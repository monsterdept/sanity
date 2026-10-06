//! Everything this process holds, and which project a call belongs to.
//!
//! The [`AppState`] is the map of loaded projects plus the rows that are not loaded yet —
//! restoring, declined for cost, waiting on a click. Its methods are the verbs that change
//! what the sidebar lists (`touch`, `focus`, `forget`, `unload`, `publish_asked`) and the two
//! routing questions every endpoint asks first: `for_client`, whose repo is the caller asking
//! about, and `owner_of`, whose queue handed this id out. The one way in is [`lock`], and it
//! recovers from poison on purpose.

use super::{Project, Report, TraceState};
use crate::scan::Scan;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Instant;

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
    /// When an agent last called anything: the clock a `sanity serve` daemon stands down by.
    pub last_agent: Option<Instant>,
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
}

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
            *super::tests::HOME_THREAD.lock().unwrap_or_else(|e| e.into_inner()),
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

    /// A repo somebody asked to see, in the sidebar BEFORE its scan starts. Returns its name.
    ///
    /// **An open is the one window in which the user has nothing to look at.** An agent calls
    /// `sanity_open` and goes silent for as long as the scan takes, and the window's own Open
    /// used to publish only once the scan returned — so a long scan was indistinguishable from
    /// a hang, and a picker that handed back a parent directory said nothing for minutes.
    /// `restoring` already describes exactly this state, a project whose scan has not landed,
    /// with a progress bar, and it is display-only, so nothing downstream mistakes the row for
    /// a project that can be queued or reported against.
    ///
    /// **Off the declined list the moment the scan starts.** A repo whose scan was over budget
    /// sits in `awaiting` with a row of its own, and `restoring` also renders a row — so asking
    /// for it there put the same project on screen twice under one name. The question has been
    /// answered; the row that asks it goes.
    pub fn pend(&mut self, key: &str, root: &Path) -> String {
        let name =
            root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| key.into());
        self.restoring.retain(|k| k.key != key);
        self.awaiting.remove(key);
        self.restoring.push(crate::reports::KnownProject {
            key: key.to_string(),
            repo: root.to_string_lossy().to_string(),
            name: name.clone(),
            touched: 0,
            files: None,
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        });
        name
    }

    /// Off the pending list, however the scan turned out. A row left reading forever is the
    /// same failure as no row at all, and the failure paths are exactly where it would be
    /// easiest to forget — so callers settle before the success path decides anything.
    pub fn settle(&mut self, key: &str) {
        self.restoring.retain(|k| k.key != key);
        self.restoring_progress.remove(key);
    }

    /// Land what a launch's restore scanned, unless the project is already here.
    ///
    /// **A restore arriving second must not replace what arrived first.** A backend that a
    /// `sanity check` starts is restoring every known repo while that same check posts `/open`
    /// and then `/check`; the open lands a project, the check attaches its run, and a restore
    /// finishing afterwards used to insert a project built from nothing over the top. The wave
    /// went on spawning readers that nothing could stop, and every reading it banked was
    /// stamped with no harness and no asked model, because both come from the run. The
    /// leases, predictions and revealed parts went with it — everything `Project::rescan`
    /// exists to carry. The project already here was scanned by an open no older than this
    /// restore, so keeping it loses nothing.
    ///
    /// Returns whether the restore landed.
    pub fn land_restored(&mut self, key: &str, project: Project) -> bool {
        self.settle(key);
        self.shallow.remove(key);
        if self.projects.contains_key(key) {
            return false;
        }
        self.projects.insert(key.to_string(), project);
        true
    }

    /// Land a scan somebody asked for as the project, whichever door it came through.
    ///
    /// **One place, because two doors built it twice and the copies drifted.** The window's
    /// Open and an agent's `sanity_open` are the same event — there is one list of projects,
    /// however it got filled — and each did it by hand. The window's copy never recorded the
    /// depth its scan had been traced to, so a repo opened from the app claimed `Untraced`
    /// over a tree holding the commit log: findings asked for a trace the map already had, and
    /// Trace offered to walk the log again. `trace` is what [`scan_asked`] actually did.
    ///
    /// `reports` come from [`load_reports`] against this same tree, reloaded from `.sanity/`
    /// rather than carried over, the way `restore` and the watcher land a tree: the store is
    /// the source, and it may have moved underneath the process — a pull, a hand edit. Loaded
    /// by the caller because an agent's open answers with counts over them before they move.
    ///
    /// **Leases are dropped.** Ids no longer move when a function does — see
    /// `assessment::key_of` — so a lease is not a claim on a line. It is a claim taken against
    /// a BODY this rescan may have replaced: the reader is out reading text that has changed,
    /// and its report would be stamped with the hash of code it never saw. Releasing costs one
    /// duplicate reading; keeping it costs a reading that describes nothing and says it is
    /// current.
    ///
    /// Returns whether the view moved — see [`AppState::focus`].
    pub fn publish_asked(
        &mut self,
        key: &str,
        repo: PathBuf,
        scan: Scan,
        trace: TraceState,
        reports: HashMap<String, Report>,
        focus: bool,
    ) -> bool {
        // **Through `Project::rescan`, so a reopen cannot quietly destroy a run.** Building a
        // Project from scratch with `run: None` detached a live wave from the only handle that
        // could stop it: `sanity check` posts `/open` before `/check`, the guard then saw no
        // run and started a second one, and the first went on spawning readers nothing could
        // reach.
        let name =
            repo.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| key.into());
        let mut project = Project::rescan(self.projects.get(key), repo, name, scan, reports);
        project.trace = trace;
        project.leased.clear();
        project.recent_files.clear();
        self.projects.insert(key.to_string(), project);
        // It has a map now, so a declined row's question has been answered — see `pend`.
        self.awaiting.remove(key);
        self.touch(key);
        self.focus(key, focus)
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

    /// Record that an agent called something.
    pub fn ping(&mut self) {
        self.last_agent = Some(Instant::now());
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::{data_home, project_of, DataHome};
    use crate::agentapi::{project_key, Run};

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

    /// **A launch's restore landing late keeps the run an open already attached.** A check that
    /// starts its own backend opens the repo and attaches a run while restore is still scanning
    /// the same repo; the restore landing afterwards replaced the project, and every reading
    /// the wave then banked came back with no harness. Pinned at the landing rather than
    /// through threads, because which scan finishes first is the race itself.
    #[test]
    fn a_late_restore_does_not_replace_a_project_holding_a_run() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let mut opened = project_of(dir.path());
        opened.run = Some(Run {
            from: 0,
            harness: "claude".into(),
            model: "sonnet".into(),
            width: 5,
            spawned: 2,
            finished: 0,
            failed: 0,
            ended: None,
            ended_at: None,
            failures: Vec::new(),
            stop: std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
            live: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(2)),
        });
        opened.leased.insert("a.rs#one".into(), Instant::now());
        let mut state = AppState::default();
        state.projects.insert("/p".into(), opened);

        assert!(!state.land_restored("/p", project_of(dir.path())), "landed over an open");
        let kept = &state.projects["/p"];
        assert_eq!(kept.run.as_ref().map(|r| r.harness.as_str()), Some("claude"), "the run was lost");
        assert!(kept.leased.contains_key("a.rs#one"), "the lease was lost");

        // Nothing opened: the restore is the project.
        assert!(state.land_restored("/q", project_of(dir.path())));
        assert!(state.projects.contains_key("/q"));
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
}
