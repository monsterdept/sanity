# Sanity

**Sanity measures how well a coding agent can predict each function in a repo from its
context, and points out the code it couldn't.**

A coding agent is shown each function's name, signature, neighbors and comments, but not its
body, and predicts what it does. Then it reads the code. Where the prediction held, the code
is probably routine. Where it missed, something in the code isn't evident from its name,
signature or comments, and the next person to read it, or the next agent, is likely to miss it
too. When the reader finds something likely to break for the next person who edits it, with
nothing in the code warning about it, it records a **trap**.

It's for anyone maintaining a codebase, including one an agent wrote. Sanity doesn't send
your code anywhere: the agent you already use does the reading, and the results are saved as
Markdown in your repo.

How the pieces fit:

- **Readings** measure each function: how well a reader predicted it, how hard it was to
  follow, and any traps.
- **Rules** combine readings with size, dependencies and history to produce **findings**.
- **Decisions** record what you chose to do about each finding.
- **`sanity verify`** checks, in CI, that the readings still describe the code.

All of it is committed with the repo, so it goes wherever the code goes.

![The map, colored by predictability](docs/images/map.png)

## Understanding a repo

Sanity draws the repo as a sunburst: the repo in the middle, directories and files as rings
around it, and every function on the outer edge, sized by its line count. You choose what the
color shows: how well an agent could predict the code, how hard it was to follow, whether
it's documented, how complex it is, what calls it, who worked on it last, how old it is, how
often it changes, and more. Click any function to see its code and everything Sanity knows
about it. **History** replays the repo one commit at a time, so you can watch it grow.

