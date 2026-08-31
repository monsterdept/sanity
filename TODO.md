# TODO — a help window for the eleven lenses

**Users cannot be expected to infer our exact terms, and some of them are not inferable.**
`mundane / typical / quirky / obscure`, `clean / nuanced / tangled / unclear`, `traces to 4
commits` against `27 commits in 90d`, "too small to compare" as distinct from "no clone in
this repo" — every one of those is a deliberate distinction and none of them are guessable.

**Two things surfaced while drafting it that the window will have to handle.** The first is
that some names mislead: the lens called Age paints recency while a field called `age_days`
means what a person means by age, and the panel already prints the better words (*Last
touched*, *First seen*). The second is that Surprise is documented as needing a second axis,
and the app has no way to cross two lenses — so the help either explains that you cross them
by switching, which works only because nothing moves between lenses and is stated nowhere,
or the product answers it properly first.

**It also has to explain the units.** This app counts lines in some places and functions or
files in others — the standing decision was to explain that rather than force one unit
everywhere, and this is where the explaining goes.

---

# TODO — Blame colours by who touched it last, not by who wrote it

**The lens is not wrong; the word people read it as is.** On ceph, `Edwin Rodriguez` leads
the Authors panel — ahead of Sage Weil, who has 27,493 commits to Edwin's 56 — because of one
commit, `c8c1019d196`, "Add missing blank line after comment block": 642 files changed, 642
insertions. `Node::last_author` is `newest.author`, the author of the most recently touched
LINE, so he is the last toucher of `hello_world.cc`, `fusetrace_ll.cc`, `SimpleRADOSStriper.cc`
and everything else that sweep brushed.

**And that is TRUE.** `git blame` says the same thing; he really does hold that blame today.
The lens is called Blame and it reports blame, faithfully. What it does not report is
OWNERSHIP, which is what people open it for — and the two agree right up until somebody runs a
formatter. So this is not a bug to fix so much as a second reading to add, and a name to be
careful with.

**The legend and the panel already disagree about it in the same window.** The map's key lists
Sage Weil first, because it follows `stats.authors` — commit order over the whole log. The
Authors panel lists Edwin first, because it sorts by lines whose last toucher he is. Two
orderings of one cast, side by side, and the more prominent one is wrong.

**The data already exists and does not reach the node.** `blame.rs` computes
`RangeDetail::authors` — `Contributor { author, lines }`, most lines first — so who wrote how
much is known per range and is fetched only for a selected function. What crosses to the map
is one name.

**Two readings, and they should not be conflated.** Who owns this (most lines) and who
touched it last are different questions; the lens currently offers the second under the name
of the first. Whichever it paints, the other belongs in the panel — and "how many hands"
is a third reading again, which is the contention signal `docs/notes/time.md` records as
measured nowhere.

**The panel's rows printed one number and were sorted by another — fixed.** `sortBuckets`
orders blame by `b.lines` while the row printed `b.count`, which is why the column read
1,819 · 1,019 · 985 · 216 · 86 · 309. It shows lines now; the count moved to the row's tooltip.
**The wider inconsistency is still open**: this app counts lines in some places and functions
or files in others, and the standing decision was to explain that rather than force one unit
everywhere. That explanation is the help window, which does not exist yet.

---

# TODO — Age paints recency; what it is for is dust

**The lens is a well-built answer to the question we did not want asked.** Bright is recent,
bands run most-recent-first, and the house rule puts the loud end first — all consistent, all
pointing at "where work has happened lately", which the History view already gives you.

**Inverting it does not work and the number says so.** On ceph, 90,878 of 94,362 functions
are "older" — 96%. Dusty as a raw age reading is the default state of code, and a lens that
lights 96% of the map is saying nothing loudly.

**So Age needs a partner, not a direction**, and the candidates are already measured: old and
surprising is code nobody remembers how to read; old and heavily called is load-bearing and
unexamined; old and undocumented is the handover risk. Which one it should be is the
decision, and it runs into the same missing capability the help entry hits — nothing here can
cross two lenses. Reasoning, purposes and what Churn needs alongside it are in
`docs/notes/time.md`.

---

# TODO — Clones should report near-copies, not only exact ones

**The finding it cannot currently make is the one people have.** `clones.rs` matches exact
after normalisation — identifiers and literals flattened, comments dropped — and says so:
"a copy one statement apart is NOT [caught], and there is no threshold to tune that would
catch it. That is the trade taken deliberately." The trade bought precision, and it costs the
common case: the twelfth handler that drifted by a line.

