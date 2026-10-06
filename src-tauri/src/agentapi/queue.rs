//! The `/queue` endpoint: which task goes out next, in what order, and the lease that holds it.
//!
//! Ranked by band and then by the proxy, with unread code a live finding points at lifted
//! ahead of the rest, and spread across files so a reader is never handed recall dressed as
//! prediction — within one handout by `interleave_by_file`, and between calls by resting a
//! file just drawn from. The Read dialog's projection of a run is the same order, counted in
//! lines ([`reading_curve`]).

use super::resync::resync_changed;
use super::run::BATCH;
use super::tasks::collect_tasks;
use super::{lock, FindingsAt, Project, Shared, Task};
use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::{Duration, Instant};

/// How long a handed-out function stays reserved.
///
/// Long enough that a reader predicting, opening a file and writing a report is never
/// raced; short enough that a subagent which dies mid-batch returns its work rather than
/// stranding it. Nothing is lost either way — an expired lease just re-queues.
pub(super) const LEASE: Duration = Duration::from_secs(600);

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

#[derive(Deserialize)]
pub struct QueueParams {
    #[serde(default = "default_n")]
    pub(super) n: usize,
    /// Which project is asking.
    ///
    /// Supplied by the stdio shim, not by the agent — see `mcp.rs`. The shim handled this
    /// client's `sanity_open`, so it knows the answer and cannot forget it; asking the
    /// model to carry a key through every call would put the one thing that keeps two
    /// sessions apart inside a prompt, where a compaction can drop it.
    #[serde(default)]
    pub(super) project: Option<String>,
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

/// Put unread code a finding points at ahead of the rest of the unread.
///
/// **The first readings go where the free list pointed.** On a repo nobody has read, the
/// findings that fire are the ones that need no reading — giant, tangled, load-bearing and
/// unread — and `sanity findings` shows them before anyone has spent a token. A `check
/// --limit 50` that then read fifty other functions by the proxy's guess would answer a
/// question nobody asked and leave the list it was run to act on exactly as it was.
///
/// Its own band, [1, 2]: above the rest of the unread at [0, 1], below stale at [2, 3],
/// which `collect_tasks` leaves room for. Within the band the proxy still orders, and
/// `spread_across_files` still rests a file just drawn from — a flagged body in a file a
/// reader has just opened is a warm reading, and coldness outranks this. Unread means no
/// report at all, which is what the finding said; stale and dated work keep their bands.
///
/// Settled findings don't count: a finding somebody dismissed is not pointing anywhere.
fn findings_first(project: &mut Project, tasks: &mut [(f32, Task)]) {
    let flagged = flagged(project);
    if flagged.is_empty() {
        return;
    }
    for (priority, t) in tasks.iter_mut() {
        let (subject, stored) = if t.file {
            (t.path.as_str(), crate::assessment::file_key(&t.path))
        } else {
            (t.id.as_str(), t.id.clone())
        };
        if flagged.contains(subject) && !project.reports.contains_key(&stored) {
            *priority += 1.0;
        }
    }
}

/// What [`findings_first`] ranks by, worked out once per key — see `Project::flagged`.
fn flagged(project: &mut Project) -> std::sync::Arc<std::collections::HashSet<String>> {
    let at = FindingsAt { reads: 0, ..FindingsAt::of(project) };
    if let Some((held, set)) = &project.flagged {
        if *held == at {
            return set.clone();
        }
    }
    let traced = crate::findings::Traced::of(&project.scan.stats, project.trace.depth);
    let facts = crate::findings::subjects(&project.scan.root, &project.reports, traced);
    let rules = crate::findings::rules_for(&project.repo, &facts);
    let archive = crate::findings::archive(&project.repo);
    let pins = crate::findings::pinned(&archive);
    // `Subject::key` is `key_of` for a function — the key readings are stored under, which
    // is also what a function's `Task::id` is — and the path for a file.
    let set: std::sync::Arc<std::collections::HashSet<String>> = std::sync::Arc::new(
        rules
            .iter()
            .flat_map(|r| crate::findings::live_hits(r, &facts, &pins).0)
            .map(|s| s.key.clone())
            .collect(),
    );
    project.flagged = Some((at, set.clone()));
    set
}

pub(super) async fn queue(State(state): State<Shared>, Query(p): Query<QueueParams>) -> Json<Vec<Task>> {
    let mut state = lock(&state);
    let Some(key) = state.for_client(p.project.as_deref()) else {
        return Json(Vec::new());
    };
    let Some(project) = state.projects.get_mut(&key) else {
        state.ping();
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
        None,
        &crate::scan::declared_from_scan(&project.repo, &project.scan.root),
        &mut tasks,
    );
    findings_first(project, &mut tasks);
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
    state.ping();
    Json(handed)
}

/// Lines of code the queue will have handed out, at each step of a partial run.
///
/// **The Read dialog's two bars only differ because this exists.** Lines and tokens are both
/// magnitudes of the same slider, and if lines are apportioned — total outstanding times the
/// fraction chosen — then the two are the same number twice and the bars paint identically.
/// They are not the same thing: reading the first two hundred functions costs whatever those
/// two hundred functions happen to be, and the queue hands them out in a decided order —
/// stale first, then unread code a finding points at, then the rest of the unread,
/// round-robined across files. So a partial run's size in lines is a fact that can be looked
/// up rather than estimated, and a repo whose expired readings sit in its long functions says
/// so on the way up.
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
    collect_tasks(
        &project.scan.root,
        &project.reports,
        &HashMap::new(),
        None,
        &crate::scan::declared_from_scan(&project.repo, &project.scan.root),
        &mut tasks,
    );
    // The same band the queue gives findings, or this projects a run that never happens.
    findings_first(project, &mut tasks);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::{data_home, project_of};
    use crate::agentapi::{AppState, Report, READ_CEILING};
    use crate::agentapi::coverage::count_funcs;
    use crate::model::NodeKind;
    use std::sync::{Arc, Mutex};

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

