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

use crate::model::{Node, NodeKind};
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
}

impl AppState {
    /// Write the project list to disk.
    ///
    /// Called on every change rather than at exit: the app restarts on every code change
    /// during development and gets killed rather than quit in normal use, so "save on
    /// close" means "usually do not save".
    pub fn persist(&self) {
        let mut index = crate::reports::KnownProjects {
            active: self.active.clone(),
            projects: self
                .projects
                .iter()
                .map(|(key, p)| crate::reports::KnownProject {
                    key: key.clone(),
                    repo: p.repo.to_string_lossy().to_string(),
                    name: p.name.clone(),
                    touched: p.touched,
                })
                .collect(),
        };
        index.projects.sort_by_key(|p| std::cmp::Reverse(p.touched));
        crate::reports::save_index(&index);
    }

    pub fn touch(&mut self, key: &str) {
        self.clock += 1;
        let c = self.clock;
        if let Some(p) = self.projects.get_mut(key) {
            p.touched = c;
        }
        self.active = Some(key.to_string());
        self.persist();
    }

    pub fn ping(&mut self, tool: &str) {
        self.last_agent = Some(Instant::now());
        self.last_tool = tool.to_string();
        self.pings += 1;
    }

    /// Which project a call belongs to.
    ///
    /// The client's own answer wins; `active` is the fallback for anything that did not
    /// supply one. That order matters: `active` is *which repo the window follows*, and
    /// it changes whenever any agent opens anything. Using it to answer "whose work is
    /// this" meant two agents on two repos silently merged — the second one to call
    /// `sanity_open` took ownership of the first one's queue, its leases and its
    /// readings, and the first one's orchestrator never knew it had changed repos.
    pub fn for_client(&self, project: Option<&str>) -> Option<String> {
        match project {
            Some(k) if self.projects.contains_key(k) => Some(k.to_string()),
            _ => self.active.clone(),
        }
    }

    fn active_project(&self) -> Option<&Project> {
        self.projects.get(self.active.as_ref()?)
    }
}

/// How long a handed-out function stays reserved.
///
/// Long enough that a reader predicting, opening a file and writing a report is never
/// raced; short enough that a subagent which dies mid-batch returns its work rather than
/// stranding it. Nothing is lost either way — an expired lease just re-queues.
const LEASE: Duration = Duration::from_secs(600);

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
    pub name: String,
    /// The declaration line. Without it an overloaded name is unresolvable — the reader
    /// sees the same name twice in `peers` and has to guess which one it was handed.
    #[serde(default)]
    pub signature: String,
    /// Other functions in the same file — the context a teammate would have.
    pub peers: Vec<String>,
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
            model: String::new(),
            body: String::new(),
            by: String::new(),
            at: String::new(),
        }
    }

    /// The two grades, with pre-grade reports folded in.
    ///
    /// An old report only knew surprised-or-not, so it maps to the ends of the scale.
    /// Coarse, but it is what that reader actually said — inventing a middle grade for
    /// it would be making up a judgement nobody made.
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
                name: node.name.clone(),
                signature: node.signature.clone().unwrap_or_default(),
                peers: Vec::new(),
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
        // Deduped: cfg-gated variants and same-named methods in different impl blocks
        // share a name, and listing one twice reads as a mistake in the file rather than
        // in this list.
        let mut names: Vec<String> = node.children.iter().map(|c| c.name.clone()).collect();
        names.sort();
        names.dedup();
        let before = out.len();
        for c in &node.children {
            collect_tasks(c, done, leased, root, node.doc.as_deref(), out);
        }
        for (_, t) in out.iter_mut().skip(before) {
            t.peers = names.iter().filter(|n| **n != t.name).cloned().collect();
        }
        return;
    }
    for c in &node.children {
        collect_tasks(c, done, leased, root, None, out);
    }
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

fn default_n() -> usize {
    5
}