**The threshold that objection says does not exist has been written and calibrated for years.**
`heuristic::distinctiveness` is `1 - linmap(max jaccard over 3-gram shingles, 0.08, 0.55)`,
with the band measured and a stated reading — "above 0.55 overlap it is the same function".
So the missing tier already has a similarity measure and a defended cut-off.

**What it does NOT have is scope, and that is the actual work.** Distinctiveness compares a
function against same-file peers, or the directory's when a file holds one function
(`scan.rs`, `Fidelity::Full` branch). Clones is repo-wide by construction: one hash per
function, grouped by hash, O(n). Fuzzy repo-wide is neither — all-pairs Jaccard over a
repo's functions is quadratic, which is why the exact-hash version was the one that shipped.
Doing this properly means MinHash or another LSH over the existing shingles, and that is a
design decision rather than a wiring job. **Do not estimate it from the file-local cost.**

**Nothing computes distinctiveness today.** The app scans at `Fidelity::Ordering`, where the
term returns `UNDECIDED` outright; `Fidelity::Full` was reachable only from the headless
scorer, and that was deleted along with the local model. Both remaining callers are in
`#[cfg(test)]`. The code is live in tests and nowhere else — confirm it still measures what it
claims before building on it.

**Exact and near must stay two answers, not one count.** The lens already separates "no clone
in this repo" from "too small to compare", for the reason the whole map is built on: a
confident answer and an approximate one are different claims and a reader has to be able to
tell which they were given. A merged "7 clones" that is four certain and three maybe is the
kind of number this app exists not to print.

---

# TODO — the map is silent about what it could not read

Found while fixing a Windows CI failure, by grep and by measurement rather than by
reading — kept above the assessment pass below so that section's claim about its own
provenance stays true.

**A repo the scanner mostly cannot parse still draws a confident map.** `KeyV2` is 110
`.scad` files and 3 `.rb`. Point sanity at it and it draws the three Ruby files: a
well-formed sunburst that is wrong about 97% of the repo, with nothing on screen saying
so. This is the hazard the no-git-history warning already exists for — "a repo with no
git history gets a visible warning, never a confident-looking half-verdict" — reached
through a different door, and this door has no warning on it. Files are dropped in
`collect_files`' `filter_map` (`scan.rs:222`): no extension, or an extension
`from_extension` does not know. Nothing counts them, so nothing can report them.

