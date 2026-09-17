//! The headless half — `sanity serve`, `sanity check`, and the read-only verbs.
//!
//! Sanity's backend was reachable only by opening a window, which was never a design
//! position: the state ended up in the app's process because the app was written first,
//! and `Project.leased` and the warm scan happened to live where the pixels did. Nothing
//! about the instrument wants that. An agent assessing a repo needs a coordinator, not a
//! picture.
//!
//! Three properties hold this together, and each one is doing real work:
//!
//! - **The backend is per machine, not per project.** One endpoint file, one process,
//!   a map of projects, and every call routed by the caller's key through `for_client`.
//!   That was already true — it is what `active_project()` was deleted for — so `sanity
//!   check` in a second repo is just another client, not a second server.
//! - **The daemon holds nothing precious.** The scan is recomputed, the readings are in
//!   `.sanity/`, and a lost lease re-queues by design. So it can be killed at any moment,
//!   which is why the lifecycle here is allowed to be blunt: idle out, or stand down when
//!   superseded. There is no `sanity stop`, because nothing needs stopping cleanly.
//! - **There is still no model path in the app.** Sanity spawns coding agents that are
//!   already installed and authenticated; it does not run inference. What `OllamaModel` was
//!   deleted to avoid was configuring an ENDPOINT, and none of this configures one.
//!
//! **`sanity study` used to live here and is gone.** It opened a repo and printed a
//! sentence to paste at an agent, from the design where the agent WAS the reader. The role
//! split ended that: a session with no `SANITY_ROLE` gets the human tools — open, check,
//! status, summary — and cannot call `next`, `reveal` or `report` at all. So the sentence
//! asked an agent to do something it has no tools for, and the three paragraphs of priming
//! warning underneath guarded a door that is now bricked up. Registering a repo is `init`,
//! and `--show` moved there with it.

