//! One repo Sanity is holding: its tree, its readings, and the work out against it.
//!
//! A [`Project`] is what every call about one repo resolves to — the scan, the readings
//! loaded from `.sanity/`, the leases and predictions of a run in flight, and the short feed
//! of what went out and came back. A fresh tree replaces the picture through
//! [`Project::rescan`], which keeps the run. Loading and saving the readings live here too,
//! because the project is the one thing holding both the tree and the store it is checked
//! against.

use super::{stamp_marks, Grade, Report, Revealed, Run, TraceState};
use crate::scan::Scan;
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

/// One project sanity is displaying.
///
/// Sanity holds several at once and an agent creates them just by opening one. That is
/// the whole posture: the app is a vessel, not a tool you configure. Nobody should have
/// to alt-tab to a window and click Open when the session driving it already knows which
/// repo it is sitting in.
#[derive(Clone)]
pub struct Project {
    pub repo: PathBuf,
    pub name: String,
    pub scan: Scan,
    pub reports: HashMap<String, Report>,
    /// Functions handed out and not yet reported, with when they went out.
    ///
    /// Without this the queue ranks by promise and reserves nothing, so parallel readers
    /// all receive the same head of the list — three subagents asking for ten functions
    /// got the same ten, and thirty calls produced fourteen assessments. Leases make
    /// concurrency actually add coverage.
    pub leased: HashMap<String, std::time::Instant>,
    /// When each file last had a function handed out of it.
    ///
    /// `interleave_by_file` spreads work across files *within one handout*, which was the
    /// entire mechanism while a reader received three functions at once. Drip-feeding one
    /// at a time defeated it silently: each call is an independent request for the single
    /// best-ranked function, scores cluster by file because distinctiveness is file-local,
    /// and so a reader's second call lands in the file its first call just opened. A
    /// reader caught it by honestly reporting `cold: false` on its own third reading.
    ///
    /// So the spreading has to survive between calls, and this is the only place it can
    /// live: subagents share one MCP process, so the server cannot tell two readers apart
    /// and cannot do it per reader. A global rest window is cruder and works, because the
    /// case that matters is exactly the one it catches — the same reader coming back
    /// seconds later.
    pub recent_files: HashMap<String, std::time::Instant>,
    /// What each reader said it expected, recorded when it asked for the body.
    ///
    /// **The prediction is the measurement, and it was the one piece of it the reader
    /// wrote down after the fact.** `body`, `by`, `at` and `spec` are all stamped in
    /// `report` on the standing rule that a field whose job is to be checkable later
    /// cannot be self-certified — and `expected` sat beside them, arriving in the same
    /// call as `found`, from a reader that had by then read the code. Nothing dishonest
    /// has to happen for that to go wrong: a reader writing both at once composes them
    /// together.
    ///
    /// `reveal` closes it. The prediction is the price of the body, so it is on the server
    /// before the bytes leave it, and a second `reveal` for the same id cannot revise it.
    /// Cleared when the reading lands.
    pub predictions: HashMap<String, String>,
    /// Which parts of each body actually went out, for bodies served in more than one.
    ///
    /// **The half of this that does not depend on a reader choosing to be honest.** Eighteen
    /// readings in this corpus were graded against bodies their readers never received, and
    /// every one of them said so in a `note` that nothing aggregates — so the store holds
    /// them at `predicted: most`, indistinguishable from a real reading unless somebody
    /// reads the prose. Rules addressed to a model have now been improvised around four
    /// times here; this is a fact the server owns, so `report` can refuse rather than ask.
    ///
    /// Keyed like `predictions` and cleared with them when the reading lands. A body that
    /// fits in one part is not recorded at all — there is nothing a reader could have
    /// missed, and an entry per reading would be a map the size of the queue.
    pub revealed: HashMap<String, Revealed>,
    /// The wave of readers Sanity is running against this repo, if it is running one.
    pub run: Option<Run>,
    /// The last few functions to go out and come back, newest last.
    ///
    /// **Sanity can say what is being read right now, and until it ran the readers it
    /// could not.** Progress was a pair of counts because the only party that knew which
    /// function was in flight was the agent session, narrating into a chat that nothing
    /// kept. Every `next`, `reveal` and `report` passes through here now, so the window
    /// and the terminal can both show the same feed, live, without either asking a model
    /// what it is doing.
    ///
    /// **In memory, bounded, and never a store.** Everything durable in it is already in
    /// `.sanity/`, and a second copy of the readings that a user cannot see is the
    /// `reports.rs` mirror that made deleting `.sanity/` appear to do nothing. This one
    /// dies with the process, which is the property that keeps it honest.
    pub events: std::collections::VecDeque<Event>,
    /// What each file looked like when its functions were last cut out of it.
    ///
    /// Modified-time and length, because a scan is a photograph and the repo is not
    /// standing still. Line numbers come from the scan; `read_source` and every reader's
    /// bounded read go to the file as it is now. Edit anything and every function below
    /// the edit is handed out at the wrong lines — the code view highlights the wrong
    /// extent, and a reader predicts one function, reads whatever now sits at those
    /// lines, and grades the two against each other. That reading is not weak evidence,
    /// it is evidence about nothing, and nothing in it says so.
    ///
    /// Length as well as mtime: a filesystem's mtime resolution is coarse enough that two
    /// writes in the same second can look identical, and this is the guard against
    /// handing out a range that has already moved.
    pub file_marks: HashMap<String, (std::time::SystemTime, u64)>,
    /// Monotonic counter, not a clock: the UI follows whichever project was touched last
    /// and `Instant` would need a baseline to serialise. A counter is enough to order them.
    pub touched: u64,
    /// Bumped every time `reports` changes, which is the one input to a findings report that
    /// has no revision of its own.
    ///
    /// **`reports.len()` is not a substitute and the difference is the whole point.** A
    /// function read a second time REPLACES its reading and leaves the count where it was, so
    /// a cache keyed on length would serve a report taken against the old grade — silently,
    /// and for as long as nobody rescanned. Findings are the surface whose whole discipline is
    /// that silence must never stand in for an answer.
    ///
    /// Every site that writes to `reports` bumps this, and that list IS the correctness
    /// argument: a seventh insert added later and not bumped is a stale report nobody sees.
    pub reads: u64,
    /// The last findings report, and the state of the repo it was taken against.
    ///
    /// **Held because a switch must not pay for one.** A report is a walk of every subject,
    /// a calibration per rule, a hit set per rule and a distribution per field — a second and
    /// a half on kibana in a dev build, and the window asks for it every time a project
    /// becomes active. The scan and the trace are already a tax; this was a third one levied
    /// on merely LOOKING at a repo you had already paid for.
    ///
    /// **Keyed on the four things a report is made of, not invalidated by hand.** `scanned`
    /// moves when the tree does, `reads` when a reading does, `trace.depth` when blame gets
    /// deeper, and the two mtimes when somebody edits the rules or files a decision — by hand
    /// or in the window, which is why they are read off the FILES rather than counted in
    /// memory. A key derived from the inputs cannot be forgotten at a call site the way an
    /// `invalidate()` can.
    pub findings: Option<(FindingsAt, crate::findings::ProjectReport)>,
    /// Every subject a live finding points at, which the queue reads first — see
    /// [`findings_first`].
    ///
    /// **Keyed like `findings`, minus `reads`, so it holds for a whole pass.** The queue is
    /// asked once per reader fetch, and working out the findings on each ask is a walk of
    /// every subject and a calibration per rule, many times a wave. A reading landing
    /// only ever takes a subject OUT of the unread band — and the queue already stops
    /// handing it out once its reading exists — so the set cannot be wrong in the direction
    /// that matters until the tree, the trace depth, the rules or the decisions move, and
    /// the key covers those.
    pub flagged: Option<(FindingsAt, std::sync::Arc<std::collections::HashSet<String>>)>,
    /// What the repo looked like when this scan was taken — see `watch::probe`.
    ///
    /// The comparison the tick makes. Held per project rather than globally because two repos
    /// move independently and a single mark would rescan both whenever either did.
    pub marks: crate::watch::Marks,
    /// How much of this repo's history has been read, and what more would cost.
    pub trace: TraceState,
    /// The repo has moved since this scan, and rescanning it is over [`crate::scan::BUDGET`].
    ///
    /// **The one state where a map is knowingly out of date.** A small repo is repaired by the
    /// next tick and never sets this; a large one would cost more than the watcher may spend
    /// unasked, so the map is kept, the flag is raised, and the row offers a rescan. Keeping
    /// the map and saying nothing would be the same sin as a stale reading keeping its colour.
    pub behind: bool,
    /// Bumped every time a scan lands. The window follows it.
    ///
    /// A counter rather than a timestamp for the same reason `touched` is one: the UI has to
    /// tell "this is a different tree" from "this is the same tree", and equality on a counter
    /// is the whole test. It rides in `ProjectSummary`, which the window already polls, so a
    /// rescan needs no second channel to reach the picture — and a channel that only the
    /// windowed build had would leave `sanity serve` unable to do this at all.
    pub scanned: u64,
    /// When an agent last called about THIS project.
    ///
    /// `AppState::last_agent` is one clock for the whole app, which was enough while only
    /// one repo could be worked at a time. Now that calls route by project, two sessions
    /// genuinely run at once and "is anything happening" has a different answer per repo —
    /// so the sidebar can show a bar for each rather than one bar for whichever project it
    /// guessed.
    pub last_agent: Option<Instant>,
}

