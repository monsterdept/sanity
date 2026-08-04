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
}

impl Report {
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
        if done.contains_key(&node.id) {
            return;
        }
        if leased
            .get(&node.id)
            .is_some_and(|t| t.elapsed() < LEASE)
        {
            return;
        }
        let priority = node.score.map_or(0.5, |s| s.surprise);
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
  2. When they return, call sanity_status and read `remaining`.\n\
  3. If remaining > 0, go back to step 1. Keep going until remaining is 0, or until you \
     hit a limit the user gave you.\n\
  4. Only then summarise: how many assessed, how many surprising, and what the surprises \
     were. If you stopped before remaining hit 0, SAY SO and say how many are left — \
     'done' and 'out of budget' are different outcomes and the user needs to know which.\n\n\
Do NOT assess in this session. Your context is contaminated: anything you have already \
read in this repo you will 'predict' from memory, which scores as unsurprising and makes \
the result meaningless. Every subagent must be fresh.\n\n\
SUBAGENT PROMPT:\n\n\
  You are reading a codebase you have never seen. Call sanity_next to get functions — you \
  will get names, locations, sibling names and any DOCS the code carries, but NOT bodies. \
  For each one, first write what you expect the body to do from that alone — the docs are \
  part of what you are given, because a reader has them too. Only then open abs_path and \
  read it.\n\n\
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
    cold        true if you had not read that file before predicting.\n\n\
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
                "ok": true, "reopened": true, "name": p.name,
                "functions": count_funcs(&p.scan), "assessed": p.reports.len(),
                "protocol": PROTOCOL,
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
    let reports = crate::reports::load(&key);
    let assessed = reports.len();
    s.projects.insert(
        key.clone(),
        Project {
            repo: path,
            name: name.clone(),
            scan,
            reports,
            leased: HashMap::new(),
            touched: 0,
        },
    );
    s.touch(&key);
    Json(serde_json::json!({
        "ok": true, "name": name, "functions": functions, "assessed": assessed,
        "protocol": PROTOCOL,
    }))
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
/// matter.
async fn queue(State(state): State<Shared>, Query(p): Query<QueueParams>) -> Json<Vec<Task>> {
    let Ok(mut state) = state.lock() else {
        return Json(Vec::new());
    };
    let Some(key) = state.active.clone() else {
        return Json(Vec::new());
    };
    state.ping("sanity_next");
    let Some(project) = state.projects.get_mut(&key) else {
        return Json(Vec::new());
    };

    let mut tasks: Vec<(f32, Task)> = Vec::new();
    collect_tasks(
        &project.scan.root,
        &project.reports,
        &project.leased,
        Some(project.repo.as_path()),
        None,
        &mut tasks,
    );
    tasks.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let handed: Vec<Task> = tasks.into_iter().take(p.n).map(|(_, t)| t).collect();

    // Reserved as they go out, so the next caller — very likely a sibling subagent
    // running at the same moment — gets different work.
    let now = Instant::now();
    for t in &handed {
        project.leased.insert(t.id.clone(), now);
    }
    Json(handed)
}

async fn report(State(state): State<Shared>, Json(r): Json<Report>) -> Json<serde_json::Value> {
    let Ok(mut state) = state.lock() else {
        return Json(serde_json::json!({ "ok": false }));
    };
    let Some(key) = state.active.clone() else {
        return Json(serde_json::json!({ "ok": false, "error": "no project open" }));
    };
    state.ping("sanity_report");
    let Some(project) = state.projects.get_mut(&key) else {
        return Json(serde_json::json!({ "ok": false, "error": "no project open" }));
    };
    project.leased.remove(&r.id);
    project.reports.insert(r.id.clone(), r);
    // Written through on every report. An assessment is minutes of an agent's work and
    // must not depend on the app exiting cleanly to survive.
    crate::reports::save(&key, &project.reports);

    let mut left = Vec::new();
    collect_tasks(
        &project.scan.root,
        &project.reports,
        &project.leased,
        None,
        None,
        &mut left,
    );

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
    Json(serde_json::json!({
        "ok": true,
        "remaining": left.len(),
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
            let mut left = Vec::new();
            collect_tasks(&p.scan.root, &p.reports, &p.leased, None, None, &mut left);
            Json(serde_json::json!({
                "open": true,
                "active": p.name,
                "repo": p.repo.to_string_lossy(),
                "functions": count_funcs(&p.scan),
                "assessed": p.reports.len(),
                "remaining": left.len(),
                "done": left.is_empty(),
                "next_step": if left.is_empty() {
                    "Every function has been assessed. Summarise the surprises.".to_string()
                } else {
                    format!("{} functions still unassessed — spawn another wave of subagents.", left.len())
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
    pub assessed: usize,
    pub touched: u64,
}

impl ProjectList {
    pub fn from_state(state: &AppState) -> ProjectList {
        let mut projects: Vec<ProjectSummary> = state
            .projects
            .iter()
            .map(|(key, p)| ProjectSummary {
                key: key.clone(),
                name: p.name.clone(),
                repo: p.repo.to_string_lossy().to_string(),
                functions: count_funcs(&p.scan),
                assessed: p.reports.len(),
                touched: p.touched,
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
            let reports = crate::reports::load(&known.key);
            s.projects.insert(
                known.key.clone(),
                Project {
                    repo: path,
                    name: known.name.clone(),
                    scan,
                    reports,
                    leased: HashMap::new(),
                    touched: known.touched,
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