use crate::agentapi::{self, Endpoint};
use crate::mcp::urlencode;
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
const START_WAIT: Duration = Duration::from_secs(15);

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
fn await_backend(deadline: Instant) -> Option<Endpoint> {
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
fn retire_stale_backend() {
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

fn get(ep: &Endpoint, path: &str) -> Result<Value, String> {
    reqwest::blocking::get(format!("{}{path}", ep.url()))
        .and_then(|r| r.json())
        .map_err(|e| e.to_string())
}

fn post(ep: &Endpoint, path: &str, body: Value) -> Result<Value, String> {
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

/// Thousands separators. The counts here are function totals, and six digits without them
/// is a number you have to stop and read.
fn commas(n: u64) -> String {
    let s = n.to_string();
    let mut out = String::with_capacity(s.len() + s.len() / 3);
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

fn num(v: &Value, key: &str) -> u64 {
    v.get(key).and_then(|x| x.as_u64()).unwrap_or(0)
}

fn text<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("")
}

/// Canonicalised, because `project_key` is and the two must agree. A key that round-trips
/// through a symlink differently from the one the backend stored is a project the CLI can
/// see and never address.
fn resolve(path: &str) -> Result<PathBuf, String> {
    std::fs::canonicalize(path).map_err(|e| format!("{path}: {e}"))
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

/// Put a repo in front of an agent: start a backend if needed, open the repo, print the
/// sentence.
///
/// What it deliberately does NOT do is run the agent. The instrument and the operator's
/// workflow are two products, and every good decision in this codebase comes from the
/// instrument staying clear of model configuration — see the module header.
///
/// `show` is the only way the window moves. Without it the repo appears in the sidebar
/// with its own progress and the pane the human is reading stays put, because a shell
/// command is not evidence that they wanted to stop looking at what they had open.
/// Is there a person here to answer a question?
///
/// **Nothing prompts unless both ends of the conversation are a terminal.** These verbs run
/// in CI, in `just` recipes, from a launchd job and inside the app's own `Command::new`, and
/// a prompt in any of those is not a question — it is a hang, with the reason invisible
/// because whatever would have printed it is being captured. Checking stdout as well as
/// stdin is what catches `sanity check . | tee log`, where a person IS present and still
/// cannot see what they are being asked.
fn interactive() -> bool {
    use std::io::IsTerminal;
    std::io::stdin().is_terminal() && std::io::stdout().is_terminal()
}

/// Ask a person to pick from a short list, or to type something else.
///
/// Returns `None` for an empty answer, which every caller reads as "you decide" — so the
/// non-interactive path and the just-press-return path arrive at the same place rather than
/// at two behaviors somebody has to know apart.
fn choose(prompt: &str, options: &[String], default: Option<&str>) -> Option<String> {
    use std::io::Write;
    println!();
    for (i, o) in options.iter().enumerate() {
        let mark = if default == Some(o.as_str()) { " (default)" } else { "" };
        println!("  {}. {o}{mark}", i + 1);
    }
    println!();
    print!("{prompt} ");
    let _ = std::io::stdout().flush();
    let mut line = String::new();
    if std::io::stdin().read_line(&mut line).is_err() {
        return default.map(str::to_string);
    }
    let line = line.trim();
    if line.is_empty() {
        return default.map(str::to_string);
    }
    // A number picks from the list; anything else is taken literally, because the list is
    // what the agent reported and a model it has never heard of is still a valid thing to
    // ask for — the same "suggestions, not a gate" rule the window's picker follows.
    if let Ok(n) = line.parse::<usize>() {
        if n >= 1 && n <= options.len() {
            return Some(options[n - 1].clone());
        }
    }
    Some(line.to_string())
}

/// Point the window at a repo, if asked and only if asked.
///
/// **The one thing `study` did that nothing else did.** Everything else it printed either
/// moved to `init` or described a workflow the role split ended — but "open the app on this
/// repo" is a real thing to want from a terminal, and no other verb does it: `check` opens
/// the project without taking the view, and the read verbs deliberately do not open at all.
///
/// Starts a backend, because there is nothing to point otherwise. That is why it is behind
/// a flag: `init` is otherwise an offline write to a file, and a verb that quietly spawns a
/// daemon to record a preference would be a surprise.
///
/// Failures are silent. The project is recorded whatever happens here, and a window that
/// did not move is a visible outcome that needs no sentence of its own.
fn reveal_in_window(repo: &std::path::Path, show: bool) {
    if !show {
        return;
    }
    let Ok(ep) = ensure_backend() else { return };
    let _ = post(&ep, "/open", json!({ "path": repo.to_string_lossy(), "focus": true }));
}

/// `sanity init --harness <name> [--model <id>] [--show]` — say which agent reads this repo.
///
/// **A human naming a project, in the one place a human is not a contaminant.** Readers
/// may never name a repo; a person in a terminal always may, and this is the terminal half
/// of the same door the window's Add project button is.
///
/// It records the harness and the model, and nothing else. No global MCP config is
/// touched: a reader's server carries a role and a project in its environment, and writing
/// that into `~/.claude.json` would turn every session the user starts by hand into a
/// reader for whichever repo was initialized last.
///
/// **`--model` is here because it was already being typed.** The flag parser has always
/// taken a value for it, so `init --harness agy --model gemini-3.6-flash-medium` was
/// accepted, silently dropped, and the next `check` ran on the agent's own default — which
/// is precisely the unannounced change of scale the `model` column exists to catch. The
/// window has remembered both settings per project since it grew a Read button; this is
/// the terminal half of the same memory.
pub fn init(path: &str, harness: Option<&str>, model: Option<&str>, show: bool) -> i32 {
    let repo = match resolve(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    if crate::scan::git_root(&repo).is_none() {
        eprintln!("sanity: {}", crate::scan::not_a_repo(&repo));
        return 1;
    }
    let key = agentapi::project_key(&repo);
    let name =
        repo.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| key.clone());

    // Recorded before the harness branch, so `init --model <id>` on its own changes the
    // model without also demanding you restate the agent — the two are independent choices
    // and `set_reader` leaves the one it was not given alone.
    let model = model.map(str::trim).filter(|m| !m.is_empty());
    if let Some(m) = model {
        crate::reports::set_reader(&key, &repo.to_string_lossy(), &name, None, Some(m));
    }

    let configured = crate::reports::harness_for(&key);
    let found: Vec<String> = crate::harness::Harness::all()
        .into_iter()
        .filter(|h| h.available())
        .map(|h| h.name().to_string())
        .collect();

    // **Asked for, or asked about — never guessed at.** With no `--harness` this used to
    // print the installed agents and stop, which is a wizard that has done the detecting and
    // then makes you type the answer back. Where there is somebody to answer, it asks; where
    // there is not — a script, a `just` recipe, the app spawning this — it prints exactly
    // what it always printed, because a prompt with nothing attached to the other end is a
    // hang whose reason is invisible.
    let mut prompted = false;
    let asked: Option<String> = match harness.map(str::to_string) {
        Some(h) => Some(h),
        None if interactive() && !found.is_empty() => {
            prompted = true;
            choose("Which agent reads this repo?", &found, configured.as_deref())
        }
        None => None,
    };

    let Some(asked) = asked else {
        // Asked and declined. Saying "no agent configured yet, on this machine: …" here
        // would be reciting the list they just chose not to pick from, under a heading they
        // have already read — the fallback below is written for somebody who was never
        // asked anything.
        if prompted {
            println!();
            println!("Nothing chosen. `sanity init --harness <name>` when you know.");
            reveal_in_window(&repo, show);
            return 0;
        }
        // Nothing chosen and nobody to ask: say what is set and what could be, rather than
        // picking. Which agent reads is the same class of choice as which model reads.
        match configured {
            Some(h) => println!("{name} reads with {h}. Change it with --harness <name>."),
            None => println!("{name} has no agent configured yet."),
        }
        if let Some(m) = crate::reports::model_for(&key) {
            println!("Its readings are taken by {m}.");
        }
        println!();
        if found.is_empty() {
            println!(
                "No supported agent is on PATH. Sanity can read with {}.",
                crate::harness::supported()
            );
        } else {
            println!("On this machine: {}", found.join(", "));
            println!();
            println!("    sanity init --harness {}", found[0]);
        }
        reveal_in_window(&repo, show);
        return if found.is_empty() { 1 } else { 0 };
    };
    let asked = asked.as_str();
    let Some(h) = crate::harness::Harness::parse(asked) else {
        eprintln!(
            "sanity: `{asked}` is not an agent Sanity can run. Supported: {}.",
            crate::harness::supported()
        );
        return 2;
    };
    // Warned, not refused. Somebody setting a machine up before installing the agent is a
    // normal order to do things in, and `sanity check` checks again at the moment it
    // matters — where a missing binary is an error rather than a guess about the future.
    if !h.available() {
        eprintln!("sanity: note — `{}` is not on PATH yet.", h.program());
    }
    crate::reports::set_harness(&key, &repo.to_string_lossy(), &name, h.name());

    // The model, on the same terms: offered where somebody can answer, left alone otherwise.
    // Only when nothing has decided already — a repo with readings has a scale, and asking
    // again invites somebody to change it by pressing return.
    if model.is_none() && crate::reports::model_for(&key).is_none() && interactive() {
        let choices: Vec<String> = h.models().into_iter().map(|m| m.id).collect();
        let default = h.models().into_iter().find(|m| m.default).map(|m| m.id);
        if !choices.is_empty() {
            println!();
            println!("Which model reads is the measurement — a smaller one predicts less,");
            println!("and readings taken by two models are one map on two scales.");
            if let Some(m) =
                choose("Which model? (return for the default)", &choices, default.as_deref())
            {
                crate::reports::set_reader(&key, &repo.to_string_lossy(), &name, None, Some(&m));
            }
        }
    }
    reveal_in_window(&repo, show);
    println!();
    match crate::reports::model_for(&key) {
        Some(m) => println!("{name} will be read by {}, using {m}.", h.name()),
        None => println!("{name} will be read by {}.", h.name()),
    }
    println!();
    println!("    sanity check");
    println!();
    println!("Readers run as separate processes, outside this directory, with no access to");
    println!("the repo — they see only what Sanity hands them. That is what makes a reading");
    println!("a prediction rather than a recollection.");
    println!();
    0
}

/// `sanity check` — run readers over this repo until it is read.
///
/// This owns model choice and concurrency, which `study` was written to avoid owning. The
/// reason the trade changed is in `harness.rs`: a reader is now a stateless MCP client, so
/// spawning one is shelling out to a CLI the user has already authenticated, and what
/// Sanity gets in return is isolation it can guarantee instead of ask for.
pub fn check(
    path: &str,
    model: Option<&str>,
    readers: Option<usize>,
    limit: Option<usize>,
    detach: bool,
) -> i32 {
    let repo = match resolve(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    // Before the backend is resolved, and only here. `check` is where a person starts work,
    // which makes it the one caller entitled to replace what is running — a reader's shim
    // asking the same question mid-wave is a subprocess proposing to restart the server it
    // is talking to.
    retire_stale_backend();
    let ep = match ensure_backend() {
        Ok(ep) => ep,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    // Opened first, because `check` is something you run standing in a repo and the repo
    // may never have been scanned. This is the same "a human may name a project" rule
    // `init` follows.
    let opened = match post(&ep, "/open", json!({ "path": repo.to_string_lossy(), "focus": false }))
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    if !opened.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        eprintln!("sanity: {}", text(&opened, "error"));
        return 1;
    }
    let key = agentapi::project_key(&repo);

    // **What this run will read with, decided before anything is spent.**
    //
    // The backend already resolves it — corpus first, then this laptop's preference — and
    // reports the answer on `/status` rather than making the CLI reimplement the order and
    // drift from it. So there are only two cases left here. It knows: say so, because which
    // model reads IS the measurement and somebody should see it named before five agents
    // start. It does not: ask, if there is anybody to ask.
    //
    // Non-interactive with nothing known is the one path that stays silent and proceeds on
    // the harness's default — the run still says so afterwards, and a script that cannot
    // answer a question must not be stopped by one.
    // Whether the model came from the repo rather than from the command line — the run's
    // opening line says so, because continuing a corpus and starting one are different acts.
    let mut inherited = false;
    let model = match model.map(str::to_string) {
        Some(m) => Some(m),
        None => {
            let known = get(&ep, &format!("/status?project={}", urlencode(&key)))
                .ok()
                // Owned: `text` borrows from the response, which does not outlive the call.
                .map(|st| text(&st, "model").to_string())
                .filter(|m| !m.is_empty());
            match known {
                Some(m) => {
                    // Announced once, by the line below, rather than here as well: the two
                    // said the model's name twice in three lines, in different words.
                    inherited = true;
                    Some(m)
                }
                None if interactive() => {
                    let h = crate::reports::harness_for(&key)
                        .and_then(|h| crate::harness::Harness::parse(&h));
                    let choices: Vec<String> = h
                        .map(|h| h.models().into_iter().map(|m| m.id).collect())
                        .unwrap_or_default();
                    let default =
                        h.and_then(|h| h.models().into_iter().find(|m| m.default)).map(|m| m.id);
                    println!();
                    println!("Nothing has read this repo yet, so there is no scale to match.");
                    if choices.is_empty() {
                        None
                    } else {
                        choose(
                            "Which model should read it? (return for the default)",
                            &choices,
                            default.as_deref(),
                        )
                    }
                }
                None => None,
            }
        }
    };
    let model = model.as_deref();

    let started = match post(
        &ep,
        "/check",
        json!({
            "project": key,
            "model": model,
            "readers": readers,
            "limit": limit,
        }),
    ) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    // **Already running is not a failure, it is the thing you asked to watch.** This printed
    // the refusal and exited 1, telling a person at a terminal to "call sanity_status" — an
    // MCP tool name, from the response written for an agent. What somebody typing `sanity
    // check` wants when a run is already going is the run: so say so in one line and show it.
    let already = started.get("already").and_then(|v| v.as_bool()).unwrap_or(false);
    if already {
        if detach {
            // Nothing to attach to in the background: it is already in the background.
            println!();
            println!("sanity: a run is already in progress");
            println!();
            println!("`sanity status {path}` says how far along it is.");
            println!();
            return 0;
        }
        // Handed to `tail` rather than printed here: on a terminal it redraws these at the
        // top of a cleared screen, above the scroll region, which is the only place they
        // stay put. Printing them first would put them wherever the cursor was.
        let banner = vec![
            String::new(),
            "sanity: connecting to a run already in progress".to_string(),
            String::new(),
            "Ctrl-C to stop the run. Ctrl-X to stop watching it.".to_string(),
            String::new(),
        ];
        if !fancy() {
            for line in &banner {
                println!("{line}");
            }
        }
        return tail(
            &ep,
            &key,
            &Wanted { repo: repo.clone(), model: model.map(str::to_string), readers, limit },
            &banner,
        );
    }
    if !started.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        eprintln!("sanity: {}", text(&started, "error"));
        let hint = text(&started, "hint");
        if !hint.is_empty() {
            eprintln!("        {hint}");
        }
        return 1;
    }

    let name = text(&opened, "name");
    let harness = text(&started, "harness");
    let model_said = text(&started, "model");

    // Collected rather than printed, for the reason above: `tail` redraws these at the top
    // of the screen so they survive the readings scrolling past.
    let mut banner = vec![
        String::new(),
        // The MODEL, not the harness, because the model is the scale — the harness is how it
        // was reached. It was "with claude (claude-sonnet-5)", which puts the incidental half
        // first and the measurement in brackets.
        format!(
            "Reading {name} with {}{}.",
            if model_said.is_empty() { harness } else { model_said },
            if inherited { " (previously used)" } else { "" }
        ),
    ];
    // Said out loud because it is the choice that decides what the numbers mean, and the one
    // somebody would otherwise discover months later from the `model` column.
    if model_said.is_empty() {
        banner.push(String::new());
        banner.push(format!(
            "No model named, so {harness}'s own default reads. Which model reads IS the"
        ));
        banner.push(
            "measurement — a smaller one predicts less — and mixing them within one"
                .to_string(),
        );
        banner.push("repo gives you a map on two scales. Pass --model to decide.".to_string());
    }
    banner.push(String::new());

    if detach {
        for line in &banner {
            println!("{line}");
        }
        println!("Running in the background. `sanity status {path}` says how far along it is.");
        println!();
        return 0;
    }
    // Tailing by default, because somebody who typed this is watching.
    //
    // **And Ctrl-C stops the run, not just the watching.** The readers are children of the
    // backend rather than of this process, so nothing about this terminal going away would
    // end them — they would go on spending tokens for as long as the wave had left. A
    // command that keeps costing money after you interrupt it is the wrong default however
    // the ownership is arranged; `--detach` is how you start one and walk away.
    banner.push("Ctrl-C to stop the run. Ctrl-X to stop watching it.".to_string());
    banner.push(String::new());
    if !fancy() {
        for line in &banner {
            println!("{line}");
        }
    }
    tail(
        &ep,
        &key,
        &Wanted { repo: repo.clone(), model: model.map(str::to_string), readers, limit },
        &banner,
    )
}

/// Open the repo on a backend and start the same wave again.
fn resume(ep: &Endpoint, want: &Wanted) -> Result<(), ()> {
    let opened = post(ep, "/open", json!({ "path": want.repo.to_string_lossy(), "focus": false }))
        .map_err(|_| ())?;
    if !opened.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        return Err(());
    }
    let started = post(
        ep,
        "/check",
        json!({
            "project": agentapi::project_key(&want.repo),
            "model": want.model,
            "readers": want.readers,
            "limit": want.limit,
        }),
    )
    .map_err(|_| ())?;
    if started.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        Ok(())
    } else {
        Err(())
    }
}

/// Print readings as they land, until the run ends.
///
/// **Sanity can do this at all only because it runs the readers.** Progress used to be two
/// counts, because the one party that knew which function was in flight was an agent
/// session narrating into a chat that nothing kept. Every hand-out and every report passes
/// through the backend now, so the terminal and the window can show the same feed without
/// asking a model what it is doing.
///
/// Polls rather than streams. The feed is bounded and carries a sequence number, so a
/// watcher asks "what is newer than what I have" and a missed tick costs nothing; a stream
/// would need the backend to hold a subscriber list for a viewer that can vanish with a
/// Ctrl-C.
/// Is stdout a terminal? Decides whether anything is drawn rather than printed.
///
/// Stdout alone, unlike [`interactive`], which also wants a stdin to read an answer from.
/// Drawing asks nothing of the reader — it only needs somewhere that can handle a carriage
/// return without filling a log file with escape codes.
fn fancy() -> bool {
    use std::io::IsTerminal;
    std::io::stdout().is_terminal()
}

/// `1 reader` / `5 readers`. Small enough to be worth not getting wrong: "1 readers" in a
/// line somebody watches for minutes is the kind of thing that makes a tool feel unfinished.
fn plural(n: u64, word: &str) -> String {
    if n == 1 {
        format!("{n} {word}")
    } else {
        format!("{} {word}s", commas(n))
    }
}

/// The width of the drawn bar, in cells. Short on purpose: it shares a line with the
/// counts, and the counts are the part somebody actually reads.
const BAR: usize = 20;

fn bar(frac: f64) -> String {
    let full = (frac.clamp(0.0, 1.0) * BAR as f64).round() as usize;
    format!("{}{}", "█".repeat(full), "░".repeat(BAR - full))
}

/// `3m20s`, or `40s` under a minute. Elapsed rather than a clock time: what matters is how
/// long this has been going, and nobody needs to know it started at 02:14.
fn elapsed(since: Instant) -> String {
    let s = since.elapsed().as_secs();
    if s < 60 {
        format!("{s}s")
    } else {
        format!("{}m{:02}s", s / 60, s % 60)
    }
}

/// How a grade is colored, or nothing when the output is not a terminal.
///
/// **Loudness follows what the reading FOUND, not how well it went.** `full` means the code
/// read the way its name implied, which is the common case and the least interesting line on
/// the screen, so it is dimmed. `none` means a reader was completely wrong about a function,
/// which is the finding the whole instrument exists to produce — it gets the brightest ink
/// in the run. Coloring these the other way round, as a pass/fail would, makes a wall of
/// green out of the answers nobody needs to read.
fn grade_ink(grade: &str) -> (&'static str, &'static str) {
    if !fancy() {
        return ("", "");
    }
    match grade {
        "full" => ("\x1b[2m", "\x1b[0m"),
        "most" => ("", ""),
        "some" => ("\x1b[33m", "\x1b[0m"),
        "none" => ("\x1b[1;33m", "\x1b[0m"),
        _ => ("\x1b[2m", "\x1b[0m"),
    }
}

/// What a run was asked for, so it can be asked for again.
///
/// **The client that wanted the run is the one that can restart it.** Nothing durable
/// records an in-flight wave — deliberately, since a backend holds nothing precious — so
/// after a handover there is no state to recover from. But the command that typed `check`
/// still knows the model, the width and the limit, and the readings already banked are in
/// `.sanity/`, so reissuing costs only whatever was in flight.
struct Wanted {
    repo: PathBuf,
    model: Option<String>,
    readers: Option<usize>,
    limit: Option<usize>,
}

fn tail(ep: &Endpoint, key: &str, want: &Wanted, banner: &[String]) -> i32 {
    // Copied, because it is replaced when a run follows itself to another backend.
    let mut ep = *ep;
    // Set by the signal handler; read at the top of every poll. A flag rather than
    // stopping from inside the handler because the stop is an HTTP call, and a handler is
    // not the place to make one.
    let interrupted = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    // **Ctrl-X stops WATCHING; Ctrl-C stops the run.** Connecting to a wave somebody else
    // started left no way out that did not also kill it, which turns "let me look" into a
    // decision. Read on a thread in the tiny bit of raw mode that delivers a keystroke
    // without waiting for a newline — signals stay on, so Ctrl-C is unaffected.
    let detached = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let keys = crate::screen::Keys::capture();
    if keys.is_some() {
        let flag = detached.clone();
        std::thread::spawn(move || {
            use std::io::Read;
            let mut byte = [0u8; 1];
            while std::io::stdin().read_exact(&mut byte).is_ok() {
                if byte[0] == 0x18 {
                    flag.store(true, std::sync::atomic::Ordering::Relaxed);
                    return;
                }
            }
        });
    }
    {
        let flag = interrupted.clone();
        // Tokio's handler rather than a new dependency; a current-thread runtime on its
        // own thread is enough to own it, and the tail itself stays blocking.
        std::thread::spawn(move || {
            if let Ok(rt) = tokio::runtime::Builder::new_current_thread().enable_all().build() {
                rt.block_on(async {
                    if tokio::signal::ctrl_c().await.is_ok() {
                        flag.store(true, std::sync::atomic::Ordering::Relaxed);
                    }
                });
            }
        });
    }
    let mut seen = 0u64;
    let started = Instant::now();
    // Where the run began, so the bar measures THIS run rather than the repo's whole
    // history. A repo that was already 90% read would otherwise open at 90% and creep,
    // which says nothing about the thing you just started.
    let mut banked_at_start: Option<u64> = None;
    // Whether a status line is currently on screen and needs erasing before anything else
    // prints. Tracked rather than assumed: the first pass has drawn nothing yet, and
    // erasing a line that is not there eats the line above it.
    let mut drawn = false;
    /// Width of the name column, so the leaders end where the grades begin.
    const NAME_COL: usize = 38;
    /// Width of each grade column. Ten, not eight, because `predicted` and `derivable` are
    /// nine characters — a heading wider than its own column pushes every column right of
    /// it out of line with the rows beneath, which is what the header was doing.
    const GRADE_COL: usize = 10;
    // Carried across polls, because the poll that fails is the one that cannot tell you what
    // the run got through — and that is exactly when somebody wants to know.
    let mut done = 0u64;

    // **A fixed block, redrawn in place, and it never grows.** The readings used to stream,
    // so the column header was gone after twenty of them and `most none full yes` was four
    // words in a row. The first fix reserved screen rows with a scroll region, which is
    // defined in ABSOLUTE rows — it pinned the top of the display rather than the header,
    // and the header scrolled off anyway.
    //
    // This keeps the last few readings and rewrites them where they are. Nothing scrolls, so
    // nothing scrolls off, and the escape sequences are two: up N lines, clear a line.
    for line in banner {
        println!("{line}");
    }
    // **Held until the first reading lands.** A wave takes minutes to bank anything, and a
    // run that banks nothing at all — a misconfigured harness, a repo somebody has already
    // read — leaves four headings floating over an empty table with a progress bar under
    // them. Headings label rows; with no rows they are decoration that looks like a fault.
    let header = if fancy() {
        let (d, o) = ("\x1b[2m", "\x1b[0m");
        format!(
            "  {d}{:<NAME$} {:<G$}{:<G$}{:<G$}derivable{o}",
            "function",
            "predicted",
            "doc'd",
            "legible",
            NAME = NAME_COL,
            G = GRADE_COL,
        )
    } else {
        format!(
            "  {:<NAME$} {:<G$}{:<G$}{:<G$}derivable",
            "function",
            "predicted",
            "doc'd",
            "legible",
            NAME = NAME_COL,
            G = GRADE_COL,
        )
    };
    let mut header_drawn = false;
    /// How many readings stay on screen. Enough to see a run working and to catch a
    /// surprising grade going past; few enough that the block fits any terminal worth
    /// running this in.
    const KEEP: usize = 10;
    let mut recent: std::collections::VecDeque<String> = std::collections::VecDeque::new();
    // Rows this loop has drawn and will overwrite next time: the readings plus the progress
    // line. Zero until the first draw, because moving up over rows nobody wrote eats the
    // banner.
    let mut block = 0usize;
    loop {
        if detached.load(std::sync::atomic::Ordering::Relaxed) {
            // Raw mode goes back before anything else prints — see `Keys`' `Drop` — so the
            // summary lands on an ordinary terminal. The block stays where it is: it is the
            // last few readings, and they are worth keeping on screen.
            drop(keys);
            println!();
            println!();
            println!("Detached. The run continues.");
            println!("  `sanity status {}` says how far along it is.", want.repo.display());
            println!();
            return 0;
        }
        if interrupted.swap(false, std::sync::atomic::Ordering::Relaxed) {
            println!();
            println!("Stopping readers…");
            let _ = post(&ep, "/stop", json!({ "project": key }));
            // Kept tailing rather than returning: the readers take a moment to die, and
            // the run's own summary is the honest answer to "what did I just spend".
        }
        let Ok(st) = get(&ep, &format!("/status?project={}", urlencode(key))) else {
            // **Opening the app kills the daemon this run was living in**, by design: one
            // backend per machine, and a human at the window beats a background process. The
            // run went with it, and the only way to continue was to notice and retype the
            // command — which is what happened, and is not a thing a tool should ask of
            // somebody watching a progress bar.
            //
            // So: look for whoever is serving now, and reissue. Bounded and single-shot,
            // because a loop that keeps re-starting waves against a backend that keeps
            // dying is a worse failure than stopping.
            if let Some(next) = await_backend(Instant::now() + START_WAIT) {
                if next.pid != ep.pid {
                    if drawn {
                        print!("\r\x1b[K");
                        drawn = false;
                    }
                    println!();
                    println!("The app took over. Continuing there.");
                    println!();
                    if resume(&next, want).is_ok() {
                        ep = next;
                        continue;
                    }
                }
            }
            // Nothing is serving, or the new backend refused. Reported as the RUN ending,
            // because that is the only part anybody has a stake in.
            // It said "lost the backend … the run may still be going", which
            // asks somebody to hold a lifecycle in their head: backends are ephemeral, there
            // is only ever one, the next command starts another and so does opening the
            // window. None of that is a fact worth teaching at the moment a run stops.
            //
            // What IS true and useful: every reading is written to `.sanity/` as it lands,
            // so what was banked is safe and the only loss is whatever was in flight.
            if drawn {
                print!("\r\x1b[K");
            }
            drop(keys);
            println!();
            println!("The run stopped early.");
            println!();
            println!("  {} in {}", plural(done, "reading"), elapsed(started));
            println!("  `sanity check` picks up where it left off.");
            println!();
            return 1;
        };
        if let Some(events) = st.get("events").and_then(|v| v.as_array()) {
            for e in events {
                let seq = e.get("seq").and_then(|v| v.as_u64()).unwrap_or(0);
                if seq <= seen {
                    continue;
                }
                seen = seq;
                // Only readings. Hand-outs churn several a second during a wave and would
                // bury the results they precede.
                if e.get("stage").and_then(|v| v.as_str()) != Some("read") {
                    continue;
                }
                let grade = text(e, "predicted");
                let (ink, off) = grade_ink(grade);
                let name = text(e, "name");
                let shown: String = name.chars().take(NAME_COL).collect();
                let dots = NAME_COL - shown.chars().count();
                let leader = if fancy() {
                    format!("\x1b[2m{}\x1b[0m", "·".repeat(dots))
                } else {
                    " ".repeat(dots)
                };
                let row = format!(
                    "  {shown}{leader} {ink}{:<G$}{off}{:<G$}{:<G$}{}",
                    grade,
                    text(e, "documented"),
                    // Absent when the grade was taken under a superseded question — see
                    // `Event::legible`. A dash, not a blank: the column still exists.
                    match text(e, "legible") {
                        "" => "—",
                        g => g,
                    },
                    match e.get("derivable").and_then(|v| v.as_bool()) {
                        Some(true) => "yes",
                        Some(false) => "no",
                        None => "—",
                    },
                    G = GRADE_COL,
                );
                // A log gets every reading, in order, as it lands. A terminal gets the last
                // few, rewritten in place — the same information, with the header still
                // above it.
                // The header arrives with the row it labels. In a terminal the progress line
                // is already on screen and the cursor is sitting on it, so it is erased first
                // — printing over it would leave its tail beside the headings. `block` is
                // still zero here (nothing has been drawn above the progress line yet), so
                // the next redraw starts below the header and leaves it alone.
                if !header_drawn {
                    if fancy() && drawn {
                        print!("\r\x1b[K");
                        drawn = false;
                    }
                    println!("{header}");
                    header_drawn = true;
                }
                if fancy() {
                    recent.push_back(row);
                    while recent.len() > KEEP {
                        recent.pop_front();
                    }
                } else {
                    println!("{row}");
                }
            }
        }

        let run = st.get("run").cloned().unwrap_or(Value::Null);
        let assessed = num(&st, "assessed");
        let remaining = num(&st, "remaining");
        if banked_at_start.is_none() {
            banked_at_start = Some(assessed);
        }
        let from = banked_at_start.unwrap_or(assessed);
        done = assessed.saturating_sub(from);
        let target = done + remaining;

        if run.get("running").and_then(|v| v.as_bool()) == Some(false) {
            let failed = num(&run, "failed");
            // Erased and not reset: this branch returns, so the flag has no reader left.
            if drawn {
                print!("\r\x1b[K");
            }
            drop(keys);
            println!();
            // Why it ended, then what it did. The first line is the backend's own sentence,
            // printed bare — "Stopped at your request.", "Reached the limit of 10 readings."
            // — and the rest is the answer to "what did I just spend", which is the whole
            // reason an interrupted run keeps tailing instead of returning at the keystroke.
            println!("{}", text(&run, "ended"));
            println!();
            println!("  {} in {}", plural(done, "reading"), elapsed(started));
            // Named rather than folded into the total. A misconfigured agent exits
            // instantly, so a run that banked nothing looks merely disappointing until you
            // see that every reader failed.
            if failed > 0 {
                println!("  {} failed", plural(failed, "reader"));
            }
            println!(
                "  {} of {} read, {} to go",
                commas(num(&st, "assessed")),
                commas(num(&st, "functions") + num(&st, "files")),
                commas(num(&st, "remaining")),
            );
            println!();
            return 0;
        }

        // **The whole block, rewritten where it is.** Only where there is a terminal: in a
        // log or a pipe this would be a carriage return every two seconds and nothing
        // legible at the end, so a non-terminal gets the readings as they land and no chrome
        // at all.
        if fancy() {
            let frac = if target == 0 { 0.0 } else { done as f64 / target as f64 };
            // **Live AND spawned, because the two answer different questions and the line
            // used to answer only one.** `live` is the concurrency somebody chose in the
            // dialog and does not move; what climbs is how many readers have been out, since
            // each takes a batch and exits. The window's panel shows `spawned` in the same
            // visual slot, so a line saying "5 readers" beside a panel saying "30 started"
            // read as two counts of one thing disagreeing.
            let readers = num(&run, "live");
            let spawned = num(&run, "spawned");
            let mut out = String::new();
            // Back to the top of what was drawn last time. Relative, so it does not care
            // where on the screen it is — the mistake the scroll region made.
            //
            // **Up by the ROWS ABOVE the cursor, not by the rows drawn.** The last thing
            // written is the progress line, with no newline after it, so the cursor is
            // sitting on it: the block is `rows + 1` lines tall but only `rows` of them are
            // above. Moving up the full height overshot into the banner and left the old
            // progress line untouched below — the banner was eaten one line per poll while
            // the progress lines stacked up.
            out.push('\r');
            if block > 0 {
                out.push_str(&format!("\x1b[{block}A"));
            }
            for row in &recent {
                out.push_str("\r\x1b[K");
                out.push_str(row);
                out.push('\n');
            }
            out.push_str(&format!(
                "\r\x1b[K\x1b[2m▕\x1b[0m{}\x1b[2m▏\x1b[0m {}/{} · {} of {} · {}",
                bar(frac),
                commas(done),
                commas(target),
                commas(readers),
                plural(spawned, "reader"),
                elapsed(started),
            ));
            print!("{out}");
            let _ = std::io::Write::flush(&mut std::io::stdout());
            // What is ABOVE the cursor now: the readings. The progress line is the one the
            // cursor is on, so it is cleared by the `\r\x1b[K` at the start rather than
            // counted here.
            block = recent.len();
            drawn = true;
        }
        std::thread::sleep(Duration::from_secs(2));
    }
}

/// The block every verb opens with: what the repo is, and how much of it has been read.
///
/// **One function because it was drifting.** `status` and `summary` both printed a header
/// and they disagreed about the denominator, about whether stale was inside "to go", and
/// about whether file headers counted — three different answers to the same question in two
/// commands somebody runs one after the other. Anything below this line is the verb's own
/// business; this part is the repo, and the repo does not change depending on which verb
/// asked.
fn project_header(v: &Value) {
    let funcs = num(v, "functions");
    let files = num(v, "files");
    let total = funcs + files;
    let read = num(v, "assessed");
    let stale = num(v, "stale");
    let togo = num(v, "remaining");
    // Read, never read, and expired: three states that sum to the total. `remaining`
    // CONTAINS the stale ones — they are queued ahead of anything unread — so subtracting is
    // the only way to state them as three disjoint numbers, and stating them any other way
    // invites adding two of them together.
    let never = togo.saturating_sub(stale);
    let pct = |n: u64| if total == 0 { 0.0 } else { n as f64 * 100.0 / total as f64 };

    println!("Project: {}", text(v, "project"));
    print!(
        "  {} segments ({} functions + {} file headers)",
        commas(total),
        commas(funcs),
        commas(files)
    );
    if num(v, "excluded") > 0 {
        print!(", {} excluded by .sanityignore", commas(num(v, "excluded")));
    }
    println!();
    println!("  {} read ({:.1}%)", commas(read), pct(read));
    // **Said in the header, because every git-derived number below and on the map depends on
    // it.** `untraced` is not "this repo has no history" — it is history nobody has paid for
    // yet, and the cost of paying is printed beside it so the next command is obvious.
    match v.get("trace_depth").and_then(|d| d.as_str()) {
        Some("edits") => println!("  History read to the line, with every edit counted"),
        Some("lines") => println!("  History read to the line"),
        Some("files") => {
            println!("  History read per file — `sanity trace --blame` for per-function")
        }
        // **Absent is not `untraced`.** The offline answer — computed from the repo when no
        // backend is running — knows nothing about what a map is holding, and printing "history
        // not read" there would be inventing a fact from a missing field. Nothing is said.
        None => {}
        Some(_) => {
            let cost = v.get("trace_cost_s").and_then(|x| x.as_f64());
            println!(
                "  History not read{} — `sanity trace`",
                match cost {
                    Some(s) if s >= 60.0 => format!(" (about {:.0} min)", s / 60.0),
                    Some(s) => format!(" (about {:.0}s)", s.max(1.0)),
                    None => String::new(),
                }
            );
        }
    }
    println!("  {} unread ({:.1}%)", commas(never), pct(never));
    println!("  {} stale ({:.1}%)", commas(stale), pct(stale));
    if let Some(n) = v.get("in_flight").and_then(|x| x.as_u64()) {
        if n > 0 {
            println!("  {} out with readers now", commas(n));
        }
    }
    println!("  readings in {}", text(v, "assessment_file"));
}

/// What `/status` would say, computed here, for when no backend is answering.
///
/// In-process on purpose, and for the same reason `refresh` is: this is a look at a repo,
/// and the repo is the authority on everything it reports. It scans — seconds — which is
/// the price of an answer, and it changes nothing: no project is registered, no daemon
/// starts, no file is written.
///
/// Shaped like the endpoint's payload so `status` has one formatter rather than two. The
/// fields only a running backend can know are absent rather than zeroed: `in_flight` says
/// how much work is out with readers, and reporting none of it when the truth is unknown is
/// the same overstatement `work_left` exists to prevent.
fn offline_status(repo: &std::path::Path) -> Option<Value> {
    let (scan, reports) = read_repo(repo)?;
    let counted = agentapi::offline_counts(&scan, &reports);
    Some(json!({
        "project": repo.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        "repo": repo.to_string_lossy(),
        "functions": counted.functions,
        "files": counted.files,
        "excluded": counted.excluded,
        "assessed": counted.assessed,
        "remaining": counted.remaining,
        "stale": counted.stale,
        "assessment_file": crate::assessment::dir(repo).to_string_lossy(),
    }))
}

/// What `/summary` would say, computed here — the aggregate half of [`offline_status`].
///
/// It refused before, on the grounds that a second payload shape is a second thing to keep
/// in step with an endpoint. That was a fair worry and the wrong conclusion: the shape comes
/// from `aggregate_of`, which is the function the endpoint itself calls, so there is one
/// definition and no drift to prevent. What was left was `sanity summary` failing at a
/// question whose entire answer is committed in the repo it is standing in.
fn offline_summary(repo: &std::path::Path) -> Option<Value> {
    let (scan, reports) = read_repo(repo)?;
    let counted = agentapi::offline_counts(&scan, &reports);
    let agg = agentapi::aggregate_of(&scan, &reports);
    Some(json!({
        "open": true,
        // The header wants both, and it is shared with `status` — so a field only one of
        // them supplied is a blank line in the other.
        "project": repo.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
        "assessment_file": crate::assessment::dir(repo).to_string_lossy(),
        "repo": repo.to_string_lossy(),
        "functions": counted.functions,
        "files": counted.files,
        "excluded": counted.excluded,
        "assessed": counted.assessed,
        "stale": agg.stale,
        "remaining": counted.remaining,
        "total": agg.total,
        "by_model": agg.by_model,
        "by_position": agg.by_position,
        "priming": agg.priming,
    }))
}

/// Parse a repo and load its committed readings. The two things every offline answer needs.
fn read_repo(
    repo: &std::path::Path,
) -> Option<(crate::scan::Scan, std::collections::HashMap<String, agentapi::Report>)> {
    let scans = crate::scancache::ScanCache::open(repo);
    let scan = crate::scan::scan(
        repo,
        &crate::surprise::HeuristicModel,
        &|_| {},
        &|_, _: &crate::surprise::Reading| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
        // Ordering, like `refresh`: the proxy scores decide nothing this prints.
        crate::scan::Fidelity::Ordering,
        // And no git, for the same reason one step further: what this prints is reading
        // coverage, which comes out of `.sanity/` and the parse. Blaming every file to print
        // how many functions have been read was minutes of somebody's terminal spent on
        // numbers this verb does not have a column for.
        crate::trace::Depth::Untraced,
    )
    .map_err(|e| {
        eprintln!("sanity: could not scan {}: {e}", repo.to_string_lossy());
    })
    .ok()?;
    let reports = crate::assessment::load(repo, &scan);
    Some((scan, reports))
}

/// Fetch one repo's view of an endpoint, or explain why there isn't one.
///
/// Read verbs never start a backend and never open a repo. Opening rescans, which is
/// seconds of work and a change to what the app is holding — surprising things for a
/// command whose name promises only to look. So the answer to "not open" is the name of
/// the command that would open it.
fn read_verb(path: &str, endpoint: &str) -> Result<Value, i32> {
    let repo = resolve(path).map_err(|e| {
        eprintln!("sanity: {e}");
        1
    })?;
    let Some(ep) = live() else {
        // **Answered from the repo instead of refused.** The rule this obeys is still right
        // — a read verb must not start a daemon or rescan what the app is holding — but the
        // conclusion drawn from it was to fail, and to point at `check`, which is not a
        // looking command at all: it spends money. The numbers here are a parse plus the
        // committed `.sanity/`, both of which are sitting in the repo, so nothing about
        // them needs a backend. What is genuinely unavailable is the live half — what is
        // out with readers right now — and the caller says so rather than reporting zero.
        return match endpoint {
            "/status" => offline_status(&repo).ok_or(1),
            _ => offline_summary(&repo).ok_or(1),
        };
    };
    let key = agentapi::project_key(&repo);
    let v = get(&ep, &format!("{endpoint}?project={}", urlencode(&key))).map_err(|e| {
        eprintln!("sanity: {e}");
        1
    })?;
    // A backend that has never heard of this repo is the same situation as no backend: the
    // answer is in the repo either way, and refusing sends somebody to `check`, which is not
    // a looking command. It happens more than it sounds — a daemon that restarted, or one
    // started for a different project — and it is the third door into the same refusal.
    //
    // The repo is NOT opened to fix it: opening rescans and changes what the app is holding,
    // which a verb promising only to look must not do. It is computed instead.
    if !v.get("open").and_then(|x| x.as_bool()).unwrap_or(false) {
        return match endpoint {
            "/status" => offline_status(&repo).ok_or(1),
            _ => offline_summary(&repo).ok_or(1),
        };
    }
    Ok(v)
}

/// Read this repo's history onto the map, because somebody asked.
///
/// **The whole ladder by default, and the budget only where it would cost minutes.** A scan
/// reads no git at all and a launch only restores what fits ten seconds — see `trace::go` — so
/// on a large repo the map arrives with no age, churn or author in it, and this is how a person
/// says go. Unflagged, every rung that fits the same ten seconds is read, priced on what is not
/// already cached — see `trace::affordable`. `--edits` or `--blame` names a rung and spends
/// whatever it costs: an explicit flag is permission, and the one thing this owes somebody is
/// knowing what they bought.
///
/// It opens the repo first, because there has to be something to land the history ON.
fn trace(path: &str, want: Want) -> i32 {
    let repo = match resolve(path) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    let ep = match ensure_backend() {
        Ok(ep) => ep,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    let key = agentapi::project_key(&repo);
    // Opened first: a trace lands on a scan, so a repo the backend has never heard of has
    // nothing to land on. `open` is idempotent and is what `sanity check` does for the same
    // reason.
    // **Read the answer, don't just check that the post went through.** `/open` refuses a
    // path no human has added — that is the door readers are kept out of — and it says so
    // in the body rather than by failing. Ignoring it here meant `sanity trace` in a repo
    // that had never seen `sanity init` printed the agent-facing "no project is open",
    // which tells a person at a terminal to call `sanity_report` again five times.
    let opened = match post(
        &ep,
        "/open",
        serde_json::json!({ "path": repo.to_string_lossy(), "project": key }),
    ) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    if !opened.get("ok").and_then(|v| v.as_bool()).unwrap_or(false) {
        eprintln!("sanity: {}", text(&opened, "error"));
        // The endpoint's own hint is written for a reader — "ask the human to add it" —
        // and the human is who is standing here. Say the command instead.
        eprintln!();
        eprintln!("    sanity init");
        eprintln!();
        return 1;
    }
    println!();
    let depth = match want {
        Want::Budget => "budget",
        Want::Exactly(depth) => depth.tag_str(),
    };
    println!(
        "Reading {}…",
        match want {
            Want::Budget => "as much history as fits the budget".to_string(),
            Want::Exactly(depth) => rung_name(depth).to_lowercase(),
        }
    );
    let body = serde_json::json!({ "project": key, "depth": depth });
    match post(&ep, "/trace", body) {
        Ok(v) if v.get("ok").and_then(|x| x.as_bool()) == Some(true) => {
            println!();
            println!(
                "  {} in {:.1}s{}",
                match v.get("depth").and_then(|d| d.as_str()) {
                    Some("edits") => "Every function has its own age, author and edit count",
                    Some("lines") => "Every function has its own age, churn and author",
                    Some("files") => "Every file has an age, a churn and an author",
                    _ => "No history read",
                },
                v.get("seconds").and_then(|x| x.as_f64()).unwrap_or(0.0),
                if v.get("stopped").and_then(|x| x.as_bool()) == Some(true) {
                    " (stopped — what it read is kept)"
                } else {
                    ""
                },
            );
            let declined = v.get("declined").and_then(|d| {
                Some((
                    crate::trace::Depth::from_tag(d.get("depth")?.as_str()?),
                    d.get("seconds")?.as_f64()? as f32,
                ))
            });
            if let Some((rung, seconds)) = declined {
                println!();
                println!(
                    "  {} skipped: about {} against a {}s budget — `sanity trace --edits --blame`",
                    rung_name(rung),
                    duration(seconds),
                    crate::trace::BUDGET.as_secs()
                );
                println!("  reads it anyway.");
            }
            println!();
            0
        }
        Ok(v) => {
            eprintln!("sanity: {}", text(&v, "error"));
            1
        }
        Err(e) => {
            eprintln!("sanity: {e}");
            1
        }
    }
}

/// A rung as a person reads it, in a sentence about skipping or reading it.
fn rung_name(depth: crate::trace::Depth) -> &'static str {
    match depth {
        crate::trace::Depth::Edits => "The edit timeline",
        crate::trace::Depth::Lines => "Per-line history",
        _ => "The commit log",
    }
}

/// An estimate, rounded the way `status` rounds one.
fn duration(seconds: f32) -> String {
    if seconds >= 60.0 {
        format!("{:.0} min", seconds / 60.0)
    } else {
        format!("{:.0}s", seconds.max(1.0))
    }
}

/// How far along an assessment is. A formatter over `/status` and nothing more.
///
/// Everything printed here was computed by the endpoint the window and the orchestrator
/// already read. Recomputing any of it in the CLI would be two implementations of one
/// answer, and the one nobody is looking at is the one that goes wrong — which is exactly
/// how a whole repo's readings lost `derivable`.
pub fn status(path: &str) -> i32 {
    let v = match read_verb(path, "/status") {
        Ok(v) => v,
        Err(code) => return code,
    };
    println!();
    // Named, because everything below reads differently depending on the answer: with one
    // running these are live numbers including work in flight, without one they are the repo
    // as it sits on disk. The pid is there so "running" can be acted on — it is the one
    // thing you need to look at the process, and a daemon nobody can name is a rumour.
    match v.get("in_flight") {
        Some(_) => {
            println!("Backend: running (pid {}, port {})", num(&v, "pid"), num(&v, "port"));
            let run = v.get("run").cloned().unwrap_or(Value::Null);
            if run.get("running").and_then(|x| x.as_bool()) == Some(true) {
                println!(
                    "  reading with {} — {}, {} started{}",
                    text(&run, "model"),
                    plural(num(&run, "live"), "reader"),
                    commas(num(&run, "spawned")),
                    if num(&run, "failed") > 0 {
                        format!(", {} failed", commas(num(&run, "failed")))
                    } else {
                        String::new()
                    },
                );
            } else {
                println!("  nothing reading right now");
            }
        }
        None => println!("Backend: not running"),
    }
    println!();
    project_header(&v);
    println!();
    let togo = num(&v, "remaining");
    if togo == 0 {
        println!("  Every segment has an up-to-date reading.");
    } else {
        // The sum, once, as the thing to do about it. Unread and stale are different work —
        // one is a first reading, the other a re-reading — but they are one command.
        println!("  {} segments need updating, run `sanity check`", commas(togo));
    }
    println!();
    0
}

/// What is worth looking at in this repo, ranked.
///
/// **In process, like `refresh` and unlike `status`.** The read verbs ask the backend because
/// what they report is partly LIVE — what is out with readers this second — and a number that
/// stale is worse than no number. A finding is not live: it is the tree, the readings in
/// `.sanity/` and the rules beside them, all of which are on disk. Asking a daemon for it
/// would mean an endpoint, a second answer, and a repo whose findings depend on whether the
/// app happens to be open.
///
/// **One subject per entry, not one per rule**, the same merge the panel does — a function
/// three rules flagged is one thing to look at, not three. `just findings` prints the other
/// view, per rule with its calibration and its marginal contribution; that is a question about
/// the CATALOG and this is a question about the repo.
pub fn findings(path: &str, limit: usize, edits: bool, blame: bool) -> i32 {
    let Survey { path, facts, rules, traced, read, declined, .. } =
        match survey(path, Want::of(edits, blame)) {
        Ok(s) => s,
        Err(code) => return code,
    };
    let groups = crate::findings::report(
        &facts,
        traced,
        read,
        &rules,
        &crate::findings::archive(&path),
    );
    list(&path, limit, &groups, declined)
}

/// Who calls one function, named rather than counted.
///
/// **The pairs behind the number, because a count cannot be argued with.** `callers` and
/// `dependents` are folded from the edge list [`crate::edges::wire`] builds, and a finding
/// spends them in a sentence — *a change here has to be checked against all 21*. Whether that
/// sentence is true is not something the number can answer: calls resolve by NAME and there is
/// no type checker, so the only check available is to read the callers back and see whether
/// they are the ones a person would name. See `docs/notes/wiring.md`, which is the record of
/// this going wrong twice.
///
/// **Grouped by file, with the subject's own file marked, because that split is the tell.**
/// A caller in another file is a claim that one file reaches into another, and for a body its
/// language cannot export that claim is false by construction rather than merely unlikely.
fn callers(path: &str, key: &str) -> i32 {
    // Files, as it always was: a caller list reads no history, and pricing blame to print one
    // would be paying for a question nobody asked.
    let Survey { facts, links, .. } = match survey(path, Want::Exactly(crate::trace::Depth::Files)) {
        Ok(s) => s,
        Err(code) => return code,
    };
    let Some(f) = facts.iter().find(|f| f.subject.key == key) else {
        eprintln!("sanity: `{key}` is not on the map.");
        eprintln!("       `sanity findings` prints the key of every finding, which is this.");
        return 1;
    };
    let s = &f.subject;
    // A file has no body and makes no calls; the question only means something about a
    // function, and answering it with an empty list would read as one nothing calls.
    let Some(line) = s.line else {
        eprintln!("sanity: `{key}` is a file, and callers are a question about a function.");
        return 1;
    };
    if links.is_empty() {
        eprintln!("sanity: this scan built no call graph, so nothing here can be answered.");
        return 1;
    }
    let Some(rel) = links.at(&s.path, line) else {
        eprintln!("sanity: no function starts at {}:{line}.", s.path);
        return 1;
    };

    println!();
    println!("{key}");
    // **Not read for calls is not "nothing calls it".** The same distinction `Related::wired`
    // is carried for: an empty list from a language nobody taught this to follow is a silence,
    // and printing it as a zero would be the instrument claiming a measurement it never took.
    if !rel.wired {
        let lang = s.lang.clone().unwrap_or_else(|| "this language".to_string());
        println!("  {lang} is not read for calls here, so no caller is claimed.");
        println!();
        return 0;
    }
    let here = rel.callers.iter().filter(|r| r.path == s.path).count();
    let away = rel.callers.len() - here;
    println!(
        "  {}, {here} in this file and {away} elsewhere",
        plural(rel.callers.len() as u64, "caller")
    );
    println!();
    let mut by_file: std::collections::BTreeMap<&str, Vec<&crate::links::Ref>> = Default::default();
    for r in &rel.callers {
        by_file.entry(r.path.as_str()).or_default().push(r);
    }
    for (file, mut refs) in by_file {
        refs.sort_by_key(|r| r.line);
        let own = if file == s.path { "  (its own file)" } else { "" };
        println!("  {file}{own}");
        for r in refs {
            let name = match &r.owner {
                Some(o) => format!("{o}::{}", r.name),
                None => r.name.clone(),
            };
            println!("    {:>5}  {name}", r.line);
        }
    }
    println!();
    0
}

/// Everything a question about this repo's findings is answered from.
///
/// **One setup, because two would be two answers.** The list and the four decision verbs ask
/// the same three things — what is in the tree, what this repo's thresholds are, and how deep
/// the trace went — and a verb that built them differently would pin a decision against
/// numbers the list never showed anybody. `commands::finding_pin` is the window's copy of the
/// same three lines, for the same reason.
struct Survey {
    path: std::path::PathBuf,
    facts: Vec<crate::findings::Facts>,
    rules: Vec<crate::findings::Rule>,
    traced: crate::findings::Traced,
    /// Whether anything here has been read. `report` needs it to tell a rule nobody can answer
    /// yet from one that is answered and silent.
    read: bool,
    /// Who calls whom, off the same scan the facts came from — see [`crate::links`]. The
    /// counts a finding quotes are folded from these edges, so a verb that shows the pairs
    /// reads them from here rather than building a second graph that could disagree.
    links: std::sync::Arc<crate::links::Links>,
    /// The rung the budget refused and what it would have cost — see [`crate::trace::affordable`].
    declined: Option<(crate::trace::Depth, f32)>,
}

/// How deep a survey reads history.
#[derive(Clone, Copy)]
enum Want {
    /// As deep as fits [`crate::trace::BUDGET`], priced on what is not already cached.
    Budget,
    /// This rung, whatever it costs — somebody typed the flag.
    Exactly(crate::trace::Depth),
}

impl Want {
    /// `--edits` and `--blame` name a rung; neither leaves it to the budget.
    fn of(edits: bool, blame: bool) -> Want {
        match (edits, blame) {
            (true, _) => Want::Exactly(crate::trace::Depth::Edits),
            (_, true) => Want::Exactly(crate::trace::Depth::Lines),
            _ => Want::Budget,
        }
    }
}

fn survey(path: &str, want: Want) -> Result<Survey, i32> {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return Err(2);
        }
    };
    let scans = crate::scancache::ScanCache::open(&path);
    // **The log walk by default, not per-line blame.** Blame is what `budgets.md` measures at
    // 206 seconds of a 214-second cold ceph scan, and worse on a repo with 59,000 files; a
    // verb whose first use is "what is worth looking at here" cannot open with that. The log
    // gives every rule an answer at file resolution, which is what `score_dir` hands a
    // function anyway wherever blame could not read it — and the two deeper rungs are there
    // to be asked for. Named here rather than inline because `blocked` has to know which rung
    // was taken: `headcount` is blame's alone, and a rule asking for it on a log-traced repo
    // must say so rather than finding nothing.
    let forced = match want {
        Want::Budget => None,
        Want::Exactly(depth) => Some(depth),
    };
    // `Ordering` fidelity: every reading clause is answered from `.sanity/` or not at all —
    // see `findings::Field::Surprise`, which is `None` on an unread body rather than falling
    // back to a proxy score. Paying for the all-pairs term would buy a number nothing here
    // prints.
    let scan = match crate::scan::scan(
        &path,
        &crate::surprise::HeuristicModel,
        &|_| {},
        &|_, _: &crate::surprise::Reading| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
        crate::scan::Fidelity::Ordering,
        // Untraced when the budget decides, because blame is priced per file and there are no
        // files to price until the tree exists. The deepening below lands the same fields an
        // inline trace would — `a_deferred_trace_lands_exactly_where_an_inline_one_did`.
        forced.unwrap_or(crate::trace::Depth::Untraced),
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("sanity: could not scan {}: {e}", path.to_string_lossy());
            return Err(1);
        }
    };
    let mut scan = scan;
    let (want, declined) = match forced {
        Some(depth) => (depth, None),
        None => {
            let (depth, declined) = crate::trace::affordable(&path, &scan, &scans);
            let reached = crate::trace::deepen(
                &path,
                &mut scan,
                depth,
                &scans,
                &std::sync::atomic::AtomicBool::new(false),
                &|_| {},
                &|_| {},
            )
            .0;
            (reached, declined)
        }
    };
    let reports = crate::assessment::load(&path, &scan);
    // **A reading is applied here, not inside the scan.** `wire` answers from the parse and
    // the paths; what a reader said about which bodies are tests lands afterwards — see
    // `links::retest_tree`. The app does this when a reading arrives; a headless verb has to
    // do it once, on the way past, or every CLI answer is the structural half only.
    crate::links::retest_tree(&mut scan, &reports);
    let traced = crate::findings::Traced::of(&scan.stats, want);
    let facts = crate::findings::subjects(&scan.root, &reports, traced);
    let rules = crate::findings::rules_for(&path, &facts);
    let read = !reports.is_empty();
    let links = scan.links.clone();
    Ok(Survey { path, facts, rules, traced, read, links, declined })
}

