//! `.sanity/` — the assessment, committed to the repo it describes.
//!
//! Readings used to live in `~/Library/Application Support/Sanity/reports/<hash>.json`,
//! keyed by the absolute path of the repo *on one machine*. That made an assessment
//! private, opaque and mortal: it could not be reviewed, could not be shared, and died
//! with the laptop. Everything worth keeping about a repo was stored in the one place
//! that was not the repo.
//!
//! So the store moved into the tree, and the format changed with it. Markdown is not a
//! rendering here — it **is** the store, parsed back in on open. A second, authoritative
//! JSON file would have been easier and would immediately have disagreed with the
//! Markdown; and the readable copy would have been the one nobody trusted. One file that
//! both a human and an agent can read, and that `git diff` can show you, is the point.
//!
//! # Sharded by top-level directory
//!
//! One file per top-level directory (`.sanity/readings/src-tauri.md`,
//! `.sanity/readings/web.md`), plus a `README.md` index at the top of `.sanity/`.
//!
//! **Under `readings/` rather than loose in `.sanity/`, because a shard is named after the
//! repo.** `shard_of` takes a top-level directory and `shard_file` makes a file of it, so a
//! project with a `rules/` or a `decisions/` directory named this tool's other stores out of
//! existence. Everything sanity writes now has a subdirectory of its own — `readings/`,
//! `rules/`, `findings/` — and nothing a source tree can be called reaches them.
//!
//! **A shard name is a PATH, not a segment.** Today it is one directory deep. `src-tauri.md`
//! is 1.1MB on this repo and a larger one will want finer shards; when it does, `shard_of`
//! returns `src-tauri/src` and nothing else changes — the file becomes
//! `readings/src-tauri/src.md`, the index links it, `read_all` walks down to it and the sweep
//! removes it. The remaining decision is where to split, not how. A single file would read better, but two people assessing one repo
//! at the same time is the case this is built for, and a single file makes that a
//! conflict every time. Sharding puts their work in different files unless they are
//! genuinely reading the same area.
//!
//! Within a shard, entries are ordered by path then by line — never by when they were
//! written — so re-running an assessment rewrites the lines that changed and nothing
//! else. An append-ordered file conflicts on every concurrent write regardless of what
//! it contains.
//!
//! # Staleness is the lifecycle
//!
//! There is no "update" verb. Each entry records [`body_hash`] of the body it was read
//! against; on open, that is compared with what is in the file now. Disagreement means
//! the code moved out from under the reading, and the queue hands it back out first.
//! "Update my sanity assessment" is therefore the same protocol as making one — the
//! queue simply already knows which readings have expired.

use crate::agentapi::{Grade, Report};
use crate::model::NodeKind;
use crate::scan::Scan;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};

/// The reading spec a new reading is taken under.
///
/// **What a grade MEANS is an input to it, and nothing recorded which one.** `reading_hash`
/// covers the file header, the doc and the body — every input except the question the
/// reader was actually asked. So rewording an ask expires nothing: the grades stay, reading
/// as current, answering a question that no longer exists. The evidence that this is not
/// theoretical is in the corpus. `legible`'s ask described its top rung only, and across
/// three repos and 6,900 readings the bottom rung was used **zero** times while 84–92% sat
/// at the top. That is not a finding about the code.
///
/// So a reading records the spec it was taken under, and this file records nothing about
/// what that spec said. **The store holds the fact; the code holds the meaning.** Which
/// bump changed what an answer means is a judgement somebody makes, and a judgement belongs
/// in a diff somebody can review — see the `*_SINCE` constants, which are that judgement.
///
/// One number for the whole reading, not one per axis. Per-axis stamps were drafted and
/// they rendered as `predicted 1 · documented 1 · legible 2`, three integers in the same
/// visual slot as four grades — a provenance line that reads as a score sheet. The thing
/// per-axis versioning was for is real and survives in the `*_SINCE` constants instead,
/// where it costs the file nothing.
///
/// Bump this when a change alters what an answer to any of the graded questions means.
/// Not for a typo, not for a rewording that sharpens the same question — an expiry nobody
/// believes in is one people learn to bump past.
///
/// **1, because versioning starts here.** It was briefly 4, which looked like a history and
/// was not one: there were no specs 1 through 3, and a number with an invented past is the
/// same sort of lie as a reading claiming a provenance it has not got. Everything banked
/// before this is 0 — unversioned, question unknown — and that is the whole of what came
/// before.
///
/// **2: the reader stopped being able to open the repo.** Source now arrives from
/// `sanity_reveal` — the exact extent, and nothing else — so a reader physically cannot go
/// and look at a caller, a type, or the rest of the file. `legible` asked what the reading
/// was LIKE, and half of its scale was about navigation: "you had to jump around" is not a
/// judgement a reader can make when jumping is not available. Every grade before this
/// answered a question that assumed a freedom the reader no longer has.
///
/// **3: `trap` stopped meaning "something here surprised me".** Read back over 894 readings
/// the field had drifted into three different jobs. Eighteen of thirty-nine were what it is
/// for — an ordering assumption nothing enforces, a leak on one path, a field order that is
/// load-bearing. Ten restated a hazard the CODE ALREADY WARNS ABOUT in a comment, which is
/// not news and is the population that would teach somebody to stop opening the lens. Nine
/// were about the reader — "I underestimated", "a different mechanism than I guessed" — the
/// exact thing the description already forbade, which is how we know the wording was not
/// carrying its weight. Two were flagged with no note at all, and a trap with no sentence
/// says nothing anybody can act on.
///
/// So the question is narrower now: a hazard the code documents is not a trap, and a trap
/// cannot be reported without the sentence that says what will bite. Both are changes to
/// what an answer MEANS, which is exactly what this constant is for.
pub const SPEC: u32 = 3;

/// The spec at which `predicted`'s question last changed meaning.
///
/// **Zero, and honestly so.** The ask has certainly been reworded over this corpus's life
/// and nothing recorded when, so every existing reading would have to be condemned on a
/// suspicion. Versioning starts here; it cannot reach backwards. The one thing worse than
/// an unknown provenance is an invented one.
pub const PREDICTED_SINCE: u32 = 0;

/// The spec at which `documented`/`derivable` last changed meaning. Zero, for the reason
/// [`PREDICTED_SINCE`] is.
pub const DOCUMENTED_SINCE: u32 = 0;

/// The spec at which `legible`'s question last changed meaning.
///
/// Spec 1: the ask was rewritten to have a BOTTOM. It described the top rung only — "how
/// clear is it on its own terms" — so a reader had nothing to push a body down the scale
/// with, and the two lower rungs went unused across a full pass of three repos. It now asks
/// what reading it was like, judged by what the reader actually did. Every grade taken
/// before this answered the other question.
///
/// Spec 2: two changes, one forced and one overdue.
///
/// The forced one is that a reader can no longer navigate. Source comes from
/// `sanity_reveal`, bounded to the extent being graded, so "you had to jump around to be
/// sure what it does" describes something no reader can do — half of the `some` rung
/// stopped being answerable, and a rung a reader cannot reach is the defect spec 1 was
/// itself written to fix.
///
/// The overdue one is that spec 1 did not work. It gave the scale a bottom and the bottom
/// went on being unused: 84–92% at the top across three repos and 6,900 readings, `none`
/// at zero. A scale where one rung takes nine readings in ten is measuring almost nothing,
/// whatever its wording. So the rungs are now written around what a reader can OBSERVE
/// about its own pass — did it hold the whole thing at once, did it have to re-read, did
/// it end up unsure — rather than around a verdict on the code's quality, which is a thing
/// a reader is agreeable about.
///
/// **Whether this one works is a question for the data, not for the diff.** Run a wave and
/// read the distribution before spending the corpus on it.
pub const LEGIBLE_SINCE: u32 = 2;

/// Whether a reading's `legible` grade was made under today's question.
///
/// `>=`, which is what makes this degrade correctly in both directions when two people run
/// different builds. A reading from an OLDER app carries no spec, parses as 0, and its
/// grade is not trusted — unknown provenance is exactly the thing not to trust. A reading
/// from a NEWER app carries a spec above anything this build knows about, and is trusted:
/// a later spec is by construction a refinement of the question, and graying out a
/// colleague's fresh work because we are behind would be the map punishing them for
/// updating first. An older app, meanwhile, has never heard of the bullet and ignores it —
/// `parse_shard` skips prefixes it does not know — so it simply behaves as it did before.
pub fn legible_current(spec: u32) -> bool {
    spec >= LEGIBLE_SINCE
}

/// The spec at which `trap`'s question last changed meaning.
///
/// Spec 3: two narrowings, from reading the corpus rather than from taste — see [`SPEC`].
/// A hazard the code already warns about is no longer a trap, so a documented footgun and
/// an unknown one stop scoring the same; and the note is now required, because the boolean
/// is not the finding, the sentence is.
///
/// It expires the whole banked set, and the trade is worth stating: `trap` is the cheap
/// half of a reading — it is answered after the body is open, unlike `predicted` — so what
/// a bump costs here is the lens going grey until repos are read again, not six thousand
/// cold predictions. That asymmetry is why this one is affordable and a `predicted` bump
/// would not be.
pub const TRAP_SINCE: u32 = 3;

/// Whether a reading's `trap` answer was made under today's question. `>=`, for the reasons
/// [`legible_current`] gives — this is the same rule, one axis over.
pub fn trap_current(spec: u32) -> bool {
    spec >= TRAP_SINCE
}

/// Does this reading hold an answer that no longer answers the question it was given?
///
/// One definition, in the same file as the constants, because four places have to agree
/// about it: the shard header that counts it, the queue that re-offers it, the map that
/// stops coloring it and the panel that shows it as history. Spread across those, a bump
/// would be honored wherever somebody remembered.
///
/// Only an answer that EXISTS can be dated. A reading that never graded legibility is
/// ungraded, not superseded, and re-queueing it on a bump would be the app asking for work
/// nobody ever did — the same conflation the shard counter is written against. `trap` is
/// narrower still: a `false` from an older spec survives, because every rewriting of that
/// question has taken things out of it and a narrowing cannot turn a no into a yes.
/// One reading as four small numbers, for a frame of the replay.
///
/// **The map needs the grades and nothing else.** A `Report` carries the prose, the
/// provenance, the model and the body hash — a megabyte an area on a repo this size, and
/// the timeline would be carrying every version of it. What paints a wedge is four answers,
/// so four answers is what crosses the wire: three grades at three bits each and the trap
/// flag, packed into one `u16` per function per commit that changed it.
///
/// `0` is absent, and absent is not `none`: a reader who graded a function `none` said
/// something, and a function nobody has read yet has not been spoken about at all. The
/// replay draws the second as unread, which is the whole point of folding these — you can
/// watch a repo learn about itself.
///
/// The two override rules travel with it, because a wedge painted from raw fields would
/// disagree with the same wedge on the live map: `grades()` applies `derivable` forcing
/// `documented` to none, and a superseded axis is dropped exactly as `legible_of` and
/// `trap_of` drop it — a reading taken under an older `SPEC` answers a question that is not
/// the one being asked, whichever end of the timeline it is on.
pub fn packed(r: &crate::agentapi::Report) -> u16 {
    fn g(v: Option<crate::agentapi::Grade>) -> u16 {
        match v {
            None => 0,
            Some(crate::agentapi::Grade::None) => 1,
            Some(crate::agentapi::Grade::Some) => 2,
            Some(crate::agentapi::Grade::Most) => 3,
            Some(crate::agentapi::Grade::Full) => 4,
        }
    }
    // **Three states, not a flag, and the third one is what makes this free to add.** Bits 10
    // and 11 read 0 on every timeline banked before they existed, and 0 has to mean "this
    // walk was never asked" rather than "no" — a boolean here would have every stored reading
    // in every cached story asserting that its docs are not derivable, which is a default
    // being silently believed as a value. That is the hazard `Bank::taken_at` is written
    // against, and unlike that field a `false` here IS readable as an answer. So: 0 unknown,
    // 1 no, 2 yes. An old story marks nothing and says nothing, which is the same absence a
    // repo nobody has read shows, and it repairs itself on the next trace rather than costing
    // every user their timeline to a format bump.
    //
    // `grades()` above has already applied the forcing this flag causes — a derivable doc is
    // packed as `documented: none`. What travels here is the REASON, which the ramp cannot
    // show: see `.derivable-pulse`.
    let derivable = if r.derivable { 2u16 } else { 1 };
    let (predicted, documented) = r.grades();
    let legible = if legible_current(r.spec) { r.legible } else { None };
    let trap = r.trap && trap_current(r.spec);
    g(Some(predicted))
        | (g(documented) << 3)
        | (g(legible) << 6)
        | (u16::from(trap) << 9)
        | (derivable << 10)
}

pub fn dated_axis(r: &crate::agentapi::Report) -> bool {
    (r.legible.is_some() && !legible_current(r.spec)) || (r.trap && !trap_current(r.spec))
}
use std::process::Command;

