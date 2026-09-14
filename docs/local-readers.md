# Reading with a local model

## Summary

**`qwen3.8:27b` with thinking, on one RTX 3090, draws the same map Sonnet does** — as far as
100 functions can tell. Which functions it calls surprising sits inside Sonnet's own
run-to-run noise. It grades on a hotter scale than Sonnet, so its readings are a separate
corpus, never a supplement to a Sonnet one.

It is **slow**: 51 readings an hour, so widdlbox (1,239 segments) is ~24 hours on the card,
or ~$16 through OpenRouter. Sonnet reads the same repo in about an hour on a subscription.

**Thinking is the whole difference.** Forced off, the same model reads 4.4× faster (222/h,
~5.6 hours for widdlbox, ~$6) and its map falls back to where `qwen3.6:27b` was: measurably
short of Sonnet's floor.

None of this is usable as shipped. It runs through Claude Code pointed at Ollama, needed four
fixes to the reader stack and three changes to the Ollama service to get this far, and thinking
could only be turned off by a proxy. See *What had to be fixed*.

## Setup

widdlbox at `091d904`, one clone per pass under `~/sanity-ab/`, so no two readers share a
`.sanity/`. RTX 3090 (24 GB), 30 GB RAM, Claude Code 2.1.269. September 12–13, 2026.

| Pass | Model | Carrier | Thinking | Readings per session | Readers | Readings | Ollama |
|---|---|---|---|---|---|---|---|
| `sonnet-a` | `claude-sonnet-5` | Claude Code | default | 10 | 5 | 1,239 | — |
| `sonnet-b` | `claude-sonnet-5` | Claude Code | default | 10 | 5 | 1,239 | — |
| `qwen` | `qwen3.6:27b` | Claude Code → Ollama | on | 10 | 1 | 1,239 | 0.30.10 |
| `qwen38-fast` | `qwen3.8:27b` | Claude Code → Ollama | on | 1 | 2 | 101 used | 0.34.0 |
| `qwen38-nothink` | `qwen3.8:27b` | Claude Code → Ollama | not requested | 1 | 2 | 20 | 0.34.0 |
| `qwen38-off` | `qwen3.8:27b` | Claude Code → proxy → Ollama | forced off | 1 | 2 | 98 | 0.34.0 |

`sonnet-b` exists to measure the **noise floor**: how often Sonnet disagrees with itself. A
local model is judged against that, not against Sonnet as if Sonnet were ground truth.

`qwen38-fast` banked 124 readings; the 23 taken warm, before the one-reading cap was enforced
(see *A count in a prompt is a request*), are excluded, leaving 101 clean ones.

## Measured: does the map agree?

Agreement is on `predicted`, the grade that colours the map. "Surprising" means `some` or
`none`. κ is chance-corrected (0 = chance, 1 = identical); weighted κ counts near-misses as
partial agreement. Intervals are 95%, from 2,000 bootstrap resamples.

### qwen3.6, full repo (1,216 functions)

| | Sonnet vs Sonnet | Sonnet vs qwen3.6 | Gap |
|---|---|---|---|
| Grades (weighted κ) | 0.70 | 0.42–0.43 | 0.28 [0.23, 0.33] |
| Surprising or not (κ) | 0.61 | 0.24–0.26 | 0.36 [0.29, 0.43] |
| Shared surprising functions (Jaccard) | 0.51 | 0.20–0.21 | 0.30 [0.25, 0.36] |
| Files ranked alike (Spearman) | 0.61 | 0.24–0.25 | — |
| Share called surprising | 16% | 9% | — |
| Graded `none` | 24 and 34 | 5 | — |
| `derivable` (κ) | 0.28 | 0.08–0.10 | — |

### qwen3.8 thinking against the same functions (101)

| | Surprising or not (κ) | Shared surprising (Jaccard) |
|---|---|---|
| Sonnet vs Sonnet | 0.59 [0.39, 0.77] | 0.52 [0.37, 0.67] |
| **qwen3.8, thinking** | **0.47** [0.31, 0.62] | **0.44** [0.33, 0.55] |
| qwen3.6 | 0.31 [0.11, 0.50] | 0.28 [0.17, 0.39] |