/// Record what somebody decided about a finding — the CLI's copy of the three buttons.
///
/// **Every rule that raises the subject, unless one is named.** The panel merges a subject's
/// rules into one tile and writes a decision per rule behind it, and a verb that wrote only
/// the first would leave the others standing and the finding half-decided. `--rule` is for the
/// case the tile cannot express: this is fine BECAUSE it is long, but the tangle still stands.
///
/// **A rule that cannot answer cannot be decided under.** A pin records what the rule
/// MEASURED, so one taken while the churn rules are dark would be a pin full of absences that
/// matches nothing ever again. Those rules are named and refused rather than written.
fn decide(
    path: &str,
    key: &str,
    rule: Option<&str>,
    verdict: crate::findings::Verdict,
    reason: &str,
    edits: bool,
    blame: bool,
) -> i32 {
    let Survey { path, facts, rules, traced, read, .. } =
        match survey(path, Want::of(edits, blame)) {
        Ok(s) => s,
        Err(code) => return code,
    };
    let Some(f) = facts.iter().find(|f| f.subject.key == key) else {
        eprintln!("sanity: `{key}` is not on the map.");
        eprintln!("       `sanity findings` prints the key of every finding, which is this.");
        return 1;
    };
    // Only rules that RAISE it, so a decision is always about something somebody was shown.
    let raising: Vec<&crate::findings::Rule> = rules
        .iter()
        .filter(|r| rule.is_none_or(|want| r.id == want))
        .filter(|r| crate::findings::matches(r, f))
        .collect();
    if raising.is_empty() {
        match rule {
            Some(id) => eprintln!("sanity: `{id}` does not raise `{key}`."),
            None => eprintln!("sanity: nothing raises `{key}` — there is no finding to decide."),
        }
        // **A rule that cannot answer is not a rule that found nothing**, and the difference is
        // the whole reason `blocked` exists. Without this line the message reads as "there is
        // no such finding" to somebody looking straight at it in the window, whose project is
        // traced where this invocation is not.
        let dark = rules.iter().filter(|r| crate::findings::blocked(r, &facts, traced, read).is_some());
        let names: Vec<&str> = dark.map(|r| r.title.as_str()).take(3).collect();
        if !names.is_empty() {
            eprintln!(
                "       {} and others cannot answer here — add --edits or --blame if the",
                names.join(", ")
            );
            eprintln!("       finding you are looking at needs history.");
        }
        return 1;
    }

    let by = crate::assessment::who(&path);
    let when = crate::assessment::now_iso();
    let mut wrote = 0usize;
    for r in &raising {
        // Blocked is the rule's own answer to "could I have measured this repo", and it is the
        // one thing that makes a pin meaningless — see the doc above.
        if let Some(b) = crate::findings::blocked(r, &facts, traced, read) {
            println!("  {} — not decided: {}", r.title, b.why);
            continue;
        }
        let d = crate::findings::Decision {
            key: key.to_string(),
            rule: r.id.clone(),
            title: r.title.clone(),
            verdict,
            pin: crate::findings::pin_of(r, f),
            reason: reason.to_string(),
            when: when.clone(),
            by: by.clone(),
        };
        if let Err(e) = crate::findings::decide(&path, d) {
            eprintln!("sanity: could not write the decision: {e}");
            return 1;
        }
        wrote += 1;
    }
    if wrote == 0 {
        return 1;
    }

    // **Read back, never trusted.** `decide` rewrites the whole archive, and an `Ok` from a
    // write is not evidence that what came back off disk says what was meant — the migration
    // that destroyed a project's readings is the reason this rule exists.
    let back = crate::findings::archive(&path);
    let filed: Vec<&crate::findings::Decision> =
        back.iter().filter(|d| d.key == key && d.verdict == verdict).collect();
    if filed.len() < wrote {
        eprintln!("sanity: wrote {wrote} decisions and read {} back — nothing is settled.", filed.len());
        return 1;
    }
    println!();
    println!("{key}");
    for d in filed {
        println!("  {} — {}", d.title, crate::findings::Verdict::word(d.verdict));
    }
    println!();
    println!("{}", verdict_note(verdict));
    0
}

