//! The headless half — `sanity serve`, `sanity check`, and the read-only verbs.
//!
//! Sanity's backend was reachable only by opening a window, which was never a design
//! position: the state ended up in the app's process because the app was written first,
//! and `Project.leased` and the warm scan happened to live where the pixels did. Nothing
//! about the instrument wants that. An agent assessing a repo needs a coordinator, not a
//! picture.
//!
//! Three properties hold this together, and each one is doing real work:
//!
//! - **The backend is per machine, not per project.** One endpoint file, one process,
//!   a map of projects, and every call routed by the caller's key through `for_client`.
//!   That was already true — it is what `active_project()` was deleted for — so `sanity
//!   check` in a second repo is just another client, not a second server.
//! - **The daemon holds nothing precious.** The scan is recomputed, the readings are in
//!   `.sanity/`, and a lost lease re-queues by design. So it can be killed at any moment,
//!   which is why the lifecycle here is allowed to be blunt: idle out, or stand down when
//!   superseded. There is no `sanity stop`, because nothing needs stopping cleanly.
//! - **There is still no model path in the app.** Sanity spawns coding agents that are
//!   already installed and authenticated; it does not run inference. What `OllamaModel` was
//!   deleted to avoid was configuring an ENDPOINT, and none of this configures one.
//!
//! **Not every verb talks to that backend.** `status`, `check` and `trace` ask it, because
//! they report or change what it is holding — what is out with readers this second, the
//! depth the open map is traced to. `findings`, `callers`, `decide` and `refresh` scan
//! in-process instead: what they answer is the tree, the readings in `.sanity/` and the rules
//! beside them, all on disk, and an answer that depended on whether the app happened to be
//! open would be two answers. See `survey`.
//!
//! **`sanity study` used to live here and is gone.** It opened a repo and printed a
//! sentence to paste at an agent, from the design where the agent WAS the reader. The role
//! split ended that: a session with no `SANITY_ROLE` gets the human tools — open, check,
//! status, summary — and cannot call `next`, `reveal` or `report` at all. So the sentence
//! asked an agent to do something it has no tools for, and the three paragraphs of priming
//! warning underneath guarded a door that is now bricked up. Registering a repo is `init`,
//! and `--show` moved there with it.
//!
//! # Where each verb lives
//!
//! This file is the command line as clap sees it, the dispatch, `sanity .` opening a repo in
//! the window, and the few helpers every verb prints with. The verbs are beside it:
//!
//! - **backend** — finding, starting and retiring the backend, and `serve` itself.
//! - **init** — which agent and which model read this repo.
//! - **check** — starting a wave, and starting it again after a takeover.
//! - **tail** — watching a run: the readings as they land, and the progress line.
//! - **status** — `status` and `summary`, answered offline when no backend has the repo.
//! - **trace** — reading history onto the map, and how deep a verb reads it.
//! - **findings** — the list, `callers`, and the decisions: snooze, allow, wrong, flag, clear
//!   and balance.
//! - **store** — `refresh` and `verify`, which answer from `.sanity/` alone.
//! - **export** — `export-data`, the JSON the offline renderer draws from.

use crate::agentapi;
use serde_json::Value;
use std::path::PathBuf;

mod backend;
mod check;
mod export;
mod findings;
mod init;
mod status;
mod store;
mod tail;
mod trace;

pub(crate) use backend::{ensure_backend, live};
pub use backend::serve;
pub use check::check;
pub use findings::findings;
pub use init::init;
pub use status::{status, summary};
pub use store::{refresh, verify};
use export::export_data;
use findings::{balance, callers, clear, decide};
use trace::{trace, Rung};

/// Thousands separators. The counts here are function totals, and six digits without them
/// is a number you have to stop and read.
fn commas(n: u64) -> String {
    let s = n.to_string();
    let mut out = String::with_capacity(s.len() + s.len() / 3);
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i).is_multiple_of(3) {
            out.push(',');
        }
        out.push(c);
    }
    out
}

fn num(v: &Value, key: &str) -> u64 {
    v.get(key).and_then(|x| x.as_u64()).unwrap_or(0)
}

fn text<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("")
}

