# Findings: what the map is telling you to do

**Most of this is built.** `findings.rs` is the evaluator, `just findings` is the bench, and
the panel, the badge and the decision store are in the window; the per-rule settings rows are
still a design. Everything from *What the evaluator found* onwards is a record like any other
note here, and everything before it is the proposal those measurements were taken against —
kept in that order because the arguments came first and several of them were wrong.

**They were called leads until the panel had been looked at.** Nothing durable moved with the
rename: `.sanity/rules.md` and `.sanity/decisions.md` key on rule ids, which are not prose.

## The question this answers

"I see all this, I understand it — so what. What can I DO with this."

The map is an excellent instrument for finding a single-lens extreme: the hot wedge is
visibly hot. What no reader can do is hold two lenses at once, because the map wears one at
a time and `colorMode.ts` deliberately refuses to blend them — "blending them would average
away the exact distinction they exist for". So the readings that no amount of looking will
produce are the CONJUNCTIONS. Big and baffling. Documented and still hot. Load-bearing and
unread. A clone group whose copies no longer agree.

That is what a finding is: a place where two lenses disagree in a way somebody should look at.
It is the multi-lens feature, and it arrives as a list rather than as a thirteenth colouring
because the answer to "so what" is a verb, and a colour has no verbs.

**They are findings, not issues.** The instrument does not know that anything here is wrong —
it knows a reader was surprised, that git has a date, that the parse counted callers. A word
like "issue" or "violation" claims a confidence nothing upstream of it has got, which is the
rule the whole metric is built on. A finding says look here, and says why.

## A clause is a band, never a number

A rule is a conjunction over one population:

```
WHEN a function is [Surprise: top band] AND [Callers: 20+]
```

Each clause names a lens and one of that lens's OWN bands — `CALLER_BANDS`, `AGE_BANDS`,
`CHURN_BANDS`, `TANGLE_BANDS`, `CLONE_BANDS`, `REACH_BANDS`, the same constants
`colorMode.ts` already colours the map with and `contribute` already buckets a rim histogram
into. Not a threshold the rule invents.

- **The rule and the picture cannot disagree.** A finding is matched by the same code that
  decides the wedge's colour, so "why is this a finding" is answered by looking at it. This is
  the discipline `rings.md` argues for a folded file against a drawn one, one surface over:
  two ways to bucket one population is a split brain, and the copy nobody is looking at is
  the one that goes wrong.
- **Every rule is drawable.** A rule expressed in bands can be shown ON the map — the
  matches highlighted in place — because the map already speaks that vocabulary. A rule
  expressed in raw numbers could only ever be a list beside a picture.
- **The space is finite and small.** Twelve lenses, about five bands each, at most two
  clauses. Enough to be genuinely flexible; small enough that authoring is two dropdowns
  rather than a query language. A query language is the bottomless thing this is avoiding,
  and the reason to avoid it is not scope — it is that a query language makes the reader do
  the work of knowing what is worth asking, which is the "so what" again one level up.
- **No sliders.** A slider invites the 73rd percentile, and nobody can defend 73.

Population is a function or a file — the directory case is asked and answered NO at the end
of this note. "A file with too many functions" is a file-population rule over a count band,
not a special case.

Cap the conjunction at two clauses. Three is the first number that needs precedence rules.

## Calibration is an authoring aid, never a runtime behaviour

**A percentile rule can never be satisfied, and a badge that cannot reach zero is wallpaper
inside a week.** The top 5% is always 5%; a repo somebody has cleaned still badges. So no
clause is ever repo-relative at match time.

But thresholds genuinely do not travel. Two hundred lines is monstrous in TypeScript and
ordinary in a C++ tree, and a repo nobody has committed to in two years is entirely "old".
The split is a property of the LENS, not of the rule:

- **Reading grades — surprise, legibility, docs, traps, tangle — need no calibration ever.**
  A reader scores against a fixed rubric; 0.9 is 0.9 on ceph and on a toy repo. This is the
  same portability that lets a reading be stored and compared at all.
- **Structural counts and time need it** — lines, functions per file, callers, reach, age,
  churn.

