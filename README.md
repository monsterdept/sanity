# Sanity

**Understandability, measured, and gated.** Sanity gives each function in a repo a reading:
a coding agent is shown the function's name, signature, neighbors and comments, but not its
body, and says what it expects the function to do. Then it opens the file and reports how
far off it was. The readings are committed next to the code. They expire when the code
changes, and CI can refuse a release that ships without them.

Generating code got cheap, so understanding it became the bottleneck. Sanity is for teams
who can build anything and no longer know what they've built. It tells you which code
nobody could predict, which docs are wrong, what will bite the next person to edit it, and
whether any of that changed since the last release.

It also draws the whole repo as a sunburst, with a lens for each of those questions.

```sh
brew install --cask monsterdept/tap/sanity
cd your-repo
sanity init --harness claude --model sonnet   # which agent reads, and with which model
sanity check --limit 50                       # take 50 readings
sanity findings                               # what is worth looking at, and why
git add .sanity && git commit -m "Readings"
```

## The loop

Sanity covers the whole life of a repo's quality, not one snapshot of it:

1. **Read.** `sanity check` starts coding agents as readers, and each one predicts functions
   before it sees them. Nothing leaves your machine except what the agent itself sends to its
   own model.
2. **Find.** `sanity findings` crosses the readings with size, complexity, call graph, clones
   and git history, and ranks what comes out: *giant and hard to follow*, *load-bearing and
   unread*, *documented and still surprising*, *copies that have drifted apart*.
3. **Decide.** Every finding gets a verdict, and verdicts are committed. *Snooze* expires when
   the code changes, and *wrong* expires when the rule changes. The list shrinks to what's
   still true.
4. **Gate.** `sanity verify` fails a build whose readings are missing, stale or mixed. You
   can't ship code nobody has read.
5. **Re-read.** Change a function and its reading goes stale. It moves to the front of the
   queue, and the next `sanity check` picks it up.

## The CLI

Every verb takes a repo path and defaults to the current directory. `sanity <verb> --help`
lists a verb's flags.

### Set up and read

```sh
sanity init --harness claude --model sonnet   # pick the agent and model for this repo
sanity check                                  # read until done, watching progress here
sanity check --readers 8                      # 8 readers at once
sanity check --limit 50                       # stop after 50 readings (a reader does ten)
sanity check --detach                         # start it and return
sanity status                                 # what readers are working on, and how much is read
```

`--harness` takes `claude`, `codex`, `opencode` or `agy`. `--model` takes any model id that
agent can reach. Stopping a pass costs only the readings in flight: finished readings are
written as they land, and the next `check` resumes where it stopped.

### See what was found

```
$ sanity summary
Project: sanity
  2,455 segments (2,280 functions + 175 file headers)
  2,455 read (100.0%)
  0 unread (0.0%)
  0 stale (0.0%)

                 full   most   some   none
  PREDICTED       696  1,131    412     41
  DOCUMENTED      377    704    302    897
  LEGIBLE       1,905    269     91      0

  24 traps identified
  623 unhelpful doc strings found
```

```
$ sanity findings --limit 2
/Users/rturk/projects/sanity  14 findings

  web/src/components/Findings.tsx#Findings
    Giant and hard to follow
      1,012 lines, and a reader had to go back over it more than once to follow
      it. Anything that changes it has to hold all of it at once, and a reader
      already found that hard.
    Tangled and hard to follow
      For 720 lines of code this branches far more than bodies that size usually
      do here, and a reader had to go back over it more than once to follow it.

  web/src/App.tsx#App
    Unpredicted and far-reaching
      This calls 48 other functions and a reader still could not predict what it
      does. It coordinates work that is not apparent from its own body.
```

`--edits` and `--blame` read more git history first, so the rules about churn and age can
fire. On a large repo that takes minutes. `sanity trace` reads the same history up front.

### Decide on findings

```sh
sanity findings snooze web/src/App.tsx#App --reason "rewrite planned for Q4"   # hide until this code changes
sanity findings allow  src/gen.rs#table                   # always fine
sanity findings wrong  src/lib.rs#parse --rule giant-illegible   # the finding is false; hide until the rule changes
sanity findings flag   src/lib.rs#parse                   # needs doing; keep it in the list
sanity findings clear  src/lib.rs#parse                   # take a decision back
sanity findings balance --target 20                       # propose thresholds that yield ~20 findings
sanity findings balance --target 20 --apply               # write them to .sanity/rules/catalog.md
```

