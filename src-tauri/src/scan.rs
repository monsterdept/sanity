//! Walk a repo, parse it, score it, and hand back the tree the sunburst renders.

use crate::cache::{self, Cache};
use crate::blame::Blame;
use crate::scancache::{Look, ScanCache};
use crate::churn::{self, History};
use crate::heuristic::{self, Fingerprint};
use crate::model::{Lang, Node, NodeKind, Provenance, Score, Source};
use crate::parse::{self, FuncDef};
use crate::surprise::{Hotspot, Item, Reading, SurpriseModel};
use rayon::prelude::*;
use serde::Serialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

/// Files above this never contain a function anybody reasons about. They are vendored
/// bundles, fixtures, or generated clients — and at a megabyte apiece they'd dominate
/// the sunburst by area while saying nothing.
const MAX_FILE_BYTES: u64 = 1_000_000;

/// A single line this long means minified or generated output. Length alone is the only
/// reliable cross-language tell; a `// @generated` marker convention is not universal.
const MINIFIED_LINE_BYTES: usize = 2_000;

/// Path segments whose contents are somebody else's code.
///
/// .gitignore catches most of it, but plenty of projects *commit* their vendored
/// dependencies — the first real scan of a sibling project had three.js's GLTFLoader
/// sitting in the results, which is noise at best and actively misleading at worst,
/// since it is neither code the user wrote nor code they can act on.
const VENDORED: &[&str] = &["vendor", "vendored", "third_party", "thirdparty", "node_modules"];

#[derive(Debug, Clone, Serialize)]
pub struct ScanStats {
    pub files_scanned: usize,
    pub files_skipped: usize,
    pub functions: usize,
    /// True when the repo has no usable git history, so the stability axis is missing
    /// and every quadrant verdict is really only half a verdict. The UI must say so —
    /// silently downgrading the finding is how a map starts lying.
    pub without_history: bool,
    pub model: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Scan {
    pub root: Node,
    pub stats: ScanStats,
}

/// One function's score, the moment it is known.
///
/// Streamed so the map can colour in as the model works rather than staying grey until
/// the whole scan returns. On a repo where analysis takes twenty minutes, a picture that
/// fills in is the difference between watching progress and watching a progress bar.
/// Only the field that changed. `churn`, `age` and `documented` are properties of the
/// code and its history, not of the instrument, so the frontend patches surprise onto
/// the score it already has rather than being sent a whole replacement.
#[derive(Debug, Clone, Serialize)]
pub struct Scored {
    pub id: String,
    pub surprise: f32,
    pub hotspots: Vec<Hotspot>,
}

/// Progress is counted in **functions**, not directories.
///
/// It used to be directories, which is a unit the user has no feel for and which is not
/// even proportional to work: one directory may hold a single tiny helper and the next
/// fifty long ones. With a model attached a scan can run for many minutes, so "3 / 37
/// directories" sitting under a blank window is the difference between waiting and
/// force-quitting.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Progress {
    pub done: usize,
    pub total: usize,
}

/// Collect the parseable source files under `root`.
///
/// `ignore::WalkBuilder` honours .gitignore/.ignore for free — the same matcher ripgrep
/// uses. This is not a nicety: without it `node_modules` and `target` are the two
/// biggest wedges in every JavaScript and Rust project on earth, and the picture says
/// nothing about the code the user wrote.
fn collect_files(root: &Path) -> Vec<(PathBuf, Lang)> {
    ignore::WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .parents(true)
        // Honour .gitignore even when the directory isn't a git repo. `ignore` defaults
        // to requiring one, which is right for ripgrep and wrong here: a downloaded
        // tarball, a worktree, or a project whose history hasn't been created yet still
        // has a .gitignore that says which files are not the user's code.
        .require_git(false)
        .build()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_some_and(|t| t.is_file()))
        .filter_map(|e| {
            let path = e.path();
            let ext = path.extension()?.to_str()?;
            let lang = Lang::from_extension(ext)?;
            let size = e.metadata().ok()?.len();
            let vendored = path
                .strip_prefix(root)
                .unwrap_or(path)
                .components()
                .any(|c| VENDORED.contains(&c.as_os_str().to_string_lossy().as_ref()));
            (size <= MAX_FILE_BYTES && !vendored).then(|| (path.to_path_buf(), lang))
        })
        .collect()
}

/// Forward slashes on every platform: node ids are built from these, and a scan on
/// Windows must produce the same ids as the same repo scanned on a Mac or the cached
/// results from one are garbage to the other.
fn rel(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .components()
        .map(|c| c.as_os_str().to_string_lossy())
        .collect::<Vec<_>>()
        .join("/")
}

