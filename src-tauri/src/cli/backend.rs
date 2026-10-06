//! The backend from the terminal's side: finding the one that is up, starting one, and `sanity serve`.
//!
//! One backend per machine, so starting one is a race that has to be won exactly once. The
//! claim is [`take_spawn_lock`], an `O_EXCL` create that decides who spawns, and every loser
//! waits for the winner's endpoint rather than starting a second. A backend is believed only
//! when it answers: the endpoint file says where to look, and [`probe`] is the evidence.
//! Before `check` starts work, [`retire_stale_backend`] asks one from another build to stand
//! down. The daemon itself is [`serve`] — idempotent, idling out on a timer, and stopping
//! every reader it spawned on every way out.

use crate::agentapi::{self, Endpoint};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::{Duration, Instant};

/// How long to wait on a liveness probe.
///
/// Short, because the only honest answers are "a loopback server replied" and "nothing is
/// there". A long timeout here would turn a missing backend into a hang at the shell,
/// where the whole point of the verb is to tell you quickly what is running.
const PROBE_TIMEOUT: Duration = Duration::from_millis(1500);

/// How long a verb waits for a backend it just started.
///
/// It covers process start and `restore`'s first moments, not a scan — `restore` rescans
/// on its own thread and the server answers before it finishes.
pub(super) const START_WAIT: Duration = Duration::from_secs(15);

/// How long a spawn lock may be held before the next caller assumes it was abandoned.
///
/// Derived, not chosen: the lock covers exactly "spawn a child and wait for it to answer",
/// which [`START_WAIT`] already bounds. A lock older than that outlived the only operation
/// it can legitimately cover, so its holder died between creating it and releasing it.
/// The margin is for a machine slow enough to be near the wait's own limit.
const SPAWN_LOCK_STALE: Duration = Duration::from_secs(START_WAIT.as_secs() + 5);

/// Where the one-spawner-at-a-time lock lives. Beside the endpoint file, in the per-machine
/// data dir, because that is the scope of the thing it protects: one backend per machine.
fn spawn_lock_path() -> Option<PathBuf> {
    Some(crate::reports::data_dir()?.join("backend.lock"))
}

/// Held by whichever process is currently allowed to start a backend.
///
/// Released on drop, which covers every way `ensure_backend` returns — including the error
/// paths, where leaving it behind would block the next caller for [`SPAWN_LOCK_STALE`].
struct SpawnLock(PathBuf);

