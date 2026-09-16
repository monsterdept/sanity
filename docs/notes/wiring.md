# Wiring — who calls what

Callers and Reach are drawn off a call graph built by matching NAMES. There is no type
checker here and there is not going to be one: `edges::wire` indexes every definition by
name, resolves every call against that index, and folds the result into two numbers per
function. The whole of the method is three passes and none of them are clever, which is the
point — it runs on the parse the scan already paid for.

Everything below is about the one thing that method has to get right: **refusing.**

## The top ten were the standard library

The ranking this repo drew of its own most-called functions, before any of this:

```
291 callers  new        src-tauri/src/history.rs      117 callers  path      edits.rs
277 callers  new        src-tauri/src/blame.rs        106 callers  len       blame.rs
175 callers  collect    src-tauri/src/parse.rs        105 callers  is_empty  blame.rs
```

Ten out of ten are Rust standard-library method names. `parse.rs`'s `collect` is a private
helper with **one** call site in the repo; it was reported with 175 and ranked third. The
sentence a finding built on that number reads *"A change here has to be checked against all
175"*, and it was a sentence about `.collect()`.

**The guard for this existed and was one condition short.** `resolve` already refused a
repo-wide match for a name with more than one definition — *"past that it is a common word
(`get`, `run`, `new`) and the honest answer is that we do not know"*. But `collect` is
defined exactly ONCE here, so the guard never fired, and every `.collect()` in the family
landed on it. The directory tier had the same hole one level down: `src-tauri/src` is forty
files in one directory, so every `.len()` in the backend reached whichever `len` happened to
live next door.

The failure is invisible in the way this whole project is about. Nothing crashes, no list is
empty, the numbers are plausible and they move when the code moves. They are just not about
the repo.

## The spelling is evidence; the receiver's type never was

`FuncDef::calls` deliberately drops the receiver, and that is still right: `a.render()` and
`b.render()` cannot be told apart without types, and pretending otherwise invents edges. But
dropping the receiver's TYPE is not the same as dropping the fact that **there was one**, and
which of the two was written is on the page. `parse::Via` records it. Three claims follow,
and each is a fact about the languages rather than a guess about the code:

- `xs.collect()` cannot be reaching a free function. No language read here lets you call one
  through a value.
- `Vec::new()` cannot be reaching a method of some other type.
- A receiver's own directory vouches for nothing. Locality is evidence about where a NAME was
  written, and the receiver is not the name.

So how a call was spelled decides which tiers it may use — `edges::resolve` carries the four
cases. The short form: a qualifier that names a type defined here beats locality outright; a
qualifier that names a module or file here is checked and then spent, leaving the tiers
exactly as they were (this is how Python, Go and Rust all spell a call to a free function in
another file); anything else is a call through something this repo never defined, and reaches
no further than the file it was written in.

**The file tier was the last place this hid.** The rule above first kept it: a call through an
unnameable receiver could still resolve inside the file it was written in, on the argument that
an impl and the code using it sit together. That argument fails exactly where it costs most — in
a big file that uses a common method name it also defines. `parse.rs` defines a test-only `walk`
and writes `cursor.walk()` throughout, and the finding read *19 call sites depend on this*. A
blind reviewer caught it by reading the body, which is the only way it was ever going to be
caught. So a receiver this repo cannot name now reaches nothing at all.

What the file tier was really standing in for is `self`, and `self` deserves better than
locality: it is the one receiver whose type is not a lookup, because the body doing the calling
is defined in something and that something is what `self` means. `this` and `Self` are the same
word elsewhere. Handled by name, it beats locality the way a named owner does — and it is why
closing the file tier costs 54 functions their last caller rather than the 180 the fully strict
rule cost.

**`Via::Dot(None)` is the case that kept the bug alive through the first attempt.**
`xs.iter().collect()` has a receiver with no name to check, because it ends in a paren. Read
as a bare name it went straight back to resolving repo-wide, and `collect` came out at 176 —
one HIGHER than before the fix. An unreadable qualifier is a reason to know less, never a
reason to fall back to knowing more.

## What it cost, measured

On sanity itself, the same instrument (`REPO=… cargo test --lib -- --ignored neighbours`):

| | edges | functions with a caller |
|---|---|---|
| before | 6,422 | 1,071 of 1,686 (64%) |
| after (spelling) | 3,077 | 1,046 of 1,686 (62%) |
| after (`self`, no file tier) | 2,793 | 992 of 1,705 (58%) |

