//! The finished tree, kept, so a launch is a read rather than a derivation.
//!
//! **Everything a scan needs was already cached except the answer.** `scancache` holds the
//! expensive ingredients — the tree-sitter parse and `git blame`, keyed by content — and it
//! earns its keep: measured on ceph, a warm scan spends 0.20s parsing and 0.03s blaming
//! against 279s and 6s cold. What it does not hold is the tree those ingredients are folded
//! into, so every launch read 300MB of parse data back, scored 113,322 functions (2.50s, for
//! a number the map never draws — see `isAnalyzed`), rebuilt the tree and aggregated it, to
//! arrive at exactly the same answer as last time.
//!
//! This holds the answer. A launch that finds a valid one skips the parse cache, the scoring
//! and the fold entirely.
//!
//! # What makes it valid
//!
//! Not the commit alone. The scan reads the WORKING TREE, so a cache keyed by HEAD would
//! serve a stale map to anybody with unsaved work — which is everybody, most of the time. The
//! signature is what the scan actually depends on:
//!
//! - every walked file's path, modification time and length — the same pair `scancache` gates
//!   on, and the same one `resync_changed` uses, for the same reason: two writes in one second
//!   can share an mtime;
//! - `HEAD`, but only for a tree that was folded with git in it — see `trace`. An untraced
//!   tree holds no age, churn or blame, so a commit cannot make it wrong, and the largest
//!   thing this cache holds stops being thrown away every time somebody commits;
//! - `PARSE_VERSION`, because a parser that has moved means the same bytes yield different
//!   functions — the rule this repo's caches all follow;
//! - the fidelity, because `Ordering` and `Full` compute different scores from identical
//!   input.
//!
//! Computing it costs the walk, which is 0.38s on ceph and is work the scan does anyway.
//!
//! # What it does not cover
//!
//! `.sanity/` readings are not in here — they are loaded separately and folded on top, which
//! is what lets a reading land without invalidating anything. A repo whose readings changed
//! keeps its cached tree and gets its colours from the store, as it always did.

