//! `sanity mcp` — the stdio MCP server, hosted by the app binary itself.
//!
//! **The only one.** It was a Node script (`mcp/sanity.mjs`) during development, which is
//! fine from a repo checkout and useless once the app is installed: there is no `mcp/`
//! directory next to a .app bundle, so any "connect" button would write a path that does
//! not exist. So the binary became its own MCP server — the command an agent launches has
//! to be something that is definitely there — and for a while both existed.
//!
//! That was the mistake, and it cost a real measurement. Two copies of one tool contract
//! drift, and the schema here gained `predicted`, `documented` and `derivable` while the
//! Node copy did not. `.mcp.json` pointed at the Node copy, so every reading taken in this
//! repo silently dropped all three — including `derivable`, the whole defence against
//! generated documentation counting as documentation. The protocol asked for them, the
//! store accepted them, and the contract in between threw them away.
//!
//! One server. If a second ever seems necessary, the schema has to come from one place.
//!
//! It forwards to the loopback API the running app serves, so the window the human is
//! looking at is what answers. Launching this without the app running is an error the
//! agent can read, not a silent empty result.

use serde_json::{json, Value};
use std::io::{BufRead, Write};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// The project THIS shim is working on.
///
/// One `sanity mcp` process is spawned per MCP client, so this variable is already
/// per-session — the isolation exists for free and was being thrown away at the HTTP
/// boundary, where every call resolved against the app's single `active` project instead.
/// Two agents on two repos therefore merged: the second to call `sanity_open` took
/// ownership of the first's queue, its leases and its readings, and the first's
/// orchestrator carried on believing it was assessing its own repo.
///
/// Held here rather than passed through the tool schema on purpose. The agent never sees
/// it, so it cannot forget it, garble it, or lose it to a compaction — and a model that
/// ignores instructions cannot break it, which is not true of anything carried in a
/// prompt.
static PROJECT: Mutex<Option<String>> = Mutex::new(None);

fn project() -> Option<String> {
    PROJECT.lock().ok().and_then(|p| p.clone())
}

/// Resolve the running app's port from the file it publishes, rather than assuming one.
///
/// Re-read on every attempt, never cached: the app claims a **new port** each time it
/// starts, so a URL from thirty seconds ago points at nobody after a restart. That is the
/// common case during development, and caching would turn a two-second gap into a dead
/// server for the life of this process.
///
/// The doc here used to claim "a stale file from a crashed app fails the liveness check".
/// There was no liveness check — the pid is published and was never read. What actually
/// happens is that a stale file resolves to a plausible URL and the connection is refused,
/// which the retry window below then absorbs or reports. That is a fine mechanism; it just
/// was not the one described, and a comment describing a guard that does not exist is
/// worse than no comment.
pub(crate) fn base_url() -> Option<String> {
    if let Ok(url) = std::env::var("SANITY_BACKEND") {
        return Some(url);
    }
    // Parsed by `agentapi::read_endpoint` rather than here. It was two readers of one
    // file the moment the CLI needed the pid as well as the port, and two parsers of one
    // format is the `mcp/sanity.mjs` shape in miniature.
    Some(crate::agentapi::read_endpoint()?.url())
}

/// How long to keep trying before giving up on a call.
///
/// The app is rebuilt and relaunched constantly during development, and each restart is a
/// gap of a second or two on a fresh port. Telling the agent to retry — which the error
/// text now does — is not enough on its own: three separate readers responded to that gap
/// by inventing a prerequisite, running the tools as shell commands, and reading
/// `.sanity/` to compensate. Absorbing the gap here means they never see it.
const RETRY_FOR: Duration = Duration::from_secs(12);
const RETRY_EVERY: Duration = Duration::from_millis(400);

/// Run `attempt` until it succeeds or the window closes, resolving the endpoint afresh
/// each time.
///
/// Only connection-level failures retry. An HTTP response that parsed is an answer, even
/// an unwelcome one, and repeating a call the server already handled would double-report
/// a reading.
fn with_retry<T>(mut attempt: impl FnMut(&str) -> Result<T, RetryableError>) -> Result<T, String> {
    let deadline = Instant::now() + RETRY_FOR;
    loop {
        // A missing endpoint file is not an error here: during a restart that is exactly
        // what the window looks like for a moment, so it is worth waiting through rather
        // than reporting — the app has not "not started", it is starting.
        if let Some(base) = base_url() {
            match attempt(&base) {
                Ok(v) => return Ok(v),
                Err(RetryableError::Fatal(e)) => return Err(e),
                Err(RetryableError::Transient) => {}
            }
        }
        if Instant::now() >= deadline {
            return Err(if crate::agentapi::endpoint_file().is_some_and(|p| p.exists()) {
                UNREACHABLE.to_string()
            } else {
                NOT_RUNNING.to_string()
            });
        }
        std::thread::sleep(RETRY_EVERY);
    }
}

