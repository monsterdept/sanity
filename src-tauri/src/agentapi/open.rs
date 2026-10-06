//! The `/open` and `/scan` endpoints: a repo a person added, scanned and landed as a project.
//!
//! A person names a project and an agent never does, so an open resolves against what the
//! human has already added and refuses anything else. The scan runs on every open, because
//! staleness is judged against the current tree, and the response is what an orchestrator
//! sizes the job from: functions and files, what is excluded or too large, the repo's shape
//! by directory, what was not scanned at all, and the protocol to run.

use super::coverage::{count_files, count_funcs, count_stale, shape_of, unscanned_of, Counts};
use super::protocol::{contract_note, priming_note, NO_PROJECT};
use super::run::BATCH;
use super::{load_reports, lock, project_key, reader_prompt, Shared, TraceState, PROTOCOL};
use super::StatusParams;
use crate::scan::Scan;
use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::time::Instant;

#[derive(Deserialize, Default)]
pub struct OpenRequest {
    /// Which repo. **Optional, and an agent should leave it out.**
    ///
    /// A reader has no filesystem and no working directory, so it cannot name a repo; and
    /// a client that could name one could name any one, including a repo the person at the
    /// window never chose. Absent, the backend answers from what the human has already
    /// added — opening it when there is exactly one candidate, listing them when there are
    /// several, and saying how to add one when there are none.
    ///
    /// Present, it must match a project already in the index. `sanity init`, `sanity
    /// check` and the window's Add project button are the three ways something gets in
    /// there, and all three are a person naming a repo in a place a person is allowed to.
    #[serde(default)]
    pub path: Option<String>,
    /// Make the window follow this repo as well as opening it.
    ///
    /// Absent by default, and absent is not "no" — see [`AppState::focus`], which still
    /// takes the view when nothing holds it. The field exists for the one caller who can
    /// legitimately claim the pane: a human who typed `sanity study --show`. The MCP
    /// shim never sends it, because an agent opening a repo is not evidence that the
    /// person at the window wanted to stop looking at the one they had.
    #[serde(default)]
    pub focus: Option<bool>,
    /// The tool contract the CALLING shim is serving, as a fingerprint.
    ///
    /// Absent means the caller predates this check, which is itself the answer: a shim old
    /// enough not to send it is old enough to be serving a schema this backend has moved
    /// past. See [`contract_note`].
    #[serde(default)]
    pub contract: Option<String>,
}

/// Which repo an `/open` is about, given what the human has already added.
///
/// **The rule is that a person names a project and an agent never does**, and everything
/// awkward about this function is that rule meeting a caller who supplied a path anyway.
/// Three ways in put a repo on the list — `sanity init`, `sanity check`, and the window's
/// Add project — and all three are somebody typing or clicking. A path that matches one of
/// them is that person's choice arriving a second time, which is fine. A path that matches
/// none of them is a caller choosing for them, which is the thing being refused.
///
/// Returning the candidates rather than picking is the same instinct as `.sanityignore`
/// having no defaults: the mechanism is here, the judgement is the human's, and an agent's
/// job is to put the list in front of them.
fn resolve_open(state: &Shared, asked: Option<&str>) -> Result<PathBuf, serde_json::Value> {
    let known = crate::reports::load_index().projects;
    let candidates = || -> Vec<serde_json::Value> {
        known.iter().map(|k| serde_json::json!({ "name": k.name, "path": k.repo })).collect()
    };
    if let Some(p) = asked {
        let path = PathBuf::from(p);
        let key = project_key(&path);
        // Already loaded counts as added: `sanity check` opens the repo it was run in
        // before starting a wave, and a project the window is already holding is one
        // somebody has plainly named.
        if lock(state).projects.contains_key(&key) || known.iter().any(|k| k.key == key) {
            return Ok(path);
        }
        return Err(serde_json::json!({
            "ok": false,
            "error": format!("{p} is not a project anybody has added to Sanity."),
            "hint": "Sanity reads repos a person has chosen, not paths an agent supplies. \
                     Ask the human to add it in the app, or to run `sanity init` in it. \
                     `projects` lists what is already there.",
            "projects": candidates(),
        }));
    }
    match known.len() {
        0 => Err(serde_json::json!({
            "ok": false,
            "error": "No repo has been added to Sanity yet.",
            "hint": "Ask the human to add one — the Add project button in the app, or \
                     `sanity init --harness claude` in the repo. You cannot choose for them.",
            "projects": [],
        })),
        // Exactly one is not a guess, it is the only answer there is.
        1 => Ok(PathBuf::from(&known[0].repo)),
        // Several, so say so and open nothing. Picking the most recent would be right most
        // of the time and silently wrong the rest, and the wrong ones write readings into
        // another repo's `.sanity/`.
        _ => Err(serde_json::json!({
            "ok": false,
            "error": "Sanity is holding more than one repo, so it cannot tell which you mean.",
            "hint": "Ask the human which of these to read, then call sanity_open again with \
                     that exact path.",
            "projects": candidates(),
        })),
    }
}