#[derive(Deserialize)]
pub struct OpenRequest {
    pub path: String,
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
const PROTOCOL: &str = "\
HOW TO RUN THIS — read all of it before starting.\n\n\
This is a LOOP, not a single pass. One batch of ten assesses two percent of a real repo; \
stopping there leaves the map almost entirely grey and the job is not done.\n\n\
YOUR JOB (the session that called sanity_open):\n\
  1. Spawn 3-5 subagents IN PARALLEL, each with the prompt below. The queue reserves what \
     it hands out, so parallel readers get different functions.\n\
  2. When they return, call sanity_status and read `remaining` and `in_flight`.\n\
  3. If remaining > 0, go back to step 1 — UNLESS remaining == in_flight, which means \
     everything left is already out with a reader and another wave would only wait. Keep \
     going until remaining is 0, or until you hit a limit the user gave you. `remaining` \
     ignores leases, so it does not flicker between calls and only falls when a reading \
     actually lands.\n\
  4. Only then summarise: how many assessed, how many surprising, and what the surprises \
     were. If you stopped before remaining hit 0, SAY SO and say how many are left — \
     'done' and 'out of budget' are different outcomes and the user needs to know which.\n\n\
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
SUBAGENT PROMPT:\n\n\
  You are reading a codebase you have never seen. Call sanity_next to get functions — you \
  will get names, SIGNATURES, locations, sibling names and any DOCS the code carries, but \
  NOT bodies. For each one, first write what you expect the body to do from that alone — \
  the docs are part of what you are given, because a reader has them too. Only then open \
  abs_path and read it.\n\n\
  Work through them IN THE ORDER GIVEN and do not skim ahead. Successive functions come \
  from different files on purpose, so that each prediction is made before you have opened \
  that file. Reading ahead is what turns a prediction into a recollection.\n\n\
  IF A SANITY TOOL ERRORS: read the message. Connection failures are usually transient — \
  the app restarts during development — so wait a moment and call the same tool again, up \
  to about five times. Do not invent a prerequisite, do not run sanity tools as shell \
  commands, and do NOT read the .sanity/ directory to compensate: it contains the previous \
  reader's findings and looking at it makes everything you say afterwards worthless. If it \
  keeps failing, stop and say Sanity is down.\n\n\
  Then call sanity_report with:\n\
    expected    what you predicted, before reading.\n\
    found       what is actually there.\n\
    predicted   how much of the body your prediction covered:\n\
                  full  — you called it; nothing in the body you missed.\n\
                  most  — broadly right, one detail that was not obvious.\n\
                  some  — recognisable, but it does real work you did not cover.\n\
                  none  — your prediction did not describe this code.\n\
    documented  how well the docs you were given cover what the code does, same scale. \
                Use none if there were no docs.\n\
    derivable   true if those docs say nothing you could not have worked out from the \
                code itself. A comment that restates the signature is derivable. This is \
                what stops generated documentation from counting as documentation, so \
                answer it honestly even when the docs read well.\n\
    cold        true if you had not read that file before predicting.\n\
    model       which model you are, name and version, e.g. claude-haiku-4.5. A \
                prediction is only worth what the reader that made it is worth, and \
                every reading here is attributed. Say what you are; omit it rather \
                than guess.\n\n\
  Grade `predicted` against what you wrote BEFORE reading, not against what you now \
  understand — the point is what the code told a stranger, not what you can see in \
  hindsight. Do not read any file before predicting its function. Assess 10, then stop \
  and report how many remain.";

/// Open a repo and make it what the window is showing.
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

    // Already held: just bring it forward, keeping whatever has been reported about it.
    if let Ok(mut s) = state.lock() {
        if s.projects.contains_key(&key) {
            s.touch(&key);
            let p = s.projects.get(&key).unwrap();
            return Json(serde_json::json!({
                "ok": true, "reopened": true, "project": key, "name": p.name,
                "functions": count_funcs(&p.scan), "assessed": p.reports.len(),
                "stale": count_stale(&p.scan, &p.reports), "protocol": PROTOCOL,
            }));
        }
    }