/// What a findings report was taken against — see `Project::findings`.
///
/// Every field is something that changes the answer, and nothing else is in here: the point
/// of a key is that it is derived, so a report cannot be served against a repo it does not
/// describe because somebody forgot a call.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FindingsAt {
    pub scanned: u64,
    pub reads: u64,
    pub depth: crate::trace::Depth,
    /// `.sanity/rules/catalog.md` and `.sanity/findings/decisions.md` as the filesystem last
    /// wrote them. Files rather than counters because both are meant to be edited by hand and
    /// merged from a branch — a counter would miss exactly the case the store was designed
    /// for.
    pub rules: Option<std::time::SystemTime>,
    pub decisions: Option<std::time::SystemTime>,
}

impl FindingsAt {
    pub fn of(p: &Project) -> FindingsAt {
        let at = |rel: &str| std::fs::metadata(p.repo.join(rel)).and_then(|m| m.modified()).ok();
        FindingsAt {
            scanned: p.scanned,
            reads: p.reads,
            depth: p.trace.depth,
            rules: at(".sanity/rules/catalog.md"),
            decisions: at(".sanity/findings/decisions.md"),
        }
    }
}

/// Load a project's readings. `.sanity` in the repo is the only source, full stop.
///
/// There was briefly a migration here that read the old machine-local store and wrote it
/// into the repo. It destroyed a project's readings, and the way it did so is worth
/// keeping written down: legacy entries are keyed by node id, node ids embed `@line`, and
/// the lines had moved since those readings were made — so the write matched almost
/// nothing, succeeded at writing nothing, and the code then deleted the only copy because
/// the write had returned `Ok`.
///
/// Two lessons, both of which outlive the migration itself:
///
/// - The unstable identifier was already known to be unstable. `key_of` exists precisely
///   because line numbers move. Using the node id anyway, for the one operation whose
///   input was irreplaceable, is the whole bug.
/// - `Ok` from a write means bytes reached the disk, never that the right bytes did.
///   Nothing destructive should be gated on it. If something like this is ever needed
///   again, read the result back and check it before removing the source.
///
/// **And applied to the tree on the way in**, which is what makes this the only door the app
/// loads readings through. What a reader said about which bodies are tests changes
/// `dependents` and `under_test`, and it lives in the readings rather than the parse — see
/// `links::retest_tree`. `report` applied it when such a reading LANDED, and nothing applied
/// it when readings were LOADED: a launch, an open and a watcher's rescan all drew the
/// structural half only, while `survey` and `export-data` load and then retest. So the window
/// and the export disagreed about the same repo until the next test classification arrived.
pub(crate) fn load_reports(repo: &Path, scan: &mut Scan) -> HashMap<String, Report> {
    let reports = crate::assessment::load(repo, scan);
    crate::links::retest_tree(scan, &reports);
    reports
}

