//! `just findings <path>` — the finding catalog, headless.
//!
//! **This is the instrument the default catalog gets titrated with, and it is why the rule
//! grammar has a text form at all.** A catalog can only be tuned in a language that can
//! express it; one tuned by recompiling is one nobody tunes. The dropdowns in the window
//! are a UI over this evaluator, added once the defaults have stopped moving — so anything
//! this cannot say, the settings page will not be able to say either.
//!
//! Two numbers matter per rule and only one of them is the hit count:
//!
//! - **calibrated** — the threshold that would yield about `--target` findings on THIS repo.
//!   A shipped constant is wrong on most repos by construction: the same rule wants 134
//!   lines on htop and 1,383 on kibana.
//! - **only** — how many of its findings no other enabled rule already found. A rule with a
//!   healthy hit count and no marginal contribution is a second name for a list you already
//!   have, which is how "long and undocumented" died.
//!
//! **`--depth files` on anything the size of kibana.** The default reads per-line blame, which
//! `docs/notes/budgets.md` measures at 206s of a 214s cold ceph scan and worse on a repo with
//! 59,000 files — and a bench nobody will wait for is a bench nobody runs. The log walk gives
//! every rule here an honest answer at file resolution, which is what `score_dir` hands a
//! function anyway wherever blame could not read it.
//!
//! `--rule` runs one ad-hoc rule instead of the catalog, which is the loop this exists for:
//!
//! ```text
//! just findings ../ceph --rule "func: loc >= 200 and callers >= 20"
//! ```

use sanity_lib::findings::{self, Rule};
use sanity_lib::scan::Progress;
use std::path::PathBuf;