/// What the decision just made will DO, which is the half a verdict name does not say.
fn verdict_note(v: crate::findings::Verdict) -> &'static str {
    match v {
        crate::findings::Verdict::Flagged => "Stays in the list. `sanity findings clear` takes it back.",
        crate::findings::Verdict::FineForNow => {
            "Hidden until this code changes. It comes back when the numbers behind it move."
        }
        crate::findings::Verdict::FineAlways => "Hidden whatever this code does.",
        crate::findings::Verdict::FalsePositive => {
            "Hidden until the RULE changes. The code may do as it likes; this was not true."
        }
    }
}

/// Take decisions back, returning the findings to the list.
///
/// **Every rule under that key by default**, for the reason the panel unflags every rule at
/// once: a subject half-decided is a tile that goes on hiding findings nobody remembers
/// deciding. No scan is needed — this is an edit to the archive, keyed by strings the archive
/// already holds, so it works on a repo whose rules no longer raise the finding at all. That
/// is the case it is most needed in.
fn clear(path: &str, key: &str, rule: Option<&str>) -> i32 {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return 2;
        }
    };
    let before = crate::findings::archive(&path);
    let doomed: Vec<crate::findings::Decision> = before
        .iter()
        .filter(|d| d.key == key && rule.is_none_or(|want| d.rule == want))
        .cloned()
        .collect();
    if doomed.is_empty() {
        eprintln!("sanity: nothing is filed under `{key}`.");
        return 1;
    }
    for d in &doomed {
        if let Err(e) = crate::findings::undecide(&path, key, &d.rule) {
            eprintln!("sanity: could not rewrite the archive: {e}");
            return 1;
        }
    }
    // Read back rather than trusting the writes: this one DELETES, which is the direction
    // that cannot be undone by running it again.
    let after = crate::findings::archive(&path);
    let left = after.iter().filter(|d| d.key == key).count();
    let want = before.iter().filter(|d| d.key == key).count() - doomed.len();
    if left != want {
        eprintln!("sanity: {left} decisions still stand under `{key}`, expected {want}.");
        return 1;
    }
    println!();
    println!("{key}");
    for d in &doomed {
        println!("  {} — back in the list", d.title);
    }
    0
}