enum RetryableError {
    /// The app was not reachable. Worth another attempt on a freshly-resolved port.
    Transient,
    /// The app answered and something else went wrong. Retrying cannot help.
    Fatal(String),
}

fn get(path: &str) -> Result<Value, String> {
    with_retry(|base| {
        let r = reqwest::blocking::get(format!("{base}{path}"))
            .map_err(|_| RetryableError::Transient)?;
        r.json().map_err(|e| RetryableError::Fatal(e.to_string()))
    })
}

fn post(path: &str, body: Value) -> Result<Value, String> {
    with_retry(|base| {
        let r = reqwest::blocking::Client::new()
            .post(format!("{base}{path}"))
            .json(&body)
            .send()
            .map_err(|_| RetryableError::Transient)?;
        r.json().map_err(|e| RetryableError::Fatal(e.to_string()))
    })
}

/// Two errors, because they call for opposite responses and one message cannot mean both.
///
/// There was only [`NOT_RUNNING`], phrased as an instruction to the human ("Start the
/// app"). A reader that hit it during a restart read it as a permanent precondition and
/// improvised: one invented a prerequisite and stopped, one decided MCP was unavailable
/// and went and read `.sanity/` — contaminating itself with the previous reader's
/// findings, the single thing the protocol forbids — and one tried to run `sanity_next`
/// as a shell command. Models fill silence with invention, so the transient case has to
/// say, in its own words, that it is transient and that retrying is the correct move.
const UNREACHABLE: &str = "Sanity is not answering right now. This is usually TRANSIENT — \
    the app restarts during development and comes back on a new port within a few seconds. \
    Wait a moment and CALL THE SAME TOOL AGAIN, up to about five times. Do NOT conclude \
    that Sanity is unavailable, do not invent a prerequisite, do not run sanity tools as \
    shell commands, and above all do NOT read the .sanity/ directory to compensate — that \
    contaminates your reading with the previous reader's findings and makes it worthless. \
    If it is still failing after several retries, stop and report that Sanity is down.";

const NOT_RUNNING: &str = "Sanity does not appear to be running at all — no endpoint file \
    was found. If it is starting up, retry in a few seconds. Otherwise ask the human to \
    start the Sanity app, then call sanity_open with your repo path. Do NOT read the \
    .sanity/ directory instead; a reading made after seeing it is contaminated.";

