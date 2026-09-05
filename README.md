# Sanity

**DaisyDisk for code comprehension.** Your repo as concentric rings: width is lines,
colour is how much of it nobody saw coming.

Generating code got cheap, so understanding it became the bottleneck. Sanity is for the
person who can build anything and no longer knows what they've built.

```
just setup            # once
just scan ../slooth   # headless — the fastest way to see if the metric says anything
just dev              # the app
```

`setup` installs the frontend deps and the Tauri CLI, and assumes Rust and Node are already
there. macOS and Windows need nothing else; on Linux, the WebKit and GTK dev packages have to
come from your package manager first — `.github/workflows/release.yml` lists them.

## What the colours mean

A wedge is hot when its body is **surprising** — when little of it is predictable from
its own name, signature and **documentation**.

```
temperature = surprise
```

So the red drains as you document, and the tool has a finish line without ever touching
your code.

The explanation term is *measured*, not counted. `// increments the counter` over a
subtle retry loop cools nothing, because the comment says only what the signature already
said. `// upstream returns 200 with an error in the body` cools a lot. Comment volume
can't game it.

Surprise on its own can't tell a subtle algorithm from a mess, so git history supplies a
second axis:

|  | **Stable** | **Churning** |
|---|---|---|
| **Surprising** | Crown jewel — document, don't touch | Trouble — the mess |
| **Predictable** | Bloat, if there's a lot of it | Quiet — ignore |

## `just scan`

The headless scorer, and the honest one — it prints a temperature histogram before the
rankings. A healthy repo shows a long cold tail and a thin hot end. If every bucket is
full or everything piles into one, the metric is measuring nothing and the rankings are
decoration.

```
$ just scan ../tally
/Users/rturk/projects/tally — 49 files, 467 functions, 9788 lines · heuristic (no model)
  42% of lines are hot

TEMPERATURE SPREAD
    0-10  ██████████████████████████████████ 128
   10-20  █████████████                      50
   ...
   90-100 ████                               16

HOTTEST — surprising and nothing explains why
    74°  assess                        255L  trouble     src-tauri/src/dashboards.rs:433
    64°  run_entry                     159L  trouble     src-tauri/src/runtime.rs:313
    71°  check                          82L  trouble     src-tauri/src/standards.rs:61
```

Run it on something you wrote. If the hot list isn't roughly what you'd have named
yourself, the metric is wrong and no amount of sunburst polish saves it.

## Languages

Rust, TypeScript, TSX, JavaScript, Python, Go, Swift, C, C++, Java, Kotlin, C#, Ruby, PHP,
Lua, Elixir, Scala, Dart, Zig, Objective-C, shell and SQL. Files in other languages still appear as
wedges — they just have no inner ring and no score, which is honest: we didn't read them.

## Where the real reading comes from

The app itself needs nothing installed: it scores with an offline proxy that is honest
about being a proxy. The measurement worth having arrives from a **reading** — an agent
handed a function's name, signature and neighbours writes down what it expects, then opens
the file and reports the gap. Those readings are committed to the repo at `.sanity/`, and
they expire when the code moves out from under them.

Sanity runs the readers itself — one process per reader, started outside the repo, without
your project settings, and with no tools but the three it takes a reading with. That is
what makes a reading a prediction rather than a recollection, and it is why a run is
started by a person rather than by the agent you happen to be talking to: a session that
has been working in the repo already knows the answers.

You need a coding agent installed and signed in — `claude`, `codex`, `opencode` or `agy`.
Then either add the repo in the app and press Read, or:

```
sanity init --harness claude --model sonnet   # whichever agent and model you want reading
sanity check                                  # --readers N, --limit N, --detach
sanity status
sanity summary
```

**Which model reads is part of the measurement.** A smaller model is surprised by more, so
the reader is the scale; mixing two over one repo gives you one map on two scales with
nothing on screen saying which wedge is which. Every reading records the model and harness
that took it.

Registering `sanity mcp` with a chat client is optional and does not change any of the
above. It buys an agent the ability to open a project and read back the same status and
summary you get from the CLI. What it never buys is a reading taken by that agent: its
context is full of the repo, so anything it graded would be recall.

`just scan . --local <weights>` scores with a local model instead, no server involved —
built with `--features local-metal` (or `local-vulkan`). That path exists for working on
the metric, not for daily use; the app names whichever instrument produced the picture
you're looking at.

## Building

`just check` type-checks. `just test` is exactly what CI runs, in CI's order — if it
passes, CI passes. `just release <version>` tags and pushes; CI builds macOS arm64, Linux
x86-64 and Windows x86-64/arm64, signs and notarizes the Mac bundle, and attaches
everything to a GitHub release. `just publish <version>` distributes it.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the metric, what it refuses to
claim, and what isn't built yet.