/// What a reading was taken against: the body, and every doc it was predicted from.
///
/// The docs belong here and their absence was a hole. `documented` and `derivable` grade
/// the comment directly, and `predicted` is made *from* it — the comment stack is handed
/// over before the reader opens anything, which is the whole reason documenting a repo
/// drains the map. So rewriting a doc changes both questions the reading answers, and
/// hashing only the body left a documentation grade reading as current when the text it
/// graded no longer existed. A stale reading that does not know it is stale is worse than
/// no reading: it is the one number here that cannot be recomputed from the code.
///
/// Found the moment it mattered — six doc comments were about to be corrected on the
/// strength of readings that would have gone on describing them.
///
/// **The whole stack, module header included.** `collect_tasks` hands a reader its own doc
/// AND the file's, so both are in front of it when it predicts; a hash covering only the
/// nearer one would let a rewritten module banner leave every reading in that file reading
/// as current against a description that no longer exists.
///
/// Widening it expired work, and exactly the right work: a file with no header hashes
/// byte-identically to before — `None` contributes nothing to the stack, so the string is
/// the one the two-argument version built — while a file with one expired every reading in
/// it, because those readings were taken without text their replacements will be given.
/// Measured on this repo the day it shipped: 458 of 625 expired, and the 167 that survived
/// were the TypeScript half, which opens with imports rather than a banner. A staleness
/// check whose inputs widen should cost exactly the readings whose inputs widened.
pub fn reading_hash(file_doc: Option<&str>, doc: Option<&str>, body: &str) -> String {
    let stack: Vec<&str> = [doc, file_doc].into_iter().flatten().collect();
    if stack.is_empty() {
        body_hash(body)
    } else {
        body_hash(&format!("{} {body}", stack.join(" ")))
    }
}

/// A short content hash, for detecting that a reading has expired.
///
/// Whitespace is collapsed first. A reformat is not a change to what the code says, and
/// hashing raw text would let one `cargo fmt` invalidate every honest reading in the
/// repo — which trains people to ignore the staleness flag, the one signal here that
/// cannot be recomputed from the code.
///
/// The loop is FNV-1a's shape with a multiplier that is not FNV-1a's prime — see the twin
/// in `heuristic.rs`. It stays that way for the reason that matters most here: this
/// number is what every committed reading is checked against, so correcting the constant
/// would expire every assessment in every repo at once. What it has to be is *stable*,
/// and it is.
pub fn body_hash(body: &str) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in body.split_whitespace().flat_map(|w| w.bytes()) {
        h ^= b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    // 48 bits: short enough to sit in a line of prose without dominating it, wide enough
    // that a collision inside one function's history is not a thing that happens.
    format!("{:012x}", h & 0xffff_ffff_ffff)
}

pub fn dir(repo: &Path) -> PathBuf {
    repo.join(".sanity")
}

/// Which shard a repo-relative path belongs to.
///
/// Files at the repo root share one shard rather than getting a file each — a repo with
/// twenty loose config files should not produce twenty assessment files.
fn shard_of(path: &str) -> String {
    match path.split_once('/') {
        Some((top, _)) if !top.is_empty() => top.to_string(),
        _ => "root".to_string(),
    }
}

/// Where the readings live, under `.sanity/`.
///
/// **A directory of their own, because `.sanity/` is shared.** A shard is named after part of
/// the repo, so the reading store's filenames are chosen by whoever laid the repo out: a
/// project with a `rules/` directory produced `.sanity/rules.md`, which is also where this
/// tool's rule store wanted to live. Everything sanity writes now sits under a subdirectory
/// nobody's source tree can name into — `readings/`, `rules/`, `findings/` — and `README.md`
/// is the only file left at the top.
pub(crate) const READINGS: &str = "readings";

/// The shard files an index links to, from its Markdown.
///
/// The index is the tool's own record of what it wrote, so parsing it back is how `save`
/// knows which files in a shared directory are its to remove. Matches `[label](path.md)`,
/// which is what `row` renders — if that ever changes shape, this has to move with it, and
/// the failure is visible: the sweep stops removing anything rather than removing too much.
///
/// **Relative paths are allowed and `..` is not.** The links carry a directory now, and the
/// list they produce is fed to `remove_file`; a link that could climb out of `.sanity/` would
/// make the index a delete-anything instruction to anybody who could edit it. Absolute paths
/// go the same way and for the same reason.
fn shard_links(readme: &str) -> Vec<String> {
    let mut out = Vec::new();
    for (_, rest) in readme.match_indices("](").map(|(i, _)| (i, &readme[i + 2..])) {
        if let Some(end) = rest.find(')') {
            let name = &rest[..end];
            let escapes = name.starts_with('/') || name.split('/').any(|seg| seg == "..");
            if name.ends_with(".md") && !escapes && name != "README.md" {
                out.push(name.to_string());
            }
        }
    }
    out
}

/// One path segment, with anything hostile flattened out.
///
/// **A dot is legal in a name and illegal as the whole of one.** `.` and `..` are directions
/// rather than names, and a shard called `..` would put its file one level above the
/// directory the sweep is allowed to touch. The character has to stay — `web.config` is an
/// ordinary directory name — so it is the all-dots segment that is refused, not the dot.
fn safe_segment(seg: &str) -> String {
    let safe: String = seg
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '-' })
        .collect();
    if !safe.is_empty() && safe.chars().all(|c| c == '.') {
        return safe.replace('.', "-");
    }
    safe
}

/// A shard name as a path under `.sanity/`, relative and forward-slashed.
///
/// **The shard name is a PATH, not a segment, and that is the whole preparation.** Today
/// `shard_of` returns one top-level directory and this returns `readings/src-tauri.md`. A
/// repo big enough to want finer shards needs `shard_of` to return `src-tauri/src` and
/// nothing else here to change: the file becomes `readings/src-tauri/src.md`, the index links
/// it, `read_all` walks down to it and the sweep can remove it. Splitting a 1.1MB shard is
/// then a decision about WHERE to split rather than a change to the store's shape.
///
/// Each segment is sanitised on its own, so a repo directory called `../` cannot become one.
fn shard_file(shard: &str) -> String {
    let safe: Vec<String> = shard.split('/').filter(|s| !s.is_empty()).map(safe_segment).collect();
    let name = if safe.is_empty() { "root".to_string() } else { safe.join("/") };
    format!("{READINGS}/{name}.md")
}

/// What a file's own reading is filed under: its path, with no `#`.
///
/// Free by construction — every function key contains a `#`, so a bare path can never
/// collide with one — and it is the same string the scan uses as the file node's id, which
/// is what lets one report map hold both kinds without a second index.
pub fn file_key(path: &str) -> String {
    path.to_string()
}

/// How a file's own reading is titled in the store.
///
/// Prose rather than an identifier, and printed without backticks, because it is not one:
/// a heading that read `` `parse.rs` `` inside a section already headed `parse.rs` would
/// look like a function of that name. Matched on the way back in — see `parse_shard` — so
/// this string is part of the store's format and not a label.
const FILE_ENTRY: &str = "the file itself";

/// The identity of a function, durable and in-memory alike: `path#name`, and `path#name#2`
/// for the second same-named function in that file, `#3` for the third, and so on.
///
/// **One scheme, not two.** Node ids used to carry `@line`, so the tree keyed functions one
/// way and the store keyed them another, and everything between the two spent its time
/// translating: a rescan re-minted every id, so the in-memory report map had to be rebuilt
/// from this key on every scan, leases became claims on ids that no longer existed and had
/// to be dropped, and the window lost its selection and its drill-in for any function that
/// had moved by a line. None of that bought anything — nothing ever read the line back out
/// of an id — and it made a background rescan into a hazard rather than a refresh.
///
/// The line lives in `Node::line`, where it is a fact about the code rather than half of a
/// name.
///
/// But `path#name` alone is not unique, and assuming it was did real damage: Swift files
/// hold a dozen `init`s and Rust files hold same-named methods in different `impl`
/// blocks. Colliding keys meant the second twin overwrote the first, so it never got
/// written at all; its reading was silently dropped, its slot vanished from the totals,
/// and on reload BOTH twins were handed the surviving reading — which then compared
/// against the wrong body and reported itself STALE. On a real Swift repo that was 91
/// functions missing from the denominator and two false expiries.
///
/// The ordinal is position within the file, so it survives everything a line number
/// doesn't: edits above, reformatting, the function growing. Reordering two same-named
/// functions does swap their readings, which is the one case this cannot see — and a
/// swapped reading between two functions of the same name in the same file is a far
/// smaller error than the one it replaces.
pub fn key_of(path: &str, name: &str, ord: usize) -> String {
    if ord == 0 {
        format!("{path}#{name}")
    } else {
        format!("{path}#{name}#{}", ord + 1)
    }
}

fn grade_word(g: Grade) -> &'static str {
    match g {
        Grade::Full => "full",
        Grade::Most => "most",
        Grade::Some => "some",
        Grade::None => "none",
    }
}

fn parse_grade(s: &str) -> Option<Grade> {
    match s.trim() {
        "full" => Some(Grade::Full),
        "most" => Some(Grade::Most),
        "some" => Some(Grade::Some),
        "none" => Some(Grade::None),
        _ => None,
    }
}

// There is no `verdict` here any more.
//
// It turned one of five grades into the entry's title — "`open` — nearly" — so a reader
// skimming a shard was told what the prediction scored and had to go four rows down for
// whether the docs covered anything, whether they were derivable, whether the body could be
// followed, or whether the thing is a footgun. Surprise is what the MAP is colored by; it is
// not what a reading IS. See `render_entry`, where the loud end of any axis earns a marker
// and nothing earns the title.

/// Flatten prose to one line.
///
/// Every field here is one sentence by design, and keeping it on one line means an entry
/// is a fixed number of lines whose boundaries a parser cannot mistake for prose. The
/// leading `- ` of the next bullet is not a delimiter you want to be guessing at.
fn flat(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

// ── Reading ────────────────────────────────────────────────────────────────────

/// Load the committed assessment, keyed by the node ids of the scan in front of us.
///
/// Readings whose function no longer exists are dropped rather than carried: a reading
/// of deleted code cannot be checked and would sit in the file forever claiming
/// coverage. The entry survives in git history, which is where a deleted thing belongs.
pub fn load(repo: &Path, scan: &Scan) -> HashMap<String, Report> {
    let stored = read_all(&dir(repo));
    if stored.is_empty() {
        return HashMap::new();
    }
    let mut out = HashMap::new();
    // Both kinds, resolved the same way: the store is keyed durably and the map the app
    // runs on is keyed by node id, so every reading is looked up from the LIVE side. A file
    // whose reading exists but which is no longer in the scan simply does not come back,
    // which is the same rule a deleted function follows.
    for (key, live) in live_funcs(scan).into_iter().chain(live_files(scan)) {
        if let Some(r) = stored.get(&key) {
            let mut r = r.clone();
            r.id = live.id.clone();
            out.insert(live.id, r);
        }
    }
    out
}

/// Every entry in every shard, keyed `path#name`.
pub(crate) fn read_all(dir: &Path) -> HashMap<String, Report> {
    let mut out = HashMap::new();
    // `readings/`, to whatever depth `shard_of` has been taught to shard at.
    walk_shards(&dir.join(READINGS), &mut out);
    // **And the flat layout, which is how the move happens without a migrator.** Shards used
    // to sit directly in `.sanity/`. Reading them here is the whole of it: the next `save`
    // writes them under `readings/`, the new index links the new paths, and the sweep removes
    // the old files because they are ones this tool linked and has stopped claiming. That is
    // "rewriting is reading and writing" — see `assessments.md`, which is emphatic that a
    // translator is the thing that destroyed a project's readings.
    //
    // Not recursive here, deliberately: `.sanity/` holds this tool's other stores now, and a
    // walk that went into them would try to parse a rule catalog as a shard.
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let path = e.path();
            if path.extension().is_none_or(|x| x != "md") {
                continue;
            }
            if path.file_name().is_some_and(|n| n == "README.md") {
                continue;
            }
            if let Ok(text) = std::fs::read_to_string(&path) {
                parse_shard(&text, &mut out);
            }
        }
    }
    out
}

