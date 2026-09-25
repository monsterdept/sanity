# Sanity

**Your repo as a map.** Sanity draws a codebase as a DaisyDisk-style sunburst: the
repo at the center, directories and files as rings around it, and every function on the rim.
The width of a wedge is its size in lines, and its color is whichever question you are asking.

Generating code got cheap, so understanding it became the bottleneck. Sanity is for the
person who can build anything and no longer knows what they have built.

```
brew install --cask monsterdept/tap/sanity
```

Or download it for macOS, Linux or Windows from <https://sanity.monster>.

## Thirteen lenses

A lens is one question, painted across the whole map. They come in four groups, ordered by
what an answer costs. The first group answers the moment a repo opens, and the last needs a
reading.

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

Click a wedge to drill in. The side panel explains what the lens says about it, and it shows
the code.

Sanity parses 63 languages with tree-sitter, including Rust, TypeScript, Python, Go, Swift,
C, C++, Java, Kotlin, C#, Ruby, PHP, Elixir, Scala, Zig, Haskell and shell. A file in any other
language still takes its place on the map. It just has no functions on the rim, because
Sanity did not read it.

## The metric: predictability

Anyone can draw a treemap of lines of code. The lens that makes this worth building is
**Predictability**:

> Boilerplate is code a model can predict from its context.

A coding agent is shown a function's name, signature, neighbors and comments, **but not its
body**, and writes down what it expects the function to do. Then it opens the file and
reports the gap. A predictable body is scaffolding. A surprising one is where the decisions
are.

Documentation is part of the context the reader predicts from. A comment that really
explains a surprising body makes it predictable, so the wedge cools on the next reading.
`// increments the counter` over a subtle retry loop cools nothing. A stale comment makes the
wedge hotter, because the reader predicts what the comment describes and the body does
something else. Comment volume can't game it. And a reader records whether a comment could
have been written from the code alone. By default, a comment like that doesn't count as
documentation on the Docs lens, so running a model over the repo can't turn the map green.

Surprise alone can't tell a subtle algorithm from a mess, so git history supplies a second
axis:

|  | **Stable** | **Churning** |
|---|---|---|
| **Surprising** | Crown jewel: document it, don't touch it | Trouble: the mess |
| **Predictable** | Bloat, if there is a lot of it | Quiet: ignore it |

## Findings

A single lens shows you extremes. The useful signals are the combinations the eye can't
hold at once: big and baffling, load-bearing and unread, documented and still hot, clones
whose copies have drifted apart. **Findings** are rules over the lenses, such as
`func: dependents >= 20 and read < 1`. Each repo can tune the catalog in the rules editor.
Each finding gets a verdict: it needs doing, it is fine for now (which expires when the code
changes), it is always fine, or it is a false positive (which expires when the rule
changes). The rules and the verdicts are both committed to the repo.

## History

Sanity reads the repo's git history onto the map in stages. A quick log walk gives age,
churn and authors per file. Per-line blame refines that down to each function. The full
replay regrows the map one commit at a time.

**History** plays that replay back. Scrub to any commit and the rings grow, shrink and
recolor as the code did. Most lenses keep working during a replay, including the
reading lenses: `.sanity/` is committed, so a frame shows what the repo knew about itself at
that commit. A replay can be exported as an MP4 movie.

## Readings live in the repo, in `.sanity/`

A reading takes minutes of an agent's time and can't be recomputed, so Sanity doesn't
keep it in an app-support folder on one laptop. Readings are committed to the repo they
describe, at `.sanity/`, as Markdown meant to be read: open `.sanity/readings/*.md` and it
reads like notes from a code review.

- **One file per top-level directory**, ordered by position in the source, so two people
  reading one repo don't produce merge conflicts.
- **Readings expire.** Each one records a hash of the body and comments it was made against.
  When the code moves, the reading is marked stale, its wedge stops being colored and gets a
  hatch instead, and it goes to the front of the queue for re-reading.
