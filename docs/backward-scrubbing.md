# Scrubbing a replay backwards

## Summary

Playing a replay forwards is fast. **Dragging the playhead backwards is not**: it rebuilds the
frame from the opening state, so seeking to commit 60,000 folds 60,000 commits at ~32 µs each —
about **two seconds**, during which nothing moves.

The fix is checkpoints: snapshot the fold's state every N commits and fold forward from the
nearest one. What stops that today is not the checkpointing, it is what a `Frame` *is*. This
note records the measurements, the design, and the two things that must not be traded away
while doing it.

## Why it is slow, exactly

`replay(hist, deltas, index)` keeps one memoised frame and advances it:

```ts
if (memo && memo.hist === hist && memo.frame.at <= index) { advance(...); return memo.frame }
const frame = opening(hist)   // ← a backward seek lands here
advance(frame, hist, deltas, index)
```

Forward playback is therefore flat — each commit is folded exactly once over the whole story,
whatever the speed. Backwards there is nothing to advance *from*, because undoing a commit
needs the state it replaced and the timeline does not carry it.

Measured on a synthetic timeline the shape kibana builds (60k files, 148k functions, ~100
functions touched per commit), after the August 2026 fold work:

| | |
|---|---|
| fold, per commit | **~32 µs** |
| fold, one frame at 5× (589 commits) | **18.8 ms** |
| seek back to commit 60,000 | **~1.9 s** |
| build the tree for one frame | **28.9 ms** |

## What blocks the obvious fix

A checkpoint is a copy of a `Frame`, and a `Frame` is eight `Map`s keyed by function index:
`loc`, `touched`, `born`, `bornAt`, `editedAt`, `funcAuthor`, `graded`, `hits`. At kibana's
148,000 live functions that is ~1.2 M map entries, and a JS `Map` entry costs on the order of
50–80 bytes of overhead — **60–90 MB for one frame**, before the values.

So full-state checkpoints buy two or three before memory is the problem. Three checkpoints
across 106,000 commits sit ~26,000 apart, which is an ~850 ms seek. Better than two seconds and
still not scrubbing.

## The design

**Make `Frame`'s per-function state dense before checkpointing it.** Every one of those maps is
keyed by a function index that is already dense (`hist.funcCount` is known when the tables
load), so each becomes a typed array:

| field | becomes | absence |
|---|---|---|
| `loc` | `Float64Array` | `0`, with liveness from `order` |
| `touched`, `born` | `Float64Array` (epoch seconds) | `-1` |
| `bornAt`, `editedAt` | `Int32Array` (commit index) | `-1` |
| `graded` | `Uint16Array` (packed grades) | a reserved value, **not** `0` |
| `funcAuthor` | `Int32Array` into an interned author table | `-1` |
| `hits` | flat `Float64Array` ring, `CHURN_MEMORY` wide, plus a `Uint8Array` of lengths | length `0` |

That does three things at once, which is why it is the first step rather than an optimisation
to do afterwards:

1. **Live frame memory falls roughly tenfold**, so a checkpoint is single-digit megabytes and a
   dozen of them fit.
2. **A checkpoint becomes a `memcpy`** (`new Float64Array(src)`) rather than a walk over a map.
3. **The fold gets faster**, because what is left in `advance` after the August work is mostly
   map hashing. This is also the last thing between a kibana frame and a smooth one.

Then:

- **Checkpoint every ~2,000 commits** during forward advance, keeping a bounded number (a
  dozen) and evicting so the survivors stay spread rather than clustered where you last were.
- **A backward seek** finds the highest checkpoint `≤ index`, thaws it, and folds the
  remainder — at most ~2,000 commits, tens of milliseconds.
- **`history::CACHE_VERSION` is not involved.** Checkpoints are derived from deltas the window
  already has; they are a runtime accelerator, not a stored artefact. If they were ever cached,
  that changes.

## What must not be traded away

- **The frame a seek produces must be identical to the one playback produces.** `replay` is
  documented as a pure accelerator — `frameTree(hist, i)` returns the same tree whether or not
  the memo is warm — and a checkpoint is the same promise one level down. The harness in
  `scratch/probe7`-shape (build a synthetic timeline, assert lines are conserved and ids are
  unique) should grow a case that folds to `i` two ways and compares the trees field by field.
- **`0` is a value, not an absence.** The maps say "not present" by being absent; a typed array
  says it with a sentinel, and picking `0` for `graded` or `touched` would make an unread
  function read as read and a function from the truncated prefix read as touched at the epoch.
  This is the `#[serde(default)]` hazard in another language.
- **A rewritten history is still replayed, never appended to.** Nothing here changes that.

## What NOT to do

- **Do not invert the deltas.** Undoing a commit needs the previous `loc`, `touched`, `author`,
  `bornAt` and the shifted end of the churn ring for every function it touched — that is a
  second timeline, about the size of the first, and it has to stay in step with it forever.
  Checkpoints need none of that: they are a snapshot of a state the fold already computes.
- **Do not approximate during the drag.** Showing the nearest cached frame while dragging and
  the exact one on release is a map that lies while it is moving, which is the failure the
  stale-reading rules exist to prevent, in motion.
- **Do not cap the fold per frame.** The transport promises a duration; letting the playhead lag
  the clock breaks the one thing `DURATIONS` exists to keep.
