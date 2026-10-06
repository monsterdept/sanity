//! The `/status` and `/summary` endpoints: the two a driving session polls.
//!
//! Status is progress — remaining, in flight, the leases that have been out longest, the run
//! and its feed — answered for the caller's repo and never the window's. Summary is the
//! result, in aggregate only: nothing in it names a function or a file, because a per-file
//! breakdown would tell a reader what to expect before it predicts.

use super::coverage::{assessed, count_files, count_funcs, count_stale, work_left, Counts, WorkLeft};
use super::tally::aggregate;
use super::{lock, read_endpoint, suggested_model, Shared};
use axum::extract::{Query, State};
use axum::Json;
use serde::Deserialize;

/// How many outstanding leases `sanity_status` itemises. A diagnostic, not an inventory:
/// the oldest few answer "is a wave stuck", and the rest are the same answer again.
const OUTSTANDING_SHOWN: usize = 10;

#[derive(Deserialize)]
pub struct StatusParams {
    /// Which project is asking. Supplied by the stdio shim, like [`QueueParams::project`].
    #[serde(default)]
    pub(super) project: Option<String>,
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
pub(super) async fn status(
    State(state): State<Shared>,
    Query(p): Query<StatusParams>,
) -> Json<serde_json::Value> {
    let mut state = lock(&state);
    // Status counts as activity. It did not, and it is the call a driving loop makes most
    // often, so a reader could poll for minutes with the window insisting nothing was
    // happening. Its mood is deliberately the quietest in the set: at this frequency
    // anything livelier would drown the calls that mean something.
    state.ping();
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
                "assessed": assessed(&p.scan, &p.reports),
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
                "assessed": assessed(&p.scan, &p.reports),
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
                    "Every function has an up-to-date reading. Summarize what the readers could not predict.".to_string()
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
pub(super) async fn summary(
    State(state): State<Shared>,
    Query(p): Query<SummaryParams>,
) -> Json<serde_json::Value> {
    let mut state = lock(&state);
    state.ping();
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
        "assessed": assessed(&project.scan, &project.reports),
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::{data_home, project_of};
    use crate::agentapi::AppState;
    use std::sync::{Arc, Mutex};

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
}
