# sanity — notes for Claude

A Tauri app that draws a repo as a DaisyDisk-style sunburst. **Width is lines. Colour is
surprise.** Part of the monster dept (`sanity.monster`).

**Get up to speed:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the metric and what it
refuses to claim are the whole design.

This file is an index of rules. Each one is stated here in the form you have to obey; the
reasoning, the measurements and the failed alternatives are in `docs/notes/`. **Read the
note before changing anything in its area** — most of these rules exist because the obvious
alternative was built and thrown away, and the note is the only record of that.

| Note | Covers |
|---|---|
| [metric.md](docs/notes/metric.md) | What temperature means, why docs cool a wedge, calibration |
| [readers.md](docs/notes/readers.md) | Sanity spawns the readers; harness isolation, `SANITY_ROLE` |
| [budgets.md](docs/notes/budgets.md) | Scan / trace / read, estimates against a budget, the sidebar row |
| [assessments.md](docs/notes/assessments.md) | `.sanity/`, keys, staleness, `SPEC`, provenance |
| [mcp.md](docs/notes/mcp.md) | The tool contract, batching, queue, endpoint routing |
| [rings.md](docs/notes/rings.md) | Drilling, ring count, rim histograms, the color cap, folding |
| [time.md](docs/notes/time.md) | What Churn and Age are FOR, and why what they measure isn't it |
| [panel.md](docs/notes/panel.md) | The detail pane, per-lens sections, code tiles |
| [history.md](docs/notes/history.md) | Replay, timeline cache, movie export |
| [leads.md](docs/notes/leads.md) | Multi-lens leads, the rule grammar, `just leads`. **UI not built** |
| [conventions.md](docs/notes/conventions.md) | Stack, commands, languages, cache versioning, release gates |

## The metric is the product

Anyone can draw a treemap of LOC. The second encoding is what makes this worth building:
**boilerplate is code a model can predict from its context.**

- **Temperature IS surprise** — not `surprise × (1 − explained)`. Documentation reaches the
  instrument, so a doc that explains the body already lowers surprise; discounting it again
  charged twice.
- **Documentation is graded, never counted, and it is a report rather than a discount.**
  Stale docs must read HOT. `heuristic::documented` is the offline fallback; there is a test
  named for it, keep it passing.
- **Model-authored text must not cool a wedge.** There is deliberately no `Provenance`
  variant with weight for model-written docs.
- **Surprise alone can't tell brilliance from mess.** Age and churn are the second axis.
- **Never let a term claim confidence it hasn't got.** Every measurement returns `UNDECIDED`
  (0.5) when out of evidence — and don't "fix" the resulting compounding with a global
  length penalty, which just measures length again.
- **There is no model path in the app, and no local one either.** Local scoring (`local.rs`,
  `llama-cpp-4`, the `local-*` features) was deleted: local models were tried as readers and
  found lacking, and the headless scorer that was their only caller went with them. The proxy
  survives for one job — ordering which functions a reader is offered first. **Do not rebuild
  forced decoding or body-diffing** — both were measured and failed; `surprise.rs` carries the
  table.
- **Ask which model reads before the first wave** — Sonnet unless told otherwise, and don't
  ask if they already named one. **Never mix models within one repo.**

## Rules the picture breaks quietly

A wrong color is not a crash. Every one of these shipped, and shipped for months, because
the map went on looking like a map.

- **A merged rim segment names nobody.** The rim merges sub-pixel bands, and a merge is not a
  value: on a categorical lens it is `other` in the structural neutral, labelled with its
  count. It used to take its largest member's name and color, which drew a tail of 209 people
  as one person and made it the widest band on the wedge. Only sub-pixel runs merge, and only
  with each other — a wide band that absorbs its neighbours is wider than the value it names.
- **A tree written before the trace is an untraced tree.** `treecache::save` runs inside
  `scan()`, which the app calls at `Depth::Untraced`; `redraw` banks the drawable half again
  once the trace lands, carrying the stored signature over rather than recomputing it — a
  traced signature mixes HEAD and would make `warm` call a warm repo cold. `slim()` is
  idempotent for the same reason: a second slim used to return empty columns, which a rim
  drops silently rather than drawing as an absence.
- **A shortcut does what the control does — never less.** The keyboard refused a locked lens
  on the ground that the strip refused it too; the strip had since been made click-through and
  said so in its own comment, so ⌘1 was dead on a repo where clicking Surprise worked. The
  guards are `lib/keys.ts` now, a pure function, because a keyboard map is a pile of early
  returns whose ORDER is the behaviour: `just keys-check` presses every key in every state.