Gaps: floor − qwen3.8 is +0.07 Jaccard [−0.06, +0.21], inside noise. Floor − qwen3.6 is +0.24
[+0.07, +0.40]. qwen3.8 − qwen3.6 is +0.16 [+0.03, +0.28].

### All five on shared functions (75)

| | Grades (weighted κ) | Surprising or not (κ) | Shared surprising (Jaccard) |
|---|---|---|---|
| Sonnet vs Sonnet | 0.55 | 0.58 | 0.50 |
| qwen3.8, thinking | 0.43 | 0.49 | 0.46 |
| qwen3.8, thinking off | 0.35 | 0.22 | 0.27 |
| qwen3.6 | 0.40 | 0.33 | 0.30 |

| Gap, median [95%] | Surprising or not (κ) | Shared surprising (Jaccard) |
|---|---|---|
| floor − thinking | +0.08 [−0.13, +0.29] | +0.04 [−0.10, +0.20] |
| floor − thinking off | +0.36 [+0.08, +0.64] | +0.24 [+0.07, +0.42] |
| thinking − thinking off | +0.27 [+0.06, +0.51] | +0.19 [+0.07, +0.31] |
| thinking off − qwen3.6 | −0.11 [−0.37, +0.17] | −0.04 [−0.18, +0.11] |

Grade distributions on those 75:

| | `full` | `most` | `some` | `none` | surprising | `derivable: yes` |
|---|---|---|---|---|---|---|
| sonnet-a | 29% | 52% | 17% | 1% | 19% | 81% |
| sonnet-b | 19% | 56% | 21% | 4% | 25% | 77% |
| qwen3.6 | 28% | 53% | 19% | 0% | 19% | 73% |
| qwen3.8, thinking | 5% | 61% | 33% | 0% | 33% | 84% |
| qwen3.8, thinking off | 19% | 49% | 25% | 7% | 32% | 64% |

## Measured: what a reading costs

Tokens and times are from Ollama's own log; OpenRouter prices are `qwen/qwen3.8-27b` on
2026-09-13: $0.214/M input, $2.55/M output, $0.15/M cached input.

| | qwen3.8, thinking | qwen3.8, thinking off |
|---|---|---|
| Readings per hour (2 readers, one GPU slot) | **51** | **222** |
| Requests per reading | 4.1 | 4.2 |
| Input tokens per reading (not cached) | 23,315 (5,936) | 20,290 (3,433) |
| Output tokens per reading | **3,488** | **689** |
| Generation per reading | 67 s | 12 s |
| Prompt processing per reading | 5.9 s | 3.8 s |
| OpenRouter, per reading | $0.0128 | $0.0050 |
| widdlbox (1,239), local | ~24 h | ~5.6 h |
| widdlbox (1,239), OpenRouter | ~$16 | ~$6 |

For scale: each Sonnet pass read all 1,239 in about an hour, with 5 readers.

**Output is the cost, not input.** Once prompt reuse works, generation is ~90% of the time
and ~70% of the dollars, and the GPU is saturated: with 2 readers, total request time already
exceeds wall-clock time. More readers do not help; see *One slot*.

"Thinking not requested" (`CLAUDE_CODE_DISABLE_THINKING=1`) generated 3,186 output tokens per
reading, 11% fewer than thinking on, and read at 55/h. It is not a middle setting, just thinking.

Estimates, not measurements: an RTX 4090 would be ~15–30% faster (generation is
bandwidth-bound: 1,008 vs 936 GB/s), an M4 Pro ~3–4× slower, an RTX 5090 ~1.7–2× faster.
Electricity was not measured.

## Why qwen3.6 read cool

A reader predicts, reads the body, then **grades its own prediction**. A weaker model is worse
at both halves, and the errors do not cancel. Of the functions both Sonnet passes called
surprising and qwen3.6 did not, 26 against 12 the other way (on 283), qwen3.6's description of
the body was as good as Sonnet's; its prediction was vaguer and it forgave itself. Predicting
`file_write` would "write to disk", then finding a permission prompt and a container, it graded
`most`. Its predictions were shorter (median 242 characters against ~270), and it hedged less
than Sonnet, not more — so the leniency is in the grading, not the phrasing.

The 12 the other way were mostly qwen3.6 genuinely being wrong — a smaller model surprised by
more, which is what `metric.md` expects. Leniency outweighed it two to one.

