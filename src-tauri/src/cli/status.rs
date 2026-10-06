//! The looking verbs, `status` and `summary`: how far along this repo is, and what was found.
//!
//! Both are formatters over the endpoint of the same name, and both open with the same
//! [`project_header`] so the two cannot disagree about the denominator. Neither starts a
//! backend or opens a repo. With nothing answering, or with a backend that has not opened this
//! repo, the same payload is computed in-process from a parse and the committed `.sanity/`
//! ([`offline_status`], [`offline_summary`]), and what only a live backend can know is left
//! absent rather than reported as zero.

use super::backend::{get, live};
use super::{commas, fancy, num, plural, resolve, text};
use crate::agentapi;
use crate::mcp::urlencode;
use serde_json::{json, Value};

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
pub(super) fn read_repo(
    repo: &std::path::Path,
) -> Option<(crate::scan::Scan, std::collections::HashMap<String, agentapi::Report>)> {
    let scans = crate::scancache::ScanCache::open(repo);
    let scan = crate::scan::scan(
        repo,
        &|_| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        &scans,
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
