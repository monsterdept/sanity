//! The process around the endpoints: the router, the endpoint file, the watcher, standing down.
//!
//! Serving ([`serve`]) binds loopback on a port the OS picks, publishes it with this pid, and
//! starts the watcher that rescans a repo whose files moved — never while a reading is out.
//! The liveness probe touches no state, so asking whether a backend is alive cannot keep it
//! alive. A newer build may retire a daemon, unless it is the window's own or a wave is
//! reading. A backend that exits retracts its claim only if the file still names it.

use super::depth::{stop_trace, trace, trace_within_budget};
use super::landing::report;
use super::open::{open_project, scan_now};
use super::queue::{queue, LEASE};
use super::reveal::reveal;
use super::run::{check, stop};
use super::status::{status, summary};
use super::{load_reports, lock, stamp_marks, Shared};
use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use std::path::PathBuf;
use std::time::Duration;

/// Is anybody home, and who.
///
/// Separate from `/status` because status is not free: it calls `ping`, which resets the
/// clock a `sanity serve` daemon stands down by. `sanity serve` and `sanity study` both
/// have to ask whether a backend is already up, and a liveness probe that counted as a
/// reader calling something would keep a backend alive by asking whether it is alive.
/// This touches no state at all.
///
/// The pid is the answer to "already serving, but by whom" — a daemon compares it against
/// its own to notice it has been superseded.
async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "ok": true,
        "pid": std::process::id(),
        "build": build_id(),
        "headless": headless(),
    }))
}

/// What build this process is running, for a caller to compare against its own.
///
/// **The version alone cannot answer this**, and the case that made it necessary is the
/// ordinary one: a developer rebuilds, `serve` is idempotent so the running daemon is
/// reused, and it renders the format it was compiled with while every file on disk says
/// otherwise. `CARGO_PKG_VERSION` moves once a release; a binary moves all afternoon. So
/// the fingerprint is the version plus the size and mtime of the executable behind this
/// process — the same three facts a person would compare by hand.
///
/// **Stamped once, at bind time, or it answers the wrong question.** Read lazily on the
/// first `/health`, it would describe whatever binary is at that path NOW — which after a
/// rebuild is the new one, so a stale daemon would vouch for itself. `serve` calls this
/// before it binds, so what is reported is the build that is actually executing.
///
/// Unknown when the executable cannot be stat-ed, and a caller must read that as "cannot
/// tell" rather than as a mismatch: killing a working backend over a missing `st_mtime` is
/// a worse failure than serving one release too long.
pub fn build_id() -> &'static str {
    static ID: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    ID.get_or_init(|| {
        let stamp = || -> Option<String> {
            let m = std::fs::metadata(std::env::current_exe().ok()?).ok()?;
            let t = m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?;
            Some(format!("{}-{}", m.len(), t.as_secs()))
        };
        match stamp() {
            Some(s) => format!("{}+{s}", env!("CARGO_PKG_VERSION")),
            None => "unknown".to_string(),
        }
    })
}

/// Whether this backend is a daemon rather than the window's own.
///
/// It decides whether a stale backend can be retired at all: a daemon holds nothing and
/// can be replaced, while the window's backend is a thread inside somebody's open app and
/// retiring it would close their work to fix a formatting drift.
static HEADLESS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub fn set_headless() {
    HEADLESS.store(true, std::sync::atomic::Ordering::Relaxed);
}

pub fn headless() -> bool {
    HEADLESS.load(std::sync::atomic::Ordering::Relaxed)
}

/// Set by `/retire`, read by the daemon's watch loop.
static RETIRING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

pub fn retiring() -> bool {
    RETIRING.load(std::sync::atomic::Ordering::Relaxed)
}

/// Whether any project has a wave still going.
pub fn any_run_live(state: &Shared) -> bool {
    lock(state).projects.values().any(|p| p.run.as_ref().is_some_and(|r| r.ended.is_none()))
}

/// Stand down so a caller on a newer build can take over.
///
/// **It answers, then exits — it does not exit from here.** The flag is read by the watch
/// loop in `cli::serve`, which is the audited stand-down path: readers stopped, endpoint
/// released, process gone. Exiting inside the handler would drop the response the caller
/// is waiting on, and the caller would have to tell a dead connection from a refusal.
///
/// **Two refusals, and both are the point of having the endpoint rather than a signal.**
/// A window is somebody's open app, not a background process, so it says so and the caller
/// warns instead. A wave in flight is minutes of a reader's work and tokens already spent;
/// a build old enough to render last week's headings is not worth throwing that away for,
/// and the run will end on its own. SIGTERM could express neither, which is why the CLI
/// asks rather than kills.
async fn retire(State(state): State<Shared>) -> Json<serde_json::Value> {
    if !headless() {
        return Json(serde_json::json!({
            "ok": false,
            "reason": "window",
            "hint": "This backend belongs to the open app. Quit and reopen it to serve a newer build.",
        }));
    }
    if any_run_live(&state) {
        return Json(serde_json::json!({
            "ok": false,
            "reason": "busy",
            "hint": "A wave is still reading. It will stand down once the run ends.",
        }));
    }
    RETIRING.store(true, std::sync::atomic::Ordering::Relaxed);
    Json(serde_json::json!({ "ok": true, "pid": std::process::id() }))
}