impl Drop for SpawnLock {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Win the right to start a backend, or return `None` because somebody else has it.
///
/// **`create_new` is the whole mechanism, and it is chosen for being atomic rather than
/// convenient.** `O_EXCL` is one syscall that either creates the file or fails because it
/// exists — there is no window between checking and claiming for a second process to fit
/// through, which is exactly what a probe-then-spawn has and why a cold wave could put
/// several servers on one machine. Portable to every platform this ships on, and it needs
/// no dependency: `flock` would be tidier about cleanup and is unix-only.
///
/// The cost of `O_EXCL` over an advisory lock is that a process which dies holding it
/// leaves the file behind, so staleness has to be handled here rather than by the kernel.
/// Age is a sound test *because* the guarded region is bounded: see [`SPAWN_LOCK_STALE`].
/// Two processes can both judge one stale, and that is safe — the steal is a remove
/// followed by the same atomic create, so only one of them wins the re-creation and the
/// other goes back to waiting.
fn take_spawn_lock() -> Option<SpawnLock> {
    take_spawn_lock_after(SPAWN_LOCK_STALE)
}

/// The above, with the abandonment threshold passed in so a test can exercise the steal
/// without having to age a file on disk.
fn take_spawn_lock_after(stale: Duration) -> Option<SpawnLock> {
    let path = spawn_lock_path()?;
    let claim = |path: &PathBuf| {
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(path)
            .map(|mut f| {
                use std::io::Write;
                let _ = write!(f, "{}", std::process::id());
            })
            .is_ok()
    };
    if claim(&path) {
        return Some(SpawnLock(path));
    }
    // Somebody holds it. Only consider stealing if it is too old to be a live attempt.
    let abandoned = std::fs::metadata(&path)
        .and_then(|m| m.modified())
        .map(|t| t.elapsed().unwrap_or_default() >= stale)
        .unwrap_or(false);
    if abandoned {
        let _ = std::fs::remove_file(&path);
        if claim(&path) {
            return Some(SpawnLock(path));
        }
    }
    None
}

/// Wait for whoever is starting a backend to publish one.
pub(super) fn await_backend(deadline: Instant) -> Option<Endpoint> {
    loop {
        if let Some(ep) = live() {
            return Some(ep);
        }
        if Instant::now() >= deadline {
            return None;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

/// How long a headless backend sits with nothing calling it before standing down.
///
/// Sized for the gap this actually has to survive: somebody runs `init`, reads what it
/// says, and gets round to `check`. Half an hour is generous for that and short enough that
/// a forgotten daemon does not outlive the afternoon. Once a wave is running, `status`
/// polling alone keeps it alive.
///
/// Nothing is lost when it fires. That is the whole reason this can be a timer rather
/// than a negotiation.
const IDLE_FOR: Duration = Duration::from_secs(30 * 60);

/// How often the daemon checks whether it is still wanted.
const WATCH_EVERY: Duration = Duration::from_secs(5);

/// Ask a backend whether it is alive, and get the pid of whatever answered.
///
/// The pid comes from the RESPONSE, never from the file. A stale endpoint file names a
/// process that died, and the port it names may since have been claimed by something
/// else — so the file is a hint about where to look and the reply is the evidence.
fn probe(ep: Endpoint) -> Option<u32> {
    health(ep).and_then(|h| u32::try_from(h.get("pid")?.as_u64()?).ok())
}

/// The whole health reply, for the one caller that needs more than "somebody is there".
fn health(ep: Endpoint) -> Option<Value> {
    let client = reqwest::blocking::Client::builder().timeout(PROBE_TIMEOUT).build().ok()?;
    client.get(format!("{}/health", ep.url())).send().ok()?.json().ok()
}

/// Stand down a backend that is serving from a different build than this one.
///
/// **The hazard is quiet, which is why this exists rather than a shorter idle timer.**
/// `serve` is idempotent, so whatever is already answering wins — and a process keeps the
/// code image it started with. Rebuild, run `sanity check`, and the readings are written by
/// the binary from an hour ago: it renders the headings it was compiled with, over a
/// `.sanity/` whose format has moved, and nothing on screen says which build produced the
/// file you are looking at. Waiting for a timer to kill it treats the symptom and cannot
/// help the case that matters, which is rebuilding and re-running immediately.
///
/// Three things it will not do. It does not compare versions — see `build_id`, a release
/// number cannot see an afternoon of rebuilds. It does not kill: SIGTERM to a daemon leaves
/// its readers running, and a signal cannot be refused by a backend that knows something
/// the caller does not. And it does not touch the window's backend, which belongs to
/// somebody's open app; that one is reported and left alone.
///
/// A backend too old to have `/retire` — or one that refuses — is reported the same way.
/// Every branch here ends in the run going ahead, because a formatting drift is not worth
/// refusing to work over.
pub(super) fn retire_stale_backend() {
    let Some(ep) = agentapi::read_endpoint() else { return };
    let Some(h) = health(ep) else { return };
    let mine = agentapi::build_id();
    let theirs = h.get("build").and_then(|v| v.as_str()).unwrap_or("unknown");
    // Unknown either way is "cannot tell", never "different" — the reply of a backend that
    // predates this endpoint reads identically to one whose binary cannot be stat-ed.
    if theirs == mine || theirs == "unknown" || mine == "unknown" {
        return;
    }
    let pid = h.get("pid").and_then(|v| v.as_u64()).unwrap_or(0);
    let reply = post(&ep, "/retire", json!({}));
    let ok = reply.as_ref().is_ok_and(|v| v.get("ok").and_then(|b| b.as_bool()) == Some(true));
    if !ok {
        let hint = reply
            .as_ref()
            .ok()
            .and_then(|v| v.get("hint").and_then(|h| h.as_str()).map(str::to_string))
            .unwrap_or_else(|| format!("Stop it with `kill {pid}` to use this build."));
        println!("sanity: the backend answering is from another build. {hint}");
        println!();
        return;
    }
    // It stands down on its next watch tick, so this waits for the endpoint to be given up
    // rather than assuming. Bounded: if it never goes, the run proceeds against it, which
    // is where we started.
    let deadline = Instant::now() + START_WAIT;
    while Instant::now() < deadline {
        if live().is_none() {
            return;
        }
        std::thread::sleep(Duration::from_millis(250));
    }
}

/// The backend that is actually up, if any.
pub(crate) fn live() -> Option<Endpoint> {
    let ep = agentapi::read_endpoint()?;
    probe(ep).map(|pid| Endpoint { pid, ..ep })
}

pub(super) fn get(ep: &Endpoint, path: &str) -> Result<Value, String> {
    reqwest::blocking::get(format!("{}{path}", ep.url()))
        .and_then(|r| r.json())
        .map_err(|e| e.to_string())
}

pub(super) fn post(ep: &Endpoint, path: &str, body: Value) -> Result<Value, String> {
    reqwest::blocking::Client::new()
        .post(format!("{}{path}", ep.url()))
        .json(&body)
        .send()
        .and_then(|r| r.json())
        .map_err(|e| e.to_string())
}

/// A backend, started if there wasn't one.
///
/// The child is `sanity serve` on this same binary — never a path, never a lookup on
/// `PATH`. Whatever is running now is definitely installed; anything found by name might
/// be a different version writing the same `.sanity/`.
///
/// **Its stdio is null, and for the shim that is load-bearing rather than tidy.**
/// `sanity mcp` speaks JSON-RPC over stdout; a child that inherited it would print
/// "Sanity backend on port …" into the middle of a protocol stream and break the session
/// that started it.
///
/// `SANITY_BACKEND` means the caller has said where the backend is, so nothing is
/// started — pointing a shim at one server and silently spawning another is the two-copies
/// failure in process form.
///
/// It is not detached from the terminal's session, so closing the shell takes the daemon
/// with it. That is a deliberate non-feature rather than an oversight: a backend that
/// dies costs an unreported reading or two and comes straight back on the next call, and
/// a background process that outlives every window and terminal the user can see is a
/// worse thing to leave on somebody's machine than a restart.
///
/// **Exactly one process spawns, and that is enforced here rather than by restricting who
/// may ask.** It used to be enforced by convention — only `sanity_open` was allowed to
/// call this — because a cold wave of readers that all probed an empty endpoint would all
/// spawn, each binding its own port and publishing the file over the last, with the losers
/// only noticing on their next five-second watch tick. That convention bought exclusion at
/// the price of recovery: a backend that died mid-run could not be restarted by the calls
/// that noticed, because they were the calls forbidden to try. And it was never exclusion
/// anyway — two sessions opening two repos at once are two permitted callers.
///
/// [`take_spawn_lock`] makes it real. Losers do not queue up behind the lock to spawn in
/// turn; they wait for the winner's backend, which is the thing they actually wanted.
pub(crate) fn ensure_backend() -> Result<Endpoint, String> {
    if let Some(ep) = live() {
        return Ok(ep);
    }
    if std::env::var_os("SANITY_BACKEND").is_some() {
        return Err("SANITY_BACKEND is set but nothing is answering there".into());
    }

    let deadline = Instant::now() + START_WAIT;
    // Held for the rest of this call, spawn and wait together. Releasing it the moment the
    // child is spawned would let the next caller in while the port is still unpublished,
    // and it would spawn a second server for the same gap this exists to close.
    let Some(_lock) = take_spawn_lock() else {
        // Somebody else is already starting one. Theirs will do.
        return await_backend(deadline).ok_or_else(|| {
            "another process is starting the backend and it did not come up in 15s".to_string()
        });
    };
    // Under the lock, ask again. The holder we queued behind may have finished between our
    // probe and our claim, and starting a second server on top of a working one is the
    // exact outcome the lock exists to prevent.
    if let Some(ep) = live() {
        return Ok(ep);
    }

    let exe = std::env::current_exe().map_err(|e| format!("cannot find my own binary: {e}"))?;
    let mut cmd = std::process::Command::new(exe);
    cmd.arg("serve")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    // **Its own process group, or Ctrl-C kills the daemon.**
    //
    // A child inherits the terminal's foreground process group, and Ctrl-C signals the
    // GROUP — so interrupting `sanity check` did not merely stop the watching, it delivered
    // SIGINT to the backend this command happened to have started. The backend shut down,
    // taking the readers with it, and the CLI then polled something that was no longer
    // there: "lost the backend. The run may still be going". There was no summary because
    // there was nothing left to ask.
    //
    // The interrupt has a job of its own — stop the readers, then report what the run cost
    // — and it can do neither from a dead server. That the daemon is also shared with the
    // window is a second reason, but the first one is enough.
    //
    // Unix only, because the problem is: Windows has no process groups in this sense and
    // sends console events to attached processes, which a null-stdio child is not.
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    cmd.spawn().map_err(|e| format!("could not start the backend: {e}"))?;

    await_backend(deadline).ok_or_else(|| "the backend did not come up within 15s".to_string())
}

/// Serve the loopback API with no window.
///
/// Idempotent rather than exclusive: if something already answers, this says so and exits
/// 0. That is what lets a launcher run `sanity serve` unconditionally, and it is also the
/// whole of the "must not conflict with a running UI" requirement — the second one never
/// starts, so there is never a second one to conflict with.
pub fn serve() -> i32 {
    if let Some(ep) = live() {
        println!("Sanity is already serving on port {} (pid {}).", ep.port, ep.pid);
        return 0;
    }

    let rt = match tokio::runtime::Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            eprintln!("sanity: no async runtime: {e}");
            return 1;
        }
    };
    // Both before the bind, and the order matters for one of them. `build_id` reads the
    // executable behind this process, so it has to be stamped while that file is still the
    // one running — after a rebuild it would describe the new binary and a stale daemon
    // would vouch for itself.
    agentapi::set_headless();
    let _ = agentapi::build_id();

    let state: agentapi::Shared = Default::default();
    // Same as the window's startup: bring back what was open, on its own thread, so the
    // server answers before the slowest repo has finished rescanning.
    // No window, nothing to draw: the backend scans and the sidebar it would feed does not
    // exist here.
    agentapi::restore(state.clone(), |_, _| {}, |_, _| {});
    let port = match rt.block_on(agentapi::serve(state.clone())) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: could not bind loopback: {e}");
            return 1;
        }
    };
    // `rt` has to outlive the loop below: `agentapi::serve` returns as soon as it has
    // spawned the listener, and dropping the runtime here would take the server with it.
    let _rt = rt;