/// Percent-encode a project key for a query string. Keys are absolute paths, so spaces
/// and anything else a directory name may legally contain have to survive the trip.
pub(crate) fn urlencode(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                (b as char).to_string()
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// The tool contract, and the biggest fixed cost a reader carries.
///
/// Public so `just tokens` can weigh the real thing. Measuring a copy would be the
/// `mcp/sanity.mjs` mistake again: two versions of one contract, and the one you are
/// reading is the one that is wrong.
///
/// **These descriptions are priced per reading.** Every subagent loads all five before it
/// reads a line of code, and at one function per reader that is once per function rather
/// than once per ten. Measured on this repo, the context we write was 86% of a reader's
/// input floor and the code it exists to read was 8% — and 800 of those tokens described
/// three tools a reader never calls. So:
///
/// - **The wire carries the rule; the source carries the reason.** The arguments behind
///   these rules — why `derivable` exists, what happened when readings were keyed on node
///   ids, why one function per reader — live in doc comments and CLAUDE.md, where they
///   cost nothing per reading. What stays here is what a reader must DO, plus the one
///   clause that makes each rule stick, because a rule with no reason gets improvised
///   around and this repo has watched that happen three times.
/// - **Guidance the orchestrator needs goes in the RESPONSE, not the description.**
///   `sanity_open` returns `protocol`, `sanity_status` returns `next_step`,
///   `sanity_summary` returns `note`. Those reach the one session that asked, at the
///   moment it matters, instead of every reader that never will. It is the argument
///   `PROTOCOL` was already written down for.
///
/// Run `just tokens` before and after touching any of this.
pub fn tools() -> Value {
    json!([
        {
            "name": "sanity_open",
            "description": "Point Sanity at a repo. Call this FIRST, with an absolute path — updating an existing assessment is the same call. Sanity does the walking, parsing and git history itself; you must NOT read `.sanity/` yourself, because knowing what the last reader found destroys the measurement. READ THE `protocol` FIELD IN THE RESPONSE AND FOLLOW IT. Check `functions` first: a full pass is a fresh subagent per ten functions, so on a large repo say what that would cost and ask how far to go before spawning anything. The response also carries `shape` — the repo by top-level directory — and `excluded`, what a `.sanityignore` at the repo root has set aside. If some slice of the repo is not worth reading, put that to the human WITH the numbers from `shape` and let them decide; the file is theirs to write, not yours, and there are no defaults in it. Never assume tests belong in it.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string", "description": "Absolute path to the repo." } },
                "required": ["path"]
            }
        },
        {
            "name": "sanity_status",
            "description": "What repo is open and how much work is left. Call after every wave of subagents, and follow `next_step`. `remaining` ignores leases and only falls when a reading lands; `in_flight` is how many of those are out with readers, so remaining == in_flight means wait rather than spawn. `outstanding` gives the oldest few as `{id, held_for_s}` — use the AGE: a wave out for minutes while `remaining` sits flat is dead, not busy. Never re-hand those functions to whoever was holding them; spawn a fresh reader instead.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "sanity_next",
            "description": "Get ONE function to assess. Call it with no arguments, from a fresh subagent that has not been reading this repo: a reader who already knows a file recalls it instead of predicting it, and recall marks everything unsurprising. You get its name, `owner` (the type it hangs off; one file can hold a dozen `parse`s), signature, location, docs, and `peers` — the nearest twenty siblings in file order, with `peers_omitted` saying how many more the file holds. You do NOT get the body. Then: (1) write what you expect the body to do from that alone; (2) read ONLY that function, opening abs_path bounded to `line`..`end_line`, never the whole file; (3) call sanity_report. The protocol asks you to do that ten times, calling this again only after reporting the last one — do not ask for several at once. It costs no less, and a reader holding ten tasks has already read nine signatures, owners and peer lists it has not predicted yet.",
            "inputSchema": {
                "type": "object",
                "properties": { "n": { "type": "number", "description": "How many to fetch. Leave it out: one at a time is the protocol, and fetching a batch is the same tokens for a warmer reading." } }
            }
        },
        {
            "name": "sanity_report",
            "description": "Report one function after predicting and then reading it, before you look at the next one. `predicted` is the measurement — grade it against what you wrote BEFORE reading, not against what you understand now. `documented` and `derivable` are about the docs you were handed, not the code. If those docs describe an enclosing type rather than this function, say so in `note` and grade `documented` as none: that is a finding about the repo, not your fault.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "The id from sanity_next." },
                    "expected": { "type": "string", "description": "What you predicted BEFORE reading it." },
                    "found": { "type": "string", "description": "What it actually does." },
                    "predicted": {
                        "type": "string",
                        "enum": ["full", "most", "some", "none"],
                        "description": "How much of the body your prediction covered. full — you called it, nothing missed. most — broadly right, one detail that was not obvious. some — recognisable, but it does real work you did not cover. none — your prediction did not describe this code."
                    },
                    "documented": {
                        "type": "string",
                        "enum": ["full", "most", "some", "none"],
                        "description": "How well the docs you were given cover what the code actually does, same scale. none if there were no docs. Reported, never subtracted from the colour."
                    },
                    "derivable": {
                        "type": "boolean",
                        "description": "True if those docs say nothing you could not have worked out from the code alone. Answer honestly even when they read well: documentation a model could regenerate from the body explains nothing that was not already there, and this is the only thing stopping a generated-docs pass from turning the map green and making it a liar."
                    },
                    "surprised": { "type": "boolean", "description": "Superseded by `predicted` — send that instead. Kept so older callers still work." },
                    "note": { "type": "string", "description": "One sentence a human can read, only if surprised." },
                    "model": { "type": "string", "description": "Which model you are, name and version, e.g. claude-haiku-4.5. A grade from a small fast model and one from a large one are not the same evidence. Say what you are; omit it rather than guess." },
                    "cold": { "type": "boolean", "description": "True if you had NOT read this file before predicting. Answer honestly — a warm reading is worth less, and Sanity marks it rather than discarding it." },
                    "position": { "type": "number", "description": "Where this function sat in your run — 1 for the first you assessed, 2 for the second, and so on up to the batch size. Report the truth, and report it even if you took more than you were asked for: `cold` only asks whether you had opened this FILE, and cannot see that a reader deep into a batch has learned the repo's idioms and predicts better for reasons that are nothing to do with the code. A reading that says where it sat can be weighed; one that does not silently widens the scale." }
                },
                "required": ["id", "expected", "found", "predicted", "documented", "derivable", "cold", "position", "model"]
            }
        },
        {
            "name": "sanity_summary",
            "description": "What the assessment says, in aggregate: grade distributions, derivable count, a split by model, and whether readings made later in a reader's run graded differently. Call this at the END, from the driving session, to report the result — it exists because that session has to report and is forbidden to read `.sanity/`. Repo-wide totals only; nothing here names a file or a function, deliberately. Read `note` in the response.",
            "inputSchema": { "type": "object", "properties": {} }
        }
    ])
}

