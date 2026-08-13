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

| area | read | of | surprising | stale | dated |
|---|---|---|---|---|---|
| [scripts](scripts.md) | 8 | 8 | 0 | 0 | 6 |
| [src-tauri](src-tauri.md) | 576 | 610 | 101 | 21 | 422 |
| [web](web.md) | 263 | 263 | 45 | 1 | 198 |
| **total** | **847** | **881** | **146** | **22** | **626** |

## Seeing it as a map

Sanity draws the same repo as a sunburst — every function a wedge, width by
lines, colour by how much of it nobody saw coming. Open this repo in the app and
these readings load with it.

```
brew install --cask monsterdept/tap/sanity
```

Or download it for macOS or Windows from <https://sanity.monster>.

## Updating this assessment

Readings go stale. Each one records a hash of the code and the comments it was
made against, so when either moves out from under a reading, Sanity marks it
STALE and offers it for re-reading before anything else. Nothing here silently
keeps claiming to be current.

Coding agents do the reading, and Sanity runs them. From this repo:

```
sanity init --harness claude
sanity check
```

Or add the repo in the app and press Read. Either way it re-reads what changed
and what was never covered, and rewrites these files. Each reader is a separate
process started outside this directory with no access to the repo — it sees only
what Sanity hands it, which is what makes a reading a prediction rather than a
recollection. The window does not have to be open while it works.

**Anyone with the repo can do this.** Readings are not owned by whoever made
them: `by` on each entry is provenance you can read, not a claim on the entry.
Files are split by top-level directory and entries are ordered by position in
the file, never by when they were written, so two people assessing different
areas produce diffs that do not touch.

## Commit this directory

A reading is minutes of careful work by a reader that will never see this code
fresh again. Unlike everything else Sanity shows you, it cannot be recomputed.