/// Write the readings into the repo.
///
/// There is no fallback any more, and the absence is deliberate. A silent fallback to a
/// hidden file is worse than a visible failure: the reading looks saved, is not where it
/// says it is, and reappears later to contradict the file the user is reading. When this
/// fails — a read-only checkout, a worktree owned by someone else — the caller tells the
/// agent so it can stop and say so, rather than filling an invisible store.
pub(super) fn save_reports(repo: &Path, scan: &Scan, reports: &HashMap<String, Report>) -> Result<(), String> {
    crate::assessment::save(repo, scan, reports).map_err(|e| {
        format!(
            "Could not write {}: {e}. The reading is held in memory but NOT saved — fix \
             the permissions on that directory, or the work will be lost when Sanity \
             closes.",
            crate::assessment::dir(repo).to_string_lossy()
        )
    })
}

/// Canonicalised so `.`, `~/x/` and `/x` are one project rather than three.
pub fn project_key(path: &Path) -> String {
    std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf()).to_string_lossy().to_string()
}

/// How many of a project's recent readings the feed remembers.
///
/// Small on purpose. It is a view of what is happening now, not a log — the record is
/// `.sanity/`, which holds all of it and is meant to be read.
const EVENTS_KEPT: usize = 40;

/// One function going out to a reader, or coming back graded.
#[derive(Debug, Clone, Serialize)]
pub struct Event {
    /// Monotonic within a project, so a watcher can ask for what it has not seen. A clock
    /// would need a baseline to serialise and would say less: what a tail needs is "is
    /// this new to me", which is an ordering question.
    pub seq: u64,
    /// `out` when a reader took it, `read` when a reading landed.
    pub stage: &'static str,
    /// Qualified with its owner where it has one, because a bare `parse` names a dozen
    /// things in some files — the same reason `owner` rides beside `name` in a task.
    pub name: String,
    pub path: String,
    /// How the prediction went. Only on `read`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub predicted: Option<Grade>,
    /// The rest of what the reading found, so a watcher can show the reading rather than
    /// one quarter of it.
    ///
    /// **A bare `most` in a scrolling list says nothing.** The CLI printed `predicted`
    /// alone, unlabeled, so a run scrolled a column of `full`/`some`/`none` past somebody
    /// with no way to know which question they answered — and three of the four axes a
    /// reader grades never reached the terminal at all. They cost a few bytes on a poll
    /// that already carries the name.
    ///
    /// `documented` comes through `grades()`, so a doc the code already implies reads as
    /// `none` here exactly as it does everywhere else — the provenance rule applied at the
    /// point of use rather than left to each caller.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub documented: Option<Grade>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legible: Option<Grade>,
    /// Whether the docs could have been written from the code alone. Not a grade, and the
    /// defense against generated documentation counting as documentation.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub derivable: Option<bool>,
}

