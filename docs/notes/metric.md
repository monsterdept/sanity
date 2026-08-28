# The metric

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


## The real metric arrives from readers, not from a scorer

The app scores with the offline proxy and takes its actual measurement from agents over
MCP. **There is no model path in the app** — `OllamaModel` was removed, endpoint and all,
because configuring a model is configuration rather than revelation. `local.rs` keeps a
no-server scorer behind `--features local-metal` for `just scan`; that is where metric
work belongs.

Forced decoding was real and was measured — on krapow it scored **6/15** against a raw
`wc -l` sort where the proxy scores 9/15, and the cobra boilerplate four earlier designs
ranked at 96-98° dropped off entirely. `surprise.rs` and ARCHITECTURE.md carry the full
table of what failed first, in the past tense. Read it before rebuilding anything here.

**Which model reads is part of the measurement, so ask before the first wave — Sonnet
unless the user says otherwise, and don't ask if they already named one.** Surprise is
what *a competent reader* could predict, so the reader IS the scale: a smaller model is
surprised by more, and its readings are not comparable with what is already banked.
Never mix models within one repo to save money — that produces one map on two scales with
nothing on screen saying which wedge is which. `model` is on every reading so the question
stays answerable later; a mixture is merely unreadable. This is reasoning and not yet a
measurement — an interleaved wave of two models over the same functions would settle it,
and `model` is recorded for exactly that, the way `position` is.

**Do not go back to generating a rival body and diffing it.** That was tried three ways
and the noise floor sits above the signal — a model never reproduces real code token for
token whether or not the code was predictable.


## Calibration is evidence, not taste

`heuristic::calibrate` maps the raw mix onto the reported scale. It is monotonic — it
changes no ordering — but the band and exponent are a standing claim about real code,
measured on tally, slooth and krapow. **`just scan <repo>` prints a histogram; read it
before and after touching those constants.** A flat or saturated spread means the metric
is measuring nothing and the rankings are decoration.