/// Canonicalised, because `project_key` is and the two must agree. A key that round-trips
/// through a symlink differently from the one the backend stored is a project the CLI can
/// see and never address.
fn resolve(path: &str) -> Result<PathBuf, String> {
    std::fs::canonicalize(path).map_err(|e| format!("{path}: {e}"))
}

/// Is there a person here to answer a question?
///
/// **Nothing prompts unless both ends of the conversation are a terminal.** These verbs run
/// in CI, in `just` recipes, from a launchd job and inside the app's own `Command::new`, and
/// a prompt in any of those is not a question — it is a hang, with the reason invisible
/// because whatever would have printed it is being captured. Checking stdout as well as
/// stdin is what catches `sanity check . | tee log`, where a person IS present and still
/// cannot see what they are being asked.
fn interactive() -> bool {
    use std::io::IsTerminal;
    std::io::stdin().is_terminal() && std::io::stdout().is_terminal()
}

/// Ask a person to pick from a short list, or to type something else.
///
/// Returns `None` for an empty answer, which every caller reads as "you decide" — so the
/// non-interactive path and the just-press-return path arrive at the same place rather than
/// at two behaviors somebody has to know apart.
fn choose(prompt: &str, options: &[String], default: Option<&str>) -> Option<String> {
    use std::io::Write;
    println!();
    for (i, o) in options.iter().enumerate() {
        let mark = if default == Some(o.as_str()) { " (default)" } else { "" };
        println!("  {}. {o}{mark}", i + 1);
    }
    println!();
    print!("{prompt} ");
    let _ = std::io::stdout().flush();
    let mut line = String::new();
    if std::io::stdin().read_line(&mut line).is_err() {
        return default.map(str::to_string);
    }
    let line = line.trim();
    if line.is_empty() {
        return default.map(str::to_string);
    }
    // A number picks from the list; anything else is taken literally, because the list is
    // what the agent reported and a model it has never heard of is still a valid thing to
    // ask for — the same "suggestions, not a gate" rule the window's picker follows.
    if let Ok(n) = line.parse::<usize>() {
        if n >= 1 && n <= options.len() {
            return Some(options[n - 1].clone());
        }
    }
    Some(line.to_string())
}

/// Is stdout a terminal? Decides whether anything is drawn rather than printed.
///
/// Stdout alone, unlike [`interactive`], which also wants a stdin to read an answer from.
/// Drawing asks nothing of the reader — it only needs somewhere that can handle a carriage
/// return without filling a log file with escape codes.
fn fancy() -> bool {
    use std::io::IsTerminal;
    std::io::stdout().is_terminal()
}

/// `1 reader` / `5 readers`. Small enough to be worth not getting wrong: "1 readers" in a
/// line somebody watches for minutes is the kind of thing that makes a tool feel unfinished.
fn plural(n: u64, word: &str) -> String {
    if n == 1 {
        format!("{n} {word}")
    } else {
        format!("{} {word}s", commas(n))
    }
}

// The command line, as clap sees it.
//
// **A plain comment, not a doc comment.** The derive turns `///` on this struct into the
// long help, so an explanation written for whoever maintains it printed itself above the
// command list every time somebody typed `--help`. That is the whole hazard of documenting
// a type whose fields are user-facing copy: the two audiences share a syntax.
//
// **Hand-rolled before, and the reason to stop was the help rather than the parsing.** The
// old parser was thirty lines and worked: a positional path defaulting to `.`, `--flag
// value` and `--flag=value` both, `repo_arg` skipping flag VALUES so `--harness claude` did
// not resolve `./claude`. What it could not do was look like a tool anybody else ships —
// one flat block of hand-aligned text, no per-verb help, no color, and an unknown flag
// silently ignored rather than named.
//
// clap is what the CLIs this wants to resemble are built on, `uv` and `rg` among them. It
// brings `sanity check --help`, alignment that survives editing, colored headings, "did
// you mean" on a typo, and errors for the arguments the old parser dropped on the floor.
#[derive(clap::Parser)]
#[command(
    name = "sanity",
    version,
    about = "Measure code for readability and understandability",
    // The two machine-invoked verbs are hidden from the list and described here instead —
    // they are things that happen TO you, and a reader scanning for what to type should not
    // have to filter them out first.
    after_help = after_help(),
    disable_help_subcommand = true,
)]
pub struct Cli {
    #[command(subcommand)]
    command: Verb,
}

