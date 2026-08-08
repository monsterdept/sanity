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
fn live() -> Option<Endpoint> {
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
pub(crate) fn ensure_backend() -> Result<Endpoint, String> {
    if let Some(ep) = live() {
        return Ok(ep);
    }
    if std::env::var_os("SANITY_BACKEND").is_some() {
        return Err("SANITY_BACKEND is set but nothing is answering there".into());
    }
    let exe = std::env::current_exe().map_err(|e| format!("cannot find my own binary: {e}"))?;
    std::process::Command::new(exe)
        .arg("serve")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("could not start the backend: {e}"))?;

    let deadline = Instant::now() + START_WAIT;
    loop {
        if let Some(ep) = live() {
            return Ok(ep);
        }
        if Instant::now() >= deadline {
            return Err("the backend did not come up within 15s".into());
        }
        std::thread::sleep(Duration::from_millis(250));
    }
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

        let idle = state
            .lock()
            .ok()
            .map(|s| s.last_agent.map_or_else(|| started.elapsed(), |t| t.elapsed()));
        if idle.is_some_and(|d| d >= IDLE_FOR) {
            println!("Nothing has called in {} minutes. Standing down.", IDLE_FOR.as_secs() / 60);
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