/// The worklist itself, once the survey is in hand.
fn list(
    path: &std::path::Path,
    limit: usize,
    groups: &[crate::findings::Group],
    declined: Option<(crate::trace::Depth, f32)>,
) -> i32 {
    // Merged by subject, widest first — the panel's order, from the same numbers. A flag does
    // not move a row: see `findings::live_hits`.
    #[derive(Default)]
    struct Row<'a> {
        flagged: bool,
        loc: u32,
        said: Vec<(&'a crate::findings::Group, &'a crate::findings::Finding)>,
    }
    let mut by_key: std::collections::BTreeMap<&str, Row> = Default::default();
    for g in groups.iter().filter(|g| g.blocked.is_none()) {
        for f in &g.hits {
            let row = by_key.entry(f.key.as_str()).or_default();
            row.flagged |= f.flagged;
            row.loc = f.hit.loc;
            row.said.push((g, f));
        }
    }
    let mut rows: Vec<(&str, Row)> = by_key.into_iter().collect();
    rows.sort_by(|(ak, a), (bk, b)| b.loc.cmp(&a.loc).then_with(|| ak.cmp(bk)));

    let settled: usize = groups.iter().map(|g| g.dismissed).sum();
    println!();
    print!("{}", path.to_string_lossy());
    println!(
        "  {} findings{}",
        commas(rows.len() as u64),
        if settled > 0 { format!(", {} ignored", commas(settled as u64)) } else { String::new() }
    );

    // **What could not be asked, said once and out loud.** A rule whose clause the repo has no
    // evidence for finds nothing, and a reader who is not told why reads that as a clean bill
    // — the one thing this surface must never do.
    //
    // Folded by the FIX, exactly as the window's footer folds it: seven rules each ending in
    // the same six words is one job printed seven times, and how much of the catalog one pass
    // would light up is the number with a decision in it. See `findings::Blocked`.
    //
    // **And the reason rides along, because here there is nowhere else to put it.** The panel
    // hangs `why` on the row's tooltip; a transcript has no tooltip, so a footer printing the
    // fold key alone says `trace required` on a repo whose history HAS been read — the fix
    // being a deeper rung, which is the one thing the line was supposed to name. Deduped and
    // in the order met: two rules waiting on the same rung are one sentence.
    struct Need<'a> {
        need: &'a str,
        n: usize,
        whys: Vec<&'a str>,
    }
    let mut needs: Vec<Need> = Vec::new();
    for g in groups.iter() {
        let Some(b) = &g.blocked else { continue };
        match needs.iter_mut().find(|it| it.need == b.need) {
            Some(it) => {
                it.n += 1;
                if !it.whys.contains(&b.why.as_str()) {
                    it.whys.push(b.why.as_str());
                }
            }
            None => needs.push(Need { need: b.need.as_str(), n: 1, whys: vec![b.why.as_str()] }),
        }
    }
    needs.sort_by(|a, b| b.n.cmp(&a.n).then_with(|| a.need.cmp(b.need)));
    for it in &needs {
        // Wrapped like a finding's own sentence, and hung rather than block-indented: the
        // count is what the eye comes back to, so a second line has to read as the rest of
        // this row and not as the next one.
        let line = format!(
            "{} of {} rules inactive ({}) — {}",
            it.n,
            groups.len(),
            it.need,
            it.whys.join("; ")
        );
        for (i, part) in wrap(&line, 76).iter().enumerate() {
            println!("{}{part}", if i == 0 { "  " } else { "    " });
        }
    }
    // **Which rung the budget stopped at, and the flags that pay for it.** Without this the
    // line above reads as a fact about the repo — "the timeline has not been walked" — when it
    // is a fact about this invocation, which chose not to spend the time.
    if let Some((rung, seconds)) = declined {
        println!(
            "    {} skipped: about {} against a {}s budget — `--edits --blame` reads it anyway",
            rung_name(rung),
            duration(seconds),
            crate::trace::BUDGET.as_secs()
        );
    }
    println!();

    // A rule's background on the first row it raises and not again — the window's rule, and
    // the transcript has the same repetition to avoid. Wrapped as ONE paragraph with the
    // sentence it belongs to rather than as a block under it: the two were written to be read
    // together, and a second indent turns a finding into a finding with a footnote. See
    // `findings::Rule::background`.
    let mut said_once: std::collections::HashSet<&str> = Default::default();
    for (key, row) in rows.iter().take(limit) {
        println!("  {}{}", if row.flagged { "⚑ " } else { "" }, key);
        for (g, f) in &row.said {
            println!("    {}", g.title);
            let mut para = crate::findings::flat(&f.says);
            if !g.background.is_empty() && said_once.insert(g.id.as_str()) {
                para.push(' ');
                para.push_str(&g.background);
            }
            for line in wrap(&para, 76) {
                println!("      {line}");
            }
        }
        println!();
    }
    if rows.len() > limit {
        println!(
            "  … and {} more. `--limit` for a longer list.",
            commas((rows.len() - limit) as u64)
        );
        println!();
    }
    0
}

