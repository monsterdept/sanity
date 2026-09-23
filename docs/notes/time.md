# The two git lenses

**Three jobs are being asked of two measurements, and one implementation is serving none of
them cleanly.**

`metric.md` calls Churn and Age "the second axis", and `Score::is_stable()` FUSES them into one
boolean to be it — `churn < 0.25 && age_days > 90` — which the four quadrants come out of.

**Nothing a user touched ever consumed that**, which is why both are now gone. `is_stable` and
`quadrant` were reachable only from the headless scorer — a terminal command we ran on
ourselves — never from the app, and never from the reading queue, which ranks on its own score
and interleaves by file so one reader is not handed several functions out of one file. The
scorer was deleted along with the local model it was the only caller of; the quadrant model
went with it.

So the fused reading was us marking our own homework, and the two lenses that ship are asked for
something else entirely. A hotspot is a churn question with no age in it; dusty is an age
question churn cannot answer. Pulled apart they are two independent readings; fused they are one
qualifier. Both framings are legitimate, they want different numbers, and that is most of why
what we built satisfies neither.

Three jobs, then, and when this note was written only the one nobody sees was done:

1. **Qualify surprise** — needs them fused. Built, consumed only by the headless scorer,
   deleted with it.
2. **Find hotspots** — needs churn alone, meaning frequency. Not built then; what shipped
   measured something else. **Built since** — see *Churn: resolved*.
3. **Find dusty code** — needs age, crossed with something that is not churn. Inverting the
   ramp does not get there. Only partly built: the findings rules `fossil` and `fossil-trap`
   cross untouched-for-years with size and with a reader's trap mark; see *Where this leaves
   it*.

## What they are for

Stated as purposes rather than as measurements, which is the level the disagreement lives at:

- **Churn should show hotspots** — the code that changes all the time, and the places where
  two people are likely to be editing the same thing.
- **Age should show dusty code** — what nobody has been near in a long while and might now
  need a look.

And two readings deliberately rejected, both of which the History view already gives you:

- Churn as *where work has gone recently*.
- Age as *where work has happened recently*.

## Churn: resolved, and how

**Churn now means frequency, off the timeline.** `edits.rs` counts, per function and per path,
the days each was changed on, out of the timeline's hash-diffed `Delta::set`. That is
`Depth::Edits`, the fourth rung of the trace ladder, and it is the only rung that adds a
quantity rather than a resolution.

What follows is the record of why it took three instruments to get there, because the second
one looked right for months.

### Blame was never chosen over the timeline

`blame.rs` landed 2026-08-04. `history.rs` landed 2026-08-08. The timeline did not exist when
churn moved to blame, and the commit that introduced it scoped itself to the replay in its own
title — *"The repo has a history, and the rings can grow through it — but not a colour"*. Nobody
went back. There was no argument for blame over the timeline; there was an ordering.

### What blame could not see, measured

Blame keeps one commit per LINE. A body whose same lines are rewritten repeatedly reports only
the commits that happen to have survived, so the metric is not merely un-windowed — for the
hotspot question it is close to anti-correlated. Measured on this repo with `git log -L` against
`git blame`:

| range | real edits | surviving commits | seen |
|---|---|---|---|
| `CLAUDE.md` L30–50 | 47 | 2 | 4% |
| `CLAUDE.md` L95–115 | 47 | 2 | 4% |
| `CLAUDE.md` whole | 55 | 10 | 18% |
| `.sanity/README.md` | 48 | 7 | 14% |

A function one person keeps rewriting scored the same as one nobody had touched. A function
assembled once out of twelve commits touching twelve different lines scored 12.

`edits.rs` pins this as a test: a body rewritten in place twelve times counts 12, and blame
asked about the same lines says 2 — the signature and the closing brace are the first commit's,
the body line is the last one's, and the ten between left nothing behind.

### And the drift nobody decided

`trace::apply_to` writes scores only on FUNCTIONS; file and directory scores come from
`aggregate`, the line-weighted mean of their children. So when functions moved to blame,
sedimentation propagated up the tree and the ninety-day window stopped painting anything at all.
It survived only as `Score::commits`, the raw number in the tooltip. Nothing chose that; it fell
out of the aggregate.

### What it costs

The walk is bounded by the widest window, which is what makes it affordable: ladybird is 81,770
commits and 6,022 of them are in the last hundred and eighty days. Measured, cold:

| repo | commits in window | walk | cached |
|---|---|---|---|
| sanity | 254 | 0.1s | 45ms |
| godot | 1,803 | 16–19s | 45ms |
| ladybird | 6,022 | 32s | — |

