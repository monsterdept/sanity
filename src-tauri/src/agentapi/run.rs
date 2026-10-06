//! The `/check` and `/stop` endpoints: the pool of reader processes Sanity runs against a repo.
//!
//! Starting a run ([`start_run`]) resolves the agent and the model, refuses a second run on
//! one repo, and launches `run_wave` in the background. The wave keeps `width` readers out,
//! refills a slot the moment one exits, and stops when the work runs out, the limit is
//! reached, a stop is asked for, or readers keep exiting with nothing landing. Each reader is
//! one process, its stderr kept so a failed run can say why. How many readings one reader
//! takes is [`BATCH`], here and nowhere else.

use super::coverage::{assessed, work_left};
use super::protocol::NO_PROJECT;
use super::{lock, read_endpoint, reader_prompt, suggested_model, Shared, StatusParams};
use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use std::time::{Duration, Instant};

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
    /// Current readings the repo held when this run started — what its progress counts from,
    /// so the window can say how far THIS run is, the way `sanity check` does.
    pub from: usize,
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
    /// What failed readers said on the way out, deduped — see `read_one` and `tally_reader`.
    ///
    /// Kept because the run's own summary cannot diagnose anything: "readers in a row exited
    /// without a successful reading" describes the symptom of every possible cause, from an
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
pub(super) const BATCH: usize = 10;

/// The default batch, for callers outside this module that need to price one.
pub fn default_batch() -> usize {
    BATCH
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
pub(super) async fn check(
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
            let from = assessed(&p.scan, &p.reports);
            p.run = Some(Run {
                from,
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
pub(super) async fn stop(State(state): State<Shared>, Json(p): Json<StatusParams>) -> Json<serde_json::Value> {
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
/// a pool that keeps launching against a queue that cannot give it work. The loop stops
/// when `remaining` reaches zero and also when readers keep exiting without it FALLING —
/// a harness that exits instantly, wrongly configured, would otherwise spin forever
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
    let mut readers = tokio::task::JoinSet::new();
    // Consecutive reader exits with no reading landing anywhere since the one before.
    let mut barren = 0;
    let mut mark = started_at;
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
        let done = assessed_now(&state, &key).saturating_sub(started_at);
        if let Some(n) = limit {
            if done >= n {
                break format!("Reached the limit of {n} readings.");
            }
        }

        // Sized by the work AND by what is left of the limit, counting the readers already
        // out against both.
        //
        // A reader does ten readings, so the limit could only ever be honored to that
        // granularity — measured on a real run, `--limit 6` with two readers banked 19.
        // That makes a small cap useless, which matters because a small cap is exactly what
        // somebody sets to try this cheaply. Holding `ceil(left / 10)` readers out brings
        // the smallest step down to ten, and the run still reports what it actually did
        // rather than what was asked.
        let mut want = width.min(remaining);
        if let Some(n) = limit {
            want = want.min(n.saturating_sub(done).div_ceil(BATCH).max(1));
        }
        // Topped up as readers exit, not launched in waves. It was waves: start `width`,
        // await every one, start `width` more — so each wave ran at the pace of its slowest
        // reader and the rest of the slots sat empty behind it, while this function's own
        // doc promised `width` in flight. Unless everything left is already leased, in
        // which case another reader would only queue behind the leases.
        let mut started = 0;
        while readers.len() < want && remaining > in_flight {
            let cmd = crate::harness::reader_command(
                harness, &exe, &backend, &key, &model, &prompt, &away,
            );
            readers.spawn(read_one(cmd, harness, stop.clone(), live.clone()));
            started += 1;
        }
        if started > 0 {
            if let Some(p) = lock(&state).projects.get_mut(&key) {
                if let Some(r) = p.run.as_mut() {
                    r.spawned += started;
                }
            }
        }

        // Woken by a reader exiting, or by a tick: the stop flag, the limit and a queue
        // that has stopped being fully leased are all things to notice without one.
        let exited = if readers.is_empty() {
            tokio::time::sleep(Duration::from_secs(5)).await;
            None
        } else {
            tokio::select! {
                j = readers.join_next() => j,
                _ = tokio::time::sleep(Duration::from_secs(1)) => None,
            }
        };
        let Some(joined) = exited else { continue };
        tally_reader(&state, &key, &stop, joined);
        // A run of readers that banked nothing. Once is a harness hiccup; `width` three
        // times over — what three barren waves used to be — is a misconfiguration, and
        // spawning into it forever is worse than stopping. Measured against the whole
        // project rather than the reader that exited, because readings land while readers
        // run and nothing ties one to the process that took it.
        let now = assessed_now(&state, &key);
        if now > mark {
            mark = now;
            barren = 0;
        } else {
            barren += 1;
            if barren >= 3 * width {
                // No guess about the cause. It used to add "check that the agent is
                // installed and signed in", which was the best available advice while
                // nothing captured what the readers said — and wrong at least as often as
                // right, since a rejected `--model` looks identical from here. The readers'
                // own output is kept now (`Run::failures`), so the summary states what
                // happened and the evidence answers why.
                break format!("{barren} readers in a row exited without a successful reading.");
            }
        }
    };
    // **Every reader is gone before the run is over.** The leases are cleared below on the
    // strength of it, and a reader still running past that would have its functions handed
    // to somebody else. Stop reaches each of them within a tick; any other ending lets the
    // ones already out finish, since killing a reader part-way through costs a prediction
    // and banks nothing.
    while let Some(joined) = readers.join_next().await {
        tally_reader(&state, &key, &stop, joined);
    }
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

/// One reader, from spawn to exit: whether it exited cleanly, and what it said on stderr.
async fn read_one(
    mut cmd: tokio::process::Command,
    harness: crate::harness::Harness,
    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
    live: std::sync::Arc<std::sync::atomic::AtomicUsize>,
) -> (bool, String) {
    let Ok(mut child) = cmd.spawn() else {
        return (false, format!("{} could not be started.", harness.program()));
    };
    // Counted from the moment there is a process, and decremented on every way out of this
    // task — see `Run::live`.
    live.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let _guard = LiveGuard(live);
    // **Drained, not merely piped.** It was piped and never read, so a reader that died in
    // one second saying `error: invalid model` threw the one useful sentence away and the
    // run reported "three waves finished without a reading landing" — true, and no help at
    // all. Draining also matters mechanically: a pipe nobody reads fills, and a chatty agent
    // then blocks on its own stderr.
    //
    // Concurrently with the wait, on its own task, because reading after the child exits is
    // the deadlock this is written to avoid.
    let err = child.stderr.take();
    let tail = tokio::spawn(async move {
        use tokio::io::AsyncReadExt;
        let mut buf = String::new();
        if let Some(mut e) = err {
            let _ = e.read_to_string(&mut buf).await;
        }
        buf
    });
    // Waited on alongside the stop flag rather than simply awaited. A reader is a coding
    // agent that will happily run for minutes, so "stop" has to be able to reach one that is
    // already going — otherwise quitting leaves every reader out spending tokens on readings
    // that have nowhere to land.
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
                    // Killed on purpose. Whatever it was saying is not a failure worth
                    // reporting to anybody.
                    return (false, String::new());
                }
            }
        }
    }
}

