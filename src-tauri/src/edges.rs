//! Call edges: who calls whom, and how far the call travels.
//!
//! The scan already parses every function; what it threw away was the calls inside them.
//! This module puts them back together into two facts the sunburst had no way to state —
//! **how many other functions call this one**, and **what share of its wiring leaves its own
//! directory** — and both are deliberately cheap, deterministic and model-free. They come off
//! the parse, so they are available the instant a repo is opened: no reader, no tokens, and
//! no git. On a repo a model generated an hour ago that is the only evidence there is.
//!
//! # What this refuses to claim
//!
//! A name is not a target. tree-sitter can see that a body calls something spelled `render`;
//! it cannot see which `render`, because that needs types, imports and overload resolution —
//! three things a per-file parse does not have. Every rule below is about being honest that
//! the answer is a guess, and about which guesses are cheap enough to be worth making:
//!
//! - **A language whose call shape has never been parsed resolves nothing**, and says so.
//!   The result is `None` — the wedge paints gray — never a zero. A zero would read as
//!   "nothing calls this", which is the finding the lens exists to surface, asserted over
//!   code nobody looked at. See [`crate::parse::resolves_calls`].
//! - **Edges stay inside a language family.** A Python `main` and a Go `main` are not the
//!   same function, and joining them would wire two subsystems together through a word.
//!   The two families that are genuinely one — C with C++ headers, and the JavaScript/
//!   TypeScript/TSX trio — are the reason [`family`] exists rather than a plain `lang ==`.
//! - **Locally ambiguous is resolved; globally ambiguous is not.** Three `parse`s in one
//!   directory are three plausible targets and the neighbourhood is the evidence, so all
//!   three are credited. Thirty `get`s across a repo are a common word, so the call is
//!   dropped. That line is drawn by what the evidence supports, not by a tuned threshold.
//! - **A call that resolves to nothing is not an error and is not counted.** Most calls in
//!   any real file go to the standard library or a dependency. `unresolved` is reported so
//!   the share is visible rather than inferred.
//!
//! # What it is NOT
//!
//! Not a dependency graph anybody should draw as a node graph — 17,000 functions and a
//! force layout is a hairball, and the sunburst's angle already carries structure. These are
//! two scalars per function, meant for the same geometry everything else is painted on.
//!
//! Not an input to a reading. `reading_hash` does not cover them, no `SPEC` moved, and
//! nothing in `.sanity/` expires because of anything in this file. Handing a reader "this
//! function has fourteen callers" would make it a graded input and cost every cold
//! prediction ever taken; that trade is worth measuring before it is worth spending.

use crate::model::{Tested, Testness};
use std::collections::{HashMap, HashSet};

use crate::model::Lang;

/// Everything one function's wiring says about it.
///
/// Counts of distinct FUNCTIONS, never of call sites: a body that calls `push` forty times
/// depends on `push` once, and counting the forty would let a loop outweigh a subsystem.
#[derive(Debug, Clone, Copy, Default)]
pub struct Wire {
    /// Distinct functions in this repo that call this one. Recursion does not count.
    pub callers: u32,
    /// Of those, how many are NOT this repo's own test code — or `None` where the language
    /// gives nothing reliable to tell test code by.
    ///
    /// **A test is a caller and it is not a dependent, and one number cannot be both.**
    /// `callers` answers "how many things call this", which is what the lens paints and which
    /// a test genuinely is. The findings that matter here ask something else — *a change here
    /// has to be checked against all 13* — and that sentence is false when eleven of the
    /// thirteen are the body's own unit tests, because changing a function and changing its
    /// tests is one edit and not thirteen. Two questions, so two numbers; the alternative was
    /// redefining `callers` under the lens that already draws it.
    ///
    /// **`None` is "this language told us nothing", never zero.** Rust says `#[cfg(test)]` and
    /// the compiler enforces it; Go says `_test.go`; C++ says nothing at all, and a confident
    /// zero there would be the third time this file invented a number nobody computed.
    pub dependents: Option<u32>,
    /// Distinct functions in this repo that this one calls.
    pub calls: u32,
    /// Distinct neighbours — callers and callees together, counted once each.
    pub incident: u32,
    /// Of those neighbours, how many live outside this function's own directory.
    pub away: u32,
}

impl Wire {
    /// The share of this function's wiring that leaves its own directory.
    pub fn locality_gap(&self) -> Option<f32> {
        locality_gap(Some(self.away), Some(self.incident))
    }
}

/// The share of a subject's wiring that leaves its own directory, or `None` when it has no
/// wiring at all.
///
/// **`None` rather than zero for an unwired function**, and the distinction is the whole lens.
/// Zero would mean "everything it touches is next door", which is the calmest thing the map
/// can say; a function connected to nothing has not earned that. It is the Reach lens's
/// subject, and Locality has nothing to report about it.
///
/// A free function rather than only a method, because the two callers hold the counts in
/// different shapes — `Wire` inside a scan, `Node` after one — and a division written out
/// twice is a division that can come to disagree about its denominator. The browser has a
/// third copy in `localityOf`, which cannot be helped and is why the counts cross the wire
/// rather than the ratio.
pub fn locality_gap(away: Option<u32>, incident: Option<u32>) -> Option<f32> {
    match (away, incident) {
        (Some(a), Some(i)) if i > 0 => Some(a as f32 / i as f32),
        _ => None,
    }
}

/// One function's address, before the tree exists.
///
/// Position in the file rather than name, because `path#name` is not unique — the same
/// reason [`crate::assessment::key_of`] takes an ordinal. Nothing durable is keyed on this;
/// it is an index into the scan that produced it and dies with it.
pub type Site = (usize, usize);