**Half the call graph was noise, and it cost twenty-five functions their last caller.** That
ratio is the argument: the deleted edges were piled onto a handful of names, so removing them
barely touches whether anything is connected at all. The top ten afterwards are `data_home`,
`project_of`, `parse_functions`, `load_index`, `scan` — functions of this repo.

**The stricter rule was built and rejected.** Refusing every call through a receiver whose
qualifier this repo does not define — no file tier, no exceptions — gives 2,094 edges and 866
functions with a caller, 51%. It removes a little more noise and it costs **180 more
functions their last caller**, which the map draws as functions nothing calls. Zero callers is
the Reach lens's headline finding and a false one is the worst thing this lens does; the JSX
row in `call_sites` is in the table for the same reason. Refusing an edge is cheap, and
inventing an absence is not.

## What a test is, and who gets to say

A caller that is a test is not a dependent. Both blind reviewers of this repo worked that
out by hand and wrote almost the same sentence — *10 of the 13 call sites are its own
tests*, *the real count is two* — because the finding said **a change here has to be checked
against all 13**, and eleven of those move with the function as one edit.

So `callers` and `dependents` are two numbers. `callers` is what the lens paints and a test
genuinely is one. `dependents` is what the load-bearing rules ask for, and answering it
needs to know which code is a test.

**That knowledge has levels, and collapsing them to a boolean is what makes a metric lie.**
A number built on a bare `true` is an estimate whose accuracy is a function of how many
conventions we bothered to encode — our own diligence, presented as a property of the code.
`Tested` keeps the level, the way `Provenance` keeps four variants rather than two:

- **Contract** — the repo's author wrote it down. `#[cfg(test)]` is a declaration to the
  compiler, `_test.go` one to the go tool, a `jest` key in `package.json` one to jest. All
  three are somebody saying which code is a test, and reading a declaration is not guessing.
  **A contract answers both ways**: Rust's silence is a real `false`, which is exactly what
  lets a Rust repo skip the reader question entirely.
- **Reader** — a reader read the body and said so. Asked ONLY where no contract exists,
  because paying a sentence per reading to be told what the compiler already said buys
  nothing. It is the only source that can see a fixture living in a production file, which
  no path and no attribute reaches — and on the one real reading pass this was tested with,
  a C++ helper called `square_xs` with no assertion in it came back `test: yes`.
- **Convention** — a runner's published glob or a directory somebody named. Filenames are
  the stronger half: `foo.test.ts` was named that to match a pattern someone else wrote
  down, where a directory called `tests` is a domain noun in plenty of repos.

Contract beats Reader beats Convention, and the order is what the evidence is worth: a
contract is a fact about what ships, a reader actually read the body, a convention only ever
saw the path.

**Absence is not a level.** `None` means nobody has said, and it must never render as "not a
test". C++ has no contract at all — googletest is a library, not a build rule — so on ceph
`dependents` is `None` across the entire C++ half and the rules that ask for it go quiet
there. Honest, and a real loss of coverage; see below.

### One silence is not a statement

A `package.json` with no runner in it has not said "there are no tests" — it has said
nothing about tests. `deno test` and `bun test` are built in and need no dependency,
`unittest` is in Python's standard library, a justfile can call a global runner, and a
monorepo declares it next door. Read as a declaration, that mistake was filed at CONTRACT
strength and short-circuited both the reader and the convention: a repo with tests would
have had its `tests/` directory ignored and its tests counted as dependents, silently.

So the manifest's silence only counts when the tree is silent too — nothing shaped like a
test anywhere in that language — and even then it is `Convention`, consulted after a reader
rather than instead of one. **Being worth skipping a question over and being a declaration
are two different judgements**, and fusing them is what made this a contract in the first
place. `skip_test_ask` answers the first, `declared_of` the second.

### A reading is applied where readings live

The reader tier was an input to `edges::wire`, which runs inside `scan` — so a landed
reading changed nothing until the next scan, and while it lagged the finding went on
overclaiming. That was a layering mistake. The tree carries the parse, the paths and the
git, plus a PROXY score; readings are applied at query time, which is why the panel folds
them onto nodes and why every other reading-derived value is already live.

`links::retest_tree` is that application: one pass over `links.bin`, which is written beside
the tree precisely so the edges survive a launch that reads no source. No re-parse. The same
trade `treecache::redraw` makes when a trace lands. It runs when a reading lands and only
when that reading answered the test question at all, so a Rust or Go repo never pays it.

