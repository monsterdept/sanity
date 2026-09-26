# TODO — Blame colours by who touched it last, not by who wrote it

**The lens is not wrong; the word people read it as is.** On ceph, `Edwin Rodriguez` leads the Authors panel — ahead of Sage Weil, who has 27,493 commits to Edwin's 56 — because of one commit, `c8c1019d196`, "Add missing blank line after comment block": 642 files changed, 642 insertions. `Node::last_author` is `newest.author`, the author of the most recently touched LINE, so he is the last toucher of `hello_world.cc`, `fusetrace_ll.cc`, `SimpleRADOSStriper.cc` and everything else that sweep brushed.

**And that is TRUE.** `git blame` says the same thing; he really does hold that blame today. The lens is called Blame and it reports blame, faithfully. What it does not report is OWNERSHIP, which is what people open it for — and the two agree right up until somebody runs a formatter. So this is not a bug to fix so much as a second reading to add, and a name to be careful with.

**The legend and the panel order the same cast differently, and that part is settled.** The key lists people in slot order — `stats.authors`, the repo-wide all-time cast ranked by COMMITS — because a person's colour and place must not move when you drill or when a replay runs. The panel lists them by LINES held under the cursor, because that is the row's own number. Two questions, two orders, both right; what was wrong was `sortBuckets` claiming in a comment that it matched the legend, and `History::authors` saying the ranking decided "only" the palette. Both fixed, and each now points at the other.

**What that leaves visible is a chosen cost, not a bug.** On ceph the widest band on a drilled wedge can belong to somebody the key does not name at all — Edwin has 56 commits against Sage Weil's 27,493, so he is nowhere near the sixteen named slots while holding the first row of the panel. `authorRank` argues that trade explicitly: an identity that does not move is worth more than a caption that is always about what is on screen. What a reader can now do is look it up: the Blame entry in `LensHelp` says what each of the two lists is ordered by, which was the question underneath this the whole time.

**The data for the second reading already exists and does not reach the node.** `blame.rs` computes `RangeDetail::authors` — `Contributor { author, lines }`, most lines first — so who wrote how much is known per range and is fetched only for a selected function. What crosses to the map is one name.

**Two readings, and they should not be conflated.** Who owns this (most lines) and who touched it last are different questions; the lens currently offers the second under the name of the first. Whichever it paints, the other belongs in the panel — and "how many hands" is a third reading again, which is the contention signal `docs/notes/time.md` records as measured nowhere.

**BUILT.** The hold below was a product question — "I am not sure why someone would want a tool that has both blame and this new metric. Better be sure before we build it." — and what answered it is the distinction the hold was taken without: they are not a second metric. They are two more reductions of the list blame already reads, and the third one's value is as a findings CLAUSE rather than as a colouring.