fn call(name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "sanity_open" => {
            let out = post("/open", json!({ "path": args.get("path").and_then(|v| v.as_str()).unwrap_or("") }))?;
            // Remember what we opened. Every later call carries it, so this session's
            // work lands in this session's repo however many other agents are running.
            if let Some(key) = out.get("project").and_then(|v| v.as_str()) {
                if let Ok(mut p) = PROJECT.lock() {
                    *p = Some(key.to_string());
                }
            }
            Ok(out)
        }
        // Carries the key like every other call. It did not, and it is the one an
        // orchestrator makes most often: a driving session polled its own run and was
        // answered about whichever repo the window had drifted to, then reported that.
        "sanity_status" => match project() {
            Some(k) => get(&format!("/status?project={}", urlencode(&k))),
            None => get("/status"),
        },
        // The batch size is decided in exactly one place, `agentapi::default_n`, and this
        // is why: the shim used to carry its own `unwrap_or(1)` and send `n` on every
        // call, so `default_n` was dead code for every MCP caller. When it moved to 3 the
        // constant changed, the doc comment changed, CLAUDE.md changed, the protocol text
        // changed — and readers kept getting one function, because the only line that
        // actually decided was this one. A cold reader reported it in the first wave.
        //
        // Omitting `n` when the caller did not ask for one is the whole fix: serde fills
        // it from `default_n` and there is nothing here left to drift.
        "sanity_next" => {
            let n = args
                .get("n")
                .and_then(|v| v.as_u64())
                .map(|n| format!("n={}&", n.clamp(1, 25)))
                .unwrap_or_default();
            match project() {
                Some(k) => get(&format!("/queue?{n}project={}", urlencode(&k))),
                None => get(&format!("/queue?{n}")),
            }
        }
        "sanity_summary" => match project() {
            Some(k) => get(&format!("/summary?project={}", urlencode(&k))),
            None => get("/summary"),
        },
        "sanity_report" => {
            let mut body = args.clone();
            if let (Some(obj), Some(k)) = (body.as_object_mut(), project()) {
                obj.insert("project".into(), Value::String(k));
            }
            post("/report", body)
        }
        other => Err(format!("unknown tool {other}")),
    }
}

pub fn run() {
    let stdin = std::io::stdin();
    let mut out = std::io::stdout();
    for line in stdin.lock().lines().map_while(Result::ok) {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let Ok(msg): Result<Value, _> = serde_json::from_str(line) else {
            continue;
        };
        // Notifications carry no id and must not be answered.
        let Some(id) = msg.get("id").cloned() else {
            continue;
        };
        let method = msg.get("method").and_then(|m| m.as_str()).unwrap_or("");

        let result = match method {
            "initialize" => json!({
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": { "name": "sanity", "version": env!("CARGO_PKG_VERSION") }
            }),
            "tools/list" => json!({ "tools": tools() }),
            "tools/call" => {
                let params = msg.get("params").cloned().unwrap_or(json!({}));
                let name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));
                match call(name, &args) {
                    Ok(v) => json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&v).unwrap_or_default() }] }),
                    // Errors come back as tool CONTENT rather than transport errors, so
                    // the model can read and act on them ("start the app first") instead
                    // of seeing an opaque failure.
                    Err(e) => json!({ "content": [{ "type": "text", "text": format!("error: {e}") }], "isError": true }),
                }
            }
            _ => {
                let _ = writeln!(
                    out,
                    "{}",
                    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": -32601, "message": format!("method not found: {method}") } })
                );
                let _ = out.flush();
                continue;
            }
        };
        let _ = writeln!(out, "{}", json!({ "jsonrpc": "2.0", "id": id, "result": result }));
        let _ = out.flush();
    }
}
