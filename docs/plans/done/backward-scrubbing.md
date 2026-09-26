# Scrubbing a replay backwards

## Summary

Playing a replay forwards is fast. **Dragging the playhead backwards was not**: it rebuilt the frame from the opening state, so seeking to commit 60,000 folded 60,000 commits at ~32 µs each — about **two seconds**, during which nothing moved.

It is checkpoints: the fold's state is snapshotted every couple of thousand commits and a backward seek thaws the nearest one and folds the remainder. What blocked that was never the checkpointing, it was what a `Frame` *was*; making it dense came first, and bought three things at once.

This note records the measurements, what shipped, and the two things that must not be traded away by whatever comes next.

## Why it was slow, exactly

`replay(hist, deltas, index)` keeps one memoised frame and advances it. Forward playback is therefore flat — each commit is folded exactly once over the whole story, whatever the speed. Backwards there was nothing to advance *from*, because undoing a commit needs the state it replaced and the timeline does not carry it.

Measured on a synthetic timeline the shape kibana builds (60k files, 148k functions, ~100 functions touched per commit), after the August 2026 fold work:

| | |
|---|---|
| fold, per commit | **~32 µs** |
| fold, one frame at 5× (589 commits) | **18.8 ms** |
| seek back to commit 60,000 | **~1.9 s** |
| build the tree for one frame | **28.9 ms** |

## What blocked the obvious fix

A checkpoint is a copy of a `Frame`, and a `Frame` was eight `Map`s keyed by function index: `loc`, `touched`, `born`, `bornAt`, `editedAt`, `funcAuthor`, `graded`, `hits`. At kibana's 148,000 live functions that is ~1.2 M map entries, and a JS `Map` entry costs on the order of 50–80 bytes of overhead — **60–90 MB for one frame**, before the values.

So full-state checkpoints buy two or three before memory is the problem. Three checkpoints across 106,000 commits sit ~26,000 apart, which is an ~850 ms seek. Better than two seconds and still not scrubbing.

## What shipped

**`Frame`'s per-function state is dense.** Every one of those maps was keyed by a function index that is already dense (`hist.funcCount` is known when the tables load), so each is a typed array:

| field | is | absence |
|---|---|---|
| `loc` | `Float64Array` | `0`, with liveness in its own `live: Uint8Array` |
| `touched`, `born` | `Uint32Array` (epoch seconds) | `NO_TS` = `0xffffffff` |
| `bornAt`, `editedAt` | `Int32Array` (commit index) | `NO_AT` = `-1` |
| `graded` | `Uint16Array` (packed grades) | `NO_GRADE` = `0xffff` |
| `funcAuthor`, `author` | `Int32Array` into an interned author table | `NO_AUTHOR` = `-1` |
| `hits` | flat `Uint32Array` ring, `CHURN_MEMORY` wide, plus a `Uint8Array` of lengths | length `0` |

`pathLive`/`pathBornAt` went with them, keyed by path index, and `dirLive`/`dirBornAt` moved from directory PATHS to the indices `Shape` already interns — which also took `dirsOf` out of the fold, where it allocated an array of strings per arrival.

That does three things at once, which is why it was the first step rather than an optimisation to do afterwards:

1. **Live frame memory falls roughly tenfold**, so a checkpoint is single-digit megabytes.
2. **A checkpoint becomes a `memcpy`** (`typed.slice()`) rather than a walk over a map.
3. **The fold gets faster**, because what was left in `advance` after the August work was mostly map hashing.

Then:

- **A checkpoint is taken every `CHECKPOINT_EVERY` (2,000) commits** during forward advance — at whatever commit the playhead lands on once that many have passed, because a frame at speed carries hundreds and stopping it on an exact multiple would mean folding twice.
- **The bank is bounded twice, by `CHECKPOINTS` (12) and by `CHECKPOINT_BUDGET` (96 MB)**, and never falls below two. Either bound alone is wrong on some repo: a count is a memory promise nobody checked, and a budget alone gives a small repo more checkpoints than its history can use. Eviction drops the interior checkpoint whose neighbours are CLOSEST together, so the survivors stay spread rather than clustered where somebody last was.
- **A backward seek** finds the highest checkpoint `≤ index`, thaws it, and folds the remainder.
- **`history::CACHE_VERSION` is not involved.** Checkpoints are derived from deltas the window already has; they are a runtime accelerator, not a stored artefact. If they were ever cached, that changes.

