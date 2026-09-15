# Findings: what the map is telling you to do

**All three surfaces are built.** `findings.rs` is the evaluator, `just findings` and
`sanity findings` are the bench and the user-facing verb, and the panel, the badge, the
decision store and the rules editor are in the window. Everything from *What the evaluator
found* onwards is a record like any other note here, and everything before it is the proposal
those measurements were taken against — kept in that order because the arguments came first
and several of them were wrong.

**They were called leads until the panel had been looked at.** Nothing durable moved with the
rename: `.sanity/rules/catalog.md` and `.sanity/findings/decisions.md` key on rule ids,
which are not prose.

## The question this answers

"I see all this, I understand it — so what. What can I DO with this."

The map is an excellent instrument for finding a single-lens extreme: the hot wedge is
visibly hot. What no reader can do is hold two lenses at once, because the map wears one at
a time and `colorMode.ts` deliberately refuses to blend them — "blending them would average
away the exact distinction they exist for". So the readings that no amount of looking will
produce are the CONJUNCTIONS. Big and baffling. Documented and still hot. Load-bearing and
unread. A clone group whose copies no longer agree.

**A finding is where what has been measured yields something needing further inspection or
work.** That is deliberately wider than "a place where two lenses disagree", which is how this
note defined it for a while and which was a description of the MECHANISM promoted to a
definition. A conjunction is how most findings are reached and it is what the grammar is built
from — but a rule of one clause is still a rule, and the day a single measurement is enough on
its own the definition should not have to be argued with. What makes something a finding is
that there is work at the end of it.

It arrives as a list rather than as a thirteenth colouring because the answer to "so what" is
a verb, and a colour has no verbs.

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

### The file holds what the repo CHANGED, and nothing it did not

**`catalog.md` was every rule written whole, and that made it an `httpd.conf`.** The argument
for writing all of them was that the file was then a complete statement of what ran, worth
reading in a diff, and that writing only the deviations would make it change shape whenever a
shipped default moved — which reads as somebody's edit. Both halves turned out to be wrong,
and the second one was wrong in the expensive direction.

A repo scanned once froze that day's defaults into itself. `merge` cannot tell a number
somebody chose from a number that merely shipped, so it defended both, and every later
improvement to a rule's CLAUSES stopped at the repo boundary. Sanity's own file was fifteen
lines of which **eight were the shipped defaults verbatim** — pure cruft, and each one blocking
changes to a rule nobody had ever touched. Prose still flowed through (`title`, `so_what`,
`says` come from the catalog unless a line overrides them), which is exactly backwards: a
wording fix reached every repo and a fix to what the rule ASKS reached none.

Nor was it complete, its one justification. Written once and never rewritten, it listed
fifteen of the nineteen rules that ran, and two of those fifteen were no longer the rules
their ids name — see `time.md` for `fossil`, which is how this was found.

So the two jobs are split, because they want opposite things:

| | wants |
|---|---|
| `catalog.md` — what you changed | minimal, durable, hand-edited, the only thing that overrides |
| `rules/README.md` — what ran | complete, current, regenerated every scan, nobody edits it |

One file could not be both; that IS the `httpd.conf` failure, and the distro answer is
`httpd.conf` plus `conf.d/`. `.sanity/` already had the pattern in its own generated
`README.md`. Someone reading the repo without the app now gets the whole rule set, current,
with the tuned ones marked; and the only thing that can silently freeze is a line somebody
actually wrote. A repo that has changed nothing has no `catalog.md` at all.

**A deviation records what it deviated FROM.** `; was: func: repo_age >= 1095 and touched >=
1825 and loc >= 100` is the shipped rule the number was tuned against. When a release changes
which fields a rule asks about, the saved number is answering a question that no longer
exists, and it is dropped rather than left overriding — the rule comes back unspoken-for and
is calibrated against the repo like one being met for the first time.

**Shape, not value.** Comparing numbers would void somebody's tuning every time a shipped
default moved, and that tuning is the entire point. What cannot survive is a threshold whose
field or operator is gone: `1825` meant five years untouched, and there is nothing to carry it
onto.

**A line with no `was` is judged on its own shape**, which is every file written before this.
Trusting them wholesale was tried for exactly one run and is worse than useless: sanity's
`fossil` line came through untouched and was then rewritten WITH a `was` recording the shape it
had never been tuned against, so the stale number got certified by the mechanism built to catch
it. Judging the line itself gets every legacy case right. It costs the one case nothing on disk
can distinguish — a hand-edited set of clauses from before provenance existed loses the edit and
gets the shipped rule back, calibrated — and of the two ways to be wrong, handing back a current
rule beats defending a dead one.

This does not loosen the anti-percentile rule above; it is what makes it work. Calibration
still runs once and sticks, and what makes a number settled is that it lands in `catalog.md`
and is read back. A rule calibration declines to move writes nothing, comes back unspoken-for,
and is calibrated again next scan — which is only ever true of a rule already producing a list
short enough to work down.

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

**Surfaces 2 and 3 are designed at the end of this note** — see *The rules editor*, which is
where the catalog becomes something a person can argue with rather than something they are
handed.

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

Both are the same shape: **a rule whose clause the repo cannot vary**. No threshold fixes
that — there is no number that makes "everything here has one author" discriminating.

The first answer written here was relevance: decide it at calibration, from the same
distribution that suggests the numbers, and turn the rule off with its reason showing —
*Last hand alone — off. This repo has 2 contributors.* **That is not what was built, and the
reason it is not is worth keeping.**

