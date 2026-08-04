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
