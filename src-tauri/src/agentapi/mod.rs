//! The backend: the loopback API an agent drives, and the reason sanity has one.
//!
//! Every scoring backend so far answers a question the user did not ask. Perplexity,
//! forced decoding, prefill — all of it approximates *"could a model have predicted this
//! code?"* because that is the quantity a model can emit. But the person opening sanity
//! has a plainer question: **will Claude Code get lost in my repo?** An agent can answer
//! that directly, by trying, and it brings context no scoring backend has.
//!
//! # Predict first, then look
//!
//! The obvious protocol is to hand the agent a function and ask whether it understood.
//! It will say yes; models asked to rate their own comprehension almost always do. So the
//! queue hands out **signature, name and neighbors — never the body.** The reader commits
//! to what it expects, *then* asks `reveal` for the body and reports where it was wrong.
//!
//! That is the same contrastive shape that made the token-level hotspots trustworthy, and
//! it resists self-flattery the same way: a prediction made before seeing the answer can
//! be checked against it. "An agent holding what a new teammate would hold guessed wrong
//! here" is a finding somebody can act on.
//!
//! The body goes out only through `reveal`, and only once the prediction is on record on
//! the server. A reader has no filesystem and no copy of the repo, so this is the one door.
//!
//! # What lives where
//!
//! One process holds every project, serves `mcp.rs` and the CLI over HTTP, and spawns the
//! readers itself. It was one file of nine thousand lines; it is split by the question each
//! part answers.
//!
//! - `state` — [`AppState`], the projects held in memory, and which one a call belongs to.
//! - `project` — one [`Project`]: its tree, its readings, its leases, and the feed of events.
//! - `reading` — what a reading IS: [`Report`] and the four-step [`Grade`].
//! - `tasks` — what a reader is handed before it predicts: [`Task`], cut from the tree.
//! - `queue` — `/queue`: which task goes out next, in what order, held by a lease.
//! - `resync` — re-cutting a file that moved since the scan, before a range goes out.
//! - `reveal` — `/reveal`: the body, traded for the prediction, in parts when it is large.
//! - `landing` — `/report`: what is refused, what is stamped server-side, and the write.
//! - `coverage` — the counts: read, stale, remaining, excluded, oversize, and `verify`.
//! - `tally` — the aggregates `/summary` reports, and which model a corpus was read by.
//! - `status` — `/status` and `/summary`, the two endpoints a driving session polls.
//! - `protocol` — what the orchestrator and each reader are told, and the warnings on open.
//! - `open` — `/open` and `/scan`: a repo a person added, scanned and landed as a project.
//! - `run` — `/check` and `/stop`: the pool of reader processes Sanity runs against a repo.
//! - `depth` — `/trace`: how much history the map holds, and the budget a launch spends.
//! - `restore` — the launch: every known project rescanned in the background, in two lanes.
//! - `sidebar` — [`ProjectList`], the rows the window polls, held or not.
//! - `server` — the router, the endpoint file, the watcher, and standing down.

mod coverage;
mod depth;
mod landing;
mod open;
mod project;
mod protocol;
mod queue;
mod reading;
mod restore;
mod resync;
mod reveal;
mod run;
mod server;
mod sidebar;
mod state;
mod status;
mod tally;
mod tasks;

pub use coverage::{
    offline_counts, verify, Instrument, OfflineCounts, Outstanding, Owed, Verification,
};
pub use depth::TraceState;
pub use landing::ReportRequest;
pub use open::{open_for_person, scan_asked, OpenRequest};
pub(crate) use project::load_reports;
pub use project::{project_key, Event, FindingsAt, Project};
pub use protocol::{reader_prompt, PROTOCOL};
pub use queue::{reading_curve, QueueParams};
pub use reading::{Grade, Report};
pub use restore::restore;
pub use resync::stamp_marks;
pub use reveal::{RevealRequest, Revealed, PART_BYTES, READ_CEILING};
pub use run::{default_batch, start_run, stop_all_runs, CheckRequest, Run};
pub use server::{
    any_run_live, build_id, endpoint_file, headless, read_endpoint, release_endpoint, retiring,
    router, serve, set_headless, Endpoint,
};
pub use sidebar::{set_order, ProjectList, ProjectSummary};
pub use state::{lock, AppState, Shared};
pub use status::{StatusParams, SummaryParams};
pub use tally::{
    aggregate_of, report_summary, suggested_model, Aggregate, Drift, GradeCounts, ModelCount,
    Priming, ReportSummary, Tally,
};
pub use tasks::{all_tasks, Task};