**An automatic switch-off manufactures silence, which is the one thing this surface may not
do.** A rule the program turns off by itself is a question that stops being asked, and nothing
distinguishes that from a question with no answer — the same failure a blocked rule avoids by
saying *nobody has read this repo yet*. It also needs a threshold of its own (under how many
contributors?), which can be wrong, and being wrong means a rule that mattered goes quiet
invisibly. A rule firing on 40% of your files is the opposite failure: loud, obvious, and one
click from fixed.

**So the grid says the share and the person decides.** Every row carries `1,247 findings` and,
under it, `40% of files` — on every row rather than on the loud ones, because "show it above
N" is an invented threshold doing the reader's judging for them, and 40% against 0.7% is a
comparison the eye makes for free. `; off` in `catalog.md` already silences a rule, and the
row already has the button that writes it; what was missing was never the switch, it was the
fact that makes somebody press it. Turned off by hand, the decision is a committed line with a
human reason in the commit message and `git blame` pointing at who made it — better provenance
than a generated sentence.

**And the measurements above are from a harness, not from anything shipping.** Neither rule
they describe is in the catalog — see *Two rules the bench measured cannot be expressed*. None
of the sixteen that ship has a clause a repo cannot vary: every one is a distribution with a
spread, which is what calibration works on, and it is why sanity's whole catalog produces
forty-nine findings rather than 40% of anything. The share is built for a case that does not
occur yet, on the argument that it is one number and it will.

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

### The blame rules gained a fourth, and the clone rules cannot be benched here

Four candidates were run one at a time against the raw catalog, on every project on this
machine — sanity, flox, fussy, tonepoet, openlineage:

| candidate | sanity | flox | fussy | tonepoet | openlineage |
|---|---|---|---|---|---|
| `clone_count >= 4 and headcount >= 3` | 0 | 0 | 0 | 0 | 0 |
| `clone_count >= 4 and trap >= 1` | 0 | 0 | 0 | 0 | 0 |
| `trap >= 1 and callers >= 20` | 0 | — | 0 | 23 / 7 | — |
| `headcount <= 1 and calls >= 10` | 154 / 79 | 50 / 31 | 74 / 47 | 2,315 / 1,483 | — |

**The clone pair is not weak, it is unmeasurable on this corpus, and so is the rule that
ships.** No body of 30 lines or more is copied four times or more in ANY of these repos —
`widely-cloned` finds nothing on all five. Clone GROUPS are not rare (tonepoet 531 functions,
openlineage 241, flox 130 in a group of two or more); they are short. Of tonepoet's 531 only
41 are 30 lines or longer, and none of those is in a group of four. The ceph and kibana
numbers above — 50 and 141 — came from C++ and TypeScript; Rust, Java and Python in this
corpus do not clone that way. Nothing here says the rule is wrong, only that this machine
cannot test it, and a candidate whose every cell is zero must not be read as a candidate that
was tried.

**`headcount <= 1 and calls >= 10` looked like the strongest of the four and was the emptiest
clause in the catalog.** On a repo one person wrote, `headcount <= 1` is true of every body,
so what those 2,315 hits measure is `calls >= 10` — a rule about reach wearing a blame clause.
`repo_headcount >= 4` is the gate `sole-author` already carries for exactly this, and with it
the candidate is a real contributor and correctly silent where the premise fails:

| `repo_headcount >= 4 and headcount <= 1 and calls >= 10 and loc >= 10` | hits / only |
|---|---|
| flox | 44 / 25 |
| openlineage | 16 / 11 |
| tonepoet, sanity, fussy | 0 — one-author repos, and the gate says so |

**Shipped as `sole-author-coordinator`.** It costs `sole-author` three of its own rows on flox
and brings 25, which is the marginal test passing in the direction the bench keeps pointing:
reach is the axis nothing else in the catalog is gated on. `trap >= 1 and callers >= 20` is
held — 23 hits on one repo whose thirteen trapped functions are the whole evidence, which is
the tier 2 overfitting this note already warns about, one repo further along.

### Two rules the bench measured cannot be expressed, and are not in the catalog

**Built, and neither is called what the bench called it.** The reduction below landed and the
hold was lifted; what ships is `one-pair-of-hands` and `many-hands-knotty`, and neither names
a person. The section is kept because the reason they were absent is the reason they have the
shape they do.

"Last hand alone" and "Many hands" were in the throwaway harness because it read blame
directly. They were absent from `catalog()`, and the reason was not the one it looks like.

**The data exists per line and is thrown away on the way to a node.** `FileBlame` holds every
line of a file with the index of whoever last touched it, and `FileBlame::range` already
slices a function's lines — but it MAXES that slice, taking the newest line's author, where
these rules need it COUNTED. So a `Node` carries one name and no headcount. `TODO.md` puts it
exactly: not a second measurement, a second reduction, the same slice counted instead of
maxed. It needs no new pass and it must not use `range_detail`, which shells out per function
and is for one function at a time in the panel, not for a hundred and fifty thousand.

**It was held on a product question rather than a cost** — *"I am not sure why someone would
want a tool that has both blame and this new metric. Better be sure before we build it."* What
answered it was the distinction: they are not a second metric, they are two more reductions of
the one blame already reads, and the count's value is as a CLAUSE rather than as a colouring.
`TODO.md` carries that argument.

**What shipped, and the one measurement that decided its shape.**

- `one-pair-of-hands` — `headcount <= 1 and callers >= 10 and loc >= 10`. Widely depended on,
  and every line last touched by the same person. `callers` is the calibrated clause and not
  `headcount`: tightening a `<=` means lowering it, and below one is nothing.
- `many-hands-knotty` — `headcount >= 4 and tangle >= 0.8 and loc >= 10`. Paired with `tangle`
  rather than with `loc`, and **that pairing is the whole design**. A headcount rises with
  size — a 362-line body has more hands than a 10-line one because there is more of it to
  touch — so `headcount >= 6 and loc >= 10` is a long-function rule wearing a headcount.
  `tangle` is already measured against the other bodies its size in this repo, so the
  conjunction says something size does not. On htop it cuts `tangle >= 0.8` from 47 hits to
  10; on ceph it takes 86,269 functions to 581.

