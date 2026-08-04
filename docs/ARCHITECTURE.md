# Sanity — architecture

DaisyDisk showed you where your disk went. Sanity shows you where your *thinking* went.

The change it's built for: generating code got cheap, so comprehension became the
bottleneck. You can't prompt your way out of not understanding your own repo, because not
knowing what you don't know is the whole condition. That's the niche — not capability,
which the user already has in abundance, but judgement about their own work.

## The one invariant

**Width is lines. Colour is surprise. They are independent measurements.**

Size is the axis everyone copies and the axis that tells you nothing — you already know
your parser is long. Colour is the product.

## The metric

> Boilerplate is code a model can predict from its context.

Feed a function its name, signature and neighbours; measure how surprised the model is by
the body. Low surprise is scaffolding. High surprise is where the decisions are.

Two implementations sit behind `surprise::SurpriseModel`:

| | |
|---|---|
| `HeuristicModel` | The default. No model, no download, no network. |
| `OllamaModel` | Experimental. A local model, if one is running (`SANITY_OLLAMA_ENDPOINT` for a remote box). Not yet better than the proxy — see below. |

The heuristic is an honest **proxy** and the UI names whichever ran. It exists because a
tool that shows nothing until you install a 4GB model is a tool nobody sees the point of.
It mixes four terms (`heuristic.rs`):

1. **Distinctiveness** — how unlike its siblings the body is, by Jaccard overlap of
   token 3-gram shingles. The strongest term, because the dominant form of boilerplate in a real
   repo is the twelfth copy of the same handler and nothing else detects that.
2. **Vocabulary novelty** — how much the body talks about things its name and signature
   didn't already imply. The cheapest shadow of the real question.
3. **Incompressibility** — repetition is what deflate removes.
4. **Branch density** — decisions per line.

**The model path works, and it is measured.** `OllamaModel` forces the decode down the
real body's token path — Ollama's `format` takes a JSON schema, and a schema of
`{"type":"string","const": <the body>}` admits exactly one string, so the logprobs that
come back are the probabilities the model assigned to *the code the human actually
wrote*. That is perplexity, reached sideways: no endpoint will score supplied text
(checked on `/api/generate` and `/v1/completions`), but constraining generation to it is
the same arithmetic.

Four earlier designs failed first, all measured on krapow against the ranking overlap
with a plain `wc -l` sort — the yardstick `sanity-scan` prints, where the offline proxy
scores 9/15:

| variant | hot lines | vs `wc -l` | verdict |
|---|---|---|---|
| generate a rival body, diff it | 66% | — | saturated; 20 functions pinned at 100° |
| + weight by the model's confidence | 64% | — | ranking unchanged |
| + imports and siblings in the prompt | 64% | — | a test function still at 86° |
| the model's entropy alone | 20% | — | graded well, ranked the wrong functions |
| **forced decoding** | **32%** | **6/15** | **finds what size alone does not** |

They shared a cause: comparing a *generated* body to the real one has a noise floor above
the signal, because a model never reproduces real code token for token whether or not the
code was predictable.

Two corroborating signs, beyond the overlap number: the cobra command definitions that
sat at 96-98° in every earlier attempt drop off the ranking entirely, and heat decouples
from length — a 24-line function at 93° outranks a 107-line one at 50°.

**The cost is real.** Forced decoding is one decode step per token of every body scored,
so it is far slower than the proxy and slower than generating a fixed 192 tokens. The
`min_lines` floor is the dial, and everything under it stays uncoloured rather than
borrowing a proxy score.

## Temperature, and why the map drains

```
temperature = surprise
```

It was `surprise × (1 − explained)` and that was double-counting. Documentation now
reaches the **instrument** rather than the arithmetic: the model is given the comment
stack a reader would have, and an agent is handed the docs before it predicts. A comment
that genuinely explains the body makes the body predictable, so the surprise term has
already fallen — discounting it a second time charged for the same thing twice, and
showed the user two bars that were the same number on every undocumented wedge.