So the scan pays for the calibration once, at the moment somebody is choosing the number —
and **the target it suggests against is a COUNT, not a percentile**, which is the bench's
finding and is argued with the numbers further down:

```
Functions longer than [ 256 ] lines
                       ↑ about 20 findings here — median 11, longest 3,047
```

The distribution comes from this repo. The rule that gets SAVED is `256`. Absolute
thereafter, portable, and meetable. That is what "rules are built after the scan" should
mean: the suggestion needs a scan, the rule does not.

A percentile would be the obvious thing to suggest and it is the wrong thing twice: it
cannot drain, and it does not even hold the list length steady — 1% of kibana's functions
is 1,479 rows and 1% of htop's is 14.

The same distribution is what lets the settings page show a live match count beside every
rule, which is the only honest way to let somebody edit a threshold — otherwise they are
typing into the dark and finding out on the next open.

## Two tiers, and the tiering is the product

"Results immediately" has a hard constraint attached: **a fresh scan has no readings.** The
map is grey by design, and a rule with a reading clause has nothing to match against.

- **Tier 1 — free.** Structure, git, wiring, clones. Fires the moment the scan lands, costs
  nothing, works on a repo nobody has spent a token on. Crowded files, giant functions,
  fossils, sole authorship over load-bearing code, diverged clones.
- **Tier 2 — reading rules.** Dark until readings exist, and they do not sit silent about
  it. They announce: *four rules are waiting on readings — 3,100 functions unread.*

**Silence on unread code reads as a clean bill, and that is the one thing this surface must
never do.** The tier 2 announcement is an un-dismissable row at the head of the list with
the read button on it, carrying the same unread remainder `rings.md` describes: a file's
`loc` is the sum of its functions', so whatever no reading accounts for is code nobody has
read. Without it, a list built from three readings out of forty functions is coverage off a
filtered list, which is the failure `work_left` exists to prevent.

The tiering is not a limitation. It is the on-ramp:

> open → findings appear for free → several say *read this* → the read button is there with
> its budget estimate → readings land → the reading rules light up and the findings sharpen

Which makes the list the thing that JUSTIFIES reader budget, in specific terms about
specific functions, rather than "read your repo, it will be nice". That chain is a better
answer to "so what" than the rules are.

## A finding has verbs, or it is a second map

A list that only navigates is the sunburst with worse typography. Every row carries:

- **Drill there** — re-root the map on it. `zoom.ts` already flies rather than jumps, and
  `Find` already does exactly this motion; a finding is the same landing with a different
  reason for going.
- **Read it** — queue a reader wave scoped to these functions, budget estimate in the row.
  The list is then a reading ORDER, which is the job the proxy already exists to do.
- **Open in the editor.**
- **Dismiss, with a reason.**

## Dismissal is pinned to the body hash

A "won't fix" set once turns the list into a graveyard of stale opinions. The machinery to
prevent that already exists and is the machinery a reading uses: **a dismissal is stored
like a reading and expires like one.** Same `.sanity/`, same Markdown that is parsed back,
same `key_of(path, name, ord)` — never a node id, which embeds `@line` and has cost a
project its readings once already. Same staleness comparison against the body it was made
about, which only the backend can do.

So: you looked, you said this is fine, it goes away. Somebody edits the body, the dismissal
expires and the finding comes back — because the sentence "this is fine" was about code that no
longer exists. And the third state is not a button: **a finding is resolved by the code
changing**, which the next scan notices on its own.

The reasons people type are the most interesting thing this feature will produce. Keep them.

## The badge counts what is new, not what there is

A first scan of ceph is not four thousand problems. It is a baseline. The mascot's badge
counts findings that are NEW since the list was last opened; the cold start sets the waterline
at zero and says so.

The list underneath is ranked and deep, and on a large repo it stays deep — that is honest,
a big repo has a lot to look at. What must drain is the badge.

**Rank by lines.** Lines affected is defensible and boring, it is the axis the whole map is
already sized by, and it does not invent a severity the instrument cannot support. Ranking
by "number of rules matched" is a severity claim; two rules firing is not twice as bad.

**On the mascot rather than a bell.** It is already per-project and per-repo minted, and
"the creature that read your repo has something to tell you" is the right sentence. The one
care needed is that a badge must not fight the working states — a scanning mascot wearing a
badge is two sentences at once, so the badge is suppressed while it is working and appears
when it settles.