**Do not report a percentage.** Measured over text files (git's own binary verdict), the
unscanned share is 30% of this repo, 37% of tally, 21% of slooth, 24% of tonepoet — and
it is lockfiles, markdown, JSON and YAML almost everywhere. None of that has a function
unit, and markdown already reaches the metric through the prompt. A headline "30%
unmeasured" would be a frightening number that means nothing, which is the same sin as a
term claiming confidence it hasn't got, run in reverse.

**Report the shape and let the reader judge.** Count dropped files by extension in
`collect_files` — those entries are already walked and discarded, so it is a tally and no
extra I/O — and surface it as a list, not a verdict: `unparsed: [{ext, files}]` on
`ProjectSummary` and in `sanity_open`'s `shape`. "110 `.scad` files not parsed" supports a
decision; "30% unscanned" does not. Same division of labour `.sanityignore` already uses:
mechanism here, judgement from the reader, decision with the person. A threshold-triggered
banner for the acute case (unparsed kinds dominate the repo) is the one part that needs a
number argued for, and it is unargued.

**Nothing can currently tell you which grammar is worth adding.** Across the 60 repos in
`~/projects`, the unscanned kinds that do have a function unit are `.erb` (334 files),
`.scad` (110) and `justfile` (19). That list had to be assembled by hand from outside the
tool, and the tool is the thing that should know.

**Six grammars were compiled into the binary and never wired up** — `v`, `matlab`, `hcl`,
`make`, `nickel`, `fsm`, all from the batch in `8f0d1f0`, none with a `Lang` variant or a
`from_extension` entry. `tree-sitter-v`'s `build.rs` shells out to `ar`, which MSVC does
not have, so an unused dependency broke Windows CI for five commits. Removed. `fsm` is the
one with no recorded rationale — if an FSM grammar was intended, that line was the only
reminder and it is gone now.

---

# TODO — findings from the full assessment pass

Everything here came out of one complete reading of this repo: 613 of 613 functions,
assessed cold, one at a time, by ~62 readers over six waves. Nothing in this file was
found by grep or by review; each line is something a reader hit while predicting a
function it had never seen.

Repo-wide at the close of that pass: **predicted** 314 full / 268 most / 31 some / 0 none ·
**legible** 550 full / 62 most / 1 some / 0 none · **documented** 145 / 145 / 47 / 276 ·
**21 traps** · 165 docs graded derivable · 531 of 613 self-reported cold · `by_position`
flat across all ten buckets.

File:line references were correct at the time of the reading and predate the edits made
after it. Re-locate before acting.

---

## 1. The instrument is lying to its own readers

**`parse::leading_doc` over-collects, and it corrupts grades rather than missing them.**
Nine readers independently reported being handed a doc block belonging to the function
*above* the one they were predicting: `interleave_by_file` got `queue`'s doc,
`sync_theme_menu` got two paragraphs about a disk-usage deletion panel, `most_recent` got
`for_client`'s key-resolution story, `stamp_marks` got `resync_changed`'s, `sameProjects`
got `findById`'s, `heatShare` got a mid-sentence fragment continuing the comment on the
constant above it, `on_disk` got two unrelated paragraphs spliced, `apply_dir_history` got
`score_dir`'s opening, `commits_of` got `age_of`'s `None` case — for a function returning
`u32`. This is the most expensive thing on this list: an unknown share of this pass's
`documented` grades graded the wrong text, and a reader that trusted the doc predicted a
different function than the one it opened. Fix, then re-queue the affected readings.

**An edit mid-wave re-queues a function to the reader still holding it.** `WedgeTip` was
edited between one reader's positions 6 and 8; the edit expired that reader's own
minutes-old reading and handed the same function straight back to it. The second reading is
pure recall and now sits in `.sanity/` looking fresh. Staleness has no notion of "this
reader already read this in this run".

**CLAUDE.md contaminates this repo's own assessment.** Every subagent receives it, it names
specific functions and states their invariants outright, and one reader caught itself
predicting `for_client` correctly from that alone without opening the file — and said so.
`cold` only asks whether the FILE had been read, so it cannot see this. An unknown share of
the 314 `full` grades here is recall, and this repo therefore reads cooler than a stranger
would find it. Either `cold` grows a second question about the design docs, or readers run
without the project instructions.

**`by_model` is self-report and it is wrong.** One model took every reading in this pass;
the store holds three names for it (`claude-opus-4-5`, `claude-opus-4.5`, `claude-opus-5`).
Provenance to read, never evidence. Either stamp it server-side or stop collecting it.

**`sanity_open` with an explicit `repo` returned `" is not a directory"`** during this
session — the argument did not reach the handler. Worth a look; the no-argument path works.

---

## 2. Tests named for properties their bodies never exercise

Eleven more, on top of the seven already recorded in CLAUDE.md. **Two cannot fail at all:**

- `cache.rs:271` `a_cache_written_by_another_model_is_dropped_not_merged` — writes a
  `Stored` with model `"old-model"`, reads it back, asserts it is not `"new-model"`.
  Compares two literals the test wrote itself; `Cache::open` is never called. Delete the
  model filter from `open` and this stays green.
- `cache.rs:246` `moving_a_function_within_a_file_does_not_invalidate_it` — calls `key(...)`
  twice with byte-identical arguments. `key` takes no line number, so nothing moves; it
  proves only that the hash is deterministic. A `key` that DID embed lines would pass it.

And the rest:

- `churn.rs:338` `churn_saturates_rather_than_running_away` — `.repeat(1)`, i.e. one commit,
  then asserts only that the result is in `0..=1`. Reads like a repeat count reduced while
  debugging and never restored.
- `heuristic.rs:415` `twelve_copies_of_a_handler_are_not_distinctive` — uses two handlers,
  not twelve. Checks one duplicate pair against one novel body plus a `< 0.5` floor; the
  property named (distinctiveness falling as a template repeats across a file) is untested.
- `model.rs:760` `model_authored_text_cannot_cool_a_wedge` — named for the product's central
  claim. Body asserts `Provenance::None.weight() == 0.0` and `Source < Human`. The property
  is enforced only by the ABSENCE of a weighted model variant; add one tomorrow and this
  stays green.
- `surprise.rs:185` `predictable_code_is_cold_and_unexpected_code_is_hot` — involves no code.
  Three assertions run `calibrate_surprisal` on the bare floats 0.2, 9.0, 1.0, 3.0.
- `agentapi.rs:3384` `endpoint_reads_back_what_was_published` — never publishes and never
  parses. Builds an `Endpoint` in memory, then hand-builds JSON with `json!` from the same
  fields and asserts serde reads two numbers back.
- `agentapi.rs:3120` `a_function_that_is_gone_stops_being_offered` — never touches the
  queue. Calls `resync_changed` directly and asserts on the scan tree, so a resync that
  correctly drops the node while `queue` still hands it out would pass.
- `cli.rs:655` `an_abandoned_spawn_lock_is_taken_rather_than_blocking_forever` — its comment
  states that the original holder's drop must not release the thief's lock, then drops
  `held` and `stolen` back to back and makes one assertion. That property is never exercised.
- `scancache.rs:734` `files_no_longer_in_the_scan_are_dropped` — only ever calls `retain`
  with an EMPTY set. A `retain` that dropped everything unconditionally would pass.
- `scan.rs:1064` `parents_are_exactly_as_wide_as_their_children` — promises a recursive
  invariant; hard-indexes `root.children[0].children[0]` in a one-file fixture and checks a
  single sum.
- `churn.rs:346` `a_directory_that_is_not_a_repo_scores_without_history` — uses
  `/definitely/not/a/repo`, which does not exist. The real case (a directory that exists
  with no `.git`) is never exercised.
- `history.rs:1045` `a_history_that_was_rewritten_is_not_extended` — sets `cached.head` to
  forty zeroes, which proves refusal on an UNKNOWN head, not a DIVERGED one. The
  `merge-base --is-ancestor` path the doc describes is not what is covered.
- `assessment.rs:1017` `key_ignores_line_numbers` — compares `keys().collect::<Vec<_>>()` on
  a single-entry map, so it can only fail on the property it names by accident.
- `model.rs:640` `hot_share_composes_through_nested_directories` — both children are 50 LOC
  with one nesting level, so 0.5 is the answer whether composition is LOC-weighted or a
  mean of means. Its sibling with 100/300 is what actually pins the weighting.
- `scan.rs:992` `ordering_fidelity_changes_the_score_and_nothing_else` — never asserts the
  scores differ. Pins the "and nothing else" half only.
- `parse.rs:865` `python_docstrings_are_the_doc` — no `#` comment beside the docstring, so
  nothing would fail if the comment won the precedence the name asserts.
- `parse.rs:919`, `parse.rs:810`, `blame.rs:253`, `churn.rs:276`, `churn.rs:294`,
  `assessment.rs:1101`, `scancache.rs:...` — a softer version of the same: names that
  understate or misdescribe what the body pins, so a regression hides behind an unrelated
  failure.

**Two fixture hazards.** `assessment.rs:1219` and its neighbours name a temp dir from the
process id alone; cargo runs tests in threads of one process, and the first line is
`remove_dir_all`. Any second test choosing that name has its fixture silently deleted.

---

## 3. Traps

- `cache.rs:161` `Cache::put` — the entries map and the dirty flush counter are separate
  mutexes. A poisoned entries lock drops the insert silently while the counter still
  advances and can still trigger a flush, so a lost reading looks exactly like a saved one.
  Both `Err` branches discard with no signal, against this repo's own rule that a failed
  write is reported and never absorbed.
- `scancache.rs:358` `put_blame` — the explicit `drop(inner)` before `self.touched(...)` is
  load-bearing and unstated; `touched` takes the same lock. Folding the call inside the
  `if let` (which looks like tidying) or deleting the `drop` deadlocks or silently stops
  marking.
- `history.rs:578` `Replayer::path_idx` — `out.paths` and `out.langs` are parallel vectors
  kept index-aligned only by this one function pushing to both. Any other write to either
  desynchronises every language label downstream.
- `history.ts:188` `replay` — returns the memoised `Frame` BY REFERENCE while `advance`
  mutates it in place, so any caller holding a previous return sees it change underneath.
- `api.ts:764` `reaggregate` — its doc says it must mirror `Node::aggregate`, and three
  inline comments record separate past drifts (hardcoded `lastTouchedDays`, hardcoded
  `source: 'proxy'`, zeroed commits). Nothing binds the two implementations.
- `colorMode.ts` `bucketsFor` — in blame and language modes the bucket key is the raw author
  or language string and the absence bucket is a sentinel-prefixed key. Any key trimming or
  normalisation folds absence into a real category. (The sentinel is now an escaped ` `
  rather than a literal NUL — see §6.)
- `commands.rs:611` `edit_client` — the doc's headline rule, "only ever edits a file that
  already EXISTS", is contradicted twelve lines in by a `claude-desktop` branch that creates
  one from `{}`. Separately, `cfg[def.key] = ...` indexes a `Value` checked only for
  VALIDITY, so a config holding a valid JSON array or scalar panics instead of returning the
  careful `Err` the rest of the function is built around.
- `scan.rs:486` `score_dir` — enumerates `file.funcs` and indexes `file.prints[i]`. Nothing
  at the site enforces that the two are parallel and equal-length.
- `scan.rs:315` `scope_of` — `b.add(&path)` returns `Option<Error>` and it is discarded. A
  `.sanityignore` that exists but is unreadable produces an empty matcher that excludes
  nothing, silently widening the denominator — the wrong failure mode for a file whose whole
  job is to state what the map is claiming about.
- `parse.rs:425` `strip_comment_markers` — strips `///`, `//!`, `/**`, `//`, `/*`, `#`,
  `*/`, `*` in a fixed order and handles neither `;;` nor `--`. The repo ships Scheme,
  Racket, Common Lisp, Emacs Lisp, Clojure, Lua, Luau, Haskell, Elm, Ada, SQL and VHDL, so
  doc comments in all of those reach readers with their markers attached.
- `assessment.rs:787` `render_index` takes `&[(String, usize, usize, usize, usize)]` and
  `Compiled::row` returns the same shape. Two of the middle counters are interchangeable at
  the type level; transposing them compiles and produces a plausible, wrong table.
- `MascotFigure.tsx:130` — `seen.current` advances synchronously but the playback it accounts
  for runs a `requestAnimationFrame` later. A cleanup in between marks calls seen that never
  animate — the exact miss the sequence numbers exist to prevent.

---

## 4. Silent failures and fail-open paths

The repo's stated rule is that a term out of evidence returns UNDECIDED and a failed write
is reported. These do neither:

- `mcp.rs#project` — `.ok()` on the `PROJECT` mutex, so a poisoned lock reads as "no project
  opened" and routes the call to the backend's fallback repo. Same shape as the `cli.rs`
  idle check already fixed to fail closed.
- `heuristic.rs:196` `jaccard` — empty vs empty returns `0.0`, "maximally different", rather
  than `UNDECIDED`. The one place in that file a term is confident on no evidence.
- `heuristic.rs:359` `documented` — returns `1.0` when the body's vocabulary is contained in
  the signature, BEFORE looking at the doc at all. A trivial undocumented function scores as
  fully documented.
- `bin/scan.rs:151` `histogram` — unscored functions fold into bucket 0 via `map_or(0.0, …)`,
  so a scan where scoring failed renders as a healthy cold tail rather than missing data.
  The doc calls this histogram "the evidence that the picture means anything at all".
- `sunburst.ts#heatOf` — returns `0` for a node with no score, drawing the coolest possible
  wedge rather than undecided.
- `assessment.rs#who` — prefers `user.email`, falls back to `unwrap_or_default()`. A machine
  with no git identity writes readings with an empty `by:` and nothing marks them
  unattributed.
- `commands.rs:479` `this_exe` — `unwrap_or_default()` yields `""`, and that value is written
  into MCP client config.
- `cache.rs:208` `Cache::len` and `scancache.rs#touched` — swallow a poisoned mutex as zero /
  a no-op. Consistent with "the cache holds nothing precious", but nothing records the loss.
- `scancache.rs:471` `entry_line` — `to_string(...).unwrap_or_default() + "\n"` writes a bare
  newline into the cache log if serialization ever fails.
- `scancache.rs:481` `read_log` — returns a count of lines successfully FOLDED, not lines
  seen, so a malformed line mid-log under-reports the file's length. Check what the caller
  does with that number.
- `api.ts#mcpClients` and `api.ts#syncThemeMenu` — `.catch(() => [])` and `.catch(() => {})`
  make a failed invoke indistinguishable from an empty result.
- `bin/scan.rs:34` — `other => path = PathBuf::from(other)`, so a mistyped flag is silently
  accepted as the scan path.
- `cli.rs:582` `main` — `args[0]` and `args[1..]` both panic on an empty slice, with nothing
  in the signature saying a verb is required.
- `agentapi.rs:1767` `report` — `leased.remove(&r.id)` runs before the scan lookup and before
  `save_reports`, so a report whose write fails has already released its lease.
- `agentapi.rs:1481` `shape_of` — truncates to the top 15 directories and says so nowhere in
  the emitted JSON. An agent proposing a `.sanityignore` from `shape` cannot see what was
  dropped; structurally the hazard `peers_omitted` exists to close.

---

## 5. Docs that describe something the code no longer does

Ranked by how badly a reader acting on them would be misled:

- `assessment.rs:74` `body_hash` — the doc insists at length that the multiplier "is not
  FNV-1a's prime" and must stay wrong for stability. `0x1000_0000_01b3` IS
  `0x100000001b3`; only the underscore grouping disguises it. Wrong in the dangerous
  direction: acting on the doc would expire every assessment in every repo.
- `agentapi.rs:859` `all_tasks` — says `peers` "has no bound: it is every function in the
  file, and a 400-function file sends all 400 names to every reader". It has been bounded to
  the nearest twenty in file order with `peers_omitted` for the remainder. This doc exists to
  justify why `just tokens` measures the real payload.
- `heuristic.rs:331` `calibrate` — prose says the mix occupies "roughly 0.15..0.95"; `FLOOR`
  is `0.30`. CLAUDE.md says the band is a standing measured claim, so one of the two is out
  of date.
- `parse.rs:754` `header_end` — argues at length that every case reads the grammar's own
  FIELDS rather than positional indices, because an optional piece shifts every index. The
  Scheme, Racket and Clojure arms do `named_child(1)`. Either the doc overclaims or those
  three are the bug it predicts.
- `parse.rs:490` `accepts` — "kind alone answers it everywhere except Elixir". The body
  carries eight exceptions: Elixir, OCaml, F#, R, Nix, Clojure, Scheme/Racket, Prolog.
- `parse.rs:535` `first_of_kind` — doc says "first NAMED child of `kind`"; the body calls
  `children`, not `named_children`. Harmless for the kinds passed today, and the one word
  that distinguishes the two tree-sitter APIs is wrong.
- `agentapi.rs:944` `default_n` — the doc opens "Ten readings per reader" over a function
  returning `1`. Only the final sentence resolves that the constant is the handout size.
- `agentapi.rs:498` `Grade::surprise` — doc says the steps are "not evenly spaced" with "the
  two confident steps close together". They are 0.08 / 0.30 / 0.62 / 0.92 — gaps of 0.22,
  0.32, 0.30, very nearly even.
- `Summary.tsx:331` — the docstring promises "what to do next" and "the ants stay,
  underneath". There are no ants, and an inline comment in the same function records that
  Notes replaced Next Steps. Two comments in one function disagreeing.
- `Detail.tsx#Contents` — doc says rows are "ordered by heat, not by size or name"; the body
  sorts by `rank(n, mode)`, whatever the ring is currently coloured by. The inline comment
  describes that fix; the docstring above it was never updated.
- `ColourKey.tsx#Legend` — a comment argues the ramp "spans the widget rather than sitting in
  a fixed 96px well in the middle of it", introducing `w-24`. It documents the opposite of
  the code.
- `CommitLog.tsx:89` — promises "two absolutely-positioned elements: a cursor on the current
  commit, and a scrim". Only the scrim is; the cursor is a `selected` prop on a memoised
  `Row`. Found by three readers.
- `api.ts#onScanScore` — says readings arrive "as the model produces them". There is no model
  path in the app; `OllamaModel` was removed endpoint and all.
- `api.ts#applyAgentReports` — describes a binary verdict mapped to the ends of the scale;
  the body delegates to `reportGrades` and folds in a `documented` grade.
- `api.ts#paintHeat` — doc calls it "`wedgeHeat`, with a share put on the ramp's own scale";
  the body never calls `wedgeHeat`, it re-derives the same branch. Two copies of one
  decision with the doc asserting they are one.
- `api.ts#isAnalyzed` — still accepts `source === 'model'` as a real reading.
- `api.ts#readingWords` — never mentions that `derivable: true` overrides `documented` to
  `none`, which is the line's most consequential behaviour.
- `history.ts#scoreInto` — says "every field it cannot honestly fill is left at the value
  that means no claim". True only of the freshly allocated branch; on the pooled path
  `surprise`, `documented`, `hotShare` and `analyzedShare` carry over from the last function
  to use that object.
- `history.ts#aggregate` — claims the roll-up is "LOC-weighted"; only `churn` is.
- `history.rs:480` — comment asserts a refused blob always yields an EMPTY state. A path
  whose `lang_of` returns `None` takes the `?` and leaves the batch entirely. Also only
  `MINIFIED_LINE_BYTES` is checked here; `VENDORED` is not, despite CLAUDE.md saying the two
  move together.
- `history.rs#repo_with` — doc says each commit adds a function to `src/lib.rs`; the helper
  writes `src.rs` at the repo root.
- `assessment.rs:247` `parse_shard` — says an entry missing `expected`/`found` is dropped;
  the flush keeps anything where EITHER is non-empty. Also describes the map as keyed
  `path#name` when it is keyed `key_of(path, name, ord)`.
- `assessment.rs:929`/`:936` — two inline comments about the same `gone.md` contradict each
  other; the assertion only makes sense under the second.
- `scancache.rs#seeded` — the docstring describes the test, not the helper.
- `heuristic.rs:187` `fnv` — an otherwise excellent doc ends with a paragraph about a
  `HashSet<u64>` vs `HashSet<String>` decision that lives elsewhere.
- `heuristic.rs:281` `distinctiveness` — doc says "1 − closest sibling match"; the body is
  `1.0 - linmap(closest, 0.08, 0.55)`. The calibration band is the load-bearing part.
- `PartyAnts.tsx#inkOf` — doc says it reads `--foreground`; the body reads
  `getComputedStyle(el).color`.
- `FileZoom.tsx:89` `fanOf` — eleven lines of doc over `return fanFor(from, paneAspect)`.
  Every behaviour documented lives in `fanFor`, attached to a body that cannot change with
  it. Same shape at `cli.rs:85` `take_spawn_lock` and `history.ts#warmHistory`.
- `bucketsFor` — five paragraphs of doc, none mentioning its first line:
  `if (mode === 'surprise') return []`. The one mode the map is built around produces no
  breakdown and the docs read as if it does.

---

## 6. Interfaces that invite a wrong call

- `zoom.ts:287` `viewFor` — `margin` and `chromeBottom` are FRACTIONS of the extent
  (`reach * margin`), not absolute units, and neither the signature nor the doc says so. A
  caller passing pixels is silently wrong at every zoom level.
- `churn.rs:100` `age_of` — returns a bare `f32` in DAYS. Nothing in the signature carries
  the unit; `age_days` at the field is the only hint. A reader predicted a normalised 0..1.
- `commands.rs:388` `agent_activity` — reads as "what work are the agents doing" and is a
  liveness heartbeat. `AgentPresence` would have been guessable.
- `assessment.rs#is_stale` reads `report.body`, a field holding a HASH, not source. The whole
  staleness mechanism keys on it.
- `ink.ts#srgb` assumes a full 7-character `#rrggbb` with no validation; `#fff`, a named
  colour or `oklch()` yields NaN channels silently.
- `api.ts:994` `rampAt` — reads as a colour sampler; returns `{stops, i, f}` where `stops`
  are CSS custom-property NAMES. The five-stop count is a hardcoded literal, so a ramp with
  fewer variables yields undefined properties silently.
- `assessment.rs:121` `shard_file` sanitisation is not injective: `a/b` and `a-b` both give
  `a-b.md`, and an empty shard gives `.md`. Same class at `commands.rs:292`, where the window
  label folds every non-alphanumeric to `-` so `a/b.rs` and `a-b.rs` collide and the second
  open silently focuses the wrong file, against a doc promising uniqueness.
- `assessment.rs:534` `Index::as_str` returns fixed status words for three variants and the
  raw error text for `Failed(e)`. A caller matching known words cannot tell a failure from an
  unrecognised status.
- `agentapi.rs:641` `Report::blank` defaults `derivable` to `false` while the three graded
  fields default to `None`. `false` is the "these docs said something real" answer, so a
  Markdown entry omitting the field parses as a credit rather than an absence.
- `agentapi.rs#resync_file` recomputes the name/ordinal pairing by hand rather than through
  `key_of`. Two implementations of "which twin is this", and the durable-keying rule depends
  on them agreeing.
- `agentapi.rs#aggregate` indexes the in-memory reports map by `node.id`, which embeds
  `@line` — the exact key shape the durable store avoids. Correct only while the map is
  re-keyed after every resync. Confirm that holds after `resync_changed`.
- `history.rs#functions_of` builds its key with an inline
  `format!("{path}#{owner}::{name}#{ord}")` rather than the shared helper, so the two
  spellings can drift.
- `App.tsx#ProgressStrip` — the doc says only the sentence changes when a `label` is given,
  but the unit noun is hardcoded per branch: a labelled wait always says "commits", an
  unlabelled one "functions".
- `parse.rs:554` `name_node` — the C/C++ arm and the Glsl/Hlsl/Slang arm are byte-identical
  declarator walks kept separate; a fix to one silently misses the other.
- `model.rs:92` `from_extension` matches the extension verbatim; only R carries both `"r"`
  and `"R"`. Any other uppercase spelling returns `None`. Consistent with "never guess", but
  it is a case-sensitive table and nothing says so.
- `heuristic.rs:387` — `words("parseHTTPHeader")` is pinned as `["parse", "httpheader"]`.
  Acronym runs fuse with the following word, so `HTTPHeader` and `Header` are unrelated
  vocabulary items in every overlap score downstream.
- `assessment.rs:93` `shard_of` shards by the FIRST path segment, so everything under
  `src-tauri/` is one shard. The doc explains the root-files case and never states
  top-level-vs-parent, which is what decides how many shard files a repo gets.
- `cli.rs:163` `live` returns an `Endpoint` carrying the pid the PROBE reported, not the one
  in the endpoint file — which interacts with the "release only if the file still names its
  own pid" rule and is undocumented.
- `cli.rs#summary` and the `sanity_summary` tool description disagree about what that
  endpoint returns: the description promises a derivable count, a model split, a
  later-vs-first comparison and a `note`; the formatter prints a subset.
- `history.ts#advance` deletes a function's `born` stamp on removal, so a path deleted and
  re-added is reborn at the later commit and its age resets in the replay.
- `churn.rs:156` `credit` is entirely order-dependent: `last_touched`/`last_author`/
  `last_commit` are stamped on a first-sighting test and `age_days` is overwritten every
  call, both relying on git walking strictly newest→oldest. The comments say so; nothing
  enforces it, and git's default order is not strictly date-monotonic across merges.
- `history.rs:628` — deletions and rename-sources are retired in a pass that runs entirely
  before the write pass. A commit that deletes a path and renames another onto it is correct
  only because of that ordering, which is a comment rather than an enforced invariant.
- `zoom.ts:223` `hubGeo` uses a bare `rInner - 4` that must match the circle drawn at the
  chart's middle, with nothing tying the two numbers together. Same shape in
  `CodeView.tsx:87`, where `Math.min(3, r.height / lines.length)` is computed twice — once
  to paint, once to seek — so a change to one makes clicks land off the line drawn.
- `sunburst.ts#rOf`/`vOf` share a bare `2` with nothing linking the pair, and
  `fan.ts#sectorOf` takes radii but stores `v0`/`v1`, so a `Sector` never holds the radius it
  was constructed from.

---

## 7. Where the docs are missing, not wrong

The pattern across 613 readings: **where this repo has doc comments they are excellent and
non-derivable — they carry the failure that motivated the code — and the gaps are
systematic.** 276 of 613 readings graded `documented: none`, and 165 of the rest were graded
derivable, i.e. a restatement.

The costly gaps are the load-bearing functions with no doc at all, where a stranger's only
route in is to open the file:

- `App.tsx#App` (730 lines), `Sunburst.tsx#Sunburst` (1,079 lines, at least five separable
  subsystems), `Detail.tsx#Detail` (400+), `SideBar.tsx#SideBar`, `Summary.tsx#Summary`,
  `FileZoom.tsx#FileZoom` — all with unusually good INTERNAL comments and nothing at the
  signature. `Sunburst` was the pass's only `predicted: some` from a reader who had every
  other advantage.
- `agentapi.rs#resync_changed` — the whole "changed, not new" semantics rests on
  `insert(...).is_some_and(|was| was != *m)`, and nothing in the file says a first-seen file
  deliberately does not count as moved.
- `agentapi.rs#work_left` — the empty `HashMap` passed to `collect_tasks` IS the lease bypass
  the "never report coverage off a lease-filtered list" rule demands, and it reads as a
  placeholder argument.
- `agentapi.rs#queue`, `agentapi.rs#report`, `api.ts#summarize`, `assessment.rs#render_entry`,
  `parse.rs#collect`, `parse.rs#body_node`, `scan.rs#run`, `local.rs#score_one`,
  `sunburst.ts#tileFunctions`, `sunburst.ts#sliceFunctions`, `model.rs#quadrant` — same
  shape: the decisions that matter live in inline comments, which only pay off after the
  file is open, and the doc stack is what reaches a reader BEFORE it predicts. This is the
  single highest-leverage documentation work in the repo, and by the metric's own logic it
  is what would cool the map honestly.
- `parse.rs#collect` deserves its own line: it deliberately does NOT descend after a
  successful extract, so a closure never becomes its own wedge and the enclosing function's
  line count stays honest. Nothing in the name, signature or peer list hints at it; the rule
  exists only as an inline comment.

---

## 8. Method

Two things about how this pass was run that should change before the next one:

- **`interleave_by_file` does not hold across a ten-function run.** Readers repeatedly drew
  three and four functions from `agentapi.rs`, `api.ts`, `history.rs` and `parse.rs` in ten
  draws and reported the later ones warm. The round-robin is across files; this repo's
  function mass is concentrated enough that ten draws revisit. 82 warm reports out of 613.
- **The tail of the queue is thin functions.** Several late readers reported that seven or
  eight of their ten were one-to-eight-line delegations, `invoke` wrappers and accessors —
  predictable by construction. The low surprise rate (31 of 613 flagged) is partly a fact
  about draw composition at the end of a full pass, not only about the repo.
