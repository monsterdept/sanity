# sanity — notes for Claude

A Tauri app that draws a repo as a DaisyDisk-style sunburst. **Width is lines. Colour is
surprise.** Part of the monster dept (`sanity.monster`).

**Get up to speed:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the metric and what
it refuses to claim are the whole design.

## The metric is the product

The sunburst is not the product; anyone can draw a treemap of LOC and several people
have. What makes this worth building is the second encoding: **boilerplate is code a
model can predict from its context.** Everything below defends that.

- **Temperature IS surprise.** It used to be `surprise × (1 − explained)`, and that
  double-counted: documentation now reaches the *instrument* — the comment stack is in
  the model's prompt, and an agent is handed the docs before it predicts — so a doc that
  explains the body already lowers the surprise. Discounting it again afterwards was
  charging for the same thing twice. The map still drains as you document; it drains
  because the next reading is genuinely less surprising.
- **Documentation is graded, never counted — and it is a report, not a discount.**
  The old lexical `explained` could only reward vocabulary OVERLAP, so a confidently
  wrong comment sharing words with the code *cooled* the wedge. Exactly backwards:
  stale docs are the common failure and must read hot. Through the prompt they do —
  the model predicts what the comment describes, the body doesn't match, surprise
  rises. `heuristic::documented` survives as the offline fallback and still subtracts
  the signature's vocabulary from both sides, so a comment restating the function name
  covers nothing. There is a test named for it — keep it passing.
- **Model-authored text must not cool a wedge.** If a model could write the explanation
  from the code alone, the explanation was already latent in the code and the wedge was
  never hot. The degenerate failure this prevents: run an LLM over the repo, everything
  turns green, the map is a liar. There is deliberately no `Provenance` variant with
  weight for model-written docs — and the agent path asks the question outright, as
  `derivable`, which is the one form of it a lexical score could never evaluate.
- **Surprise alone can't tell brilliance from mess.** Both are unpredictable. Age and
  churn (`churn.rs`) are the second axis; the four quadrants come from the pair. A repo
  with no git history gets a visible warning, never a confident-looking half-verdict.
- **Never let a term claim confidence it hasn't got.** Every measurement returns
  `UNDECIDED` (0.5) when it's out of evidence. They all degrade in the same direction on
  short input, so untreated they compound — the first real scan ranked `fn main()` as
  tally's most surprising code. Equally, don't "fix" that with a global length penalty:
  that just makes the map say "long means hot", which is measuring length again.

## The model is where the real metric lives

`OllamaModel` forces the decode onto the real body's tokens (a `const` JSON schema
compiles to a grammar admitting exactly one string) and averages their surprisal. That is
the actual metric; the offline proxy is a stand-in.

It is measured, not assumed: on krapow it scores **6/15** against a raw `wc -l` sort where
the proxy scores 9/15, and the cobra boilerplate that four earlier designs ranked at
96-98° drops off entirely. `surprise.rs` carries the full table of what failed first.

Do not go back to generating a rival body and diffing it. That was tried three ways and
the noise floor sits above the signal — a model never reproduces real code token for
token whether or not the code was predictable.

## Calibration is evidence, not taste## Calibration is evidence, not taste

`heuristic::calibrate` maps the raw mix onto the reported scale. It is monotonic — it
changes no ordering — but the band and exponent are a standing claim about real code,
measured on tally, slooth and krapow. **`just scan <repo>` prints a histogram; read it
before and after touching those constants.** A flat or saturated spread means the metric
is measuring nothing and the rankings are decoration.

## Assessments are committed, and they expire

Agent readings live in **`.sanity/`** in the scanned repo (`assessment.rs`) and nowhere
else. **The Markdown is the store**, parsed back on open; don't add a JSON file beside
it, because the readable copy is the one that would end up wrong. It is not slow — 5,000
readings (1.4 MB) parse in 30ms, once, on open.

- **One home, no fallback, no migration.** `reports.rs` used to keep a permanent second
  copy, which made deleting `.sanity/` appear to do nothing — the map came back from a
  file the user could not see, holding an *older* set of readings. Don't reintroduce a
  mirror "for safety": a user who cannot tell which copy they are looking at is worse off
  than one who lost a file.
- **The migration that replaced it destroyed a project's readings. Read this before
  writing another one.** It matched legacy entries by node id; node ids embed `@line`;
  the lines had moved. So it wrote almost nothing, that write returned `Ok`, and the code
  deleted the source because `Ok` looked like proof. Two rules fall out: never key
  anything durable on a node id (that is what `key_of` is for), and never gate a
  destructive step on a write returning `Ok` — read the result back and check it.
- **A failed write is reported, never absorbed.** `save_reports` returns an error and the
  `report` handler puts it in `ok`/`error`/`hint` so the agent stops. Silently diverting
  to a hidden file is how a reading looks saved and isn't.