## Three surfaces

**1. The list.** Ranked, grouped by rule, each group headed by the rule's own sentence. A
person can use this forever without learning that rules exist. This is almost everybody.

**2. Per-rule settings.** One row per rule: on/off, its threshold with the calibration hint,
its live match count against this repo, and — where the rule is one this repo cannot vary —
the reason it is off, in words. ("Last hand alone — off. This repo has 2 contributors.")
This is "I do not care about clones, off" and "256 is too aggressive here". Per project —
the rules live in the project's `.sanity/` beside its readings, Markdown, parsed back, no
migrator, because `sanity refresh` is the whole mechanism.

**3. New rule.** Population, then two clauses, then a title and a "so what" sentence the
author writes. It is two dropdowns and a band picker.

**Built third, and FIRST.** It is last in the order somebody discovers these and first in
the order they get built, because it is not primarily a user feature — it is the instrument
the default catalog gets titrated with. A catalog can only be tuned in a grammar that can
express it, and one tuned by recompiling is one nobody tunes. So the evaluator and a text
form of it come first, as the bench:

```
just findings ceph --rule "func: loc >= 200 and callers >= 20"
```

The dropdowns are a UI over that evaluator, added once the defaults have stopped moving.
This is also what keeps the built-ins honest: they are written in the grammar because the
grammar is what they were CHOSEN in.

**The built-in rules are written in that same grammar — there is no privileged built-in
format.** That is what makes the third surface cheap: by the time somebody goes looking for
it they have read fifteen worked examples of it, because the defaults ARE the examples. A
separate internal representation for the batteries-included set would mean a rule the
builder cannot express, and the first person to try to edit one would find out.

## The default catalog, and what the bench did to it

Everything below the table was measured before any of it was built, off sanity's own scan
caches for five repos — htop (151 files), VectorLand (83), sanity (102), ceph (6,142),
kibana (59,008) — chosen to disagree with each other about size, language, age and headcount.
The bench reads `scancache` directly and applies candidate rules to every function and every
file. **Tier 1 only: there is no reading in those caches, so no tier 2 rule below has been
tested at all** and each is marked.

| Rule | Clauses | So what | Tier | Benched |
|---|---|---|---|---|
| Giant function | function, size over the band | it is several functions | 1 | yes |
| Crowded file | file, function count over the band | it is several files | 1 | yes |
| Fossil | old + long | nobody who wrote it is still here | 1 | yes |
| Many hands | file, contributor count + size | everyone has been through here | 1 | yes |
| Last hand alone | one name holds ≥90% + size | one person's, and only theirs | 1 | yes |
| Churning and long | high churn + size | it will not sit still | 1 | **no — see below** |
| Load-bearing and unread | many callers + no reading | read this one next | 1 | no |
| Big and baffling | top size band + top surprise | a split, or a doc | 2 | no |
| Stale doc | documented + still hot | the doc lies — what Docs is FOR | 2 | no |
| Hot and busy | high churn + high surprise | where the bugs are | 2 | no |
| Fossil trap | trap mark + old + no churn | old, and it bites | 2 | no |
| Diverged clone | clone group, members in different surprise bands | one copy got fixed | 2 | no |

Three things the bench changed, and one it could not answer.

### One constant cannot serve every repo — the spread is 10×

The threshold that yields a list of twenty, per rule, per repo:

| Rule | htop | VectorLand | sanity | ceph | kibana |
|---|---|---|---|---|---|
| files / functions | 151 / 1,428 | 83 / 1,871 | 102 / 1,503 | 6,142 / 113,322 | 59,008 / 147,906 |
| distinct authors | 22 | 1 | 2 | 320 | 296 |
| Giant function (lines) | 134 | 149 | 256 | **865** | **1,383** |
| Crowded file (functions) | 19 | 18 | 26 | **285** | 81 |
| Fossil (lines, ≥5y) | 21 | — | — | 235 | 109 |
| Many hands (contributors) | 11 | 1 | 1 | 66 | 31 |