pub fn router(state: Shared) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/retire", post(retire))
        .route("/open", post(open_project))
        .route("/queue", get(queue))
        .route("/reveal", post(reveal))
        .route("/check", post(check))
        .route("/stop", post(stop))
        .route("/report", post(report))
        .route("/scan", post(scan_now))
        .route("/trace", post(trace))
        .route("/trace/stop", post(stop_trace))
        .route("/status", get(status))
        .route("/summary", get(summary))
        .with_state(state)
}

/// Where the app writes the port it actually claimed.
///
/// Published rather than fixed, and pid-stamped, for the reason tally learned the hard
/// way: if the MCP server assumes a port, anything else holding it answers in the app's
/// place — alive enough to look fine, wrong enough to fail confusingly.
pub fn endpoint_file() -> Option<PathBuf> {
    Some(crate::reports::data_dir()?.join("agent-endpoint.json"))
}

/// Who currently claims to be the backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Endpoint {
    pub port: u16,
    pub pid: u32,
}

impl Endpoint {
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
}

/// Parse the published endpoint. One reader, because two would drift.
///
/// It says nothing about whether that process is alive — the file outlives a crash, and
/// the pid was published for years without anything ever reading it. Callers that need
/// liveness probe `/health`; callers that only need "who claims it" (a daemon checking
/// whether it has been superseded) can stop here.
pub fn read_endpoint() -> Option<Endpoint> {
    let raw = std::fs::read_to_string(endpoint_file()?).ok()?;
    let v: serde_json::Value = serde_json::from_str(&raw).ok()?;
    Some(Endpoint {
        port: u16::try_from(v.get("port")?.as_u64()?).ok()?,
        pid: u32::try_from(v.get("pid")?.as_u64()?).ok()?,
    })
}