Calibrated, on four repos read per line:

| | functions | one pair of hands | many hands, knotty |
|---|---|---|---|
| htop | 1,415 | 3 | 10 |
| sanity | 1,283 | 26 | 0 |
| VectorLand | 1,871 | 18 | 0 |
| ceph | 86,269 | 473 | 1,060 |

**Zero on the two solo repos is the right answer and not a silent one.** Nobody else has been
in them; the rule asked and the answer was no. What would be silence is `one-pair-of-hands`
firing there — which it does, 26 and 18 — while its headcount clause narrows nothing, because
one pair of hands is true of everything on a repo with one pair of hands. That is the case
*A rule can be irrelevant to a repo* is about, and it is why the share sits under the count.

**`Node::last_author` is not a substitute, and the reason is sharper than it first looks.**
Blame records who touched each line LAST, so a function rewritten wholesale reads as new and
everyone whose lines were replaced is gone — not diminished, gone. A rule built on it would
say "one person owns this" while measuring "one person edited the newest line". `TODO.md`
refuses the word Ownership for the same reason; the honest pair is "last touched by" and "most
lines here", a timestamp and a headcount, neither of them authorship.

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

**Computed on demand, and deliberately not cached** — which is where the build went a
different way from the paragraph this one replaces. That paragraph planned to cache findings
with the scan and invalidate them on a rule edit; what it missed is that a rule set is an
input no cache can see, exactly as the parser is, so the version would have to move every time
somebody dragged a threshold. `report` runs per ask off the in-memory scan instead, which
makes a rule change a new answer by construction — see *A rule change is a new answer*.

**If that is ever revisited, the ordinary rules apply and are not optional.** Findings in
`scancache::Entry` or the tree cache move the format version in the same commit; a
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

## The rules editor

**Built.** The store speaks the grammar, `Field` and `Op` are enumerable, the commands exist,
the rules are a third view in the panel, and a row opens into a form that writes back. What is
left is one piece of *Three surfaces* — relevance, which is described under *Where it lives*
and is a sentence about a repo rather than a control.

The four blockers below were the point of writing this up before starting: the dropdowns are
an afternoon and none of the afternoon is the hard part. They are kept as a record of what had
to move, and each now says how it moved.

### Four things that were in the way, all of them in the code

- **`Rule` was made of `&'static str`.** `id`, `title`, `so_what` and `says` were all static,
  so every rule that could exist was one compiled into the binary and a rule read out of
  `.sanity/` could not be constructed at all. This was the whole blocker and everything else
  was small beside it.
  *Done: the fields are `String`. Not `Cow<'static, str>` — the catalog is fifteen rules of
  four short strings, which is noise beside a walk of every subject, and `Cow` would have put
  a borrow-or-own decision at every use site to save it.*
- **`saved_rules` was `id -> f32`.** One number per rule, the calibrated clause's threshold.
  It could not say *off*, could not carry a rule the catalog had never heard of, could not
  hold a floor or a population or a second clause.
  *Done: it returns `Line`s and `merge` folds them onto the catalog — amendments, not a
  whitelist, so a rule a later release ships reaches a repo that was tuned before it existed.*
- **`Op::parse` and `Op::name` were private, and nothing enumerated `Field`.** The evaluator
  needs neither: it parses text and reads values. A form needs both — every field a clause may
  name, which population each applies to, whether it needs a reading, and every operator with
  the word for it.
  *Done: `Field::ALL`, `Op::ALL` and `Field::pop`, with a test that every name parses back.
  `trap` is answerable and deliberately not offered: it is a mark rather than a measurement,
  and a picker would have to present `trap >= 1` as though the number meant something.*
- **`Group` sent `expr` as a rendered string.** `func: loc >= 257` is the right thing to SHOW
  and the wrong thing to populate three controls from: a form parsing back the string it was
  just given would be a second parser, disagreeing with the first the day somebody adds an
  operator.
  *Done: `RuleView` carries structured clauses and keeps `expr` for display.*

### The store, in the grammar it is already written in

`.sanity/rules/catalog.md` stays Markdown that is parsed back — no migrator, and `sanity
refresh` is the whole mechanism. It grows the same shape `decisions.md` uses: one line per
rule, segments separated by `; `, each named by its own prefix, so a segment nobody
recognises is skipped rather than shifting the rest.

```markdown
- `giant-function`; func: loc >= 257
- `crowded-file`; off
- `fossil`; func: age >= 1825 and loc >= 100; floor 0
- `hot-paths`; func: callers >= 20 and commits >= 4; floor 10; title: Hot paths;
  so what: widely depended on, and moving
```

**`.sanity/` now has one file at the top and three directories under it** — `README.md`, then
`readings/`, `rules/` and `findings/`. The reason is in `assessments.md`: a shard is named
after a top-level directory of the REPO, so a project with a `rules/` folder produced a
`.sanity/rules.md` full of readings and wrote it straight over this store. Nothing a source
tree can be called reaches a subdirectory.

Three cases, and the file has to tell them apart without a flag saying which: a **built-in**
carries an id the catalog knows and overrides only what it names; a **disabled** built-in
carries `off`; a **user rule** carries an id the catalog has never heard of, and must
therefore carry everything — expression, title, so-what — because there is nothing to fall
back to. A user line missing its title is a rule that cannot be drawn, and is dropped with
the same reflex `archive()` drops a decision whose verdict it cannot read: **two of the three
things a malformed rule could do are hide work.**

