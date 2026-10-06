//! The `trace` verb, and how deep any verb reads a repo's history.
//!
//! The verb opens the repo on a backend and asks `/trace` for a rung, or for as much as fits
//! the budget. That request is a [`Rung`], and the findings verbs make the same one when they
//! scan for themselves. How a skipped rung and its price are said — [`rung_name`] and
//! [`duration`] — is shared with the foot of the findings list.

use super::backend::{ensure_backend, post};
use super::{resolve, text};
use crate::agentapi;

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
pub(super) fn trace(path: &str, rung: Rung) -> i32 {
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
    let depth = match rung {
        Rung::Budget => "budget",
        Rung::Exactly(depth) => depth.tag_str(),
    };
    println!(
        "Reading {}…",
        match rung {
            Rung::Budget => "as much history as fits the budget".to_string(),
            Rung::Exactly(depth) => rung_name(depth).to_lowercase(),
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
pub(super) fn rung_name(depth: crate::trace::Depth) -> &'static str {
    match depth {
        crate::trace::Depth::Edits => "The edit timeline",
        crate::trace::Depth::Lines => "Per-line history",
        _ => "The commit log",
    }
}

/// An estimate, rounded the way `status` rounds one.
pub(super) fn duration(seconds: f32) -> String {
    if seconds >= 60.0 {
        format!("{:.0} min", seconds / 60.0)
    } else {
        format!("{:.0}s", seconds.max(1.0))
    }
}

/// How deep a verb reads history: a rung somebody named, or as far as the budget goes.
///
/// A depth REQUEST, not a list of what to return — every survey returns the same fields.
#[derive(Clone, Copy)]
pub(super) enum Rung {
    /// As deep as fits [`crate::trace::BUDGET`], priced on what is not already cached.
    Budget,
    /// This rung, whatever it costs — somebody typed the flag.
    Exactly(crate::trace::Depth),
}

impl Rung {
    /// `--edits` and `--blame` name a rung; neither leaves it to the budget.
    pub(super) fn of(edits: bool, blame: bool) -> Rung {
        match (edits, blame) {
            (true, _) => Rung::Exactly(crate::trace::Depth::Edits),
            (_, true) => Rung::Exactly(crate::trace::Depth::Lines),
            _ => Rung::Budget,
        }
    }
}