/// Every `.md` under a directory, however deep.
fn walk_shards(dir: &Path, out: &mut HashMap<String, Report>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for e in entries.flatten() {
        let path = e.path();
        if path.is_dir() {
            walk_shards(&path, out);
            continue;
        }
        if path.extension().is_none_or(|x| x != "md") {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(&path) {
            parse_shard(&text, out);
        }
    }
}

/// Parse one shard into `path#name` → report.
///
/// Deliberately forgiving. This file is committed, so it will be hand-edited and it will
/// be merged by hand after a conflict; a parser that rejects the whole file over one
/// malformed bullet would throw away everyone else's work to punish one typo. An
/// unrecognized line is skipped, and an entry with neither `expected` nor `found` is dropped
/// on its own — one with either is kept.
///
/// Three tiers: `## path` names the file, `### name` (with an ordinal suffix for a repeated
/// name) the entry, and under it the prose bullets and one `·`-separated metadata line. That
/// line is most of the work — spec, paging, body hash, commit, model, harness, when, by,
/// cold or warm, priming, position and every grade — and each segment is recognised by its
/// own prefix, so a segment this build does not know is skipped rather than fatal.
pub(crate) fn parse_shard(text: &str, out: &mut HashMap<String, Report>) {
    let mut file = String::new();
    let mut cur: Option<(String, Report)> = None;

    // An entry is complete only when the next heading arrives, so flushing happens both
    // in the loop and after it.
    macro_rules! flush {
        () => {
            if let Some((key, r)) = cur.take() {
                if !r.expected.is_empty() || !r.found.is_empty() {
                    out.insert(key, r);
                }
            }
        };
    }

    for line in text.lines() {
        let line = line.trim_end();
        if let Some(rest) = line.strip_prefix("## ") {
            flush!();
            file = rest.trim().trim_matches('`').to_string();
            continue;
        }
        if let Some(rest) = line.strip_prefix("### ") {
            flush!();
            if file.is_empty() {
                continue;
            }
            // "`name` — verdict" or "`name` #2 — verdict". The verdict is decoration and
            // is recomputed on write; the ordinal is part of the key.
            let head = rest.split('—').next().unwrap_or(rest).trim();
            let (name_part, ord) = match head.rsplit_once(" #") {
                Some((before, n)) => match n.trim().parse::<usize>() {
                    // Printed 1-based, keyed 0-based.
                    Ok(n) if n >= 2 => (before.trim(), n - 1),
                    _ => (head, 0),
                },
                None => (head, 0),
            };
            let name = name_part.trim().trim_matches('`');
            if name.is_empty() {
                continue;
            }
            // The file's own reading, filed under the bare path — see `FILE_ENTRY`.
            let id = if name.eq_ignore_ascii_case(FILE_ENTRY) {
                file_key(&file)
            } else {
                key_of(&file, name, ord)
            };
            cur = Some((id.clone(), Report { id, ..Report::blank() }));
            continue;
        }
        let Some((_, r)) = cur.as_mut() else { continue };
        let Some(bullet) = line.trim_start().strip_prefix("- ") else {
            continue;
        };
        let bullet = bullet.trim();
        if let Some(v) = bullet.strip_prefix("expected:") {
            r.expected = v.trim().to_string();
        } else if let Some(v) = bullet.strip_prefix("found:") {
            r.found = v.trim().to_string();
        } else if let Some(v) = bullet.strip_prefix("note:") {
            r.note = v.trim().to_string();
        } else {
            // The two `·`-separated lines: provenance and grades. Parsed by segment
            // prefix rather than by position, so a hand-edit that reorders or drops one
            // costs that segment and nothing else.
            for seg in bullet.split('·') {
                let seg = seg.trim();
                if let Some(v) = seg.strip_prefix("spec ") {
                    // Absent means 0 means "unknown question", which is the answer rather
                    // than a gap — see `SPEC`. A garbled number takes the same road: what
                    // it cannot be is quietly promoted to current.
                    r.spec = v.trim().parse().unwrap_or(0);
                } else if let Some(v) = seg.strip_prefix("served in ") {
                    // A garbled count reads as absent, which expires the reading rather
                    // than promoting it — the same road `spec` takes, and the safe
                    // direction: this field's absence is what marks a body nobody proved
                    // arrived.
                    r.paged = v.split_whitespace().next().and_then(|n| n.parse().ok());
                } else if let Some(v) = seg.strip_prefix("read at ") {
                    r.body = v.trim().trim_matches('`').to_string();
                } else if let Some(v) = seg.strip_prefix("commit ") {
                    r.at = v.trim().trim_matches('`').to_string();
                } else if let Some(v) = seg.strip_prefix("read by ") {
                    r.model = v.trim().to_string();
                } else if let Some(v) = seg.strip_prefix("asked for ") {
                    r.asked = v.trim().to_string();
                } else if let Some(v) = seg.strip_prefix("via ") {
                    r.harness = v.trim().to_string();
                } else if let Some(v) = seg.strip_prefix("when ") {
                    r.when = v.trim().to_string();
                } else if let Some(v) = seg.strip_prefix("by ") {
                    r.by = v.trim().to_string();
                } else if seg == "cold reading" {
                    r.cold = true;
                } else if seg == "warm reading" {
                    r.cold = false;
                } else if let Some(v) = seg.strip_prefix("priming: ") {
                    // "CLAUDE.md in context" / "CLAUDE.md excluded" — the file list is
                    // everything up to the verdict, so a repo carrying two of them round
                    // trips. An unrecognized tail is neither, and leaves both halves at
                    // their defaults rather than guessing which way it fell.
                    let v = v.trim();
                    if let Some(f) = v.strip_suffix(" in context") {
                        r.agent_docs = f.trim().to_string();
                        r.primed = true;
                    } else if let Some(f) = v.strip_suffix(" excluded") {
                        r.agent_docs = f.trim().to_string();
                        r.primed = false;
                    }
                } else if let Some(v) = seg.strip_prefix("reading ") {
                    // "reading 3 of its run" — how much of this repo the reader had
                    // already seen when it made this call. Absent on everything banked
                    // before the field existed, which is a different thing from 1 and is
                    // reported as such.
                    r.position = v.split_whitespace().next().and_then(|n| n.parse().ok());
                } else if let Some(v) = seg.strip_prefix("predicted:") {
                    r.predicted = parse_grade(v);
                } else if let Some(v) = seg.strip_prefix("documented:") {
                    r.documented = parse_grade(v);
                } else if let Some(v) = seg.strip_prefix("derivable:") {
                    r.derivable = v.trim() == "yes";
                } else if let Some(v) = seg.strip_prefix("legible:") {
                    r.legible = parse_grade(v);
                } else if let Some(v) = seg.strip_prefix("trap:") {
                    r.trap = v.trim() == "yes";
                } else if let Some(v) = seg.strip_prefix("test:") {
                    // Absent from the line means nobody asked, which is not the same as `no` —
                    // see `Report::test`. Only a segment that is actually there answers.
                    r.test = Some(v.trim() == "yes");
                }
            }
        }
    }
    flush!();
}

// ── Writing ────────────────────────────────────────────────────────────────────

/// One function as it stands in the tree right now, for ordering and staleness.
struct Live {
    /// The scan's node id, which is what the in-memory report map is keyed by.
    id: String,
    path: String,
    name: String,
    line: u32,
    /// Which same-named function in this file this is, counting from zero in line order.
    ord: usize,
    body: String,
    /// What a reader would be handed for it — see [`crate::model::Node::bytes`]. Carried so
    /// the store's own render expires a reading on exactly the terms the queue does; two
    /// definitions of "still current" is how a README ends up claiming a coverage its own
    /// shards contradict.
    bytes: Option<u32>,
}

/// Every function in the scan, keyed by its durable [`key_of`].
///
/// Ordinals are assigned in line order within each file, so they have to be worked out
/// over the whole file at once rather than as each node is visited.
/// One function as the walk meets it: line, name, id, body hash, extent.
///
/// Named because the ordinals have to be assigned over a whole file at once, so the walk
/// collects before it can key anything — see [`live_funcs`].
type Seen = (u32, String, String, String, Option<u32>);

fn live_funcs(scan: &Scan) -> BTreeMap<String, Live> {
    let mut by_file: BTreeMap<String, Vec<Seen>> = BTreeMap::new();
    scan.root.visit(&mut |n| {
        if n.kind != NodeKind::Func {
            return;
        }
        by_file.entry(n.path.clone()).or_default().push((
            n.line.unwrap_or(0),
            n.name.clone(),
            n.id.clone(),
            n.body.clone().unwrap_or_default(),
            n.bytes,
        ));
    });

    let mut out = BTreeMap::new();
    for (path, mut funcs) in by_file {
        // By line, then by id, so the ordinals are a pure function of the file and two
        // scans of unchanged code never disagree about which twin is which.
        funcs.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.2.cmp(&b.2)));
        let mut seen: HashMap<String, usize> = HashMap::new();
        for (line, name, id, body, bytes) in funcs {
            let ord = seen.entry(name.clone()).or_insert(0);
            let this = *ord;
            *ord += 1;
            out.insert(
                key_of(&path, &name, this),
                Live { id, path: path.clone(), name, line, ord: this, body, bytes },
            );
        }
    }
    out
}

/// Every readable FILE in the scan, keyed by its durable [`file_key`].
///
/// Excluded files are left out for the same reason their functions are: `.sanityignore`
/// says they are not this assessment's business, and a file reading would put them back in
/// the denominator by a side door.
///
/// A file with no declarations is skipped, matching `collect_tasks` — there is nothing for
/// a header to be graded against.
fn live_files(scan: &Scan) -> BTreeMap<String, Live> {
    let mut out = BTreeMap::new();
    scan.root.visit(&mut |n| {
        if n.kind != NodeKind::File || n.excluded || n.children.is_empty() {
            return;
        }
        out.insert(
            file_key(&n.path),
            Live {
                id: n.id.clone(),
                path: n.path.clone(),
                name: n.name.clone(),
                line: 0,
                ord: 0,
                body: n.body.clone().unwrap_or_default(),
                bytes: n.bytes,
            },
        );
    });
    out
}

/// Whether a reading still describes the code it was made against.
///
/// A reading with no hash predates this store and is taken at its word — the alternative
/// is declaring every migrated reading stale on first open, which would present a repo's
/// entire history of careful work as expired.
///
/// **A function that is GONE is not stale here, and that is a division of labour rather than
/// an oversight.** `node_body` of `None` means nothing in today's scan matches this reading,
/// so there is no body to compare against and no answer this function can honestly give;
/// staleness is "the code moved under a reading", and a reading with no code is a different
/// question. Deletion is handled where it can be acted on — a function that is gone stops
/// being offered as work, which `a_function_that_is_gone_stops_being_offered` pins — so read
/// on its own, `false` here means "not stale", never "still current".
pub fn is_stale(report: &Report, node_body: Option<&str>, extent: Option<u32>) -> bool {
    // **A body too large to have been served whole, from a reading with no record of having
    // taken it in parts.** Until `reveal` paged, an extent over `PART_BYTES` was put on the
    // wire in one response and arrived at the reader truncated or not at all — and readers
    // did not stop. Eighteen readings in this corpus were graded that way, every one noting
    // the fact in prose nothing aggregates, and every one landing on the same flattering
    // rung. They are expired here rather than swept once, which makes this an invariant
    // instead of a migration: the store is never rewritten, nothing is deleted, and a
    // reading of a large body is simply not current unless it carries the evidence.
    //
    // Asked BEFORE the hash, because it is the stronger claim. A reading whose body has not
    // moved is normally current; this one is not, and for a reason the hash cannot see —
    // the hash covers what the reader was SUPPOSED to be given, and this covers whether it
    // got it. Same shape as the `file_doc` bug: inputs a reading claims and never received.
    //
    // An unknown extent is not stale, matching `Node::unreadable`: `None` here is a tree
    // cached before the extent existed, and expiring a repo's whole corpus on a missing
    // field would be the worst reading of it available.
    if extent.is_some_and(|b| b as usize > crate::agentapi::PART_BYTES) && report.paged.is_none() {
        return true;
    }
    match (report.body.as_str(), node_body) {
        ("", _) => false,
        (recorded, Some(now)) => recorded != now,
        (_, None) => false,
    }
}

/// One reading, tied to where its function currently sits.
struct Placed<'a> {
    line: u32,
    name: String,
    /// The file's own reading rather than one of its functions — rendered first in the
    /// section and titled as prose. See [`FILE_ENTRY`].
    is_file: bool,
    /// Which same-named function in the file this is — printed beside the name so a
    /// human reading two `init` entries can tell which one is which.
    ord: usize,
    report: &'a Report,
    /// Whether the code has moved since the reading was made.
    stale: bool,
}

/// Write the whole assessment out: one file per top-level directory, plus the index.
///
/// Rewritten in full on every report rather than appended to. A report is minutes of an
/// agent's reading and the app is far more often killed than quit, so anything deferred
/// to exit is anything lost; and a full rewrite is the only way entries stay in path
/// order, which is what keeps two people's diffs from colliding.
/// One shard's row in the index, and the body that goes in its own file.
///
/// Both come out of the same pass because they are the same walk seen twice, and the
/// counts in the index have to be the counts in the shard. Rendering the table anywhere
/// else would be a second implementation of the arithmetic, and the copy nobody reads is
/// the one that goes wrong — which is how a whole repo's readings lost `derivable`.
struct Compiled {
    shard: String,
    read: usize,
    total: usize,
    surprising: usize,
    stale: usize,
    /// Readings holding a `legible` grade that answers a question since rewritten.
    ///
    /// Counted rather than marked per entry. The grade a reader gave is still printed —
    /// it is what they said, and the store's job is to record that — but a human reading
    /// a shard has no way to know the app has stopped honoring it, and a store whose
    /// numbers quietly diverge from the map is the failure this whole file exists against.
    /// One count in the header, where `read`, `surprising` and `stale` already answer
    /// "how much of this still counts".
    dated: usize,
    body: String,
}

impl Compiled {
    /// The tuple `render_index` wants. The body is the shard file's business.
    fn row(&self) -> (String, usize, usize, usize, usize, usize) {
        (self.shard.clone(), self.read, self.total, self.surprising, self.stale, self.dated)
    }
}