**A built-in's line overrides, never replaces.** Writing the expression out in full for a
built-in is allowed and is what the editor does when somebody changes a clause — but a line
that names only a threshold leaves the rest of the rule to the catalog, so a shipped
improvement to a rule's floor or its prose still reaches a repo that has tuned its number.
That is the same decision the note already records for the catalog as a whole, one level
down.

### Identity, again, and for the third time

**A user rule needs an id that is not its title.** Slug the title at creation, disambiguate
against every id in use — built-in and saved — and then never touch it again. Retitling is
free; it has been proven free twice now, once when "Hot and busy" became "Surprising and
changing" and once when leads became findings. Built-in ids are reserved: a user rule may not
take `fossil`, because a later release adding a rule by that name would silently merge two
different questions and the decisions filed under both.

### What editing does to decisions, which is where the body count is

This is the part to get right before any of it ships, and the answer is already fixed by
`pin_of`, which records the SUBJECT's values rather than the rule's thresholds:

- **Changing a threshold does not touch a decision.** `fine-for-now` on a 300-line function
  pins `loc=300`; moving the rule's bar from 257 to 400 changes which findings exist, not what
  any decision was about. Nothing expires. This is worth stating in the UI, because everybody
  will assume the opposite.
- **Changing which FIELDS a clause names does expire them all.** The pin is built by walking
  `rule.clauses`, so a rule that gains, loses or swaps a clause writes pins of a different
  shape, and every `fine-for-now` on it stops matching. The findings come back. That is
  correct — the decision was made about a different question — and it must be said at the
  moment of editing rather than discovered as findings reappearing. *Changing this rule's
  clauses brings back 7 findings somebody set aside.*
- **A flag does not move a finding in the list.** `flagged` is the one verdict that keeps a
  finding on screen, and for a while it also sorted that finding to the front — of its rule, of
  the merged worklist and of `sanity findings`. Clicking Flag therefore made the row jump out
  from under the pointer and reordered the list around it, and the order stopped meaning what
  every other surface's order means: how wide the body is. A flag is a note about what you mean
  to do next, not a claim about the code, so `live_hits` ranks by `rank()` alone and the panel
  and the CLI sort on `loc` alone. The flag says itself, in the tile and as `⚑` in the CLI.
- **`false-positive` is the fourth verdict, and it is about the RULE.** The other three are
  statements about your code; this one says the tool made a claim that was not true. Both it
  and `fine-always` hide a finding forever from where a user stands, which is the whole
  argument against splitting them — but they do not hide it for the same LENGTH of time, and
  that is a behaviour rather than a label. A won't-fix outlives everything, including the rule
  being retuned. A false positive has to survive the CODE changing, because the rule is just as
  wrong tomorrow, and must not survive the RULE changing, because a rule asking a different
  question may be perfectly right. `pin_asks` is exactly that line: it compares the pin's field
  NAMES, so moving a threshold leaves the dismissal standing and swapping a clause expires it.
  **The test that keeps the two apart is that a false positive is a claim contradicted by
  evidence this tool already holds** — `175 callers` against one real call site, `documented:
  none` against `Node::doc.is_some()`. A true finding nobody wants to act on is not one, and
  confusing them turns this into a bin for disagreement. It exists because four false findings
  shipped and were caught by blind reviewers who each wrote "the finding is false" unprompted,
  while the archive had no way to record the difference between that and a shrug.
- **`fine-always` does not care**, by construction. It is a statement about the subject, not
  about a version of it, and `Verdict::hides` never consults the pin for it.
- **Deleting a rule orphans its decisions rather than deleting them.** They stay in
  `decisions.md`, matched by nothing, and come back to life if a rule with that id returns.
  Deleting the rows instead would make "I turned it off to look at something" a destructive
  act. The ignored drawer shows them with the title they were filed under, which is why that
  title is stored beside the id.

### Calibration belongs in the editor, and only there

The row shows the number and, beside it, what the repo would suggest: *257 — about 8 findings
here; median 11, longest 3,161.* Pressing the suggestion takes it. That is
`calibrate(rule, facts, TARGET)` and `spread(facts, pop, field)`, both of which exist.

**The suggestion may only tighten.** `calibrated()` already refuses to loosen and the note
records why: a fossil is five years, and a repo whose eighth-oldest trap is six days old does
not get to redefine the word. A hand-typed number is not held to that — somebody typing 60
into a fossil rule has decided something — but the *suggestion* never offers it.

**And a hand-typed number gets the vacuity guard.** `trap >= 1 and commits >= 0` was a real
bug: the clause is true of everything, the rule quietly becomes single-lens, and the tile goes
on showing two lenses. The editor refuses to save a clause no subject can fail, and says which
clause and why.

"Recalibrate" is delete-the-saved-value: the next open computes and saves a fresh one, exactly
as a repo with no `catalog.md` does. One code path, not two.

### The number to tune on is marginal contribution

Every row carries **hits** and **only** — how many findings this rule produces, and how many
of them no other enabled rule already found. `marginal` exists and takes the precomputed hit
sets, so the whole grid is one pass.

**Hit count is the wrong number and this note has the receipts.** "Long and undocumented"
scored 3,455 on kibana and was worthless, because 18 of its top 20 were already in "Giant
function". A row that showed only its hit count would have kept it. And the pair moves as
rules are toggled — turning one off raises its neighbours' contribution — which is exactly
what makes the grid an instrument rather than a list of settings.

**It is also repo-shaped, which the editor is the only place to see.** "Giant function"
contributes 0 of 8 on htop and 2,180 of 2,292 on kibana. A default set tuned centrally would
have cut the rule doing most of the work on the largest repo tried. The editor is where a
person finds that out about their own repo.

