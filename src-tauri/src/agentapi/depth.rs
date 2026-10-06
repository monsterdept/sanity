//! The `/trace` endpoint: how much of a repo's history the map holds, and what more costs.
//!
//! Each project carries a [`TraceState`]: the depth its tree was traced to, the price of the
//! next rung when that is over budget, and a running pass's progress and stop flag. The
//! endpoint spends because somebody asked. A launch restoring projects and a watcher noticing
//! a repo moved are work nobody asked for, so they go through `trace_within_budget`, the one
//! place the budget is applied — and `banks_over` keeps a declined launch from erasing a
//! deeper trace somebody already paid for.

use super::protocol::NO_PROJECT;
use super::{lock, Shared, StatusParams};
use crate::scan::Scan;
use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use std::path::Path;
use std::time::Instant;

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

/// What `trace` was asked for.
#[derive(Debug, Deserialize)]
pub(super) struct TraceParams {
    #[serde(default)]
    project: Option<String>,
    /// `files`, `lines` or `edits`. `budget` is as deep as fits `trace::BUDGET`, priced on what
    /// is not already cached — the CLI's default. Absent deepens by one step from wherever this
    /// repo is.
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
pub(super) async fn trace(State(state): State<Shared>, Json(p): Json<TraceParams>) -> Json<serde_json::Value> {
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
    // `None` is the budget's to decide, and it can only decide once the scan is in hand —
    // blame is priced per file.
    let asked = match p.depth.as_deref() {
        Some("files") => Some(crate::trace::Depth::Files),
        Some("lines") => Some(crate::trace::Depth::Lines),
        Some("edits") => Some(crate::trace::Depth::Edits),
        Some("budget") => None,
        // One step on from wherever it is. A caller that says nothing gets the cheap half
        // first, which is also the half that makes the next estimate a measured one.
        None => Some(match at {
            crate::trace::Depth::Untraced => crate::trace::Depth::Files,
            _ => crate::trace::Depth::Lines,
        }),
        Some(other) => {
            return Json(serde_json::json!({
                "ok": false,
                "error": format!("unknown depth {other}"),
                "hint": "depth is `files` (the commit log), `lines` (per-line blame), `edits` \
                         (the timeline) or `budget` (as deep as fits)",
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
            // **Never below the rung this map already holds.** Deepening to a shallower rung
            // re-applies the trace without what was bought above it, so a budget that prices
            // a changed repo's blame over ten seconds would strip per-function history off a
            // map somebody paid for. The budget decides how much FURTHER to go.
            let (depth, declined) = match asked {
                Some(depth) => (depth, None),
                None => {
                    let (fits, declined) = crate::trace::affordable(&repo, scan, &scans);
                    (fits.max(at), declined.filter(|(rung, _)| *rung > at))
                }
            };
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
            Some((scan.clone(), traced_to, depth, declined))
        })
        .await
        .ok()
        .flatten()
    };
    let Some((scan, (reached, done, considered), depth, declined)) = traced else {
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
        // The rung the budget refused and its price, so the verb can name the flag that buys it.
        "declined": declined.map(|(rung, seconds)| serde_json::json!({
            "depth": rung.tag_str(),
            "seconds": seconds,
        })),
    }))
}

/// Stop a running trace. What it has read is kept — see `trace::deepen`.
pub(super) async fn stop_trace(
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
pub(super) fn banks_over(reached: crate::trace::Depth, banked: Option<&str>) -> bool {
    reached.rank() >= crate::trace::Depth::from_tag(banked.unwrap_or("")).rank()
}

/// Read as much of `repo`'s history as fits the budget, and say what is left.
///
/// The one place the gate is applied to work nobody asked for — a launch restoring projects,
/// and a watcher noticing a repo moved. An explicit open, a CLI verb or the window's own Trace
/// button all go through [`deepen_project`] instead, which does what it was told.
pub(super) fn trace_within_budget(
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

#[cfg(test)]
mod tests {
    use super::*;

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
}