**It is keyed by NODE ID**, because that is what the map in hand is keyed by —
`assessment::load` resolves the durable key on the way in and hands back `live.id`. Building
`key_of` there matched nothing, and the first test written for it passed anyway, because the
fixture's keys were spelled to match the code rather than the store.

### Three detectors, and why two of them remain

`findings::not_ours` excludes test code by PATH at file level, and its rule is deliberately
more liberal than `convention_of`: it takes a bare `test/` directory in any language, where
this file refuses to guess that for C++. That is defensible rather than sloppy, because the
costs differ — pointing the instrument somewhere useless loses a finding nobody hears about,
and miscounting a dependent prints a sentence that is false. Worth unifying behind one
function with a tier argument; not worth forcing to one threshold.

`findings::in_a_test_module` asked whether an owner chain ran through a module named
`tests`. The findings population asks `Node::tested` now, which is strictly more, and the
44 functions that left this repo's population are the ones a name could never have seen:
eight `#[cfg(test)]` modules called something else — `slot_tests`, `real`, `languages`,
`kinds`, `complexity` among them. A blind reviewer had already been taken in by that gap,
reporting `parse.rs` as "already split into `languages`/`kinds`/`complexity` submodules"
when all three are test modules.

## What `dependents` costs, which is not nothing

`dependents` is `None` wherever `is_test` has no answer, and the three rules that gate on it
then do not match those subjects at all. That is the same silence `callers` has always had on a
language whose calls nobody taught it to follow — but it is a WIDER silence, and the widening
is a real cost paid for the sentence being true.

On VectorLand it is the whole repo: GDScript has no test convention worth a table entry, so
"load-bearing and undocumented" cannot be asked there at all. On ceph it will be the same, in
C++, on the largest codebase any of this has been pointed at.

And the silence is per-LANGUAGE while `blocked` is per-REPO, so a mixed repo with one Python
file among the GDScript unblocks the rule for everything and then reports a clean bill over
every body it could not ask about. `blocked` names the case where the whole repo cannot answer;
it has nothing to say about the half that cannot. Callers has carried the same hole since it
was written and the map paints it gray per node, which findings have no equivalent of.

Worth knowing before believing a quiet rule on a repo that is not Rust.

## The cap was hiding more than the resolver ever did

`MAX_CALLS` bounds how many distinct callees one body records. It was 64, and its comment said
truncation "loses edges from the one function that is already the least readable thing in the
file, which is the cheapest place to lose them."

That is exactly backwards, and a blind reviewer found it by checking a number: a finding said
`App` calls 19 things, and the body invokes 70-odd. **An edge is a pair.** Dropping App's 65th
callee does not cost App anything a reader would notice — it removes App from the CALLER count
of every function past that point. The cap is a limit on out-edges that is paid by the ordinary
functions on the other end, and it lands only on the largest, most tangled bodies in a repo,
which is the exact population every one of these rules selects for.

On this repo it drew **101 functions as called by nothing that something calls** — a bigger
false absence than any of the resolver changes above, sitting there the whole time. Raising the
cap to 2048 takes the graph from 2,797 edges to 2,967 and those 101 back.

The number is measured, over 117,495 functions in three repos:

| | p50 | p99 | p99.9 | max | over 512 |
|---|---|---|---|---|---|
| sanity | 4 | 49 | 137 | 270 (`App`) | 0 |
| VectorLand | 4 | 32 | 61 | 82 | 0 |
| ceph | 2 | 29 | 63 | **790** (`main`, `radosgw-admin.cc`) | 1 |

The median body makes four calls. The largest hand-written one anywhere is a CLI dispatcher at
790 — real code a cap of 512 would have cut in half. Dropping the cap entirely is still wrong:
it is the only thing bounding a generated file's initializer, and the list is cached per
function forever. 2048 is 2.6× the largest real body and 13× the 99.99th percentile, and costs
nothing that is not actually there.

## The third time, and the first one a verb could find

**A body defines a helper inside itself, calls it, and the call is credited to a stranger.**
`web/src/lib/reportTables.ts#walk` is a 21-line module-private helper with five call sites in
its own file. It was reported with **21 callers across nine files that cannot import it** —
`App`, `buildModel`, `countPending`, `summarize`, `opaqueShare`, `undocShare`, `bucketsFor`,
`histogramsFor`, `holdsUncommitted`, `legendFor`, `headSizes`, `frameTree`, `layout`,
`drawSvg` — and every one of those holds its own `const walk = …` and calls that.