/// Break a sentence onto lines a terminal can hold, at word boundaries.
fn wrap(text: &str, width: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        if !line.is_empty() && line.chars().count() + 1 + word.chars().count() > width {
            out.push(std::mem::take(&mut line));
        }
        if !line.is_empty() {
            line.push(' ');
        }
        line.push_str(word);
    }
    if !line.is_empty() {
        out.push(line);
    }
    out
}

/// What the assessment says, in aggregate.
///
/// Aggregate and nothing else, deliberately — this prints `/summary`, which refuses a
/// per-file or per-function breakdown because one server answers both readers and
/// orchestrators and "udf.rs averages some" is `.sanity/` with the serial numbers filed
/// off. A human wanting the detail has the window, and has the Markdown.
pub fn summary(path: &str) -> i32 {
    let v = match read_verb(path, "/summary") {
        Ok(v) => v,
        Err(code) => return code,
    };
    let total = v.get("total").cloned().unwrap_or(Value::Null);
    println!();
    project_header(&v);

    let readings = total.get("readings").and_then(|x| x.as_u64()).unwrap_or(0);
    if readings == 0 {
        println!();
        println!("  Nothing has been read yet. `sanity check` starts.");
        println!();
        return 0;
    }

    println!();
    // A table, because three histograms are three rows of the SAME four columns and the
    // whole reason to print them together is to compare them down the column.
    let (d, o) = if fancy() { ("\x1b[2m", "\x1b[0m") } else { ("", "") };
    println!("  {d}{:<12}{:>7}{:>7}{:>7}{:>7}{o}", "", "full", "most", "some", "none");
    for (label, key) in
        [("PREDICTED", "predicted"), ("DOCUMENTED", "documented"), ("LEGIBLE", "legible")]
    {
        println!("  {:<12}{}", label, grades(total.get(key)));
    }

    // **Everything below was already being computed and never printed.** The endpoint has
    // returned traps, cold, derivable, the per-model split and the position curve since it
    // was written — `sanity_summary` exists precisely so the party that ran the readers can
    // read its own result — and the CLI showed two histograms. What it could not say was the
    // one thing this repo's own corpus most needed said: which models took the readings.
    let n = |k: &str| total.get(k).and_then(|x| x.as_u64()).unwrap_or(0);
    println!();
    if n("traps") > 0 {
        println!("  {} identified", plural(n("traps"), "trap"));
    }
    if n("derivable") > 0 {
        // `derivable` is a doc the reader judged it could have written from the code alone,
        // which is the same thing as one that told it nothing.
        println!("  {} unhelpful doc strings found", commas(n("derivable")));
    }
    // `cold` is not printed. It is 99% on every corpus — the queue round-robins across
    // files precisely so a reader is not handed neighbors — so a line that says the same
    // thing about every repo is a line nobody reads twice. It stays in the payload, where
    // the number stops being decoration and becomes checkable if it ever moves.

    // The mixture, named. `banked_model` reports agreement as a single name and disagreement
    // as nothing at all, which is the one case somebody has to act on.
    if let Some(by_model) = v.get("by_model").and_then(|x| x.as_object()) {
        if !by_model.is_empty() {
            println!();
            println!("  {d}Read by{o}");
            let mut rows: Vec<(&String, u64)> = by_model
                .iter()
                .map(|(m, t)| (m, t.get("readings").and_then(|x| x.as_u64()).unwrap_or(0)))
                .collect();
            rows.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(b.0)));
            // The list is the finding. Two names under "Read by" already says the corpus is
            // mixed, and a sentence restating the row count as a conclusion is the table
            // being explained to somebody who has just read it.
            for (model, count) in &rows {
                println!("    {:<28}{:>7}", model, commas(*count));
            }
        }
    }

    // Whether the readings were taken by readers holding the repo's own brief. Only where
    // there was a brief to hold: `not_applicable` is a repo with no instructions file, and
    // "0 exposed" there is not a fact about the run.
    if let Some(p) = v.get("priming") {
        let exposed = p.get("exposed").and_then(|x| x.as_u64()).unwrap_or(0);
        let clean = p.get("clean").and_then(|x| x.as_u64()).unwrap_or(0);
        if exposed + clean > 0 {
            println!();
            // Priming is about this repo's BRIEF — a CLAUDE.md or AGENTS.md in the reader's
            // context — and not about access to the source. Source arrives only from
            // `sanity_reveal`, bounded, after the prediction is stamped; that isolation is a
            // property of how a reader is launched rather than something a corpus reports.
            // The two get confused because both are contamination, so the line names neither
            // and leaves the definition where it is documented.
            println!("  Priming: {} readings primed, {} unprimed", commas(exposed), commas(clean));
        }
    }

    // The curve `by_position` exists for: does a reader get better as it works? Printed as
    // the share of its readings at the top rung, per position, because a slope there is the
    // warming that would make the batch size wrong — and flat is the finding so far.
    if let Some(pos) =
        v.get("by_position").and_then(|x| x.get("positions")).and_then(|x| x.as_object())
    {
        if pos.len() > 1 {
            println!();
            println!("  {d}Full predictions by position in a reader's batch{o}");
            // Sorted as NUMBERS. JSON object keys are strings, so iterating them put
            // position 10 between 1 and 2 — a curve read left to right in the wrong order,
            // which is worse than not drawing it.
            let mut cols: Vec<(u32, &Value)> =
                pos.iter().filter_map(|(k, v)| k.parse::<u32>().ok().map(|n| (n, v))).collect();
            cols.sort_by_key(|(n, _)| *n);
            print!("   ");
            for (k, _) in &cols {
                print!("{:>5}", k);
            }
            println!();
            print!("   ");
            for (_, counts) in &cols {
                let full = counts.get("full").and_then(|x| x.as_u64()).unwrap_or(0);
                let all: u64 = ["full", "most", "some", "none"]
                    .iter()
                    .map(|g| counts.get(*g).and_then(|x| x.as_u64()).unwrap_or(0))
                    .sum();
                print!("{:>4}%", (full * 100).checked_div(all).unwrap_or(0));
            }
            println!();
        }
    }
    println!();
    0
}

/// Rewrite a repo's `.sanity/` in the CURRENT format, in place.
///
/// **This is the migration mechanism, and there will never be a migrator.** `.sanity/` is
/// Markdown that is parsed back, so a format change is not a data change: `parse_shard`
/// reads a heading as everything before the em-dash and recomputes what follows it on write,
/// so every reading survives a round trip through a renderer that has moved on. Rewriting is
/// therefore reading and writing, not translating — and a translator is precisely the thing
/// that once destroyed a project's readings by matching legacy entries on node ids that had
/// moved. **When the format changes, run this. Do not write a migration.**
///
/// The one durable rule it depends on: whatever changes, the shard must still parse under
/// the OLD reader long enough to be re-rendered by the new one. Adding a bullet or moving
/// decoration after the em-dash is free. Changing what a key is made of is not, and would be
/// the same class of change as the migration that failed — see `key_of`.
///
/// **In-process, not through the backend, and that is the whole reason it exists.** Every
/// other write verb would go through `/open`, which refreshes as a matter of course. But the
/// backend that answers may be an app somebody started this morning, from a binary that
/// renders the format you are trying to leave — and `serve` is idempotent, so a newer binary
/// politely declines to replace it. A verb whose entire job is "apply THIS build's format"
/// cannot be a formatter over a daemon of unknown vintage.
///
/// Nothing is created: `assessment::refresh` writes only files that are already there, so a
/// repo with no assessment comes back untouched and says so.
pub fn refresh(path: &str) -> i32 {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return 2;
        }
    };
    if !crate::assessment::dir(&path).is_dir() {
        println!();
        println!("{} has no .sanity/ — nothing to rewrite.", path.to_string_lossy());
        println!();
        return 0;
    }
    let scans = crate::scancache::ScanCache::open(&path);
    let scan = match crate::scan::scan(
        &path,
        &crate::surprise::HeuristicModel,
        &|_| {},
        &|_, _: &crate::surprise::Reading| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
        // Ordering, matching an open. The proxy scores decide nothing that is written here —
        // a shard holds readings, and a reading is an agent's — so paying for the all-pairs
        // term would buy a number this verb does not print.
        crate::scan::Fidelity::Ordering,
        // Untraced, on the same argument. A shard is keyed by `key_of` and hashed against the
        // doc and the body; no line of it comes from git. This verb rewrote the format and
        // waited out a full blame pass to do it.
        crate::trace::Depth::Untraced,
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("sanity: could not scan {}: {e}", path.to_string_lossy());
            return 1;
        }
    };
    let reports = crate::assessment::load(&path, &scan);
    println!();
    match crate::assessment::refresh(&path, &scan, &reports) {
        // Reported, never absorbed — the same rule `save_reports` follows. A rewrite that
        // failed halfway leaves an index and its shards disagreeing, which is the one state
        // this whole file is written to prevent.
        crate::assessment::Index::Failed(e) => {
            eprintln!("sanity: {e}");
            println!();
            1
        }
        crate::assessment::Index::Absent => {
            println!("{} has no index — nothing to rewrite.", path.to_string_lossy());
            println!();
            0
        }
        crate::assessment::Index::Current => {
            println!("{} — already current, nothing written.", path.to_string_lossy());
            println!("  {} readings", commas(reports.len() as u64));
            println!();
            0
        }
        crate::assessment::Index::Refreshed => {
            println!("{} — rewritten.", path.to_string_lossy());
            println!("  {} readings, all of them re-rendered", commas(reports.len() as u64));
            println!();
            println!("Read the diff before committing it. A format change should move headings");
            println!("and prose; a change in the BULLETS is a reading that did not survive.");
            println!();
            0
        }
    }
}

/// One row of a grade table: four counts, in scale order, aligned under their headings.
///
/// **The names moved to a header row, and that is a reversal with a reason.** They were on
/// every row — `full 228   most 400` — precisely so four bare numbers would not be something
/// you have to go and look up, and the scale's direction is the reading. That argument holds
/// for ONE histogram. Printed three at a time it stops holding: the labels are identical on
/// every row, and repeating them puts each number wherever the previous number's width
/// happens to end, so the columns you actually want to compare do not line up. A header row
/// keeps the names on screen and lets the counts sit in fixed columns.
fn grades(v: Option<&Value>) -> String {
    let Some(v) = v else {
        return format!("{:>7}", "—");
    };
    ["full", "most", "some", "none"]
        .iter()
        .map(|k| format!("{:>7}", commas(v.get(*k).and_then(|x| x.as_u64()).unwrap_or(0))))
        .collect::<Vec<_>>()
        .join("")
}

