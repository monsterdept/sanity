//! `just tokens <path>` — what a reader actually pays, in bytes we control.
//!
//! One function per reader made the protocol honest and made a cost visible that batching
//! had been hiding. A reader used to amortise its fixed prefix — the tool contract and the
//! subagent prompt — across ten readings; now it pays the whole thing for one. So the
//! length of an `inputSchema` description stopped being editorial and became a per-reading
//! charge, multiplied by however many functions the repo has.
//!
//! That is an argument nobody should have twice from memory, which is the same reason
//! `just scan` prints a histogram. This weighs the real artifacts — `mcp::tools()`,
//! `agentapi::PROTOCOL`, and the actual task payloads for a real repo — rather than a copy
//! of them, because a copy is a second contract and this repo has already paid for one of
//! those.
//!
//! **These are estimates.** Tokens are counted at a flat [`CHARS_PER_TOKEN`], which is
//! about right for English prose and runs light on JSON and code. Read the ratios and the
//! shape; do not quote the absolute numbers to two significant figures. What the tool is
//! good for is before-and-after: shorten a description, run it again, see what it bought.

use sanity_lib::agentapi;
use sanity_lib::scan;
use sanity_lib::surprise::HeuristicModel;
use std::path::PathBuf;

/// Crude on purpose, and stated rather than hidden.
///
/// A real tokenizer would be a dependency and a model-specific answer; the question here
/// is "is this 5% of a reading or 40%", and four characters answers that. It understates
/// JSON and code, which both tokenize worse than prose — so the payload numbers below are
/// a floor, and the fixed prefix (mostly prose) is the most accurate figure on the page.
const CHARS_PER_TOKEN: usize = 4;

fn tok(chars: usize) -> usize {
    chars / CHARS_PER_TOKEN
}

fn row(label: &str, chars: usize) {
    println!("  {label:<34} {chars:>8} ch  ~{:>7} tok", tok(chars));
}

fn pct(sorted: &[usize], p: f64) -> usize {
    if sorted.is_empty() {
        return 0;
    }
    let i = ((sorted.len() - 1) as f64 * p).round() as usize;
    sorted[i]
}

/// A number a person can hold: 39_300_000 → "39.3M".
fn big(n: usize) -> String {
    match n {
        n if n >= 1_000_000 => format!("{:.1}M", n as f64 / 1e6),
        n if n >= 1_000 => format!("{:.1}k", n as f64 / 1e3),
        n => n.to_string(),
    }
}