## Why thinking is the difference

qwen3.8 with thinking grades harder than Sonnet but points at the same functions. Its misses
are honest: predicting `ctr c ls` for a function that runs `ctr container info`, it graded
`some` where Sonnet, closer, said `most`.

Without thinking it goes erratic in both directions. It called `triggerWave` "a thin trigger"
and graded `most` when the body choreographs a five-step timed animation (thinking and both
Sonnet passes said `some`). It graded `stripXMLToolCalls` `none` where everyone else said
`most`. `none` rises to 7%, `derivable` falls to 64%.

## What had to be fixed

Each of these produced plausible-looking output while being wrong.

### Claude Code's token countdown broke prompt reuse

Claude Code 2.1.269 appends a mid-conversation `system` message after every tool result:
`<total_tokens>N tokens left</total_tokens>`. Ollama 0.34 renders system messages ahead of the
conversation, so every turn changed the prompt ~4k tokens in and the server re-read the entire
history: **100%** of a 21,636-token prompt re-processed per request, 19 s of prefill before a
word. Reproduced by hand: a two-turn request with any per-turn system message re-processes
everything after it; without one, only the new ~1,750 tokens.

`CLAUDE_CODE_TOTAL_TOKENS_REMINDER=off` removes it: ~130 new tokens processed per turn.
`CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` shrinks the session prefix. Both are set by the `ollama`
harness. The one remaining mid-conversation system message, `# Environment`, is sent once and
never changes, so it does not break reuse.

### A count in a prompt is a request

Told to take **exactly 1** reading, a qwen3.8 reader took **24** in one session, its context
growing ~4k tokens per reading until Ollama truncated it at 64k and the reader failed. Every
reading after the first was taken warm — the condition the batch exists to control — and the
pass's pace jumped, which is how it hid.

`sanity mcp` now counts handouts per reader process and answers `sanity_next` with "you are
finished" past `SANITY_BATCH`, which the harness passes in the shim's environment. Answered
rather than refused, because the reader prompt tells a reader to retry an error.

### A backend restart dropped a live run

A new backend restores every known project in the background by building each from scratch
with `run: None` and inserting it over whatever is there (`agentapi.rs`, the restore loop).
`sanity check` right after a backend start opens its repo and starts a wave first; the restore
then replaced that project. The wave kept spawning readers with no `run` to report, stop or
count it: invisible to `status`, deaf to `/stop`, ended only by `--limit`. This is the bug the
`open_project` comment already records fixing — arriving through the second construction site.
The restore now skips a project that is already loaded.

### One slot

Ollama refuses parallel requests for the `qwen35` architecture (qwen3.6 and qwen3.8 both):
`model architecture does not currently support parallel requests`. `OLLAMA_NUM_PARALLEL` is
ignored and `llama-server` launches with `-np 1`. Two readers overlap Claude Code's startup
with the other reader's generation, and with two the GPU was already saturated. Three was not
tried; it should only queue.

Speculative decoding is already on: Ollama 0.34 uses qwen3.8's built-in multi-token prediction
heads (`draft-mtp`). The handful of requests inspected accepted 41–69% of drafted tokens.

### The prompt cache lived in system RAM, and killed the server

llama.cpp keeps prompt-cache entries (default 8 GiB) and up to 32 recurrent-state checkpoints
per slot (~150–235 MB each) in **host** memory. With two QEMU VMs holding ~7 GB, the kernel's
OOM killer took `llama-server` **14 times** overnight. Readers retried through all but two.
The library reads its own arguments from the environment, so the service override caps both.
Sampled every 30 s across the three hours of passes that followed: `llama-server` peaked at
7.3 GB with 9.2 GB still available, and the OOM killer fired **zero** times.

```
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_CONTEXT_LENGTH=64000"
Environment="LLAMA_ARG_CACHE_RAM=6144"
Environment="LLAMA_ARG_CTX_CHECKPOINTS=4"
```

Two service traps: Ollama's `install.sh` rewrites `ollama.service` from scratch on upgrade,
dropping any `Environment` lines there, so settings belong in `override.conf`. And an
`override.conf` without a `[Service]` header is ignored silently — this machine's
`OLLAMA_NUM_PARALLEL=8` had been inert since August.