/// Everything the report reads, for one repo, as one JSON document.
///
/// **For the offline renderer**, which draws the PDF as a Node script with no window. Every
/// field is what the window is handed for the same repo, through the same function: the tree as
/// `project_scan` serializes it (but whole — functions included, since no second fetch is
/// coming), the readings as `agent_reports` stamps them, the groups as `project_report`
/// assembles them, and the row's counts as `ProjectList` computes them.
#[derive(serde::Serialize)]
struct Export {
    version: u32,
    name: String,
    path: String,
    remote: Option<String>,
    head: Option<crate::commands::RepoHead>,
    #[serde(rename = "traceDepth")]
    trace_depth: crate::trace::Depth,
    grammars: usize,
    scan: crate::scan::Scan,
    reports: Vec<crate::agentapi::Report>,
    groups: Vec<crate::findings::Group>,
    summary: crate::agentapi::ReportSummary,
    /// Where the offline renderer keeps its figures for this repo — a directory, beside the
    /// other machine-local caches. `None` where there is no data dir to put it in.
    #[serde(rename = "renderCache")]
    render_cache: Option<String>,
}

/// The render cache's format version, in the slot's NAME — see `reports::cache_slot`. Bump it
/// when the renderer's figures change shape, and the old slot ages out through `prune_slots`.
const RENDER_TAG: &str = "r1";

/// Build the export the way the app builds a project: scan untraced, deepen in memory.
///
/// **Untraced first, then `trace::deepen`, because that is what hits the tree cache.** The app
/// never scans at a depth — a traced signature mixes HEAD — so a scan asked for `Files` here
/// would miss the cached map every time and pay the parse on a repo the window opens in a
/// fraction of a second. Readings load AFTER the trace, as `restore` loads them, and the
/// reader's test classifications land through `links::retest_tree` before any finding is
/// asked, as `survey` does.
///
/// `depth: None` is what the app last banked for this repo, else `Files` — the depth an open
/// deepens to. A banked `untraced` is honoured: it is what the window is drawing.
fn export_of(
    path: &std::path::Path,
    depth: Option<crate::trace::Depth>,
    lap: &dyn Fn(&str),
) -> Result<Export, String> {
    let scans = crate::scancache::ScanCache::open(path);
    let mut scan = crate::scan::scan(
        path,
        &crate::surprise::HeuristicModel,
        &|_| {},
        &|_, _: &crate::surprise::Reading| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
        crate::scan::Fidelity::Ordering,
        crate::trace::Depth::Untraced,
    )
    .map_err(|e| format!("could not scan {}: {e}", path.to_string_lossy()))?;
    lap("scan");

    let want = depth.unwrap_or_else(|| {
        crate::reports::banked_depth(path)
            .map(|tag| crate::trace::Depth::from_tag(&tag))
            .unwrap_or(crate::trace::Depth::Files)
    });
    let (reached, _, _) = crate::trace::deepen(
        path,
        &mut scan,
        want,
        &scans,
        &std::sync::atomic::AtomicBool::new(false),
        &|_| {},
        &|_| {},
    );
    lap(reached.tag_str());

    let reports = crate::assessment::load(path, &scan);
    crate::links::retest_tree(&mut scan, &reports);
    let stamped = crate::commands::stamp_reports(&scan.root, &reports);
    lap("readings");

    let traced = crate::findings::Traced::of(&scan.stats, reached);
    let groups = crate::findings::project_report(path, &scan.root, &reports, traced).groups;
    lap("findings");

    let summary = crate::agentapi::report_summary(&scan, &reports, reached);
    let where_ = path.to_string_lossy().to_string();
    // The name the sidebar shows: the index's, where the app has met this repo, and otherwise
    // the directory's — which is what an open names a project it has never seen.
    let key = crate::agentapi::project_key(path);
    let name = crate::reports::load_index()
        .projects
        .into_iter()
        .find(|p| p.key == key)
        .map(|p| p.name)
        .unwrap_or_else(|| {
            path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| key.clone())
        });
    // A directory, made here so the renderer never has to guess the layout of the data dir.
    // The writer of a slot is the one that sweeps its siblings, as every other kind does.
    let render_cache = crate::reports::cache_slot("renders", path, RENDER_TAG)
        .filter(|dir| std::fs::create_dir_all(dir).is_ok())
        .map(|dir| {
            crate::reports::prune_slots("renders", path, RENDER_TAG);
            dir.to_string_lossy().to_string()
        });
    let export = Export {
        render_cache,
        version: 1,
        name,
        remote: crate::commands::repo_remote(where_.clone()),
        head: crate::commands::repo_head(where_.clone()),
        path: where_,
        trace_depth: reached,
        grammars: crate::commands::languages().len(),
        scan,
        reports: stamped,
        groups,
        summary,
    };
    lap("git");
    Ok(export)
}

/// `sanity export-data` — see [`export_of`]. JSON to `out` or stdout; timing to stderr.
fn export_data(path: &str, depth: Option<crate::trace::Depth>, out: Option<&str>) -> i32 {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return 2;
        }
    };
    let started = Instant::now();
    let last = std::cell::Cell::new(started);
    let lap = |what: &str| {
        let now = Instant::now();
        eprintln!("export-data: {what:<9} {:>8.2?}", now - last.get());
        last.set(now);
    };
    let export = match export_of(&path, depth, &lap) {
        Ok(x) => x,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    let written = match out {
        Some(file) => std::fs::File::create(file).map_err(|e| format!("{file}: {e}")).and_then(|f| {
            let mut w = std::io::BufWriter::new(f);
            serde_json::to_writer(&mut w, &export).map_err(|e| e.to_string())?;
            std::io::Write::flush(&mut w).map_err(|e| e.to_string())
        }),
        None => {
            let mut w = std::io::BufWriter::new(std::io::stdout().lock());
            serde_json::to_writer(&mut w, &export)
                .map_err(|e| e.to_string())
                .and_then(|_| std::io::Write::flush(&mut w).map_err(|e| e.to_string()))
        }
    };
    if let Err(e) = written {
        eprintln!("sanity: could not write the export: {e}");
        return 1;
    }
    lap("write");
    let size = out.and_then(|f| std::fs::metadata(f).ok()).map(|m| m.len());
    eprintln!(
        "export-data: {} at depth {}, {} readings, {} groups{} in {:.2?}",
        export.name,
        export.trace_depth.tag_str(),
        export.reports.len(),
        export.groups.len(),
        size.map(|b| format!(", {} bytes", commas(b))).unwrap_or_default(),
        started.elapsed(),
    );
    0
}

// The command line, as clap sees it.
//
// **A plain comment, not a doc comment.** The derive turns `///` on this struct into the
// long help, so an explanation written for whoever maintains it printed itself above the
// command list every time somebody typed `--help`. That is the whole hazard of documenting
// a type whose fields are user-facing copy: the two audiences share a syntax.
//
// **Hand-rolled before, and the reason to stop was the help rather than the parsing.** The
// old parser was thirty lines and worked: a positional path defaulting to `.`, `--flag
// value` and `--flag=value` both, `repo_arg` skipping flag VALUES so `--harness claude` did
// not resolve `./claude`. What it could not do was look like a tool anybody else ships —
// one flat block of hand-aligned text, no per-verb help, no color, and an unknown flag
// silently ignored rather than named.
//
// clap is what the CLIs this wants to resemble are built on, `uv` and `rg` among them. It
// brings `sanity check --help`, alignment that survives editing, colored headings, "did
// you mean" on a typo, and errors for the arguments the old parser dropped on the floor.
#[derive(clap::Parser)]
#[command(
    name = "sanity",
    version,
    about = "Measure code for readability and understandability",
    // The two machine-invoked verbs are hidden from the list and described here instead —
    // they are things that happen TO you, and a reader scanning for what to type should not
    // have to filter them out first.
    after_help = "\x1b[1m\x1b[4mInternals\x1b[0m\n  \
        \x1b[1msanity serve\x1b[0m  Start the backend (one per machine, ephemeral, idempotent,\n                \
        not user-initiated)\n  \
        \x1b[1msanity mcp\x1b[0m    Start the stdio MCP server, launched by an agent's own config\n\n\
        Run `sanity` with no arguments to open the window.",
    disable_help_subcommand = true,
)]
pub struct Cli {
    #[command(subcommand)]
    command: Verb,
}

// Every verb takes a path, and every one of them defaults it to the working directory:
// these are things you run while standing in the repo you mean.
/// The three buttons in the panel, and the one that takes them back.
///
/// Named for what they DO rather than for what they are stored as: `fine-for-now` is a
/// verdict in the archive and a poor imperative, and somebody typing a command is telling the
/// tool to do something. The words the archive keeps are `Verdict::word`'s, unchanged.
#[derive(clap::Subcommand)]
enum Decide {
    /// Fine as it stands — hide it until this code changes
    Snooze(Decided),
    /// Always fine — hide it whatever this code does
    Allow(Decided),
    /// Not true — the finding is wrong, not unwanted. Hidden until the rule changes
    Wrong(Decided),
    /// Needs doing. It stays in the list
    Flag(Decided),
    /// Take a decision back, returning the finding to the list
    Clear {
        /// The finding, as `sanity findings` prints it — `path/to/file.rs#name`.
        key: String,
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// Just this rule's decision. Every one filed under the key, by default.
        #[arg(long, value_name = "ID")]
        rule: Option<String>,
    },
}

/// What all three verdicts need. One struct, so they cannot drift into taking different flags.
#[derive(clap::Args)]
struct Decided {
    /// The finding, as `sanity findings` prints it — `path/to/file.rs#name`.
    key: String,
    /// The repo. Defaults to where you are standing.
    #[arg(default_value = ".")]
    path: String,
    /// Just this rule. Every rule that raises the finding, by default.
    #[arg(long, value_name = "ID")]
    rule: Option<String>,
    /// Why. Asked for and not required, as in the panel.
    #[arg(long, value_name = "TEXT", default_value = "")]
    reason: String,
    /// Read the timeline, so the churn rules can be decided under too.
    #[arg(long)]
    edits: bool,
    /// Per-line blame, so the age and authorship rules can be decided under too.
    #[arg(long)]
    blame: bool,
}