### What the form allows, and what it refuses

Population, then one to three clauses, a title and an impact line. Two dropdowns and a
number, three times over.

It refuses, on purpose and with a reason each:

- **No fourth clause, and the cap is a choice rather than a consequence.** It was argued here
  as being about precedence — that a grammar needing precedence rules is a query language —
  and **that argument is wrong and is retracted.** Precedence is a real argument against OR,
  and it is why there is no OR; it caps conjunction at nothing, because `a and b and c and d`
  is associative and needs none.

  The tell is that the number moved. Two was the cap while the size guard lived in a separate
  `floor` field, on the argument that it was about the instrument's resolution rather than
  about the repo: below ten lines a claim about a body is mostly a claim about its signature.
  That argument did not survive size being a lens — a rule that gates on size is asking a size
  question whatever the field is called, and hiding it made the tile's lens list a lie by
  omission, as well as putting the word `floor` on screen, which the first person to see it
  had to ask about. So the floor became a clause and the cap became three: **a limit that
  moved to make room for an implementation change was never measuring anything.**

  What is left is two soft reasons, neither of which picks three over four. A tile names the
  lenses that raised it and carries a sentence about them, and past some width that stops
  being a sentence. And calibration works by moving one clause's bar to hit a target count, so
  every clause added narrows the set and the calibrated clause loosens to compensate — past
  some width the rule is mostly tuning against itself. Three is a judgement, and the UI says
  so rather than claiming a reason it has not got.
- **No OR, and no nesting — and the trigger for revisiting it is somebody naming a rule
  OUTWARD.** OR cannot ask anything a set of rules cannot. Any combination of clauses goes to
  disjunctive normal form — `A and (B or C)` is `(A and B) or (A and C)` — and the panel
  already ORs rules together, because a subject three rules flagged is ONE tile with three
  sentences. So OR is a compression of the rule list, never an extension of its reach, and the
  compression only pays where the normal form blows up: `(A or B) and (C or D)` is four rules.
  Nothing in a catalog of sixteen rules of one to three clauses is close.

  **The question is therefore not what can be asked, but whether anything cares that one
  expression is one rule rather than two.** In the panel nothing does: the unit of address is
  the SUBJECT, and the tile files a decision across all of its rules at once, so dismissing a
  thing two rules found is one click and one reason. What the split does cost is bookkeeping —
  two switches in `catalog.md` with nothing saying they belong together, two rows and two
  blame lines in `decisions.md` for one judgement, two rows in the grid whose counts overlap.

  **A rule becomes a unit of address the moment its title is shown to somebody who is not
  looking at the panel** — a notification subject line, a CI check name, a PR comment header.
  That is when "one rule or two" stops being bookkeeping, and it is the trigger for building
  OR. Not before.

  There is one cost to weigh when it arrives: `check_template` only lets the report text name
  a field the rule GUARANTEES, and under OR no branch field is guaranteed. `{{commits}}` is
  unfillable for a subject that matched the other branch, so a rule using OR loses its
  tailored paragraph and falls back to the flat impact line. `{{window}}` rides on `commits`
  the same way: it is the days of the narrowest churn window, which is what `commits` counts,
  and a sentence stating a count must name it — "changed in 8 commits recently" sat beside the
  Churn lens's 38 in 21 days for the same function.
- **Four operators, and no `==` or `!=`.** Two directions, each with and without the boundary,
  is the whole grammar. Half the fields are continuous — `tangle`, `surprise`, `documented`
  and `illegible` are 0–1 grades, `age` and `touched` are fractional days — and `tangle == 0.8`
  is a clause that looks correct and matches nothing, silently, forever. On the discrete
  fields equality is not needed because the values are integers and the existing operators
  already reach it: `callers == 0` is `callers < 1`, which is exactly what "Load-bearing and
  unread" does with `read < 1`; `callers != 0` is `callers >= 1`. The only thing that costs
  two clauses is an interior band, `commits >= 3 and commits < 10`, and that costs two clauses
  in a language with `==` as well.
- **No new fields — with one exception, and it is written down.** The field list is the lens
  list, `headcount` apart: it is the count of whose lines are standing, and blame paints
  NAMES rather than counts, so there is nothing to colour. It earns the exception by being
  the only shape a rule about people may take — a rule that named somebody would be a rule
  about what a thing is CALLED, which the bullet below refuses. The picker is built from
  `Field::ALL` rather than from a copy kept in the frontend — a second list is one list plus a
  stale copy, and the stale one is the one still offering a field that was renamed, which is
  not hypothetical: `legible` became `illegible`. A field nothing paints is a number with no
  picture behind it.
- **No paths, names or globs.** `path contains "/test/"` is the most requested rule that will
  never be in this grammar: it makes rules about what things are CALLED rather than about what
  was measured, and the moment it exists the catalog fills up with them. Exclusions are
  `.sanityignore`'s job and it already has one.

### Prose, and the one thing a user rule may not do quietly

A user rule gets a title and a so-what. `says` — the tailored paragraph with `{{token}}` holes
— is optional, and **validated at save against the same invariant the catalog test enforces**:
a token may only name `name`, `path`, `median`, `threshold`, `age_years`, or a field the
rule's own clauses guarantee. `render` already falls back to `so_what` when it cannot fill a
token, silently and correctly; silently is right at runtime and wrong at authoring time, where
it would mean somebody writes a sentence that never appears and is never told. Refuse the
save, name the token.

### A rule change is a new answer, never a stale one

**Editing a rule recomputes every finding, and nothing between the file and the panel may
remember the old ones.** The path is short on purpose: `project_report` calls `rules_for`,
which reads `.sanity/rules/catalog.md`; `subjects` walks the in-memory scan; `report` matches,
ranks, subtracts decisions and counts marginal contribution.