The map still drains as you document. It drains because the next reading is genuinely
less surprising, which is a stronger claim than a multiplier: it can be wrong, and you
can check it.

**It also fixes the direction of an error.** The old `explained` was lexical — it could
only reward vocabulary overlap between doc and body. So a confidently *wrong* comment
that happened to share words with the code raised it and **cooled** the wedge. Precisely
backwards, since staleness is the common documentation failure. Through the prompt the
sign flips: the model predicts what the comment describes, the body doesn't match, and
surprise goes **up**. Stale docs read hot, which is what makes the map self-invalidating
rather than merely drainable.

`documented` survives as a separate, reported number — how well the docs cover what the
code does, graded by the reader that read both. It is shown, not folded into the colour,
because "surprising and undocumented" and "surprising but well covered" are different
situations and only one of them is anyone's fault.

### Provenance, and the degenerate failure

A model-written comment must not cool a wedge. If the model could produce the explanation
from the code alone, the explanation was already latent in the code — cooling it is
circular. Without that rule, someone runs an LLM over the repo, everything turns green,
and the map is a liar. `Provenance` has no variant with weight for model-authored text,
and `Source` (a comment already in the file, author unknown) is discounted because
increasingly an agent wrote it.

What this **cannot** do is verify truth. A confidently wrong comment still cools a wedge;
surprise-reduction measures explanatory fit, not correctness. The mitigation is that the
common failure isn't fabrication, it's **staleness** — and staleness shows up for free as
a cooled wedge *reheating* when the code moves out from under its comment. The map
self-invalidates.

## The second axis

Surprise can't tell a subtle algorithm from an incomprehensible mess; both are
unpredictable. Age and churn separate them (`churn.rs`, one `git log` pass for the whole
repo):

|  | **Stable** | **Churning** |
|---|---|---|
| **Surprising** | Crown jewel — document, don't touch | Trouble — the mess |
| **Predictable** | Bloat (if bulky) / Quiet | Bloat / Quiet |

No git history means no second axis, and the UI says so rather than showing a
confident-looking half-verdict.

## Pipeline

```
scan.rs       walk (ignore crate → .gitignore for free), group files by directory
parse.rs      tree-sitter → functions with signatures and doc comments
heuristic.rs  the offline proxy + the measured doc-coverage term
surprise.rs   the model-backed scorer, when one is available
churn.rs      git history → the stability axis
model.rs      the tree, LOC-weighted aggregation, temperature, quadrants
```

Two decisions worth knowing:

- **Scoring is grouped by directory, not by file.** A function needs peers to be compared
  against and plenty of files hold exactly one. Without the directory fallback, every
  one-function-per-file codebase — which is most React frontends — loses the strongest
  term.
- **Node kinds are matched literally, not by tree-sitter query.** A query whose capture
  names drift with a grammar release matches nothing and returns a repo with no inner
  ring — an empty result that looks exactly like a clean codebase. Kind matching goes red
  in tests instead.

## Calibration

Averaging four partly-correlated signals is a central-limit machine: the raw mix occupies
a tidy bell centred near 0.60 on real code, so untreated the whole repo comes out
uniformly lukewarm. Worse, a bell is the wrong *shape* — the product's claim is that a
small fraction of a codebase is where the thinking lives, and no linear rescaling of a
bell is anything but a bell.

`heuristic::calibrate` fixes both with a monotonic curve (it changes no ordering). The
band and exponent are measured, not tuned by eye. **`just scan <repo>` prints the
histogram — that is the instrument, and it is the first thing to look at.** A flat or
saturated spread means the metric separates nothing and the rankings below it are
decoration.

## The assessment lives in the repo