/// The foot of `sanity --help`: the two hidden verbs, then what `sanity` alone does, which is
/// the one line that differs between the app and a headless build.
fn after_help() -> String {
    let internals = "\x1b[1m\x1b[4mInternals\x1b[0m\n  \
        \x1b[1msanity serve\x1b[0m  Start the backend (one per machine, ephemeral, idempotent,\n                \
        not user-initiated)\n  \
        \x1b[1msanity mcp\x1b[0m    Start the stdio MCP server, launched by an agent's own config";
    let bare = if cfg!(feature = "gui") {
        "Run `sanity .` to open this repo in the window, or `sanity` with no arguments to open\n\
        the window alone."
    } else {
        "This build of sanity has no window. Every verb above works."
    };
    format!("{internals}\n\n{bare}")
}

/// The three buttons in the panel, and the one that takes them back.
///
/// Named for what they DO rather than for what they are stored as: `fine-for-now` is a
/// verdict in the archive and a poor imperative, and somebody typing a command is telling the
/// tool to do something. The words the archive keeps are `Verdict::word`'s, unchanged.
#[derive(clap::Subcommand)]
enum Decide {
    /// Fine as it stands — hide it until this code changes
    Snooze(Decided),
    /// Always fine — hide it whatever this code does
    Allow(Decided),
    /// Not true — the finding is wrong, not unwanted. Hidden until the rule changes
    Wrong(Decided),
    /// Needs doing. It stays in the list
    Flag(Decided),
    /// Take a decision back, returning the finding to the list
    Clear {
        /// The finding, as `sanity findings` prints it — `path/to/file.rs#name`.
        key: String,
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// Just this rule's decision. Every one filed under the key, by default.
        #[arg(long, value_name = "ID")]
        rule: Option<String>,
    },
    /// Propose thresholds that bring the whole list toward N findings
    Balance {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// How many findings the list should hold, counted once each however many rules raise
        /// them.
        #[arg(long, value_name = "N", default_value_t = 20)]
        target: usize,
        /// Save the proposal to `.sanity/rules/catalog.md`. Without it nothing is written.
        #[arg(long)]
        apply: bool,
        /// Balance the rules as sanity ships them, ignoring this repo's `catalog.md` — for
        /// asking whether a shipped threshold is right.
        #[arg(long, conflicts_with = "apply")]
        stock: bool,
    },
}

/// What all three verdicts need. One struct, so they cannot drift into taking different flags.
#[derive(clap::Args)]
struct Decided {
    /// The finding, as `sanity findings` prints it — `path/to/file.rs#name`.
    key: String,
    /// The repo. Defaults to where you are standing.
    #[arg(default_value = ".")]
    path: String,
    /// Just this rule. Every rule that raises the finding, by default.
    #[arg(long, value_name = "ID")]
    rule: Option<String>,
    /// Why. Asked for and not required, as in the panel.
    #[arg(long, value_name = "TEXT", default_value = "")]
    reason: String,
    /// Read the timeline, so the churn rules can be decided under too.
    #[arg(long)]
    edits: bool,
    /// Per-line blame, so the age and authorship rules can be decided under too.
    #[arg(long)]
    blame: bool,
}