The mechanism is two rules that were each right alone:

- `collect` stops descending the moment it extracts a function, deliberately, so a closure is
  part of its enclosing body rather than a wedge of its own. The nested definition therefore
  never enters `defs`.
- The call walk descends into everything, nested definitions included, so the CALL is
  recorded against the enclosing body.

A name defined nowhere the index can see is a name `resolve` will place somewhere else, and in
a TypeScript corpus the one top-level `walk` was globally unique, so `GLOBAL_UNIQUE` was
satisfied and every spelling of it landed there. Rust had the same disease one tier down:
`findings.rs#walk`, `search.rs#walk` and `churn.rs#walk` share a directory with five nested
`fn walk`s in `agentapi.rs`, and the `near` tier credited each of them 6-7 callers. After the
fix they report 1, 1 and their own.

`FuncDef::locals` is the close: the names a body defines inside itself, refused before
`resolve` is asked. **It is a fact about the languages rather than a guess about a receiver** —
a local definition shadows an outer name of the same spelling, so the call goes to the local
one wherever both exist. That is the same footing as `#[cfg(test)]`, and it is why this is not
the over-refusing that cost 180 functions their last caller: it removes only edges whose
target is a body the index does not hold.

**And the instrument is now in the tool.** The previous two rounds of this were caught by a
blind reviewer reading a body and checking a number by hand, which the note above says outright
was the only way it was ever going to be caught. `sanity callers <KEY>` prints the pairs the
counts are folded from, grouped by file and marking the subject's own — because "21 callers, 16
of them in files that cannot import it" is a sentence a person can refute, where "21 callers"
is not.

## The fourth one, found by the verb rather than by a person

**A private helper collects the calls of every same-named helper in the repo.** The audit's
first run on this repo reported **113 edges — 11.4% of the checkable cross-file ones —
landing on bodies the caller cannot name**: `git` holding 23, `insert` 11, `get` 10 and 10,
`key_of` 9, `f` 9. `assessment.rs`'s `fn git(repo, args)` is private, and every one of its
credited callers was some other file's own `let git = |args| …`.

`GLOBAL_UNIQUE` cannot see this, and that is the point: each of those names is defined exactly
once, so the guard against common words never fires. The directory tier then hands the call
over, because locality is evidence about where a NAME was written and says nothing about
whether the module lets anyone else say it.

**Visibility is the evidence, and it is a fact rather than a guess** — the same footing as
`#[cfg(test)]`. [`crate::parse::FuncDef::exported`] is three-state, and the absent state is the
load-bearing one: `None` means the language does not say (Python exports everything and marks
nothing, C++ has no module system a parse can see) and refuses nothing at all. Read off a real
parse, because the three that DO say, say it in three different places:

| | where it is written | scope a private name reaches |
|---|---|---|
| Rust | `visibility_modifier` inside `function_item`, so the signature carries it | the module TREE — `src/a.rs`'s private `f` is reachable from `src/a/b.rs` |
| JS family | an `export_statement` WRAPPING the declaration, invisible to the signature | the file, and nothing further |
| Go | nothing at all; the initial capital is the rule | the package, which is the directory |

Applied before the tiers rather than inside them, and to FREE FUNCTIONS only: a method's
reachability belongs to its type, a JS class method carries no `export` of its own, and refusing
those would strike out every cross-file receiver call in a repo.

**What it cost, measured.** Contradicted edges went to zero on every repo that can be checked —
sanity 113 → 0, tonepoet 59 → 0, styx 2 → 0 — for 105 edges on sanity and five functions losing
their last caller. All five were read by hand and all five were wrong before: a private axum
handler that is routed rather than called, a check script's `main()` invoked from module-level
code, and three private helpers whose callers each held a closure of the same name.

**One of those five is the argument for having both fixes.** `findings.rs`'s private `yes` was
credited to `edges.rs`, which holds `let yes = |is_test| …` — a Rust CLOSURE, which
`func_kinds` does not index, so `FuncDef::locals` structurally cannot see it. Shadowing catches
what visibility cannot when the callee is exported; visibility catches what shadowing cannot
when the shadow is a closure the parse does not record. Neither is a superset of the other.

