//! The `/reveal` endpoint: the body of one task, traded for the prediction.
//!
//! The prediction is recorded on the server before any source goes back, and a second call
//! cannot revise it. The extent is re-cut first, a function gets its own lines and a file
//! task the whole file, and a body over [`PART_BYTES`] is served in parts whose receipt is
//! recorded in [`Revealed`] so `/report` can refuse a reading of a body its reader never
//! finished. Past [`READ_CEILING`] nothing is served at all.

use super::protocol::NO_PROJECT;
use super::queue::LEASE;
use super::resync::resync_changed;
use super::{lock, Shared};
use crate::model::NodeKind;
use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use std::time::Instant;

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
    pub(super) fn whole(&self) -> bool {
        self.seen.len() >= self.parts
    }

    /// The parts still owed, for an error that says what to do.
    pub(super) fn missing(&self) -> Vec<usize> {
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
    pub(super) project: Option<String>,
    pub(super) id: String,
    /// What the reader expects the body to do. Recorded before any bytes go back.
    pub(super) expected: String,
    /// Which part of the body to send, 1-based. Absent means the first.
    ///
    /// Defaulted rather than required so the call a reader makes for an ordinary function is
    /// exactly the call it made before — most bodies are one part, and paying for a
    /// paging argument on every reading to serve the few that are not is the same trade
    /// [`PROTOCOL`] refuses elsewhere. The response says when there is more.
    #[serde(default)]
    pub(super) part: Option<usize>,
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
pub(super) async fn reveal(
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
        state.ping();
        return Json(serde_json::json!({
            "ok": false,
            "error": format!("No open project holds `{}`, so there is no source to show.", req.id),
            "hint": "The repo was very likely rescanned since you were handed this task — \
                     ids carry line numbers and they move. Call sanity_next for fresh work.",
        }));
    };
    let Some(project) = state.projects.get_mut(&key) else {
        state.ping();
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    project.last_agent = Some(Instant::now());
    if project.leased.get(&req.id).is_none_or(|t| t.elapsed() >= LEASE) {
        state.ping();
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
            state.ping();
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
        state.ping();
        return Json(serde_json::json!({
            "ok": false,
            "error": format!("`{}` is no longer in this repo's scan.", req.id),
            "hint": "Call sanity_next for fresh work.",
        }));
    };

    let text = match std::fs::read_to_string(project.repo.join(&path)) {
        Ok(t) => t,
        Err(e) => {
            state.ping();
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
    state.ping();
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::landing::report;
    use crate::agentapi::tests::{data_home, lease_kind, project_of};
    use crate::agentapi::{AppState, Grade, Report, ReportRequest};
    use std::sync::{Arc, Mutex};

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
}
