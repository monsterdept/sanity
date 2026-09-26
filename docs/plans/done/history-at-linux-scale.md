# Tracing history on a repo the size of linux

## Summary

A first replay of the Linux kernel is **hours**. That has not changed and is not a bug — see *What NOT to do*. What changed is that it is no longer **silent**: the log is streamed and counted as it arrives, so the phase that used to be a two-minute wait with no denominator now reports a moving fraction from its first commit, and can be stopped at any point.

The remaining unreportable window is **~20 seconds**, which is git's own startup before the first line of the log appears.

## Measured

On `linux` at **1,358,757** commits (`rev-list --no-merges --count HEAD`), on an M-series Mac, warm page cache:

| | |
|---|---|
| `rev-list --no-merges --count HEAD` | **19 s** |
| `git log …` first commit emitted | **20.7 s** |
| `git log …` streaming rate, thereafter | **~10,400 commits/s** |
| `git log …` wall clock, to completion | **160 s** |
| `git log …` output | **401 MB** |
| `log_shas` (`--format=%H`, the resume path) | **19 s**, 56 MB |
| Replay, at ~17 ms/commit | **~6.4 hours** |

The exact command, as `commits()` builds it for `CommitRange::Last(ALL_COMMITS)`:

```
git log --no-merges --reverse --root --raw --find-renames \
        --format=%x01%H%x1f%ct%x1f%an%x1f%s HEAD
```

For comparison, the same repo's **churn** log — `--max-count=5000`, no `--raw` — is a different job with a deliberately unrelated cap: churn bounds a 90-day window's worth of counting, where the oldest commits genuinely change nothing, while this bounds a story, where they are the beginning of it.

## `--reverse` is innocent, and this doc used to say otherwise

An earlier version of this file claimed `--reverse` made git buffer the whole history before emitting anything, so streaming could not help. **That is wrong**, and it is the kind of wrong that stops an obvious fix from being tried. Measured arrival curve on a 112,385-commit repo:

| commit | 1 | 1,000 | 10,000 | 50,000 | 100,000 | done |
|---|---|---|---|---|---|---|
| arrives at | 3.5 s | 3.9 s | 6.1 s | 20.7 s | 32.3 s | 35.8 s |

git spends a few seconds walking the commit graph to establish the order and then streams the diffs. On linux that startup is 20.7 s of the 160 s — so **87% of the wait is reportable**, and the order the walk wants is the order git is happy to produce.

Keeping `--reverse` also makes a cancelled read *coherent* rather than wasted: oldest-first means a partial read is a complete prefix of the story, which is exactly what a bounded window already is. Reading newest-first and reversing in memory — the obvious alternative — would have made the same interruption a hole in the middle.

## What was done