/// Lines of the file head handed to the model as context. Imports and top-level type
/// declarations live here in every language sanity parses, and they are most of what
/// tells a reader (or a model) what this file is even about.
const CONTEXT_HEAD_LINES: usize = 40;

/// Complete sibling functions shown to the model, and how much of each.
///
/// Two is enough to establish house style — the thing that lets a reader predict the
/// eleventh command handler from the first two — without turning every prompt into a
/// whole file and every scan into an hour of prompt evaluation.
const CONTEXT_SIBLINGS: usize = 2;
const CONTEXT_SIBLING_LINES: usize = 30;

/// The two memos a scan carries, bundled because they are always passed together and
/// separately because they answer different questions.
///
/// `scores` is keyed on a function's body and doc, since a score is a reading OF those.
/// `scans` is keyed on a whole file, since a parse and a blame are readings of the file.
/// They also differ in who fills them: `scores` only in the model path, `scans` on every
/// scan. Passing two ephemerals is how the headless scanner stays reproducible.
pub struct Memos<'a> {
    pub scores: &'a Cache,
    pub scans: &'a ScanCache,
}

impl Memos<'_> {
    /// Neither memo persists. What `just scan` and the tests use — an experiment that can
    /// answer from a file is not an experiment against the thing being measured.
    pub fn ephemeral() -> (Cache, ScanCache) {
        (Cache::ephemeral(), ScanCache::ephemeral())
    }
}

struct ParsedFile {
    rel_path: String,
    lang: Lang,
    funcs: Vec<FuncDef>,
    prints: Vec<Fingerprint>,
    head: String,
    /// FNV of the file's bytes, carried out of the parse so the blame pass can ask the
    /// cache about this exact content without stat-ing or reading the file a second time.
    hash: u64,
    /// Matched by `.sanityignore` — parsed and drawn, but never handed to a reader and
    /// never in the denominator. See [`scope_of`].
    excluded: bool,
}

/// What `.sanityignore` says is not this assessment's business.
///
/// **The tool cannot know this and should not pretend to.** Whether `tests-unit/` is
/// noise or the most interesting thing in the repo is a judgement about a specific
/// codebase — and it cuts both ways: a full pass of one repo found seven tests whose names
/// promised properties their bodies never exercised, including the one named for the whole
/// product's claim. Shipping a default that excluded tests would have deleted the best
/// result of that run. So there are no defaults. The file starts absent, and every line in
/// it is somebody's decision.
///
/// What the tool can do is make the decision cheap to make well: `sanity_open` reports the
/// shape of the repo by directory, and an agent that has read it can put a proposal in
/// front of the human with numbers attached. Mechanism here, judgement from the reader,
/// decision with the person — the same division as the metric itself.
///
/// Gitignore syntax, via the same matcher, so negation and directory patterns behave the
/// way anyone would expect. Committed with the repo like `.sanity/` is, because scoping is
/// a claim about what this map MEANS: kept on one machine, two people looking at the same
/// sunburst would be looking at different denominators with no way to tell.
fn scope_of(root: &Path) -> Option<ignore::gitignore::Gitignore> {
    let path = root.join(".sanityignore");
    if !path.exists() {
        return None;
    }
    let mut b = ignore::gitignore::GitignoreBuilder::new(root);
    b.add(&path);
    b.build().ok()
}

/// Imports plus a couple of whole sibling bodies, for the model prompt.
///
/// Excludes the function being scored, obviously: showing a model the answer and then
/// measuring whether it guessed the answer measures nothing at all.
fn context_for(file: &ParsedFile, skip: usize) -> String {
    let mut out = file.head.clone();
    for f in file
        .funcs
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != skip)
        .take(CONTEXT_SIBLINGS)
        .map(|(_, f)| f)
    {
        out.push_str("\n\n");
        out.push_str(&f.signature);
        let body: String = f
            .body
            .lines()
            .take(CONTEXT_SIBLING_LINES)
            .collect::<Vec<_>>()
            .join("\n");
        out.push_str(&body);
    }
    out
}