use crate::scan::Fidelity;
use crate::scan::Scan;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Bumped when the SHAPE of what is stored changes. A stale record here is not dangerous —
/// it is a tree describing a repo that has moved on — but it is unreadable, and a version is
/// how it says so rather than failing to parse.
///
/// 2: binary rather than JSON — see `load`.
/// 3: the parser's version is stored beside the signature, so an unchecked read can still
///    refuse a tree built by a different parser — see `stale`.
/// 5: the neighbour table is written beside the tree — see [`links_path`]. A bump even
///    though nothing in THIS file's shape moved: a tree cached by version 4 has no `links.bin`
///    beside it, so every warm repo would have shown an empty Callers list — right about the
///    file it read, wrong about the code — until something unrelated dropped the cache. Which
///    is the failure `file_doc` taught in `scancache`, arriving through a sibling file instead
///    of through a defaulted field.
/// 4: `Node` gained the clone fields. **A field added to what is STORED here is a version
///    bump even when nothing about the repo changed**, and the reason is the one `file_doc`
///    taught in `scancache`: every one of them is `#[serde(default)]`, so a record written
///    before it loads perfectly and reports `None`. Every repo with a warm tree would have
///    shown an empty Clones lens — correctly according to the file it read, and wrongly about
///    the code — until something unrelated happened to drop the cache.
/// 6: `Score` gained `all_commits`, the lifetime commit count a header prints. Same rule as
///    4 and for the same reason — it is an `Option`, so a version-5 tree would load and
///    report `None` for every path, and a repo with a warm cache would have quietly gone on
///    printing nothing where the count belongs.
/// 7: `Node` gained `bytes`, the extent a reader would be handed. Same rule again, and here
///    the defaulted `None` is the dangerous direction rather than merely an empty one: the
///    queue skips what is too large to read and the map says so, both off this field, so a
///    version-6 tree would report every node as having no extent — and an unknown extent
///    that read as a small one would put the god-files straight back in the queue to be
///    served whole, which is the failure this release exists to close.
/// 8: `Node` gained `cols`, a file's functions reduced to the numbers a distribution is
///    built from — see [`crate::model::Cols`]. `slim` fills them, and `slim` is what this
///    cache stores, so a version-7 tree loads with `None` on every file and the map falls
///    back to a flat rim exactly where the histogram is worth the most: the repos too large
///    to have fetched their rings. It is the `#[serde(default)]` hazard in its usual shape —
///    a missing field reading as a valid value — and the reason this list exists.
/// 9: `Node::lang` is written as the name a person reads — `C++`, not `cpp` — because the
///    replay's tables always named a language that way and the two spellings never joined,
///    so every language in a story took a colour the live map had never given it. See
///    `model::lang_label`. A version-8 tree holds the old spelling, which would deserialize
///    to `None` and leave the Language lens with nothing to say about any file: the same
///    hazard as 8, one field over, and the reason this is a bump rather than a quiet edit.
/// 10: `ScanStats::unscanned` — the tally of the files the walk saw and did not scan. It is
///    `#[serde(default)]`, so a version-9 record loads with an EMPTY tally: not "not
///    measured" but "nothing was dropped", which is a confident answer nobody computed and
///    the same hazard as 8 and 9 one field further along.
/// 11: `Node::unparsed` and `Node::unparsed_here`, so that tally scopes to the drill instead
///    of being one repo-wide number beside two that update. Same hazard as 10 and one level
///    down: a version-10 tree defaults them to zero, and a wedge reporting no unreadable
///    files under it is a claim, not a gap.
/// 12: `Unscanned::assets` became `not_code` and took prose, configuration and markup with
///    it. A rename is a format change like any other — a version-11 record has the old key,
///    which now deserializes to zero and reports a repo where nothing was filtered.
/// 13: Churn became a count off the timeline instead of blame's surviving commits, so
///    `Score::churn` and `Score::commits` are now one value per WINDOW and `Cols::commits`
///    with them. A version-12 record cannot deserialize those at all and would simply be
///    refused — but `ScanStats` also gained `churn_windows` and `churned`, both
///    `#[serde(default)]`, and those are the hazard in its usual shape: an old record would
///    load with a ladder of `[0, 0, 0, 0]` and the window pulldown would offer four rungs of
///    "0 days", each of them a horizon nothing can fall inside. Same shape as 8, 9, 10 and 11
///    and the reason this list exists.
/// 14: The Complexity lens — `Score::tangle` and `Score::cognitive`, and `ScanStats` gained
///    `tangle_bands`, what counts as a normal score for a body of each size in this repo.
///    The score fields are `Option`, so a version-13 record refuses them outright rather than
///    reading them wrong; the bands are `#[serde(default)]` and would load EMPTY, which the
///    lens reads as "no language here has a branch table" and locks itself over. That is the
///    safe direction and it is still a format change, because a repo would draw as unsupported
///    until something unrelated dropped the cache. Same shape as every entry above it.
/// 15: `Cols` gained `tangle`, the per-function complexity a file needs in order to answer for
///    its own functions when its ring has not been fetched. Without it a version-14 tree loads
///    with the field absent, every ring-less file says nothing under Complexity, and the rim
///    over it draws a distribution missing those lines — which is the failure `histogramsFor`
///    opens by naming, arriving through the door built to close it. `#[serde(default)]` on a
///    `Vec` means EMPTY, and empty here reads as "no function in this file has a branch table",
///    which is a confident answer nobody computed.
/// 16: `Node` gained `main_author` and `headcount`, the two reductions of a function's blame
///    that are not its last toucher — whose lines most of it IS, and how many people's lines
///    are standing in it. Both are `#[serde(default)]` `Option`s, so a version-15 tree loads
///    with them absent, which is exactly what a repo that has not been blamed reports and is
///    therefore indistinguishable from it. That is the whole reason this is a bump rather than
///    a silent addition: a rule reading `headcount <= 1` would find nothing on a cached tree
///    and report it as a clean bill, which is the failure this surface is written against.
const VERSION: u32 = 16;

