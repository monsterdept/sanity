//! The `invoke` surface. Frontend ↔ Rust is Tauri commands — no server, no sidecar.

use crate::cache::Cache;
use crate::scan::{self, Memos, Progress, Scan, Scored};
use crate::surprise::HeuristicModel;
use serde::Deserialize;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// Set by `stop_scan`, cleared at the start of every scan.
///
/// A global rather than per-scan state because there is only ever one scan in flight —
/// the UI disables the button that would start a second — and a global keeps the stop
/// command from having to be handed a handle it would only ever use once.
static CANCEL: std::sync::LazyLock<Arc<AtomicBool>> =
    std::sync::LazyLock::new(|| Arc::new(AtomicBool::new(false)));
use tauri::{AppHandle, Emitter};

/// What to scan. Just a path now.
///
/// It used to carry an Ollama endpoint, model and length floor, chosen in Settings and
/// sent on every scan. All of it is gone: the model path was configuration rather than
/// revelation, and the readings an agent files through MCP are the measurement the app
/// is actually built around. The offline proxy draws the map until a reader improves it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanRequest {
    pub path: String,
}

/// Scan a repo and return the whole scored tree.
///
/// The tree is returned in one payload rather than streamed. A large repo is a few MB of
/// JSON, which the webview parses in well under a frame — and the sunburst cannot draw a
/// single ring until it knows the totals anyway, because every wedge's angle depends on
/// its siblings' lines. Streaming would buy nothing and cost the ability to render.
/// What this parser can read, and what it can do with each language.
///
/// **A static fact about the build, not about a repo**, which is why it takes no path and never
/// touches disk. The window asks once and keeps it.
///
/// It exists because three lenses go grey for three different reasons and the map cannot tell
/// them apart on its own: a function nothing calls looks like a language whose calls were never
/// parsed, and a body that never branches looks like one whose branch kinds nobody wrote. The
/// literal node-kind matching makes those loud in a test and said nothing in the app.
#[tauri::command]
pub fn languages() -> Vec<crate::parse::LangSupport> {
    crate::parse::language_support()
}

#[tauri::command]
pub async fn scan_repo(
    app: AppHandle,
    state: tauri::State<'_, crate::agentapi::Shared>,
    req: ScanRequest,
) -> Result<Scan, String> {
    let root = PathBuf::from(&req.path);
    let root_for_state = root.clone();
    if !root.is_dir() {
        return Err(format!("{} is not a directory", req.path));
    }
    // Before anything expensive. The scan that prompted this ran for minutes and wrote
    // 323MB before anyone could tell it was scanning the wrong thing.
    if scan::git_root(&root).is_none() {
        return Err(scan::not_a_repo(&root));
    }

    CANCEL.store(false, Ordering::Relaxed);

    // In the sidebar BEFORE the work starts, not after it finishes.
    //
    // The project used to be published only once the scan returned, so a long scan was
    // indistinguishable from a hang: the pane said "Walking the repo…", the sidebar stayed
    // empty, and there was nothing on screen naming what was being read. When the path
    // turned out to be wrong — a picker handing back a parent directory — nothing said so
    // for minutes. `restoring` already exists to describe a project whose scan has not
    // landed, with a progress bar; this is the same state arrived at from the other door.
    let pending_key = crate::agentapi::project_key(&root);
    {
        let mut s = crate::agentapi::lock(&state);
        let name = root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| pending_key.clone());
        s.restoring.retain(|k| k.key != pending_key);
        // **Off the declined list the moment the scan starts.** A repo whose scan was over
        // budget sits in `awaiting` with a row of its own, and `restoring` is a second list
        // that also renders a row — so pressing Scan there put the same project on screen
        // twice, the pending copy beside the declined one, under one name. The question has
        // been answered; the row that asks it goes.
        s.awaiting.remove(&pending_key);
        s.restoring.push(crate::reports::KnownProject {
            key: pending_key.clone(),
            repo: root.to_string_lossy().to_string(),
            name: name.clone(),
            touched: 0,
            files: None,
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        });
        // On DISK before the work starts too, for the same reason it is in the sidebar
        // before the work starts — see `reports::remember`. `restoring` is memory only, and
        // the index was written by `touch` when the scan returned, so a repo whose first
        // scan runs for hours was lost by any quit before it finished.
        crate::reports::remember(&pending_key, &root.to_string_lossy(), &name);
    }

    // The scan is CPU-bound and rayon-parallel, so it must never run on the async
    // runtime's threads.
    let progress_state = (*state).clone();
    let progress_key = pending_key.clone();
    let scan_started = std::time::Instant::now();
    let scanned = tauri::async_runtime::spawn_blocking(move || {
        let model = HeuristicModel;

        let emit = |p: Progress| {
            // Fed to the sidebar row as well as the pane, so the two agree about how far
            // along the same scan is.
            if let Ok(mut s) = progress_state.lock() {
                s.restoring_progress.insert(progress_key.clone(), p.clone());
            }
            // Named, like the shape batches beside it — see `scan::Tick`.
            let _ = app
                .emit("scan-progress", crate::scan::Tick { project: &progress_key, progress: &p });
        };
        // Per-function scores go out as they land so the sunburst colors in live. The
        // full tree still returns at the end — the stream is an accelerant, not the
        // source of truth, so a dropped event costs a few seconds of gray rather than a
        // permanently wrong wedge.
        let scored = |id: &str, reading: &crate::surprise::Reading| {
            let _ = app.emit(
                "scan-score",
                Scored {
                    id: id.to_string(),
                    surprise: reading.surprise,
                    hotspots: reading.hotspots.clone(),
                },
            );
        };
        // Ephemeral, always. The persistent cache existed for the model path, where a
        // scan ran for tens of minutes; the proxy recomputes the whole repo in about a
        // second, and a cache that saves nothing is a file that can only disagree with
        // the code.
        let cache = Cache::ephemeral();
        // The scan cache, by contrast, is persistent and worth having: what it memoises is
        // the tree-sitter parse and `git blame`, which recompute to exactly the same answer
        // for a file nobody touched and cost 51s an open on a large C++ tree.
        let scans = crate::scancache::ScanCache::open(&root);
        // Ordering fidelity: in the app this number is only ever a queue sort key. A
        // proxy-scored function is `Source::Proxy`, which the UI refuses to color, so
        // the all-pairs term would cost 27 of these 34 seconds to produce a value no
        // user ever sees. See `scan::Fidelity`.
        // The repo's shape, streamed a directory at a time as it parses, so the window can
        // draw the map assembling instead of a bar that cannot move. The wedges arrive grey
        // and stay grey: a scan in progress has no reading to show, and the tree the scan
        // returns replaces this one whole.
        let shape = |files: &[crate::scan::ShapeFile]| {
            let _ =
                app.emit("scan-shape", crate::scan::ShapeBatch { project: &progress_key, files });
        };
        let mut scan = scan::scan(
            &root,
            &model,
            &emit,
            &scored,
            &shape,
            &CANCEL,
            Memos { scores: &cache, scans: &scans },
            scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        )
        .map_err(|e| e.to_string())?;
        // **Somebody stood in front of the app and chose this repo**, so the commit log is
        // not work nobody invited — the same reading `sanity_open` gets. Depth 2 is still an
        // ask of its own, here as everywhere: an hour of `git blame` is not what pressing
        // Open means. See `trace::go` for the work that IS gated.
        emit(crate::scan::Progress::phase("reading the commit log"));
        crate::trace::deepen(
            &root,
            &mut scan,
            crate::trace::Depth::Files,
            &scans,
            &CANCEL,
            &|_| {},
            &|_| {},
        );
        Ok::<_, String>(scan)
    })
    .await
    .map_err(|e| e.to_string())?;

    // Off the pending list however this turned out. A row that stays "reading…" forever is
    // the failure this was added to prevent, wearing the opposite face — so it is cleared
    // before the success path decides anything, not inside it.
    {
        let mut s = crate::agentapi::lock(&state);
        s.restoring.retain(|k| k.key != pending_key);
        s.restoring_progress.remove(&pending_key);
    }

    // Banked so the next launch can price this repo from its own measurement rather than the
    // corpus default — see `reports::note_scan` and `scan::estimate`.
    if let Ok(scan) = scanned.as_ref() {
        crate::reports::note_scan(
            &pending_key,
            scan.stats.files_scanned,
            scan_started.elapsed().as_millis() as u64,
        );
    }

    // Publish as a project so an MCP client can pull a work queue from the very scan the
    // user is looking at. The window's own Open button and an agent's sanity_open land in
    // the same place — there is one list of projects, however it got filled.
    if let Ok(scan) = scanned.as_ref() {
        let mut shared = crate::agentapi::lock(&state);
        let key = crate::agentapi::project_key(&root_for_state);
        let key_path = root_for_state.clone();
        let name = root_for_state
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| key.clone());
        // Same source as the agent path: `.sanity` in the repo. This used to read the
        // machine-local store, so opening a repo from the window and opening it from an
        // agent disagreed about what had been read — the two doors into one project have
        // to land on the same assessment.
        let reports = shared
            .projects
            .get(&key)
            .map(|p| p.reports.clone())
            .unwrap_or_else(|| crate::assessment::load(&root_for_state, scan));
        // Carried across rather than rebuilt, the same way `reports` above already is —
        // see `Project::rescan` for what a fresh one destroys, and why a rescan being an
        // ordinary event is the point.
        let project = crate::agentapi::Project::rescan(
            shared.projects.get(&key),
            key_path.clone(),
            name,
            scan.clone(),
            reports,
        );
        shared.projects.insert(key.clone(), project);
        // Off the declined list, if it was on it: it has a map now, so the row's question has
        // been answered and leaving it would show a Scan button over a scanned repo.
        shared.awaiting.remove(&key);
        shared.touch(&key);
        // Focused outright, unlike the agent and headless paths. This is the window's own
        // Open command — somebody stood in front of the app and chose this repo, which is
        // the one case where taking the view is what was asked for rather than something
        // done to a pane in use.
        shared.focus(&key, true);
    }
    // Slim, like `project_scan` and for the same reason — the window asks for a file's
    // functions when it has somewhere to draw them.
    scanned.map(|s| Scan { root: s.root.slim(), stats: s.stats, links: s.links })
}