- **The end of a replay is the live map.** One ranking and one spelling per lens, in both
  modes: blame ranks over `stats.authors` everywhere, and a language is named by `Lang::label`
  on both sides of the wire. Two of each is a split brain that recolours the whole map the
  moment History opens, and it reads as a palette bug.
- **A roll-up carries a tally, or it says nothing — it never says what it cannot know.**
  A replay folds most of a frame into stand-ins (`rest` is the marker). Counting their lines
  as an absence drew ceph's own history as `no git history`; dropping them instead drew 0.27%
  of `src/pybind` as 100% of it. So the fold totals what it drops, per FILE — language, author,
  and `[days, commits, churn, lines]` for the two git ramps — and `contribute` bands it by
  calling itself, so a folded file and a drawn one cannot fall in different bands. Lenses with
  nothing at file resolution to answer them keep saying nothing. `aggregate` already skipped
  these nodes; any walk that buckets must too.
- **A new frame array is a new checkpoint field, in the same commit.** `bank` and `thaw` are
  explicit lists, so a field left out comes back EMPTY on a backward seek — which reads as a
  valid answer, not a failure. `replay-check` compares forward, backward and cold fold field by
  field; anything a frame writes belongs in its fingerprint.
- **A band says what it knows, never what the repo is.** `no git history` is a fact about a
  folder; a per-function null under Age or Churn means this map has no history for those
  lines, which on a traced repo is a different sentence entirely. Repo-level answers go on the
  lens (`locks`), once, beside the button that fixes them — never repeated on every segment.
- **How many colors a lens spends is the reader's choice, not a constant.** The palette went
  4 → 8 → 16 → 64 chasing two incompatible readings; `CAPS` lets the reader pick. Apply a cap
  to the RANKS and nowhere else — every surface already treats an unranked category as
  `other`, and a `cap` argument on six functions is six chances to disagree.

## Rules that cost a repo its data when broken

These are the ones with a body count. Each is written up in its note.

- **Never key anything durable on a node id.** Node ids embed `@line`. `key_of(path, name,
  ord)` is what keys a reading. A migration that keyed on node ids destroyed a project's
  readings.
- **Never gate a destructive step on a write returning `Ok`.** Read the result back and
  check it. That same migration deleted its source because `Ok` looked like proof.
- **There is no migrator, ever. `sanity refresh <repo>` is the whole mechanism** — the store
  is Markdown that is parsed back, so rewriting is reading and writing.
- **A `#[serde(default)]` field on a cached record IS a format change.** Bump the format
  version in the same commit. `file_doc` went into `scancache::Entry` without one and readers
  were handed no file header for months, silently.
- **A parser change is not a file change.** Every cache gates on file changes and none can
  see that the parser moved — bump `parse::PARSE_VERSION`.
- **When a field is added to `Report`, add it to the `inputSchema` in the same commit.** The
  schema is what the reader is allowed to say; drift there silently ate four fields.
- **`.sanity/` has one home, no fallback, no mirror.**
- **Never let a reader see `.sanity/` before it predicts.**

## Working here

- `just check` (Rust + TS type-check), `just test` (full CI-equivalent; passing ⟹ CI passes),
  `just cli <verb> <path>`, `just tokens` (before and after touching tool descriptions),
  `just expiry` (does this release expire readings), `just history <repo>`,
  `just rim-check` (what a rim segment may claim) and `just keys-check` (every shortcut, in
  every state) — the frontend has no test framework, so a rule that can be wrong invisibly
  gets a bundled script.
- **Never launch the app yourself** — `just dev` opens a window; that is the human's to run.
- **Check that a regression test fails without its fix.** Where threads make the
  discriminating moment unstageable, pin the arithmetic instead and label the threaded test
  honestly as covering plumbing only.
- **A proxy is not a measurement.** Sample the real process (`sample <pid>`) rather than
  inferring; two proxies cost a wrong conclusion each here.
- **Never resolve a tool by bare name** — a GUI app does not inherit your shell's PATH.
  `Harness::resolve` exists for this.
- **Read grammar node kinds off a real parse, never off memory.**
- `web/src/lib/mascot.js` is a committed placeholder; don't delete it.

## Commits

Never commit without being explicitly asked — every time. Never add co-author credit.
