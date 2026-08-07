# Sanity assessment — sanity

A record of how well this repo reads to someone who has not read it.

Each entry in the files below is one **reading**: an agent was shown a
function's name, signature, neighbouring function names and comments — never its
body — and wrote down what it expected to find. Then it opened the file. The gap
between the prediction and the code is the finding.

A function nobody guessed wrong about is boilerplate. A function that caught out
a competent reader is where this repo keeps its decisions — and is worth either
a comment or a second look.

**These files are meant to be read.** You need no software to get the value out
of them: open one and read it like notes from a code review. A human and an
agent can both work from them as they are.

| area | read | of | surprising | stale |
|---|---|---|---|---|
| [scripts](scripts.md) | 2 | 2 | 1 | 0 |
| [src-tauri](src-tauri.md) | 287 | 287 | 13 | 0 |
| [web](web.md) | 102 | 102 | 1 | 0 |
| **total** | **391** | **391** | **15** | **0** |

## Seeing it as a map

Sanity draws the same repo as a sunburst — every function a wedge, width by
lines, colour by how much of it nobody saw coming. Open this repo in the app and
these readings load with it.

```
brew install --cask monsterdept/tap/sanity
```

Or download it for macOS or Windows from <https://sanity.monster>.

## Updating this assessment

Readings go stale. Each one records a hash of the body it was made against, so
when the code moves out from under a reading, Sanity marks it STALE and offers
it for re-reading before anything else. Nothing here silently keeps claiming to
be current.

With the app running and its MCP server connected (the app offers this under
Connect), ask Claude:

> update my sanity assessment

It re-reads what changed and what was never covered, and rewrites these files.

**Anyone with the repo can do this.** Readings are not owned by whoever made
them: `by` on each entry is provenance you can read, not a claim on the entry.
Files are split by top-level directory and entries are ordered by position in
the file, never by when they were written, so two people assessing different
areas produce diffs that do not touch.

## Commit this directory

A reading is minutes of careful work by a reader that will never see this code
fresh again. Unlike everything else Sanity shows you, it cannot be recomputed.
