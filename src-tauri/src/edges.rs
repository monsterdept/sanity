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

use crate::model::{Kind, Kinded, Tested, Testness};
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
    /// Does a test call this — `None` where test code cannot be told apart here.
    ///
    /// **"A test calls this", never "this is covered".** Coverage means the line executed,
    /// which needs the suite to have been RUN and instrumented, and this tool never runs
    /// anything. Borrowing the word would be the map claiming a measurement nobody took, on
    /// the one question people are most primed to misread.
    ///
    /// **What a test REACHES, at any depth.** A test of `a` exercises `b` through `a`; saying
    /// only the first hop is tested paints every accessor under a tested entry point as
    /// untested, which reads as false because it is.
    ///
    /// Direct-only was the first answer, on the argument that a closure reaches nearly
    /// everything and distinguishes nothing. Measured, it saturates at 37% of classifiable
    /// bodies on two unrelated Rust repos — so almost two thirds are reached by no test at
    /// any depth, and the closure is the discriminating answer rather than the vacuous one.
    /// See `links::reach_depth::how_far_do_tests_reach`.
    ///
    /// **It reports a SEARCH, and the search is incomplete by construction.** Calls are
    /// followed only in languages `resolves_calls` parses and only where a name resolves, so
    /// a body reached through a refused edge reports as unreached — and a suite written in
    /// shell that drives a binary from outside contributes nothing at all. flox has 19,065
    /// lines of `.bats` doing exactly that.
    ///
    /// Which is why every word on this band says what was FOUND. `no test found` is true;
    /// `untested` would be a claim about the world that a call graph cannot make, and each
    /// time this was got wrong the map looked plausible while saying it. `super::f()` — how a
    /// Rust unit test calls the thing it tests — was thrown away for a week under exactly
    /// that heading.
    ///
    /// The absence is the important half: `None` means test code is not separable here (C++,
    /// GDScript, anything with no contract and nothing read), and it must render as "we
    /// cannot tell" rather than as "no test calls this".
    pub under_test: Option<bool>,
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
    /// What each site turned out to be, and on what evidence — for the tree, which draws it.
    pub tested: HashMap<Site, Testness>,
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
    wire_with(files, &Declarations::default())
}