/// Which definitions a call in one language is allowed to reach.
///
/// Not `lang ==`, because two pairs of languages are genuinely one namespace and both matter.
/// **C and C++ are the case the map was missing**: a header and its implementation are the
/// canonical "these two files are the same thing" edge, and `.h` parses as C++ while `.c`
/// parses as C, so an identity comparison would sever every one of them. The JS family is
/// the same shape for a different reason — one project routinely holds `.ts`, `.tsx` and
/// `.js` and calls freely across them.
///
/// Everything else is its own family. A repo holding Python and Go has two `main`s and they
/// are not related; joining them by name would wire the two halves of the map together
/// through a coincidence of spelling.
fn family(lang: Lang) -> u8 {
    match lang {
        Lang::C | Lang::Cpp => 1,
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => 2,
        other => 3 + other as u8,
    }
}

/// A file as this module needs to see it: where it is, what it is, and what is in it.
///
/// Borrowed rather than owned so a scan can hand over what it already parsed. The caller
/// flattens its directory grouping; the grouping is rebuilt here from the paths, because a
/// directory is the unit locality is measured against and it has to be derived the same way
/// for every file whatever order they arrived in.
pub struct FileView<'a> {
    pub path: &'a str,
    pub lang: Lang,
    pub funcs: &'a [crate::parse::FuncDef],
}

/// Every function's wiring, plus what could not be resolved.
pub struct Wiring {
    per_site: HashMap<Site, Wire>,
    /// Every resolved edge, caller first. Deduplicated, recursion already dropped.
    ///
    /// **Kept rather than folded away, because two scalars cannot be clicked.** The counts
    /// below them answer "how wired is this"; the panel that opens when somebody wants to
    /// know *what* calls a function needs the pairs themselves, and rebuilding them costs
    /// the whole repo's parse — the one thing a launch off a cached tree never reads. See
    /// [`crate::links`], which is the only consumer and turns these into a form that
    /// survives the scan.
    pub edges: Vec<(Site, Site)>,
    /// Call names that reached no definition, and how many did. Reported rather than
    /// swallowed: a repo where 95% of calls go nowhere is one where the family rule or the
    /// grammar is wrong, and the only way to notice is to be told the share.
    pub resolved: u64,
    pub unresolved: u64,
    /// Functions in a language that resolves calls at all — the denominator for every share
    /// downstream, and never the function count, which includes languages nobody looked at.
    pub resolvable: u64,
}

impl Wiring {
    /// This function's wiring, or `None` when its language resolves no calls.
    pub fn at(&self, file: usize, func: usize) -> Option<Wire> {
        self.per_site.get(&(file, func)).copied()
    }
}

/// The directory a repo-relative path sits in, as the empty string at the root.
fn dir_of(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(d, _)| d)
}

/// How many definitions of one name a REPO-WIDE match may have and still resolve.
///
/// One. A call that leaves its own directory and finds two candidates has found a word, not a
/// function — and crediting both would inflate the caller count of whichever pair happens to
/// share a spelling, which is exactly the wedges a reader is most likely to be misled about.
/// Locally the opposite holds and the constant does not apply: see [`resolve`].
const GLOBAL_UNIQUE: usize = 1;

