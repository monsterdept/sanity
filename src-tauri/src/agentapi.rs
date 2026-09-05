//! The loopback API an agent drives, and the reason sanity has one.
//!
//! Every scoring backend so far answers a question the user did not ask. Perplexity,
//! forced decoding, prefill — all of it approximates *"could a model have predicted this
//! code?"* because that is the quantity a model can emit. But the person opening sanity
//! has a plainer question: **will Claude Code get lost in my repo?** An agent can answer
//! that directly, by trying, and it brings context no scoring backend has — it can grep,
//! follow call sites, read the tests.
//!
//! # Predict first, then look
//!
//! The obvious protocol is to hand the agent a function and ask whether it understood.
//! It will say yes; models asked to rate their own comprehension almost always do. So the
//! queue hands out **signature, name and neighbors — never the body.** The agent commits
//! to what it expects, *then* opens the file itself and reports where it was wrong.
//!
//! That is the same contrastive shape that made the token-level hotspots trustworthy, and
//! it resists self-flattery the same way: a prediction made before seeing the answer can
//! be checked against it. "An agent holding what a new teammate would hold guessed wrong
//! here" is a finding somebody can act on.
//!
//! Bodies are never sent. The agent already has the repo; shipping code over loopback
//! would be duplicated effort and a second copy to keep in sync.

use crate::model::{Lang, Node, NodeKind};
use crate::scan::Scan;
use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

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

/// Everything sanity is currently holding.
#[derive(Default)]
pub struct AppState {
    pub projects: HashMap<String, Project>,
    /// Key of the project the window should be showing.
    pub active: Option<String>,
    /// The sidebar's hand-made order, as keys. Loaded from the index and written back with
    /// it — see `KnownProjects::order` for why it lives on this machine rather than in a
    /// repo.
    pub order: Vec<String>,
    pub clock: u64,
    /// When an agent last called anything, and what it called.
    ///
    /// Tracked so the window can say whether an agent is working *right now*. Absence of
    /// activity has to be statable — a panel that only appears while something is
    /// happening cannot tell you it is idle, and its absence is indistinguishable from
    /// the feature not existing.
    pub last_agent: Option<Instant>,
    pub last_tool: String,
    /// Ticks per agent call, so the UI can animate on repeats of the same tool.
    pub pings: u64,
    /// Reports turned away by [`mangled`] since this backend started, across all projects.
    ///
    /// A refusal costs a reading its substance — the reader cannot see what went wrong,
    /// and the lever it reaches for is its own prose. Before this, the only record that it
    /// had happened at all was a subagent's recollection of its own transcript, which is
    /// not evidence: a wave of six readers lost work on one of them and the other five
    /// could not tell you so.
    ///
    /// Deliberately global and not per project. The refusal happens before a caller is
    /// routed anywhere — that is the point of refusing early — so attributing it to a repo
    /// would mean resolving one just to file the complaint. It is a property of the wave,
    /// which is the thing being watched.
    pub refused: u64,
    /// Projects the startup restore has read from the index but not yet rescanned.
    ///
    /// Held apart from `projects` on purpose. A placeholder in the map would be a project
    /// with an empty scan, and everything that reads the map would believe it: `sanity_open`
    /// would answer `reopened: true` with zero functions, and the queue would report a repo
    /// as fully assessed because it has no functions to assess. This list is display-only,
    /// and drains as each real scan lands.
    pub restoring: Vec<crate::reports::KnownProject>,
    /// Projects whose scan would cost more than [`crate::scan::BUDGET`], waiting to be asked.
    ///
    /// Held apart from `projects` for the reason above and one more: a repo in here has no
    /// tree at all, so a placeholder would report zero functions as though somebody had
    /// counted them. It is display-only, it carries the estimate the row shows, and it empties
    /// the moment a scan is asked for.
    pub awaiting: HashMap<String, crate::scan::Estimate>,
    /// How far each pending rescan has got, keyed the same way.
    ///
    /// Measured, not estimated. The scan already reports `done`/`total` and the restore was
    /// throwing it away, so the honest fraction was there for free — and a fraction the
    /// scorer actually counted beats any guess from repo size, which is what "how long will
    /// this take" would otherwise have to be built on.
    /// How far a scan has got, what it is doing, and what it is counting — see
    /// `scan::Progress`.
    ///
    /// The whole struct rather than the fields the sidebar happened to want. It was a
    /// `(done, total, phase)` tuple, so `unit` — added because the window was printing the
    /// wrong noun over the right number — would have had to be threaded through four
    /// call sites to reach the row that prints it, which is how the phase came to be
    /// carried here and the unit came not to be.
    pub restoring_progress: HashMap<String, crate::scan::Progress>,
    /// The project somebody is waiting on, so the restore scans it next.
    ///
    /// **A queue ordered before the window is up is a guess; a click is not.** The restore
    /// takes the previously-active project first and the rest by recency, which is the best
    /// anyone can do at launch — and it is wrong the moment somebody opens a small repo that
    /// happens to sit behind a large one. linux is hours; sanity is seconds; and a person
    /// looking at sanity was told `queued` for the length of linux.
    ///
    /// It is set by `project_scan`, which is what the window calls when it switches to a
    /// project — the one signal that means "this is the one I want", as opposed to `active`,
    /// which is a record of where the LAST session was. Consumed by the restore loop with
    /// `take`: it is a request spent on the project it names, not a setting that keeps
    /// applying, and a repo already scanned or in flight is simply not in the queue any more,
    /// which falls through to the running order.
    ///
    /// It changes only WHICH repo is scanned next, never whether one is. Nothing is skipped
    /// and nothing is cancelled; a scan in flight is left to finish, because abandoning it
    /// would throw away work somebody may be about to want and would make the order the
    /// window sees depend on how fast they clicked.
    pub wanted: Option<String>,
    /// The drawable half of a project's map, published before the project itself.
    ///
    /// **A launch should not decode what nobody is looking at.** A project becomes a
    /// `Project` only when its whole tree is in hand — which for ceph means rebuilding
    /// 113,322 function nodes, 0.38s, before the window can draw the eight thousand shapes it
    /// actually shows. The trimmed tree is cached beside the whole one (see
    /// `treecache::slim`) and lands here first, so the map is on screen while the rest
    /// arrives.
    ///
    /// Dropped the moment the real project is inserted. Nothing reads this except the window
    /// asking for a tree — the counts, the queue and a file's functions all wait for the
    /// project, and waiting is correct: they are answers about the whole repo.
    pub shallow: HashMap<String, crate::scan::Scan>,
    /// The last few calls, newest last, each with the tick it happened on.
    ///
    /// A single `last_tool` is what the window polls, and the window polls every two
    /// seconds — long enough for a reader to call `next`, `open` and `report` inside one
    /// interval, which collapsed a whole cycle of work into one animation of whichever
    /// call happened to be last. Keeping a short tail lets the mascot play the sequence
    /// it actually missed. Bounded because it is a display buffer, not a log.
    pub recent: std::collections::VecDeque<(u64, String)>,
}

/// How many calls the window can be behind before the tail stops being worth keeping.
/// Eight is four poll intervals of a fast reader; anything older would animate a burst
/// the user has already stopped watching for.
const RECENT_CALLS: usize = 8;

impl AppState {
    /// Write the project list to disk.
    ///
    /// Called on every change rather than at exit: the app restarts on every code change
    /// during development and gets killed rather than quit in normal use, so "save on
    /// close" means "usually do not save".
    ///
    /// **Merged with what is already on disk, never a straight overwrite.** The live map
    /// is authoritative for the projects this session has loaded and says nothing about
    /// the rest — and at startup "the rest" is most of them, because `restore` rescans
    /// each repo on a background thread and a large one takes seconds. Overwriting meant
    /// the first `touch` in that window published a half-restored map as the whole truth:
    /// open the app with a Claude session attached, `sanity_open` lands before the
    /// restore finishes, and every other project is erased from the index. Not dropped
    /// for the session — erased, because the index is the only record they existed.
    ///
    /// The same merge covers the quieter version: a repo on a disconnected volume fails
    /// its rescan and is skipped, and without this the next touch would forget it rather
    /// than leave it to come back when the volume does. Forgetting a project must take
    /// something more deliberate than being briefly unreadable.
    pub fn persist(&self) {
        // Under test, writing the index is only safe inside a `data_home()` — see its doc.
        // A test that persists without one writes into the developer's real sidebar and,
        // running in parallel, into whatever directory another test is currently asserting
        // about. That was already known and already fixed once by adding `data_home`; it
        // came back because the rule lived in a comment and the next test to call `touch`
        // did not read it. Two of them had, and the symptom was a suite that failed roughly
        // one run in three, always in a test that was itself correct.
        //
        // A panic here names the offender directly. The alternative is what we had: an
        // assertion failure in an innocent test, listing projects it has never heard of.
        //
        // The check is "is THIS thread holding one", not "is the variable set" — the
        // variable is process-global, so an unguarded test sees whatever some other test
        // installed and a check on it passes precisely when the race is happening.
        #[cfg(test)]
        debug_assert_eq!(
            *tests::HOME_THREAD.lock().unwrap_or_else(|e| e.into_inner()),
            Some(std::thread::current().id()),
            "a test persisted the project index outside a data_home() — hold one, or this \
             writes into the real sidebar and races every other test that has one"
        );
        let mut index = crate::reports::load_index();
        let live: Vec<crate::reports::KnownProject> = self
            .projects
            .iter()
            .map(|(key, p)| {
                // **Everything this record holds that memory does not.** `AppState` knows
                // which repos are open and how big they are; it does not know which agent
                // reads this one, what its last scan cost, or how deep anybody has traced it —
                // those are written straight to the index by other paths. So a fresh record
                // built from the live project ERASES them on the next touch of any kind,
                // silently, minutes after they were set.
                //
                // That was written down here for `harness` and it happened again anyway, to
                // `scan_ms` and `trace_depth`, because the trap is a field list and a comment
                // is not one: tracing a second project touched the index and wiped the first
                // project's depth on the way past. `a_touch_cannot_erase_what_only_the_index_
                // knows` is the tripwire; the comment is why.
                let banked = index.projects.iter().find(|k| &k.key == key);
                crate::reports::KnownProject {
                    key: key.clone(),
                    repo: p.repo.to_string_lossy().to_string(),
                    name: p.name.clone(),
                    touched: p.touched,
                    // The one field here the live project simply knows. It is what the restore
                    // sorts lanes by next launch — see `BIG_REPO_FILES`.
                    files: Some(p.scan.stats.files_scanned),
                    scan_ms: banked.and_then(|k| k.scan_ms),
                    trace_depth: banked.and_then(|k| k.trace_depth.clone()),
                    harness: banked.and_then(|k| k.harness.clone()),
                    model: banked.and_then(|k| k.model.clone()),
                }
            })
            .collect();
        // Anything on disk this session has not loaded is carried through untouched. Live
        // entries win on key, so a project that IS loaded is updated rather than doubled.
        index.projects.retain(|known| !self.projects.contains_key(&known.key));
        index.projects.extend(live);
        // `active` is this session's, and only when it has one: a restore that has not yet
        // reached the project the last session was looking at must not blank the record of
        // which one that was.
        if self.active.is_some() {
            index.active = self.active.clone();
        }
        // The arrangement, when this session has one. Empty means nobody has dragged
        // anything HERE, which must not wipe what another session arranged.
        if !self.order.is_empty() {
            index.order = self.order.clone();
        }
        index.projects.sort_by_key(|p| std::cmp::Reverse(p.touched));
        crate::reports::save_index(&index);
    }

    /// Take a project out of the sidebar, out of the index, and out of the cache.
    ///
    /// **It removes a listing, never a repo and never a reading.** The readings are in the
    /// repo's own `.sanity/`, committed, and this does not touch them — re-adding the
    /// project brings back everything it knew, which is what makes the menu item safe
    /// enough to have no confirmation behind it. What is lost is a row, its position in the
    /// history, and this app's own working-out; the way to undo it is the `+` button.
    ///
    /// **The caches go with the row, and they used to stay.** Removing a project left its
    /// tree, scan log, blame and timeline sitting under Application Support with nothing
    /// left anywhere pointing at them — a repo taken out of the sidebar went on costing what
    /// it cost while it was in, until `sweep_slots` aged the files out thirty days later. It
    /// also crossed the two verbs against their own names: Reset deleted the data and kept
    /// the row, Remove kept the data and dropped the row. `forget_all` is the same call Reset
    /// makes, and what it deletes is only ever derived — the repo is where it was and the
    /// readings are inside it.
    ///
    /// The path comes off the INDEX and is read before the entry goes, which is also what
    /// makes it right for the rows with no live project behind them: one declined for cost,
    /// one waiting on the restore, one that has been reset. Those are exactly the ones
    /// somebody removes.
    ///
    /// Here rather than in the command, which is where Reset's purge lives, and the two are
    /// not the same shape: `unload` is HALF a verb — the live half, with the index left
    /// alone — while this is the whole of Remove. A caller that has to remember a second
    /// call is a caller that will forget it.
    ///
    /// Both halves or neither: dropping it from `projects` alone would leave the entry on
    /// disk, so it would come back on the next launch, and dropping it from the index alone
    /// would leave the row on screen until a restart. `persist` carries through any entry
    /// this session has not loaded, so the index has to be edited directly rather than
    /// rewritten from live state.
    ///
    /// A run in flight is stopped by the readers' own next call finding no project, which
    /// is the same path a quit takes; nothing is left holding a lease on something that no
    /// longer exists. The "last repo opened" fallback needs no clearing either — it is a
    /// per-project clock, so it leaves with the project.
    pub fn forget(&mut self, key: &str) {
        // Before the entry is taken out from under it — see the doc.
        let repo = crate::reports::load_index()
            .projects
            .iter()
            .find(|p| p.key == key)
            .map(|p| PathBuf::from(&p.repo));
        self.projects.remove(key);
        // And off the declined list, or a repo taken out of the sidebar comes back as a row
        // offering to scan itself — the ghost `restoring` was written up against, arriving
        // through the one list that does not drain on its own.
        self.awaiting.remove(key);
        self.restoring.retain(|k| k.key != key);
        if self.active.as_deref() == Some(key) {
            self.active = None;
        }
        let mut index = crate::reports::load_index();
        index.projects.retain(|p| p.key != key);
        if index.active.as_deref() == Some(key) {
            index.active = None;
        }
        crate::reports::save_index(&index);
        // After the index write, not before: `persist` merges live state over what is on
        // disk, so running it second is what stops the entry being written back.
        self.persist();
        // Last, and not conditional on any of it: the removal is what the person asked for
        // and it is now durable, so the files that were only ever derived from it go. A
        // delete that failed leaves what leaving them always left — orphans the sweep takes.
        if let Some(repo) = repo {
            crate::reports::forget_all(&repo);
        }
    }

    /// Drop the LIVE state for a project and leave it in the list.
    ///
    /// **The half of `forget` that is not about the sidebar.** A reset throws away everything
    /// derived for a repo, so the tree held in memory is the one thing left claiming the
    /// caches still exist — but the row has to stay, because the point is to scan it again.
    /// `forget` cannot be reused for that: it takes the project out of the index, which is
    /// what makes it Remove rather than Reset.
    ///
    /// The declined and pending lists go with it, on the same rule `forget` states: a repo
    /// left on either comes back as a row offering work about a scan nobody now has.
    pub fn unload(&mut self, key: &str) {
        self.projects.remove(key);
        self.awaiting.remove(key);
        self.restoring.retain(|k| k.key != key);
        if self.active.as_deref() == Some(key) {
            self.active = None;
        }
    }

    /// Move a project to the front of the history. Says nothing about the window.
    ///
    /// It used to set `active` too, and the two are different claims: one is "this was
    /// used most recently", which is the sidebar's ordering, and the other is "this is
    /// what the human is looking at". Fusing them meant any open retargeted the window —
    /// including an open by a headless run in another repo, and including the second of
    /// two agents working two repos at once, which is the hazard `for_client` is written
    /// up against. Whether the view follows is now [`AppState::focus`], decided by the
    /// caller.
    pub fn touch(&mut self, key: &str) {
        self.clock += 1;
        let c = self.clock;
        if let Some(p) = self.projects.get_mut(key) {
            p.touched = c;
        }
        self.persist();
    }

    /// Point the window at a project, if that is not taking a view away from somebody.
    ///
    /// `asked` is a caller saying so outright — `sanity study --show`, or a human
    /// clicking. Absent that, the view only moves when nothing is being looked at: a
    /// fresh launch, a headless daemon that has never had a window, or an `active` key
    /// naming a project that is no longer loaded. The pane the human is reading is not
    /// something a background process gets to reassign, and the sidebar already carries
    /// the new project with its own progress, so nothing is hidden by declining.
    ///
    /// Returns whether the view actually moved, so the caller can say which happened.
    pub fn focus(&mut self, key: &str, asked: bool) -> bool {
        let vacant = self.active.as_ref().is_none_or(|k| !self.projects.contains_key(k));
        if !asked && !vacant {
            return false;
        }
        self.active = Some(key.to_string());
        self.persist();
        true
    }

    /// Somebody is looking at this project now.
    ///
    /// **It focuses and does not `touch`, which is the whole of it being a selection rather
    /// than an open**, and it is a method so there is one place that says so. It lived in
    /// `commands::select_project` as two calls, and the `touch` cost two things at once: the
    /// sidebar is ordered most-recently-touched-first, so every click moved that row to the
    /// top — a list that rearranges itself as you use it, which is what drag-to-arrange
    /// exists to answer — and it broke the invariant [`Self::for_client`] rests on, that
    /// nothing but an open bumps `touched`. With a click bumping it, looking at a second repo
    /// silently changed where a keyless shim would write its readings.
    ///
    /// A test can call this; it cannot call a `#[tauri::command]` taking `tauri::State`. That
    /// is most of the reason it is here rather than there — a rule enforced only inside a
    /// command is a rule with no test on it.
    pub fn select(&mut self, key: &str) {
        self.focus(key, true);
    }

    /// Record a call. `tool` is the tool name, optionally suffixed with the outcome —
    /// `sanity_report:hot` — because what the mascot should do about a reading depends on
    /// what the reading said, and the name of the endpoint cannot carry that.
    pub fn ping(&mut self, tool: &str) {
        self.last_agent = Some(Instant::now());
        self.last_tool = tool.to_string();
        self.pings += 1;
        self.recent.push_back((self.pings, tool.to_string()));
        while self.recent.len() > RECENT_CALLS {
            self.recent.pop_front();
        }
    }

    /// A keyless caller gets the most recently OPENED project, never the window's.
    ///
    /// This used to be `active`, which was the same thing only for as long as opening a
    /// repo also pointed the window at it. Splitting those apart (see [`Self::focus`])
    /// broke the equivalence in the dangerous direction: with the window left on an
    /// earlier repo, a caller that supplied no key would resolve to whatever somebody was
    /// LOOKING at rather than what this session had opened — and `report` takes that same
    /// path, so a reading would be written into another repo's `.sanity/`, attributed and
    /// hashed and looking entirely genuine.
    ///
    /// `touched` is the right fallback because it means what this needs it to mean: every
    /// open bumps it, nothing else does, and no view moves it. It restores exactly the
    /// behavior keyless callers had before the split, without tying it back to a pane.
    ///
    /// It remains a fallback and not a mechanism. A shim that handled `sanity_open` sends
    /// its key on every call and never comes through here.
    fn most_recent(&self) -> Option<String> {
        self.projects.iter().max_by_key(|(_, p)| p.touched).map(|(key, _)| key.clone())
    }

    /// Which project a call belongs to.
    ///
    /// The client's own answer wins; `active` is the fallback for anything that did not
    /// supply one. That order matters: `active` is *which repo the window follows*, and
    /// it changes whenever any agent opens anything. Using it to answer "whose work is
    /// this" meant two agents on two repos silently merged — the second one to call
    /// `sanity_open` took ownership of the first one's queue, its leases and its
    /// readings, and the first one's orchestrator never knew it had changed repos.
    /// **A key that is asked for and not found is NOT the same as no key.** It used to
    /// fall through to `active`, which reopened the exact hole the shim was built to
    /// close: the caller named a repo, the app did not have it, and the call was answered
    /// for whichever project the window happened to be following. A reading would have
    /// been written into another repo's `.sanity/`, attributed and hashed and looking
    /// entirely genuine.
    ///
    /// It is not hypothetical. The app restarts on every edit during development and
    /// `restore` rescans on a background thread, so there is a window on every restart
    /// where the shim holds a perfectly good key for a project that is not loaded yet. A
    /// cold reader found this by predicting the function from that doc comment and
    /// noticing the body does the thing the comment warns about.
    ///
    /// So it returns `None`, and the callers say "not loaded, retry" — the same answer
    /// they give when nothing is open at all, because from the caller's side it is the
    /// same situation: wait, do not throw the reading away.
    pub fn for_client(&self, project: Option<&str>) -> Option<String> {
        match project {
            Some(k) => self.projects.contains_key(k).then(|| k.to_string()),
            None => self.most_recent(),
        }
    }

    // There was an `active_project()` here — resolve the window's repo, ignore the
    // caller. `status` was its last user and its removal is the fix, so the helper goes
    // with it: leaving a one-line shortcut past `for_client` around is an invitation to
    // reopen the hole in the next endpoint.

    /// Which project a READING belongs to: the one that handed the task out.
    ///
    /// `for_client` answers "which repo is this caller asking about", which is the right
    /// question for a queue or a status and the wrong one for a durable write. The two
    /// come apart because the shim's key is one mutable cell shared by every subagent in
    /// a session: any reader that calls `sanity_open` retargets it for all of them, and a
    /// keyless caller falls through to whichever repo was opened last. So a reader could
    /// be handed a function from repo A, predict it, read it, and have its reading routed
    /// to repo B — where the id names nothing, so it was accepted, counted and written
    /// nowhere. Two readers hit that in one wave; one noticed only because the response's
    /// `repo_assessed` was the wrong order of magnitude.
    ///
    /// The handout is the stronger evidence and it is already recorded. A live lease says
    /// this exact id went out of this exact queue; failing that, a project whose scan
    /// still holds the id is the only place the reading could be about. The caller's own
    /// key is consulted first — when it agrees, nothing changes — but it cannot override
    /// a task's provenance, because the party that knows least about where a reading
    /// belongs is the one whose ambient state got swapped underneath it.
    ///
    /// `None` means no loaded project knows this id at all. That is NOT the same as
    /// nothing being open, and the caller has to keep them apart: the first is a reading
    /// with nowhere to land, the second is the restore window that `NO_PROJECT` exists to
    /// describe.
    pub fn owner_of(&self, id: &str, asked: Option<&str>) -> Option<String> {
        let holds = |p: &Project| p.leased.contains_key(id) || holds_id(&p.scan, id);
        // The caller's answer wins WHEN IT IS ALSO TRUE. This keeps the single-repo case
        // — every call in it — on exactly the path it was on before.
        if let Some(k) = asked {
            if self.projects.get(k).is_some_and(&holds) {
                return Some(k.to_string());
            }
        }
        let mut found: Vec<&String> =
            self.projects.iter().filter(|(_, p)| holds(p)).map(|(k, _)| k).collect();
        // Sorted, because a HashMap's order is not one: two repos that both hold an id
        // must not resolve differently between two calls. Ties break toward the most
        // recently opened, which is the closest thing to an intent we have left.
        found.sort();
        match found.len() {
            0 => None,
            1 => Some(found[0].clone()),
            _ => {
                let recent = self.most_recent();
                match recent.filter(|k| found.contains(&k)) {
                    Some(k) => Some(k),
                    None => Some(found[0].clone()),
                }
            }
        }
    }
}

/// Whether a scan still holds this node id.
///
/// Ids embed `@line`, so this answers "as the tree stands right now" and nothing more —
/// which is exactly the question [`AppState::owner_of`] needs. A reader holding a task
/// across a full rescan reports an id that has moved, and the honest answer is that no
/// project holds it: it is refused and re-fetched rather than banked against whatever
/// happens to share the name.
fn holds_id(scan: &Scan, id: &str) -> bool {
    let mut found = false;
    scan.root.visit(&mut |n| found |= n.id == id);
    found
}

/// How long a handed-out function stays reserved.
///
/// Long enough that a reader predicting, opening a file and writing a report is never
/// raced; short enough that a subagent which dies mid-batch returns its work rather than
/// stranding it. Nothing is lost either way — an expired lease just re-queues.
const LEASE: Duration = Duration::from_secs(600);

/// What a reader is told when its reading has nowhere to land.
///
/// This is usually TRANSIENT and was phrased as though it were permanent. The app is
/// rebuilt and relaunched constantly during development, and a restore rescans in the
/// background — so for a second or two after every restart the server is up, answering,
/// and holding no projects. `mcp.rs` cannot absorb that the way it absorbs a refused
/// connection, and deliberately so: an HTTP response that parsed is an answer, and
/// blind-retrying a `report` the server already handled would double-bank a reading.
///
/// So the message has to do the work. Three readers hit the flat "no project open" during
/// this window; two retried on instinct and the third did not, and its reading — a
/// prediction, a read and a grade already paid for — was simply lost. A reader that cannot
/// tell "wait a moment" from "there is nothing here" will pick one, and the expensive
/// mistake is the one that discards work.
const NO_PROJECT: &str = "No project is open for this call. If you were assessing a moment \
    ago this is TRANSIENT — the app restarts during development and takes a second or two \
    to reload its projects. Wait a moment and CALL sanity_report AGAIN with exactly the \
    same arguments, up to about five times; do NOT discard the reading you just made, and \
    do not start over. If it keeps failing, the human needs to call sanity_open, so stop \
    and say so rather than throwing the reading away.";

/// How long a file is passed over after something is drawn from it.
///
/// Long enough to outlast ONE READER'S WHOLE RUN, which is the case this exists for: a
/// reader coming back to a file it opened a few minutes ago and honestly reporting the
/// second reading warm. Short enough that it is a preference and not a lock — `queue` falls
/// back to rested files when nothing else is left, so a repo with four files still finishes.
///
/// **It is tied to `default_n` and it was left behind when that moved.** At 180s the doc
/// said what it was for — "one reader's three functions, about seventy seconds together" —
/// and then the batch became ten and this did not follow. Ten readings take longer than
/// three, so the window expired mid-run and the file came back round: five readers across
/// two waves of a full pass reported being handed a second or third function from a file
/// they had already opened, one of them four in a row, and each marked those readings warm.
/// Warmth is the one thing the whole handout design exists to prevent, so a rest window that
/// does not outlast a run is not a preference, it is a leak.
///
/// 300s against a measured 190-275s for ten readings, taken from sixty readers over a full
/// pass of this repo. Re-measure it when `default_n` moves again — the two are one decision
/// and this is the half that does not announce itself.
const FILE_REST: Duration = Duration::from_secs(300);

/// How many outstanding leases `sanity_status` itemises. A diagnostic, not an inventory:
/// the oldest few answer "is a wave stuck", and the rest are the same answer again.
const OUTSTANDING_SHOWN: usize = 10;

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
fn load_reports(repo: &Path, scan: &Scan) -> HashMap<String, Report> {
    crate::assessment::load(repo, scan)
}

/// Write the readings into the repo.
///
/// There is no fallback any more, and the absence is deliberate. A silent fallback to a
/// hidden file is worse than a visible failure: the reading looks saved, is not where it
/// says it is, and reappears later to contradict the file the user is reading. When this
/// fails — a read-only checkout, a worktree owned by someone else — the caller tells the
/// agent so it can stop and say so, rather than filling an invisible store.
fn save_reports(repo: &Path, scan: &Scan, reports: &HashMap<String, Report>) -> Result<(), String> {
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

pub type Shared = Arc<Mutex<AppState>>;

/// Take the state lock, recovering from poison.
///
/// **Poisoning turned a transient panic into a permanently wrong backend.** A panic
/// anywhere under this lock poisons it for the life of the process, and every reader was
/// written to degrade quietly: `queue` answered with an empty list, `report` with
/// `ok: false`, the window's polls with defaults, and `serve`'s watch loop could not tell
/// how idle it was — so it never stood down. Meanwhile `/health` touches no state at all,
/// by design, so `live()` kept reporting that daemon healthy and `ensure_backend` kept
/// handing it to new sessions instead of starting one that worked. Immortal, useless, and
/// indistinguishable from a working backend over the only probe there is.
///
/// Recovering is honest here because `AppState` holds **nothing precious** — the scan
/// recomputes, the readings are in `.sanity/`, an expired lease re-queues. That is the
/// same property that lets the daemon idle out at all, and it means poisoning has nothing
/// to protect. A caller that panicked mid-mutation leaves at worst one project's live
/// scan inconsistent until the next open rescans it, which is strictly better than every
/// caller after it being told, plausibly, that there is no work to do.
///
/// It returns a guard rather than a `Result` on purpose: there is no `.ok()` left for a
/// call site to swallow, which is what the watch loop was doing.
pub fn lock(state: &Shared) -> MutexGuard<'_, AppState> {
    state.lock().unwrap_or_else(|e| e.into_inner())
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

/// A wave of readers Sanity spawned, and how it is going.
///
/// **The loop this describes used to be prose in `PROTOCOL`** — spawn five to ten, poll
/// `remaining` and `in_flight`, go again unless they are equal, stop where the human said
/// and say so. Every line of it was an instruction to a model that might follow it, on a
/// harness that might be able to, and the two experiments that ever measured a full pass
/// both ended with the driving session describing its own run from what subagents said in
/// chat. As code it is merely a loop.
#[derive(Debug, Clone)]
pub struct Run {
    pub harness: String,
    pub model: String,
    /// How many readers are wanted in flight at once.
    pub width: usize,
    /// Readers started, finished, and exited non-zero. `failed` is reported rather than
    /// retried: a harness that cannot start is a fact about the machine, and a hundred
    /// silent retries would look like a slow run.
    pub spawned: usize,
    pub finished: usize,
    pub failed: usize,
    /// What failed readers said on the way out, deduped — see the drain in `run_wave`.
    ///
    /// Kept because the run's own summary cannot diagnose anything: "three waves finished
    /// without a reading landing" describes the symptom of every possible cause, from an
    /// unsigned-in agent to a `--model` string the CLI rejects. The window shows the summary
    /// and puts this behind an info icon, which is the right split — one is the state of the
    /// run, the other is evidence, and evidence is what you want only once you are looking.
    pub failures: Vec<String>,
    /// When the loop stopped, for telling this run's dying chatter from new work.
    ///
    /// Not shown anywhere. It exists because "an agent called about this project in the
    /// last 60 seconds" is how the panel decides somebody is working, and that window is
    /// deliberately long — a reader predicting, revealing and reporting goes quiet for tens
    /// of seconds inside one reading, and a shorter window flickers. The cost is that after
    /// a Stop, the killed readers' last calls go on answering "yes" for up to a minute, so
    /// the panel said WORKING over a finished run with the Read button already back.
    pub ended_at: Option<Instant>,
    /// Set when the loop has stopped, with why — a whole sentence, capitalised.
    ///
    /// Rendered bare wherever it appears. A caller that prefixes it produced "Stopped —
    /// stopped" the first time somebody pressed the button, and a string that only reads
    /// correctly after one particular prefix has a hidden dependency on one caller.
    ///
    /// `None` while it is still going.
    pub ended: Option<String>,
    /// Asked to stop. A reader that is already going is killed rather than waited for: it
    /// runs for minutes, and the alternative is a coding agent still spending tokens after
    /// the human asked it to stop. The reading it was on is lost, which is the cheaper half
    /// of that trade.
    pub stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    /// How many reader processes are alive right now.
    ///
    /// **Shutdown waits on this, and a timer is not good enough.** It was a flat 900ms
    /// sleep, which is plenty for one reader and not for three: the kills are done by
    /// per-reader tasks, so `exit(0)` after a fixed wait cuts off whichever ones had not
    /// been scheduled yet. Measured — one reader died, three survived as orphans on PPID 1.
    /// Counting them means the wait ends when the job is actually done.
    pub live: std::sync::Arc<std::sync::atomic::AtomicUsize>,
}

/// One unit of work: everything a reader gets *before* opening the file.
#[derive(Debug, Clone, Serialize)]
pub struct Task {
    pub id: String,
    /// Repo-relative, and there is deliberately no absolute one beside it any more.
    ///
    /// `abs_path` existed so a reader could open the file itself. Under `reveal` the
    /// source arrives from the server, so the only thing an absolute path could still do
    /// is invite the read this design removed — and a field whose sole remaining use is
    /// the forbidden one is not a convenience, it is a door. The relative path stays
    /// because it is real evidence for a prediction: `src-tauri/src/parse.rs` tells a
    /// reader something about what it is being asked to guess.
    pub path: String,
    pub line: u32,
    /// The last line of the body. Handed over so the reader opens the function and only
    /// the function: these files run to thousands of lines, and an unbounded read both
    /// costs a fortune and shows the reader the bodies of functions it is about to be
    /// asked to predict — the read-ahead the ordering exists to prevent.
    pub end_line: u32,
    pub name: String,
    /// The type, trait or class this function hangs off, when it hangs off one.
    ///
    /// The reader was told `parse`, in a file holding a dozen `parse`s, and `peers` showed
    /// it `parse` again — so it predicted one twin, read another, and reported the docs it
    /// had been given as belonging to something else. That reads as a copy-paste bug in
    /// the repo, and it is not one: it is the queue handing over a name that identifies
    /// nothing. Sent as its own field rather than spliced into `name`, because `name` is
    /// half of the key every committed reading is stored under.
    #[serde(default)]
    pub owner: Option<String>,
    /// The declaration line. Without it an overloaded name is unresolvable — the reader
    /// sees the same name twice in `peers` and has to guess which one it was handed.
    #[serde(default)]
    pub signature: String,
    /// Other functions in the same file — the context a teammate would have.
    ///
    /// Qualified by owner where there is one, for the reason above and for one the
    /// dedupe made worse: two same-named twins collapsed to a single entry, so the list
    /// actively concealed that the file held more than one.
    ///
    /// The nearest [`PEER_WINDOW`] in file order, not the whole file — see there for what
    /// the whole file was costing.
    pub peers: Vec<String>,
    /// How many siblings the window left out, so a truncated list is never mistaken for
    /// a complete one. Zero when the file fits.
    #[serde(default)]
    pub peers_omitted: usize,
    /// The documentation OF THIS THING: a function's own comment, or a file's header.
    ///
    /// Handed over BEFORE the prediction on purpose — an agentic reader reads the comments
    /// before the code, so predicting without them measures a harder question than anyone
    /// actually faces.
    ///
    /// It used to be the whole stack, the chunk's doc and then the file's, in one unlabeled
    /// array. That was fine while file headers were rare and became a defect the day they
    /// were collected for every file: two readers in one wave reported a module's header as
    /// the function's own documentation, and one of them graded it against the wrong subject.
    /// An array whose meaning depends on its length is a contract that has to be explained;
    /// two fields explain themselves.
    #[serde(default)]
    pub docs: Vec<String>,
    /// The header of the file this lives in, as CONTEXT rather than as its documentation.
    ///
    /// Empty on a file task, where the header is the subject and arrives in `docs`. Also
    /// empty when the file has none, which is common and is a finding rather than a gap.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub file_doc: String,
    pub lines: u32,
    /// Whether this task is a FILE rather than a function.
    ///
    /// A file reading asks the same three questions one level up: predict what this file is
    /// for from its name, its header and its declarations; then open it and grade whether
    /// the header covers what is actually in there, and whether that header could have been
    /// written from the code alone. It exists because nothing measured the header — it was
    /// handed to every function reader as context and judged by none of them, so a file with
    /// a superb banner and bare functions painted exactly like a file with no banner at all.
    ///
    /// A separate flag rather than a separate endpoint: the queue, the lease, the report and
    /// the store all do the same thing with it, and the one thing that differs is what the
    /// reader is being asked about. `peers` carries the declarations, `docs` carries the
    /// header, and `name` is the file's own name.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub file: bool,
    /// What to do differently, sent only with a file task.
    ///
    /// On the WIRE and only on the tasks it applies to, which is the whole argument. The
    /// alternative was a paragraph in `READER_PROMPT` explaining a kind of task most
    /// readers in a wave never receive — that text is multiplied by the function count,
    /// where this is multiplied by the file count and reaches exactly the reading that
    /// needs it. The same reasoning that put `protocol` and `next_step` in responses
    /// rather than in tool descriptions.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub ask: String,
}

/// The one sentence a file reading needs that a function reading does not.
const FILE_ASK: &str = "\
This task is the FILE, not a function. Predict what the whole file is FOR — its \
responsibility and its shape — from its name, its header in `docs` (empty means it has \
none, which is itself the finding) and the declarations in `peers`, before opening it. Then read it and grade: `predicted` against what you wrote, \
`documented` for whether that header covers what is actually in here, `derivable` for \
whether the header could have been written from the code alone. Leave `legible` and `trap` \
unset — both are judgements about one body.";

/// A four-step ordinal, for the two things a reader can judge but not measure.
///
/// Deliberately not a 0-100. A model asked for a number emits one, but 73 versus 68 is
/// noise: it is not stable across runs on unchanged code, and an unstable score quietly
/// destroys the thing the layout works hardest to protect — recognizing the shape you
/// saw last time. Four steps are a judgement a reader can actually make and repeat. The
/// arithmetic stays here, where it is inspectable, rather than in the model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Grade {
    /// Called it. Nothing in the body the prediction missed.
    Full,
    /// Broadly right, with a detail that wasn't obvious.
    Most,
    /// Recognizable, but the body does real work the prediction didn't cover.
    Some,
    /// The prediction did not describe this code.
    None,
}

impl Grade {
    /// How surprising a prediction at this grade means the code was.
    ///
    /// Not evenly spaced: the interesting distinction is between "I basically knew this"
    /// and "I did not", so the two confident steps sit close together and leave room to
    /// separate the two that matter.
    pub fn surprise(self) -> f32 {
        match self {
            Grade::Full => 0.08,
            Grade::Most => 0.30,
            Grade::Some => 0.62,
            Grade::None => 0.92,
        }
    }

    /// How well documented this code is, at this grade.
    pub fn documented(self) -> f32 {
        match self {
            Grade::Full => 0.95,
            Grade::Most => 0.7,
            Grade::Some => 0.35,
            Grade::None => 0.0,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Report {
    pub id: String,
    /// Lines in the function this reading is about, and whether the reading has expired.
    ///
    /// **Stamped on the way out, never stored** — the same rule `legible_dated` follows, and
    /// for a stronger reason: both are facts about the CODE as it stands, and the store is a
    /// record of a reading. Writing them into `.sanity/` would freeze one scan's opinion
    /// into a file that outlives it.
    ///
    /// They exist so that a directory can draw what its readings look like when the window
    /// has not fetched its functions. The browser folds readings onto function NODES, and a
    /// large repo arrives without them (see `Node::slim`), so a reading whose function is
    /// not on screen could be counted neither by line nor as current — and counting an
    /// expired reading as a live one is the one thing this store must never do. Only the
    /// backend can answer that: staleness is a hash comparison against the live body, which
    /// is precisely what the window is missing.
    ///
    /// `loc` is `0` for a reading whose function no longer exists. That is not a size; it is
    /// how an orphan says so, and the window drops it rather than counting a phantom.
    #[serde(default)]
    pub loc: u32,
    #[serde(default)]
    pub stale: bool,
    /// What the agent expected before reading the body. Recorded even when it was right,
    /// because "expected X, found X" is the evidence that a wedge is genuinely boring.
    ///
    /// **Filled server-side from `reveal`, not from the report.** It arrived in the same
    /// call as `found`, from a reader that had by then read the code — so the one field
    /// that has to predate the body was the only part of the measurement written after it.
    /// `Default` because the report no longer carries it; see [`Project::predictions`].
    #[serde(default)]
    pub expected: String,
    /// What it actually found.
    pub found: String,
    /// How many parts the body was served in, when it took more than one.
    ///
    /// **Evidence that a large body actually arrived, kept because asking did not work.**
    /// Eighteen readings in this corpus were graded against bodies their readers never
    /// received; every one recorded the fact in a `note` and graded anyway, and all
    /// eighteen landed on the same flattering rung. So this is stamped server-side from
    /// [`Project::revealed`], beside `body`, `by` and `at`, on the standing rule that a
    /// field whose job is to be checkable later cannot be self-certified.
    ///
    /// **Absence is what makes the old readings expire, and it is not a migration.** A body
    /// over [`PART_BYTES`] can only be served in parts, so an honest reading of one carries
    /// a count here; a reading of the same body with nothing here was taken when `reveal`
    /// still handed the whole thing over in one response, which is exactly the population
    /// that could not receive it. `is_stale` reads the pair — see there. Nothing rewrites
    /// the store and nothing is deleted: the readings expire, re-queue, and are replaced by
    /// re-reading, which is the only mechanism this codebase has for a changed input.
    ///
    /// `None` on the overwhelming majority of readings, which are one part and have nothing
    /// to prove. It renders only when present, on the same rule as every other absence here.
    #[serde(default)]
    pub paged: Option<usize>,
    /// Whether the body diverged from the expectation in a way that matters.
    ///
    /// Superseded by `predicted`. Kept, and defaulted, so reports written before the
    /// grades existed still load — dropping it would silently discard every assessment
    /// already banked against a repo.
    #[serde(default)]
    pub surprised: bool,
    /// How much of the body the agent's prediction actually covered.
    #[serde(default)]
    pub predicted: Option<Grade>,
    /// How well the documentation it was given covers what the code does.
    ///
    /// Graded by the reader that just read both, which is what the old lexical score
    /// could not do: overlap can tell you a doc talks about the same words as the body,
    /// never whether it says anything true about them.
    #[serde(default)]
    pub documented: Option<Grade>,
    /// Whether that documentation could have been written from the code alone.
    ///
    /// The provenance rule, asked directly. A doc a model could regenerate from the body
    /// explains nothing that was not already there, so it must not count as
    /// documentation — otherwise anyone can run a model over a repo, turn the map green
    /// and make it a liar. A lexical score cannot ask this; a reader can.
    #[serde(default)]
    pub derivable: bool,
    /// How clear the body was ONCE OPEN — the second axis.
    ///
    /// `predicted` asks whether the intent was reachable before opening the file, which is
    /// the question the whole predict-then-read protocol is built to answer. It cannot
    /// distinguish two repos that fail it for opposite reasons: one whose bodies are plain
    /// the moment you look, and one that is unreadable all the way down. Those deserve
    /// different verdicts and scored identically.
    ///
    /// It is free to ask, because by the time this is filled in the reader has read the
    /// body anyway. And it is the half that inline comments legitimately count toward —
    /// they are invisible to `predicted` by construction, since they live inside the thing
    /// being predicted, and feeding them to the predictor would be handing over the answer.
    #[serde(default)]
    pub legible: Option<Grade>,
    /// Something here will bite whoever edits this next.
    ///
    /// Not "I was surprised" — a surprise is about the reader, and a trap is about the
    /// code: an ordering assumption nothing enforces, a silent no-op, an unguarded index, a
    /// resource that leaks on one path.
    ///
    /// **A wrong doc is not a trap**, and the first version of this field said it was. It
    /// read as an invitation on a repo whose commonest defect is exactly that, and a third
    /// of the traps in the first corpus were documentation drift — which `documented` and
    /// `derivable` already grade. Counting it twice inflated the one number whose whole
    /// value is being rare enough to work through.
    ///
    /// Separate from `legible`,
    /// because the two are independent and the dangerous quadrant is the one where they
    /// disagree: a perfectly clear body with a mine under it reads as safe.
    ///
    /// It is also what makes a notes list usable. Notes conflate defects, missing
    /// documentation and readers apologizing for their own misreadings; nothing but the
    /// reader knows which it wrote, and this is it saying so.
    #[serde(default)]
    pub trap: bool,
    /// One sentence a human can read. Optional — a correct prediction needs no note.
    #[serde(default)]
    pub note: String,
    /// Whether the reporter was seeing this file for the first time when it predicted.
    ///
    /// Self-declared and therefore weak, but the alternative is not knowing at all. A
    /// warm reader recalls rather than predicts, so its verdicts are worth less — and the
    /// UI can say so instead of presenting every report as equally earned.
    #[serde(default)]
    pub cold: bool,
    /// How many functions this reader had already assessed when it made this reading —
    /// 1 for the first, 2 for the second.
    ///
    /// `cold` asks "had you read this FILE before?", and that is the smaller half of the
    /// question. A reader working through a batch is also learning the repo's idioms, its
    /// naming conventions, its domain vocabulary and its author's habits — so by its
    /// eighth function it predicts better for reasons that have nothing to do with the
    /// code being clearer, and `cold: true` records none of it. Two readings at different
    /// positions are not comparable measurements, and nothing in the store said which was
    /// which.
    ///
    /// The protocol now hands out one function per reader, so this should be 1 on
    /// everything. It is recorded anyway, because "should be" is not a measurement: a
    /// reader that batches regardless leaves a trace here instead of quietly widening the
    /// scale. Self-declared, and weak for the same reason as `cold`.
    #[serde(default)]
    pub position: Option<u32>,
    /// Whether the repo's own agent instructions were in the reader's context.
    ///
    /// The contamination `cold` cannot see. `cold` asks whether the reader had opened this
    /// FILE, and a host that injects `CLAUDE.md` into every subagent hands it a detailed
    /// description of the architecture it is about to predict — so the reading is honestly
    /// cold and substantially recall. It is not hypothetical: a full pass of a real repo
    /// had readers volunteering it unprompted in roughly a quarter of reports, naming
    /// fifty-odd functions they had recalled rather than inferred, and there was no field
    /// to put it in. The whole finding survives as prose in a caveats document.
    ///
    /// Self-declared, and it has to be: the server sees a tool call, never a system prompt.
    /// The reader is the only party that can see its own context, which is the same reason
    /// `cold` and `position` are asked rather than derived. What makes it checkable is the
    /// server-stamped half beside it — see [`Report::agent_docs`].
    ///
    /// **It must name WHOSE brief, because the first live wave split on exactly that.** Nine
    /// readers, one session: two answered `true` and four answered `false` while explaining,
    /// unprompted, that they were discounting the operator's personal `~/.claude/CLAUDE.md`
    /// and counting only the repo's. Four readers reasoning their way to a distinction the
    /// question never drew is four readers guessing, and the two who went the other way were
    /// not wrong so much as answering a different question — 26 readings landed on the wrong
    /// side of a rule nobody had stated. A global instructions file says nothing about the
    /// code being predicted, which is the only thing this field is about.
    #[serde(default)]
    pub primed: bool,
    /// Which instruction files the repo held when this reading landed, comma-joined.
    ///
    /// Stamped server-side from [`crate::assessment::agent_docs`], beside `body`, `by` and
    /// `at`, and for their reason. It is also the thing that gives `primed` meaning: an
    /// unprimed reading in a repo with no instructions file is trivially true, and the same
    /// reading here says a run was deliberately launched without them. Stamped rather than
    /// recomputed later because a repo can gain or lose a `CLAUDE.md` at any time, and the
    /// question is what was true when somebody read.
    #[serde(default, rename = "agentDocs")]
    pub agent_docs: String,
    /// [`crate::assessment::body_hash`] of the body this reading was made against.
    ///
    /// Filled in by the server from the scan, never by the reporter — an agent asked to
    /// hash what it just read would have to be trusted to do it, and this is the one
    /// field whose whole job is to be checkable later. Empty on readings that predate
    /// the committed store; see `assessment::is_stale`.
    #[serde(default)]
    pub body: String,
    /// Which model made this reading, name and version, as it reported itself.
    ///
    /// Self-declared, like `cold`, and weak for the same reason — but the alternative is
    /// a panel that says "an agent (MCP)" for every reading ever banked, which puts a
    /// frontier model and something small and cheap behind one label. The metric is a
    /// claim about what a competent reader could predict, so *which* reader is part of
    /// the reading. Empty on reports banked before the field existed; the UI falls back
    /// rather than inventing an attribution.
    #[serde(default)]
    pub model: String,
    /// Which model the RUN asked for, stamped server-side beside what the reader says it is.
    ///
    /// **`model` alone cannot answer the question it exists for.** It is self-declared, so a
    /// reading that says `claude-sonnet-4.5` is evidence of what the process believed it
    /// was, and nothing else — and the failure worth catching is a repo quietly read on two
    /// scales, where the thing that changed is what somebody ASKED for. Sanity spawns the
    /// readers now, so the request is a fact it holds at the moment of the report and does
    /// not have to take anybody's word for. It is stamped on the same rule as `body`, `by`,
    /// `at` and `agent_docs`: the fields whose job is to be checkable later cannot be
    /// self-certified.
    ///
    /// Empty when no model was named — the harness picked, which is itself the answer, and
    /// the one `sanity check` warns about out loud.
    ///
    /// **Not a graded input**, so it is out of `reading_hash` and did not move `SPEC`.
    /// Recording who was asked changes nothing about what the reader was asked.
    #[serde(default)]
    pub asked: String,
    /// Which agent Sanity ran to take this reading, stamped server-side.
    ///
    /// **The harness is part of the instrument, not packaging around it.** The same model
    /// id reads differently through two agents — a different system prompt, a different
    /// tool surface, a different amount of its context already spent before it sees the
    /// first function — so `read by claude-sonnet-4.6` is only half an attribution when
    /// that model can be reached through Claude Code and through Antigravity both.
    ///
    /// It is also what makes an agent PRESELECTABLE. The machine-local project index
    /// remembers which agent reads a repo, which is right for a preference and useless as
    /// a record: a repo read on somebody else's laptop, or read by hand over MCP, arrives
    /// with an index that has never heard of it while its `.sanity/` is full of readings.
    /// The corpus is the thing that travels, so the corpus is asked.
    ///
    /// Empty for a reading taken outside a run Sanity started. **Not a graded input** — out
    /// of `reading_hash`, no `SPEC` movement.
    #[serde(default)]
    pub harness: String,
    /// When this reading was taken, UTC, stamped server-side — see `assessment::now_iso`.
    ///
    /// Sortable, and the only thing in a reading that is. `at` is the commit the code was
    /// at, which every reading in one sitting shares; `by` is a person. Empty on everything
    /// banked before this existed, which is why anything reading it has to cope with a
    /// corpus that is partly undated. **Not a graded input** — out of `reading_hash`, no
    /// `SPEC` movement, nothing expires.
    #[serde(default)]
    pub when: String,
    /// Set on the way OUT when `legible` was graded under a superseded question.
    ///
    /// Computed here rather than in the browser, and that is the whole point of the split:
    /// the store records which spec a reading was taken under, and the code decides what
    /// each spec changed. Mirroring `LEGIBLE_SINCE` into TypeScript would put that decision
    /// in two places, and the copy nobody is looking at is the one that goes wrong — which
    /// is exactly how a whole repo's readings lost `derivable`.
    ///
    /// The grade itself is NOT cleared. It is what a reader said, and the panel shows it as
    /// history the same way it shows a stale reading; what it must not do is color a wedge
    /// or count toward a dial. Deleting the reader's answer to make the display simpler
    /// would be destroying evidence to avoid writing a conditional.
    #[serde(default, rename = "legibleDated")]
    pub legible_dated: bool,
    /// The same, for `trap` — see [`crate::assessment::TRAP_SINCE`]. Two flags rather than
    /// one "this reading is dated": the axes moved at different specs and a reading can be
    /// current on one and superseded on the other, so a single flag would grey out a
    /// legibility grade to report a trap question that changed.
    ///
    /// It is also the narrower of the two, and deliberately: a `false` from an older spec
    /// survives, because every change to this question has REMOVED things from it and a
    /// narrowing cannot turn a no into a yes. Only the `true`s are dated.
    #[serde(default, rename = "trapDated")]
    pub trap_dated: bool,
    /// Which reading spec this was taken under — see [`crate::assessment::SPEC`].
    ///
    /// Stamped server-side in the `report` handler, beside `body`, `by` and `at`, and for
    /// the same reason those are: a field whose whole job is to be checkable later cannot
    /// be self-certified. A reader asked to declare which question it was answering could
    /// claim the one that makes its answer look current, which is precisely the claim this
    /// exists to test.
    ///
    /// `0` on everything written before the spec existed, which is not a gap — it is the
    /// answer. An unversioned reading was taken under an unknown question.
    #[serde(default)]
    pub spec: u32,
    /// Whose git identity was configured when the reading was made.
    #[serde(default)]
    pub by: String,
    /// The short commit the repo was at. Empty outside a git repo.
    #[serde(default)]
    pub at: String,
}

impl Report {
    /// An empty reading, for parsers and tests to fill in field by field.
    pub fn blank() -> Report {
        Report {
            id: String::new(),
            // Stamped when the window asks, never stored — see the fields.
            loc: 0,
            stale: false,
            expected: String::new(),
            found: String::new(),
            paged: None,
            asked: String::new(),
            harness: String::new(),
            when: String::new(),
            surprised: false,
            predicted: None,
            documented: None,
            derivable: false,
            legible: None,
            trap: false,
            note: String::new(),
            cold: false,
            position: None,
            primed: false,
            agent_docs: String::new(),
            model: String::new(),
            body: String::new(),
            spec: 0,
            legible_dated: false,
            trap_dated: false,
            by: String::new(),
            at: String::new(),
        }
    }

    /// The two grades, with two rules applied that the grades themselves do not carry.
    ///
    /// An old report only knew surprised-or-not, so it maps to the ends of the scale.
    /// Coarse, but it is what that reader actually said — inventing a middle grade for
    /// it would be making up a judgement nobody made.
    ///
    /// And **`derivable` forces `documented` to `None`**, whatever grade the reader gave:
    /// a doc a model could regenerate from the body explains nothing that was not already
    /// there. That rule lived only in the inline comment below, so the number this returns
    /// was not the number the reader reported and nothing visible from outside said so —
    /// a cold reader predicted this function, found the override, and pointed out that the
    /// TypeScript mirror `reportGrades` documents both rules while this one documents one.
    pub fn grades(&self) -> (Grade, Option<Grade>) {
        let predicted =
            self.predicted.unwrap_or(if self.surprised { Grade::None } else { Grade::Full });
        // A doc the code already implies is not documentation, whatever grade it was
        // given — this is the provenance rule, applied at the point of use so no caller
        // can forget it.
        let documented = if self.derivable { Some(Grade::None) } else { self.documented };
        (predicted, documented)
    }
}

/// How many siblings a reader is shown, at most.
///
/// The list was every function in the file, and on a repo with small files nobody noticed.
/// Measured across three: this repo's median task payload is 920 characters of which 438
/// are siblings; tonepoet's is **5,213 of which 4,759** — 91% — and its p90 is 30,512
/// characters of function names handed to a reader about to read fourteen lines. A full
/// pass there would spend ~22M tokens on sibling lists, more than twice the entire tool
/// contract. It is by a distance the largest thing we control, and it was invisible until
/// `just tokens` was pointed at a repo with big files.
///
/// Twenty, centered on the function, because the value was never a census. "What else is in
/// this file" is a claim about the neighborhood, and the findings this field earns — a
/// test named for a property its neighbors show it does not have — come from the
/// functions either side. Five hundred names are not five hundred times as informative.
///
/// The remainder is reported rather than dropped: a reader handed twenty names with no
/// count would take them for the whole file, which is a different and false statement.
const PEER_WINDOW: usize = 20;

/// The functions either side of this one, and how many were left out.
///
/// Centered where it can be, and sliding to the edges where it cannot — the first function
/// in a file gets twenty below it rather than ten of nothing and ten below.
fn neighbors(names: &[String], i: usize) -> (Vec<String>, usize) {
    if names.len() <= PEER_WINDOW + 1 {
        let peers: Vec<String> =
            names.iter().enumerate().filter(|(k, _)| *k != i).map(|(_, n)| n.clone()).collect();
        return (peers, 0);
    }
    let half = PEER_WINDOW / 2;
    let start = i.saturating_sub(half).min(names.len() - PEER_WINDOW - 1);
    let peers: Vec<String> = names[start..=start + PEER_WINDOW]
        .iter()
        .enumerate()
        .filter(|(k, _)| start + k != i)
        .map(|(_, n)| n.clone())
        .collect();
    let omitted = names.len() - 1 - peers.len();
    (peers, omitted)
}

/// How a language writes "this function, on that type".
///
/// Cosmetic, and still worth getting right: a reader shown `Tag.parse` in a Rust file has
/// been handed a small untruth about the language it is about to read, and the whole
/// exercise is asking it to notice exactly that kind of mismatch.
fn qualify(name: &str, owner: Option<&str>, lang: Option<Lang>) -> String {
    match owner {
        None => name.to_string(),
        // Ruby is deliberately not in the `::` list: there `Foo::bar` means a constant
        // lookup and `Foo#bar` is the method, so neither separator is the obvious one.
        Some(o) if matches!(lang, Some(Lang::Rust | Lang::Cpp | Lang::Php)) => {
            format!("{o}::{name}")
        }
        Some(o) => format!("{o}.{name}"),
    }
}

fn collect_tasks(
    node: &Node,
    done: &HashMap<String, Report>,
    leased: &HashMap<String, Instant>,
    // The enclosing file's own comment, carried down so a chunk's task can hand over the
    // whole stack a reader would have rather than only the chunk's own line.
    file_doc: Option<&str>,
    out: &mut Vec<(f32, Task)>,
) {
    // Past the ceiling this node yields no task, on the `Node::excluded` rule below: still
    // parsed, still drawn, never handed to a reader and never in the denominator. The
    // difference is who decided — `.sanityignore` is the human's judgement about scope, this
    // is a fact about what a reader can hold — so the two absences stay apart on the map and
    // are counted separately. Merging them would let a tool's limitation read as somebody's
    // deliberate exclusion.
    //
    // **This node only, never its subtree.** What the ceiling catches is nearly always a
    // FILE, because a file task is served whole — 856KB is the largest in the corpus against
    // a 177KB largest function — and almost every function inside such a file is perfectly
    // readable. Returning here rather than skipping one task would take a god-file's four
    // hundred functions out of the queue along with it, which is the coverage hole this
    // release is closing, dug from the other end.
    let oversize = node.unreadable();
    if node.kind == NodeKind::Func {
        if oversize {
            return;
        }
        // A reading only excuses a function while it still describes it. Once the body
        // moves, the reading is evidence about code that no longer exists and the
        // function is unread again — which is what makes "update my sanity assessment"
        // the same protocol as making one, rather than a second mode.
        //
        // **A reading can also be superseded without the code moving.** When a graded
        // question is rewritten, the answers to it stop counting — the map greys them, the
        // dials drop them — and until this existed there was no way to work that off: the
        // reading still described the body, so the function returned here and the hole was
        // permanent for anything nobody happened to edit. An expiry a person cannot act on
        // is worse than no expiry, because the app states a gap and then offers no verb.
        //
        // It re-queues for an ORDINARY reading, not for the missing answer alone. Asking a
        // reader only the expired question is the one thing `SPEC` exists to prevent — a
        // grade made by a reader that never predicted this function lands in the same column
        // as one that did, looking comparable. What this buys is a place in the queue.
        let (stale, dated) = match done.get(&node.id) {
            Some(prior) => {
                let stale = crate::assessment::is_stale(prior, node.body.as_deref(), node.bytes);
                let dated = crate::assessment::dated_axis(prior);
                if !stale && !dated {
                    return;
                }
                (stale, dated)
            }
            None => (false, false),
        };
        if leased.get(&node.id).is_some_and(|t| t.elapsed() < LEASE) {
            return;
        }
        // Stale readings outrank everything unread. Code somebody bothered to assess and
        // then changed is where an assessment goes wrong quietly — a wedge that still
        // looks cool because of a reading that expired.
        //
        // A superseded ANSWER ranks below both, and the order is the honest one: stale means
        // the reading describes code that is gone, unread means there is no reading at all,
        // and dated means there is a good reading with one answer greyed out. Three
        // situations, worst first. Bands do not overlap — dated sits at [-1, 0], unread at
        // [0, 1], stale at [1, 2] — so a run works through them in that order however
        // surprising the code is.
        let priority = node.score.map_or(0.5, |s| s.surprise)
            + if stale {
                1.0
            } else if dated {
                -1.0
            } else {
                0.0
            };
        out.push((
            priority,
            Task {
                id: node.id.clone(),
                path: node.path.clone(),
                line: node.line.unwrap_or(0),
                end_line: node.end_line.unwrap_or_else(|| node.line.unwrap_or(0) + node.loc),
                name: node.name.clone(),
                owner: node.owner.clone(),
                signature: node.signature.clone().unwrap_or_default(),
                peers: Vec::new(),
                peers_omitted: 0,
                docs: node
                    .doc
                    .as_deref()
                    .map(|d| d.trim().to_string())
                    .filter(|d| !d.is_empty())
                    .into_iter()
                    .collect(),
                file_doc: file_doc.unwrap_or_default().trim().to_string(),
                lines: node.loc,
                file: false,
                ask: String::new(),
            },
        ));
        return;
    }
    if node.kind == NodeKind::File {
        // Out of scope by the repo's own `.sanityignore`. Never queued, never counted in
        // the denominator, still parsed and still on the map — see `Node::excluded`.
        if node.excluded {
            return;
        }
        // The file itself, as its own reading. Same staleness rule as a function: a header
        // that no longer describes the declarations under it is evidence about a file that
        // no longer exists, and goes back in the queue.
        // Read and still current, or out with a reader: nothing to hand over. Written the
        // same way as the function branch above so the two cannot drift on what "done"
        // means — a stale reading is not done, it is first in line.
        let queue_file = match done.get(&node.id) {
            Some(prior) => crate::assessment::is_stale(prior, node.body.as_deref(), node.bytes),
            None => true,
        } && leased.get(&node.id).is_none_or(|t| t.elapsed() >= LEASE)
            // A file with nothing in it has no declarations to describe, so there is no
            // reading to take: the header would be graded against an empty surface.
            && !node.children.is_empty()
            // Too large to serve whole. Its functions carry on below regardless — see the
            // note at the top of this function about which half of the subtree this costs.
            && !oversize;
        if queue_file {
            let stale = done.contains_key(&node.id);
            // Below every function of its own file and above nothing: a file reading is
            // context for the functions inside it, so a reader that takes one first is
            // better placed — but the queue interleaves by file anyway, and a file task
            // that outranked real functions would put a wave of them ahead of the work.
            let priority = node.score.map_or(0.5, |s| s.hot_share) + if stale { 1.0 } else { 0.0 };
            out.push((
                priority,
                Task {
                    id: node.id.clone(),
                    path: node.path.clone(),
                    line: 1,
                    // The last line anything in it reaches. A file reading is the one task
                    // that legitimately wants the whole file, and this is the honest bound
                    // on "the whole file" that the scan actually knows.
                    end_line: node
                        .children
                        .iter()
                        .filter_map(|c| c.end_line)
                        .max()
                        .unwrap_or(node.loc),
                    name: node.name.clone(),
                    owner: None,
                    signature: String::new(),
                    // Every declaration, not a window. The window exists because a function
                    // needs its NEIGHBORS and a file's list of two hundred is mostly noise
                    // to it; a file reading is a judgement about exactly that list, so
                    // truncating it would be asking about a file while hiding part of it.
                    peers: node
                        .children
                        .iter()
                        .map(|c| qualify(&c.name, c.owner.as_deref(), c.lang))
                        .collect(),
                    peers_omitted: 0,
                    docs: node
                        .doc
                        .as_deref()
                        .map(|d| d.trim().to_string())
                        .filter(|d| !d.is_empty())
                        .into_iter()
                        .collect(),
                    file_doc: String::new(),
                    lines: node.loc,
                    file: true,
                    ask: FILE_ASK.to_string(),
                },
            ));
        }
        // Qualified by owner, and kept in FILE ORDER rather than sorted. Order is what
        // makes the window below mean something: the functions either side of this one are
        // what a person scrolling past would see, and the findings this field actually
        // produces — a test whose name promises more than its neighbors deliver — come
        // from that adjacency, not from an alphabetical census.
        let names: Vec<String> =
            node.children.iter().map(|c| qualify(&c.name, c.owner.as_deref(), c.lang)).collect();
        // AFTER the file's own task, which already carries the complete list and must not
        // have it replaced by a function's window.
        let before = out.len();
        // Which child produced which task, so each one gets its own neighborhood. Not
        // every child yields a task — read and leased ones are skipped — so the index
        // cannot be inferred from position in `out`.
        let mut from: Vec<usize> = Vec::new();
        for (i, c) in node.children.iter().enumerate() {
            let mark = out.len();
            collect_tasks(c, done, leased, node.doc.as_deref(), out);
            from.extend(std::iter::repeat_n(i, out.len() - mark));
        }
        for (k, (_, t)) in out.iter_mut().skip(before).enumerate() {
            let (peers, omitted) = neighbors(&names, from[k]);
            t.peers = peers;
            t.peers_omitted = omitted;
        }
        return;
    }
    for c in &node.children {
        collect_tasks(c, done, leased, None, out);
    }
}

/// Every task the queue could hand out, with nothing read and nothing leased.
///
/// For measurement, not for handing out — `just tokens` weighs the payload a reader
/// actually receives, and building a second version of it in the tool would measure the
/// wrong thing the moment either drifted. `peers` in particular has no bound: it is every
/// function in the file, and a 400-function file sends all 400 names to every reader that
/// touches it.
pub fn all_tasks(scan: &Scan) -> Vec<Task> {
    let mut out = Vec::new();
    collect_tasks(&scan.root, &HashMap::new(), &HashMap::new(), None, &mut out);
    out.into_iter().map(|(_, t)| t).collect()
}

#[derive(Deserialize)]
pub struct QueueParams {
    #[serde(default = "default_n")]
    n: usize,
    /// Which project is asking.
    ///
    /// Supplied by the stdio shim, not by the agent — see `mcp.rs`. The shim handled this
    /// client's `sanity_open`, so it knows the answer and cannot forget it; asking the
    /// model to carry a key through every call would put the one thing that keeps two
    /// sessions apart inside a prompt, where a compaction can drop it.
    #[serde(default)]
    project: Option<String>,
}

/// Ten readings per reader, fetched ONE AT A TIME. Two separate knobs, and they got
/// conflated once already.
///
/// **The number is the edge of what was measured, and deliberately not one step past it.**
///
/// Cost first, because that half is settled. A reader costs about 23,110 to enter plus
/// 3,030 per function, measured on a 1/2/3/5/8 sweep and confirmed at 10 on a second repo.
/// Per function that is `23,110/n + 3,030` — a hyperbola, so there is no natural knee and
/// any choice of one is really a choice about what saving is worth having:
///
/// | n  | tokens/function | saved vs the next step down |
/// |----|-----------------|-----------------------------|
/// | 1  | 26,100          | —                           |
/// | 2  | 14,600          | 11,500                      |
/// | 3  | 10,700          | 3,900                       |
/// | 5  |  7,700          | 1,200 per step              |
/// | 8  |  5,900          | 400 per step                |
/// | 10 |  5,300          | 250 per step                |
///
/// This was 3, on the belief that a reader gets better at a repo as it works — that it
/// learns the idioms and the vocabulary, so a reading taken tenth is made by a better
/// reader than the first, and the map cannot tell that apart from code that is genuinely
/// easier to predict. **Two experiments went looking for that and neither found it.** A
/// full pass of this repo at a batch of three: `full` at 39.5% for position 1 against
/// 38.4% later, flat. Forty readers at a batch of TEN on a 10,828-function repo, buckets
/// forty deep: positions 2 through 10 scattered between 35% and 55% with a slope of
/// essentially zero. 784 readings, two codebases, no warming.
///
/// So the mechanism that argued for a short batch is not in evidence, and the cost of
/// assuming it anyway is 2.5x. Ten is where the measurement stops. Fifteen might be fine
/// and nothing here knows that.
///
/// The one position effect that did show up argues the same way. On the ten-batch repo,
/// position 1 graded `full` 27.5% against 41.9% for everything after — first readings
/// HARSHER, which looks like a reader hedging before it has used the four-step scale
/// rather than anything about the code (z ≈ 1.9; and it did not replicate on the other
/// repo, so treat it as unresolved). If it is real, a bigger batch dilutes it: at three,
/// a third of all readings are position 1; at ten, a tenth.
///
/// **What would move this number.** Down: warming found at positions 8-10 with buckets
/// deeper than forty. Up: a clean measurement at 15-25 finding nothing, which nobody has
/// run. `position` is on every reading and `by_position` buckets per position, so any run
/// at any batch size adds a point to the curve — read it before touching this.
///
/// **Known limitation, and it is repo-shaped.** The queue rests a file for `FILE_REST`
/// after drawing from it, and on a small repo the pool of files with unread work runs out;
/// a reader deep into a batch then gets handed a file it already opened. That happened on
/// a 43-file repo at a batch of three and did not happen on a 731-file one at ten. The
/// binding constraint on batch size is file supply, not warming — and `cold` records it
/// honestly when it bites.
///
/// The other knob: **one at a time.** The saving is the shared CONTEXT, not the shared
/// fetch. A wave that fetched three times inside one context cost 30,125 per reader
/// against 30,495 for a true batch of three — the same — and it is colder, because a
/// reader handed a batch has read every signature, owner and peer list in it before it
/// predicts the first. One reader said so unprompted and downgraded its own readings for
/// it. Equal cost, better measurement, so `default_n` is the size of one HANDOUT and the
/// protocol asks for ten calls.
fn default_n() -> usize {
    1
}

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

/// What to say about the repo's own agent instructions, if it has any.
///
/// **The condition this warns about is invisible from inside a reading.** A host that
/// injects `CLAUDE.md` into every subagent hands each reader a description of the
/// architecture it is about to predict, and the reading comes back honestly `cold` — it had
/// not opened the file — while being substantially recall. A full pass of a real repo shipped
/// with a caveats document reconstructing this from readers who happened to mention it in
/// chat, because nothing had asked them and nothing had warned the human.
///
/// Here rather than in an `inputSchema` description, on the standing rule: a description is
/// loaded once per FUNCTION and this is one sentence per RUN, addressed to the one party who
/// can act on it. A reader cannot unsee its own system prompt — by the time it calls
/// anything, the context is already built. Only the human relaunching decides this.
///
/// **It ASKS, and the first version asserted — which made it worse than saying nothing.**
/// All this function can see is whether the repo has the file. Whether a given session
/// LOADED it is invisible here, and the first draft papered over that with "each reader
/// arrives already holding a description", stated flat. The orchestrator receiving that had
/// the evidence to contradict it — its own context held no brief, because the human had
/// launched with `--setting-sources user` an hour earlier — and relayed it anyway. Noticing
/// an absence is the one thing nobody does unprompted; a tool that has just stated a fact
/// about the repo is a credible source; so a correct belief was overwritten by a wrong one.
/// It then reached the human as "CLAUDE.md WILL be injected into every reader", because the
/// hedge is the first thing lost when a warning is relayed. Anything a tool asserts arrives
/// at the person stronger than it left.
///
/// So the response states only what this process knows, and hands the rest to the party that
/// can actually see it. Asked plainly, an orchestrator answers correctly in both directions;
/// it is the same footing as `cold` and `primed`, which is the footing everything about
/// priming is on. Phrased not to lead, for the same reason.
///
/// **And it says which evidence does not count.** The next orchestrator to get this went and
/// looked: listed the repo, stat'd the file, reported its size, and concluded from its
/// existence on disk that it was holding it. That is the same error one layer down — a fact
/// about the repo answering a question about a session — and it is the obvious thing to do
/// unless told otherwise, because the file is right there and the context is not
/// inspectable in the same way. Naming the two things that prove nothing is cheaper than
/// hoping.
///
/// Absent when the repo has no such file, so a clean repo says nothing. It is a warning and
/// not a refusal: whether the priming matters is a judgement about a specific repo and a
/// specific question, and the tool's job is to make sure nobody discovers it afterwards.
fn priming_note(repo: &Path) -> Option<String> {
    let docs = crate::assessment::agent_docs(repo);
    (!docs.is_empty()).then(|| {
        format!(
            "This repo has {docs} at its root. Sanity cannot see whether your session \
             loaded it, so CHECK YOUR OWN CONTEXT before you decide anything. Neither this \
             message nor the file being on disk is evidence about your context — the only \
             question is whether it is in your instructions. If it is not there, this \
             session was launched \
             without project instructions, your readers inherit that, and the run is clean \
             — say so in one line and carry on. If it is there, every reader arrives \
             holding a description of the code it is about to predict, `predicted` measures \
             recall, and the readings stay honestly `cold` so nothing downstream catches \
             it: tell the human before the first wave, because relaunching with `claude \
             --setting-sources user` is the remedy and only they can do it. Either way \
             every reader answers `primed` for itself, and the store records what the repo \
             held, so the run says which it was."
        )
    })
}

/// What to say about the caller's tool contract, if anything.
///
/// **The failure this exists for produced no error at all.** `tools/list` is answered from
/// the shim's own process image, so a shim left running across a rebuild keeps offering the
/// schema it was compiled with. Two fields were added to `report`; the shim serving readers
/// had never heard of them; the readers could not send what they were not offered; and the
/// store recorded the absence as "no opinion", which is a legitimate value. Eighty readings
/// were taken before anyone noticed, and only because someone read an aggregate and saw a
/// column of zeroes.
///
/// Every part of that chain behaved correctly. The only place the mismatch was knowable was
/// here, where both halves are in one process and neither was being asked.
fn contract_note(sent: Option<&str>) -> Option<String> {
    let mine = crate::mcp::contract_fingerprint();
    match sent {
        Some(f) if f == mine => None,
        Some(_) => Some(
            "Your MCP server is serving a DIFFERENT tool contract from this backend. It \
             was almost certainly started before the binary was rebuilt, and `tools/list` \
             is answered from its own process image — so readers are being offered an \
             older schema and will silently omit any field it does not know about. \
             Restart or reconnect the sanity MCP server before assessing; readings taken \
             now may be missing fields nobody will notice are absent."
                .to_string(),
        ),
        None => Some(
            "Your MCP server predates the contract check and may be serving an older \
             schema than this backend. If it has been running since before the last \
             rebuild, restart or reconnect it before assessing."
                .to_string(),
        ),
    }
}

/// The instruction handed back on every open.
///
/// Returned as *data* rather than left to the tool description, because the description
/// is read once when the session starts and this is read at the moment it matters. The
/// contamination problem is the whole reason: an agent that has been working in a repo
/// does not predict its functions, it recalls them, and recall scores as "not surprised"
/// on everything. That silently turns the measurement into a rubber stamp.
///
/// A subagent is the only thing that reliably fixes it — a fresh context window that
/// receives exactly what it is given and nothing else.
///
/// **One function per reader**, which is the correction this text most recently needed.
/// It used to ask for ten, and ten is a scale that widens as the reader works: `cold`
/// catches a file the reader has opened before and catches nothing about the idioms,
/// naming and vocabulary it has absorbed by its eighth prediction. Readings from one run
/// were therefore not comparable to each other, and the improvement read as code getting
/// clearer. One each is not merely cleaner — it is cheaper, because a batch re-sends every
/// earlier prediction on every turn.
pub const PROTOCOL: &str = "\
HOW TO RUN THIS — read all of it before starting.\n\n\
YOU DO NOT ASSESS ANYTHING, AND YOU DO NOT SPAWN READERS. Sanity spawns them itself, as \
separate processes that have no access to this repo and see only what they are handed. \
Your context is full of this codebase: anything you 'predicted' you would be recalling, \
which scores as unsurprising and quietly turns the measurement into a rubber stamp.\n\n\
  1. WHICH MODEL READS IS PART OF THE MEASUREMENT — ASK BEFORE STARTING, unless the user \
     already said. Surprise is what a competent reader could predict, so the reader IS the \
     scale: a smaller model is surprised by more, and its readings are not comparable with \
     the ones already banked. Propose Sonnet and say why in one line. Never mix models \
     within a repo to save money — that is one map on two scales, with nothing on screen \
     saying which wedge is which.\n\
  2. ON A LARGE REPO, ASK FIRST. `functions` plus `files` in the sanity_open response is \
     the size of the job — a file is a reading too, graded on whether its header describes \
     what is in it. If that is more than the user has agreed to spend, say so and pass \
     their cap as `limit` rather than starting and stopping.\n\
  3. Call sanity_check. It returns as soon as the wave is launched; the run continues in \
     the background and survives this session ending.\n\
  4. Poll sanity_status. `remaining` only falls when a reading lands; `in_flight` is what \
     is out with readers; `run` says how many readers Sanity has started, how many \
     finished, and how many FAILED. Readers failing while nothing lands is a broken \
     configuration, not a slow run — say so rather than waiting it out.\n\
  5. When `run.running` is false, report from sanity_summary. Do NOT reconstruct the \
     result from anything you remember, and do NOT read `.sanity/` — a session that has \
     seen the previous readings cannot honestly describe the new ones. If the run stopped \
     short, say so and say how many are left: 'done' and 'out of budget' are different \
     outcomes.\n\n\
Findings are written into the repo itself, at `.sanity/`, as Markdown a person can read. \
Tell the user they are there and that they are theirs to commit; it is not yours to commit \
for them.\n\n\
UPDATING AN EXISTING ASSESSMENT is the same call with nothing added. `stale` counts \
readings whose code has since changed, and those are handed out first.";

/// The half of the protocol a reader receives, split out because it is priced differently.
///
/// Everything above goes to one orchestrator, once. This goes into every subagent, so on a
/// repo of any size it is multiplied by the function count — and `just tokens` has to be
/// able to weigh the two apart. It found this out the hard way first, by locating the
/// boundary with a string search for a heading that had just been reworded, and quietly
/// reporting the whole protocol as the reader's share. A boundary worth measuring is worth
/// making structural.
///
/// Terse on purpose. It used to restate every `sanity_report` field, which the tool schema
/// already carries — one contract, billed to each reader twice.
///
/// **The brief clause is about DISCLOSURE, not access, and that is not a softening.** A
/// `CLAUDE.md` is injected into a subagent's context by the harness before the reader does
/// anything, so "do not read it" is a rule that cannot be followed — and a rule that cannot
/// be followed is how readers learn to treat the rest of this as advisory. What a reader can
/// actually do is notice, discount, and say so.
///
/// It is here rather than nowhere because the question keeps arriving from outside: two
/// separate users' agents reported the same thing, that a repo's brief names specific
/// functions and readers then predict them from it. The measurement was defensible — a new
/// teammate reads the brief too, and documentation reaching the instrument is the whole
/// design — but "defensible" is not the same as "recorded", and the honest answer to a
/// recurring question is a field in the record rather than a paragraph in a reply.
///
/// What it costs: the reader's fixed prefix went 2,212 → 2,315 tokens, ~103 per reading, or
/// about 65k across a full pass of this repo. What it buys is the one thing the corpus could
/// not otherwise say — WHICH readings leaned on the brief — and it narrows what `predicted`
/// claims from "predictable to a new teammate" to "predictable from the handout", which is
/// the only half this tool controls.
/// What one reader is told to do, for a run that hands it `n` functions.
///
/// **A function rather than a constant, and `n` is always [`BATCH`].** It was ten in two
/// places — spelled out in words here, and in `BATCH` for sizing a wave — which is two
/// things that must agree and nothing making them. A wave sized for a batch the readers
/// were never asked to take hands out work nobody collects.
///
/// It briefly took the batch from the request, as a speed-versus-cost slider in the Read
/// dialog. That is removed: the cost curve has no knee to aim at, and the batch is a reading
/// CONDITION — recorded per reading as `position` — so varying it across one repo makes that
/// repo's corpus a mixture in the same way two models do. See the constant.
///
/// Digits, not words. "assessing EXACTLY TEN THINGS" reads better and does not survive
/// substitution — "EXACTLY SEVEN THINGS" needs a spelling table for a string that is
/// already priced per reading.
pub fn reader_prompt(n: usize) -> String {
    format!(
        "\
  You are reading a codebase you have never seen, and you are assessing EXACTLY {n} \
  THINGS, ONE AT A TIME. Repeat this {n} times: call sanity_next with no arguments and \
  it hands you exactly one — usually a function, occasionally a whole file, which carries \
  an `ask` field saying how its question differs; write what you expect its body to do \
  from the name, owner, signature, siblings and docs alone — two or three sentences, no \
  more — THEN call sanity_reveal with that prediction as `expected`, which returns the \
  source; read it and call sanity_report. Only then call sanity_next again. After the \
  last report, stop.\n\n\
  Your prediction is recorded when you ask for the source, and asking again returns the \
  same code and changes nothing. So write it before you call, and write what you actually \
  expect rather than something safe.\n\n\
  A LARGE BODY ARRIVES IN PARTS. The reply says `part N of M`; call sanity_reveal again \
  with the next `part` until you hold all of them, then report. If you cannot get them \
  all, say so to the human and take no reading — do not grade from what you have, and do \
  not go and fetch the rest another way.\n\n\
  Do not ask for more than one at a time. One handout is one function on purpose: a \
  reader given several at once has read every signature, owner and peer list in the batch \
  before it predicts the first, and it costs no less. Set `position` to 1 through {n} in \
  the order you assess them.\n\n\
  Grade `predicted` against what you WROTE, not against what you understand now: the \
  question is what the code told a stranger.\n\n\
  THE PROJECT'S OWN BRIEF IS NOT THE HANDOUT. This repo's CLAUDE.md or AGENTS.md may \
  already be in your context, and some of them explain specific functions by name. Do not \
  open one, and do not let it carry a prediction: predict from the name, owner, signature, \
  peers and docs you were given. Where you notice you knew something from the brief rather \
  than from the handout, grade on the handout alone. Report `primed` on whether THIS \
  REPO's brief was in your context at all — a personal or global instructions file is not \
  it, and whether the brief helped is not the question, since you cannot fully know.\n\n\
  Read only what sanity_reveal gives you. Do not open the repo yourself, do not spawn \
  subagents, and do NOT read the `.sanity/` directory — it holds the previous reader's \
  findings, and seeing them makes everything you say afterwards worthless. If a tool \
  errors, read the message: connection failures \
  are usually transient, so wait and retry the same call a few times rather than \
  inventing a prerequisite or running the tools as shell commands."
    )
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

async fn open_project(
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
    lock(&state).ping("sanity_open");

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

    // In the sidebar NOW, before the scan, not after it.
    //
    // **This is the only window in which the user has nothing to look at.** The agent calls
    // `sanity_open` and then goes silent for as long as the scan takes — no tool output, no
    // chat, nothing — and until this existed the app was silent with it: an empty project
    // list and an onboarding screen still saying "ask your agent to study a project", which
    // is precisely the instruction they had just followed. The one moment somebody most
    // needs to see the machine working was the one moment it showed them nothing.
    //
    // `restoring` already describes exactly this state — a project whose scan has not landed
    // yet, with a progress bar — and it is display-only, so nothing downstream mistakes it
    // for a project that can be queued or reported against.
    {
        let mut s = lock(&state);
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| key.clone());
        s.restoring.retain(|k| k.key != key);
        s.restoring.push(crate::reports::KnownProject {
            key: key.clone(),
            repo: path.to_string_lossy().to_string(),
            name,
            touched: 0,
            files: None,
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        });
    }

    let scan_path = path.clone();
    let started = Instant::now();
    let scanned = tokio::task::spawn_blocking(move || {
        // Persistent, unlike the score cache beside it. The rescan on every open is
        // deliberate and stays — but re-deriving a parse and a blame for a file nobody
        // touched is the same work producing the same answer, and on PrusaSlicer that was
        // 51.5s of a 51.5s open. See `scancache`.
        let scans = crate::scancache::ScanCache::open(&scan_path);
        let mut scan = crate::scan::scan(
            &scan_path,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        )?;
        // **An open is an ASK, so it is not gated** — a person picked this repo or an agent
        // named it, and either way somebody is waiting on the answer and meant to be. What it
        // is not is a blank cheque for depth 2: blame is per-file work on a scale nothing here
        // can predict — an hour on kibana — so it stays an explicit request of its own, the
        // same for a human and for an agent. `sanity_open` reports what that would cost.
        crate::trace::deepen(
            &scan_path,
            &mut scan,
            crate::trace::Depth::Files,
            &scans,
            &std::sync::atomic::AtomicBool::new(false),
            &|_| {},
            &|_| {},
        );
        Ok::<_, anyhow::Error>(scan)
    })
    .await;
    let scan_ms = started.elapsed().as_millis() as u64;

    // Off the pending list however this turned out, before anything can return. A row left
    // reading forever is the same failure as no row at all, and the failure paths are
    // exactly where it would be easiest to forget.
    let settled = |state: &Shared| {
        let mut s = lock(state);
        s.restoring.retain(|k| k.key != key);
        s.restoring_progress.remove(&key);
    };
    let scan = match scanned {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => {
            settled(&state);
            return Json(serde_json::json!({ "ok": false, "error": e.to_string() }));
        }
        Err(e) => {
            settled(&state);
            return Json(serde_json::json!({ "ok": false, "error": e.to_string() }));
        }
    };
    settled(&state);

    let name =
        path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| key.clone());
    let Counts { kept: functions, excluded, oversize } = count_funcs(&scan);
    // Files are readings too, and this response is what the protocol tells an orchestrator
    // to size the job from — so it has to be the whole job, not the function half of it.
    let files = count_files(&scan);
    let shape = shape_of(&scan);
    // Before `scan` is handed to the project, like `shape` above it.
    let unscanned = unscanned_of(&scan);

    let mut s = lock(&state);
    // Reloaded from `.sanity/` against the fresh tree rather than carried over from the
    // old Project. In-memory reports are keyed by node id, and node ids embed `@line` —
    // carrying them across a rescan would orphan every reading in a file where anything
    // moved. `load_reports` resolves the durable `key_of` entries onto the new ids, which
    // is the same thing `restore` does and the only correct way to cross a rescan.
    let reports = load_reports(&path, &scan);
    // The index ships to strangers, and `save` only rewrites it when a reading lands — so
    // a FINISHED repo keeps whatever prose its last reading was written with, forever. An
    // open is the moment we certainly have both the repo and its readings in hand, so it
    // is where an out-of-date index gets caught. It refreshes, never creates: opening a
    // repo with no assessment must not leave a `.sanity/` directory in somebody's tree.
    let index = crate::assessment::refresh(&path, &scan, &reports);
    // The file marks are stamped inside `Project::rescan` below, which runs AFTER the scan
    // and after `refresh` — so anything either of them wrote is already in the marks and
    // cannot read as a change on the first tick. `refresh` only writes when the bytes differ,
    // but "only sometimes fires a spurious rescan" is not a property worth having when the
    // alternative is one stat walk.
    let probe_path = path.clone();
    let stale = count_stale(&scan, &reports);
    // Minus stale, like everywhere else. It was `reports.len()` raw — the same bug
    // `/status` was fixed for and the same consequence: the window said 142 while the agent
    // driving the assessment was told 608, and the optimistic number was the one making
    // decisions about whether to keep going. `assessed` has one definition.
    let assessed = reports.len().saturating_sub(stale);
    // **Through `Project::rescan`, so a reopen cannot quietly destroy a run.** This built a
    // Project from scratch with `run: None`, and `sanity check` posts `/open` before
    // `/check` — so opening a repo that was already being read detached the live wave from
    // the only handle that could stop it. The guard then saw no run and started a second
    // one, `p.run` became the new wave, and the first went on spawning readers that nothing
    // could reach: stop from the window ended the CLI's run while the window's own kept
    // going. Two construction sites for one struct is how the same bug arrives twice; there
    // is one now.
    let mut project = Project::rescan(s.projects.get(&key), path, name.clone(), scan, reports);
    // What the open above actually traced to, and what the depth beyond it would cost — an
    // open never takes depth 2 on its own, so this is where a caller learns what asking for it
    // buys. See `open_project`'s scan.
    project.trace = TraceState { depth: crate::trace::Depth::Files, ..Default::default() };
    // Leases are the one thing a reopen SHOULD drop, and now for one reason rather than
    // two. Ids no longer move when a function does — see `assessment::key_of` — so a lease
    // is no longer a claim on a line. What it is is a claim taken against a BODY that this
    // rescan may have replaced: the reader is out reading text that has changed, and its
    // report would be stamped with the hash of code it never saw. Releasing costs one
    // duplicate reading; keeping it costs a reading that describes nothing and says it is
    // current.
    project.leased.clear();
    project.recent_files.clear();
    project.last_agent = Some(Instant::now());
    s.projects.insert(key.clone(), project);
    // An open is an ask, so whatever the budget declined is now paid for — see `scan_now`.
    s.awaiting.remove(&key);
    s.touch(&key);
    let showing = s.focus(&key, req.focus.unwrap_or(false));
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

/// How much work is genuinely left, and how much of it is available this second.
///
/// These are two different numbers and conflating them was a reporting bug with teeth.
/// `remaining` used to come from the lease-filtered queue, so a function currently held
/// by a reader counted as done — the tool reported `done: true` with "every function has
/// an up-to-date reading" while 34 were still out on lease and unassessed. An instrument
/// that overstates its own coverage is worse than one that measures nothing, because the
/// number looks finished.
///
/// So `remaining` ignores leases entirely: it is unread-or-stale, full stop, and it only
/// falls when a reading actually lands. `in_flight` is what leases explain, and it is the
/// difference between "keep going" and "wait".
/// `outstanding` itemises `in_flight` — which functions, and how long they have been out.
/// A bare count says readers are working; it cannot distinguish that from a wave that died
/// twenty minutes ago and left its batch to rot until the lease expires. The orchestrator
/// polling between waves is the only party that can act on the difference, and it is the
/// one already calling this.
///
/// **Ids and ages, never the task payload.** A reader that fetched a function may already
/// have opened the file, so re-delivering the body would let it "predict" code it has read
/// — recall wearing a prediction's clothes, which grades as unsurprising and turns the
/// wedge green on a reading nobody made. A dropped function is re-queued for somebody
/// else, and never handed back to whoever dropped it.
struct WorkLeft {
    remaining: usize,
    in_flight: usize,
    /// Oldest lease first — that is the end worth looking at, because age is the whole
    /// signal. Ids only.
    outstanding: Vec<(String, u64)>,
}

fn work_left(project: &Project) -> WorkLeft {
    let none = HashMap::new();
    let mut unread = Vec::new();
    collect_tasks(&project.scan.root, &project.reports, &none, None, &mut unread);
    // A lease only counts as in flight while it covers work that is still outstanding: a
    // lease over a function whose reading has since landed explains nothing, and one past
    // LEASE has already returned to the pool.
    let mut outstanding: Vec<(String, u64)> = unread
        .iter()
        .filter_map(|(_, t)| {
            let held = project.leased.get(&t.id)?;
            let age = held.elapsed();
            (age < LEASE).then(|| (t.id.clone(), age.as_secs()))
        })
        .collect();
    outstanding.sort_by_key(|(_, age)| std::cmp::Reverse(*age));
    WorkLeft { remaining: unread.len(), in_flight: outstanding.len(), outstanding }
}

/// Readings whose code has changed under them.
///
/// Reported separately from "unread" everywhere it is surfaced, because they are
/// different situations for the person reading the number: unread is work never done,
/// stale is work that has quietly stopped being true.
/// Every unit of work in a scan — function or file header — skipping what `.sanityignore`
/// set aside.
///
/// **Exclusion is inherited, so it cannot be tested per node.** `Node::excluded` is set on
/// the FILE a pattern matched, and its functions are out of scope with it — which is why
/// `collect_tasks` and `count_funcs` both carry the flag down as they walk. `visit` does
/// not, so anything using it counted work the queue would never hand out: `assessed` and
/// `count_stale` did, while `functions` and `remaining` did not, and on a repo with a
/// `.sanityignore` the four numbers stopped adding up. A coverage line reading `100 of 90`
/// is the visible end of it; "unread minus stale" going negative is the other.
fn each_unit(scan: &Scan, f: &mut impl FnMut(&Node)) {
    fn walk(node: &Node, out_of_scope: bool, f: &mut impl FnMut(&Node)) {
        let out_of_scope = out_of_scope || node.excluded;
        if matches!(node.kind, NodeKind::Func | NodeKind::File) && !out_of_scope {
            f(node);
        }
        for c in &node.children {
            walk(c, out_of_scope, f);
        }
    }
    walk(&scan.root, false, f);
}

fn count_stale(scan: &Scan, reports: &HashMap<String, Report>) -> usize {
    let mut n = 0;
    // Files as well as functions: both are handed out, both are reported, and both expire.
    // Counting only functions left an expired FILE reading in the numerator — `assessed`
    // subtracts this from `reports.len()`, which holds every kind.
    each_unit(scan, &mut |node| {
        if let Some(r) = reports.get(&node.id) {
            if crate::assessment::is_stale(r, node.body.as_deref(), node.bytes) {
                n += 1;
            }
        }
    });
    n
}

/// Things in the scan whose reading still describes them.
///
/// Counted from the SCAN, not from the reports, and that is the whole of it. `reports.len()`
/// is not this number and neither is `reports.len() - stale`, which is what it used to be:
/// `count_stale` walks the scan to find expired readings, so a reading whose function was
/// DELETED is never stale — nothing walks past it — and it sat in the total forever. A repo
/// that removed code could report `assessed` above its own function count, and this one did:
/// `/status` said 241 while `sanity_summary`, which counts differently, said 217 a minute
/// later, after an afternoon of deleting and renaming.
///
/// Walking the live side fixes both halves at once. A deleted function has no node to be
/// found from, so its orphaned reading cannot be counted; a moved one fails `is_stale`
/// against its own node. It is the same direction `save` takes for the same reason — iterate
/// what exists, look up its reading — and the same rule the queue follows: a reading whose
/// body has moved is history, not coverage. An instrument that overstates its own coverage
/// is worse than one that measures nothing.
fn assessed(project: &Project) -> usize {
    let mut n = 0;
    each_unit(&project.scan, &mut |node| {
        if let Some(r) = project.reports.get(&node.id) {
            if !crate::assessment::is_stale(r, node.body.as_deref(), node.bytes) {
                n += 1;
            }
        }
    });
    n
}

/// The counts `/status` reports, computed from a scan and a store with no `Project` around.
///
/// **For the CLI answering without a backend.** Everything here is derivable from what is
/// on disk, so refusing to answer when no daemon happens to be running made `sanity status`
/// the one verb that needed the app open to describe a repo it can read. Kept beside the
/// live definitions rather than reimplemented in `cli.rs`: `assessed` excluding stale, and
/// `remaining` coming from the queue rather than from subtraction, are decisions this repo
/// has made twice and would drift on a third time.
pub struct OfflineCounts {
    pub functions: usize,
    pub files: usize,
    pub excluded: usize,
    /// Units past [`READ_CEILING`] — see [`Counts::oversize`]. Its own number beside
    /// `excluded`, because a reader limit and somebody's `.sanityignore` are opposite
    /// reasons for the same absence and only one of them is anybody's decision.
    pub oversize: usize,
    pub assessed: usize,
    pub remaining: usize,
    pub stale: usize,
}

pub fn offline_counts(scan: &Scan, reports: &HashMap<String, Report>) -> OfflineCounts {
    let Counts { kept: functions, excluded, oversize } = count_funcs(scan);
    let mut unread = Vec::new();
    collect_tasks(&scan.root, reports, &HashMap::new(), None, &mut unread);
    let mut assessed = 0;
    each_unit(scan, &mut |node| {
        if let Some(r) = reports.get(&node.id) {
            if !crate::assessment::is_stale(r, node.body.as_deref(), node.bytes) {
                assessed += 1;
            }
        }
    });
    OfflineCounts {
        functions,
        oversize,
        // Beside `functions`, never folded into it — see `count_files`. A file with
        // declarations is its own reading, so it is in `assessed` and in `remaining`, and a
        // denominator that leaves it out reports more read than there is to read.
        files: count_files(scan).kept,
        excluded,
        assessed,
        remaining: unread.len(),
        stale: count_stale(scan, reports),
    }
}

/// Lines of code sitting in functions that still need reading.
///
/// **The size of the job in the unit the code is written in.** A function count answers
/// "how many things", and a token estimate answers "what will this cost", but neither says
/// how much CODE is involved — and that is the figure somebody already has a feel for,
/// because it is the one the map is drawn in. Width is lines.
///
/// Functions only. A file reading grades the file's header rather than its body, so adding
/// a file's `loc` would count every one of its functions a second time and roughly double
/// the estimate — the same double-count the `functions`/`files` split exists to avoid.
///
/// Stale readings count as outstanding, exactly as [`assessed`] excludes them: the work is
/// there to be done again.
fn unread_lines(project: &Project) -> usize {
    let mut n = 0;
    fn walk(node: &Node, out_of_scope: bool, project: &Project, n: &mut usize) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::Func {
            if out_of_scope {
                return;
            }
            let read = project
                .reports
                .get(&node.id)
                .is_some_and(|r| !crate::assessment::is_stale(r, node.body.as_deref(), node.bytes));
            if !read {
                *n += node.loc as usize;
            }
            return;
        }
        for c in &node.children {
            walk(c, out_of_scope, project, n);
        }
    }
    walk(&project.scan.root, false, project, &mut n);
    n
}

/// Functions in scope, and functions `.sanityignore` set aside.
///
/// Always both, everywhere either is shown. "10,828 functions" and "10,828 functions,
/// 2,140 excluded" are the same repo and different claims, and a percentage divided by
/// the first while the queue works from the second is the instrument overstating itself
/// — the same failure as counting leased work as done.
fn count_funcs(scan: &Scan) -> Counts {
    fn walk(node: &Node, out_of_scope: bool, c: &mut Counts) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::Func {
            // Scope is asked FIRST, so a function that is both reads as excluded. A human
            // took it out of the assessment either way, and reporting it under a heading
            // about tool limits would invite somebody to go and fix a size that nobody is
            // waiting on.
            *(if out_of_scope {
                &mut c.excluded
            } else if node.unreadable() {
                &mut c.oversize
            } else {
                &mut c.kept
            }) += 1;
            return;
        }
        for ch in &node.children {
            walk(ch, out_of_scope, c);
        }
    }
    let mut c = Counts::default();
    walk(&scan.root, false, &mut c);
    c
}

/// What a scan holds, split by whether a reading can be taken of it.
///
/// **Three numbers because there are three reasons, and a coverage figure that merges any
/// two of them is an instrument overstating itself.** `kept` is the denominator — what a run
/// can actually finish. `excluded` is somebody's `.sanityignore`. `oversize` is past
/// [`READ_CEILING`], which is a fact about readers rather than a judgement about the code,
/// and it is reported separately for exactly that reason: folded into `excluded` it would
/// read as a decision a human made, and folded into `kept` it would be a denominator no run
/// can ever reach.
#[derive(Default, Clone, Copy)]
struct Counts {
    /// In scope and readable. The only one that belongs in a denominator.
    kept: usize,
    /// Set aside by `.sanityignore` — see [`Node::excluded`].
    excluded: usize,
    /// Too large for a reading to be taken over — see [`Node::unreadable`].
    oversize: usize,
}

/// Files that are their own reading, and files `.sanityignore` set aside.
///
/// The same shape and the same rule as [`count_funcs`], for the same reason: a file is a
/// unit of work now — queued, leased, reported and expired exactly as a function is — so a
/// coverage figure that divides by functions alone is an instrument overstating itself. The
/// sidebar read `150/631` while the queue held 62 file readings nobody had taken, which is
/// a bar that can fill completely with work outstanding.
///
/// A file with no declarations is not counted, matching `collect_tasks` and `live_files`:
/// there is nothing for its header to be graded against, so it is never handed out.
fn count_files(scan: &Scan) -> Counts {
    fn walk(node: &Node, out_of_scope: bool, c: &mut Counts) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::File {
            if !node.children.is_empty() {
                // A file task is revealed WHOLE, so the ceiling reaches files long before it
                // reaches functions — the largest function in the corpus is 177KB and the
                // file holding it is 856KB. Its functions are counted normally by
                // `count_funcs`; it is only the header reading that cannot be taken.
                *(if out_of_scope {
                    &mut c.excluded
                } else if node.unreadable() {
                    &mut c.oversize
                } else {
                    &mut c.kept
                }) += 1;
            }
            return;
        }
        for ch in &node.children {
            walk(ch, out_of_scope, c);
        }
    }
    let mut c = Counts::default();
    walk(&scan.root, false, &mut c);
    c
}

/// The repo's shape by top-level directory, so an agent can propose a `.sanityignore`
/// with numbers rather than a guess.
///
/// This is the whole reason the feature can work. Nobody shipping the tool can know that
/// `comfy_api_nodes/` is generated or that `tests-unit/` is a different question — but a
/// reader looking at "tests-unit: 900 functions" can put that in front of the human, who
/// decides. Counts only, never names of functions: a directory total tells a future
/// reader nothing about anything it is going to predict.
fn shape_of(scan: &Scan) -> Vec<serde_json::Value> {
    let mut by_dir: std::collections::BTreeMap<String, (usize, usize)> = Default::default();
    fn walk(
        node: &Node,
        out: bool,
        by_dir: &mut std::collections::BTreeMap<String, (usize, usize)>,
    ) {
        let out = out || node.excluded;
        if node.kind == NodeKind::Func {
            let top = node.path.split('/').next().unwrap_or(".").to_string();
            let e = by_dir.entry(top).or_default();
            if out {
                e.1 += 1;
            } else {
                e.0 += 1;
            }
            return;
        }
        for c in &node.children {
            walk(c, out, by_dir);
        }
    }
    walk(&scan.root, false, &mut by_dir);
    let mut rows: Vec<(String, usize, usize)> =
        by_dir.into_iter().map(|(d, (a, b))| (d, a, b)).collect();
    rows.sort_by_key(|(_, a, b)| std::cmp::Reverse(a + b));
    rows.into_iter()
        .take(15)
        .map(|(dir, kept, dropped)| {
            serde_json::json!({ "dir": dir, "functions": kept, "excluded": dropped })
        })
        .collect()
}

/// What the walk left out, as two lists rather than a share.
///
/// **A percentage here would be the frightening number that means nothing.** Measured over
/// text files the unscanned part of a repo is routinely a third of it, and almost all of that
/// is lockfiles, Markdown, JSON and YAML — none of which has a function unit. "110 .scad files
/// not parsed" is a sentence somebody can act on; "30% unmeasured" is a verdict nobody asked
/// this tool to reach. Mechanism here, judgement from the reader, decision with the human —
/// the division `.sanityignore` already runs on.
///
/// Capped, and the remainder is COUNTED rather than dropped. `shape_of` truncates to fifteen
/// directories and says so nowhere in what it emits, which leaves a reader proposing a
/// `.sanityignore` unable to see what was withheld; this is the same hazard `peers_omitted`
/// exists to close, so the omission is a field.
fn unscanned_of(scan: &Scan) -> serde_json::Value {
    /// Enough to show the shape of a repo's gaps without spending a reader's context on the
    /// tail of one-file extensions, which is where this list gets long and stops informing.
    const ROWS: usize = 12;
    let u = &scan.stats.unscanned;
    let unparsed: Vec<serde_json::Value> = u
        .unparsed
        .iter()
        .take(ROWS)
        .map(|k| serde_json::json!({ "ext": k.ext, "files": k.files }))
        .collect();
    serde_json::json!({
        "unparsed": unparsed,
        "unparsed_omitted": u.unparsed.len().saturating_sub(unparsed.len()),
        // Images, prose, configuration and compiled output — everything with no function
        // unit, kept out of the list above so it can answer the question it is for. Reported
        // so the filter is visible rather than felt.
        "not_code": u.not_code,
        "skipped": u
            .skipped
            .iter()
            .map(|s| serde_json::json!({ "reason": s.reason, "files": s.files }))
            .collect::<Vec<_>>(),
    })
}

/// Hand out the next few functions worth assessing, from the active project.
///
/// Ordered by the proxy's guess at surprise so an agent that only gets
/// through a fraction of a large repo spends its budget on the parts most likely to
/// matter — but **spread across files**, which matters more than the ordering does.
///
/// Ranking purely by score handed one reader many functions from the same file, because
/// `distinctiveness` is computed against file-local peers and so scores cluster by file.
/// After the first of them that file is open and read, and every later prediction is
/// recall wearing a prediction's clothes. One reader honestly self-reported 22 of 48 as
/// warm for exactly this reason — which is the protocol working, but only because that
/// reader was honest. Interleaving makes coldness a property of the queue instead of a
/// question the reader has to answer about itself.
fn interleave_by_file(mut ranked: Vec<(f32, Task)>, n: usize) -> Vec<Task> {
    ranked.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    // Round-robin over files, taking each file's best remaining candidate per pass. Files
    // stay in descending order of their strongest function, so the most promising work
    // still comes first — it just never arrives two-from-one-file in a row while any
    // other file has something to offer.
    let mut by_file: Vec<Vec<Task>> = Vec::new();
    let mut seen: HashMap<String, usize> = HashMap::new();
    for (_, t) in ranked {
        match seen.get(&t.path) {
            Some(&i) => by_file[i].push(t),
            None => {
                seen.insert(t.path.clone(), by_file.len());
                by_file.push(vec![t]);
            }
        }
    }
    let mut out = Vec::with_capacity(n);
    let mut round = 0;
    while out.len() < n {
        let mut progressed = false;
        for file in &by_file {
            if let Some(t) = file.get(round) {
                out.push(t.clone());
                progressed = true;
                if out.len() == n {
                    return out;
                }
            }
        }
        if !progressed {
            break;
        }
        round += 1;
    }
    out
}
/// What the file looks like on disk right now, or nothing if it cannot be read.
fn mark_of(repo: &Path, rel_path: &str) -> Option<(std::time::SystemTime, u64)> {
    let m = std::fs::metadata(repo.join(rel_path)).ok()?;
    Some((m.modified().ok()?, m.len()))
}

/// Cut one file's functions out of it again, against the file as it is now.
///
/// Positions, signature, docs and body hash are refreshed; the node **id is left alone**.
/// Ids embed `@line` and would all move, and the reports map is keyed by id for this
/// session — re-keying it here is the shape of the migration that once destroyed a
/// project's readings. Nothing parses an id; the durable key is `key_of(path, name, ord)`,
/// which has no line in it precisely so that this is safe.
///
/// Functions that have gone are dropped. Functions that are NEW are not added: the queue
/// would have to score them, and distinctiveness is measured against every peer in the
/// file. They arrive on the next `sanity_open`, which rescans. Said plainly rather than
/// left to be discovered, because "the map is missing a function you just wrote" is a
/// reasonable thing to be confused by.
fn resync_file(root: &mut Node, repo: &Path, rel_path: &str) -> bool {
    fn find<'a>(n: &'a mut Node, path: &str) -> Option<&'a mut Node> {
        if n.kind == NodeKind::File && n.path == path {
            return Some(n);
        }
        n.children.iter_mut().find_map(|c| find(c, path))
    }
    let Some(file) = find(root, rel_path) else {
        return false;
    };
    let Some(lang) = file.lang else {
        return false;
    };
    let Ok(src) = std::fs::read_to_string(repo.join(rel_path)) else {
        return false;
    };

    // Keyed by name and ordinal — position among same-named functions, in line order.
    // The same ordinal `key_of` uses, and for the same reason: a file holds a dozen
    // `parse`s and the name alone cannot say which of them moved where.
    let defs = crate::parse::parse_functions(lang, &src);
    // Re-cut from the same bytes as the functions. The header is half of what a reading is
    // hashed against, so refreshing the bodies while leaving a stale banner on the file node
    // would make every re-hash below disagree with the one the scan takes — the readings
    // would flip to expired and back on alternate opens.
    let fresh_file_doc = crate::parse::file_doc(lang, &src);
    let mut counts: HashMap<&str, usize> = HashMap::new();
    let mut fresh: HashMap<(&str, usize), &crate::parse::FuncDef> = HashMap::new();
    for d in &defs {
        let ord = counts.entry(d.name.as_str()).or_insert(0);
        fresh.insert((d.name.as_str(), *ord), d);
        *ord += 1;
    }

    file.doc = fresh_file_doc.clone();
    // And the file's own reading hash, from the same bytes. Left behind, a file reading
    // taken before an edit would keep looking current against a surface that has changed —
    // and the scan's own hash would disagree with this one, so the reading would flip
    // between current and expired depending on which pass last touched the node.
    file.body = Some(crate::assessment::reading_hash(
        None,
        fresh_file_doc.as_deref(),
        &crate::scan::file_surface(&defs),
    ));
    let mut counts: HashMap<String, usize> = HashMap::new();
    file.children.retain_mut(|c| {
        let ord = counts.entry(c.name.clone()).or_insert(0);
        let this = *ord;
        *ord += 1;
        match fresh.get(&(c.name.as_str(), this)) {
            Some(d) => {
                c.line = Some(d.start_line);
                c.end_line = Some(d.end_line);
                c.loc = d.loc();
                c.signature = Some(d.signature.clone());
                c.doc = d.doc.clone();
                c.owner = d.owner.clone();
                // Re-hashed here so a reading taken after this points at what the reader
                // actually read. Left stale, `report` would stamp the hash of a body that
                // is already gone and the reading would look current forever.
                c.body = Some(crate::assessment::reading_hash(
                    fresh_file_doc.as_deref(),
                    d.doc.as_deref(),
                    &d.body,
                ));
                true
            }
            None => false,
        }
    });
    true
}

/// What each file looked like at the moment the scan cut its positions.
///
/// **Stamped at the scan, not lazily on the first resync — and that distinction was a real
/// bug.** `resync_changed` used to populate this map itself, treating a first sighting as
/// unchanged: `HashMap::insert` returns `None` for a key it has never held, and
/// `is_some_and` reads that as "not moved". So a file edited between the scan and the first
/// `sanity_next` had its POST-edit mark recorded as though it matched the PRE-edit
/// positions, and was never re-cut for the life of that project.
///
/// Three readers in one wave were handed ranges off by the length of an edit made minutes
/// earlier; one was given a function's doc comment in place of its body and graded a
/// prediction against ten lines of prose. That is the failure `resync_changed` exists to
/// prevent, arriving through its own first line. A mark belongs to the moment the positions
/// were cut, which is the scan.
pub fn stamp_marks(repo: &Path, scan: &Scan) -> HashMap<String, (std::time::SystemTime, u64)> {
    let mut out = HashMap::new();
    scan.root.visit(&mut |n| {
        if n.kind == NodeKind::File {
            if let Some(m) = mark_of(repo, &n.path) {
                out.insert(n.path.clone(), m);
            }
        }
    });
    out
}

/// Re-cut every file that has moved since we last looked.
///
/// Called before anything is handed out, which is the only place it can be: a range is
/// wrong from the moment the file changes, and the queue is what turns a range into a
/// reader's instruction.
///
/// **There is a file watcher now, and it does not replace this.** `watch_tick` rescans the
/// whole project when the repo moves, which re-cuts everything — but it deliberately refuses
/// to run while a reading is out with a reader, because a rescan under a lease produces a
/// report stamped against a body its reader never saw. So the one moment this matters most
/// is exactly the moment the watcher stands down, and this is what covers it: a cheap,
/// targeted re-cut on the path that is about to hand a range to somebody.
///
/// The first pass over a file only records what it looks like — the tree came straight
/// from a scan, so there is nothing to correct yet.
fn resync_changed(project: &mut Project) -> usize {
    let repo = project.repo.clone();
    let mut seen: Vec<(String, (std::time::SystemTime, u64))> = Vec::new();
    project.scan.root.visit(&mut |n| {
        if n.kind == NodeKind::File {
            if let Some(m) = mark_of(&repo, &n.path) {
                seen.push((n.path.clone(), m));
            }
        }
    });
    let moved: Vec<String> = seen
        .into_iter()
        .filter(|(path, m)| {
            project.file_marks.insert(path.clone(), *m).is_some_and(|was| was != *m)
        })
        .map(|(path, _)| path)
        .collect();
    if moved.is_empty() {
        return 0;
    }
    for path in &moved {
        resync_file(&mut project.scan.root, &repo, path);
    }
    // Widths and roll-ups follow the lines that just changed, or the parents keep
    // describing a file that is no longer that size.
    project.scan.root.aggregate();
    moved.len()
}

/// Pick what to hand over, holding back files something was just drawn from.
///
/// [`interleave_by_file`] spreads within one handout and that was the whole mechanism
/// while a reader received three functions at once. One at a time, it does nothing: each
/// call independently returns the best-ranked function, scores cluster by file because
/// distinctiveness is file-local, and the reader's next call lands in the file it has just
/// been reading. So the spread has to be remembered between calls.
///
/// Rested files are PREFERRED, not forbidden. At the end of a run, or in a repo of four
/// files, everything left may sit in a file touched a minute ago — and a warm reading is
/// worth more than a stalled queue with work still on the table.
fn spread_across_files(
    tasks: Vec<(f32, Task)>,
    recent: &HashMap<String, Instant>,
    now: Instant,
    n: usize,
) -> Vec<Task> {
    let (fresh, resting): (Vec<_>, Vec<_>) = tasks.into_iter().partition(|(_, t)| {
        recent.get(&t.path).is_none_or(|at| now.duration_since(*at) > FILE_REST)
    });
    interleave_by_file(if fresh.is_empty() { resting } else { fresh }, n)
}

async fn queue(State(state): State<Shared>, Query(p): Query<QueueParams>) -> Json<Vec<Task>> {
    let mut state = lock(&state);
    let Some(key) = state.for_client(p.project.as_deref()) else {
        return Json(Vec::new());
    };
    let Some(project) = state.projects.get_mut(&key) else {
        state.ping("sanity_next");
        return Json(Vec::new());
    };
    project.last_agent = Some(Instant::now());
    // Before anything is ranked, let alone handed out. A range that has moved is not a
    // slightly-wrong instruction, it is a reader predicting one function and reading
    // whatever now sits at those lines.
    resync_changed(project);

    let mut tasks: Vec<(f32, Task)> = Vec::new();
    collect_tasks(&project.scan.root, &project.reports, &project.leased, None, &mut tasks);
    let now = Instant::now();
    let handed = spread_across_files(tasks, &project.recent_files, now, p.n);

    // Reserved as they go out, so the next caller — very likely a sibling subagent
    // running at the same moment — gets different work.
    for t in &handed {
        project.leased.insert(t.id.clone(), now);
        project.recent_files.insert(t.path.clone(), now);
    }
    // Named for the feed the way `peers` is named for a reader: qualified by owner, because
    // a bare `parse` identifies nothing in a file that holds a dozen of them.
    for t in &handed {
        let name = match (&t.owner, t.file) {
            (_, true) => t.path.clone(),
            (Some(o), _) => format!("{o}::{}", t.name),
            (None, _) => t.name.clone(),
        };
        project.note("out", name, t.path.clone(), None);
    }
    // Handing out nothing when nothing is left is the end of the job, and the only moment
    // in the protocol worth a flourish. Handing out nothing while work is still leased is
    // an ordinary wait, so the two are pinged apart rather than both reading as "done".
    let done = handed.is_empty() && work_left(project).remaining == 0;
    state.ping(if done { "sanity_next:done" } else { "sanity_next" });
    Json(handed)
}

#[derive(Deserialize, Default)]
pub struct CheckRequest {
    #[serde(default)]
    pub project: Option<String>,
    /// Which agent to run readers with. Falls back to what `sanity init` recorded.
    #[serde(default)]
    pub harness: Option<String>,
    /// Which model reads. **No default is invented here** — which model reads IS the
    /// measurement, a smaller one is surprised by more, and its readings are not
    /// comparable with what is already banked. Empty means the harness's own default,
    /// which is at least a choice the user made somewhere.
    #[serde(default)]
    pub model: Option<String>,
    /// How many readers at once.
    #[serde(default)]
    pub readers: Option<usize>,
    /// Stop once this many readings have landed. `None` runs to completion.
    ///
    /// Checked between waves, never mid-reader: a reader is doing ten readings and killing
    /// it part-way through costs a prediction and banks nothing. So a cap of 5 with ten-wide
    /// readers stops at the first wave boundary past 5, and the run reports what it actually
    /// did rather than what was asked for.
    #[serde(default)]
    pub limit: Option<usize>,
}

/// How many readers a wave runs at once when nobody said.
///
/// `PROTOCOL` asked for five to ten and the number never mattered much, because a session
/// spawning subagents was bounded by its host anyway. Spawning processes has no such
/// backstop, so it is stated once, here, and it is deliberately at the low end: each one
/// is a whole coding agent, and the cost of being wrong upwards is somebody's laptop.
const DEFAULT_READERS: usize = 5;

/// How many readings one reader takes.
///
/// **The single source of it.** [`reader_prompt`] formats this into what the reader is
/// asked to do, and a wave is sized by it, so the two cannot disagree — they used to be
/// separate, ten in words here and ten in a constant there.
///
/// **It is not offered as a control, and a slider for it was built and removed.** The trade
/// is real — `23,110/n + 3,030` a reading, so one per reader is five times the cost of ten
/// and about five times the speed — but the curve is a hyperbola with no knee, so there is
/// no principled place on it to aim, and the batch is a reading CONDITION recorded per
/// reading as `position`. Varying it across one repo makes that repo's corpus a mixture in
/// exactly the way two models do, and the map has no way to say which readings were taken
/// under which arrangement.
///
/// Ten is where the measurement stops, not a measured optimum: warming was looked for twice
/// — a full pass at three, and forty readers at ten on a 10,828-function repo — and never
/// found. Fifteen might be fine. Moving it is a decision about the instrument, taken here,
/// with what it does to the existing corpus in mind.
const BATCH: usize = 10;

/// The most source `reveal` will put in one response.
///
/// **A tool result has a size and nothing was checking it.** `reveal` served whatever the
/// extent came to, in one JSON string, and above a harness's output cap that arrives at the
/// reader truncated or not at all. Eighteen readings in this corpus were taken through that
/// wall — sixteen in one repo — and their notes say what a reader does when it hits one:
/// *"used a subagent to slice the oversized reveal output"*, *"sampled via grep against the
/// saved output file"*, *"Confirmed structurally via grep (134 pub fn, 18 pub struct …)
/// rather than reading the whole 465KB body"*. Every one of those is a reader leaving the
/// handout, which [`reader_prompt`] forbids in as many words. They all graded anyway, and
/// all eighteen graded `predicted: most` — not one refused, which is not eighteen readers
/// exercising judgement but the shape of a reader that could not check.
///
/// Which way it bends the map is the part that makes this a metric bug rather than an
/// ergonomic one. A reader that cannot see the body predicts from the signature, the peers
/// and the docs — and "predictable from surrounding context" is exactly what this instrument
/// reports as *boilerplate*. So the failure does not add noise, it adds COLD, and it does so
/// on the largest and most accreted code in the repo, which is where the map is supposed to
/// be loudest.
///
/// **The number comes from the reader's harness, never from a corpus.** Sizing it to the
/// code we happen to have would set a constant that is wrong the first time somebody reads
/// with a different agent — the cap belongs to the instrument, not to the subject. The
/// tightest we know of is Claude Code's ~25,000 tokens; source runs 3–4 bytes to the token,
/// so 32KB is ~10,700 tokens at the pessimistic end, better than 2× headroom for the JSON
/// envelope and for a harness that is stricter than the one this was measured against.
pub const PART_BYTES: usize = 32_000;

/// The extent past which a reading cannot be taken, because it does not fit.
///
/// Paging defeats the per-CALL cap. It does nothing about the reader's own context, and past
/// some size the body cannot be held at all — so the task leaves the queue and the wedge says
/// so, on the [`Node::excluded`] precedent: never queued, never in the denominator, still
/// parsed and still drawn. What it must not do is read as UNREAD, which means "nobody has got
/// to it yet" about something no run will ever reach.
///
/// **It is a limit, not a budget, and the first version confused the two.** That one was
/// 128KB, sized as "more than a reader should hold ALONGSIDE the other nine functions in its
/// batch" — a judgement about comfort dressed up as a constraint. Measured against real
/// stores it refused 2 file readings in this repo and 38 in tonepoet, including this repo's
/// own `App.tsx`, and file readings are where it lands because a file task is served whole.
/// Taking a repo's largest files permanently off the map to spare a reader a crowded context
/// is the coverage hole this release exists to close, dug from the other end.
///
/// So the line is drawn where the body stops FITTING: ~175k tokens at the pessimistic 3
/// bytes/token, against the 200k context the readers in use have. Below it a reader may have
/// an uncomfortable batch; above it there is no arrangement that works. Measured across both
/// stores, 1,222 and 17,500 units: p99 is 58KB and 22KB, so this sits far out on a very thin
/// tail — it refuses **nothing** in this repo, and 5 files in tonepoet, every one over 500KB.
///
/// **What it does NOT guard, and cannot.** [`Project::revealed`] records which parts were
/// SERVED, not which were retained — a reader that fetched everything and then had its
/// context compacted looks identical to one that held it all. That hole widens the closer a
/// body sits to this line, and nothing here can see it. `report`'s refusal is the guard that
/// works; this only rules out the arithmetically impossible.
///
/// It is a standing claim about readers in the same way the calibration band is a standing
/// claim about code, and it moves on the same terms: evidence, not taste. A context window
/// that grows moves this number.
pub const READ_CEILING: usize = 524_288;

/// The default batch, for callers outside this module that need to price one.
pub fn default_batch() -> usize {
    BATCH
}

/// Lines of code the queue will have handed out, at each step of a partial run.
///
/// **The Read dialog's two bars only differ because this exists.** Lines and tokens are both
/// magnitudes of the same slider, and if lines are apportioned — total outstanding times the
/// fraction chosen — then the two are the same number twice and the bars paint identically.
/// They are not the same thing: reading the first two hundred functions costs whatever those
/// two hundred functions happen to be, and the queue hands them out in a decided order —
/// stale first, then unread, round-robined across files. So a partial run's size in lines is
/// a fact that can be looked up rather than estimated, and a repo whose expired readings sit
/// in its long functions says so on the way up.
///
/// One entry per [`BATCH`], because that is the granularity a run actually has: the slider
/// steps by a reader's handout, so every position it can stop at is an entry here. Cumulative
/// rather than per-step, so the frontend indexes instead of summing.
///
/// Leases are ignored and `recent_files` is empty on purpose: this projects the order a run
/// starting NOW would take, not the order the current one is partway through.
pub fn reading_curve(state: &Shared, key: &str) -> Vec<u32> {
    let mut st = lock(state);
    let Some(project) = st.projects.get_mut(key) else {
        return Vec::new();
    };
    let mut tasks: Vec<(f32, Task)> = Vec::new();
    collect_tasks(&project.scan.root, &project.reports, &HashMap::new(), None, &mut tasks);
    let all = tasks.len();
    let order = spread_across_files(tasks, &HashMap::new(), Instant::now(), all);
    let mut out = Vec::with_capacity(order.len().div_ceil(BATCH));
    let mut running: u32 = 0;
    for (i, t) in order.iter().enumerate() {
        running = running.saturating_add(t.lines);
        // Every batch boundary, and the tail — a run of 43 can stop at 43.
        if (i + 1) % BATCH == 0 || i + 1 == order.len() {
            out.push(running);
        }
    }
    out
}

/// Start a wave of readers against a project, and keep waving until the work is done.
///
/// **This is `PROTOCOL`'s orchestration loop, as code.** It was prose asking a session to
/// spawn readers, poll `remaining` and `in_flight`, go again unless they are equal, stop
/// where the human said and say which. As instructions it was contingent on a harness that
/// could fan out at all — which is Claude Code and Roo and nothing else — and on a model
/// choosing to follow it. Two full passes ended with the driving session reporting its own
/// result from what subagents had said in chat, which is the failure `sanity_summary` was
/// added to fix from the other end.
///
/// It returns as soon as the wave is launched. A full pass is hours; an HTTP call that
/// waited for it would be a timeout with a run still going on behind it.
async fn check(
    State(state): State<Shared>,
    Json(req): Json<CheckRequest>,
) -> Json<serde_json::Value> {
    Json(start_run(&state, req))
}

/// The body of [`check`], callable without an HTTP request.
///
/// The window starts runs too, and it holds the same `Shared` the router does — so going
/// out to loopback to reach it would be the app talking to itself over a socket. What it
/// must NOT be is a second implementation: `sanity check`, `sanity_check` and the Read
/// button are three triggers, and the moment two of them decide anything differently the
/// unwatched one goes quietly wrong. That is the same rule the CLI's read verbs follow —
/// formatters over the endpoints, computing nothing.
pub fn start_run(state: &Shared, req: CheckRequest) -> serde_json::Value {
    let (key, repo, already) = {
        let st = lock(state);
        let Some(key) = st.for_client(req.project.as_deref()) else {
            return serde_json::json!({ "ok": false, "error": NO_PROJECT });
        };
        let Some(p) = st.projects.get(&key) else {
            return serde_json::json!({ "ok": false, "error": NO_PROJECT });
        };
        (
            key.clone(),
            p.repo.clone(),
            // **Ended is not the same as finished, and the gap between them is a race.**
            // This asked only whether `ended` was set, so a wave that had just banked its
            // last reading — or been stopped a second ago — read as over while its readers
            // were still alive. Starting another then puts two sets of readers on one queue,
            // which is exactly what the rule below forbids, and it happened: a run with one
            // segment left let a second wave in from the CLI.
            //
            // `live` is the backend's count of processes it has not reaped, so this covers
            // both halves and clears itself as they exit.
            p.run.as_ref().is_some_and(|r| {
                r.ended.is_none() || r.live.load(std::sync::atomic::Ordering::Relaxed) > 0
            }),
        )
    };
    // One wave per project. Two would double every reader's chance of being handed work
    // the other is already holding, and the leases would hide it rather than prevent it.
    if already {
        return serde_json::json!({
            "ok": false,
            // Named so a caller can tell this refusal from the others and act on it. The CLI
            // attaches to the run instead of failing; an agent reads the hint below. Same
            // response, two audiences, and neither has to parse the prose.
            "already": true,
            "error": "A run is already going for this repo.",
            "hint": "Call sanity_status to watch it. Starting a second wave against one \
                     repo does not go faster; it just puts two readers on the same queue. \
                     A run that has just ended still counts until its readers have exited, \
                     which takes a few seconds.",
        });
    }

    let harness_name = match &req.harness {
        Some(h) => h.clone(),
        None => crate::reports::harness_for(&key).unwrap_or_default(),
    };
    if harness_name.is_empty() {
        return serde_json::json!({
            "ok": false,
            "error": "No agent is configured to read with.",
            "hint": format!(
                "Run `sanity init --harness <name>` in the repo, or pass a harness with \
                 this call. Supported: {}.",
                crate::harness::supported()
            ),
        });
    }
    let Some(harness) = crate::harness::Harness::parse(&harness_name) else {
        return serde_json::json!({
            "ok": false,
            "error": format!("`{harness_name}` is not an agent Sanity knows how to run."),
            "hint": format!("Supported: {}.", crate::harness::supported()),
        });
    };
    // Before a wave, not discovered from a hundred identical spawn failures.
    if !harness.available() {
        return serde_json::json!({
            "ok": false,
            "error": format!("`{}` is not on PATH, so no reader can be started.", harness.program()),
            "hint": "Install it, or pass a different harness.",
        });
    }
    let Some(backend) = read_endpoint().map(|e| e.url()) else {
        return serde_json::json!({
            "ok": false,
            "error": "Sanity has not published an endpoint for its readers to call back on.",
        });
    };
    let exe = std::env::current_exe().unwrap_or_default();
    // **The model falls back to the project's, exactly as the harness above does, and it
    // did not.** `/check` read the request and stopped there, so a repo whose model was
    // chosen in the window and then read from the terminal ran on the harness's own
    // default — silently, and recorded as whatever the reader turned out to be. That is
    // the two-scale mixture the `model` field exists to expose, produced by the tool
    // rather than caught by it. One resolution order for both settings: what this call
    // asked for, else what the project is set to, else nothing and say so.
    let model = req
        .model
        .clone()
        .filter(|m| !m.trim().is_empty())
        .or_else(|| lock(state).projects.get(&key).and_then(|p| suggested_model(p, &key)))
        .unwrap_or_default();
    let width = req.readers.unwrap_or(DEFAULT_READERS).clamp(1, 32);
    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let live = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

    {
        let mut st = lock(state);
        if let Some(p) = st.projects.get_mut(&key) {
            p.run = Some(Run {
                harness: harness.name().to_string(),
                model: model.clone(),
                width,
                spawned: 0,
                finished: 0,
                failed: 0,
                ended: None,
                stop: stop.clone(),
                live: live.clone(),
                ended_at: None,
                failures: Vec::new(),
            });
        }
    }

    let shared = state.clone();
    let key_for_run = key.clone();
    let limit = req.limit;
    let model_for_run = model.clone();
    let wave = move || async move {
        run_wave(
            shared,
            key_for_run,
            harness,
            exe,
            backend,
            model_for_run,
            width,
            limit,
            stop,
            live,
        )
        .await;
    };
    // **`tokio::spawn` panics with no runtime in scope, and this function promises to be
    // callable from anywhere.** It was `tokio::spawn` flat, which is correct from the axum
    // handler and fatal from the window: a Tauri command is sync and runs on the main
    // thread, so pressing Read aborted the whole app on `TryCurrentError`. A function whose
    // doc says "callable without an HTTP request" must not assume the HTTP request's
    // runtime.
    //
    // Borrowing the caller's runtime when there is one keeps the wave on the same threads
    // as the server it reports to. Otherwise it gets a thread and a runtime of its own,
    // which is the honest cost of being called from a place that has neither.
    detached(wave());

    serde_json::json!({
        "ok": true,
        "started": true,
        "project": key,
        "repo": repo.to_string_lossy(),
        "harness": harness.name(),
        "model": if model.is_empty() { serde_json::Value::Null } else { model.into() },
        "readers": width,
        "note": "Readers are running as separate processes with no access to this repo. \
                 Poll sanity_status for `remaining`, `in_flight` and the run's own counts; \
                 call sanity_summary when it is done.",
    })
}

/// Ask a run to stop, and kill the readers it has out.
///
/// Between readings, never mid-reading — except that a reader IS mid-reading for minutes
/// at a time, so `run_wave` kills the process rather than waiting politely. The reading it
/// was working on is lost, which is the correct trade: the alternative is a coding agent
/// still spending tokens after the human asked it to stop.
async fn stop(State(state): State<Shared>, Json(p): Json<StatusParams>) -> Json<serde_json::Value> {
    let st = lock(&state);
    let Some(key) = st.for_client(p.project.as_deref()) else {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    let stopped = st
        .projects
        .get(&key)
        .and_then(|p| p.run.as_ref())
        .filter(|r| r.ended.is_none())
        .map(|r| r.stop.store(true, std::sync::atomic::Ordering::Relaxed))
        .is_some();
    Json(serde_json::json!({ "ok": true, "stopped": stopped }))
}

/// What `trace` was asked for.
#[derive(Debug, Deserialize)]
struct TraceParams {
    #[serde(default)]
    project: Option<String>,
    /// `files` or `lines`. Absent deepens by one step from wherever this repo is.
    #[serde(default)]
    depth: Option<String>,
}

/// Read this repo's history, because somebody asked.
///
/// **The other side of the budget, and the only one that spends without a ceiling.** The gate
/// exists to keep work nobody invited off a person's machine; a caller reaching this has
/// invited it, so what it does is what it was told and the cost is reported rather than
/// refused. The estimate the row was showing is what they decided from.
///
/// Synchronous on purpose. Depth 1 is seconds-to-a-minute and the caller wants the map to be
/// right when it returns; depth 2 is the long one and a caller asking for it has been shown
/// what it costs. What makes that survivable is the stop flag, not a short call.
async fn trace(State(state): State<Shared>, Json(p): Json<TraceParams>) -> Json<serde_json::Value> {
    let (key, repo, at) = {
        let st = lock(&state);
        let Some(key) = st.for_client(p.project.as_deref()) else {
            return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
        };
        let Some(project) = st.projects.get(&key) else {
            return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
        };
        (key.clone(), project.repo.clone(), project.trace.depth)
    };
    let depth = match p.depth.as_deref() {
        Some("files") => crate::trace::Depth::Files,
        Some("lines") => crate::trace::Depth::Lines,
        // One step on from wherever it is. A caller that says nothing gets the cheap half
        // first, which is also the half that makes the next estimate a measured one.
        None => match at {
            crate::trace::Depth::Untraced => crate::trace::Depth::Files,
            _ => crate::trace::Depth::Lines,
        },
        Some(other) => {
            return Json(serde_json::json!({
                "ok": false,
                "error": format!("unknown depth {other}"),
                "hint": "depth is `files` (the commit log) or `lines` (per-line blame)",
            }));
        }
    };

    let started = Instant::now();
    // Cleared before it starts, never after it ends: a flag left set by a previous stop would
    // make the next trace refuse to do anything and look like a button that did nothing.
    let stop = {
        let mut st = lock(&state);
        let Some(project) = st.projects.get_mut(&key) else {
            return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
        };
        project.trace.stop.store(false, std::sync::atomic::Ordering::Relaxed);
        project.trace.running = Some(crate::scan::Progress::phase("reading the commit log"));
        // Retired the moment the work starts — see the same line in `commands::trace_project`.
        // A pending price and a running pass are two answers to one question, and a caller that
        // has to know which to prefer is one that will eventually prefer the wrong one.
        project.trace.pending = None;
        project.trace.stop.clone()
    };
    let traced = {
        let repo = repo.clone();
        let mut scan = { lock(&state).projects.get(&key).map(|p| p.scan.clone()) };
        let ticking = state.clone();
        let ticking_key = key.clone();
        tokio::task::spawn_blocking(move || {
            let scan = scan.as_mut()?;
            let scans = crate::scancache::ScanCache::open(&repo);
            let traced_to =
                crate::trace::deepen(
                    &repo,
                    scan,
                    depth,
                    &scans,
                    &stop,
                    &|progress| {
                        let mut st = lock(&ticking);
                        if let Some(p) = st.projects.get_mut(&ticking_key) {
                            p.trace.running = Some(progress);
                        }
                    },
                    // A window may well be open on this project while an agent or the CLI
                    // drives the trace, and it watches `scanned` like any other.
                    &|snapshot| {
                        let mut st = lock(&ticking);
                        if let Some(p) = st.projects.get_mut(&ticking_key) {
                            p.scan = snapshot.clone();
                            p.scanned = p.scanned.wrapping_add(1);
                        }
                    },
                );
            Some((scan.clone(), traced_to))
        })
        .await
        .ok()
        .flatten()
    };
    let Some((scan, (reached, done, considered))) = traced else {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };

    let mut st = lock(&state);
    let Some(project) = st.projects.get_mut(&key) else {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    project.scan = scan;
    // **The depth the pass REACHED, with the coverage it got to.** A stopped pass used to be
    // reported as the depth below — rounding a fraction into a step, which made two thirds of a
    // repo's blame look like work that never happened — and the correction was made here, out
    // of a stop flag this function read for itself. It is `deepen`'s answer now: the log walk
    // is interruptible too, and a stop inside it reaches nothing, which no amount of reading
    // the flag from out here could have told apart from a completed walk.
    let resolved = (done, considered);
    // Falling short of what was asked for IS the stop, and reading it this way rather than off
    // the flag survives the flag being replaced a line later — which it is, by a fresh
    // `TraceState`, and reading it after that was a bug this file already carries a note about.
    let stopped = reached != depth;
    project.trace = TraceState { depth: reached, resolved, ..Default::default() };
    // Banked, so a restart puts the map back where somebody paid to have it — see
    // `KnownProject::trace_depth`. Only what actually landed: a stopped pass banks the depth it
    // reached, not the one it was aiming at.
    crate::reports::note_trace(&key, reached.tag_str());
    project.scanned = project.scanned.wrapping_add(1);
    Json(serde_json::json!({
        "ok": true,
        "project": key,
        "repo": repo.display().to_string(),
        "depth": project.trace.depth,
        "stopped": stopped,
        "seconds": started.elapsed().as_secs_f32(),
    }))
}

/// Scan a repo whose scan was declined for cost, because somebody asked.
///
/// The other side of `scan::BUDGET`, and the counterpart to `/trace`: a launch that would have
/// spent a minute parsing linux leaves the row saying what it would cost, and this is how a
/// person says go. It routes through `open_project`, which is the one place a scan becomes a
/// project — a second construction site for the same thing is how the same bug arrives twice.
async fn scan_now(State(state): State<Shared>, Json(p): Json<StatusParams>) -> Json<serde_json::Value> {
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

/// Stop a running trace. What it has read is kept — see `trace::deepen`.
async fn stop_trace(
    State(state): State<Shared>,
    Json(p): Json<StatusParams>,
) -> Json<serde_json::Value> {
    let st = lock(&state);
    let Some(key) = st.for_client(p.project.as_deref()) else {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    let stopped = st
        .projects
        .get(&key)
        .map(|p| p.trace.stop.store(true, std::sync::atomic::Ordering::Relaxed))
        .is_some();
    Json(serde_json::json!({ "ok": true, "stopped": stopped }))
}

/// Run a future to completion in the background, with or without a runtime to hand.
///
/// **`tokio::spawn` panics when nothing is running, and that shipped.** `start_run` used it
/// flat, which is correct from the axum handler and fatal from the window: a Tauri command
/// is synchronous and runs on the main thread, so pressing Read aborted the whole app on
/// `TryCurrentError`. A function documented as "callable without an HTTP request" must not
/// assume the HTTP request's runtime.
///
/// Borrowing the caller's runtime where there is one keeps the wave on the same threads as
/// the server it reports to. Where there is not, it takes a thread and a runtime of its
/// own — the honest cost of being called from somewhere that has neither.
///
/// Split out from `start_run` so it can be tested, which is not incidental: a test of the
/// crash through `start_run` needs an open project, a configured agent and that agent
/// installed, so it would pass on a machine that never reached the spawn at all.
fn detached(fut: impl std::future::Future<Output = ()> + Send + 'static) {
    match tokio::runtime::Handle::try_current() {
        Ok(handle) => {
            handle.spawn(fut);
        }
        Err(_) => {
            std::thread::spawn(move || {
                match tokio::runtime::Builder::new_current_thread().enable_all().build() {
                    Ok(rt) => rt.block_on(fut),
                    // Nothing to report to — the caller had its answer long ago. The run
                    // simply never starts, and `run` stays as it was: not running.
                    Err(e) => eprintln!("sanity: could not start a runtime for readers: {e}"),
                }
            });
        }
    }
}

/// Keep `width` readers in flight until the work runs out, the limit is reached, or a stop
/// is asked for.
///
/// A reader is a whole coding agent, so the failure to design against is not slowness but
/// a wave that keeps launching against a queue that cannot give it work. The loop stops
/// when `remaining` reaches zero and also when it stops FALLING while nothing is in flight
/// — a harness that exits instantly, wrongly configured, would otherwise spin forever
/// spawning processes that do nothing.
#[allow(clippy::too_many_arguments)]
async fn run_wave(
    state: Shared,
    key: String,
    harness: crate::harness::Harness,
    exe: std::path::PathBuf,
    backend: String,
    model: String,
    width: usize,
    limit: Option<usize>,
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    live: std::sync::Arc<std::sync::atomic::AtomicUsize>,
) {
    // Built once, not per reader: it is the same string for every process in the run, and
    // the number in it has to be the number the wave is sized against below — which is what
    // [`reader_prompt`] taking the count is for.
    let prompt = reader_prompt(BATCH);
    // Readers are launched from a directory that is not the repo, which on Codex is the
    // whole of the priming fix and on Claude is the belt beside `--setting-sources`.
    //
    // Its own directory per run, not the bare temp dir, because for opencode, Codex and
    // Antigravity this is also where their MCP config goes — see `harness::write_config`.
    // One scratch
    // directory doing both jobs is not a coincidence worth undoing: the config has to be
    // somewhere the reader will look, and the one place it is guaranteed to look is the
    // directory we already chose for being nowhere near the repo.
    let away = std::env::temp_dir().join(format!("sanity-readers-{}", std::process::id()));
    if std::fs::create_dir_all(&away).is_err()
        || crate::harness::write_config(harness, &away, &exe, &backend, &key).is_err()
    {
        if let Some(p) = lock(&state).projects.get_mut(&key) {
            if let Some(r) = p.run.as_mut() {
                r.ended = Some("Could not write the reader's configuration.".into());
            }
        }
        return;
    }
    let started_at = assessed_now(&state, &key);
    let mut barren = 0;
    let ended = loop {
        if stop.load(std::sync::atomic::Ordering::Relaxed) {
            break "Stopped at your request.".to_string();
        }
        let (remaining, in_flight) = match lock(&state).projects.get(&key) {
            Some(p) => {
                let w = work_left(p);
                (w.remaining, w.in_flight)
            }
            None => break "The project was closed.".to_string(),
        };
        if remaining == 0 {
            break "Every function has an up-to-date reading.".to_string();
        }
        if let Some(n) = limit {
            if assessed_now(&state, &key).saturating_sub(started_at) >= n {
                break format!("Reached the limit of {n} readings.");
            }
        }
        // Everything left is out with somebody. Waiting is right; another wave would only
        // queue behind the leases.
        if remaining == in_flight {
            tokio::time::sleep(Duration::from_secs(5)).await;
            continue;
        }

        let before = assessed_now(&state, &key);
        // Sized by the work AND by what is left of the limit.
        //
        // A reader does ten readings, so a wave is `readers × 10` and the limit could only
        // ever be honored to that granularity — measured on a real run, `--limit 6` with
        // two readers banked 19. That is the documented behavior and it makes a small cap
        // useless, which matters because a small cap is exactly what somebody sets to try
        // this cheaply. Spawning `ceil(left / 10)` readers brings the smallest step down to
        // ten, and the run still reports what it actually did rather than what was asked.
        let mut wave = remaining.saturating_sub(in_flight).min(width).max(1);
        if let Some(n) = limit {
            let done = assessed_now(&state, &key).saturating_sub(started_at);
            let left = n.saturating_sub(done);
            wave = wave.min(left.div_ceil(BATCH).max(1));
        }
        let mut handles = Vec::new();
        for _ in 0..wave {
            let mut cmd = crate::harness::reader_command(
                harness, &exe, &backend, &key, &model, &prompt, &away,
            );
            let stop = stop.clone();
            let live = live.clone();
            handles.push(tokio::spawn(async move {
                let Ok(mut child) = cmd.spawn() else {
                    return (false, format!("{} could not be started.", harness.program()));
                };
                // Counted from the moment there is a process, and decremented on every way
                // out of this task — see `Run::live`.
                live.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
                let _guard = LiveGuard(live);
                // **Drained, not merely piped.** It was piped and never read, so a reader
                // that died in one second saying `error: invalid model` threw the one useful
                // sentence away and the run reported "three waves finished without a reading
                // landing" — true, and no help at all. Draining also matters mechanically: a
                // pipe nobody reads fills, and a chatty agent then blocks on its own stderr.
                //
                // Concurrently with the wait, on its own task, because reading after the
                // child exits is the deadlock this is written to avoid.
                let err = child.stderr.take();
                let tail = tokio::spawn(async move {
                    use tokio::io::AsyncReadExt;
                    let mut buf = String::new();
                    if let Some(mut e) = err {
                        let _ = e.read_to_string(&mut buf).await;
                    }
                    buf
                });
                // Waited on alongside the stop flag rather than simply awaited. A reader
                // is a coding agent that will happily run for minutes, so "stop" has to be
                // able to reach one that is already going — otherwise quitting leaves
                // every reader in the current wave spending tokens on readings that have
                // nowhere to land.
                loop {
                    tokio::select! {
                        st = child.wait() => {
                            let said = tail.await.unwrap_or_default();
                            return (matches!(st, Ok(s) if s.success()), said);
                        }
                        _ = tokio::time::sleep(Duration::from_millis(250)) => {
                            if stop.load(std::sync::atomic::Ordering::Relaxed) {
                                let _ = child.start_kill();
                                let _ = child.wait().await;
                                // Killed on purpose. Whatever it was saying is not a
                                // failure worth reporting to anybody.
                                return (false, String::new());
                            }
                        }
                    }
                }
            }));
        }
        if let Some(p) = lock(&state).projects.get_mut(&key) {
            if let Some(r) = p.run.as_mut() {
                r.spawned += wave;
            }
        }
        for h in handles {
            let (ok, said) = h.await.unwrap_or((false, String::new()));
            // **A reader killed by Stop is not a failure.** Every non-zero exit was counted,
            // so interrupting a run reported "1 reader failed" about a process the run had
            // just killed on purpose — and `failed` is the number that exists to tell a
            // misconfigured agent apart from a slow one. Reading the stop flag rather than
            // the exit code, because from the outside the two deaths look identical.
            let killed = stop.load(std::sync::atomic::Ordering::Relaxed);
            if let Some(p) = lock(&state).projects.get_mut(&key) {
                if let Some(r) = p.run.as_mut() {
                    r.finished += 1;
                    if !ok && !killed {
                        r.failed += 1;
                        let said = said.trim();
                        // Deduped, because a misconfiguration fails every reader the same
                        // way and five copies of one sentence is not five findings. Capped
                        // for the same reason a log tail is: nobody reads the sixth.
                        if !said.is_empty()
                            && r.failures.len() < 5
                            && !r.failures.iter().any(|f| f == said)
                        {
                            r.failures.push(said.to_string());
                        }
                    }
                }
            }
        }
        // A whole wave that banked nothing. Once is a harness hiccup; three times running
        // is a misconfiguration, and spawning into it forever is worse than stopping.
        if assessed_now(&state, &key) == before {
            barren += 1;
            if barren >= 3 {
                // No guess about the cause. It used to add "check that the agent is
                // installed and signed in", which was the best available advice while
                // nothing captured what the readers said — and wrong at least as often as
                // right, since a rejected `--model` looks identical from here. The readers'
                // own output is kept now (`Run::failures`), so the summary states what
                // happened and the evidence answers why.
                break "Three waves in a row finished without a successful reading.".to_string();
            }
        } else {
            barren = 0;
        }
    };
    if let Some(p) = lock(&state).projects.get_mut(&key) {
        // **The run's leases die with the run.** A lease means "a reader is working on
        // this", and once the wave is over that is false however it ended: Stop kills
        // readers mid-reading, and a reader that merely exited was not going to report
        // either. Left alone they sat there for the rest of `LEASE`, which made the map go
        // on pulsing wedges nobody was reading and made `in_flight` count work with no
        // worker behind it — the same overstatement `work_left` exists to prevent, arriving
        // from the other side.
        //
        // The functions simply return to the queue, which is what an expired lease does
        // anyway; this only stops the wait. Safe here because the loop has ended, so every
        // reader this run spawned is gone.
        p.leased.clear();
        if let Some(r) = p.run.as_mut() {
            r.ended = Some(ended);
            r.ended_at = Some(Instant::now());
        }
    }
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
    fn note(&mut self, stage: &'static str, name: String, path: String, found: Option<&Report>) {
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

/// Every model a project's readings were taken by, commonest first.
///
/// **The disagreement itself, made visible.** [`one_model`] answers `None` for a mixed
/// corpus, on the grounds that a mixture is worth SHOWING rather than resolving to a
/// majority — and then nothing showed it. The Read dialog fell back to a bare picker, which
/// is indistinguishable from a repo nobody has ever read, so the one case the rule exists
/// for was the one case it said nothing about. This is what the dialog says instead.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ModelCount {
    pub model: String,
    pub readings: usize,
}

/// What to ASK for, to carry on the way the last reading was taken.
///
/// **`asked`, not `model`, and the difference is the whole point of keeping both.** A
/// reading records two things about its reader: what the run requested, stamped
/// server-side, and what the reader said it was. They are not interchangeable — a run asks
/// for `sonnet` and the reader reports `claude-sonnet-4.5`, which is that model's name for
/// itself and not necessarily a string its CLI accepts. Feeding the self-report back to
/// `--model` is how a wave dies on every reader at once with nothing to say beyond "three
/// waves finished without a reading landing".
///
/// So: the newest dated reading's `asked`, falling back to its `model` for readings taken
/// before `asked` existed — where the self-report is all there is, and a guess that might
/// be rejected beats no suggestion at all.
///
/// **What a mixed corpus offers instead of nothing.** With readings on several scales there
/// is no single banked model to continue, and the dialog otherwise falls back to the
/// harness's own default — which is how a repo picks up one more scale.
///
/// `None` when nothing is dated, which is every corpus banked before `when` existed. A
/// partly-dated corpus answers from the dated part: those are by definition the recent
/// ones, since the undated readings predate the field.
fn recent_model(p: &Project) -> Option<String> {
    p.reports
        .values()
        .filter(|r| !r.when.is_empty())
        // Lexicographic, which is chronological for this format — see `now_iso`.
        .max_by(|a, b| a.when.cmp(&b.when))
        .map(|r| if r.asked.trim().is_empty() { r.model.trim() } else { r.asked.trim() })
        .filter(|m| !m.is_empty())
        .map(str::to_string)
}

/// What a run uses when nobody names a model. `None` means the harness's own default.
///
/// **One order, wherever the question is asked.** The `/check` handler resolved it one way
/// and the window's dialog another, which is how a repo picks up a second scale: press Read
/// and get the corpus's model, type `sanity check` and get whatever this laptop last
/// preferred. The corpus comes first because it travels with the repo and a stored
/// preference does not — see `recent_model` for why it reads what the last run ASKED for
/// rather than what its readers said they were.
pub fn suggested_model(p: &Project, key: &str) -> Option<String> {
    recent_model(p).or_else(|| one_model(p)).or_else(|| crate::reports::model_for(key))
}

fn model_tally(p: &Project) -> Vec<ModelCount> {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for r in p.reports.values() {
        let m = r.model.trim();
        if !m.is_empty() {
            *counts.entry(m).or_default() += 1;
        }
    }
    let mut out: Vec<ModelCount> = counts
        .into_iter()
        .map(|(model, readings)| ModelCount { model: model.to_string(), readings })
        .collect();
    // Commonest first, then by name so a tie does not reshuffle on every poll — which the
    // frontend would read as a change and re-render for.
    out.sort_by(|a, b| b.readings.cmp(&a.readings).then_with(|| a.model.cmp(&b.model)));
    out
}

/// The one agent a project's readings were taken by, or `None` if they disagree.
///
/// Same rule as [`one_model`] below, and the same reason: two agents over one repo is worth
/// seeing rather than resolving. Used to preselect the Read dialog, where `None` correctly
/// means "do not choose for them".
///
/// Disagreement is left visible rather than resolved to a majority. A repo read by two
/// models is one map on two scales, and the answer to that is for somebody to see it, not
/// for this function to pick a winner.
fn one_harness(p: &Project) -> Option<String> {
    let mut seen: Option<&str> = None;
    for r in p.reports.values() {
        let h = r.harness.trim();
        if h.is_empty() {
            continue;
        }
        match seen {
            None => seen = Some(h),
            Some(prev) if prev == h => {}
            Some(_) => return None,
        }
    }
    seen.map(|s| s.to_string())
}

fn one_model(p: &Project) -> Option<String> {
    let mut seen: Option<&str> = None;
    for r in p.reports.values() {
        let m = r.model.trim();
        if m.is_empty() {
            continue;
        }
        match seen {
            None => seen = Some(m),
            Some(prev) if prev == m => {}
            Some(_) => return None,
        }
    }
    seen.map(|s| s.to_string())
}

/// Decrements the live-reader count however its task ends — normally, killed, or panicking.
///
/// A guard rather than a decrement at each `return`, because there are three of those and
/// the cost of missing one is a shutdown that waits its full deadline every time.
struct LiveGuard(std::sync::Arc<std::sync::atomic::AtomicUsize>);

impl Drop for LiveGuard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, std::sync::atomic::Ordering::Relaxed);
    }
}

/// How many readings this project holds right now, excluding stale ones.
fn assessed_now(state: &Shared, key: &str) -> usize {
    lock(state).projects.get(key).map(assessed).unwrap_or(0)
}

/// A body served in parts, and which of them the reader has actually taken.
///
/// See [`Project::revealed`] for why the server keeps this rather than asking.
#[derive(Clone, Debug)]
pub struct Revealed {
    /// How many parts this body was cut into.
    pub parts: usize,
    /// Which ones went out. A set rather than a high-water mark: a reader may fetch them in
    /// any order, and "got 1 and 3" has to be distinguishable from "got 1, 2 and 3" —
    /// treating the highest as proof of everything below it is the same mistake as gating a
    /// destructive step on a write returning `Ok`.
    pub seen: std::collections::BTreeSet<usize>,
}

impl Revealed {
    /// Every part accounted for.
    fn whole(&self) -> bool {
        self.seen.len() >= self.parts
    }

    /// The parts still owed, for an error that says what to do.
    fn missing(&self) -> Vec<usize> {
        (1..=self.parts).filter(|p| !self.seen.contains(p)).collect()
    }
}

/// Cut served source into parts, each no larger than [`PART_BYTES`].
///
/// On line boundaries, and `split_inclusive` keeps the separators, so concatenating the
/// parts reproduces the source byte for byte — which is the property the reader is promised
/// and `a_paged_body_reassembles_to_the_original` pins.
///
/// A single line longer than the budget goes out on its own rather than looping forever.
/// That is honest code with a long line: the scan refuses minified files outright
/// (`MINIFIED_LINE_BYTES`), so a bundle never reaches here.
fn parts_of(source: &str) -> Vec<&str> {
    if source.len() <= PART_BYTES {
        return vec![source];
    }
    let mut out = Vec::new();
    let (mut start, mut end) = (0usize, 0usize);
    for line in source.split_inclusive('\n') {
        if end > start && end - start + line.len() > PART_BYTES {
            out.push(&source[start..end]);
            start = end;
        }
        end += line.len();
    }
    if end > start {
        out.push(&source[start..end]);
    }
    out
}

/// A request for the source of one task, and the prediction it is being traded for.
#[derive(Deserialize)]
pub struct RevealRequest {
    /// Supplied by the shim, never by the model — see [`QueueParams::project`].
    #[serde(default)]
    project: Option<String>,
    id: String,
    /// What the reader expects the body to do. Recorded before any bytes go back.
    expected: String,
    /// Which part of the body to send, 1-based. Absent means the first.
    ///
    /// Defaulted rather than required so the call a reader makes for an ordinary function is
    /// exactly the call it made before — most bodies are one part, and paying for a
    /// paging argument on every reading to serve the few that are not is the same trade
    /// [`PROTOCOL`] refuses elsewhere. The response says when there is more.
    #[serde(default)]
    part: Option<usize>,
}

/// Hand over the source of one task, once its prediction is on record.
///
/// **The reader used to fetch this itself, and that was two problems wearing one coat.**
/// It required a filesystem, which is why Claude Desktop could not take a single reading
/// and why every harness read through a different door. And "open `abs_path`, bounded to
/// the lines you were given and nothing more" was an instruction to a model — the same
/// class of rule as "do not read `.sanity/`", which readers have improvised around three
/// times (see `mcp.rs`'s error text for what that cost). Serving the bytes makes the
/// bound a fact rather than a request, and costs nothing: the body crossed the wire
/// either way.
///
/// The extent is recut first. A scan is a photograph and the repo is not standing still,
/// so this and `queue` both go through `resync_changed` — which is the point of doing it
/// here, because it collapses "the lines the scan remembers" and "the lines the reader
/// reads" into ONE answer computed in one place. Previously the queue re-cut and then the
/// reader did its own arithmetic against a file that may have moved again since.
///
/// A file task gets the whole file, because that is the reading: `FILE_ASK` asks what the
/// file is FOR, and its `end_line` is only as far as the last declaration reaches.
///
/// It refuses without a live lease. Not as bookkeeping — an id nobody holds is a reader
/// working from a task it was never handed, or one whose lease expired and whose work has
/// since gone to somebody else, and serving it would produce a second reading of the same
/// function that looks exactly as legitimate as the first.
async fn reveal(
    State(state): State<Shared>,
    Json(req): Json<RevealRequest>,
) -> Json<serde_json::Value> {
    let mut state = lock(&state);
    if state.for_client(req.project.as_deref()).is_none() {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    }
    // Routed by where the TASK came from, exactly as `report` is: the shim's key is one
    // cell shared by every reader in a session, and an id resolved through it can name a
    // function in a repo this caller is not working on.
    let Some(key) = state.owner_of(&req.id, req.project.as_deref()) else {
        state.ping("sanity_error");
        return Json(serde_json::json!({
            "ok": false,
            "error": format!("No open project holds `{}`, so there is no source to show.", req.id),
            "hint": "The repo was very likely rescanned since you were handed this task — \
                     ids carry line numbers and they move. Call sanity_next for fresh work.",
        }));
    };
    let Some(project) = state.projects.get_mut(&key) else {
        state.ping("sanity_error");
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    project.last_agent = Some(Instant::now());
    if project.leased.get(&req.id).is_none_or(|t| t.elapsed() >= LEASE) {
        state.ping("sanity_error");
        return Json(serde_json::json!({
            "ok": false,
            "error": format!("`{}` is not out with you, so its source was not sent.", req.id),
            "hint": "Either you were never handed this task, or it was out so long that the \
                     lease expired and it has gone back in the queue for somebody else. Call \
                     sanity_next for work of your own; do not report against this id.",
        }));
    }
    // Before the extent is read off the scan, for the reason in the doc above.
    resync_changed(project);

    let mut found = None;
    project.scan.root.visit(&mut |n| {
        if n.id == req.id {
            found = Some((
                n.path.clone(),
                n.line.unwrap_or(1),
                n.end_line.unwrap_or_else(|| n.line.unwrap_or(1) + n.loc),
                n.kind == NodeKind::File,
                n.bytes,
            ));
        }
    });
    // Above the ceiling nothing is served, and the refusal is the same fact the queue and
    // the map are already working from — `Node::bytes`, one number, so the wedge cannot say
    // readable while this says no. It should not be reachable: `collect_tasks` does not hand
    // these out. It is here because a lease can outlive a rescan that grew a function past
    // the line, and because the alternative to refusing is what used to happen.
    if let Some((_, _, _, _, Some(bytes))) = found {
        if bytes as usize > READ_CEILING {
            state.ping("sanity_error");
            return Json(serde_json::json!({
                "ok": false,
                "error": format!(
                    "`{}` is {}KB, past the {}KB a reading can be taken over. No source was sent.",
                    req.id,
                    bytes / 1024,
                    READ_CEILING / 1024,
                ),
                "hint": "This is not something to work around — do not open the repo, grep it, \
                         or spawn a subagent to slice it, and do not report a grade for it. \
                         The map marks it as too large to read, which is a finding about the \
                         code rather than a gap in coverage. Call sanity_next for other work.",
            }));
        }
    }
    let Some((path, line, end_line, whole_file, _)) = found else {
        state.ping("sanity_error");
        return Json(serde_json::json!({
            "ok": false,
            "error": format!("`{}` is no longer in this repo's scan.", req.id),
            "hint": "Call sanity_next for fresh work.",
        }));
    };

    let text = match std::fs::read_to_string(project.repo.join(&path)) {
        Ok(t) => t,
        Err(e) => {
            state.ping("sanity_error");
            return Json(serde_json::json!({
                "ok": false,
                "error": format!("Could not read {path}: {e}. Nothing is wrong with your call."),
                "hint": "Report this to the human and stop; do not guess at the body.",
            }));
        }
    };
    let source = if whole_file {
        text
    } else {
        // 1-based and inclusive, which is what `line`/`end_line` mean everywhere else.
        text.lines()
            .skip(line.saturating_sub(1) as usize)
            .take((end_line.saturating_sub(line) + 1) as usize)
            .collect::<Vec<_>>()
            .join("\n")
    };

    // `or_insert`: a second reveal for the same id serves the same bytes and leaves the
    // first prediction standing. A reader that could revise this after reading would be
    // grading itself against a prediction it wrote with the answer in front of it, which
    // is the whole thing this call exists to prevent. Fetching part 2 is a second call, so
    // this has to survive one — the prediction is the price of the BODY, not of a slice.
    project.predictions.entry(req.id.clone()).or_insert_with(|| req.expected.clone());

    let cut = parts_of(&source);
    let parts = cut.len();
    // Out of range reads as the last part rather than erroring: a reader that miscounts
    // gets the end of the body, which is recoverable, instead of a failure it will try to
    // work around. Zero is the same clamp from the other side — `part: 0` is a 1-based
    // index written by something counting from nought.
    let part = req.part.unwrap_or(1).clamp(1, parts);
    if parts > 1 {
        let seen = project
            .revealed
            .entry(req.id.clone())
            .or_insert_with(|| Revealed { parts, seen: std::collections::BTreeSet::new() });
        // Re-cut on every call, so a file edited mid-reading changes the count. Trusting the
        // stored one would let a body that grew past a part boundary report itself complete
        // on the parts of a shorter version.
        seen.parts = parts;
        seen.seen.insert(part);
    }
    state.ping("sanity_reveal");
    let mut out = serde_json::json!({
        "ok": true,
        "id": req.id,
        "path": path,
        "line": line,
        "end_line": end_line,
        "whole_file": whole_file,
        "part": part,
        "parts": parts,
        "source": cut[part - 1],
    });
    // Said in the RESPONSE rather than in the schema, on the standing rule that a tool
    // description is multiplied by every reading while this reaches only the readings that
    // are actually in parts. It has to be unmissable: the failure it replaces is a reader
    // deciding on its own that it has enough, and eighteen of them did.
    if parts > 1 {
        let next = part % parts + 1;
        out["next_step"] = serde_json::json!(format!(
            "This is part {part} of {parts}. You have NOT seen the whole body yet. Call \
             sanity_reveal again for the same id with `part: {next}`, and keep going until \
             you hold all {parts}. Do not report until you do — a report with parts missing \
             is refused, and grading from a partial body is the one thing this call exists \
             to prevent. Do not open the repo, grep it, or spawn a subagent to get the rest."
        ));
    }
    Json(out)
}

/// A reading, plus which project it belongs to.
///
/// `project` is flattened alongside the report rather than living on `Report` itself: it
/// is routing, not part of the reading, and it must not end up in `.sanity/`.
#[derive(Deserialize)]
pub struct ReportRequest {
    #[serde(default)]
    project: Option<String>,
    #[serde(flatten)]
    report: Report,
}

/// A text field carrying the rest of the reader's own tool call.
///
/// Seen in the wild: a reader's arguments were serialised as XML rather than JSON, and the
/// parse assigned everything from `found` onward — closing tag, remaining parameters and
/// all — into that one string. The call still arrives well-formed here, just short: the
/// grades after the swallowed field never reach the server at all.
///
/// Which would be merely ugly if a missing `predicted` were treated as missing. It is not
/// — [`Report::grades`] folds it through the pre-grade `surprised` flag, whose default is
/// `false`, so a truncated call lands as `Full`, the greenest grade on the scale. 28
/// readings across two repos went in that way and 15 of them state, in the leaked text,
/// that their reader chose `most`. A parse accident must not be able to make a repo look
/// better than it read.
///
/// So the report is refused and the reading is not banked. Repairing it here by parsing
/// the leak back out is the shape of the migration that once destroyed a project's
/// readings — and unnecessary, because the reader is still running and can simply resend.
///
/// **A leak alone is not the fault; a MISSING GRADE is.** The first version refused on the
/// leak by itself, and that cost the thing this whole tool measures. A reader hit it four
/// times on one function, could not see its own serialisation, and did the only thing that
/// ever appeared to work: it cut `found` from ~450 characters to 76 and was accepted. The
/// reading landed as a one-line stub where the paragraph it replaced was the useful part.
/// Refusing a call that carried every grade destroys a complete reading to tidy up some
/// trailing punctuation — so the tail is kept as the reader sent it, ugly and honest, and
/// only a call that actually lost a grade is turned away.
///
/// And the refusal has to say what to do. The first wording said "send it again as
/// ordinary JSON", which a model cannot act on — it does not choose its own encoding — so
/// the only lever it has left is the prose. The second wording ruled the prose out without
/// offering anything in its place, which is no better: a reader resent identical text
/// twice, was refused twice, and improvised anyway.
///
/// What actually works is ORDER — grades first, prose last, so a mangle swallows nothing
/// that matters. The schema now declares the fields that way (see `mcp.rs`, where the
/// reasoning lives), and this hint names it for the reader that hits the case regardless.
/// A trap with nothing said about it.
///
/// Its own function so it can be tested without standing up a server, and because the rule
/// is a claim about reports rather than a step in a handler: `trap` is a boolean, the panel
/// draws the NOTE as the trap, and a bare `true` is a flag on a wedge that has nothing to
/// tell whoever opens it. Two of those are in this repo's own corpus.
fn trap_without_note(r: &Report) -> bool {
    r.trap && r.note.trim().is_empty()
}

fn mangled(r: &Report) -> Option<&'static str> {
    // The grades are what the guard is protecting. `predicted` folds to `Full` when
    // absent, so its loss is the expensive one; the other two go gray, which is a smaller
    // lie but still one this build asked a reader for and did not get.
    if r.predicted.is_some() && r.documented.is_some() && r.legible.is_some() {
        return None;
    }
    // The closing tags are the reliable half: an argument value that ends by closing the
    // tag it lives in cannot be prose about code. `<parameter name=` catches the rest of
    // the payload trailing behind it.
    const LEAK: [&str; 2] = ["</parameter>", "<parameter name="];
    for (name, text) in [("expected", &r.expected), ("found", &r.found), ("note", &r.note)] {
        if LEAK.iter().any(|m| text.contains(m)) || text.contains(&format!("</{name}>")) {
            return Some(name);
        }
    }
    None
}

async fn report(
    State(state): State<Shared>,
    Json(req): Json<ReportRequest>,
) -> Json<serde_json::Value> {
    let r = req.report;
    // Before anything is stamped, stored or written: a report whose prose is carrying the
    // rest of its own tool call is a report with fields MISSING, and the missing one is
    // usually a grade. Rejected rather than repaired — the reader is still there and can
    // send it again, which is the only party that knows what it meant.
    if let Some(field) = mangled(&r) {
        // Said in the reader's own terms, because the reader is the only party that can
        // fix it and it cannot see what went wrong. The first wording sent it hunting for
        // the fault in its prose, and shortening the prose is the one "fix" that appears
        // to work — see `mangled`. Name what was lost, and rule the length out.
        //
        // Pinged as an error, because a refusal used to leave no trace anywhere: no ping,
        // no counter, nothing written. Four of them cost one reading its substance, and
        // the only record was a subagent's recollection of its own transcript, which is
        // not evidence. Same argument as a failed write — work is being lost, and the
        // human watching the window is the party who can stop it.
        {
            let mut state = lock(&state);
            state.refused += 1;
            state.ping("sanity_error");
        }
        return Json(serde_json::json!({
            "ok": false,
            "saved": false,
            "error": format!(
                "`{field}` arrived carrying the rest of this call, so the grades after it \
                 never reached the server. Nothing was saved."
            ),
            "hint": "Send it again for the same id, listing every grade FIRST and the \
                     prose fields last — that is what fixes it. Keep the same text in \
                     full: its length is not the problem, and shortening it or dropping \
                     `note` loses the reading for nothing.",
        }));
    }
    // A trap with no sentence says nothing anybody can act on. `trap` is a boolean and the
    // finding is the note beside it — the panel draws the note AS the trap — so a bare
    // `true` is a flag on a wedge that, opened, has nothing to tell you. Two of them are in
    // this repo's own corpus.
    //
    // Refused rather than downgraded to `trap: false`. Silently clearing it would discard a
    // reader's actual judgement to make the store tidy, and the reader is the one party that
    // can say what it meant — it is still there, and this is one field away from correct.
    // The schema cannot express "required when another field is true", so the rule lives
    // here, where it can be enforced, and is stated in `trap`'s own description so a reader
    // meets it before it answers rather than after.
    if trap_without_note(&r) {
        {
            let mut state = lock(&state);
            state.refused += 1;
            state.ping("sanity_error");
        }
        return Json(serde_json::json!({
            "ok": false,
            "saved": false,
            "error": "`trap` is true with no `note`, so this reading names a hazard without                       saying what it is. Nothing was saved.",
            "hint": "Send it again for the same id with `note` set to one sentence naming                      what breaks and when. If on reflection the code does not bite the next                      editor — or a comment already warns about it — send `trap: false`                      instead; that is a real answer, not a retreat.",
        }));
    }
    let mut state = lock(&state);
    // Nothing loaded is the restore window, and it must keep saying "wait, retry" — see
    // NO_PROJECT. Asked before the id is routed, because a reading arriving two seconds
    // after a restart has nowhere to land for a reason that will pass on its own.
    if state.for_client(req.project.as_deref()).is_none() {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    }
    // Where the TASK came from, not where the caller thinks it is. See `owner_of`: the
    // shim's key is one cell shared by every subagent in a session, and a reading routed
    // by it can land in a repo whose scan has never heard of the id.
    let Some(key) = state.owner_of(&r.id, req.project.as_deref()) else {
        // The failure this replaces returned `ok: true`. The id resolved to no function,
        // so `body` was stamped empty, the report went into a map keyed by an id nothing
        // matches, and `save_reports` — which walks live functions, not reports — wrote
        // nothing. A reading was counted, celebrated and discarded, and the response said
        // `saved: true`. A reading that cannot be placed is refused out loud instead.
        state.refused += 1;
        state.ping("sanity_error");
        return Json(serde_json::json!({
            "ok": false,
            "saved": false,
            "error": format!(
                "No open project holds `{}`, so this reading has nowhere to land and was \
                 NOT saved.",
                r.id
            ),
            "hint": "The repo was very likely rescanned since you were handed this task — \
                     ids carry line numbers and they move. Call sanity_next for fresh \
                     work; do not re-send this reading against a different id.",
        }));
    };
    let Some(project) = state.projects.get_mut(&key) else {
        state.ping("sanity_error");
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    project.last_agent = Some(Instant::now());
    // A body served in parts, with parts still owed. Refused — the reader graded something
    // it never fully saw, which is the failure this whole path exists to close, and it is
    // the one form of it the server can prove rather than ask about.
    //
    // Before the lease is released, deliberately: the work stays out with this reader so it
    // can fetch what it is missing and send the same reading again. Dropping the lease would
    // put the function back in the queue and make the refusal cost a reading rather than a
    // round trip. Refused rather than downgraded, on the `trap_without_note` rule — clearing
    // a reader's grades to tidy the store is not ours to do, and there is nothing here to
    // salvage anyway: a grade from a partial body is not a weaker measurement, it is a
    // measurement of something else.
    if let Some(seen) = project.revealed.get(&r.id) {
        if !seen.whole() {
            let missing = seen.missing();
            let (parts, have) = (seen.parts, seen.seen.len());
            state.refused += 1;
            state.ping("sanity_error");
            return Json(serde_json::json!({
                "ok": false,
                "saved": false,
                "error": format!(
                    "This body was served in {parts} parts and you have taken {have}. \
                     Nothing was saved.",
                ),
                "hint": format!(
                    "Call sanity_reveal for the same id with `part` set to each of {missing:?}, \
                     read them, then send this reading again — your prediction is already \
                     recorded and re-reading cannot change it. Do not grade from what you \
                     have: eighteen readings in this corpus were written against bodies \
                     their readers never finished, and every one of them landed on the same \
                     flattering grade. If the rest genuinely cannot be fetched, say so to \
                     the human and stop rather than reporting.",
                ),
            }));
        }
    }
    project.leased.remove(&r.id);
    // The prediction as it stood BEFORE the body was served — see `Project::predictions`.
    // Taken here rather than accepted from the report, on the same rule as `body` and `at`
    // below: the field whose job is to be checkable cannot be self-certified.
    //
    // It falls back to what the caller sent, and that is not a loophole left open. A shim
    // built before `reveal` existed has no stored prediction to find, and refusing its
    // readings would discard work over a field it was never given the chance to record.
    // What it cannot do is OVERWRITE a stored one.
    let promised = project.predictions.remove(&r.id);
    // Cleared with the prediction, and only once the reading is past the guard above: a
    // reading that got this far held every part, so the record has done its job. Left
    // behind it would refuse the next honest re-read of the same function after a rescan.
    //
    // Taken before it is dropped, and stamped rather than accepted: this is the evidence
    // the body was received whole, and the party it is evidence against is the caller. See
    // `Report::paged`.
    let paged = project.revealed.remove(&r.id).map(|v| v.parts);

    // Provenance is stamped here, not accepted from the caller. The body hash is the
    // field a future reader checks this reading against, so it has to come from the same
    // scan the queue handed out — an agent could report a hash of whatever it liked, and
    // the one thing a staleness marker cannot be is self-certified.
    let mut r = r;
    let mut body = None;
    // Its name and path come off the same walk, for the feed. Derived from the id instead
    // they would carry the `@line` an id embeds, and would be wrong the moment somebody
    // added an import — which is the reason nothing durable is keyed on an id either.
    let mut named = None;
    project.scan.root.visit(&mut |n| {
        if n.id == r.id {
            body = n.body.clone();
            named = Some((
                match (&n.owner, n.kind == NodeKind::File) {
                    (_, true) => n.path.clone(),
                    (Some(o), _) => format!("{o}::{}", n.name),
                    (None, _) => n.name.clone(),
                },
                n.path.clone(),
            ));
        }
    });
    r.body = body.unwrap_or_default();
    if let Some(p) = promised {
        r.expected = p;
    }
    // Which question this answered — the same argument as the hash beside it. A reader
    // asked to declare its own spec could name the one that makes its grade look current,
    // and that claim is exactly what the field exists to test. This build asked, so this
    // build stamps.
    r.spec = crate::assessment::SPEC;
    // Stamped, never accepted — see `Report::paged`. A reader that could set this would be
    // certifying that it had received the body it is about to grade, which is the one claim
    // this field exists to check.
    r.paged = paged;
    // And cleared, for the same reason it is stamped rather than accepted. It is a
    // conclusion this build draws on the way out, never a claim a reader gets to make on
    // the way in — a reader that sent `legibleDated: false` would otherwise be voting on
    // whether its own grade still counts.
    r.legible_dated = false;
    r.trap_dated = false;
    r.by = crate::assessment::who(&project.repo);
    r.at = crate::assessment::head(&project.repo);
    // What this run asked for, from the run itself. A hand-driven reader belongs to no run
    // and leaves it empty, which is honest: nobody here asked for anything.
    r.asked = project.run.as_ref().map(|run| run.model.clone()).unwrap_or_default();
    r.harness = project.run.as_ref().map(|run| run.harness.clone()).unwrap_or_default();
    r.when = crate::assessment::now_iso();
    // The hazard half of the priming question, on the same grounds as the hash: what the
    // repo held is a fact about the reading conditions, and a reader has no business
    // declaring it. `primed` — what was actually in its context — stays as the reader sent
    // it, because that is the half only the reader can see.
    r.agent_docs = crate::assessment::agent_docs(&project.repo);

    // What the reading said, before it is moved into the map. `Some`/`None` are the two
    // grades that mean the reader was actually caught out — the same test the surprise
    // rate is counted with, so the mascot and the hint cannot disagree about what
    // "surprising" means. A report landing on an id that already held one is a re-read of
    // work that expired, which is honest labor but not news.
    let outcome = if project.reports.contains_key(&r.id) {
        "sanity_report:stale"
    } else if matches!(r.grades().0, Grade::Some | Grade::None) {
        "sanity_report:hot"
    } else {
        "sanity_report:cold"
    };

    // Before the map takes it, while the grade is still to hand.
    if let Some((name, path)) = named {
        project.note("read", name, path, Some(&r));
    }
    project.reports.insert(r.id.clone(), r);
    project.reads = project.reads.wrapping_add(1);
    // Written through on every report. An assessment is minutes of an agent's work and
    // must not depend on the app exiting cleanly to survive.
    let write_error = save_reports(&project.repo, &project.scan, &project.reports).err();

    let WorkLeft { remaining, in_flight, .. } = work_left(project);
    // Where it actually landed. `/open` and `/status` have said this all along and this
    // did not, so the one endpoint that WRITES was the one that would not tell you which
    // repo it had written to. A reader worked it out from the order of magnitude of
    // `repo_assessed` and was right, which is not a diagnostic anyone should need.
    let landed_name = project.name.clone();
    let landed_repo = project.repo.to_string_lossy().into_owned();

    // Surfaced back to the agent, not just to the window. An implausibly low surprise
    // rate is the signature of a contaminated or agreeable reader, and telling the
    // caller lets it correct course rather than filling a repo with rubber stamps.
    let total = project.reports.len();
    // Counted off the grade, not the legacy flag: `some` and `none` are the two that
    // mean the reader was actually caught out.
    let surprised = project
        .reports
        .values()
        .filter(|r| matches!(r.grades().0, Grade::Some | Grade::None))
        .count();
    let warm = project.reports.values().filter(|r| !r.cold).count();
    let mut hint = String::new();
    if total >= 8 && surprised * 10 < total {
        hint = format!(
            "Across THIS WHOLE REPO — not your readings — only {surprised} of {total} are \
             flagged surprising. Nothing to answer for if your own reads were cold and \
             honest; it is aimed at whoever is driving. If readers are being handed files \
             they already know, or are being agreeable, the results mean nothing."
        );
    }
    // A failed write outranks any coaching about the reading itself: carrying on for
    // another two hundred functions that are also not being saved is the worst outcome
    // available, and only the agent is in a position to stop.
    if let Some(e) = &write_error {
        hint = e.clone();
    }
    // Last, once nothing else borrows the project. A write that failed must not look like
    // a reading that landed — the mascot is the one part of the window a user watching
    // from across the room can read, and a celebration over a report that was never saved
    // is the same lie as a silent fallback file.
    state.ping(if write_error.is_some() { "sanity_error" } else { outcome });
    Json(serde_json::json!({
        "ok": write_error.is_none(),
        "saved": write_error.is_none(),
        "error": write_error,
        "project": landed_name,
        "repo": landed_repo,
        "remaining": remaining,
        "in_flight": in_flight,
        // Named for their scope, because they were read as being about the caller. Two
        // readers in one wave stopped to query these: one saw "warm_reports: 1" after
        // three honest `cold: true` reports and wondered which of its own it had got
        // wrong; another read the hint's "only 2 of 21 surprising" as a verdict on its
        // three. Both then spent tokens explaining themselves. A number handed to one
        // reader that is really about every reader has to say so in its own name.
        "repo_assessed": total,
        "repo_surprised": surprised,
        "repo_warm_reports": warm,
        "hint": hint,
    }))
}

#[derive(Deserialize)]
pub struct StatusParams {
    /// Which project is asking. Supplied by the stdio shim, like [`QueueParams::project`].
    #[serde(default)]
    project: Option<String>,
}

/// How far along this session's assessment is.
///
/// **Answered for the caller's project, not for the window's.** It was the last endpoint
/// resolving against `active`, and `active` moves whenever anybody opens anything — the
/// human clicking a project in the app is enough. So an orchestrator polling its own run
/// got another repo's numbers, with `repo` and `active` in the response naming a repo it
/// had never asked about and nothing saying the subject had changed. It reported a false
/// conclusion from them. The only reason it was caught at all was that `assessed` fell by
/// an order of magnitude; two repos of similar size and the wrong number reads as true.
///
/// Worse, `queue` and `report` were already routed by key, so the same server disagreed
/// with itself about what "current" meant: readers stayed on the session's repo while the
/// call driving them answered about another. An instrument whose status and whose work
/// describe different subjects is not measuring anything.
async fn status(
    State(state): State<Shared>,
    Query(p): Query<StatusParams>,
) -> Json<serde_json::Value> {
    let mut state = lock(&state);
    // Status counts as activity. It did not, and it is the call a driving loop makes most
    // often, so a reader could poll for minutes with the window insisting nothing was
    // happening. Its mood is deliberately the quietest in the set: at this frequency
    // anything livelier would drown the calls that mean something.
    state.ping("sanity_status");
    // Read before the map is borrowed. Reported on every status because the party that
    // needs it is the one driving a wave, and it is the only number here that describes
    // work the instrument DESTROYED rather than work it is waiting on.
    let refused = state.refused;
    let projects: Vec<serde_json::Value> = state
        .projects
        .values()
        .map(|p| {
            serde_json::json!({
                "name": p.name,
                "repo": p.repo.to_string_lossy(),
                "functions": count_funcs(&p.scan).kept,
                "files": count_files(&p.scan).kept,
                "assessed": assessed(p),
            })
        })
        .collect();
    let key = state.for_client(p.project.as_deref());
    // Kept alongside the borrow: the settings this reports are keyed by project and live in
    // the machine-local index rather than on `Project`, so the handler needs the key as well
    // as the thing it resolved to.
    let resolved = key.clone().unwrap_or_default();
    match key.and_then(|k| state.projects.get(&k)) {
        Some(p) => {
            // The loop's termination condition, so a driving agent can ask "is there
            // work left" without having to infer it from a report response it may never
            // have seen — subagent tool results do not reach the parent.
            let WorkLeft { remaining, in_flight, outstanding } = work_left(p);
            let stale = count_stale(&p.scan, &p.reports);
            // Oldest first and capped, because this is a diagnostic and the whole list of
            // a stalled wave says nothing the first few do not. `in_flight` above is the
            // true count and is never capped, so the short list cannot be mistaken for the
            // whole of what is out.
            let shown: Vec<serde_json::Value> = outstanding
                .iter()
                .take(OUTSTANDING_SHOWN)
                .map(|(id, age)| serde_json::json!({ "id": id, "held_for_s": age }))
                .collect();
            // One walk. Both halves came from separate calls on adjacent lines, so the
            // whole tree was counted twice to answer one question.
            let Counts { kept: functions, excluded, oversize } = count_funcs(&p.scan);
            Json(serde_json::json!({
                "open": true,
                // Named `project`, not `active`: this answer is about the caller's repo,
                // and calling it "active" was how a driving session read another repo's
                // numbers as its own. Every status response says what it answered about
                // so a mismatch is visible even to a caller that supplied no key.
                "project": p.name,
                "repo": p.repo.to_string_lossy(),
                // Who is answering. A backend is ephemeral and there is only ever one, so
                // this is not a lifecycle to manage — it is what you need to look at the
                // process when something is wrong, which a status verb should not withhold.
                "pid": std::process::id(),
                "port": read_endpoint().map(|e| e.port),
                // **How much of this repo's history the map holds**, because an orchestrator
                // reading `churn` or `age` off a summary has to know whether anybody has read
                // the log. `untraced` means those numbers are absent, which is not the same
                // claim as a repo with no git in it — see `trace::Depth`.
                "trace_depth": p.trace.depth,
                // What reading more would cost, when it is more than Sanity spends unasked.
                // Present means the map is deliberately incomplete and a person has to say go;
                // `sanity trace` is the verb, and `sanity_open` counts as having asked.
                "trace_cost_s": p.trace.pending.as_ref().map(|e| e.seconds),
                "functions": functions,
                // **Beside `functions`, because `assessed` counts both.** A file with
                // declarations is its own reading — queued, leased, graded and expired
                // exactly as a function is — so a caller dividing by `functions` alone
                // reports more read than there is to read. `sanity status` did: 812
                // functions, 821 read. The same arithmetic the sidebar's `150/631` came
                // from, arriving through the endpoint instead.
                "files": count_files(&p.scan).kept,
                "excluded": excluded,
                // Beside `excluded` and never folded into it. Both are functions no run will
                // reach, and the reasons are opposite: `excluded` is somebody's `.sanityignore`,
                // this is code too large for a reader to hold (`READ_CEILING`). Reported as one
                // number they would read as a decision the repo made about itself.
                "oversize": oversize,
                // Not scoped to this repo — see `AppState::refused`. Named for what it
                // counts so a driving session cannot read it as "reports outstanding".
                "refused_reports": refused,
                // Stale readings excluded, so this agrees with the sidebar and with
                // `remaining`. Through `assessed`, not spelled out again: this handler
                // carried its own `reports.len() - stale` a few lines from a call to the
                // function that exists to be the one definition, which is the divergence
                // `assessed` was written to end.
                "assessed": assessed(p),
                // What a run with no `--model` would use — see `suggested_model`. Reported
                // so the CLI can name it before spending anything, and so it does not have
                // to reimplement the resolution and drift from it. Null means nothing knows,
                // and the harness's own default reads.
                "model": suggested_model(p, &resolved),
                "harness": crate::reports::harness_for(&resolved),
                // Lease-independent, so two callers a second apart agree. It only falls
                // when a reading actually lands.
                "remaining": remaining,
                // What the leases explain. Polling `remaining` and seeing it flat while
                // this is non-zero means readers are working, not stuck.
                "in_flight": in_flight,
                // ...which `outstanding` makes checkable: the oldest few leases with how
                // long they have been held. A batch that has been out for minutes with
                // `remaining` flat is a dead wave, not a busy one, and only the age tells
                // the two apart. Ids, never bodies — see `WorkLeft`.
                "outstanding": shown,
                // Split out of `remaining` so an update run can say what it is doing.
                // "43 left" and "43 left, 12 of them readings that have expired" are the
                // same number and different jobs.
                "stale": stale,
                // The wave Sanity is running, if it is running one. Absent rather than
                // zeroed when there is none: a run that has never started and a run that
                // has started and read nothing are different states, and only one of them
                // is a reason to worry.
                //
                // `failed` is here because the alternative is a run that looks merely slow.
                // A misconfigured harness exits instantly, so `spawned` climbs, nothing
                // lands, and every other number on this page sits exactly where it was.
                // The same feed the window shows, on the same data. `sanity check` tails
                // this — so a terminal and a window watching one run see one thing, which
                // they would not if the CLI had been given its own endpoint to compute
                // from. Bounded and in memory; the record is `.sanity/`.
                "events": p.events,
                "run": p.run.as_ref().map(|r| serde_json::json!({
                    "harness": r.harness,
                    "model": if r.model.is_empty() { serde_json::Value::Null } else { r.model.clone().into() },
                    "readers": r.width,
                    "spawned": r.spawned,
                    "finished": r.finished,
                    "failed": r.failed,
                    "running": r.ended.is_none(),
                    // Asked to stop but not stopped yet. Killing five coding agents takes a
                    // moment, and without this the only visible states are "running" and
                    // "ended" — so pressing Stop looked like pressing nothing. Reported by
                    // the BACKEND rather than held by the clicking window, so a terminal
                    // tailing the same run sees it too.
                    "stopping": r.ended.is_none() && r.stop.load(std::sync::atomic::Ordering::Relaxed),
                    "live": r.live.load(std::sync::atomic::Ordering::Relaxed),
                    "ended": r.ended,
                    // Same as the window's copy — a terminal watching a failing run wants
                    // the reason as much as the pane does.
                    "failures": r.failures,
                })),
                "assessment_file": crate::assessment::dir(&p.repo).to_string_lossy(),
                "done": remaining == 0,
                "next_step": if remaining == 0 {
                    "Every function has an up-to-date reading. Summarize the surprises.".to_string()
                } else if remaining == in_flight {
                    format!(
                        "{remaining} still unread, all of them out with readers right now. \
                         Wait for this wave to finish rather than spawning another."
                    )
                } else if stale > 0 {
                    format!(
                        "{remaining} functions need reading ({in_flight} out with readers \
                         now), {stale} of them readings that have gone stale — the code \
                         changed under them. Those are handed out first. Spawn another wave \
                         of subagents.",
                    )
                } else {
                    format!(
                        "{remaining} functions still unassessed ({in_flight} out with \
                         readers now) — spawn another wave of subagents."
                    )
                },
                "projects": projects,
            }))
        }
        // Either nothing is open, or this session's repo is not loaded — during a restart
        // the second is the common one, and it is transient. Say which, for the same
        // reason `UNREACHABLE` is not `NOT_RUNNING`: a caller that cannot tell "wait" from
        // "there is nothing here" will pick one, and it picks wrong.
        None => Json(serde_json::json!({
            "open": false,
            "projects": projects,
            "hint": if p.project.is_some() {
                "The repo this session opened is not loaded right now. If the app was \
                 restarting this is TRANSIENT — wait a moment and call sanity_status \
                 again. If it keeps failing, call sanity_open with the absolute path."
            } else {
                "No repo is open. Call sanity_open with the absolute path first."
            },
        })),
    }
}

/// How many readings landed on each step of the scale.
#[derive(Debug, Default, Clone, Serialize)]
pub struct GradeCounts {
    pub full: usize,
    pub most: usize,
    pub some: usize,
    pub none: usize,
    /// Readings carrying no grade at all. Only `documented` can be this — `predicted`
    /// folds a pre-grade report onto the ends of the scale, because that is what its
    /// reader actually said.
    pub ungraded: usize,
}

impl GradeCounts {
    fn add(&mut self, g: Option<Grade>) {
        match g {
            Some(Grade::Full) => self.full += 1,
            Some(Grade::Most) => self.most += 1,
            Some(Grade::Some) => self.some += 1,
            Some(Grade::None) => self.none += 1,
            None => self.ungraded += 1,
        }
    }
}

#[derive(Debug, Default, Clone, Serialize)]
pub struct Tally {
    pub readings: usize,
    pub predicted: GradeCounts,
    /// Post-provenance, via [`Report::grades`]: a doc the reader judged derivable counts
    /// as `none` here however it was graded, because that is the rule the rest of the app
    /// applies and two different "documented" numbers would be worse than one.
    pub documented: GradeCounts,
    /// How many of those docs the reader judged it could have written from the code — the
    /// share of the `documented: none` above that came from the rule rather than from
    /// missing comments.
    pub derivable: usize,
    /// The second axis: how clear the body was once the reader had opened it.
    ///
    /// Reported alongside `predicted` rather than folded into it, because the pair is the
    /// finding. Low `predicted` with high `legible` is a repo you cannot navigate but can
    /// read; both low is one you cannot work in at all; and high `legible` beside a pile of
    /// `traps` is the dangerous one — clear on the surface, mined underneath.
    ///
    /// Readings banked before this field existed carry no opinion, so they land in
    /// `ungraded` rather than defaulting to a grade nobody gave.
    pub legible: GradeCounts,
    /// Readings whose reader said something here will bite the next person to edit it.
    pub traps: usize,
    /// Readings whose reader said it had not seen that file before.
    pub cold: usize,
}

impl Tally {
    fn add(&mut self, r: &Report) {
        let (predicted, documented) = r.grades();
        self.readings += 1;
        self.predicted.add(Some(predicted));
        self.documented.add(documented);
        self.derivable += usize::from(r.derivable);
        // A grade from a superseded question lands in `ungraded`, not in its rung. The map
        // stops coloring those wedges, and an aggregate that kept counting them would be
        // the orchestrator's copy of the answer disagreeing with the human's — the same
        // split `assessed` was fixed for, where the optimistic number was the one making
        // decisions.
        self.legible.add(r.legible.filter(|_| crate::assessment::legible_current(r.spec)));
        // Same rule as `legible` above: an answer to a superseded question is not counted.
        // It matters more here than there, because this number is the one somebody acts on
        // — an aggregate that kept counting old traps would send a maintainer looking for
        // hazards under a definition the map no longer uses.
        self.traps += usize::from(r.trap && crate::assessment::trap_current(r.spec));
        self.cold += usize::from(r.cold);
    }
}

/// Does a reader get better at this repo as it works through a batch?
///
/// The one thing the protocol could not see about itself. By its eighth function a reader
/// has learned the repo's idioms, its naming and its author's habits — so it predicts
/// better for reasons that are nothing to do with the code. That improvement is
/// indistinguishable in the output from code that is genuinely more predictable, which
/// makes it the same class of error as an invented surprise, pointed the other way.
///
/// **One bucket per position, not first-versus-later.** The collapsed version answered
/// the wrong question and hid it: a full pass of this repo at a batch of three found
/// `full` at 39.5% for position 1 against 38.4% later — flat — which reads as "no warming"
/// and is really "no warming *within three*". The concern was always about position eight
/// or nine. Three may simply be too short for a reader to learn anything, and a two-bucket
/// split cannot tell that apart from an effect that does not exist.
///
/// Per position, any run at any batch size contributes a point to the same curve for free.
/// A knee at five or six shows up as a knee; a flat line across ten is an answer.
///
/// What is known so far, and it is not much: a confounded sweep put later readings at 36%
/// `full` against 29% — the direction the warm-tail argument predicts. A cleaner run
/// reversed it. A complete pass showed neither. The one consistent signal across all three
/// is that `some` rises with position, which looks like a reader calibrating against a
/// scale it has now used rather than one learning the repo — a different mechanism, and
/// still not significant.
///
/// Settling it needs the arms interleaved in one wave so queue depth and file mix are
/// matched, and it needs a repo where a reader has less handed to it — this one gives a
/// paragraph of rationale per function, which leaves prior exposure little to add.
#[derive(Debug, Default, Clone, Serialize)]
pub struct Drift {
    /// Position → how that position's readings graded. Keyed by the reader's own count,
    /// so bucket 1 is every reader's first function whatever batch size it was running.
    pub positions: std::collections::BTreeMap<u32, GradeCounts>,
    /// Readings banked before position was recorded. Never folded into bucket 1 — an
    /// unknown position is not a claim of freshness, and counting it as one is exactly how
    /// a batched run got to look uniform in the first place.
    pub unrecorded: usize,
}

/// Everything [`summary`] reports, computed off the tree rather than off `reports`.
///
/// Walking the scan rather than the map is the same choice `save` makes: from the
/// function side each reading is checked against the body it was taken over, so a reading
/// whose code has moved is counted as stale instead of averaged in as coverage. Walking
/// the reports instead would report a distribution over a repo that no longer exists.
#[derive(Debug, Default, Serialize)]
pub struct Aggregate {
    pub total: Tally,
    pub by_model: std::collections::BTreeMap<String, Tally>,
    pub by_position: Drift,
    pub stale: usize,
    pub priming: Priming,
}

/// How much of this assessment was taken by readers holding the repo's own documentation.
///
/// Repo-wide, like everything else here, and it is the number that decides whether
/// `predicted` can be reported at all. `exposed` is what a run would rather not have; the
/// point of counting it is that a mixed corpus can be SPLIT, which prose in a caveats
/// document written afterwards cannot do.
#[derive(Debug, Default, Serialize)]
pub struct Priming {
    /// Readings whose reader declared the instructions were in its context.
    pub exposed: usize,
    /// Readings taken in a repo that HAS instructions, by a reader that did not hold them.
    pub clean: usize,
    /// Readings from a repo with no instructions file at all — nothing to be primed by,
    /// and counted apart so `clean` keeps meaning "deliberately excluded".
    pub not_applicable: usize,
}

fn aggregate(project: &Project) -> Aggregate {
    aggregate_of(&project.scan, &project.reports)
}

/// The same, from a scan and a store, for a caller with no `Project` — see
/// [`offline_counts`], which exists for the same reason. One definition, so the CLI
/// answering without a backend cannot drift from the endpoint answering with one.
pub fn aggregate_of(scan: &Scan, reports: &HashMap<String, Report>) -> Aggregate {
    let mut agg = Aggregate::default();
    // Through `each_unit`, so `.sanityignore` is honored here as it is everywhere else —
    // the aggregate is what `sanity summary` prints, and counting readings the queue would
    // never hand out is the same overstatement one level along.
    each_unit(scan, &mut |node| {
        if node.kind != NodeKind::Func {
            return;
        }
        let Some(r) = reports.get(&node.id) else {
            return;
        };
        if crate::assessment::is_stale(r, node.body.as_deref(), node.bytes) {
            agg.stale += 1;
            return;
        }
        agg.total.add(r);
        agg.by_model
            // Attribution is self-declared and may be missing; a blank gets its own
            // bucket rather than being folded in with the models that did say.
            .entry(if r.model.is_empty() { "unattributed".into() } else { r.model.clone() })
            .or_default()
            .add(r);
        // Three buckets and not two: "no instructions in this repo" and "instructions the
        // reader was launched without" are different facts, and folding them together would
        // let a repo that never had a CLAUDE.md read as a run somebody took care over.
        if r.agent_docs.is_empty() {
            agg.priming.not_applicable += 1;
        } else if r.primed {
            agg.priming.exposed += 1;
        } else {
            agg.priming.clean += 1;
        }
        let (predicted, _) = r.grades();
        match r.position {
            Some(n) => agg.by_position.positions.entry(n).or_default().add(Some(predicted)),
            None => agg.by_position.unrecorded += 1,
        }
    });
    agg
}

#[derive(Deserialize)]
pub struct SummaryParams {
    /// Which project is asking. Supplied by the stdio shim, like [`QueueParams::project`].
    #[serde(default)]
    project: Option<String>,
}

/// What the assessment says, in aggregate and in aggregate only.
///
/// The orchestrator is the party that has to report the result and the one party
/// structurally forbidden the numbers: `.sanity/` is off limits to it for the same reason
/// it is off limits to a reader, and nothing else returned a grade. So a real run ended
/// with the driving session describing its own measurement second-hand, from whatever its
/// subagents happened to say in chat. That is a hole in the loop — the instrument could
/// not tell its operator what it had learned.
///
/// **Repo-wide totals, and nothing that names a function or a file.** Not an oversight and
/// not thrift: "38% of readings graded most" tells a future reader nothing about anything
/// it is about to predict, and "udf.rs averages some" tells it precisely the thing the
/// whole protocol exists to withhold. A per-file breakdown is `.sanity/` with the serial
/// numbers filed off, and the same server answers both readers and orchestrators.
///
/// Stale readings are excluded and counted separately, like everywhere else — a summary
/// that averaged in readings of code that has since changed would be describing a repo
/// that no longer exists.
async fn summary(
    State(state): State<Shared>,
    Query(p): Query<SummaryParams>,
) -> Json<serde_json::Value> {
    let mut state = lock(&state);
    state.ping("sanity_summary");
    let key = state.for_client(p.project.as_deref());
    let Some(project) = key.and_then(|k| state.projects.get(&k)) else {
        return Json(serde_json::json!({
            "open": false,
            "hint": "No repo is open. Call sanity_open with the absolute path first."
        }));
    };

    let agg = aggregate(project);
    let WorkLeft { remaining, .. } = work_left(project);
    let Counts { kept: functions, excluded, oversize } = count_funcs(&project.scan);
    Json(serde_json::json!({
        "open": true,
        // The header this feeds is shared with `/status`, so the fields it reads have to
        // come from the same definitions. They did not: `assessed` was `agg.total.readings`,
        // which counts FUNCTION readings — the aggregate is about the grade tables, and the
        // tables are functions only. So `sanity summary` said 754 read where `sanity status`
        // said 817, one command apart, and both were describing the same repo.
        "project": project.name,
        "assessment_file": crate::assessment::dir(&project.repo).to_string_lossy(),
        "repo": project.repo.to_string_lossy(),
        "functions": functions,
        // Beside `functions`, because `assessed` counts file headers too — see the same
        // field on `/status`.
        "files": count_files(&project.scan).kept,
        "excluded": excluded,
        // Beside `excluded` and never folded into it. Both are functions no run will
        // reach, and the reasons are opposite: `excluded` is somebody's `.sanityignore`,
        // this is code too large for a reader to hold (`READ_CEILING`). Reported as one
        // number they would read as a decision the repo made about itself.
        "oversize": oversize,
        "assessed": assessed(project),
        "stale": count_stale(&project.scan, &project.reports),
        "remaining": remaining,
        "total": agg.total,
        "by_model": agg.by_model,
        "by_position": agg.by_position,
        "priming": agg.priming,
        "note": "Aggregates only. Nothing here names a function or a file, and that is \
                 deliberate: a per-file breakdown would tell a reader what to expect \
                 before it predicts, which is the contamination the whole protocol \
                 exists to prevent. `documented` is post-provenance — a doc graded \
                 derivable counts as none. Stale readings are excluded from every count \
                 above and reported separately. `by_position` buckets readings by how \
                 many functions the reader had already assessed, so bucket 1 is every \
                 reader's first. Read it as a CURVE, not as counts: later buckets hold \
                 fewer readings by construction and that means nothing. What matters is \
                 whether the grades get GREENER as position rises — that would be readers \
                 learning the repo as they work, an improvement that is theirs and not \
                 the code's. A full pass of one repo at a batch of three found the curve \
                 flat, which only rules out an effect within three. `priming` is the one \
                 condition that can invalidate `predicted` outright: `exposed` counts \
                 readers that held this repo's own CLAUDE.md while predicting it, which is \
                 recall wearing prediction's clothes. Report that number whenever it is \
                 not zero — a headline predicted-rate over a primed corpus is a claim the \
                 run did not earn."
    }))
}

/// What the window needs to know about what is on offer.
#[derive(Debug, Clone, Default, Serialize)]
pub struct ProjectList {
    pub active: Option<String>,
    pub projects: Vec<ProjectSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSummary {
    pub key: String,
    pub name: String,
    pub repo: String,
    pub functions: usize,
    /// Files that are their own reading — see [`count_files`]. Beside `functions` rather
    /// than folded into it, because the two are different things to say: "631 functions"
    /// is what the repo IS, and `functions + files` is how much there is to read. The
    /// sidebar divides by the sum; the header still names them separately.
    pub files: usize,
    /// Bumped whenever a scan lands — see `Project::scanned`.
    ///
    /// The window polls this list already, so a rescan reaches the picture without a second
    /// channel: the poll notices the number moved and refetches the tree. A Tauri event would
    /// be faster and would exist only in the windowed build, leaving `sanity serve` unable to
    /// do the one thing this is for.
    pub scanned: u64,
    /// Functions `.sanityignore` set aside. Shown beside `functions`, never folded into
    /// it — the sidebar's `81/377` is a claim about coverage, and a denominator that
    /// silently shrank is the same lie as a reading that outlived its code.
    pub excluded: usize,
    /// What the walk saw and did not scan — see [`crate::scan::Unscanned`].
    ///
    /// **`None` is "nobody has looked", not "nothing was dropped".** The rows for a project
    /// that has not been scanned zero every other count on the stated ground that a guess
    /// would be read as a measurement; an empty `Unscanned` is worse than a guess, because
    /// an empty list of gaps is a confident claim that there are none. So the absence is
    /// carried in the type rather than spelled as emptiness.
    pub unscanned: Option<crate::scan::Unscanned>,
    /// Functions and files too large for a reading to be taken over — see
    /// [`Node::unreadable`]. Out of the denominator like `excluded` and counted apart from
    /// it: the sidebar must not say a repo is fully read while holding work no run can
    /// reach, and it must not report a tool's limit as a choice somebody made.
    pub oversize: usize,
    /// Which agent reads this repo, as `sanity init` or the window recorded it.
    ///
    /// Machine-local — see `KnownProject::harness`. Which CLI is installed is a fact about
    /// this laptop, not about the repo.
    pub harness: Option<String>,
    /// Which model this repo is read by, as chosen here.
    pub model: Option<String>,
    /// Which model the readings already banked were taken by, when they agree.
    ///
    /// **The corpus is the authority on this, not a setting.** Never mixing models within
    /// one repo is the rule that keeps a map on one scale, and a stored preference cannot
    /// enforce it across two laptops — two people would each pick, and nothing on screen
    /// would say the wedges were measured differently. What the readings were actually
    /// taken by is a fact, it is already recorded per reading, and it survives being
    /// cloned. `None` when there are no readings, or when they already disagree — and
    /// disagreeing is itself worth showing rather than resolving.
    pub banked_model: Option<String>,
    /// The one agent this repo's readings were actually taken by — see [`one_harness`].
    /// Outranks the machine-local preference for the same reason `banked_model` does: it
    /// is a fact that travels with the repo rather than a setting on one laptop.
    pub banked_harness: Option<String>,
    /// Every model in the corpus with its share — see [`model_tally`]. One entry is the
    /// ordinary case; more than one is a repo already on two scales, and the dialog says so.
    pub banked_models: Vec<ModelCount>,
    /// The model of the newest dated reading — see [`recent_model`]. What a mixed corpus
    /// offers in place of a banked model.
    pub recent_model: Option<String>,
    /// The wave in progress, if any — see [`Run`].
    pub run: Option<serde_json::Value>,
    /// The last few functions out and back, oldest first — see [`Event`].
    pub events: Vec<Event>,
    /// Node ids currently out with a reader, so the map can show where the work is.
    ///
    /// **The panel used to list function names and this replaces them.** A list of four
    /// names in the narrowest column in the app is a progress indicator you have to read,
    /// scrolling past faster than anybody can, and it says nothing about WHERE the work is
    /// — which is the one thing this app draws. On the map the same fact is a glance: the
    /// wedges being read pulse, and a run becomes visibly a sweep across the repo.
    ///
    /// Node ids, uniquely among everything durable here, and that is safe precisely because
    /// this is not durable: it is a frame of the poll, matched against a tree from the same
    /// process and thrown away. The `key_of` rule exists because ids embed `@line` and a
    /// stored one orphans the moment somebody adds an import; nothing is stored here.
    ///
    /// Leases whose reading has already landed are dropped rather than left to expire, or a
    /// finished function would go on pulsing for the rest of its lease.
    pub reading: Vec<String>,
    /// Functions with a reading that still describes them.
    ///
    /// Stale readings are excluded rather than counted, so `assessed / functions` means
    /// "how much of this repo is currently understood" and not "how much was understood
    /// at some point". The same choice `collect_tasks` makes — a repo cannot be finished
    /// and have expired readings in it.
    pub assessed: usize,
    /// Lines of code in the functions still outstanding — see [`unread_lines`].
    pub unread_lines: usize,
    /// Commits reachable from HEAD, as the scan counted them. 0 for a repo with no history.
    ///
    /// Beside the reading numbers because the sidebar now says both: a project has a repo to
    /// READ and a story to REPLAY, they are worked separately, and a row that reports only
    /// the first leaves the second discoverable only by turning a mode on and waiting.
    pub commits: usize,
    /// Commits already replayed and stored — see [`crate::history::banked`]. The difference
    /// is what a replay has left to do.
    pub replayed: usize,
    /// Where this repo's trace has got to, when one is running — see [`crate::history::tracing`].
    ///
    /// **The window used to be the only thing that knew, which meant a reload made a running
    /// walk invisible.** The row went back to offering `Trace` over a repo with ten cores
    /// already on it, the count beside the button froze at whatever it was when the run
    /// started, and pressing it would have started a second walk. The walk is the backend's,
    /// so its progress is reported the same way `run` is: from the process doing the work, on
    /// the list the sidebar already polls, so any window — reloaded, second, or opened an hour
    /// later — sees the same thing.
    pub tracing: Option<crate::scan::Progress>,
    /// How much of this repo's history the MAP holds — see `trace::Depth`.
    ///
    /// Depth 3 is the replay above; this is the two below it. `untraced` means the wedges carry
    /// no age, churn or author at all, which is a different sentence from "this folder has no
    /// git history" and has to reach the window as one.
    pub trace_depth: crate::trace::Depth,
    /// What reading more of it would cost, when that is more than a budget will spend unasked.
    ///
    /// `None` means nothing is waiting — either it fits and has been done, or it is running.
    /// Present means the map is deliberately incomplete and somebody has to say go.
    pub trace_cost: Option<crate::trace::Estimate>,
    /// Where a running trace has got to, from the process doing it. Null when none is.
    pub tracing_history: Option<crate::scan::Progress>,
    /// Files with per-line history, and how many the trace was asked to resolve.
    ///
    /// **Both numbers, from the same place.** The row used to divide `resolved` by the file
    /// count reported beside it, and the two are counted differently — `files` is what a reader
    /// could be handed, `resolvable` is every file node the trace walked — so the fraction
    /// never reached one and the pill went on offering work that was done. Two fields that are
    /// always set together cannot drift the way two definitions of one number can.
    pub resolved: usize,
    pub resolvable: usize,
    /// The repo has moved and rescanning it is over budget — see `Project::behind`.
    pub behind: bool,
    /// What a scan of this repo would cost, when nobody has been asked yet.
    ///
    /// Present ONLY for a repo whose scan was declined: there is no tree, every count below is
    /// zero because nothing has been measured, and this is what the row offers instead. Not to
    /// be confused with `trace_cost`, which is about a repo that HAS a map.
    pub scan_cost: Option<crate::scan::Estimate>,
    pub stale: usize,
    pub touched: u64,
    /// An agent has called about this project recently. Per project, so two sessions
    /// working two repos both report as working rather than one of them winning.
    pub working: bool,
    /// Known from the index but not yet rescanned, so its counts are not measured yet.
    ///
    /// A restore rescans rather than storing trees, and a large repo takes tens of
    /// seconds — tonepoet is 34. The name and path were on disk the whole time, so a
    /// sidebar that shows nothing until the scan lands is withholding what it already
    /// knows and reading as "your projects are gone". These entries carry real names and
    /// zeroed counts, and the flag is what stops a zero being read as a measurement.
    pub loading: bool,
    /// This app is not holding a scan for the project, and nothing is on its way either.
    ///
    /// **A third state, and it has to be stated rather than inferred from the other two.**
    /// The window read "scanned" as neither declined nor loading, which is true of every row
    /// that has been scanned and also of the one a reset leaves behind — so that row ticked
    /// its Scan pill over `0 functions in 0 files`, reported `no git history here` about a
    /// repo nobody had walked, and offered to read nothing. Every count on a row like this is
    /// a zero standing for "not measured", the same as behind `loading`, and this is what
    /// stops one being read as a measurement.
    ///
    /// True for all three of the not-held cases — reset, waiting on the restore, declined for
    /// cost — because it says what the app is holding and not why. See `unloaded`, which
    /// builds the row, and `AppState::unload`, which is how a project gets here on purpose.
    #[serde(default)]
    pub unloaded: bool,
    /// How far that rescan has got, when it has started counting. Both zero means the walk
    /// is still under way and there is no denominator yet — which is a real state, not a
    /// zero-percent one, and the UI shows it as such.
    pub read_done: usize,
    pub read_total: usize,
    /// What the scan is doing — see `scan::Progress::phase`. A scan names its phases whether
    /// or not it can count them, because a bar that runs two phases end to end at very
    /// different speeds reads as a hang at the join unless the join is on screen.
    #[serde(default)]
    pub read_phase: String,
    /// What `read_done` and `read_total` are counting — see `scan::Progress::unit`.
    #[serde(default)]
    pub read_unit: String,
}

/// One row for a project the app knows of and is not holding a scan for.
///
/// **Three lists render this same row and they were three copies of it.** A scan declined
/// for cost, a project the restore has not reached, and — the case that has no list —
/// one whose live state has been dropped by a reset. All three know a name, a path and
/// nothing else, and the whole of what separates them is whether something is happening
/// (`loading`) and whether there is a price to print (`scan_cost`), so those are what a
/// caller overrides and everything else is settled here.
///
/// Every count is zero and every reading is empty, which is the rule the counts follow
/// everywhere: the walk has not run, so there is no denominator, and a guess in one of
/// these fields is read as a measurement. The configured harness and model DO come
/// through — they are the index's own, not the scan's, and a repo does not forget who
/// reads it because nothing is loaded.
fn unloaded(known: &crate::reports::KnownProject) -> ProjectSummary {
    ProjectSummary {
        key: known.key.clone(),
        name: known.name.clone(),
        repo: known.repo.clone(),
        functions: 0,
        files: 0,
        // Not walked yet, so there is no tally — see the field.
        unscanned: None,
        // Nothing has been scanned, so there is no revision to report. The window reads a
        // change in this as "refetch"; starting at zero means the first real scan is a
        // change from it.
        scanned: 0,
        excluded: 0,
        oversize: 0,
        harness: known.harness.clone(),
        model: known.model.clone(),
        // Nothing has been read back yet, so the corpus cannot speak. Zero guesses here,
        // same as the counts above.
        banked_model: None,
        banked_harness: None,
        banked_models: Vec::new(),
        recent_model: None,
        run: None,
        events: Vec::new(),
        assessed: 0,
        unread_lines: 0,
        commits: 0,
        replayed: 0,
        tracing: None,
        // Nothing scanned, so nothing traced and no bank to price the next one from — the
        // same rule as the counts above.
        trace_depth: crate::trace::Depth::Untraced,
        trace_cost: None,
        tracing_history: None,
        resolved: 0,
        resolvable: 0,
        behind: false,
        scan_cost: None,
        reading: Vec::new(),
        stale: 0,
        touched: known.touched,
        working: false,
        loading: false,
        // What the row IS. Every zero above stands for "not measured" and this is the field
        // that says so — see `ProjectSummary::unloaded`.
        unloaded: true,
        read_done: 0,
        read_total: 0,
        read_phase: String::new(),
        read_unit: String::new(),
    }
}

impl ProjectList {
    pub fn from_state(state: &AppState) -> ProjectList {
        // Read once for the whole list, not once per project: this is polled every second
        // and a the-index-per-row version would open the same file a dozen times a tick.
        let index = crate::reports::load_index();
        let harnesses: HashMap<String, String> = index
            .projects
            .iter()
            .filter_map(|k| k.harness.clone().map(|h| (k.key.clone(), h)))
            .collect();
        let models: HashMap<String, String> = index
            .projects
            .iter()
            .filter_map(|k| k.model.clone().map(|m| (k.key.clone(), m)))
            .collect();
        let mut projects: Vec<ProjectSummary> = state
            .projects
            .iter()
            .map(|(key, p)| {
                let stale = count_stale(&p.scan, &p.reports);
                let Counts { kept: functions, excluded, oversize } = count_funcs(&p.scan);
                let files = count_files(&p.scan).kept;
                ProjectSummary {
                    unscanned: Some(p.scan.stats.unscanned.clone()),
                    trace_depth: p.trace.depth,
                    trace_cost: p.trace.pending.clone(),
                    tracing_history: p.trace.running.clone(),
                    resolved: p.trace.resolved.0,
                    resolvable: p.trace.resolved.1,
                    behind: p.behind,
                    // A project with a tree has been scanned; what it would cost to do again
                    // is not a question the row asks. See the field.
                    scan_cost: None,
                    // Same window as `agent_activity`: a reader predicting, opening a
                    // file and writing a report goes quiet for tens of seconds inside one
                    // continuous batch, and a shorter window makes it flicker.
                    // And not counting this run's own death rattle. A stopped reader is
                    // killed mid-call, so its last MCP calls sit inside the window above
                    // with nothing behind them — see `Run::ended_at`. Chatter AFTER the run
                    // ended is real work (a hand-driven session on the same repo) and still
                    // counts, which is why this compares times rather than simply muting a
                    // project that has ever had a run.
                    working: p.last_agent.is_some_and(|t| {
                        t.elapsed() < Duration::from_secs(60)
                            && p.run
                                .as_ref()
                                .and_then(|r| r.ended_at)
                                .is_none_or(|end| t > end)
                    }),
                    key: key.clone(),
                    name: p.name.clone(),
                    repo: p.repo.to_string_lossy().to_string(),
                    functions,
                    files,
                    scanned: p.scanned,
                    excluded,
                    oversize,
                    harness: harnesses.get(key).cloned(),
                    model: models.get(key).cloned(),
                    banked_harness: one_harness(p),
                    banked_model: one_model(p),
                    banked_models: model_tally(p),
                    recent_model: recent_model(p),
                    run: p.run.as_ref().map(|r| serde_json::json!({
                        "harness": r.harness,
                        "model": r.model,
                        "readers": r.width,
                        "spawned": r.spawned,
                        "finished": r.finished,
                        "failed": r.failed,
                        "running": r.ended.is_none(),
                        // See the same field in `/status`: pressing Stop has to be visible
                        // before the readers have actually died.
                        "stopping": r.ended.is_none() && r.stop.load(std::sync::atomic::Ordering::Relaxed),
                        "live": r.live.load(std::sync::atomic::Ordering::Relaxed),
                        "ended": r.ended,
                        "failures": r.failures,
                    })),
                    events: p.events.iter().cloned().collect(),
                    // The same walk `assessed` does, and for the reason written there:
                    // `reports.len() - stale` counts readings whose function was deleted.
                    assessed: assessed(p),
                    unread_lines: unread_lines(p),
                    commits: p.scan.stats.commits,
                    // Read from a four-byte sidecar rather than from the timeline itself,
                    // which on a large repo is hundreds of megabytes — see `history::banked`.
                    replayed: crate::history::banked(&p.repo, crate::history::ALL_COMMITS),
                    tracing: crate::history::tracing(&p.repo),
                    reading: p
                        .leased
                        .iter()
                        .filter(|(id, at)| {
                            at.elapsed() < LEASE && !p.reports.contains_key(*id)
                        })
                        .map(|(id, _)| id.clone())
                        .collect(),
                    stale,
                    touched: p.touched,
                    loading: false,
                    // Held, with a tree behind every count above.
                    unloaded: false,
                    read_done: 0,
                    read_total: 0,
                    read_phase: String::new(),
                    read_unit: String::new(),
                }
            })
            .collect();
        // **Projects whose scan was declined for cost.** Listed from the index like the
        // restoring rows below, and for the same reason — the name and path are known and the
        // counts are not — but with `loading: false`, because nothing is happening and
        // nothing is going to until somebody says so. The estimate rides along as the only
        // number the row can honestly print.
        projects.extend(
            state
                .awaiting
                .iter()
                // Against BOTH lists, not just the loaded one. Three sources feed this vector
                // — loaded, declined, pending — and any two of them naming one key is that
                // project on screen twice. `scan_repo` clears the declined entry when a scan
                // starts, and this is the guard behind that rather than the message: a row
                // that has appeared twice is not something to explain, it is something not to
                // do.
                .filter(|(key, _)| {
                    !state.projects.contains_key(*key)
                        && !state.restoring.iter().any(|k| &k.key == *key)
                })
                .filter_map(|(key, cost)| {
                    let known =
                        crate::reports::load_index().projects.into_iter().find(|k| &k.key == key)?;
                    Some(ProjectSummary {
                        // The estimate rides along as the only number this row can honestly
                        // print, and it is the whole of what makes it a DECLINED row rather
                        // than an unloaded one. **Not loading**: a declined scan is a standing
                        // state, not a wait — the row that says "loading" forever is the
                        // failure that flag exists to prevent, wearing the opposite face.
                        scan_cost: Some(cost.clone()),
                        ..unloaded(&known)
                    })
                }),
        );
        // Projects the restore knows about but has not reached yet. Listed from the index,
        // which holds the name and path — everything the sidebar needs to show a row — and
        // nothing it does not, so the counts stay zero behind `loading` rather than being
        // guessed. Skipped once the real project lands, so a row never appears twice.
        projects.extend(
            state.restoring.iter().filter(|known| !state.projects.contains_key(&known.key)).map(
                |known| {
                    let progress = state
                        .restoring_progress
                        .get(&known.key)
                        .cloned()
                        .unwrap_or_else(|| crate::scan::Progress::at(0, 0));
                    ProjectSummary {
                        // The one thing this row has that an unloaded one does not: something
                        // is happening, and how far it has got. Both zero means the walk is
                        // under way with no denominator yet, which is a real state rather than
                        // a zero-percent one.
                        loading: true,
                        read_done: progress.done,
                        read_total: progress.total,
                        read_phase: progress.phase,
                        read_unit: progress.unit,
                        ..unloaded(known)
                    }
                },
            ),
        );
        // **Everything else the index knows, which is the list nothing else was keeping.**
        //
        // The three sources above are all live state, and a project can be in the index and
        // in none of them. Reset is how you get there on purpose: it deletes every cache and
        // calls `unload`, whose own doc says the row has to stay because the point is to scan
        // it again — and the row went anyway, because nothing listed a project the app was
        // not holding. Pressing Reset removed the project from the sidebar, which is Remove,
        // which is the other menu item.
        //
        // So the rule is that **the index is the list**, and live state only decides how much
        // a row can say. `forget` is what takes a row out, and it does it by taking the entry
        // out of the index; anything still in there is still yours. That also catches the
        // rows the restore settles without loading — a repo on a volume that is not mounted
        // stops being pending, and `drain` says so, but it does not stop being a project.
        //
        // Zeroed and not loading, like the two above it: a row that cannot say what is in the
        // repo says nothing about it, and its Scan pill is the offer to find out.
        {
            let held = |key: &str| {
                state.projects.contains_key(key)
                    || state.awaiting.contains_key(key)
                    || state.restoring.iter().any(|k| k.key == key)
            };
            projects.extend(
                index.projects.iter().filter(|known| !held(&known.key)).map(unloaded),
            );
        }
        // Most recently touched first, unless somebody has arranged the list — see
        // `KnownProjects::order`. Arranged rows come first in the order they were put in;
        // anything the arrangement has never heard of (a project added since) sorts above
        // them by recency, because a repo you just opened belongs where you will look first.
        let order = &state.order;
        projects.sort_by_key(|p| {
            let at = order.iter().position(|k| *k == p.key);
            (at.is_some(), at.unwrap_or(0), std::cmp::Reverse(p.touched))
        });
        ProjectList { active: state.active.clone(), projects }
    }
}

/// Is anybody home, and who.
///
/// Separate from `/status` because status is not free: it calls `ping`, which is what
/// drives the mascot and the "an agent is working" panel. `sanity serve` and `sanity
/// study` both have to ask whether a backend is already up, and a liveness probe that
/// animates the window as though a reader had called something would make the UI lie
/// about its own subject. This touches no state at all.
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
/// Stop every run this backend is driving, and wait briefly for its readers to die.
///
/// **A reader must not outlive the backend that spawned it.** It is a whole coding agent,
/// spending somebody's tokens on readings that now have nowhere to land — expensive and
/// useless at once, which is the worst kind of orphan to leave behind. Quitting the window
/// is the case that matters: the backend is a thread in that process, so the readers are
/// its children, and nothing about a normal exit kills them.
///
/// The wait is short and best-effort on purpose. It is a tidy-up on the way out, and a
/// shutdown that blocks because an agent is slow to die is worse than one stray process:
/// `kill_on_drop` and the process going away cover what this misses.
pub fn stop_all_runs(state: &Shared) {
    let mut any = false;
    {
        let st = lock(state);
        for p in st.projects.values() {
            if let Some(r) = &p.run {
                if r.ended.is_none() {
                    r.stop.store(true, std::sync::atomic::Ordering::Relaxed);
                    any = true;
                }
            }
        }
    }
    if !any {
        return;
    }
    // Waited on the COUNT, not a clock. Each reader is killed by its own task, so a fixed
    // sleep races the scheduler: three readers reliably outlived a 900ms one and were left
    // orphaned on PPID 1. This ends as soon as the last process is gone, and gives up after
    // a bounded wait because a shutdown that hangs on a slow agent is worse than a stray.
    let deadline = Instant::now() + Duration::from_secs(5);
    loop {
        let alive: usize = {
            let st = lock(state);
            st.projects
                .values()
                .filter_map(|p| p.run.as_ref())
                .map(|r| r.live.load(std::sync::atomic::Ordering::Relaxed))
                .sum()
        };
        if alive == 0 || Instant::now() >= deadline {
            return;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

pub fn release_endpoint(pid: u32) {
    if read_endpoint().is_some_and(|ep| ep.pid == pid) {
        if let Some(path) = endpoint_file() {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// Rebuild the projects sanity had open, in the background.
///
/// Scans are recomputed rather than stored: a saved tree would be wrong the moment a file
/// changed, and rescanning costs about a second. Assessments come back from disk with the
/// project, which is the part that actually could not be recovered.
///
/// A repo that has moved or been deleted is dropped silently — a sidebar entry that opens
/// nothing is worse than one that quietly disappeared.
///
/// Nothing here calls `touch`, and nothing persists until the end. `touch` writes the
/// index, and during a restore the map it would write is the half of the list rebuilt so
/// far — so quitting mid-restore used to truncate `projects.json` to whatever had loaded,
/// losing the rest permanently. A restore reads the index; it has no business editing it
/// until it knows the whole answer.
/// Put the sidebar in this order and remember it. Keys, oldest arrangement first.
pub fn set_order(state: &Shared, keys: Vec<String>) {
    let mut s = lock(state);
    s.order = keys;
    s.persist();
}

/// Rebuild the sidebar's projects, scanning each one.
///
/// `on_shape` streams each directory's files as they parse, so a window can draw the map
/// assembling rather than a bar — see `Node::slim` and `lib/shape.ts`. A backend with no
/// window passes a no-op: this module is the headless half and has never held an
/// `AppHandle`, which is why the emitter arrives as an argument rather than being reached
/// for.
///
/// `on_tick` is the same arrangement for progress. The restore wrote its counts into
/// `restoring_progress` and stopped there, which the sidebar polls at 1.5s — a rate that is
/// fine for a fraction and useless for `Progress::at`, where the whole point is that the
/// wedge lights up as the scan reaches it. Adding a project goes through `commands.rs` and
/// already emitted; a RELAUNCH went through here and did not, so the same repo lit up or
/// stayed dark depending on which way it had arrived.
///
/// **Both carry the project key, because the window cannot work it out.** They did not, and
/// the receiving side inferred the owner from the projects list — the one row that is
/// `loading`. There is no such row: a restore publishes EVERY known project as loading up
/// front, on purpose, so the sidebar fills in immediately. So the inferred owner was
/// whichever unfinished project sorted first, it changed hands every time any of them
/// settled, and the accumulated shape of the repo actually being scanned was thrown away
/// mid-parse. A stream that names its subject cannot be guessed wrong.
/// The window's shape stream, shared by the restore's lanes rather than owned by one.
///
/// `Arc<dyn …>` and not a generic: two lanes run the same code over the same emitters, and a
/// type parameter would only mean two copies of [`drain`] that cannot share them.
type ShapeSink = std::sync::Arc<dyn Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync>;
/// The window's progress stream, on the same terms as [`ShapeSink`].
type TickSink = std::sync::Arc<dyn Fn(&str, &crate::scan::Progress) + Send + Sync>;

/// Work one lane of the restore: scan each project, publish it, move to the next.
///
/// Split out of [`restore`] so two lanes can run it — see `BIG_REPO_FILES`. Everything it
/// touches is per project or behind the state lock, so two of these are independent: the
/// scan caches are per repo, the progress is keyed by project, and the only shared thing is
/// `wanted`, which `claim_next` consumes only when this lane can serve it.
///
/// `active` is the key the LAST session was looking at, passed in rather than read here so
/// both lanes compare against the same value; which project the window actually lands on is
/// decided once, by the caller, after both lanes have finished.
fn drain(
    mut queue: Vec<crate::reports::KnownProject>,
    state: &Shared,
    on_shape: &(dyn Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync),
    on_tick: &(dyn Fn(&str, &crate::scan::Progress) + Send + Sync),
    active: Option<String>,
) {
    while !queue.is_empty() {
        // Whoever the window is waiting on goes next, if this lane holds them.
        let known = queue.remove(claim_next(&mut lock(state).wanted, &queue));
        let path = PathBuf::from(&known.repo);
        // Off the list whatever happens below — a row that cannot be scanned must stop
        // claiming to be moments away from appearing. It stays in the index, so it
        // comes back next launch if the volume does; it just isn't pending any more.
        let settled = |s: &mut AppState| {
            s.restoring.retain(|k| k.key != known.key);
            s.restoring_progress.remove(&known.key);
        };
        if !path.is_dir() {
            settled(&mut lock(state));
            continue;
        }
        // The scan already counts what it is doing; the restore used to discard it and
        // leave the sidebar with nothing to say for the length of a large repo.
        // The map first, and without asking whether it is still true — see
        // `treecache::stale`. Proving it costs a walk of the whole repo, and the scan on
        // the next line does that anyway and replaces this if the answer is no.
        if let Some(drawn) = crate::treecache::stale(&path) {
            lock(state).shallow.insert(known.key.clone(), drawn);
        }
        let progress_key = known.key.clone();
        let progress_state = state.clone();
        // Once, on the first phase that can count itself — see `reports::note_size`.
        let sized = std::sync::atomic::AtomicBool::new(false);
        let on_progress = move |p: crate::scan::Progress| {
            on_tick(&progress_key, &p);
            let mut s = lock(&progress_state);
            // Under the state lock, which is what serialises it against the other lane: this
            // is a read-modify-write of one file and two of them interleaving is how an index
            // loses an entry. `persist` is safe for the same reason — it runs holding this.
            if p.total > 0 && !sized.swap(true, std::sync::atomic::Ordering::Relaxed) {
                crate::reports::note_size(&progress_key, p.total);
            }
            s.restoring_progress.insert(progress_key.clone(), p);
        };
        // **Priced before a file is opened.** The count and the rate are both banked by the
        // last scan of this repo, so this costs a lookup — which is the point at a launch
        // restoring every project, where a directory walk apiece to decide would be most of
        // what the gate is meant to save. A repo nobody has scanned here is not refused: its
        // size is unknown, and refusing on an unknown would leave a row that cannot be acted
        // on. See `scan::estimate`.
        let priced = crate::scan::estimate(known.files, known.scan_ms);
        // **A cached tree makes that price wrong**, and wrong in the direction that annoys: the
        // estimate is what PARSING would cost, and a repo whose tree is already stored is not
        // going to be parsed — the scan walks, matches the signature and decodes the answer.
        // Kibana was declined at every launch on a fifteen-second estimate for a tenth of a
        // second of work. Asked only when the price says no, so a small repo never pays for the
        // question. See `treecache::warm`.
        if !priced.fits
            && !crate::treecache::warm(
                &path,
                crate::scan::Fidelity::Ordering,
                crate::trace::Depth::Untraced,
            )
        {
            let mut s = lock(state);
            s.awaiting.insert(known.key.clone(), priced);
            settled(&mut s);
            continue;
        }
        let scans = crate::scancache::ScanCache::open(&path);
        let scan_took = Instant::now();
        // **Nobody asked for this one.** A launch restores every project in the index, so it is
        // the least invited work in the app, and it draws the map without opening git at all —
        // see `trace`. What history costs is decided below, against a budget, per repo.
        let Ok(mut scan) = crate::scan::scan(
            &path,
            &crate::surprise::HeuristicModel,
            &on_progress,
            &|_, _: &crate::surprise::Reading| {},
            &|files: &[crate::scan::ShapeFile]| on_shape(&known.key, files),
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos {
                scores: &crate::cache::Cache::ephemeral(),
                scans: &scans,
            },
            // A queue sort key, not a number anyone sees — see `scan::Fidelity`.
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        ) else {
            settled(&mut lock(state));
            continue;
        };
        // Banked from the scan that just ran, so the next launch prices this repo from its own
        // measurement rather than the corpus default — see `reports::note_scan`. Written here
        // rather than beside `note_size` because a rate needs a whole scan to be a rate.
        crate::reports::note_scan(&known.key, scan.stats.files_scanned, scan_took.elapsed().as_millis() as u64);
        let pending =
            trace_within_budget(&path, &mut scan, &scans, known.trace_depth.as_deref(), &on_progress);
        // **Never over what somebody already paid for** — see `banks_over`. A launch that
        // declines to restore has priced some work, not undone it.
        if banks_over(pending.depth, known.trace_depth.as_deref()) {
            crate::reports::note_trace(&known.key, pending.depth.tag_str());
        }
        let marks = stamp_marks(&path, &scan);
        let mut s = lock(state);
        settled(&mut s);
        let reports = load_reports(&path, &scan);
        let probe_path = path.clone();
        s.shallow.remove(&known.key);
        s.projects.insert(
            known.key.clone(),
            Project {
                reads: 0,
                findings: None,
                repo: path,
                name: known.name.clone(),
                scan,
                reports,
                trace: pending,
                behind: false,
                leased: HashMap::new(),
                recent_files: HashMap::new(),
                predictions: HashMap::new(),
                revealed: HashMap::new(),
                run: None,
                events: Default::default(),
                file_marks: marks,
                marks: crate::watch::probe(&probe_path),
                scanned: 1,
                touched: known.touched,
                last_agent: None,
            },
        );
        // Restored in reverse order so the last one touched is the last one in, and
        // the window lands back where it was rather than on an arbitrary project.
        //
        // The window only switches when `active` is set, so choosing it is what makes
        // a restore visible at all. Decided once, after the loop, against what
        // actually came back: picking it per-iteration meant a recorded active whose
        // repo had since been moved or deleted matched nothing, left `active` at None,
        // and opened an empty window with a full sidebar behind it.
        if active.as_deref() == Some(known.key.as_str()) {
            s.active = Some(known.key.clone());
        }
    }
}

/// Above this many files a repo gets a lane to itself — see [`restore`].
///
/// The gap it sits in is enormous, which is what makes the exact value uninteresting: this
/// repo is **77** files, tonepoet is 731, and linux is **65,757**. Nothing measured lands
/// within an order of magnitude of the line. What would make it delicate is a repo that
/// actually sits near it, and then the question to ask is not "what is the number" but "how
/// long does this repo hold a lane", because that is the property being bought.
const BIG_REPO_FILES: usize = 2_000;

/// Which project this lane takes next: the one somebody is waiting on, else the running
/// order — see [`AppState::wanted`].
///
/// **Consumed only if this lane can serve it**, which is what makes it safe with two lanes
/// drawing from the same request. A plain `take` would let the small lane swallow a request
/// for a big repo, and the click would do nothing at all.
///
/// Its own function so the choice can be tested without a thread, a temp repo and a scan. A
/// `wanted` naming something not in this queue is the normal case rather than an error: it is
/// in the other lane, already scanned, or the one in flight — and either way the queue is the
/// list of what is LEFT here.
fn claim_next(wanted: &mut Option<String>, queue: &[crate::reports::KnownProject]) -> usize {
    match wanted.as_deref().and_then(|key| queue.iter().position(|p| p.key == key)) {
        Some(at) => {
            *wanted = None;
            at
        }
        None => 0,
    }
}

pub fn restore(
    state: Shared,
    on_shape: impl Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync + 'static,
    on_tick: impl Fn(&str, &crate::scan::Progress) + Send + Sync + 'static,
) {
    let index = crate::reports::load_index();
    if index.projects.is_empty() {
        return;
    }
    // Continue the previous session's counter rather than restarting it. `touched` is
    // `clock`, and clock is per-process — which was harmless while every entry was
    // rewritten on every save and they all shared one session's numbering. Now that
    // unloaded entries keep the number they were last saved with, a counter starting at 0
    // would rank this session's projects BELOW last session's, and the sidebar reads as a
    // history in that order.
    {
        let mut s = lock(&state);
        let high = index.projects.iter().map(|p| p.touched).max().unwrap_or(0);
        s.clock = s.clock.max(high);
        // Published before the first scan starts, so the sidebar fills in immediately with
        // what the index already knows and each row firms up as its scan lands — rather
        // than staying empty for the length of the slowest repo and reading as loss.
        s.restoring = index.projects.clone();
        // The arrangement comes back with the list it arranges, or the sidebar reads as
        // recency again on every launch and a person has to drag it back every morning.
        s.order = index.order.clone();
        // **Where this launch is going, said before it gets there.** `active` used to be set
        // only when the previously-active project's own scan landed — last, on a big repo —
        // so for the length of that scan the window had nothing selected and waited on
        // whatever sat at the top of the sidebar: a launch that said "Reading sanity…" for
        // half a minute and then showed ceph.
        //
        // Naming it now is a claim about intent, not about what came back. If that repo has
        // been moved or deleted it never arrives, and the fallback after the loop replaces it
        // with the most recently touched thing that did — the same correction as before, one
        // wrong project name earlier rather than one wrong project name throughout.
        s.active = index.active.clone();
    }
    std::thread::spawn(move || {
        let on_shape: ShapeSink = std::sync::Arc::new(on_shape);
        let on_tick: TickSink = std::sync::Arc::new(on_tick);
        // **The one you are going to look at, first.** The list is restored oldest-touched
        // first so the most recent ends up on top — which is right for the sidebar and wrong
        // for the wait: scanning is sequential, so the project the window will open was
        // behind every other one, and a launch with three repos made you wait for all three
        // to see the first.
        let mut order: Vec<&crate::reports::KnownProject> = index.projects.iter().rev().collect();
        if let Some(active) = index.active.as_deref() {
            if let Some(at) = order.iter().position(|k| k.key == active) {
                let first = order.remove(at);
                order.insert(0, first);
            }
        }
        // Owned, and drained by choice rather than iterated in order — see `AppState::wanted`.
        // The arrangement above is the best guess anyone can make BEFORE the window is up;
        // once it is, somebody clicking a row is better information than any guess, and a
        // queue that cannot be reordered has no way to accept it.
        let queue: Vec<crate::reports::KnownProject> = order.into_iter().cloned().collect();

        // **Two lanes, so a small repo never waits on a large one.** A single queue meant
        // 77 files sat behind 65,757 — sanity read `queued` for the length of linux, and the
        // wait was being charged to the wrong project entirely.
        //
        // Two, and not one lane per project, because what the sequencing actually buys is
        // disk: a scan is already rayon-parallel across every core, and during the blame pass
        // its threads are blocked on `git blame` subprocesses rather than computing — so the
        // constraint was never CPU, and it is not memory either (measured at 0.36 GB with
        // linux a third of the way through). It is how many `git blame` processes are
        // competing for one disk. One big lane keeps that bounded; one small lane empties in
        // seconds and rejoins.
        // **A repo of unknown size is MEASURED before it is laned, not guessed at.**
        // `files: None` used to mean small, on the sound argument that somebody who has just
        // added a repo is watching it and must not wait behind an hour of linux. What that
        // did not cover is the unknown repo that turns out to be enormous: ladybird arrived
        // with no recorded size, took the small lane, and held it at 7,646 files while five
        // repos of a few hundred each waited behind the very lane that exists to protect
        // them. Its size was written during that scan, so the misfiling corrected itself on
        // the next launch and looked like a one-off — it is not, it is every repo's first
        // launch after being added.
        //
        // The walk is what the scan does first anyway, and it is the cheapest thing in the
        // scan: 0.01s on a 344-file repo, a couple of seconds on the kernel. Paying it here,
        // once, only for repos nobody has a number for, buys a lane assignment that is a
        // measurement instead of a hope.
        let sized: Vec<(crate::reports::KnownProject, usize)> = queue
            .into_iter()
            .map(|k| {
                let n = match k.files {
                    Some(n) => n,
                    None => {
                        let n = crate::scan::collect_files(&PathBuf::from(&k.repo)).len();
                        // Banked immediately: a launch that is quit before this repo's scan
                        // reaches its first counted tick would otherwise arrive at the next
                        // launch just as unknown, and lane just as badly.
                        crate::reports::note_size(&k.key, n);
                        n
                    }
                };
                (k, n)
            })
            .collect();
        let (big, small): (Vec<_>, Vec<_>) =
            sized.into_iter().partition(|(_, n)| *n > BIG_REPO_FILES);
        let (big, small): (Vec<_>, Vec<_>) = (
            big.into_iter().map(|(k, _)| k).collect(),
            small.into_iter().map(|(k, _)| k).collect(),
        );
        let lanes: Vec<_> = [big, small]
            .into_iter()
            .filter(|lane| !lane.is_empty())
            .map(|lane| {
                let state = state.clone();
                let on_shape = on_shape.clone();
                let on_tick = on_tick.clone();
                let active = index.active.clone();
                std::thread::spawn(move || drain(lane, &state, &*on_shape, &*on_tick, active))
            })
            .collect();
        // Both, before the tail below: it decides which project the window lands on and
        // writes the index, and either answer is a truncation of itself if the other lane is
        // still producing projects. A joined thread that panicked is not worth propagating —
        // the other lane's work is still good, and the fallback picks from what did arrive.
        for lane in lanes {
            let _ = lane.join();
        }

        let mut s = lock(&state);
        // Fall back to the most recently touched thing that did come back. Landing on the
        // wrong project is recoverable with a click; landing on nothing looks like the
        // restore failed.
        if s.active.as_ref().is_none_or(|k| !s.projects.contains_key(k)) {
            s.active = s.projects.iter().max_by_key(|(_, p)| p.touched).map(|(key, _)| key.clone());
        }
        // One write, now that the list is whole and cannot be a truncation of itself.
        s.persist();
    });
}

/// What a project's history has cost so far, and what the rest would cost.
///
/// **A depth is a property of the map, not a preference**, so it travels with the project and
/// is reported wherever coverage is — see `trace::Depth`. `pending` is the estimate a person
/// is shown when the next depth is over budget: present means "waiting to be asked", which is
/// a third state beside traced and untraceable and must never render as either.
#[derive(Clone, Debug, Default)]
pub struct TraceState {
    pub depth: crate::trace::Depth,
    pub pending: Option<crate::trace::Estimate>,
    /// How many of this repo's files have per-line blame, out of how many there are.
    ///
    /// **A fraction, because depth 2 genuinely is one.** Blame is a process per file and stops
    /// per file, so a repo two thirds of the way through is two thirds resolved — and this
    /// used to be rounded back down to `Files` on the argument that the map must not claim a
    /// resolution it only has in places. A fraction does not CLAIM, it states; rounding it
    /// away was the dishonest move, and it made a stopped pass look like work that never
    /// happened. Zero of zero for an untraced repo.
    pub resolved: (usize, usize),
    /// Where a running trace has got to, reported by the thread doing it.
    ///
    /// **From the backend and not from the window**, for the reason the replay's own progress
    /// already is: a reload would otherwise lose sight of a walk that is still running, and
    /// the row would offer to start a second one.
    pub running: Option<crate::scan::Progress>,
    /// Set to stop the running trace. Per project, because two repos can be traced at once
    /// and one flag would stop the wrong one.
    pub stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
}

/// Read as much of `repo`'s history as fits the budget, and say what is left.
///
/// The one place the gate is applied to work nobody asked for — a launch restoring projects,
/// and a watcher noticing a repo moved. An explicit open, a CLI verb or the window's own Trace
/// button all go through [`deepen_project`] instead, which does what it was told.
/// May a launch's own trace outcome be banked over what the index already records?
///
/// **Only if it does not go backwards, and that is the whole rule.** `trace_within_budget`
/// returns `Files` — or `Untraced` — whenever it declines to restore a deeper trace: the log
/// walk at launch came back empty, `relines` priced the remaining blame over budget, or the
/// repo is big enough that `go` asks before spending a minute of somebody's machine. All three
/// are decisions about THIS LAUNCH's budget. None of them is a statement that the per-line pass
/// somebody sat and waited for did not happen.
///
/// Banked anyway, they erased it, and the erasure is what made the bug permanent rather than
/// annoying: the next launch reads `files`, so it does not even attempt the restore, so it
/// banks `files` again. One declined launch and a repo offers `304 files to blame` forever,
/// however many times the button is pressed — with the blame still sitting in the cache,
/// answered and unread.
///
/// The `/trace` handler is deliberately NOT held to this. There, a shallower depth is what a
/// person asked for or where their stop landed, and recording it is the point.
fn banks_over(reached: crate::trace::Depth, banked: Option<&str>) -> bool {
    reached.rank() >= crate::trace::Depth::from_tag(banked.unwrap_or("")).rank()
}

fn trace_within_budget(
    repo: &Path,
    scan: &mut Scan,
    scans: &crate::scancache::ScanCache,
    banked: Option<&str>,
    on_progress: &(dyn Fn(crate::scan::Progress) + Sync),
) -> TraceState {
    match crate::trace::go(repo) {
        crate::trace::Go::Run(mut depth) => {
            on_progress(crate::scan::Progress::phase("reading the commit log"));
            // **What this repo was traced to last time, if it can be had for nothing.** A
            // restart used to drop a repo back to file resolution and ask for the per-line pass
            // again — work somebody had already bought. Blame is cached per file, so an
            // unchanged repo already holds every answer; `relines` prices the remainder and
            // says no where the cache cannot serve it, which keeps a dropped cache from
            // spending minutes at launch on work nobody re-requested.
            let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            if matches!(banked, Some("lines") | Some("edits"))
                && crate::trace::depth1(repo, &stop, &|_| {})
                    .is_some_and(|h| crate::trace::relines(scan, scans, &h))
            {
                depth = crate::trace::Depth::Lines;
                // **And the deepest rung, on the same rule: restored only if it is already
                // counted.** The edits store is keyed on HEAD, so an unchanged repo answers in
                // milliseconds — 45ms measured on godot against a 17s walk — and a repo whose
                // HEAD has moved prices as a walk, which is a decision for the person at the
                // window rather than something a launch does on their behalf. `estimate`
                // reports zero for exactly the first case.
                //
                // Without this, restarting dropped a repo out of `Depth::Edits` and the Churn
                // lens locked itself again on a repo somebody had already traced — the same
                // shape of loss `relines` exists to prevent one rung up, and it shipped for
                // the same reason: the list of depths that can be restored was written when
                // there were only three.
                if banked == Some("edits") && crate::edits::estimate(repo).0 <= 0.0 {
                    depth = crate::trace::Depth::Edits;
                }
            }
            let (reached, resolved) = {
                let (reached, done, considered) =
                    crate::trace::deepen(
                        repo,
                        scan,
                        depth,
                        scans,
                        &stop,
                        &|progress| on_progress(progress),
                        // The restore lane holds no project to publish INTO — it is building
                        // the tree that becomes one. Its caller lands the finished scan.
                        &|_| {},
                    );
                (reached, (done, considered))
            };
            // **Banked, so the next launch draws what this just paid for.** The stored map
            // comes from `scan()`, which runs before this and therefore stores an untraced
            // tree; without this the log walk is re-derived every launch and, worse, the map
            // drawn from cache in the meantime has no git in it at all. See `treecache::redraw`.
            if reached != crate::trace::Depth::Untraced {
                crate::treecache::redraw(repo, scan);
            }
            TraceState { depth: reached, resolved, pending: None, running: None, stop }
        }
        // Nothing is hidden by declining: the map is drawn, the row says what history would
        // cost, and the button is right there. What must not happen is a launch quietly
        // spending a minute of somebody's machine on linux's log.
        crate::trace::Go::Ask(estimate) => TraceState {
            depth: crate::trace::Depth::Untraced,
            pending: Some(estimate),
            ..Default::default()
        },
    }
}

/// Bind loopback and serve. Returns the port.
///
/// 127.0.0.1 only, and port 0 so the OS picks a free one. This exposes a read-mostly view
/// of a scan the user already opened, but it is still an open socket on their machine and
/// it has no business being reachable from anywhere else.
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
                &crate::surprise::HeuristicModel,
                &|_| {},
                &|_, _: &crate::surprise::Reading| {},
                &|_| {},
                &std::sync::atomic::AtomicBool::new(false),
                crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
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
        let Ok(Ok((scan, trace))) = scanned else {
            // A repo that has been deleted or moved out from under us fails here every tick.
            // The marks are left alone deliberately: retrying is what recovers a `git
            // checkout` caught mid-write, and there is nothing to report to anyone about a
            // walk that failed on a directory the user is in the middle of changing.
            continue;
        };
        // Reloaded against the fresh tree, exactly as `open_project` does and for the same
        // reason: in-memory reports are keyed by node id, ids carry `@line`, and carrying them
        // across a rescan would orphan every reading in a file where anything moved.
        let reports = load_reports(&repo, &scan);
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
pub(crate) mod tests {

    /// A launch that could not afford to restore must not erase the trace it could not afford.
    ///
    /// **The bug this pins was permanent, which is what made it worth a test.** Trace a repo to
    /// `lines`, quit, reopen; if that launch declined the restore for any reason — an empty log
    /// walk, blame priced over budget, a repo big enough to ask first — the outcome was banked
    /// over the record, so every launch after it read `files` and never tried again. The row
    /// offered `304 files to blame` forever, with the blame sitting in the cache, answered.
    #[test]
    fn a_declined_restore_does_not_forget_what_was_paid_for() {
        use crate::trace::Depth;
        // The failing shape, in both directions it can arrive: nothing walked, or the log
        // walked and the blame declined.
        assert!(!banks_over(Depth::Untraced, Some("lines")));
        assert!(!banks_over(Depth::Files, Some("lines")));
        assert!(!banks_over(Depth::Lines, Some("edits")));
        // A restore that got there, or got FURTHER, is worth writing down.
        assert!(banks_over(Depth::Lines, Some("lines")));
        assert!(banks_over(Depth::Edits, Some("lines")));
        // A repo nobody has traced has nothing to protect, so anything lands — including the
        // untraced answer itself, which is what a first launch of a big repo records.
        assert!(banks_over(Depth::Untraced, None));
        assert!(banks_over(Depth::Files, None));
        // A tag from a later build reads as untraced, so this build's own answer stands rather
        // than being refused by a rung it cannot name.
        assert!(banks_over(Depth::Files, Some("some-later-rung")));
    }
    use super::*;

    fn task(path: &str, name: &str) -> Task {
        Task {
            id: format!("{path}#{name}"),
            path: path.to_string(),
            line: 1,
            end_line: 10,
            name: name.to_string(),
            owner: None,
            signature: String::new(),
            peers: Vec::new(),
            peers_omitted: 0,
            docs: Vec::new(),
            file_doc: String::new(),
            lines: 10,
            file: false,
            ask: String::new(),
        }
    }

    fn project_of(dir: &std::path::Path) -> Project {
        let scan = crate::scan::scan(
            dir,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos {
                scores: &crate::cache::Cache::ephemeral(),
                scans: &crate::scancache::ScanCache::ephemeral(),
            },
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Lines,
        )
        .unwrap();
        let marks = stamp_marks(dir, &scan);
        Project {
            reads: 0,
            findings: None,
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

    /// A shim serving a different contract is told so; a matching one is not.
    ///
    /// The bug this guards produced no error anywhere. A shim left running across a rebuild
    /// kept serving a schema without `legible` or `trap`; the readers omitted what they were
    /// never offered; the store recorded the absence as "no opinion", which is a real value;
    /// and eighty readings landed before an aggregate of zeroes gave it away. Silence on the
    /// happy path is part of the contract too — a warning that is always present is one an
    /// orchestrator stops reading.
    /// An answer that stopped answering today's question goes back in the queue, LAST.
    ///
    /// Without this a bump was an expiry nobody could work off: the reading still described
    /// the body, so `collect_tasks` returned early and the grey stayed until somebody
    /// happened to edit that function. The order matters as much as the fact — a stale
    /// reading describes code that is gone and an unread function has nothing at all, so
    /// both outrank a good reading with one answer greyed.
    #[test]
    fn a_superseded_answer_is_re_offered_after_everything_else() {
        let mut file = crate::model::Node::dir("src/a.rs", "a.rs");
        file.kind = NodeKind::File;
        file.path = "src/a.rs".into();
        let mut root = crate::model::Node::dir("", "");
        let mut done: HashMap<String, Report> = HashMap::new();
        for (i, name) in ["stale_one", "unread_one", "dated_one", "current_one"].iter().enumerate()
        {
            let mut n = crate::model::Node::dir("src/a.rs", name);
            n.kind = NodeKind::Func;
            n.id = format!("src/a.rs#{name}");
            n.path = "src/a.rs".into();
            n.line = Some(i as u32 * 10);
            n.body = Some(crate::assessment::body_hash(name));
            let mut r = Report::blank();
            r.id = n.id.clone();
            r.body = n.body.clone().unwrap_or_default();
            r.spec = crate::assessment::SPEC;
            match *name {
                // Its body moved under it.
                "stale_one" => r.body = crate::assessment::body_hash("something else entirely"),
                // A trap flagged under the question spec 3 narrowed.
                "dated_one" => {
                    r.trap = true;
                    r.note = "the bite".into();
                    r.spec = crate::assessment::TRAP_SINCE - 1;
                }
                _ => {}
            }
            if *name != "unread_one" {
                done.insert(n.id.clone(), r);
            }
            file.children.push(n);
        }
        root.children.push(file);
        let mut out = Vec::new();
        collect_tasks(&root, &done, &HashMap::new(), None, &mut out);
        out.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        // The file's own header reading is in here too and is not what this is about.
        let order: Vec<&str> =
            out.iter().filter(|(_, t)| !t.file).map(|(_, t)| t.name.as_str()).collect();
        assert_eq!(
            order,
            vec!["stale_one", "unread_one", "dated_one"],
            "worst first, and a reading that is current on every axis is not offered at all"
        );
    }

    /// A trap arrives with its sentence or it does not arrive.
    ///
    /// The boolean is not the finding. Reading back 894 readings in this repo, two functions
    /// were flagged `trap: true` with no note at all — a warning on a wedge that, opened,
    /// says nothing anybody can act on. The refusal is deliberate over the alternative of
    /// quietly storing `trap: false`: that would discard a reader's actual judgement to keep
    /// the store tidy, and the reader is the one party that knows what it meant.
    #[test]
    fn a_trap_must_say_what_it_is() {
        let mut r = Report { trap: true, ..Report::blank() };
        assert!(trap_without_note(&r), "a bare trap is not a finding");
        r.note = "   ".into();
        assert!(trap_without_note(&r), "and whitespace is not a sentence");
        r.note = "Reordering the log walk breaks the age stamp.".into();
        assert!(!trap_without_note(&r), "with the bite named, it stands");
        let clear = Report { trap: false, ..Report::blank() };
        assert!(!trap_without_note(&clear), "no trap, nothing to say");
    }

    #[test]
    fn a_shim_serving_a_stale_contract_is_told_to_restart() {
        let mine = crate::mcp::contract_fingerprint();
        assert!(contract_note(Some(&mine)).is_none(), "a matching contract must say nothing");

        let stale = contract_note(Some("0000000000000000")).expect("a mismatch must be reported");
        assert!(
            stale.to_lowercase().contains("restart"),
            "the warning has to say what to do: {stale}"
        );

        // A shim too old to send one at all is the same hazard wearing a different face.
        assert!(contract_note(None).is_some(), "a caller that cannot say must still be warned");
    }

    /// An edit made BEFORE the first handout still has to be re-cut.
    ///
    /// The sibling test above edits after calling `resync_changed` once, which is the case
    /// that always worked — and that gap is why this shipped. `file_marks` was populated
    /// lazily by `resync_changed` itself, and its "has this moved" test is
    /// `HashMap::insert(..).is_some_and(|was| was != now)`: `insert` returns `None` for a
    /// key it has never held, so the FIRST sighting of any file recorded whatever the file
    /// looked like at that moment and reported no movement. A file edited between the scan
    /// and the first `sanity_next` therefore had its post-edit mark stored against pre-edit
    /// positions, and could never be seen to move again.
    ///
    /// Three readers in one wave hit it on the same file: two were handed ranges eight
    /// lines short, and one was given a function's doc comment where its body should have
    /// been. Marks are stamped at the scan now, so the first look has something true to
    /// compare against.
    #[test]
    fn a_file_edited_before_the_first_handout_is_still_re_cut() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(
            &path,
            "fn first() {}
fn second() { println!(\"2\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        // The edit lands before anything is handed out — no `resync_changed` has run.
        std::fs::write(
            &path,
            "// one\n// two\n// three\nfn first() {}\nfn second() { println!(\"2\"); }\n",
        )
        .unwrap();

        assert_eq!(
            resync_changed(&mut p),
            1,
            "the file moved before the first look and was not re-cut"
        );

        let mut line = None;
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func && n.name == "second" {
                line = n.line;
            }
        });
        assert_eq!(line, Some(5), "re-cut did not move `second` to its new line");
    }

    /// Clicking a queued project moves it to the front of the restore.
    ///
    /// The launch order — last session's active repo, then by recency — is the best guess
    /// available before the window exists, and it is wrong the moment somebody opens a small
    /// repo sitting behind a large one. linux is hours and sanity is seconds, so a person
    /// looking at sanity was told `queued` for the length of linux.
    #[test]
    fn the_project_somebody_asked_for_is_scanned_next() {
        let q = queued(&[("/linux", None), ("/sanity", None), ("/tally", None)]);

        let mut want = Some("/sanity".to_string());
        assert_eq!(claim_next(&mut want, &q), 1, "the one asked for goes next");
        assert_eq!(want, None, "and the request is spent");

        let mut none = None;
        assert_eq!(claim_next(&mut none, &q), 0, "nobody asked: the running order stands");

        // In the other lane, already scanned, or the one in flight — either way it is not in
        // what is LEFT here, and that is ordinary rather than an error.
        let mut elsewhere = Some("/gone".to_string());
        assert_eq!(claim_next(&mut elsewhere, &q), 0, "a stale request does not stall the lane");
        assert_eq!(
            elsewhere.as_deref(),
            Some("/gone"),
            "and it is NOT consumed — the other lane still has to see it, or a click on a big \
             repo would be swallowed by the small lane and do nothing at all"
        );
    }

    /// A small repo gets its own lane rather than queueing behind a large one.
    ///
    /// 77 files sat behind 65,757: sanity read `queued` for the length of linux, which is the
    /// wait being charged to the wrong project. The size comes from the last scan, so a repo
    /// nobody has scanned here yet is unknown — and unknown goes in the small lane, because a
    /// repo somebody just added is one they are watching.
    #[test]
    fn a_big_repo_scans_in_its_own_lane() {
        let all = queued(&[
            ("/linux", Some(65_757)),
            ("/sanity", Some(77)),
            ("/fresh", None),
            ("/ceph", Some(120_000)),
        ]);
        let (big, small): (Vec<_>, Vec<_>) =
            all.into_iter().partition(|k| k.files.is_some_and(|n| n > BIG_REPO_FILES));

        let keys = |v: &[crate::reports::KnownProject]| {
            v.iter().map(|k| k.key.clone()).collect::<Vec<_>>()
        };
        assert_eq!(keys(&big), ["/linux", "/ceph"]);
        assert_eq!(keys(&small), ["/sanity", "/fresh"], "never scanned counts as small");
    }

    fn queued(of: &[(&str, Option<usize>)]) -> Vec<crate::reports::KnownProject> {
        of.iter()
            .map(|(k, files)| crate::reports::KnownProject {
                key: (*k).into(),
                repo: (*k).into(),
                name: (*k).into(),
                touched: 0,
                files: *files,
                scan_ms: None,
                trace_depth: None,
                harness: None,
                model: None,
            })
            .collect()
    }

    /// A project added but never scanned still survives a quit.
    ///
    /// It reached the index only through `touch`, which runs when the scan RETURNS — right
    /// for a repo scanned in a second, and a loss for one that is not. linux takes hours on
    /// its first pass, so every quit before it finished dropped the project outright: the row
    /// vanished, and it had to be added again, to scan again from the beginning. The
    /// leftovers name the shape of it — `active` and `order` still pointed at a repo that
    /// `projects` no longer listed, because those two are written from the session while the
    /// list was written from what had loaded.
    #[test]
    fn a_project_added_but_not_yet_scanned_is_in_the_index() {
        let _data = data_home();
        crate::reports::remember("/big", "/big", "big");
        let saved = crate::reports::load_index();
        assert_eq!(saved.projects.len(), 1, "an added project is on disk before its scan lands");
        assert_eq!(saved.projects[0].key, "/big");

        // Re-adding must not reset what somebody configured for it: `remember` runs on every
        // add, and an add of a project that is already there is the normal case.
        crate::reports::set_reader("/big", "/big", "big", Some("agy"), Some("sonnet"));
        crate::reports::remember("/big", "/big", "big");
        let again = crate::reports::load_index();
        assert_eq!(again.projects.len(), 1, "the same project is not doubled");
        assert_eq!(again.projects[0].harness.as_deref(), Some("agy"), "the harness survived");
        assert_eq!(again.projects[0].model.as_deref(), Some("sonnet"), "the model survived");
    }

    /// One project is one row, whichever lists it is on.
    ///
    /// **The sidebar is fed by three of them** — loaded, declined for cost, and pending a scan
    /// — and any two naming the same key put that repo on screen twice under one name. It
    /// happened the moment the third was added: pressing `Scan` on a repo whose scan was over
    /// budget starts a pending scan without clearing the declined entry, so kibana appeared
    /// beside itself.
    #[test]
    fn a_project_on_two_lists_is_still_one_row() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
        let known = crate::reports::KnownProject {
            key: key.clone(),
            repo: dir.path().to_string_lossy().to_string(),
            name: "t".into(),
            touched: 0,
            files: None,
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        };

        // **In the index, or the declined row cannot exist.** It is built from the name and
        // path on disk — a repo the index has never heard of has no row to draw — so a test
        // that skips this asserts against a list the bug cannot reach, and passes whether the
        // guard is there or not. It did.
        crate::reports::remember(&key, &known.repo, "t");

        let mut state = AppState::default();
        state.awaiting.insert(key.clone(), crate::scan::estimate(Some(90_000), Some(90_000)));
        state.restoring.push(known.clone());
        assert_eq!(
            ProjectList::from_state(&state).projects.iter().filter(|p| p.key == key).count(),
            1,
            "declined and pending is one repo in two states, not two repos"
        );

        // And once it has actually loaded, neither of the other two may add a second.
        state.projects.insert(key.clone(), project_of(dir.path()));
        assert_eq!(
            ProjectList::from_state(&state).projects.iter().filter(|p| p.key == key).count(),
            1,
            "a loaded project is listed once however it got there"
        );
    }

    /// **Remove takes the caches with the row, and it used to leave them.**
    ///
    /// Nothing points at a removed project: it is out of the index, so no launch restores it
    /// and no sweep knows what its files were for. They sat under Application Support until
    /// `sweep_slots` aged them out thirty days later — a repo taken out of the sidebar still
    /// costing what it cost while it was in it. It also crossed the two verbs against their
    /// own names, Reset deleting the data and keeping the row while Remove did the opposite.
    ///
    /// Asserted on a slot per KIND, because the deletion walks a directory apiece and a test
    /// that writes one file proves only that the first one is walked.
    #[test]
    fn removing_a_project_takes_what_was_derived_from_it() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
        crate::reports::remember(&key, &dir.path().to_string_lossy(), "t");

        // One cache slot per kind, as a scan and a trace of this repo would have left.
        let slots: Vec<std::path::PathBuf> = ["trees", "scans", "traces", "timelines", "edits"]
            .iter()
            .map(|kind| {
                let at = crate::reports::cache_slot(kind, dir.path(), "p1").expect("a slot");
                std::fs::write(&at, b"derived").expect("writes");
                at
            })
            .collect();
        // And one belonging to another repo, which must survive: the deletion is by this
        // repo's hash, and a sweep of the whole directory would take the neighbour too.
        let other = tempfile::tempdir().unwrap();
        let spared = crate::reports::cache_slot("trees", other.path(), "p1").expect("a slot");
        std::fs::write(&spared, b"someone else's").expect("writes");

        let mut state = AppState::default();
        state.projects.insert(key.clone(), project_of(dir.path()));
        state.forget(&key);

        assert!(
            ProjectList::from_state(&state).projects.is_empty(),
            "Remove takes the row — that half always worked"
        );
        for at in &slots {
            assert!(!at.exists(), "{} outlived the project it was derived from", at.display());
        }
        assert!(spared.exists(), "another repo's cache was taken along with this one's");
        // The repo itself is not this app's to delete, and neither is anything in it.
        assert!(dir.path().join("a.rs").exists(), "the repo is not ours to touch");
    }

    /// **Reset is not Remove, and the difference is one row on screen.**
    ///
    /// Reset deletes every cache this app derived for a repo and calls `unload`, which drops
    /// the live project and leaves the index entry alone — its own doc says the row has to
    /// stay, because the point of a reset is to do the work again. The row went anyway: the
    /// list was built from live state alone, so a project the app was not holding was a
    /// project nobody listed, and the menu item read as a gentler-sounding Remove.
    ///
    /// Asserted on the state `reset_project` leaves behind rather than by calling it, which
    /// wants a Tauri handle: the caches are gone, the index entry stands, nothing is loaded.
    #[test]
    fn a_reset_leaves_a_row_to_scan_again() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
        crate::reports::remember(&key, &dir.path().to_string_lossy(), "t");

        let mut state = AppState::default();
        state.projects.insert(key.clone(), project_of(dir.path()));
        state.active = Some(key.clone());
        assert_eq!(ProjectList::from_state(&state).projects.len(), 1, "loaded, and listed");

        state.unload(&key);
        let after = ProjectList::from_state(&state);
        assert_eq!(after.projects.len(), 1, "the row a reset is supposed to leave behind");
        let row = &after.projects[0];
        assert_eq!(row.key, key);
        assert_eq!(row.name, "t", "named from the index, which is what still knows it");
        // Not pending anything. A reset is a standing state — nothing is happening until
        // somebody presses Scan — and a row that says `loading` with nothing loading is the
        // failure that flag exists to prevent.
        assert!(!row.loading, "nothing is running, so nothing may claim to be");
        assert_eq!(row.functions, 0, "and it counts nothing, because it has walked nothing");
        assert_eq!(row.trace_depth, crate::trace::Depth::Untraced);
    }

    /// A touch of ANY project must not erase what only the index knows about another.
    ///
    /// **This is the trap the `harness` comment in `persist` describes, sprung again.** That
    /// record holds several things memory does not: which agent reads a repo, what its last
    /// scan cost, how deep it has been traced. `persist` rebuilds an entry per live project on
    /// every touch — and a field added to the struct and filled with `None` there erases the
    /// banked value the next time anybody so much as selects a row.
    ///
    /// It cost exactly that: trace a repo, restart, see it come back traced; trace a SECOND
    /// repo, restart, and both are untraced, because touching the second one rewrote the first
    /// one's record on the way past. A comment did not stop it, so this does — every field the
    /// index owns is asserted here, and adding one to `KnownProject` without carrying it
    /// through `persist` fails this test rather than a user's map.
    #[test]
    fn a_touch_cannot_erase_what_only_the_index_knows() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());

        let state: Shared = Default::default();
        {
            let mut s = lock(&state);
            s.projects.insert(key.clone(), project_of(dir.path()));
        }
        // Everything written to the index by a path that is not `persist`.
        crate::reports::remember(&key, &dir.path().to_string_lossy(), "t");
        crate::reports::set_reader(&key, &dir.path().to_string_lossy(), "t", Some("agy"), Some("sonnet"));
        crate::reports::note_scan(&key, 41, 1234);
        crate::reports::note_trace(&key, "lines");

        // A touch of this project, and of another — the second is what actually bit, because
        // `persist` rewrites every live entry rather than the one that moved.
        lock(&state).touch(&key);
        lock(&state).touch("/somewhere/else");

        let index = crate::reports::load_index();
        let banked = index.projects.iter().find(|k| k.key == key).expect("still listed");
        assert_eq!(banked.trace_depth.as_deref(), Some("lines"), "the traced depth survived");
        assert_eq!(banked.scan_ms, Some(1234), "what the last scan cost survived");
        assert_eq!(banked.harness.as_deref(), Some("agy"), "the harness survived");
        assert_eq!(banked.model.as_deref(), Some("sonnet"), "the model survived");
    }

    /// A save from a half-restored session must not erase the projects it has not got to.
    ///
    /// This is the bug that emptied a real index down to one entry. `restore` rescans on a
    /// background thread and a large repo takes seconds; a `sanity_open` arriving inside
    /// that window inserts one project and touches it, and a persist that wrote the live
    /// map as the whole truth published "there is one project" — erasing the rest from the
    /// only record that they existed. The map is authoritative for what it holds and says
    /// nothing about what it does not.
    #[test]
    fn a_save_mid_restore_does_not_erase_projects_it_has_not_loaded() {
        let _data = data_home();

        crate::reports::save_index(&crate::reports::KnownProjects {
            active: Some("/a".into()),
            explain_trace: None,
            // `..Default::default()` for the rest: a test about restoring two projects has
            // no opinion about the sidebar's arrangement, and spelling every field out makes
            // adding one a change to every test that ever built this.
            order: Vec::new(),
            projects: vec![
                crate::reports::KnownProject {
                    key: "/a".into(),
                    repo: "/a".into(),
                    name: "a".into(),
                    touched: 7,
                    files: None,
                    scan_ms: None,
                    trace_depth: None,
                    harness: None,
                    model: None,
                },
                crate::reports::KnownProject {
                    key: "/b".into(),
                    repo: "/b".into(),
                    name: "b".into(),
                    touched: 4,
                    files: None,
                    scan_ms: None,
                    trace_depth: None,
                    harness: None,
                    model: None,
                },
            ],
        });

        // A session that has restored only `/b` so far saves.
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("x.rs"), "fn one() { }\n").unwrap();
        let mut state = AppState::default();
        let mut p = project_of(dir.path());
        p.name = "b".into();
        p.repo = PathBuf::from("/b");
        p.touched = 9;
        state.projects.insert("/b".into(), p);
        state.active = Some("/b".into());
        state.persist();

        let back = crate::reports::load_index();
        let keys: Vec<&str> = back.projects.iter().map(|p| p.key.as_str()).collect();
        assert!(
            keys.contains(&"/a"),
            "the project this session had not loaded was erased: {keys:?}"
        );
        assert_eq!(keys.len(), 2, "and nothing was duplicated: {keys:?}");
        // The loaded one is updated in place, not doubled, and this session's active wins.
        let b = back.projects.iter().find(|p| p.key == "/b").unwrap();
        assert_eq!(b.touched, 9);
        assert_eq!(back.active.as_deref(), Some("/b"));
    }

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

    /// `outstanding` has to itemise exactly what `in_flight` counts, and a lease only
    /// explains work that is still outstanding.
    ///
    /// The failure this guards is the one `work_left` was written for, one level down: a
    /// lease left behind over a function whose reading has since landed would inflate
    /// `in_flight`, and an orchestrator reading `remaining == in_flight` waits instead of
    /// spawning the wave that would finish the repo. Coverage numbers must never be
    /// derived from the lease table.
    #[test]
    fn outstanding_itemises_only_live_leases_on_unread_work() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.rs"),
            "fn one() { println!(\"1\"); }\nfn two() { println!(\"2\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let ids: Vec<String> = {
            let mut out = Vec::new();
            collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, &mut out);
            // Functions only. The file itself is queued too — see `Task::file` — and this
            // test is about what a lease does to unread work, not about which kinds exist.
            out.into_iter().filter(|(_, t)| !t.file).map(|(_, t)| t.id).collect()
        };
        assert_eq!(ids.len(), 2, "fixture should offer two functions");

        // Nothing out: no leases, nothing itemised.
        assert_eq!(work_left(&p).in_flight, 0);
        assert!(work_left(&p).outstanding.is_empty());

        // One out with a reader: counted, itemised, and by its id.
        p.leased.insert(ids[0].clone(), Instant::now());
        let w = work_left(&p);
        assert_eq!(
            w.remaining, 3,
            "a lease is not a reading; remaining holds (two functions and their file)"
        );
        assert_eq!(w.in_flight, 1);
        assert_eq!(w.outstanding.len(), w.in_flight);
        assert_eq!(w.outstanding[0].0, ids[0]);

        // A lease left over a function that has since been read explains nothing. It must
        // drop out of both numbers rather than keep claiming a reader is busy on it.
        p.reports.insert(ids[0].clone(), Report { id: ids[0].clone(), ..Report::blank() });
        p.reads = p.reads.wrapping_add(1);
        let w = work_left(&p);
        assert_eq!(w.remaining, 2, "one function read; its twin and their file are left");
        assert_eq!(w.in_flight, 0, "the reading landed; the stale lease is moot");
        assert!(w.outstanding.is_empty());
    }

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

    /// The summary is the orchestrator's only honest account of its own run, so what it
    /// leaves out matters as much as what it counts.
    ///
    /// Two exclusions, both of which were bugs elsewhere first. A stale reading is history
    /// and must not be averaged in as coverage — the same rule `assessed` and
    /// `collect_tasks` follow. And a reading with no recorded position must not be counted
    /// as a first reading: an unknown position is not a claim of freshness, and treating
    /// it as one would make a batched run — the thing this field exists to expose — look
    /// uniform.
    #[test]
    fn the_summary_counts_neither_stale_readings_nor_unknown_positions_as_good_news() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.rs"),
            "fn one() { println!(\"1\"); }\nfn two() { println!(\"2\"); }\nfn three() { println!(\"3\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let mut ids = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                ids.push((n.id.clone(), n.body.clone().unwrap_or_default()));
            }
        });
        assert_eq!(ids.len(), 3);

        fn reading(id: &str, body: &str, position: Option<u32>, model: &str) -> Report {
            Report {
                id: id.to_string(),
                predicted: Some(Grade::Full),
                body: body.to_string(),
                position,
                model: model.to_string(),
                ..Report::blank()
            }
        }
        let mut bank = |r: Report| {
            p.reports.insert(r.id.clone(), r);
        p.reads = p.reads.wrapping_add(1);
            p.reads = p.reads.wrapping_add(1);
        };
        bank(reading(&ids[0].0, &ids[0].1, Some(1), "haiku"));
        bank(reading(&ids[1].0, &ids[1].1, Some(7), "sonnet"));
        // Read against a body that is no longer there.
        bank(reading(&ids[2].0, "a hash from another era", Some(1), "sonnet"));

        let agg = aggregate(&p);
        assert_eq!(agg.stale, 1);
        assert_eq!(agg.total.readings, 2, "the stale reading is not coverage");
        assert_eq!(agg.total.predicted.full, 2);
        assert_eq!(agg.by_model.len(), 2);
        assert_eq!(agg.by_model["sonnet"].readings, 1, "and not in its model's tally either");

        // One bucket per position, so a curve can be read off any run at any batch size —
        // "first vs later" could not tell a flat line from an effect that starts at six.
        assert_eq!(agg.by_position.positions[&1].full, 1);
        assert_eq!(agg.by_position.positions[&7].full, 1, "position 7 is its own bucket");
        assert!(!agg.by_position.positions.contains_key(&2), "no bucket is invented");
        assert_eq!(agg.by_position.unrecorded, 0);

        // A reading from before the field existed lands in neither bucket.
        let r = reading(&ids[1].0, &ids[1].1, None, "sonnet");
        p.reports.insert(r.id.clone(), r);
        p.reads = p.reads.wrapping_add(1);
        let agg = aggregate(&p);
        assert_eq!(agg.by_position.unrecorded, 1);
        assert_eq!(agg.by_position.positions[&1].full, 1, "unknown is not position 1");
        assert!(!agg.by_position.positions.contains_key(&7), "nor is it its old bucket");
    }

    /// Same-named twins must arrive distinguishable, and both must appear in the peers.
    ///
    /// A reader handed `udf.rs#parse`, with `parse` also in its sibling list, cannot tell
    /// which of the file's dozen `parse`s it has. It predicts one, reads another, grades
    /// itself against the mismatch, and reports the docs as belonging to something else —
    /// a copy-paste bug in the repo that is not there. The old peers list made it worse by
    /// deduping bare names, so the twins collapsed into a single entry and the list
    /// concealed exactly what the reader needed.
    #[test]
    fn same_named_methods_arrive_with_the_type_they_hang_off() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("udf.rs"),
            "impl DescriptorTag {\n    fn parse(b: &[u8]) -> u8 { b[0] }\n}\n\
             impl LogicalVolumeDescriptor {\n    fn parse(b: &[u8]) -> u16 { 1 }\n}\n",
        )
        .unwrap();
        let p = project_of(dir.path());

        let mut out = Vec::new();
        collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, &mut out);
        let tasks: Vec<Task> = out.into_iter().map(|(_, t)| t).filter(|t| !t.file).collect();
        assert_eq!(tasks.len(), 2);

        let owners: Vec<Option<&str>> = tasks.iter().map(|t| t.owner.as_deref()).collect();
        assert!(
            owners.contains(&Some("DescriptorTag"))
                && owners.contains(&Some("LogicalVolumeDescriptor")),
            "each twin must say which type it belongs to: {owners:?}"
        );
        // Each sees the other, qualified — not a bare `parse`, and not nothing.
        for t in &tasks {
            assert_eq!(t.peers.len(), 1, "the twin must be visible: {:?}", t.peers);
            assert_eq!(t.peers_omitted, 0, "a two-function file fits in the window");
            assert!(t.peers[0].ends_with("::parse"), "unqualified peer: {:?}", t.peers);
            assert_ne!(
                t.peers[0],
                qualify(&t.name, t.owner.as_deref(), Some(Lang::Rust)),
                "a function must not be listed as its own peer"
            );
        }
    }

    /// `.sanityignore` narrows the queue and is COUNTED while it does it.
    ///
    /// The scoping half is easy and the counting half is the point. An exclusion that
    /// disappears from the totals lets a map claim completeness over a subset somebody
    /// chose months ago — the same failure as `done` counting leased work, or `assessed`
    /// counting readings whose code had moved.
    #[test]
    fn an_excluded_file_leaves_the_queue_and_stays_in_the_count() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("tests")).unwrap();
        std::fs::write(dir.path().join("keep.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        std::fs::write(
            dir.path().join("tests/drop.rs"),
            "fn two() { println!(\"2\"); }\nfn three() { println!(\"3\"); }\n",
        )
        .unwrap();

        // With no `.sanityignore`, everything is in scope. No defaults, ever — a shipped
        // default excluding tests would have deleted the best finding of a whole run.
        let p = project_of(dir.path());
        assert_eq!((count_funcs(&p.scan).kept, count_funcs(&p.scan).excluded), (3, 0));

        std::fs::write(dir.path().join(".sanityignore"), "tests/\n").unwrap();
        let p = project_of(dir.path());
        assert_eq!(
            (count_funcs(&p.scan).kept, count_funcs(&p.scan).excluded),
            (1, 2),
            "in scope and set aside are both reported, never one silently"
        );

        // The queue works from the narrowed set.
        let mut out = Vec::new();
        collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, &mut out);
        let names: Vec<String> =
            out.into_iter().filter(|(_, t)| !t.file).map(|(_, t)| t.name).collect();
        assert_eq!(names, vec!["one"], "excluded functions are never handed out");

        // And the shape a reader would use to propose one still shows both halves, or it
        // could not have proposed anything.
        let shape = shape_of(&p.scan);
        let tests = shape.iter().find(|r| r["dir"] == "tests").expect("tests/ in the shape");
        assert_eq!(tests["excluded"], 2);
        assert_eq!(tests["functions"], 0);
    }

    /// A reading for code that is gone must not count as coverage.
    ///
    /// `assessed` was `reports.len() - stale`, and `count_stale` walks the SCAN — so a
    /// reading whose function had been deleted was never stale, because nothing walked past
    /// it, and it stayed in the numerator forever. A repo that removed code could report
    /// more assessed than it has functions. Found by the disagreement it caused: `/status`
    /// said 241 where `sanity_summary` said 217.
    #[test]
    fn a_reading_for_a_deleted_function_is_not_coverage() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gate.rs");
        std::fs::write(&path, "fn open() { println!(\"1\"); }\nfn shut() { println!(\"2\"); }\n")
            .unwrap();
        let mut p = project_of(dir.path());

        // Both read, against their own bodies.
        let mut ids = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                ids.push((n.id.clone(), n.body.clone().unwrap_or_default()));
            }
        });
        assert_eq!(ids.len(), 2);
        for (id, body) in &ids {
            p.reports.insert(
                id.clone(),
                Report { id: id.clone(), body: body.clone(), ..Report::blank() },
            );
        }
        assert_eq!(assessed(&p), 2, "two live readings");

        // One function is deleted and the repo rescanned. Its reading is now about nothing.
        std::fs::write(&path, "fn open() { println!(\"1\"); }\n").unwrap();
        let rescanned = project_of(dir.path());
        p.scan = rescanned.scan;
        assert_eq!(assessed(&p), 1, "the survivor counts; the orphan is history, not coverage");
    }

    /// A file is handed out as its own reading, with the header and the whole list.
    ///
    /// Deleting one of two same-named functions must not silently move a reading onto the
    /// other one.
    ///
    /// `resync_file` matches old children to fresh definitions by (name, ordinal), and an
    /// ordinal is a position — so removing the FIRST of two `go`s makes the survivor's fresh
    /// ordinal 0, which is the deleted one's old slot. A reader flagged it as a trap. What
    /// saves it is the thing that saves every positional scheme here: a reading is checked
    /// against a BODY, so one that lands on the wrong twin is expired rather than believed,
    /// and expired work goes back to the front of the queue.
    ///
    /// The exception is two twins with identical bodies, where the transfer is undetectable
    /// and also harmless — the reading describes that text either way. That is the caveat
    /// `key_of` already carries about reordering, written down here where the mechanism can
    /// be seen.
    #[test]
    fn deleting_a_twin_expires_the_survivors_reading_rather_than_moving_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(
            &path,
            "impl A { fn go(&self) -> u8 { 1 } }\nimpl B { fn go(&self) -> u16 { 22222 } }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let mut ids = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                ids.push((n.id.clone(), n.body.clone().unwrap_or_default()));
            }
        });
        assert_eq!(ids.len(), 2, "twins are separate readings");
        for (id, body) in &ids {
            p.reports.insert(
                id.clone(),
                Report { id: id.clone(), body: body.clone(), ..Report::blank() },
            );
        }

        // The FIRST twin goes. The survivor slides into its ordinal.
        std::fs::write(&path, "impl B { fn go(&self) -> u16 { 22222 } }\n").unwrap();
        resync_changed(&mut p);

        let mut left = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                let stale = p
                    .reports
                    .get(&n.id)
                    .is_some_and(|r| crate::assessment::is_stale(r, n.body.as_deref(), n.bytes));
                left.push((n.id.clone(), stale));
            }
        });
        assert_eq!(left.len(), 1, "one function left");
        assert!(
            left[0].1,
            "the reading it inherited describes the other twin's body, so it is expired — \
             not silently believed"
        );
    }

    /// The header was collected and fed to every function reader as context, and judged by
    /// nobody — so a file with a careful banner over bare functions painted exactly like a
    /// file with no banner at all. This is the reading that closes that.
    #[test]
    fn a_file_is_queued_as_its_own_reading() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("gate.rs"),
            "//! The gate module.\n//! Opens and closes.\n\n             fn open() { println!(\"1\"); }\nfn shut() { println!(\"2\"); }\n",
        )
        .unwrap();
        let p = project_of(dir.path());

        let mut out = Vec::new();
        collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, &mut out);
        let file: Vec<&Task> = out.iter().map(|(_, t)| t).filter(|t| t.file).collect();
        assert_eq!(file.len(), 1, "one file, one file reading");
        let t = file[0];

        assert_eq!(t.id, "gate.rs", "keyed by path — a function id always holds a `#`");
        assert_eq!(t.docs, vec!["The gate module.\nOpens and closes."]);
        assert_eq!(t.peers, vec!["open", "shut"], "every declaration, not a window");
        assert_eq!(t.peers_omitted, 0);
        assert!(!t.ask.is_empty(), "a file task says how its question differs");
        // The functions still come through unchanged, and say nothing about being files.
        assert_eq!(out.iter().filter(|(_, t)| !t.file).count(), 2);
    }

    /// What expires a file reading, and what must not.
    ///
    /// A file reading answers "does this banner describe what is in here". Rewriting the
    /// banner or changing the declarations makes that a different question; rewriting a
    /// body does not, and expiring on it would put every file back in the queue on every
    /// commit — which teaches people to ignore the flag.
    #[test]
    fn a_file_reading_expires_on_its_header_and_its_surface() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gate.rs");
        let hash = |src: &str| {
            std::fs::write(&path, src).unwrap();
            let p = project_of(dir.path());
            let mut found = None;
            p.scan.root.visit(&mut |n| {
                if n.path == "gate.rs" && n.kind == crate::model::NodeKind::File {
                    found = n.body.clone();
                }
            });
            found.expect("a file carries the hash its reading is checked against")
        };

        let base = hash("//! The gate.\n\nfn open(a: u8) { println!(\"1\"); }\n");
        assert_ne!(
            base,
            hash("//! The valve.\n\nfn open(a: u8) { println!(\"1\"); }\n"),
            "a rewritten header is a different file to describe"
        );
        assert_ne!(
            base,
            hash("//! The gate.\n\nfn open(a: u16) { println!(\"1\"); }\n"),
            "a changed declaration is a different file to describe"
        );
        assert_ne!(
            base,
            hash("//! The gate.\n\nfn open(a: u8) { println!(\"1\"); }\nfn shut() {}\n"),
            "a new declaration is a different file to describe"
        );
        assert_eq!(
            base,
            hash("//! The gate.\n\nfn open(a: u8) { println!(\"changed\"); }\n"),
            "rewriting a body does not change what the header has to describe"
        );
    }

    /// A big file hands over its neighborhood, and says how much it left out.
    ///
    /// The whole-file list was 91% of tonepoet's median task payload, 30k characters at its
    /// p90. What a truncated list must never do is look complete.
    #[test]
    fn a_long_file_sends_the_neighborhood_and_counts_the_rest() {
        let names: Vec<String> = (0..100).map(|i| format!("fn_{i:02}")).collect();

        // Middle of the file: centered, and the remainder is stated rather than dropped.
        let (peers, omitted) = neighbors(&names, 50);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert_eq!(omitted, 99 - PEER_WINDOW);
        assert!(!peers.contains(&"fn_50".to_string()), "never its own peer");
        assert!(peers.contains(&"fn_49".to_string()) && peers.contains(&"fn_51".to_string()));

        // First in the file: the window slides rather than half-emptying.
        let (peers, omitted) = neighbors(&names, 0);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert_eq!(omitted, 99 - PEER_WINDOW);
        assert!(peers.contains(&"fn_01".to_string()));

        // Last, likewise.
        let (peers, _) = neighbors(&names, 99);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert!(peers.contains(&"fn_98".to_string()));

        // A file that fits is handed over whole, and says so with a zero.
        let small: Vec<String> = (0..5).map(|i| format!("f{i}")).collect();
        let (peers, omitted) = neighbors(&small, 2);
        assert_eq!(peers.len(), 4);
        assert_eq!(omitted, 0);
    }

    /// A range that has moved is corrected before it is handed to anyone.
    ///
    /// The scan is a photograph; `read_source` and every reader's bounded read go to the
    /// file as it is now. Edit anything and every function below the edit is described at
    /// the wrong lines — the code view highlights the wrong extent, and a reader predicts
    /// one function, reads whatever now occupies those lines, and grades the two against
    /// each other. A reader caught it from the far end: the range it was handed for
    /// `applyAgentReports` held unrelated constants, and it said so rather than grading
    /// them. Nothing else would have.
    #[test]
    fn a_file_that_moved_is_re_cut_before_anything_is_handed_out() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(
            &path,
            "fn first() { println!(\"1\"); }\nfn second() { println!(\"2\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let line_of = |p: &Project, name: &str| {
            let mut found = None;
            p.scan.root.visit(&mut |n| {
                if n.kind == NodeKind::Func && n.name == name {
                    found = n.line;
                }
            });
            found.expect(name)
        };
        assert_eq!(line_of(&p, "second"), 2);
        let before = {
            let mut h = None;
            p.scan.root.visit(&mut |n| {
                if n.name == "second" {
                    h = n.body.clone();
                }
            });
            h
        };

        // First look only records what the files are — the tree came straight from a scan.
        assert_eq!(resync_changed(&mut p), 0, "nothing has moved yet");

        // Three lines land above it, and `third` is written. This is the shape of every
        // edit made while an assessment is running.
        std::fs::write(
            &path,
            "// one\n// two\n// three\nfn first() { println!(\"1\"); }\nfn second() { println!(\"2\"); }\nfn third() {}\n",
        )
        .unwrap();

        assert_eq!(resync_changed(&mut p), 1, "the file moved and was re-cut");
        assert_eq!(line_of(&p, "second"), 5, "the range follows the function");
        assert_eq!(line_of(&p, "first"), 4);

        // The body is unchanged, so the hash must be too — a reformat or an edit ELSEWHERE
        // in the file is not a reason to expire an honest reading.
        let after = {
            let mut h = None;
            p.scan.root.visit(&mut |n| {
                if n.name == "second" {
                    h = n.body.clone();
                }
            });
            h
        };
        assert_eq!(before, after, "moving a function does not expire its reading");

        // A function written since the scan is not invented here — it needs scoring
        // against every peer in the file, which is a scan's job. It arrives on reopen.
        let mut names = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                names.push(n.name.clone())
            }
        });
        assert_eq!(names, vec!["first", "second"]);
    }

    /// A function deleted under the queue is dropped, not handed out at stale lines.
    #[test]
    fn a_function_that_is_gone_stops_being_offered() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(&path, "fn keep() { println!(\"1\"); }\nfn go() { println!(\"2\"); }\n")
            .unwrap();
        let mut p = project_of(dir.path());
        assert_eq!(resync_changed(&mut p), 0);

        std::fs::write(&path, "fn keep() { println!(\"1\"); }\n").unwrap();
        assert_eq!(resync_changed(&mut p), 1);

        let mut names = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                names.push(n.name.clone())
            }
        });
        assert_eq!(names, vec!["keep"]);
    }

    /// `/status` answers about the caller's repo, not about whichever one the window is
    /// following.
    ///
    /// This is the one endpoint that was still resolving through `active`, and it is the
    /// call a driving session makes most often. The human clicking another project in the
    /// app was enough to retarget a headless run mid-flight: the orchestrator polled, got
    /// another repo's `assessed` and `remaining`, and reported a conclusion drawn from
    /// them. Nothing in the response said the subject had moved, and `queue` and `report`
    /// went on serving the session's real repo — so the same server described two
    /// different subjects in one run.
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

    #[tokio::test]
    async fn status_answers_about_the_callers_repo_not_the_window() {
        // `touch` persists.
        let _data = data_home();
        let mine = tempfile::tempdir().unwrap();
        std::fs::write(mine.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let theirs = tempfile::tempdir().unwrap();
        std::fs::write(theirs.path().join("b.rs"), "fn two() { println!(\"2\"); }\n").unwrap();

        let mut state = AppState::default();
        let mut p = project_of(mine.path());
        p.name = "mine".into();
        state.projects.insert("/mine".into(), p);
        let mut p = project_of(theirs.path());
        p.name = "theirs".into();
        state.projects.insert("/theirs".into(), p);
        // The window has drifted onto somebody else's repo — but `mine` is what was
        // opened most recently, which is what a keyless caller is actually asking about.
        state.active = Some("/theirs".into());
        state.touch("/theirs");
        state.touch("/mine");
        let shared: Shared = Arc::new(Mutex::new(state));

        let Json(out) =
            status(State(shared.clone()), Query(StatusParams { project: Some("/mine".into()) }))
                .await;
        assert_eq!(out["project"], "mine", "status followed the window, not the caller");
        assert!(out["repo"].as_str().unwrap().contains(mine.path().to_str().unwrap()));

        // No key — the last repo OPENED, not the one being looked at. This asserted the
        // window until opening a repo stopped pointing the window at it; once those came
        // apart, "whatever is on screen" was the wrong answer in the one direction that
        // costs something, because `report` resolves down this same path. The answer still
        // names whose it is either way, which is what makes a mismatch visible.
        let Json(out) = status(State(shared), Query(StatusParams { project: None })).await;
        assert_eq!(out["project"], "mine");
    }

    /// Hand out tasks until one of the kind asked for appears, taking the leases with them.
    ///
    /// The lease is the part that matters: `reveal` refuses without one, so a test that
    /// reached into the scan for an id would be exercising a path no reader can take.
    ///
    /// `want_file` rather than "the first one", because the queue interleaves and which
    /// kind arrives first is not a promise. A test that happens to pass because a file
    /// task sorted second is the ordering luck this repo keeps a rule about.
    async fn lease_kind(shared: &Shared, key: &str, want_file: bool) -> Task {
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

    /// The source comes from the server, bounded to the extent that will be graded.
    ///
    /// A function gets its own lines and nothing else. This is the property that used to
    /// be an instruction — "open abs_path, bounded to `line`..`end_line`, never the whole
    /// file" — and instructions to a model are the class of rule this repo has watched
    /// readers improvise around three times.
    #[tokio::test]
    async fn reveal_serves_the_functions_own_lines_and_no_more() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.rs"),
            "fn one() {\n    println!(\"1\");\n}\n\nfn two() {\n    println!(\"SECRET\");\n}\n",
        )
        .unwrap();
        let mut state = AppState::default();
        state.projects.insert("/p".into(), project_of(dir.path()));
        state.touch("/p");
        let shared: Shared = Arc::new(Mutex::new(state));

        let task = lease_kind(&shared, "/p", false).await;
        let Json(out) = reveal(
            State(shared.clone()),
            Json(RevealRequest {
                project: Some("/p".into()),
                id: task.id.clone(),
                expected: "prints something".into(),
                part: None,
            }),
        )
        .await;
        assert_eq!(out["ok"], true, "{out}");
        let src = out["source"].as_str().unwrap();
        assert!(src.contains(&task.name), "the body served was not this function's");
        // The neighbor is the test. An unbounded read hands the reader the body of a
        // function it has not predicted yet, which is the read-ahead the ordering exists
        // to prevent.
        let other = if task.name == "one" { "SECRET" } else { "\"1\"" };
        assert!(!src.contains(other), "reveal leaked a sibling's body into the handout:\n{src}");
    }

    /// Past the ceiling a function leaves the queue, is counted apart, and is refused.
    ///
    /// Three places have to agree — the queue, the count and `reveal` — or the map offers
    /// work that cannot be done, or states a gap while the queue quietly keeps serving it.
    /// And `oversize` is its own number rather than folded into `excluded`: one is a fact
    /// about readers, the other is somebody's `.sanityignore`, and merging them would let a
    /// tool's limitation read as a decision a human made.
    #[tokio::test]
    async fn an_oversize_function_leaves_the_queue_and_is_counted_apart() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        // One function past READ_CEILING, one ordinary one beside it in the same file. The
        // small one is the test: a file holding something unreadable must not lose its
        // readable functions along with it.
        let huge: String =
            (0..READ_CEILING / 20 + 1000).map(|i| format!("    let x{i} = {i};\n")).collect();
        std::fs::write(
            dir.path().join("a.rs"),
            format!("fn small() {{\n    println!(\"1\");\n}}\n\nfn huge() {{\n{huge}}}\n"),
        )
        .unwrap();
        let mut state = AppState::default();
        state.projects.insert("/p".into(), project_of(dir.path()));
        state.touch("/p");
        let shared: Shared = Arc::new(Mutex::new(state));

        {
            let s = lock(&shared);
            let p = &s.projects["/p"];
            let counts = count_funcs(&p.scan);
            assert_eq!(counts.oversize, 1, "the huge function was not counted as oversize");
            assert_eq!(counts.kept, 1, "the readable function did not survive its neighbour");
            assert_eq!(counts.excluded, 0, "a reader limit was reported as an exclusion");
        }

        // Everything the queue will ever hand out, leases ignored.
        let mut names = Vec::new();
        for _ in 0..8 {
            let Json(handed) = queue(
                State(shared.clone()),
                Query(QueueParams { n: 4, project: Some("/p".into()) }),
            )
            .await;
            if handed.is_empty() {
                break;
            }
            names.extend(handed.into_iter().map(|t| t.name));
        }
        assert!(names.contains(&"small".to_string()), "the readable function was not queued");
        assert!(!names.contains(&"huge".to_string()), "an unreadable function was handed out");
    }

    /// A body too large for one response is cut into parts that reassemble exactly.
    ///
    /// The reader is promised the extent it will be graded against. Paging is only
    /// admissible because it does not change that: concatenating the parts has to be the
    /// same bytes the old single-response call would have sent, or the map is grading
    /// against something nobody can reconstruct.
    #[test]
    fn a_paged_body_reassembles_to_the_original() {
        // Longer than one part and not a multiple of it, so the last part is a remainder.
        let body: String = (0..4000).map(|i| format!("    line {i} of the body\n")).collect();
        assert!(body.len() > PART_BYTES * 2, "fixture is not large enough to page");

        let cut = parts_of(&body);
        assert!(cut.len() >= 3, "expected several parts, got {}", cut.len());
        assert_eq!(cut.concat(), body, "the parts do not reassemble to the body");
        for (i, p) in cut.iter().enumerate() {
            assert!(p.len() <= PART_BYTES, "part {} is {} bytes, over the cap", i + 1, p.len());
        }
        // On line boundaries: a part that ends mid-token would hand the reader code that
        // does not parse, and two of them would look like a syntax error in the repo.
        for p in cut.iter().take(cut.len() - 1) {
            assert!(p.ends_with('\n'), "a part was cut mid-line");
        }
    }

    /// A body that fits stays one part, and says so.
    ///
    /// The common reading must not pay for this. `parts: 1` with no `next_step` is what
    /// almost every function returns, and a reader should not learn a paging protocol to
    /// read four lines.
    #[test]
    fn a_small_body_is_served_whole_in_one_part() {
        let body = "fn one() {\n    println!(\"1\");\n}\n";
        let cut = parts_of(body);
        assert_eq!(cut.len(), 1);
        assert_eq!(cut[0], body);
    }

    /// A report is refused while any part of its body is still outstanding.
    ///
    /// **The half that does not depend on a reader choosing to be honest.** Eighteen
    /// readings in this corpus were graded against bodies their readers never received, and
    /// every one of them said so in a `note` nothing aggregates while grading anyway. The
    /// rule was already written down for readers; readers improvised around it. This is the
    /// server refusing on evidence it owns.
    #[tokio::test]
    async fn a_report_with_parts_outstanding_is_refused() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        // One function large enough to page, so the reader gets part 1 of several.
        let body: String = (0..3000).map(|i| format!("    let x{i} = {i};\n")).collect();
        std::fs::write(dir.path().join("a.rs"), format!("fn big() {{\n{body}}}\n")).unwrap();
        let mut state = AppState::default();
        state.projects.insert("/p".into(), project_of(dir.path()));
        state.touch("/p");
        let shared: Shared = Arc::new(Mutex::new(state));

        let task = lease_kind(&shared, "/p", false).await;
        let Json(first) = reveal(
            State(shared.clone()),
            Json(RevealRequest {
                project: Some("/p".into()),
                id: task.id.clone(),
                expected: "assigns a lot of variables".into(),
                part: None,
            }),
        )
        .await;
        assert_eq!(first["ok"], true, "{first}");
        let parts = first["parts"].as_u64().expect("a part count");
        assert!(parts > 1, "fixture did not page: {first}");
        assert!(first["next_step"].is_string(), "a paged reply must say there is more");

        let mut r = Report::blank();
        r.id = task.id.clone();
        r.found = "assigns a lot of variables".into();
        r.predicted = Some(Grade::Full);
        let Json(out) = report(
            State(shared.clone()),
            Json(ReportRequest { project: Some("/p".into()), report: r.clone() }),
        )
        .await;
        assert_eq!(out["ok"], false, "a partial reading was accepted: {out}");
        assert_eq!(out["saved"], false);

        // The lease survives the refusal, so the reader can fetch the rest and send the
        // same reading again. Dropping it would make a refusal cost a reading rather than
        // a round trip, and the function would go back in the queue for somebody else.
        for part in 2..=parts {
            let Json(more) = reveal(
                State(shared.clone()),
                Json(RevealRequest {
                    project: Some("/p".into()),
                    id: task.id.clone(),
                    expected: "a revision that must not land".into(),
                    part: Some(part as usize),
                }),
            )
            .await;
            assert_eq!(more["ok"], true, "part {part} was refused: {more}");
        }
        let Json(out) = report(
            State(shared.clone()),
            Json(ReportRequest { project: Some("/p".into()), report: r }),
        )
        .await;
        assert_eq!(out["ok"], true, "the completed reading was refused: {out}");
        // Stamped from what the server served, never from the reader — and it is what makes
        // this reading survive `is_stale`, where one without it would expire.
        let saved = lock(&shared).projects["/p"].reports[&task.id].clone();
        assert_eq!(saved.paged, Some(parts as usize), "the part count was not stamped");
        // The prediction is still the one written before any bytes went out, across every
        // one of those calls.
        assert_eq!(saved.expected, "assigns a lot of variables");
    }

    /// A second reveal serves the same source and leaves the first prediction standing.
    ///
    /// The prediction is the measurement, and the whole point of trading it for the body
    /// is that it cannot be composed afterwards alongside `found`. A reader that could
    /// call again with a better guess would be grading itself against a prediction it
    /// wrote with the answer in front of it — which is the failure `reveal` exists to
    /// close, reintroduced one layer down.
    #[tokio::test]
    async fn a_second_reveal_cannot_revise_the_prediction() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() {\n    println!(\"1\");\n}\n").unwrap();
        let mut state = AppState::default();
        state.projects.insert("/p".into(), project_of(dir.path()));
        state.touch("/p");
        let shared: Shared = Arc::new(Mutex::new(state));

        let task = lease_kind(&shared, "/p", false).await;
        let ask = |expected: &str| {
            let shared = shared.clone();
            let id = task.id.clone();
            let expected = expected.to_string();
            async move {
                reveal(
                    State(shared),
                    Json(RevealRequest { project: Some("/p".into()), id, expected, part: None }),
                )
                .await
            }
        };
        let Json(first) = ask("a wild guess").await;
        let Json(second) = ask("actually it prints 1").await;
        assert_eq!(first["source"], second["source"], "the same id served different code");

        let mut r = Report::blank();
        r.id = task.id.clone();
        r.predicted = Some(Grade::Full);
        r.documented = Some(Grade::None);
        r.legible = Some(Grade::Full);
        r.found = "prints 1".into();
        // What a reader that revised its prediction would have sent.
        r.expected = "actually it prints 1".into();
        let Json(out) = report(
            State(shared.clone()),
            Json(ReportRequest { project: Some("/p".into()), report: r }),
        )
        .await;
        assert_eq!(out["ok"], true, "{out}");
        let stored = lock(&shared).projects["/p"].reports[&task.id].expected.clone();
        assert_eq!(
            stored, "a wild guess",
            "the reading kept a prediction written after the body was served"
        );
    }

    /// An id that is not out with the caller gets no source.
    ///
    /// Not bookkeeping. An unleased id is a reader working from a task it was never
    /// handed, or one whose lease expired and whose function has since gone to somebody
    /// else — and serving it produces a second reading of the same code that looks
    /// exactly as legitimate as the first.
    #[tokio::test]
    async fn reveal_without_a_lease_is_refused() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() {\n    println!(\"1\");\n}\n").unwrap();
        let mut state = AppState::default();
        state.projects.insert("/p".into(), project_of(dir.path()));
        state.touch("/p");
        let shared: Shared = Arc::new(Mutex::new(state));

        // A real id, taken from the scan rather than from the queue — so nothing leased it.
        let mut id = String::new();
        lock(&shared).projects["/p"].scan.root.visit(&mut |n| {
            if n.kind == crate::model::NodeKind::Func {
                id = n.id.clone();
            }
        });
        assert!(!id.is_empty(), "the fixture must hold a function");

        let Json(out) = reveal(
            State(shared.clone()),
            Json(RevealRequest {
                project: Some("/p".into()),
                id: id.clone(),
                expected: "anything".into(),
                part: None,
            }),
        )
        .await;
        assert_eq!(out["ok"], false, "an unleased id was served source: {out}");
        assert!(out["source"].is_null());
        assert!(
            !lock(&shared).projects["/p"].predictions.contains_key(&id),
            "a refused reveal recorded a prediction anyway"
        );
    }

    /// A file task is the one reading that legitimately wants the whole file.
    ///
    /// `FILE_ASK` asks what the file is FOR, and a file node's `end_line` only reaches its
    /// last declaration — so slicing to it would hand the reader a truncated file and ask
    /// it to grade the header against what it could see.
    #[tokio::test]
    async fn a_file_task_is_revealed_whole() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.rs"),
            "//! A header.\nfn one() {\n    println!(\"1\");\n}\n\n// TRAILING\n",
        )
        .unwrap();
        let mut state = AppState::default();
        state.projects.insert("/p".into(), project_of(dir.path()));
        state.touch("/p");
        let shared: Shared = Arc::new(Mutex::new(state));

        let task = lease_kind(&shared, "/p", true).await;
        let Json(out) = reveal(
            State(shared.clone()),
            Json(RevealRequest {
                project: Some("/p".into()),
                id: task.id,
                expected: "a module".into(),
                part: None,
            }),
        )
        .await;
        assert_eq!(out["ok"], true, "{out}");
        assert_eq!(out["whole_file"], true);
        let src = out["source"].as_str().unwrap();
        assert!(src.contains("//! A header."), "the header was cut off:\n{src}");
        assert!(src.contains("// TRAILING"), "the file was sliced to its last declaration:\n{src}");
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

    /// Starting a run from a thread with no tokio runtime does not panic.
    ///
    /// **This is a crash that shipped to the window.** `start_run` used a bare
    /// `tokio::spawn`, which is right from the axum handler and aborts the process
    /// anywhere else: a Tauri command is synchronous and runs on the main thread, so
    /// pressing Read killed the app on `TryCurrentError`. Every other test passed, because
    /// every other test either had a runtime or never reached the spawn.
    ///
    /// A plain `#[test]` is the whole point — no `#[tokio::test]` here, deliberately. The
    /// annotation that would make this convenient is the one that would stop it testing
    /// anything.
    ///
    /// It waits for the future to actually RUN, not merely for `detached` to return. A
    /// version that only checked for the absence of a panic would pass against an
    /// implementation that quietly dropped the work.
    #[test]
    fn work_detaches_from_a_thread_with_no_runtime() {
        let (tx, rx) = std::sync::mpsc::channel();
        detached(async move {
            let _ = tx.send(());
        });
        assert!(rx.recv_timeout(Duration::from_secs(5)).is_ok(), "the future never ran");
    }

    /// And it still works from inside one, which is the axum handler's case.
    #[tokio::test]
    async fn work_detaches_from_inside_a_runtime() {
        let (tx, rx) = std::sync::mpsc::channel();
        detached(async move {
            let _ = tx.send(());
        });
        let got = tokio::task::spawn_blocking(move || rx.recv_timeout(Duration::from_secs(5)))
            .await
            .unwrap();
        assert!(got.is_ok(), "the future never ran");
    }

    /// A named project that is not loaded must not be answered for by another one.
    ///
    /// The shim carries the project key so the model cannot lose it; that only helps if
    /// the key is honored or refused, never quietly replaced. Falling back to `active`
    /// here would write one repo's reading into another repo's `.sanity/`, correctly
    /// hashed and attributed, with nothing anywhere to say it happened.
    #[test]
    fn a_project_key_that_is_not_loaded_is_refused_rather_than_swapped() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let mut state = AppState::default();
        state.projects.insert("/loaded".into(), project_of(dir.path()));
        state.active = Some("/loaded".into());

        assert_eq!(state.for_client(Some("/loaded")).as_deref(), Some("/loaded"));
        // Asked for, absent — during a restart this is a real key for a project that has
        // not been rescanned yet.
        assert_eq!(
            state.for_client(Some("/not-restored-yet")),
            None,
            "a named project must never be silently answered by the active one"
        );
        // Nothing asked for: the window's project is the honest default.
        assert_eq!(state.for_client(None).as_deref(), Some("/loaded"));
    }

    /// Looking at a project does not reorder the sidebar, and does not retarget a shim.
    ///
    /// The sidebar is ordered most-recently-touched-first, so while `select_project` called
    /// `touch` every click moved that row to the top — a list that rearranges itself as you
    /// use it, which is the objection drag-to-arrange exists to answer, arriving through the
    /// one action nobody thinks of as arranging.
    ///
    /// The second assertion is the one with teeth. `for_client(None)` resolves to the most
    /// recently OPENED project, and that is only sound while nothing but an open bumps
    /// `touched` — so a click moving it meant looking at a second repo silently changed where
    /// a keyless shim's readings would land. Both properties come off the same call, so they
    /// are checked together rather than in two tests that could be fixed apart.
    #[test]
    fn looking_at_a_project_moves_neither_the_list_nor_the_routing() {
        // `touch` and `focus` both persist — see `data_home`.
        let _data = data_home();
        let mine = tempfile::tempdir().unwrap();
        std::fs::write(mine.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let theirs = tempfile::tempdir().unwrap();
        std::fs::write(theirs.path().join("b.rs"), "fn two() { println!(\"2\"); }\n").unwrap();

        let mut state = AppState::default();
        state.projects.insert("/mine".into(), project_of(mine.path()));
        state.projects.insert("/theirs".into(), project_of(theirs.path()));
        // `/mine` opened last, so it is both the top of the list and where a keyless caller
        // resolves. Only an open does this.
        state.touch("/theirs");
        state.touch("/mine");
        let before: Vec<u64> =
            ["/mine", "/theirs"].iter().map(|k| state.projects[*k].touched).collect();

        // Now look at the other one, through the same call the sidebar click makes.
        state.select("/theirs");

        let after: Vec<u64> =
            ["/mine", "/theirs"].iter().map(|k| state.projects[*k].touched).collect();
        assert_eq!(before, after, "looking at a project reordered the sidebar");
        assert_eq!(
            state.for_client(None).as_deref(),
            Some("/mine"),
            "looking at a project retargeted a keyless caller's readings"
        );
        // And it still did its own job: a restart comes back to what was last selected.
        assert_eq!(state.active.as_deref(), Some("/theirs"), "the view did not move");
    }

    /// A reading belongs to the queue that handed it out, not to the caller's ambient key.
    ///
    /// Every subagent in a session shares one shim, so one reader calling `sanity_open`
    /// retargets the key for all of them mid-wave. That happened: readers were handed
    /// functions from one repo and their reports were routed to another, where the id
    /// named nothing — so the reading was counted and written nowhere, under `ok: true`.
    /// The lease is the record of where the work came from and it is already kept.
    #[test]
    fn a_reading_lands_where_its_task_came_from() {
        // `touch` persists — see `data_home`.
        let _data = data_home();
        let mine = tempfile::tempdir().unwrap();
        std::fs::write(mine.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let theirs = tempfile::tempdir().unwrap();
        std::fs::write(theirs.path().join("b.rs"), "fn two() { println!(\"2\"); }\n").unwrap();

        let mut state = AppState::default();
        state.projects.insert("/mine".into(), project_of(mine.path()));
        state.projects.insert("/theirs".into(), project_of(theirs.path()));
        state.touch("/theirs");
        state.touch("/mine");

        // An id out of `theirs`, taken from its own scan so it is the real thing.
        let mut theirs_id = String::new();
        state.projects["/theirs"].scan.root.visit(&mut |n| {
            if n.kind == crate::model::NodeKind::Func {
                theirs_id = n.id.clone();
            }
        });
        assert!(!theirs_id.is_empty(), "the fixture must hold a function");

        // The caller's key says `/mine` — the ambient state a sibling reader moved. The
        // task came out of `/theirs`, and that is where the reading goes.
        assert_eq!(
            state.owner_of(&theirs_id, Some("/mine")).as_deref(),
            Some("/theirs"),
            "a reading followed the caller's key into a repo that has never heard of it"
        );
        // Agreement changes nothing, which is every call in the single-repo case.
        assert_eq!(state.owner_of(&theirs_id, Some("/theirs")).as_deref(), Some("/theirs"));
        // And keyless — the case every subagent is actually in.
        assert_eq!(state.owner_of(&theirs_id, None).as_deref(), Some("/theirs"));
    }

    /// An id nothing holds is refused, not absorbed.
    ///
    /// This is the same failure from the other end: `report` stamped an empty body, put
    /// the reading in a map under an id no function matches, and `save_reports` — which
    /// walks live functions rather than reports — wrote nothing at all. The response said
    /// `saved: true`. A reading with nowhere to land has to say so.
    #[test]
    fn a_reading_for_an_id_no_project_holds_is_refused() {
        // `touch` persists — see `data_home`.
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let mut state = AppState::default();
        state.projects.insert("/loaded".into(), project_of(dir.path()));
        state.touch("/loaded");

        assert_eq!(state.owner_of("a.rs@99#nothing", Some("/loaded")), None);
        assert_eq!(state.owner_of("a.rs@99#nothing", None), None);

        // A lease is enough on its own: ids carry `@line`, and a lease outliving a re-cut
        // is exactly the case where the reader is still holding honest work.
        state
            .projects
            .get_mut("/loaded")
            .unwrap()
            .leased
            .insert("a.rs@99#nothing".into(), Instant::now());
        assert_eq!(state.owner_of("a.rs@99#nothing", None).as_deref(), Some("/loaded"));
    }

    /// Spreading has to survive between calls, not just within one handout.
    ///
    /// This is the regression that came with drip-feeding one function at a time:
    /// `interleave_by_file` spreads a batch, and with a batch of one there is nothing to
    /// spread. A reader's second call landed in the file its first call had just opened,
    /// and the only reason anyone knew was that the reader honestly reported `cold:
    /// false` on its own third reading. Coldness is supposed to be the queue's job.
    #[test]
    fn a_file_just_drawn_from_is_passed_over_on_the_next_call() {
        let now = Instant::now();
        let ranked = vec![
            (0.9, task("hot.rs", "a")),
            (0.8, task("hot.rs", "b")),
            (0.4, task("other.rs", "c")),
        ];

        // Nothing handed out yet: the best-ranked function wins, as before.
        let first = spread_across_files(ranked.clone(), &HashMap::new(), now, 1);
        assert_eq!(first[0].path, "hot.rs");

        // Now hot.rs has just been drawn from. The next call takes the lower-ranked
        // function from a file the reader has not opened, rather than hot.rs's sibling.
        let mut recent = HashMap::new();
        recent.insert("hot.rs".to_string(), now);
        let second = spread_across_files(ranked.clone(), &recent, now, 1);
        assert_eq!(
            second[0].path, "other.rs",
            "a second draw from a file just read is recall, not prediction"
        );

        // But it is a preference, not a lock. With every remaining function in the rested
        // file, handing over nothing would stall the loop with work still left.
        let only_hot = vec![(0.9, task("hot.rs", "a")), (0.8, task("hot.rs", "b"))];
        let forced = spread_across_files(only_hot, &recent, now, 1);
        assert_eq!(forced.len(), 1, "a rested file is still better than no work");

        // And the rest expires: once the window has passed, ranking decides again.
        let mut old = HashMap::new();
        old.insert("hot.rs".to_string(), now - FILE_REST - Duration::from_secs(1));
        assert_eq!(spread_across_files(ranked, &old, now, 1)[0].path, "hot.rs");
    }

    /// The queue must not hand a reader two functions from one file back to back while
    /// another file still has work. Ranking by score alone did exactly that — scores
    /// cluster by file because distinctiveness is measured against file-local peers — and
    /// every reading after the first in a file is recall, not prediction.
    #[test]
    fn queue_spreads_across_files() {
        // One file is far and away the most promising; naive ranking hands out all of it.
        let mut ranked = Vec::new();
        for i in 0..5 {
            ranked.push((0.9 - i as f32 * 0.01, task("hot.rs", &format!("h{i}"))));
        }
        for i in 0..5 {
            ranked.push((0.5 - i as f32 * 0.01, task("mid.rs", &format!("m{i}"))));
        }
        for i in 0..5 {
            ranked.push((0.2 - i as f32 * 0.01, task("cold.rs", &format!("c{i}"))));
        }

        let handed = interleave_by_file(ranked, 6);
        assert_eq!(handed.len(), 6);
        // No two consecutive tasks share a file while other files have work left.
        for pair in handed.windows(2) {
            assert_ne!(pair[0].path, pair[1].path, "consecutive reads from one file");
        }
        // The most promising file still leads — spreading must not become round-robin
        // that ignores the ranking.
        assert_eq!(handed[0].path, "hot.rs");
        assert_eq!(handed[0].name, "h0");
    }

    /// With only one file left there is nothing to interleave with, and the queue must
    /// still hand out work rather than starving.
    #[test]
    fn queue_falls_back_when_one_file_remains() {
        let ranked = (0..4).map(|i| (0.5, task("only.rs", &format!("f{i}")))).collect();
        let handed = interleave_by_file(ranked, 3);
        assert_eq!(handed.len(), 3);
    }

    /// Asking for more than exists returns everything, not a panic and not a repeat.
    #[test]
    fn queue_never_repeats_or_overruns() {
        let ranked = vec![(0.9, task("a.rs", "x")), (0.8, task("b.rs", "y"))];
        let handed = interleave_by_file(ranked, 25);
        assert_eq!(handed.len(), 2);
        assert_ne!(handed[0].id, handed[1].id);
    }

    /// Two loaded projects keyed `/x` and `/y`, over one throwaway repo. The keys are
    /// what `focus` reasons about; the scans behind them are only there because a
    /// `Project` cannot exist without one.
    ///
    /// The `DataHome` comes back with them because both verbs under test — `touch` and
    /// `focus` — persist, and a caller that drops it writes `/x` and `/y` into whatever
    /// index the machine really has.
    fn two_projects() -> (DataHome, tempfile::TempDir, AppState) {
        let data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let mut state = AppState::default();
        state.projects.insert("/x".into(), project_of(dir.path()));
        state.projects.insert("/y".into(), project_of(dir.path()));
        (data, dir, state)
    }

    /// Opening a repo must not take the pane away from whoever is reading it.
    ///
    /// This is the whole of the `sanity study` question: the human is looking at one repo
    /// in the window, a headless run opens another, and the view has to stay put while
    /// the new project still becomes fully addressable. It is also the two-agents case —
    /// `for_client` keeps their *routing* apart, and this keeps their *view* apart.
    #[test]
    fn an_unasked_open_does_not_steal_the_window() {
        let (_data, _dir, mut state) = two_projects();
        state.active = Some("/x".into());

        assert!(!state.focus("/y", false), "an unasked open must not move the view");
        assert_eq!(state.active.as_deref(), Some("/x"));

        // Asked for outright — `--show`, or the window's own Open command.
        assert!(state.focus("/y", true));
        assert_eq!(state.active.as_deref(), Some("/y"));
    }

    /// Nothing on screen is not a view worth protecting.
    ///
    /// The case that matters is headless: a daemon that has never had a window has no
    /// `active`, and if an open declined to set one then every keyless caller would
    /// resolve to nothing and `sanity serve` would answer no one.
    #[test]
    fn an_open_takes_a_window_that_nobody_holds() {
        let (_data, _dir, mut state) = two_projects();
        assert!(state.focus("/y", false), "nothing was being looked at");
        assert_eq!(state.active.as_deref(), Some("/y"));

        // An `active` naming a project that is not loaded is the same situation wearing a
        // key: it points at nothing, so it is not a view being taken from anybody.
        state.active = Some("/gone".into());
        assert!(state.focus("/y", false));
        assert_eq!(state.active.as_deref(), Some("/y"));
    }

    /// A caller with no key follows what was OPENED, not what is on screen.
    ///
    /// The pairing that has to hold: the window is left on an earlier repo while a
    /// session works in a newer one, and a keyless `next` or `report` must land on the
    /// newer one. `report` resolves down this same path, so getting it wrong writes a
    /// reading into a repo nobody was assessing.
    #[test]
    fn a_keyless_call_follows_the_last_open_not_the_window() {
        let (_data, _dir, mut state) = two_projects();
        // `/x` was opened first and is what the window still shows; `/y` was opened after.
        state.focus("/x", true);
        state.touch("/x");
        state.touch("/y");
        assert_eq!(state.active.as_deref(), Some("/x"), "the view has not moved");
        assert_eq!(state.for_client(None).as_deref(), Some("/y"));
        // A key that IS supplied still wins outright, view or no view.
        assert_eq!(state.for_client(Some("/x")).as_deref(), Some("/x"));
        // And one that names nothing loaded is still not silently redirected.
        assert_eq!(state.for_client(Some("/gone")), None);
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

    /// The priming warning asks; it must never assert that the reader is primed.
    ///
    /// **This is the whole defect it was rewritten for, so the test is about the wording.**
    /// The first version said "each reader arrives already holding a description", flat, on
    /// the strength of a file existing on disk. An orchestrator running in a session
    /// launched with `--setting-sources user` — no brief in its context, the human having
    /// taken the advice an hour earlier — relayed it to that human as fact, and it reached
    /// them stronger than it was written, because a hedge is the first thing lost in a
    /// relay. A tool cannot see a session's context and must not imply that it can; what it
    /// can do is name what it found, say what it cannot see, and hand the question to the
    /// only party able to answer it.
    ///
    /// It must still name the flag. A reader that hit an earlier flat warning elsewhere in
    /// this tool invented a prerequisite, another ran the tools as shell commands, and a
    /// third read `.sanity/` to compensate, which contaminated it. "You may be
    /// contaminated" with nothing to do about it is that failure with better manners.
    #[test]
    fn the_priming_warning_asks_rather_than_asserts() {
        let dir = tempfile::tempdir().unwrap();
        assert!(
            priming_note(dir.path()).is_none(),
            "a repo with no instructions file has nothing to warn about"
        );

        std::fs::write(dir.path().join("CLAUDE.md"), "# notes\n").unwrap();
        let note = priming_note(dir.path()).expect("a repo that has one");
        assert!(note.contains("CLAUDE.md"), "names what it found: {note}");
        assert!(note.contains("--setting-sources user"), "and what to do: {note}");
        // What it cannot see, said out loud, and the check handed over.
        assert!(note.contains("cannot see"), "admits its own blindness: {note}");
        assert!(note.contains("CHECK YOUR OWN CONTEXT"), "and delegates it: {note}");
        // The clean branch has to be reachable from the text alone, or an orchestrator that
        // IS clean has nothing to conclude and falls back to the alarming reading.
        assert!(note.contains("the run is clean"), "offers the other answer: {note}");

        // Two of them are both named — a run launched to exclude one and not the other is
        // still primed, and a warning that mentioned only the first would look satisfied.
        std::fs::write(dir.path().join("AGENTS.md"), "# notes\n").unwrap();
        let both = priming_note(dir.path()).expect("still warns");
        assert!(both.contains("CLAUDE.md, AGENTS.md"), "got: {both}");
    }

    /// A truncated call is refused, and honest prose about markup is not.
    ///
    /// The grade is what is at stake: `Report::grades` folds a missing `predicted` to
    /// `Full`, so a report that lost its fields to a serialisation accident banks the
    /// greenest reading on the scale rather than failing. The second half matters as much
    /// — this repo's own readings discuss JSX, so a rule that fires on any angle bracket
    /// would refuse real work.
    #[test]
    fn a_report_carrying_its_own_tool_call_is_refused() {
        let leaked = Report {
            found: "…outside the scroll area.</found> <parameter name=\"predicted\">most".into(),
            ..Report::blank()
        };
        assert_eq!(mangled(&leaked), Some("found"));
        // What it would have banked, had it been accepted: `most` on the wire, `full` in
        // the store.
        assert_eq!(leaked.grades().0, Grade::Full);

        let trailing = Report {
            expected: "A component returning <div> with the node's name.</expected>".into(),
            ..Report::blank()
        };
        assert_eq!(mangled(&trailing), Some("expected"));

        let honest = Report {
            expected: "Renders a <p> inside <div className=\"panel\"> when unread.".into(),
            found: "Exactly that, plus a <hr> above the counts.".into(),
            note: "The `</p>` here is prose about markup, not a leak.".into(),
            ..Report::blank()
        };
        assert_eq!(mangled(&honest), None);
    }

    /// A leak with every grade behind it is a complete reading, and refusing it is how the
    /// guard cost this repo a paragraph: the reader cannot see its own serialisation, so
    /// the only lever it has is the prose, and it shortened until something was accepted.
    /// The trailing tag is kept as sent — cosmetic, in a store people read — because the
    /// alternative is parsing the leak back out, which is the shape of the migration that
    /// once destroyed a project's readings.
    #[test]
    fn a_leak_with_its_grades_intact_is_a_reading_and_is_kept() {
        let complete = Report {
            found: "…and a pinned provenance footer.</parameter>".into(),
            predicted: Some(Grade::Most),
            documented: Some(Grade::None),
            legible: Some(Grade::Most),
            ..Report::blank()
        };
        assert_eq!(mangled(&complete), None);
        // The grade the reader chose, not the `Full` a truncated call would have banked.
        assert_eq!(complete.grades().0, Grade::Most);

        // One grade short of complete is the case the guard exists for, leak and all.
        let lost_a_grade = Report { predicted: None, ..complete.clone() };
        assert_eq!(mangled(&lost_a_grade), Some("found"));
    }
}