fn main() {
    let path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    // ── The fixed prefix: what every reader loads before it sees any code ──────────

    let tools = sanity_lib::mcp::tools();
    let tools_json = serde_json::to_string(&tools).unwrap_or_default();

    // Two constants, not one string searched for a heading. The first version of this
    // located the boundary by looking for "SUBAGENT PROMPT:", the heading was reworded an
    // hour later, and the tool silently charged every reader for the orchestrator's half
    // as well. A measurement that can be broken by an edit somewhere else is not one.
    let protocol = agentapi::PROTOCOL;
    let subagent = agentapi::READER_PROMPT;

    println!("\nMCP TOKEN BUDGET — {}", path.display());
    println!(
        "  estimated at {CHARS_PER_TOKEN} chars/token — read the ratios, not the digits\n"
    );

    println!("PER READER, FIXED — loaded by every subagent before it reads anything.");
    println!("  Identical across readers, so it should cache; if it does not, this is");
    println!("  the whole bill multiplied by the function count.");
    if let Some(list) = tools.as_array() {
        for t in list {
            let name = t.get("name").and_then(|v| v.as_str()).unwrap_or("?");
            let n = serde_json::to_string(t).map(|s| s.len()).unwrap_or(0);
            // A reader only ever calls two of these. The rest are loaded anyway — the
            // tool list is per connection, not per role — so they are dead weight in
            // every reader's context and worth seeing priced separately.
            let used = matches!(name, "sanity_next" | "sanity_report");
            row(
                &format!("{name:<16} {}", if used { "" } else { "· never called" }),
                n,
            );
        }
    }
    row("tools/list, whole", tools_json.len());
    row("subagent prompt", subagent.len());
    let fixed = tools_json.len() + subagent.len();
    println!("  {:-<34} {:->8}     {:->7}", "", "", "");
    row("FIXED PREFIX", fixed);

    println!("\n  For the orchestrator only, once per run:");
    row("protocol (whole)", protocol.len());

    // ── The variable part: the payload this repo would actually hand out ───────────

    println!("\nscanning {} …", path.display());
    let memos = sanity_lib::scan::Memos::ephemeral();
    let scanned = match scan::scan(
        &path,
        &HeuristicModel,
        &|_| {},
        &|_, _: &sanity_lib::surprise::Reading| {},
        &std::sync::atomic::AtomicBool::new(false),
        // Both memos ephemeral: a headless run that answers from a file on disk is not a
        // run of the thing being measured. Same rule `just history` follows.
        sanity_lib::scan::Memos { scores: &memos.0, scans: &memos.1 },
        // Ordering fidelity: the all-pairs term changes the SCORES, and this tool weighs
        // payloads. Skipping it costs nothing here and makes a large repo finish.
        sanity_lib::scan::Fidelity::Ordering,
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    };

    let tasks = agentapi::all_tasks(&scanned, &path);
    if tasks.is_empty() {
        eprintln!("no functions found — nothing to weigh");
        return;
    }

    let mut whole: Vec<usize> = Vec::with_capacity(tasks.len());
    let mut peers: Vec<usize> = Vec::with_capacity(tasks.len());
    let mut docs: Vec<usize> = Vec::with_capacity(tasks.len());
    let mut sigs: Vec<usize> = Vec::with_capacity(tasks.len());
    let mut lines: Vec<usize> = Vec::with_capacity(tasks.len());
    for t in &tasks {
        whole.push(serde_json::to_string(t).map(|s| s.len()).unwrap_or(0));
        peers.push(t.peers.iter().map(|p| p.len() + 3).sum());
        docs.push(t.docs.iter().map(|d| d.len()).sum());
        sigs.push(t.signature.len());
        lines.push(t.lines as usize);
    }
    for v in [&mut whole, &mut peers, &mut docs, &mut sigs, &mut lines] {
        v.sort_unstable();
    }

    println!("\nPER FUNCTION — the payload this repo would hand over.");
    println!("  {:<20} {:>9} {:>9} {:>9}", "", "median", "p90", "max");
    let dist = |label: &str, v: &[usize], unit: &str| {
        println!(
            "  {label:<20} {:>7}{unit} {:>7}{unit} {:>7}{unit}",
            pct(v, 0.5),
            pct(v, 0.9),
            pct(v, 1.0)
        );
    };
    dist("task JSON", &whole, "ch");
    dist("  of which peers", &peers, "ch");
    dist("  of which docs", &docs, "ch");
    dist("  of which signature", &sigs, "ch");
    dist("body to read", &lines, "ln");

    // The body is the one part of the bill that is the actual subject of the exercise.
    // Estimated from lines rather than measured, because the scan keeps a hash of each
    // body and not the text — deliberately, and not worth undoing for this.
    const CHARS_PER_LINE: usize = 38;
    let body_chars: usize = lines.iter().map(|l| l * CHARS_PER_LINE).sum();
    let payload_chars: usize = whole.iter().sum();

    println!("\nWHOLE-REPO PROJECTION — {} functions, one reader each.", tasks.len());
    let n = tasks.len();
    let prefix_total = tok(fixed) * n;
    let payload_total = tok(payload_chars);
    let body_total = tok(body_chars);
    let all = (prefix_total + payload_total + body_total) as f64;
    let line = |label: String, v: usize| {
        println!("  {label:<26} {:>8} tok  {:>4.0}%", big(v), 100.0 * v as f64 / all);
    };
    line(format!("fixed prefix × {n}"), prefix_total);
    line("task payloads".into(), payload_total);
    line(format!("bodies (at {CHARS_PER_LINE} ch/line)"), body_total);
    println!("  {:-<26} {:->8}", "", "");
    line("input, once through".into(), prefix_total + payload_total + body_total);
    println!(
        "\n  A reader takes several turns, and every turn re-sends everything before it,\n  \
         so the real bill is a multiple of this — call it 3-4x. What this measures is\n  \
         the FLOOR, and which part of the floor is ours to shrink.\n"
    );

    // The point of the exercise, stated rather than left to be inferred.
    let unused: usize = tools
        .as_array()
        .map(|l| {
            l.iter()
                .filter(|t| {
                    !matches!(
                        t.get("name").and_then(|v| v.as_str()),
                        Some("sanity_next") | Some("sanity_report")
                    )
                })
                .map(|t| serde_json::to_string(t).map(|s| s.len()).unwrap_or(0))
                .sum()
        })
        .unwrap_or(0);
    println!(
        "  Of the fixed prefix, {} tok is tool descriptions a reader never calls —\n  \
         {} tok across the repo. That is ours to cut without touching the contract\n  \
         a reader is actually held to.\n",
        tok(unused),
        big(tok(unused) * n)
    );
}