    let me = std::process::id();

    // **Nothing this backend spawned outlives it, including when it is killed.**
    //
    // Measured: SIGTERM to the daemon left three readers running. The graceful paths —
    // idling out, and the window's `RunEvent::Exit` — call `stop_all_runs`, and neither
    // one is what happens when somebody closes a terminal or a supervisor stops the
    // service. A signal terminates the process without unwinding, so `kill_on_drop` never
    // fires either, and what survives is three coding agents spending tokens on readings
    // that have nowhere to land.
    //
    // SIGKILL cannot be caught and is the one case left. The backstop there is the reader
    // itself: `SANITY_BACKEND` points at a port that no longer answers and also stops the
    // shim starting a replacement, so each one fails its retries and exits within about
    // twelve seconds. That is a bounded leak rather than a permanent one.
    {
        let dying = state.clone();
        _rt.spawn(async move {
            #[cfg(unix)]
            {
                use tokio::signal::unix::{signal, SignalKind};
                let mut term = match signal(SignalKind::terminate()) {
                    Ok(t) => t,
                    Err(_) => return,
                };
                tokio::select! {
                    _ = term.recv() => {}
                    _ = tokio::signal::ctrl_c() => {}
                }
            }
            #[cfg(not(unix))]
            {
                if tokio::signal::ctrl_c().await.is_err() {
                    return;
                }
            }
            eprintln!("\nsanity: stopping readers…");
            agentapi::stop_all_runs(&dying);
            agentapi::release_endpoint(std::process::id());
            std::process::exit(0);
        });
    }