/// Parse one file, or take its parse from `cache` when nothing about it has changed.
///
/// Fingerprints are recomputed rather than cached even on a hit. They are a `HashSet<u64>`
/// per function — bigger on disk than the body they are derived from, and derived from a
/// body the cache is already holding — so storing them would trade the thing this cache is
/// for (a fast open) against the thing it costs (disk), in the wrong direction. At
/// `Fidelity::Ordering`, which is what the app opens at, they are not computed at all.
fn parse_file(
    root: &Path,
    path: &Path,
    lang: Lang,
    fidelity: Fidelity,
    scope: Option<&ignore::gitignore::Gitignore>,
    cache: &ScanCache,
) -> Option<ParsedFile> {
    let rel_path = rel(root, path);
    // Shingling every body is half the cost of the term it feeds, so at ordering fidelity
    // it is skipped outright rather than computed and ignored.
    let print = |funcs: &[FuncDef]| -> Vec<Fingerprint> {
        match fidelity {
            Fidelity::Full => funcs.iter().map(|f| heuristic::fingerprint(&f.body)).collect(),
            Fidelity::Ordering => Vec::new(),
        }
    };
    // Excluded is recomputed on every scan and never cached: `.sanityignore` is a file the
    // human edits, and a scan that answered from a memo would keep drawing a slice they
    // just took out of scope.
    let excluded =
        scope.is_some_and(|s| s.matched_path_or_any_parents(path, false).is_ignore());

    let (funcs, head, hash) = match cache.look(&rel_path, path, None) {
        Look::Unreadable => return None,
        Look::Hit(hit) => (hit.funcs, hit.head, hit.ident.hash),
        Look::Miss { src, ident } => {
            if src.lines().any(|l| l.len() > MINIFIED_LINE_BYTES) {
                return None;
            }
            let funcs = parse::parse_functions(lang, &src);
            if funcs.is_empty() {
                return None;
            }
            let head = src
                .lines()
                .take(CONTEXT_HEAD_LINES)
                .collect::<Vec<_>>()
                .join("\n");
            cache.put_parse(&rel_path, &ident, lang, &funcs, &head);
            (funcs, head, ident.hash)
        }
    };
    let prints = print(&funcs);
    Some(ParsedFile {
        rel_path,
        lang,
        funcs,
        prints,
        head,
        hash,
        // Parsed even when excluded, rather than skipped in the walk. Scanning is seconds
        // and readers are millions of tokens, so the cheap thing is to know exactly how
        // much was set aside and say so. An exclusion nobody can count is how a map claims
        // completeness over a subset.
        excluded,
    })
}

/// Score every function in one directory.
///
/// Scoring is grouped by directory rather than by file for one reason: a function needs
/// peers to be compared against, and plenty of real files hold exactly one function. A
/// lone function with no peers scores an undecided 0.5 distinctiveness (see
/// `heuristic::distinctiveness`), so without the directory fallback every
/// one-function-per-file codebase — which is most React frontends — would have its
/// strongest signal switched off.
/// Fill in each directory's DISTINCT commit count from the git history.
///
/// `aggregate` can compute a directory's lines, surprise and hot share from its children,
/// but not this: a commit touching twelve files in one directory is one commit for that
/// directory, and by the time the tree exists only per-file counts survive. `churn::read`
/// credits ancestor directories once per commit while the log is still grouped, so the
/// answer is a lookup on the directory's own path.
///
/// Churn itself stays the children's LOC-weighted mean rather than `churn_of(dir)`: the
/// normalisation constant is tuned for a single file, and a directory pooling every
/// commit beneath it would saturate to 1.0 the moment anyone touched anything.
///
/// **Files as well as directories, despite the name.** A file node's score comes from
/// `aggregate`, which sets `commits: 0` because summing its functions would count one
/// commit once per function it touched — and nothing filled it back in, so every file
/// reported zero commits next to a churn bar at 72. A file's path is a real path, so the
/// log answers directly; only the aggregate could not. Two cold readers predicted
/// directories-only from the name and this doc, in two separate runs, and both were
/// caught by the `File` arm — which is the instrument reporting a name that undersells
/// its function, so the doc now says it rather than an inline comment inside the body
/// where a reader predicting from the outside never sees it.
fn apply_dir_history(node: &mut Node, history: &History) {
    if node.kind == NodeKind::Dir || node.kind == NodeKind::File {
        if let Some(score) = node.score.as_mut() {
            score.commits = history.commits_of(&node.path);
        }
    }
    for child in &mut node.children {
        apply_dir_history(child, history);
    }
}

