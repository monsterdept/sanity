//! Walk a repo, parse it, score it, and hand back the tree the sunburst renders.

use crate::blame::Blame;
use crate::cache::{self, Cache};
use crate::churn::History;
use crate::heuristic::{self, Fingerprint};
use crate::model::{Lang, Node, NodeKind, Provenance, Score, Source};
use crate::parse::{self, FuncDef};
use crate::scancache::{Look, ScanCache};
use crate::surprise::{Hotspot, Item, Reading, SurpriseModel};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::{Duration, Instant};

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
/// Directory names that are somebody else's code by definition.
///
/// **Not a `.sanityignore` default, and the difference is the whole argument.** That file
/// is a judgement about a specific codebase — whether `tests-unit/` is noise or the most
/// interesting thing in the repo — and the tool provider cannot know it. This list is not a
/// judgement: a `node_modules` or a `site-packages` is installed dependencies, and nobody
/// opens a map of their repo to look at torch.
///
/// The Python names were missing, which cost a real minute of a user's machine. `venv` is
/// as ubiquitous as `node_modules` and was simply never added — the list grew from the
/// language that taught the lesson first. `.gitignore` normally hides these, but only
/// inside a git repo: the `ignore` walker requires one, so a directory that is not a repo
/// gets no ignore rules at all and every virtualenv under it is parsed. That path is
/// refused outright now (see `git_root`), and this list is the second line.
const VENDORED: &[&str] = &[
    "vendor",
    "vendored",
    "third_party",
    "thirdparty",
    "node_modules",
    "venv",
    ".venv",
    "site-packages",
    "__pycache__",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
];

/// The work tree `path` sits in, or `None` if it is not in a git repo at all.
///
/// **Refusing is the point.** A folder picker double-click navigates rather than selects,
/// so the panel can hand back the PARENT of the thing you meant — and `~/projects` is not a
/// repo, it is thirty of them. Nothing downstream noticed: with no repo there are no ignore
/// rules, so the walk went into every virtualenv it found, pinned every core for minutes,
/// and wrote a third of a gigabyte of cache, while the window said "Walking the repo…" and
/// the sidebar stayed empty. Every part of that is a symptom of one unasked question.
///
/// It is also the honest reading of what this tool measures. Age, churn and blame are all
/// git, `.sanity/` expects to be committed, and history replays commits — a directory with
/// no repo cannot answer four of the five lenses, and the one it could answer would be a
/// map of somebody's whole home directory.
pub fn git_root(path: &Path) -> Option<PathBuf> {
    let out = std::process::Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let root = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!root.is_empty()).then(|| PathBuf::from(root))
}

/// The git repositories sitting directly inside `path`, by name.
///
/// One level only. A folder of projects is the case worth catching, and walking deeper to
/// find it would be doing the expensive thing this refusal exists to avoid.
pub fn repos_inside(path: &Path) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(path) else {
        return Vec::new();
    };
    let mut found: Vec<String> = entries
        .flatten()
        .filter(|e| e.path().join(".git").exists())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    found.sort();
    found
}

/// What to tell someone who picked a directory that is not in a repo.
///
/// **It offers the way out rather than explaining the mistake.** The first version of this
/// spent its last sentence on a theory about how the folder picker behaves — that a
/// double-click navigates instead of choosing, so the dialog hands back the parent. That
/// theory was never verified, and it is probably wrong: a directory-choosing panel returns
/// the folder you have navigated INTO, which would be the project, not its parent. Shipping
/// it meant the app explained a user's own action back to them, confidently, from a guess.
///
/// What is not a guess is what is on disk. A folder holding thirty repositories is a folder
/// somebody meant to pick one thing out of, and naming them turns a refusal into a
/// direction. If it holds none, there is nothing to suggest and the message says only what
/// it knows.
pub fn not_a_repo(path: &Path) -> String {
    let need = "Sanity needs a git repository: age, churn and blame all come from git \
                history, and assessments are committed to the repo they describe.";
    let inside = repos_inside(path);
    if inside.is_empty() {
        return format!("{} is not a git repository.\n\n{need}", path.display());
    }
    let shown = inside.iter().take(3).cloned().collect::<Vec<_>>().join(", ");
    let rest = match inside.len() {
        n if n > 3 => format!(" and {} more", n - 3),
        _ => String::new(),
    };
    format!(
        "{} is not a git repository, but it contains {} of them — {shown}{rest}.\n\nOpen one \
         of those instead.\n\n{need}",
        path.display(),
        inside.len(),
    )
}