A single shipped number does exactly what the spread predicts. At **200 lines**, "giant
function" is 8 findings on htop and **2,292 on kibana**. At **40 functions**, "crowded file"
is 2 findings on htop, 10 on sanity, **672 on ceph** — and 106 on kibana, which is 0.18% of its
files against ceph's 10.9%, because kibana's median file holds ONE function and ceph's holds
eight. The same rule, the same number, a top-decile finding in one repo and a rounding error
in the other.

**So the calibration target is a COUNT, not a percentile.** The suggestion offered while
somebody is choosing the number is *the threshold that gives you about twenty findings here* —
and what gets saved is the number, absolute, portable, meetable. This keeps everything the
percentile version threw away: fix the twenty and the count drops and stays down, where a
percentile rule hands you a fresh 5% forever.

Twenty is a guess at "a list a person reads to the bottom" and is worth arguing. What is
not a guess is that it has to be a count.

### A rule can be irrelevant to a repo, and the catalog should say so

"Last hand alone" fires on **40% of sanity's files and 30% of VectorLand's**, which is
correct and useless: VectorLand has one author and sanity has two, so of course one hand
holds everything. On ceph the same rule is 6% and on kibana 0.66%, where it means something.
Symmetrically, "Fossil" is empty on both young repos and finds 307 functions on ceph.

Both are the same shape: **a rule whose clause the repo cannot vary**. The fix is not a
threshold, it is relevance — decided once, at calibration, from the same distribution that
suggests the numbers, and SAID rather than hidden:

> Last hand alone — off. This repo has 2 contributors.

Off with its reason showing is honest and switchable. Silently matching everything is the
crying-wolf failure one rule earlier than the badge.

### Doc presence is not a clause, and the numbers are why

"Long and undocumented" looked like an obvious tier 1 rule. It is a near-tautology:
**83% of kibana's functions, 90% of ceph's and 95% of htop's carry no doc comment at all.**
A clause that excludes one function in ten is not narrowing anything — of the twenty longest
functions in each repo, 16 to 18 are undocumented, so the rule is "giant function" with a
rounding error and two names for one list.

This is the counting-versus-grading rule arriving from the other direction, with numbers
behind it: **documentation is graded, never counted.** Whether a doc EXISTS is nearly free
of information; whether it explains the body is the entire value, and only a reader can say.
So the rule is cut from tier 1 and lives in tier 2 as *Stale doc*, off the Docs grade.

(sanity is the exception that proves it — 25% undocumented, 7 of its 20 longest — which is
what a repo with a documentation habit looks like, and still not a reason to ship the rule.)

### Churn could not be benched, and the bench must not pretend otherwise

`scancache` holds blame, and blame carries only the LAST commit to touch each line. A
function edited ten times this quarter shows up as however many lines survive, once. The
proxy duly found 1 finding on ceph and 10 on kibana, which is not a measurement of anything —
real churn is the log walk `churn::refresh` owns, and it is not in this cache.

So both churn rules are **untested**, and are marked untested rather than being reported as
quiet. A proxy is not a measurement; two proxies have cost a wrong conclusion each here.
They get benched when the bench can read a trace.

### What the bench is, and the number to titrate against

`just findings <repo>` — the criterion is a sentence rather than a number:

> first open produces a list a person would read to the bottom

**But hit count is the wrong number to tune on, and this bench proved it.** "Long and
undocumented" scored a perfectly healthy 3,455 on kibana and was worthless, because 18 of
the top 20 were already in "giant function". A rule's hit count says nothing about whether
it earns a row in the catalog.

So the bench reports **marginal contribution**: how many findings this rule finds that no other
ENABLED rule already found, which is a number that moves as rules are toggled and is
therefore the thing to titrate against. Near zero is a second name for a list you already
have — cut it, or find the clause that makes it disagree with its neighbour.

The same number is worth showing in the settings row, beside the match count. "412 findings, 9
of them only this rule finds" is the sentence somebody needs to decide whether to keep it.

A rule that cannot pass on all five repos is not a default. It stays in the catalog, off,
which costs nothing — the catalog is where opinions go to be optional.

