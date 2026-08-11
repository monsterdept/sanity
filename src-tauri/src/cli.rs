//! The headless half — `sanity serve`, `sanity study`, and the read-only verbs.
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
//!   That was already true — it is what `active_project()` was deleted for — so `study`
//!   in a second repo is just another client, not a second server.
//! - **The daemon holds nothing precious.** The scan is recomputed, the readings are in
//!   `.sanity/`, and a lost lease re-queues by design. So it can be killed at any moment,
//!   which is why the lifecycle here is allowed to be blunt: idle out, or stand down when
//!   superseded. There is no `sanity stop`, because nothing needs stopping cleanly.
//! - **There is still no model path in the app.** `sanity study` prints the sentence and
//!   gets out of the way. Spawning a reader would mean owning model choice, auth,
//!   concurrency and resumption — the configuration `OllamaModel` was deleted to avoid —
//!   and it would make the tool assert the reading conditions that `position` and
//!   `by_position` exist to keep measuring.

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

/// How long `study` waits for a backend it just started.
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
/// Sized for the gap this actually has to survive: `study` prints a sentence, and a human
/// then has to read it, switch to an agent and paste it. Half an hour is generous for
/// that and short enough that a forgotten daemon does not outlive the afternoon. Once a
/// wave is running, `status` polling alone keeps it alive.
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
    let client = reqwest::blocking::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .build()
        .ok()?;
    let body: Value = client.get(format!("{}/health", ep.url())).send().ok()?.json().ok()?;
    u32::try_from(body.get("pid")?.as_u64()?).ok()
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
        return await_backend(deadline)
            .ok_or_else(|| "another process is starting the backend and it did not come up in 15s".to_string());
    };
    // Under the lock, ask again. The holder we queued behind may have finished between our
    // probe and our claim, and starting a second server on top of a working one is the
    // exact outcome the lock exists to prevent.
    if let Some(ep) = live() {
        return Ok(ep);
    }

    let exe = std::env::current_exe().map_err(|e| format!("cannot find my own binary: {e}"))?;
    std::process::Command::new(exe)
        .arg("serve")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start the backend: {e}"))?;

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
    let state: agentapi::Shared = Default::default();
    // Same as the window's startup: bring back what was open, on its own thread, so the
    // server answers before the slowest repo has finished rescanning.
    agentapi::restore(state.clone());
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
    println!(
        "Sanity backend on port {port} (pid {me}). Idles out after {} minutes.",
        IDLE_FOR.as_secs() / 60
    );

    let started = Instant::now();
    loop {
        std::thread::sleep(WATCH_EVERY);

        // Superseded. The window claims the endpoint file when it starts, and a human who
        // has opened the app beats a background process every time — so the daemon retires
        // rather than leaving two servers up with only one of them addressable. Losing
        // whatever it held is safe, which is the property that lets this be a one-line
        // rule instead of a handover.
        match agentapi::read_endpoint() {
            Some(ep) if ep.pid != me => {
                println!("Sanity app took over on port {}. Standing down.", ep.port);
                return 0;
            }
            // The file was removed out from under us. Nothing can reach this process any
            // more, so it is a daemon nobody can address: same outcome.
            None => {
                println!("Endpoint file is gone; nothing can reach me. Standing down.");
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
pub fn study(path: &str, show: bool) -> i32 {
    let repo = match resolve(path) {
        Ok(p) => p,
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

    let opened = match post(
        &ep,
        "/open",
        json!({ "path": repo.to_string_lossy(), "focus": show }),
    ) {
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

    // The counts come from `/status`, not from the open response, because `assessed` there
    // is `reports.len()` raw and this has to agree with the sidebar — stale readings are
    // expired work, not finished work, and a CLI that counted them would be the `/status`
    // bug over again in a second place.
    let key = agentapi::project_key(&repo);
    let st = get(&ep, &format!("/status?project={}", urlencode(&key))).unwrap_or(Value::Null);

    let name = text(&opened, "name");
    let functions = num(&opened, "functions");
    let excluded = num(&opened, "excluded");
    let assessed = num(&st, "assessed");
    let remaining = num(&st, "remaining");
    let stale = num(&st, "stale");

    println!();
    println!("{name} — {}", repo.display());
    print!("  {} functions", commas(functions));
    // Never on its own. An exclusion that vanishes from the totals is how a map claims
    // completeness over a subset somebody narrowed months ago.
    if excluded > 0 {
        print!(", {} excluded by .sanityignore", commas(excluded));
    }
    println!();
    print!("  {} read, {} to go", commas(assessed), commas(remaining));
    if stale > 0 {
        print!(" ({} of them stale — the code moved under them)", commas(stale));
    }
    println!();
    // Never "the window is showing this". Headless is the case this verb exists for and
    // there is no window there to speak for — `showing` means the view slot now names
    // this repo, which is a claim about Sanity and true whether or not anything is drawing
    // it. Saying "window" would have the CLI describe a pane that does not exist.
    println!(
        "  backend on port {}{}",
        ep.port,
        if opened.get("showing").and_then(|v| v.as_bool()).unwrap_or(false) {
            ", Sanity is pointed here"
        } else {
            ", Sanity is left pointed at another repo"
        }
    );
    println!();
    if remaining == 0 {
        println!("Every function has an up-to-date reading. `sanity summary {path}` says what it found.");
    } else {
        println!("Ask your agent:");
        println!();
        println!("    study this project in sanity");
    }
    println!();
    0
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
        eprintln!("sanity: nothing is running. Start the app, or run `sanity study {path}`.");
        return Err(1);
    };
    let key = agentapi::project_key(&repo);
    let v = get(&ep, &format!("{endpoint}?project={}", urlencode(&key))).map_err(|e| {
        eprintln!("sanity: {e}");
        1
    })?;
    if !v.get("open").and_then(|x| x.as_bool()).unwrap_or(false) {
        eprintln!("sanity: {} is not open. Run `sanity study {path}`.", repo.display());
        return Err(1);
    }
    Ok(v)
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
    println!("{} — {}", text(&v, "project"), text(&v, "repo"));
    print!("  {} functions", commas(num(&v, "functions")));
    if num(&v, "excluded") > 0 {
        print!(", {} excluded by .sanityignore", commas(num(&v, "excluded")));
    }
    println!();
    println!(
        "  {} read, {} to go, {} out with readers now",
        commas(num(&v, "assessed")),
        commas(num(&v, "remaining")),
        commas(num(&v, "in_flight"))
    );
    if num(&v, "stale") > 0 {
        println!("  {} stale — the code changed under them", commas(num(&v, "stale")));
    }
    println!("  readings in {}", text(&v, "assessment_file"));
    println!();
    println!("{}", text(&v, "next_step"));
    println!();
    0
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
    println!("{}", text(&v, "repo"));
    print!("  {} functions", commas(num(&v, "functions")));
    if num(&v, "excluded") > 0 {
        print!(", {} excluded by .sanityignore", commas(num(&v, "excluded")));
    }
    println!();
    println!(
        "  {} read, {} to go, {} stale",
        commas(num(&v, "assessed")),
        commas(num(&v, "remaining")),
        commas(num(&v, "stale"))
    );
    if let Some(readings) = total.get("readings").and_then(|x| x.as_u64()) {
        if readings > 0 {
            println!();
            println!("  PREDICTED   {}", grades(total.get("predicted")));
            println!("  DOCUMENTED  {}", grades(total.get("documented")));
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
        &std::sync::atomic::AtomicBool::new(false),
        crate::scan::Memos { scores: &crate::cache::Cache::ephemeral(), scans: &scans },
        // Ordering, matching an open. The proxy scores decide nothing that is written here —
        // a shard holds readings, and a reading is an agent's — so paying for the all-pairs
        // term would buy a number this verb does not print.
        crate::scan::Fidelity::Ordering,
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

/// One grade histogram on one line, in scale order.
///
/// Named rather than positional: four bare numbers in a row is a thing you have to go and
/// look up, and the scale's direction is the reading.
fn grades(v: Option<&Value>) -> String {
    let Some(v) = v else { return "—".into() };
    ["full", "most", "some", "none"]
        .iter()
        .map(|k| format!("{k} {}", commas(v.get(*k).and_then(|x| x.as_u64()).unwrap_or(0))))
        .collect::<Vec<_>>()
        .join("   ")
}

const USAGE: &str = "\
sanity — see where the thinking in your codebase actually is

  sanity                     open the window
  sanity study <path>        open a repo for assessment and print what to ask your agent
                             (--show also points the window at it)
  sanity status <path>       how far along that repo's assessment is
  sanity summary <path>      what the assessment found, in aggregate
  sanity refresh <path>      rewrite that repo's .sanity/ in the current format
  sanity serve               run the backend with no window (idempotent)
  sanity mcp                 the stdio MCP server, for an agent to launch
";

/// Dispatch for everything that is not the window. Returns a process exit code.
pub fn main(args: &[String]) -> i32 {
    let rest: Vec<&str> = args[1..].iter().map(|s| s.as_str()).collect();
    // Defaulting to the working directory, because every one of these verbs is something
    // you run while standing in the repo you mean.
    let path = rest.iter().find(|a| !a.starts_with('-')).copied().unwrap_or(".");
    match args[0].as_str() {
        "serve" => serve(),
        "study" => study(path, rest.contains(&"--show")),
        "status" => status(path),
        "summary" => summary(path),
        "refresh" => refresh(path),
        "help" | "--help" | "-h" => {
            print!("{USAGE}");
            0
        }
        other => {
            eprintln!("sanity: unknown command `{other}`\n");
            print!("{USAGE}");
            2
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