/// The neighbour table as it is stored. Its own record rather than a field on [`Cached`]:
/// the tree is written twice, whole and slim, and the slim copy exists to be small.
#[derive(Deserialize)]
struct CachedLinks {
    version: u32,
    signature: u64,
    links: crate::links::Links,
}

/// The same record, borrowed, for the write.
///
/// **A `Scan` holds its table behind an `Arc` and cloning it to encode would defeat that.**
/// On ceph the table is megabytes and the tree cache is written on every scan; bincode only
/// needs to READ the value, so the owning half is only needed on the way back in. Field order
/// and types match [`CachedLinks`] exactly, which is what makes the two halves one format.
#[derive(Serialize)]
struct CachedLinksRef<'a> {
    version: u32,
    signature: u64,
    links: &'a crate::links::Links,
}

#[derive(Serialize, Deserialize)]
struct Cached {
    version: u32,
    /// What the tree was derived from — see the module note. A mismatch is a rescan.
    signature: u64,
    /// The parser that produced it. Held separately from the signature because `stale` reads
    /// this file WITHOUT computing a signature, and a tree parsed by a different build is
    /// wrong in a way no amount of "the files have not changed" can excuse.
    parse: u32,
    scan: Scan,
}

/// How the tree is written, and the only interesting decision in this file.
///
/// **JSON was the format and it was the whole cost.** Measured on ceph's cache: 67.4MB, read
/// from disk in 0.01s, parsed in **1.15s**. The disk is not the problem and never was — the
/// problem is asking `serde_json` to walk sixty-seven megabytes of punctuation and field
/// names to rebuild 113,322 nodes whose shape was known at compile time.
///
/// A binary encoding does the same job without the text: no key strings, no escaping, no
/// number parsing. The file is smaller and, far more importantly, it is read at memcpy speed
/// rather than at parser speed.
///
/// The cost of choosing it is that the file stops being readable with `jq`, which for a cache
/// nobody debugs by hand — it is regenerated by deleting it — is not much of a cost. The
/// caches a person DOES read (`.sanity/`, the endpoint file) stay text.
fn config() -> bincode::config::Configuration {
    bincode::config::standard()
}

/// The signature for `repo` as it stands, walking it to find out. For callers outside the
/// scan — see `slim`.
pub fn current(repo: &Path, fidelity: Fidelity, depth: crate::trace::Depth) -> u64 {
    signature(repo, &crate::scan::collect_files(repo), fidelity, depth)
}

/// The map WITHOUT its functions, if the stored one still describes this repo.
///
/// **What the window draws is eight thousand shapes; what the tree holds is a hundred and
/// thirteen thousand.** Decoding the rest to hand over the part that gets drawn was 0.38s of
/// every project switch, for functions the backend wants and the picture does not: the ring
/// inside a file arrives from `file_functions` when there is somewhere to put it, and the
/// reading queue wants them when somebody presses Read.
///
/// So the trimmed tree is written beside the whole one and read on its own. A launch draws
/// from this; the full tree lands behind it.
pub fn slim(repo: &Path, signature: u64) -> Option<Scan> {
    let cached = read_slim(repo)?;
    (cached.signature == signature).then_some(cached.scan)
}

/// Is the stored tree still this repo's answer?
///
/// **What stops a big repo asking to be scanned every single launch.** `scan::estimate` prices
/// a scan from files times a rate, which is the cost of PARSING them — and a repo whose tree is
/// already cached is not going to be parsed at all: the scan walks, matches the signature and
/// returns the stored answer. Kibana was declined at every open on a fifteen-second estimate
/// for work that was really a tenth of a second of decoding.
///
/// The walk is the price of the question — 1.4s on kibana, 0.1s on this repo — and it is the
/// same walk the scan then does, so a warm repo pays it twice. That is the trade for never
/// asking a person about work that is not going to happen. Only the slim record is decoded,
/// which is why this is not simply `load`: the whole tree is 36MB on ceph and the question is
/// answered by its header.
pub fn warm(repo: &Path, fidelity: Fidelity, depth: crate::trace::Depth) -> bool {
    slim(repo, current(repo, fidelity, depth)).is_some()
}