Blame's clause carries a caution rather than a veto: `TODO.md` records that Blame reports
who touched a line LAST, which a formatter sweep rewrites wholesale. The rule is therefore
named **Last hand alone** and not *Ownership*, because "one person owns this" is the exact
claim that note refuses to make. A count of who holds the most standing lines is the second
reduction it describes, and this rule inherits it the day it lands.

## What the evaluator found, once it was real

`findings.rs` and `just findings` are built; everything above this line was designed against a
throwaway harness over `scancache`, and this section is what changed when the same rules
ran against the actual tree. **Two implementations, agreeing to the digit** — htop's "giant
function" is 8 hits at a calibrated 134 lines from both, ceph's is 416 at 865, ceph's
"crowded file" 672 at 285 — which is the only reason the numbers above are still quoted.

The real evaluator can also ask two things the harness could not, because callers and clone
groups are resolved repo-wide after the parse and never reach `scancache`. Those two turn
out to be the answer to the worry that tier 1 is a treemap with worse typography.

### Marginal contribution is REPO-SHAPED, and that is the finding

`hits / only` — how many findings, and how many of them no other enabled rule found:

| Rule | htop | ceph | sanity | kibana |
|---|---|---|---|---|
| Giant function | 8 / **0** | 416 / **70** | 31 / 4 | 2,292 / **2,180** |
| Crowded file | 2 / 2 | 672 / 672 | 10 / 10 | 106 / 106 |
| Load-bearing, unread | 22 / 22 | **4,236 / 4,204** | 4 / 4 | 719 / 706 |
| Tangled for its size | 6 / 2 | 1,065 / 986 | 40 / 22 | 3,001 / 2,892 |
| Fossil | 32 / 25 | 1,435 / 1,036 | 0 | 30 / 19 |
| Widely cloned | 0 | **50 / 50** | 0 | 141 / 136 |

**"Giant function" is the catalog's most redundant rule and its second largest contributor,
depending on which repo you ask.** On htop every one of its eight findings was already found by
something else; on ceph it brings 70 rows out of 416; on kibana it brings 2,180 out of 2,292.
That was measured in that order, and the first two readings produced a confident wrong
conclusion — written down here as "the rule the catalog could most nearly do without" —
which the fourth repo overturned.

The mechanism is legible once the numbers are side by side. In C and C++ a long function is
usually also tangled, also old, also called from everywhere, so the rules pile onto the same
bodies and only one of them needs to fire. In kibana's TypeScript the giant things are
generated parsers, fixture objects and test suites: not tangled, not old, called from one
place. Nothing else in the catalog can see them.

**So "this rule earns nothing" is not a judgment a catalog can make once, centrally.** It is
a judgment per repo — which is the strongest argument yet for the per-project overrides in
*Three surfaces*, and it is why the marginal count belongs in the settings row next to each
rule rather than only in a note. A shipped default that were tuned to ceph would have cut the
rule that does most of the work on kibana.

**What holds across all four is the OTHER half.** "Load-bearing and unread", "widely cloned"
and "crowded file" contribute almost their whole list on every repo they can answer — 4,204
of 4,236, 50 of 50, 106 of 106. None of them is a size reading, none is drawn by a wedge's
width, and none is what a linter reports. That is the spine, and it holds where the size
rule's contribution swings by two orders of magnitude.

### The reading rules land, and one of them is redundant too

sanity has 1,599 committed readings, so tier 2 ran for the first time:

| Rule | hits | only |
|---|---|---|
| Stale doc | 112 | 93 |
| Hard to read | 58 | 16 |
| Big and baffling | 28 | **0** |

(The numbers as first run. "Big and baffling" did not survive them — see below.)

**"Big and baffling" is entirely contained in its neighbours** — every long, surprising body
on sanity is already reported as giant, or tangled, or hard to read. It is the tier 2 twin
of the same finding, and it goes the same way "long and undocumented" did: not because it is
wrong, but because it is a second name for a list somebody already has. Cut, or given a
clause that makes it disagree with something.

Titrating on hit count would have kept both of these and cut nothing. That is the whole
argument for the second column.

### Titration: what the second column changed

Compared one at a time against the shipped catalog, because **marginal is measured against
the whole ENABLED set and candidates cannibalise each other**. Four variants of one rule in
one run each make the others look worthless; the number only means something when a single
candidate is added to the defaults.