/// How many authors the window can colour, and therefore how many are worth sending.
///
/// Matches `CATEGORICAL` in `colorMode.ts`. Two copies of one number, which is the shape this
/// repo is careful about — but the alternative is the window asking Rust how long its own
/// palette is, and the cost of them disagreeing is small and visible: a name past the end
/// takes the same neutral as no name at all, which is what it would have taken anyway.
pub const AUTHOR_SLOTS: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanStats {
    pub files_scanned: usize,
    pub files_skipped: usize,
    pub functions: usize,
    /// True when the repo has no usable git history, so the stability axis is missing
    /// and every quadrant verdict is really only half a verdict. The UI must say so —
    /// silently downgrading the finding is how a map starts lying.
    pub without_history: bool,
    /// Commits reachable from HEAD, **not counting merges**. Part of what a repo IS,
    /// alongside its lines and its functions — and cheap: one `git rev-list --count`,
    /// milliseconds even on a large history, where `churn` walks a capped window and could
    /// not answer this anyway.
    ///
    /// **Merges are out because the replay does not walk them**, and the two numbers meet in
    /// the sidebar: a row saying `57k commits to trace` under a trace that had just reported
    /// itself finished was this count and `history`'s disagreeing about what a commit is.
    /// ceph is 163,916 commits and 122,791 without merges, so forty-one thousand of them
    /// could never be traced and sat in that line forever. A merge introduces no code of its
    /// own — `git log --no-merges` is what the walk asks for, for that reason — so counting
    /// them here was measuring one thing and reporting it against another.
    pub commits: usize,
    /// Everyone who has ever committed here, most commits first — see `churn::History`.
    ///
    /// **The window colours a person by their position in this list, and by nothing else.**
    /// Ranking authors by what they hold in whatever is on screen made a person's colour a
    /// property of the view: it changed when you drilled and it changed while a replay ran.
    /// One list per repo means one colour per person, on the live map and in every frame of
    /// its history.
    ///
    /// Capped at what the palette can actually hold plus a little slack — see `CATEGORICAL`.
    /// A repo with five hundred authors has no five hundred distinguishable colours, and a
    /// list that pretended otherwise would just be a longer tail of the same neutral.
    pub authors: Vec<String>,
    pub model: String,
    /// Call sites that reached a definition in this repo, and ones that did not.
    ///
    /// The diagnostic for the two wiring lenses, and the one number that can tell a bad rule
    /// from an ordinary repo. Most calls in any real file go to the standard library or to a
    /// dependency, so a low share is normal — but a repo at 2% means [`crate::edges::family`]
    /// or the grammar is wrong, and every ranking the lenses produce is noise. Reported
    /// rather than inferred, on the same rule `excluded` follows: a denominator nobody can
    /// see is how an instrument comes to overstate its own coverage.
    pub calls_resolved: u64,
    pub calls_unresolved: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scan {
    pub root: Node,
    pub stats: ScanStats,
    /// Who calls whom, and what is a copy of what — see [`crate::links`].
    ///
    /// **Skipped by serde, and stored beside the tree rather than in it.** Two consumers read
    /// this struct and neither should carry the table: the window is sent a `Scan` on every
    /// open and would receive a megabytes-long list of function names it has no use for until
    /// somebody clicks one, and `treecache` writes a `Scan` twice — once whole and once slim,
    /// the slim one existing precisely to be small. It rides in its own file under the same
    /// signature, which is what makes an absence here mean "not built yet" rather than "no
    /// neighbours".
    ///
    /// `Arc` because a `Scan` is cloned to be slimmed and a clone of the table would be the
    /// quadratic accident `slim` documents, one level up.
    #[serde(skip)]
    pub links: std::sync::Arc<crate::links::Links>,
}


/// One function's score, the moment it is known.
///
/// Streamed so the map can color in as the model works rather than staying gray until
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

/// Progress counts the unit the running phase works in, and NAMES that phase.
///
/// It used to be directories, which is a unit the user has no feel for and which is not
/// even proportional to work: one directory may hold a single tiny helper and the next
/// fifty long ones. With a model attached a scan can run for many minutes, so "3 / 37
/// directories" sitting under a blank window is the difference between waiting and
/// force-quitting. It then became functions, for the model pass — and outlived it: the two
/// phases that actually run count FILES, so the window was announcing the wrong noun over
/// the right number. The unit travels with [`Progress::counting`]'s phase for that reason.
#[derive(Debug, Clone, Serialize)]
pub struct Progress {
    pub done: usize,
    pub total: usize,
    /// What is being done, when a count cannot say it.
    ///
    /// **A wait needs a noun before it can have a fraction.** Both long jobs here spend
    /// their first seconds on work with no denominator — a scan reads a 300MB cache and
    /// walks five thousand commits of `git log` before it knows how many files it has; a
    /// trace reads a stored timeline and a hundred thousand commits of log before it knows
    /// how many frames there are. Reported as `0 / 0`, that is a bar at zero and the word
    /// "starting", for long enough to read as a button that missed the press.
    #[serde(default)]
    pub phase: String,
    /// The repo-relative path this tick is about, so the map can show where the scan IS.
    ///
    /// **A fraction says how much; it cannot say where.** The two long phases sweep the repo
    /// in a definite order — parse by directory, blame over the files the parse produced, so
    /// both run alphabetically — and none of that reached the window, which had a bar and a
    /// picture that stopped moving the moment the parse ended. The wedge lights up instead,
    /// on the same channel a reader's lease already uses: the map is the thing this app
    /// draws, so progress belongs on it rather than beside it.
    ///
    /// Empty when a phase has no single subject, which is most of them — a walk, a cache
    /// read, a `git log` are all about the repo rather than about a file in it.
    #[serde(default)]
    pub at: String,
    /// What `done` and `total` are counting, plural, for the window to print after them.
    ///
    /// **The unit is a property of the phase, so it cannot live in the window.** It was a
    /// literal there — `Scoring N / M functions` — written when the only counted phase was
    /// the model pass. That pass has not run since `OllamaModel` was removed; the two phases
    /// that do run count FILES, and both of them arrived under that sentence. A scan of linux
    /// therefore announced 111,029 *functions* over a number that was files, while the
    /// sidebar — which had its own literal, and the right one — said files beside it. One
    /// number, two nouns, in one window.
    #[serde(default)]
    pub unit: String,
    /// Which sub-step of a multi-step phase this tick belongs to, 1-based. `0` for a phase
    /// that has no sub-steps.
    ///
    /// **The gauge is chambers, so a tick has to say which chamber it fills.** A trace is three
    /// depths behind one control — the commit log, per-line blame, the replay — and the window
    /// draws them as three chambers of one pill rather than as one continuous fill, because
    /// they are a 1:10:100 cost ladder and a single bar at a third claims the cheapest step is
    /// a third of the wait.
    ///
    /// It is a NUMBER and not the phase string, which the window could have matched on and
    /// which would have worked. That is the arrangement `just tokens` was burned by once: a
    /// boundary located by searching for a heading, reworded an hour later, silently wrong
    /// afterwards. A boundary worth drawing is worth making structural.
    ///
    /// Not persisted anywhere — progress is live and nothing caches it — so `default` here is
    /// backwards compatibility on the wire only, and not the format change that annotation is
    /// on a stored record.
    #[serde(default)]
    pub step: u8,
}

impl Progress {
    /// A step of a countable job whose unit the caller has already established.
    pub fn at(done: usize, total: usize) -> Self {
        Progress {
            done,
            total,
            phase: String::new(),
            unit: String::new(),
            at: String::new(),
            step: 0,
        }
    }

    /// A job that has begun and cannot yet be counted.
    pub fn phase(what: &str) -> Self {
        Progress {
            done: 0,
            total: 0,
            phase: what.to_string(),
            unit: String::new(),
            at: String::new(),
            step: 0,
        }
    }

    /// A countable job that says which one it is and what it is counting.
    pub fn counting(what: &str, unit: &str, done: usize, total: usize) -> Self {
        Progress {
            done,
            total,
            phase: what.to_string(),
            unit: unit.to_string(),
            at: String::new(),
            step: 0,
        }
    }

    /// …and where it has got to. Separate from [`Progress::counting`] because most phases
    /// have no single subject and would pass an empty string.
    pub fn on(mut self, path: &str) -> Self {
        self.at = path.to_string();
        self
    }

    /// …and which chamber of its phase's gauge it fills — see [`Progress::step`].
    pub fn step(mut self, step: u8) -> Self {
        self.step = step;
        self
    }
}

/// The closest two progress reports may be delivered, in wall clock.
///
/// Fifty milliseconds is twenty a second, which is past what anybody reads off a moving
/// number and comfortably inside a frame. The ticks themselves stay per unit of work — a
/// count that skips is a count that lies about where it stopped.
const TICK_GAP: Duration = Duration::from_millis(50);

/// Rate-limit a progress sink, so a job that ticks a million times does not post a million
/// events.
///
/// **The long jobs here report per commit, and that number is now unbounded.** Every tick
/// crosses to the webview as a serialized event; at ceph's 122,792 commits that is a
/// hundred thousand messages for a bar with a few hundred readable positions, and the
/// kernel's 1.27 million would spend more time announcing the walk than walking. The work is
/// not the reporting, but the reporting is on the same thread as the work.
///
/// **A phase change is never dropped, whatever the clock says.** Phases are what the row
/// reads when there is no count — `counting commits`, `reading the log`, `walking` — and one
/// swallowed by the rate limit leaves the window naming a step that finished minutes ago.
/// The same goes for the last tick of a countable job: a bar that stops at 99% because its
/// final report landed inside the gap is the exact failure this whole area is about.
pub fn throttled(to: &dyn Fn(Progress)) -> impl Fn(Progress) + '_ {
    let last: std::cell::Cell<Option<Instant>> = std::cell::Cell::new(None);
    let phase = std::cell::RefCell::new(String::new());
    move |p: Progress| {
        let fresh = {
            let mut held = phase.borrow_mut();
            let changed = *held != p.phase;
            if changed {
                held.clear();
                held.push_str(&p.phase);
            }
            changed
        };
        let done = p.total > 0 && p.done >= p.total;
        let due = last.get().is_none_or(|t| t.elapsed() >= TICK_GAP);
        if fresh || done || due {
            last.set(Some(Instant::now()));
            to(p);
        }
    }
}

