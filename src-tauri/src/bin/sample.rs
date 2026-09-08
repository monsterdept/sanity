//! `just sample <repo> <out> [n]` — cut N functions out of a repo as prediction exercises.
//!
//! For measuring the READER rather than the repo. The queue hands each function to one
//! reader and keeps one reading, which is right for building a map and useless for asking
//! whether two readers agree — so this writes the same handout to disk, where it can be
//! given to as many readers as the question needs and their answers compared.
//!
//! It deliberately does not go through `sanity_report` or `.sanity/`. A validation run is
//! not an assessment: it must not lease work, must not bank readings, and must not be
//! distinguishable afterwards from the real thing by anyone reading the store. Keeping it
//! outside is cheaper than keeping it straight.
//!
//! **Sampling is by stride, not randomness.** Every `total/n`-th function in scan order,
//! so the same repo at the same commit yields the same exercise every time and a rerun
//! measures a change in the readers rather than a change in the draw.

use sanity_lib::agentapi;
use sanity_lib::scan;
use sanity_lib::surprise::HeuristicModel;
use std::path::PathBuf;

fn main() {
    let mut args = std::env::args().skip(1);
    let repo = PathBuf::from(args.next().unwrap_or_else(|| ".".into()));
    let out = PathBuf::from(args.next().unwrap_or_else(|| "sample".into()));
    let want: usize = args.next().and_then(|s| s.parse().ok()).unwrap_or(10);

    let memos = sanity_lib::scan::Memos::ephemeral();
    let scanned = match scan::scan(
        &repo,
        &HeuristicModel,
        &|_| {},
        &|_, _: &sanity_lib::surprise::Reading| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        // Both memos ephemeral: a headless run that answers from a file on disk is not a
        // run of the thing being measured. Same rule `just history` follows.
        sanity_lib::scan::Memos { scores: &memos.0, scans: &memos.1 },
        // The scores are never used here — only the handout is — so the all-pairs term
        // would be thirty seconds spent on a number this tool does not print.
        sanity_lib::scan::Fidelity::Ordering,
        sanity_lib::trace::Depth::Lines,
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(1);
        }
    };

    let tasks = agentapi::all_tasks(&scanned, &repo);
    if tasks.is_empty() {
        eprintln!("no functions found");
        std::process::exit(1);
    }
    let stride = (tasks.len() / want).max(1);

    std::fs::create_dir_all(&out).expect("create output directory");
    let mut written = 0;
    for t in tasks.iter().step_by(stride).take(want) {
        // The body is sliced from the file as it is now, by the same bounds a reader would
        // be told to open. If those have drifted the exercise is wrong in exactly the way
        // a real reading would have been, which is worth preserving rather than papering
        // over — run `sanity_open` first if the tree is stale.
        let Ok(src) = std::fs::read_to_string(repo.join(&t.path)) else {
            continue;
        };
        let lines: Vec<&str> = src.lines().collect();
        let (from, to) = (t.line as usize, t.end_line as usize);
        if from == 0 || to > lines.len() || from > to {
            continue;
        }
        let body = lines[from - 1..to].join("\n");

        let owner = t.owner.as_deref().unwrap_or("—");
        let docs = if t.docs.is_empty() { "(none)".to_string() } else { t.docs.join("\n\n") };
        let peers = if t.peers.is_empty() {
            "(none)".to_string()
        } else {
            format!(
                "{}{}",
                t.peers.join(", "),
                if t.peers_omitted > 0 {
                    format!(" … and {} more in this file", t.peers_omitted)
                } else {
                    String::new()
                }
            )
        };

        written += 1;
        let head = format!(
            "# {}\n\nowner: {owner}\nfile: {}\nlines: {}\n\n## signature\n\n```\n{}\n```\n\n## docs\n\n{docs}\n\n## other functions in this file\n\n{peers}\n",
            t.name, t.path, t.lines, t.signature,
        );
        std::fs::write(out.join(format!("{written:02}_head.md")), head).expect("write head");
        std::fs::write(out.join(format!("{written:02}_body.txt")), body).expect("write body");
    }

    println!(
        "{written} exercises from {} functions in {} → {}",
        tasks.len(),
        repo.display(),
        out.display()
    );
    println!("each is NN_head.md (what a reader is given) and NN_body.txt (what it predicts)");
}
