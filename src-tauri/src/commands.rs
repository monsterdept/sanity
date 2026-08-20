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
        s.restoring.push(crate::reports::KnownProject {
            key: pending_key.clone(),
            repo: root.to_string_lossy().to_string(),
            name: name.clone(),
            touched: 0,
            files: None,
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
    let scanned = tauri::async_runtime::spawn_blocking(move || {
        let model = HeuristicModel;

        let emit = |p: Progress| {
            // Fed to the sidebar row as well as the pane, so the two agree about how far
            // along the same scan is.
            if let Ok(mut s) = progress_state.lock() {
                s.restoring_progress.insert(progress_key.clone(), p.clone());
            }
            // Named, like the shape batches beside it — see `scan::Tick`.
            let _ = app.emit(
                "scan-progress",
                crate::scan::Tick { project: &progress_key, progress: &p },
            );
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
            let _ = app.emit(
                "scan-shape",
                crate::scan::ShapeBatch { project: &progress_key, files },
            );
        };
        scan::scan(
            &root,
            &model,
            &emit,
            &scored,
            &shape,
            &CANCEL,
            Memos { scores: &cache, scans: &scans },
            scan::Fidelity::Ordering,
        )
        .map_err(|e| e.to_string())
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
        shared.touch(&key);
        // Focused outright, unlike the agent and headless paths. This is the window's own
        // Open command — somebody stood in front of the app and chose this repo, which is
        // the one case where taking the view is what was asked for rather than something
        // done to a pane in use.
        shared.focus(&key, true);
    }
    // Slim, like `project_scan` and for the same reason — the window asks for a file's
    // functions when it has somewhere to draw them.
    scanned.map(|s| Scan { root: s.root.slim(), stats: s.stats })
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
    tauri::async_runtime::spawn_blocking(move || {
        if fresh == Some(true) {
            crate::history::forget(&root, limit);
        }
        // **The count, not the timeline.** Returning the story is what made a large repo
        // unopenable: 122,792 frames is over a hundred megabytes of JSON, and the window
        // parsed all of it to draw one frame. It asks for what it needs now — see
        // `history_tables` and the two window commands below it.
        if trace != Some(true) {
            return crate::history::stored(&root, limit).map(|s| s.commits.len()).unwrap_or(0);
        }
        let emit = |p: Progress| {
            let _ = app.emit("history-progress", p);
        };
        // **Rate-limited, because the trace now reports per commit from its first second.**
        // The log read ticks once per commit and the walk ticks again, so an unbounded window
        // on a large repo is millions of events crossing to the webview from the thread doing
        // the work. See `scan::throttled`, which never drops a phase change or a final tick.
        let emit = crate::scan::throttled(&emit);
        crate::history::read_cached(&root, limit, &emit).commits.len()
    })
    .await
    .map_err(|e| e.to_string())
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
        let out = std::process::Command::new("git")
            .arg("-C")
            .arg(&repo)
            .args(args)
            .output()
            .ok()?;
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
pub fn history_funcs(
    path: String,
    from: usize,
    count: usize,
) -> Vec<crate::history::HistoryFunc> {
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
        let root = PathBuf::from(&repo)
            .canonicalize()
            .map_err(|e| format!("repo unreadable: {e}"))?;
        let full = root
            .join(&rel_path)
            .canonicalize()
            .map_err(|e| format!("no such file: {e}"))?;
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
pub fn open_code_window(app: tauri::AppHandle, repo: String, rel_path: String) -> Result<(), String> {
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
            p.reports
                .values()
                .cloned()
                .map(|mut r| {
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
pub fn agent_activity(
    state: tauri::State<'_, crate::agentapi::Shared>,
) -> AgentActivity {
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
pub fn projects(
    state: tauri::State<'_, crate::agentapi::Shared>,
) -> crate::agentapi::ProjectList {
    crate::agentapi::ProjectList::from_state(&crate::agentapi::lock(&state))
}

/// The full scored tree for one project, fetched when the window switches to it.
#[tauri::command]
pub fn project_scan(
    state: tauri::State<'_, crate::agentapi::Shared>,
    key: String,
) -> Option<Scan> {
    // **Without the functions.** See `Node::slim`: ceph's tree is 75MB of JSON, almost all
    // of it functions the map cannot draw, and the window spent five seconds parsing it
    // before anything appeared. A file's own ring arrives when something asks for it.
    let mut s = crate::agentapi::lock(&state);
    if let Some(p) = s.projects.get(&key) {
        return Some(Scan { root: p.scan.root.slim(), stats: p.scan.stats.clone() });
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
    let repo = crate::reports::load_index()
        .projects
        .into_iter()
        .find(|p| p.key == key)?
        .repo;
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
#[tauri::command]
pub fn select_project(state: tauri::State<'_, crate::agentapi::Shared>, key: String) {
    let mut s = crate::agentapi::lock(&state);
    s.touch(&key);
    s.focus(&key, true);
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
        crate::agentapi::CheckRequest {
            project: Some(key),
            harness: None,
            model,
            readers,
            limit,
        },
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