/// The last map this repo had, without asking whether it is still true.
///
/// **The picture goes up first and the question is asked behind it.** Proving a cached tree
/// current means walking the repo and stat-ing every file — 0.25s on ceph, and the only thing
/// left between a launch and an instant one. It is also work whose answer is almost always
/// "nothing has changed": a repo changes at the speed of somebody typing in it, and the scan
/// that follows this by a fraction of a second replaces the map if it did.
///
/// So the map is drawn from the last one, and the scan behind it either confirms it or
/// supersedes it. What is NOT skipped is the parser: a tree built by a different build of
/// this app describes functions that no longer exist by those names, and no staleness
/// argument covers that.
pub fn stale(repo: &Path) -> Option<Scan> {
    let cached = read_slim(repo)?;
    (cached.parse == crate::parse::PARSE_VERSION).then_some(cached.scan)
}

fn read_slim(repo: &Path) -> Option<Cached> {
    let path = slim_path(repo)?;
    // A launch that answers from here writes nothing, and to another build's sweep a slot
    // nothing writes looks abandoned — see `mark_used`.
    crate::reports::mark_used(&path);
    let bytes = std::fs::read(path).ok()?;
    let (cached, _): (Cached, usize) = bincode::serde::decode_from_slice(&bytes, config()).ok()?;
    (cached.version == VERSION).then_some(cached)
}

fn slim_path(repo: &Path) -> Option<PathBuf> {
    path_for(repo).map(|p| p.with_extension("slim.bin"))
}

/// The name this build's trees are kept under — see [`crate::reports::cache_slot`].
///
/// Both versions, because both are refusals a reader makes: [`VERSION`] decides whether the
/// record can be READ, `PARSE_VERSION` whether what it holds still MEANS anything. The
/// signature covers the pair too, so nothing here is newly gated — what changes is that a
/// build one version away now looks in a different place instead of overwriting this one.
fn tag() -> String {
    format!("p{}v{}", crate::parse::PARSE_VERSION, VERSION)
}

fn path_for(repo: &Path) -> Option<PathBuf> {
    crate::reports::cache_slot("trees", repo, &tag()).map(|p| p.with_extension("bin"))
}

/// Fold one more value into a running FNV.
fn mix(h: &mut u64, bytes: &[u8]) {
    for b in bytes {
        *h ^= *b as u64;
        *h = h.wrapping_mul(0x1000_0000_01b3);
    }
}

/// What this scan depends on, as one number. See the module note for what is in it and why.
pub fn signature(
    repo: &Path,
    files: &[(PathBuf, crate::model::Lang)],
    fidelity: Fidelity,
    depth: crate::trace::Depth,
) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    mix(&mut h, &crate::parse::PARSE_VERSION.to_le_bytes());
    mix(&mut h, &VERSION.to_le_bytes());
    mix(&mut h, if fidelity == Fidelity::Full { b"full" } else { b"ordering" });
    // **How much git the tree was folded with.** A tree traced to the line and one traced to
    // the file carry different numbers in the same fields, and an untraced one carries none —
    // so without this, a scan that deliberately skipped git would be served the last traced
    // tree and would look like it had done the work. Caught by the test that pins a deferred
    // trace against an inline one: the untraced scan came back with history in it.
    //
    // It is here rather than a version bump because it is a property of THIS scan, not of the
    // format. Where this ends up is a parse-only tree with the trace applied on top — see
    // `trace::apply` — at which point this mixes one value and stops mattering.
    mix(&mut h, depth.tag());
    // **Only when the tree actually holds git.** This is why taking the trace out of a scan
    // was worth doing: an untraced tree is parse-only, so a commit cannot make it wrong, and
    // ceph stopped throwing away a 36MB tree every time somebody committed to it. A tree
    // folded WITH history still turns over on a commit, because the numbers in it did.
    if depth != crate::trace::Depth::Untraced {
        mix(&mut h, head_of(repo).as_bytes());
    }
    // **`.sanityignore`, because it decides what is in scope and is not a source file.**
    // Caught by `an_excluded_file_leaves_the_queue_and_stays_in_the_count` on the first run
    // of this cache: the walk only lists parseable files, so a repo that gained an ignore
    // rule had an identical signature and was served a tree that knew nothing about it. Its
    // bytes rather than its mtime — a rule edited back to what it was is the same scope.
    if let Ok(rules) = std::fs::read(repo.join(".sanityignore")) {
        mix(&mut h, &rules);
    }
    for (path, _) in files {
        mix(&mut h, path.to_string_lossy().as_bytes());
        // Absent metadata mixes nothing, which makes a file that cannot be stat-ed look
        // unchanged. It is the same file the walk found a moment ago; if it has since gone,
        // the parse will say so and the scan that follows is the correct one anyway.
        if let Ok(m) = std::fs::metadata(path) {
            mix(&mut h, &m.len().to_le_bytes());
            if let Ok(t) = m.modified() {
                if let Ok(d) = t.duration_since(std::time::UNIX_EPOCH) {
                    mix(&mut h, &d.as_nanos().to_le_bytes());
                }
            }
        }
    }
    h
}