impl Project {
    /// Rebuild a project around a fresh scan, keeping everything the scan does not describe.
    ///
    /// **A rescan replaces the picture, not the run**, and the two used to be the same
    /// operation. `scan_repo` built a whole new `Project` with every volatile field emptied,
    /// and a rescan is an ordinary event — selecting a repo in the sidebar is one — so
    /// switching away from a repo being read and back to it destroyed the wave's state while
    /// the wave carried on. What that cost, in order of seriousness: the `predictions`
    /// stamped by `sanity_reveal` before the source was served, which are the measurement
    /// itself and would have come back empty; the leases, so functions already out with a
    /// reader were handed out again; and the `run`, so the panel offered Read on a project
    /// with five readers still spawning.
    ///
    /// Work keyed by node id survives this because ids come from `key_of` — path, name,
    /// ordinal — so they do not move when code does. That is the rule's whole purpose.
    pub fn rescan(
        prev: Option<&Project>,
        repo: std::path::PathBuf,
        name: String,
        scan: Scan,
        reports: HashMap<String, Report>,
    ) -> Project {
        Project {
            file_marks: stamp_marks(&repo, &scan),
            marks: crate::watch::probe(&repo),
            // **The trace belongs to the SCAN, not to the project's run**, so it does not
            // survive here the way the leases and predictions do: this `scan` was folded with
            // whatever depth its caller traced it to, and claiming the last one's depth over a
            // fresh tree would be the map reporting a resolution nobody paid for. The caller
            // sets it from what it actually did.
            trace: TraceState::default(),
            // A fresh tree is by definition not behind the repo it was just read from.
            behind: false,
            leased: prev.map(|p| p.leased.clone()).unwrap_or_default(),
            recent_files: prev.map(|p| p.recent_files.clone()).unwrap_or_default(),
            predictions: prev.map(|p| p.predictions.clone()).unwrap_or_default(),
            // Survives a rescan for the same reason the predictions do, and for a sharper
            // one: a reader holding parts 1 and 2 of a body when the tree is rebuilt would
            // otherwise have its record wiped, and `report` would then accept a reading it
            // has no evidence was made against the whole body. Losing this fails OPEN.
            revealed: prev.map(|p| p.revealed.clone()).unwrap_or_default(),
            run: prev.and_then(|p| p.run.clone()),
            events: prev.map(|p| p.events.clone()).unwrap_or_default(),
            touched: prev.map(|p| p.touched).unwrap_or(0),
            reads: prev.map(|p| p.reads).unwrap_or(0),
            // **Not carried over.** This tree is a different tree, so the report taken against
            // the last one describes a repo that is gone. The key would catch it — `scanned`
            // has just been bumped — and dropping it here says the same thing without relying
            // on that.
            findings: None,
            flagged: None,
            last_agent: prev.and_then(|p| p.last_agent),
            // Bumped, not set. The window watches this for "the tree changed, refetch", and
            // a constant is a change exactly once — every rescan after the first looked
            // identical to no rescan at all.
            scanned: prev.map(|p| p.scanned).unwrap_or(0) + 1,
            repo,
            name,
            scan,
            reports,
        }
    }