An agent's reading is the one thing here that cannot be recomputed. A scan is a second of
Rust; a reading is minutes of a reader that will never see that code fresh again. So it
is the one thing that must not be stored where only one person can reach it — and for a
while it was, in `~/Library/Application Support/Sanity/reports/<hash>.json`, keyed by the
repo's absolute path on one laptop.

It now lives at **`.sanity/`, committed to the repo it describes** (`assessment.rs`).
Three decisions carry that:

- **The Markdown is the store, not a rendering of one.** It is parsed back in on open. A
  JSON file underneath would have been easier and would have disagreed with the Markdown
  within a week — and the readable copy is the one that would have been wrong. A reading
  is prose either way; there was never a machine format worth having.
- **One file per top-level directory, entries ordered by position in the file.** Two
  people assessing one repo is the case this is for, and append-ordered files conflict on
  every concurrent write regardless of content. Nothing is scoped to a user: `by:` on an
  entry is provenance to read, not a claim on it. Anyone with the repo can extend
  anyone's assessment.
- **Staleness is the lifecycle, so there is no update mode.** Each entry records
  `body_hash` of the body it was read against — whitespace-collapsed, so `cargo fmt`
  doesn't expire a repo's honest work. When the hash stops matching, the reading is
  marked STALE and `collect_tasks` hands it back out ahead of anything unread. "Update my
  sanity assessment" is therefore the same protocol as making one; the queue already
  knows which readings expired.

That last point is the drainable map's claim made durable. A reading that keeps looking
current after its code changed is exactly the failure the whole design refuses elsewhere
— a term claiming confidence it hasn't got.

### What a stale reading looks like

**It stops colouring its wedge.** `applyAgentReports` drops the score of an expired
reading and the wedge falls back to the offline proxy — which is what an unread function
looks like, because that is what it now is. Leaving the old colour up would be a number
claiming confidence it no longer has, the one thing this metric refuses everywhere else.

That alone would be invisible, so the wedge carries a **hatch**: a texture, not a hue,
because the ring already has exactly one colour encoding and a second would put two
scales on one picture. There is a standing rule here against per-wedge marks — a mark on
every wedge is stripes, not information — and it is the reason the hatch is fine: stale
is rare by construction, so it lands on a handful of wedges and the eye goes to them. If
most of a repo is ever hatched, most of the repo genuinely has expired readings and
saying so loudly is right.

The reading itself is kept and shown in the panel, above the prose it qualifies, with
who made it and at which commit. It is still true about the code it was made against;
it just isn't about this code any more.

Coverage counts follow: `ProjectSummary::assessed` excludes stale readings, the same
choice `collect_tasks` makes, so a project cannot read as finished while holding expired
work. A completed project that gains stale readings drops below full — and the sidebar
says why, because a bar going backwards with no explanation reads as lost work.

The hash is stamped server-side from the scan, never accepted from the reporter. A
staleness marker is the one field whose entire job is to be checkable later, so it cannot
be self-certified. And an agent must never be shown `.sanity/` before predicting: a
reader told what the last reader found is recalling, not predicting, which is the same
contamination the cold/warm flag exists to expose.

## Not built yet

Named here so the gaps don't read as oversights:

- **The contrastive summary.** *"Expected a thin wrapper that forwards to the client;
  found a hand-rolled backoff that swallows one error class."* This is the payoff for the
  whole perplexity approach — you can only write that sentence if you know what the model
  expected — and it needs the model-backed scorer.
- **The interview loop.** Asking "why is this like this?" and banking the answer at
  `Provenance::Human`. The only thing that legitimately cools the map all the way.
- **Non-code views.** Decision tables, side-effect inventories, prose that follows
  execution. Pseudocode is deliberately *not* the plan: it's usually just code with worse
  syntax, and the hard part was never syntax — it's holding the branching and the state.
- **The diff view.** Two scans, before and after. "Your agent added 11k lines here and
  you have never opened a file in it."
- **A results cache.** Every scan is currently from scratch.