    let scan_path = path.clone();
    let scanned = tokio::task::spawn_blocking(move || {
        crate::scan::scan(
            &scan_path,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &std::sync::atomic::AtomicBool::new(false),
            &crate::cache::Cache::ephemeral(),
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
    let functions = count_funcs(&scan);

    let Ok(mut s) = state.lock() else {
        return Json(serde_json::json!({ "ok": false, "error": "state poisoned" }));
    };
    let reports = load_reports(&path, &scan);
    let assessed = reports.len();
    let stale = count_stale(&scan, &reports);
    s.projects.insert(
        key.clone(),
        Project {
            repo: path,
            name: name.clone(),
            scan,
            reports,
            leased: HashMap::new(),
            touched: 0,
            last_agent: Some(Instant::now()),
        },
    );
    s.touch(&key);
    Json(serde_json::json!({
        "ok": true, "project": key, "name": name, "functions": functions, "assessed": assessed,
        "stale": stale, "protocol": PROTOCOL,
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
fn work_left(project: &Project) -> (usize, usize) {
    let none = HashMap::new();
    let mut unread = Vec::new();
    collect_tasks(&project.scan.root, &project.reports, &none, None, None, &mut unread);
    let mut available = Vec::new();
    collect_tasks(
        &project.scan.root,
        &project.reports,
        &project.leased,
        None,
        None,
        &mut available,
    );
    (unread.len(), unread.len().saturating_sub(available.len()))
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

fn count_funcs(scan: &Scan) -> usize {
    let mut n = 0;
    scan.root.visit(&mut |x| {
        if x.kind == NodeKind::Func {
            n += 1
        }
    });
    n
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
async fn queue(State(state): State<Shared>, Query(p): Query<QueueParams>) -> Json<Vec<Task>> {
    let Ok(mut state) = state.lock() else {
        return Json(Vec::new());
    };
    let Some(key) = state.for_client(p.project.as_deref()) else {
        return Json(Vec::new());
    };
    state.ping("sanity_next");
    let Some(project) = state.projects.get_mut(&key) else {
        return Json(Vec::new());
    };
    project.last_agent = Some(Instant::now());

    let mut tasks: Vec<(f32, Task)> = Vec::new();
    collect_tasks(
        &project.scan.root,
        &project.reports,
        &project.leased,
        Some(project.repo.as_path()),
        None,
        &mut tasks,
    );
    let handed = interleave_by_file(tasks, p.n);

    // Reserved as they go out, so the next caller — very likely a sibling subagent
    // running at the same moment — gets different work.
    let now = Instant::now();
    for t in &handed {
        project.leased.insert(t.id.clone(), now);
    }
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
        return Json(serde_json::json!({ "ok": false, "error": "no project open" }));
    };
    state.ping("sanity_report");
    let Some(project) = state.projects.get_mut(&key) else {
        return Json(serde_json::json!({ "ok": false, "error": "no project open" }));
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

    project.reports.insert(r.id.clone(), r);
    // Written through on every report. An assessment is minutes of an agent's work and
    // must not depend on the app exiting cleanly to survive.
    let write_error = save_reports(&project.repo, &project.scan, &project.reports).err();

    let (remaining, in_flight) = work_left(project);

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
            "Only {surprised} of {total} flagged as surprising. If you are reading files \
             you already knew, or being agreeable, these results mean nothing — use a \
             fresh subagent."
        );
    }
    // A failed write outranks any coaching about the reading itself: carrying on for
    // another two hundred functions that are also not being saved is the worst outcome
    // available, and only the agent is in a position to stop.
    if let Some(e) = &write_error {
        hint = e.clone();
    }
    Json(serde_json::json!({
        "ok": write_error.is_none(),
        "saved": write_error.is_none(),
        "error": write_error,
        "remaining": remaining,
        "in_flight": in_flight,
        "assessed": total,
        "surprised": surprised,
        "warm_reports": warm,
        "hint": hint,
    }))
}

async fn status(State(state): State<Shared>) -> Json<serde_json::Value> {
    let Ok(state) = state.lock() else {
        return Json(serde_json::json!({ "open": false }));
    };
    let projects: Vec<serde_json::Value> = state
        .projects
        .values()
        .map(|p| {
            serde_json::json!({
                "name": p.name,
                "repo": p.repo.to_string_lossy(),
                "functions": count_funcs(&p.scan),
                "assessed": p.reports.len(),
            })
        })
        .collect();
    match state.active_project() {
        Some(p) => {
            // The loop's termination condition, so a driving agent can ask "is there
            // work left" without having to infer it from a report response it may never
            // have seen — subagent tool results do not reach the parent.
            let (remaining, in_flight) = work_left(p);
            let stale = count_stale(&p.scan, &p.reports);
            Json(serde_json::json!({
                "open": true,
                "active": p.name,
                "repo": p.repo.to_string_lossy(),
                "functions": count_funcs(&p.scan),
                "assessed": p.reports.len(),
                // Lease-independent, so two callers a second apart agree. It only falls
                // when a reading actually lands.
                "remaining": remaining,
                // What the leases explain. Polling `remaining` and seeing it flat while
                // this is non-zero means readers are working, not stuck.
                "in_flight": in_flight,
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
        None => Json(serde_json::json!({ "open": false, "projects": projects })),
    }
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
                    functions: count_funcs(&p.scan),
                    assessed: p.reports.len().saturating_sub(stale),
                    stale,
                    touched: p.touched,
                }
            })
            .collect();
        // Most recently touched first — the sidebar should read as a history.
        projects.sort_by_key(|p| std::cmp::Reverse(p.touched));
        ProjectList {
            active: state.active.clone(),
            projects,
        }
    }
}

pub fn router(state: Shared) -> Router {
    Router::new()
        .route("/open", post(open_project))
        .route("/queue", get(queue))
        .route("/report", post(report))
        .route("/status", get(status))
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

/// Rebuild the projects sanity had open, in the background.
///
/// Scans are recomputed rather than stored: a saved tree would be wrong the moment a file
/// changed, and rescanning costs about a second. Assessments come back from disk with the
/// project, which is the part that actually could not be recovered.
///
/// A repo that has moved or been deleted is dropped silently — a sidebar entry that opens
/// nothing is worse than one that quietly disappeared.
pub fn restore(state: Shared) {
    let index = crate::reports::load_index();
    if index.projects.is_empty() {
        return;
    }
    std::thread::spawn(move || {
        for known in index.projects.iter().rev() {
            let path = PathBuf::from(&known.repo);
            if !path.is_dir() {
                continue;
            }
            let Ok(scan) = crate::scan::scan(
                &path,
                &crate::surprise::HeuristicModel,
                &|_| {},
                &|_, _: &crate::surprise::Reading| {},
                &std::sync::atomic::AtomicBool::new(false),
                &crate::cache::Cache::ephemeral(),
            ) else {
                continue;
            };
            let Ok(mut s) = state.lock() else { return };
            let reports = load_reports(&path, &scan);
            s.projects.insert(
                known.key.clone(),
                Project {
                    repo: path,
                    name: known.name.clone(),
                    scan,
                    reports,
                    leased: HashMap::new(),
                    touched: known.touched,
                    last_agent: None,
                },
            );
            // Restored in reverse order so the last one touched is the last one in, and
            // the window lands back where it was rather than on an arbitrary project.
            if index.active.as_deref() == Some(known.key.as_str())
                || index.active.is_none()
            {
                s.touch(&known.key);
            }
        }
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
            name: name.to_string(),
            signature: String::new(),
            peers: Vec::new(),
            docs: Vec::new(),
            lines: 10,
        }
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
}