#[derive(clap::Subcommand)]
enum Verb {
    /// Configure agent and model for this repo
    Init {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// Which coding agent runs the readers.
        #[arg(long, value_name = "NAME")]
        harness: Option<String>,
        /// Which model reads. It is the scale — a smaller one is surprised by more.
        #[arg(long, value_name = "ID")]
        model: Option<String>,
        /// Point the window at this repo.
        #[arg(long)]
        show: bool,
    },
    /// Perform a reading pass
    Check {
        /// The repo to read. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// Which model reads. It is the scale — a smaller one is surprised by more.
        #[arg(long, value_name = "ID")]
        model: Option<String>,
        /// How many readers at once.
        #[arg(long, value_name = "N")]
        readers: Option<usize>,
        /// Stop once this many readings have landed. A reader does ten, so ten is the step.
        #[arg(long, value_name = "N")]
        limit: Option<usize>,
        /// Start it and return, rather than watching.
        #[arg(long)]
        detach: bool,
    },
    /// Read this repo's git history onto the map
    Trace {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// The timeline, however long it takes. Without a flag, every rung that fits the ten-second
        /// budget is read, priced on what is not already cached.
        #[arg(long)]
        edits: bool,
        /// Per-line blame, however long it takes. One `git blame` per file — minutes on a large
        /// repo, hours on a huge one.
        #[arg(long)]
        blame: bool,
    },
    /// View backend status and reading completion
    Status {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// Summarize reader findings
    Summary {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// What is worth looking at, and why
    Findings {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// How many to print. The list is ranked, so this is the top of it.
        #[arg(long, value_name = "N", default_value_t = 20)]
        limit: usize,
        /// Read the timeline as well, so the churn rules can answer. Minutes on a large repo.
        #[arg(long)]
        edits: bool,
        /// Per-line blame, so age resolves to the function rather than the file. Hours on a
        /// huge repo — see `docs/notes/budgets.md`, where it is 206s of a 214s cold ceph scan.
        #[arg(long)]
        blame: bool,
        /// Decide one, instead of listing them.
        #[command(subcommand)]
        decide: Option<Decide>,
    },
    /// Rewrite .sanity/ in the current format
    Refresh {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// Write everything the report reads, for one repo, as JSON
    ExportData {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// How much history to read. Defaults to what the app last used here, else `files`.
        #[arg(long, value_parser = ["untraced", "files", "lines", "edits"])]
        depth: Option<String>,
        /// Where to write it. Standard output by default.
        #[arg(long, value_name = "FILE")]
        out: Option<String>,
    },
    /// Who calls one function, by name
    Callers {
        /// The function, as `sanity findings` prints it — `path/to/file.rs#name`.
        key: String,
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// The backend, with no window. Idempotent.
    #[command(hide = true)]
    Serve,
    /// The stdio MCP server, for an agent to launch.
    #[command(hide = true)]
    Mcp,
}

pub fn main(args: &[String]) -> i32 {
    use clap::Parser;
    // The binary's own name back in front, because clap reports usage with argv[0] and
    // `main.rs` hands over the arguments with it already stripped.
    let cli = match Cli::try_parse_from(
        std::iter::once("sanity".to_string()).chain(args.iter().cloned()),
    ) {
        Ok(cli) => cli,
        Err(e) => {
            // clap decides the stream and the code: `--help` and `--version` are a success
            // printed to stdout, a bad argument is an error on stderr. Printing both the
            // same way is how `sanity --help | less` ends up empty.
            let _ = e.print();
            return if e.use_stderr() { 2 } else { 0 };
        }
    };
    match cli.command {
        Verb::Serve => serve(),
        // Reached only if something calls `cli::main` with it — `main.rs` intercepts `mcp`
        // before this, because the MCP server must not pay for argument parsing or for
        // anything else this module does on the way in.
        Verb::Mcp => {
            crate::mcp::run();
            0
        }
        Verb::Init { path, harness, model, show } => {
            init(&path, harness.as_deref(), model.as_deref(), show)
        }
        Verb::Trace { path, edits, blame } => trace(&path, Want::of(edits, blame)),
        Verb::Check { path, model, readers, limit, detach } => {
            check(&path, model.as_deref(), readers, limit, detach)
        }
        Verb::Status { path } => status(&path),
        Verb::Summary { path } => summary(&path),
        Verb::Findings { path, limit, edits, blame, decide: None } => {
            findings(&path, limit, edits, blame)
        }
        Verb::Findings { decide: Some(what), .. } => {
            use crate::findings::Verdict;
            let verdict = match &what {
                Decide::Snooze(_) => Verdict::FineForNow,
                Decide::Allow(_) => Verdict::FineAlways,
                Decide::Wrong(_) => Verdict::FalsePositive,
                Decide::Flag(_) => Verdict::Flagged,
                Decide::Clear { key, path, rule } => {
                    return clear(path, key, rule.as_deref());
                }
            };
            let (Decide::Snooze(d) | Decide::Allow(d) | Decide::Flag(d) | Decide::Wrong(d)) = &what
            else {
                unreachable!("clear returned above")
            };
            decide(&d.path, &d.key, d.rule.as_deref(), verdict, &d.reason, d.edits, d.blame)
        }
        Verb::Callers { key, path } => callers(&path, &key),
        Verb::Refresh { path } => refresh(&path),
        Verb::ExportData { path, depth, out } => {
            export_data(&path, depth.as_deref().map(crate::trace::Depth::from_tag), out.as_deref())
        }
    }
}

#[cfg(test)]
mod tests {

    /// The pieces of the progress line, which is watched for minutes and has to be right.
    #[test]
    fn the_progress_line_reads_correctly_at_both_ends() {
        assert_eq!(bar(0.0).chars().filter(|c| *c == '█').count(), 0);
        assert_eq!(bar(1.0).chars().filter(|c| *c == '░').count(), 0);
        // Always the same width, whatever the fraction — a bar that grows the line it is on
        // makes the counts beside it jump about while somebody is reading them.
        for f in [0.0, 0.01, 0.5, 0.999, 1.0] {
            assert_eq!(bar(f).chars().count(), BAR);
        }
        // Out of range rather than panicking: `done` comes from one poll and `target` from
        // another, so a reading landing between them can put this over 1.
        assert_eq!(bar(1.4).chars().count(), BAR);

        assert_eq!(plural(1, "reader"), "1 reader");
        assert_eq!(plural(0, "reader"), "0 readers");
        assert_eq!(plural(5, "reader"), "5 readers");
    }
    use super::*;
    use crate::agentapi::tests::data_home;

    /// **The export is what the window is handed, whole.** The offline renderer has no second
    /// fetch, so a file arriving without its functions draws a map with no inner ring; a
    /// reading arriving unstamped carries `loc: 0`, which the window reads as "this function is
    /// gone" and drops. Both are silent — the PDF still looks like a PDF.
    #[test]
    fn an_export_carries_whole_files_and_stamped_readings() {
        let _home = data_home();
        let dir = tempfile::tempdir().expect("tmp");
        let repo = std::fs::canonicalize(dir.path()).expect("canonical");
        let git = |args: &[&str]| {
            let out = std::process::Command::new("git")
                .arg("-C")
                .arg(&repo)
                .args(["-c", "user.email=t@example.com", "-c", "user.name=t"])
                .args(args)
                .output()
                .expect("git runs");
            assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
        };
        let gate = repo.join("gate.rs");
        let body = |shut: &str| {
            format!(
                "fn open() {{\n    println!(\"1\");\n    println!(\"one\");\n}}\n\n\
                 fn shut() {{\n    {shut}\n}}\n"
            )
        };
        git(&["init", "-q"]);
        std::fs::write(&gate, body("println!(\"2\");")).expect("writes");
        git(&["add", "."]);
        git(&["commit", "-q", "-m", "first"]);

        // Both functions read against the bodies they have now.
        let scan = crate::scan::scan(
            &repo,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos {
                scores: &crate::cache::Cache::ephemeral(),
                scans: &crate::scancache::ScanCache::ephemeral(),
            },
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        )
        .expect("scans");
        let mut readings = std::collections::HashMap::new();
        scan.root.visit(&mut |n| {
            if n.kind == crate::model::NodeKind::Func {
                readings.insert(
                    n.id.clone(),
                    crate::agentapi::Report {
                        id: n.id.clone(),
                        expected: "a thing".into(),
                        found: "another thing".into(),
                        predicted: Some(crate::agentapi::Grade::Some),
                        documented: Some(crate::agentapi::Grade::Full),
                        legible: Some(crate::agentapi::Grade::Most),
                        note: "a note".into(),
                        body: n.body.clone().unwrap_or_default(),
                        model: "sonnet".into(),
                        ..crate::agentapi::Report::blank()
                    },
                );
            }
        });
        assert_eq!(readings.len(), 2);
        crate::assessment::save(&repo, &scan, &readings).expect("saves");

        // `shut` moves under its reading; `open` does not.
        std::fs::write(&gate, body("println!(\"two\");")).expect("writes");

        let export =
            export_of(&repo, Some(crate::trace::Depth::Files), &|_| {}).expect("exports");
        let bytes = serde_json::to_vec(&export).expect("serializes");
        let v: Value = serde_json::from_slice(&bytes).expect("parses back");

        assert_eq!(v["version"], 1);
        assert_eq!(v["traceDepth"], "files");
        assert_eq!(v["path"], repo.to_string_lossy().as_ref());

        let reports = v["reports"].as_array().expect("reports");
        assert_eq!(reports.len(), 2, "{reports:?}");
        for r in reports {
            assert!(r["loc"].as_u64().unwrap_or(0) > 0, "stamped with its size: {r}");
            let shut = r["id"].as_str().unwrap_or_default().contains("#shut");
            assert_eq!(r["stale"], shut, "only the moved body is stale: {r}");
        }

        // The file carries its functions, which the window's `project_scan` does not send.
        let files = v["scan"]["root"]["children"].as_array().expect("root children");
        let file = files.iter().find(|f| f["name"] == "gate.rs").expect("gate.rs on the map");
        let funcs = file["children"].as_array().expect("functions under the file");
        assert_eq!(funcs.len(), 2);
        assert!(funcs.iter().all(|f| f["kind"] == "func"), "{funcs:?}");
        assert!(v["scan"]["stats"].get("tangle_bands").is_some(), "stats as the window reads them");

        assert_eq!(v["summary"]["functions"], 2);
        assert_eq!(v["summary"]["assessed"], 1);
        assert_eq!(v["summary"]["stale"], 1);
        assert_eq!(v["summary"]["banked_model"], "sonnet");
        assert_eq!(v["summary"]["trace_depth"], "files");
        assert!(v["groups"].is_array());
        assert!(v["grammars"].as_u64().unwrap_or(0) > 0);
        let renders = v["renderCache"].as_str().expect("a render cache under the data dir");
        assert!(std::path::Path::new(renders).is_dir(), "made as a directory: {renders}");
        assert!(renders.contains("/renders/") && renders.ends_with("-r1"), "{renders}");
    }

    /// **Factoring the stamping out changed nothing it stamps.** `agent_reports` now delegates
    /// to `stamp_reports`, so the four stamped fields are pinned here against a tree: an orphan
    /// reads `loc: 0` and not stale, a moved body reads stale, and the dating follows the spec.
    #[test]
    fn stamping_marks_size_expiry_and_dating() {
        use crate::agentapi::Report;
        use crate::model::{Node, NodeKind};
        let func = |id: &str, body: &str, loc: u32| Node {
            id: id.into(),
            kind: NodeKind::Func,
            body: Some(body.into()),
            loc,
            ..Node::dir("x", "x")
        };
        let mut root = Node::dir("", "");
        root.children = vec![func("a.rs#live@1", "h1", 7), func("a.rs#moved@9", "h2", 3)];
        let mut reports = std::collections::HashMap::new();
        for (id, body, spec, trap) in [
            ("a.rs#live@1", "h1", crate::assessment::SPEC, true),
            ("a.rs#moved@9", "old", 0, true),
            ("a.rs#gone@20", "h9", 0, false),
        ] {
            reports.insert(
                id.to_string(),
                Report { id: id.into(), body: body.into(), spec, trap, ..Report::blank() },
            );
        }
        let by: std::collections::HashMap<String, Report> =
            crate::commands::stamp_reports(&root, &reports)
                .into_iter()
                .map(|r| (r.id.clone(), r))
                .collect();
        let live = &by["a.rs#live@1"];
        assert_eq!((live.loc, live.stale, live.legible_dated, live.trap_dated), (7, false, false, false));
        let moved = &by["a.rs#moved@9"];
        assert_eq!((moved.loc, moved.stale, moved.legible_dated, moved.trap_dated), (3, true, true, true));
        let gone = &by["a.rs#gone@20"];
        assert_eq!((gone.loc, gone.stale, gone.legible_dated, gone.trap_dated), (0, false, true, false));
    }

    /// **`clear` takes back every rule under a key, and proves it off the disk.**
    ///
    /// The panel unflags every rule behind a tile at once, because taking back only the first
    /// leaves the others hiding a finding nobody remembers deciding. This is the same rule on
    /// the command line, and it is the DELETING verb — the direction that running it again
    /// cannot undo — so it reads the archive back rather than trusting three `Ok`s.
    ///
    /// No scan: the archive is keyed on strings it already holds, which is what lets a
    /// decision be taken back on a repo whose rules no longer raise the finding at all.
    #[test]
    fn clearing_a_finding_takes_back_every_rule_under_it() {
        use crate::findings::{Decision, Verdict, archive, decide as file};
        let dir = tempfile::tempdir().expect("tmp");
        let repo = dir.path();
        let filed = |key: &str, rule: &str| Decision {
            key: key.into(),
            rule: rule.into(),
            title: rule.into(),
            verdict: Verdict::FineForNow,
            pin: "pin".into(),
            reason: String::new(),
            when: "2026-01-01T00:00:00Z".into(),
            by: "somebody".into(),
        };
        for r in ["giant-function", "tangled-for-size", "crowded-file"] {
            file(repo, filed("a.rs#run", r)).expect("writes");
        }
        // A second subject, which must survive every one of these.
        file(repo, filed("b.rs#other", "giant-function")).expect("writes");

        let path = repo.to_string_lossy().to_string();
        assert_eq!(clear(&path, "a.rs#run", Some("tangled-for-size")), 0, "one rule");
        let left = archive(repo);
        assert_eq!(left.iter().filter(|d| d.key == "a.rs#run").count(), 2, "the named one only");

        assert_eq!(clear(&path, "a.rs#run", None), 0, "the rest of them");
        let left = archive(repo);
        assert_eq!(left.iter().filter(|d| d.key == "a.rs#run").count(), 0);
        assert_eq!(left.len(), 1, "the other subject is untouched");

        // Nothing filed is a refusal rather than a silent success: somebody who mistypes a key
        // must not be told the decision they meant to take back is gone.
        assert_eq!(clear(&path, "a.rs#run", None), 1, "there is nothing left to clear");
    }

    /// A flag's value is never mistaken for the repo path.
    ///
    /// `sanity init --harness claude` is the case: one bare word, and it names an agent.
    /// Read as a positional it resolves `./claude` and the user is told their repo does not
    /// exist, which sends them looking at the wrong thing entirely.
    ///
    /// clap gets this right structurally, where the hand-rolled parser got it right by
    /// carrying a list of which flags take values — a list that had to be updated every
    /// time a flag was added, and silently mis-parsed when it was not. The test outlived
    /// the parser because the BUG is what it is about, not the implementation: these are
    /// the exact command lines somebody types.
    #[test]
    fn a_flags_value_is_not_the_repo() {
        use clap::Parser;
        let path_of = |args: &[&str]| -> String {
            let cli = Cli::try_parse_from(std::iter::once("sanity").chain(args.iter().copied()))
                .expect("should parse");
            match cli.command {
                Verb::Init { path, .. }
                | Verb::Check { path, .. }
                | Verb::Status { path }
                | Verb::Summary { path }
                | Verb::Refresh { path } => path,
                _ => unreachable!("no path on this verb"),
            }
        };
        assert_eq!(path_of(&["init", "--harness", "claude"]), ".");
        assert_eq!(path_of(&["init", "--harness=claude"]), ".");
        assert_eq!(path_of(&["check", "--model", "sonnet", "--readers", "8"]), ".");
        // A real path still wins, before or after the flags.
        assert_eq!(path_of(&["init", "--harness", "claude", "/repo"]), "/repo");
        assert_eq!(path_of(&["init", "/repo", "--harness", "claude"]), "/repo");
        // A valueless flag does not swallow what follows it.
        assert_eq!(path_of(&["init", "--show", "/repo"]), "/repo");

        // And the half the old parser could not do at all: an argument it has never heard
        // of is an error rather than something quietly dropped.
        assert!(Cli::try_parse_from(["sanity", "check", "--wat"]).is_err());
    }

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