**And the harness found its own bug first.** Its opening run reported 29.88% of Go's checkable
edges as contradicted, naming `rollbackCmd`, `publishCmd` and `devboxForTesting` — all
unexported names called from files beside them in the same package, which is ordinary Go. A
file is not the unit of visibility in every language, and reading it as one made the audit
commit the exact error it exists to catch. Package-aware, the real number is 0.45%.

### A file is only file-private if it is a MODULE

**The first cut of the visibility rule invented 28 absences, in the direction this note keeps
warning about.** Reading "no `export` on the declaration" as "not reachable" is right for an ES
module and wrong for a classic script: a page of `<script>` tags shares one global scope, so a
component defined in one file is nameable from the next without anything being exported.

Both repos on hand that have such files are design mocks — VectorLand's three
`docs/design/.../*.jsx` beside a standalone HTML page, fussystuff's `docs/answer-design/*.jsx` —
and every one of them is `import=0 export=0`. They lost 9 and 19 edges respectively, every one
of them real, and the functions concerned were drawn as called by nothing.

So `is_module` gates the whole JS branch: a file with no static `import` and no `export`
anywhere answers `None`, which refuses nothing. **The evidence for "this name is private" is not
the absence of a keyword — it is the presence of a module system to be private within.**

The cost of being wrong in each direction is the same asymmetry as everywhere else here: a
missed refusal leaves an inflated count that the audit will find, and a wrong refusal draws live
code as dead, which nothing will.

### A refusal can ADD an edge, and the count is not monotone

**ceph went 249,256 edges → 249,066 with the shadowing rule → 249,088 with visibility as well.**
The second fix removed edges and the total went UP by 22, which looks impossible and is not.

`resolve` refuses a repo-wide match for a name with more than one definition — past that it is a
common word and the honest answer is that we do not know. Filtering an unreachable candidate out
of the set BEFORE the tiers can take a name from two candidates to one, and one satisfies
`GLOBAL_UNIQUE`. A call that was previously refused as ambiguous now has exactly one definition
it could possibly mean, and resolves.

That is the right answer — a candidate the module system would refuse was never a real
alternative, and pretending it made the name ambiguous is the same overclaim one level up — but
it means **"edges removed" is the wrong thing to measure a refusal by.** What to watch is
functions losing their LAST caller, which is the failure that draws live code as dead, and that
number is monotone in the direction it matters.

## What it still cannot do

`project.scan()` from another file is a real edge and it is now dropped: the receiver is a
variable, and nothing here knows its type. That is the same answer `resolve` has always given
a name it cannot place, and it is the honest one — but it is an undercount, and the numbers
are still only ever to be read as *roughly how wired is this*.

Two smaller edges of the rule, both deliberate:

- A Rust `mod` is an owner (see `OWNER_KINDS`), so a free function inside one is reachable
  through a dot. That is a handful of functions and the alternative is a second, weaker copy
  of `owner_of`'s judgement.
- The module set is file stems across the whole repo rather than per family, so a `parse.ts`
  makes `parse` a plausible qualifier for Rust too. It only ever loosens a refusal back to
  the behaviour that shipped for months, which is the safe direction.

## Changing any of this

`FuncDef::calls` is cached, so a change to what a call RECORDS moves two numbers in the same
commit — `parse::PARSE_VERSION` and `scancache::FORMAT_VERSION` — and the second one matters
more than it looks: the field kept its name when it changed type, so the field-list guard in
`scancache`'s tests cannot see it. A version-7 entry decodes its call list as an EMPTY one,
and a function that calls nothing is a sink under Reach. `treecache` keys on `PARSE_VERSION`
and needs nothing of its own. No reading expires — `reading_hash` covers the header, the doc
and the body, and how a call was spelled is none of them.

`FuncDef::locals` moved the same two for the same reason — `PARSE_VERSION` 11→12 and
`scancache::FORMAT_VERSION` 9→10 — and there the field-list guard in `scancache`'s tests DOES
see it, because the field is new rather than merely retyped. It fails until the list is updated
by hand, which is the acknowledgement the bump is supposed to cost somebody.

`treecache::VERSION` moved too, 28→29. It keys on `PARSE_VERSION` and so would have been
invalidated anyway; the bump is there because the rule is that a change to `resolve` moves it,
and a rule that is skipped whenever somebody works out it was redundant this time is not a rule.
What a warm version-28 tree holds is the old call graph — `reportTables.ts#walk` banked at 21
callers where it has five — and nothing about the records changed shape, so it would serve them
in silence. No reading expires: `reading_hash` covers the header, the doc and the body, and what
a body defines inside itself is none of them.