1. **The log is streamed.** `commits()` spawns with a piped stdout and parses line by line into the same `absorb` the batched parser uses, so the two cannot drift. Neither the 400 MB buffer nor the `from_utf8_lossy` copy of it exists any more; one reusable line buffer does.
2. **It counts as it goes.** `Progress::counting("reading the log", "read", n, total)`, per commit. A bounded window knows its denominator from tick one (`--max-count` cannot produce more); an unbounded one picks it up when the count lands.
3. **The count runs beside the log, not before it.** `rev-list --count` is a full revwalk — 19 s here — and it only ever produces the denominator. It is spawned on a thread; the log starts immediately and the ticks read the answer out of an atomic when it arrives.
4. **It can be stopped.** The cancel flag is checked once per commit, and the child is killed and reaped rather than left to compute output nobody will read. Pinned by `a_cancelled_log_read_stops_at_the_first_commit`, which injects the predicate rather than setting the process-wide flag — a test that set `CANCELLED` stopped every other walk running beside it in the same test binary.
5. **Progress is rate-limited on the way out.** `scan::throttled` caps delivery at 20/second. Both phases now tick per commit, and at 1.36 M commits an unthrottled sink is millions of serialized events posted from the thread doing the work. Phase changes and the final tick are never dropped.
6. **Each phase says what its number means.** The row said `12k / 112k traced` while the log was being read, which had traced nothing; the unit now comes from the phase (`read`, `traced`).
7. **The CLI shows it too.** `just history` discarded the progress it was handed, so the tool that exists to check the walk gave no sign of whether it was working. One line on stderr, rewritten in place; stdout stays clean for `--json`.
8. **`log_shas` streams as well** — the resume path, 19 s and 56 MB here, which fires on every `extend` and on `warm` for any repo holding a partial timeline. It counts without a denominator, deliberately: the only way to know how many commits there are is the same revwalk this *is*, so buying a fraction would mean doing the work twice to narrate it once. The row and the CLI both render a bare climbing count when there is nothing to divide by.
9. **Stopping cannot destroy a banked timeline.** `read_cached` saved whatever `read` returned, and a cancel during the log read returns an empty one — so pressing Stop on a resumed trace would have written nothing over a banked hour. Two guards, because they fail differently: `log_shas` returning `None` means *gave up*, which `extend` answers with `Carry::Same` rather than the full replay a `Refused` would trigger; and `bank` refuses to write a walk that applied nothing. Pinned by `a_cancelled_walk_does_not_erase_a_banked_timeline`, which was checked against the unguarded version.

10. **The trace has its own rayon pool.** Rayon has one global pool and no priorities, so a scan — which submits a `par_iter` over every file in the repo — and a trace, which submits ~1,500 parses per window, share one queue. The trace waits behind whatever the scan already has in flight, and because it only ticks *after* a window is parsed, it stops reporting entirely for the duration: not slow, starved. A second pool makes them compete for CPU instead of for a queue, which the OS scheduler arbitrates and rayon's queue does not. Sized to the whole machine rather than half of it — a trace running alone is the common case, and the overlap costs 2× oversubscription of CPU-bound work, which the scheduler splits about evenly. Idle rayon workers sleep, so it costs nothing when no trace is running.
11. **Window parsing is chunked, and the opening state reports at last.** A window was one `par_iter`, so the whole of it was one silent step; it now ticks every 128 files. The bigger find was `seed` — parsing the entire tree at the edge of a truncated window, which on linux is **65,987 files** — which reported nothing whatsoever and is by far the longest phase of a bounded trace. Both halves are counted as one job, because reading blobs out of git and parsing them are one wait to anybody watching.

## What is still worth doing

1. **The 20-second startup is still silent.** It is named (`reading the log`) rather than blank, which is the bar the rest of the scan is held to, but there is nothing to count until git emits. Nothing cheap fixes this; the honest options are to say the price up front (the sidebar row already knows `1358k commits to trace`) or to leave it.
2. **Resuming a partial kernel trace goes through `commits_named`**, which chunks 2,000 shas per `git log --no-walk`. For a trace stopped at commit 300k that is ~530 git invocations. It works, it now reports, and nobody has measured it.
3. **`warm` still pays the 19 s revwalk to decide not to warm.** A repo with a partial timeline costs a full `log_shas` on open, purely to find out it is too far behind. The cheap question — how many commits are ahead of the stored head — is `rev-list --count <head>..HEAD`, which this module deliberately avoids because the walk's order is not an ancestry (see `log_shas`, and the fifteen thousand commits that cost ceph its resume). It would be sound for a DECISION, where an approximate answer is fine, and unsound for the cursor. Worth doing carefully or not at all.

## What NOT to do

**Do not cap it back.** The cap was 400 and the feature's own notes record what that cost: tonepoet opened with 584 commits already folded into the first frame, so the directory structure existed on day one and the story began in the middle. A bounded run still reports `truncated` rather than pretending, and that is what `--limit` is for — a person asking for less, not the tool deciding for them.

**Do not drop `--reverse` to get streaming.** It streams already (above), and dropping it would cost the property that makes stopping safe.