That covers everything derived from the call and not just the list: the totals, `only`, the
`blocked` reasons, the ignored count, the rules grid and the number on the creature. They come
from one `ProjectReport`, which is why they cannot disagree about a repo — and they are one
command for that reason as much as for the walk it saves.

### There IS a cache now, and this section used to say there was not

**"Nothing on that path is memoised" was true and is not.** The claim it justified — a rule
that changed on disk is a different answer on the next ask — still holds, but by a key rather
than by absence, and the difference is worth being exact about because the old paragraph
argued the cache would be a mistake.

What it argued was: *caching findings would need a version that moves whenever a rule moves,
and a rule moves whenever somebody drags a threshold.* That is right, and it is the
specification rather than the objection. There are four such inputs and all four are already
observable:

| input | what moves | why it is not something else |
|---|---|---|
| the tree | `Project::scanned` | already the window's own "refetch" signal |
| the readings | `Project::reads` | **not** `reports.len()` — see below |
| blame's depth | `TraceState::depth` | `headcount` is blame's alone |
| rules and decisions | the two files' mtimes | both are meant to be hand-edited and merged |

**A key derived from the inputs cannot be forgotten at a call site the way an `invalidate()`
can.** That is the whole argument for this shape. The alternative — a flag cleared wherever
something changes — has six clearing sites for the readings alone, and the failure of missing
one is a panel confidently describing a repo as it was, which is invisible.

**`reads` is not `reports.len()`, and the difference is the reason it exists.** A function read
a second time REPLACES its reading and leaves the count where it was, so a cache keyed on
length would serve a report taken against the old grade — silently, until something rescanned.
Every site that writes to `reports` bumps `reads`, and that list of sites is the correctness
argument; a seventh insert added later and not bumped is stale findings nobody sees.

**The rules and decisions are keyed on FILES rather than on counters**, because the store's
whole premise is that they are text somebody may edit by hand or merge from a branch. A
counter would miss exactly the case `.sanity/` was designed for.

### What made it necessary, measured

The old paragraph's cost estimate was a headless run over kibana — "about ten seconds, cold
scan included" — which is the right number for a CLI invocation and the wrong one for a
window, where the report is asked for every time a project becomes active, on top of a scan
and a trace already paid for. Switching to ceph took five seconds and to kibana nine.

Three defects, none of them the cache's absence:

- **`marginal` was quadratic.** It rebuilt the union of every OTHER rule's hits from scratch
  once per rule, and ran twice per report. A subject exactly one rule found is a subject with
  a count of one: **1.30s to 140ms** on 291,610 hits over 18 rules.
- **`rules_view` sorted the repo once per CLAUSE** — fifty-odd passes for about fifteen
  distinct answers, because a field's distribution does not depend on which rule is asking.
  **738ms to 235ms.**
- **`report` walked the tree for itself** while every caller had walked it a moment earlier.

**And the bench written to catch the first could not see it.** Its synthetic functions were 10
to 50 lines, so no rule fired, every hit set was empty, and a quadratic over hits measured as
free. It builds bodies the catalog matches now, and runs the old implementation inline beside
the new one asserting they agree. A bench whose data cannot trigger the code path is a bench
that reports zero, which is worse than no bench: it answers the question.

**The last one was not speed at all.** With the cache in, one project sitting still produced
eighty reports in a burst — the effect was keyed on the tree OBJECT, which is rebuilt every
time a ring arrives or a score streams in. `treeRev` exists for that distinction and says so:
a tree arriving is a different repo, or the same one rebuilt; a new object for the same repo
happens several times a minute. The window asks on three scalars now — the tree arriving, how
many readings have landed, and the counter a rule edit or a decision bumps.

**A dev build prints what each report cost and whether it was one.** `debug_assertions` only,
because a shipped build should not narrate itself — but two quadratic passes and a per-clause
sort hid on this path behind reasoning that sounded right, and the line that says
`computed in 1.31s` against `cached in 84µs` is the difference between fixing this and fixing
something else.

### What is still true, and what is still not built

The first visit to a project still computes, which is a second and a bit on kibana in a dev
build. **It belongs on the scan**, where the tax is already being levied — the objection is
that the computation needs the projects lock, so a background pass trades a slow switch for a
stalled window. The tree behind an `Arc` is what makes that possible, and it is not done.

The window's own mechanism is unchanged: a decision bumps a counter and every half re-asks. A
rule edit bumps the same counter.

### Rules live in the repo the moment they deviate

**`.sanity/rules/catalog.md`, committed, and never anywhere else.** The argument is the one
`assessment.rs` opens with, applied to rules rather than readings: a store keyed to one
machine makes the thing it holds private, opaque and mortal — unreviewable, unshareable, and
dead with the laptop. A threshold somebody chose for a repo is a decision about that repo, not
a preference of the person who happened to open it, and `.sanity/` has one home with no
fallback and no mirror.

That is already how it behaves and it is worth stating as a requirement rather than leaving as
an implementation detail: `rules_for` writes the file the first time a repo is opened, because
calibration deviates from the shipped numbers the moment it runs. Every later edit writes
through `save_rules`, which reads its own write back before anything believes it.

**The cost is that opening a repo makes an untracked file**, which is the same cost `.sanity/`
already imposes for readings, and the same answer applies: they are yours to commit. What is
not acceptable is the alternative — a local override that makes one person's map disagree with
everybody else's, with nothing in the repo to explain why.

### Breadcrumbs are git's job, and the file has to let it do it

The record-keeping is already solved and it is not solved here. `decisions.md` is committed,
so `git blame` on a line gives the commit that introduced it — which is the tree the decision
was made against, recorded by the thing whose entire job that is. `git log .sanity/` is who
decided what and when; `git diff` is what changed about the rules that found it; and a
reviewer who has never opened the app can read both in a pull request.