Twentyfold spread in seconds-per-commit (godot 9.36ms measured, sanity 0.4ms), so the rate is
banked per repo like `churn::Bank::rate`. A full History timeline, where one exists, is counted
where it lies rather than re-walked.

It is a priced phase and nothing runs it unasked. That follows `history::warm`'s standing rule —
*sanity will keep a timeline you have asked for current, and will never make one you have not* —
and until it has run, Churn is **locked**, not painted: every count is zero, and zero is a
finding. `Stats::churned` is that answer, stated once on the repo beside the button that fixes
it.

### The window is the repo's own

A fixed 30/60/90/180 goes inert on exactly the repos this app is for. Measured:

| repo | life | 30d | 60d | 90d | 180d |
|---|---|---|---|---|---|
| sanity | 27d | 271 | 271 | 271 | 271 |
| krapow | 109d | 0 | 0 | 0 | 59 |
| godot | 4891d | 140 | 500 | 783 | 1803 |

Four choices and one answer on this repo; three empty maps on a dormant one. So `windows_for`
scales the ladder to a project that cannot fill it — sanity offers 4/9/13/27 days — which is the
argument `ageSpanOf` already makes: *in a repo three days old, the thing written on day one
really has been left alone for two thirds of the project's life.*

**Capped at the top, though, and the asymmetry is the point.** Age normalizes to the whole life
because *old* is relative to the project. Churn means *lately*: half of kibana's life is six and
a half years, which is precisely the window `CHURN_WINDOW_DAYS` says calls a whole repo stable.
Proportional at the young end, capped at the old one.

The saturation anchor scales with the window (`saturation_for`), so the colour is a rate rather
than a count — otherwise widening the horizon just brightens the map and three of the four rungs
change exposure instead of asking a different question.

What this costs is comparability: a window here and a window in an older repo are not the same
window. Age already paid that knowingly, and said why — cross-repo comparison was never
something this app offered.

### What is left over

**Sedimentation is a real reading and it no longer has a lens.** "How many hands are layered in
the code in front of you" is a genuine question that blame answers cheaply and the timeline does
not; it was removed from the churn axis because it was wearing another question's name, not
because it was wrong. If it comes back it comes back as its own lens with its own word.

## What they measured, and how that read

- **Age paints recency by default, and it is the rejected reading exactly.** (It can now paint the
  oldest line instead — see *Where this leaves it*.) `--age-4`, the brightest
  stop, is the RECENT end; `RAMP_ENDS` reads `['old', 'recent']`; `AGE_BANDS` is documented
  "most recent first"; and the house rule is that the loud end leads. Every one of those is
  consistent with the others, which is why nobody noticed — the lens is a well-built answer to
  the question we did not want asked.