// Every verb takes a path, and every one of them defaults it to the working directory:
// these are things you run while standing in the repo you mean.
#[derive(clap::Subcommand)]
enum Verb {
    /// Configure agent and model for this repo
    Init {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// Which coding agent runs the readers.
        #[arg(long, value_name = "NAME")]
        harness: Option<String>,
        /// Which model reads. It is the scale — a smaller one is surprised by more.
        #[arg(long, value_name = "ID")]
        model: Option<String>,
        /// Point a running Sanity window at this repo, if there is one.
        #[arg(long)]
        show: bool,
    },
    /// Perform a reading pass
    Check {
        /// The repo to read. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// Which model reads. It is the scale — a smaller one is surprised by more.
        #[arg(long, value_name = "ID")]
        model: Option<String>,
        /// How many readers at once.
        #[arg(long, value_name = "N")]
        readers: Option<usize>,
        /// Stop once this many readings have landed. A reader does ten, so ten is the step.
        #[arg(long, value_name = "N")]
        limit: Option<usize>,
        /// Start it and return, rather than watching.
        #[arg(long)]
        detach: bool,
    },
    /// Read this repo's git history onto the map
    Trace {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// The timeline, however long it takes. Without a flag, every rung that fits the ten-second
        /// budget is read, priced on what is not already cached.
        #[arg(long)]
        edits: bool,
        /// Per-line blame, however long it takes. One `git blame` per file — minutes on a large
        /// repo, hours on a huge one.
        #[arg(long)]
        blame: bool,
    },
    /// View backend status and reading completion
    Status {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// Summarize reader findings
    Summary {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// What is worth looking at, and why
    Findings {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// How many to print. The list is ranked, so this is the top of it.
        #[arg(long, value_name = "N", default_value_t = 20)]
        limit: usize,
        /// Read the timeline as well, so the churn rules can answer. Minutes on a large repo.
        #[arg(long)]
        edits: bool,
        /// Per-line blame, so age resolves to the function rather than the file. Hours on a
        /// huge repo — see `docs/notes/budgets.md`, where it is 206s of a 214s cold ceph scan.
        #[arg(long)]
        blame: bool,
        /// Decide one, instead of listing them.
        #[command(subcommand)]
        decide: Option<Decide>,
    },
    /// Rewrite .sanity/ in the current format
    Refresh {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// Fail unless every reading is present, current, and taken by one model
    Verify {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// Require this model, not merely one model.
        #[arg(long, value_name = "ID")]
        model: Option<String>,
        /// Require this agent, not merely one agent.
        #[arg(long, value_name = "NAME")]
        harness: Option<String>,
        /// Pass readings taken by more than one agent or model.
        #[arg(long, conflicts_with_all = ["model", "harness"])]
        mixed: bool,
    },
    /// Write everything the report reads, for one repo, as JSON
    ExportData {
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
        /// How much history to read. Defaults to what the app last used here, else `files`.
        #[arg(long, value_parser = ["untraced", "files", "lines", "edits"])]
        depth: Option<String>,
        /// Where to write it. Standard output by default.
        #[arg(long, value_name = "FILE")]
        out: Option<String>,
    },
    /// Who calls one function, by name
    Callers {
        /// The function, as `sanity findings` prints it — `path/to/file.rs#name`.
        key: String,
        /// The repo. Defaults to where you are standing.
        #[arg(default_value = ".")]
        path: String,
    },
    /// The backend, with no window. Idempotent.
    #[command(hide = true)]
    Serve,
    /// The stdio MCP server, for an agent to launch.
    #[command(hide = true)]
    Mcp,
}

/// The repo `sanity` should open in the window, if the arguments name one.
///
/// **`sanity .` opens this repo, the way `code .` and `zed .` open this folder.** It used to
/// be `unrecognized subcommand`, and plain `sanity` opened the window on whatever was open
/// last — so the first command a newcomer ran left them to find the repo they were standing
/// in with a picker.
///
/// - **A verb always wins.** A directory called `check` does not turn `sanity check` into an
///   open; you would write `sanity ./check`.
/// - **One argument that is a directory** is a repo to open, resolved to its git root the way
///   every other door resolves one. A directory that is not in a repo is an error, said the
///   way the window's Open says it, not a silent fall through to clap's usage text.
/// - **No arguments, at a terminal, inside a repo**, opens that repo. Not from a double-click:
///   `interactive` is whether stdin is a terminal, because a launcher's working directory is
///   `/` on macOS but can be `$HOME` on Linux, and a home directory that happens to be a
///   dotfiles repo is not a repo anybody asked to see.
///
/// `Ok(None)` means nothing to open: the caller runs the CLI when there are arguments and the
/// plain window when there are none.
pub fn launch_target(
    args: &[String],
    cwd: &std::path::Path,
    interactive: bool,
) -> Result<Option<PathBuf>, String> {
    match args {
        [] if interactive => Ok(crate::scan::git_root(cwd)),
        [] => Ok(None),
        [one] if !one.starts_with('-') && !is_verb(one) => {
            let dir = cwd.join(one);
            if !dir.is_dir() {
                return Ok(None);
            }
            crate::scan::git_root(&dir).map(Some).ok_or_else(|| crate::scan::not_a_repo(&dir))
        }
        _ => Ok(None),
    }
}

/// Whether `word` names one of the CLI's verbs, `help` included.
fn is_verb(word: &str) -> bool {
    use clap::CommandFactory;
    word == "help"
        || Cli::command()
            .get_subcommands()
            .any(|c| c.get_name() == word || c.get_all_aliases().any(|a| a == word))
}

/// Put a repo a person named at a terminal on the list of repos Sanity has been given.
///
/// The same door `sanity init` is: a person naming a repo in a place a person is allowed to.
/// Recorded before the window is asked to open it, because `/open` only opens what is on
/// that list — and when a window is already running, this process forwards its arguments
/// and exits, so this is the last chance to record anything.
pub fn name_for_window(repo: &std::path::Path) {
    let key = agentapi::project_key(repo);
    let name = repo.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| key.clone());
    crate::reports::remember(&key, &repo.to_string_lossy(), &name);
}

pub fn main(args: &[String]) -> i32 {
    use clap::Parser;
    // The binary's own name back in front, because clap reports usage with argv[0] and
    // `main.rs` hands over the arguments with it already stripped.
    let cli = match Cli::try_parse_from(
        std::iter::once("sanity".to_string()).chain(args.iter().cloned()),
    ) {
        Ok(cli) => cli,
        Err(e) => {
            // clap decides the stream and the code: `--help` and `--version` are a success
            // printed to stdout, a bad argument is an error on stderr. Printing both the
            // same way is how `sanity --help | less` ends up empty.
            let _ = e.print();
            return if e.use_stderr() { 2 } else { 0 };
        }
    };
    match cli.command {
        Verb::Serve => serve(),
        // Reached only if something calls `cli::main` with it — `main.rs` intercepts `mcp`
        // before this, because the MCP server must not pay for argument parsing or for
        // anything else this module does on the way in.
        Verb::Mcp => {
            crate::mcp::run();
            0
        }
        Verb::Init { path, harness, model, show } => {
            init(&path, harness.as_deref(), model.as_deref(), show)
        }
        Verb::Trace { path, edits, blame } => trace(&path, Rung::of(edits, blame)),
        Verb::Check { path, model, readers, limit, detach } => {
            check(&path, model.as_deref(), readers, limit, detach)
        }
        Verb::Status { path } => status(&path),
        Verb::Summary { path } => summary(&path),
        Verb::Findings { path, limit, edits, blame, decide: None } => {
            findings(&path, limit, edits, blame)
        }
        Verb::Findings { decide: Some(what), .. } => {
            use crate::findings::Verdict;
            let verdict = match &what {
                Decide::Snooze(_) => Verdict::FineForNow,
                Decide::Allow(_) => Verdict::FineAlways,
                Decide::Wrong(_) => Verdict::FalsePositive,
                Decide::Flag(_) => Verdict::Flagged,
                Decide::Clear { key, path, rule } => {
                    return clear(path, key, rule.as_deref());
                }
                Decide::Balance { path, target, apply, stock } => {
                    return balance(path, *target, *apply, *stock);
                }
            };
            let (Decide::Snooze(d) | Decide::Allow(d) | Decide::Flag(d) | Decide::Wrong(d)) = &what
            else {
                unreachable!("clear and balance returned above")
            };
            decide(&d.path, &d.key, d.rule.as_deref(), verdict, &d.reason, d.edits, d.blame)
        }
        Verb::Callers { key, path } => callers(&path, &key),
        Verb::Refresh { path } => refresh(&path),
        Verb::Verify { path, model, harness, mixed } => {
            verify(&path, model.as_deref(), harness.as_deref(), mixed)
        }
        Verb::ExportData { path, depth, out } => {
            export_data(&path, depth.as_deref().map(crate::trace::Depth::from_tag), out.as_deref())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `sanity .` and plain `sanity` in a repo open it; verbs and everything else do not.
    #[test]
    fn a_directory_argument_opens_its_repo_and_a_verb_never_does() {
        let dir = tempfile::tempdir().unwrap();
        let repo = dir.path().join("repo");
        std::fs::create_dir_all(repo.join("check")).unwrap();
        std::fs::create_dir(dir.path().join("plain")).unwrap();
        let git = std::process::Command::new("git").arg("init").arg("-q").arg(&repo).status();
        assert!(git.map(|s| s.success()).unwrap_or(false), "git init");
        let root = std::fs::canonicalize(&repo).unwrap();
        let at = |p: Option<PathBuf>| p.map(|p| std::fs::canonicalize(p).unwrap());
        let args = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();

        assert_eq!(at(launch_target(&args(&["."]), &repo, false).unwrap()), Some(root.clone()));
        assert_eq!(
            at(launch_target(&args(&["repo"]), dir.path(), false).unwrap()),
            Some(root.clone()),
            "a path relative to where you stand"
        );
        assert_eq!(
            launch_target(&args(&["check"]), &repo, false).unwrap(),
            None,
            "a verb is a verb even with a directory of that name beside it"
        );
        assert_eq!(
            at(launch_target(&args(&["./check"]), &repo, false).unwrap()),
            Some(root.clone()),
            "and the directory is still reachable by spelling it as a path"
        );
        assert!(
            launch_target(&args(&["plain"]), dir.path(), false).is_err(),
            "a directory outside any repo is said so, not handed to clap"
        );
        assert_eq!(launch_target(&args(&["nope"]), dir.path(), false).unwrap(), None);
        assert_eq!(launch_target(&args(&["findings", "."]), &repo, false).unwrap(), None);

        assert_eq!(at(launch_target(&[], &repo, true).unwrap()), Some(root), "at a terminal, in a repo");
        assert_eq!(launch_target(&[], &repo, false).unwrap(), None, "not from a launcher");
        assert_eq!(launch_target(&[], dir.path(), true).unwrap(), None, "at a terminal, outside one");
    }

    /// A flag's value is never mistaken for the repo path.
    ///
    /// `sanity init --harness claude` is the case: one bare word, and it names an agent.
    /// Read as a positional it resolves `./claude` and the user is told their repo does not
    /// exist, which sends them looking at the wrong thing entirely.
    ///
    /// clap gets this right structurally, where the hand-rolled parser got it right by
    /// carrying a list of which flags take values — a list that had to be updated every
    /// time a flag was added, and silently mis-parsed when it was not. The test outlived
    /// the parser because the BUG is what it is about, not the implementation: these are
    /// the exact command lines somebody types.
    #[test]
    fn a_flags_value_is_not_the_repo() {
        use clap::Parser;
        let path_of = |args: &[&str]| -> String {
            let cli = Cli::try_parse_from(std::iter::once("sanity").chain(args.iter().copied()))
                .expect("should parse");
            match cli.command {
                Verb::Init { path, .. }
                | Verb::Check { path, .. }
                | Verb::Status { path }
                | Verb::Summary { path }
                | Verb::Refresh { path } => path,
                _ => unreachable!("no path on this verb"),
            }
        };
        assert_eq!(path_of(&["init", "--harness", "claude"]), ".");
        assert_eq!(path_of(&["init", "--harness=claude"]), ".");
        assert_eq!(path_of(&["check", "--model", "sonnet", "--readers", "8"]), ".");
        // A real path still wins, before or after the flags.
        assert_eq!(path_of(&["init", "--harness", "claude", "/repo"]), "/repo");
        assert_eq!(path_of(&["init", "/repo", "--harness", "claude"]), "/repo");
        // A valueless flag does not swallow what follows it.
        assert_eq!(path_of(&["init", "--show", "/repo"]), "/repo");

        // And the half the old parser could not do at all: an argument it has never heard
        // of is an error rather than something quietly dropped.
        assert!(Cli::try_parse_from(["sanity", "check", "--wat"]).is_err());
    }
}