- **Anyone with the repo can extend anyone's assessment.** A reading names who took it,
  with which model and which agent, as provenance rather than ownership.

`.sanity/rules/` holds the findings catalog, and `.sanity/findings/decisions.md` holds the verdicts on
findings.

## Who does the reading

Sanity runs the readers. You need a coding agent installed and signed in: Claude Code,
Codex, OpenCode or Antigravity. Each reader is a separate process, started outside the repo
without your project settings, and given only the tools it takes a reading with. That is what
makes a reading a prediction rather than a recollection. A session that has been working in
the repo already knows the answers.

**Which model reads is part of the measurement.** A smaller model is surprised by more, so
the model is the scale. Sanity records the model and agent behind every reading, and a repo
should be read by one model throughout.

Sanity itself never calls a model and needs no API key or endpoint. Until a repo has been
read, an offline heuristic decides which functions are offered to readers first. It never
colors the map.

## The CLI

The same binary runs without a window:

```
sanity init --harness claude --model sonnet   # pick the agent and model that read this repo
sanity check                                  # start a reading pass (--readers N, --limit N, --detach)
sanity status                                 # what is out with readers, and how much is read
sanity summary                                # what the readers found
sanity findings                               # what is worth looking at, and why
sanity trace                                  # read git history onto the map (--blame, --edits)
sanity callers src/lib.rs#parse               # who calls one function, by name
sanity export-data                            # everything the report reads, as JSON
sanity refresh                                # rewrite .sanity/ in the current format
sanity verify                                 # fail unless readings are complete, current, one model
```

`sanity` with no arguments opens the window. `sanity mcp` is a stdio MCP server that lets a
chat agent open a project and read back its status and summary. It can't take readings. Its
context is full of the repo, so anything it graded would be recall.

## In CI

Readings are taken by developers, against the code they are about to ship, and committed.
CI never takes them, because that would mean model credentials in CI. What CI can do is
refuse a release that ships without them. `sanity verify` exits non-zero unless:

- **complete**: every function and file in scope has a reading;
- **current**: none is stale against the code as checked out, and none was taken under an
  older version of a question;
- **one instrument**: every reading names the same agent and model. `--model` and `--harness`
  pin which one; `--mixed` waives the check and still prints the mix.

It needs no git history and no network. As a GitHub Action, on a Linux x86-64 runner:

```yaml
- uses: actions/checkout@v4
- uses: monsterdept/sanity-action@v1
  with:
    version: 0.31.0          # the Sanity release your team reads with
    model: claude-sonnet-5   # optional
```

Pin `version` to the release your team reads with. A release that changes the parser or a
question can expire readings, and the gate shouldn't move unless you move it.

## Export

- **PDF**, in three forms: a **report** that stands alone like a paper (cover, methodology,
  a section per lens, findings grouped by where they are on the map), a shorter **brief**,
  and a 16:9 **deck**. File → Export Report as PDF… (⇧⌘E). The PDFs are vector and
  searchable, and use embedded fonts.
- **Movie**: the History replay as an MP4.
- **Data**: `sanity export-data` writes everything the report is built from as JSON, and
  `just render <repo>` draws the PDFs from it without opening a window.

## Building from source

```
just setup    # once: frontend deps and the Tauri CLI (assumes Rust and Node)
just dev      # the app
just cli status ../some-repo
```

Linux needs the WebKit and GTK development packages from your package manager first.
`.github/workflows/release.yml` lists them.

`just check` type-checks. `just test` runs exactly what CI runs, in the same order, so if it
passes, CI passes. `just release <version>` tags and pushes. CI then builds macOS arm64, Linux
x86-64 and Windows x86-64/arm64, signs and notarizes the Mac bundle, and attaches everything to
a GitHub release. `just publish <version>` distributes it.

## Further reading

[docs/](docs/README.md) indexes the rest: the architecture, one note per area, and the plans,
both finished and open.