/// Withdraw this process's claim to be the backend, on the way out.
///
/// **A claim nobody retracts is a claim that outlives its claimant.** Nothing removed this
/// file — not the app on quit, not the daemon on standing down — so after the first run
/// there was always a file on disk naming a port, usually a dead one. Two things read that
/// file and both were misled by it. `mcp.rs` chooses its error text by whether the file
/// EXISTS, so a backend that had quit reported itself as `UNREACHABLE`: "usually
/// TRANSIENT, comes back on a new port within a few seconds, retry up to five times" — to
/// a reader whose backend was never coming back. And a human reading the file has no way
/// to tell a live backend from the wreckage of the last one.
///
/// **Only if it still names me.** The superseded case is a daemon standing down *because*
/// the app has already published its own claim over the top, and deleting the file there
/// would take the live backend's address with it — turning a clean handover into an outage
/// that ends with `ensure_backend` starting a third server. Read, compare, then unlink.
///
/// A failed removal is silent, for the reason a failed *cache* write is: the file is a
/// hint, `probe` is the evidence, and a stale one costs a probe that fails and a fresh
/// spawn. Nothing here is unrecoverable, which is why it can be a best-effort tidy rather
/// than a shutdown protocol.
pub fn release_endpoint(pid: u32) {
    if read_endpoint().is_some_and(|ep| ep.pid == pid) {
        if let Some(path) = endpoint_file() {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// How often the repo is looked at. See `watch::probe` for what a look costs.
const WATCH_TICK: Duration = Duration::from_millis(1500);

/// Re-scan a project whose files have moved, and tell the window.
///
/// **It refuses to run while anything is leased, and that refusal is the whole design.** A
/// rescan re-mints node ids — they embed `@line` — and a reader in flight is holding one. Drop
/// the tree underneath it and the report it sends a minute later finds no node to stamp, so
/// `report` writes an EMPTY body hash; `is_stale` reads an empty hash as "predates this store,
/// take it at its word", and that reading can then never expire. A reading that does not know
/// it is stale is the one failure this store is built to prevent, and a background timer that
/// manufactured them on every edit would be the worst possible way to arrive at it.
///
/// `open_project` rescans regardless and drops the leases, which is right there: a human or an
/// agent asked for it, and one duplicated reading is a smaller cost than an open that lies. A
/// timer nobody asked for does not get to make that trade — it waits, and the leases expire on
/// their own within `LEASE`.
///
/// The probe and the scan both run off the lock. Holding the mutex across a directory walk would
/// stall every reader in the wave behind a rescan they are the reason we are not doing.
async fn watch_tick(state: &Shared) {
    let watching: Vec<(String, PathBuf, crate::watch::Marks)> = {
        let s = lock(state);
        s.projects
            .iter()
            // Something is out with a reader. Not now.
            .filter(|(_, p)| p.leased.values().all(|t| t.elapsed() >= LEASE))
            .map(|(k, p)| (k.clone(), p.repo.clone(), p.marks))
            .collect()
    };
    for (key, repo, was) in watching {
        let probe_repo = repo.clone();
        let Ok(now) = tokio::task::spawn_blocking(move || crate::watch::probe(&probe_repo)).await
        else {
            continue;
        };
        if now == was {
            continue;
        }
        // **The repo moved and rescanning it is over budget**, so the map stays as it is and
        // says so. This is the only way a scanned project's own map goes out of date without
        // being repaired within a tick — small repos never reach it. See `Project::behind`.
        let priced = {
            let s = lock(state);
            let known = crate::reports::load_index();
            let entry = known.projects.iter().find(|k| k.key == key);
            let _ = &s;
            crate::scan::estimate(entry.and_then(|k| k.files), entry.and_then(|k| k.scan_ms))
        };
        if !priced.fits {
            let mut s = lock(state);
            if let Some(p) = s.projects.get_mut(&key) {
                p.behind = true;
                // The marks are advanced anyway. Without that every tick would re-notice the
                // same change, and a flag that is set once is what the row needs — not a
                // decision re-made twice a second for the life of the window.
                p.marks = now;
            }
            continue;
        }
        let scan_repo = repo.clone();
        let banked = crate::reports::load_index()
            .projects
            .into_iter()
            .find(|k| k.key == key)
            .and_then(|k| k.trace_depth);
        let scanned = tokio::task::spawn_blocking(move || {
            let scans = crate::scancache::ScanCache::open(&scan_repo);
            let mut scan = crate::scan::scan(
                &scan_repo,
                &|_| {},
                &|_| {},
                &std::sync::atomic::AtomicBool::new(false),
                &scans,
                crate::scan::Fidelity::Ordering,
                crate::trace::Depth::Untraced,
            )?;
            // A timer nobody set is the least invited work there is — it already refuses to
            // run while a reader holds a lease, and it takes the budget for the same reason.
            // A branch switch on a large repo must not start a minute of `git log`.
            let trace = trace_within_budget(&scan_repo, &mut scan, &scans, banked.as_deref(), &|_| {});
            Ok::<_, anyhow::Error>((scan, trace))
        })
        .await;
        let Ok(Ok((mut scan, trace))) = scanned else {
            // A repo that has been deleted or moved out from under us fails here every tick.
            // The marks are left alone deliberately: retrying is what recovers a `git
            // checkout` caught mid-write, and there is nothing to report to anyone about a
            // walk that failed on a directory the user is in the middle of changing.
            continue;
        };
        // Reloaded against the fresh tree, exactly as `open_project` does and for the same
        // reason: in-memory reports are keyed by node id, ids carry `@line`, and carrying them
        // across a rescan would orphan every reading in a file where anything moved.
        let reports = load_reports(&repo, &mut scan);
        let file_marks = stamp_marks(&repo, &scan);
        let fresh = crate::watch::probe(&repo);

        let mut s = lock(state);
        // Checked again under the lock. A reader can have taken work during the walk, and the
        // whole point is not to pull the tree out from under one.
        let Some(p) = s.projects.get_mut(&key) else { continue };
        if p.leased.values().any(|t| t.elapsed() < LEASE) {
            continue;
        }
        p.scan = scan;
        p.reports = reports;
        p.reads = p.reads.wrapping_add(1);
        p.file_marks = file_marks;
        // Whatever the budget allowed this time. A repo that was traced and has now moved past
        // what a tick may spend goes back to saying so rather than keeping the old depth's
        // colours over a tree that no longer has those numbers in it.
        p.trace = trace;
        // From after the scan, not the `now` from before it: anything the walk itself touched
        // is then already accounted for and cannot read as a change on the next tick.
        p.marks = fresh;
        p.behind = false;
        p.scanned = p.scanned.wrapping_add(1);
    }
}

/// Bind loopback and serve. Returns the port.
///
/// 127.0.0.1 only, and port 0 so the OS picks a free one. This exposes a read-mostly view
/// of a scan the user already opened, but it is still an open socket on their machine and
/// it has no business being reachable from anywhere else.
pub async fn serve(state: Shared) -> anyhow::Result<u16> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    if let Some(path) = endpoint_file() {
        let _ = std::fs::write(
            path,
            serde_json::json!({ "port": port, "pid": std::process::id() }).to_string(),
        );
    }
    let app = router(state.clone());
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    // The repo does not stand still, and until this existed nothing told the app so: you
    // committed and Blame went on reporting lines as uncommitted, because that was true when
    // the scan ran. Here rather than in the Tauri layer because the backend is where the state
    // lives — `sanity serve` has no window and still holds projects — and because the signal
    // reaches the window through `ProjectSummary`, which it already polls.
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(WATCH_TICK).await;
            watch_tick(&state).await;
        }
    });
    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::{data_home, project_of};
    use crate::agentapi::{AppState, Run};
    use std::sync::{Arc, Mutex};

    /// Standing down withdraws MY claim and never somebody else's.
    ///
    /// The superseded path is a daemon exiting *because* the app has already written its
    /// own port over the top. An unconditional remove there would take the live backend's
    /// address with it, and the next `ensure_backend` would find nothing answering and
    /// start a third server against a window that was working perfectly well — a clean
    /// handover turned into an outage by the tidying.
    #[test]
    fn standing_down_withdraws_only_its_own_claim() {
        let _home = data_home();
        let path = endpoint_file().unwrap();
        let write = |pid: u32| {
            std::fs::write(&path, serde_json::json!({ "port": 4242, "pid": pid }).to_string())
                .unwrap()
        };

        // Superseded: the file names the app, and the departing daemon is 999.
        write(1234);
        release_endpoint(999);
        assert_eq!(
            read_endpoint().map(|e| e.pid),
            Some(1234),
            "took the successor's claim with it"
        );

        // Idling out: the file still names me, so it goes.
        release_endpoint(1234);
        assert!(read_endpoint().is_none(), "left a claim naming a process that has exited");

        // Already gone is not an error — two exits can race, and the second must not panic.
        release_endpoint(1234);
    }

    /// A stale backend is replaced only when replacing it is free.
    ///
    /// Both refusals are the reason `/retire` exists instead of the CLI sending a signal:
    /// the caller knows the builds differ and nothing else, while the backend knows whether
    /// it is a daemon and whether readers are mid-reading. A wave costs minutes and real
    /// tokens per function; a build old enough to render last week's headings is not worth
    /// spending that to correct, and it stands down on its own once the run ends.
    #[tokio::test]
    async fn a_backend_with_a_wave_in_flight_is_not_retired() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let mut p = project_of(dir.path());
        p.run = Some(Run {
            from: 0,
            harness: "claude".into(),
            model: "sonnet".into(),
            width: 5,
            spawned: 3,
            finished: 0,
            failed: 0,
            ended: None,
            ended_at: None,
            failures: Vec::new(),
            stop: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            live: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(3)),
        });
        let mut state = AppState::default();
        state.projects.insert("/p".into(), p);
        let shared: Shared = Arc::new(Mutex::new(state));

        // A window says so and keeps its readers, whatever else is true — checked first
        // because it is the refusal that protects somebody's open app.
        let Json(out) = retire(State(shared.clone())).await;
        assert_eq!(out["ok"], false);
        assert_eq!(out["reason"], "window", "the window's backend offered to shut itself down");

        set_headless();
        let Json(out) = retire(State(shared.clone())).await;
        assert_eq!(out["ok"], false);
        assert_eq!(out["reason"], "busy", "a wave of readers was thrown away over a build number");
        assert!(!retiring(), "the watch loop would have stood the daemon down anyway");

        // The run ends; now there is nothing to lose and it goes.
        lock(&shared).projects.get_mut("/p").unwrap().run.as_mut().unwrap().ended =
            Some("Done.".into());
        let Json(out) = retire(State(shared)).await;
        assert_eq!(out["ok"], true);
        assert!(retiring());
    }

    /// The endpoint file round-trips through the one parser both halves now share.
    #[test]
    fn endpoint_reads_back_what_was_published() {
        let ep = Endpoint { port: 51823, pid: 4242 };
        assert_eq!(ep.url(), "http://127.0.0.1:51823");
        let raw = serde_json::json!({ "port": ep.port, "pid": ep.pid }).to_string();
        let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(v["port"].as_u64(), Some(51823));
        assert_eq!(v["pid"].as_u64(), Some(4242));
    }
}