/// `wire`, plus what the repo's own manifests declared — see [`Declarations`].
///
/// **A reader's answer is deliberately not an input here.** The tree is what the parse and
/// the paths can say; a reading is applied where readings live, by [`crate::links::retest`].
/// Taking one as an argument was what made a landed reading need a whole rescan before it
/// changed anything, which is a layering mistake rather than a property of the design.
pub fn wire_with(files: &[FileView<'_>], declared: &Declarations) -> Wiring {
    // name → every definition of it, with the family and directory needed to rank candidates.
    let mut defs: HashMap<&str, Vec<Def<'_>>> = HashMap::new();
    // Every name a qualifier could legitimately BE: the types and modules definitions sit in,
    // and the file stems a module-qualified call spells. See `resolve`.
    let mut owners: HashSet<&str> = HashSet::new();
    let mut modules: HashSet<&str> = HashSet::new();
    // Which sites are test code, and which FILES we were able to ask about at all — kept per
    // file rather than per language so nothing has to be hashed that is not already.
    let mut tests: HashSet<Site> = HashSet::new();
    // Bodies the toolchain excludes from the build. A subset of `tests`, and the distinction
    // matters: a convention says where tests probably live, a contract says what does not
    // ship, and only the second can rule an edge impossible.
    let mut sealed: HashSet<Site> = HashSet::new();
    let mut tested: HashMap<Site, Testness> = HashMap::new();
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
            // **Structural evidence only, strongest first**: the toolchain's marker, then a
            // filename or directory convention, then the repo's own corroborated silence —
            // which comes last of the three because it is about a whole language rather than
            // one file. A reader's answer belongs to none of these tiers and is applied by
            // `links::retest`, where readings live.
            let known = testness(file.lang, file.path, func.in_cfg_test, &func.name, declared);
            // Test by CONTRACT, which is a fact about what the compiler builds rather than a
            // judgement — see the edge filter below, which is the only thing that reads it.
            if contract_of(file.lang, file.path, func.in_cfg_test)
                .is_some_and(|t| t.is_test)
            {
                sealed.insert((fi, gi));
            }
            if let Some(t) = known {
                if t.is_test {
                    tests.insert((fi, gi));
                }
                tested.insert((fi, gi), t);
                told[fi] = true;
            }
            let owner = func.owner.as_deref();
            if let Some(o) = owner {
                owners.insert(o);
            }
            defs.entry(func.name.as_str()).or_default().push(Def {
                fam,
                dir,
                path: file.path,
                lang: file.lang,
                exported: func.exported,
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
            let caller =
                Caller { file: fi, dir, path: file.path, mine: func.owner.as_deref() };
            for call in &func.calls {
                // **A name this body defines itself is not a name to look up.** A closure or a
                // nested function shadows an outer definition of the same spelling in every
                // language read here, so the call goes to the local one — and the local one is
                // not in `defs`, because `parse::collect` stops descending at a function
                // boundary while the call walk does not. Left to `resolve`, the call goes to
                // whichever stranger shares the spelling: `reportTables.ts#walk`, a
                // module-private helper with five call sites in its own file, was credited
                // with 21 callers across nine files that cannot import it. See
                // [`crate::parse::FuncDef::locals`] and `docs/notes/wiring.md`.
                //
                // Counted as RESOLVED rather than dropped: the call found its callee, which is
                // a body this index does not hold. `unresolved` is the share that says the
                // family rule or the grammar is wrong, and a shadowed call is neither.
                if func.locals.iter().any(|l| l == &call.name) {
                    resolved += 1;
                    continue;
                }
                let hits = resolve(&defs, call, fam, &caller, &owners, &modules);
                if hits.is_empty() {
                    unresolved += 1;
                    continue;
                }
                resolved += 1;
                for to in hits {
                    // **Nothing outside `#[cfg(test)]` can call into it.** The compiler does
                    // not build that code, so the edge is not merely unlikely — it cannot
                    // exist, and this is the one place a name collision can be ruled out by a
                    // fact rather than by a guess about a receiver.
                    //
                    // It is what lets the file tier stay open for everything else: 19 callers
                    // on `parse.rs`'s test-only `walk`, all of them `cursor.walk()` in
                    // production code, are refused here rather than by closing a tier that
                    // every trait impl needs.
                    if sealed.contains(&to) && !tests.contains(&from) {
                        continue;
                    }
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
                    // A repo where tests are separable can say "nothing tests this"; one
                    // where they are not must say nothing at all.
                    under_test: told[fi].then_some(false),
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
            // `dependents` is a DIRECT question — how many distinct non-test functions call
            // this, one per caller however many times it calls — so it
            // is counted here. Reach is not, and is walked below.
            if told[to.0] && !tests.contains(from) {
                *w.dependents.get_or_insert(0) += 1;
            }
        }
        neighbours.entry(*from).or_default().insert(*to);
        neighbours.entry(*to).or_default().insert(*from);
    }
    // **What a test reaches, not what it calls.** A test of `a` exercises `b` through `a`,
    // and `c` through `b`, and reporting only the first hop paints the accessors under a
    // tested entry point as untested — which reads as false, because it is.
    //
    // Transitive was argued against on the grounds that a closure reaches nearly everything
    // and stops distinguishing anything. That was an assertion, and it is wrong: measured on
    // two unrelated Rust repos it saturates at 37% of classifiable bodies — sanity 14% direct
    // to 37% reached, flox 18% to 37% — so nearly two thirds are reached by no test at any
    // depth. `how_far_do_tests_reach` is the measurement and it is kept.
    //
    // A cycle is not a special case: a visited set makes `c` calling `a` back terminate.
    let mut out_edges: HashMap<Site, Vec<Site>> = HashMap::new();
    for (from, to) in &edges {
        out_edges.entry(*from).or_default().push(*to);
    }
    let mut reached: HashSet<Site> = HashSet::new();
    let mut queue: Vec<Site> = tests.iter().copied().collect();
    while let Some(at) = queue.pop() {
        for to in out_edges.get(&at).map(Vec::as_slice).unwrap_or_default() {
            if !tests.contains(to) && reached.insert(*to) {
                queue.push(*to);
            }
        }
    }
    for site in &reached {
        if told[site.0] {
            if let Some(w) = per_site.get_mut(site) {
                w.under_test = Some(true);
            }
        }
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
    Wiring { per_site, tested, resolved, unresolved, resolvable, edges }
}

/// One definition, as the resolver needs to see it.
struct Def<'a> {
    fam: u8,
    dir: &'a str,
    /// The file it is defined in, which is the unit its visibility is measured from — and in
    /// Rust the root of the module subtree that can still name it.
    path: &'a str,
    /// What the definition is written in. The scope a private name reaches is a property of the
    /// LANGUAGE rather than of the repo: a file in the JS family, a directory in Go, a module
    /// tree in Rust. See [`reaches`].
    lang: Lang,
    /// Whether another module may name it — see [`crate::parse::FuncDef::exported`]. `None` is
    /// "this language does not say", and it refuses nothing.
    exported: Option<bool>,
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

/// Whether a body is a test, on structural evidence alone, strongest tier first.
///
/// **One chain with two callers**: `wire`, which places a body on the live map, and
/// `history::place`, which places the same body in a replay. Spelled out twice, the frame at
/// HEAD could call a body a test that the live map beside it calls code.
pub(crate) fn testness(
    lang: Lang,
    path: &str,
    in_cfg_test: bool,
    name: &str,
    declared: &Declarations,
) -> Option<Testness> {
    contract_of(lang, path, in_cfg_test)
        .or_else(|| convention_of(lang, path))
        .or_else(|| named_of(lang, name))
        .or_else(|| declared_of(lang, declared))
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
pub fn has_test_contract(lang: Option<Lang>) -> bool {
    lang.is_some_and(|l| contract_of(l, "", false).is_some())
}

/// Is asking a reader "is this a test" worth a sentence on this task?
///
/// **A different question from how much we KNOW**, and keeping them apart is the fix for
/// having made corroborated silence a contract. A repo that declares no runner anywhere and
/// holds no file shaped like a test is one where the answer is not seriously in doubt — not
/// because anybody declared it, but because there is nothing left for a reader to find. That
/// is worth skipping the question over and is not worth calling a contract.
pub fn skip_test_ask(lang: Option<Lang>, declared: &Declarations) -> bool {
    lang.is_some_and(|l| {
        has_test_contract(Some(l)) || declared.of(l) == Some(Declares::NoTests)
    })
}

/// What corroborated silence is worth, which is not what a declaration is worth.
///
/// **`NoTests` is an inference and is labelled as one.** A manifest that does not mention
/// jest has not said "there are no tests" — it has said nothing about tests, and reading
/// silence as a statement is the mistake this whole file keeps being written against. So it
/// comes back at [`Tested::Convention`] and is consulted after a reader, not before.
///
/// It is still worth having, and it is still worth NOT paying a reader to improve: those are
/// two different questions and conflating them is what put this at contract strength in the
/// first place. `skip_test_ask` answers the second one.
fn declared_of(lang: Lang, declared: &Declarations) -> Option<Testness> {
    match declared.of(lang)? {
        Declares::NoTests => Some(Testness { is_test: false, how: Tested::Convention }),
    }
}

/// What a file IS, from what the repo declared and what its path says.
///
/// **Contract first, and for generated code the contract is unusually strong**: a header
/// saying `Code generated by … DO NOT EDIT` is the tool that wrote the file asserting that
/// editing it is pointless, and `@generated` is the same convention Meta's tooling spread.
/// `.gitattributes` is the other declaration — `linguist-generated` and `linguist-vendored`
/// are lines the repo's own author wrote, which is the definition of a contract this file
/// settled on for tests.
///
/// Everything below that is a path, and a path is a convention: `vendor/` and `node_modules/`
/// are near-universal and still only a habit, and a directory called `generated` is a word
/// somebody chose. Both are labelled as what they are.
///
/// Tests are decided elsewhere — see `contract_of` — because the evidence there includes a
/// reader, and this has no body to hand.
pub fn kind_of(path: &str, head: &str, declared: &Attributes) -> Option<Kinded> {
    let file = path.rsplit_once('/').map_or(path, |(_, f)| f);
    let seg = |s: &str| path.split('/').any(|p| p == s);
    let by = |kind, how| Some(Kinded { kind, how });

    if declared.generated.iter().any(|p| glob_ish(p, path)) {
        return by(Kind::Generated, Tested::Contract);
    }
    if declared.vendored.iter().any(|p| glob_ish(p, path)) {
        return by(Kind::Vendored, Tested::Contract);
    }
    // The banner a generator writes. Only the first few lines are looked at, which is where
    // every one of these conventions puts it, and the match is case-folded because `DO NOT
    // EDIT` and `do not edit` are both current.
    let banner: String = head.chars().take(400).collect::<String>().to_lowercase();
    if banner.contains("do not edit")
        || banner.contains("@generated")
        || banner.contains("code generated by")
        || banner.contains("autogenerated")
        || banner.contains("automatically generated")
    {
        return by(Kind::Generated, Tested::Contract);
    }
    // Declarations rather than an implementation. `.d.ts` is contract-grade — the TypeScript
    // compiler emits nothing for one — and the rest are the universal spelling in their
    // ecosystems. Checked before the vendored and generated paths deliberately: a generated
    // header is more usefully drawn as generated, so this is only reached when neither of
    // those claimed it, which is why it sits after their contract checks and before their
    // conventions.
    if file.ends_with(".d.ts") {
        return by(Kind::Header, Tested::Contract);
    }
    if [".h", ".hpp", ".hh", ".hxx", ".pyi", ".idl"].iter().any(|e| file.ends_with(e)) {
        return by(Kind::Header, Tested::Convention);
    }
    if seg("vendor") || seg("node_modules") || seg("third_party") || seg("Godeps") {
        return by(Kind::Vendored, Tested::Convention);
    }
    if seg("generated")
        || seg("__generated__")
        || seg("antlr")
        || file.contains(".gen.")
        || file.contains(".pb.")
        || file.contains("_pb2.")
        || file.contains(".min.")
    {
        return by(Kind::Generated, Tested::Convention);
    }
    None
}

/// What `.gitattributes` declares about whole paths — the repo's author writing down what a
/// file is, which is the same act as a `jest` key in `package.json`.
#[derive(Debug, Default, Clone)]
pub struct Attributes {
    pub generated: Vec<String>,
    pub vendored: Vec<String>,
}

/// Enough of a gitattributes pattern to be useful and no more.
///
/// **Deliberately not a glob engine.** The patterns that matter in practice are a directory
/// prefix (`vendor/**`), a suffix (`*.pb.go`) and a literal path, and a partial
/// implementation that quietly mismatches the rest would be worse than one that says what it
/// handles. Anything with a `?` or a bracket is left alone rather than half-matched.
fn glob_ish(pattern: &str, path: &str) -> bool {
    let p = pattern.trim_start_matches('/');
    if p.contains('?') || p.contains('[') {
        return false;
    }
    match p.split_once('*') {
        None => path == p || path.starts_with(&format!("{}/", p.trim_end_matches('/'))),
        Some((head, tail)) => {
            let tail = tail.trim_start_matches('*').trim_start_matches('/');
            path.starts_with(head) && (tail.is_empty() || path.ends_with(tail))
        }
    }
}

/// Does this path match any test convention we know, for any language?
///
/// Exposed because `scan::declared` needs exactly this question and must not answer it with a
/// second copy: a repo is reported as having no tests only when nothing here looks like one,
/// so a pattern in one list and not the other is a repo silently mis-declared.
pub fn looks_like_a_test(lang: Lang, path: &str) -> bool {
    contract_of(lang, path, false).map(|t| t.is_test).unwrap_or_default()
        || convention_of(lang, path).map(|t| t.is_test).unwrap_or_default()
}

/// What the FUNCTION is called, for languages where a harness dispatches on the name.
///
/// **A tier on a different axis, and the only one there.** Contract, convention and silence
/// all ask about the FILE and all answer from its PATH, so a repo whose tests are marked by a
/// naming rule INSIDE a file is invisible to every one of them — no glob could ever see it.
/// ceph's standalone suite is 256 functions across 63 files, and every one of them was drawn
/// as hand-written code.
///
/// **Shell only, because shell is where the name IS the dispatch.** `qa/standalone/*.sh` ends
/// each file with a `run` that enumerates its own functions and calls every match:
///
/// ```sh
/// local funcs=${@:-$(set | sed -n -e 's/^\(TEST_[0-9a-z_]*\) .*/\1/p')}
/// for func in $funcs ; do $func $dir || return 1 ; done
/// ```
///
/// Rename `TEST_foo` to `foo` and it silently stops being run. shunit2 dispatches on the same
/// shape, so this is a shell idiom rather than one project's habit. Every other language here
/// either has a real contract or answers from the path, and a Python function called
/// `test_thing` outside a collected file is not one — `convention_of` returns `Some(false)`
/// there, which stops this being reached at all. The `_ => None` languages are the only ones
/// that fall through, which is exactly the set this should be asked about.
///
/// **Positive evidence only, so a miss is `None` rather than `Some(false)`.** This is the one
/// tier that is asymmetric and it has to be: a shell function NOT called `TEST_*` is very
/// often test support — `setup`, `teardown`, `add_something` — and answering "not a test" for
/// those would be reading a naming rule's silence as a statement, which is the mistake this
/// whole file is written against. It says a thing IS a test, or it says nothing.
///
/// **Convention and not Contract**, though the argument for Contract is real: the prefix is
/// load-bearing, the harness breaks without it. What is missing is that nothing READ the
/// dispatch — recognising that `sed` line would be fitting this to one repo. A name is what
/// can be seen, and a name is a convention.
fn named_of(lang: Lang, name: &str) -> Option<Testness> {
    let dispatched = match lang {
        Lang::Shell | Lang::Zsh => {
            name.starts_with("TEST_") || name.starts_with("test_")
        }
        _ => false,
    };
    dispatched.then_some(Testness { is_test: true, how: Tested::Convention })
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
        // `_test.ts` is Deno's spelling and `.test.ts` is jest's; a repo using the first
        // and declaring nothing was reported as having no tests at all until a fixture
        // caught it. Both, and the same for `spec`.
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => guess(
            [".test.", ".spec.", "_test.", "_spec."].iter().any(|m| file.contains(m))
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

/// The file name without its directory or extension — what a module-qualified call spells.
fn stem_of(path: &str) -> &str {
    let file = path.rsplit_once('/').map_or(path, |(_, f)| f);
    file.split_once('.').map_or(file, |(stem, _)| stem)
}

/// Whether a definition can be NAMED from the file doing the calling.
///
/// **A refusal on evidence, never a guess.** [`crate::parse::FuncDef::exported`] is `None`
/// wherever the language does not say — Python exports everything and marks nothing, C++ has no
/// module system a parse can see — and `None` reaches everything. A `Some(false)` is a fact
/// about what the compiler or the module system would allow, which is the same footing as
/// `#[cfg(test)]` and not the same as a guess about a receiver.
///
/// **Free functions only, deliberately.** A method's reachability belongs to its type: a JS
/// class method carries no `export` of its own, and refusing on that would strike out every
/// cross-file receiver call in a repo. Refusing an edge is cheap and inventing an absence is
/// not, and this is the side of that line to be on.
///
/// The scope a private name reaches differs per language, and that IS the rule:
/// - **Rust**: the module tree. `src/a.rs`'s private `f` is reachable from `src/a/b.rs`.
/// - **The JS family**: the file, and nothing further.
/// - **Go**: the package, which is the directory.
///
/// Measured on this repo before it existed: 113 edges, 11.4% of the checkable cross-file ones,
/// including a private `fn git` holding 23. See `links::tests::wiring_audit`.
fn reaches(d: &Def<'_>, caller: &Caller<'_>) -> bool {
    if d.owner.is_some() || d.exported != Some(false) || d.site.0 == caller.file {
        return true;
    }
    match d.lang {
        Lang::Rust => d
            .path
            .strip_suffix(".rs")
            .is_some_and(|stem| caller.path.starts_with(&format!("{stem}/"))),
        Lang::Go => d.dir == caller.dir,
        // **A known limit, stated rather than hidden.** `function f(){}` exported later by
        // `export { f }` reads as unexported here, because only the declaration's own ancestors
        // are inspected. That form appears nowhere in this repo, and the failure it would cause
        // is a refused real edge — so if it starts appearing, `wiring_audit` is the wrong
        // instrument to notice it and a function losing its last caller is the right one.
        _ => false,
    }
}

/// Where a call was written from — the facts every tier asks about the CALLER.
///
/// Bundled rather than passed one by one: the visibility rule needs the calling file's path as
/// well as its index and directory, and nine positional arguments is both a clippy error and a
/// signature nobody can read at the call site.
struct Caller<'a> {
    file: usize,
    dir: &'a str,
    /// The calling file's own path, for the languages whose visibility scope is not the file —
    /// Rust's is the module tree, so a child module may name what its parent keeps private.
    path: &'a str,
    /// The owner of the body making the call, which is the one receiver type that can be
    /// known: `self` is whatever this is defined in.
    mine: Option<&'a str>,
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
fn resolve(
    defs: &HashMap<&str, Vec<Def<'_>>>,
    call: &crate::parse::Call,
    fam: u8,
    caller: &Caller<'_>,
    owners: &HashSet<&str>,
    modules: &HashSet<&str>,
) -> Vec<Site> {
    let Some(all) = defs.get(call.name.as_str()) else { return Vec::new() };
    // Visibility is applied BEFORE the tiers rather than inside them: a name this file cannot
    // reach is not a candidate the locality rules should get to weigh, and filtering here means
    // the owner, file, directory and repo-wide tiers all work on the same honest set.
    let same_family: Vec<&Def<'_>> =
        all.iter().filter(|d| d.fam == fam).filter(|d| reaches(d, caller)).collect();
    if same_family.is_empty() {
        return Vec::new();
    }

    let (through, qualifier) = match &call.via {
        crate::parse::Via::Free => (false, None),
        // **`super::f()` and `crate::f()` name a SCOPE, not a receiver.** There is nothing to
        // resolve the qualifier against and nothing to refuse: they say "the same crate,
        // further out", which is what a bare name already means here. Read as an unnameable
        // receiver they were thrown away — and `super::thing()` is precisely how a Rust unit
        // test calls the thing it tests, so `parse.rs`'s `forks_at` read as reached by no test
        // while two tests called it by name, four lines apart.
        //
        // `self` and `Self` are NOT in this list: they name the enclosing type, which is a
        // real and knowable receiver, and they are resolved as one below.
        crate::parse::Via::Path(Some(q)) if q == "super" || q == "crate" => (false, None),
        crate::parse::Via::Dot(q) | crate::parse::Via::Path(q) => (true, q.as_deref()),
    };
    // **`self` is the one receiver whose type is knowable**, and it is knowable exactly
    // because it is not a lookup: the body doing the calling is defined in something, and
    // `self.f()` means that something's `f`. `this` and `Self` are the same word in the other
    // languages read here.
    let named = match qualifier {
        Some("self" | "this" | "Self") => caller.mine,
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

    // **Its own file, even through a receiver this repo cannot name.** An impl and the code
    // using it do sit together, and closing this tier cost the thing it was closed to
    // protect: every method of `impl Environment for ManagedEnvironment` read as untested
    // while the tests calling `env.install(…)` sat beside them in the same file.
    //
    // It was closed because `cursor.walk()` in `parse.rs` landed on that file's test-only
    // `walk`. That is now refused where it belongs — in `wire`, on the ground that a body
    // outside `#[cfg(test)]` cannot call one inside it, which is a fact about what the
    // compiler builds rather than a guess about a receiver.
    //
    // Worth knowing how sharp the old edge was: whether `env.install(…)` resolved depended on
    // whether some file in the repo happened to be named `env.rs`, because that would make
    // the receiver a module name and reopen every tier. An accident of naming deciding a real
    // edge is worse than either answer.
    let here: Vec<Site> =
        reachable.iter().filter(|d| d.site.0 == caller.file).map(|d| d.site).collect();
    if !here.is_empty() {
        return here;
    }
    // Past its own file an unnameable receiver has nothing left to offer: repo-uniqueness is
    // evidence about a NAME and none at all about a type. `as_str`, `lock` and `count` are
    // each defined exactly once here and each collected every standard-library call spelled
    // the same way.
    if !local {
        return Vec::new();
    }
    let near: Vec<Site> =
        reachable.iter().filter(|d| d.dir == caller.dir).map(|d| d.site).collect();
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
            ncloc: 0,
            in_cfg_test: false,
            calls: calls.iter().map(|c| free(c)).collect(),
            locals: Vec::new(),
            // `None` is "the language does not say", which refuses nothing — so a fixture that
            // means to test the refusal has to say `Some(false)` out loud.
            exported: None,
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

    /// **An unnameable receiver reaches its own file, and no further.**
    ///
    /// The file tier was closed for a while, because `cursor.walk()` in `parse.rs` landed on
    /// that file's test-only `walk` and put 19 callers on it. Closing it cost more than it
    /// saved: every method of a trait impl read as uncalled while the tests invoking them
    /// through a variable sat in the same file. The `walk` case is refused by
    /// `a_production_body_cannot_call_into_cfg_test` instead — a fact about what the compiler
    /// builds, where this was a guess about a receiver.
    ///
    /// How sharp the old edge was is the argument against it: whether `env.install(…)`
    /// resolved depended on whether the repo happened to contain a file called `env.rs`,
    /// which would make the receiver a module name and reopen every tier at once.
    #[test]
    fn an_unnameable_receiver_reaches_its_own_file_and_no_further() {
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
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "its own file, where the impl is");
        assert_eq!(w.at(1, 0).map(|x| x.calls), Some(0), "and not the next file over");
    }

    /// **A name its module does not export cannot be reached from outside it.**
    ///
    /// Measured before this existed: 113 edges on this repo — 11.4% of the checkable cross-file
    /// ones — landed on bodies the compiler would not let the caller name, `assessment.rs`'s
    /// private `fn git` holding 23 of them while every caller was some other file's own `let git
    /// = |args| …`. See `links::tests::wiring_audit`, which counts them.
    ///
    /// Each half of this asserts in BOTH directions, because a refusal measured only by what it
    /// removes cannot notice that it removed too much — the failure that cost 180 functions
    /// their last caller when the strict receiver rule was tried.
    #[test]
    fn a_private_name_is_not_reachable_from_another_module() {
        let caller = || spells("range_detail", &[free("git")]);
        let w = wired(&[
            ("src/assessment.rs", Lang::Rust, vec![FuncDef {
                exported: Some(false),
                ..def("git", &[])
            }]),
            ("src/blame.rs", Lang::Rust, vec![caller()]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(0), "another file cannot name it");

        let w = wired(&[
            ("src/assessment.rs", Lang::Rust, vec![FuncDef {
                exported: Some(true),
                ..def("git", &[])
            }]),
            ("src/blame.rs", Lang::Rust, vec![caller()]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "`pub` reaches past its own file");

        // **Rust privacy is a module TREE, not a file.** A child module may name what its
        // parent keeps private, so this is a real edge and refusing it would draw live code as
        // dead.
        let w = wired(&[
            ("src/a.rs", Lang::Rust, vec![FuncDef {
                exported: Some(false),
                ..def("helper", &[])
            }]),
            ("src/a/b.rs", Lang::Rust, vec![spells("inner", &[free("helper")])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "a child module may name it");

        // **Go's unit is the package, which is the directory.** An unexported name is visible
        // to every file beside it and to nothing further — the distinction that took the Go
        // audit from a reported 29.88% to 0.45%, all of it the harness's own error.
        let w = wired(&[
            ("internal/csi/store.go", Lang::Go, vec![FuncDef {
                exported: Some(false),
                ..def("newStore", &[])
            }]),
            ("internal/csi/node.go", Lang::Go, vec![spells("run", &[free("newStore")])]),
            ("cmd/main.go", Lang::Go, vec![spells("main", &[free("newStore")])]),
        ]);
        assert_eq!(
            w.at(0, 0).map(|x| x.callers),
            Some(1),
            "the file beside it in the package, and not the one outside it",
        );
    }

    /// **A body that defines a name calls its own, never a stranger's.**
    ///
    /// Measured rather than imagined: `web/src/lib/reportTables.ts#walk` is a 21-line
    /// module-private helper with five call sites in its own file, and it was reported with 21
    /// callers across nine files that cannot import it — every one of them a body holding its
    /// own `walk` and calling that. `parse::collect` stops descending at a function boundary so
    /// the local definition never reaches `defs`, while the call walk descends into everything
    /// and records the call. [`crate::parse::FuncDef::locals`] is what closes it.
    #[test]
    fn a_body_calling_a_name_it_defines_itself_reaches_no_stranger() {
        let mut shadows = spells("buildModel", &[free("walk")]);
        shadows.locals = vec!["walk".to_string()];
        let w = wired(&[
            ("web/src/lib/reportTables.ts", Lang::TypeScript, vec![def("walk", &[])]),
            ("web/src/components/MapArt.tsx", Lang::Tsx, vec![shadows]),
        ]);
        assert_eq!(
            w.at(0, 0).map(|x| x.callers),
            Some(0),
            "its own closure, not the module-private helper it cannot import",
        );

        // **And the refusal is about the shadowed name alone.** A fix measured only by what it
        // removes has no way to notice that it removed too much, so the same pair with nothing
        // local of that name still resolves — which is the behaviour every cross-file call in
        // two whole languages depends on.
        let w = wired(&[
            ("web/src/lib/reportTables.ts", Lang::TypeScript, vec![def("walk", &[])]),
            (
                "web/src/components/MapArt.tsx",
                Lang::Tsx,
                vec![spells("buildModel", &[free("walk")])],
            ),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(1), "nothing local shadows it here");
    }

    /// **A body outside `#[cfg(test)]` cannot call one inside it**, because the compiler does
    /// not build that code. Not unlikely — impossible, which is the only kind of thing that
    /// can rule out a name collision without guessing at a receiver.
    ///
    /// This is what `parse.rs` needed: a test-only `walk` collecting every `cursor.walk()`
    /// written in production code in the same file. Refusing it here leaves the file tier
    /// open for the trait impls that need it.
    #[test]
    fn a_production_body_cannot_call_into_cfg_test() {
        let w = wired(&[(
            "src/parse.rs",
            Lang::Rust,
            vec![
                // A test-only helper, and a production body that writes the same name against
                // something else entirely.
                test_fn("walk", &[]),
                spells("collect", &[dot("cursor", "walk")]),
                test_fn("covers", &[dot("cursor", "walk")]),
            ],
        )]);
        assert_eq!(
            w.at(0, 0).map(|x| x.callers),
            Some(1),
            "only the caller that is itself excluded from the build",
        );
        assert_eq!(w.at(0, 1).map(|x| x.calls), Some(0), "production reaches nothing sealed");
    }

    /// **`super::f()` names a scope, not a receiver**, and is how a Rust unit test calls the
    /// thing it tests. Read as a receiver nothing can name, every one of those edges was
    /// thrown away: `parse.rs`'s `forks_at` reported that no test reached it while two tests
    /// called it by name four lines apart.
    #[test]
    fn super_and_crate_are_scopes_rather_than_receivers() {
        let scoped = |q: &str| crate::parse::Call {
            name: "forks_at".to_string(),
            via: crate::parse::Via::Path(Some(q.to_string())),
        };
        let w = wired(&[(
            "src/parse.rs",
            Lang::Rust,
            vec![
                def("forks_at", &[]),
                test_fn("covers_forks", &[scoped("super")]),
                test_fn("covers_again", &[scoped("crate")]),
            ],
        )]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(2), "both tests reach it");
        assert_eq!(w.at(0, 0).map(|x| x.under_test), Some(Some(true)));
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

    /// **"A test calls this" is an existential claim, and its absence is stated as one.**
    ///
    /// `Some(true)` means we found a test that calls it. `Some(false)` means test code is
    /// separable here and none of its callers is one. `None` means we cannot tell tests apart
    /// at all — and that must never render as "no test calls this", which is the whole reason
    /// it is three states.
    /// **A test reaches what its callees reach.** `a` is called by a test, `b` by `a`, `c` by
    /// `b` — and `c` calling `a` back is a cycle the walk terminates on rather than a case.
    /// Only `lonely`, which nothing reaches, stays false.
    ///
    /// The first version of this counted DIRECT callers, which drew every accessor under a
    /// tested entry point as untested. It was defended on the grounds that a closure reaches
    /// nearly everything; measured, it saturates near a third — see
    /// `links::reach_depth::how_far_do_tests_reach`.
    #[test]
    fn a_test_reaches_what_its_callees_reach() {
        let w = wired(&[(
            "src/a.rs",
            Lang::Rust,
            vec![
                def("a", &["b"]),
                def("b", &["c"]),
                def("c", &["a"]),
                def("lonely", &[]),
                test_fn("exercises", &[free("a")]),
            ],
        )]);
        for (i, name) in [(0, "a"), (1, "b"), (2, "c")] {
            assert_eq!(
                w.at(0, i).map(|x| x.under_test),
                Some(Some(true)),
                "`{name}` is reached through the chain",
            );
        }
        assert_eq!(w.at(0, 3).map(|x| x.under_test), Some(Some(false)), "nothing reaches it");
    }

    /// **A vitest suite tests what it calls**, parsed rather than built: its tests are anonymous
    /// callbacks, and until they were units every call inside one was dropped — sewcrates' four
    /// tiering functions were each called five times by a test file and none was under test.
    #[test]
    fn a_js_runner_test_is_a_caller_and_not_a_dependent() {
        let app = crate::parse::parse_functions(
            Lang::TypeScript,
            "export function tier(id: string) { return id.length; }\n",
        );
        let suite = crate::parse::parse_functions(
            Lang::TypeScript,
            "import { tier } from './tiers';\ndescribe('tier', () => {\n  it('counts', () => {\n    expect(tier('ab')).toBe(2);\n  });\n});\n",
        );
        let w = wired(&[
            ("web/src/tiers.ts", Lang::TypeScript, app),
            ("web/src/tiers.test.ts", Lang::TypeScript, suite),
        ]);
        let tier = w.at(0, 0).expect("wired");
        assert_eq!(tier.under_test, Some(true), "the test reaches it");
        assert_eq!(tier.callers, 1, "and is counted where the lens paints");
        assert_eq!(tier.dependents, Some(0), "but depends on nothing");
    }

    #[test]
    fn under_test_says_a_test_calls_this_and_not_that_it_is_covered() {
        let w = wired(&[(
            "src/a.rs",
            Lang::Rust,
            vec![
                def("covered", &[]),
                def("lonely", &[]),
                test_fn("exercises", &[free("covered")]),
            ],
        )]);
        assert_eq!(w.at(0, 0).map(|x| x.under_test), Some(Some(true)), "a test calls it");
        assert_eq!(w.at(0, 1).map(|x| x.under_test), Some(Some(false)), "and none calls this");

        // A language where test code cannot be told apart says nothing rather than "no".
        let cc = wired(&[(
            "src/a.cc",
            Lang::Cpp,
            vec![def("helper", &[]), def("run", &["helper"])],
        )]);
        assert_eq!(
            cc.at(0, 0).map(|x| x.under_test),
            Some(None),
            "not `false` — that would be a finding asserted about code nobody could classify",
        );
    }

    /// **The four things a repo is made of, and what says so.**
    ///
    /// A generator's banner is the strongest contract available anywhere in this file: the
    /// tool that wrote the file asserting that editing it is pointless. `.gitattributes` is
    /// the other, and it is a declaration in exactly the sense a `jest` key is — the author
    /// writing down what a path holds. Everything below is a path, and a path is a habit.
    #[test]
    fn a_repo_is_made_of_four_things_and_says_which() {
        let none = Attributes::default();
        let banner = "// Code generated by protoc-gen-go. DO NOT EDIT.\n";
        assert_eq!(
            kind_of("src/api.pb.go", banner, &none).map(|k| (k.kind, k.how)),
            Some((Kind::Generated, Tested::Contract)),
            "the generator said so itself",
        );
        // Same file, no banner: the name is a convention and is labelled as one.
        assert_eq!(
            kind_of("src/api.pb.go", "package api\n", &none).map(|k| (k.kind, k.how)),
            Some((Kind::Generated, Tested::Convention)),
        );
        assert_eq!(
            kind_of("vendor/x/y.go", "", &none).map(|k| (k.kind, k.how)),
            Some((Kind::Vendored, Tested::Convention)),
        );
        // What the repo wrote down beats what a path suggests, and reaches files no
        // convention would have caught.
        let said = Attributes {
            generated: vec!["schema/*.rs".into()],
            vendored: vec!["deps/**".into()],
        };
        assert_eq!(
            kind_of("schema/tables.rs", "", &said).map(|k| (k.kind, k.how)),
            Some((Kind::Generated, Tested::Contract)),
        );
        assert_eq!(
            kind_of("deps/foo/bar.rs", "", &said).map(|k| (k.kind, k.how)),
            Some((Kind::Vendored, Tested::Contract)),
        );
        // Declarations rather than an implementation, and `.d.ts` is the contract: the
        // TypeScript compiler emits nothing for one.
        assert_eq!(
            kind_of("src/os/bluestore/BlueStore.h", "", &none).map(|k| (k.kind, k.how)),
            Some((Kind::Header, Tested::Convention)),
        );
        assert_eq!(
            kind_of("types/api.d.ts", "", &none).map(|k| (k.kind, k.how)),
            Some((Kind::Header, Tested::Contract)),
        );
        // **Nothing here places ordinary code, and that is deliberate.** This function only
        // ever reports a positive finding about a PATH; code is asserted by the caller, which
        // is the only place that knows the file parsed. A `None` from here means "none of my
        // business", never "unplaceable" and never "probably code".
        assert_eq!(kind_of("src/main.rs", "fn main() {}", &none), None);
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

    /// **A harness that dispatches on a function's NAME is invisible to every path tier.**
    ///
    /// ceph's standalone suite is 63 shell files whose `run` enumerates its own functions by
    /// the `TEST_` prefix and calls each one. Nothing about the PATH says test —
    /// `qa/standalone/scrub/osd-scrub-repair.sh` has no `test` segment — and shell has no arm
    /// in `convention_of` at all, so 256 test functions were drawn as hand-written code and
    /// their helpers counted those calls as dependents. See `named_of`.
    #[test]
    fn a_shell_harness_names_its_tests_and_the_path_never_says_so() {
        let w = wired(&[(
            "qa/standalone/scrub/osd-scrub-repair.sh",
            Lang::Shell,
            vec![
                def("add_something", &[]),
                def("TEST_auto_repair_bluestore", &["add_something"]),
            ],
        )]);
        assert_eq!(
            w.at(0, 0).map(|x| x.callers),
            Some(1),
            "a test is a caller, which is what the lens paints"
        );
        assert_eq!(
            w.at(0, 0).map(|x| x.dependents),
            Some(Some(0)),
            "and it is not a dependent — nothing here depends on the helper but the suite"
        );
        assert_eq!(
            w.tested.get(&(0, 1)).map(|t| (t.is_test, t.how)),
            Some((true, Tested::Convention)),
            "the prefix is what can be seen, so it is a convention"
        );
    }

    /// **A name that says nothing is not a name that says no.**
    ///
    /// This is the one tier that only ever answers positively, and it has to be: `setup`,
    /// `teardown` and `add_something` live in the same file as the tests and are test support.
    /// Answering `false` for them would read a naming rule's silence as a statement — and
    /// worse, it would make every shell function in every repo a decided non-test, ahead of
    /// the reader who is the only thing that could actually tell.
    #[test]
    fn a_shell_function_without_the_prefix_is_unplaced_rather_than_cleared() {
        assert_eq!(named_of(Lang::Shell, "TEST_scrub_warning").map(|t| t.is_test), Some(true));
        assert_eq!(named_of(Lang::Shell, "test_get_last_scrub_stamp").map(|t| t.is_test), Some(true));
        assert_eq!(named_of(Lang::Shell, "add_something"), None, "nobody said");
        assert_eq!(named_of(Lang::Shell, "teardown"), None);
        // Every other language either has a contract or answers from the path, and this must
        // not reach past shell: a Python `test_helper` in a production file is not a test, and
        // `convention_of` has already said so before this is consulted.
        assert_eq!(named_of(Lang::Python, "test_thing"), None);
        assert_eq!(named_of(Lang::Rust, "test_thing"), None);
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
        assert!(wire_with(&[], &none).edges.is_empty(), "empty is empty");

        // Python has no contract, so the queue asks; Rust has one, so it never does.
        assert!(!has_test_contract(Some(Lang::Python)));
        assert!(has_test_contract(Some(Lang::Rust)) && has_test_contract(Some(Lang::Go)));
        assert!(!has_test_contract(None), "a language nobody parsed answers nothing");

        // **Corroborated silence is worth skipping the question over and is NOT a contract.**
        // Two different judgements: how much we know, and whether a reader could improve it.
        // Reading a manifest that names no runner as "there are no tests" is the mistake —
        // Deno and Bun need no dependency at all — so it only ever reaches convention
        // strength, and it is consulted after a reader rather than instead of one.
        let said_no = Declarations { js: Some(Declares::NoTests), ..Default::default() };
        assert!(!has_test_contract(Some(Lang::TypeScript)), "nothing was declared");
        assert!(skip_test_ask(Some(Lang::TypeScript), &said_no), "and nothing is left to find");
        assert!(!skip_test_ask(Some(Lang::Python), &said_no), "and only for that family");
        assert_eq!(
            declared_of(Lang::TypeScript, &said_no).map(|t| t.how),
            Some(Tested::Convention),
            "an inference from two silences is not a declaration",
        );
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

