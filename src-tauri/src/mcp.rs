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
        .map_err(|_| NOT_RUNNING.to_string())?
        .json()
        .map_err(|e| e.to_string())
}

fn post(path: &str, body: Value) -> Result<Value, String> {
    let base = base_url().ok_or(NOT_RUNNING)?;
    reqwest::blocking::Client::new()
        .post(format!("{base}{path}"))
        .json(&body)
        .send()
        .map_err(|_| NOT_RUNNING.to_string())?
        .json()
        .map_err(|e| e.to_string())
}

const NOT_RUNNING: &str = "Sanity is not running. Start the app, then call sanity_open with your repo path.";

fn tools() -> Value {
    json!([
        {
            "name": "sanity_open",
            "description": "Point Sanity at a repo and make it what the window shows. Call this FIRST, with the absolute path of the project you are working in — Sanity creates the project if it has not seen it before, and reopens it (keeping past assessments) if it has. Sanity does the structural work itself: walking the repo, parsing functions, reading git history. You do not need to do any of that. READ THE `protocol` FIELD IN THE RESPONSE AND FOLLOW IT — the assessment must run in fresh subagents, not in the session that called this.",
            "inputSchema": {
                "type": "object",
                "properties": { "path": { "type": "string", "description": "Absolute path to the repo." } },
                "required": ["path"]
            }
        },
        {
            "name": "sanity_status",
            "description": "What repo Sanity has open, how many functions are assessed, and — importantly — how many REMAIN. Call this after every wave of subagents: if `remaining` is above zero the job is not finished and you should spawn another wave.",
            "inputSchema": { "type": "object", "properties": {} }
        },
        {
            "name": "sanity_next",
            "description": "Get the next functions to assess, most promising first. ONLY call this from a fresh subagent that has not been reading this repo — a reader who already knows a file recalls it rather than predicting it, and recall marks everything unsurprising. Returns each function's NAME, LOCATION and SIBLING NAMES — deliberately NOT its body. For each: (1) write what you expect the body to do from the name and neighbours alone; (2) THEN open abs_path at the given line and read it; (3) report the gap with sanity_report.",
            "inputSchema": {
                "type": "object",
                "properties": { "n": { "type": "number", "description": "How many to fetch (default 5)." } }
            }
        },
        {
            "name": "sanity_report",
            "description": "Report one function after predicting and then reading it. Mark surprised=true only when the body did something the name and signature would not lead a competent reader to expect — an unusual failure mode, a hidden side effect, a workaround, an inverted condition. Ordinary implementation detail is not surprise.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "The id from sanity_next." },
                    "expected": { "type": "string", "description": "What you predicted BEFORE reading it." },
                    "found": { "type": "string", "description": "What it actually does." },
                    "surprised": { "type": "boolean", "description": "Did it diverge in a way that matters?" },
                    "note": { "type": "string", "description": "One sentence a human can read, only if surprised." },
                    "cold": { "type": "boolean", "description": "True if you had NOT read this file before predicting. Answer honestly — a warm reading is worth less and Sanity shows it differently rather than discarding it." }
                },
                "required": ["id", "expected", "found", "surprised"]
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