/// Replay one repo's history, commit by commit.
///
/// Separate from `scan_repo` and asked for by hand, because it is the one thing here that
/// costs real time on a large repo — a few hundred commits means re-parsing every file
/// version they touched. Nobody should pay for that on the way to looking at a map they
/// asked for.
///
/// Cached per repo, and carried forward rather than recomputed: a commit's diff is
/// immutable, so the second time this is asked the answer is a file read, and after a
/// day's work it is a file read plus the commits since. See `history::read_cached`.
///
/// Blocking, like the scan, for the same reason: tree-sitter over a few hundred file
/// versions is rayon-parallel CPU work and must never run on the async runtime's threads.
#[tauri::command]
pub async fn scan_history(
    app: AppHandle,
    path: String,
    limit: Option<usize>,
    // `trace`: walk the commits this repo has not walked yet, which is minutes on a large
    // repo and an hour on ceph. Omitted or false means "hand me what is already banked" —
    // see `history::stored`.
    //
    // **Two doors rather than one, because the cost is the difference.** This command used
    // to always bring the timeline up to date, so the button that OPENS History was also the
    // button that starts an hour of parsing, and there was no way to look at a trace
    // somebody had already taken without extending it first.
    trace: Option<bool>,
    // `fresh`: throw the stored timeline away first, so the walk starts from nothing. A trace
    // is otherwise idempotent — it appends what is new and returns — which is right for
    // keeping one current and useless for "do it again with this build".
    fresh: Option<bool>,
) -> Result<usize, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }
    let limit = limit.unwrap_or(crate::history::ALL_COMMITS);
    tauri::async_runtime::spawn_blocking(move || -> Result<usize, String> {
        if fresh == Some(true) {
            crate::history::forget(&root, limit);
        }
        // **The count, not the timeline.** Returning the story is what made a large repo
        // unopenable: 122,792 frames is over a hundred megabytes of JSON, and the window
        // parsed all of it to draw one frame. It asks for what it needs now — see
        // `history_tables` and the two window commands below it.
        if trace != Some(true) {
            return Ok(crate::history::stored(&root, limit).map(|s| s.commits.len()).unwrap_or(0));
        }
        // **The claim is the guard, and it is taken here rather than asked for by the
        // window.** A second walk over one repo is not half the speed each, it is twice the
        // time each and neither finishes — and the caller that would start one is a window
        // that has forgotten the first, which is a reload away at any moment. Refused with a
        // sentence rather than silently joined: the row has a Cancel on it, and "your press
        // did nothing because something you cannot see is already running" is exactly the
        // shape of message this app owes somebody.
        let Some(claim) = crate::history::Tracing::claim(&root) else {
            return Err(format!(
                "{} is already being traced — the row shows how far along it is",
                root.display()
            ));
        };
        let emit = |p: Progress| {
            // Recorded before it is emitted, so anything that asks between two ticks gets
            // the same answer the event carried. The window's copy is a convenience; this
            // one is what a reloaded window, a second window and the sidebar all read.
            claim.at(&p);
            let _ = app.emit("history-progress", p);
        };
        // **Rate-limited, because the trace now reports per commit from its first second.**
        // The log read ticks once per commit and the walk ticks again, so an unbounded window
        // on a large repo is millions of events crossing to the webview from the thread doing
        // the work. See `scan::throttled`, which never drops a phase change or a final tick.
        let emit = crate::scan::throttled(&emit);
        Ok(crate::history::read_cached(&root, limit, &emit).commits.len())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The tables a timeline is drawn from — paths, languages, functions, the opening state.
///
/// Sent once when History opens, and never again: everything per-commit is fetched in
/// windows by the two commands below. See the note above `history::LOADED`.
#[tauri::command]
pub fn history_tables(path: String) -> Option<crate::history::Tables> {
    crate::history::tables(&PathBuf::from(path))
}

/// `count` log rows from `offset`, for the list beside the map. `scope` narrows it to the
/// commits that touched a directory, the way drilling does.
#[tauri::command]
pub fn history_log(
    path: String,
    offset: usize,
    count: usize,
    scope: Option<String>,
) -> Vec<crate::history::LogRow> {
    crate::history::log(&PathBuf::from(path), offset, count, scope.as_deref().unwrap_or(""))
}

/// The repo's remote, as `owner/name`, or nothing.
///
/// **For the caption on an exported movie, which is the only caller and the reason the
/// answer is a slug rather than a URL.** A directory's basename is what the app calls a
/// project, and it is the wrong name to publish: half the interesting repos on a machine are
/// called `src`, `main` or the same word as somebody else's. The remote is the name the repo
/// answers to in public.
///
/// Both URL shapes, because both are what `origin` actually holds — scp-form
/// (`git@host:owner/name.git`) and a URL (`https://host/owner/name`). The last two segments
/// rather than a host-aware parse: a GitLab subgroup is deeper and still reads correctly as
/// the two names nearest the end, and nothing here needs to know which forge it is looking
/// at. `origin` first, then whatever remote there is, then nothing — a repo with no remote,
/// or no git at all, captions with its own name and the export never mentions it.
#[tauri::command]
pub fn repo_remote(path: String) -> Option<String> {
    let repo = PathBuf::from(path);
    let git = |args: &[&str]| -> Option<String> {
        let out =
            std::process::Command::new("git").arg("-C").arg(&repo).args(args).output().ok()?;
        if !out.status.success() {
            return None;
        }
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        (!s.is_empty()).then_some(s)
    };
    let url = git(&["remote", "get-url", "origin"]).or_else(|| {
        let first = git(&["remote"])?;
        let first = first.lines().next()?.trim().to_string();
        git(&["remote", "get-url", &first])
    })?;
    slug_of(&url)
}

/// `owner/name` out of a remote URL. Separate from its caller so it can be tested without a
/// repo to point at.
fn slug_of(url: &str) -> Option<String> {
    let url = url.trim().trim_end_matches('/');
    let url = url.strip_suffix(".git").unwrap_or(url);
    // scp-form has no scheme and puts the path after a colon; a URL puts it after the host.
    // Replacing the colon covers the first and leaves the second alone, since a port would
    // have to be numeric and no segment below is.
    let tail = url.rsplit(['/', ':']).take(2).collect::<Vec<_>>();
    if tail.len() < 2 {
        return None;
    }
    let (name, owner) = (tail[0], tail[1]);
    if name.is_empty() || owner.is_empty() || owner.contains("://") {
        return None;
    }
    Some(format!("{owner}/{name}"))
}

/// The frame indices in `scope` — what the transport addresses when the map is drilled.
#[tauri::command]
pub fn history_scoped(path: String, scope: Option<String>) -> Vec<u32> {
    crate::history::scoped(&PathBuf::from(path), scope.as_deref().unwrap_or(""))
}

/// The deltas for frames `[from, from + count)`, for a caller folding the map forward.
#[tauri::command]
pub fn history_deltas(path: String, from: usize, count: usize) -> Vec<serde_json::Value> {
    crate::history::deltas(&PathBuf::from(path), from, count)
}

/// Functions `[from, from + count)` — see `history::funcs` for why a prefix is enough.
#[tauri::command]
pub fn history_funcs(path: String, from: usize, count: usize) -> Vec<crate::history::HistoryFunc> {
    crate::history::funcs(&PathBuf::from(path), from, count)
}

/// Top up this repo's timeline, if it already has one.
///
/// Called when a project comes on screen. It is deliberately incapable of building a
/// timeline from nothing — see `history::warm`. Fire-and-forget from the frontend: the
/// answer is only ever "there was one and it is current now", which changes nothing on
/// screen and everything about how long History takes to open.
#[tauri::command]
pub async fn warm_history(path: String) -> bool {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return false;
    }
    tauri::async_runtime::spawn_blocking(move || {
        crate::history::warm(&root, crate::history::ALL_COMMITS)
    })
    .await
    .unwrap_or(false)
}

/// What reading this repo's history would cost, before it is added or opened.
///
/// Free: nothing walks the log to answer it — see `trace::estimate`, which prices a repo
/// nobody has walked here from its packed object count. That is what lets the add dialog show
/// this repo's own numbers instead of a general warning about large repositories.
#[tauri::command]
pub async fn estimate_trace(path: String) -> Result<crate::trace::Estimate, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }
    tauri::async_runtime::spawn_blocking(move || crate::trace::estimate(&root))
        .await
        .map_err(|e| e.to_string())
}

/// Whether the add dialog explains itself — see `KnownProjects::explain_trace`.
#[tauri::command]
pub fn explain_trace() -> bool {
    crate::reports::explain_trace()
}

/// Remember that somebody has read the explanation, or wants it back.
#[tauri::command]
pub fn set_explain_trace(explain: bool) {
    crate::reports::set_explain_trace(explain)
}