**An `at` field on `Decision` was proposed here and is wrong.** It would be a second answer to
a question git already answers, and a second answer that can drift: a hand-edited file, a
cherry-pick, a squash, and the field and the history disagree with nobody able to say which is
right. Readings carry `at` and that is precedent rather than justification — a `Report` is
handed to the store by an agent over MCP that has no commit of its own to be blamed by, which
is not this situation.

**What this does need is for the file to be a pure function of its contents**, or blame stops
being the record. It nearly is: `save_archive` groups by subject through a `BTreeMap`, so
subjects are in a stable order however they were added. Within one subject they are not —
`decide` retains-and-pushes onto the end of a `Vec`, so re-deciding one rule on a subject that
has two moves the OTHER one's line as well. Both lines rewrite, both get blamed on the newer
commit, and the untouched decision loses the provenance that is the whole point.

Sorting each subject's decisions by rule id before writing fixes it, and it is two lines. It
is worth doing whether or not the editor ever gets built: a store that reshuffles itself
cannot be reviewed in a diff, and being reviewable in a diff is why it is Markdown in the repo
rather than JSON in a cache.

### What kibana said about the catalog

**Run on a repo nobody has read, the tool is a linter, and it was not a good one.** Seven of
fifteen rules are blocked — *nobody has read this repo yet* — so kibana gets the tier 1 half,
and the first ten findings were: an index-mapping literal of 5,337 lines, a generated ANTLR
parser, a `.gen.ts` client, three test suites, a saved-object type table, an i18n string map,
and two things worth reading. **Two of ten.**

The measurement that should have caught this was taken and misread. "Giant function" had a
marginal contribution of 2,180 out of 2,292 on kibana, and this note recorded that as the rule
carrying its weight — the earlier text even says *"in kibana's TypeScript the giant things are
generated parsers, fixture objects and test suites"* and treats it as a point in the rule's
favour. What the number actually meant is that **nothing else finds these because nothing else
considers them worth finding**. High marginal contribution is necessary and not sufficient: a
rule can be uniquely wrong.

Three changes came out of it, and the first two are not rules at all.

- **Generated code, test code and `.sanityignore` are not subjects.** `Node::excluded` was
  computed and ignored here; generated and test files are recognised by path. **Excluding by
  path is not a rule about paths** — the grammar still refuses `path contains "/test/"` as a
  clause, because a rule is a statement about what was MEASURED. This is the other thing:
  what the instrument is pointed at, which is what `.sanityignore` has always been.
  A test's job is different — a long suite is normal, a surprising body is the point, an
  undocumented one is fine — so every rule means something else there. Findings about tests
  would be a different catalog, not a subset of this one.
- **A Rust unit test needed the parser.** It lives in the file it tests, so no path says so,
  and `#[test]` is a SIBLING of the function rather than part of it. The enclosing module is
  the one signal that reaches the tree, so `mod_item` is an owner now and `PARSE_VERSION` is
  8. That costs a re-parse and not a re-blame, which is exactly why the parse version sits on
  each cache entry — see `scancache`.
- **A giant body with no branching is data.** The literals that survived the path rules —
  1,920 lines of saved-object types, 1,879 of i18n strings — are single objects with nothing
  to follow, and nobody is going to split them up. Giant function gained
  `cognitive >= 10`: a low bar, and deliberately not "tangled", which is a different rule
  asking whether the complexity is explained by the length. This one only asks whether there
  is control flow at all.

Afterwards the same list reads: a fleet service, a heap-snapshot CLI, an ML chart provider, a
graph workspace, a canvas layout module, two route registrations. **Eight of ten**, with two
misses that are both the same shape — an ANTLR-generated parser in a `parser/` directory
rather than an `antlr/` one, and a Playwright page object under `src/playwright/` rather than
`test/`. Path heuristics get most of it and will never get all of it.

**And one rule was reading its own grades wrong.** Stale doc fired 58 times on this repo and
owned the list. The threshold was `surprise >= 0.6`, which catches `Grade::Some` — "recognizable,
but the body does real work the prediction did not cover", which is most documentation. The
grade the rule is NAMED for is `Grade::None` at 0.92: "the prediction did not describe this
code". At 0.9 it returns one finding here, and that finding is right. The number was not the
problem; the reading of it was.

### Two views, and the CLI has both

`sanity findings` is the worklist: one entry per SUBJECT, merged the way the panel merges,
widest first, with each rule's sentence under it and the blocked rules named
before the list rather than left as silence. It runs in process, like `refresh` and unlike
`status` — the read verbs ask the backend because what they report is partly live, and a
finding is not: it is the tree, the readings and the rules, all on disk. An endpoint would be
a second answer, and findings that depended on whether the app happened to be open.

**And the CLI decides, because a worklist you cannot answer is a report.** `sanity findings
snooze | allow | flag | clear <KEY>` are the three buttons in the panel and the one that
takes them back, named for what they do rather than for what the archive stores — `Verdict`
keeps its own words. The KEY is the line the list already prints: `key_of` is `path#name`, so
copying a finding out of the list is how you address it, and nothing has to be looked up.

Two things they are careful about, both of which are the panel's rules rather than new ones.
A verdict writes **one decision per rule that currently raises the subject** — the tile is the
unit and writing only the first would leave a finding half-decided — with `--rule` for the
case a tile cannot express: *this is fine BECAUSE it is long, but the tangle still stands.*
And a rule that `blocked` says cannot answer is named and refused rather than written, because
a pin taken while the churn rules are dark is a pin full of absences that will never match
again. `clear` needs no scan at all: the archive is keyed on strings it already holds, which is
what lets a decision be taken back on a repo whose rules no longer raise the finding — the
case it is most needed in. It reads the archive back rather than trusting the writes, being
the one verb here that deletes.