/// How much of the proxy to actually compute.
///
/// The proxy has two jobs and they need different things. As **the metric** it is the
/// number the histogram and the rankings are read off, and every term has to be there.
/// Inside the app it is only ever **a reading order**: `collect_tasks` sorts the queue by
/// it, and nothing else consumes it — a proxy-scored function is `Source::Proxy`, which
/// `isAnalyzed` rejects, so its wedge is painted structural neutral and its number never
/// reaches the screen. Nothing claims to have been understood until an agent reads it.
///
/// That asymmetry is worth a mode because one term is not like the others.
/// `distinctiveness` is all-pairs — every function Jaccard'd against every peer in its
/// file — and on a repo with 16,814 functions across 102 files it is ~2.8M set
/// intersections: 27.7s of a 34s scan, measured, for 0.35 of the mix. The other three
/// terms are O(body) and effectively free.
///
/// So the app pays for the cheap three and takes `UNDECIDED` for the fourth — the same
/// answer that term already gives whenever it runs out of evidence, which keeps it honest
/// rather than inventing a substitute. It shifts every score by one constant, so within
/// the app it changes only the tie-break order of a queue that reads the whole repo
/// anyway. Full fidelity stays the default everywhere the number is the point.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Fidelity {
    /// All four terms. What the metric is.
    Full,
    /// Skip the all-pairs term. Enough to rank a work queue, and 30 seconds cheaper.
    Ordering,
}

fn score_dir(
    files: &[ParsedFile],
    history: &History,
    blame: &Blame,
    fidelity: Fidelity,
) -> Vec<(String, Node)> {
    let dir_prints: Vec<&Fingerprint> = files.iter().flat_map(|f| f.prints.iter()).collect();

    files
        .iter()
        .map(|file| {
            let churn = history.churn_of(&file.rel_path);
            let age_days = history.age_of(&file.rel_path);
            let commits = history.commits_of(&file.rel_path);
            let last_touched_days = history.last_touched_of(&file.rel_path);
            let last_author = history.last_author_of(&file.rel_path);

            let file_blame = blame.get(&file.rel_path);

            let children: Vec<Node> = file
                .funcs
                .iter()
                .enumerate()
                .map(|(i, func)| {
                    // This function's own history where blame could read it, the file's
                    // otherwise — an untracked file, a repo without git, or a range the
                    // blame no longer covers should cost resolution, not the axis.
                    let own = file_blame
                        .and_then(|b| b.range(func.start_line, func.end_line, blame.now));
                    let (churn, age_days, commits, last_touched_days, last_author) = match &own {
                        Some(h) => (
                            (h.commits as f32 / crate::churn::CHURN_SATURATION).clamp(0.0, 1.0),
                            Some(h.age_days),
                            h.commits,
                            Some(h.last_touched_days),
                            Some(h.last_author.clone()).filter(|a| !a.is_empty()),
                        ),
                        None => (
                            churn,
                            age_days,
                            commits,
                            last_touched_days,
                            last_author.clone(),
                        ),
                    };
                    // Same-file peers when there are any; otherwise the directory's.
                    let peers: Vec<&Fingerprint> = if fidelity == Fidelity::Ordering {
                        Vec::new()
                    } else if file.prints.len() > 1 {
                        file.prints
                            .iter()
                            .enumerate()
                            .filter(|(j, _)| *j != i)
                            .map(|(_, p)| p)
                            .collect()
                    } else {
                        dir_prints
                            .iter()
                            .copied()
                            .filter(|p| !std::ptr::eq(*p, &file.prints[i]))
                            .collect()
                    };

                    // No fingerprints exist at ordering fidelity, so there is nothing to
                    // index — and `UNDECIDED` is what the term itself returns with no
                    // peers to compare against, which is the same statement: no evidence.
                    let distinct = match fidelity {
                        Fidelity::Full => heuristic::distinctiveness(&file.prints[i], &peers),
                        Fidelity::Ordering => heuristic::UNDECIDED,
                    };
                    let proxy = heuristic::surprise(&func.signature, &func.body, distinct);
                    let surprise = proxy;

                    // Measured coverage, then discounted by who wrote the words. A
                    // comment already in the source is `Source`, never `Human`: we
                    // cannot tell whether a person or an agent typed it, and the
                    // difference is the whole reason the map can be trusted.
                    let measured = heuristic::documented(
                        func.doc.as_deref(),
                        &func.signature,
                        &func.body,
                    );
                    let provenance = if func.doc.is_some() {
                        Provenance::Source
                    } else {
                        Provenance::None
                    };

                    let node = Node {
                        id: format!("{}#{}@{}", file.rel_path, func.name, func.start_line),
                        name: func.name.clone(),
                        kind: NodeKind::Func,
                        excluded: false,
                        doc: func.doc.clone(),
                        signature: Some(func.signature.clone()),
                        owner: func.owner.clone(),
                        body: Some(crate::assessment::reading_hash(
                            func.doc.as_deref(),
                            &func.body,
                        )),
                        end_line: Some(func.end_line),
                        path: file.rel_path.clone(),
                        loc: func.loc(),
                        line: Some(func.start_line),
                        lang: Some(file.lang),
                        last_author,
                        score: Some(Score {
                            surprise,
                            documented: measured * provenance.weight(),
                            churn,
                            age_days,
                            commits,
                            last_touched_days,
                            provenance,
                            // Leaves don't have a share of anything; `aggregate` reads
                            // their temperature directly to build their parents'.
                            hot_share: 0.0,
                            source: Source::Proxy,
                            analyzed_share: 0.0,
                        }),
                        hotspots: Vec::new(),
                        children: Vec::new(),
                    };
                    node
                })
                .collect();

            let name = file
                .rel_path
                .rsplit('/')
                .next()
                .unwrap_or(&file.rel_path)
                .to_string();
            (
                file.rel_path.clone(),
                Node {
                    id: file.rel_path.clone(),
                    name,
                    kind: NodeKind::File,
                    excluded: file.excluded,
                    // No file-level doc yet: `parse` extracts the comment attached to
                    // each chunk, not the banner at the top of a module. The stack a
                    // reader is handed is therefore one deep for now, and widens here
                    // when file docs are parsed rather than anywhere downstream.
                    doc: None,
                    signature: None,
                    owner: None,
                    body: None,
                    end_line: None,
                    path: file.rel_path.clone(),
                    loc: 0, // filled by aggregate()
                    line: None,
                    lang: Some(file.lang),
                    last_author: last_author.clone(),
                    score: None,
                    hotspots: Vec::new(),
                    children,
                },
            )
        })
        .collect()
}