/// The scan an OPEN gets, from the window or from an agent: the parse, then the commit log.
///
/// **An agent's open is an ASK, so it is not gated** — the agent named this repo and is waiting
/// on the answer. What no open is, is a blank cheque for depth 2: blame is per-file work on a
/// scale nothing here can predict — an hour on kibana — so it stays an explicit request of its
/// own, the same for a human and for an agent.
///
/// **The window's open is `budgeted`, because the window has already told the person so.**
/// Adding a repo whose log is over [`crate::trace::BUDGET`] puts up a dialog saying the map
/// arrives without its history lenses and the row carries a Trace button — and pressing Add
/// then walked the log anyway, 47 seconds on linux, under a dialog that had just promised
/// otherwise. Over budget, the map lands untraced with the price on the row, which is what the
/// launch restore already does through the same [`crate::trace::go`].
///
/// The scan cache is persistent, unlike the rest of what an open rebuilds. The rescan on every
/// open is deliberate and stays — staleness is judged against the CURRENT tree — but
/// re-deriving a parse and a blame for a file nobody touched is the same work producing the
/// same answer, and on PrusaSlicer that was 51.5s of a 51.5s open. See `scancache`.
///
/// Ordering fidelity: in the app the proxy is only ever a queue sort key, `Source::Proxy` is
/// refused a color, and the all-pairs term cost 27 of tonepoet's 34 seconds to produce a value
/// nobody sees. See `scan::Fidelity`.
pub fn scan_asked(
    root: &Path,
    on_progress: &(dyn Fn(crate::scan::Progress) + Sync),
    on_shape: &(dyn Fn(&[crate::scan::ShapeFile]) + Sync),
    cancel: &std::sync::atomic::AtomicBool,
    budgeted: bool,
) -> anyhow::Result<(Scan, TraceState)> {
    let scans = crate::scancache::ScanCache::open(root);
    let mut scan = crate::scan::scan(
        root,
        on_progress,
        on_shape,
        cancel,
        &scans,
        crate::scan::Fidelity::Ordering,
        crate::trace::Depth::Untraced,
    )?;
    if budgeted {
        if let crate::trace::Go::Ask(estimate) = crate::trace::go(root) {
            let trace = TraceState { pending: Some(estimate), ..Default::default() };
            return Ok((scan, trace));
        }
    }
    on_progress(crate::scan::Progress::phase("reading the commit log"));
    let (depth, _, _) =
        crate::trace::deepen(root, &mut scan, crate::trace::Depth::Files, &scans, cancel, &|_| {}, &|_| {});
    // Banked again with its history in it — `scan` stored an untraced tree before the walk.
    // See `treecache::redraw`.
    if depth != crate::trace::Depth::Untraced {
        crate::treecache::redraw(root, &scan);
    }
    Ok((scan, TraceState { depth, ..Default::default() }))
}