/// Group the readings by shard and render each one, without writing anything.
///
/// Split out of [`save`] so [`refresh_index`] can produce a byte-identical index without
/// also being a second opinion about what the index says. If these two ever disagreed,
/// `open` and `report` would rewrite the file past each other on every call and the repo
/// would carry a permanently dirty diff.
fn compile(scan: &Scan, reports: &HashMap<String, Report>) -> Vec<Compiled> {
    let live = live_funcs(scan);
    // `BTreeMap` throughout so the output is a pure function of the readings: the same
    // set writes the same bytes, which is what lets `git diff` show only what changed.
    // Driven off the live functions, not off the reports. Walking the reports meant
    // resolving each one back to a function by name, which is exactly where twins got
    // confused; from this direction each function looks up its own reading by the key
    // that already distinguishes it, and staleness compares against its own body.
    let readable_files = live_files(scan);
    let mut shards: BTreeMap<String, BTreeMap<String, Vec<Placed>>> = BTreeMap::new();
    for (l, is_file) in
        live.values().map(|l| (l, false)).chain(readable_files.values().map(|l| (l, true)))
    {
        let Some(r) = reports.get(&l.id) else { continue };
        shards.entry(shard_of(&l.path)).or_default().entry(l.path.clone()).or_default().push(
            Placed {
                line: l.line,
                name: l.name.clone(),
                ord: l.ord,
                is_file,
                report: r,
                stale: is_stale(r, Some(l.body.as_str()), l.bytes),
            },
        );
    }

    let mut out = Vec::new();
    for (shard, files) in &shards {
        let mut read = 0usize;
        let mut surprising = 0usize;
        let mut stale = 0usize;
        let mut dated = 0usize;
        let mut body = String::new();
        for (path, entries) in files {
            let mut entries: Vec<_> = entries.iter().collect();
            // The file's own reading leads its section — it is the thing the rest are
            // inside of, and it sorts there for free: `line` is 0 for a file and 1-based
            // for everything else.
            entries.sort_by(|a, b| {
                b.is_file
                    .cmp(&a.is_file)
                    .then_with(|| a.line.cmp(&b.line))
                    .then_with(|| a.name.cmp(&b.name))
            });
            body.push_str(&format!("\n## {path}\n"));
            for e in entries {
                read += 1;
                if matches!(e.report.grades().0, Grade::Some | Grade::None) {
                    surprising += 1;
                }
                if e.stale {
                    stale += 1;
                }
                // A grade that is present and no longer answers today's question. Both
                // halves matter: a reading that never graded legibility is not dated, it
                // is ungraded, and folding the two together would report work nobody did.
                if dated_axis(e.report) {
                    dated += 1;
                }
                body.push_str(&render_entry(&e.name, e.ord, e.is_file, e.report, e.stale));
            }
        }
        // Everything readable in this shard, so "12 of 400 read" is honest about the rest.
        // Files count: they are handed out, reported and stored exactly as functions are,
        // and a denominator that left them out would report a coverage nobody has.
        let total = live
            .values()
            .chain(readable_files.values())
            .filter(|l| shard_of(&l.path) == *shard)
            .count();
        out.push(Compiled { shard: shard.clone(), read, total, surprising, stale, dated, body });
    }
    out
}

/// The repo's own name, as the index titles it.
fn repo_name(repo: &Path) -> String {
    repo.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "this repo".to_string())
}

/// What happened to `.sanity/README.md` when we last looked at it.
pub enum Index {
    /// Already said what this version of Sanity would say.
    Current,
    /// It was out of date and has been rewritten.
    Refreshed,
    /// There is no assessment here. Nothing was created — see [`refresh_index`].
    Absent,
    Failed(String),
}

impl Index {
    pub fn as_str(&self) -> &str {
        match self {
            Index::Current => "current",
            Index::Refreshed => "refreshed",
            Index::Absent => "absent",
            Index::Failed(e) => e,
        }
    }
}

/// Bring an existing assessment up to date with what this version of Sanity would write.
///
/// `save` already rewrites these files on every report, so a repo mid-assessment repairs
/// itself the moment a reading lands. The gap is the repo that is FINISHED: nothing is
/// left to read, so nothing is ever saved, so it keeps whatever it was written with —
/// prose telling strangers to run a command that has since stopped existing, and a table
/// claiming a coverage that stopped being true the next time somebody wrote a function.
/// Opening the repo is the one moment we certainly have both the tree and the readings in
/// hand, so that is where this goes.
///
/// **The index and the shards move together.** Refreshing only `README.md` was worse than
/// refreshing nothing: the table would say 27 stale while the file it links to said 0, and
/// a document that contradicts itself is not a document anybody trusts. They come out of
/// one `compile`, so there is no version in which they can disagree.
///
/// **Refreshes, never creates.** Opening a repo that has no assessment must not put a
/// `.sanity/` directory in somebody's working tree — an open is a look, and a look that
/// leaves a directory behind is a surprise in a place people run `git status`. A shard
/// that does not exist yet is not written either: that is a reading's business, not a
/// refresh's.
///
/// **Writes only on a real difference, file by file.** Rewriting identical bytes would
/// touch the mtime and dirty a checkout for nothing, on every open, of every repo.
pub fn refresh(repo: &Path, scan: &Scan, reports: &HashMap<String, Report>) -> Index {
    let root = dir(repo);
    let Ok(existing_index) = std::fs::read_to_string(root.join("README.md")) else {
        return Index::Absent;
    };
    let compiled = compile(scan, reports);

    let mut wrote = false;
    let mut write_if_changed = |path: PathBuf, fresh: String| -> Result<(), String> {
        // Only files already there. A shard that has never been written is coverage that
        // does not exist, and inventing it here would claim readings nobody made.
        match std::fs::read_to_string(&path) {
            Ok(cur) if cur == fresh => Ok(()),
            Ok(_) => match std::fs::write(&path, fresh) {
                Ok(()) => {
                    wrote = true;
                    Ok(())
                }
                Err(e) => Err(format!("could not rewrite {}: {e}", path.to_string_lossy())),
            },
            Err(_) => Ok(()),
        }
    };

    for c in &compiled {
        let fresh =
            render_shard(&c.shard, c.read, c.total, c.surprising, c.stale, c.dated, &c.body);
        if let Err(e) = write_if_changed(root.join(shard_file(&c.shard)), fresh) {
            return Index::Failed(e);
        }
    }

    let rows: Vec<_> = compiled.iter().map(Compiled::row).collect();
    let fresh = render_index(&repo_name(repo), &rows);
    if existing_index != fresh {
        // Reported rather than absorbed. Nothing is lost — the readings themselves are
        // untouched and the next report tries again — but an index that silently failed
        // to update is a document claiming to be current while saying something else.
        if let Err(e) = std::fs::write(root.join("README.md"), fresh) {
            return Index::Failed(format!("could not rewrite the index: {e}"));
        }
        wrote = true;
    }
    if wrote {
        Index::Refreshed
    } else {
        Index::Current
    }
}

pub fn save(repo: &Path, scan: &Scan, reports: &HashMap<String, Report>) -> std::io::Result<()> {
    let root = dir(repo);
    std::fs::create_dir_all(&root)?;

    // Grouped for the file layout — shard, then source file, then position within it. The
    // grouping and the arithmetic live in `compile`, shared with `refresh_index` so the
    // two can never write a different index for the same readings.
    let compiled = compile(scan, reports);
    let mut index = Vec::new();
    for c in &compiled {
        let at = root.join(shard_file(&c.shard));
        // A shard's path has directories in it now — `readings/`, and however many more once
        // `shard_of` shards deeper than the top level.
        if let Some(parent) = at.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(
            at,
            render_shard(&c.shard, c.read, c.total, c.surprising, c.stale, c.dated, &c.body),
        )?;
        index.push(c.row());
    }

    // What the OUTGOING index linked to — read before it is overwritten, because that list
    // is the only record of which files in here this tool created.
    let ours = shard_links(&std::fs::read_to_string(root.join("README.md")).unwrap_or_default());

    std::fs::write(root.join("README.md"), render_index(&repo_name(repo), &index))?;

    // Shards that lost their last reading leave a file behind claiming coverage that is no
    // longer there. Cleared, not left to rot — but only ours, and only after the index that
    // replaces them is safely on disk.
    //
    // **It used to delete every `.md` that was not `README.md` or a current shard**, which
    // is a much wider net than the sentence above describes: `.sanity/` is a directory this
    // tool SHARES with a human, and any note left in it was removed on the next report, with
    // the result thrown away so nothing said so. Deriving the list from the previous index
    // means the sweep can only ever remove a file this tool put there and then stopped
    // claiming — a file nobody linked is a file nobody here owns.
    //
    // After the write, not before: a failed index used to leave the shards already pruned,
    // so the one moment the two could disagree was also the moment the evidence went. Now a
    // failure leaves both halves as they were and `?` reports it.
    //
    // And the error is returned rather than discarded. A permissions problem left a dead
    // shard on disk that the new index does not link, which is an orphan claiming coverage
    // with nothing pointing at it and nobody told.
    let keep: Vec<String> = compiled.iter().map(|c| shard_file(&c.shard)).collect();
    for name in ours {
        if keep.contains(&name) {
            continue;
        }
        let at = root.join(&name);
        match std::fs::remove_file(&at) {
            Ok(()) => {}
            // Already gone is the outcome we wanted — and it is the ordinary case the first
            // time a repo laid out flat is written under `readings/`: the outgoing index
            // linked `src-tauri.md`, `git mv` has already put it where the new index will
            // link it, and there is nothing left at the old path to remove.
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }
        // A shard that was the last thing in its directory leaves the directory behind, and
        // an empty `readings/src-tauri/` claims an area that no longer has readings. Only
        // ever the parents of a file this tool just removed, only while they are empty, and
        // never `.sanity/` itself — `remove_dir` refuses a directory with anything in it,
        // which is the guard rather than a check that could race with it.
        let mut up = at.parent().map(Path::to_path_buf);
        while let Some(d) = up {
            if d == root || !d.starts_with(&root) || std::fs::remove_dir(&d).is_err() {
                break;
            }
            up = d.parent().map(Path::to_path_buf);
        }
    }
    Ok(())
}

fn render_entry(name: &str, ord: usize, is_file: bool, r: &Report, stale: bool) -> String {
    let mut s = String::new();
    // Markers for the things somebody skimming has to be able to find, and NOTHING that is
    // merely one of the five grades.
    //
    // The heading used to print the surprise verdict — "`open` — nearly" — which is one axis
    // wearing the title while `documented`, `derivable`, `legible` and `trap` sat in a bullet
    // four rows down. That was already known to be wrong: these markers exist because opacity
    // and traps were invisible to a skim, and bolting them on beside the verdict fixed the
    // symptom while leaving surprise as the headline. A reading is five judgements and none of
    // them is the finding.
    //
    // So the heading is the NAME, and a marker appears only for the loud end of any axis —
    // the entries somebody skimming two hundred of them should stop at. `as expected` and
    // `nearly` get nothing, `crystal` and `readable` get nothing: a heading that annotated
    // every entry would annotate none of them.
    //
    // Everything after the em-dash is decoration `parse_shard` splits off and recomputes on
    // write, so these cost nothing durable and cannot drift from the record they summarize.
    let mut marks = String::new();
    // Named by the axis and the grade, the words the bullet below already uses, so a skim
    // and a read cannot disagree about which scale a mark is on. A skim is looking for the
    // thing that caught somebody out, and `none` and `some` are the two that did.
    match r.grades().0 {
        Grade::None => marks.push_str(" — PREDICTED NONE"),
        Grade::Some => marks.push_str(" — PREDICTED SOME"),
        _ => {}
    }
    // **Both gated on the axis still answering today's question.** A heading mark is this
    // file's version of coloring a wedge — it is what a skim reads, and it is decoration the
    // writer recomputes rather than a fact the store holds. So it follows the same rule the
    // map does: the bullet keeps what the reader said (`trap: yes` is still there to read),
    // and the mark stops advertising it. A shard that went on shouting TRAP over an answer
    // the lens has greyed would be the readable copy disagreeing with the picture, which is
    // the one thing the Markdown-as-store design cannot afford.
    match r.legible.filter(|_| legible_current(r.spec)) {
        Some(Grade::None) => marks.push_str(" — LEGIBLE NONE"),
        Some(Grade::Some) => marks.push_str(" — LEGIBLE SOME"),
        _ => {}
    }
    if r.trap && trap_current(r.spec) {
        marks.push_str(" — TRAP");
    }
    if stale {
        marks.push_str(" — STALE");
    }
    let tail = marks;
    // The ordinal is only printed when there IS a twin, so the overwhelming majority of
    // entries read as a plain function name and the marker means something where it
    // appears. Parsed back as part of the key — see `key_of`.
    let nth = if ord == 0 { String::new() } else { format!(" #{}", ord + 1) };
    if is_file {
        // Prose, unbackticked — see `FILE_ENTRY`. The heading is what `parse_shard` keys
        // the reading off, so this string is format rather than presentation.
        s.push_str(&format!("\n### {FILE_ENTRY}{tail}\n"));
    } else {
        s.push_str(&format!("\n### `{name}`{nth}{tail}\n"));
    }

    let mut meta = Vec::new();
    // First on the provenance line, and on the provenance line rather than beside the
    // grades, because that is what it is: which question this reading answered. Sat among
    // the grades it would read as one — a draft that stamped a version per axis rendered
    // `predicted 1 · documented 1 · legible 2` next to four grades, and three integers in
    // that slot are a score sheet. Omitted at 0 rather than printed: `spec 0` invites the
    // reading that somebody chose it, and absence is the honest shape of "taken before this
    // was recorded".
    if r.spec > 0 {
        meta.push(format!("spec {}", r.spec));
    }
    // Only when the body took more than one response. On the overwhelming majority of
    // readings there is nothing to prove and nothing is printed, on the same rule as every
    // other absence on this line — and its absence on a LARGE body is the whole signal, so
    // printing `served in 1 part` everywhere would bury the one case worth seeing.
    if let Some(n) = r.paged {
        meta.push(format!("served in {n} parts"));
    }
    if !r.body.is_empty() {
        meta.push(format!("read at `{}`", r.body));
    }
    if !r.at.is_empty() {
        meta.push(format!("commit `{}`", r.at));
    }
    if !r.model.is_empty() {
        meta.push(format!("read by {}", r.model));
    }
    // **Only when it disagrees with the self-report, because agreement is not news.** The
    // request is stamped on every reading a run takes (see `Report::asked`), but printing
    // "asked for sonnet · read by sonnet" on all of them spends a provenance line saying one
    // thing twice. What earns the words is the disagreement: a reader that was asked for one
    // model and reports another means the run is not on the scale somebody chose, and that
    // is the whole reason the pair is kept.
    if !r.asked.is_empty() && r.asked != r.model {
        meta.push(format!("asked for {}", r.asked));
    }
    // Always, when there is one — unlike `asked for`, which is only news on disagreement.
    // The agent is not derivable from anything else on the line: the same model id reads
    // through more than one of them, and which one is part of the instrument.
    if !r.harness.is_empty() {
        meta.push(format!("via {}", r.harness));
    }
    if !r.when.is_empty() {
        meta.push(format!("when {}", r.when));
    }
    if !r.by.is_empty() {
        meta.push(format!("by {}", r.by));
    }
    meta.push(if r.cold { "cold reading" } else { "warm reading" }.to_string());
    if let Some(n) = r.position {
        meta.push(format!("reading {n} of its run"));
    }
    // Only where there is something to be missing. A repo with no instructions file has
    // nothing to prime a reader WITH, so "not primed" there is noise on every entry — but
    // in a repo that has one, both answers are news: `in context` says this reading saw a
    // description of what it was predicting, and `excluded` says somebody launched the run
    // without it and the reading is worth what it claims to be.
    if !r.agent_docs.is_empty() {
        meta.push(format!(
            "priming: {} {}",
            r.agent_docs,
            if r.primed { "in context" } else { "excluded" }
        ));
    }
    s.push_str(&format!("- {}\n", meta.join(" · ")));

    s.push_str(&format!("- expected: {}\n", flat(&r.expected)));
    s.push_str(&format!("- found: {}\n", flat(&r.found)));

    let (predicted, documented) = r.grades();
    let doc = documented.map_or("not judged".to_string(), |g| grade_word(g).to_string());
    s.push_str(&format!(
        "- predicted: {} · documented: {} · derivable: {} · legible: {} · trap: {}{}\n",
        grade_word(predicted),
        doc,
        if r.derivable { "yes" } else { "no" },
        // "not judged", not a default grade: every reading banked before this field existed
        // has no opinion about legibility, and printing one would invent a measurement.
        r.legible.map_or("not judged".to_string(), |g| grade_word(g).to_string()),
        if r.trap { "yes" } else { "no" },
        // Written only when it was asked. A `test: no` on every Rust reading would be the
        // store recording an answer nobody gave.
        match r.test {
            Some(true) => " · test: yes",
            Some(false) => " · test: no",
            None => "",
        },
    ));

    if !r.note.trim().is_empty() {
        s.push_str(&format!("- note: {}\n", flat(&r.note)));
    }
    if stale {
        s.push_str(
            "- this code has changed since it was read; the reading above may no longer\n  \
             describe it, and Sanity will offer it for re-reading first.\n",
        );
    }
    s
}