/// One function queued for the model, with everything the call needs.
struct Work<'a> {
    priority: f32,
    id: String,
    func: &'a FuncDef,
    peers: Vec<String>,
    context: String,
    proxy: f32,
    cache_key: (String, u64),
}

/// Replace proxy surprise with the model's, marking those leaves analysed.
///
/// `documented` is left alone: it is a property of the docs, not of the surprise, and
/// the model path does not grade documentation — it only consumes it. The comment stack
/// is in the prompt, so a doc that genuinely explains the body lowers this surprise
/// directly rather than discounting it afterwards.
fn apply_model_scores(node: &mut Node, upgrades: &std::collections::HashMap<String, Reading>) {
    if node.kind == NodeKind::Func {
        if let Some(reading) = upgrades.get(&node.id) {
            if let Some(score) = node.score.as_mut() {
                score.surprise = reading.surprise;
                score.source = Source::Model;
                score.analyzed_share = 1.0;
            }
            node.hotspots = reading.hotspots.clone();
        }
        return;
    }
    for c in &mut node.children {
        apply_model_scores(c, upgrades);
    }
}

/// Insert a file node at its path, creating intermediate directory wedges as needed.
fn insert(root: &mut Node, rel_path: &str, node: Node) {
    let mut cur = root;
    let parts: Vec<&str> = rel_path.split('/').collect();
    let mut walked = String::new();
    for part in &parts[..parts.len().saturating_sub(1)] {
        if !walked.is_empty() {
            walked.push('/');
        }
        walked.push_str(part);
        let idx = cur
            .children
            .iter()
            .position(|c| c.name == *part && c.kind == NodeKind::Dir)
            .unwrap_or_else(|| {
                cur.children.push(Node::dir(&walked, part));
                cur.children.len() - 1
            });
        cur = &mut cur.children[idx];
    }
    cur.children.push(node);
}

/// Directories with exactly one child directory and nothing else are collapsed into a
/// single wedge (`src/main/java/com/x` becomes one ring, not four).
///
/// Not cosmetic: each of those rings is a full annulus of the sunburst carrying zero
/// information, and on a deeply-nested project they push the actual code so far out that
/// the functions are hairline slivers.
fn collapse_chains(node: &mut Node) {
    for c in &mut node.children {
        collapse_chains(c);
    }
    while node.kind == NodeKind::Dir && node.children.len() == 1 {
        let only = &node.children[0];
        if only.kind != NodeKind::Dir {
            break;
        }
        let mut child = node.children.remove(0);
        node.name = format!("{}/{}", node.name, child.name);
        node.id = child.id.clone();
        node.path = child.path.clone();
        node.children = std::mem::take(&mut child.children);
    }
}