/// Build the call graph and reduce it to two numbers per function.
///
/// Three passes, none of them clever: index every definition by name, resolve every call
/// against that index, then fold the edge list into per-function counts. The cost is
/// proportional to the calls that are actually THERE — [`crate::parse::MAX_CALLS`] is a
/// ceiling and not a budget, and the measured median body makes four calls. A 17,000-function
/// repo is about a million hash lookups, well under a second, and it runs on the same parse
/// the scan already paid for.
pub fn wire(files: &[FileView<'_>]) -> Wiring {
    wire_with(files, &HashMap::new(), &Declarations::default())
}

/// `wire`, plus whatever a reader has said about which bodies are tests.
///
/// A separate entry point rather than an argument on `wire`, because the readings are not
/// something the call graph needs and every other caller has none — see
/// [`crate::model::Tested::Reader`], which is consulted only where a contract is silent.
pub fn wire_with(
    files: &[FileView<'_>],
    read_test: &HashMap<Site, Testness>,
    declared: &Declarations,
) -> Wiring {
    // name → every definition of it, with the family and directory needed to rank candidates.
    let mut defs: HashMap<&str, Vec<Def<'_>>> = HashMap::new();
    // Every name a qualifier could legitimately BE: the types and modules definitions sit in,
    // and the file stems a module-qualified call spells. See `resolve`.
    let mut owners: HashSet<&str> = HashSet::new();
    let mut modules: HashSet<&str> = HashSet::new();
    // Which sites are test code, and which FILES we were able to ask about at all — kept per
    // file rather than per language so nothing has to be hashed that is not already.
    let mut tests: HashSet<Site> = HashSet::new();
    let mut told: Vec<bool> = vec![false; files.len()];
    let mut resolvable = 0u64;
    for (fi, file) in files.iter().enumerate() {
        if !crate::parse::resolves_calls(file.lang) {
            continue;
        }
        resolvable += file.funcs.len() as u64;
        let fam = family(file.lang);
        let dir = dir_of(file.path);
        modules.insert(stem_of(file.path));
        for (gi, func) in file.funcs.iter().enumerate() {
            // Contract first; a reading second where the language has no contract; the
            // layout last. See `contract_of` — and note the reader is only ASKED where a
            // contract is silent, so this order is also the order the evidence arrives in.
            let known = contract_of(file.lang, file.path, func.in_cfg_test)
                .or_else(|| declared_of(file.lang, declared))
                .or_else(|| read_test.get(&(fi, gi)).copied())
                .or_else(|| convention_of(file.lang, file.path));
            if let Some(t) = known {
                if t.is_test {
                    tests.insert((fi, gi));
                }
                told[fi] = true;
            }
            let owner = func.owner.as_deref();
            if let Some(o) = owner {
                owners.insert(o);
            }
            defs.entry(func.name.as_str()).or_default().push(Def {
                fam,
                dir,
                site: (fi, gi),
                owner,
            });
        }
    }

    let mut resolved = 0u64;
    let mut unresolved = 0u64;
    // Deduplicated: the same pair reached through two different names is one dependency.
    let mut edges: HashSet<(Site, Site)> = HashSet::new();
    for (fi, file) in files.iter().enumerate() {
        if !crate::parse::resolves_calls(file.lang) {
            continue;
        }
        let fam = family(file.lang);
        let dir = dir_of(file.path);
        for (gi, func) in file.funcs.iter().enumerate() {
            let from = (fi, gi);
            for call in &func.calls {
                let hits =
                    resolve(&defs, call, fam, fi, dir, func.owner.as_deref(), &owners, &modules);
                if hits.is_empty() {
                    unresolved += 1;
                    continue;
                }
                resolved += 1;
                for to in hits {
                    // Recursion is not wiring between two pieces of code, and it would put
                    // every self-referential helper one caller up the ranking for nothing.
                    if to != from {
                        edges.insert((from, to));
                    }
                }
            }
        }
    }

    // Seeded with a zero for every resolvable function, so "nothing calls this and it calls
    // nothing" is a recorded fact rather than a missing key. The `None` this module returns
    // has exactly one meaning — the language was never read — and a function that fell out of
    // the edge list must not borrow it.
    let mut per_site: HashMap<Site, Wire> = HashMap::new();
    for (fi, file) in files.iter().enumerate() {
        if crate::parse::resolves_calls(file.lang) {
            for gi in 0..file.funcs.len() {
                let seed = Wire {
                    dependents: told[fi].then_some(0),
                    ..Wire::default()
                };
                per_site.insert((fi, gi), seed);
            }
        }
    }
    // Neighbours per function, so `incident` counts a mutual pair once rather than twice.
    let mut neighbours: HashMap<Site, HashSet<Site>> = HashMap::new();
    for (from, to) in &edges {
        if let Some(w) = per_site.get_mut(from) {
            w.calls += 1;
        }
        if let Some(w) = per_site.get_mut(to) {
            w.callers += 1;
            // Counted up from zero only for languages we can actually ask; everywhere else it
            // stays `None` rather than becoming a zero nobody measured.
            if told[to.0] && !tests.contains(from) {
                *w.dependents.get_or_insert(0) += 1;
            }
        }
        neighbours.entry(*from).or_default().insert(*to);
        neighbours.entry(*to).or_default().insert(*from);
    }
    for (site, near) in &neighbours {
        let Some(w) = per_site.get_mut(site) else { continue };
        let home = dir_of(files[site.0].path);
        w.incident = near.len() as u32;
        w.away = near.iter().filter(|(fi, _)| dir_of(files[*fi].path) != home).count() as u32;
    }

    // Sorted, so the panel's lists come out in a stable order rather than a hash order that
    // reshuffles between two scans of an unchanged repo — the same argument `BTreeMap`
    // carries in `scan`'s directory grouping.
    let mut edges: Vec<(Site, Site)> = edges.into_iter().collect();
    edges.sort_unstable();
    Wiring { per_site, resolved, unresolved, resolvable, edges }
}

/// One definition, as the resolver needs to see it.
struct Def<'a> {
    fam: u8,
    dir: &'a str,
    site: Site,
    /// The type or module it is defined in — see [`crate::parse::FuncDef::owner`]. `None` is
    /// a free function, and that is the half of this the dot rule turns on.
    owner: Option<&'a str>,
}

/// What is known about whether this definition is test code, and on what evidence.
///
/// **Contract, then Convention — and the reader sits between them**, filled in by the caller
/// where it has a reading to offer, because this function has none. See
/// [`crate::model::Testness`] for why the level is kept rather than collapsed to a boolean:
/// a number built on a bare `true` is an estimate whose accuracy is a function of how many
/// conventions we bothered to encode, presented as if it were a property of the code.
///
/// **A contract answers both ways.** Rust's `#[cfg(test)]` decides what is in the binary, so
/// its silence is a real `false` and not a shrug — which is exactly what lets a Rust repo skip
/// the reader question entirely. Go's `_test.go` is the same kind of fact, spelled as a
/// filename.
///
/// Everything below that is [`Tested::Convention`]: a runner's published glob (`test_*.py`,
/// `*.spec.ts`) or a directory somebody named. Filenames are the stronger half — a filename is
/// chosen to match a pattern someone else wrote down, where a directory called `tests` is a
/// domain noun in plenty of repos, covers vendored trees, and says nothing about the fixtures
/// under it. Both are here and both are labelled, so a finding can say which it leaned on.
fn contract_of(lang: Lang, path: &str, in_cfg_test: bool) -> Option<Testness> {
    let file = path.rsplit_once('/').map_or(path, |(_, f)| f);
    let yes = |is_test| Some(Testness { is_test, how: Tested::Contract });
    match lang {
        // The compiler excludes it. `tests/` beside `src/` is cargo's own contract for
        // integration tests, and is anchored at the crate root rather than matched anywhere.
        Lang::Rust => yes(in_cfg_test || path.starts_with("tests/") || path.contains("/tests/")),
        Lang::Go => yes(file.ends_with("_test.go")),
        _ => None,
    }
}

/// What the REPO says about its own tests, read from the files its author wrote.
///
/// **A contract is what somebody wrote down, not only what a compiler enforces.** That is the
/// wider and better line: `#[cfg(test)]` is a declaration to the compiler, `_test.go` is one
/// to the go tool, and a `jest` key in `package.json` is one to jest. All three are the
/// repo's author saying which code is a test, and reading a declaration is not guessing.
///
/// The inverse is a declaration too, and it is the cheapest one here: **a project that
/// configures no test runner at all for a language has said there are no tests in it.** This
/// repo's own `web/` is exactly that — no config file, no runner in `devDependencies`, no
/// `test` script — and without this, every one of its TypeScript functions costs a reader the
/// question `TEST_ASK` asks, to be told no. That was 6.5% of the token floor to learn
/// something `package.json` already said.
///
/// Absent means only that nothing was found to read. It is not `NoTests`: a repo can have
/// tests and configure them somewhere this does not look, so the fall-through is convention
/// and then a reader, exactly as before.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Declares {
    /// The repo configures no test runner for this language family. Nothing here is a test.
    NoTests,
}