On sanity, the only repo here with readings:

| Candidate | hits | only |
|---|---|---|
| `surprise >= 0.6 and calls >= 10` | 64 | **20** |
| `surprise >= 0.6 and tangle >= 0.8` | 35 | 12 |
| `surprise >= 0.6 and callers >= 10` | 14 | 7 |
| `surprise >= 0.6 and loc >= 150` — the incumbent | 28 | **0** |

**"Big and baffling" is cut and "Surprising and far-reaching" replaces it.** Surprise against
SIZE says nothing, because size is the clause almost every other rule is already gated on —
a long surprising body is already reported as giant, or tangled, or hard to read. Surprise
against REACH is a different axis, and one no wedge draws: a function that calls out to a
dozen things and that nobody predicted is a coordinator somebody has to hold in their head.

The same test failed to improve tier 1. On ceph, both `loc >= 200 and cognitive >= 30` (290
hits) and `loc >= 200 and calls >= 20` (215 hits) contribute **zero** over "Giant function" —
they are strict subsets of it. So the weakest rule in the catalog cannot be strengthened by
conjunction, and it stays as it is: 70 rows of its own on ceph, 4 on sanity, none at all on
htop. It survives on being the rule a newcomer understands first, which is a real thing for
the row a person meets before they believe any of this.

**Every remaining rule now contributes something on the repo that can test it.**

**The churn rule has been measured, and it needed `--depth edits`.** It finds 3 findings on
sanity, 1 of them its own. The throwaway harness reported this rule as empty and was right to
refuse to call that a measurement: blame keeps one commit per line, so it cannot see a body
rewritten forty times, and only the timeline can. Its threshold reads `—` rather than a
number, which is `calibrate` saying that fewer than twenty subjects clear the other clause —
the honest answer rather than a suggestion nothing supports.

**Every tier 2 number above comes from one 104-file repo, which is thin.** It is the only
repo on hand with committed readings, and it is one I wrote — so the tier 2 catalog is the
part of this most likely to be overfitted, and the first thing to re-titrate when a second
repo has been read.

### Two rules the bench measured cannot be expressed, and are not in the catalog

"Last hand alone" and "Many hands" were in the throwaway harness because it read blame
directly. They are absent from `catalog()` and will stay absent until the tree carries what
they need: per-range contributor counts, which `blame.rs` computes into
`RangeDetail::authors` and never puts on a node. `Node::last_author` is not a substitute —
building either rule on it would make exactly the ownership claim `TODO.md` refuses to make.

### Two defects the tests caught, both of the kind this surface specialises in

Neither would have crashed anything, and both would have quietly produced a confident wrong
answer — which is the failure mode the whole note is written around.

- **`marginal` identified rules by title.** Every ad-hoc rule off the command line is called
  "ad-hoc", so two of them excluded each other from their own comparison set and each
  reported all of its hits as unique — the exact inverse of the number's purpose, on the
  number the catalog is titrated with. It is positional now.
- **`Node::funcs` is zero on a full tree.** It carries a count only for a tree `slim` has
  taken the children out of. Reading it made "crowded file" find NOTHING on a repo whose
  widest file holds 161 functions, and a rule with no hits looks precisely like a repo with
  no problem. Both have regression tests, and both were confirmed to fail without the fix.

## Where it runs

**In Rust, at scan time**, for the reason `search::find` gives at length: a big repo is
drawn from a slimmed tree, the browser holds almost none of ceph's functions, and a list
built from whatever the window happened to fetch is not an approximation — it is a confident
picture of a biased sample. It is the same failure the rim histogram was caught by, and it
would be worse here, because a finding is a claim about a specific named function.

Scan time also means findings persist, survive a window that was never opened, and can be
reported by the CLI and over MCP beside `sanity_check`.

**The cache implications are the ordinary ones and they are not optional.** Findings computed
in a scan are cached with it, so a rule edit must invalidate them — a rule set is an input
to the result the way the parser is, and a parser change is not a file change. If findings
enter `scancache::Entry` or the tree cache, the format version moves in the same commit; a
`#[serde(default)]` field on a cached record IS a format change, which is how `file_doc` cost
readers their file headers for months.

## Three questions, answered