### Gate, inspect and export

```
$ sanity verify
  pass  complete        every unit has a reading
  pass  current         every reading describes the code as it stands
  pass  one instrument  claude-sonnet-5 via claude
```

```sh
sanity verify --model claude-sonnet-5         # require this model, not just one model
sanity callers src/edges.rs#resolve           # who calls one function, by name
sanity trace --blame                          # per-line blame, so age resolves to functions
sanity export-data --out report.json          # everything the report reads, as JSON
sanity refresh                                # rewrite .sanity/ in the current format
```

`sanity` with no arguments opens the window. `sanity mcp` is a stdio MCP server that lets a
chat agent open a project and read back its status and summary. It can't take readings: its
context is already full of the repo, so anything it graded would be recall.

## Installation

| Platform | Get it |
|---|---|
| macOS (Apple silicon) | `brew install --cask monsterdept/tap/sanity`, or the `.dmg` from [sanity.monster](https://sanity.monster) |
| Linux x86-64 | `.deb` or `.AppImage` from [sanity.monster](https://sanity.monster) |
| Windows x86-64 / arm64 | `.exe` installer from [sanity.monster](https://sanity.monster) |

The app and the CLI are the same binary. The Homebrew cask puts `sanity` on your `PATH`. If
you installed the app another way, press **Install sanity command** on the welcome screen,
which links it into `/usr/local/bin` or `~/.local/bin`. Don't add the app bundle to your
`PATH` or alias it. Other binaries live beside it, and scripts can't see an alias.

**To take readings** you also need a coding agent installed and signed in: Claude Code
(`claude`), Codex (`codex`), OpenCode (`opencode`) or Antigravity (`agy`). Sanity never calls a
model itself and needs no API key. Everything else (the map, findings, history, `verify`)
works without one.

**What a pass costs.** A reader spends roughly 23,000 tokens getting started and 3,000 per
function, and it reads ten functions per session. That works out to about 5,300 tokens per
function, or about five million for a thousand-function repo. `sanity status` shows how much
is left. Start with `--limit`. To leave parts of a repo out of reading, list them in a
`.sanityignore` at the root: they're still drawn, but they no longer count toward coverage.

## In CI

Readings are taken by developers, against the code they're about to ship, and committed. CI
never takes them, because that would mean model credentials in CI. CI checks what was
committed. `sanity verify` exits non-zero unless the readings are:

- **complete**: every function and file in scope has a reading;
- **current**: none is stale against the checked-out code, and none was taken under an older
  version of a question;
- **one instrument**: every reading names the same agent and model. `--model` and `--harness`
  pin which one. `--mixed` waives the check and still prints the mix.

It needs no git history, no network and no credentials.

### GitHub Actions

[`monsterdept/sanity-action`](https://github.com/monsterdept/sanity-action) runs `verify` on a
Linux x86-64 runner:

```yaml
name: Readings
on: [pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: monsterdept/sanity-action@v1
        with:
          version: 0.31.0          # the Sanity release your team reads with
          model: claude-sonnet-5   # optional: require this model
          # harness: claude        # optional: require this agent
          # path: services/api     # optional: a repo in a subdirectory
          # consistent-reader: false   # optional: allow mixed models
```

**Pin `version`.** A release that changes the parser or a question can expire readings, and
the gate shouldn't move unless you move it.

To gate releases rather than pull requests, put the job in front of your build with
`needs:`. Sanity gates its own releases this way: see
[`.github/workflows/readings.yml`](.github/workflows/readings.yml).

### Anywhere else

Download the `.AppImage` for the pinned version and run it:

```sh
curl -fsSLo sanity https://dl.dept.monster/sanity/Sanity_0.31.0_amd64.AppImage
chmod +x sanity
APPIMAGE_EXTRACT_AND_RUN=1 ./sanity verify "$PWD"   # absolute: the AppImage starts in its own directory
```

`APPIMAGE_EXTRACT_AND_RUN=1` is for runners that don't have `libfuse2`.

## The metric: predictability

Anyone can count lines or branches. What Sanity measures is:

> Boilerplate is code a model can predict from its context.

A predictable body is scaffolding. A surprising one is where the decisions are, and it's the
code a new teammate, or the next agent, will get wrong.

Documentation is part of the context the reader predicts from. A comment that actually
explains a surprising body makes it predictable, so the function reads cooler next time.
`// increments the counter` over a subtle retry loop changes nothing. A stale comment makes
it read *hotter*, because the reader predicts what the comment describes and the body does
something else. Adding more comments can't game the score. A reader also records whether a
comment could have been written from the code alone, and by default a comment like that
doesn't count as documentation, so running a model over the repo can't make the numbers look
better.

**Which model reads is part of the measurement.** A smaller model is surprised by more
things, so the model sets the scale. Sanity records the model and agent behind every
reading. Read a repo with one model throughout, and `verify` enforces that.

Each reader is a separate process, started outside the repo without your project settings,
and given only the tools it needs to take a reading. That's what makes a reading a
prediction and not a recollection: a session that has been working in the repo already knows
the answers.

Surprise alone can't tell a subtle algorithm from a mess, so git history supplies a second
axis:

|  | **Stable** | **Churning** |
|---|---|---|
| **Surprising** | Crown jewel: document it, don't touch it | Trouble: the mess |
| **Predictable** | Bloat, if there's a lot of it | Quiet: ignore it |

## Readings live in the repo

A reading takes minutes of an agent's time and can't be recomputed, so it doesn't belong in
an app-support folder on one laptop. Readings are committed to the repo they describe, at
`.sanity/`, as Markdown meant for people. Open `.sanity/readings/*.md` and it reads like
notes from a code review.

- **One file per top-level directory**, ordered by position in the source, so two people
  reading one repo don't produce merge conflicts.
- **Readings expire.** Each one records a hash of the body and comments it was taken against.
  When the code changes, the reading is marked stale and goes to the front of the queue.
- **Anyone with the repo can extend anyone's readings.** A reading names who took it, with
  which model and which agent. That's provenance, not ownership.

`.sanity/rules/` holds the findings catalog, and `.sanity/findings/decisions.md` holds the
verdicts. Don't hand-edit readings. An edited reading is a measurement nobody took.

## The map

`sanity` with no arguments opens the window. The repo is at the center, directories and files
are rings around it, and every function is on the rim. A wedge's width is its size in lines.
Its color is whichever question you're asking:

| Group | Lens | What it asks | Needs |
|---|---|---|---|
| **Code shape** | Complexity | How complex is it for its size? | nothing but the scan |
| | Composition | Is it hand-written, a test, generated, vendored or a header? | |
| | Language | What is it written in? | |
| | Clones | Is it a copy of something else? | |
| **Interconnectivity** | Callers | How many things call it? | a language whose calls are read |
| | Reach | How much does it call out to? | |
| **Activity** | Blame | Who committed to it last? | git history |
| | Age | How long since anyone touched it? | |
| | Churn | How much has it changed lately? | |
| **Assessment** | Predictability | How much could a reader predict? | readings |
| | Legibility | What was reading it actually like? | |
| | Docs | What has nobody explained? | |
| | Traps | What will bite whoever edits it next? | |

Click a wedge to drill in. The side panel explains what the lens says about it and shows the
code. The findings list, the rules editor and verdicts are all in the window too.

**History** replays the repo one commit at a time. Scrub to any commit and the rings grow,
shrink and recolor as the code did. Because `.sanity/` is committed, the reading lenses work
during a replay too: each frame shows what the repo knew about itself at that commit.

**Export**: a PDF **report** that stands alone like a paper (cover, methodology, a section per
lens, findings grouped by where they are), a shorter **brief**, a 16:9 **deck**, and the
replay as an MP4. File → Export Report as PDF… (⇧⌘E).

Sanity parses 63 languages with tree-sitter, including Rust, TypeScript, Python, Go, Swift, C,
C++, Java, Kotlin, C#, Ruby, PHP, Elixir, Scala, Zig, Haskell and shell. Files in other
languages still appear on the map, but without functions on the rim.

## Building from source

```sh
just setup                      # once: frontend deps and the Tauri CLI (needs Rust and Node)
just dev                        # the app
just cli findings ../some-repo  # the CLI, built from this checkout
```

On Linux, install the WebKit and GTK development packages first:
`libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev`.

`just check` type-checks. `just test` runs exactly what CI runs, in the same order, so if it
passes, CI passes.

[docs/](docs/README.md) has the rest: the architecture, one note per area, and the plans,
finished and open.