fn main() {
    let mut args = std::env::args().skip(1);
    let mut path = PathBuf::from(".");
    let mut target = 20usize;
    let mut show = 5usize;
    let mut exprs: Vec<String> = Vec::new();
    let mut bare = false;
    let mut raw = false;
    let mut depth = sanity_lib::trace::Depth::Lines;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--rule" => {
                if let Some(e) = args.next() {
                    exprs.push(e);
                }
            }
            "--bare" => bare = true,
            "--raw" => raw = true,
            "--target" => target = args.next().and_then(|n| n.parse().ok()).unwrap_or(target),
            "--show" => show = args.next().and_then(|n| n.parse().ok()).unwrap_or(show),
            "--depth" => {
                depth = match args.next().as_deref() {
                    Some("none") => sanity_lib::trace::Depth::Untraced,
                    Some("files") => sanity_lib::trace::Depth::Files,
                    Some("edits") => sanity_lib::trace::Depth::Edits,
                    _ => sanity_lib::trace::Depth::Lines,
                }
            }
            "-h" | "--help" => {
                eprintln!(
                    "usage: sanity-findings [PATH] [--rule EXPR]... [--bare] [--raw] [--target N] [--show N]\n\
                     \x20                  [--depth none|files|lines|edits]\n\n\
                     --depth files on a large repo: the default blames every file.\n\
                     EXPR is `func: loc >= 200 and callers >= 20` — one or two clauses over\n\
                     loc funcs callers calls clone_size cognitive tangle age touched commits\n\
                     read surprise documented legible"
                );
                return;
            }
            // **An empty argument is not a path.** `just` hands a recipe's `*flags=""` through
            // as one empty positional when no flags were given, and taking it as the repo made
            // `just findings` with no arguments scan "" and report a repo of nothing —
            // truthfully, and about the wrong place.
            other if !other.is_empty() => path = PathBuf::from(other),
            _ => {}
        }
    }

    // **An ad-hoc rule is APPENDED to the catalog, not swapped for it.** The question being
    // asked of a candidate is never "how many does it find" — it is what it finds that the
    // shipped set does not, and a run that dropped the catalog would answer the first
    // question while appearing to answer the second. `--bare` is for looking at a rule on
    // its own, which is a different and rarer thing to want.

    // Same one-line stderr ticker as `sanity-history`, for the same reason: a cold scan of a
    // large repo is minutes, and a tool that discards the progress it is handed leaves you
    // with no idea whether it is working. stdout stays clean.
    //
    // Throttled with an atomic rather than through `scan::throttled`, which holds a `Cell`
    // and a `RefCell` and so is not `Sync` — and a scan's progress callback is called from
    // the parse threads. Same job, one line of state instead of three.
    let last = std::sync::atomic::AtomicU64::new(0);
    let epoch = std::time::Instant::now();
    let tick = |p: Progress| {
        let now = epoch.elapsed().as_millis() as u64;
        let was = last.load(std::sync::atomic::Ordering::Relaxed);
        // Always let a phase change through: the phases are what say WHICH of a scan's four
        // long stretches you are in, and swallowing one for being early is the report that
        // made a cold open look like a hang.
        let ends = p.done > 0 && p.done == p.total;
        if now.saturating_sub(was) < 100 && !ends {
            return;
        }
        last.store(now, std::sync::atomic::Ordering::Relaxed);
        if p.total > 0 {
            let pct = 100.0 * p.done as f32 / p.total as f32;
            eprint!("\r{:<22} {:>9} / {:<9} {:>5.1}%   ", p.phase, p.done, p.total, pct);
        } else if !p.phase.is_empty() {
            eprint!("\r{:<60}", p.phase);
        }
        let _ = std::io::Write::flush(&mut std::io::stderr());
    };

    let started = std::time::Instant::now();
    let scans = sanity_lib::scancache::ScanCache::open(&path);
    // `Fidelity::Ordering`, matching an open: the proxy's own surprise decides nothing here.
    // Every reading clause is answered from `.sanity/` or not at all — see `Field::Surprise`,
    // which is `None` on an unread body rather than falling back to a proxy score.
    let scan = match sanity_lib::scan::scan(
        &path,
        &sanity_lib::surprise::HeuristicModel,
        &tick,
        &|_, _: &sanity_lib::surprise::Reading| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        sanity_lib::scan::Memos { scores: &sanity_lib::cache::Cache::ephemeral(), scans: &scans },
        sanity_lib::scan::Fidelity::Ordering,
        depth,
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("\nsanity-findings: could not scan {}: {e}", path.display());
            std::process::exit(1);
        }
    };
    let reports = sanity_lib::assessment::load(&path, &scan);
    eprintln!();

    let traced = findings::Traced {
        git: depth != sanity_lib::trace::Depth::Untraced,
        churned: scan.stats.churned,
        blamed: depth >= sanity_lib::trace::Depth::Lines,
        headcount: scan.stats.headcount,
        age_days: scan.stats.age_days,
    };
    let facts = findings::subjects(&scan.root, &reports, traced);

    // **The repo's own thresholds, the same ones the window uses.** `rules_for` calibrates
    // and saves on first sight; after that the numbers are settled and this tool reports what
    // the panel reports. `--raw` runs the shipped catalog instead, which is what you want when
    // asking what a rule DOES rather than what this repo currently says.
    let mut rules: Vec<Rule> = if bare {
        Vec::new()
    } else if raw {
        findings::catalog()
    } else {
        findings::rules_for(&path, &facts)
    };
    match exprs.iter().map(|e| Rule::parse(e)).collect::<Result<Vec<_>, _>>() {
        Ok(r) => rules.extend(r),
        Err(e) => {
            eprintln!("sanity-findings: {e}");
            std::process::exit(2);
        }
    }
    if rules.is_empty() {
        eprintln!("sanity-findings: --bare needs at least one --rule");
        std::process::exit(2);
    }
    let funcs =
        facts.iter().filter(|f| f.subject.kind == sanity_lib::model::NodeKind::Func).count();
    let files = facts.len() - funcs;

    // Once, and reused by both loops below: `hits` filters and sorts every subject, and this
    // tool prints each rule twice.
    //
    // **Minus what the archive holds, because the window subtracts it too.** A bench that
    // counted findings somebody had already settled would disagree with the panel about the same
    // repo, and two answers about one population is the split brain this whole design keeps
    // legislating against. A FLAGGED finding is not settled and stays counted.
    let archive = findings::archive(&path);
    let pins = findings::pinned(&archive);
    let (sets, aside): (Vec<_>, Vec<_>) =
        rules.iter().map(|r| findings::live_hits(r, &facts, &pins)).unzip();
    let solo = findings::Marginal::of(&sets);
    let set_aside: usize = aside.iter().sum();

    println!("{}", path.display());
    println!(
        "  {files} files, {funcs} functions, {} readings, scanned in {:.1}s",
        reports.len(),
        started.elapsed().as_secs_f32(),
    );
    // **What could not be asked, said once and out loud.** A rule whose clause the repo has
    // no evidence for finds nothing, and a reader who is not told why will read that as a
    // clean bill — the one thing this surface must never do.
    if !traced.git {
        println!("  no git read (--depth none): age, touched and commits cannot answer");
    } else if !traced.churned {
        println!("  timeline not walked: commits cannot answer — `--depth edits` to walk it");
    }
    if reports.is_empty() {
        println!("  nothing read here: surprise, documented and legible cannot answer");
    }
    if set_aside > 0 {
        println!("  {set_aside} settled in .sanity/findings/decisions.md, and not counted below");
    }

    let head = format!(
        "\n  {:<34} {:>7} {:>7} {:>18}   {}",
        "rule", "hits", "only", "calibrated", "so what"
    );
    println!("{head}");
    println!("  {}", "-".repeat(head.len() - 4));
    for (i, rule) in rules.iter().enumerate() {
        let hits = &sets[i];
        let only = solo.only(i, &sets);
        let cal = findings::calibrate(rule, &facts, target)
            .map(|v| format!("{} {}", rule.clauses[rule.calibrated].field.name(), fmt(v)))
            .unwrap_or_else(|| "—".to_string());
        println!(
            "  {:<34} {:>7} {:>7} {:>18}   {}",
            format!("{}{}", rule.title, if rule.tier() == 2 { " ²" } else { "" }),
            hits.len(),
            only,
            cal,
            rule.so_what,
        );
    }

    for (i, rule) in rules.iter().enumerate() {
        let hits = &sets[i];
        if hits.is_empty() {
            continue;
        }
        println!("\n  {} — {}", rule.title, rule.expr());
        for s in hits.iter().take(show) {
            let at = s.line.map(|l| format!(":{l}")).unwrap_or_default();
            println!("      {:>6}L  {}{}  {}", s.loc, s.path, at, s.name);
            // The rule's own sentence about this body, filled with its numbers — the same
            // string the panel prints, from the same renderer. Two templates for one sentence
            // is how the window and the CLI come to disagree about a repo.
            if let Some(f) = facts.iter().find(|f| f.subject.key == s.key) {
                let median = rule
                    .clauses
                    .get(rule.calibrated)
                    .and_then(|c| findings::spread(&facts, rule.pop, c.field))
                    .map(|s| s.median);
                println!("              {}", findings::flat(&findings::render(rule, f, median)));
            }
        }
        if hits.len() > show {
            println!("      … and {} more", hits.len() - show);
        }
    }
    println!();
}

fn fmt(v: f32) -> String {
    if v.fract() == 0.0 {
        format!("{}", v as i64)
    } else {
        format!("{v:.2}")
    }
}