/// What each language family's manifests declare. Built once per scan — see
/// [`crate::scan::declared`], which is where the files are read.
#[derive(Debug, Clone, Copy, Default)]
pub struct Declarations {
    pub js: Option<Declares>,
    pub python: Option<Declares>,
}

impl Declarations {
    fn of(&self, lang: Lang) -> Option<Declares> {
        match lang {
            Lang::TypeScript | Lang::Tsx | Lang::JavaScript => self.js,
            Lang::Python => self.python,
            _ => None,
        }
    }
}

/// Does this language's toolchain answer the test question by itself?
///
/// The queue asks it before deciding whether to spend a sentence asking a reader — see
/// `agentapi::TEST_ASK`. One function so the two cannot disagree: a language that got a
/// contract here and was not removed from the ask list would be paying for an answer it
/// already has, silently and on every reading.
pub fn has_test_contract(lang: Option<Lang>, declared: &Declarations) -> bool {
    lang.is_some_and(|l| {
        contract_of(l, "", false).is_some() || declared.of(l) == Some(Declares::NoTests)
    })
}

/// The repo's own declaration, at contract strength because somebody wrote it.
fn declared_of(lang: Lang, declared: &Declarations) -> Option<Testness> {
    match declared.of(lang)? {
        Declares::NoTests => Some(Testness { is_test: false, how: Tested::Contract }),
    }
}

/// The weaker half: a runner's glob or a directory name. Never consulted where a contract
/// spoke.
fn convention_of(lang: Lang, path: &str) -> Option<Testness> {
    let file = path.rsplit_once('/').map_or(path, |(_, f)| f);
    let seg = |s: &str| path.split('/').any(|p| p == s);
    let guess = |is_test| Some(Testness { is_test, how: Tested::Convention });
    match lang {
        Lang::Python => guess(
            file.starts_with("test_")
                || file.ends_with("_test.py")
                || file == "conftest.py"
                || seg("tests")
                || seg("test"),
        ),
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => guess(
            [".test.", ".spec."].iter().any(|m| file.contains(m))
                || seg("__tests__")
                || seg("tests"),
        ),
        Lang::Ruby => guess(file.ends_with("_spec.rb") || file.ends_with("_test.rb") || seg("spec")),
        Lang::Java | Lang::Kotlin | Lang::Scala => guess(path.contains("/src/test/")),
        // C++ loudest among the rest: no contract, and a bare `test/` directory on a codebase
        // this size is a guess rather than a convention. It says nothing until a reader does.
        _ => None,
    }
}

/// The file name without its directory or extension — what a module-qualified call spells./// The file name without its directory or extension — what a module-qualified call spells.
fn stem_of(path: &str) -> &str {
    let file = path.rsplit_once('/').map_or(path, |(_, f)| f);
    file.split_once('.').map_or(file, |(stem, _)| stem)
}

