//! `just scan <path>` — the headless scorer.
//!
//! This exists before the UI does, and it is the only thing that can answer the question
//! the whole product depends on: **does the surprise score separate anything real on a
//! repo you already know?** If the hottest wedges below aren't the ones you'd have named
//! yourself, the metric is wrong and no amount of sunburst polish saves it. Run it
//! against something you wrote and read the list.

use sanity_lib::model::{Node, NodeKind, Quadrant};
use sanity_lib::scan;
use sanity_lib::surprise::{HeuristicModel, OllamaModel, SurpriseModel};
use std::path::PathBuf;

/// Functions shorter than this keep their proxy score when a model is in play. See
/// `OllamaModel::min_lines` — this is a cost gate, and at tens of seconds per call it is
/// the difference between a scan of minutes and one of hours.
const DEFAULT_MIN_LINES: usize = 25;

fn main() {
    let mut args = std::env::args().skip(1);
    let mut path = PathBuf::from(".");
    let mut use_ollama = false;
    let mut model_name = "devstral-small-2:24b".to_string();
    let mut endpoint = std::env::var("SANITY_OLLAMA_ENDPOINT")
        .unwrap_or_else(|_| "http://127.0.0.1:11434".to_string());
    let mut min_lines = DEFAULT_MIN_LINES;
    let mut local: Option<PathBuf> = None;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--ollama" => use_ollama = true,
            "--model" => {
                if let Some(m) = args.next() {
                    model_name = m;
                    use_ollama = true;
                }
            }
            "--endpoint" => {
                if let Some(e) = args.next() {
                    endpoint = e;
                    use_ollama = true;
                }
            }
            "--local" => {
                if let Some(p) = args.next() {
                    local = Some(PathBuf::from(p));
                }
            }
            "--min-lines" => {
                if let Some(n) = args.next().and_then(|n| n.parse().ok()) {
                    min_lines = n;
                }
            }
            "-h" | "--help" => {
                eprintln!(
                    "usage: sanity-scan [PATH] [--ollama] [--model NAME] \\\n\
                     \x20            [--endpoint URL] [--min-lines N]\n\n\
                     \x20 --min-lines  only send functions at least this long to the model\n\
                     \x20              (default {DEFAULT_MIN_LINES}); shorter ones keep their proxy score.\n\
                     \x20 SANITY_OLLAMA_ENDPOINT sets the default endpoint."
                );
                return;
            }
            other => path = PathBuf::from(other),
        }
    }

    #[cfg(feature = "local-model")]
    let local_model = local.as_ref().map(|p| {
        sanity_lib::local::LocalModel::load(p).unwrap_or_else(|e| {
            eprintln!("error: could not load {}: {e}", p.display());
            std::process::exit(1);
        })
    });
    #[cfg(not(feature = "local-model"))]
    let local_model: Option<()> = local.as_ref().map(|_| {
        eprintln!("error: rebuild with --features local-metal (or local-vulkan) for --local");
        std::process::exit(1);
    });

    #[cfg(feature = "local-model")]
    let model: Box<dyn SurpriseModel> = if let Some(m) = local_model {
        eprintln!("scoring locally with {}", m.label());
        Box::new(m)
    } else if use_ollama {
        let m = OllamaModel::new(&endpoint, &model_name, min_lines);
        if m.available() {
            eprintln!("scoring with {model_name} at {endpoint} (functions >= {min_lines} lines)");
            Box::new(m)
        } else {
            eprintln!("note: nothing answering at {endpoint} — using the offline proxy");
            Box::new(HeuristicModel)
        }
    } else {
        Box::new(HeuristicModel)
    };

    #[cfg(not(feature = "local-model"))]
    let model: Box<dyn SurpriseModel> = {
        let _ = &local_model;
        if use_ollama {
            let m = OllamaModel::new(&endpoint, &model_name, min_lines);
            if m.available() {
                Box::new(m)
            } else {
                Box::new(HeuristicModel)
            }
        } else {
            Box::new(HeuristicModel)
        }
    };

    let scanned = match scan::scan(
        &path,
        model.as_ref(),
        &|_| {},
        &|_, _: &sanity_lib::surprise::Reading| {},
        &std::sync::atomic::AtomicBool::new(false),
        // Ephemeral: the headless scanner is how the metric gets measured, and a run
        // that silently reuses yesterday's scores is not a measurement.
        &sanity_lib::cache::Cache::ephemeral(),
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    };

    let mut funcs: Vec<&Node> = Vec::new();
    scanned.root.visit(&mut |n| {
        if n.kind == NodeKind::Func {
            funcs.push(n);
        }
    });

    println!(
        "{} — {} files, {} functions, {} lines · {}",
        path.display(),
        scanned.stats.files_scanned,
        scanned.stats.functions,
        scanned.root.loc,
        scanned.stats.model,
    );
    if scanned.stats.without_history {
        // Never let a half-verdict pass as a whole one.
        println!("  no git history: the stability axis is off, so every quadrant is a guess");
    }
    if funcs.is_empty() {
        println!("  nothing parseable here");
        return;
    }

    // The headline number. Not "how much code do you have" — how much of it is
    // surprise, which is the only quantity this tool claims to measure.
    let hot_lines: u32 = funcs
        .iter()
        .filter(|n| n.score.is_some_and(|s| s.temperature() > 0.5))
        .map(|n| n.loc)
        .sum();
    println!(
        "  {:.0}% of lines are hot",
        100.0 * hot_lines as f32 / scanned.root.loc.max(1) as f32
    );

    histogram(&funcs);
    baseline_check(&mut funcs.clone());

    // Ranked by temperature × lines, not temperature alone.
    //
    // Temperature is an intensity — surprise *per line* — and a seven-line function can
    // legitimately max it out. But the question this list answers is "where is my
    // attention owed", and that is intensity times how much of it there is. It is also
    // what the sunburst does: the eye reads area × colour, so a list ordered on colour
    // alone disagrees with the picture it is supposed to explain.
    section("HOTTEST — surprising and nothing explains why", &mut funcs, |n| {
        n.score.map_or(0.0, |s| s.temperature() * n.loc as f32)
    });
    section("BULKIEST PREDICTABLE — lines that decide nothing", &mut funcs, |n| {
        n.score
            .filter(|s| s.quadrant(n.loc) == Quadrant::Bloat)
            .map_or(0.0, |_| n.loc as f32)
    });
}