### One project at a time, and the sidebar is the cross-repo view

**There is no combined list, and the reason is that a combined list would be ranked across
two populations matched by two different rule sets.** Thresholds are saved absolute but
chosen against one repo's distribution, so ceph's `140` and a small repo's `60` are both
"long function" and neither is comparable to the other. Rank those together by lines and
ceph owns the list forever, which is a fact about ceph's size and not about anything worth
doing.

It would also need a store outside any project, and `.sanity/` has one home, no fallback, no
mirror.

**What crosses repos is the count, on the row that already exists to carry it.** `SideBar`
says of itself that it answers "what is the state of my projects"; a finding count per
`ProjectSummary` is that question with one more term in it, and it needs no new store —
each project computes its own and hands over an integer. The mascot badge and the sidebar
row are then the same number at two zoom levels.

**Rules: shipped defaults, per-project overrides, and nothing in between.** The catalog is
code, in the binary. A project's `.sanity/` holds only what it has CHANGED — a rule turned
off, a threshold moved, a rule somebody wrote — written the first time anything is edited,
and absent until then.

Overrides rather than a copy of the catalog, and the difference matters twice: a project
that has customised one rule still receives new built-ins on the next release, and a
built-in whose shipped default improves reaches every project that never disagreed with it.
An override naming a rule that no longer exists is ignored, silently, which is the only
sensible reading of it.

**No user-level layer.** "Off in every project I ever open" is a third store that can
disagree with the other two, for a preference nobody has asked for yet. If it turns out to
be wanted, it is a layer between the catalog and the project and the precedence is obvious;
what it must never become is a place where a rule can be defined.

### A finding is a claim about HEAD, so the list is live-only

The list is hidden during a replay and says why, which is the panel `Find` already renders
for the same reason.

**The tempting version is a partial one, which makes it the dangerous version.** A frame
carries `churn`, `ageDays`, `commits`, `lang` and a replayed Complexity, so several tier 1
rules genuinely could be matched at frame N — and every reading rule could not. A list that
runs the half of the catalog that happens to be replayable is silence standing in for a
clean bill, on a surface whose entire discipline is that silence must never do that. It is
also the sin `history.rs` is built to avoid one metric over: stamping today's answer onto a
2019 body is the map claiming a measurement nobody took.

**And a finding's verbs do not exist in the past.** Read it, open it, dismiss it — all three
are about the code in the working tree. A dismissal is pinned to a body hash; there is no
coherent thing to pin to a body that was replaced in 2019.

**What replay is genuinely good for here is one question, and it is per-finding rather than a
list: since when?** For a finding whose every clause is replayable, the timeline can show the
frame where it started matching — this function crossed into the top complexity band in
2021 and has been there since. The walk already re-parses every version of every file a
commit touched, which is how Complexity is replayed at all, and `functionHistory` already
fetches one function's story for the panel.

Offer it on the finding, only when every clause is replayable, and say nothing at all when one
is not. A "since when" that quietly means "since when, ignoring the surprise clause" is the
same partial answer wearing a smaller hat.

### Directory rules are the rim spoken aloud, and the rim says it better

**No directory population in v1.**

A directory's reading is a DISTRIBUTION, and that is exactly what the rim draws — complete
over the whole subtree or falling back to the roll-up, curved onto the wedge it is about.
Nearly every directory rule anyone proposes is a sentence the rim already draws: mostly
unread, no git history, one person's work, half a dozen languages. Restating those as list
rows moves the reading off the picture and onto a surface with no advantage.

**The one thing a histogram genuinely cannot do is FLAG, and what is worth flagging about a
directory is spread rather than a band.** A folder half fossil and half fresh, a folder
whose children disagree violently about anything — the rim shows that beautifully to
somebody already looking at it, and can never tell you to go look. That is a real gap.

It is not this grammar, though. A clause here names a band; heterogeneity is a statement
about a whole distribution, and expressing it needs a second kind of clause — a spread
clause — which doubles the vocabulary the settings page has to teach for one population's
sake. So the trigger for revisiting this is specific: **when somebody wants a finding about
disagreement rather than about a value, design the spread clause, and directories arrive
with it.** Not before, and not by widening a band clause to cover a case it does not fit.