/// Read more of the open repo's history, because the person asked for it.
///
/// The window's half of `/trace`. What it returns is how long it took, so the row can say what
/// the estimate turned out to be worth — an estimate nobody ever checks is a number that
/// drifts, and this is the only place the app finds out whether its own arithmetic was close.
#[tauri::command]
pub async fn trace_project(
    state: tauri::State<'_, crate::agentapi::Shared>,
    path: String,
    depth: Option<String>,
) -> Result<f32, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }
    let key = crate::agentapi::project_key(&root);
    let at = {
        let s = crate::agentapi::lock(&state);
        s.projects.get(&key).map(|p| p.trace.depth).unwrap_or_default()
    };
    let want = match depth.as_deref() {
        Some("files") => crate::trace::Depth::Files,
        Some("lines") => crate::trace::Depth::Lines,
        Some("edits") => crate::trace::Depth::Edits,
        // **One rung at a time, and the ladder now has four.** Asking for the next depth is
        // what the Trace button means; jumping from nothing to the timeline would charge
        // somebody a minute of walking for a press that has always meant "read the log".
        _ => match at {
            crate::trace::Depth::Untraced => crate::trace::Depth::Files,
            crate::trace::Depth::Files => crate::trace::Depth::Lines,
            _ => crate::trace::Depth::Edits,
        },
    };
    let (mut scan, stop) = {
        let mut s = crate::agentapi::lock(&state);
        let p = s.projects.get_mut(&key).ok_or("that project is not open")?;
        // Cleared on the way in, never on the way out — a flag left set by the last stop would
        // make this one refuse to do anything and read as a button that did nothing.
        p.trace.stop.store(false, std::sync::atomic::Ordering::Relaxed);
        p.trace.running = Some(crate::scan::Progress::phase("reading the commit log"));
        // **A price is what a phase offers when nothing is happening, so starting retires it.**
        // `pending` means "declined for cost, waiting to be asked" — and somebody has now
        // asked. Left set, it is a second answer to "what is this phase doing" that outlives
        // the question, and the window has to know to prefer the other one. Same move
        // `scan_repo` makes with a declined scan when the scan starts.
        p.trace.pending = None;

        (p.scan.clone(), p.trace.stop.clone())
    };
    let traced = root.clone();
    let started = std::time::Instant::now();
    let ticking = (*state).clone();
    let ticking_key = key.clone();
    let (scan, (reached, resolved, considered)) = tauri::async_runtime::spawn_blocking(move || {
        let scans = crate::scancache::ScanCache::open(&traced);
        // **The phase, its unit and its chamber all come from `deepen`.** They were built here,
        // and at four other call sites, which is five copies of one pass's own vocabulary — and
        // the copies had already diverged into two that reported nothing at all. What a step is
        // called is the step's business.
        let traced_to = crate::trace::deepen(
            &traced,
            &mut scan,
            want,
            &scans,
            &stop,
            &|progress| {
                let mut s = crate::agentapi::lock(&ticking);
                if let Some(p) = s.projects.get_mut(&ticking_key) {
                    p.trace.running = Some(progress);
                }
            },
            // **Each chunk of blame reaches the map while the pass is still running.**
            // `scanned` is what the window watches to refetch a tree, so bumping it is the
            // whole of "show this now" — see `trace::PUBLISH_STEPS` for why there are ten
            // of these and not one a second.
            &|snapshot| {
                let mut s = crate::agentapi::lock(&ticking);
                if let Some(p) = s.projects.get_mut(&ticking_key) {
                    p.scan = snapshot.clone();
                    p.scanned = p.scanned.wrapping_add(1);
                }
            },
        );
        (scan, traced_to)
    })
    .await
    .map_err(|e| e.to_string())?;

    let mut s = crate::agentapi::lock(&state);
    let project = s.projects.get_mut(&key).ok_or("that project is not open")?;
    project.scan = scan;
    // **The depth the pass REACHED, which the pass is the only thing that knows.** This used to
    // be the depth asked for, corrected here by reading the stop flag — right while a stop
    // could only land inside the blame pass, and wrong the moment the log walk became
    // interruptible too, where it would have banked a walk that folded nothing as `files`.
    let resolved = (resolved, considered);
    project.trace = crate::agentapi::TraceState { depth: reached, resolved, ..Default::default() };
    // Banked, so reopening the app restores what this press bought rather than asking for it
    // again — see `KnownProject::trace_depth`.
    crate::reports::note_trace(&key, reached.tag_str());
    // And banked in the MAP, so the next launch draws the history rather than re-deriving it
    // behind a picture that has none — see `treecache::redraw`. The depth note above says this
    // repo was traced; without this the tree on disk says otherwise.
    if reached != crate::trace::Depth::Untraced {
        crate::treecache::redraw(&root, &project.scan);
    }
    project.scanned = project.scanned.wrapping_add(1);
    Ok(started.elapsed().as_secs_f32())
}

/// Stop a running trace. What it read is kept.
#[tauri::command]
pub fn stop_trace(state: tauri::State<'_, crate::agentapi::Shared>, path: String) -> bool {
    let key = crate::agentapi::project_key(&PathBuf::from(&path));
    let s = crate::agentapi::lock(&state);
    s.projects
        .get(&key)
        .map(|p| p.trace.stop.store(true, std::sync::atomic::Ordering::Relaxed))
        .is_some()
}

/// The text of one file in the open repo, for the code view.
///
/// Joined onto the repo root and then checked to still be inside it, because `rel_path`
/// arrives from the webview: `../../.ssh/id_rsa` is a valid relative path and this
/// command would otherwise read it. Canonicalising both sides is what makes the check
/// hold against symlinks and `..` alike.
///
/// Capped, because the view renders a span per line and a vendored bundle would freeze
/// the window rather than show anything useful.
#[tauri::command]
pub async fn read_source(repo: String, rel_path: String) -> Result<String, String> {
    const MAX_BYTES: u64 = 2 * 1024 * 1024;
    tauri::async_runtime::spawn_blocking(move || {
        let root =
            PathBuf::from(&repo).canonicalize().map_err(|e| format!("repo unreadable: {e}"))?;
        let full = root.join(&rel_path).canonicalize().map_err(|e| format!("no such file: {e}"))?;
        if !full.starts_with(&root) {
            return Err("outside the open repo".into());
        }
        let meta = std::fs::metadata(&full).map_err(|e| e.to_string())?;
        if meta.len() > MAX_BYTES {
            return Err(format!("{} is too large to display", rel_path));
        }
        std::fs::read_to_string(&full).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Open one file's code view in a window of its own.
///
/// The modal is for a glance; this is for reading beside something else, or on a second
/// screen. The window loads the same bundle with `?code=` set, and the app renders only
/// the code view when it sees it — one entry point, two shapes, rather than a second
/// build.
///
/// Labels are derived from the path and sanitised: Tauri labels must be unique and
/// allow only a restricted character set, and a path contains neither guarantee.
#[tauri::command]
pub fn open_code_window(
    app: tauri::AppHandle,
    repo: String,
    rel_path: String,
) -> Result<(), String> {
    use tauri::{WebviewUrl, WebviewWindowBuilder};

    let label: String = format!("code-{rel_path}")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect();

    // Already open: focus it rather than stacking a second copy of the same file.
    if let Some(w) = tauri::Manager::get_webview_window(&app, &label) {
        let _ = w.set_focus();
        return Ok(());
    }

    // Encoded by hand rather than pulling in a crate for two strings. Only the
    // characters that would break a query string are escaped — a path can legally
    // contain any of them, and `#` in particular would silently truncate the URL.
    let esc = |v: &str| {
        v.bytes()
            .map(|b| match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                    (b as char).to_string()
                }
                _ => format!("%{b:02X}"),
            })
            .collect::<String>()
    };
    let url = format!("index.html?code={}&repo={}", esc(&rel_path), esc(&repo));
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(url.into()))
        .title(&rel_path)
        .inner_size(900.0, 800.0)
        .min_inner_size(420.0, 320.0);

    // Same overlay titlebar AND the same traffic-light inset as the main window. Without
    // the inset these windows got the macOS default, which sits at a different offset
    // from every other window in the department — the whole reason that constant exists.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(
            crate::TRAFFIC_LIGHTS.0,
            crate::TRAFFIC_LIGHTS.1,
        ));

    builder.build().map(|_| ()).map_err(|e| e.to_string())
}