    /// Record one function going out or coming back, dropping the oldest.
    pub(super) fn note(&mut self, stage: &'static str, name: String, path: String, found: Option<&Report>) {
        let seq = self.events.back().map(|e| e.seq + 1).unwrap_or(1);
        let (predicted, documented) = match found {
            Some(r) => {
                let (p, d) = r.grades();
                (Some(p), d)
            }
            None => (None, None),
        };
        self.events.push_back(Event {
            seq,
            stage,
            name,
            path,
            predicted,
            documented,
            legible: found.and_then(|r| r.legible).filter(|_| {
                // Dated grades answer a superseded question — see `legible_dated`. Shown as
                // absent rather than as a current answer, on the same rule the map follows.
                found.is_some_and(|r| !r.legible_dated)
            }),
            derivable: found.map(|r| r.derivable),
        });
        while self.events.len() > EVENTS_KEPT {
            self.events.pop_front();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::project_of;

    /// A rescan keeps the run going, and keeps the predictions it has already taken.
    ///
    /// **The volatile half of a project is not derivable from the repo**, which is exactly
    /// why rebuilding it from a fresh scan lost it. Selecting a repo in the sidebar rescans
    /// it, so this fired whenever somebody switched projects and switched back — and the
    /// worst of it was silent: `predictions` holds what a reader committed to BEFORE it was
    /// shown the source, so losing them means the readings still in flight come back with an
    /// empty `expected`. That is the measurement, not a display detail.
    #[test]
    fn a_rescan_does_not_throw_away_the_run_it_lands_in_the_middle_of() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let mut before = project_of(dir.path());
        before.leased.insert("a.rs#one".into(), Instant::now());
        before.predictions.insert("a.rs#one".into(), "it prints".into());
        before.run = Some(Run {
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
        before.note("out", "one".into(), "a.rs".into(), None);

        let scan = before.scan.clone();
        let after = Project::rescan(
            Some(&before),
            dir.path().to_path_buf(),
            "t".into(),
            scan,
            HashMap::new(),
        );

        assert_eq!(
            after.predictions.get("a.rs#one").map(String::as_str),
            Some("it prints"),
            "a prediction taken before the source was served did not survive the rescan"
        );
        assert!(after.leased.contains_key("a.rs#one"), "in-flight work would be handed out twice");
        assert!(after.run.is_some(), "the panel would offer Read while readers are still up");
        assert_eq!(after.run.as_ref().map(|r| r.spawned), Some(3));
        assert_eq!(after.events.len(), 1);
        // And the counter the window watches for "refetch the tree" has to MOVE, or a
        // rescan after the first is indistinguishable from no rescan.
        assert_eq!(after.scanned, before.scanned + 1);

        // A repo being seen for the first time starts empty rather than inheriting anything.
        let fresh = Project::rescan(
            None,
            dir.path().to_path_buf(),
            "t".into(),
            before.scan.clone(),
            HashMap::new(),
        );
        assert!(fresh.run.is_none() && fresh.leased.is_empty() && fresh.predictions.is_empty());
    }
}
