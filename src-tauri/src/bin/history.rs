//! `just history <path>` — the replay, headless.
//!
//! The same thing `just scan` is for the metric: the app is the human's to open, so this
//! is how a change to the walk gets checked. It prints the shape of the timeline — how
//! many commits, how many functions the repo ends with, and what the biggest frames did —
//! which is enough to catch the failures that matter. A rename handled as an add shows up
//! as a function count that only ever climbs; a desynchronised blob stream shows up as
//! functions landing in the wrong file.

use sanity_lib::history;
use sanity_lib::scan::Progress;
use std::collections::HashMap;
use std::path::PathBuf;

fn main() {
    let mut args = std::env::args().skip(1);
    let mut path = PathBuf::from(".");
    let mut limit = history::MAX_COMMITS;
    let mut files = false;
    let mut json = false;
    let mut cached = false;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--files" => files = true,
            "--json" => json = true,
            "--cached" => cached = true,
            "--limit" => {
                if let Some(n) = args.next().and_then(|n| n.parse().ok()) {
                    limit = n;
                }
            }
            "-h" | "--help" => {
                eprintln!("usage: sanity-history [PATH] [--limit N] [--files] [--json] [--cached]");
                return;
            }
            other => path = PathBuf::from(other),
        }
    }

    let started = std::time::Instant::now();
    // Uncached by default: this is the tool that CHECKS the walk, and a run that answers
    // from a file is not a run of the thing being checked. `--cached` exercises the other
    // path deliberately.
    let hist = if cached {
        history::read_cached(&path, limit, &|_: Progress| {})
    } else {
        history::read(&path, limit, &|_: Progress| {})
    };
    let elapsed = started.elapsed();

    // The exact payload the webview receives, so the replay on that side can be checked
    // against this one without a window. Two implementations of one walk is how the two
    // pictures drift; this is what makes the comparison cheap enough to actually run.
    if json {
        println!("{}", serde_json::to_string(&hist).expect("serialises"));
        return;
    }

    if hist.commits.is_empty() {
        println!("no history here — nothing to replay");
        return;
    }

    // Replayed rather than trusted: the frames are deltas, and the only honest way to
    // report a total is to apply them, which is exactly what the frontend does.
    let mut live: HashMap<u32, u32> = hist.base.iter().copied().collect();
    let mut peak = 0usize;
    for c in &hist.commits {
        for (f, loc) in &c.set {
            live.insert(*f, *loc);
        }
        for f in &c.del {
            live.remove(f);
        }
        peak = peak.max(live.len());
    }
    let lines: u32 = live.values().sum();

    println!("{}", path.display());
    println!(
        "  {} commits replayed{}, in {:.1}s",
        hist.commits.len(),
        if hist.truncated > 0 {
            format!(" ({} older folded into the opening frame)", hist.truncated)
        } else {
            String::new()
        },
        elapsed.as_secs_f32(),
    );
    println!(
        "  {} files, {} functions ever, {} alive at HEAD ({} lines), peak {}",
        hist.paths.len(),
        hist.funcs.len(),
        live.len(),
        lines,
        peak,
    );

    if files {
        // Per file, so the total can be reconciled against `just scan` on the same repo.
        // The two disagree legitimately — the scan honors .gitignore and skips hidden
        // directories, git has opinions about neither — and this is where that shows.
        let mut per: HashMap<u32, (usize, u32)> = HashMap::new();
        for (f, loc) in &live {
            let e = per.entry(hist.funcs[*f as usize].path).or_default();
            e.0 += 1;
            e.1 += loc;
        }
        let mut rows: Vec<(&String, usize, u32)> = per
            .iter()
            .map(|(p, (n, l))| (&hist.paths[*p as usize], *n, *l))
            .collect();
        rows.sort_by_key(|(_, n, _)| std::cmp::Reverse(*n));
        println!("\n  functions alive at HEAD, by file");
        for (path, n, l) in rows {
            println!("    {n:>4}  {l:>6}L  {path}");
        }
    }

    println!("\n  busiest commits");
    let mut busy: Vec<&history::HistoryCommit> = hist.commits.iter().collect();
    busy.sort_by_key(|c| std::cmp::Reverse(c.set.len() + c.del.len()));
    for c in busy.iter().take(8) {
        println!(
            "    {}  +{:<4} -{:<4} {:<3} files  {}",
            c.short,
            c.set.len(),
            c.del.len(),
            c.files.len(),
            c.subject.chars().take(56).collect::<String>(),
        );
    }
}
