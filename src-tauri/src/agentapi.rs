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
//! queue hands out **signature, name and neighbours — never the body.** The agent commits
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
use std::time::{Duration, Instant};
use std::sync::{Arc, Mutex, MutexGuard};

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
    /// What the repo looked like when this scan was taken — see `watch::probe`.
    ///
    /// The comparison the tick makes. Held per project rather than globally because two repos
    /// move independently and a single mark would rescan both whenever either did.
    pub marks: crate::watch::Marks,
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

/// Everything sanity is currently holding.
#[derive(Default)]
pub struct AppState {
    pub projects: HashMap<String, Project>,
    /// Key of the project the window should be showing.
    pub active: Option<String>,
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
    /// How far each pending rescan has got, keyed the same way.
    ///
    /// Measured, not estimated. The scan already reports `done`/`total` and the restore was
    /// throwing it away, so the honest fraction was there for free — and a fraction the
    /// scorer actually counted beats any guess from repo size, which is what "how long will
    /// this take" would otherwise have to be built on.
    pub restoring_progress: HashMap<String, (usize, usize)>,
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
        let live: Vec<crate::reports::KnownProject> = self
            .projects
            .iter()
            .map(|(key, p)| crate::reports::KnownProject {
                key: key.clone(),
                repo: p.repo.to_string_lossy().to_string(),
                name: p.name.clone(),
                touched: p.touched,
            })
            .collect();
        // Anything on disk this session has not loaded is carried through untouched. Live
        // entries win on key, so a project that IS loaded is updated rather than doubled.
        let mut index = crate::reports::load_index();
        index
            .projects
            .retain(|known| !self.projects.contains_key(&known.key));
        index.projects.extend(live);
        // `active` is this session's, and only when it has one: a restore that has not yet
        // reached the project the last session was looking at must not blank the record of
        // which one that was.
        if self.active.is_some() {
            index.active = self.active.clone();
        }
        index.projects.sort_by_key(|p| std::cmp::Reverse(p.touched));
        crate::reports::save_index(&index);
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
        let vacant = self
            .active
            .as_ref()
            .is_none_or(|k| !self.projects.contains_key(k));
        if !asked && !vacant {
            return false;
        }
        self.active = Some(key.to_string());
        self.persist();
        true
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
    /// behaviour keyless callers had before the split, without tying it back to a pane.
    ///
    /// It remains a fallback and not a mechanism. A shim that handled `sanity_open` sends
    /// its key on every call and never comes through here.
    fn most_recent(&self) -> Option<String> {
        self.projects
            .iter()
            .max_by_key(|(_, p)| p.touched)
            .map(|(key, _)| key.clone())
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
        let mut found: Vec<&String> = self
            .projects
            .iter()
            .filter(|(_, p)| holds(p))
            .map(|(k, _)| k)
            .collect();
        // Sorted, because a HashMap's order is not one: two repos that both hold an id
        // must not resolve differently between two calls. Ties break towards the most
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
    std::fs::canonicalize(path)
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string()
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

/// One unit of work: everything a reader gets *before* opening the file.
#[derive(Debug, Clone, Serialize)]
pub struct Task {
    pub id: String,
    /// Absolute, so the agent can open it without having to know where the app's repo is
    /// or assume it shares a working directory with it.
    pub abs_path: String,
    /// Repo-relative, which is what reads well in a report.
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
    /// It used to be the whole stack, the chunk's doc and then the file's, in one unlabelled
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
/// destroys the thing the layout works hardest to protect — recognising the shape you
/// saw last time. Four steps are a judgement a reader can actually make and repeat. The
/// arithmetic stays here, where it is inspectable, rather than in the model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Grade {
    /// Called it. Nothing in the body the prediction missed.
    Full,
    /// Broadly right, with a detail that wasn't obvious.
    Most,
    /// Recognisable, but the body does real work the prediction didn't cover.
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
    /// What the agent expected before reading the body. Recorded even when it was right,
    /// because "expected X, found X" is the evidence that a wedge is genuinely boring.
    pub expected: String,
    /// What it actually found.
    pub found: String,
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
    /// body anyway. And it is the half that inline comments legitimately count towards —
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
    /// documentation and readers apologising for their own misreadings; nothing but the
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
    /// Set on the way OUT when `legible` was graded under a superseded question.
    ///
    /// Computed here rather than in the browser, and that is the whole point of the split:
    /// the store records which spec a reading was taken under, and the code decides what
    /// each spec changed. Mirroring `LEGIBLE_SINCE` into TypeScript would put that decision
    /// in two places, and the copy nobody is looking at is the one that goes wrong — which
    /// is exactly how a whole repo's readings lost `derivable`.
    ///
    /// The grade itself is NOT cleared. It is what a reader said, and the panel shows it as
    /// history the same way it shows a stale reading; what it must not do is colour a wedge
    /// or count towards a dial. Deleting the reader's answer to make the display simpler
    /// would be destroying evidence to avoid writing a conditional.
    #[serde(default, rename = "legibleDated")]
    pub legible_dated: bool,
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
            expected: String::new(),
            found: String::new(),
            surprised: false,
            predicted: None,
            documented: None,
            derivable: false,
            legible: None,
            trap: false,
            note: String::new(),
            cold: false,
            position: None,
            model: String::new(),
            body: String::new(),
            spec: 0,
            legible_dated: false,
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
        let predicted = self
            .predicted
            .unwrap_or(if self.surprised { Grade::None } else { Grade::Full });
        // A doc the code already implies is not documentation, whatever grade it was
        // given — this is the provenance rule, applied at the point of use so no caller
        // can forget it.
        let documented = if self.derivable {
            Some(Grade::None)
        } else {
            self.documented
        };
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
/// Twenty, centred on the function, because the value was never a census. "What else is in
/// this file" is a claim about the neighbourhood, and the findings this field earns — a
/// test named for a property its neighbours show it does not have — come from the
/// functions either side. Five hundred names are not five hundred times as informative.
///
/// The remainder is reported rather than dropped: a reader handed twenty names with no
/// count would take them for the whole file, which is a different and false statement.
const PEER_WINDOW: usize = 20;

/// The functions either side of this one, and how many were left out.
///
/// Centred where it can be, and sliding to the edges where it cannot — the first function
/// in a file gets twenty below it rather than ten of nothing and ten below.
fn neighbours(names: &[String], i: usize) -> (Vec<String>, usize) {
    if names.len() <= PEER_WINDOW + 1 {
        let peers: Vec<String> = names
            .iter()
            .enumerate()
            .filter(|(k, _)| *k != i)
            .map(|(_, n)| n.clone())
            .collect();
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
    root: Option<&Path>,
    // The enclosing file's own comment, carried down so a chunk's task can hand over the
    // whole stack a reader would have rather than only the chunk's own line.
    file_doc: Option<&str>,
    out: &mut Vec<(f32, Task)>,
) {
    if node.kind == NodeKind::Func {
        // A reading only excuses a function while it still describes it. Once the body
        // moves, the reading is evidence about code that no longer exists and the
        // function is unread again — which is what makes "update my sanity assessment"
        // the same protocol as making one, rather than a second mode.
        let stale = match done.get(&node.id) {
            Some(prior) => {
                if !crate::assessment::is_stale(prior, node.body.as_deref()) {
                    return;
                }
                true
            }
            None => false,
        };
        if leased
            .get(&node.id)
            .is_some_and(|t| t.elapsed() < LEASE)
        {
            return;
        }
        // Stale readings outrank everything unread. Code somebody bothered to assess and
        // then changed is where an assessment goes wrong quietly — a wedge that still
        // looks cool because of a reading that expired.
        let priority = node.score.map_or(0.5, |s| s.surprise) + if stale { 1.0 } else { 0.0 };
        out.push((
            priority,
            Task {
                id: node.id.clone(),
                abs_path: root
                    .map(|r| r.join(&node.path).to_string_lossy().to_string())
                    .unwrap_or_else(|| node.path.clone()),
                path: node.path.clone(),
                line: node.line.unwrap_or(0),
                end_line: node
                    .end_line
                    .unwrap_or_else(|| node.line.unwrap_or(0) + node.loc),
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
            Some(prior) => crate::assessment::is_stale(prior, node.body.as_deref()),
            None => true,
        } && !leased.get(&node.id).is_some_and(|t| t.elapsed() < LEASE)
            // A file with nothing in it has no declarations to describe, so there is no
            // reading to take: the header would be graded against an empty surface.
            && !node.children.is_empty();
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
                    abs_path: root
                        .map(|r| r.join(&node.path).to_string_lossy().to_string())
                        .unwrap_or_else(|| node.path.clone()),
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
                    // needs its NEIGHBOURS and a file's list of two hundred is mostly noise
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
        // produces — a test whose name promises more than its neighbours deliver — come
        // from that adjacency, not from an alphabetical census.
        let names: Vec<String> = node
            .children
            .iter()
            .map(|c| qualify(&c.name, c.owner.as_deref(), c.lang))
            .collect();
        // AFTER the file's own task, which already carries the complete list and must not
        // have it replaced by a function's window.
        let before = out.len();
        // Which child produced which task, so each one gets its own neighbourhood. Not
        // every child yields a task — read and leased ones are skipped — so the index
        // cannot be inferred from position in `out`.
        let mut from: Vec<usize> = Vec::new();
        for (i, c) in node.children.iter().enumerate() {
            let mark = out.len();
            collect_tasks(c, done, leased, root, node.doc.as_deref(), out);
            from.extend(std::iter::repeat_n(i, out.len() - mark));
        }
        for (k, (_, t)) in out.iter_mut().skip(before).enumerate() {
            let (peers, omitted) = neighbours(&names, from[k]);
            t.peers = peers;
            t.peers_omitted = omitted;
        }
        return;
    }
    for c in &node.children {
        collect_tasks(c, done, leased, root, None, out);
    }
}

/// Every task the queue could hand out, with nothing read and nothing leased.
///
/// For measurement, not for handing out — `just tokens` weighs the payload a reader
/// actually receives, and building a second version of it in the tool would measure the
/// wrong thing the moment either drifted. `peers` in particular has no bound: it is every
/// function in the file, and a 400-function file sends all 400 names to every reader that
/// touches it.
pub fn all_tasks(scan: &Scan, repo: &Path) -> Vec<Task> {
    let mut out = Vec::new();
    collect_tasks(
        &scan.root,
        &HashMap::new(),
        &HashMap::new(),
        Some(repo),
        None,
        &mut out,
    );
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

#[derive(Deserialize)]
pub struct OpenRequest {
    pub path: String,
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
This is a LOOP, not a single pass. A wave of readers assesses a percent or two of a real \
repo; stopping there leaves the map almost entirely grey and the job is not done.\n\n\
YOUR JOB (the session that called sanity_open):\n\
  1. Spawn 5-10 subagents IN PARALLEL, each with the prompt below. EACH ONE ASSESSES \
     EXACTLY TEN FUNCTIONS and stops. The queue reserves what it hands out, so parallel \
     readers get different functions.\n\
  2. When they return, call sanity_status and read `remaining` and `in_flight`.\n\
  3. If remaining > 0, go back to step 1 — UNLESS remaining == in_flight, which means \
     everything left is already out with a reader and another wave would only wait. Keep \
     going until remaining is 0, or until you hit a limit the user gave you. `remaining` \
     ignores leases, so it does not flicker between calls and only falls when a reading \
     actually lands.\n\
  4. Only then summarise. Call sanity_summary for the actual numbers — the grade \
     distribution, what the docs covered, how it splits by model. Do NOT reconstruct the \
     result from what your subagents said in chat, and do NOT read `.sanity/` to get it. \
     If you stopped before remaining hit 0, SAY SO and say how many are left — 'done' and \
     'out of budget' are different outcomes and the user needs to know which.\n\n\
TEN READINGS PER READER, FETCHED ONE AT A TIME. Ten because that is the edge of what has \
actually been measured: two experiments, 784 readings across two codebases, looked for \
readers grading greener as they work through a batch — the reason this used to be three — \
and neither found it, while the cost falls from ~26,000 tokens per function at one to \
~5,300 at ten. Fifteen might be fine and nobody has measured it, so do not raise it. One \
at a time, because the saving comes from the shared context, not the shared handout: \
fetching ten at once costs the same and shows the reader nine functions it has not \
predicted yet.\n\n\
WHICH MODEL READS IS PART OF THE MEASUREMENT — ASK BEFORE THE FIRST WAVE, unless the user \
already said. Surprise is what a competent reader could predict, so the reader IS the \
scale: a smaller model is surprised by more, and its readings are not comparable to the \
ones already banked. Propose Sonnet and say why in one line, then spawn every reader in \
this run on whatever they choose. Do not mix models within a repo to save money — a mixed \
corpus gives you one map on two scales and nothing on screen says which wedge is which. \
`model` is recorded on every reading, so an honest answer is available later; a mixture is \
merely unreadable.\n\n\
ON A LARGE REPO, ASK. `functions` PLUS `files` in the sanity_open response is the real \
size of the job — a file is a reading too, graded on whether its header describes what is \
in it — and at ten per reader, ten thousand of them is over a thousand subagents. If that is more than the user has agreed to spend, say what a full pass would \
cost and ask how far to go BEFORE starting, then stop where they said and report how many \
are left. A partial assessment is a normal outcome; an unannounced one is not.\n\n\
IF YOU RUN OUT OF SUBAGENTS, THE ASSESSMENT IS NOT OVER — it is paused, and resuming it \
costs nothing. Hosts cap how many subagents one session may spawn, and at ten functions \
each a cap of two hundred is two thousand functions; a large repo will hit it. That is not \
a failure and it is not a reason to improvise. Every reading is already saved in the repo, \
so: tell the user how many are left, ask them to start a fresh session, and call \
sanity_open again — `remaining` picks up exactly where this one stopped. Above all do NOT \
start assessing functions yourself to finish the job. Your context is full of this repo; \
your readings would be recall, they would score as unsurprising, and they would be \
indistinguishable afterwards from honest ones.\n\n\
Findings are written into the repo itself, at `.sanity/`, as Markdown a person can read. \
That happens automatically on every report — do not write those files yourself. Tell the \
user the assessment is there and that it is theirs to commit; it is not yours to commit \
for them.\n\n\
UPDATING AN EXISTING ASSESSMENT is this same loop, with nothing added. If `.sanity/` was \
already there, sanity_open loaded it, and `stale` in sanity_status counts readings whose \
code has since changed. Those are handed out FIRST. Never read `.sanity/` yourself before \
assessing, and never pass its contents to a subagent — a reader who has been told what the \
last reader found is no longer predicting, and the whole measurement is worthless.\n\n\
Do NOT assess in this session. Your context is contaminated: anything you have already \
read in this repo you will 'predict' from memory, which scores as unsurprising and makes \
the result meaningless. Every subagent must be fresh.\n\n\
SUBAGENT PROMPT — paste this and nothing else. The tools describe their own fields; \
repeating them here would only bill every reader twice for one contract.\n\n";

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
pub const READER_PROMPT: &str = "\
  You are reading a codebase you have never seen, and you are assessing EXACTLY TEN \
  THINGS, ONE AT A TIME. Repeat this ten times: call sanity_next with no arguments and \
  it hands you exactly one — usually a function, occasionally a whole file, which carries \
  an `ask` field saying how its question differs and is the only case where you read more \
  than the lines you were given; write what you expect its body to do from the name, \
  owner, signature, siblings and docs alone — two or three sentences, no more — THEN open \
  abs_path, bounded to the `line`..`end_line` you were given and nothing more, read it, \
  and call sanity_report. Only then call sanity_next again. After the tenth report, \
  stop.\n\n\
  Do not ask for more than one at a time. One handout is one function on purpose: a \
  reader given ten at once has read ten signatures, ten owners and ten peer lists before \
  it predicts the first, and it costs no less. Set `position` to 1 through 10 in the order \
  you assess them.\n\n\
  Grade `predicted` against what you WROTE, not against what you understand now: the \
  question is what the code told a stranger.\n\n\
  THE PROJECT'S OWN BRIEF IS NOT THE HANDOUT. A CLAUDE.md or AGENTS.md may already be in \
  your context, and some of them explain specific functions by name. Do not open one, and \
  do not let it carry a prediction: predict from the name, owner, signature, peers and docs \
  you were given. Where you notice you knew something from the brief rather than from the \
  handout, grade on the handout alone and say so in `note`.\n\n\
  Do not read any other file, do not spawn subagents, and do NOT read the `.sanity/` \
  directory — it holds the previous reader's findings, and seeing them makes everything \
  you say afterwards worthless. If a tool errors, read the message: connection failures \
  are usually transient, so wait and retry the same call a few times rather than \
  inventing a prerequisite or running the tools as shell commands.";

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
/// Scored with the offline proxy only, so every wedge starts grey. Nothing claims to have
/// been understood until something actually reads it.
async fn open_project(
    State(state): State<Shared>,
    Json(req): Json<OpenRequest>,
) -> Json<serde_json::Value> {
    let path = PathBuf::from(&req.path);
    if !path.is_dir() {
        return Json(serde_json::json!({ "ok": false, "error": format!("{} is not a directory", req.path) }));
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
        crate::scan::scan(
            &scan_path,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
            crate::scan::Fidelity::Ordering,
        )
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

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| key.clone());
    let (functions, excluded) = count_funcs(&scan);
    // Files are readings too, and this response is what the protocol tells an orchestrator
    // to size the job from — so it has to be the whole job, not the function half of it.
    let (files, _) = count_files(&scan);
    let shape = shape_of(&scan);

    let mut s = lock(&state);
    // Reloaded from `.sanity/` against the fresh tree rather than carried over from the
    // old Project. In-memory reports are keyed by node id, and node ids embed `@line` —
    // carrying them across a rescan would orphan every reading in a file where anything
    // moved. `load_reports` resolves the durable `key_of` entries onto the new ids, which
    // is the same thing `restore` does and the only correct way to cross a rescan.
    let reports = load_reports(&path, &scan);
    let marks = stamp_marks(&path, &scan);
    // The index ships to strangers, and `save` only rewrites it when a reading lands — so
    // a FINISHED repo keeps whatever prose its last reading was written with, forever. An
    // open is the moment we certainly have both the repo and its readings in hand, so it
    // is where an out-of-date index gets caught. It refreshes, never creates: opening a
    // repo with no assessment must not leave a `.sanity/` directory in somebody's tree.
    let index = crate::assessment::refresh(&path, &scan, &reports);
    // Taken AFTER the scan and after `refresh`, so anything either of them wrote is already
    // in the marks and cannot read as a change on the first tick. `refresh` only writes when
    // the bytes differ, but "only sometimes fires a spurious rescan" is not a property worth
    // having when the alternative is one stat walk here.
    let probe_path = path.clone();
    let stale = count_stale(&scan, &reports);
    // Minus stale, like everywhere else. It was `reports.len()` raw — the same bug
    // `/status` was fixed for and the same consequence: the window said 142 while the agent
    // driving the assessment was told 608, and the optimistic number was the one making
    // decisions about whether to keep going. `assessed` has one definition.
    let assessed = reports.len().saturating_sub(stale);
    // Keep its place in the history; the reopen is not a new project.
    let touched = s.projects.get(&key).map(|p| p.touched).unwrap_or(0);
    s.projects.insert(
        key.clone(),
        Project {
            repo: path,
            name: name.clone(),
            scan,
            reports,
            // Dropped, not carried, and now for one reason rather than two. Ids no longer
            // move when a function does — see `assessment::key_of` — so a lease is no longer
            // a claim on a line. What it is is a claim taken against a BODY that this rescan
            // may have replaced: the reader is out reading text that has changed, and its
            // report would be stamped with the hash of code it never saw. Releasing costs one
            // duplicate reading; keeping it costs a reading that describes nothing and says
            // it is current.
            leased: HashMap::new(),
            recent_files: HashMap::new(),
            file_marks: marks,
            marks: crate::watch::probe(&probe_path),
            scanned: 1,
            touched,
            last_agent: Some(Instant::now()),
        },
    );
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
        "functions": functions, "files": files, "assessed": assessed,
        // Both, always. `functions` is what a full pass costs and what a percentage
        // divides by; `excluded` is what somebody decided is not this assessment's
        // business. A denominator quietly narrowed months ago is how a map ends up
        // claiming completeness over a subset.
        "excluded": excluded,
        // The repo by top-level directory, so a reader can propose a `.sanityignore` with
        // numbers instead of a guess. Nobody shipping this tool can know which of these
        // directories is worth a reading; somebody who has just read the repo can ask.
        "shape": shape,
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
        "stale": stale, "protocol": format!("{PROTOCOL}{READER_PROMPT}"),
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
    collect_tasks(&project.scan.root, &project.reports, &none, None, None, &mut unread);
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
    WorkLeft {
        remaining: unread.len(),
        in_flight: outstanding.len(),
        outstanding,
    }
}

/// Readings whose code has changed under them.
///
/// Reported separately from "unread" everywhere it is surfaced, because they are
/// different situations for the person reading the number: unread is work never done,
/// stale is work that has quietly stopped being true.
fn count_stale(scan: &Scan, reports: &HashMap<String, Report>) -> usize {
    let mut n = 0;
    scan.root.visit(&mut |node| {
        // Files as well as functions: both are handed out, both are reported, and both
        // expire. Counting only functions left an expired FILE reading in the numerator
        // — `assessed` subtracts this from `reports.len()`, which holds every kind.
        if !matches!(node.kind, NodeKind::Func | NodeKind::File) {
            return;
        }
        if let Some(r) = reports.get(&node.id) {
            if crate::assessment::is_stale(r, node.body.as_deref()) {
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
    project.scan.root.visit(&mut |node| {
        if !matches!(node.kind, NodeKind::Func | NodeKind::File) {
            return;
        }
        if let Some(r) = project.reports.get(&node.id) {
            if !crate::assessment::is_stale(r, node.body.as_deref()) {
                n += 1;
            }
        }
    });
    n
}

/// Functions in scope, and functions `.sanityignore` set aside.
///
/// Always both, everywhere either is shown. "10,828 functions" and "10,828 functions,
/// 2,140 excluded" are the same repo and different claims, and a percentage divided by
/// the first while the queue works from the second is the instrument overstating itself
/// — the same failure as counting leased work as done.
fn count_funcs(scan: &Scan) -> (usize, usize) {
    fn walk(node: &Node, out_of_scope: bool, kept: &mut usize, dropped: &mut usize) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::Func {
            *(if out_of_scope { dropped } else { kept }) += 1;
            return;
        }
        for c in &node.children {
            walk(c, out_of_scope, kept, dropped);
        }
    }
    let (mut kept, mut dropped) = (0, 0);
    walk(&scan.root, false, &mut kept, &mut dropped);
    (kept, dropped)
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
fn count_files(scan: &Scan) -> (usize, usize) {
    fn walk(node: &Node, out_of_scope: bool, kept: &mut usize, dropped: &mut usize) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::File {
            if !node.children.is_empty() {
                *(if out_of_scope { dropped } else { kept }) += 1;
            }
            return;
        }
        for c in &node.children {
            walk(c, out_of_scope, kept, dropped);
        }
    }
    let (mut kept, mut dropped) = (0, 0);
    walk(&scan.root, false, &mut kept, &mut dropped);
    (kept, dropped)
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
    fn walk(node: &Node, out: bool, by_dir: &mut std::collections::BTreeMap<String, (usize, usize)>) {
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
        .filter(|(path, m)| project.file_marks.insert(path.clone(), *m).is_some_and(|was| was != *m))
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
        recent
            .get(&t.path)
            .is_none_or(|at| now.duration_since(*at) > FILE_REST)
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
    collect_tasks(
        &project.scan.root,
        &project.reports,
        &project.leased,
        Some(project.repo.as_path()),
        None,
        &mut tasks,
    );
    let now = Instant::now();
    let handed = spread_across_files(tasks, &project.recent_files, now, p.n);

    // Reserved as they go out, so the next caller — very likely a sibling subagent
    // running at the same moment — gets different work.
    for t in &handed {
        project.leased.insert(t.id.clone(), now);
        project.recent_files.insert(t.path.clone(), now);
    }
    // Handing out nothing when nothing is left is the end of the job, and the only moment
    // in the protocol worth a flourish. Handing out nothing while work is still leased is
    // an ordinary wait, so the two are pinged apart rather than both reading as "done".
    let done = handed.is_empty() && work_left(project).remaining == 0;
    state.ping(if done { "sanity_next:done" } else { "sanity_next" });
    Json(handed)
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
fn mangled(r: &Report) -> Option<&'static str> {
    // The grades are what the guard is protecting. `predicted` folds to `Full` when
    // absent, so its loss is the expensive one; the other two go grey, which is a smaller
    // lie but still one this build asked a reader for and did not get.
    if r.predicted.is_some() && r.documented.is_some() && r.legible.is_some() {
        return None;
    }
    // The closing tags are the reliable half: an argument value that ends by closing the
    // tag it lives in cannot be prose about code. `<parameter name=` catches the rest of
    // the payload trailing behind it.
    const LEAK: [&str; 2] = ["</parameter>", "<parameter name="];
    for (name, text) in [
        ("expected", &r.expected),
        ("found", &r.found),
        ("note", &r.note),
    ] {
        if LEAK.iter().any(|m| text.contains(m))
            || text.contains(&format!("</{name}>"))
        {
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
    project.leased.remove(&r.id);

    // Provenance is stamped here, not accepted from the caller. The body hash is the
    // field a future reader checks this reading against, so it has to come from the same
    // scan the queue handed out — an agent could report a hash of whatever it liked, and
    // the one thing a staleness marker cannot be is self-certified.
    let mut r = r;
    let mut body = None;
    project.scan.root.visit(&mut |n| {
        if n.id == r.id {
            body = n.body.clone();
        }
    });
    r.body = body.unwrap_or_default();
    // Which question this answered — the same argument as the hash beside it. A reader
    // asked to declare its own spec could name the one that makes its grade look current,
    // and that claim is exactly what the field exists to test. This build asked, so this
    // build stamps.
    r.spec = crate::assessment::SPEC;
    // And cleared, for the same reason it is stamped rather than accepted. It is a
    // conclusion this build draws on the way out, never a claim a reader gets to make on
    // the way in — a reader that sent `legibleDated: false` would otherwise be voting on
    // whether its own grade still counts.
    r.legible_dated = false;
    r.by = crate::assessment::who(&project.repo);
    r.at = crate::assessment::head(&project.repo);

    // What the reading said, before it is moved into the map. `Some`/`None` are the two
    // grades that mean the reader was actually caught out — the same test the surprise
    // rate is counted with, so the mascot and the hint cannot disagree about what
    // "surprising" means. A report landing on an id that already held one is a re-read of
    // work that expired, which is honest labour but not news.
    let outcome = if project.reports.contains_key(&r.id) {
        "sanity_report:stale"
    } else if matches!(r.grades().0, Grade::Some | Grade::None) {
        "sanity_report:hot"
    } else {
        "sanity_report:cold"
    };

    project.reports.insert(r.id.clone(), r);
    // Written through on every report. An assessment is minutes of an agent's work and
    // must not depend on the app exiting cleanly to survive.
    let write_error = save_reports(&project.repo, &project.scan, &project.reports).err();

    let WorkLeft {
        remaining,
        in_flight,
        ..
    } = work_left(project);
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
                "functions": count_funcs(&p.scan).0,
                "files": count_files(&p.scan).0,
                "assessed": assessed(p),
            })
        })
        .collect();
    let key = state.for_client(p.project.as_deref());
    match key.and_then(|k| state.projects.get(&k)) {
        Some(p) => {
            // The loop's termination condition, so a driving agent can ask "is there
            // work left" without having to infer it from a report response it may never
            // have seen — subagent tool results do not reach the parent.
            let WorkLeft {
                remaining,
                in_flight,
                outstanding,
            } = work_left(p);
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
            let (functions, excluded) = count_funcs(&p.scan);
            Json(serde_json::json!({
                "open": true,
                // Named `project`, not `active`: this answer is about the caller's repo,
                // and calling it "active" was how a driving session read another repo's
                // numbers as its own. Every status response says what it answered about
                // so a mismatch is visible even to a caller that supplied no key.
                "project": p.name,
                "repo": p.repo.to_string_lossy(),
                "functions": functions,
                "excluded": excluded,
                // Not scoped to this repo — see `AppState::refused`. Named for what it
                // counts so a driving session cannot read it as "reports outstanding".
                "refused_reports": refused,
                // Stale readings excluded, so this agrees with the sidebar and with
                // `remaining`. Through `assessed`, not spelled out again: this handler
                // carried its own `reports.len() - stale` a few lines from a call to the
                // function that exists to be the one definition, which is the divergence
                // `assessed` was written to end.
                "assessed": assessed(p),
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
                "assessment_file": crate::assessment::dir(&p.repo).to_string_lossy(),
                "done": remaining == 0,
                "next_step": if remaining == 0 {
                    "Every function has an up-to-date reading. Summarise the surprises.".to_string()
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
struct GradeCounts {
    full: usize,
    most: usize,
    some: usize,
    none: usize,
    /// Readings carrying no grade at all. Only `documented` can be this — `predicted`
    /// folds a pre-grade report onto the ends of the scale, because that is what its
    /// reader actually said.
    ungraded: usize,
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
struct Tally {
    readings: usize,
    predicted: GradeCounts,
    /// Post-provenance, via [`Report::grades`]: a doc the reader judged derivable counts
    /// as `none` here however it was graded, because that is the rule the rest of the app
    /// applies and two different "documented" numbers would be worse than one.
    documented: GradeCounts,
    /// How many of those docs the reader judged it could have written from the code — the
    /// share of the `documented: none` above that came from the rule rather than from
    /// missing comments.
    derivable: usize,
    /// The second axis: how clear the body was once the reader had opened it.
    ///
    /// Reported alongside `predicted` rather than folded into it, because the pair is the
    /// finding. Low `predicted` with high `legible` is a repo you cannot navigate but can
    /// read; both low is one you cannot work in at all; and high `legible` beside a pile of
    /// `traps` is the dangerous one — clear on the surface, mined underneath.
    ///
    /// Readings banked before this field existed carry no opinion, so they land in
    /// `ungraded` rather than defaulting to a grade nobody gave.
    legible: GradeCounts,
    /// Readings whose reader said something here will bite the next person to edit it.
    traps: usize,
    /// Readings whose reader said it had not seen that file before.
    cold: usize,
}

impl Tally {
    fn add(&mut self, r: &Report) {
        let (predicted, documented) = r.grades();
        self.readings += 1;
        self.predicted.add(Some(predicted));
        self.documented.add(documented);
        self.derivable += usize::from(r.derivable);
        // A grade from a superseded question lands in `ungraded`, not in its rung. The map
        // stops colouring those wedges, and an aggregate that kept counting them would be
        // the orchestrator's copy of the answer disagreeing with the human's — the same
        // split `assessed` was fixed for, where the optimistic number was the one making
        // decisions.
        self.legible
            .add(r.legible.filter(|_| crate::assessment::legible_current(r.spec)));
        self.traps += usize::from(r.trap);
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
struct Drift {
    /// Position → how that position's readings graded. Keyed by the reader's own count,
    /// so bucket 1 is every reader's first function whatever batch size it was running.
    positions: std::collections::BTreeMap<u32, GradeCounts>,
    /// Readings banked before position was recorded. Never folded into bucket 1 — an
    /// unknown position is not a claim of freshness, and counting it as one is exactly how
    /// a batched run got to look uniform in the first place.
    unrecorded: usize,
}

/// Everything [`summary`] reports, computed off the tree rather than off `reports`.
///
/// Walking the scan rather than the map is the same choice `save` makes: from the
/// function side each reading is checked against the body it was taken over, so a reading
/// whose code has moved is counted as stale instead of averaged in as coverage. Walking
/// the reports instead would report a distribution over a repo that no longer exists.
#[derive(Debug, Default, Serialize)]
struct Aggregate {
    total: Tally,
    by_model: std::collections::BTreeMap<String, Tally>,
    by_position: Drift,
    stale: usize,
}

fn aggregate(project: &Project) -> Aggregate {
    let mut agg = Aggregate::default();
    project.scan.root.visit(&mut |node| {
        if node.kind != NodeKind::Func {
            return;
        }
        let Some(r) = project.reports.get(&node.id) else {
            return;
        };
        if crate::assessment::is_stale(r, node.body.as_deref()) {
            agg.stale += 1;
            return;
        }
        agg.total.add(r);
        agg.by_model
            // Attribution is self-declared and may be missing; a blank gets its own
            // bucket rather than being folded in with the models that did say.
            .entry(if r.model.is_empty() {
                "unattributed".into()
            } else {
                r.model.clone()
            })
            .or_default()
            .add(r);
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
async fn summary(State(state): State<Shared>, Query(p): Query<SummaryParams>) -> Json<serde_json::Value> {
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
    let (functions, excluded) = count_funcs(&project.scan);
    Json(serde_json::json!({
        "open": true,
        "repo": project.repo.to_string_lossy(),
        "functions": functions,
        "excluded": excluded,
        "assessed": agg.total.readings,
        "stale": agg.stale,
        "remaining": remaining,
        "total": agg.total,
        "by_model": agg.by_model,
        "by_position": agg.by_position,
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
                 flat, which only rules out an effect within three."
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
    /// Functions with a reading that still describes them.
    ///
    /// Stale readings are excluded rather than counted, so `assessed / functions` means
    /// "how much of this repo is currently understood" and not "how much was understood
    /// at some point". The same choice `collect_tasks` makes — a repo cannot be finished
    /// and have expired readings in it.
    pub assessed: usize,
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
    /// How far that rescan has got, when it has started counting. Both zero means the walk
    /// is still under way and there is no denominator yet — which is a real state, not a
    /// zero-percent one, and the UI shows it as such.
    pub read_done: usize,
    pub read_total: usize,
}

impl ProjectList {
    pub fn from_state(state: &AppState) -> ProjectList {
        let mut projects: Vec<ProjectSummary> = state
            .projects
            .iter()
            .map(|(key, p)| {
                let stale = count_stale(&p.scan, &p.reports);
                let (functions, excluded) = count_funcs(&p.scan);
                let (files, _) = count_files(&p.scan);
                ProjectSummary {
                    // Same window as `agent_activity`: a reader predicting, opening a
                    // file and writing a report goes quiet for tens of seconds inside one
                    // continuous batch, and a shorter window makes it flicker.
                    working: p
                        .last_agent
                        .is_some_and(|t| t.elapsed() < Duration::from_secs(60)),
                    key: key.clone(),
                    name: p.name.clone(),
                    repo: p.repo.to_string_lossy().to_string(),
                    functions,
                    files,
                    scanned: p.scanned,
                    excluded,
                    // The same walk `assessed` does, and for the reason written there:
                    // `reports.len() - stale` counts readings whose function was deleted.
                    assessed: assessed(p),
                    stale,
                    touched: p.touched,
                    loading: false,
                    read_done: 0,
                    read_total: 0,
                }
            })
            .collect();
        // Projects the restore knows about but has not reached yet. Listed from the index,
        // which holds the name and path — everything the sidebar needs to show a row — and
        // nothing it does not, so the counts stay zero behind `loading` rather than being
        // guessed. Skipped once the real project lands, so a row never appears twice.
        projects.extend(
            state
                .restoring
                .iter()
                .filter(|known| !state.projects.contains_key(&known.key))
                .map(|known| {
                    let (done, total) = state
                        .restoring_progress
                        .get(&known.key)
                        .copied()
                        .unwrap_or((0, 0));
                    ProjectSummary {
                        key: known.key.clone(),
                        name: known.name.clone(),
                        repo: known.repo.clone(),
                        // Zeroed behind `loading`, like every other count here: the walk
                        // has not run, so there is no denominator yet and a guess would be
                        // read as a measurement.
                        functions: 0,
                        files: 0,
                        // Nothing has been scanned, so there is no revision to report. The
                        // window reads a change in this as "refetch"; starting at zero means
                        // the first real scan is a change from it.
                        scanned: 0,
                        excluded: 0,
                        assessed: 0,
                        stale: 0,
                        touched: known.touched,
                        working: false,
                        loading: true,
                        read_done: done,
                        read_total: total,
                    }
                }),
        );
        // Most recently touched first — the sidebar should read as a history.
        projects.sort_by_key(|p| std::cmp::Reverse(p.touched));
        ProjectList {
            active: state.active.clone(),
            projects,
        }
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
    Json(serde_json::json!({ "ok": true, "pid": std::process::id() }))
}

pub fn router(state: Shared) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/open", post(open_project))
        .route("/queue", get(queue))
        .route("/report", post(report))
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
pub fn restore(state: Shared) {
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
    }
    std::thread::spawn(move || {
        for known in index.projects.iter().rev() {
            let path = PathBuf::from(&known.repo);
            // Off the list whatever happens below — a row that cannot be scanned must stop
            // claiming to be moments away from appearing. It stays in the index, so it
            // comes back next launch if the volume does; it just isn't pending any more.
            let settled = |s: &mut AppState| {
                s.restoring.retain(|k| k.key != known.key);
                s.restoring_progress.remove(&known.key);
            };
            if !path.is_dir() {
                settled(&mut lock(&state));
                continue;
            }
            // The scan already counts what it is doing; the restore used to discard it and
            // leave the sidebar with nothing to say for the length of a large repo.
            let progress_key = known.key.clone();
            let progress_state = state.clone();
            let on_progress = move |p: crate::scan::Progress| {
                lock(&progress_state)
                    .restoring_progress
                    .insert(progress_key.clone(), (p.done, p.total));
            };
            let Ok(scan) = crate::scan::scan(
                &path,
                &crate::surprise::HeuristicModel,
                &on_progress,
                &|_, _: &crate::surprise::Reading| {},
                &std::sync::atomic::AtomicBool::new(false),
                crate::scan::Memos {
                    scores: &crate::cache::Cache::ephemeral(),
                    scans: &crate::scancache::ScanCache::open(&path),
                },
                // A queue sort key, not a number anyone sees — see `scan::Fidelity`.
                crate::scan::Fidelity::Ordering,
            ) else {
                settled(&mut lock(&state));
                continue;
            };
            let marks = stamp_marks(&path, &scan);
            let mut s = lock(&state);
            settled(&mut s);
            let reports = load_reports(&path, &scan);
            let probe_path = path.clone();
            s.projects.insert(
                known.key.clone(),
                Project {
                    repo: path,
                    name: known.name.clone(),
                    scan,
                    reports,
                    leased: HashMap::new(),
                    recent_files: HashMap::new(),
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
            if index.active.as_deref() == Some(known.key.as_str()) {
                s.active = Some(known.key.clone());
            }
        }
        let mut s = lock(&state);
        // Fall back to the most recently touched thing that did come back. Landing on the
        // wrong project is recoverable with a click; landing on nothing looks like the
        // restore failed.
        if s.active.as_ref().is_none_or(|k| !s.projects.contains_key(k)) {
            s.active = s
                .projects
                .iter()
                .max_by_key(|(_, p)| p.touched)
                .map(|(key, _)| key.clone());
        }
        // One write, now that the list is whole and cannot be a truncation of itself.
        s.persist();
    });
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
        let scan_repo = repo.clone();
        let scanned = tokio::task::spawn_blocking(move || {
            let scans = crate::scancache::ScanCache::open(&scan_repo);
            crate::scan::scan(
                &scan_repo,
                &crate::surprise::HeuristicModel,
                &|_| {},
                &|_, _: &crate::surprise::Reading| {},
                &std::sync::atomic::AtomicBool::new(false),
                crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
                crate::scan::Fidelity::Ordering,
            )
        })
        .await;
        let Ok(Ok(scan)) = scanned else {
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
        p.file_marks = file_marks;
        // From after the scan, not the `now` from before it: anything the walk itself touched
        // is then already accounted for and cannot read as a change on the next tick.
        p.marks = fresh;
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
    use super::*;

    fn task(path: &str, name: &str) -> Task {
        Task {
            id: format!("{path}#{name}"),
            abs_path: path.to_string(),
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
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos {
                scores: &crate::cache::Cache::ephemeral(),
                scans: &crate::scancache::ScanCache::ephemeral(),
            },
            crate::scan::Fidelity::Ordering,
        )
        .unwrap();
        let marks = stamp_marks(dir, &scan);
        Project {
            repo: dir.to_path_buf(),
            name: "t".into(),
            scan,
            reports: HashMap::new(),
            leased: HashMap::new(),
            recent_files: HashMap::new(),
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
        std::fs::write(&path, "fn first() {}
fn second() { println!(\"2\"); }\n").unwrap();
        let mut p = project_of(dir.path());

        // The edit lands before anything is handed out — no `resync_changed` has run.
        std::fs::write(
            &path,
            "// one\n// two\n// three\nfn first() {}\nfn second() { println!(\"2\"); }\n",
        )
        .unwrap();

        assert_eq!(resync_changed(&mut p), 1, "the file moved before the first look and was not re-cut");

        let mut line = None;
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func && n.name == "second" {
                line = n.line;
            }
        });
        assert_eq!(line, Some(5), "re-cut did not move `second` to its new line");
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
            projects: vec![
                crate::reports::KnownProject {
                    key: "/a".into(),
                    repo: "/a".into(),
                    name: "a".into(),
                    touched: 7,
                },
                crate::reports::KnownProject {
                    key: "/b".into(),
                    repo: "/b".into(),
                    name: "b".into(),
                    touched: 4,
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
        assert_eq!(read_endpoint().map(|e| e.pid), Some(1234), "took the successor's claim with it");

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
            collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, None, &mut out);
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
        assert_eq!(w.remaining, 3, "a lease is not a reading; remaining holds (two functions and their file)");
        assert_eq!(w.in_flight, 1);
        assert_eq!(w.outstanding.len(), w.in_flight);
        assert_eq!(w.outstanding[0].0, ids[0]);

        // A lease left over a function that has since been read explains nothing. It must
        // drop out of both numbers rather than keep claiming a reader is busy on it.
        p.reports.insert(
            ids[0].clone(),
            Report {
                id: ids[0].clone(),
                ..Report::blank()
            },
        );
        let w = work_left(&p);
        assert_eq!(w.remaining, 2, "one function read; its twin and their file are left");
        assert_eq!(w.in_flight, 0, "the reading landed; the stale lease is moot");
        assert!(w.outstanding.is_empty());
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
        collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, None, &mut out);
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
        assert_eq!(count_funcs(&p.scan), (3, 0));

        std::fs::write(dir.path().join(".sanityignore"), "tests/\n").unwrap();
        let p = project_of(dir.path());
        assert_eq!(
            count_funcs(&p.scan),
            (1, 2),
            "in scope and set aside are both reported, never one silently"
        );

        // The queue works from the narrowed set.
        let mut out = Vec::new();
        collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, None, &mut out);
        let names: Vec<String> = out.into_iter().filter(|(_, t)| !t.file).map(|(_, t)| t.name).collect();
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
            p.reports.insert(id.clone(), Report { id: id.clone(), body: body.clone(), ..Report::blank() });
        }
        assert_eq!(assessed(&p), 2, "two live readings");

        // One function is deleted and the repo rescanned. Its reading is now about nothing.
        std::fs::write(&path, "fn open() { println!(\"1\"); }\n").unwrap();
        let rescanned = project_of(dir.path());
        p.scan = rescanned.scan;
        assert_eq!(
            assessed(&p),
            1,
            "the survivor counts; the orphan is history, not coverage"
        );
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
            p.reports
                .insert(id.clone(), Report { id: id.clone(), body: body.clone(), ..Report::blank() });
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
                    .is_some_and(|r| crate::assessment::is_stale(r, n.body.as_deref()));
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
        collect_tasks(&p.scan.root, &p.reports, &HashMap::new(), None, None, &mut out);
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

    /// A big file hands over its neighbourhood, and says how much it left out.
    ///
    /// The whole-file list was 91% of tonepoet's median task payload, 30k characters at its
    /// p90. What a truncated list must never do is look complete.
    #[test]
    fn a_long_file_sends_the_neighbourhood_and_counts_the_rest() {
        let names: Vec<String> = (0..100).map(|i| format!("fn_{i:02}")).collect();

        // Middle of the file: centred, and the remainder is stated rather than dropped.
        let (peers, omitted) = neighbours(&names, 50);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert_eq!(omitted, 99 - PEER_WINDOW);
        assert!(!peers.contains(&"fn_50".to_string()), "never its own peer");
        assert!(peers.contains(&"fn_49".to_string()) && peers.contains(&"fn_51".to_string()));

        // First in the file: the window slides rather than half-emptying.
        let (peers, omitted) = neighbours(&names, 0);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert_eq!(omitted, 99 - PEER_WINDOW);
        assert!(peers.contains(&"fn_01".to_string()));

        // Last, likewise.
        let (peers, _) = neighbours(&names, 99);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert!(peers.contains(&"fn_98".to_string()));

        // A file that fits is handed over whole, and says so with a zero.
        let small: Vec<String> = (0..5).map(|i| format!("f{i}")).collect();
        let (peers, omitted) = neighbours(&small, 2);
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
        std::fs::write(&path, "fn keep() { println!(\"1\"); }\nfn go() { println!(\"2\"); }\n").unwrap();
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

        let Json(out) = status(
            State(shared.clone()),
            Query(StatusParams { project: Some("/mine".into()) }),
        )
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

    /// A named project that is not loaded must not be answered for by another one.
    ///
    /// The shim carries the project key so the model cannot lose it; that only helps if
    /// the key is honoured or refused, never quietly replaced. Falling back to `active`
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

    /// A reading belongs to the queue that handed it out, not to the caller's ambient key.
    ///
    /// Every subagent in a session shares one shim, so one reader calling `sanity_open`
    /// retargets the key for all of them mid-wave. That happened: readers were handed
    /// functions from one repo and their reports were routed to another, where the id
    /// named nothing — so the reading was counted and written nowhere, under `ok: true`.
    /// The lease is the record of where the work came from and it is already kept.
    #[test]
    fn a_reading_lands_where_its_task_came_from() {
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
        state.projects["/theirs"]
            .scan
            .root
            .visit(&mut |n| {
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
        assert_eq!(
            state.owner_of(&theirs_id, Some("/theirs")).as_deref(),
            Some("/theirs")
        );
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
        assert_eq!(
            state.owner_of("a.rs@99#nothing", None).as_deref(),
            Some("/loaded")
        );
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
        let ranked = (0..4)
            .map(|i| (0.5, task("only.rs", &format!("f{i}"))))
            .collect();
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
            found: "…outside the scroll area.</found> <parameter name=\"predicted\">most"
                .into(),
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
        let lost_a_grade = Report {
            predicted: None,
            ..complete.clone()
        };
        assert_eq!(mangled(&lost_a_grade), Some("found"));
    }
}