    /// The first readings go where the free findings pointed, and stale work still goes first.
    ///
    /// A repo-local rule flags exactly one body, so which one is flagged does not depend on
    /// how the shipped rules calibrate against three tiny files.
    #[test]
    fn findings_come_before_the_rest_of_the_unread_and_stale_before_both() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("big.rs"),
            "fn flagged() {\n    println!(\"1\");\n    println!(\"2\");\n    println!(\"3\");\n    \
             println!(\"4\");\n    println!(\"5\");\n    println!(\"6\");\n    println!(\"7\");\n    \
             println!(\"8\");\n}\n",
        )
        .unwrap();
        std::fs::write(dir.path().join("small.rs"), "fn plain() { println!(\"p\"); }\n").unwrap();
        std::fs::write(dir.path().join("moved.rs"), "fn moved() { println!(\"m\"); }\n").unwrap();
        std::fs::create_dir_all(dir.path().join(".sanity/rules")).unwrap();
        std::fs::write(
            dir.path().join(".sanity/rules/catalog.md"),
            "- `long-unread`; func: ncloc >= 8 and read < 1; title: Long and unread; so what: Long.\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        // `moved` was read against a body it no longer has.
        let mut moved = None;
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func && n.name == "moved" {
                moved = Some(n.id.clone());
            }
        });
        let moved = moved.expect("moved is parsed");
        p.reports.insert(
            moved.clone(),
            Report { id: moved.clone(), body: "a body that is gone".into(), ..Report::blank() },
        );

        let mut tasks = Vec::new();
        collect_tasks(
            &p.scan.root,
            &p.reports,
            &HashMap::new(),
            None,
            &crate::scan::declared_from_scan(&p.repo, &p.scan.root),
            &mut tasks,
        );
        assert_eq!(flagged(&mut p).len(), 1, "the local rule flags one body and nothing else does");
        findings_first(&mut p, &mut tasks);
        let band = |name: &str| -> f32 {
            tasks.iter().find(|(_, t)| !t.file && t.name == name).map(|(s, _)| s.floor()).unwrap()
        };
        // The bands, not the order: within a band the proxy decides, and three tiny bodies
        // could come out in the right order by the proxy alone.
        assert_eq!(band("moved"), 2.0, "stale sits above everything unread");
        assert_eq!(band("flagged"), 1.0, "what a finding points at sits above the rest");
        assert_eq!(band("plain"), 0.0, "the rest of the unread");
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
}