What shipped: `RangeHistory` gained `main_author` and `headcount`, `Node` carries both (`treecache` VERSION 16), Blame has a `most lines` reading beside `newest line` (first shipped as `last touched`; `Rings.tsx`'s `BlameReading` says why it was renamed), and the catalog has `sole-author` and `crowded-and-knotty` (first shipped as `one-pair-of-hands` and `many-hands-knotty`). Everything below is kept as the reasoning, and each claim now says how it landed.

Two things were established while deciding the hold, and both survived it:

- **It is not a second measurement, it is a second REDUCTION, and it is nearly free.** Both readings start from one list — every line in the range, with the name of whoever last touched it. Blame takes the newest line and reports its author; the proposal counts the names and reports the biggest pile. `FileBlame.lines` already holds that list in memory and `range` already slices it, so this is the same slice counted instead of maxed. Nothing needs a new pass and nothing needs `range_detail`, which shells out per function. *Done: `FileBlame::range` counts the slice it was already walking, into a `Vec` indexed by the file's own author index rather than a map — the index is dense and small because it is a position in that file's cast, not the repo's.*
- **Do not call it Ownership.** Blame records who touched each line LAST, so a function rewritten wholesale reads as new and everyone whose lines were replaced is gone — not diminished, gone. Counting those names measures who holds what is standing now, which is robust to a one-line-per-file sweep and no help at all against a full reformat. Real authorship over time is `git log -L`, refused here on cost like everything else in this module. The honest pair is "last touched by" and "most lines here": a timestamp and a headcount, neither of them authorship. *Done: the lens is still Blame, the reading is `most lines`, and the field is `headcount`. Author was proposed and refused for exactly this reason — it is Ownership one step along.*

**Three reductions, not two, and the `max` is not the one it sounds like.** The input is one list: every line in the range, with the name of whoever last touched that line. What differs is only what is taken from the pile.

| taken | reading | the question |
|---|---|---|
| the newest line's name | last touched | who edited this most recently |
| the biggest pile of names | most lines | whose code is standing in it |
| the count of distinct names | headcount | how many people's lines are standing here |

So today's blame is `argmax by RECENCY`, not by count, and the two can disagree completely: a typo fix in a four-hundred-line body makes somebody its last toucher while they hold one line of it. That is the distinction the hold was taken without, and having it is most of the answer.

**They are three readings of one lens, not a second metric — which is what the hold was actually objecting to.** "A tool with both blame and this new metric" is a fair objection to a second metric and not one to a second reading, and this app has already made that argument and won it twice: Age paints one of two dates and a switch says which, Tangle measures against the repo or against a published bar. So it is a pulldown beside the lens, left of the spacer with the other three, on the same rule — what it changes is what the COLOUR MEANS.

**Blame keeps its name, and the readings need no nouns.** Not Author: blame cannot see who wrote anything, so that is Ownership again one step along. "Blame" is git's word and it names the mechanism rather than making a claim, which is the honest thing for it to do. Underneath it the readings are phrases and nothing is coined —

```
Blame ▾    last touched · most lines · headcount
```

**And the RULES want none of this vocabulary, because they must not name a person.** The findings grammar already refuses paths, names and globs — rules about what a thing is CALLED rather than about what was measured — and "who wrote this" is exactly that. What the two held rules need is counts:

```
func: headcount <= 1 and callers >= 20    — load-bearing, and only one person has been in it
func: headcount >= 5 and surprise >= 0.7  — several people editing something nobody can predict
```

That is "Last hand alone" and "Many hands" with neither name, and it is the better shape: the clause is a number, and the "who" stays in the panel where it is a fact rather than a criterion. A concentration — what share the largest pile holds — is the other field worth having, and it is a share rather than a name for the same reason.

**`headcount` and not `author count`**, which is Author wearing a number: it asserts these people wrote the code, and blame cannot see that. Not "how many" either — the other two readings are things you TAKE from the pile and that one was a question, which is a different part of speech doing a different job. Headcount is this note's own word for it already, four paragraphs up: *a timestamp and a headcount, neither of them authorship*. One word in the pulldown and in the clause, because two names for one number is where drift starts.

Their value is as clauses rather than as a lens, which is the last piece of the product answer: `headcount >= 5` alone is a number of people, and a conjunction says something neither half does. What shipped pairs it with `tangle` rather than with `surprise` — surprise needs a reading pass and the count needs per-line blame, and a rule wanting both is a rule almost nobody can run. `tangle` is tier 1 and, being measured against the other bodies its size, it is the clause that stops a headcount rule from being a long-function rule in disguise: a 362-line body has more hands because there is more of it to touch. See `docs/notes/findings.md`, where the two rules and their numbers on four repos are recorded.

**One thing the build added that the argument had not:** `Traced` gained `blamed`, because a repo traced to `Depth::Files` has git in every sense the age and churn fields mean and none of the sense this one does. Without it a headcount rule on a log-traced repo finds nothing and says nothing, which is silence standing in for a clean bill — so `blocked` names the fix instead: *git history has not been read per line*.

**The panel's rows printed one number and were sorted by another — fixed.** `sortBuckets` orders blame by `b.lines` while the row printed `b.count`, which is why the column read 1,819 · 1,019 · 985 · 216 · 86 · 309. It shows lines now; the count moved to the row's tooltip. **The wider inconsistency is still open**: this app counts lines in some places and functions or files in others, and the standing decision was to explain that rather than force one unit everywhere. The help window exists — `LensHelp` — but it is a lens reference, deliberately: it was scoped to the lens entries (eleven then, thirteen now, plus a Languages tab) because carrying the drawing, the passes and the controls too pushed the row somebody opened it for below the fold. So the units explanation has a window and still has no home in it, and giving it one is a question about that scope rather than about building a window.

---

# TODO — Age paints recency; what it is for is dust

**The lens is a well-built answer to the question we did not want asked.** Bright is recent, bands run most-recent-first, and the house rule puts the loud end first — all consistent, all pointing at "where work has happened lately", which the History view already gives you.

**Inverting it does not work and the number says so.** On ceph, 90,878 of 94,362 functions are "older" — 96%. Dusty as a raw age reading is the default state of code, and a lens that lights 96% of the map is saying nothing loudly.

**So Age needs a partner, not a direction**, and the candidates are already measured: old and surprising is code nobody remembers how to read; old and heavily called is load-bearing and unexamined; old and undocumented is the handover risk. Which one it should be is the decision. It used to run into a missing capability too — nothing here could cross two lenses — and the findings catalog has since supplied that: `fossil-trap` is untouched-for-years AND a reader's trap. None of the three pairings above is a rule yet, and the lens itself still paints recency (its readings are `newest line` and `oldest line`). Reasoning, purposes and what Churn needs alongside it are in `docs/notes/time.md`.

---

# TODO — Clones should report near-copies, not only exact ones

**The finding it cannot currently make is the one people have.** `clones.rs` matches exact after normalisation — identifiers and literals flattened, comments dropped — and says so: "a copy one statement apart is NOT [caught], and there is no threshold to tune that would catch it. That is the trade taken deliberately." The trade bought precision, and it costs the common case: the twelfth handler that drifted by a line.

**The threshold that objection says does not exist has been written and calibrated for years.** `heuristic::distinctiveness` is `1 - linmap(max jaccard over 3-gram shingles, 0.08, 0.55)`, with the band measured and a stated reading — "above 0.55 overlap it is the same function". So the missing tier already has a similarity measure and a defended cut-off.

**What it does NOT have is scope, and that is the actual work.** Distinctiveness compares a function against same-file peers, or the directory's when a file holds one function (`scan.rs`, `Fidelity::Full` branch). Clones is repo-wide by construction: one hash per function, grouped by hash, O(n). Fuzzy repo-wide is neither — all-pairs Jaccard over a repo's functions is quadratic, which is why the exact-hash version was the one that shipped. Doing this properly means MinHash or another LSH over the existing shingles, and that is a design decision rather than a wiring job. **Do not estimate it from the file-local cost.**

**Nothing computes distinctiveness today.** The app scans at `Fidelity::Ordering`, where the term returns `UNDECIDED` outright; `Fidelity::Full` was reachable only from the headless scorer, and that was deleted along with the local model. Both remaining callers are in `#[cfg(test)]`. The code is live in tests and nowhere else — confirm it still measures what it claims before building on it.

**Exact and near must stay two answers, not one count.** The lens already separates "no clone in this repo" from "too small to compare", for the reason the whole map is built on: a confident answer and an approximate one are different claims and a reader has to be able to tell which they were given. A merged "7 clones" that is four certain and three maybe is the kind of number this app exists not to print.

---

# TODO — the map is silent about what it could not read

**Built since.** The walk counts what it drops by extension (`scan::Unscanned`, with `unparsed: [{ext, files}]` kept apart from `not_code` and `skipped`); `sanity_open` returns it as `unscanned`, capped at twelve rows with the remainder counted; every node carries a rolled-up `unparsed`, and the map's corner caveat (`MapCaveat.tsx`) says how many files under the current drill could not be parsed. The threshold-triggered banner below is the part not built. The record of why it is shaped this way follows.

Found while fixing a Windows CI failure, by grep and by measurement rather than by reading — kept above the assessment pass below so that section's claim about its own provenance stays true.

**A repo the scanner mostly cannot parse still draws a confident map.** `KeyV2` is 110 `.scad` files and 3 `.rb`. Point sanity at it and it draws the three Ruby files: a well-formed sunburst that is wrong about 97% of the repo, with nothing on screen saying so. This is the hazard the no-git-history warning already exists for — "a repo with no git history gets a visible warning, never a confident-looking half-verdict" — reached through a different door, and this door has no warning on it. Files are dropped in `collect_files`' `filter_map` (`scan.rs:222`): no extension, or an extension `from_extension` does not know. Nothing counts them, so nothing can report them.

**Do not report a percentage.** Measured over text files (git's own binary verdict), the unscanned share is 30% of this repo, 37% of tally, 21% of slooth, 24% of tonepoet — and it is lockfiles, markdown, JSON and YAML almost everywhere. None of that has a function unit, and markdown already reaches the metric through the prompt. A headline "30% unmeasured" would be a frightening number that means nothing, which is the same sin as a term claiming confidence it hasn't got, run in reverse.

**Report the shape and let the reader judge.** Count dropped files by extension in `collect_files` — those entries are already walked and discarded, so it is a tally and no extra I/O — and surface it as a list, not a verdict: `unparsed: [{ext, files}]` on `ProjectSummary` and in `sanity_open`'s `shape`. "110 `.scad` files not parsed" supports a decision; "30% unscanned" does not. Same division of labour `.sanityignore` already uses: mechanism here, judgement from the reader, decision with the person. A threshold-triggered banner for the acute case (unparsed kinds dominate the repo) is the one part that needs a number argued for, and it is unargued.

**Nothing can currently tell you which grammar is worth adding.** Across the 60 repos in `~/projects`, the unscanned kinds that do have a function unit are `.erb` (334 files), `.scad` (110) and `justfile` (19). That list had to be assembled by hand from outside the tool, and the tool is the thing that should know.

**Six grammars were compiled into the binary and never wired up** — `v`, `matlab`, `hcl`, `make`, `nickel`, `fsm`, all from the batch in `8f0d1f0`, none with a `Lang` variant or a `from_extension` entry. `tree-sitter-v`'s `build.rs` shells out to `ar`, which MSVC does not have, so an unused dependency broke Windows CI for five commits. Removed. `fsm` is the one with no recorded rationale — if an FSM grammar was intended, that line was the only reminder and it is gone now.

---

# TODO — the breakdown list reports the drawing, not the repo

**`0 of 10,443`.** Open kibana, take Complexity, click `very high`, and the panel names none of them: `Counted from the scan. Drill in to list them.` The COUNT is right and comes from `Cols`, the per-file summary the scan produces and ships on a file node whether or not its ring was ever fetched. The LIST is folded from function NODES, and a large repo arrives without any.

**What decides whether it can answer is the viewport, which has nothing to do with the question.** Function rings are asked for by `useWantRings` in `Sunburst.tsx`, whose test is `tilingOf` — deliberately the same predicate the render pass takes, so a file is asked about exactly when a tiling would be drawn for it and never when it would not. That is right for the map and wrong for the panel: it makes the list empty on kibana and complete on htop, so the pane is quietly reporting what got drawn. `25,217 files (43%) too thin` is the same fact from the other end.

**The precedent is `search_project`, and it was built for this exact failure.** Its own note: *asked of the backend rather than of the tree in the window ... a window holding a slimmed tree has no function names at all, so the search somebody types would come back empty on exactly the repos big enough to need one.* The bucket list has the identical shape and never got the same treatment. The backend holds the whole tree — `p.scan.root` is what `search::find` walks and what `file_functions` reads out of — so nothing needs computing that is not already in memory.

**So: a sibling command, not a change to the fetch.** `bucket_functions(key, path, lens, bucket, limit)` walks the subtree under `path`, keeps the functions whose reading lands in that band, ranks them, returns the top N. The map keeps asking for exactly what it draws.

Two things to settle first, and the second is the harder one:

- **Which lenses it can answer.** Complexity, Age, Churn, Blame and Language band off numbers the scan and the trace already hold, so the backend can do it alone. The reading lenses cannot: a grade is not a number the scan knows — it comes from `.sanity/` and is folded in the browser, which is why `Node.pending` exists at all. Either the banding moves to Rust, where it would then exist twice, or the command returns candidates and `colorMode` bands them, which puts a second definition of "very high" one refactor away from disagreeing with the map. Neither is obviously right.
- **What the order is.** A list of 10,443 needs one, and the lens does not always supply it. `very high` has an obvious ranking; `TypeScript` has none, and picking one silently makes the panel claim a rank the lens never measured.

**Do not fix this by fetching more rings.** At kibana's root that is 58,000 files of function nodes to answer a question about a list of twenty, and it would put the whole repo in the window to avoid asking the process that already has it.

**Related, and not the same thing:** `N of M` in the bucket header is honest but reads badly when N is always 0 at repo scale. If this stays unbuilt, the cheap half is to say it in words — `10,443 · not loaded` — so the fraction stops looking like a measurement.
