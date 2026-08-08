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
use std::sync::{Arc, Mutex};

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
            None => self.active.clone(),
        }
    }

    // There was an `active_project()` here — resolve the window's repo, ignore the
    // caller. `status` was its last user and its removal is the fix, so the helper goes
    // with it: leaving a one-line shortcut past `for_client` around is an invitation to
    // reopen the hole in the next endpoint.
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
/// Long enough to outlast one reader's three functions, which take about seventy seconds
/// together — that is the case this exists for, a reader coming back to a file it opened
/// twenty seconds ago and honestly reporting the second reading warm. Short enough that
/// it is a preference and not a lock: `queue` falls back to rested files when nothing
/// else is left, so a repo with four files still finishes.
const FILE_REST: Duration = Duration::from_secs(180);

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
    /// The comment stack a reader has before opening the body: this chunk's own doc
    /// first, then the file's. Handed over BEFORE the prediction on purpose — an
    /// agentic reader reads the comments before the code, so predicting without them
    /// measures a harder question than anyone actually faces.
    #[serde(default)]
    pub docs: Vec<String>,
    pub lines: u32,
}

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
            note: String::new(),
            cold: false,
            position: None,
            model: String::new(),
            body: String::new(),
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
                docs: [node.doc.as_deref(), file_doc]
                    .into_iter()
                    .flatten()
                    .map(|d| d.trim().to_string())
                    .filter(|d| !d.is_empty())
                    .collect(),
                lines: node.loc,
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
ON A LARGE REPO, ASK. `functions` in the sanity_open response is the real size of the \
job: at ten functions per reader, ten thousand functions is over a thousand \
subagents. If that is more than the user has agreed to spend, say what a full pass would \
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
pub const READER_PROMPT: &str = "\
  You are reading a codebase you have never seen, and you are assessing EXACTLY TEN \
  functions, ONE AT A TIME. Repeat this ten times: call sanity_next with no arguments and \
  it hands you exactly one function; write what you expect its body to do from the name, \
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
    let key = project_key(&path);
    if let Ok(mut s) = state.lock() {
        s.ping("sanity_open");
    }

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
    let reopened = state
        .lock()
        .map(|s| s.projects.contains_key(&key))
        .unwrap_or(false);

    let scan_path = path.clone();
    let scanned = tokio::task::spawn_blocking(move || {
        crate::scan::scan(
            &scan_path,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &std::sync::atomic::AtomicBool::new(false),
            &crate::cache::Cache::ephemeral(),
            crate::scan::Fidelity::Ordering,
        )
    })
    .await;

    let scan = match scanned {
        Ok(Ok(s)) => s,
        Ok(Err(e)) => return Json(serde_json::json!({ "ok": false, "error": e.to_string() })),
        Err(e) => return Json(serde_json::json!({ "ok": false, "error": e.to_string() })),
    };

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| key.clone());
    let (functions, excluded) = count_funcs(&scan);
    let shape = shape_of(&scan);

    let Ok(mut s) = state.lock() else {
        return Json(serde_json::json!({ "ok": false, "error": "state poisoned" }));
    };
    // Reloaded from `.sanity/` against the fresh tree rather than carried over from the
    // old Project. In-memory reports are keyed by node id, and node ids embed `@line` —
    // carrying them across a rescan would orphan every reading in a file where anything
    // moved. `load_reports` resolves the durable `key_of` entries onto the new ids, which
    // is the same thing `restore` does and the only correct way to cross a rescan.
    let reports = load_reports(&path, &scan);
    let assessed = reports.len();
    let stale = count_stale(&scan, &reports);
    // Keep its place in the history; the reopen is not a new project.
    let touched = s.projects.get(&key).map(|p| p.touched).unwrap_or(0);
    s.projects.insert(
        key.clone(),
        Project {
            repo: path,
            name: name.clone(),
            scan,
            reports,
            // Dropped, not carried. A lease is a claim on a node id, and the ids just
            // moved — a lease that survives a rescan reserves whatever now sits at that
            // line. They expire in ten minutes regardless, and a reader whose function is
            // released twice costs one duplicate reading; a reader silently blocked from
            // work that was never really held costs coverage.
            leased: HashMap::new(),
            recent_files: HashMap::new(),
            file_marks: HashMap::new(),
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
        "functions": functions, "assessed": assessed,
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
        // The two halves, rejoined for the one caller that needs both — it has to read
        // the orchestration half and paste the reader half.
        "stale": stale, "protocol": format!("{PROTOCOL}{READER_PROMPT}"),
    }))
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
        if node.kind != NodeKind::Func {
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

/// Functions whose reading still describes them.
///
/// `reports.len()` is not this number, and reporting it as one is the same failure as
/// counting leased work in `done`: a reading whose body has moved is history, not
/// coverage, and `collect_tasks` has already put that function back in the queue.
/// `ProjectSummary` subtracted stale and `/status` did not, so the sidebar and the agent
/// driving the assessment disagreed about how far along it was — and the agent's copy was
/// the optimistic one. An instrument that overstates its own coverage is worse than one
/// that measures nothing.
fn assessed(project: &Project) -> usize {
    project
        .reports
        .len()
        .saturating_sub(count_stale(&project.scan, &project.reports))
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
    let mut counts: HashMap<&str, usize> = HashMap::new();
    let mut fresh: HashMap<(&str, usize), &crate::parse::FuncDef> = HashMap::new();
    for d in &defs {
        let ord = counts.entry(d.name.as_str()).or_insert(0);
        fresh.insert((d.name.as_str(), *ord), d);
        *ord += 1;
    }

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
                c.body = Some(crate::assessment::reading_hash(d.doc.as_deref(), &d.body));
                true
            }
            None => false,
        }
    });
    true
}