![A function's reading in the side panel](docs/images/reading.png)

The most useful of these measurements come from **readings**, the predictions described
above. Besides how far off its prediction was, each reading records how hard the code was to
follow, whether the comments helped, and any traps the reader found.

## Finding what needs work

Sanity also gives you a list of specific places that need attention, and says why each one
is on it. For example:

- a 1,000-line function that a reader had to go back over more than once to follow
- a function twenty others depend on that nobody has read
- a function whose comments describe something other than what it does
- a trap in code people are still editing: something a reader expects to break for the next
  person who edits it, with nothing in the code to warn them
- code copied into several places, where one copy changed and the others didn't

Each item is a **finding**, and each finding comes from a **rule** that combines a few
measurements, like "over 200 lines, and hard to follow" or "depended on by ten or more
functions, and undocumented." Sanity comes with about two dozen rules, and you can change
their thresholds or turn them off for your repo.

<img src="docs/images/findings.png" alt="The findings list" width="640">

```
$ sanity findings --limit 2
/Users/you/projects/sanity  14 findings

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

You decide on each finding: fix it, snooze it until the code changes, mark it wrong, or
accept it. Decisions are committed with the repo, so the list gets shorter as you work
through it, and anyone who picks up the repo sees the same list you do.

A hard-to-predict function isn't always a problem. It might be a careful algorithm or it
might be a mess. Git history helps tell them apart:

|  | **Rarely changes** | **Changes often** |
|---|---|---|
| **Hard to predict** | Probably intricate and important. Document it and be careful with it. | Probably a problem. |
| **Easy to predict** | Routine. Worth a look only if there's a lot of it. | Routine work. Usually fine. |

## Getting started

```sh
brew install --cask monsterdept/tap/sanity
cd your-repo
sanity init --harness claude --model sonnet   # which agent reads, and with which model
sanity check --limit 50                       # take 50 readings
sanity                                        # open the app
sanity findings                               # what needs work, and why
git add .sanity && git commit -m "Readings"
```

## Changing the rules

`.sanity/rules/README.md` lists every rule that ran: its name, the conditions it checks, and
what it says about a match. That file is regenerated on every scan.

To change a rule for your repo, edit its line in `.sanity/rules/catalog.md`. Change a number
and it's used as written. Add `; off` to turn the rule off. Delete the line to go back to the
default. The rules editor in the app makes the same changes.

If the list is too long or too short to be useful, `sanity findings balance --target 20`
suggests thresholds that would give about 20 findings, and `--apply` saves them.

## What you need

- **Sanity itself.** See [Installation](#installation).
- **A coding agent, installed and signed in**, to take readings: Claude Code (`claude`), Codex
  (`codex`), OpenCode (`opencode`) or Antigravity (`agy`). Sanity never calls a model itself and
  doesn't need an API key.

Everything except taking readings works without an agent: the map, findings from the parts
that don't need readings, history and `verify`.

**What readings cost.** Cost depends on how many functions and file headers there are to read,
and how long they are. `sanity status` shows how many are left.

| Reader | Per function | 1,000 functions |
|---|---|---|
| Claude Code | ~5,300 tokens | ~5M tokens |

That is the only reader measured so far: about 23,000 tokens for a reader to start, then about
3,000 per function, at ten functions per session. Other agents and models haven't been measured.

A cheaper reader isn't a cheaper version of the same measurement (see
[why trust the signal](#why-trust-the-signal)). Start with `sanity check --limit 50`
to see what a pass is like before reading everything.

<img src="docs/images/read-dialog.png" alt="Starting a reading pass: the agent, the model, and what the pass will cover" width="480">

To leave parts of a repo out, list them in a `.sanityignore` at the root. They're still drawn
on the map, but they aren't read and don't count toward coverage.

## The CLI

Every command takes a repo path and defaults to the current directory, and `sanity <command>
--help` lists its options. [docs/cli.md](docs/cli.md) covers every command: taking readings,
seeing results, deciding on findings, verifying, exporting, and the MCP server.

## Installation

| Platform | Download |
|---|---|
| macOS (Apple silicon) | `brew install --cask monsterdept/tap/sanity`, or the `.dmg` from [sanity.monster](https://sanity.monster) |
| Linux x86-64 | `.deb` or `.AppImage` from [sanity.monster](https://sanity.monster) |
| Windows x86-64 / arm64 | `.exe` installer from [sanity.monster](https://sanity.monster) |

The app and the CLI are one program. The Homebrew cask puts `sanity` on your `PATH`. If you
installed another way, open the app and press **Install sanity command** on the welcome
screen. It links `sanity` into `/usr/local/bin` or `~/.local/bin`. Don't add the app bundle
to your `PATH` or make an alias for it: other programs it needs live next to it, and scripts
can't see aliases.

## In CI

You take readings on your own machine, against the code you're about to ship, and commit
them. CI doesn't take readings, because that would mean putting model credentials in CI. It
only checks what you committed. `sanity verify` fails unless the readings are:

- **complete**: every function and file in scope has a reading;
- **current**: no reading is out of date for the code that's checked out, and none was taken
  with an older version of the questions;
- **from one model**: every reading was taken with the same agent and model. `--model` and
  `--harness` require a specific one. `--mixed` turns this check off but still prints what
  was used.

`verify` doesn't need git history, network access or credentials.

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
      - uses: actions/checkout@v7
      - uses: monsterdept/sanity-action@v1
        with:
          version: 0.31.2          # the Sanity release your team reads with
          model: claude-sonnet-5   # optional: require this model
          # harness: claude        # optional: require this agent
          # path: services/api     # optional: a repo in a subdirectory
          # consistent-reader: false   # optional: allow mixed models
```

**Pin `version`.** A new release can change the parser or the questions, which can make
existing readings out of date. Pinning means your check only changes when you decide to
upgrade.

To check releases instead of pull requests, add the job before your build with `needs:`.
Sanity checks its own releases this way: see
[`.github/workflows/readings.yml`](.github/workflows/readings.yml).

### Other CI systems

Download the `.AppImage` for your pinned version and run it:

```sh
curl -fsSLo sanity https://dl.dept.monster/sanity/Sanity_0.31.2_amd64.AppImage
chmod +x sanity
APPIMAGE_EXTRACT_AND_RUN=1 ./sanity verify "$PWD"   # use an absolute path: the AppImage starts in its own directory
```

`APPIMAGE_EXTRACT_AND_RUN=1` is needed on runners without `libfuse2`.

## Why trust the signal

Sanity works from a hypothesis: routine code is code a model can predict from its context. If
a reader predicts a function well, there probably isn't much in it you'd need to learn. If it
doesn't, something in there isn't obvious. This is a working assumption, not an established
result.

Sanity doesn't measure correctness, security, performance or whether the architecture is
right. A model can predict code that's wrong, and be puzzled by code that's fine. Readings
tell you where the code is surprising, and the history matrix
[above](#finding-what-needs-work) helps tell intricate from messy.

Comments are part of the context the reader predicts from. A comment that explains an
unusual function helps the reader predict it, so the function scores better. A comment that
just restates the code (`// increments the counter`) doesn't help. A comment that's out of
date makes things worse: the reader predicts what the comment says, and the code does
something else. Readers also note whether a comment could have been written from the code
alone. By default those comments don't count as documentation, so generating comments with a
model won't improve the numbers.

**The model you read with sets the scale.** Different models give different readings. A
smaller model is surprised by more, and in one comparison a weaker model also graded its own
misses more leniently. So readings from different models can't be compared. Sanity records
the model and agent for every reading. Use one model for a repo, and `verify` will check that you did.

Each reader runs as its own process, outside the repo and without your project settings, with
only the tools it needs. This matters: an agent that has already been working in the repo
knows what the code does, and its "predictions" would just be memory.

Sanity never calls a model and needs no API key. The agent you already use does the reading,
and sends what it reads to its own model, as it would in any other session. Readings expire
when the code or comments they describe change (see [below](#readings-live-in-the-repo)), and
`verify` catches any that are missing, stale or from a different model.

## Readings live in the repo

A reading takes an agent minutes and can't be recreated exactly, so Sanity keeps readings
in the repo they describe, at `.sanity/`, as Markdown meant to be read by people. Open
`.sanity/readings/*.md` and you'll see something like notes from a code review.

- **There's one file per top-level directory**, in source order, so two people taking
  readings in the same repo don't get merge conflicts.
- **Readings expire.** Each one records a hash of the code and comments it was taken
  against. When those change, the reading is marked stale and goes to the front of the queue.
- **Anyone can add to them.** Each reading records who took it, with which model and agent.
  That's a record of where it came from, not ownership.

`.sanity/rules/` holds the rules that produce findings, and `.sanity/findings/decisions.md`
holds your decisions. Please don't edit readings by hand. An edited reading describes a
measurement nobody took.

## The app

`sanity` with no arguments opens the app. The repo is in the center, directories and files
are rings around it, and functions are on the outer edge. A wedge's width is its size in
lines. Its color depends on which lens you pick:

| Group | Lens | What it shows | Needs |
|---|---|---|---|
| **Code shape** | Complexity | How complex it is for its size | only the scan |
| | Composition | Whether it's hand-written, a test, generated, vendored or a header | |
| | Language | What language it's in | |
| | Clones | Whether it's a copy of other code | |
| **Interconnectivity** | Callers | How many things call it | a language whose calls Sanity can read |
| | Reach | How much it calls | |
| **Activity** | Blame | Who changed it last | git history |
| | Age | How long since it changed | |
| | Churn | How much it has changed recently | |
| **Assessment** | Predictability | How well a reader predicted it | readings |
| | Legibility | How hard it was to read | |
| | Docs | What isn't explained | |
| | Traps | What's likely to trip up the next person who edits it | |

Click a wedge to zoom in. The side panel explains what the lens says about it and shows the
code. The findings list, the rules editor and your decisions are in the app too.

**History** replays the repo one commit at a time. As you move through commits, the rings
grow, shrink and change color the way the code did. Because `.sanity/` is committed, the
reading lenses work in a replay too: each commit shows the readings that existed at that
point.

https://github.com/user-attachments/assets/c7cd432e-bb55-49fd-ae9a-8ac7a7306932

**Export** makes a PDF report (methodology, one section per lens, and findings grouped by
where they are), a shorter brief, a 16:9 slide deck, and an MP4 of a replay. Use File →
Export Report as PDF… (⇧⌘E).

Sanity parses 63 languages with tree-sitter, including Rust, TypeScript, Python, Go, Swift, C,
C++, Java, Kotlin, C#, Ruby, PHP, Elixir, Scala, Zig, Haskell and shell. Files in other
languages still show up on the map, but without functions.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers building from source and running the same checks CI
runs.

[docs/](docs/README.md) has the rest: the architecture, one note per area, and plans (finished
and open).
