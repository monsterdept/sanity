//! The `check` verb: open the repo on a backend, settle which model reads, and start a wave.
//!
//! The model is decided before anything is spent — inherited from the repo's own readings,
//! asked for at a terminal, or left to the harness and said out loud. A run already going is
//! the thing somebody asked to watch, not a failure. What the run was asked for is kept as a
//! [`Wanted`] so [`resume`] can ask for it again on a backend that took over; the watching
//! itself is in `tail`.

use super::backend::{ensure_backend, get, post, retire_stale_backend};
use super::tail::tail;
use super::{choose, fancy, interactive, resolve, text};
use crate::agentapi::{self, Endpoint};
use crate::mcp::urlencode;
use serde_json::json;
use std::path::PathBuf;

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
pub(super) fn resume(ep: &Endpoint, want: &Wanted) -> Result<(), ()> {
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

/// What a run was asked for, so it can be asked for again.
///
/// **The client that wanted the run is the one that can restart it.** Nothing durable
/// records an in-flight wave — deliberately, since a backend holds nothing precious — so
/// after a handover there is no state to recover from. But the command that typed `check`
/// still knows the model, the width and the limit, and the readings already banked are in
/// `.sanity/`, so reissuing costs only whatever was in flight.
pub(super) struct Wanted {
    pub(super) repo: PathBuf,
    pub(super) model: Option<String>,
    pub(super) readers: Option<usize>,
    pub(super) limit: Option<usize>,
}
