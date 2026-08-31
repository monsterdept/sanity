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

Three jobs, then, and only the one nobody sees is done:

1. **Qualify surprise** — needs them fused. Built, consumed only by the headless scorer,
   deleted with it.
2. **Find hotspots** — needs churn alone, meaning frequency. Not built; what ships measures
   something else.
3. **Find dusty code** — needs age, crossed with something that is not churn. Not built, and
   inverting the ramp does not get there.

## What they are for

Stated as purposes rather than as measurements, which is the level the disagreement lives at:

- **Churn should show hotspots** — the code that changes all the time, and the places where
  two people are likely to be editing the same thing.
- **Age should show dusty code** — what nobody has been near in a long while and might now
  need a look.

And two readings deliberately rejected, both of which the History view already gives you:

- Churn as *where work has gone recently*.
- Age as *where work has happened recently*.

## What they measure today

- **Age paints recency, and it is the rejected reading exactly.** `--age-4`, the brightest
  stop, is the RECENT end; `RAMP_ENDS` reads `['old', 'recent']`; `AGE_BANDS` is documented
  "most recent first"; and the house rule is that the loud end leads. Every one of those is
  consistent with the others, which is why nobody noticed — the lens is a well-built answer to
  the question we did not want asked.
- **Churn counts a different thing depending on what you point at, and the ramp hides it.**
  `Score::commits` is a 90-day rate on a file and, on a function, the distinct commits its
  surviving lines trace back to — `model.rs` says so, and `blame.rs` "asks the UI not to
  present the two as one number". The tooltip complies: `27 commits in 90d` against `traces to
  4 commits`. The COLOUR does not — one ramp, two quantities, one picture.
- **What a function's churn actually measures is sedimentation, not frequency.** Blame sees
  only surviving lines, so a body assembled out of twelve commits scores high whether it was
  rewritten last week or has sat untouched since 2014. That is a real reading — how many hands
  are layered in the code in front of you — and it is not the hotspot the purpose asks for.
- **Both naive readings exist as fields already.** `Score::age_days` is "days since the code
  first appeared" and the panel prints it as *First seen*; `Score::all_commits` is "every
  commit that has ever touched this path". So "how old is the oldest part" and "how many times
  has this changed" are named quantities sitting beside the ones the lenses paint. A field
  called `age_days` means what a person means by age; the lens called Age does not.

## Why the obvious fixes do not serve the purpose

- **Inverting the Age ramp makes the map louder and no more useful.** On ceph, `LAST TOUCHED`
  is 171 functions this month, 3,313 this quarter, and **90,878 older** — 96% of the repo.
  Dusty as a raw age reading is not a finding; it is the default state of code, and a lens that
  lights 96% of the picture is saying nothing at a higher volume.
  **Age needs a partner, not a direction.** Old AND surprising is code nobody remembers how to
  read; old AND heavily called is load-bearing and unexamined; old AND undocumented is the
  handover risk. Three different worries, all three already measured, and none of them crossed
  with age anywhere.
  **Which runs into the fact that this app has no way to cross two lenses at all.** The banner
  that named the quadrants was removed for explaining an enum's vocabulary to somebody who had
  never been shown it, and the four-dial row for being the same four answers a screen earlier.
  The panel and the tooltip both follow the current lens. So the only crossing a user can
  perform is to switch lenses and remember — which works, and works only because nothing moves
  between them, and is nowhere stated as a thing you can do.
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

That walk is expensive once and cached (`history::read_cached`). Today it is built only when
somebody opens History, so the number the live map wants is already being computed behind a
feature that exists for something else.

**Contention is not churn and should not be folded into it.** How often a thing changes and how
many people change it are different questions with different answers — a file one person rewrites
weekly is not the coordination problem a file six teams touch quarterly is.

## Where this leaves it

Open, deliberately, and recorded rather than half-fixed. The order the work would go in:

1. Churn means frequency, sourced from the timeline rather than from blame, and probably splits
   in two — how often, and how many hands.
2. Age is crossed rather than inverted, because the raw reading is nearly constant on any real
   repository.

Neither is a rename, and neither should be started by adjusting a ramp direction and calling it
done.
