//! `just scan <path>` — the headless scorer.
//!
//! This exists before the UI does, and it is the only thing that can answer the question
//! the whole product depends on: **does the surprise score separate anything real on a
//! repo you already know?** If the hottest wedges below aren't the ones you'd have named
//! yourself, the metric is wrong and no amount of sunburst polish saves it. Run it
//! against something you wrote and read the list.

use sanity_lib::model::{Node, NodeKind, Quadrant};
use sanity_lib::scan;
use sanity_lib::surprise::{HeuristicModel, SurpriseModel};
use std::path::PathBuf;

fn main() {
    let mut args = std::env::args().skip(1);
    let mut path = PathBuf::from(".");
    let mut local: Option<PathBuf> = None;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--local" => {
                if let Some(p) = args.next() {
                    local = Some(PathBuf::from(p));
                }
            }
            "-h" | "--help" => {
                eprintln!(
                    "usage: sanity-scan [PATH] [--local WEIGHTS]\n\n\
                     \x20 --local  score with a local model (needs --features local-metal\n\
                     \x20          or local-vulkan); otherwise the offline proxy runs."
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
    } else {
        Box::new(HeuristicModel)
    };

    #[cfg(not(feature = "local-model"))]
    let model: Box<dyn SurpriseModel> = {
        let _ = &local_model;
        Box::new(HeuristicModel)
    };

    let memos = sanity_lib::scan::Memos::ephemeral();
    let scanned = match scan::scan(
        &path,
        model.as_ref(),
        &|_| {},
        &|_, _: &sanity_lib::surprise::Reading| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        // Ephemeral: the headless scanner is how the metric gets measured, and a run
        // that silently reuses yesterday's scores is not a measurement.
        // Both memos ephemeral: a headless run that answers from a file on disk is not a
        // run of the thing being measured. Same rule `just history` follows.
        sanity_lib::scan::Memos { scores: &memos.0, scans: &memos.1 },
        // Full, always. This is where the metric gets measured, and the all-pairs term is
        // the strongest one in the mix — a histogram read off a scan that skipped it would
        // be a measurement of a different instrument.
        sanity_lib::scan::Fidelity::Full,
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
    wiring(&funcs, &scanned.stats);
    copies(&funcs);
    baseline_check(&mut funcs.clone());

    // Ranked by temperature × lines, not temperature alone.
    //
    // Temperature is an intensity — surprise *per line* — and a seven-line function can
    // legitimately max it out. But the question this list answers is "where is my
    // attention owed", and that is intensity times how much of it there is. It is also
    // what the sunburst does: the eye reads area × color, so a list ordered on color
    // alone disagrees with the picture it is supposed to explain.
    section("HOTTEST — surprising and nothing explains why", &mut funcs, |n| {
        n.score.map_or(0.0, |s| s.temperature() * n.loc as f32)
    });
    section("BULKIEST PREDICTABLE — lines that decide nothing", &mut funcs, |n| {
        n.score.filter(|s| s.quadrant(n.loc) == Quadrant::Bloat).map_or(0.0, |_| n.loc as f32)
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

/// What the call graph found, before anybody is asked to trust a color made out of it.
///
/// **The null model for the Reach and Locality lenses, and the reason to print it rather
/// than to reason about it.** Both lenses turn a count into a ramp, and a ramp is a claim
/// about how the quantity is distributed in real code. `calibrate`'s own doc makes the
/// argument for surprise — "a flat or saturated spread means the metric is measuring nothing
/// and the rankings are decoration" — and nothing about call counts exempts them.
///
/// Three numbers decide whether the lenses are worth looking at on a given repo, and every
/// one of them is a way for this to be USELESS rather than merely imprecise:
///
/// - **Coverage.** Functions in a language whose calls resolve at all. A repo that is 90%
///   Fortran gets two gray lenses, and the honest thing is to say so up front rather than to
///   let somebody read gray as calm.
/// - **Resolution.** The share of call sites that reached a definition in this repo. Most
///   calls in any real file go to the standard library or a dependency, so this is naturally
///   low — but a repo at 2% means the family rule or the grammar is wrong, and the ranking
///   below is noise.
/// - **Unreferenced.** The share of resolvable functions nothing in the repo calls. This is
///   the finding the Reach lens exists for, and it is also the number most likely to be
///   misread: a library's public surface is unreferenced BY ITS OWN REPO and entirely
///   healthy, while the same figure in a freshly generated application is dead code.
fn wiring(funcs: &[&Node], stats: &sanity_lib::scan::ScanStats) {
    let resolvable: Vec<&&Node> = funcs.iter().filter(|n| n.callers.is_some()).collect();
    println!("\nWIRING");
    if resolvable.is_empty() {
        println!("  no language here has a call shape sanity has read — both lenses are gray");
        return;
    }
    let sites = stats.calls_resolved + stats.calls_unresolved;
    println!(
        "  {} of {} call sites reached a definition in this repo ({:.0}%)",
        stats.calls_resolved,
        sites,
        100.0 * stats.calls_resolved as f32 / sites.max(1) as f32,
    );
    let orphans = resolvable.iter().filter(|n| n.callers == Some(0)).count();
    println!(
        "  {} of {} functions in a language whose calls resolve ({:.0}%)",
        resolvable.len(),
        funcs.len(),
        100.0 * resolvable.len() as f32 / funcs.len().max(1) as f32,
    );
    println!(
        "  {orphans} of those are called by nothing in this repo ({:.0}%)",
        100.0 * orphans as f32 / resolvable.len().max(1) as f32,
    );

    // Caller counts, in the bands the lens has to tell apart. Bands rather than deciles
    // because the distribution is expected to be a power law, and ten equal slices of a
    // power law are one full bucket and nine empty ones.
    let bands: [(&str, u32, u32); 6] = [
        ("0", 0, 0),
        ("1", 1, 1),
        ("2", 2, 2),
        ("3-5", 3, 5),
        ("6-15", 6, 15),
        ("16+", 16, u32::MAX),
    ];
    let peak = bands
        .iter()
        .map(|(_, lo, hi)| {
            resolvable.iter().filter(|n| (*lo..=*hi).contains(&n.callers.unwrap())).count()
        })
        .max()
        .unwrap_or(1)
        .max(1);
    println!("  callers");
    for (label, lo, hi) in bands {
        let c = resolvable.iter().filter(|n| (lo..=hi).contains(&n.callers.unwrap())).count();
        println!(
            "    {:>5} {:<30} {}",
            label,
            "\u{2588}".repeat((c * 30 / peak).max(usize::from(c > 0))),
            c
        );
    }

    // Locality, over the functions that have any wiring at all. Deciles here because a share
    // is bounded and its shape is the open question — if this is flat the lens is a ranking,
    // if it piles at one end it is a constant wearing a ramp.
    let wired: Vec<f32> = resolvable
        .iter()
        .filter_map(|n| sanity_lib::edges::locality_gap(n.away, n.incident))
        .collect();
    if wired.is_empty() {
        println!("  nothing is wired to anything — Locality has nothing to draw");
        return;
    }
    let mut deciles = [0usize; 10];
    for v in &wired {
        deciles[((v * 10.0) as usize).min(9)] += 1;
    }
    let peak = deciles.iter().copied().max().unwrap_or(1).max(1);
    println!("  calls leaving their own directory, per function ({} wired)", wired.len());
    for (i, c) in deciles.iter().enumerate() {
        println!(
            "    {:>3}-{:<3} {:<30} {}",
            i * 10,
            i * 10 + 10,
            "\u{2588}".repeat((c * 30 / peak).max(usize::from(*c > 0))),
            c
        );
    }
}

/// What the Clones lens has to draw, and whether the floor is in the right place.
///
/// Group sizes rather than a count of cloned functions: one 40-way group and forty pairs are
/// very different repos and a single number says the same thing about both. Read this before
/// touching [`sanity_lib::parse::MIN_SHAPE_TOKENS`] — the failure it guards against shows up
/// here as a huge group of tiny bodies, and the failure of setting it too high shows up as
/// nothing at all.
fn copies(funcs: &[&Node]) {
    let comparable = funcs.iter().filter(|n| n.comparable == Some(1)).count();
    println!("\nCOPIES");
    if comparable == 0 {
        println!("  nothing here clears the {}-token floor", sanity_lib::parse::MIN_SHAPE_TOKENS);
        return;
    }
    let cloned = funcs.iter().filter(|n| n.copied == Some(1)).count();
    println!(
        "  {} of {} functions are big enough to compare ({:.0}%)",
        comparable,
        funcs.len(),
        100.0 * comparable as f32 / funcs.len().max(1) as f32,
    );
    println!(
        "  {cloned} of those share a body with another ({:.0}%)",
        100.0 * cloned as f32 / comparable.max(1) as f32,
    );

    let mut sizes: std::collections::HashMap<u32, u32> = std::collections::HashMap::new();
    for n in funcs.iter().filter(|n| n.clone_size.is_some()) {
        let (Some(g), Some(s)) = (n.clone_group, n.clone_size) else { continue };
        sizes.insert(g, s);
    }
    if sizes.is_empty() {
        return;
    }
    let bands: [(&str, u32, u32); 4] =
        [("2", 2, 2), ("3-5", 3, 5), ("6-15", 6, 15), ("16+", 16, u32::MAX)];
    let peak = bands
        .iter()
        .map(|(_, lo, hi)| sizes.values().filter(|s| (*lo..=*hi).contains(s)).count())
        .max()
        .unwrap_or(1)
        .max(1);
    println!("  groups, by how many share the body ({} groups)", sizes.len());
    for (label, lo, hi) in bands {
        let c = sizes.values().filter(|s| (lo..=hi).contains(s)).count();
        println!(
            "    {:>5} {:<30} {}",
            label,
            "\u{2588}".repeat((c * 30 / peak).max(usize::from(c > 0))),
            c
        );
    }
    let mut biggest: Vec<(&u32, &u32)> = sizes.iter().collect();
    biggest.sort_by_key(|(_, s)| std::cmp::Reverse(**s));
    if let Some((g, s)) = biggest.first() {
        let member = funcs
            .iter()
            .find(|n| n.clone_group == Some(**g))
            .map(|n| format!("{} ({})", n.name, n.path))
            .unwrap_or_default();
        println!("  biggest group: {s} copies of {member}");
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
/// High overlap is a verdict on the metric, not a curiosity: it means the color is
/// decoration and the user could get the same answer from `wc -l`. Sanity's whole claim
/// is that size is the boring axis, so this number is the claim's own falsification test
/// and it belongs in the default output where it cannot be quietly skipped.
fn baseline_check(funcs: &mut [&Node]) {
    const N: usize = 15;
    if funcs.len() < N {
        return;
    }
    let top = |rank: &dyn Fn(&Node) -> f32, funcs: &mut [&Node]| -> Vec<String> {
        funcs.sort_by(|a, b| rank(b).partial_cmp(&rank(a)).unwrap_or(std::cmp::Ordering::Equal));
        funcs.iter().take(N).map(|n| n.id.clone()).collect()
    };

    let by_metric = top(&|n: &Node| n.score.map_or(0.0, |s| s.temperature() * n.loc as f32), funcs);
    let by_size = top(&|n: &Node| n.loc as f32, funcs);
    let shared = by_metric.iter().filter(|id| by_size.contains(id)).count();

    println!("\nBASELINE  top-{N} by metric vs top-{N} by raw line count: {shared}/{N} the same");
    println!(
        "  {}",
        match shared {
            0..=6 => "the metric is finding things size alone does not",
            7..=11 => "partly size — the color is doing some work",
            _ => "SIZE IS DOING THE WORK: this ranking is `wc -l` with extra steps",
        }
    );
}

fn section(title: &str, funcs: &mut [&Node], rank: impl Fn(&Node) -> f32) {
    funcs.sort_by(|a, b| rank(b).partial_cmp(&rank(a)).unwrap_or(std::cmp::Ordering::Equal));
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
