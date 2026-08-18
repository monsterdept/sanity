# Tracing history on a repo the size of linux

## Summary

A first replay of the Linux kernel is **hours**, and its first visible phase — `reading the
log` — is a **~2 minute wait with no denominator**, because the log is read with
`Command::output()`, which buffers the whole thing before anything can be reported.

None of this is a bug. `history.rs` says so at `ALL_COMMITS`: the cap was deliberately raised
from 400 to unbounded because a story that starts in the middle is not the story, and the
first replay of a very large repo is "a real cost and it is the user's to spend". What the
design predates is a repo of this size, where the cost is large enough that the window's
silence during it reads as a hang. It was reported as one.

## Measured

On `linux` at 1,267,000 commits (`rev-list --no-merges --count HEAD`), on an M-series Mac:

| | |
|---|---|
| `git log …` wall clock | **86 s** |
| `git log …` output | **400 MB** |
| Replay, at the 17 ms/commit measured on tonepoet | **~6 hours** |

The exact command, as `commits()` builds it for `CommitRange::Last(ALL_COMMITS)`:

```
git log --no-merges --reverse --root --raw --find-renames \
        --format=%x01%H%x1f%ct%x1f%an%x1f%s HEAD
```

For comparison, the same repo's **churn** log — `--max-count=5000`, no `--raw` — is 634 KB
and **1.8 s**. The two are not the same job and their caps are deliberately unrelated: churn
bounds a 90-day window's worth of counting, where the oldest commits genuinely change
nothing, while this bounds a story, where they are the beginning of it.

## Why the wait is silent

`commits()` calls `.output()`, so the whole 400 MB arrives before the first line is parsed.
Three consequences, in order of how much they hurt:

1. **No progress is possible.** `read` reports `Progress::phase("reading the log")` and then
   cannot say anything else until `commits()` returns. The comment there anticipates this —
   *"until it lands there is no denominator to report"* — and it was written against a
   hundred thousand commits, not 1.27 million.
2. **Peak memory is doubled.** The 400 MB `Vec<u8>` is turned into a `String` by
   `String::from_utf8_lossy`, which allocates a second 400 MB, and both are live while
   `parse_commits` walks it.
3. **`--reverse` makes git buffer too.** It cannot stream oldest-first without reading the
   whole history first, so the cost is paid on both sides of the pipe.

## What would change it

Not yet done. In the order they are worth doing:

1. **Stream the log.** Spawn with a piped stdout and parse incrementally, counting commits as
   they arrive. The wait does not get shorter — it gets *legible*, which is the bar the rest
   of the scan's phases are held to — and peak memory halves, because neither the 400 MB
   buffer nor its lossy copy needs to exist.
2. **State the price before starting.** The sidebar row already knows the number
   (`1267k commits to trace`); a job that will run for hours could say so where it is
   started rather than after.
3. **Leave it.** It is documented, bounded by `--limit` and by the `limit` argument, and
   cancellable — which is what the reporter did.

## What NOT to do

**Do not cap it back.** The cap was 400 and the feature's own notes record what that cost:
tonepoet opened with 584 commits already folded into the first frame, so the directory
structure existed on day one and the story began in the middle. A bounded run still reports
`truncated` rather than pretending, and that is what `--limit` is for — a person asking for
less, not the tool deciding for them.