### Thinking cannot be turned off through Claude Code

`CLAUDE_CODE_DISABLE_THINKING=1` and `MAX_THINKING_TOKENS=0` both remove the `thinking` field
from the request; with it absent, Ollama uses the model's default, and qwen3.8 thinks anyway
(3 blocks in 3 turns, every time). Claude Code never sends `{"type": "disabled"}`. The
thinking-off pass ran through a 60-line proxy that sets it on every `/v1/messages` request:
119 output tokens for a task that took 839 with thinking, zero thinking blocks.

### Unresolved

- **Big files cannot be read locally at 64k.** Sanity's own `web/src/App.tsx` is 231 KB (~79k
  tokens); `agentapi.rs` is 456 KB (~155k). A reader that overflows fails, so these readings
  would be missing — on exactly the largest code. qwen3.8's attention cache is small (79 MB at
  20k tokens), so a much larger context probably fits in 24 GB. Not tested.
- **Claude Code assumes a 200k window** for a model it does not know, so it will not compact
  before a 64k server truncates. `CLAUDE_CODE_MAX_CONTEXT_TOKENS` would fix it; not set.
- **A truncated prompt can still produce a reading.** Every truncation observed coincided with
  a reader failing, but that is not proof none was banked.
- **A reader's self-declared model is prose.** qwen3.8 reports `"qwen3.8:27b (per the harness
  environment line; I cannot independently verify my own model id)"`. The server-stamped
  `asked` field is the one to trust.

## What NOT to do

- **Do not mix instruments.** A local initial read and local incremental updates are one
  corpus only if model, quantization, thinking, readings per session and carrier settings all
  match. OpenRouter's `qwen/qwen3.8-27b` is not the same instrument as a local `Q4_K_M`;
  neither is qwen3.8 with and without thinking.
- **Do not compare against Sonnet as ground truth.** Sonnet agrees with itself on only half its
  surprising functions (Jaccard 0.51) and a third of its `none`s. The floor is the bar.
- **Do not trust a pace number without checking positions.** The runaway session made a broken
  pass look faster.
- **Do not size readers to the card's memory.** On `qwen35` there is one slot however much is
  free.

## What this makes stale

- `CLAUDE.md` and `docs/notes/metric.md` say local models were tried as readers and found
  lacking. For qwen3.8 with thinking, on which functions a map calls surprising, that is no
  longer what was measured. It is still true of speed.
- `docs/notes/readers.md` describes four harnesses; there are five, and the Ollama one depends
  on Claude Code.
- `agentapi::BATCH` documents one batch for every reader. `Harness::batch()` now makes it one
  for Ollama.

## Caveats

- Samples: 1,216 for qwen3.6, 101 for qwen3.8 thinking, 75 shared by all five. The qwen3.8
  intervals are wide.
- The qwen3.8 passes read one function per session; Sonnet read ten. That difference is inside
  every qwen3.8 comparison.
- The 101 clean thinking readings are not quite the queue's first 101: the 23 warm readings
  took their functions.
- One repo. Rust, JavaScript and TypeScript dominate it.
- Disagreements were judged by a Claude model.

## Open questions

- **Predictor or grader?** Have Sonnet grade qwen's predictions against the body, outside any
  `.sanity/`. If qwen3.6's map heats up, grading could be split out as its own step.
- **Is there a thinking budget in between?** Turning thinking off removed ~80% of the output
  tokens (3,488 → 689 per reading).
- **Does a larger context read `App.tsx`,** and how long does it take?
- **Can the carrier be something other than Claude Code?** opencode talks to Ollama directly.
- **What does an incremental scan cost?** At 51/h, a 10-function commit is ~12 minutes.

## Where the data is

- Readings: `~/sanity-ab/{sonnet-a,sonnet-b,qwen,qwen38-fast,qwen38-nothink,qwen38-off}/widdlbox/.sanity/`.
  `qwen38` holds 15 readings from an abandoned pass with prompt reuse broken; unused.
- Code: branch `ollama-reader`, not merged — `src-tauri/src/harness.rs`, `mcp.rs`,
  `agentapi.rs`, `web/src/components/ReadDialog.tsx`. Clippy and rustfmt were not run on it.
- The comparison scripts and the thinking-off proxy were written in session scratch space and
  are not in the repo.
