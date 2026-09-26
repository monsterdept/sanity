# Sanity docs

Four kinds of document live here, and they are kept apart so that a reader can tell what the
product does from what somebody once meant it to do.

## Using Sanity

- [cli.md](cli.md): every command.
- [lenses.md](lenses.md): what each lens measures, and what it needs to have run first.
- [findings.md](findings.md): findings, decisions, and how rules produce them.
- [rules.md](rules.md): the rule grammar, every field, and what an edit does to decisions.
- [ci.md](ci.md): checking committed readings with `sanity verify`, on GitHub Actions or
  anywhere else.

## How it works — true of the code today

- [ARCHITECTURE.md](ARCHITECTURE.md): the metric, what it refuses to claim, and the pipeline.
  Start here.
- [notes/](notes/): one note per area. Each describes current behavior and keeps the record
  of what was tried and thrown away, because most rules here exist because the obvious
  alternative was built and failed.

| Note | Covers |
|---|---|
| [metric.md](notes/metric.md) | What temperature means, why docs cool a wedge, calibration |
| [readers.md](notes/readers.md) | Sanity spawns the readers; harness isolation, `SANITY_ROLE` |
| [budgets.md](notes/budgets.md) | Scan, trace and read, estimated against a budget |
| [assessments.md](notes/assessments.md) | `.sanity/`, keys, staleness, provenance |
| [mcp.md](notes/mcp.md) | The tool contract, batching, queue, endpoint routing |
| [rings.md](notes/rings.md) | Drilling, ring count, rim histograms, the color cap, folding |
| [wiring.md](notes/wiring.md) | Callers and Reach: name matching, spelling, what counts as a test |
| [time.md](notes/time.md) | What Churn and Age are for, and why what they measure isn't it |
| [panel.md](notes/panel.md) | The detail pane, per-lens sections, code tiles |
| [history.md](notes/history.md) | Replay, timeline cache, movie export |
| [report.md](notes/report.md) | The PDF report, brief and deck |
| [findings.md](notes/findings.md) | Multi-lens findings, the rule grammar, decisions, the rules editor |
| [conventions.md](notes/conventions.md) | Stack, commands, languages, cache versioning, release gates |

## Plans — finished

Write-ups of work that shipped: what was measured, what was built, and what must not be
traded away. A leftover item that is still open is listed under open plans too.

| Plan | Shipped |
|---|---|
| [offline-renderer.md](plans/done/offline-renderer.md) | Vector PDF export drawn without the window |
| [backward-scrubbing.md](plans/done/backward-scrubbing.md) | Checkpointed replay, so seeking backwards is instant |
| [history-at-linux-scale.md](plans/done/history-at-linux-scale.md) | A streamed, stoppable trace on a repo the size of Linux |
| [headless-cli.md](plans/done/headless-cli.md) | Every CLI verb without the window, released for five targets from 0.33.0; the dev tools left the app bundle |

## Plans — open

Decided but unbuilt, or measured and not yet usable. Nothing here describes the product as it
ships.

| Plan | State |
|---|---|
| [backlog.md](plans/open/backlog.md) | Decided-but-unbuilt items, each with its reasoning |
| [blame-ownership.md](plans/open/blame-ownership.md) | What Blame and Age don't say yet: an Age partner, near-copy clones, bucket lists that follow the drawing |
| [local-readers.md](plans/open/local-readers.md) | A local model as reader: measured on an unmerged branch, not on `main` |

## Elsewhere

- [bugs/](bugs/): bugs in other people's software, written up to file upstream. The
  NSOpenPanel one is diagnosed and not yet worked around.
- [`.sanity/`](../.sanity/README.md) at the repo root is Sanity's assessment of itself. It is
  product output, not documentation.