fn render_shard(
    shard: &str,
    read: usize,
    total: usize,
    surprising: usize,
    stale: usize,
    dated: usize,
    body: &str,
) -> String {
    let stale_note = if stale > 0 { format!(" · {stale} stale") } else { String::new() };
    // Said in the header, not on every entry. Three repos would gain 6,900 identical lines
    // saying the same thing about the same release, which is decoration pretending to be
    // per-reading information — and the question a person actually has here is "how much of
    // this still counts", which is what the rest of this line answers.
    let dated_note = if dated > 0 {
        // Wrapped like every other paragraph here — it is prose in the same file, and a
        // single unbroken line is exactly the drift `render_index` warns about, hidden by
        // the fact that this one is built rather than written out.
        format!(
            "\n\n{dated} of these answered an earlier version of a question and are not\n\
             counted; see the note below."
        )
    } else {
        String::new()
    };
    // Only when there are some. A paragraph explaining an expiry that has not happened is
    // release notes in somebody's repo.
    let spec_note = if dated > 0 {
        "\n\n\
         `spec` is which version of the questions a reading answered. Two of them have\n\
         been rewritten. `legible` used to ask \"how clear is it on its own terms\",\n\
         which defined no rung but the top one; it now asks what reading it was like —\n\
         one pass, a second look, jumping around, or never being sure. `trap` used to\n\
         collect anything that surprised a reader, including hazards the code itself\n\
         already warns about; it now means only what will bite the next editor and\n\
         nothing has written down. Answers from before those changes are kept here,\n\
         because they are what a reader said, but they no longer color the map.\n\
         Re-read those functions to replace them."
    } else {
        ""
    };
    format!(
        "# {shard} — sanity assessment\n\
         \n\
         {read} of {total} read · {surprising} unpredicted{stale_note}{dated_note}\n\
         \n\
         Each entry below is one **reading**, of a function or of a whole file. An\n\
         agent was given its name, signature, neighboring names and comments — never\n\
         its body — and wrote down what it expected to find. Then it opened the file.\n\
         The gap between the two is the finding. A file's own entry is titled `the file\n\
         itself` and asks whether the header at the top describes what is actually in\n\
         there.\n\
         \n\
         `read at` is a hash of the body as it was when the reading was made. When it\n\
         stops matching the code, the reading is marked STALE and goes back in the\n\
         queue.\
         {spec_note}\n\
         \n\
         What this is and how to add to it: [README.md](README.md)\n\
         {body}"
    )
}

fn render_index(repo: &str, shards: &[(String, usize, usize, usize, usize, usize)]) -> String {
    // The `dated` column appears only when some reading is. A column of zeros in every
    // repo forever would be this release's footnote carved into everybody's index — and
    // the index and the shards have to agree, so it appears exactly when their headers say
    // it does.
    let any_dated = shards.iter().any(|(_, _, _, _, _, d)| *d > 0);
    let head = if any_dated {
        "| area | read | of | unpredicted | stale | dated |\n|---|---|---|---|---|---|\n"
    } else {
        "| area | read | of | unpredicted | stale |\n|---|---|---|---|---|\n"
    };
    let mut table = String::from(head);
    let (mut tr, mut tt, mut ts, mut tx, mut td) = (0, 0, 0, 0, 0);
    for (shard, read, total, surprising, stale, dated) in shards {
        table.push_str(&format!(
            "| [{}]({}) | {} | {} | {} | {}",
            shard,
            shard_file(shard),
            read,
            total,
            surprising,
            stale
        ));
        if any_dated {
            table.push_str(&format!(" | {dated}"));
        }
        table.push_str(" |\n");
        tr += read;
        tt += total;
        ts += surprising;
        tx += stale;
        td += dated;
    }
    table.push_str(&format!("| **total** | **{tr}** | **{tt}** | **{ts}** | **{tx}**"));
    if any_dated {
        table.push_str(&format!(" | **{td}**"));
    }
    table.push_str(" |\n");

    // **Wrapped at 78, every paragraph, and worth keeping that way.** The prose is edited
    // one sentence at a time and the lines drift, which is invisible in the source — the
    // continuations hide it — and glaring in the file somebody opens on GitHub, where a
    // 68-character line sits above an 84-character one. Rewrap the whole paragraph after
    // editing it, rather than pushing the overflow onto the next line.
    format!(
        "# Sanity assessment — {repo}\n\
         \n\
         A record of how well this repo might read to someone who has not read it.\n\
         \n\
         Each entry in the files below is one **reading**: an agent was shown a\n\
         function's name, signature, neighboring function names and comments, but never\n\
         its body. It was asked what it expected to find. Then it was given the file\n\
         and asked to explain the difference.\n\
         \n\
         **These files are meant to be read.**\n\
         \n\
         You do not need the Sanity CLI or GUI to get the information out of them: open\n\
         one and read it like notes from a code review.\n\
         \n\
         {table}\
         \n\
         ## Seeing it as a map\n\
         \n\
         Sanity draws this repo as a sunburst with every file and function represented,\n\
         colored by predictability, legibility, doc coverage, churn, and nine other\n\
         dimensions. Open the app to visualize these readings.\n\
         \n\
         ```\n\
         brew install --cask monsterdept/tap/sanity\n\
         ```\n\
         \n\
         Or download it for macOS, Linux or Windows from <https://sanity.monster>.\n\
         \n\
         ## Updating this assessment\n\
         \n\
         Readings go stale. Each one records a hash of the code and the comments it was\n\
         made against, so when either moves out from under a reading, Sanity marks it\n\
         STALE and offers it for re-reading before anything else.\n\
         \n\
         Coding agents do the reading, and Sanity runs them. From this repo:\n\
         \n\
         ```\n\
         sanity init\n\
         sanity check\n\
         ```\n\
         \n\
         Or add the repo in the app and press Read.\n\
         \n\
         Each reader is a separate process started outside this directory with no\n\
         access to the repo. It sees only what Sanity hands it. The window does not\n\
         have to be open while it works.\n\
         \n\
         ## Commit this directory\n\
         \n\
         A reading is minutes of careful work and tokens spent. Commit it so others can\n\
         benefit from it.\n\
         \n\
         Everything here is yours, and Sanity claims no rights in it. The text Sanity\n\
         writes here, including this file and the rule descriptions under `rules/`, is\n\
         dedicated to the public domain under CC0 1.0, so committing this directory\n\
         adds no license terms to this repo.\n"
    )
}

// ── Provenance ─────────────────────────────────────────────────────────────────

fn git(repo: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git").arg("-C").arg(repo).args(args).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!s.is_empty()).then_some(s)
}

/// The commit a reading was made at. Empty outside a git repo, which is allowed —
/// an assessment of a directory with no history is still an assessment.
pub fn head(repo: &Path) -> String {
    git(repo, &["rev-parse", "--short", "HEAD"]).unwrap_or_default()
}

/// Who made a reading, by the same identity git would put on a commit.
///
/// Recorded so a reader of the file can weigh an entry — not to partition the store.
/// Nothing anywhere keys off this.
pub fn who(repo: &Path) -> String {
    git(repo, &["config", "user.email"])
        .or_else(|| git(repo, &["config", "user.name"]))
        .unwrap_or_default()
}

/// Files a coding agent loads into its own context without being asked.
///
/// Only the ones a HOST injects unprompted. A `docs/` tree or a README is something a
/// reader would have to go and fetch, and fetching is a choice the reading can own; these
/// arrive before the reader has done anything, which is the difference that matters here.
const AGENT_DOCS: &[&str] = &["CLAUDE.md", "AGENTS.md", "GEMINI.md", ".cursorrules"];

/// Which of those this repo has at its root, comma-joined. Empty when it has none.
///
/// **This is the hazard, not the exposure**, and the distinction is the whole design.
/// Sanity can see that a repo carries a `CLAUDE.md`; it cannot see whether the reader that
/// just predicted a function had it in context, because a tool call arrives long after the
/// system prompt was built. So this is half the answer and [`crate::agentapi::Report::primed`]
/// is the other, and only the pair is worth anything: a reader reporting itself unprimed in
/// a repo with no instructions file has said nothing, while the same report here is the
/// evidence that a run was launched clean.
///
/// Root only. Claude Code also picks up a `CLAUDE.md` beside the file being worked on, so
/// this can undercount — but a root file is the one that covers the whole repo, and the
/// question is being asked about whole runs. It is the same shape as `cold`: a check worth
/// having is not the same as a proof.
pub fn agent_docs(repo: &Path) -> String {
    AGENT_DOCS.iter().filter(|f| repo.join(f).exists()).copied().collect::<Vec<_>>().join(", ")
}

/// The moment a reading was taken, as sortable UTC — `2026-08-13T05:12:03Z`.
///
/// **A reading had no date at all until now**, which made two ordinary questions
/// unanswerable: how old is this reading, and — when a repo's corpus is mixed — which model
/// read it most recently. `at` looks like it should answer them and does not: it is the
/// COMMIT the code was at, so every reading taken in one sitting shares it and its date is
/// about the code rather than the reading.
///
/// ISO-8601 rather than epoch seconds because the store is Markdown somebody reads, and a
/// ten-digit integer in a provenance line is the readable copy being the wrong one. It also
/// sorts lexicographically, which is the whole job here.
///
/// Hand-rolled from `SystemTime`, because this is the only date the crate formats and a
/// dependency for it would be 250KB to print eight numbers. The civil-from-days conversion
/// is Hinnant's, which is exact for every date this will ever see.
pub fn now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    iso_of(secs)
}

