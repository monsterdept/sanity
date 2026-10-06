//! The `init` verb: a person saying which agent and which model read this repo.
//!
//! It records the harness and the model in the per-machine index and touches no global agent
//! config. At a terminal it asks rather than listing the choices and stopping; anywhere else
//! it prints what is set and what could be, because a prompt with nobody on the other end is
//! a hang. With `--show` it also points a running window at the repo, which no other verb
//! does.

use super::backend::{ensure_backend, post};
use super::{choose, interactive, resolve};
use crate::agentapi;
use serde_json::json;

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