/// Re-cut every file that has moved since we last looked.
///
/// Called before anything is handed out, which is the only place it can be: a range is
/// wrong from the moment the file changes, and the queue is what turns a range into a
/// reader's instruction. Doing it here rather than on a file-watcher keeps it to one
/// mechanism with no background thread to be out of date in its own way.
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
    let Ok(mut state) = state.lock() else {
        return Json(Vec::new());
    };
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

async fn report(
    State(state): State<Shared>,
    Json(req): Json<ReportRequest>,
) -> Json<serde_json::Value> {
    let r = req.report;
    let Ok(mut state) = state.lock() else {
        return Json(serde_json::json!({ "ok": false }));
    };
    let Some(key) = state.for_client(req.project.as_deref()) else {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
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
    let Ok(mut state) = state.lock() else {
        return Json(serde_json::json!({ "open": false }));
    };
    // Status counts as activity. It did not, and it is the call a driving loop makes most
    // often, so a reader could poll for minutes with the window insisting nothing was
    // happening. Its mood is deliberately the quietest in the set: at this frequency
    // anything livelier would drown the calls that mean something.
    state.ping("sanity_status");
    let projects: Vec<serde_json::Value> = state
        .projects
        .values()
        .map(|p| {
            serde_json::json!({
                "name": p.name,
                "repo": p.repo.to_string_lossy(),
                "functions": count_funcs(&p.scan).0,
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
            Json(serde_json::json!({
                "open": true,
                // Named `project`, not `active`: this answer is about the caller's repo,
                // and calling it "active" was how a driving session read another repo's
                // numbers as its own. Every status response says what it answered about
                // so a mismatch is visible even to a caller that supplied no key.
                "project": p.name,
                "repo": p.repo.to_string_lossy(),
                "functions": count_funcs(&p.scan).0,
                "excluded": count_funcs(&p.scan).1,
                // Stale readings excluded, so this agrees with the sidebar and with
                // `remaining` — see [`assessed`].
                "assessed": p.reports.len().saturating_sub(stale),
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
    let Ok(mut state) = state.lock() else {
        return Json(serde_json::json!({ "open": false }));
    };
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
    Json(serde_json::json!({
        "open": true,
        "repo": project.repo.to_string_lossy(),
        "functions": count_funcs(&project.scan).0,
        "excluded": count_funcs(&project.scan).1,
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
                    functions: count_funcs(&p.scan).0,
                    excluded: count_funcs(&p.scan).1,
                    assessed: p.reports.len().saturating_sub(stale),
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
                        functions: 0,
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
    let dir = dirs::data_dir()?.join("Sanity");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("agent-endpoint.json"))
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
    if let Ok(mut s) = state.lock() {
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
                if let Ok(mut s) = state.lock() {
                    settled(&mut s);
                }
                continue;
            }
            // The scan already counts what it is doing; the restore used to discard it and
            // leave the sidebar with nothing to say for the length of a large repo.
            let progress_key = known.key.clone();
            let progress_state = state.clone();
            let on_progress = move |p: crate::scan::Progress| {
                if let Ok(mut s) = progress_state.lock() {
                    s.restoring_progress
                        .insert(progress_key.clone(), (p.done, p.total));
                }
            };
            let Ok(scan) = crate::scan::scan(
                &path,
                &crate::surprise::HeuristicModel,
                &on_progress,
                &|_, _: &crate::surprise::Reading| {},
                &std::sync::atomic::AtomicBool::new(false),
                &crate::cache::Cache::ephemeral(),
                // A queue sort key, not a number anyone sees — see `scan::Fidelity`.
                crate::scan::Fidelity::Ordering,
            ) else {
                if let Ok(mut s) = state.lock() {
                    settled(&mut s);
                }
                continue;
            };
            let Ok(mut s) = state.lock() else { return };
            settled(&mut s);
            let reports = load_reports(&path, &scan);
            s.projects.insert(
                known.key.clone(),
                Project {
                    repo: path,
                    name: known.name.clone(),
                    scan,
                    reports,
                    leased: HashMap::new(),
                    recent_files: HashMap::new(),
                    file_marks: HashMap::new(),
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
        let Ok(mut s) = state.lock() else { return };
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
pub async fn serve(state: Shared) -> anyhow::Result<u16> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    if let Some(path) = endpoint_file() {
        let _ = std::fs::write(
            path,
            serde_json::json!({ "port": port, "pid": std::process::id() }).to_string(),
        );
    }
    let app = router(state);
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });
    Ok(port)
}

#[cfg(test)]
mod tests {
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
            lines: 10,
        }
    }

    fn project_of(dir: &std::path::Path) -> Project {
        let scan = crate::scan::scan(
            dir,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &std::sync::atomic::AtomicBool::new(false),
            &crate::cache::Cache::ephemeral(),
            crate::scan::Fidelity::Ordering,
        )
        .unwrap();
        Project {
            repo: dir.to_path_buf(),
            name: "t".into(),
            scan,
            reports: HashMap::new(),
            leased: HashMap::new(),
            recent_files: HashMap::new(),
            file_marks: HashMap::new(),
            touched: 0,
            last_agent: None,
        }
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
        let home = tempfile::tempdir().unwrap();
        // `save_index`/`load_index` resolve under the data dir, so point it at a temp one.
        // Serialised against other tests by being the only one that touches these vars.
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let prev = std::env::var("XDG_DATA_HOME").ok();
        let prev_home = std::env::var("HOME").ok();
        unsafe {
            std::env::set_var("XDG_DATA_HOME", home.path());
            std::env::set_var("HOME", home.path());
        }

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

        unsafe {
            match prev {
                Some(v) => std::env::set_var("XDG_DATA_HOME", v),
                None => std::env::remove_var("XDG_DATA_HOME"),
            }
            match prev_home {
                Some(v) => std::env::set_var("HOME", v),
                None => std::env::remove_var("HOME"),
            }
        }
    }

    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

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
            out.into_iter().map(|(_, t)| t.id).collect()
        };
        assert_eq!(ids.len(), 2, "fixture should offer two functions");

        // Nothing out: no leases, nothing itemised.
        assert_eq!(work_left(&p).in_flight, 0);
        assert!(work_left(&p).outstanding.is_empty());

        // One out with a reader: counted, itemised, and by its id.
        p.leased.insert(ids[0].clone(), Instant::now());
        let w = work_left(&p);
        assert_eq!(w.remaining, 2, "a lease is not a reading; remaining holds");
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
        assert_eq!(w.remaining, 1);
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
        let tasks: Vec<Task> = out.into_iter().map(|(_, t)| t).collect();
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
        let names: Vec<String> = out.into_iter().map(|(_, t)| t.name).collect();
        assert_eq!(names, vec!["one"], "excluded functions are never handed out");

        // And the shape a reader would use to propose one still shows both halves, or it
        // could not have proposed anything.
        let shape = shape_of(&p.scan);
        let tests = shape.iter().find(|r| r["dir"] == "tests").expect("tests/ in the shape");
        assert_eq!(tests["excluded"], 2);
        assert_eq!(tests["functions"], 0);
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
        // The window has drifted onto somebody else's repo.
        state.active = Some("/theirs".into());
        let shared: Shared = Arc::new(Mutex::new(state));

        let Json(out) = status(
            State(shared.clone()),
            Query(StatusParams { project: Some("/mine".into()) }),
        )
        .await;
        assert_eq!(out["project"], "mine", "status followed the window, not the caller");
        assert!(out["repo"].as_str().unwrap().contains(mine.path().to_str().unwrap()));

        // No key — the window is the honest default, and the answer still says whose it is.
        let Json(out) = status(State(shared), Query(StatusParams { project: None })).await;
        assert_eq!(out["project"], "theirs");
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
    fn two_projects() -> (tempfile::TempDir, AppState) {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let mut state = AppState::default();
        state.projects.insert("/x".into(), project_of(dir.path()));
        state.projects.insert("/y".into(), project_of(dir.path()));
        (dir, state)
    }

    /// Opening a repo must not take the pane away from whoever is reading it.
    ///
    /// This is the whole of the `sanity study` question: the human is looking at one repo
    /// in the window, a headless run opens another, and the view has to stay put while
    /// the new project still becomes fully addressable. It is also the two-agents case —
    /// `for_client` keeps their *routing* apart, and this keeps their *view* apart.
    #[test]
    fn an_unasked_open_does_not_steal_the_window() {
        let (dir, mut state) = two_projects();
        let _dir = dir;
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
        let (dir, mut state) = two_projects();
        let _dir = dir;
        assert!(state.focus("/y", false), "nothing was being looked at");
        assert_eq!(state.active.as_deref(), Some("/y"));

        // An `active` naming a project that is not loaded is the same situation wearing a
        // key: it points at nothing, so it is not a view being taken from anybody.
        state.active = Some("/gone".into());
        assert!(state.focus("/y", false));
        assert_eq!(state.active.as_deref(), Some("/y"));
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