/// Open a repo a person named at a terminal, and take the view — `sanity .`.
///
/// The one caller besides `init --show` entitled to `focus`: a human typed the path. The
/// repo must already be on the known list, which [`crate::cli::name_for_window`] sees to
/// before the window is asked. Failures are the window's to show; an open that went wrong
/// leaves the sidebar row saying so, as it does for every other open.
pub async fn open_for_person(state: Shared, repo: PathBuf) {
    let asked = OpenRequest {
        path: Some(repo.to_string_lossy().to_string()),
        focus: Some(true),
        ..Default::default()
    };
    let _ = open_project(State(state), Json(asked)).await;
}

/// Open a repo, and add it to what Sanity is holding.
///
/// It used to end "…and make it what the window is showing", which is no longer the
/// default and was never quite defensible: an open is a claim about what the caller is
/// working on, not about what the person at the window wants to look at. The project
/// appears in the sidebar with its own progress either way, so nothing becomes invisible;
/// see [`AppState::focus`] for when the view does move.
///
/// Sanity does the structural work — walking, tree-sitter, git churn — because that is a
/// second of Rust and would be thousands of tokens of agent time. The agent supplies the
/// part only it can: judgement about whether the code reads the way its name implies.
///
/// Scored with the offline proxy only, so every wedge starts gray. Nothing claims to have
/// been understood until something actually reads it.
pub(super) async fn open_project(
    State(state): State<Shared>,
    Json(req): Json<OpenRequest>,
) -> Json<serde_json::Value> {
    // Resolved against what a human has added, never taken on trust. See `OpenRequest::path`.
    let path = match resolve_open(&state, req.path.as_deref()) {
        Ok(p) => p,
        Err(answer) => return Json(answer),
    };
    if !path.is_dir() {
        return Json(serde_json::json!({
            "ok": false,
            "error": format!("{} is not a directory", path.display()),
        }));
    }
    // Same gate as the window's Open. An agent is likelier than a human to hand over a
    // parent directory — it is working from a path in a prompt, with no picker to look at.
    if crate::scan::git_root(&path).is_none() {
        return Json(serde_json::json!({ "ok": false, "error": crate::scan::not_a_repo(&path) }));
    }
    let key = project_key(&path);
    lock(&state).ping();

    // Already held is not a reason to skip the scan.
    //
    // It used to be: a held project was brought forward and returned as-is. But staleness
    // is decided by comparing each reading's `body_hash` against the body in the CURRENT
    // scan, so a scan taken before the code changed cannot see that it changed — and
    // "study this project in sanity again" after a merge is exactly the case. Close and
    // reopen the app and it worked, because `restore` rescans; leave the window open and
    // the same request silently found nothing stale. An instrument whose answer depends on
    // whether you restarted it is not measuring the repo.
    //
    // Affordable now: the app scans at `Fidelity::Ordering`, which took tonepoet from 34.8s
    // to 8.6s. It was not affordable before, which is most of why it worked this way.
    let reopened = lock(&state).projects.contains_key(&key);

    // In the sidebar NOW, before the scan, not after it — see `AppState::pend`.
    let name = lock(&state).pend(&key, &path);

    let scan_path = path.clone();
    let started = Instant::now();
    let scanned = tokio::task::spawn_blocking(move || {
        scan_asked(&scan_path, &|_| {}, &|_| {}, &std::sync::atomic::AtomicBool::new(false), false)
    })
    .await;
    let scan_ms = started.elapsed().as_millis() as u64;

    lock(&state).settle(&key);
    let (mut scan, trace) = match scanned {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Json(serde_json::json!({ "ok": false, "error": e.to_string() })),
        Err(e) => return Json(serde_json::json!({ "ok": false, "error": e.to_string() })),
    };

    let Counts { kept: functions, excluded, oversize } = count_funcs(&scan);
    // Files are readings too, and this response is what the protocol tells an orchestrator
    // to size the job from — so it has to be the whole job, not the function half of it.
    let files = count_files(&scan);
    let shape = shape_of(&scan);
    // Before `scan` is handed to the project, like `shape` above it.
    let unscanned = unscanned_of(&scan);

    let reports = load_reports(&path, &mut scan);
    // The index ships to strangers, and `save` only rewrites it when a reading lands — so
    // a FINISHED repo keeps whatever prose its last reading was written with, forever. An
    // open is the moment we certainly have both the repo and its readings in hand, so it
    // is where an out-of-date index gets caught. It refreshes, never creates: opening a
    // repo with no assessment must not leave a `.sanity/` directory in somebody's tree.
    //
    // Before `publish_asked`, which stamps the file marks — so anything `refresh` wrote is
    // already in them and cannot read as a change on the first tick.
    let index = crate::assessment::refresh(&path, &scan, &reports);
    let probe_path = path.clone();
    let stale = count_stale(&scan, &reports);
    // Minus stale, like everywhere else. It was `reports.len()` raw — the same bug
    // `/status` was fixed for and the same consequence: the window said 142 while the agent
    // driving the assessment was told 608, and the optimistic number was the one making
    // decisions about whether to keep going. `assessed` has one definition.
    let assessed = reports.len().saturating_sub(stale);
    let mut s = lock(&state);
    let showing =
        s.publish_asked(&key, path, scan, trace, reports, req.focus.unwrap_or(false));
    if let Some(p) = s.projects.get_mut(&key) {
        p.last_agent = Some(Instant::now());
    }
    Json(serde_json::json!({
        "ok": true, "reopened": reopened, "project": key, "name": name,
        // Whether the window moved. It usually will not, and a caller that assumed it had
        // would tell the human to go and look at a pane still showing something else.
        "showing": showing,
        // What became of `.sanity/README.md`. Reported rather than absorbed, on the same
        // grounds as a failed `save_reports`: an index that quietly failed to update is a
        // document claiming to be current while saying something else.
        "index": index.as_str(),
        // Absent when the two halves agree, so a healthy run says nothing. A field that is
        // always present is one an orchestrator learns to skip.
        "contract_warning": contract_note(req.contract.as_deref()),
        // Absent for the same reason, and this one has to arrive BEFORE the first reader
        // exists — which is what `open` is. Nothing later can fix it: a reader's context is
        // built before it can call anything.
        "priming_warning": priming_note(&probe_path),
        // The bare fact under that warning, so the CLI can write the human's sentence
        // without reimplementing the check. Read verbs are formatters over endpoints —
        // whatever they need that an endpoint lacks belongs in the endpoint, or there are
        // two implementations of one answer and the unwatched one goes wrong.
        "agent_docs": crate::assessment::agent_docs(&probe_path),
        "functions": functions, "files": files.kept, "assessed": assessed,
        // Both, always. `functions` is what a full pass costs and what a percentage
        // divides by; `excluded` is what somebody decided is not this assessment's
        // business. A denominator quietly narrowed months ago is how a map ends up
        // claiming completeness over a subset.
        "excluded": excluded,
        // Beside `excluded` and never folded into it. Both are functions no run will
        // reach, and the reasons are opposite: `excluded` is somebody's `.sanityignore`,
        // this is code too large for a reader to hold (`READ_CEILING`). Reported as one
        // number they would read as a decision the repo made about itself.
        "oversize": oversize,
        // The repo by top-level directory, so a reader can propose a `.sanityignore` with
        // numbers instead of a guess. Nobody shipping this tool can know which of these
        // directories is worth a reading; somebody who has just read the repo can ask.
        "shape": shape,
        // **What is NOT on that map.** A repo the scanner mostly cannot parse still draws a
        // well-formed sunburst — point it at 110 `.scad` files and 3 `.rb` and it draws the
        // three Ruby files — and every count above is over the part it could read. Two lists,
        // never added together: `unparsed` is a grammar this tool does not have, `skipped` is
        // a language it has and declined. See `unscanned_of`.
        "unscanned": unscanned,
        "sanityignore": if excluded > 0 {
            "In effect — `excluded` above is what it set aside."
        } else {
            "None. If a slice of this repo is not worth reading — generated clients, \
             vendored trees, a test suite you would rather assess separately — say so \
             with the numbers from `shape` and let the human write `.sanityignore` at the \
             repo root. Gitignore syntax. Do NOT create one unasked, and do not assume \
             tests belong in it: a full pass of another repo found seven tests whose \
             names promised properties their bodies never exercised, which was the best \
             result of that run."
        },
        // How long the scan took, and — when that was long enough for a caller to have
        // wondered whether it had hung — what it will cost next time.
        //
        // In the RESPONSE rather than the schema, on the standing rule: an `inputSchema`
        // description is loaded once per FUNCTION and would bill every reader for a
        // sentence only the orchestrator can act on. This reaches the one session that
        // asked, at the moment it matters, and it can say the actual number rather than a
        // hedge that has to cover every repo.
        "scan_ms": scan_ms,
        "scan_note": scan_note(scan_ms, reopened),
        // The two halves, rejoined for the one caller that needs both — it has to read
        // the orchestration half and paste the reader half.
        "stale": stale, "protocol": format!("{PROTOCOL}{}", reader_prompt(BATCH)),
    }))
}