/// Count a reader that has exited into the run.
fn tally_reader(
    state: &Shared,
    key: &str,
    stop: &std::sync::atomic::AtomicBool,
    joined: Result<(bool, String), tokio::task::JoinError>,
) {
    let (ok, said) = joined.unwrap_or((false, String::new()));
    // **A reader killed by Stop is not a failure.** Every non-zero exit was counted, so
    // interrupting a run reported "1 reader failed" about a process the run had just killed
    // on purpose — and `failed` is the number that exists to tell a misconfigured agent
    // apart from a slow one. Reading the stop flag rather than the exit code, because from
    // the outside the two deaths look identical.
    let killed = stop.load(std::sync::atomic::Ordering::Relaxed);
    if let Some(p) = lock(state).projects.get_mut(key) {
        if let Some(r) = p.run.as_mut() {
            r.finished += 1;
            if !ok && !killed {
                r.failed += 1;
                let said = said.trim();
                // Deduped, because a misconfiguration fails every reader the same way and
                // five copies of one sentence is not five findings. Capped for the same
                // reason a log tail is: nobody reads the sixth.
                if !said.is_empty() && r.failures.len() < 5 && !r.failures.iter().any(|f| f == said)
                {
                    r.failures.push(said.to_string());
                }
            }
        }
    }
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
    lock(state).projects.get(key).map(|p| assessed(&p.scan, &p.reports)).unwrap_or(0)
}

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

#[cfg(test)]
mod tests {
    use super::*;

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
}