/// The whole pipeline. `on_progress` fires per directory — the app drives the mascot off
/// it, so a scan of a big repo shows something moving rather than a frozen window.
pub fn scan(
    root: &Path,
    model: &dyn SurpriseModel,
    on_progress: &(dyn Fn(Progress) + Sync),
    // Called with (function id, reading) the instant each score is known.
    on_scored: &(dyn Fn(&str, &Reading) + Sync),
    // Set to stop the model pass early. Everything already scored is kept — with no
    // length filter, being able to stop IS the cost control, so this is load-bearing
    // rather than a convenience.
    cancel: &AtomicBool,
    memos: Memos<'_>,
    fidelity: Fidelity,
) -> anyhow::Result<Scan> {
    let Memos { scores: cache, scans } = memos;
    let files = collect_files(root);
    let total_found = files.len();
    let scope = scope_of(root);
    let history = churn::read(root);

    // Group by parent directory so `score_dir` has peers to compare against. BTreeMap
    // rather than HashMap: iteration order decides sibling order in the sunburst, and a
    // ring that reshuffles itself between two scans of an unchanged repo would make the
    // before/after diff — the reason to open this twice — unreadable.
    let mut by_dir: BTreeMap<String, Vec<(PathBuf, Lang)>> = BTreeMap::new();
    for (path, lang) in files {
        let dir = rel(root, path.parent().unwrap_or(root));
        by_dir.entry(dir).or_default().push((path, lang));
    }

    // Parse everything first, then score. Splitting the two passes costs nothing —
    // parsing is CPU-bound and quick — and buys an honest denominator: until every file
    // is parsed there is no way to know how many functions the scan is about to score,
    // and a progress bar whose total moves is worse than none.
    let parsed_dirs: Vec<Vec<ParsedFile>> = by_dir
        .par_iter()
        .map(|(_dir, entries)| {
            entries
                .iter()
                .filter_map(|(p, lang)| {
                    parse_file(root, p, *lang, fidelity, scope.as_ref(), scans)
                })
                .collect()
        })
        .collect();

    let files_scanned: usize = parsed_dirs.iter().map(|d| d.len()).sum();

    // Per-line provenance, so churn, age and blame resolve to the FUNCTION rather than to
    // its file. One `git blame` per file, in parallel — 22ms each on a small Swift file,
    // and 29.4s across 2,518 C++ files, which is why `scancache` memoises it.
    //
    // Taken AFTER the parse, over the files that actually parsed, rather than before it
    // over every file the walk found. Two reasons, and the second is the load-bearing one.
    // Nothing ever read the blame of a file with no functions in it — `score_dir` asks per
    // function — so blaming minified bundles and empty headers was always waste. And the
    // cache is keyed on content, so the blame pass needs the hash the parse pass computed;
    // running first would mean stat-ing and reading every file twice to learn the same
    // thing.
    let for_blame: Vec<(String, u64)> = parsed_dirs
        .iter()
        .flatten()
        .map(|f| (f.rel_path.clone(), f.hash))
        .collect();
    let blame = Blame::read(root, &for_blame, &history, scans);

    // A repo shrinks as well as grows, and an entry nobody asks about again is never
    // invalidated by anything — without this a cache would carry every file of every
    // branch anyone had ever checked out.
    scans.retain(&for_blame.iter().map(|(p, _)| p.clone()).collect());
    let is_model = model.is_model();

    // Build the whole tree from the proxy first. It is fast, it is entirely grey (no
    // wedge claims to have been analysed), and it means the user has the repo's shape on
    // screen in about a second instead of after the model finishes.
    let per_dir: Vec<Vec<(String, Node)>> = parsed_dirs
        .par_iter()
        .map(|parsed| score_dir(parsed, &history, &blame, fidelity))
        .collect();

    let root_name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| root.to_string_lossy().to_string());
    let mut tree = Node::dir("", &root_name);
    for (rel_path, node) in per_dir.into_iter().flatten() {
        insert(&mut tree, &rel_path, node);
    }
    // Collapse the children, never the root: the root wedge is the repo, and a project
    // whose sources all live under one `src/` would otherwise have its own name replaced
    // by that directory's.
    for child in &mut tree.children {
        collapse_chains(child);
    }
    tree.aggregate();
    apply_dir_history(&mut tree, &history);

    // ── The model pass, in priority order ────────────────────────────────────────
    //
    // Forced decoding costs a decode step per token, so a large repo takes hours. Rather
    // than make the user wait for all of it, the work is ordered by how much it could
    // possibly matter — lines × the proxy's guess at surprise — and streamed
    // as it lands. The most consequential wedges colour in within the first minutes, and
    // stopping early costs the least valuable results rather than an arbitrary
    // directory's worth. Total runtime stops being the number that matters.
    if is_model {
        // The proxy scores already live on the grey tree; read them back rather than
        // recomputing, so the priority ordering and the model's fallback both use
        // exactly the number the user is currently looking at.
        let mut proxies: std::collections::HashMap<String, f32> = std::collections::HashMap::new();
        tree.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                if let Some(sc) = n.score {
                    proxies.insert(n.id.clone(), sc.surprise);
                }
            }
        });

        let mut work: Vec<Work> = Vec::new();
        let mut cached: Vec<(String, Reading)> = Vec::new();
        for parsed in &parsed_dirs {
            for file in parsed {
                let peer_names: Vec<String> = file.funcs.iter().map(|f| f.name.clone()).collect();
                for (i, func) in file.funcs.iter().enumerate() {
                    let id = format!("{}#{}@{}", file.rel_path, func.name, func.start_line);
                    let ck = cache::key(&file.rel_path, &func.name, &func.body, func.doc.as_deref());
                    // Already scored by this model, and unchanged since — reuse it.
                    // Resuming an interrupted scan and rescanning a repo you edited two
                    // files in are the same code path.
                    if let Some(reading) = cache.get(&ck) {
                        on_scored(&id, &reading);
                        cached.push((id, reading));
                        continue;
                    }
                    let proxy = proxies.get(&id).copied().unwrap_or(0.5);
                    work.push(Work {
                        // Ordered by the proxy's *intensity*, deliberately NOT by
                        // intensity × lines. Weighting by size would push short
                        // functions to the back of a queue that can run for hours, and a
                        // three-line guard with an inverted comparison is exactly the
                        // kind of thing this tool exists to surface. Size is already
                        // visible — it is the width of the wedge — so the queue spends
                        // its ordering budget on the axis the eye cannot read.
                        priority: proxy,
                        id,
                        func,
                        peers: peer_names.clone(),
                        context: context_for(file, i),
                        proxy,
                        cache_key: ck,
                    });
                }
            }
        }
        work.sort_by(|a, b| {
            b.priority
                .partial_cmp(&a.priority)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let total = work.len();
        if total == 0 {
            // Everything was cached. Still emit one tick so the UI doesn't sit on a
            // stale "0 / 0" from a previous run.
            on_progress(Progress { done: 0, total: 0 });
        }
        let done = AtomicUsize::new(0);
        let scored: Vec<(String, Reading)> = work
            .par_iter()
            .filter(|_| !cancel.load(Ordering::Relaxed))
            .map(|w| {
                let surprise = model.surprise(
                    &Item {
                        name: &w.func.name,
                        signature: &w.func.signature,
                        body: &w.func.body,
                        peers: &w.peers,
                        doc: w.func.doc.as_deref(),
                        lines: w.func.body.lines().count(),
                        context: &w.context,
                    },
                    w.proxy,
                );
                cache.put(&w.cache_key, &surprise);
                // Emitted HERE, inside the parallel map, not after it. Reporting from
                // the apply step meant nothing reached the UI until the whole scan
                // finished — which on a repo this size is hours of a grey map with a
                // moving progress bar, the exact thing streaming exists to prevent.
                on_scored(&w.id, &surprise);
                on_progress(Progress {
                    done: done.fetch_add(1, Ordering::Relaxed) + 1,
                    total,
                });
                (w.id.clone(), surprise)
            })
            .collect();

        // Cached scores land in the same map, so a resumed scan paints its recovered
        // wedges in the very first frame instead of re-deriving them.
        let upgrades: std::collections::HashMap<String, Reading> =
            cached.into_iter().chain(scored).collect();
        cache.flush();
        apply_model_scores(&mut tree, &upgrades);
        tree.aggregate();
        // `aggregate` rebuilds every directory score from its children, which zeroes the
        // commit counts again — so this has to follow EVERY aggregate, not just the first.
        apply_dir_history(&mut tree, &history);
    }

    let mut functions = 0;
    tree.visit(&mut |n| {
        if n.kind == NodeKind::Func {
            functions += 1;
        }
    });

    // Written at the end as well as every `FLUSH_EVERY`, so a scan that finishes under the
    // flush threshold — which is every small repo — still leaves something behind.
    scans.save();

    Ok(Scan {
        root: tree,
        stats: ScanStats {
            files_scanned,
            files_skipped: total_found.saturating_sub(files_scanned),
            functions,
            without_history: history.is_empty(),
            model: model.label(),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::surprise::HeuristicModel;
    use std::fs;

    fn fixture() -> tempfile::TempDir {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("src/deep/nest");
        fs::create_dir_all(&src).unwrap();
        fs::write(
            src.join("a.rs"),
            "/// Adds.\nfn add(a: u32) -> u32 { a + 1 }\nfn sub(a: u32) -> u32 { a - 1 }\n",
        )
        .unwrap();
        // Ignored, and the reason the tool is usable at all on a real project.
        fs::write(dir.path().join(".gitignore"), "vendor/\n").unwrap();
        fs::create_dir_all(dir.path().join("vendor")).unwrap();
        fs::write(dir.path().join("vendor/huge.rs"), "fn vendored() { }\n").unwrap();
        dir
    }

    /// Ordering fidelity may drop the all-pairs term. It may not drop the tree.
    ///
    /// The app scans at `Ordering` and the whole UI is built on what comes back, so the
    /// shape — files, functions, lines, ids — has to be identical to what `Full` produces.
    /// Only the surprise number is allowed to differ, and only because at `Ordering` the
    /// distinctiveness term reports `UNDECIDED` instead of measuring.
    #[test]
    fn ordering_fidelity_changes_the_score_and_nothing_else() {
        let dir = fixture();
        let full = run(dir.path());
        let m = Memos::ephemeral();
        let fast = scan(
            dir.path(),
            &HeuristicModel,
            &|_| {},
            &|_, _: &Reading| {},
            &AtomicBool::new(false),
            Memos { scores: &m.0, scans: &m.1 },
            Fidelity::Ordering,
        )
        .unwrap();

        assert_eq!(full.stats.functions, fast.stats.functions);
        assert_eq!(full.stats.files_scanned, fast.stats.files_scanned);
        assert_eq!(full.root.loc, fast.root.loc);

        let ids = |s: &Scan| {
            let mut v = Vec::new();
            s.root.visit(&mut |n| {
                if n.kind == NodeKind::Func {
                    v.push(n.id.clone());
                }
            });
            v.sort();
            v
        };
        assert_eq!(ids(&full), ids(&fast), "the tree must not depend on fidelity");
        assert!(
            !ids(&fast).is_empty(),
            "fixture should parse some functions, or this proves nothing"
        );
    }

    fn run(dir: &Path) -> Scan {
        let m = Memos::ephemeral();
        scan(
            dir,
            &HeuristicModel,
            &|_| {},
            &|_, _: &Reading| {},
            &AtomicBool::new(false),
            Memos { scores: &m.0, scans: &m.1 },
            Fidelity::Full,
        )
        .unwrap()
    }

    #[test]
    fn gitignored_paths_never_enter_the_picture() {
        let dir = fixture();
        let s = run(dir.path());
        let mut names = Vec::new();
        s.root.visit(&mut |n| names.push(n.name.clone()));
        assert!(names.contains(&"add".to_string()), "{names:?}");
        assert!(!names.contains(&"vendored".to_string()), "{names:?}");
    }

    #[test]
    fn single_child_directory_chains_collapse_to_one_ring() {
        let dir = fixture();
        let s = run(dir.path());
        // src → deep → nest is one wedge, not three empty annuli.
        assert_eq!(s.root.children.len(), 1);
        assert_eq!(s.root.children[0].name, "src/deep/nest");
        // ...but the repo itself keeps its own name, however deep its only child chain.
        assert_eq!(s.root.name, dir.path().file_name().unwrap().to_string_lossy());
    }

    #[test]
    fn parents_are_exactly_as_wide_as_their_children() {
        let dir = fixture();
        let s = run(dir.path());
        let file = &s.root.children[0].children[0];
        let sum: u32 = file.children.iter().map(|c| c.loc).sum();
        assert_eq!(file.loc, sum);
        assert_eq!(s.root.loc, sum);
    }

    #[test]
    fn documentation_is_graded_not_discounted() {
        let dir = fixture();
        let s = run(dir.path());
        let mut by_name = BTreeMap::new();
        s.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                by_name.insert(n.name.clone(), n.score.unwrap());
            }
        });
        let add = by_name["add"];
        let sub = by_name["sub"];
        assert_eq!(sub.documented, 0.0, "no doc must mean nothing documented");
        assert!(add.documented > 0.0, "a real doc must be graded above nothing");
        // Temperature is deliberately NOT asserted to differ. Documentation used to
        // multiply into it, and the assertion here was `add <= sub` — which stayed green
        // when the multiplier was removed, because two identical bodies have identical
        // surprise and `<=` is satisfied by equality. A test that cannot fail is worse
        // than no test.
        //
        // Documentation now cools through the INSTRUMENT: the comment stack is in the
        // model's prompt and an agent reads it before predicting. That cannot be
        // asserted without a model, so it is not asserted here rather than being
        // approximated by something that would pass either way.
        assert_eq!(add.temperature(), add.surprise);
    }

    #[test]
    fn a_repo_without_git_says_so_rather_than_guessing() {
        let dir = fixture();
        let s = run(dir.path());
        assert!(s.stats.without_history);
        s.root.visit(&mut |n| {
            if let Some(score) = n.score {
                assert_eq!(score.age_days, None);
            }
        });
    }

    #[test]
    fn scanning_an_empty_directory_is_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let s = run(dir.path());
        assert_eq!(s.stats.functions, 0);
        assert_eq!(s.root.loc, 0);
    }
}