/// Readings for one project — the one the WINDOW is showing, which is not always the one an
/// agent last opened.
///
/// Polled rather than pushed: an agent reports every several seconds at best, so a poll
/// costs nothing and avoids threading an AppHandle into the loopback server purely to emit
/// events.
///
/// This used to answer for `active` only. The moment a second project existed that was
/// wrong: an agent opening a repo makes it active, so the window — still showing the
/// first — began receiving the second's readings, whose ids match nothing in the tree on
/// screen. Switching back through the sidebar loads a fresh proxy-scored tree from here,
/// and the readings that would have recolored it were never sent. A repo with a thousand
/// assessed functions rendered entirely gray while the sidebar counted them.
#[tauri::command]
pub fn agent_reports(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: Option<String>,
) -> Vec<crate::agentapi::Report> {
    let s = crate::agentapi::lock(&state);
    let Some(key) = key.or_else(|| s.active.clone()) else {
        return Vec::new();
    };
    s.projects
        .get(&key)
        .map(|p| {
            // **What the window cannot work out for itself: how big each read function is,
            // and whether the reading has expired.** Both need the live tree, which the
            // window has only in part — a large repo arrives without its functions. Built
            // once per poll rather than per report, and not at all for a repo nobody has
            // read, which is the common case and the expensive one: the walk is proportional
            // to the repo and the reports are proportional to the reading somebody has done.
            let mut live: std::collections::HashMap<&str, (Option<&str>, Option<u32>, u32)> =
                std::collections::HashMap::new();
            if !p.reports.is_empty() {
                p.scan.root.visit(&mut |n| {
                    if n.kind == crate::model::NodeKind::Func {
                        live.insert(n.id.as_str(), (n.body.as_deref(), n.bytes, n.loc));
                    }
                });
            }
            p.reports
                .values()
                .cloned()
                .map(|mut r| {
                    // A reading whose function is gone reports `loc: 0` and is dropped by the
                    // window — it is not stale, it is about code that no longer exists, and
                    // the two are different facts.
                    let found = live.get(r.id.as_str()).copied();
                    r.loc = found.map(|(_, _, loc)| loc).unwrap_or(0);
                    r.stale = found
                        .map(|(body, bytes, _)| crate::assessment::is_stale(&r, body, bytes))
                        .unwrap_or(false);
                    // Stamped on the way out, never stored: `legible_dated` is a judgement
                    // THIS build makes about a fact the file records, so it has to be
                    // recomputed every time the constants move. Writing it into `.sanity/`
                    // would freeze one build's opinion into the store and make the next
                    // bump invisible.
                    r.legible_dated = !crate::assessment::legible_current(r.spec);
                    // **Only a `true` expires.** Spec 3 narrowed what counts as a trap —
                    // a hazard the code already warns about stopped being one — and a
                    // narrowing can only turn old trues into falses, never the other way
                    // round. So a reader that looked under the old question and found
                    // nothing has still found nothing under this one, and greying its
                    // answer would throw away 855 clear readings in this repo alone to
                    // re-ask a question whose answer cannot have changed.
                    r.trap_dated = r.trap && !crate::assessment::trap_current(r.spec);
                    r
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Whether an agent is working right now.
///
/// "Recently" is sixty seconds: an agent predicting a function, opening a file and
/// writing a report goes quiet for tens of seconds at a time, and a shorter window would
/// have the indicator flickering between working and asleep during one continuous batch.
#[derive(serde::Serialize)]
pub struct AgentCall {
    /// Which ping this was. The window replays only the ones above the last it saw, so a
    /// burst inside one poll interval animates as a burst rather than as its last frame.
    seq: u64,
    tool: String,
}

#[derive(serde::Serialize)]
pub struct AgentActivity {
    active: bool,
    tool: String,
    nonce: u64,
    events: Vec<AgentCall>,
}

#[tauri::command]
pub fn agent_activity(state: tauri::State<'_, crate::agentapi::Shared>) -> AgentActivity {
    const IDLE_AFTER: std::time::Duration = std::time::Duration::from_secs(60);
    let s = crate::agentapi::lock(&state);
    AgentActivity {
        active: s.last_agent.is_some_and(|t| t.elapsed() < IDLE_AFTER),
        tool: s.last_tool.clone(),
        nonce: s.pings,
        events: s
            .recent
            .iter()
            .map(|(seq, tool)| AgentCall { seq: *seq, tool: tool.clone() })
            .collect(),
    }
}

/// What the window should be showing, and everything else on offer.
///
/// Polled by the frontend so an agent calling `sanity_open` switches the window with no
/// click anywhere. That is the whole point of the inversion: the session that knows which
/// repo you are in should be the thing that decides what is on screen.
#[tauri::command]
pub fn projects(state: tauri::State<'_, crate::agentapi::Shared>) -> crate::agentapi::ProjectList {
    crate::agentapi::ProjectList::from_state(&crate::agentapi::lock(&state))
}

/// The full scored tree for one project, fetched when the window switches to it.
#[tauri::command]
pub fn project_scan(state: tauri::State<'_, crate::agentapi::Shared>, key: String) -> Option<Scan> {
    // **Without the functions.** See `Node::slim`: ceph's tree is 75MB of JSON, almost all
    // of it functions the map cannot draw, and the window spent five seconds parsing it
    // before anything appeared. A file's own ring arrives when something asks for it.
    let mut s = crate::agentapi::lock(&state);
    if let Some(p) = s.projects.get(&key) {
        return Some(Scan {
            root: p.scan.root.slim(),
            stats: p.scan.stats.clone(),
            links: p.scan.links.clone(),
        });
    }
    // Not loaded, and somebody is looking at it: scan this one next — see `AppState::wanted`.
    // This command is what the window calls when it switches project, which makes it the one
    // signal that means "this is the one I want" rather than "this is where I was last time".
    s.wanted = Some(key.clone());
    // Still being scanned, but a previous run left a map — see `AppState::shallow`. Answering
    // with it is what lets a launch draw before the whole tree has been decoded; the row goes
    // on saying the project is loading, because it is.
    if let Some(drawn) = s.shallow.get(&key) {
        return Some(drawn.clone());
    }
    // **Not yet reached by the restore, which is not the same as having nothing to show.**
    // The restore scans one repo at a time and publishes each cached map as it gets to that
    // repo — so a small project queued behind a large one had no `shallow` entry and answered
    // with nothing, for as long as the large one took. Clicking it showed an empty pane while
    // a complete map of it sat on disk. That is the wait being charged to the wrong project:
    // what is queued is its RESCAN, and the rescan is not what somebody clicking it wants.
    //
    // Decoded here rather than up front, because the rule this sits under is that a launch
    // must not decode what nobody is looking at — and this runs precisely when somebody is.
    // It is not stored in `shallow`: the lock is held for reading, the restore owns that map,
    // and re-decoding on a second click costs a fraction of a second against the seconds this
    // saves. Dropping the guard to take it for writing would also let the real project land
    // in between, and answering with the cache after that is answering with the older thing.
    drop(s);
    let repo = crate::reports::load_index().projects.into_iter().find(|p| p.key == key)?.repo;
    crate::treecache::stale(&PathBuf::from(repo))
}

/// One file's functions, for the ring inside its wedge.
///
/// Asked for as the map needs them — a file wide enough to draw an inside, or one somebody
/// has drilled into or opened the code of. The whole repo's worth is what `project_scan`
/// stopped sending.
#[tauri::command]
pub fn file_functions(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    paths: Vec<String>,
) -> std::collections::HashMap<String, Vec<crate::model::Node>> {
    let want: std::collections::HashSet<String> = paths.into_iter().collect();
    crate::agentapi::lock(&state)
        .projects
        .get(&key)
        .map(|p| p.scan.root.functions_of(&want))
        .unwrap_or_default()
}

/// Every place a name appears on the map, best first.
///
/// **Asked of the backend rather than of the tree in the window**, and that is the whole
/// reason this command exists — see [`crate::search`]. A window holding a slimmed tree has no
/// function names at all, so the search somebody types would come back empty on exactly the
/// repos big enough to need one.
///
/// Empty for a project that has never been scanned, which is the same answer as "nothing
/// matched" and is honest in both directions: there is no map to find anything on yet.
#[tauri::command]
pub fn search_project(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    query: String,
    limit: usize,
) -> Vec<crate::search::Hit> {
    crate::agentapi::lock(&state)
        .projects
        .get(&key)
        .map(|p| crate::search::find(&p.scan.root, &query, limit))
        .unwrap_or_default()
}

/// What the map is telling you to do: the finding catalog, run against this project.
///
/// **Answered by the backend for the reason [`search_project`] is** — a window holding a
/// slimmed tree has no function names and no call counts, so a browser-side pass would come
/// back empty on exactly the repos worth asking about, and would be a confident picture of
/// whatever the window happened to fetch. See `rings.md`, where a histogram over a biased
/// sample is written up at length; a finding is worse, because it names one function.
///
/// Empty for a project that has never been scanned. Every OTHER absence is reported inside
/// the group as [`crate::findings::Group::blocked`], because a rule that cannot answer must not
/// be drawn as a rule that found nothing.
/// Everything the findings panel and the mascot need, from ONE walk of the tree.
///
/// **It was three commands and it is one because they are one answer.** `project_findings`,
/// `project_rules` and `rule_grammar` each built the whole fact set for themselves — three
/// walks, three sets of one record per function, all three under the projects lock so they
/// serialised. On kibana that is 540,000 records to answer three questions about one repo,
/// and it is what made opening it slow.
///
/// Nothing is cached to fix that, and nothing should be: a cache here needs a key that moves
/// whenever the tree or the readings do, and the failure mode of getting that key wrong is a
/// panel confidently describing a repo as it was. Asking once is the version with no key.
///
/// It also removes a way for the three to disagree. The counts in the grid, the tiles in the
/// list and the number on the creature now come from one set of facts by construction rather
/// than from three fetches that happen to be issued together.
#[tauri::command]
pub fn project_report(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
) -> crate::findings::ProjectReport {
    let started = std::time::Instant::now();
    let mut st = crate::agentapi::lock(&state);
    let Some(p) = st.projects.get(&key) else { return Default::default() };

    // **Served from the last one where the repo has not moved.** Switching to a project the
    // window has already looked at should cost nothing: the report is a walk of every subject,
    // a calibration per rule, a hit set per rule and a distribution per field — a second and a
    // half on kibana in a dev build, and it was being paid every time a project became active
    // on top of the scan and the trace that had already been paid for.
    //
    // The key is derived from the four things a report is made of, so nothing has to remember
    // to invalidate it — see `FindingsAt`.
    let at = crate::agentapi::FindingsAt::of(p);
    if let Some((was, report)) = &p.findings {
        if *was == at {
            said(&key, "cached", started);
            return report.clone();
        }
    }

    let traced = crate::findings::Traced {
        // What the map itself knows: whether anybody has read the log yet. NOT
        // `stats::without_history`, which is true for an untraced repo as well as for one
        // with no history — the two absences must never render alike, and here they would
        // both come out as "no git history" over a repo whose trace simply has not run.
        git: p.trace.depth != crate::trace::Depth::Untraced,
        churned: p.scan.stats.churned,
        blamed: p.trace.depth >= crate::trace::Depth::Lines,
    };
    // **This repo's own thresholds, not the catalog's shipped ones.** A shipped constant is
    // wrong nearly everywhere — `loc >= 200` is eight findings on htop and 2,292 on kibana — so
    // the numbers are calibrated against the repo the first time it is asked and then saved
    // and left alone. Saved is what makes the list drainable; see `findings::rules_for`.
    let facts = crate::findings::subjects(&p.scan.root, &p.reports, traced);
    let rules = crate::findings::rules_for(&p.repo, &facts);
    let read = !p.reports.is_empty();
    let fresh = crate::findings::ProjectReport {
        groups: crate::findings::report(
            &facts,
            traced,
            read,
            &rules,
            // Read from the repo on every ask rather than held in state. The archive is small,
            // it is a file somebody may well have edited by hand or merged from a branch, and a
            // cached copy is how the panel comes to disagree with `.sanity/` about what has
            // been dismissed — which is the one thing this store must never do.
            &crate::findings::archive(&p.repo),
        ),
        rules: crate::findings::rules_view(&p.repo, &facts, traced, read),
        grammar: crate::findings::grammar(&facts),
    };

    // Stored against the key it was taken at, which is re-read rather than reused: computing
    // the report may have WRITTEN `catalog.md`, since `rules_for` calibrates and saves on
    // first sight. Keeping the earlier key would mark the cache stale the moment it was
    // filled, and every switch would pay again.
    if let Some(p) = st.projects.get_mut(&key) {
        p.findings = Some((crate::agentapi::FindingsAt::of(p), fresh.clone()));
    }
    said(&key, "computed", started);
    fresh
}

/// What a report cost, on stderr, in a dev build only.
///
/// **Because "the switch is slow" is not a measurement and neither is a guess about why.**
/// Two quadratic passes and a per-clause sort hid in here for a week behind reasoning that
/// sounded right, and the bench written to catch them could not see them. A line per call
/// says which project, whether it was served or computed, and how long it took — which is the
/// difference between fixing this and fixing something else.
///
/// `debug_assertions` because it is a development instrument: a shipped build should not
/// narrate itself, and `just dev` is where somebody is watching.
#[cfg(debug_assertions)]
fn said(key: &str, how: &str, at: std::time::Instant) {
    eprintln!("findings: {key} {how} in {:?}", at.elapsed());
}

#[cfg(not(debug_assertions))]
fn said(_key: &str, _how: &str, _at: std::time::Instant) {}

/// The pin for one finding, as the code stands right now — see [`crate::findings::pin_of`].
///
/// Its own function because dismissing and restoring both need it and both need it to be the
/// SAME string: a pin computed two ways is a dismissal that never matches, which would show
/// as a finding somebody dismissed reappearing immediately.
fn finding_pin(
    st: &crate::agentapi::AppState,
    project: &str,
    key: &str,
    rule: &str,
) -> Result<(std::path::PathBuf, String, String), String> {
    let p = st.projects.get(project).ok_or("that project is not open")?;
    let traced = crate::findings::Traced {
        git: p.trace.depth != crate::trace::Depth::Untraced,
        churned: p.scan.stats.churned,
        blamed: p.trace.depth >= crate::trace::Depth::Lines,
    };
    let facts = crate::findings::subjects(&p.scan.root, &p.reports, traced);
    // The repo's rules, not the shipped ones: a pin records the values the rule MEASURED, and
    // one computed against a different threshold is a dismissal that never matches.
    let rules = crate::findings::rules_for(&p.repo, &facts);
    // By id, which is what the window sends and what the archive is keyed on — a title is
    // prose and may have been reworded since.
    let r = rules.iter().find(|r| r.id == rule).ok_or("no rule by that id")?;
    let f = facts.iter().find(|f| f.subject.key == key).ok_or("that finding is not on the map")?;
    Ok((p.repo.clone(), crate::findings::pin_of(r, f), r.title.to_string()))
}

/// Write one rule back, by id: a changed threshold, a floor, a silence, or a rule of
/// somebody's own.
///
/// **The whole catalog is rewritten, because the file is a complete statement of what runs.**
/// Editing one line in place would mean a second writer that has to agree with `save_rules`
/// about the format, and the two would drift the first time a field was added.
///
/// A rule the file does not mention still runs, so silencing has to be said: `on: false`
/// writes `off` rather than dropping the line.
#[tauri::command]
pub fn save_rule(
    state: tauri::State<'_, crate::agentapi::Shared>,
    project: String,
    rule: crate::findings::RuleEdit,
) -> Result<(), String> {
    let (repo, facts, traced) = project_facts(&state, &project)?;
    let mut live = crate::findings::rules_for(&repo, &facts);
    let _ = traced;
    crate::findings::apply_edit(&mut live, rule)?;
    crate::findings::save_rules(&repo, &live).map_err(|e| e.to_string())
}

/// Take a rule out: a rule of somebody's own is deleted, a built-in is silenced.
///
/// **A built-in cannot be deleted**, because a later release would ship it again and the
/// person who removed it would find it back with no record of their having said otherwise.
#[tauri::command]
pub fn delete_rule(
    state: tauri::State<'_, crate::agentapi::Shared>,
    project: String,
    id: String,
) -> Result<(), String> {
    let (repo, facts, _) = project_facts(&state, &project)?;
    let mut live = crate::findings::rules_for(&repo, &facts);
    live.retain(|r| r.id != id);
    crate::findings::save_rules(&repo, &live).map_err(|e| e.to_string())
}

/// Put a rule back the way the catalog ships it, and re-suggest its threshold.
#[tauri::command]
pub fn reset_rule(
    state: tauri::State<'_, crate::agentapi::Shared>,
    project: String,
    id: String,
) -> Result<(), String> {
    let (repo, facts, _) = project_facts(&state, &project)?;
    let mut live = crate::findings::rules_for(&repo, &facts);
    let shipped = crate::findings::catalog();
    let Some(fresh) = shipped.iter().find(|r| r.id == id) else {
        return Err("that rule is not one of sanity's own".into());
    };
    let tuned = crate::findings::calibrated(std::slice::from_ref(fresh), &facts);
    match live.iter().position(|r| r.id == id) {
        Some(at) => live[at] = tuned[0].clone(),
        // Silenced, and being reset — which is how a rule comes back on.
        None => live.push(tuned[0].clone()),
    }
    crate::findings::save_rules(&repo, &live).map_err(|e| e.to_string())
}

/// The three things every rule write needs, read under one lock.
fn project_facts(
    state: &tauri::State<'_, crate::agentapi::Shared>,
    project: &str,
) -> Result<(std::path::PathBuf, Vec<crate::findings::Facts>, crate::findings::Traced), String> {
    let st = crate::agentapi::lock(state);
    let p = st.projects.get(project).ok_or("that project is not open")?;
    let traced = crate::findings::Traced {
        git: p.trace.depth != crate::trace::Depth::Untraced,
        churned: p.scan.stats.churned,
        blamed: p.trace.depth >= crate::trace::Depth::Lines,
    };
    Ok((p.repo.clone(), crate::findings::subjects(&p.scan.root, &p.reports, traced), traced))
}

/// Record what somebody decided about a finding.
///
/// **Keyed by `key_of` and by the rule's ID, and pinned to the state the code was in** — see
/// [`crate::findings::pin_of`]. A `fine-for-now` expires when the body or the numbers the rule
/// measured move, because "this is fine" was said about something that is no longer there; a
/// `fine-always` is about the subject rather than a version of it and does not.
///
/// The `Result` is read back off disk before it is returned — nothing here is gated on a write
/// having returned `Ok`, which is what the migration that destroyed a project's readings did.
#[tauri::command]
pub fn decide_finding(
    state: tauri::State<'_, crate::agentapi::Shared>,
    project: String,
    key: String,
    rule: String,
    verdict: crate::findings::Verdict,
    reason: String,
) -> Result<(), String> {
    let (repo, pin, title) = {
        let st = crate::agentapi::lock(&state);
        finding_pin(&st, &project, &key, &rule)?
    };
    let d = crate::findings::Decision {
        key,
        rule,
        title,
        verdict,
        pin,
        reason,
        when: crate::assessment::now_iso(),
        by: crate::assessment::who(&repo),
    };
    // The error is returned rather than swallowed: a panel that stops drawing a finding on the
    // strength of a write it never checked is claiming something it does not know.
    crate::findings::decide(&repo, d).map_err(|e| e.to_string())
}

/// Take a decision back, returning the finding to the list.
#[tauri::command]
pub fn undecide_finding(
    state: tauri::State<'_, crate::agentapi::Shared>,
    project: String,
    key: String,
    rule: String,
) -> Result<(), String> {
    let repo = {
        let st = crate::agentapi::lock(&state);
        st.projects.get(&project).map(|p| p.repo.clone()).ok_or("that project is not open")?
    };
    crate::findings::undecide(&repo, &key, &rule).map_err(|e| e.to_string())
}

/// Everything decided in this repo, newest first.
///
/// **Including entries whose pin has moved.** An expired `fine-for-now` is not deleted — the
/// finding it was about is already back in the list, and the row here is the record of somebody
/// having once looked at it.
#[tauri::command]
pub fn project_decisions(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
) -> Vec<crate::findings::Decision> {
    let st = crate::agentapi::lock(&state);
    let Some(p) = st.projects.get(&key) else { return Vec::new() };
    let mut all = crate::findings::archive(&p.repo);
    all.sort_by(|a, b| b.when.cmp(&a.when));
    all
}

/// What one function is connected to: its callers, what it calls, and its clone group./// What one function is connected to: its callers, what it calls, and its clone group.
///
/// **Asked for on selection, never sent with the tree.** The lists are the edges the Callers,
/// Reach and Clones counts are made of — see [`crate::links`] — and shipping every function's
/// with the map would be megabytes of function names to answer a question about the one wedge
/// somebody clicked.
///
/// `None` where the table has never been built (a project drawn from a slim cached tree
/// before its scan has run) or where the scan holds no function starting at that line. Those
/// are different absences and the panel says which: an empty table is [`Related::wired`]
/// false with nothing in it, and a missing function is nothing at all.
#[tauri::command]
pub fn function_links(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    path: String,
    line: u32,
) -> Option<crate::links::Related> {
    let s = crate::agentapi::lock(&state);
    let p = s.projects.get(&key)?;
    p.scan.links.at(&path, line)
}

/// Every decision point in one function, and what they add up to.
///
/// **Re-parsed on demand, from the working tree, not read out of the scan.** The sites are
/// not stored anywhere — see `parse::forks_at` for why putting them on `FuncDef` would be two
/// format bumps and a list per function in every repo's cache, to serve a pane that shows one
/// function at a time.
///
/// It follows that this can disagree with the map, and that is the right way round: the panel
/// is showing you the file as it is now, exactly as the doc, the blame and the neighbour
/// snippets on that same pane already do. The count here is the count of what you are reading.
///
/// `None` for a language with no branch table, a file that has moved out from under the scan,
/// or a path outside the repo. All three are absences the panel states rather than an empty
/// list, which would read as a body that never forks.
#[tauri::command]
pub async fn function_forks(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    path: String,
    line: u32,
) -> Result<Option<Forks>, String> {
    let repo = {
        let s = crate::agentapi::lock(&state);
        match s.projects.get(&key) {
            Some(p) => p.repo.clone(),
            None => return Ok(None),
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        // Canonicalised and checked exactly as `read_source` and `function_sources` do. A path
        // arrives from the window, and the window got it from a scan, but "it came from us" is
        // not a boundary check.
        let root = repo.canonicalize().ok()?;
        let full = root.join(&path).canonicalize().ok()?;
        if !full.starts_with(&root) {
            return None;
        }
        // From the extension, the same way the scan decided this file was parseable. Not
        // asked of the scan's node: the pane is describing the file on disk, and a scan a
        // moment old is not the authority on what is there now.
        let ext = path.rsplit_once('.')?.1;
        let lang = crate::model::Lang::from_extension(ext)?;
        let src = std::fs::read_to_string(&full).ok()?;
        let f = crate::parse::forks_at(lang, &src, line)?;
        // The body itself, because the panel draws every line and marks the ones that were
        // charged — a list of only the forks is the evidence with the context cut out, and the
        // context is what makes a nested `+3` legible as nesting.
        let all: Vec<&str> = src.lines().collect();
        let from = (f.start.max(1) as usize) - 1;
        let to = (f.end.max(f.start) as usize).min(all.len());
        // **Capped, and what was cut is said out loud.** The map's own outliers run to the low
        // thousands of lines; past that this is a file viewer in a side pane. Silence here
        // would make a truncated body look like a short one whose count does not add up.
        let truncated = to - from > MAX_BODY_LINES;
        let end = to.min(from + MAX_BODY_LINES);
        let lines = all[from..end].iter().map(|l| l.to_string()).collect();
        Some(Forks { cognitive: f.cognitive, start: f.start, lines, truncated, forks: f.forks })
    })
    .await
    .map_err(|e| e.to_string())
}

/// How much of a body the panel will draw. The same figure `MAX_SNIPPET_LINES` picks for the
/// same reason: past this it is a file viewer in a side pane.
const MAX_BODY_LINES: usize = 2_000;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Forks {
    /// The total the sites sum to — computed in the same walk that found them, so the panel
    /// never adds the list up itself and cannot disagree with it.
    pub cognitive: u32,
    /// The body's first line, one-based, so the gutter can number what it draws.
    pub start: u32,
    /// The body, verbatim, from `start`. Indentation kept: it is what makes the nesting a
    /// `+3` is charged for visible without drawing it a second way.
    pub lines: Vec<String>,
    /// Cut at [`MAX_BODY_LINES`]. Said out loud, or a body that stops mid-function reads as a
    /// short one whose forks do not add up.
    pub truncated: bool,
    /// Every charge, by line. A line can hold more than one — `if (a && b)` is two — so this
    /// is a list rather than a value per line, and the panel sums a line's own.
    pub forks: Vec<crate::parse::Fork>,
}

/// One function's line range, as the window asks for it.
///
/// `name` rides along so the answer can say whether the span still looks like the function it
/// was cut for — see [`Snippet::moved`]. It is not used to FIND anything: the scan decided
/// where this function is, and re-finding it here would be a second parser.
#[derive(serde::Deserialize)]
pub struct Span {
    pub path: String,
    pub start: u32,
    pub end: u32,
    pub name: String,
}

/// The source of one span, with what is wrong with it if anything.
#[derive(serde::Serialize)]
pub struct Snippet {
    pub text: String,
    /// The function's name is nowhere near the top of this span, so the file has almost
    /// certainly moved since the scan cut it and these are somebody else's lines.
    ///
    /// **A scan is a photograph and the repo is not standing still.** The same hazard
    /// `resync_changed` exists for on the reader path: one edit above a function puts every
    /// function below it at the wrong lines, and code shown under the wrong name is worse
    /// than no code — it looks exactly as authoritative. Reported rather than corrected,
    /// because correcting it means re-parsing, and the fix for a stale scan is a scan.
    pub moved: bool,
    /// Cut at [`MAX_SNIPPET_LINES`]. Said out loud so an expanded view is never quietly a
    /// partial one.
    pub truncated: bool,
}

/// How much of one function the panel will show. A body longer than this is a body nobody is
/// reading in a side pane, and the map's own outliers run to the low thousands of lines.
const MAX_SNIPPET_LINES: usize = 2_000;

/// The source behind a list of function rows, in one call.
///
/// **A set per call, not a row per call**, on the same argument as `file_functions`: a
/// function with two hundred callers is two hundred round trips and, worse, two hundred reads
/// of files that repeat. Each file is read once here however many spans land in it.
///
/// Bounded on the way out rather than on the way in: `read_source` hands over a whole file,
/// which is right for the code view and wrong for a twenty-line snippet out of a five
/// thousand line file. A span the file cannot supply is `null` — an absence the panel states,
/// never an empty block.
#[tauri::command]
pub async fn function_sources(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    spans: Vec<Span>,
) -> Result<Vec<Option<Snippet>>, String> {
    let repo = {
        let s = crate::agentapi::lock(&state);
        match s.projects.get(&key) {
            Some(p) => p.repo.clone(),
            None => return Ok(spans.iter().map(|_| None).collect()),
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        let Ok(root) = repo.canonicalize() else {
            return spans.iter().map(|_| None).collect();
        };
        let mut files: std::collections::HashMap<String, Option<Vec<String>>> =
            std::collections::HashMap::new();
        spans
            .iter()
            .map(|span| {
                let lines = files.entry(span.path.clone()).or_insert_with(|| {
                    // Canonicalised and checked per file, exactly as `read_source` does. A
                    // path arrives from the window, and the window got it from a scan, but
                    // "it came from us" is not a boundary check.
                    let full = root.join(&span.path).canonicalize().ok()?;
                    if !full.starts_with(&root) {
                        return None;
                    }
                    let text = std::fs::read_to_string(&full).ok()?;
                    Some(text.lines().map(str::to_string).collect())
                });
                let lines = lines.as_ref()?;
                let from = (span.start.max(1) as usize) - 1;
                let to = (span.end.max(span.start) as usize).min(lines.len());
                if from >= to {
                    return None;
                }
                let truncated = to - from > MAX_SNIPPET_LINES;
                let end = to.min(from + MAX_SNIPPET_LINES);
                let body = &lines[from..end];
                // The name in the first few lines, which is where every grammar this parses
                // puts it. Three rather than one: an attribute, a decorator or a wrapped
                // signature can push a declaration down, and crying wolf on those would
                // teach people to ignore the one case that matters.
                let moved = !body.iter().take(3).any(|l| l.contains(&span.name));
                Some(Snippet { text: body.join("\n"), moved, truncated })
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

/// One file's part in one commit.
#[derive(serde::Serialize)]
pub struct CommitFile {
    pub path: String,
    pub added: u32,
    pub removed: u32,
}

/// Everything about one commit that a panel row cannot hold.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetail {
    pub sha: String,
    pub short: String,
    pub author: String,
    pub email: String,
    pub when: i64,
    pub subject: String,
    /// The message past its subject line, unwrapped. Empty on the many commits that have none.
    pub body: String,
    /// Every file it touched, with what it did to each. Empty on a merge, which `git show`
    /// reports nothing for without being told which parent to diff against.
    pub files: Vec<CommitFile>,
    pub added: u32,
    pub removed: u32,
}

/// One commit, in full.
///
/// **Every row that names a commit can now open it.** The panel shows a sha, an author and a
/// truncated subject because that is what fits beside a timeline — and every one of those rows
/// was a dead end: the next question is always *what did that commit actually do*, and the
/// answer was in a terminal in another window.
///
/// One `git show` per open, on a click. `--numstat` rather than a patch: the question a row
/// raises is what the commit touched, and a diff of a 2,000-line refactor in a 260px panel is
/// not an answer to it.
#[tauri::command]
pub async fn commit_detail(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    sha: String,
) -> Result<Option<CommitDetail>, String> {
    let repo = {
        let s = crate::agentapi::lock(&state);
        match s.projects.get(&key) {
            Some(p) => p.repo.clone(),
            None => return Ok(None),
        }
    };
    // A sha and nothing else. `git show` takes a revision expression, and one built from a
    // string the window supplies is a place to be careful: `--` would make it a path, `HEAD~1`
    // a walk, and neither is a commit anybody clicked on.
    if sha.is_empty() || !sha.chars().all(|c| c.is_ascii_hexdigit()) {
        return Ok(None);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let out = std::process::Command::new("git")
            .arg("-C")
            .arg(&repo)
            .args([
                "show",
                "--numstat",
                // \x01 between fields, \x02 closing the header — a body contains newlines and
                // may contain anything else, so the only safe boundary is one git will not
                // emit itself.
                "--format=%H%x01%h%x01%an%x01%ae%x01%ct%x01%s%x01%b%x02",
                &sha,
            ])
            .output()
            .ok()?;
        if !out.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&out.stdout);
        let (head, rest) = text.split_once('\u{2}')?;
        let mut f = head.split('\u{1}');
        let mut detail = CommitDetail {
            sha: f.next()?.trim_start().to_string(),
            short: f.next()?.to_string(),
            author: f.next()?.to_string(),
            email: f.next()?.to_string(),
            when: f.next()?.parse().unwrap_or(0),
            subject: f.next()?.to_string(),
            body: f.next().unwrap_or("").trim().to_string(),
            files: Vec::new(),
            added: 0,
            removed: 0,
        };
        for line in rest.lines() {
            let mut parts = line.split('\t');
            let (Some(a), Some(d), Some(path)) = (parts.next(), parts.next(), parts.next()) else {
                continue;
            };
            // `-` for both counts is git's word for a binary file. Counted as zero lines and
            // still listed: what it touched is the question, and a binary blob is an answer.
            let added: u32 = a.parse().unwrap_or(0);
            let removed: u32 = d.parse().unwrap_or(0);
            detail.added += added;
            detail.removed += removed;
            detail.files.push(CommitFile { path: path.to_string(), added, removed });
        }
        Some(detail)
    })
    .await
    .map_err(|e| e.to_string())
}

/// One function's history, on demand — see [`crate::blame::line_history`], which is where the
/// difference between the commits that CHANGED these lines and the ones whose lines survive is
/// written down. Blame, Churn and Age are three shapes over this one record.
///
/// Four git processes run together, so this waits: `-L` on a hot file in a deep repo is
/// seconds, and the window would sit on it. The lock is dropped before any of them start —
/// holding the state across a process would stall every reader and the window with it.
#[tauri::command]
pub async fn function_history(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    path: String,
    start: u32,
    end: u32,
) -> Result<Option<crate::blame::LineHistory>, String> {
    let repo = {
        let s = crate::agentapi::lock(&state);
        match s.projects.get(&key) {
            Some(p) => p.repo.clone(),
            None => return Ok(None),
        }
    };
    tauri::async_runtime::spawn_blocking(move || {
        crate::blame::line_history(&repo, &path, start, end)
    })
    .await
    .map_err(|e| e.to_string())
}

/// Tick the appearance item the webview is actually using.
///
/// The preference is stored in localStorage, so Rust cannot know it when the menu is
/// built — without this the menu opens with System ticked whatever you last chose. The
/// frontend calls it on mount and on every change; nothing is stored on this side, so the
/// two cannot disagree about which is current.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn sync_theme_menu(app: tauri::AppHandle, theme: String) {
    use tauri::Manager;
    if let Some(themes) = app.try_state::<crate::ThemeMenu>() {
        themes.select(&theme);
    }
}

/// Nothing to sync where there is no app menu.
#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn sync_theme_menu(_app: tauri::AppHandle, _theme: String) {}

/// Stop the model pass. Everything scored so far is kept and returned.
///
/// With the length floor gone nothing is excluded from analysis, so this is how a scan
/// is bounded: the queue is ordered by how promising each function looks, and the user
/// stops when the picture has told them enough.
#[tauri::command]
pub fn stop_scan() {
    CANCEL.store(true, Ordering::Relaxed);
}

/// Stop the history replay that is running. What it managed is kept — see
/// [`crate::history::cancel`].
#[tauri::command]
pub fn stop_history() {
    crate::history::cancel();
}

/// Add a folder to Sanity, from a directory a person picked.
///
/// **The `+` was deliberately removed once, and this is it coming back for a different
/// reason.** The argument then was that opening by hand was a dead end: an agent called
/// `sanity_open` in the repo it was already working in, and a project arrived by hand gave
/// you a gray map and four lenses, which is the app with its reason for existing removed.
///
/// A reader has no filesystem now, and no working directory. It cannot name a repo at all,
/// so somebody has to, and the only parties who may are a person at this window and a
/// person in a terminal running `sanity init`. Adding is the entrance rather than a
/// sideshow, and a gray map is what every project looks like before it is read.
///
/// **It required a `.git` at the root, and no longer does.** That guard was doing two jobs
/// and only one of them was its own. The real one: a picker was once handed a directory of
/// many repos and set thirty minutes of CPU on fire. The borrowed one: standing in for a
/// picker that hands back the enclosing folder on a double-click, so the refusal fired
/// constantly for people who HAD pointed at a repo. Nothing about scanning needs git —
/// churn and blame degrade to "no history", which the app already reports — so requiring it
/// was refusing folders for the convenience of a check rather than for the user's.
///
/// What is left unguarded is the CPU: pick `~/projects` deliberately and it will scan all
/// of it. That is a real hazard and it is not solved here; it wants a size or repo-count
/// warning that names what is about to happen, rather than a rule that says no to folders
/// somebody meant to pick.
/// A directory that was chosen, and what is about to be scanned.
#[derive(serde::Serialize)]
pub struct Added {
    path: String,
    /// What this repo will be called in the project list, once its scan publishes it.
    ///
    /// **The window has to know this before the scan starts.** Adding a project sets it
    /// aside as pending and selects it the moment its row appears — and the row was being
    /// matched by comparing the picked path against the row's `repo` string. Those are the
    /// same string today only by luck: `project_key` canonicalizes, `repo` does not, and a
    /// symlinked home or a trailing slash is enough to make a repo the person just chose
    /// sit in the sidebar unselected while the map stays on whatever was there before.
    /// The key is the identity the backend actually files it under, so handing it over
    /// removes the guess.
    key: String,
    /// Git repos sitting directly inside it. Zero for an ordinary project.
    holds: usize,
    /// The first few, by name, so the warning can show what it found rather than a count.
    names: Vec<String>,
}

#[tauri::command]
pub fn add_project(path: String) -> Result<Added, String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }
    // **Counted, not refused.** Requiring a `.git` used to make this impossible to get
    // wrong and impossible to do on purpose; dropping it left the hazard the guard was
    // really about — a picker handed `~/projects` once and set thirty minutes of CPU on
    // fire. The count is what somebody needs to see BEFORE that happens, and it is one
    // directory listing rather than a walk.
    //
    // Only when the chosen directory is not itself a repo: a monorepo with vendored
    // submodules holds repos and is exactly one project, and warning about it would be
    // the old refusal wearing a question mark.
    let mut names: Vec<String> = Vec::new();
    if !root.join(".git").exists() {
        if let Ok(entries) = std::fs::read_dir(&root) {
            for e in entries.flatten() {
                if e.path().join(".git").exists() {
                    if let Some(n) = e.file_name().to_str() {
                        names.push(n.to_string());
                    }
                }
            }
        }
    }
    names.sort();
    let holds = names.len();
    names.truncate(3);
    Ok(Added {
        path: root.to_string_lossy().to_string(),
        key: crate::agentapi::project_key(&root),
        holds,
        names,
    })
}

// **The MCP-client helpers were here and are gone, because nothing reached them.**
//
// `mcp_command`, `mcp_clients`, `mcp_connect` and `mcp_disconnect` — with the client table
// behind them — served a sheet that listed chat clients and offered to write sanity into
// each one's config. The sheet went when Sanity started launching its own readers:
// connecting a client stopped being the way in and became a way to ASK for a run in a
// conversation. The commands stayed registered and unreachable after it, which is the state
// this file's neighbors argue against most consistently — kept "just in case" is how a
// decision comes back in a second copy nobody is watching.
//
// Connecting a client by hand is still supported and needs nothing from here: the command
// is `sanity mcp`, and any client that speaks stdio MCP takes it.

/// Where a `sanity` symlink can go, best first.
///
/// **A symlink into a directory already on PATH, not a PATH entry and not an alias.**
/// Adding `Sanity.app/Contents/MacOS` to PATH would also expose `sanity-scan`,
/// `sanity-history` and two other dev binaries that sit beside the app's, and it hard-codes
/// a path inside a bundle the user can move. An alias exists only in interactive shells, so
/// it is invisible to scripts and to anything else that shells out. A symlink is the one
/// form that behaves like an installed program.
fn cli_link_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![PathBuf::from("/usr/local/bin")];
    if let Some(home) = dirs::home_dir() {
        dirs.push(home.join(".local/bin"));
    }
    dirs
}

/// What `install_cli` did, or would do.
#[derive(serde::Serialize)]
pub struct CliLink {
    /// Where the symlink is, once made.
    path: String,
    /// Whether that directory is on the PATH this process can see.
    ///
    /// Reported rather than acted on. A GUI app's PATH is not the user's — that is the
    /// whole lesson of `Harness::resolve` — so this can be wrong in the pessimistic
    /// direction, and saying "you may need to add this to your PATH" when it is already
    /// there is a smaller harm than silently leaving a link nobody can run.
    on_path: bool,
}

/// Put `sanity` on the PATH of somebody who dragged the app to /Applications.
///
/// The cask does this with a `binary` stanza and needs nothing from us. A direct download
/// has no package manager to do it, and the honest options are a symlink or a paragraph of
/// documentation — so the app offers the symlink, the way editors have always shipped their
/// shell command.
///
/// It links to the running executable rather than to a guessed bundle path: the app may be
/// anywhere, and `current_exe` is the one thing that knows where.
#[tauri::command]
pub fn install_cli() -> Result<CliLink, String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let mut refused = Vec::new();
    for dir in cli_link_dirs() {
        if std::fs::create_dir_all(&dir).is_err() {
            refused.push(dir.display().to_string());
            continue;
        }
        let link = dir.join("sanity");
        // Replaced rather than left alone: an old link pointing at a bundle that has since
        // moved is the "looks configured, won't connect" state the MCP rows already have a
        // label for, and it is worse here because the error is a bare "command not found".
        let _ = std::fs::remove_file(&link);
        #[cfg(unix)]
        let made = std::os::unix::fs::symlink(&exe, &link);
        #[cfg(not(unix))]
        let made = std::fs::hard_link(&exe, &link);
        if made.is_err() {
            refused.push(dir.display().to_string());
            continue;
        }
        let on_path = std::env::var_os("PATH")
            .map(|p| std::env::split_paths(&p).any(|d| d == dir))
            .unwrap_or(false);
        return Ok(CliLink { path: link.display().to_string(), on_path });
    }
    Err(format!(
        "Could not write to {}. You can link it by hand: ln -s \"{}\" /usr/local/bin/sanity",
        refused.join(" or "),
        exe.display()
    ))
}

/// Whether typing `sanity` in a terminal would work, and where the link is if there is one.
///
/// **Read-only, because the button that used to be the only way to find out was a write.**
/// The card offered "Ensure CLI is on PATH" unconditionally, so somebody with a working
/// `sanity` was invited to fix a thing that was not broken, and the only way to learn the
/// answer was to perform the action.
///
/// `on_path` asks the LOGIN SHELL rather than this process's `PATH`, and that is the whole
/// correctness of it. A GUI app launched from Finder inherits roughly
/// `/usr/bin:/bin:/usr/sbin:/sbin`, so comparing the link's directory against it reported
/// `~/.local/bin` as "not on PATH" for every user who has it — which is most of them, and
/// exactly the machine this was tested on. The shell is the only thing that knows, for the
/// same reason `Harness::resolve` asks it.
#[derive(serde::Serialize)]
pub struct CliState {
    /// A `sanity` link exists in one of the places this app would write one.
    linked: bool,
    /// Where that link is, if it exists.
    path: Option<String>,
    /// A shell would find `sanity` — whether or not this app put it there.
    on_path: bool,
    /// What a shell would actually RUN, resolved through the symlink.
    resolved: Option<String>,
    /// Whether that is this app. False means a different build wins the name.
    is_this_app: bool,
}

#[tauri::command]
pub fn cli_status() -> CliState {
    let found = cli_link_dirs().into_iter().map(|d| d.join("sanity")).find(|p| p.exists());
    // What a terminal would run, followed to the end of the symlink. Either route counts:
    // somebody may have a `sanity` from Homebrew, which this app did not link.
    let resolved = crate::harness::which("sanity")
        .or_else(|| crate::harness::via_login_shell("sanity"))
        .and_then(|p| std::fs::canonicalize(p).ok());
    let here = std::env::current_exe().ok().and_then(|p| std::fs::canonicalize(p).ok());
    CliState {
        linked: found.is_some(),
        path: found.map(|p| p.display().to_string()),
        on_path: resolved.is_some(),
        // **Compared, not assumed, because two installs of this app is the ordinary case.**
        // A Homebrew cask puts `sanity` in `/opt/homebrew/bin` pointing into the bundle it
        // installed; a link made here points wherever THIS app is. Both can exist, PATH
        // order decides which one the name means, and the loser is a build that answers
        // `sanity check` while the window in front of you is a different one — the same
        // "looks configured, won't connect" state the MCP rows already had a label for.
        // Only a comparison can see it: "a shell finds sanity" is true in exactly the case
        // that goes wrong.
        is_this_app: match (&resolved, &here) {
            (Some(a), Some(b)) => a == b,
            _ => false,
        },
        resolved: resolved.map(|p| p.display().to_string()),
    }
}

/// Remember that somebody is looking at this project.
///
/// **A click in the sidebar is what a restore should land on.** `active` moves when a
/// project is OPENED — by an agent, by `sanity init --show`, by the window's own Open — and
/// a sidebar click deliberately did not move it, because that rule was written against
/// agents retargeting a pane somebody else was using. It reads differently from this side:
/// choosing a project in your own window is exactly the claim on the view that `focus`
/// exists to record, so quitting with sanity selected and coming back to ceph was the app
/// forgetting the last thing it was told.
/// **It does not `touch`, and that is the whole of it being a selection rather than an
/// open.** It used to, so every click moved the row to the top of the sidebar: the list is
/// ordered most-recently-touched-first, and a list that rearranges itself as you use it is
/// one you have to re-read every time — the same objection the drag-to-arrange gesture was
/// added for, arriving through the one action nobody would think of as arranging.
///
/// The invariant it was quietly breaking is written down at [`AppState::for_client`]: a
/// keyless caller resolves to the most recently OPENED project, and that is only sound
/// because "every open bumps `touched`, nothing else does, and no view moves it." A click in
/// the sidebar is a view move. With it bumping `touched`, looking at a second repo silently
/// retargeted where a shim with no project key would send its readings.
///
/// Nothing is lost by dropping it: [`AppState::focus`] sets `active` and persists on its own,
/// which is what a restore comes back to.
#[tauri::command]
pub fn select_project(state: tauri::State<'_, crate::agentapi::Shared>, key: String) {
    crate::agentapi::lock(&state).select(&key);
}

/// Put the sidebar in this order, and remember it.
///
/// Sent whole rather than as a move: the window has just laid the list out and the list it
/// is showing is the answer. A "move A above B" would be the same fact with an argument
/// about what the order was beforehand attached to it.
#[tauri::command]
pub fn reorder_projects(state: tauri::State<'_, crate::agentapi::Shared>, keys: Vec<String>) {
    crate::agentapi::set_order(&state, keys);
}

/// Take a project out of the sidebar.
///
/// The counterpart to `add_project`, and deliberately not called "delete": it removes a
/// listing. The repo is untouched and so are its readings, which live in its own
/// `.sanity/` — see `agentapi::AppState::forget`.
#[tauri::command]
pub fn forget_project(state: tauri::State<'_, crate::agentapi::Shared>, key: String) {
    crate::agentapi::lock(&state).forget(&key);
}

/// Throw away everything this app has DERIVED for one repo, and keep everything it has read.
///
/// **The escape hatch for a cache that cannot notice it is wrong.** Every cache here refuses
/// itself on a version, a signature or a content hash, which covers the honest cases. What
/// none of them can see is a build whose bugs are since fixed: the bytes match, the version
/// matches, and the answer is simply the wrong one. It replaced `Re-trace history`, which was
/// this for the timeline alone — a narrower door onto the same room, and the wrong shape for
/// what it was actually being used for, which is clearing out the artifacts of a build that
/// has moved on.
///
/// Three things go, and one stays.
///
/// The caches go (`reports::forget_all`) — the parsed tree, the scan log, the blame, the
/// timeline, in every tag any build wrote. The banked numbers go with them: `files`,
/// `scan_ms` and `trace_depth` are what the row prices its own work from, and a price for
/// work whose result has just been deleted is worse than no price, because the gate believes
/// it. The live project goes too, so the row returns to the state a freshly added repo is in
/// rather than showing a tree from a cache that no longer exists.
///
/// **The readings stay**, in `.sanity/`, inside the repo. Nothing here touches them, which is
/// why this can be one click with a sentence under it rather than a confirmation dialog.
#[tauri::command]
pub fn reset_project(state: tauri::State<'_, crate::agentapi::Shared>, key: String) {
    let mut index = crate::reports::load_index();
    // The repo's path from the INDEX rather than from the live state: a project that has been
    // declined for cost or is waiting on a restore has a row and no `Project`, and those are
    // exactly the ones somebody resets.
    let Some(repo) = index.projects.iter().find(|p| p.key == key).map(|p| PathBuf::from(&p.repo))
    else {
        return;
    };
    crate::reports::forget_all(&repo);
    if let Some(p) = index.projects.iter_mut().find(|p| p.key == key) {
        p.files = None;
        p.scan_ms = None;
        p.trace_depth = None;
    }
    // **`unload`, never `forget`.** `forget` takes the row out of the index, which is Remove;
    // this has to leave it there, because the point of a reset is to do the work again.
    // Unloaded FIRST, then the index written: `persist` merges live state over what is on
    // disk, so an entry still holding a scan would write its own numbers back over the ones
    // just cleared — the erasure hazard `a_touch_cannot_erase_what_only_the_index_knows`
    // exists for, running in the other direction.
    crate::agentapi::lock(&state).unload(&key);
    crate::reports::save_index(&index);
}

/// Write an exported replay to the path the save dialog came back with.
///
/// **The one path on which this app writes anything.** Everything else here reads: a scan
/// walks a repo, an assessment is written by the backend into `.sanity/`, and the window
/// itself has never had a reason to put a byte anywhere. So the check is worth stating
/// rather than assuming — a movie goes to a `.mp4`, and a request naming anything else is
/// refused instead of overwriting whatever was there. The path is not otherwise constrained:
/// it came from a native save dialog, which is the user saying where.
///
/// Base64 because the alternative shape for bytes across the IPC is a JSON array of numbers,
/// and a minute of 1080p is tens of megabytes.
#[tauri::command]
pub fn save_movie(path: String, data: String) -> Result<(), String> {
    use base64::Engine;
    let out = PathBuf::from(&path);
    let ext = out.extension().and_then(|e| e.to_str()).unwrap_or_default().to_ascii_lowercase();
    if ext != "mp4" {
        return Err(format!("{} is not a .mp4 path.", out.display()));
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data)
        .map_err(|e| format!("The movie did not survive the trip from the window: {e}"))?;
    std::fs::write(&out, bytes).map_err(|e| format!("{}: {e}", out.display()))
}

/// How many lines a partial run would cover, at each step it could stop at.
///
/// Fetched once when the Read dialog opens rather than carried on the project poll: it is a
/// number per ten outstanding functions, which is a few kilobytes for a large repo and would
/// otherwise be recomputed and re-sent every 1.5 seconds for every project, most of which
/// nobody is about to read. See `agentapi::reading_curve` for what it measures.
#[tauri::command]
pub fn read_curve(state: tauri::State<'_, crate::agentapi::Shared>, key: String) -> Vec<u32> {
    crate::agentapi::reading_curve(&state, &key)
}

/// Which coding agents are installed on this machine.
///
/// The prerequisite this app actually has, now that it runs the readers itself. It used to
/// be "configure an MCP server", which is a thing people get wrong silently; this one can
/// simply be looked for, so the window states it instead of explaining it.
#[tauri::command]
pub fn harnesses() -> Vec<serde_json::Value> {
    crate::harness::Harness::all()
        .into_iter()
        .map(|h| {
            let installed = h.available();
            serde_json::json!({
                "id": h.name(),
                "installed": installed,
                // Asked of the agent itself — see `Harness::models`. Empty is a real
                // answer, not a failure: Claude names only aliases and Codex needs its app
                // server up, so the picker always keeps a field you can type into.
                "models": if installed { h.models() } else { Vec::new() },
                // Whether that list is the agent's own — see `Harness::enumerates`. The
                // window offers a text field only where it is not, because typing an id
                // into a real catalog is how somebody gets an auth-time rejection
                // minutes after pressing Read.
                "enumerated": h.enumerates(),
            })
        })
        .collect()
}

/// Record which agent and model read a project. Once per project, not once per run.
#[tauri::command]
pub fn set_reader(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    harness: Option<String>,
    model: Option<String>,
) -> Result<(), String> {
    let (repo, name) = {
        let s = crate::agentapi::lock(&state);
        let p = s.projects.get(&key).ok_or("that project is not open")?;
        (p.repo.to_string_lossy().to_string(), p.name.clone())
    };
    crate::reports::set_reader(
        &key,
        &repo,
        &name,
        harness.as_deref().filter(|h| !h.is_empty()),
        model.as_deref().filter(|m| !m.is_empty()),
    );
    Ok(())
}

/// Start a wave of readers from the window.
///
/// Straight into `agentapi::start_run` rather than out to loopback: the window holds the
/// same state the router does, and the app talking to itself over a socket would be a
/// second path to the same decision. What matters is that it is the same FUNCTION the CLI
/// and the MCP tool reach — three triggers, one loop.
#[tauri::command]
pub fn start_check(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
    model: Option<String>,
    readers: Option<usize>,
    limit: Option<usize>,
) -> serde_json::Value {
    crate::agentapi::start_run(
        &state,
        crate::agentapi::CheckRequest { project: Some(key), harness: None, model, readers, limit },
    )
}

/// Ask a running wave to stop.
///
/// Honored between readers, never mid-reading: a reader killed part-way through has cost
/// a prediction and banked nothing, and the lease it holds re-queues on its own.
#[tauri::command]
pub fn stop_check(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
) -> Result<(), String> {
    let s = crate::agentapi::lock(&state);
    let p = s.projects.get(&key).ok_or("that project is not open")?;
    let run = p.run.as_ref().ok_or("nothing is running for that project")?;
    run.stop.store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}

#[cfg(test)]
mod remote_tests {
    use super::slug_of;

    /// Every shape `origin` is actually found holding, and the two that must come back
    /// empty rather than as a half-answer — a caption is published, so an invented owner is
    /// worse than no owner.
    #[test]
    fn a_remote_url_reduces_to_owner_and_name() {
        for (url, want) in [
            ("git@github.com:barstoolbluz/tonepoet.git", Some("barstoolbluz/tonepoet")),
            ("https://github.com/barstoolbluz/tonepoet.git", Some("barstoolbluz/tonepoet")),
            ("https://github.com/barstoolbluz/tonepoet", Some("barstoolbluz/tonepoet")),
            ("ssh://git@github.com/monsterdept/sanity.git", Some("monsterdept/sanity")),
            ("https://gitlab.com/group/sub/thing.git", Some("sub/thing")),
            ("/Users/rturk/projects/sanity", Some("projects/sanity")),
            ("https://github.com/", None),
            ("sanity", None),
        ] {
            assert_eq!(slug_of(url).as_deref(), want, "{url}");
        }
    }
}