fn head_of(repo: &Path) -> String {
    std::process::Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

/// The stored tree, if it describes this repo as it stands.
pub fn load(repo: &Path, signature: u64) -> Option<Scan> {
    let path = path_for(repo)?;
    crate::reports::mark_used(&path);
    let bytes = std::fs::read(path).ok()?;
    let (cached, _): (Cached, usize) = bincode::serde::decode_from_slice(&bytes, config()).ok()?;
    let mut scan =
        (cached.version == VERSION && cached.signature == signature).then_some(cached.scan)?;
    // The neighbour table, from beside it and under the same signature. Its absence is not a
    // reason to reject the tree — it is a table the panel can say it does not have, where the
    // tree is the map itself.
    if let Some(links) = load_links(repo, signature) {
        scan.links = std::sync::Arc::new(links);
    }
    Some(scan)
}

/// The neighbour table written beside a cached tree — see [`crate::links`] for why it is not
/// simply rebuilt.
///
/// Its own file, read only when something asks a question about one function's neighbours, so
/// a launch that draws the map and nothing else never touches it. Guarded by the same
/// signature as the tree: a table describing a repo that has moved would name callers that no
/// longer call.
fn load_links(repo: &Path, signature: u64) -> Option<crate::links::Links> {
    let bytes = std::fs::read(links_path(repo)?).ok()?;
    let (cached, _): (CachedLinks, usize) =
        bincode::serde::decode_from_slice(&bytes, config()).ok()?;
    (cached.version == VERSION && cached.signature == signature).then_some(cached.links)
}

fn links_path(repo: &Path) -> Option<PathBuf> {
    path_for(repo).map(|p| p.with_extension("links.bin"))
}

/// The drawable half again, now that the trace has landed.
///
/// **The stored map was untraced by construction and nobody noticed for months.** `save` runs
/// inside `scan()`, and the app always calls `scan()` at `Depth::Untraced` and deepens
/// afterwards — so `Cols::of` stamped `-1, -1` on every function on its way to disk, and the
/// history somebody had paid for lived only in memory. What `stale` then drew at the next
/// launch, before the restore reached that repo, was a map with no age, no churn and no author
/// in it. On ceph that is a picture of 123,000 commits' worth of history, drawn as though
/// there were none.
///
/// **Only the drawable half, and deliberately.** The whole tree is 36MB on ceph and its extra
/// content is the function nodes, which `deepen` refills in about two seconds from caches that
/// already exist — paying tens of megabytes per repo to save that is a bad trade. The slim
/// half is the one that gets DRAWN before anything else exists, so it is the half where being
/// untraced shows.
///
/// **The signature is carried over rather than recomputed**, which is the one subtle thing
/// here. `signature` mixes `depth.tag()` and, for a traced tree, HEAD — so a signature taken
/// now would not match the one `scan()` will compute at `Depth::Untraced` on the next launch,
/// and `warm` would report a cold repo and put a large one behind a "shall I scan this?"
/// prompt it does not need. Keeping the stored signature says exactly what is true: these are
/// the same files, parsed by the same build, and this is the best map we have of them.
/// Nothing reads the slim record's TREE except `stale`, which does not consult the signature
/// at all — `warm` reads the record for its header and throws the tree away.
///
/// Does nothing when there is no record yet: the scan writes one, and this only ever improves
/// what is already there.
pub fn redraw(repo: &Path, scan: &Scan) {
    let Some(path) = slim_path(repo) else { return };
    // Its own header, so this cannot invent a signature or a parse version — see above.
    let Some(held) = read_slim(repo) else { return };
    let Ok(bytes) = bincode::serde::encode_to_vec(
        Cached {
            version: VERSION,
            signature: held.signature,
            parse: held.parse,
            scan: Scan {
                root: scan.root.slim(),
                stats: scan.stats.clone(),
                links: Default::default(),
            },
        },
        config(),
    ) else {
        return;
    };
    let tmp = path.with_extension("tmp");
    if std::fs::write(&tmp, bytes).is_ok() {
        // Renamed rather than written in place, the same rule `save` follows and for the same
        // reason: a launch that read a half-written tree would draw a repo with a hole in it.
        let _ = std::fs::rename(&tmp, &path);
    }
}

/// Keep this tree for next time. A failed write costs a derivation, never an answer, so
/// nothing is reported — the same rule the timeline cache follows.
pub fn save(repo: &Path, signature: u64, scan: &Scan) {
    let Some(path) = path_for(repo) else { return };
    // Once a scan, which is the only moment anything here changes — see `prune_slots` for
    // why the sweep is by age rather than by tag.
    crate::reports::prune_slots("trees", repo, &tag());
    let Ok(bytes) = bincode::serde::encode_to_vec(
        Cached {
            version: VERSION,
            signature,
            parse: crate::parse::PARSE_VERSION,
            scan: scan.clone(),
        },
        config(),
    ) else {
        return;
    };
    let tmp = path.with_extension("tmp");
    if std::fs::write(&tmp, bytes).is_ok() {
        // Renamed rather than written in place: a launch that reads a half-written tree would
        // draw a repo with a hole in it, and the hole would look like data.
        let _ = std::fs::rename(&tmp, &path);
    }
    // The drawable half, beside it — see `slim`. Written second and read first, which is the
    // safe order: a slim file with no whole one behind it costs a scan, while the reverse
    // would be a map with no functions under it and no way to notice.
    let Some(thin) = slim_path(repo) else { return };
    let Ok(bytes) = bincode::serde::encode_to_vec(
        Cached {
            version: VERSION,
            signature,
            parse: crate::parse::PARSE_VERSION,
            scan: Scan {
                root: scan.root.slim(),
                stats: scan.stats.clone(),
                links: Default::default(),
            },
        },
        config(),
    ) else {
        return;
    };
    let tmp = thin.with_extension("tmp");
    if std::fs::write(&tmp, bytes).is_ok() {
        let _ = std::fs::rename(&tmp, &thin);
    }
    // The neighbour table, last, in its own file. Nothing reads it to draw anything, so a
    // failed write costs a panel a list and never a map — the same rule the two above follow.
    if scan.links.is_empty() {
        return;
    }
    let Some(links) = links_path(repo) else { return };
    let Ok(bytes) = bincode::serde::encode_to_vec(
        CachedLinksRef { version: VERSION, signature, links: &scan.links },
        config(),
    ) else {
        return;
    };
    let tmp = links.with_extension("tmp");
    if std::fs::write(&tmp, bytes).is_ok() {
        let _ = std::fs::rename(&tmp, &links);
    }
}

#[cfg(test)]
mod tests {
    /// The borrowed record and the owned one are one format, and nothing but this says so.
    ///
    /// **They are two structs precisely so the write can avoid a multi-megabyte clone**, which
    /// means a field added to one and not the other compiles, encodes, and produces a file the
    /// reader silently rejects — a repo whose neighbour lists quietly never load. Cheaper to
    /// assert than to notice.
    ///
    /// **Populated, and every byte accounted for.** It round-tripped `Links::default()` — an
    /// empty table, whose encoding is a run of zero-length collections — so the only thing it
    /// could prove was that the two records agree about a value with nothing in it. And
    /// `decode_from_slice` returns what it consumed rather than insisting on the whole buffer,
    /// so a trailing field on the writing side alone would leave bytes unread and still decode
    /// "fine". Contents in, contents out, and the length checked.
    #[test]
    fn the_borrowed_links_record_decodes_as_the_owned_one() {
        use crate::links::tests::{func, table};
        let links = table(&[
            (
                "src/a.rs",
                vec![func("caller", 1, &["callee"], Some(7)), func("callee", 20, &[], None)],
            ),
            ("src/b.rs", vec![func("twin", 1, &[], Some(7))]),
        ]);
        assert!(!links.is_empty(), "the fixture has to have something in it");

        let bytes = bincode::serde::encode_to_vec(
            super::CachedLinksRef { version: super::VERSION, signature: 7, links: &links },
            super::config(),
        )
        .expect("encodes");
        let (back, read): (super::CachedLinks, usize) =
            bincode::serde::decode_from_slice(&bytes, super::config()).expect("decodes");
        assert_eq!(back.version, super::VERSION);
        assert_eq!(back.signature, 7);
        assert_eq!(
            read,
            bytes.len(),
            "the owned record consumed every byte the borrowed one wrote — a field on one side \
             only would leave a tail behind and still decode"
        );
        assert_eq!(back.links.len(), links.len(), "and the same functions came back");
    }

    /// The stored map carries the history somebody paid for.
    ///
    /// **`save` runs inside `scan()`, which the app calls at `Depth::Untraced`** — so the tree
    /// that reaches disk has `-1` in every function's history column, and `stale` draws that at
    /// the next launch. This pins the repair: after a trace lands, the drawable half holds the
    /// traced numbers, and it still answers `warm` for the signature the scan will ask with.
    #[test]
    fn the_stored_map_keeps_what_the_trace_read() {
        // **Its own data home, and that is not tidiness.** Slots live under `data_dir()`,
        // which is the user's real cache unless `SANITY_DATA_DIR` says otherwise — so without
        // this the test writes into it, and `save`'s own `prune_slots` runs against whatever
        // else is in there. It also takes the env lock, which is what stops this racing the
        // other tests that move the same variable out from under it.
        let _home = crate::agentapi::tests::data_home();
        let dir = tempfile::tempdir().expect("a temp dir");
        let repo = dir.path();
        let sig = 42;

        // What a scan stores: a file whose one function has no history yet.
        let mut untraced = scan_of(None);
        super::save(repo, sig, &untraced);
        let drawn = super::stale(repo).expect("the scan wrote a drawable half");
        assert_eq!(
            touched_of(&drawn),
            vec![-1],
            "an untraced scan stores an untraced map — this is the state the repair starts from"
        );

        // What the trace then learns, landed on the live tree. Both fields, because
        // `Cols::of` gates the whole column on `age_days` — "does this repo have history for
        // this function at all" — and writes the date only once that says yes.
        let score = untraced.root.children[0].children[0].score.as_mut().expect("a score");
        score.age_days = Some(100.0);
        score.last_touched_days = Some(3.0);
        super::redraw(repo, &untraced);

        let drawn = super::stale(repo).expect("still a drawable half");
        assert_eq!(touched_of(&drawn), vec![3], "and now it carries what the trace read");
        assert!(
            super::slim(repo, sig).is_some(),
            "under the signature the scan will ask with, or a large repo is offered a rescan it \
             does not need — `redraw` carries the header over rather than recomputing it"
        );
    }

    /// `redraw` has nothing to improve until a scan has written something.
    #[test]
    fn redrawing_before_a_scan_writes_nothing() {
        let _home = crate::agentapi::tests::data_home();
        let dir = tempfile::tempdir().expect("a temp dir");
        super::redraw(dir.path(), &scan_of(Some(3.0)));
        assert!(super::stale(dir.path()).is_none(), "no record, and none invented");
    }

    /// One file, one function, with or without a last-touched date.
    fn scan_of(touched: Option<f32>) -> crate::scan::Scan {
        let mut func = crate::model::Node::dir("f.rs#go", "go");
        func.kind = crate::model::NodeKind::Func;
        func.path = "f.rs".into();
        func.loc = 10;
        func.line = Some(1);
        func.end_line = Some(9);
        func.score = Some(crate::model::Score {
            surprise: 0.0,
            documented: 0.0,
            churn: [0.0; 4],
            age_days: touched.map(|_| 100.0),
            tangle: None,
            cognitive: None,
            commits: [0; 4],
            all_commits: None,
            last_touched_days: touched,
            provenance: crate::model::Provenance::None,
            hot_share: 0.0,
            source: crate::model::Source::Proxy,
            analyzed_share: 0.0,
        });
        let mut file = crate::model::Node::dir("f.rs", "f.rs");
        file.kind = crate::model::NodeKind::File;
        file.path = "f.rs".into();
        file.loc = 10;
        file.children = vec![func];
        let mut root = crate::model::Node::dir("", "repo");
        root.loc = 10;
        root.children = vec![file];
        crate::scan::Scan {
            root,
            stats: crate::scan::ScanStats {
                commits: 0,
                churn_windows: [30, 60, 90, 180],
                churned: false,
                tangle_bands: Default::default(),
                files_scanned: 1,
                files_skipped: 0,
                unscanned: Default::default(),
                functions: 1,
                authors: Vec::new(),
                without_history: false,
                model: "test".into(),
                calls_resolved: 0,
                calls_unresolved: 0,
            },
            links: Default::default(),
        }
    }

    /// The `touched` column of every file in a stored map — the field this is all about.
    fn touched_of(scan: &crate::scan::Scan) -> Vec<i32> {
        let mut out = Vec::new();
        scan.root.visit(&mut |n| {
            if let Some(c) = n.cols.as_ref() {
                out.extend(c.touched.iter().copied());
            }
        });
        out
    }

    /// What the drawable half costs to read, against the whole tree. Ignored: a measurement,
    /// `REPO=/path/to/repo cargo test -- --ignored --nocapture halves`.
    #[test]
    #[ignore]
    fn halves() {
        let repo = std::env::var("REPO").expect("REPO=/path/to/repo");
        let repo = std::path::Path::new(&repo);
        let t = std::time::Instant::now();
        let sig = super::current(repo, crate::scan::Fidelity::Ordering, crate::trace::Depth::Lines);
        let walk = t.elapsed();
        // What a launch actually does: read the last map without proving it — see `stale`.
        let t = std::time::Instant::now();
        let thin = super::stale(repo).expect("a slim tree is cached");
        let slim = t.elapsed();
        let t = std::time::Instant::now();
        let whole = super::load(repo, sig).expect("a whole tree is cached");
        let full = t.elapsed();
        let count = |s: &crate::scan::Scan| {
            let mut n = 0;
            s.root.visit(&mut |_| n += 1);
            n
        };
        println!(
            "walk {:.2}s · slim {:.2}s ({} nodes) · whole {:.2}s ({} nodes)",
            walk.as_secs_f64(),
            slim.as_secs_f64(),
            count(&thin),
            full.as_secs_f64(),
            count(&whole),
        );
    }

    /// Where the time goes when a launch reads its cached tree. Ignored: a measurement,
    /// `TREE=/path/to/cache.bin cargo test -- --ignored --nocapture split`.
    #[test]
    #[ignore]
    fn split() {
        let path = std::env::var("TREE").expect("TREE=/path/to/cache.bin");
        let t = std::time::Instant::now();
        let bytes = std::fs::read(&path).expect("reads");
        let read = t.elapsed();
        let t = std::time::Instant::now();
        let (cached, _): (super::Cached, usize) =
            bincode::serde::decode_from_slice(&bytes, super::config()).expect("decodes");
        let parse = t.elapsed();
        let mut funcs = 0;
        cached.scan.root.visit(&mut |n| {
            if n.kind == crate::model::NodeKind::Func {
                funcs += 1;
            }
        });
        println!(
            "{:.1} MB · read {:.2}s · decode {:.2}s · {funcs} functions",
            bytes.len() as f64 / 1e6,
            read.as_secs_f64(),
            parse.as_secs_f64(),
        );
    }
}