/// The calibration check, and the first thing to look at.
///
/// A healthy repo shows a spread with a long cold tail and a thin hot end. If every
/// bucket is full, or everything piles into one, the metric is measuring nothing and the
/// rankings below are decoration. Printing it is not a debug aid — it is the evidence
/// that the picture means anything at all.
fn histogram(funcs: &[&Node]) {
    let mut buckets = [0usize; 10];
    for n in funcs {
        let t = n.score.map_or(0.0, |s| s.temperature());
        buckets[((t * 10.0) as usize).min(9)] += 1;
    }
    let peak = buckets.iter().copied().max().unwrap_or(1).max(1);
    println!("\nTEMPERATURE SPREAD");
    for (i, count) in buckets.iter().enumerate() {
        let bar = "█".repeat((count * 34 / peak).max(usize::from(*count > 0)));
        println!("  {:>3}-{:<3} {:<34} {}", i * 10, i * 10 + 10, bar, count);
    }
}

/// Does the metric beat sorting by size?
///
/// The hard question, and the one easiest to avoid asking. Every ranking sanity prints is
/// temperature × lines, and big functions are where the thinking usually is — so a metric
/// that contributes *nothing* would still produce a plausible-looking list, carried
/// entirely by the LOC term. This prints the overlap between the real ranking and a dumb
/// sort by line count.
///
/// High overlap is a verdict on the metric, not a curiosity: it means the colour is
/// decoration and the user could get the same answer from `wc -l`. Sanity's whole claim
/// is that size is the boring axis, so this number is the claim's own falsification test
/// and it belongs in the default output where it cannot be quietly skipped.
fn baseline_check(funcs: &mut [&Node]) {
    const N: usize = 15;
    if funcs.len() < N {
        return;
    }
    let top = |rank: &dyn Fn(&Node) -> f32, funcs: &mut [&Node]| -> Vec<String> {
        funcs.sort_by(|a, b| {
            rank(b)
                .partial_cmp(&rank(a))
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        funcs.iter().take(N).map(|n| n.id.clone()).collect()
    };

    let by_metric = top(&|n: &Node| n.score.map_or(0.0, |s| s.temperature() * n.loc as f32), funcs);
    let by_size = top(&|n: &Node| n.loc as f32, funcs);
    let shared = by_metric.iter().filter(|id| by_size.contains(id)).count();

    println!(
        "\nBASELINE  top-{N} by metric vs top-{N} by raw line count: {shared}/{N} the same"
    );
    println!(
        "  {}",
        match shared {
            0..=6 => "the metric is finding things size alone does not",
            7..=11 => "partly size — the colour is doing some work",
            _ => "SIZE IS DOING THE WORK: this ranking is `wc -l` with extra steps",
        }
    );
}

fn section(title: &str, funcs: &mut [&Node], rank: impl Fn(&Node) -> f32) {
    funcs.sort_by(|a, b| {
        rank(b)
            .partial_cmp(&rank(a))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    println!("\n{title}");
    for n in funcs.iter().take(15).filter(|n| rank(n) > 0.0) {
        let s = n.score.unwrap_or_else(|| unreachable!("ranked nodes are scored"));
        println!(
            "  {:>4.0}°  {:<28} {:>4}L  {:<11} {}:{}",
            s.temperature() * 100.0,
            truncate(&n.name, 28),
            n.loc,
            quadrant_label(s.quadrant(n.loc)),
            n.path,
            n.line.unwrap_or(0),
        );
    }
}

fn quadrant_label(q: Quadrant) -> &'static str {
    match q {
        Quadrant::CrownJewel => "crown-jewel",
        Quadrant::Trouble => "trouble",
        Quadrant::Bloat => "bloat",
        Quadrant::Quiet => "quiet",
    }
}

fn truncate(s: &str, n: usize) -> String {
    if s.chars().count() <= n {
        s.to_string()
    } else {
        // Character-wise, not byte-wise: identifiers are UTF-8 and slicing mid-codepoint
        // panics rather than printing a short name.
        s.chars().take(n - 1).collect::<String>() + "…"
    }
}
