//! `sanity mcp` — the stdio MCP server, hosted by the app binary itself.
//!
//! It was a Node script (mcp/sanity.mjs) during development, which is fine from a repo
//! checkout and useless once the app is installed: there is no `mcp/` directory next to
//! a .app bundle, so any "connect" button would write a path that does not exist. Tally
//! solved this by making the binary its own MCP server, and the same reasoning applies —
//! the command an agent launches has to be something that is definitely there.
//!
//! It forwards to the loopback API the running app serves, so the window the human is
//! looking at is what answers. Launching this without the app running is an error the
//! agent can read, not a silent empty result.

use serde_json::{json, Value};
use std::io::{BufRead, Write};

/// Resolve the running app's port from the file it publishes, rather than assuming one.
/// A stale file from a crashed app fails the liveness check.
fn base_url() -> Option<String> {
    if let Ok(url) = std::env::var("SANITY_BACKEND") {
        return Some(url);
    }
    let path = crate::agentapi::endpoint_file()?;
    let raw = std::fs::read_to_string(path).ok()?;
    let v: Value = serde_json::from_str(&raw).ok()?;
    let port = v.get("port")?.as_u64()?;
    Some(format!("http://127.0.0.1:{port}"))
}

fn get(path: &str) -> Result<Value, String> {
    let base = base_url().ok_or(NOT_RUNNING)?;
    reqwest::blocking::get(format!("{base}{path}"))
        // Reached the point of having an endpoint and failed to connect: the app was
        // there and went away, which is the restart case, not the never-started one.
        .map_err(|_| UNREACHABLE.to_string())?
        .json()
        .map_err(|e| e.to_string())
}

fn post(path: &str, body: Value) -> Result<Value, String> {
    let base = base_url().ok_or(NOT_RUNNING)?;
    reqwest::blocking::Client::new()
        .post(format!("{base}{path}"))
        .json(&body)
        .send()
        .map_err(|_| UNREACHABLE.to_string())?
        .json()
        .map_err(|e| e.to_string())
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

fn tools() -> Value {
    json!([
        {
            "name": "sanity_open",
            "description": "Point Sanity at a repo and make it what the window shows. Call this FIRST, with the absolute path of the project you are working in — including when the user asks to UPDATE an existing assessment, which is the same call. Sanity loads any assessment committed to the repo at `.sanity/` (whoever made it — these are shared, not per-user), and reports `stale`: readings whose code has changed underneath them. Sanity does the structural work itself: walking the repo, parsing functions, reading git history. You do not need to do any of that, and you must NOT read `.sanity/` yourself — knowing what the last reader found destroys the measurement. READ THE `protocol` FIELD IN THE RESPONSE AND FOLLOW IT — the assessment must run in fresh subagents, not in the session that called this.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string", "description": "Absolute path to the repo." } },
                "required": ["path"]
            }
        },
        {
            "name": "sanity_status",
            "description": "What repo Sanity has open and how much work is left. Call this after every wave of subagents. `remaining` is functions with no current reading — it ignores what is out with readers, so two callers a second apart agree, and it only falls when a reading actually lands. `in_flight` is how many of those are held by readers right now: if remaining == in_flight, wait rather than spawning another wave. `done` is remaining == 0 and nothing else. `stale` is the subset read before whose code has since changed; they are handed out first. `assessment_file` is where findings are written in the repo.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "sanity_next",
            "description": "Get the next functions to assess, most promising first. ONLY call this from a fresh subagent that has not been reading this repo — a reader who already knows a file recalls it rather than predicting it, and recall marks everything unsurprising. Returns each function's NAME, SIGNATURE, LOCATION, SIBLING NAMES and DOCS — deliberately NOT its body. Successive functions are drawn from DIFFERENT files wherever possible, so your reading of each stays cold. For each: (1) write what you expect the body to do from the name, signature, docs and neighbours alone; (2) THEN open abs_path at the given line and read it; (3) report the gap with sanity_report. Work through them IN ORDER and do not read ahead into the next function's file.",
            "inputSchema": {
                "type": "object",
                "properties": { "n": { "type": "number", "description": "How many to fetch (default 5)." } }
            }
        },
        {
            "name": "sanity_report",
            "description": "Report one function after predicting and then reading it. `predicted` is the measurement — grade how much of the body your prediction actually covered, against what you wrote BEFORE reading. `documented` and `derivable` are about the docs you were handed, not about the code. If the docs you were given describe an enclosing type rather than this function, say so in `note` and grade `documented` as none — that is a real finding about the repo, not your fault.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "The id from sanity_next." },
                    "expected": { "type": "string", "description": "What you predicted BEFORE reading it." },
                    "found": { "type": "string", "description": "What it actually does." },
                    "predicted": {
                        "type": "string",
                        "enum": ["full", "most", "some", "none"],
                        "description": "How much of the body your prediction actually covered. full — you called it, nothing in the body you missed. most — broadly right, one detail that was not obvious. some — recognisable, but it does real work you did not cover. none — your prediction did not describe this code. Grade against what you wrote BEFORE reading, not against what you understand now."
                    },
                    "documented": {
                        "type": "string",
                        "enum": ["full", "most", "some", "none"],
                        "description": "How well the docs you were given cover what the code actually does, same scale. Use none if there were no docs. This is reported, never subtracted from the colour — 'surprising and undocumented' and 'surprising but well covered' are different situations and only one is anyone's fault."
                    },
                    "derivable": {
                        "type": "boolean",
                        "description": "True if those docs say nothing you could not have worked out from the code alone. This is the one question a lexical score can never ask, and it is the defence against someone running a model over a repo, turning the map green and making it a liar: documentation a model could regenerate from the body explains nothing that was not already there, so it must not count as documentation."
                    },
                    "surprised": { "type": "boolean", "description": "Superseded by `predicted` — send that instead. Kept so older callers still work." },
                    "note": { "type": "string", "description": "One sentence a human can read, only if surprised." },
                    "model": { "type": "string", "description": "Which model you are, name and version, e.g. claude-haiku-4.5. Every reading is attributed, because a grade from a small fast model and one from a large one are not the same evidence. Say what you are; omit it rather than guess." },
                    "cold": { "type": "boolean", "description": "True if you had NOT read this file before predicting. Answer honestly — a warm reading is worth less and Sanity shows it differently rather than discarding it." }
                },
                "required": ["id", "expected", "found", "predicted", "documented", "derivable", "cold"]
            }
        }
    ])
}

fn call(name: &str, args: &Value) -> Result<Value, String> {
    match name {
        "sanity_open" => post("/open", json!({ "path": args.get("path").and_then(|v| v.as_str()).unwrap_or("") })),
        "sanity_status" => get("/status"),
        "sanity_next" => {
            let n = args.get("n").and_then(|v| v.as_u64()).unwrap_or(5).clamp(1, 25);
            get(&format!("/queue?n={n}"))
        }
        "sanity_report" => post("/report", args.clone()),
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