- ~~**Churn counts a different thing depending on what you point at, and the ramp hides it.**~~
  *Fixed — see above. Kept because the shape of the mistake is the useful part.*
  `Score::commits` is a 90-day rate on a file and, on a function, the distinct commits its
  surviving lines trace back to — `model.rs` says so, and `blame.rs` "asks the UI not to
  present the two as one number". The tooltip complies: `27 commits in 90d` against `traces to
  4 commits`. The COLOUR does not — one ramp, two quantities, one picture.
- **What a function's churn actually measures is sedimentation, not frequency.** Blame sees
  only surviving lines, so a body assembled out of twelve commits scores high whether it was
  rewritten last week or has sat untouched since 2014. That is a real reading — how many hands
  are layered in the code in front of you — and it is not the hotspot the purpose asks for.
- **Both naive readings exist as fields already.** `Score::age_days` is "days since the code
  first appeared" and the hover tooltip prints it as *First seen* (`WedgeTip.tsx`); `Score::all_commits` is "every
  commit that has ever touched this path". So "how old is the oldest part" and "how many times
  has this changed" are named quantities sitting beside the ones the lenses paint. A field
  called `age_days` means what a person means by age; the lens called Age does not.

- **A rule asked `age` and its sentence said `touched`, and it read fine for months.** Fossil
  gated on `age >= 1825` and printed "{{loc}} lines that no commit has changed in
  {{age_years}} years." Those are two different quantities — `age` is the oldest surviving
  line, `touched` the newest — and on ceph's `OSDMonitor::prepare_command_impl` the gap is the
  whole story: 4,313 lines, 52 people's work standing in it, nineteen years since the oldest
  line was written, and edited constantly. The tile said nobody had touched it since 2006. It
  was spotted from the sentence being *absurd* alongside the other three rules firing on the
  same body, not from the rule, because the rule's own wording is where the confusion lives.
  Fossil asks `touched` now, and both dates have their own render token so a sentence has to
  name which one it means.
- **The template checks exempted the date token, which is how it hid.** `age_years` sat in the
  "not a field" skip list beside `name` and `path`, so neither the catalog test nor the rule
  editor's `check_template` asked whether a clause guaranteed it. Both resolve the date tokens
  to their fields now. The same hole existed one layer down: a repo's saved `catalog.md` holds
  tuned NUMBERS and takes its prose from the shipped catalog, so a shipped rule that changes
  which field it asks about leaves the tuned clause pointing at the old one — ceph's saved
  `age >= 1825` began printing "no commit has changed it in 0.1 years", filled from facts the
  rule never gated on. `amend` re-runs the check and drops back to the generic sentence rather
  than the tuning, because the number is the part somebody chose.

## Why the obvious fixes do not serve the purpose

- **Inverting the Age ramp makes the map louder and no more useful.** On ceph, `LAST TOUCHED`
  is 171 functions this month, 3,313 this quarter, and **90,878 older** — 96% of the repo.
  Dusty as a raw age reading is not a finding; it is the default state of code, and a lens that
  lights 96% of the picture is saying nothing at a higher volume.
  **Age needs a partner, not a direction.** Old AND surprising is code nobody remembers how to
  read; old AND heavily called is load-bearing and unexamined; old AND undocumented is the
  handover risk. Three different worries, all three already measured, and none of them crossed
  with age anywhere.
  **Which ran into the fact that this app had no way to cross two lenses at all.** The banner
  that named the quadrants was removed for explaining an enum's vocabulary to somebody who had
  never been shown it, and the four-dial row for being the same four answers a screen earlier.
  The panel and the tooltip both follow the current lens. So the only crossing a user could
  perform was to switch lenses and remember. Findings are that crossing now — a rule is clauses
  over several lenses' fields (`findings.rs`, see [findings.md](findings.md)) — but of the three
  age worries above, only a trap crossed with age ships as a rule (`fossil-trap`).
- **Renaming fixes the vocabulary and none of the readings.** Age → Recency would be honest and
  would free the word for a lens that means it, but the purpose above still has nothing painting
  it.
- **`git log -L` per function is still a process apiece**, which is why blame was used instead
  and why sedimentation is what we ended up with. Nothing here changes that arithmetic.

## Where the instrument already is

**The timeline knows what blame cannot.** History's log walk visits every commit and carries,
per commit, the set of functions it touched (`Deltas`, `c.set`) and its author. Counting across
it gives exactly "how many times has this function changed, ever" — the frequency the hotspot
purpose asks for — and the same pass gives the distinct authors behind a function, which is the
contention half of that purpose and is currently measured nowhere at all.

That walk is expensive once and cached (`history::read_cached`). When this was written it was
built only when somebody opened History, so the number the live map wanted was already being
computed behind a feature that exists for something else. `edits.rs` now reads that same
stored timeline for Churn (`Depth::Edits`), and walks just the churn window's commits when none
is stored. The authors half is
still unused: `Node::headcount`, the one per-function count of people, comes from blame — people
with lines STANDING — not from the timeline's record of who changed it.

**Contention is not churn and should not be folded into it.** How often a thing changes and how
many people change it are different questions with different answers — a file one person rewrites
weekly is not the coordination problem a file six teams touch quarterly is.

## Where this leaves it

1. ~~Churn means frequency, sourced from the timeline rather than from blame.~~ **Done** — see
   *Churn: resolved*. It did not split in two: how often is the lens, and how many hands is a
   reading with no lens rather than half of this one.
2. **Age is now two readings** rather than one, which is not the crossing this note asked for and
   is the honest half of it. The lens paints either the newest line here or the oldest — both
   were always measured, and it only ever showed the first, which is the rejected reading named
   above. The switch is beside the lens.

   It is deliberately NOT called *first seen*: blame reports the last commit to touch each line,
   so a body rewritten wholesale has nothing left saying when it was written. `oldest line` is a
   fact; when this code first appeared is not one we hold.

   **The crossing is still mostly open.** Old AND surprising, old AND heavily called, old AND
   undocumented are three different worries, all three measured, and none of them ships as a
   rule crossed with age. The mechanism exists now — findings rules can name `age` or `touched`
   beside `surprise`, `callers` or `docs`, and a person can write one in the rules editor — but
   the shipped catalog crosses age only with a trap (`fossil-trap`). Those rules are the thing to
   build next — not a third reading of age.

Neither was a rename, and neither was started by adjusting a ramp direction and calling it done.
