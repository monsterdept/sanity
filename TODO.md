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

**The legend and the panel order the same cast differently, and that part is settled.** The
key lists people in slot order — `stats.authors`, the repo-wide all-time cast ranked by
COMMITS — because a person's colour and place must not move when you drill or when a replay
runs. The panel lists them by LINES held under the cursor, because that is the row's own
number. Two questions, two orders, both right; what was wrong was `sortBuckets` claiming in a
comment that it matched the legend, and `History::authors` saying the ranking decided "only"
the palette. Both fixed, and each now points at the other.

**What that leaves visible is a chosen cost, not a bug.** On ceph the widest band on a drilled
wedge can belong to somebody the key does not name at all — Edwin has 56 commits against Sage
Weil's 27,493, so he is nowhere near the sixteen named slots while holding the first row of
the panel. `authorRank` argues that trade explicitly: an identity that does not move is worth
more than a caption that is always about what is on screen. What a reader can now do is look
it up: the Blame entry in `LensHelp` says what each of the two lists is ordered by, which was
the question underneath this the whole time.

**The data for the second reading already exists and does not reach the node.** `blame.rs`
computes `RangeDetail::authors` — `Contributor { author, lines }`, most lines first — so who
wrote how much is known per range and is fetched only for a selected function. What crosses to
the map is one name.

**Two readings, and they should not be conflated.** Who owns this (most lines) and who
touched it last are different questions; the lens currently offers the second under the name
of the first. Whichever it paints, the other belongs in the panel — and "how many hands"
is a third reading again, which is the contention signal `docs/notes/time.md` records as
measured nowhere.

**HELD, and the reason to hold it is a product question rather than a cost.** "I am not sure
why someone would want a tool that has both blame and this new metric. Better be sure before
we build it." Two things were established while deciding that, and both should survive the
hold:

- **It is not a second measurement, it is a second REDUCTION, and it is nearly free.** Both
  readings start from one list — every line in the range, with the name of whoever last
  touched it. Blame takes the newest line and reports its author; the proposal counts the
  names and reports the biggest pile. `FileBlame.lines` already holds that list in memory and
  `range` already slices it, so this is the same slice counted instead of maxed. Nothing
  needs a new pass and nothing needs `range_detail`, which shells out per function.
- **Do not call it Ownership.** Blame records who touched each line LAST, so a function
  rewritten wholesale reads as new and everyone whose lines were replaced is gone — not
  diminished, gone. Counting those names measures who holds what is standing now, which is
  robust to a one-line-per-file sweep and no help at all against a full reformat. Real
  authorship over time is `git log -L`, refused here on cost like everything else in this
  module. The honest pair is "last touched by" and "most lines here": a timestamp and a
  headcount, neither of them authorship.

**The panel's rows printed one number and were sorted by another — fixed.** `sortBuckets`
orders blame by `b.lines` while the row printed `b.count`, which is why the column read
1,819 · 1,019 · 985 · 216 · 86 · 309. It shows lines now; the count moved to the row's tooltip.
**The wider inconsistency is still open**: this app counts lines in some places and functions
or files in others, and the standing decision was to explain that rather than force one unit
everywhere. The help window exists — `LensHelp` — but it is a lens reference and nothing else,
deliberately: it was scoped to the eleven entries because carrying the drawing, the passes and
the controls too pushed the row somebody opened it for below the fold. So the units
explanation has a window and still has no home in it, and giving it one is a question about
that scope rather than about building a window.

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