`just findings` is the bench: one row per RULE, with its calibrated suggestion, its marginal
contribution, and **what people decided about what it said** — `wrong` and `never`, counted off
the archive. Those two are the only columns here that are about the RULE rather than the repo:
`hits` and `only` measure how much a rule speaks and how much of that nothing else says, and
neither can tell you whether a word of it was worth reading. `wrong` is the number that has to
reach zero. `never` is information about calibration and not a defect — dismissing a true
finding is what that verdict is FOR, and `crowded-file` sitting at seven on this repo is the
mechanism working rather than failing. That is a question about the catalog, where the verb asks a question
about the repo, and they are deliberately not the same output.

### Where it lives

**A third view inside the Findings panel**, beside `findings` and `ignored` — not a separate
settings window. The counts are the reason: `hits` and `only` are meaningless except next to
the list they change, and a person tuning a threshold wants to press back and look. The panel
already carries a two-view toggle and a header that names the count; this is a third entry in
both.

Built as: the tabs name the three views and carry their counts, a header under them names the
one on screen and holds its single action — `Add Rule` on the rules view, the way into the
ignored drawer on the other two — and a rule row opens into the form in place. In place rather
than in a sheet, because the numbers a threshold is being judged against are the rows above
and below it.

Relevance surfaces here as the share under each row's count, and as the `turn off` beside it —
see *A rule can be irrelevant to a repo*, which is also where the version that turned rules off
by itself is argued down.

### Build order, and what each step actually cost

All seven are done. Kept because the order was the plan and the plan was right about where the
care went — and because two of them cost something the plan did not predict.

1. **`Rule` owns its strings, and `catalog()` becomes one source among two.** Nothing visible
   changed; everything below needed it.
2. **The store grows into the grammar** — the full line shape, with the dropping discipline for
   a line that cannot be read, and a round-trip test: the shipped catalog written out and
   parsed back is the shipped catalog.
3. **`Field` and `Op` become enumerable and public**, with the population and reading-tier
   metadata a form needs. One list, so a fifteenth field cannot be added without appearing in
   the picker.
4. **The commands.** `save_rule` / `delete_rule` / `reset_rule` write back through
   `save_rules`, which reads its own write back, and each bumps the counter the window re-asks
   on so an edit and its consequences land together.
5. **A stable order inside `save_archive`** — each subject's decisions sorted by rule id.
   Without it a decision nobody touched can be rewritten by an unrelated one, and `git blame`
   is the whole multi-user story.
6. **The grid**, read-only first.
7. **The form.**

**Step 3 had a bill nobody costed: a second list of fields.** The picker cannot read `Field`
directly, so `rule_grammar` sends it — and the moment there are two lists, the copy nobody
compiles is the one still offering a field that has been renamed. That is not hypothetical:
`legible` became `illegible` the same week, because its value is `Grade::surprise()` and high
means *harder to read*, so the name said the opposite of the number. The guard is a test that
every name the picker offers, `Field::parse` accepts.

**Step 4 had a bigger one, and it was measured rather than guessed.** Three commands each
built the whole fact set for themselves, under the projects lock, so they serialised: on
kibana that is 540,000 records to answer three questions about one repo, and opening it went
from fast to noticeably not. They are one answer anyway — the counts in the grid, the tiles in
the list and the number on the creature are one measurement seen three ways — so they are one
command, `project_report`, and one walk. See the bench in `findings.rs`, which is kept
`#[ignore]`d with the numbers in its doc comment.

Step 6 was the one predicted to change the design, and it did, twice: the grid's `only` column
went (it answers a question somebody asks once about the CATALOG and was sitting on every row
forever), and `floor` stopped being a field and became a clause.

### Open, and worth arguing before the build

- **Should a user rule be shareable?** `.sanity/rules/catalog.md` is committed, so it already is,
  between people on one repo. Between REPOS there is nothing, and the catalog is the only
  thing that crosses. A rule somebody found useful on one repo is the obvious thing to want to
  carry, and an export/import is the obvious mechanism — and both are how a catalog becomes a
  plugin directory nobody curates.
- **Does the editor need a preview?** The grid's `hits` and `only` update live, which may be
  the whole of it; a top-five list under the form would be better and is another surface to
  keep honest.
- **What happens to a `catalog.md` written by a newer version?** The dropping discipline says an
  unreadable line is skipped, which for a rule means it silently reverts to the catalog's
  version — safe, and invisible. A count of what was dropped, said once at the top of the
  grid, is probably the answer.

### What the form refuses to enforce

**Every rule about what a rule may be lives in `apply_edit`, and the form enforces none of
them.** The clause cap, a threshold true of everything, a field that says nothing about this
population, a `{{token}}` the rule cannot fill: the backend answers each with a sentence, and
the form shows it verbatim and stays open.

A second copy of those checks in the frontend is the obvious version and it is a second
grammar. The day the two disagree, the form is refusing rules the backend accepts — which
reads as the save being broken, and is the harder of the two failures to find. What the form
does instead is offer only what is offerable: the population picker filters the fields to the
ones that population can be asked about, and a new clause opens on its field's median rather
than on `0`, which `apply_edit` refuses as true of everything.

The one thing it checks itself is the parse. Clause values are strings while they are being
typed — a number input bound to a `number` cannot hold an empty box, so a field typed through
zero either snaps back or becomes `NaN` — and `NaN` sent as a threshold is a rule that matches
nothing, silently, which is the failure this whole surface exists against. One parse, at the
edge, where a bad number can still be refused out loud.