/// One file's shape, streamed the moment it parses.
///
/// **The map draws itself while the scan runs, and this is all it takes to draw it.** Width
/// is lines, so a wedge needs a name and a line count and nothing else; colour is a reading,
/// and during a scan there isn't one — the assembling map is entirely grey, which is the
/// same thing it says about unread code anywhere else.
///
/// Deliberately not a [`Node`]: a node carries scores, hotspots, docs and body hashes, none
/// of which exist yet at the moment this is emitted, and half of which are only known after
/// the blame pass. The two shapes are allowed to differ because the streamed one is thrown
/// away — the scan's real tree replaces it whole when it lands.
#[derive(Clone, serde::Serialize)]
pub struct ShapeFile {
    /// Repo-relative, which is what the receiving side builds its directories from.
    pub path: String,
    pub lang: Lang,
    /// `(name, lines)` per function, in file order.
    pub funcs: Vec<(String, u32)>,
}

/// One batch of streamed shape, and the project it belongs to.
///
/// **The key is on the wire because the window cannot infer it.** It tried: the owner of the
/// accumulated shape was taken to be the one project in the list that is `loading`. A restore
/// publishes every known project as loading up front, deliberately, so the sidebar fills in
/// at once — so that was whichever unfinished project happened to sort first, it changed
/// hands whenever any of them settled, and the map of the repo actually being parsed was
/// discarded halfway through drawing itself.
#[derive(Clone, serde::Serialize)]
pub struct ShapeBatch<'a> {
    pub project: &'a str,
    pub files: &'a [ShapeFile],
}

/// One progress tick, and the project it belongs to. Same argument as [`ShapeBatch`], and
/// they travel together: the tick is what lights a wedge on the map the batches drew, so a
/// tick that reached the wrong map would light nothing and say nothing about it.
#[derive(Clone, serde::Serialize)]
pub struct Tick<'a> {
    pub project: &'a str,
    pub progress: &'a Progress,
}

fn shape_of(files: &[ParsedFile]) -> Vec<ShapeFile> {
    files
        .iter()
        .map(|f| ShapeFile {
            path: f.rel_path.clone(),
            lang: f.lang,
            funcs: f.funcs.iter().map(|d| (d.name.clone(), d.loc())).collect(),
        })
        .collect()
}