/// [`now_iso`] for a given epoch second, so the conversion can be tested against dates
/// nobody has to wait for.
fn iso_of(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    let (h, min, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{min:02}:{s:02}Z")
}

/// Days since 1970-01-01 to a civil date. Hinnant's algorithm, unchanged.
fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A human's file in `.sanity/` survives a report; a shard that lost its readings does not.
    ///
    /// The sweep used to remove every `.md` that was not `README.md` or a current shard, and
    /// discard the result. `.sanity/` is a directory this tool shares with a person — it is
    /// committed, and the whole point is that a human can read it — so a note left there
    /// disappeared on the next reading with nothing said. Deriving the list from the
    /// outgoing index is what makes the sweep incapable of touching a file it did not write.
    #[test]
    fn a_human_file_in_the_assessment_survives_a_save() {
        let _home = crate::agentapi::tests::data_home();
        let repo = tempfile::tempdir().unwrap();
        std::fs::write(repo.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let scan = crate::scan::scan(
            repo.path(),
            &|_| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            &crate::scancache::ScanCache::ephemeral(),
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Lines,
        )
        .unwrap();

        save(repo.path(), &scan, &HashMap::new()).unwrap();

        let mine = dir(repo.path()).join("NOTES.md");
        std::fs::write(&mine, "# my notes\n").unwrap();
        // A shard this tool wrote and has since stopped claiming.
        let orphan = dir(repo.path()).join("gone.md");
        std::fs::write(&orphan, "# an old shard\n").unwrap();

        save(repo.path(), &scan, &HashMap::new()).unwrap();

        assert!(mine.exists(), "a human's note was deleted by a save");
        // `gone.md` was never linked by an index this tool wrote, so it is not ours to
        // remove either — the rule is "what we claimed", not "what we recognize".
        assert!(orphan.exists(), "a file this tool never linked was removed");
    }

    fn report(id: &str, note: &str) -> Report {
        Report {
            id: id.to_string(),
            expected: "a thing\nover two lines".to_string(),
            found: "another thing".to_string(),
            predicted: Some(Grade::Some),
            documented: Some(Grade::Full),
            derivable: false,
            legible: Some(Grade::Most),
            trap: true,
            note: note.to_string(),
            cold: true,
            position: Some(3),
            body: "aabbccddeeff".to_string(),
            by: "ross@rossturk.com".to_string(),
            at: "37eb765".to_string(),
            ..Report::blank()
        }
    }

    /// **A heading mark is decoration, and a shard written with either vocabulary still
    /// parses.** The marks moved from the app's display words (`OBSCURE`, `TANGLED`) to the
    /// grade names; every shard already on disk carries the old ones, and `parse_shard` keys
    /// on the NAME, so both spellings have to come back as the same entry.
    #[test]
    fn a_heading_mark_names_the_axis_and_the_grade_and_parses_either_way() {
        let r = Report {
            predicted: Some(Grade::None),
            legible: Some(Grade::Some),
            spec: SPEC,
            ..report("src/a.rs#foo@12", "a note")
        };
        let entry = render_entry("foo", 0, false, &r, false);
        assert!(
            entry.contains("### `foo` — PREDICTED NONE — LEGIBLE SOME — TRAP\n"),
            "marks name the axis and its grade: {entry}"
        );

        for heading in [
            "### `foo` — PREDICTED SOME — LEGIBLE NONE — TRAP — STALE",
            "### `foo` — OBSCURE — TANGLED — TRAP",
        ] {
            let mut back = HashMap::new();
            parse_shard(
                &format!(
                    "## src/a.rs\n\n{heading}\n\
                     - read at `aabb` · by dana@example.com · cold reading\n\
                     - expected: x\n\
                     - found: y\n\
                     - predicted: some · documented: none · derivable: no\n"
                ),
                &mut back,
            );
            assert!(back.contains_key("src/a.rs#foo"), "`{heading}` did not parse to `foo`");
        }
    }

    #[test]
    fn round_trips() {
        let r = report("src/a.rs#foo@12", "a note");
        let mut body = String::from("\n## src/a.rs\n");
        body.push_str(&render_entry("foo", 0, false, &r, false));
        let text = render_shard("src", 1, 1, 1, 0, 0, &body);

        let mut back = HashMap::new();
        parse_shard(&text, &mut back);
        let got = back.get("src/a.rs#foo").expect("entry survived the round trip");
        assert_eq!(got.expected, "a thing over two lines");
        assert_eq!(got.found, "another thing");
        assert_eq!(got.note, "a note");
        assert_eq!(got.body, "aabbccddeeff");
        assert_eq!(got.at, "37eb765");
        assert_eq!(got.by, "ross@rossturk.com");
        assert!(got.cold);
        assert!(!got.derivable);
        // The second axis has to survive the store, not just the wire. This repo has
        // already lost four fields once — the schema declared them, `Report` held them,
        // and the copy of the contract in between dropped them silently. A field that
        // round-trips through neither is indistinguishable from a field nobody sent.
        assert_eq!(got.legible, Some(Grade::Most), "legible did not survive the round trip");
        assert!(got.trap, "trap did not survive the round trip");
        // **Absent means nobody asked, and that has to survive too.** `test` is written only
        // where a reader was asked for it, so a reading that carries no `test:` segment must
        // come back `None` — not `Some(false)`, which would be the store holding an answer
        // nobody gave and would count a repo's tests as production code.
        assert_eq!(got.test, None, "an unasked question is not a `no`");
        assert_eq!(got.predicted, Some(Grade::Some));
        assert_eq!(got.documented, Some(Grade::Full));
        // Where the reading sat in its reader's run. `read at`, `read by` and `reading N`
        // all start "read", so this is also the check that the segment prefixes still
        // pick each other apart.
        assert_eq!(got.position, Some(3));
    }

    /// A reading banked before position existed must come back as unknown, never as 1.
    ///
    /// The distinction is the entire point of the field: an unrecorded position is not a
    /// claim that the reader was on its first function, and silently treating it as one
    /// would make a batched run look uniform — which is the state this was added to make
    /// visible.
    #[test]
    fn a_reading_without_a_position_does_not_claim_to_be_the_first() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo` — surprising\n\
             - read at `aabb` · by dana@example.com · cold reading\n\
             - expected: x\n\
             - found: y\n\
             - predicted: some · documented: none · derivable: no\n",
            &mut back,
        );
        assert_eq!(back["src/a.rs#foo"].position, None);
    }

    /// A reading banked before the spec existed is spec 0, and its `legible` is not trusted.
    ///
    /// The whole corpus is in this state — three repos, 6,900 readings, none of them
    /// carrying a spec — so this is the case that decides whether the change does anything
    /// at all. Absence must read as "answered an unknown question", never as "answered the
    /// current one", which is the direction a `unwrap_or(SPEC)` would quietly take it.
    #[test]
    fn a_reading_without_a_spec_does_not_claim_todays_question() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo`\n\
             - read at `aabb` · by dana@example.com · cold reading\n\
             - expected: x\n\
             - found: y\n\
             - predicted: some · documented: none · derivable: no · legible: full\n",
            &mut back,
        );
        let r = &back["src/a.rs#foo"];
        assert_eq!(r.spec, 0, "no spec bullet means spec 0");
        assert_eq!(r.legible, Some(Grade::Full), "the grade is kept — it is what a reader said");
        assert!(!legible_current(r.spec), "but it does not answer today's question");
    }

    /// A whole corpus's traps expire when the question narrows, and each axis expires alone.
    ///
    /// The pair is what makes this worth a test. `trap` moved at spec 3 and `legible` at
    /// spec 2, so a reading taken under spec 2 is current on one axis and superseded on the
    /// other — and the obvious simplification, one `dated` flag for the whole reading, would
    /// throw away a legibility grade to report a trap question that changed under it.
    #[test]
    fn each_axis_expires_on_its_own_spec() {
        assert!(legible_current(2), "spec 2 answered today's legibility question");
        assert!(!trap_current(2), "and an earlier trap question");
        assert!(trap_current(TRAP_SINCE), "the spec that narrowed it");
        assert!(trap_current(SPEC + 99), "and anything a later build stamps");
        assert!(!trap_current(0), "everything unversioned is unknown, not clear");
    }

    /// Two builds, one repo: neither one throws away the other's work.
    ///
    /// The case this file cannot control. Somebody runs an older app, or a newer one, and
    /// both write into the same `.sanity/`. A reading from a NEWER spec is trusted — a later
    /// spec refines the question, and graying out a colleague's fresh reading because we are
    /// behind would punish them for updating first. A reading from an OLDER spec is not.
    /// Both fall out of one `>=`; the test is here because the asymmetry is easy to
    /// "correct" into an equality by somebody who has not thought about the second case.
    #[test]
    fn a_reading_from_a_newer_build_is_still_trusted() {
        assert!(legible_current(LEGIBLE_SINCE), "the spec that set the question");
        assert!(legible_current(SPEC + 99), "a build we have never heard of");
        assert!(!legible_current(LEGIBLE_SINCE - 1), "the spec before it");
        assert!(!legible_current(0), "and everything unversioned");
    }

    /// **A reader's answer about test code survives the store, in all three states.**
    ///
    /// `Some(true)` and `Some(false)` are both answers somebody gave; `None` is nobody having
    /// been asked, which is written as an absent segment rather than as a `no`. The three are
    /// what `Tested::Reader` is worth, and a store that collapsed the last two would count a
    /// repo's tests as the code they exercise — see `edges::Wire::dependents`.
    #[test]
    fn a_readers_answer_about_tests_survives_the_store() {
        for want in [Some(true), Some(false), None] {
            let r = Report { test: want, ..report("src/a.rs#foo@12", "a note") };
            let mut body = String::from("\n## src/a.rs\n");
            body.push_str(&render_entry("foo", 0, false, &r, false));
            let text = render_shard("src", 1, 1, 1, 0, 0, &body);

            let mut back = HashMap::new();
            parse_shard(&text, &mut back);
            let got = back.get("src/a.rs#foo").expect("survived");
            assert_eq!(got.test, want, "`test: {want:?}` did not survive the round trip");
        }
    }

    /// The spec rides on the provenance line and survives the round trip.
    ///
    /// On the provenance line and not among the grades, which is a rendering decision with a
    /// reason: `spec 7` beside `predicted: most · documented: full` reads as a fifth grade.
    /// It sits with `read at` and `by`, which is what it is.
    #[test]
    fn a_spec_round_trips_as_provenance() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo`\n\
             - spec 7 · read at `aabb` · by dana@example.com · cold reading\n\
             - expected: x\n\
             - found: y\n\
             - predicted: some · documented: none · derivable: no · legible: full\n",
            &mut back,
        );
        let r = &back["src/a.rs#foo"];
        assert_eq!(r.spec, 7);
        assert!(legible_current(r.spec));
        // And back out again, in the same slot.
        let rendered = render_entry("foo", 0, false, r, false);
        assert!(rendered.contains("- spec 7 · read at"), "got: {rendered}");
    }

    /// Priming round-trips as a pair, and says nothing when there is nothing to say.
    ///
    /// The two halves are recorded together because neither is worth much alone: what the
    /// repo HELD is server-stamped and checkable, what was in the reader's CONTEXT is the
    /// only thing the reader can see, and the finding is the combination. So one segment
    /// carries both, and a repo with no instructions file renders none — an entry that said
    /// "not primed" on every reading of a repo with nothing to be primed by is noise that
    /// teaches people to skip the field that matters.
    #[test]
    fn priming_round_trips_and_is_silent_when_there_is_nothing_to_say() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo`\n\
             - spec 1 · read at `aabb` · cold reading · priming: CLAUDE.md in context\n\
             - expected: x\n\
             - found: y\n\
             - predicted: full · documented: none · derivable: no · legible: full\n\
             \n### `bar`\n\
             - spec 1 · read at `ccdd` · cold reading · priming: CLAUDE.md, AGENTS.md excluded\n\
             - expected: x\n\
             - found: y\n\
             - predicted: full · documented: none · derivable: no · legible: full\n",
            &mut back,
        );
        let primed = &back["src/a.rs#foo"];
        assert!(primed.primed);
        assert_eq!(primed.agent_docs, "CLAUDE.md");
        // Two instruction files still round trip: the list runs up to the verdict, so the
        // comma inside it is not a boundary.
        let clean = &back["src/a.rs#bar"];
        assert!(!clean.primed);
        assert_eq!(clean.agent_docs, "CLAUDE.md, AGENTS.md");

        assert!(
            render_entry("foo", 0, false, primed, false).contains("priming: CLAUDE.md in context"),
        );
        assert!(render_entry("bar", 0, false, clean, false)
            .contains("priming: CLAUDE.md, AGENTS.md excluded"),);

        // A repo with no instructions file has nothing to be primed by, and says so by
        // saying nothing. `primed` alone must not be enough to print a segment.
        let mut lone = Report { primed: true, ..Report::blank() };
        lone.body = "aabb".into();
        assert!(!render_entry("baz", 0, false, &lone, false).contains("priming"));
    }

    /// The model a run ASKED for survives a save, and is silent when it agrees.
    ///
    /// Both halves matter. Round-tripping is what stops `sanity refresh` from quietly
    /// dropping the field — the store is the only copy, and a segment that renders but does
    /// not parse is lost the first time somebody reformats. Silence on agreement is what
    /// keeps it from being noise on every reading of every run: the pair is kept so that a
    /// DISagreement is visible, and a reader that reports the model it was asked for has
    /// already said the whole thing once.
    #[test]
    fn the_asked_for_model_round_trips_and_is_silent_when_it_agrees() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo`\n\
             - spec 1 · read at `aabb` · read by haiku · asked for sonnet · cold reading\n\
             - expected: x\n\
             - found: y\n\
             - predicted: full · documented: none · derivable: no · legible: full\n",
            &mut back,
        );
        let swapped = &back["src/a.rs#foo"];
        assert_eq!(swapped.model, "haiku");
        assert_eq!(swapped.asked, "sonnet");
        assert!(render_entry("foo", 0, false, swapped, false).contains("asked for sonnet"));

        // Agreement says nothing: `read by` already carries it.
        let agreed = Report {
            model: "sonnet".into(),
            asked: "sonnet".into(),
            body: "aabb".into(),
            ..Report::blank()
        };
        assert!(!render_entry("foo", 0, false, &agreed, false).contains("asked for"));

        // And a reading nobody asked anything of — a hand-driven reader, belonging to no
        // run — must not grow an empty claim.
        let hand = Report { model: "sonnet".into(), body: "aabb".into(), ..Report::blank() };
        assert!(!render_entry("foo", 0, false, &hand, false).contains("asked for"));
        assert!(!render_entry("foo", 0, false, &hand, false).contains("via "));
    }

    /// A reading's date round trips, and the conversion is right for dates nobody waited for.
    ///
    /// The whole value of `when` is that it sorts, so a wrong month makes a mixed corpus
    /// recommend the wrong model — quietly, and only on some days of some years. Leap day
    /// and a year boundary are where hand-rolled civil-date arithmetic goes wrong.
    #[test]
    fn a_reading_says_when_it_was_taken() {
        assert_eq!(iso_of(0), "1970-01-01T00:00:00Z");
        assert_eq!(iso_of(1_767_225_600), "2026-01-01T00:00:00Z");
        // 2024-02-29, which only exists if the leap rule is right.
        assert_eq!(iso_of(1_709_208_000), "2024-02-29T12:00:00Z");
        assert_eq!(iso_of(1_767_225_599), "2025-12-31T23:59:59Z");
        // Sorting the strings has to be sorting the instants — that is what it is for.
        assert!(iso_of(1_700_000_000) < iso_of(1_700_000_001));

        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo`\n\
             - spec 1 · read at `aabb` · read by sonnet · when 2026-08-13T05:12:03Z\n\
             - expected: x\n\
             - found: y\n\
             - predicted: full · documented: none · derivable: no · legible: full\n",
            &mut back,
        );
        let r = &back["src/a.rs#foo"];
        assert_eq!(r.when, "2026-08-13T05:12:03Z");
        assert!(render_entry("foo", 0, false, r, false).contains("when 2026-08-13T05:12:03Z"));

        // Undated readings — every one banked before the field — say nothing rather than
        // claiming the epoch.
        let old = Report { model: "sonnet".into(), body: "aabb".into(), ..Report::blank() };
        assert!(!render_entry("foo", 0, false, &old, false).contains("when "));
    }

    /// The agent survives a save, which is what makes it preselectable.
    ///
    /// The machine-local index is a preference and the corpus is the record — a repo read
    /// on another laptop arrives with an index that has never heard of it. If this stops
    /// round-tripping, `banked_harness` silently becomes `None` everywhere and the dialog
    /// goes back to asking a question the repo can already answer.
    #[test]
    fn the_agent_that_read_round_trips() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo`\n\
             - spec 1 · read at `aabb` · read by claude-sonnet-4.6 · via agy · cold reading\n\
             - expected: x\n\
             - found: y\n\
             - predicted: full · documented: none · derivable: no · legible: full\n",
            &mut back,
        );
        let r = &back["src/a.rs#foo"];
        assert_eq!(r.harness, "agy");
        // The pair is the point: this model is reachable through two agents, so neither
        // half attributes the reading on its own.
        assert_eq!(r.model, "claude-sonnet-4.6");
        assert!(render_entry("foo", 0, false, r, false).contains("via agy"));
    }

    /// An older build's reader must not be broken by a bullet it has never heard of.
    ///
    /// This is the property the whole "add a field, don't change the format" rule rests on,
    /// and it is worth a test rather than a promise: `parse_shard` matches segment prefixes
    /// and drops what it does not recognize, so a shard written by a future build still
    /// yields its readings here. If that ever stops being true, adding a field stops being
    /// free and becomes the class of change that once destroyed a project's readings.
    #[test]
    fn an_unknown_segment_costs_that_segment_and_nothing_else() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo`\n\
             - spec 9 · read at `aabb` · confidence high · by dana@example.com · cold reading\n\
             - expected: x\n\
             - found: y\n\
             - predicted: some · documented: none · derivable: no · legible: full · vibes: good\n",
            &mut back,
        );
        let r = &back["src/a.rs#foo"];
        assert_eq!(r.body, "aabb");
        assert_eq!(r.by, "dana@example.com");
        assert_eq!(r.legible, Some(Grade::Full));
        assert_eq!(r.spec, 9);
    }

    /// The shard says how many of its grades no longer answer today's question.
    ///
    /// Because the store is the copy people read without the app, and a shard printing
    /// `legible: clean` beside a map that has gone gray is the same failure as an index
    /// claiming a coverage it has not got — two records of one thing, disagreeing, with the
    /// unwatched one wrong.
    ///
    /// A reading that never graded legibility is NOT dated, it is ungraded. Folding those
    /// together would report an expiry over work nobody did, and would put a number in the
    /// header of every shard in every repo that has readings from before the field existed.
    #[test]
    fn a_shard_counts_grades_that_answer_an_older_question() {
        let scan = scan_of(&[
            ("src/a.rs", "old", 10, "one"),
            ("src/a.rs", "fresh", 20, "two"),
            ("src/a.rs", "never", 30, "three"),
        ]);
        let mut reports = HashMap::new();
        for (id, l) in live_funcs(&scan) {
            let mut r = report(&id, &l.name);
            r.body = l.body.clone();
            // The helper flags a trap on everything, and a trap is graded too — see
            // `TRAP_SINCE`. Cleared so this half of the test is about `legible` alone;
            // the trap axis gets its own reading below.
            r.trap = false;
            match l.name.as_str() {
                // Graded under the question we have since rewritten.
                "old" => r.legible = Some(Grade::Full),
                // Graded under today's.
                "fresh" => {
                    r.legible = Some(Grade::Full);
                    r.spec = SPEC;
                }
                // Never graded at all.
                _ => r.legible = None,
            }
            reports.insert(id, r);
        }
        let compiled = compile(&scan, &reports);
        let src = compiled.iter().find(|c| c.shard == "src").expect("one shard");
        assert_eq!(src.dated, 1, "only the pre-spec GRADE counts, not the ungraded reading");

        let text = render_shard(
            &src.shard,
            src.read,
            src.total,
            src.surprising,
            src.stale,
            src.dated,
            &src.body,
        );
        assert!(text.contains("1 of these answered an earlier version of a question"), "{text}");

        // **Any graded axis counts, not just legibility.** `trap` moved at spec 3 while
        // `legible` moved at 2, so the reading below is current on one and superseded on
        // the other — and a header that only looked at legibility would report this shard
        // as entirely up to date while the map greys half its trap answers.
        for r in reports.values_mut() {
            if r.id.contains("never") {
                r.trap = true;
                r.note = "the bite".into();
                r.spec = LEGIBLE_SINCE;
            }
        }
        let compiled = compile(&scan, &reports);
        let src = compiled.iter().find(|c| c.shard == "src").expect("one shard");
        assert_eq!(src.dated, 2, "a trap answered under spec 2 is dated too");
        // And nothing about it when there is nothing to say.
        let quiet = render_shard("src", 1, 1, 0, 0, 0, "");
        assert!(!quiet.contains("earlier question"), "no release notes in a clean repo");
    }

    /// The key is `path#name`, never the node id: a reading must survive somebody adding
    /// an import above the function it describes.
    #[test]
    fn key_ignores_line_numbers() {
        let a = scan_of(&[("src/a.rs", "foo", 12, "body")]);
        let b = scan_of(&[("src/a.rs", "foo", 480, "body")]);
        assert_eq!(
            live_funcs(&a).keys().collect::<Vec<_>>(),
            live_funcs(&b).keys().collect::<Vec<_>>()
        );
    }

    /// Two `init`s in one Swift file used to share a key. The second overwrote the first,
    /// so one reading was dropped on write, the slot vanished from the totals, and on
    /// reload both functions were handed the survivor's reading — which then compared
    /// against the wrong body and reported itself STALE.
    #[test]
    fn same_named_functions_in_one_file_stay_apart() {
        let scan = scan_of(&[
            ("A.swift", "init", 10, "one"),
            ("A.swift", "init", 40, "two"),
            ("A.swift", "other", 70, "three"),
        ]);
        let live = live_funcs(&scan);
        assert_eq!(live.len(), 3, "no function is lost to a key collision");
        assert!(live.contains_key("A.swift#init"));
        assert!(live.contains_key("A.swift#init#2"));
        // Each twin keeps its OWN body, which is what stopped the false expiries.
        assert_eq!(live["A.swift#init"].body, body_hash("one"));
        assert_eq!(live["A.swift#init#2"].body, body_hash("two"));

        // And the ordinal survives the file round trip.
        let tmp = std::env::temp_dir().join(format!("sanity-twins-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let reports: HashMap<String, Report> = live
            .values()
            .map(|l| {
                (
                    l.id.clone(),
                    Report { body: l.body.clone(), ..report(&l.id, l.name.clone().as_str()) },
                )
            })
            .collect();
        save(&tmp, &scan, &reports).unwrap();
        let back = load(&tmp, &scan);
        assert_eq!(back.len(), 3, "every reading came back to its own function");
        for l in live.values() {
            assert!(!is_stale(&back[&l.id], Some(l.body.as_str()), None), "{} is not stale", l.id);
        }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    /// A file's own reading survives the round trip, and cannot collide with a function's.
    ///
    /// The two live in one map and one shard. A file is keyed by its bare path — every
    /// function key holds a `#` — and titled as prose so a human reading the shard does not
    /// take it for a function of that name.
    #[test]
    fn a_file_reading_round_trips_beside_its_functions() {
        let scan = scan_of(&[("gate.rs", "open", 10, "one"), ("gate.rs", "shut", 20, "two")]);
        let files = live_files(&scan);
        assert_eq!(files.len(), 1);
        assert!(files.contains_key("gate.rs"), "keyed by the bare path");

        let mut reports: HashMap<String, Report> = live_funcs(&scan)
            .values()
            .map(|l| (l.id.clone(), Report { body: l.body.clone(), ..report(&l.id, &l.name) }))
            .collect();
        let f = &files["gate.rs"];
        reports.insert(f.id.clone(), Report { body: f.body.clone(), ..report(&f.id, "gate.rs") });

        let tmp = std::env::temp_dir().join(format!("sanity-fileread-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        save(&tmp, &scan, &reports).unwrap();

        // The shard says which entry is the file, in prose rather than as an identifier.
        let shard =
            std::fs::read_to_string(dir(&tmp).join(shard_file(&shard_of("gate.rs")))).unwrap();
        assert!(shard.contains(&format!("### {FILE_ENTRY}")), "{shard}");
        assert!(shard.contains("### `open`"));

        let back = load(&tmp, &scan);
        assert_eq!(back.len(), 3, "two functions and their file all came back");
        assert!(back.contains_key("gate.rs"), "the file's reading is keyed by its path");
        assert!(!is_stale(&back["gate.rs"], f.body.as_str().into(), None));
        let _ = std::fs::remove_dir_all(&tmp);
    }

    /// A reformat must not expire a repo's worth of honest readings.
    #[test]
    fn hash_ignores_formatting() {
        assert_eq!(body_hash("if x {\n    go();\n}"), body_hash("if x {\n        go();\n    }"));
        assert_ne!(body_hash("go()"), body_hash("stop()"));
    }

    /// Rewriting a doc comment must expire the reading that graded it.
    ///
    /// `documented` and `derivable` are judgements about the comment, and `predicted` is
    /// made from it — so a corrected doc means both questions were answered about text
    /// that is gone. Hashing only the body left those grades looking current.
    #[test]
    fn a_reading_expires_when_its_documentation_changes() {
        let body = "if x { go() }";
        assert_ne!(
            reading_hash(None, Some("Goes, if x."), body),
            reading_hash(None, Some("Goes, unless x."), body),
            "a rewritten doc is a different reading"
        );
        assert_ne!(
            reading_hash(None, None, body),
            reading_hash(None, Some("Goes, if x."), body),
            "documenting an undocumented function is a change too"
        );
        // But reflowing one is not. A doc rewrapped to a different column says the same
        // thing, and expiring honest work over it teaches people to ignore the flag.
        assert_eq!(
            reading_hash(None, Some("Goes,\nif x."), body),
            reading_hash(None, Some("Goes, if x."), body)
        );
    }

    /// The module banner is in the stack a reader predicts from, so it is in the hash.
    ///
    /// It reaches the reader through `collect_tasks`, which appends the file's doc under
    /// the function's own — so a rewritten banner changes what every function in that file
    /// was predicted from, and a hash that ignored it would leave the whole file reading as
    /// current against a description nobody can find any more.
    #[test]
    fn a_reading_expires_when_its_module_header_changes() {
        let body = "if x { go() }";
        let doc = Some("Goes, if x.");
        assert_ne!(
            reading_hash(Some("The gate module."), doc, body),
            reading_hash(Some("The valve module."), doc, body),
            "a rewritten module header is a different reading"
        );
        assert_ne!(
            reading_hash(None, doc, body),
            reading_hash(Some("The gate module."), doc, body),
            "gaining a header is a change too"
        );
        // The two docs are distinguishable from each other, not just concatenated: moving a
        // sentence from the function's doc up to the file's is a real change to what a
        // reader is handed FIRST, and the stack has an order for that reason.
        assert_ne!(
            reading_hash(Some("A."), Some("B."), body),
            reading_hash(Some("B."), Some("A."), body),
            "which doc a sentence sits in is part of the reading"
        );
    }

    #[test]
    fn stale_when_the_body_moves() {
        let r = report("src/a.rs#foo@1", "");
        assert!(!is_stale(&r, Some("aabbccddeeff"), None));
        assert!(is_stale(&r, Some("000000000000"), None));
        // A migrated reading with no recorded hash is taken at its word.
        let old = Report { body: String::new(), ..r };
        assert!(!is_stale(&old, Some("000000000000"), None));
    }

    /// A reading of a body too large to have been served whole, with nothing saying it
    /// arrived in parts, is expired however well its hash matches.
    ///
    /// **This is what clears the eighteen readings that were graded against bodies nobody
    /// received.** Before `reveal` paged, an extent over `PART_BYTES` went out in one
    /// response and reached the reader truncated or not at all; the readings came back
    /// confident anyway, all eighteen on the same flattering rung, with the fact recorded
    /// only in prose. There is no sweep and no migrator — the store is never rewritten, and
    /// a translator over it is the thing that once destroyed a project's readings. What
    /// there is instead is an invariant: a large body's reading is current only while it
    /// carries the evidence, so the old ones re-queue and are replaced by re-reading.
    #[test]
    fn a_large_body_read_without_paging_is_expired() {
        let hash = body_hash("fn big() {}");
        let r = Report { body: hash.clone(), ..report("src/a.rs#big@1", "") };
        let big = Some(crate::agentapi::PART_BYTES as u32 + 1);
        let small = Some(crate::agentapi::PART_BYTES as u32 - 1);

        // The hash matches in every one of these. The extent and the record are the only
        // things moving.
        assert!(!is_stale(&r, Some(&hash), small), "a small body is unaffected");
        assert!(is_stale(&r, Some(&hash), big), "a large body with no paging record stands");

        let served = Report { paged: Some(4), ..r.clone() };
        assert!(!is_stale(&served, Some(&hash), big), "a reading that took its parts expired");

        // An unknown extent is not stale: `None` is a tree cached before the extent
        // existed, and expiring every corpus on a missing field is the worst reading of it
        // available. Which way to fail is the point of the assertion.
        assert!(!is_stale(&r, Some(&hash), None), "an unknown extent expired a reading");
    }

    /// A hand-merged file will have damage in it. One broken entry must not cost the
    /// rest of the file.
    #[test]
    fn survives_a_mangled_entry() {
        let text = "## src/a.rs\n\
                    \n### `broken` — surprising\n\
                    - read at `dead`\n\
                    \n### `intact` — nearly\n\
                    - read at `beef` · by dana@example.com · cold reading\n\
                    - expected: something\n\
                    - found: something else\n\
                    - predicted: most · documented: none · derivable: yes\n";
        let mut out = HashMap::new();
        parse_shard(text, &mut out);
        assert!(!out.contains_key("src/a.rs#broken"), "an entry with no reading is dropped");
        let ok = out.get("src/a.rs#intact").expect("its neighbor survives");
        assert_eq!(ok.predicted, Some(Grade::Most));
        assert!(ok.derivable);
    }

    /// Build a scan holding one function per named `key_of(path, name, ord)` — the same
    /// identity the real scan mints, so a fixture cannot pass under a scheme the app does
    /// not use.
    fn scan_of(funcs: &[(&str, &str, u32, &str)]) -> Scan {
        use crate::model::Node;
        let mut root = Node::dir("", "");
        let mut by_file: BTreeMap<String, Vec<Node>> = BTreeMap::new();
        let mut ords: HashMap<(&str, &str), usize> = HashMap::new();
        for (path, name, line, body) in funcs {
            let mut n = Node::dir(path, name);
            n.kind = NodeKind::Func;
            let ord = ords.entry((path, name)).or_insert(0);
            n.id = key_of(path, name, *ord);
            *ord += 1;
            n.path = path.to_string();
            n.line = Some(*line);
            n.body = Some(body_hash(body));
            by_file.entry(path.to_string()).or_default().push(n);
        }
        for (path, kids) in by_file {
            let mut f = Node::dir(&path, &path);
            f.kind = NodeKind::File;
            f.path = path.to_string();
            // What a reading of the FILE is checked against — see `scan`, which builds this
            // from the header and the declarations.
            f.body = Some(body_hash(&format!("header of {path}")));
            f.children = kids;
            root.children.push(f);
        }
        Scan {
            root,
            stats: crate::scan::ScanStats {
                headcount: 0,
                age_days: 0,
                commits: 0,
                churn_windows: [30, 60, 90, 180],
                churned: false,
                tangle_bands: Default::default(),
                files_scanned: 0,
                files_skipped: 0,
                unscanned: Default::default(),
                functions: funcs.len(),
                authors: Vec::new(),
                without_history: true,
                model: "test".into(),
                calls_resolved: 0,
                calls_unresolved: 0,
            },
            links: Default::default(),
        }
    }

    /// An index written by an older Sanity is brought up to date without a new reading.
    ///
    /// The case it exists for is the FINISHED repo: nothing left to read means nothing is
    /// ever saved, so the file that ships to strangers keeps whatever prose it was written
    /// with — including instructions for a version that no longer works that way.
    #[test]
    fn a_stale_index_is_rewritten_on_open_and_an_absent_one_is_not_created() {
        let tmp = std::env::temp_dir().join(format!("sanity-index-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();

        let scan = scan_of(&[("src-tauri/src/scan.rs", "walk", 40, "fn walk() {}")]);
        let reports: HashMap<String, Report> = scan
            .root
            .children
            .iter()
            .flat_map(|f| f.children.iter())
            .map(|n| {
                let r =
                    Report { body: n.body.clone().unwrap_or_default(), ..report(&n.id, "a thing") };
                (n.id.clone(), r)
            })
            .collect();

        // No assessment here yet: an open must look and leave nothing behind.
        assert!(matches!(refresh(&tmp, &scan, &reports), Index::Absent));
        assert!(!dir(&tmp).exists(), "opening a repo must not create .sanity/");

        save(&tmp, &scan, &reports).unwrap();
        // Freshly written, so there is nothing to do — and nothing is written, because a
        // rewrite of identical bytes dirties a checkout on every open of every repo.
        assert!(matches!(refresh(&tmp, &scan, &reports), Index::Current));

        // An index carrying an older version's copy.
        let path = dir(&tmp).join("README.md");
        let old = std::fs::read_to_string(&path)
            .unwrap()
            .replace("sanity check", "study this project in sanity");
        std::fs::write(&path, &old).unwrap();

        assert!(matches!(refresh(&tmp, &scan, &reports), Index::Refreshed));
        let now = std::fs::read_to_string(&path).unwrap();
        assert!(now.contains("sanity check"), "the copy is current again");

        // Byte-identical to what `save` writes. If these two ever disagreed, `open` and
        // `report` would rewrite the file past each other and the repo would carry a
        // permanently dirty diff.
        save(&tmp, &scan, &reports).unwrap();
        assert_eq!(std::fs::read_to_string(&path).unwrap(), now);

        let _ = std::fs::remove_dir_all(&tmp);
    }

    /// The whole point, exercised end to end: write the repo's assessment, read it back,
    /// and confirm a reading survives the source moving down the file.
    /// **A story banked before the derivable bits existed must not assert an answer.**
    ///
    /// Zero is what every reading in every cached timeline reads for bits 10 and 11, and the
    /// one thing it must not mean is `no`. There is no format bump behind this — the whole
    /// reason for three states rather than a flag is that a bump would cost every user their
    /// traced story to buy a pulse — so this test is the only thing standing between an old
    /// timeline and a map confidently reporting that nobody's docs are derivable.
    #[test]
    fn an_unpacked_zero_is_not_an_answer_about_derivable() {
        let bits = |packed: u16| (packed >> 10) & 3;
        assert_eq!(bits(0), 0, "an old story says nothing, and nothing is not `no`");

        let mut r = report("f", "");
        r.derivable = true;
        assert_eq!(bits(packed(&r)), 2, "a derivable doc says so");
        r.derivable = false;
        assert_eq!(bits(packed(&r)), 1, "and one that is not says THAT, rather than nothing");

        // The forcing still travels with it: what the ramp paints is unchanged, and only the
        // reason is new — see `packed`.
        r.derivable = true;
        r.documented = Some(crate::agentapi::Grade::Full);
        assert_eq!(
            (packed(&r) >> 3) & 7,
            1,
            "a derivable doc is packed as `none` however it was graded"
        );
    }

    #[test]
    fn writes_and_reloads_a_repo_assessment() {
        let tmp = std::env::temp_dir().join(format!("sanity-assess-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();

        let scan = scan_of(&[
            ("src-tauri/src/scan.rs", "walk", 40, "fn walk() {}"),
            ("web/src/app.jsx", "App", 9, "return <div/>"),
        ]);
        let reports: HashMap<String, Report> = scan
            .root
            .children
            .iter()
            .flat_map(|f| f.children.iter())
            .map(|n| {
                // The hash the server stamps on a report: whatever the scan says the
                // body was at the moment the reading was handed out.
                let r = Report {
                    body: n.body.clone().unwrap_or_default(),
                    ..report(&n.id, "surprising thing")
                };
                (n.id.clone(), r)
            })
            .collect();
        save(&tmp, &scan, &reports).unwrap();

        // Sharded per top-level directory, under `readings/`, with an index that explains
        // itself. Nothing but `README.md` sits at the top of `.sanity/`: the shard names come
        // from the repo's own directories, so anything else up there is a collision waiting
        // for somebody to make a `rules/` folder.
        assert!(tmp.join(".sanity/readings/src-tauri.md").exists());
        assert!(tmp.join(".sanity/readings/web.md").exists());
        assert!(!tmp.join(".sanity/src-tauri.md").exists());
        let index = std::fs::read_to_string(tmp.join(".sanity/README.md")).unwrap();
        assert!(index.contains("sanity.monster"), "the index says where to get the app");
        assert!(index.contains("sanity check"), "and how to refresh it");

        // The same functions, moved down the file and one of them rewritten.
        let moved = scan_of(&[
            ("src-tauri/src/scan.rs", "walk", 118, "fn walk() {}"),
            ("web/src/app.jsx", "App", 9, "return <span/>"),
        ]);
        let back = load(&tmp, &moved);
        assert_eq!(back.len(), 2, "both readings found their functions again");
        // Keyed by identity, not by position — the move is invisible here now, where it used
        // to be the thing this resolution had to survive. What still has to hold is the
        // distinction the move was hiding: same body, still current; changed body, expired.
        let walk = back.get("src-tauri/src/scan.rs#walk").unwrap();
        assert!(
            !is_stale(walk, Some(&body_hash("fn walk() {}")), None),
            "unchanged body, still current"
        );
        let app = back.get("web/src/app.jsx#App").unwrap();
        assert!(
            is_stale(app, Some(&body_hash("return <span/>")), None),
            "body changed, reading expired"
        );

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn shards_by_top_level_dir() {
        assert_eq!(shard_of("src-tauri/src/scan.rs"), "src-tauri");
        assert_eq!(shard_of("justfile"), "root");
        assert_eq!(shard_file("src-tauri"), "readings/src-tauri.md");
    }

    /// **A shard name is a path, and that is the preparation for splitting one.**
    ///
    /// `src-tauri.md` is 1.1MB on this repo and a bigger one will want finer shards. When it
    /// does, `shard_of` returns a deeper prefix and NOTHING else moves — so the machinery is
    /// tested at that depth now, while the default is still one segment.
    #[test]
    fn a_shard_may_be_nested_however_deep_it_is_sharded() {
        assert_eq!(shard_file("src-tauri/src"), "readings/src-tauri/src.md");
        assert_eq!(shard_file("a/b/c"), "readings/a/b/c.md");
        // Every segment is sanitised on its own, so a directory that looks like a traversal
        // cannot become one.
        assert_eq!(shard_file("../etc"), "readings/--/etc.md");
        assert_eq!(shard_file(""), "readings/root.md");
    }

    /// **The index's links are fed to `remove_file`.** A link that could climb out of
    /// `.sanity/` would turn a file anybody can edit into a delete-anything instruction.
    #[test]
    fn the_sweep_list_cannot_leave_the_directory() {
        let links = shard_links(
            "| [ok](readings/web.md) | [up](../../secrets.md) | [abs](/etc/passwd.md) |\n\
             | [self](README.md) | [deep](readings/a/b.md) |",
        );
        assert_eq!(links, vec!["readings/web.md", "readings/a/b.md"]);
    }

    /// **Readings written before the layout move are still read.** That is the whole of the
    /// migration: the next `save` writes them where the new index links them, and the sweep
    /// removes what it stopped claiming. A translator is what destroyed a project's readings
    /// — see `assessments.md` — so there is not one.
    #[test]
    fn a_flat_shard_from_the_old_layout_is_still_found() {
        let tmp = std::env::temp_dir().join(format!("sanity-flat-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        let root = tmp.join(".sanity");
        std::fs::create_dir_all(&root).unwrap();

        let scan = scan_of(&[("src-tauri/src/scan.rs", "walk", 1, "fn walk() {}")]);
        let reports: HashMap<String, Report> = [(
            "src-tauri/src/scan.rs#walk".to_string(),
            Report { body: "fn walk() {}".into(), ..report("src-tauri/src/scan.rs#walk", "x") },
        )]
        .into_iter()
        .collect();

        // Put a store on disk the old way, by writing today's and moving it back — the shard
        // bytes are then genuinely what an older build wrote, rather than a guess at them.
        save(&tmp, &scan, &reports).unwrap();
        std::fs::rename(root.join("readings/src-tauri.md"), root.join("src-tauri.md")).unwrap();
        std::fs::remove_dir(root.join("readings")).unwrap();
        let index = std::fs::read_to_string(root.join("README.md")).unwrap();
        std::fs::write(root.join("README.md"), index.replace("readings/", "")).unwrap();

        assert_eq!(load(&tmp, &scan).len(), 1, "found where the old layout put it");

        save(&tmp, &scan, &reports).unwrap();
        assert!(root.join("readings/src-tauri.md").exists(), "written where the new one does");
        assert!(!root.join("src-tauri.md").exists(), "and the old file swept");
        assert_eq!(load(&tmp, &scan).len(), 1, "still one reading, not two");

        let _ = std::fs::remove_dir_all(&tmp);
    }
}