### The churn ring is packed, and it is why a checkpoint fits

The ring is by a distance the widest thing a frame holds: `CHURN_MEMORY` (16) stamps per function is 64 bytes against the ~32 the other fields come to. Stored flat, a checkpoint of a kibana-shaped timeline would be ~25 MB and a dozen of them 300 MB — which is the arithmetic the first sketch of this note did not do.

So a checkpoint stores exactly `hitLen[f]` stamps per function, in function order, and `thaw` scatters them back into the flat ring. Nothing is approximated: the same stamps come back in the same order. That takes a checkpoint to ~48 bytes per function the timeline has ever held.

`order` is not stored at all — it is the ascending list of live functions and `live` already says which those are, so a second copy could only disagree with the first.

### What the seek actually costs now

The spacing a bounded bank can PROMISE is `max(CHECKPOINT_EVERY, commits / kept)`, not `CHECKPOINT_EVERY` — a dozen checkpoints over a long history sit an eleventh of it apart however often one is banked. On a kibana-shaped repo (106,000 commits, and a bank the budget holds to ~10 checkpoints) that is a remainder of ~10,000 commits, so **~300 ms rather than ~1.9 s**. Under about 24,000 commits the floor binds instead and a seek is tens of milliseconds.

The remaining ceiling is memory, and it is the honest place to push next: more checkpoints is a smaller remainder, linearly, and each one costs ~48 bytes per function. What is NOT worth doing is making the state smaller by making it approximate — see below.

## What must not be traded away

- **The frame a seek produces must be identical to the one playback produces.** `replay` is documented as a pure accelerator — `frameTree(hist, i)` returns the same tree whether or not the memo is warm — and a checkpoint is the same promise one level down. `just replay-check` is what holds it: a synthetic timeline folded to the same commit three ways (forward through playback, backward through a thaw, and cold from the opening state against a `Tables` value the module has never seen) with the trees compared field by field.
- **`0` is a value, not an absence.** The maps said "not present" by being absent; a typed array says it with a sentinel, and picking `0` for `graded` or `touched` would make an unread function read as read and a function from the truncated prefix read as touched at the epoch. This is the `#[serde(default)]` hazard in another language. The harness generates functions of zero lines and readings that pack to zero for exactly this reason, and asserts the reading case outright — a two-ways comparison cannot catch it, because both paths read the same store and agree about the same wrong answer.
- **A seek that thawed nothing is correct and slow**, which no comparison of trees can see. So `history.ts` exports `cost` — how many commits the last fold actually folded, and which checkpoint it came from — and the harness asserts a bounded remainder. It is a count and not a wall clock: both times are dominated by building the tree, so a timing threshold would need retuning per machine and go flaky on a loaded runner.
- **A rewritten history is still replayed, never appended to.** Nothing here changes that.

## What NOT to do

- **Do not invert the deltas.** Undoing a commit needs the previous `loc`, `touched`, `author`, `bornAt` and the shifted end of the churn ring for every function it touched — that is a second timeline, about the size of the first, and it has to stay in step with it forever. Checkpoints need none of that: they are a snapshot of a state the fold already computes.
- **Do not prune the churn ring at checkpoint time.** It is tempting — a stamp older than the 90-day window can never be counted again, so dropping it looks free, and it would halve what a checkpoint holds. It rests on commit dates rising monotonically along the log, which git does not promise, and it buys memory with the one property this whole thing is for.
- **Do not approximate during the drag.** Showing the nearest cached frame while dragging and the exact one on release is a map that lies while it is moving, which is the failure the stale-reading rules exist to prevent, in motion.
- **Do not cap the fold per frame.** The transport promises a duration; letting the playhead lag the clock breaks the one thing `DURATIONS` exists to keep.