/// Collect the parseable source files under `root`.
///
/// `ignore::WalkBuilder` honors .gitignore/.ignore for free — the same matcher ripgrep
/// uses. This is not a nicety: without it `node_modules` and `target` are the two
/// biggest wedges in every JavaScript and Rust project on earth, and the picture says
/// nothing about the code the user wrote.
pub(crate) fn collect_files(root: &Path) -> Vec<(PathBuf, Lang)> {
    ignore::WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .parents(true)
        // Honor .gitignore even when the directory isn't a git repo. `ignore` defaults
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
    /// The module's own banner, if it has one — see [`parse::file_doc`]. It reaches the
    /// file node's `doc`, every function's `reading_hash`, and through both the comment
    /// stack a reader is handed before it predicts.
    file_doc: Option<String>,
    prints: Vec<Fingerprint>,
    head: String,
    /// FNV of the file's bytes, carried out of the parse so the blame pass can ask the
    /// cache about this exact content without stat-ing or reading the file a second time.
    hash: u64,
    /// The file's length in bytes, from the same [`Ident`] the hash came out of.
    ///
    /// It reaches the file node's `bytes`, which is what decides whether a FILE task can be
    /// served — a file reading is revealed whole, so its extent is the whole file, and the
    /// largest one in the corpus so far is 856KB. Carried rather than measured because the
    /// cache gates on it either way: it is free on a hit and free on a miss.
    len: u64,
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
pub fn scope_of(root: &Path) -> Option<ignore::gitignore::Gitignore> {
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
///
/// **The NEAREST siblings, not the first two in the file.** It filtered out the function
/// being scored and then took from the top, so every function past the second was handed the
/// same opening pair of the file while the first two got a window that shifted around them —
/// the context a function was scored against depended on where in the file it happened to
/// sit, which is a property of the layout rather than of the code. A reader found it from
/// the far end.
///
/// Adjacency is the point, and it is the same argument `PEER_WINDOW` makes on the MCP side:
/// what establishes house style is the handlers either side of this one, the ones a person
/// scrolling past would see. The opening two functions of a file are not that unless you are
/// near the top of it.
fn context_for(file: &ParsedFile, skip: usize) -> String {
    let mut out = file.head.clone();
    // Centered on the function, then clamped — so one near the top or the bottom still gets a
    // full window, from whichever side has neighbors.
    let half = CONTEXT_SIBLINGS / 2;
    let start = skip.saturating_sub(half.max(1));
    for f in file
        .funcs
        .iter()
        .enumerate()
        .skip(start)
        .filter(|(i, _)| *i != skip)
        .take(CONTEXT_SIBLINGS)
        .map(|(_, f)| f)
    {
        out.push_str("\n\n");
        out.push_str(&f.signature);
        let body: String =
            f.body.lines().take(CONTEXT_SIBLING_LINES).collect::<Vec<_>>().join("\n");
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
    let excluded = scope.is_some_and(|s| s.matched_path_or_any_parents(path, false).is_ignore());

    let (funcs, file_doc, head, hash, len) = match cache.look(&rel_path, path, None) {
        Look::Unreadable => return None,
        Look::Hit(hit) => (hit.funcs, hit.file_doc, hit.head, hit.ident.hash, hit.ident.len),
        Look::Miss { src, ident } => {
            if src.lines().any(|l| l.len() > MINIFIED_LINE_BYTES) {
                return None;
            }
            let funcs = parse::parse_functions(lang, &src);
            if funcs.is_empty() {
                return None;
            }
            // The module's banner, parsed here beside its functions — one pass over the
            // bytes, one cache entry, so a file's header cannot go stale against its own
            // parse. See `parse::file_doc`.
            let file_doc = parse::file_doc(lang, &src);
            let head = src.lines().take(CONTEXT_HEAD_LINES).collect::<Vec<_>>().join("\n");
            cache.put_parse(&rel_path, &ident, lang, &funcs, file_doc.as_deref(), &head);
            (funcs, file_doc, head, ident.hash, ident.len)
        }
    };
    let prints = print(&funcs);
    Some(ParsedFile {
        rel_path,
        lang,
        funcs,
        file_doc,
        prints,
        head,
        hash,
        len,
        // Parsed even when excluded, rather than skipped in the walk. Scanning is seconds
        // and readers are millions of tokens, so the cheap thing is to know exactly how
        // much was set aside and say so. An exclusion nobody can count is how a map claims
        // completeness over a subset.
        excluded,
    })
}

/// What a scan of this repo may cost before somebody has to be asked.
///
/// **Its own number, and it is not the trace's**, because the two phases are unrelated work
/// with unrelated shapes: a trace scales with commits × paths and a scan scales with files and
/// their size. Sharing one constant would tie them together for no reason other than that
/// they were both written down here. Ten seconds, the same value, arrived at separately.
pub const BUDGET: std::time::Duration = std::time::Duration::from_secs(10);

/// Milliseconds per file for a repo this machine has never scanned.
///
/// Measured across the corpus on a release build — kibana 0.16, ceph 0.48, linux 0.50 — and
/// deliberately the pessimistic end of it, because the cost of over-estimating is one dialog
/// somebody dismisses and the cost of under-estimating is the wait this exists to prevent.
/// A repo that has been scanned here uses its OWN measured rate instead (`KnownProject::
/// scan_ms`), which is what makes a debug build price itself honestly without anyone
/// hard-coding two constants.
const COLD_MS_PER_FILE: f32 = 0.5;

/// What the next scan of `repo` would cost, and how much of that is known.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Estimate {
    /// Seconds, at this repo's own measured rate where it has one.
    pub seconds: f32,
    /// Files the last scan found. `None` where none has finished here.
    pub files: Option<usize>,
    /// Nothing has scanned this repo on this machine, so both the count and the rate are
    /// inferred. Said out loud, so nothing prints a guess as a stopwatch.
    pub cold: bool,
    /// Whether it fits [`BUDGET`].
    pub fits: bool,
}

/// Price a scan from what the last one cost — see [`crate::reports::KnownProject::scan_ms`].
///
/// **Free, and that is the whole design.** The count and the rate are both banked by the
/// previous scan, so deciding costs a lookup rather than a walk — which matters at a launch
/// restoring every project, where paying a directory walk apiece to decide would be most of
/// what the gate is trying to save.
///
/// A repo with no bank is priced from its file count if the caller has walked it and from
/// nothing at all if not — in which case the estimate is `None` files, zero seconds and
/// `fits`, because refusing to scan a repo nobody can price would leave somebody with a row
/// that cannot be acted on. **The gate errs toward doing the work**; what it must never do is
/// spend a minute silently, and a repo whose size is unknown is one walk from being known.
pub fn estimate(files: Option<usize>, scan_ms: Option<u64>) -> Estimate {
    let rate = match (files, scan_ms) {
        (Some(n), Some(ms)) if n > 0 => ms as f32 / n as f32,
        _ => COLD_MS_PER_FILE,
    };
    let seconds = files.map(|n| n as f32 * rate / 1000.0).unwrap_or(0.0);
    Estimate {
        seconds,
        files,
        cold: scan_ms.is_none(),
        fits: seconds <= BUDGET.as_secs_f32(),
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

/// Score every function in one directory.
///
/// Scoring is grouped by directory rather than by file for one reason: a function needs
/// peers to be compared against, and plenty of real files hold exactly one function. A
/// lone function with no peers scores an undecided 0.5 distinctiveness (see
/// `heuristic::distinctiveness`), so without the directory fallback every
/// one-function-per-file codebase — which is most React frontends — would have its
/// strongest signal switched off.
fn score_dir(
    files: &[ParsedFile],
    // Index of this directory's first file in the flat list [`edges::wire`] was given.
    // Passed rather than recomputed because the wiring is repo-wide by construction and the
    // scoring pass is per directory: a directory cannot know its own offset, and a second
    // flattening here would be a second chance to disagree with the first.
    base: usize,
    wiring: &crate::edges::Wiring,
    // Repo-wide for the same reason the wiring is: a copy is a relation between two
    // functions that are usually in different directories, so it cannot be found from
    // inside one.
    copies: &crate::clones::Copies,
    history: &History,
    blame: &Blame,
    fidelity: Fidelity,
) -> Vec<(String, Node)> {
    let dir_prints: Vec<&Fingerprint> = files.iter().flat_map(|f| f.prints.iter()).collect();

    files
        .iter()
        .enumerate()
        .map(|(fi, file)| {
            // One lookup for the file, one per function under it — and the SAME one a
            // deferred trace uses, so a map drawn with git in hand and one that gets git
            // afterwards cannot come out different. See `trace::apply`.
            let file_trace = crate::trace::FileTrace::of(&file.rel_path, history, blame);

            let ords = ordinals(&file.funcs);
            let children: Vec<Node> = file
                .funcs
                .iter()
                .enumerate()
                .map(|(i, func)| {
                    // Its own history where blame could read it, its file's otherwise — see
                    // `FileTrace::func`, which is where that rule now lives.
                    let crate::trace::FuncTrace {
                        churn,
                        age_days,
                        commits,
                        last_touched_days,
                        last_author,
                    } = file_trace.func(func.start_line, func.end_line);
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
                    let measured =
                        heuristic::documented(func.doc.as_deref(), &func.signature, &func.body);
                    let provenance =
                        if func.doc.is_some() { Provenance::Source } else { Provenance::None };

                    let wire = wiring.at(base + fi, i);
                    let copy = copies.at(base + fi, i);

                    let node = Node {
                        id: crate::assessment::key_of(&file.rel_path, &func.name, ords[i]),
                        name: func.name.clone(),
                        kind: NodeKind::Func,
                        excluded: false,
                        doc: func.doc.clone(),
                        signature: Some(func.signature.clone()),
                        owner: func.owner.clone(),
                        body: Some(crate::assessment::reading_hash(
                            file.file_doc.as_deref(),
                            func.doc.as_deref(),
                            &func.body,
                        )),
                        end_line: Some(func.end_line),
                        // Signature plus body — the extent `reveal` cuts out of the file.
                        // Not `loc`: a 3,711-line function is 177KB and a 3,711-line one of
                        // single-token lines is a tenth of that, and it is the bytes that
                        // have to fit through a tool result. See `Node::bytes`.
                        bytes: Some(
                            (func.signature.len() + func.body.len()).try_into().unwrap_or(u32::MAX),
                        ),
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
                            // A function's lifetime count would be `git log -L`, a process
                            // apiece — see `Score::all_commits`, which is `None` here for
                            // that reason and not for want of history.
                            all_commits: None,
                            last_touched_days,
                            provenance,
                            // Leaves don't have a share of anything; `aggregate` reads
                            // their temperature directly to build their parents'.
                            hot_share: 0.0,
                            source: Source::Proxy,
                            analyzed_share: 0.0,
                        }),
                        hotspots: Vec::new(),
                        // `Option` all the way from `edges` to the wedge. A language whose
                        // call shape has never been parsed has no `Wire` at all, and the
                        // absence has to survive every hop — the moment it becomes a zero it
                        // reads as "nothing calls this", which is the finding this lens
                        // exists to make, asserted about code nobody looked at.
                        callers: wire.map(|w| w.callers),
                        calls: wire.map(|w| w.calls),
                        incident: wire.map(|w| w.incident),
                        away: wire.map(|w| w.away),
                        // A function is its own denominator of one. Written here rather than
                        // derived in `aggregate` so the leaf and the container carry the same
                        // pair of numbers meaning the same thing — see `Node::resolvable`.
                        resolvable: wire.map(|_| 1),
                        orphans: wire.map(|w| u32::from(w.callers == 0)),
                        sinks: wire.map(|w| u32::from(w.calls == 0)),
                        clone_group: copy.map(|c| c.group),
                        clone_size: copy.map(|c| c.size),
                        // A body too small to compare is an absence, not a unique function —
                        // see `MIN_SHAPE_TOKENS`. `None` paints gray, which is the honest
                        // answer to a question nobody asked of it.
                        comparable: func.shape.map(|_| 1),
                        copied: func.shape.map(|_| u32::from(copy.is_some())),
                        children: Vec::new(),
                        funcs: 0,
                    };
                    node
                })
                .collect();

            let name = file.rel_path.rsplit('/').next().unwrap_or(&file.rel_path).to_string();
            (
                file.rel_path.clone(),
                Node {
                    id: file.rel_path.clone(),
                    name,
                    kind: NodeKind::File,
                    excluded: file.excluded,
                    // The module's banner, and the second half of the comment stack a
                    // reader is handed — `collect_tasks` reads it straight off this field
                    // and appends it under the function's own doc. See `parse::file_doc`.
                    doc: file.file_doc.clone(),
                    signature: None,
                    owner: None,
                    // What a reading OF THIS FILE was taken against: its header, and the
                    // surface that header claims to describe.
                    //
                    // Not the file's text. A file reading answers "does this banner describe
                    // what is in here", and editing one function body does not change the
                    // answer — hashing the bytes would expire every file reading on every
                    // commit and train people to ignore the flag. The surface is what a
                    // reader is handed: the signatures, in order. Add, remove, rename or
                    // re-type a function and the file genuinely became a different file to
                    // describe; rewrite an implementation and it did not.
                    body: Some(crate::assessment::reading_hash(
                        None,
                        file.file_doc.as_deref(),
                        &file_surface(&file.funcs),
                    )),
                    end_line: None,
                    // The whole file, because that is what a file task is served. Its own
                    // length rather than the sum of its functions': the header, the imports
                    // and everything between the declarations all reach the reader too.
                    bytes: Some(file.len.try_into().unwrap_or(u32::MAX)),
                    path: file.rel_path.clone(),
                    loc: 0, // filled by aggregate()
                    line: None,
                    lang: Some(file.lang),
                    last_author: file_trace.last_author(),
                    score: None,
                    hotspots: Vec::new(),
                    // A file is not called and does not call; its functions are. Rolled up in
                    // the browser instead, as a share, the way `hot_share` and `opaqueShare`
                    // are — and for the same reason, that a mean over a container's leaves
                    // converges on the repo's mean and says nothing.
                    callers: None,
                    calls: None,
                    incident: None,
                    away: None,
                    // Filled by `aggregate` from the functions inside — see `Node::resolvable`.
                    resolvable: None,
                    orphans: None,
                    sinks: None,
                    clone_group: None,
                    clone_size: None,
                    comparable: None,
                    copied: None,
                    children,
                    funcs: 0,
                },
            )
        })
        .collect()
}

/// Which same-named function in this file each one is, counting from zero in file order.
///
/// The other half of [`crate::assessment::key_of`], and the reason a function's identity can
/// be its durable key rather than its line: `path#name` is not unique — Swift files hold a
/// dozen `init`s and Rust files hold same-named methods in different `impl` blocks — so the
/// position among twins is what tells them apart, and unlike a line number it survives every
/// edit above them.
///
/// Computed once per file and shared by the two places an id is minted. They were two
/// `format!` calls with the same string in them, which is one drift away from a tree whose
/// nodes and whose scores are keyed differently.
pub fn ordinals(funcs: &[crate::parse::FuncDef]) -> Vec<usize> {
    let mut seen: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
    funcs
        .iter()
        .map(|f| {
            let n = seen.entry(f.name.as_str()).or_insert(0);
            let this = *n;
            *n += 1;
            this
        })
        .collect()
}

/// What a file's header claims to describe: its declarations, in file order.
///
/// The stable half of a file. Shared by the scan and by `resync_changed`, which has to
/// produce the identical string from the identical bytes — two implementations of this
/// would make a file reading flip between current and expired on alternate opens.
pub fn file_surface(funcs: &[crate::parse::FuncDef]) -> String {
    funcs.iter().map(|f| f.signature.as_str()).collect::<Vec<_>>().join("\n")
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

/// Replace proxy surprise with the model's, marking those leaves analyzed.
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
#[allow(clippy::too_many_arguments)]
pub fn scan(
    root: &Path,
    model: &dyn SurpriseModel,
    on_progress: &(dyn Fn(Progress) + Sync),
    // Called with (function id, reading) the instant each score is known.
    on_scored: &(dyn Fn(&str, &Reading) + Sync),
    // Called with one directory's files the instant they parse, so the window can draw the
    // repo taking shape instead of a bar. See [`ShapeFile`].
    on_shape: &(dyn Fn(&[ShapeFile]) + Sync),
    // Set to stop the model pass early. Everything already scored is kept — with no
    // length filter, being able to stop IS the cost control, so this is load-bearing
    // rather than a convenience.
    cancel: &AtomicBool,
    memos: Memos<'_>,
    fidelity: Fidelity,
    // How much git to read, and whether to read any — see [`crate::trace::Depth`]. The two
    // long phases of a scan of a large repo are both git, and neither is needed to draw the
    // map: on ceph they are 210s of a 214s cold scan against 1.97s of parsing.
    depth: crate::trace::Depth,
) -> anyhow::Result<Scan> {
    let Memos { scores: cache, scans } = memos;
    // **What each phase costs, when asked.** Every performance decision in this file — the
    // ephemeral score cache, `Fidelity::Ordering`, the shape stream — rests on a measurement
    // of one phase against the others, and those were taken on repos of a few hundred files.
    // `SANITY_TIMING=1` prints the same numbers for whatever you point it at.
    let timing = std::env::var_os("SANITY_TIMING").is_some();
    let mut mark = std::time::Instant::now();
    let mut lap = |what: &str| {
        if timing {
            eprintln!("  {what:>22}: {:>7.2}s", mark.elapsed().as_secs_f64());
            mark = std::time::Instant::now();
        }
    };
    // **Each phase says it has started, before it can say how far along it is.**
    // `done: 0` with a total is the shape the window reads as "this phase, nothing done
    // yet" — see `ProgressPane`. Without them a scan of a large repo spent its first
    // seconds under one word, `walking`, while it did three unrelated things: a filesystem
    // walk, a `git log` over five thousand commits, and a 300MB cache read.
    on_progress(Progress::phase("walking the repo"));
    let files = collect_files(root);
    let total_found = files.len();
    lap("walk");

    // **The answer, if last time's is still the answer.** See `treecache`: the signature is
    // what this scan depends on — every walked file's mtime and length, HEAD, the parse
    // version and the fidelity — and computing it costs the walk that has just happened.
    //
    // Only for the proxy. A model pass writes different scores into the same shape, and it
    // streams them as it goes; handing it a finished tree would skip the very work it was
    // asked to do.
    let signature =
        (!model.is_model()).then(|| crate::treecache::signature(root, &files, fidelity, depth));
    if let Some(sig) = signature {
        if let Some(cached) = crate::treecache::load(root, sig) {
            on_progress(Progress::phase("reading the cached map"));
            lap("cached");
            return Ok(cached);
        }
    }

    let scope = scope_of(root);
    // Reported as its own phase because it is one: `git log --name-only` over the churn
    // window, measured at 3.5s on ceph, with nothing else happening.
    // Named for the log it reads, not for "history", because the blame pass below is also
    // history and is the one that takes the hours. Two phases with the same noun on the
    // same bar is the ambiguity this whole run of naming exists to remove.
    let history = if depth == crate::trace::Depth::Untraced {
        // Not "this repo has no history" — nobody has asked for it yet. `trace::apply` fills
        // these fields in later, and the map says which of the two it is meanwhile.
        History::default()
    } else {
        // Uninterruptible here on purpose: a scan's own stop is checked per FILE in the parse,
        // and this walk is one of the phases that runs before there are files to count. The
        // window's Trace button is the path with a stop on it.
        crate::trace::depth1(root, &std::sync::atomic::AtomicBool::new(false), &|seen| {
            on_progress(Progress::counting("reading the commit log", "commits", seen, 0).step(1))
        })
        .unwrap_or_default()
    };
    lap("churn");

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
    // **The phases that actually run report themselves.** Every `on_progress` call used to
    // sit inside the model pass, which the app has not run since `OllamaModel` was removed —
    // so a scan of a large repo showed a bar that could not move for minutes, sweeping to say
    // "something is happening" because nothing could say what. Parsing and blaming are the
    // two long phases and they are both countable.
    // Under its own name, before the parse rather than inside it — see `ScanCache::warm`.
    // The parse cannot report a fraction until it has this, and on a large repo reading it
    // takes far longer than the phase whose label would otherwise be left on screen.
    on_progress(Progress::phase("reading the cached scan"));
    scans.warm();
    lap("cache");

    let parsed = AtomicUsize::new(0);
    let parsed_dirs: Vec<Vec<ParsedFile>> = by_dir
        .par_iter()
        // **Stoppable, per directory.** A cold parse of a repo of a hundred thousand files is
        // the other phase somebody can be left waiting on, and what it has done survives being
        // stopped the same way the blame does: `scancache` holds every file it got through.
        // The tree it would have built does not survive, and must not — a tree missing the
        // directories nobody reached is a map that quietly understates the repo.
        .filter(|_| !cancel.load(Ordering::Relaxed))
        .map(|(dir, entries)| {
            let files: Vec<ParsedFile> = entries
                .iter()
                .filter_map(|(p, lang)| parse_file(root, p, *lang, fidelity, scope.as_ref(), scans))
                .collect();
            // Streamed HERE, from inside the parallel map, for the same reason `on_scored`
            // is: reported after the loop, nothing would reach the window until the whole
            // parse finished — and on a repo the size of ceph the parse is not even the
            // long part. What follows it is the blame pass, which is minutes, and which the
            // map can sit fully drawn through instead of blank.
            on_shape(&shape_of(&files));
            on_progress(
                Progress::counting(
                    "parsing",
                    "files",
                    parsed.fetch_add(files.len(), Ordering::Relaxed) + files.len(),
                    total_found,
                )
                // The directory, because that is the unit this phase works in — the files
                // themselves are already arriving on `on_shape` and drawing themselves.
                .on(dir),
            );
            files
        })
        .collect();

    lap("parse");
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
    let for_blame: Vec<(String, u64)> =
        parsed_dirs.iter().flatten().map(|f| (f.rel_path.clone(), f.hash)).collect();
    // **Counted from zero, under its own name.** It used to continue the parse's numbering —
    // one bar from the top of the scan, on the argument that the two phases are one wait as
    // far as anybody watching is concerned, and that a bar which fills, empties and fills
    // again reads as a false start. What that actually produced was a bar whose two halves
    // run at wildly different speeds with nothing on screen saying so: parsing linux is
    // 57k files in a couple of minutes, blaming them is one `git blame --line-porcelain`
    // apiece against a history that deep, and the join is invisible. The window reported
    // "~<1 min left" — an ETA averaged over a rate that had already stopped applying — while
    // hours of work remained, and the honest reading of a bar that crawls after moving fast
    // is that the scan has hung. A phase boundary the viewer can see is worth a bar that
    // restarts; a false start is a smaller lie than a false estimate.
    let blamed = AtomicUsize::new(0);
    let blame = if depth == crate::trace::Depth::Lines {
        Blame::read(root, &for_blame, &history, scans, cancel, &|path: &str| {
            on_progress(
                Progress::counting(
                    "reading per-line history",
                    "files",
                    blamed.fetch_add(1, Ordering::Relaxed) + 1,
                    for_blame.len(),
                )
                .on(path),
            );
        })
    } else {
        // Depth 1 without depth 2 is the resolution the fallback in `FileTrace::func` has
        // always described: every function takes its file's numbers. Blocky rings under Age
        // and Churn, and honestly so.
        Blame::default()
    };

    lap("blame");
    if cancel.load(Ordering::Relaxed) {
        // Reported rather than returned. Half a parse is not a smaller map, it is a WRONG
        // one — every wedge is drawn from lines that were counted, so the directories the
        // walk never reached simply would not be there and nothing on screen would say so.
        // The caller keeps the tree it had; the work is in the cache for the next attempt.
        anyhow::bail!("stopped");
    }
    // A repo shrinks as well as grows, and an entry nobody asks about again is never
    // invalidated by anything — without this a cache would carry every file of every
    // branch anyone had ever checked out.
    scans.retain(&for_blame.iter().map(|(p, _)| p.clone()).collect());
    let is_model = model.is_model();

    // Call edges, repo-wide, before anything is scored. It has to be one pass over every
    // file at once — a call in `web/src/App.tsx` resolves against a definition three
    // directories away, so the per-directory scoring pass below is exactly the wrong shape
    // to compute it in. Cheap: it reads the `calls` the parse already collected and does not
    // touch a file.
    let flat: Vec<crate::edges::FileView<'_>> = parsed_dirs
        .iter()
        .flatten()
        .map(|f| crate::edges::FileView { path: &f.rel_path, lang: f.lang, funcs: &f.funcs })
        .collect();
    // **Named, because everything from here to the tree used to be silent.** The parse and
    // the blame both count themselves and then hand over to four phases that did not — so on
    // a large repo the row sat on the blame's final `5,302 / 5,302 files` for as long as the
    // rest took, which reads as a scan that finished and then hung. It was reported as one.
    // These two are single passes over what is already in memory and are over in moments;
    // they get a name rather than a count because there is nothing to divide.
    on_progress(Progress::phase("wiring the call graph"));
    let wiring = crate::edges::wire(&flat);
    on_progress(Progress::phase("finding copies"));
    let copies = crate::clones::find(&flat);
    // Where each directory's files start in `flat`. A prefix sum over the same iteration
    // order the flattening used, which is the only thing that makes the two agree.
    let mut offsets: Vec<usize> = Vec::with_capacity(parsed_dirs.len());
    let mut acc = 0usize;
    for d in &parsed_dirs {
        offsets.push(acc);
        acc += d.len();
    }

    // Build the whole tree from the proxy first. It is fast, it is entirely gray (no
    // wedge claims to have been analyzed), and it means the user has the repo's shape on
    // screen in about a second instead of after the model finishes.
    // Counted in FILES rather than directories, because directories are wildly uneven — one
    // holding four hundred files and the next holding two would make a bar that jumps and
    // then stops. Files are also the unit the two phases before this counted in, so the
    // number keeps meaning the same thing across the whole scan.
    let scored = AtomicUsize::new(0);
    let to_score: usize = parsed_dirs.iter().map(|d| d.len()).sum();
    let per_dir: Vec<Vec<(String, Node)>> = parsed_dirs
        .par_iter()
        .enumerate()
        .map(|(di, parsed)| {
            let out = score_dir(parsed, offsets[di], &wiring, &copies, &history, &blame, fidelity);
            // After the directory rather than during it: `score_dir` is one call per
            // directory and splitting it to report inside would be reshaping the work to
            // suit the narration. At `Full` fidelity a big directory is the slow unit here,
            // which is exactly what a reader watching this needs to be able to see.
            on_progress(Progress::counting(
                "scoring",
                "files",
                scored.fetch_add(parsed.len(), Ordering::Relaxed) + parsed.len(),
                to_score,
            ));
            out
        })
        .collect();

    lap("score");
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
    crate::trace::apply_dir_history(&mut tree, &history);
    lap("tree");

    // ── The model pass, in priority order ────────────────────────────────────────
    //
    // Forced decoding costs a decode step per token, so a large repo takes hours. Rather
    // than make the user wait for all of it, the work is ordered by how much it could
    // possibly matter — lines × the proxy's guess at surprise — and streamed
    // as it lands. The most consequential wedges color in within the first minutes, and
    // stopping early costs the least valuable results rather than an arbitrary
    // directory's worth. Total runtime stops being the number that matters.
    if is_model {
        // The proxy scores already live on the gray tree; read them back rather than
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
                let ords = ordinals(&file.funcs);
                for (i, func) in file.funcs.iter().enumerate() {
                    let id = crate::assessment::key_of(&file.rel_path, &func.name, ords[i]);
                    let ck =
                        cache::key(&file.rel_path, &func.name, &func.body, func.doc.as_deref());
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
            b.priority.partial_cmp(&a.priority).unwrap_or(std::cmp::Ordering::Equal)
        });

        let total = work.len();
        if total == 0 {
            // Everything was cached. Still emit one tick so the UI doesn't sit on a
            // stale "0 / 0" from a previous run.
            on_progress(Progress::at(0, 0));
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
                // finished — which on a repo this size is hours of a gray map with a
                // moving progress bar, the exact thing streaming exists to prevent.
                on_scored(&w.id, &surprise);
                on_progress(Progress::counting(
                    "scoring",
                    "functions",
                    done.fetch_add(1, Ordering::Relaxed) + 1,
                    total,
                ));
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
        crate::trace::apply_dir_history(&mut tree, &history);
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

    let links = std::sync::Arc::new(crate::links::Links::build(&flat, &wiring, &copies));
    let scan = Scan {
        links: links.clone(),
        root: tree,
        stats: ScanStats {
            files_scanned,
            files_skipped: total_found.saturating_sub(files_scanned),
            functions,
            without_history: history.is_empty(),
            // Capped where the palette stops meaning anything — see `ScanStats::authors`.
            authors: history.authors().iter().take(AUTHOR_SLOTS).cloned().collect(),
            // Out of the walk that just ran rather than a `git rev-list` of its own — see
            // `trace::apply`, which fills this the same way when the trace arrives later.
            // Zero means "print no count" rather than "a repo with none".
            commits: history.total_commits_of("").unwrap_or(0) as usize,
            model: model.label(),
            calls_resolved: wiring.resolved,
            calls_unresolved: wiring.unresolved,
        },
    };
    // Kept under the signature computed before the work started, so the next launch of this
    // repo — unchanged, which is the normal case — reads this instead of deriving it again.
    // A cancelled model pass never gets here, which is right: half a pass is not an answer.
    if let Some(sig) = signature {
        crate::treecache::save(root, sig, &scan);
    }
    lap("save");
    Ok(scan)
}

#[cfg(test)]
mod tests {
    /// **The gate errs toward doing the work, and never toward a silent minute.**
    ///
    /// Four states, and the one that catches people out is the last: a repo nobody has scanned
    /// here has no count and no rate, and refusing it would leave a row that cannot be acted
    /// on — a question with no way to answer it. What the budget is for is the case where the
    /// size IS known and is large.
    #[test]
    fn a_scan_is_priced_from_the_last_one_and_an_unknown_size_is_not_refused() {
        // Measured on this machine: 59,008 files in 9.3s is 0.16ms a file.
        let kibana = super::estimate(Some(59_008), Some(9_310));
        assert!(!kibana.cold, "a repo with a banked rate is priced from it");
        assert!(kibana.fits, "nine seconds is under the budget");

        // The same repo through a build that parses five times slower — which is what a debug
        // binary is, and the reason the rate is measured rather than assumed.
        let slow = super::estimate(Some(59_008), Some(46_550));
        assert!(!slow.fits, "forty-six seconds is not, and the same repo has to ask");

        let huge = super::estimate(Some(45_748), Some(120_000));
        assert!(!huge.fits && huge.seconds > 60.0, "two minutes asks");

        let unknown = super::estimate(None, None);
        assert!(unknown.cold, "nothing has measured this, and the estimate says so");
        assert_eq!(unknown.files, None, "a count nobody counted is not reported");
        assert!(
            unknown.fits,
            "a repo whose size is unknown is one walk from being known — refusing it would \
             leave a row with a question and no way to answer it"
        );
    }

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

    /// The neighbour table is built by the scan that produced the tree, and describes the
    /// same functions.
    ///
    /// **Written because an empty table is indistinguishable from a repo with no wiring.**
    /// `Scan::links` is `#[serde(skip)]` and defaults, so every path that rebuilds a `Scan` —
    /// the slim copy, the tree cache, a restore — can drop it silently and the only symptom
    /// is a Callers panel that says "nothing calls this" about everything.
    #[test]
    fn a_scan_builds_the_neighbour_table_beside_its_tree() {
        let dir = fixture();
        let scan = run(dir.path());
        assert_eq!(scan.links.len(), scan.stats.functions, "one entry per function the tree holds",);
        let add = scan.links.at("src/deep/nest/a.rs", 2).expect("`add` starts on line 2");
        assert!(add.wired, "Rust resolves calls, so an empty list here is a real zero");
        assert!(add.callers.is_empty(), "nothing in the fixture calls it");
    }

    /// The streamed shape describes the same repo the scan returns.
    ///
    /// **Written because the streaming half is invisible when it breaks.** What it feeds is
    /// a loading state — a picture that is replaced seconds later by the real tree — so an
    /// `on_shape` that never fires, or fires with nothing in it, looks exactly like a scan
    /// that was simply fast. The map either assembles or it does not, and nobody can tell
    /// from the finished window which of those happened.
    #[test]
    fn the_streamed_shape_matches_the_tree_it_precedes() {
        let dir = fixture();
        let seen = std::sync::Mutex::new(Vec::<ShapeFile>::new());
        let m = Memos::ephemeral();
        let scanned = scan(
            dir.path(),
            &HeuristicModel,
            &|_| {},
            &|_, _: &Reading| {},
            &|files| seen.lock().unwrap().extend_from_slice(files),
            &AtomicBool::new(false),
            Memos { scores: &m.0, scans: &m.1 },
            Fidelity::Ordering,
            crate::trace::Depth::Lines,
        )
        .unwrap();

        let streamed = seen.into_inner().unwrap();
        assert!(!streamed.is_empty(), "the shape never reached the window");

        // Every file the scan drew, and every function in it, with the same line counts —
        // the loading map has to be the same picture, or it is an animation of a repo
        // nobody has.
        let mut want: Vec<(String, String, u32)> = Vec::new();
        scanned.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                want.push((n.path.clone(), n.name.clone(), n.loc));
            }
        });
        let mut got: Vec<(String, String, u32)> = streamed
            .iter()
            .flat_map(|f| f.funcs.iter().map(|(name, loc)| (f.path.clone(), name.clone(), *loc)))
            .collect();
        want.sort();
        got.sort();
        assert_eq!(got, want);
    }

    /// What the window is handed when a project is selected, in bytes.
    ///
    /// Ignored: it is a measurement, not an assertion — `cargo test -- --ignored --nocapture
    /// payload` on a real repo. The number decides whether the wait when a big project comes
    /// on screen is the IPC or the drawing, and guessing that wrong costs a day.
    #[test]
    #[ignore]
    fn payload() {
        let repo = std::env::var("REPO").expect("REPO=/path/to/repo");
        // The app's own memos: a persistent scan cache, so the second run of this measures
        // what a LAUNCH costs rather than what a first look costs.
        let scans = crate::scancache::ScanCache::open(std::path::Path::new(&repo));
        let m = (crate::cache::Cache::ephemeral(), scans);
        let scan = scan(
            std::path::Path::new(&repo),
            &HeuristicModel,
            &|_| {},
            &|_, _: &Reading| {},
            &|_| {},
            &AtomicBool::new(false),
            Memos { scores: &m.0, scans: &m.1 },
            Fidelity::Ordering,
            crate::trace::Depth::Lines,
        )
        .unwrap();
        let json = serde_json::to_string(&scan).expect("serialises");
        // What the window is actually handed, and what it costs to hand over — see
        // `Node::slim`. Both halves are timed because both have been the wait at some point:
        // the trimming was quadratic, and before that the payload was 75MB of JSON.
        let t = std::time::Instant::now();
        let root = scan.root.slim();
        let trimmed = t.elapsed();
        let t = std::time::Instant::now();
        let slim = serde_json::to_string(&Scan { root, ..scan.clone() }).expect("serialises");
        println!("  slim {:.2}s · encode {:.2}s", trimmed.as_secs_f64(), t.elapsed().as_secs_f64());
        let mut funcs = 0;
        scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                funcs += 1;
            }
        });
        let (mut docs, mut ids, mut paths, mut names, mut bodies) = (0, 0, 0, 0, 0);
        scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                docs += n.doc.as_ref().map(|d| d.len()).unwrap_or(0);
                ids += n.id.len();
                paths += n.path.len();
                names += n.name.len();
                bodies += n.body.as_ref().map(|b| b.len()).unwrap_or(0);
            }
        });
        println!("sent {:.1} MB (slim)", slim.len() as f64 / 1e6);
        println!(
            "whole {:.1} MB for {} functions ({} bytes each)",
            json.len() as f64 / 1e6,
            funcs,
            json.len() / funcs.max(1),
        );
        for (what, bytes) in
            [("docs", docs), ("ids", ids), ("paths", paths), ("names", names), ("bodies", bodies)]
        {
            println!("  {what:>7}: {:.1} MB", bytes as f64 / 1e6);
        }
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
            &|_| {},
            &AtomicBool::new(false),
            Memos { scores: &m.0, scans: &m.1 },
            Fidelity::Ordering,
            crate::trace::Depth::Lines,
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
            &|_| {},
            &AtomicBool::new(false),
            Memos { scores: &m.0, scans: &m.1 },
            Fidelity::Full,
            crate::trace::Depth::Lines,
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

    /// The prompt's siblings are the ones beside it, not the ones at the top of the file.
    ///
    /// It took from the start after excluding the scored function, so everything past the
    /// second function in a file was scored against the same opening pair — the context
    /// depended on position in the file, which is a fact about layout and not about code.
    #[test]
    fn a_functions_context_is_its_neighbors() {
        let funcs: Vec<crate::parse::FuncDef> = (0..8)
            .map(|i| crate::parse::FuncDef {
                name: format!("f{i}"),
                signature: format!("fn f{i}()"),
                body: format!("{{ {i} }}"),
                doc: None,
                owner: None,
                start_line: i as u32 * 3 + 1,
                end_line: i as u32 * 3 + 2,
                shape: None,
                calls: Vec::new(),
            })
            .collect();
        let file = ParsedFile {
            rel_path: "a.rs".into(),
            lang: Lang::Rust,
            funcs,
            file_doc: None,
            prints: Vec::new(),
            head: String::new(),
            hash: 0,
            len: 0,
            excluded: false,
        };

        let ctx = context_for(&file, 6);
        assert!(ctx.contains("fn f5"), "the one before it: {ctx}");
        assert!(!ctx.contains("fn f0"), "not the top of the file: {ctx}");
        assert!(!ctx.contains("fn f6"), "and never itself: {ctx}");

        // A function at the top still gets a full window, from the side that has neighbors.
        let top = context_for(&file, 0);
        assert!(top.contains("fn f1") && top.contains("fn f2"), "{top}");
        assert!(!top.contains("fn f0"), "{top}");
    }

    /// A function keeps its identity when the code above it moves.
    ///
    /// Ids used to carry `@line`, so adding an import re-minted every id below it. Nothing
    /// ever read the line back out; what it cost was everything that keys on identity — the
    /// report map rebuilt on every scan, leases voided, the window's selection and drill-in
    /// dropped for anything that had shifted a row. With a watcher rescanning on every save
    /// that stopped being an occasional cost and became the normal case.
    #[test]
    fn an_edit_above_a_function_does_not_change_its_identity() {
        let dir = tempfile::tempdir().unwrap();
        let ids = |src: &str| {
            std::fs::write(dir.path().join("a.rs"), src).unwrap();
            let (cache, scans) = Memos::ephemeral();
            let scan = scan(
                dir.path(),
                &crate::surprise::HeuristicModel,
                &|_| {},
                &|_, _: &crate::surprise::Reading| {},
                &|_| {},
                &std::sync::atomic::AtomicBool::new(false),
                Memos { scores: &cache, scans: &scans },
                Fidelity::Ordering,
                crate::trace::Depth::Lines,
            )
            .unwrap();
            let mut out = Vec::new();
            scan.root.visit(&mut |n| {
                if n.kind == NodeKind::Func {
                    out.push(n.id.clone());
                }
            });
            out.sort();
            out
        };

        let before = ids("fn one() { println!(\"1\"); }\nfn two() { println!(\"2\"); }\n");
        assert_eq!(before, vec!["a.rs#one", "a.rs#two"]);
        let after =
            ids("use std::fmt;\n\nfn one() { println!(\"1\"); }\nfn two() { println!(\"2\"); }\n");
        assert_eq!(before, after, "an import above them is not a new pair of functions");
    }

    /// Two functions of one name in one file are still told apart — by position, which the
    /// line number was only ever a proxy for.
    #[test]
    fn same_named_functions_keep_separate_identities() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.rs"),
            "impl A { fn go(&self) -> u8 { 1 } }\nimpl B { fn go(&self) -> u16 { 2 } }\n",
        )
        .unwrap();
        let (cache, scans) = Memos::ephemeral();
        let scan = scan(
            dir.path(),
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            Memos { scores: &cache, scans: &scans },
            Fidelity::Ordering,
            crate::trace::Depth::Lines,
        )
        .unwrap();
        let mut ids = Vec::new();
        scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                ids.push(n.id.clone());
            }
        });
        ids.sort();
        assert_eq!(ids, vec!["a.rs#go", "a.rs#go#2"], "the twins do not collide");
    }

    #[test]
    fn scanning_an_empty_directory_is_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        let s = run(dir.path());
        assert_eq!(s.stats.functions, 0);
        assert_eq!(s.root.loc, 0);
    }
}
