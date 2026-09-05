# Sanity assessment — sanity

A record of how well this repo might read to someone who has not read it.

Each entry in the files below is one **reading**: an agent was shown a
function's name, signature, neighboring function names and comments, but never
its body. It was asked what it expected to find. Then it was given the file
and asked to explain the difference.

**These files are meant to be read.**

You do not need the Sanity CLI or GUI to get the information out of them: open
one and read it like notes from a code review.

| area | read | of | surprising | stale |
|---|---|---|---|---|
| [docs](readings/docs.md) | 2 | 2 | 1 | 0 |
| [scripts](readings/scripts.md) | 35 | 35 | 5 | 0 |
| [src-tauri](readings/src-tauri.md) | 1170 | 1170 | 207 | 0 |
| [web](readings/web.md) | 566 | 566 | 107 | 0 |
| **total** | **1773** | **1773** | **320** | **0** |

## Seeing it as a map

Sanity draws this repo as a sunburst with every file and function represented,
colored by surprise, legibility, doc coverage, churn, and four other
dimensions. Open the app to visualize these readings.

```
brew install --cask monsterdept/tap/sanity
```

Or download it for macOS or Windows from <https://sanity.monster>.

## Updating this assessment

Readings go stale. Each one records a hash of the code and the comments it was
made against, so when either moves out from under a reading, Sanity marks it
STALE and offers it for re-reading before anything else.

Coding agents do the reading, and Sanity runs them. From this repo:

```
sanity init
sanity check
```

Or add the repo in the app and press Read.

Each reader is a separate process started outside this directory with no
access to the repo. It sees only what Sanity hands it. The window does not
have to be open while it works.

## Commit this directory

A reading is minutes of careful work and tokens spent. Commit it so others can
benefit from it.