#[cfg(test)]
pub(crate) mod tests {
    use super::queue::{queue, QueueParams};
    use super::{stamp_marks, Project, Shared, Task, TraceState};
    use axum::extract::{Query, State};
    use axum::Json;
    use std::collections::HashMap;

    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    /// Which thread currently holds a [`DataHome`], for `AppState::persist` to check.
    ///
    /// The thread and not a bare flag, because the flag would be true for every test while
    /// any ONE of them held a home — which is exactly the window an unguarded test writes
    /// into.
    pub(super) static HOME_THREAD: std::sync::Mutex<Option<std::thread::ThreadId>> =
        std::sync::Mutex::new(None);

    /// A disposable data dir, held for the length of a test.
    ///
    /// **Every test whose state can `persist` needs one.** `touch` and `focus` both write
    /// the project index, so a test without this writes into the developer's real sidebar
    /// — `/x` and `/y` sat in a real one, pointing at temp dirs long since deleted — and,
    /// running in parallel, into the same file the index tests are asserting about. That
    /// is what turned two green CI runs red: the save-mid-restore test read back four
    /// projects because the focus tests had put theirs in the same place.
    ///
    /// The lock is what serialises them; there is one process-wide environment, so
    /// pointing it somewhere private is only private while nobody else is running. The
    /// vars are restored on drop rather than at the end of the test body, so a panicking
    /// test cannot leave the next one aimed at a directory that has been deleted.
    pub(crate) struct DataHome {
        _guard: std::sync::MutexGuard<'static, ()>,
        _dir: tempfile::TempDir,
        prev: Option<std::ffi::OsString>,
    }

    impl Drop for DataHome {
        fn drop(&mut self) {
            *HOME_THREAD.lock().unwrap_or_else(|e| e.into_inner()) = None;
            unsafe {
                match self.prev.take() {
                    Some(v) => std::env::set_var("SANITY_DATA_DIR", v),
                    None => std::env::remove_var("SANITY_DATA_DIR"),
                }
            }
        }
    }

    #[must_use]
    pub(crate) fn data_home() -> DataHome {
        let guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let dir = tempfile::tempdir().unwrap();
        let prev = std::env::var_os("SANITY_DATA_DIR");
        unsafe { std::env::set_var("SANITY_DATA_DIR", dir.path()) };
        *HOME_THREAD.lock().unwrap_or_else(|e| e.into_inner()) = Some(std::thread::current().id());
        DataHome { _guard: guard, _dir: dir, prev }
    }

    /// A project over a real scan of `dir`, traced to `Lines`, with nothing read and nothing out.
    /// Shared by every submodule's tests, which is why it lives here.
    pub(super) fn project_of(dir: &std::path::Path) -> Project {
        let scan = crate::scan::scan(
            dir,
            &|_| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            &crate::scancache::ScanCache::ephemeral(),
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Lines,
        )
        .unwrap();
        let marks = stamp_marks(dir, &scan);
        Project {
            reads: 0,
            findings: None,
            flagged: None,
            repo: dir.to_path_buf(),
            name: "t".into(),
            scan,
            reports: HashMap::new(),
            trace: TraceState { depth: crate::trace::Depth::Lines, ..Default::default() },
            behind: false,
            leased: HashMap::new(),
            recent_files: HashMap::new(),
            predictions: HashMap::new(),
            revealed: HashMap::new(),
            run: None,
            events: Default::default(),
            file_marks: marks,
            marks: crate::watch::probe(dir),
            scanned: 1,
            touched: 0,
            last_agent: None,
        }
    }

    /// Hand out tasks until one of the kind asked for appears, taking the leases with them.
    ///
    /// The lease is the part that matters: `reveal` refuses without one, so a test that
    /// reached into the scan for an id would be exercising a path no reader can take.
    ///
    /// `want_file` rather than "the first one", because the queue interleaves and which
    /// kind arrives first is not a promise. A test that happens to pass because a file
    /// task sorted second is the ordering luck this repo keeps a rule about.
    pub(super) async fn lease_kind(shared: &Shared, key: &str, want_file: bool) -> Task {
        for _ in 0..16 {
            let Json(mut handed) = queue(
                State(shared.clone()),
                Query(QueueParams { n: 1, project: Some(key.to_string()) }),
            )
            .await;
            if handed.is_empty() {
                break;
            }
            let t = handed.remove(0);
            if t.file == want_file {
                return t;
            }
        }
        panic!(
            "the fixture never handed out a {} task",
            if want_file { "file" } else { "function" }
        );
    }
}