    println!(
        "Sanity backend on port {port} (pid {me}). Idles out after {} minutes.",
        IDLE_FOR.as_secs() / 60
    );

    let started = Instant::now();
    loop {
        std::thread::sleep(WATCH_EVERY);

        // Asked to make way for a newer build. Same exit as idling out, and it reaches here
        // rather than happening in the handler so the caller gets its answer before this
        // process goes: `/retire` has already refused if a wave is live or if this is the
        // window's backend, so by the time the flag is set there is nothing left to weigh.
        if agentapi::retiring() {
            println!("A newer build asked to take over. Standing down.");
            agentapi::stop_all_runs(&state);
            agentapi::release_endpoint(me);
            return 0;
        }

        // Superseded. The window claims the endpoint file when it starts, and a human who
        // has opened the app beats a background process every time — so the daemon retires
        // rather than leaving two servers up with only one of them addressable. Losing
        // whatever it held is safe, which is the property that lets this be a one-line
        // rule instead of a handover.
        match agentapi::read_endpoint() {
            Some(ep) if ep.pid != me => {
                println!("Sanity app took over on port {}. Standing down.", ep.port);
                // **Readers stopped on the way out, like every other exit.** This path
                // returned without doing it, and `main` ends in `process::exit`, so no
                // destructor runs and `kill_on_drop` never fires: the readers were orphaned
                // and spent another twelve seconds failing retries against a port that had
                // gone. The rule this file states forty lines up — nothing this backend
                // spawned outlives it — had two exits that did not obey it.
                agentapi::stop_all_runs(&state);
                return 0;
            }
            // The file was removed out from under us. Nothing can reach this process any
            // more, so it is a daemon nobody can address: same outcome.
            None => {
                println!("Endpoint file is gone; nothing can reach me. Standing down.");
                agentapi::stop_all_runs(&state);
                return 0;
            }
            _ => {}
        }

        // Unconditional, and that is the fix rather than the style.
        //
        // This was `state.lock().ok().map(...)` fed to `is_some_and`, so a lock it could
        // not take read as "not idle" and the daemon stayed up forever — which is exactly
        // the state a poisoned mutex leaves it in, and exactly the state in which every
        // one of its answers is empty. The idle check is the only thing that ever ends
        // this process, so it must not have a branch that means "I could not tell".
        // `agentapi::lock` recovers from poison, so there is no longer an `ok()` here to
        // swallow; if that ever changes, this has to fail CLOSED and stand down.
        let idle = {
            let s = agentapi::lock(&state);
            s.last_agent.map_or_else(|| started.elapsed(), |t| t.elapsed())
        };
        if idle >= IDLE_FOR {
            println!("Nothing has called in {} minutes. Standing down.", IDLE_FOR.as_secs() / 60);
            // Same rule as the window's exit: nothing this backend spawned outlives it.
            agentapi::stop_all_runs(&state);
            agentapi::release_endpoint(me);
            return 0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::data_home;

    /// The whole point of the lock: a cold wave cannot put two backends on one machine.
    ///
    /// This is what replaced "only `sanity_open` may bootstrap". That rule reduced the
    /// number of callers without ever excluding them — two sessions opening two repos are
    /// two permitted callers — and it made recovery impossible, because the calls that
    /// notice a dead backend were the ones forbidden to restart it. Exclusion belongs at
    /// the spawn, where it can be enforced, not at the caller, where it can only be
    /// discouraged.
    #[test]
    fn only_one_caller_may_start_a_backend_at_a_time() {
        let _home = data_home();

        let first = take_spawn_lock().expect("an uncontended lock must be available");
        assert!(
            take_spawn_lock().is_none(),
            "a second caller got the lock too, which is a second backend"
        );

        // Released on drop — including, in `ensure_backend`, on the error paths.
        drop(first);
        assert!(
            take_spawn_lock().is_some(),
            "the lock was not released, so nothing can ever start a backend again"
        );
    }

    /// A process that dies holding the lock must not wedge every later caller.
    ///
    /// The cost of `O_EXCL` over an advisory lock is that nothing cleans up after a death,
    /// so age is the test — sound only because the guarded region is bounded by
    /// `START_WAIT`. Both halves matter: a lock younger than the threshold is a live
    /// attempt and must be respected, and one older is wreckage and must be taken.
    #[test]
    fn an_abandoned_spawn_lock_is_taken_rather_than_blocking_forever() {
        let _home = data_home();

        let held = take_spawn_lock().expect("uncontended");
        assert!(
            take_spawn_lock_after(Duration::from_secs(3600)).is_none(),
            "stole a lock that is still well within a live attempt"
        );

        // Zero threshold: whatever is there is by definition too old.
        let stolen = take_spawn_lock_after(Duration::ZERO);
        assert!(stolen.is_some(), "an abandoned lock blocked a caller forever");

        // The thief now holds it, and the original holder's drop must not hand it to a
        // third caller — release is by path, and both point at the same one.
        drop(held);
        drop(stolen);
        assert!(take_spawn_lock().is_some(), "lock left behind after everyone released");
    }
}