/// Which definitions a call reaches, nearest tier first.
///
/// **Same file, then same directory, then the whole family** — and the tiers are not just a
/// preference order, they carry different evidence. A name matched inside the file it is
/// called from is about as certain as this method gets, and if the file defines it twice the
/// two are genuinely both plausible. Across the repo nothing local vouches for the match, so
/// only a name with exactly one definition anywhere is taken; past that it is a common word
/// (`get`, `run`, `new`) and the honest answer is that we do not know.
///
/// **That guard was necessary and not sufficient, and the gap had a body count.** It fires on
/// a name defined MORE than once. A name defined exactly once still took every call spelled
/// like it, anywhere in the family — so `parse.rs`'s private `collect`, which one line in the
/// repo calls, was credited with all 175 bodies that write `.collect()`. And the directory
/// tier has the same hole one level down: `src-tauri/src` is forty files in one directory, so
/// every `.len()` in the backend landed on whichever `len` happened to live next door. The ten
/// most-called functions in this repo were `new`, `collect`, `path`, `len`, `is_empty` and
/// `get` — the Rust standard library, ranked as though it were the code.
///
/// **So how a call was SPELLED decides which tiers it may use.** That is not the receiver's
/// type, which no parse here can have; it is [`crate::parse::Via`], read off the page:
///
/// - **`f()`** vouches for nothing and needs nothing. The tiers are as they were.
/// - **`A::f()` or `x.f()` where `A` names a type something in this repo is defined in.**
///   The strongest evidence available, and it beats locality: the candidates are the ones
///   with that owner, wherever they live.
/// - **`m.f()` or `m::f()` where `m` names a module or a file here.** That is how Python and
///   Go spell a call to a free function in another file, and how Rust spells `mem::swap`. The
///   qualifier is checked and then spent; the tiers run as for a bare name.
/// - **Anything else** — `xs.collect()`, `Vec::new()` — is a call through something this repo
///   never defined. Two things follow, and both are facts about the language rather than
///   guesses about the code: it cannot be reaching a FREE function, because no language here
///   lets you call one through a value or a foreign type; and its own directory vouches for
///   nothing, because the receiver is not local, so the middle tier is skipped. What is left
///   is the file it was written in, or a name defined exactly once in the repo.
///
/// Returning several sites rather than picking one is deliberate. A guess would put a
/// confident edge on the map where the parse has none, and the counts this feeds are already
/// only ever read as "roughly how wired is this" — one extra candidate in a directory changes
/// a caller count by one, where a wrong pick changes two functions' wiring and looks certain.
#[allow(clippy::too_many_arguments)]
fn resolve(
    defs: &HashMap<&str, Vec<Def<'_>>>,
    call: &crate::parse::Call,
    fam: u8,
    file: usize,
    dir: &str,
    // The owner of the body making the call, which is the one receiver type that can be
    // known: `self` is whatever this is defined in.
    mine: Option<&str>,
    owners: &HashSet<&str>,
    modules: &HashSet<&str>,
) -> Vec<Site> {
    let Some(all) = defs.get(call.name.as_str()) else { return Vec::new() };
    let same_family: Vec<&Def<'_>> = all.iter().filter(|d| d.fam == fam).collect();
    if same_family.is_empty() {
        return Vec::new();
    }

    let (through, qualifier) = match &call.via {
        crate::parse::Via::Free => (false, None),
        crate::parse::Via::Dot(q) | crate::parse::Via::Path(q) => (true, q.as_deref()),
    };
    // **`self` is the one receiver whose type is knowable**, and it is knowable exactly
    // because it is not a lookup: the body doing the calling is defined in something, and
    // `self.f()` means that something's `f`. `this` and `Self` are the same word in the other
    // languages read here.
    let named = match qualifier {
        Some("self" | "this" | "Self") => mine,
        other => other,
    };
    // Named the owner: that IS the answer, and locality has nothing to add to it.
    if let Some(q) = named {
        if owners.contains(q) {
            let owned: Vec<Site> =
                same_family.iter().filter(|d| d.owner == Some(q)).map(|d| d.site).collect();
            if !owned.is_empty() {
                return owned;
            }
        }
    }
    // A bare name, or a qualifier that names a module here, leaves the tiers as they always
    // were. A receiver with no name to check does not: an unreadable qualifier is a reason to
    // know less, never a reason to fall back to knowing more.
    let local = !through || qualifier.is_some_and(|q| modules.contains(q));

    let mut reachable: Vec<&Def<'_>> = same_family;
    if !local {
        // Through a value or a foreign type, so it is not a free function — and `self.f()`
        // and `this.f()` land here too, which is right: they are methods, and the file tier
        // below is where an impl and its own calls almost always sit.
        reachable.retain(|d| d.owner.is_some());
        if reachable.is_empty() {
            return Vec::new();
        }
    }

    // **A receiver this repo cannot name reaches nothing, its own file included.** The file
    // tier was left open here at first, on the argument that an impl and the code using it sit
    // together — and it put 19 callers on `parse.rs`'s test-only `walk`, every one of them
    // tree-sitter's `cursor.walk()` written in the same file. A big file that uses a common
    // method name it also defines is exactly where that argument fails, and a big file is
    // where a wrong caller count does the most damage. `self` is handled above, which is the
    // case the file tier was really standing in for.
    if !local {
        return Vec::new();
    }
    let here: Vec<Site> = reachable.iter().filter(|d| d.site.0 == file).map(|d| d.site).collect();
    if !here.is_empty() {
        return here;
    }
    // Repo-uniqueness is real evidence about a NAME and none at all about a receiver's type:
    // `as_str`, `lock` and `count` are each defined exactly once here and each of them still
    // collected every standard-library call spelled the same way. The file tier survives
    // because `self.f()` is written next to the impl it belongs to; nothing below it does.
    let near: Vec<Site> = reachable.iter().filter(|d| d.dir == dir).map(|d| d.site).collect();
    if !near.is_empty() {
        return near;
    }
    if reachable.len() > GLOBAL_UNIQUE {
        return Vec::new();
    }
    reachable.iter().map(|d| d.site).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse::FuncDef;

    /// A call written as a bare name, which is what most of these fixtures mean.
    fn free(name: &str) -> crate::parse::Call {
        crate::parse::Call { name: name.to_string(), via: crate::parse::Via::Free }
    }

    fn def(name: &str, calls: &[&str]) -> FuncDef {
        FuncDef {
            name: name.into(),
            signature: format!("fn {name}()"),
            body: "{}".into(),
            doc: None,
            owner: None,
            start_line: 1,
            end_line: 2,
            shape: None,
            cognitive: None,
            in_cfg_test: false,
            calls: calls.iter().map(|c| free(c)).collect(),
        }
    }

    /// A definition inside a type, which is what makes it reachable through a receiver.
    fn method(owner: &str, name: &str, calls: &[crate::parse::Call]) -> FuncDef {
        FuncDef { owner: Some(owner.into()), calls: calls.to_vec(), ..def(name, &[]) }
    }

    /// A body the compiler excludes from the binary — `#[cfg(test)]`, which is the only
    /// thing that makes it test code by CONTRACT. A module merely named `tests` is a
    /// convention, and for Rust the contract has already answered by then.
    fn test_fn(name: &str, calls: &[crate::parse::Call]) -> FuncDef {
        FuncDef {
            owner: Some("tests".into()),
            in_cfg_test: true,
            calls: calls.to_vec(),
            ..def(name, &[])
        }
    }

    /// A definition with calls this file has spelled out, rather than the bare names `def`
    /// takes.
    fn spells(name: &str, calls: &[crate::parse::Call]) -> FuncDef {
        FuncDef { calls: calls.to_vec(), ..def(name, &[]) }
    }

    /// `q.name()` — a call through a receiver spelled `q`.
    fn dot(q: &str, name: &str) -> crate::parse::Call {
        crate::parse::Call {
            name: name.to_string(),
            via: crate::parse::Via::Dot(Some(q.to_string())),
        }
    }

    /// `something().name()` — a receiver with no name to check.
    fn anon(name: &str) -> crate::parse::Call {
        crate::parse::Call { name: name.to_string(), via: crate::parse::Via::Dot(None) }
    }

    /// `Q::name()`.
    fn path(q: &str, name: &str) -> crate::parse::Call {
        crate::parse::Call {
            name: name.to_string(),
            via: crate::parse::Via::Path(Some(q.to_string())),
        }
    }

    /// `wire` over a fixed set of files, so a test reads as the repo it describes.
    fn wired(files: &[(&str, Lang, Vec<FuncDef>)]) -> Wiring {
        let views: Vec<FileView<'_>> =
            files.iter().map(|(p, l, f)| FileView { path: p, lang: *l, funcs: f }).collect();
        wire(&views)
    }

    /// **The one that shipped for months and made the whole lens report the standard
    /// library.** `xs.collect()` is not a call to a free function named `collect` — no
    /// language read here lets you call one through a value — but the resolver saw only the
    /// name, found exactly one definition repo-wide and credited every body in the repo to
    /// it. On sanity itself the private helper in `parse.rs` was reported with 175 callers
    /// against a true 1, and it was the third most-called function in the repo.
    #[test]
    fn a_call_through_a_receiver_is_not_a_call_to_a_free_function() {
        let w = wired(&[
            ("src/parse.rs", Lang::Rust, vec![def("collect", &[])]),
            (
                "src/scan.rs",
                Lang::Rust,
                vec![spells("scan", &[anon("collect"), dot("xs", "collect")])],
            ),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(0), "a free function is not a method");
        assert_eq!(w.at(1, 0).map(|x| x.calls), Some(0));
    }

    /// The other half of the same rule: a receiver with no name to check is still a receiver.
    ///
    /// `xs.iter().collect()` ends in `)`, not in an identifier — and reading that as a BARE
    /// name is what kept the bug alive through the first fix. An unreadable qualifier is a
    /// reason to know less, never a reason to fall back to knowing more.
    #[test]
    fn an_unreadable_receiver_is_not_a_bare_name() {
        let w = wired(&[
            ("src/a.rs", Lang::Rust, vec![method("Store", "load", &[])]),
            ("src/b.rs", Lang::Rust, vec![spells("run", &[anon("load")])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(0), "nothing vouches for that receiver");
    }

    /// A qualifier that names a type something here is defined in is the strongest evidence
    /// this method gets, and it beats being next door: `Store::load()` means the `load` in
    /// `impl Store`, not the unrelated one the caller happens to share a directory with.
    #[test]
    fn an_owner_beats_locality() {
        let w = wired(&[
            ("src/far/store.rs", Lang::Rust, vec![method("Store", "load", &[])]),
            ("src/near.rs", Lang::Rust, vec![def("load", &[])]),
            ("src/caller.rs", Lang::Rust, vec![spells("run", &[path("Store", "load")])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "the owner named it");
        assert_eq!(w.at(1, 0).map(|x| x.callers), Some(0), "sharing a directory is not evidence");
    }

    /// **A qualifier that names a MODULE is spent, not held against the call.** `util.helper()`
    /// in Python and Go, and `util::helper()` in Rust, are how a free function in another file
    /// is called — so the qualifier is checked, found to be a file here, and then the ordinary
    /// tiers run exactly as they do for a bare name. Refusing these would paint every
    /// cross-file call in two whole languages as reaching nothing.
    ///
    /// **This one passes under the old resolver too**, and is here for that reason rather than
    /// in spite of it: the other four in this group pin what the spelling rule REFUSES, and
    /// this pins what it must go on allowing. A fix measured only by what it removes has no
    /// way to notice that it removed too much.
    #[test]
    fn a_module_qualifier_leaves_the_tiers_alone() {
        let w = wired(&[
            ("src/util.rs", Lang::Rust, vec![def("helper", &[])]),
            ("src/far/caller.rs", Lang::Rust, vec![spells("run", &[path("util", "helper")])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "a module qualifier is not a receiver");
    }

    /// **A receiver this repo cannot name reaches nothing, and its own file is not an
    /// exception.**
    ///
    /// The file tier was left open for these at first, on the argument that an impl and the
    /// code using it sit together. It put 19 callers on `parse.rs`'s test-only `walk`, all of
    /// them tree-sitter's `cursor.walk()` written in the same file — and a big file using a
    /// common method name it also defines is both where that argument fails and where a wrong
    /// count does the most damage.
    ///
    /// `self` is what the file tier was standing in for, and it is handled exactly: not by
    /// locality but by knowing what the CALLER is defined in, which is the one receiver type
    /// that is never a guess. The test below this one pins that half.
    #[test]
    fn an_unnameable_receiver_reaches_nothing() {
        let w = wired(&[
            // The receiver is deliberately not spelled like either file: a qualifier that
            // names a module here is a different case, and it is the test above this one.
            (
                "src/a.rs",
                Lang::Rust,
                vec![method("Blame", "len", &[]), spells("near", &[dot("held", "len")])],
            ),
            ("src/b.rs", Lang::Rust, vec![spells("far", &[dot("held", "len")])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(0), "not even from its own file");
        assert_eq!(w.at(1, 0).map(|x| x.calls), Some(0), "and not from the next one over");
    }

    /// **`self.f()` is the one call through a receiver whose type is not a guess**, because it
    /// is not a lookup at all: the body doing the calling is defined in something, and that
    /// something is what `self` is. It beats locality the same way a named owner does — the
    /// impl in the far file wins over the same-named free function next door.
    #[test]
    fn self_is_the_receiver_this_can_name() {
        let w = wired(&[
            ("src/far/store.rs", Lang::Rust, vec![
                method("Store", "load", &[]),
                method("Store", "run", &[dot("self", "load")]),
            ]),
            ("src/far/other.rs", Lang::Rust, vec![def("load", &[])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "its own type's method");
        assert_eq!(w.at(1, 0).map(|x| x.callers), Some(0), "not the neighbour of that name");
    }

    /// **A test is a caller and it is not a dependent**, and the two numbers say so
    /// separately. Both blind reviewers of this repo worked this out by hand — *10 of the 13
    /// call sites are its own tests* — because the sentence a finding prints is *a change here
    /// has to be checked against all 13*, and eleven of those move with the function as one
    /// edit.
    ///
    /// `callers` is deliberately unchanged: it is what the lens paints, and a test does call
    /// the thing.
    #[test]
    fn a_test_is_a_caller_and_not_a_dependent() {
        let w = wired(&[(
            "src/a.rs",
            Lang::Rust,
            vec![
                def("helper", &[]),
                def("shipped", &["helper"]),
                // `#[cfg(test)]` is the contract: the compiler will not put this in the
                // binary, so it is not a dependent of anything.
                test_fn("covers_helper", &[free("helper")]),
            ],
        )]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(2), "both of them call it");
        assert_eq!(w.at(0, 0).map(|x| x.dependents), Some(Some(1)), "only one depends on it");
        // And a body nothing calls is a dependents ZERO, not an absence: the language was
        // asked and answered.
        assert_eq!(w.at(0, 2).map(|x| x.dependents), Some(Some(0)));
    }

    /// **A contract answers both ways, which is what spares the reader the question.**
    ///
    /// Rust's `#[cfg(test)]` decides what is in the binary, so its silence is a real `false`
    /// and not a shrug — and because the contract has spoken, the convention below it is never
    /// consulted. A module somebody merely NAMED `tests`, with no attribute, is code that
    /// ships, and counting it as a test would be the tool overriding the compiler.
    #[test]
    fn a_contract_answers_both_ways_and_stops_there() {
        let w = wired(&[(
            "src/a.rs",
            Lang::Rust,
            vec![
                def("helper", &[]),
                // `mod tests` in name only: no attribute, so this is in the binary.
                method("tests", "looks_like_a_test", &[free("helper")]),
            ],
        )]);
        assert_eq!(
            w.at(0, 0).map(|x| x.dependents),
            Some(Some(1)),
            "the compiler says this ships, so it is a dependent"
        );
    }

    /// **A reader outranks a convention and is outranked by a contract.**
    ///
    /// The order is the order the evidence is worth: a contract is a fact about what ships, a
    /// reader actually read the body, and a convention only ever saw the path. So a reader can
    /// overrule a directory guess — a fixture builder sitting in a production file, or a
    /// helper under `tests/` that production calls — and cannot overrule the compiler.
    #[test]
    fn a_reader_outranks_the_layout_and_not_the_toolchain() {
        // The layout says test; nothing has read it.
        let w = wired(&[
            ("tests/helpers.py", Lang::Python, vec![def("build", &[])]),
            ("app/run.py", Lang::Python, vec![def("run", &["build"])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.dependents), Some(Some(1)), "a caller is a dependent");

        // `wire_with` is the entry point that carries a reader's answers; `scan` fills it
        // from the store, which is where the keying lives.
        let none = Declarations::default();
        assert!(wire_with(&[], &HashMap::new(), &none).edges.is_empty(), "empty is empty");

        // Python has no contract, so the queue asks; Rust has one, so it never does.
        assert!(!has_test_contract(Some(Lang::Python), &none));
        assert!(
            has_test_contract(Some(Lang::Rust), &none) && has_test_contract(Some(Lang::Go), &none)
        );
        assert!(!has_test_contract(None, &none), "a language nobody parsed answers nothing");

        // **And a repo that declared no runner has answered for its whole language.** This
        // repo's `web/` is exactly that, and without it every TypeScript function costs a
        // reader the question — 6.5% of the token floor to be told what `package.json` says.
        let said_no = Declarations { js: Some(Declares::NoTests), ..Default::default() };
        assert!(has_test_contract(Some(Lang::TypeScript), &said_no), "the repo already said");
        assert!(!has_test_contract(Some(Lang::Python), &said_no), "and only for that family");
    }

    /// **A language with no test convention says nothing rather than zero.** C++ has no
    /// compiler marker and no enforced layout — googletest is a library, not a build rule — so
    /// a confident "0 of these callers are tests" there would be the third number this file
    /// invented. The rules that ask for it go dark instead.
    #[test]
    fn a_language_with_no_test_convention_reports_no_dependents() {
        let w = wired(&[("src/a.cc", Lang::Cpp, vec![def("helper", &[]), def("run", &["helper"])])]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "callers are still counted");
        assert_eq!(w.at(0, 0).map(|x| x.dependents), Some(None), "and nothing is claimed");
    }

    #[test]
    fn a_call_becomes_a_caller() {
        let w = wired(&[("a.rs", Lang::Rust, vec![def("top", &["helper"]), def("helper", &[])])]);
        assert_eq!(w.at(0, 1).unwrap().callers, 1);
        assert_eq!(w.at(0, 0).unwrap().calls, 1);
        assert_eq!(w.at(0, 0).unwrap().callers, 0);
    }

    /// The distinction the whole lens rests on: a language nobody has read reports NOTHING,
    /// and a function nothing calls reports ZERO. Collapsing the two would draw every
    /// repo in an unwired language as dead code.
    #[test]
    fn an_unreadable_language_is_absent_and_an_uncalled_function_is_zero() {
        let w = wired(&[
            ("a.rs", Lang::Rust, vec![def("orphan", &[])]),
            ("b.sql", Lang::Sql, vec![def("also_orphan", &[])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(0), "Rust: measured, and it is zero");
        assert_eq!(w.at(1, 0).map(|x| x.callers), None, "SQL: never looked");
        assert_eq!(w.resolvable, 1, "the denominator counts only what could be read");
    }

    /// Recursion is not two pieces of code depending on each other.
    #[test]
    fn a_function_does_not_call_itself_into_the_ranking() {
        let w = wired(&[("a.rs", Lang::Rust, vec![def("loopy", &["loopy"])])]);
        assert_eq!(w.at(0, 0).unwrap().callers, 0);
        assert_eq!(w.at(0, 0).unwrap().incident, 0);
    }

    /// A Python `main` and a Go `main` are not the same function.
    #[test]
    fn edges_do_not_cross_language_families() {
        let w = wired(&[
            ("a.py", Lang::Python, vec![def("start", &["main"])]),
            ("b.go", Lang::Go, vec![def("main", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 0);
        assert_eq!(w.unresolved, 1);
    }

    /// The header-and-implementation edge, which is the one everybody asks for — and which an
    /// identity comparison on `Lang` would sever, because `.h` parses as C++ and `.c` as C.
    #[test]
    fn a_c_file_and_a_cpp_header_are_one_family() {
        let w = wired(&[
            ("src/thing.c", Lang::C, vec![def("run", &["thing_init"])]),
            ("include/thing.h", Lang::Cpp, vec![def("thing_init", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 1);
    }

    /// Two definitions in one file are two plausible targets and the file is the evidence.
    #[test]
    fn a_locally_ambiguous_name_credits_every_candidate() {
        let mut twin_a = def("parse", &[]);
        let twin_b = def("parse", &[]);
        twin_a.owner = Some("A".into());
        let w = wired(&[("a.rs", Lang::Rust, vec![def("top", &["parse"]), twin_a, twin_b])]);
        assert_eq!(w.at(0, 1).unwrap().callers, 1);
        assert_eq!(w.at(0, 2).unwrap().callers, 1);
    }

    /// Across the repo nothing local vouches for the match, so a shared spelling is a word.
    ///
    /// Without this the common verbs — `get`, `run`, `new` — collect a caller count in the
    /// hundreds and take over the top of every ranking the lens produces.
    #[test]
    fn a_globally_ambiguous_name_resolves_to_nothing() {
        let w = wired(&[
            ("a/one.rs", Lang::Rust, vec![def("top", &["get"])]),
            ("b/two.rs", Lang::Rust, vec![def("get", &[])]),
            ("c/three.rs", Lang::Rust, vec![def("get", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 0);
        assert_eq!(w.at(2, 0).unwrap().callers, 0);
        assert_eq!(w.unresolved, 1);
        // The same name with ONE definition repo-wide does resolve — the rule is about
        // ambiguity, not about distance.
        let w = wired(&[
            ("a/one.rs", Lang::Rust, vec![def("top", &["get"])]),
            ("b/two.rs", Lang::Rust, vec![def("get", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 1);
    }

    /// The nearer tier wins outright rather than being merged with the wider one.
    #[test]
    fn a_local_definition_shadows_a_distant_one() {
        let w = wired(&[
            ("a/one.rs", Lang::Rust, vec![def("top", &["helper"]), def("helper", &[])]),
            ("b/two.rs", Lang::Rust, vec![def("helper", &[])]),
        ]);
        assert_eq!(w.at(0, 1).unwrap().callers, 1, "the one in the same file");
        assert_eq!(w.at(1, 0).unwrap().callers, 0, "not the one across the repo");
    }

    #[test]
    fn locality_is_the_share_of_neighbours_outside_the_directory() {
        let w = wired(&[
            ("src/a.rs", Lang::Rust, vec![def("hub", &["near", "far"])]),
            ("src/b.rs", Lang::Rust, vec![def("near", &[])]),
            ("other/c.rs", Lang::Rust, vec![def("far", &[])]),
        ]);
        assert_eq!(w.at(0, 0).unwrap().locality_gap(), Some(0.5));
        assert_eq!(w.at(1, 0).unwrap().locality_gap(), Some(0.0), "called from next door");
        assert_eq!(w.at(2, 0).unwrap().locality_gap(), Some(1.0), "called from elsewhere");
    }

    /// A function wired to nothing has no locality, and must not be handed the calm end of
    /// the ramp for it. Zero would say "everything it touches is next door"; it touches
    /// nothing, which is Reach's subject and not Locality's.
    #[test]
    fn an_unwired_function_has_no_locality_rather_than_perfect_locality() {
        let w = wired(&[("a.rs", Lang::Rust, vec![def("alone", &[])])]);
        assert_eq!(w.at(0, 0).unwrap().locality_gap(), None);
    }

    /// A mutual pair is one neighbour each, not two.
    #[test]
    fn a_mutual_pair_counts_once_from_each_side() {
        let w =
            wired(&[("a.rs", Lang::Rust, vec![def("ping", &["pong"]), def("pong", &["ping"])])]);
        assert_eq!(w.at(0, 0).unwrap().incident, 1);
        assert_eq!(w.at(0, 1).unwrap().incident, 1);
    }
}