- **Keys are `key_of(path, name, ord)`, never the node id.** Node ids carry `@line` and
  would orphan every reading the moment somebody adds an import. `path#name` alone is
  NOT unique — Swift files hold a dozen `init`s, Rust files hold same-named methods in
  different `impl` blocks — so the second twin takes `#2`, the third `#3`, by position in
  the file. Assuming uniqueness cost 91 functions and two false expiries on one real
  Swift repo; `same_named_functions_in_one_file_stay_apart` is the test, keep it passing.
- **`save` iterates live functions, not reports.** Walking the reports means resolving
  each back to a function by name, which is where twins got confused. From the function
  side each looks up its own reading and compares against its own body.
- **Staleness replaces an update mode.** Each entry records `body_hash` of the body it
  was read against; a mismatch marks it STALE and `collect_tasks` queues it ahead of
  anything unread. So "update my sanity assessment" needs no new verb. The hash collapses
  whitespace on purpose — a reformat must not expire a repo's honest work.
- **Provenance is stamped server-side.** `body`, `by` and `at` are filled in the `report`
  handler from the scan and from git, never taken from the agent. The one field whose job
  is to be checkable later cannot be self-certified.
- **Never let a reader see `.sanity/` before it predicts.** Being told what the last
  reader found is recall, not prediction — the same contamination `cold` exists to
  expose. The MCP descriptions say so; keep them saying it.
- Nothing is user-scoped. `by:` is provenance to read, not ownership; anyone with the
  repo extends anyone's assessment.
- **A stale reading must not colour its wedge.** `applyAgentReports` drops its score and
  the wedge falls back to the proxy; a hatch (`#stale-hatch`) marks it, and the reading
  stays in the panel as history. Keeping the old colour would be the same sin as a term
  claiming confidence it hasn't got. `node.proxyScore` exists only so this is reversible
  — reports fold into the already-folded tree, so the number being restored has to have
  been kept. Don't drop it because "a rescan supplies a fresh tree anyway"; that is
  ordering luck, not a guarantee.
- **`assessed` excludes stale, everywhere.** `collect_tasks`, `ProjectSummary` and the
  sidebar all agree, so nothing can read as finished while holding expired work.

## The tool contract is part of the metric

`mcp.rs`'s `inputSchema` is not documentation — it is what the reader is allowed to say.
It drifted from `Report` and silently ate four fields: the protocol asked for `predicted`,
`documented`, `derivable` and `model`, Rust could store all four, and the schema declared
none of them. Careful readers printed the grades into chat, where they were lost, and
`predicted` was collapsed into the `surprised` boolean. **`derivable` is the defence
against generated docs counting as documentation — it was being collected and discarded.**
When a field is added to `Report`, add it to the schema in the same commit.

- **Never report coverage off a lease-filtered list.** `done`/`remaining` did, so 34
  functions out with readers read as finished under "every function has an up-to-date
  reading". `work_left` returns `(remaining, in_flight)`: remaining ignores leases and
  only falls when a reading lands. An instrument that overstates its own coverage is worse
  than one that measures nothing.
- **Coldness is the queue's job, not the reader's.** `interleave_by_file` round-robins
  across files, because scores cluster by file (distinctiveness is file-local) and a
  reader handed 25 from one file is recalling after the first. `cold` is self-reported and
  should be a check, not the mechanism.
- **Errors must say what to do.** A reader that hit the old flat "Sanity is not running"
  invented a prerequisite, another ran the tools as shell commands, another read
  `.sanity/` to compensate — contaminating itself. `UNREACHABLE` (transient, retry) is
  separate from `NOT_RUNNING` (never started) for that reason. Models fill silence with
  invention.

## Conventions

- Stack: Tauri 2 · React 19 · Vite 7 · Tailwind v4 · tree-sitter · rayon.
- Frontend ↔ Rust is Tauri **`invoke`** (`src-tauri/src/commands.rs`) — no server, no
  sidecar. Same as tally.
- `just check` (Rust + TS type-check), `just test` (the full CI-equivalent, in CI's
  order — web build + `cargo test` + clippy `-D warnings`; passing ⟹ CI passes).
  `just scan <path>` is the headless scorer and the fastest way to test a change to the
  metric.
- **Never launch the app yourself** — `just dev` opens a window; that's the human's to
  run. Verify with check/test/scan.
- `web/src/lib/mascot.js` is a committed placeholder. `just mascot` replaces it with the
  real bundle from the private lapbar/neo-mascots repo; the placeholder exists so a
  fresh checkout and CI both build without SSH access to that org. Don't delete it.
- New language = a `Lang` variant, a grammar in Cargo.toml, an entry in
  `parse::func_kinds`, and a test in `parse.rs`. The kind names are matched literally,
  so a grammar bump that renames a node goes red rather than silently returning nothing.

## Commits

Never commit without being explicitly asked — every time. Never add co-author credit.