/// What to tell the caller about the time it just waited.
///
/// A slow open is not a fault and must not read as one — a reader that decides an open is
/// broken invents a prerequisite, which is the documented failure mode behind `UNREACHABLE`
/// existing separately from `NOT_RUNNING`. What it needs to know is the shape of the cost:
/// the first open of a repo pays for the parse and the blame of every file, and every open
/// after it pays only for what changed.
///
/// Silent under the threshold, because a note attached to a fast call is noise that trains
/// the reader to skip the field on the one call where it matters.
fn scan_note(ms: u64, reopened: bool) -> Option<String> {
    const SLOW_MS: u64 = 5_000;
    if ms < SLOW_MS {
        return None;
    }
    Some(format!(
        "This scan took {}s. The parse and git blame of every file are cached per machine, \
         so opens after this one cost only what changed{}. Expect the same one-off wait the \
         first time you open any large repo — it is not a hang, and retrying restarts it.",
        ms / 1000,
        if reopened { " (this repo was already open, so the cache was in use)" } else { "" }
    ))
}

/// Scan a repo whose scan was declined for cost, because somebody asked.
///
/// The other side of `scan::BUDGET`, and the counterpart to `/trace`: a launch that would have
/// spent a minute parsing linux leaves the row saying what it would cost, and this is how a
/// person says go. It routes through `open_project`, which is the one place a scan becomes a
/// project — a second construction site for the same thing is how the same bug arrives twice.
pub(super) async fn scan_now(State(state): State<Shared>, Json(p): Json<StatusParams>) -> Json<serde_json::Value> {
    let repo = {
        let st = lock(&state);
        let Some(key) = st.for_client(p.project.as_deref()) else {
            return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
        };
        crate::reports::load_index()
            .projects
            .into_iter()
            .find(|k| k.key == key)
            .map(|k| k.repo)
    };
    let Some(repo) = repo else {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    open_project(State(state), Json(OpenRequest { path: Some(repo), ..Default::default() })).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::{data_home, project_of};
    use crate::agentapi::AppState;
    use std::collections::HashMap;

    /// **An open records the depth it traced to, from either door.** The window's Open built
    /// its project by hand and never set `trace`, so `Project::rescan`'s default stood: a repo
    /// opened from the app claimed `Untraced` over a tree holding the commit log, findings
    /// asked for a trace the map already had, and Trace offered to walk the log again.
    #[test]
    fn an_asked_open_lands_at_the_depth_it_was_traced_to() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
        let mut state = AppState::default();
        let mut held = project_of(dir.path());
        held.leased.insert("a.rs#one".into(), Instant::now());
        state.projects.insert(key.clone(), held);

        state.pend(&key, dir.path());
        assert_eq!(state.restoring.len(), 1, "the row is on screen before the scan lands");
        state.settle(&key);
        assert!(state.restoring.is_empty(), "and gone once it has, however it turned out");

        let (scan, trace) = scan_asked(dir.path(), &|_| {}, &|_| {}, &Default::default(), true)
            .expect("scans");
        state.publish_asked(&key, dir.path().to_path_buf(), scan, trace, HashMap::new(), true);
        let p = &state.projects[&key];
        assert_eq!(p.trace.depth, crate::trace::Depth::Files, "an open reads the commit log");
        assert!(p.leased.is_empty(), "a lease taken against the old body outlived the rescan");
        assert_eq!(state.active.as_deref(), Some(key.as_str()));
    }

    /// A caller with no path is told what the human has added, and nothing is invented.
    ///
    /// One candidate is the only answer there is, so it is taken. Several is a question,
    /// not a guess: picking the most recent would be right most of the time and silently
    /// wrong the rest, and being wrong here writes a reading into another repo's
    /// `.sanity/` — correctly hashed and attributed, with nothing to say it happened.
    /// None is neither; it is a thing only a person can fix.
    #[test]
    fn a_pathless_open_answers_from_what_a_human_added() {
        let _data = data_home();
        let state: Shared = Default::default();

        // Nothing added yet.
        let err = resolve_open(&state, None).expect_err("nothing is added, so nothing opens");
        assert_eq!(err["ok"], false);
        assert!(err["hint"].as_str().unwrap().contains("add"));

        let mut index = crate::reports::KnownProjects::default();
        index.projects.push(crate::reports::KnownProject {
            key: "/a".into(),
            repo: "/a".into(),
            name: "a".into(),
            touched: 1,
            files: None,
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        });
        crate::reports::save_index(&index);
        assert_eq!(resolve_open(&state, None).unwrap(), PathBuf::from("/a"));

        index.projects.push(crate::reports::KnownProject {
            key: "/b".into(),
            repo: "/b".into(),
            name: "b".into(),
            touched: 2,
            files: None,
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        });
        crate::reports::save_index(&index);
        let err = resolve_open(&state, None).expect_err("two candidates is a question");
        assert_eq!(err["ok"], false);
        let listed: Vec<&str> = err["projects"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p["path"].as_str().unwrap())
            .collect();
        assert_eq!(listed, vec!["/a", "/b"], "the human was not shown the choice");
    }

    /// A path nobody added is refused, however real it is.
    ///
    /// The rule this protects is that a person names a project and an agent never does. A
    /// caller that can name any path can point a run at a repo the person at the window
    /// never chose — and readings are written into the repo, so being wrong leaves files
    /// behind in it.
    #[test]
    fn a_path_the_human_never_added_is_refused() {
        let _data = data_home();
        let state: Shared = Default::default();
        crate::reports::save_index(&crate::reports::KnownProjects {
            active: None,
            explain_trace: None,
            order: Vec::new(),
            projects: vec![crate::reports::KnownProject {
                key: "/added".into(),
                repo: "/added".into(),
                name: "added".into(),
                touched: 1,
                files: None,
                scan_ms: None,
                trace_depth: None,
                harness: None,
                model: None,
            }],
        });

        assert_eq!(resolve_open(&state, Some("/added")).unwrap(), PathBuf::from("/added"));
        let err =
            resolve_open(&state, Some("/somewhere-else")).expect_err("an unadded path opened");
        assert_eq!(err["ok"], false);
        assert!(
            err["error"].as_str().unwrap().contains("/somewhere-else"),
            "the refusal must name what was asked for"
        );
    }
}
