# web — sanity assessment

528 of 542 read · 99 surprising · 3 stale

Each entry below is one **reading**, of a function or of a whole file. An
agent was given its name, signature, neighboring names and comments — never
its body — and wrote down what it expected to find. Then it opened the file.
The gap between the two is the finding. A file's own entry is titled `the file
itself` and asks whether the header at the top describes what is actually in
there.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the
queue.

What this is and how to add to it: [README.md](README.md)

## web/scripts/keys-check.ts

### the file itself
- spec 3 · read at `0c9e8a660033` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:36Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A standalone CLI script (run via `just keys-check`) that exhaustively simulates every key against every UI state, feeding them through the shared `lib/keys.ts` decision logic, to catch cases where an early-return in the ordered keyboard handler silently shadows another shortcut (like the Tab-vs-lens-digit regression). It likely has a `check`/`step` loop enumerating states, a `cmd` helper mapping key+state to the resolved command, and a `lens` helper isolating lens-digit shortcuts, printing any keys that resolve to an unexpected or conflicting command.
- found: A hand-written assertion script (not exhaustive over states, but a curated set of regression checks) that calls `actOf` from lib/keys.ts with various key+modifier+Where combinations and asserts expected resolved actions: lens digits still work with the find pane open or a field focused, Tab only opens the finder where free, ⌘+ / bare ⌘= disambiguate history vs the twelfth lens, keyboard parity with the lens-switcher strip (including a locked lens), and ⌘]/⌘[ stepping to reach the lens with no digit. Exits 1 if any check fails.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted a generic exhaustive cross-product and a `step` helper that loops over states; actually it's a fixed list of pointed regression assertions and `step` specifically extracts the stepBy action for bracket keys.

### `check`
- spec 3 · read at `7026e7f50af2` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:47:21Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A tiny assertion helper for this CLI script: if `ok` is false it prints a failure message (including `what` and the `saw` value if given) and marks the run as failed, likely via process.exitCode or a shared counter, while doing nothing (or maybe a pass log) when ok is true.
- found: Logs "ok <what>" and returns if ok is true; otherwise increments a shared `failed` counter and logs "FAIL <what>" plus the JSON-stringified `saw` value if one was provided.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The file_doc explains why this check script exists (a keyboard-map ordering bug) but not this function's own behavior.

### `cmd` — QUIRKY
- spec 3 · read at `b3234bb32a25` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:32Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: cmd(key) calls into the actual keyboard shortcut handler from lib/keys.ts with a synthetic event for that key, then returns the resolved command name (or undefined) - used by check/lens to enumerate what each key does in each state without duplicating the handler's own early-return ordering logic.
- found: It's a tiny factory that builds a synthetic key-event object for a given key string, defaulting meta:true and the other modifiers false — it doesn't call any handler itself, just constructs the input shape that check/lens presumably feed into the real handler.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `lens` — OBSCURE
- spec 3 · read at `9061a87b7cb6` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes an Act object and returns a short human-readable string label combining its key and modifier flags (e.g. "Ctrl+Tab"), used elsewhere in the script for printing or comparing actions.
- found: Extracts a representative value from an Act: if the action's `do` field is 'lens', returns its `mode` sub-field, otherwise returns the `do` field itself (with optional chaining for null/undefined safety). It's a special-case accessor, not a string formatter.
- predicted: none · documented: none · derivable: yes · legible: full · trap: no
- note: The file_doc explains why the script exists (a Tab-shortcut regression) but says nothing about this specific accessor's lens-vs-do special-casing.

### `step`
- spec 3 · read at `73131de6ddb5` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:47:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small helper that simulates pressing a single key `k`, likely calling into the keyboard-map/shortcut logic (e.g. cmd or lens) and advancing/reporting current state by one step, used so the twelfth lens (with no digit shortcut) can still be reached via repeated stepping instead of a direct number key.
- found: step(k) simulates pressing key k by calling cmd(k) to get the resulting action against the `idle` state, then returns the step delta (`a.by`) only if the action's `do` is 'step', otherwise null — it's a query of what stepping distance a key would produce, not a state-advancing action itself.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/scripts/replay-check.ts

### the file itself
- spec 3 · read at `e448f4cb6973` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:52Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A standalone CLI script that generates a synthetic commit history with the seeded rng, folds it to a given commit two ways — forward playback banking checkpoints, and backward seek that thaws a checkpoint and replays the remainder — then compares the two resulting frames field-by-field (invariants, zeroIsAReading) and reports divergence (render/text), with main as the entry point setting exit code on failure. Purpose: regression-test the checkpoint/replay optimization's correctness without a real repo.
- found: A three-way replay harness: synth() builds a synthetic commit timeline, then frameTree is folded forward (checkpoint banking), backward (descending seeks that thaw checkpoints), and cold (chill() gives an identity-fresh Tables so caches miss) at the same marked commits, comparing rendered text (render/text) and structural invariants (invariants, zeroIsAReading) for equality; main() also explicitly measures and asserts that a warm backward seek folds a bounded number of commits from a checkpoint rather than silently degrading to a full cold fold, which is the actual point of the script (a correct-but-slow answer would pass any equality check).
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: Missed upfront that the harness also asserts a hard performance/correctness bound on how many commits a seek is allowed to fold (not just that outputs match) — that's the actual payload, not just a correctness comparison.

### `rng`
- spec 3 · read at `a6a23063e047` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:33Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A seeded PRNG factory: takes a numeric seed and returns a closure () => number producing deterministic pseudo-random values in [0,1) on each call (e.g. mulberry32/LCG style), so synthetic test data is reproducible across runs.
- found: Mulberry32 PRNG: seeded closure that advances state by a golden-ratio-derived constant and applies xorshift/multiply mixing to produce a deterministic float in [0,1) per call.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc explains why determinism matters for the replay-check harness but the per-function doc is just a one-liner restating that; the actual algorithm (mulberry32) isn't named anywhere.

### `synth` — TANGLED
- spec 3 · read at `56cd993e3dd2` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:14:26Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Uses a seeded RNG to deterministically generate a fake commit history with the given number of files, functions, and commits — producing a sequence of commits that add, rewrite, and delete functions (and sometimes empty out files/directories) so replay/checkpoint folding has edge cases to exercise. Likely also injects "readings" that land and get withdrawn, returning a Fake object bundling the commit list (and maybe expected end state).
- found: Uses a seeded RNG to build a synthetic Tables/Deltas pair: generates files (some excluded, mimicking .sanityignore), a base set of live functions, then simulates `commits` timeline entries each mutating a random subset of functions (add/edit/delete), plus occasional cognitive-complexity scores, readings, and unread markers. It deliberately tunes timing/probabilities to stress specific invariants (churn windows spanning checkpoints, zero-as-valid-value cases for loc/cog/reading, sparse language coverage) that the replay-check harness later verifies.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: The inline comments explain WHY each probability/threshold was chosen (to stress specific edge cases in the fold/checkpoint logic) — that intent isn't recoverable from the code shape alone.

### `chill`
- spec 3 · read at `04803dc11868` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:04Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Deep-copies the Tables history (e.g. via JSON.parse(JSON.stringify(...)) or similar) to produce a value that is structurally identical but has entirely new object references, so any cache keyed by object identity (like a memoized frameTree) will not recognize it and will recompute from scratch.
- found: Manually rebuilds the Tables object with fresh array/object references for each field (paths, excluded, langs, funcs, base), spreading the rest, so it's structurally equal to the input but shares no references with it, defeating identity-keyed memoization.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `render`
- spec 3 · read at `99ea70c7cec8` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:14:53Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recursively serializes a tree Node into the out string array: writes each field a frame writes (in a fixed order) as a line, indented/prefixed by depth, then recurses into children with depth+1, producing a deterministic flat text dump for line-by-line diffing between two trees.
- found: Recursively renders a Node into `out`: one line per node with indentation by depth, listing kind/id/name/loc/rest/lang/lastAuthor/birthBelow/touchBelow, a formatted score block (surprise/documented/churn/age/touch/commits/tangle/cog/hot/analyzed/source/appeared/edited) or '-', an agent block, and a folded roll-up block (lang/author/time/tangle tallies) or '-', then recurses into children at depth+1.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `text` — QUIRKY
- spec 3 · read at `f235d28e7db2` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:39Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Converts a synthetic tree Node into a short human-readable label (likely its path or name), used for printing diagnostic output when the forward/backward replay comparison finds a mismatch.
- found: Delegates to a `render` peer function that accumulates lines into an array, then joins them with newlines — producing a full multi-line rendered dump of the tree, not just a short label.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The actual formatting logic lives in the `render` peer function, not shown here.

### `invariants`
- spec 3 · read at `9d5a94ac5887` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:27Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the tree checking two things: that a node's loc equals the sum of its children's loc (lines conserved at every size), and that no node id appears twice anywhere in the tree (using a Set to track seen ids). Calls fail(message) with a description including `where` for each violation found, rather than throwing immediately.
- found: Exactly as predicted: recursive walk checking duplicate ids via a Set, and checking each non-leaf node's loc equals the sum of its children's loc (leaf loc is trusted, not re-derived).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `zeroIsAReading`
- spec 3 · read at `c45a33f9d32f` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:34:14Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: This is a standalone invariant check within replay-check.ts's synthetic-timeline test harness — it builds a small synthetic history/reading where a grade axis packs to the value 0, folds it, and asserts that the store still distinguishes "graded as 0" from "never graded" (likely via a separate presence/mask array rather than relying on the value being non-zero), calling fail(msg) if the two get conflated.
- found: Builds a synthetic 2-function, 2-commit timeline where one function ("zero") gets a `read` delta with grade 0 and never a `set`, while the other ("graded") gets a `set` but no `read`; folds it through frameTree and asserts the resulting node's `agent` field is defined for the zero-grade function and undefined for the ungraded one, calling fail() on either violation.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: I predicted the general shape correctly (a synthetic fold checking that a zero grade isn't mistaken for absence) but got the mechanism slightly wrong — the check is on Node.agent being defined/undefined directly, not on a separate presence/mask array as I guessed; the underlying Uint16Array packing this test guards is one level further down in the store, not visible at this call site.

### `main` — TANGLED
- spec 3 · read at `6185a1ee2bb7` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:34:15Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: This is the script's entry point: it generates a synthetic commit timeline via `synth`/`rng`, computes the "forwards" fold once while banking checkpoints, then for a set of random target commits computes the "backwards" answer by seeking/thawing a checkpoint (`chill`) and folding the remainder, comparing the two trees field-by-field (and running `invariants`/`zeroIsAReading` checks). It reports pass/fail via `text`/`render` and likely exits with a non-zero process code on any mismatch, since this is meant to run in CI without a real repo.
- found: Confirmed the core shape: synthesize a timeline, fold forwards while banking checkpoints, seek backwards (forcing thaws), compare against a cold fold from scratch, run invariants, and exit 1 on failure. What I missed: it doesn't just compare forward vs backward trees — it compares BOTH against a third "cold fold from opening state" baseline as the ground truth, uses carefully clustered seek targets just past each checkpoint (worst case for a broken thaw), includes a separate zeroIsAReading check unrelated to seeking, and ends with a whole second phase on a longer synthetic timeline whose entire purpose is a performance/correctness check that checkpointing actually bounds the folded-commit count (not just correctness) — asserting a count bound rather than timing, since a slow-but-correct seek would pass any equality check.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: The file doc explained the forward-vs-backward comparison concept but said nothing about the third cold-fold baseline, the clustering of seek marks near checkpoints, or the second long-timeline performance-bound phase — all only discoverable by reading the body.

## web/scripts/rim-check.ts

### the file itself
- spec 3 · read at `0eb687497608` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:48:40Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A standalone TypeScript check script that builds synthetic author/file/directory fixtures to validate the rim (distribution-band) visualization's invariants: that a drawn band's width never claims more than the actual share it represents, and that a band's label never names an author/entity that isn't actually the dominant one in that band. It likely specifically reproduces the kibana x-pack/platform bug scenario (two large authors plus a long tail of thin ones merged into a mislabeled band) and asserts the current code no longer produces that lie, run as a script (e.g., via npm/ts-node) rather than through the normal test framework.
- found: It is exactly the standalone check script I predicted for the kibana-shaped merged-band bug (a wide run absorbing/mislabeling a thin tail), but that is only the first of about ten independent regression scenarios: absence bands vs 'no git history' vs 'timeline not walked', roll-up/fold stand-ins not being counted as distribution members or absences, sortBuckets putting unknown keys last instead of first (the -1 indexOf bug), per-lens ramp/band-list isolation (the ternary-fallthrough bug), a container drawing every child's band rather than its mean, columns-only files (ring never fetched) not throwing and banding correctly per churn window rung, and folded files' dual age readings (touch vs birth) banding correctly including the opening-state churn-gate regression.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no

### `check`
- spec 3 · read at `d48811ca4e94` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:47:17Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A small test-assertion helper: prints a pass/fail line for `what`, and if `ok` is false, prints the `saw` value for debugging and marks the overall run as failed (e.g. incrementing a failure counter or setting an exit code), used to drive the rim-drawing invariant checks in this script.
- found: Logs 'ok' or 'FAIL' for a named check; on failure increments a module-level `failed` counter and prints the JSON-stringified `saw` value if provided.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The file_doc describes the whole script's purpose, not this specific helper, which has no doc of its own.

### `at`
- spec 3 · read at `821348b83a10` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Constructs a single Slice object for the rim/band chart: takes a label, a line count (the value), and an optional fill color (defaulting to a CSS variable keyed by label length), and returns an object bundling those fields plus possibly a derived share/percentage for rendering one band.
- found: Builds and returns a plain Slice object literal with key, label, fill, and lines fields — a simple constructor/factory, no derived computation.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The attached doc snippet ("A slice as histogramsFor emits one...") describes the output of a different function, histogramsFor, not this constructor `at`.

### `func`
- spec 3 · read at `21e20abbae9b` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:24Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper: builds and returns a leaf `Node` of kind 'func' with the given `loc`, a placeholder name/path, empty children, and a score object whose lastTouchedDays comes from `touched` (null meaning no history), used by this file's rim-band correctness tests to construct small synthetic trees without going through a real scan.
- found: Matched the core idea (fixture Node of kind func with loc, empty children, score.lastTouchedDays from touched) but I assumed a placeholder name/path would be included; actually the object omits name/path entirely and is force-cast `as unknown as Node`, plus zeroed commits/churn arrays and an ageDays of 1 (or null) I didn't anticipate.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `dir`
- spec 3 · read at `9c3df9838496` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:50Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A fixture factory building a fake directory Node from an array of child nodes: `{ kind: 'dir', children: kids, loc: sum of kids' loc, excluded: false }` cast as Node, used to assemble test trees for rim-check.
- found: A fixture factory building a fake directory Node: kind:'dir', loc hardcoded to 0 (not summed from children), excluded:false, children:kids.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I predicted loc would be summed from the children's loc; it's actually just hardcoded to 0.

### `file`
- spec 3 · read at `153146731868` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:38Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A tiny test-fixture builder: constructs a synthetic file Node (kind: 'file') wrapping the given `kids` array as its children, with minimal/placeholder fields for the other Node properties, used alongside `dir` and `func` to build synthetic trees for the rim-drawing checks in this script.
- found: Builds a minimal synthetic 'file' Node with loc 0 and the given children, cast through unknown to Node, for use as a test fixture.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The only docs present are the file-level header about rim invariants, not this fixture helper.

### `standIn`
- spec 3 · read at `515b681d355c` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:42Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A two-line arrow function building a fake Node-shaped test object representing a folded roll-up with no reading — likely {kind: 'func', loc, rest: count, children: []} mirroring the stand-in shape from colorMode.ts/history.ts, used to test rim-check's band logic against roll-ups.
- found: Constructs a fake Node with kind 'func', the given loc, `rest: count` marking it as a roll-up stand-in, empty children, not excluded, and no score — for exercising rim-check's band logic against roll-up nodes.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `dated`
- spec 3 · read at `b72cecead231` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:31Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Tiny test-fixture factory, sibling to func/dir/file/standIn in this rim-check script, that builds a synthetic Node of the given loc size pre-populated with a score/age value (unlike func, which is presumably undated) — used to exercise age/churn rim-banding logic in this check script's test cases.
- found: Builds a synthetic func Node with the given loc and a fixed score (commits: 3, ageDays: 400, lastTouchedDays: 0.5) — exactly the dated test fixture predicted, used to feed age/churn rim-band checks.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `file` #2
- spec 3 · read at `153146731868` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:41Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: 2-line test-fixture factory, sibling to dir, returning a Node with kind: 'file', children: kids, and loc summed from the children's loc — a minimal fake file node wrapping given function children for the rim-check test cases.
- found: Returns a fake file Node with children: kids, but loc is hardcoded to 0 (not summed from kids) and also sets funcs: 0 — a minor detail my prediction got wrong.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `dir` #2 — QUIRKY
- spec 3 · read at `9c3df9838496` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:57Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A tiny test-fixture factory (the second local `dir` helper in this file, likely scoped differently from the first) that builds a directory-kind Node from an array of child nodes, summing their loc into the directory's own loc — a one-liner used to assemble synthetic trees for the rim-drawing checks described in the file doc.
- found: A test-fixture factory building a dir-kind Node from child nodes, but with `loc` hardcoded to 0 (not summed from children) plus `excluded: false`, cast through `unknown as Node` since the fixture is intentionally incomplete.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: File_doc describes the whole file's rim-drawing-correctness rationale, not this specific fixture helper.

### `drawn`
- spec 3 · read at `a192284f65f2` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:41Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A tiny fixture factory that builds a Node representing a file that survived the fold (as opposed to being rolled into a stand-in), given its loc and language — likely `{ kind: 'file', loc, lang, children: [] }` cast as Node, used to build test trees for the rim-check's language/share assertions.
- found: A fixture factory building a fake file Node that survived the fold: kind:'file', given loc and lang, excluded:false, funcs:1, empty children.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The attached doc is a worked example (ceph's pybind) illustrating the file's broader bug, not a description of this specific factory.

### `crowd`
- spec 3 · read at `898a129ee99d` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:47Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture factory that builds a synthetic Node representing a "crowded" file with many contributors, given total lines of code, function count, a language breakdown, and optional time/churn stats. It likely fills in required Node fields with sensible defaults and is used elsewhere in this rim-check script to construct scenarios like the kibana long-tail-of-authors case described in the file doc.
- found: Builds a synthetic file Node as predicted, but the `count` param fills `rest` (folded/hidden sibling count) not function count — funcs is hardcoded to 0, and lang/time go into a `folded` field alongside an empty author list.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `dir` #3
- spec 3 · read at `9c3df9838496` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:52Z · by ross@rossturk.com · warm reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Minimal test-fixture factory, sibling to file, returning a Node with kind: 'dir', children: kids, and loc: 0 hardcoded rather than summed from children — used to build fake directory nodes for the rim-check test scenarios.
- found: Exactly as predicted: fake dir Node with children: kids and loc hardcoded to 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: This prediction benefited from having just seen the sibling file() factory's same hardcoded-loc pattern in the prior task, so it's a warmer read than the cold flag alone suggests.

### `share`
- spec 3 · read at `589377b5b766` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:38Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a key k (likely an author/contributor identifier), share(k) looks up that key's count within some constructed dataset (the "crowd"/dir/file test fixture described in the file doc) and divides it by the total count across all keys, returning the fractional share that contributor represents of the whole. It's probably a small test helper used to assert that rendered band widths on the rim/map match the real underlying proportions.
- found: Computes the fraction of total lines that belong to the row whose label matches k, by finding it in a `rows` array and dividing its `lines` field by `total`; returns 0 if not found.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `withCols` — QUIRKY
- spec 3 · read at `e55c9238e99d` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:53:11Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture builder: given a total `loc` and an array of [value, count] tangle pairs, it constructs a synthetic file/dir Node whose child function nodes are assigned those tangle scores (count copies of each value), used to feed the rim/band-drawing logic under test with a controlled distribution.
- found: Builds a synthetic file Node with a `cols` (columnar per-function) block populated straight from the tangles array (each pair is a function's own [tangle0,tangle1], not a value/count histogram), plus a top-level `score.tangle` averaged across those columns, specifically so the file has real per-function ring data rather than needing to fall back to the flat roll-up.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: I guessed tangles was a (value,count) histogram feeding synthetic child function nodes; it's actually a flat columnar `cols` structure with one entry per function and no `children` at all.

### `dir` #4
- spec 3 · read at `df178ef77c07` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:45:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A one-line test-fixture helper: builds a synthetic directory Node from a list of child nodes, summing their loc into the directory's own loc and wrapping them as children, with placeholder kind/name/path fields.
- found: A one-line synthetic Node fixture builder for a directory, wrapping the given children with a fixed loc of 400 (not summed from kids) and placeholder id/excluded fields, cast through unknown.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The doc field returned here was the file-level header, not documentation of this specific tiny helper.

### `fn`
- spec 3 · read at `c5a97609e8df` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:52:08Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A small test-data builder: given loc and a [weighted, raw] tangle tuple, constructs a Node representing a file (leaf) with those complexity values set, used as a building block for composing synthetic repo trees in this rim-band regression check.
- found: Builds a synthetic leaf Node of kind 'func' with given loc, zeroed commits/churn, ageDays/lastTouchedDays of 1, the given tangle tuple, and a derived cognitive score (tangle[1]*15 rounded) — a test fixture builder for this rim-band script.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `dir` #5
- spec 3 · read at `9c3df9838496` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:54:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Same synthetic fixture builder as `file` but with kind 'dir', wrapping the given children into a Node with zeroed loc/funcs and excluded false, cast to Node.
- found: Builds a synthetic 'dir' kind Node fixture with zeroed loc, excluded false, and given children, cast to Node; matches file() but omits funcs field.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `file` #3
- spec 3 · read at `153146731868` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:54:20Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A tiny test-fixture builder used to construct synthetic tree nodes for exercising the rim-band logic: it wraps the given child nodes into a Node of kind "file" (or similar), likely with default/placeholder name and size fields, mirroring a sibling `dir` builder that does the same for directories.
- found: Builds a synthetic 'file' kind Node fixture with zeroed loc/funcs, excluded false, and the given children, cast through unknown to Node for test purposes.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `withCols` #2 — QUIRKY
- spec 3 · read at `098526495b22` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:54:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds a stand-in Node representing a small file, given its total loc and an array of per-author commit tuples (likely [additions, deletions, commits, something] or similar). It computes an inline Score object for the node — including a churn field (the fix for the bug described in the file doc where churn was missing and caused a crash) — so this node can be treated like one with real cols/children for rendering purposes.
- found: Test fixture builder: constructs a 'file' Node with cols filled from loc/commits (placeholder touched=3, callers/calls/clones=-1) and no inline score at all, cast through `as unknown as Node` — this is the exact cast-hides-missing-field pattern the file doc warns about, not a fixed version with churn added.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: I expected this to be the fixed stand-in with an inline score including churn, but it actually has no score field at all and uses the same 'as unknown as Node' cast the file doc calls out as hiding the bug — likely this is a test fixture reproducing/testing that exact scenario rather than the production contributeCols fix.

### `dir` #6
- spec 3 · read at `9c3df9838496` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:54:30Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper that builds a synthetic directory Node from an array of child Nodes, aggregating their values (e.g. summing sizes/counts) into the parent so the rim-check script can construct fake trees to test the band-drawing logic without a real repo.
- found: Builds a fake directory Node with kind 'dir', loc hardcoded to 0, excluded false, and the given children — no aggregation of child values, just a cast fixture object.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: File doc is for the whole rim-check.ts file, not this specific helper, so it doesn't describe this function's behavior directly.

### `bandAt`
- spec 3 · read at `16c161336ccb` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:50:50Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns the churn/commit band a node's commit count falls into for the window index `at` (one of the four churn windows), used to verify that the same function reports a higher band (e.g. `10+`) at the widest window and a lower one at narrower windows.
- found: Builds a Views object with the churn window set to index `at` (age/tangle held fixed), runs bucketsFor on a single-file fixture dir under the 'churn' mode, and returns the label of whichever bucket holds the row with exactly 100 lines — i.e. what band a fixed 100-line function falls into at that window.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `crowd` #2 — QUIRKY
- spec 3 · read at `b56c043ef7c7` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:11Z · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds a synthetic fake Node with total loc lines distributed across count distinct authors (a crowd of small contributors, per the kibana x-pack/platform bug scenario), using time as per-contributor age/date values — to test that many thin per-author slices get correctly merged/bucketed in the rim histogram rather than drawn as one misleadingly-labeled run or overly wide bands.
- found: Builds a roll-up stand-in file Node (rest: count, folded: {lang: [], author: [], time}) — this is a fixture for the `contribute` roll-up path I read earlier in colorMode.ts (n.rest !== undefined branch), representing count folded functions with a `time` tally array, not a crowd of distinct authors as I guessed.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: Recognizing this ties directly to `contribute`'s roll-up branch in colorMode.ts would have made the mechanism obvious — the two files are testing the same code path.

### `dir` #7
- spec 3 · read at `9c3df9838496` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:54:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper that builds a directory Node wrapping the given `kids` array, likely summing up children's line/commit counts into the parent node's aggregate fields and setting a `kind: 'dir'` tag with some placeholder name/path.
- found: Test-fixture helper building a minimal directory Node with kind 'dir', loc 0, excluded false, and the given children — no aggregation, just a cast fixture object.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `views` — QUIRKY
- spec 3 · read at `62ab9536f221` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:53:27Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A factory function that, given which age-reading direction ('newest' or 'oldest') is under test, returns an array/object of the view descriptors (e.g. author-crowd view and age-band view) each configured with the right column/share function for that direction — so the same downstream checks can be run against both reading modes without duplicating the setup.
- found: A small factory parametrized by the age-read direction that returns a config object bundling settings for three lenses at once — age (span + read direction), churn (a ladder config with cloned windows), and tangle (fixed to 'weighted') — used to build the map views under test for a given reading mode.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I correctly guessed the read-direction parametrization but wrongly assumed it returned per-audience "view" descriptors (author vs age) rather than a per-lens settings bundle (age/churn/tangle) — different domain than I expected.

### `at` #2 — OBSCURE
- spec 3 · read at `08949d58e607` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small test-fixture helper that builds a labeled entry (likely a single-contributor/author record) tagged with the given `label`, used alongside `dated`, `standIn`, `crowd`, `file`, `dir` to construct synthetic authorship data for testing the rim-band logic described in the file doc.
- found: A lookup closure over an `aged` array of bands: given a label, finds the band with that label and returns its `.lines` value, defaulting to 0 if not found. Used as a test-assertion helper, not a fixture builder.
- predicted: none · documented: none · derivable: yes · legible: full · trap: no

### `wasOldest`
- spec 3 · read at `b01487e3270d` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:55:00Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line test helper that looks up whether the entry with the given label was flagged/recorded as the oldest in some previously computed structure (like `dated`), returning a boolean.
- found: Looks up a band by label in the `oldest` array and returns its `lines` value, or 0 if not found — a numeric lookup rather than a boolean flag.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/src/App.tsx

### the file itself — QUIRKY — STALE
- spec 3 · served in 7 parts · read at `182fe8bd4f46` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:49:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Root React component file for the frontend app: wires together project/repo selection, scan triggering and progress display, the sunburst visualization, and trace/history controls. Contains the top-level App component plus small subcomponents (ProgressPane, ProgressStrip, FindButton, HistoryToggle, Empty) and pure helper functions for memoization equality checks (sameRun, sameIds, sameProgress, sameCost, sameProjects) and tree/id lookups (findById, parentOf, traceSig). The header doc is narrowly about trace-button behavior rather than a summary of the whole file's scope.
- found: The entire top-level application component and nearly all its state: project list polling and following whichever project an agent opened, scan/trace/replay orchestration and progress reporting, streaming shape/score/reading batching with careful memoization to avoid re-rendering thousands of sunburst arcs, the full color-mode/lens system with locks and rank tables, history replay state (timeline tables, deltas, playhead, scrubbing), drill-in/selection/crumb navigation, keyboard shortcuts, CLI-install and onboarding dialogs, and the Empty/first-run screen. Also holds small presentational subcomponents (ProgressTrack, ProgressStrip, ProgressPane, Spacer, FindButton, HistoryToggle, Empty) and the memoization-equality helpers. Every piece of the app's cross-cutting state ends up threaded through this one component.
- predicted: some · documented: some · derivable: no · legible: not judged · trap: no
- note: The file is enormous (3400+ lines) and almost entirely comment-driven narrative explaining past bugs and design tradeoffs rather than current behavior at a glance; a prediction from the header/peers alone captures maybe a third of the actual surface area.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `noop`
- spec 3 · read at `f8812f446328` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:50Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A trivial one-line no-op arrow function, `() => {}`, used as a placeholder callback for handlers the assembling map doesn't need.
- found: const noop = () => {} — a trivial no-op function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `sameRun`
- spec 3 · read at `e1ca8c8b054c` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:53Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Compares two run objects field-by-field (handling null/undefined for "no run"), checking things like id/phase and, importantly, the `assessed` count and `live` reader count that a naive comparison previously missed — since a reference-equality or partial check let a finished run's ended state go undetected. Returns true only if every displayed field matches.
- found: Null-safe field-by-field equality check over a run's running/stopping/live/spawned/finished/failed/readers/ended fields, used because the poll always allocates fresh objects so reference equality would never see a match.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I guessed an `assessed` field that doesn't exist here — the real fields are spawned/finished/failed/readers/ended, though the general shape (field-by-field, null handling, include live) was right.

### `sameIds`
- spec 3 · read at `49a9ecc223ca` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:49Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: `sameIds` treats undefined as an empty array, then compares two id arrays for equality — same length and same id at each index, in order (not set equality).
- found: Defaults both args to empty array, then checks equal length and every element equal at the same index, in order.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `sameProgress`
- spec 3 · read at `512fdb72dd5c` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:54Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Compares two optional/nullable Progress values for equality. Returns true if both are null/undefined, false if exactly one is null/undefined (since that transition matters per the docs), and otherwise compares the relevant fields of the two Progress objects (e.g. phase, done, total) for equality, likely via a small set of field checks rather than a deep generic walk.
- found: Returns !a && !b if either is nullish (so exactly one being null is false, both null is true), otherwise compares done, total, phase, and unit fields for equality.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `traceSig`
- spec 3 · read at `893b4da71b18` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:45Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a compact string fingerprint of the project's trace progress, concatenating a few relevant fields (phase/step and some count or depth) so callers can compare "did this step make progress" via simple string equality instead of deep-comparing the whole ProjectSummary.
- found: Concatenates trace_depth, resolved/resolvable, and replayed/commits into a template string fingerprint.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `sameCost`
- spec 3 · read at `69ae18f100f1` · commit `4bf0da1` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-26T21:00:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Shallow equality check between two optional cost objects — returns true if both are null/undefined, false if only one is, and otherwise compares seconds, cold, and fits field by field. Used to avoid unnecessary re-renders since the objects are freshly allocated on every poll.
- found: Shallow-compares two optional cost objects for the common fields (seconds, cold, fits), then also structurally compares extra fields (commits, files) that only exist on one of the two cost-shape variants (trace cost vs scan cost), without naming which type is which.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `sameProjects`
- spec 3 · read at `a6e30c66724a` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:47Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Compares two ProjectSummary arrays for equality to decide whether to trigger a re-render. First checks length (and maybe order/ids), then for each pair of items walks all keys present on EITHER object (to handle fields added by a newer backend or absent from an older one), comparing each key's value — using a deep/structural comparison for keys listed in a DEEPLY set (things like nested arrays/objects) and a shallow Object.is-style comparison for everything else. Returns false as soon as any mismatch is found, true if everything matches.
- found: Compares two ProjectSummary arrays element-by-element by index (after a length check), and for each pair unions the keys present on either object, comparing each key with a DEEPLY-registered comparator if one exists for that key, otherwise Object.is — short-circuiting to false on first mismatch.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `findById`
- spec 3 · read at `61c678125e8e` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:43Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursive tree search: checks if node.id === id, otherwise recurses into node.children looking for a match, returning the found Node or null.
- found: Recursive DFS over node.children matching on node.id, returns first match or null.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `readingSignature`
- spec 3 · read at `9a8668398665` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:49Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: `readingSignature` builds a cheap FNV-1a hash string over the list of reports, folding in each reading's id, the body/target it was taken against, and its grades — explicitly excluding prose fields like `found`/`note` — so callers can cheaply detect "did anything actually change" without re-hashing megabytes of text every poll.
- found: FNV-1a hash folding id, at, body, and all grade fields (predicted/documented/legible/trap/derivable + dated variants) per report into one running hash, prefixed with reports.length, returned as a string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `parentOf`
- spec 3 · read at `2d96b8cce242` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:47Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Recursive depth-first walk from node: checks whether any of node's direct children has id, and if so returns node itself as the parent; otherwise recurses into each child and returns the first non-null result, returning null if id isn't found anywhere in the subtree.
- found: Exactly as predicted: recursive DFS that returns node when one of its direct children matches id, else recurses into children, else null.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc here is stale/misattached — it's the chaseTrace doc bleeding onto this peer, not a description of parentOf.

### `App` — QUIRKY — UNCLEAR — STALE
- spec 3 · served in 6 parts · read at `220b1e8eb76b` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:54Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This is the root React component for the whole Sanity desktop app. It almost certainly holds a large pile of useState/useReducer for top-level UI state (current project, scan/trace progress, selected node, which lens is active, dialogs open), wires up Tauri IPC calls (invoke/listen) to drive scanning, history, and tracing, and renders the overall page layout — sidebar/project list, the map/treemap view, the LensPane, progress strips, and toolbar buttons like FindButton and HistoryToggle. Given the file doc about "Trace", it also contains the logic for advancing a trace pill through the call graph via chaseTrace-related handlers.
- found: The entire root component of the Sanity desktop app: ~3000 lines holding dozens of state slots and effects for polling projects/agent activity/readings, following whichever project an MCP agent opens, streaming scan shape/progress into an assembling map, batched grafting of fetched function rings into the tree, a full git-history replay/timeline system (scrubbing, playing, exporting movies), a chained trace/blame/replay 'column' walker (chaseTrace), color ranking for author/language lenses, keyboard shortcuts, and the full JSX layout (sidebar, top toolbar with per-lens controls, sunburst map, history bar, detail panel, several dialogs, and a code-view modal).
- predicted: some · documented: none · derivable: yes · legible: none · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `useProgress`
- spec 3 · read at `72304b16c0ca` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:38Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: `useProgress` is a hook that tracks a `Progress` object over time (via ref/state samples on each change), computing `pct` as a fraction (defaulting to `0`, never null) and computing `eta` in minutes only once it has accumulated enough samples to estimate a rate — returning `undefined`/omitting `eta` before then, since a tiny sample size makes the estimate swing wildly.
- found: Keeps a ref marking {phase, done, at}, reset whenever phase changes; pct is done/total (0 if no total); eta is computed from progress moved since the mark divided by time watched, but only once moved>20 and watched>5s, else null.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `ProgressTrack`
- spec 3 · read at `b842fdf090ff` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:09Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders the shared progress-bar track: a div with a fill bar whose width is set from pct when there's a real total, but falls back to an indeterminate "sweep" CSS animation (track-sweep class) when progress is null or has no total yet.
- found: Track div with fill bar width set from pct (rounded percent) when progress is non-null; when progress is null, renders a track-sweep indeterminate animation instead — condition is on progress being present, not specifically on total.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `phaseLine`
- spec 3 · read at `60b615989acb` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:11Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a human-readable status string from a Progress object, e.g. "Scanning 67,511 / 111,029 files", selecting the current phase name and formatting the counts with thousands separators for six-digit readability.
- found: Capitalizes the phase name (or 'Working' if none), returns just "Phase…" if total is 0, otherwise formats done/total with toLocaleString for thousands separators and appends the unit string if present.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ProgressStrip`
- spec 3 · read at `affc1b60debc` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a small boxed overlay (styled like the caveat chip) containing the phaseLine(progress) text, positioned in a corner of the map so a still-running scan/blame pass stays visible even once the map itself looks visually complete.
- found: Boxed strip showing phaseLine text, an embedded ProgressTrack bar, and an ETA in minutes (from useProgress) when available.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ProgressPane`
- spec 3 · read at `085bec7d8a15` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:45Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Centered, wider variant of the progress display for an empty pane: shows an optional label heading, phaseLine(progress) text, a ProgressTrack bar, and ETA, mirroring ProgressStrip's content but laid out for standalone full-pane display. Likely renders a simpler placeholder when progress is null.
- found: Centered full-height/width flex column: phaseLine text or label/default fallback when progress is null, a ProgressTrack bar, and an ETA line when available — same shape as ProgressStrip but standalone-pane layout.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `Spacer`
- spec 3 · read at `2686cfa44c32` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:52:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a single flex-growing div (e.g. className="flex-1" or style={{flex:1}}) that also carries the Tauri drag-region attribute (data-tauri-drag-region) so this stretch of empty space in the toolbar remains draggable, matching the doc's explanation that it holds the drag attribute explicitly rather than inheriting it.
- found: A span with data-tauri-drag-region, aria-hidden, and classes min-w-4 flex-1 self-stretch — stretched full-height so the drag handle isn't just a thin sliver.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `FindButton`
- spec 3 · read at `ceaf4acd8029` · commit `74e9537` · read by claude-sonnet-5 · via claude · when 2026-09-03T06:57:18Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small UI button/pill component that toggles a "Find" panel. It renders a clickable element showing active/inactive styling based on `on`, applies disabled styling/attributes when `disabled` is true (though per the doc comment, the disabled state blocks the keyboard shortcut but not necessarily this click), and calls `onOpen()` on click to open the find panel. Probably includes an icon and maybe a keyboard shortcut hint label.
- found: Renders a circular magnifying-glass icon button styled via inline style based on `on` (active/accent vs neutral) and `disabled` (dimmed, default cursor), with title text explaining why it's disabled, calling onOpen on click. No actual toggle logic inside, just presentation.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `HistoryToggle`
- spec 3 · read at `40b3b1230124` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:39Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a small toggle button/pill (likely labeled "History") that reflects `on` as an active/pressed visual state, and is disabled when `busy` is true or when `traced` is false (since there's nothing to show for an untraced repo). Clicking it calls `onToggle()` — it does not itself kick off any tracing work, only flips the view.
- found: Renders a pill button toggling the history/replay view. Disabled only when turning ON (not on, and busy or untraced) — turning off/leaving is always allowed regardless of busy/traced state, so a running trace or lack of one never locks the user into the view. Shows a lock icon when untraced-and-off, a tooltip explaining why, and label 'Tracing…' vs 'History'.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The important asymmetric-disable logic (`!on && (...)`) and the "leaving is always allowed" invariant live only in an inline body comment, not in the params doc I was handed before reading.

### `Empty` — QUIRKY
- spec 3 · read at `7608306ba708` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:30Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: `Empty` renders the first-run screen with a single primary call-to-action button (wired to `onAdd`) to add a repo, plus a small check (likely an effect probing for `claude`/`codex` binaries or config) that states whether an agent CLI is available, and a brief mention of MCP as a secondary way to trigger the same action — no headline/pitch copy, since the doc says it deliberately dropped that.
- found: Renders a card with an Add-a-repo button, a line naming which coding-agent harnesses are installed (from `harnesses()`), a demoted mention of `sanity check` terminal use, and a whole CLI-linking sub-UI that checks `cliStatus()` and lets the user install/link the `sanity` CLI onto PATH, showing state depending on whether PATH already resolves to this app, a different build, or nothing.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

## web/src/CodeWindow.tsx

### the file itself
- spec 2 · read at `762905383664` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:56:10Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: This is the standalone entry point/root component for the popped-out code window (the one CodeView's onPopOut spawns): it reads repo/file identifiers (likely from URL query params or window args), loads/locates the target file node via fileByPath, and renders CodeView in its own window without an onPopOut handler (since a pop-out window popping out again is meaningless) but possibly with onClose wired to closing the window.
- found: Standalone popped-out window component taking repo/relPath as props (not URL params); re-resolves the file node from a fresh project scan (not shared state, since it's a separate JS context), watches system theme independently, renders a custom draggable titlebar, and passes to CodeView with no onSelect/onPopOut/onClose wired up since this window IS the code view.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Guessed URL query params for identifying repo/file where it's actually React props, and guessed there might be an onClose handler when in fact there's deliberately neither pop-out nor close.

### `fileByPath`
- spec 2 · read at `b2957f945f19` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:19Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively searches the Node tree starting at `node`, comparing each node's own path field to the target `path` and returning it on an exact match, otherwise recursing into `children` (likely short-circuiting into only the directory whose path is a prefix of the target) and returning null if nothing matches.
- found: Plain recursive depth-first search: returns node itself if it's a file matching the path, otherwise brute-force recurses into every child regardless of prefix, returning the first hit or null.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed an optimization (only descending into the directory whose path prefixes the target) that isn't there — it's an unoptimized full tree walk.

### `CodeWindow`
- spec 2 · read at `24f3c2c44870` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads repo/relPath props, looks up the file node via the fileByPath peer helper against the app's already-loaded scan state (from a shared store/context), handles a not-found/loading case, and renders the same code-view component the main window uses to show one file's source with syntax highlighting.
- found: Fetches the project list and scan via API calls (listProjects/projectScan) rather than reading held app state directly, finds the file with fileByPath, and renders loading/error/found states. Found state renders a custom draggable titlebar strip (Tauri drag region) with the relPath, plus theme sync via watchSystemTheme(loadTheme()), and the CodeView component with no pop-out/close since this window IS the code view.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/AgentMascot.tsx

### the file itself — QUIRKY
- spec 3 · read at `87ea6248950a` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A small React component (~34 lines) that renders a simple visual mascot/avatar representing an AI agent in the UI, probably an inline SVG icon or emoji-based badge, with minimal props (maybe size or a status/active flag) and no complex state or animation logic.
- found: A thin lazy-loading wrapper: it defers importing the heavy (~1.2MB, three.js-based) MascotFigure component via React.lazy, shows a sized placeholder span in a Suspense fallback to avoid layout reflow, and otherwise just forwards size/events/state/gaze/project/remint props through to the real 3D mascot component once loaded.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `AgentMascot`
- spec 3 · read at `8e1655967690` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:29Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A lazy-loading wrapper around `MascotFigure` (which lives in its own module for chunk-splitting). Uses React.lazy/Suspense to import MascotFigure, forwarding all the same props (size, events, state, gaze, project, remint), and renders a fixed-size placeholder box as the Suspense fallback so the row doesn't reflow while the chunk loads.
- found: Suspense wrapper around the lazily-imported MascotFigure, forwarding all props, with a same-sized empty span as the fallback to prevent reflow.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/Bloom.tsx

### the file itself
- spec 3 · read at `1b7a639e9ad6` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:52Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a decorative empty-state illustration — a scattered field of SVG flowers shown in the right pane when nothing is selected. Uses math helpers (petals, seedHead, leafPath) to generate rose-curve-based petal/leaf paths, small components (Flower, Leaf) built from those paths, a Tile component to lay out repeated/randomized flower instances, and a top-level Bloom component composing many tiles into the full scattered field.
- found: Decorative empty-pane SVG: a rose-curve (rhodonea, fattened by fractional power) flower shape and a Vogel-phyllotaxis seed head compose into Flower/Leaf, placed on a p6m wallpaper-group hexagonal lattice (6-fold, 3-fold, 2-fold sites) in a Tile, drawn nine times at offsets to make SVG pattern clipping tile seamlessly, rendered as a repeating `<pattern>` fill via Bloom.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header explains deep math/design rationale (crystallographic restriction, why 6 not 5 petals, why scattered not vined, the nine-copies tiling trick) that is essential to understanding the seemingly-arbitrary constant choices (K=3, T, lattice point arrays) and isn't recoverable from the code alone.

### `petals`
- spec 3 · read at `4cb8082affa4` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Generates an SVG path `d` string tracing the rhodonea rose curve r = a*|cos(k*theta)|^(1/P), looping theta from 0 to 2*pi (or pi depending on k parity), converting polar (r,theta) to cartesian x,y at each step, and joining the points into a "M x y L x y L x y..." path string.
- found: Loops 240 steps over theta in [0, 2pi], computes the fattened rhodonea radius using constants A/K/P, converts to cartesian, and builds an SVG path string with M/L commands, closed with Z.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `seedHead`
- spec 2 · read at `b0599e867627` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:35Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Generates a small cluster of circles (cx, cy, r) representing the flower's central seed disk, likely using a phyllotaxis/golden-angle spiral (Vogel's model) to place seeds in a packed circular pattern with radius growing as sqrt(index).
- found: Places 13 seeds at golden-angle increments (n*GOLDEN) with radius scaling as A*0.115*sqrt(n), each a fixed small dot radius A*0.05 — classic Vogel phyllotaxis spiral.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `Flower` — QUIRKY
- spec 2 · read at `9c287bf640f8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:32Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders an SVG group scaled by s, composing the petals() helper (drawing the fattened rhodonea rose-curve path from the file doc) with a central seedHead element, assembling one flower shape. No component-level docs since the math is explained at file level.
- found: Draws a filled PETALS path (a precomputed constant, not a call to a petals() helper), then the same PETALS path again as an outline scaled to 0.45 (reusing the same rose-curve shape rather than redrawing at a different k), then maps a SEEDS array of precomputed circles for the center. No seedHead call.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I assumed petals()/seedHead() were called as functions; instead PETALS and SEEDS are precomputed module-level constants used directly, and the center is drawn as discrete seed circles rather than a single seedHead element.

### `leafPath`
- spec 3 · read at `6d4b644d3fb7` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:27Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns an SVG path `d` string drawing a vesica/lens shape: starts at one tip (0,-L), draws an elliptical/circular arc out to a maximum width and back to the other tip (0,L), then a mirrored arc back to the start, using a radius derived from L via the vesica piscis geometry (arc radius equal to the distance between the two circle centers, i.e. related to L by a sqrt(3) or similar factor).
- found: Two-arc vesica path as predicted, but tips are along the x-axis (-L,0) to (L,0) rather than the y-axis, and the arc radius is just an empirical constant L*1.16 rather than a geometrically-derived vesica-piscis factor.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Leaf`
- spec 3 · read at `09b88f7e8082` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering a single decorative SVG leaf shape at a given scale `s`, likely reusing `leafPath` from its peers to generate the path data and applying a fill/stroke style consistent with the flower motif.
- found: Renders a scaled SVG group containing a leaf outline path (from leafPath(L), semi-transparent fill + stroke, using currentColor) plus a straight midrib line down the center of the leaf.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `Tile` — QUIRKY
- spec 2 · read at `1b3b535c7b4d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:48Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A React component with no props that picks randomized parameters (rotation, scale, position jitter, maybe seed/color) via useMemo/useState and renders a <Flower> (or <Leaf>) inside a positioned wrapper — one repeatable cell used to tile the empty right pane into a scattered field of flowers.
- found: Deterministically renders one repeating SVG tile: fixed sets of precomputed lattice points (SIXFOLD, THREEFOLD, TWOFOLD) placing full-size Flowers, smaller rotated Flowers, and Leaves at exact translate/rotate transforms — no randomness at all, it's a symmetric tiling unit.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Assumed randomized placement; it's actually a fully deterministic symmetric lattice using precomputed point arrays.

### `Bloom` — QUIRKY
- spec 3 · read at `41d6c7d9f291` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:53Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the decorative empty-state illustration: a scattered field of flowers built from the rhodonea-curve petal math described in the file doc, using helper functions/components (petals, seedHead, Flower, Leaf, Tile) to generate several flowers at varied positions/sizes/rotations inside an SVG or div wrapper, accepting an optional className to merge into the container.
- found: Renders a full-bleed SVG with a repeating <pattern> built from a grid of Tile components offset by OFFSETS, filling a background rect with that pattern — a tiled decorative field rather than directly-placed individual flowers.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The comment explains why patternTransform rotation was removed (looked crooked, not deliberate) — irregularity is meant to live in the Tile/motif rotations instead, which isn't visible from this function alone.

## web/src/components/CodeBlock.tsx

### the file itself — QUIRKY
- spec 3 · read at `44caf565d2ae` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:35:11Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A component for displaying a code snippet with line numbers: `dedent` strips common leading whitespace from a multi-line string so indentation from the source doesn't leak into the display, `Lines` renders each line as a numbered row, and `CodeBlock` is the exported wrapper that ties them together, likely used to show function bodies/passages elsewhere in the map's detail panels. No syntax highlighting engine is implied by the peer names, so it's probably plain monospace text rather than tokenized highlighting.
- found: A dual-size code viewer: an inline scrollable box that expands via a corner button into a full modal (Overlay-based, Escape-to-close, with a copy button and title/subtitle header). Uses `dedent` to strip the shared indentation and `tokenize` for lightweight highlighting, but also supports a non-highlighted prose mode (for doc comments) that wraps instead of scrolling, and an optional `marks` map that annotates specific file lines with a label/reason column, used so other lenses (like Complexity) don't reimplement their own code box.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level doc comment exists — the rich JSDoc block above `dedent` actually documents CodeBlock as a whole (a misplaced/merged header) rather than describing `dedent` itself.

### `dedent`
- spec 3 · read at `d3e7ad5ad7e6` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:16Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Splits the code into lines, then computes the shortest common leading-whitespace prefix across all non-blank lines (skipping blank lines when measuring, since they'd otherwise force a zero-length prefix), comparing character-by-character rather than counting indent levels so mixed tabs/spaces aren't misjudged. It then strips that literal prefix from the start of every line and rejoins them with newlines.
- found: Splits on newlines, tracks a running common leading-whitespace prefix by narrowing it character-by-character against each non-blank line's leading whitespace, then strips that literal prefix from every line and rejoins.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `CodeBlock`
- spec 3 · read at `a2d3a08e6d9c` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a card: header row with title/subtitle (and maybe a copy button and expand-to-modal control), an optional caveat message, then a scrollable body built from `dedent(raw)` rendered via `Lines`, with a gutter numbered from `startLine`, syntax highlighting unless `highlight` is false, sized by `height`/`maxHeight`, square/borderless when `flush`, and per-line annotations drawn from `marks` (label + why) in their own column beside the marked lines.
- found: Renders the collapsed code box (dedented code via `Lines`, optional caveat above it, a hover-revealed expand button) plus, when opened, a modal (via `Overlay`, closable on Escape/backdrop) showing the same body with a header (title/subtitle/copy button/close). No visible title/subtitle in the collapsed state — those only appear in the modal.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `Lines`
- spec 3 · read at `9dbcfc65e54b` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a table of code lines, splitting `code` into rows with a gutter cell showing startLine + index (or just index+1 if no startLine) and a code cell; highlight toggles syntax highlighting; marks annotates specific line numbers with a label/tooltip using the why text, likely shown as a margin note or hover title.
- found: Renders a table of code lines with an optional gutter cell (only if startLine is given) showing the real file line number, a code cell that either tokenizes/highlights the line or wraps it as prose depending on `highlight`, dimming unmarked lines when `marks` is present and bolding marked ones, and an optional trailing mark-label column with the `why` as a title tooltip.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed that the whole gutter column is conditionally omitted when startLine is undefined, and that marked lines are made bold/prominent rather than unmarked lines being dimmed as an afterthought — the emphasis direction (marked comes forward) was called out deliberately in a comment.

## web/src/components/CodeView.tsx

### the file itself
- spec 3 · read at `3cf262a226d6` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:08Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This file implements the source-code viewer panel — a CodeView React component that renders a file's source text alongside a Minimap for navigation, with ownerByLine/rampAt/rampStops computing a color ramp per line (likely author/heat/ownership) so the code pane visually echoes the sunburst's coloring when you drill into a function or file.
- found: Renders a single file's source as a line table with per-line heat wash/gutter color keyed by the owning function, clickable rows to select a function, a canvas Minimap showing the whole file's heat/indentation profile for click-to-seek navigation, plus scroll-to-reveal-function logic and optional pop-out/close controls.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `ownerByLine`
- spec 2 · read at `39b85adfda97` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:18Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a Map from 1-indexed line number to the Node (chunk/function) that covers it, by iterating over the file's child nodes (each with a start/end line range) and, for each line in that range, setting map[line] = node. Likely handles overlapping/nested nodes by letting later (perhaps more specific) nodes overwrite earlier ones.
- found: Iterates file.children, skipping non-'func' nodes and those with a null line, then for each line from fn.line to fn.endLine (falling back to fn.line if endLine is null) sets map.set(line, fn). Returns the resulting Map.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `rampStops`
- spec 2 · read at `5a30a1533442` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:53:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Reads the getComputedStyle of the given element to pull out the five heat-ramp CSS custom properties (hex color strings), parses each hex string into an [r, g, b] number triple, and returns them as an array in ramp order — feeding a canvas-based color interpolation (rampAt) that can't use CSS color-mix() directly.
- found: Reads five `--heat-0` through `--heat-4` CSS custom properties via getComputedStyle, parses each hex color string into an [r,g,b] triple (with a gray fallback), and returns them in order for canvas-based interpolation.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `rampAt`
- spec 2 · read at `815003ab0e2f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Given a sorted array of [position, value1, value2] color stops and a query t, it finds the two stops bracketing t, linearly interpolates between their component values, and returns a CSS color string (e.g. rgb(...) or hsl(...)) representing the ramp color at that point — used for the minimap's heat/color gradient.
- found: Treats stops as evenly-spaced [r,g,b] triples (no explicit position field), maps t (clamped 0-1) into the stop index space, linearly interpolates each RGB component between the two bracketing stops, and returns an rgb(...) CSS string.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Assumed each stop carried an explicit position value; actually stops are just evenly spaced by array index.

### `Minimap`
- spec 2 · read at `a5d4d74a6d60` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:22Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a canvas (or absolutely-positioned divs) drawing one thin bar per line, sized/positioned by that line's leading indentation and length, colored by a heat ramp (via rampAt) looked up per-line through ownerByLine. It listens to scroller's scroll position (re-rendering on scrollTick) to draw a viewport-indicating overlay rectangle, offset by insetTop, and supports click-to-scroll/jump to the clicked line in the main code view.
- found: Draws a full-file minimap onto a canvas: one heat-colored background bar per analyzed line (via rampAt/paintHeat), one indentation-shaped foreground bar per line of text (dimmed for comment lines), and a translucent rectangle showing the current scroll viewport. Supports click/drag (pointer capture) to seek, centering the scroller on the clicked line.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `CodeView` — TANGLED
- spec 3 · read at `2952957d6362` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:00Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the file's source lines with a colored heat gutter per line (via tokenize/ownerByLine/rampAt/rampStops), highlights the selected node's line range, scrolls to and flashes the reveal target (using the nonce to force re-scroll on repeat), and renders a Minimap alongside plus header controls (onPopOut/onClose buttons, conditionally shown).
- found: Fetches file source via readSource in an effect, shows loading/error states, computes owners-by-line and renders each line as a table row with a heat-colored gutter bar and background wash, highlights the selected node, shows a scroll-triggered nonce-driven reveal effect (deliberately excluding `file` from deps to avoid snapping back on tree re-renders), tracks a scrollTick counter for the Minimap, and renders pop-out/close buttons plus a Minimap sibling.
- predicted: most · documented: some · derivable: no · legible: some · trap: no
- note: The scroll-to-reveal effect intentionally omits `file` from its dependency array because the tree is rebuilt as a new object every poll — worth flagging since eslint-disable comments like this are easy to "fix" by mistake.

## web/src/components/ColorKey.tsx

### the file itself
- spec 3 · served in 2 parts · read at `af29a31b4e6c` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:48:51Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: ColorKey.tsx is a React component rendering the color legend/key overlay for the map UI, explaining what each color band means for the active lens (Complexity, Reach, Age, etc). It exports a Legend/ColorLegend component, a ModeSwitcher for cycling between lenses, a Lock toggle to pin the current mode, a shortcut helper mapping keys to actions, and a useMapEdge hook to position the legend relative to the map's visible edge.
- found: A color-legend/key overlay for the map: Lock (padlock icon showing a locked/unavailable lens), Legend (renders mode-specific keys — gradient ramp for calibrated lenses, discrete swatches for categorical modes like traps/callers/clones/reach, named+ranked author list for categorical author/owner mode), shortcut (keyboard-shortcut-string helper), ModeSwitcher (dropdown to pick the active lens, replacing an earlier segmented-tab row that ran out of width, shows lock icons and shortcut keys), useMapEdge (measures the map's circular composition bounding box so the legend text can flow around it via CSS shape-outside), and ColorLegend (top-level component combining Legend with stale/unread indicator swatches).
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `Lock`
- spec 3 · read at `8e42cecb563c` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:42Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a small SVG padlock icon sized by `size`, colored with the accent color when `keyed` is true (meaning some button can unlock this state) and a muted neutral ink color otherwise, unless `color` is explicitly passed to override the tint (e.g. when sitting on a colored background).
- found: Renders an inline SVG padlock (rect body + arc shackle) sized by `size` (default 7), colored via CSS `color` (accent when keyed, muted-foreground otherwise, or the explicit override), with opacity dimmed to 0.7 when not keyed for extra visual distinction beyond just hue.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Legend` — QUIRKY — TANGLED
- spec 3 · read at `35dbe8880461` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:45:02Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders the color key for the map, branching by mode: for calibrated/ordered modes (Age, Complexity, Surprise etc.) it shows a gradient heat ramp labeled with the mode-specific endpoint words from `views`/rampEnds; for categorical modes (like owner) it lists each category with its swatch color looked up via `ranks` so colors stay stable across replay frames rather than being recomputed from list position. It's positioned relative to the map using the `edge` circle geometry, and may include a lock affordance and keyboard shortcut hint per the peers.
- found: Branches on mode into several distinct key styles: categorical (owner) lists ranked/named categories up to a cap with "N more · shades repeat" and neutral counts, using a CSS float + shape-outside trick to wrap the text around the map's circular edge; boolean modes (traps) get a single square swatch with no scale; banded modes (callers, clones, reach) each render a fixed small legend of swatch+label pairs from constants; and the remaining calibrated modes fall through to a labeled 24-step gradient ramp with mode-specific endpoint words from rampEnds.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: I expected just a two-way categorical/gradient split; there are actually five distinct rendering branches (categorical, traps, callers, clones, reach, ramp), each with its own key shape, plus a non-obvious CSS shape-outside layout for wrapping around the map's circle.

### `shortcut` — TRAP
- spec 3 · read at `696e7c79fca5` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:45:45Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line lookup: index 0-8 maps to ⌘1-⌘9, index 9 to ⌘0, index 10 to ⌘-, anything past that returns null.
- found: Returns the bare key label (no ⌘ prefix) for indices 0-8 as '1'-'9', 9 as '0', 10 as '-', and — not mentioned in the doc — 11 as '=', falling back to null past that.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The doc explicitly says "a twelfth lens gets no shortcut," but the code gives index 11 (the twelfth lens) the '=' key — a doc/code mismatch that would mislead whoever adds a 13th lens trusting the comment.

### `ModeSwitcher` — TANGLED
- spec 3 · read at `92b9a379241a` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:44:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a dropdown/pulldown trigger button showing the current color mode's name in its accent color at a fixed minimum width, which opens a menu listing every ColorMode option. Options present in `locked` are rendered disabled/dimmed with their lock reason shown (likely via title/tooltip), clicking an enabled option calls onMode(mode) and closes the menu, and there's probably keyboard/shortcut handling given the `shortcut` peer.
- found: A custom dropdown: a chip-style trigger button tinted with the current mode's accent color showing its label (and a lock glyph if the current mode is locked), toggling an absolutely-positioned listbox menu. A full-screen invisible backdrop div closes the menu on any outside click/contextmenu. Each menu row shows a lock slot, the label, and a colored keyboard-shortcut badge (⌘+digit) tinted in that row's own mode color; locked rows are dimmed (not disabled) with a tooltip explaining why; clicking a row calls onMode and closes the menu; a footer shows a static step hint.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: The extensive inline comments explain design history (why a segmented control became a dropdown, why locked rows are dimmed not disabled, why the shortcut badge replaced two separate indicators) that isn't derivable from the code alone.

### `useMapEdge`
- spec 3 · read at `d57448d25a36` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:07Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Hook that measures the chart pane and the key box to compute a circle's radius and center relative to the box, for a shape-outside exclusion so text wraps around the circular map. Returns null when there's no measurement yet or the pane is too small for the circle to reach the box's corner. The `key` param gates re-measurement to avoid a resize-effect loop, only recomputing when it changes.
- found: Finds the chart pane via closest('[data-chart]'), measures the actual rendered rings SVG group ([data-rings]) bounding box (not the pane's own size) to get the circle's radius (half the smaller dimension) and center in the box's own coordinates, storing it keyed by `key` so it only remeasures when key changes; a separate ResizeObserver on the pane clears the cached edge on resize to force remeasurement.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `ColorLegend` — QUIRKY
- spec 3 · read at `6bb441dc5bed` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:43:46Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that renders the Legend component inside a bordered/boxed container styled to visually match ModeSwitcher, passing through mode/views/categories/ranks/stale/unread. The at prop is used only as a React key to force remount when the drilled node changes, not read for rendering logic.
- found: Renders the Legend plus, only in reading-painted modes (paintsFromReadings) and when counts are nonzero, a small ribbon of stale/unread swatch counts. No border/box wrapper at all (explicitly rejected); instead uses useMapEdge with a cache key built from mode/categories/stale/unread/at to reshape the key's edge to match the map's curve, so text hugs a ragged/curved boundary rather than sitting in a rectangle.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

## web/src/components/CommitCard.tsx

### the file itself — QUIRKY
- spec 3 · read at `6e9c342f2510` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A file with a single exported component, CommitCard, that renders one git commit in the history/replay commit-log list: abbreviated sha, author, relative/absolute date, commit message (possibly truncated), and maybe a stat like files-changed or insertions/deletions. It's likely clickable to jump to that point in the history replay, with hover/selected styling, and receives a commit object as props plus maybe an onClick/onSelect callback.
- found: CommitCard is actually a modal overlay (not a list row) that opens on demand for a given sha, lazily fetching full commit detail via commitDetail() only when opened, then showing the subject/author/body message and a per-file added/removed stat list (no diff/patch), with escape-to-close and copy-full-sha affordances.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: The file-level docs field was empty even though the file itself has a rich JSDoc-style header explaining the design rationale (why no diff, why fetch-on-open, why rows became openable) — that header just wasn't surfaced in the handout's docs field.

### `CommitCard`
- spec 3 · read at `17ea012165c3` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:55:56Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A modal/popover component that, on mount (or when sha/repoKey changes), fetches the commit's detail (full message, author, date, list of changed files) via an effect and shows a loading state until it arrives. Renders the message and file list only (no diff), with a close affordance that calls onClose, and guards against stale fetches if sha changes before the request resolves.
- found: A modal (via Overlay) that lazily fetches commit detail on mount/sha-change with a `live` guard against stale responses, shows loading/error/loaded states, and renders sha, date, copy-full-sha button, author, message body (as preformatted text), and a file list with per-file +/- stats (or a note when git show reports no files for a merge). Escape key closes it, same as backdrop click via Overlay.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted the fetch/guard/close mechanics correctly but missed the specific UI details (copy button, escape handler, merge-with-no-files message, per-file stat formatting).

## web/src/components/CommitLog.tsx

### the file itself — QUIRKY
- spec 3 · read at `206a8e4fb093` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:05Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file implements the commit-log pane: the exported `CommitLog` component (a virtualized, paged, playhead-following list of commits with a dimming scrim over what's still to come, opening a CommitCard on click) plus a small `stamp` helper that formats a commit's timestamp into the short string shown in each row. It has no file-level header comment — the rationale lives on the CommitLog docstring itself rather than at the top of the file, since the file is really "one component and its formatting helper," not a broader module.
- found: The file has no header comment — it opens straight into imports and tuned constants (ROW_H, OVERSCAN, PAGE, FOLLOW_MS, INFLIGHT). It defines three things: the memoized `Row` component (selection shown as a background on the row itself, which is what earlier resolved to being the "cursor" the CommitLog docstring mentions — not a separate overlay element), the `stamp` timestamp formatter, and the exported `CommitLog` component itself.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: My earlier CommitLog reading correctly flagged that the docstring's "cursor" overlay wasn't in that function's body — it's here: Row applies `selected` as its own background, confirming the design note under Row rather than a missing feature.

### `stamp`
- spec 2 · read at `007bc6229dfa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a Unix timestamp ts and formats it into a short human-readable string (e.g. via new Date(ts) and toLocaleTimeString/toLocaleString) for display next to a commit log entry.
- found: Converts a Unix seconds timestamp to a short locale date string like "Aug 13" (month + day, no time).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `CommitLog` — QUIRKY — TANGLED
- spec 3 · read at `63889155572f` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:55:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a paged, oldest-at-top scrollable commit log fetched from repoPath, filtered/narrowed by `scope`/`frames`. Rows are rendered once via memoization (keyed off stable data, not `index`), and instead of restyling each row per frame, two absolutely-positioned overlays move: a cursor marking the current commit (`index`) and a scrim covering rows not yet reached. While `playing`, an effect auto-scrolls the pane to keep the cursor in view; clicking a row calls `onIndex` to seek.
- found: Renders a virtualized, paged commit log (only visible rows + overscan are fetched/rendered, in PAGE-sized chunks with a bounded number in flight and pages far from the viewport evicted), oldest-at-top. A layout effect follows the playhead — centering while playing (throttled via FOLLOW_MS/performance.now), minimally scrolling into view when paused/scrubbed, and doing nothing when the move originated from a click in the log itself (tracked via fromClick ref). The only element actually absolutely-positioned/transformed for performance is the "still to come" scrim over the static row list; row selection highlighting is handled per-row via a memoized `selected` prop rather than a separate cursor overlay in this function.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Docs promised "a cursor on the current commit, and a scrim" as the two moving overlays, but this function only implements the scrim as an absolutely-positioned element — the cursor, if it exists, must live inside the Row peer.

## web/src/components/Counts.tsx

### the file itself
- spec 3 · read at `a7d41a04bf6f` · commit `6cf7dc9` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:43Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A small React component named Counts that renders a compact numeric summary (e.g. "N files, M functions, K directories") of the currently displayed codebase/selection, likely shown near the top of the visualization as an at-a-glance overview. No file-level doc.
- found: Renders "N lines · M functions · K commits · J excluded" for a node, where the commit figure is either the full git-log commit count for a subtree, or for a single function the distinct commits its current lines trace back to via blame — deliberately labeled differently and omitted entirely (never shown as 0) when there's no history.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Counts` — QUIRKY
- spec 3 · read at `741ca19c1dd9` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:49Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A shared React component that renders "lines / functions / commits" text for any node type (repo, directory, file, or function). It reads line count off `node`, shows `functions` only when provided (omitted for a function node since it isn't made of functions), and renders a commit count segment with a label that differs depending on whether it's a true "touched in history" count (repo/dir/file) versus a blame-traceback count (function) — and omits the commit segment entirely rather than printing 0 when no history data is available.
- found: Renders "N lines · N functions · N commits · N excluded" pieces, each conditionally shown. Lines always show. Functions show only when the prop is defined (omitted for a function node). Commits show only `allCommits` (never present on a function at all anymore — the old per-function blame-traceback count was deliberately removed as a different, non-comparable quantity and now lives elsewhere as churn). Excluded shows a `.sanityignore` count when nonzero.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The docs handed to me described the OLD behavior (a function showing a blame-traceback commit count) which the code's own comment says was deliberately removed months ago — the given docs actively mislead rather than describe current behavior, and I also missed the `excluded` segment in my prediction entirely.

## web/src/components/Crumbs.tsx

### the file itself
- spec 2 · read at `f854d81892ed` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:18Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a breadcrumb trail for the current path/directory, splitting it into clickable segments so the user can navigate up to any ancestor directory. Likely takes a path string and an onNavigate callback prop, maps path segments to clickable spans/buttons separated by a delimiter (e.g. "/"), and highlights or disables the last (current) segment.
- found: A breadcrumb nav component showing the ancestry trail (root to current node) as clickable buttons, plus a separate "Up" button. Collapsed single-child chains keep their internal slashes dimmed so the node reads as one place, while inter-crumb separators stay the louder visual mark.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Doc comment explains non-obvious history (trail is ancestry not drill-stack, past bug with single-link rendering) that couldn't be derived from the code alone.

### `Crumbs`
- spec 2 · read at `9197413e9b46` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:00Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders the breadcrumb trail as a row of clickable spans, each calling onGo(index) on click, with the current (last) node rendered non-clickable or differently styled. A crumb name that contains slashes (a collapsed single-child chain) has its internal slashes dimmed, while the actual separators between distinct crumbs are the brighter mark. If onUp is provided, it renders an additional "up" affordance that calls it.
- found: Renders each trail node as a button calling onGo(i), with the last node still clickable (recenters) but bold/foreground-colored instead of accent; internal slashes within a collapsed-chain name are dimmed (opacity-40) while true crumb separators are opacity-50; ends with an Up button disabled when onUp is absent.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted the last crumb as non-clickable, but it's still a button — clicking it re-centers on the current node.

## web/src/components/Detail.tsx

### the file itself
- spec 3 · read at `df27c9833e71` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:35:11Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file implements the right-hand Detail panel component used in App.tsx to describe whatever node is selected or focused on the map. It likely has helper functions for ranking/measuring a node's stats (rank, measure), functions for computing and rendering authorship/provenance info (provenance, provenancePieces, Provenance component), a Contents component listing a container's children (files/functions) with their sizes or scores, and the top-level Detail component that assembles all of these into the panel shown in the sidebar aside.
- found: Right-hand detail panel: rank/measure compute per-lens sort key and displayed quantity for a node; provenance/provenancePieces/Provenance describe who/what produced a reading; Contents lists a container's children sorted by the active lens; Detail is the top-level component that shows a repo Summary when nothing is selected, reuses Summary (scoped) for containers, and for a leaf function renders a header (name, trap badge, breadcrumb path, counts), the LensPane reading, a Contents list, and a Provenance footer.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `rank` — QUIRKY
- spec 3 · read at `ab7551db78dd` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:39:59Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Switches on `mode` (a ColorMode like "predicted", "documented", "legible", "trap", etc.) and pulls the corresponding numeric value out of `views` for node `n` — likely an aggregate/average score or count for that node in that category — returning a single number used both to sort the list and to color the ring for the currently selected mode.
- found: Per-mode ranking/coloring value: churn returns the churn count at the currently selected window index (views.churn.at), age returns negative days-since-touched read against views.age.read (or -1 if null) so recent sorts first, callers returns 1/(1+callers) so uncalled/rare nodes rank highest, reach returns raw call count, clones returns cloneSize (bigger groups first), and the default falls through to wedgeHeat(n). Nodes with no score return -1.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `measure`
- spec 3 · read at `fa3fe1c19943` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:52Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Switches on `mode` (the active lens: surprise, complexity, age, churn, tangle, etc.) and extracts the single relevant numeric field from `n` (or `views`) for that mode, formatting it into a short string with its unit baked in (e.g., "42%", "1.2k loc", "3mo") to fit an 8-character column — returning `null` when that mode has no applicable number for this node (e.g., a node with no history).
- found: A per-mode switch: blame returns null (author is categorical, already shown by swatch), churn returns commit count at the current window with ×, callers/reach/clones return counts with their own glyphs (×, →, ×), age returns "today"/"Nd ago", surprise returns either a human grade word (for read functions) or a rounded heat degree (for model-scored ones), and everything else falls back to the LOC count.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `provenance` — QUIRKY
- spec 3 · read at `66e52b241034` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:40:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a node and an optional model name, returns a one-sentence human-readable string explaining where the displayed numbers (rank/measure) came from. Likely branches on whether model is non-null: if present, says something like "Computed by {model}"; if null, falls back to describing a cached, heuristic, or default source.
- found: Returns a one-sentence explanation of where a node's score came from, with priority-ordered checks: first if the node is too large to read (returns a size/ceiling message referencing a READ_CEILING constant), then if not yet analyzed, then based on node.score.source — 'agent' (formats who/when read it via MCP), 'model' (measured by the given model name), or falls back to 'the offline proxy'.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `provenancePieces`
- spec 3 · read at `2b570177639d` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:35:29Z · by ross@rossturk.com · warm reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Splits the provenance sentence into three renderable pieces for the footer's flex layout, so the model name (unbounded length) is the part that truncates while "Read by" and "at <commit>" stay fixed. Returns the full sentence as the first element with the other two empty when the node wasn't read by an agent (nothing to split), and ['Read by', model, 'at <commit>'] when it was.
- found: Splits the provenance sentence into a fixed lead, a variable-length model name, and a fixed commit tail so the footer's flexbox can truncate only the model name; returns the whole sentence as a single piece when the node wasn't read by an agent.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `Provenance`
- spec 3 · read at `126a03caf544` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:35:50Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Calls provenancePieces(node, model) to get an array of text pieces describing who/what produced the numbers (e.g. agent names, the model, or measured vs estimated), then joins/renders them as a single muted line of text.
- found: Destructures provenancePieces(node, model) into three parts (lead, who, tail) and renders them as a flex row of spans — the lead and tail have fixed/shrink-0 width while the middle "who" (model name) is the one allowed to truncate — with the full provenance string as a hover title.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the specific three-part lead/who/tail structure and the deliberate truncation-only-on-the-model-name layout detail, which the code comment calls out explicitly.

### `Contents`
- spec 3 · read at `cce0b87347eb` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:43:33Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a list of node's children sorted by heat/rank (via the rank peer and ranks map) descending, with unread/gray children sinking to the bottom instead of being treated as low-heat. Each row shows the child's name, a size measure, and a color derived from mode; clicking calls onSelect, double-click calls onDrill.
- found: Renders node's children as rows sorted first by whether they've been analyzed (unread sinks to bottom), then by rank(mode)-derived heat, then loc as tiebreak. Each row shows a color swatch via colorFor, the name, and a measure(mode) value; click selects, double-click drills in.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Detail` — TANGLED
- spec 3 · read at `e9ccbfd163ca` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:02Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is the main detail/inspector panel that renders info about the currently selected (or focused) node: a title/path header with breadcrumb via `owners`, provenance info, and a "Complexity" section that shows the node's tangle/cognitive score against `tangleBands`/`tangleOver` for context. It likely branches on whether `node` is null (showing `focus` info instead) and whether `replaying` is true (disabling live lens sections like neighbours/blame that only make sense against the working tree), wiring up `onSelect`, `onDrill`, `onShowIn`, and `onJump` callbacks to child elements.
- found: Renders the detail/inspector pane. With no node selected it shows a Summary of the focus subtree (or an idle Bloom pattern if nothing has been scanned yet). With a node, non-leaf (container/file) nodes reuse the same Summary component scoped to that subtree, while leaf functions get a bespoke header (name, trap badge, breadcrumb path, counts) plus LensPane (the eleven-lens breakdown) and a Contents list, with a Provenance footer when the mode paints from readings.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: The top-level `docs` field was empty; all the substantial rationale lived in inline JSDoc on individual params and in body comments, which I only saw after revealing.

## web/src/components/Dials.tsx

### the file itself
- spec 3 · read at `796bf3155e27` · commit `6cf7dc9` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This file now just contains the `Gauge` component — a reusable half-circle SVG dial (used to render surprise/docs/churn/legibility values elsewhere), since the four-gauge row itself was removed and only the primitive that draws one half-circle arc survived. Small single-purpose visual component: takes a value/fraction and label, renders an SVG arc with some color/fill logic.
- found: Exactly the Gauge half-circle SVG dial component (180° arc, ramp-colored, with unread/word variants) plus extensive doc comments explaining the removed dial-row and design rationale for each visual choice (track dimming, cap style, font-size fitting, label wrapping).
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc comments here carry design history (what was removed and why) that isn't recoverable from the code alone, but they're unusually thorough and accurate for what remains.

### `Gauge`
- spec 3 · read at `35d9d87058bc` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:37Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a fixed-180° arc (SVG or conic-gradient) whose sweep is driven by `value`, colored by sampling `ramp` at `rampValue ?? value` (unless ramp is undefined, in which case it uses a neutral/accent color). If `unread` is true, it draws only the empty track with no needle/fill and a placeholder like "—" instead of a number. In the center it prints either `word` (for four-step qualitative readings) or the numeric value (e.g. as a percentage), with `label` beneath and `hint` wired up as a title/tooltip.
- found: SVG half-circle gauge: fixed 180° arc path, value clamped and drawn as a dasharray fraction of arc length, colored via heatColor(ramp, rampValue??value) or var(--accent)/var(--secondary) fallbacks. Unread suppresses the value arc and shows an em dash. Center text is word or rounded percentage, dynamically sized to shrink-fit longer words; label wraps below with tight tracking.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: Missed the shrink-to-fit font-size calc, the butt-vs-round strokeLinecap zero-value fix, and the label wrapping/tracking details — all called out via inline comments only visible after reveal.

## web/src/components/ExportDialog.tsx

### the file itself
- spec 3 · read at `b48085f52cbc` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:27Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A React dialog component (ExportDialog) that lets the user configure and trigger exporting the commit-replay "movie" (from movie.ts) as a video file — options likely include resolution, frame rate/pace, and which commit range to cover. Helper functions frameOf, pace, ms, lasting, and suggest compute derived values: mapping playhead/commit position to frame number, pacing/frame-rate math, formatting durations (ms, lasting = human-readable duration), and suggesting sensible default export settings (e.g. based on commit count so exports don't run absurdly long). No file header doc, so the responsibility has to be inferred purely from these pieces.
- found: A React dialog (ExportDialog) for exporting the commit-replay sunburst as an MP4: lets the user pick length, resolution, ground (light/dark) and color lens, then drives movie.ts's `record` to rasterize frames and `saveMovie` to write the file, showing live per-stage progress (fetch/fold/raster/draw/encode) and codec fallback messaging. Helpers format duration/size labels and derive a default filename; no file-level header doc exists even though individual consts/functions carry rich JSDoc.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: frameOf actually computes pixel width/height from a chosen frame height, not a frame-number/playhead mapping as I guessed from the name alone.

### `frameOf`
- spec 3 · read at `57a2a9bcea07` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:22:20Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the export frame's width from a given height using the 16:9 ASPECT ratio (from movie.ts), then rounds the width to the nearest even number since video encoders require even dimensions for chroma subsampling, returning { width, height }.
- found: Exactly as predicted: width = height * 16/9, rounded to nearest even number, height passed through unchanged.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `pace` — QUIRKY
- spec 3 · read at `72df0d0149a5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:00Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Given a total count of items to export, computes an estimated duration (using some assumed per-item rate and probably the `ms`/`lasting` helpers) and returns a human-readable string like "~2 minutes" for display in the export progress/estimate UI.
- found: Formats a duration given in seconds as a short label: minutes rounded (e.g. "3m") once it reaches 60 seconds, otherwise seconds (e.g. "45s"). Doesn't call the sibling ms/lasting helpers at all.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Despite the name "pace", this is a plain seconds→"Xm"/"Xs" formatter, not a rate/throughput calculation — the input is a duration in seconds, not an item count.

### `ms`
- spec 3 · read at `4dddd82a330c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:48Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Formats a millisecond duration into a short human-readable string, e.g. showing seconds with one decimal if >= 1000ms, or "Xms" otherwise, for display in export progress/time estimates.
- found: Exactly as predicted: >=1000ms shows seconds to one decimal, else rounded milliseconds.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lasting`
- spec 3 · read at `a07a92bf9be7` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:55Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Converts a duration in seconds to a human-readable string like "5s", "3 min", or "2 hr", picking the coarsest unit (seconds/minutes/hours) that still represents the value without rounding down to zero, and rounding the number up (Math.ceil) within that unit so the estimate never undershoots.
- found: Three-tier ceil-based formatting: >=5400s (1.5hr) shows hours, >=90s shows minutes, else shows whole seconds — matches my general shape but the actual cutoffs (5400, 90) are more deliberately chosen than the simple 3600/60 I guessed, presumably to avoid awkward '1h' at 61 minutes or '1 min' at 61 seconds.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `suggest`
- spec 3 · read at `862ad60f8261` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:55Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Sanitizes `name` into a safe filename: replaces spaces and slashes with dashes/underscores, strips other unsafe characters, and falls back to a generic default (like "export" or "sanity") if the result is empty, possibly appending a date stamp or extension.
- found: Lowercases and collapses non-alphanumeric runs into single dashes, trims leading/trailing dashes, falls back to "history" if empty, and appends "-history.mp4" as a fixed suffix.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected a generic sanitize-with-fallback but didn't anticipate the fixed "-history.mp4" suffix, which reveals this is specifically for exporting the history movie feature, not a general filename helper.

### `ExportDialog` — TANGLED
- spec 3 · read at `60bc89c24ea0` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A modal dialog component that lets the user configure and kick off a movie export (duration/scope/format), then drives the recording loop: for each frame it calls ensure(index) to await the timeline landing before capturing, stages the map via onStage for the export's size/ground, and reports progress while recording. It suggests a filename from name/slug/scope, restores the playhead via onIndex when done, and closes via onClose, using helpers like frameOf/pace/ms/lasting/suggest for timing/labeling math.
- found: A dialog with pickers for lens/length/resolution/ground, driving a `go()` async flow that stages the map (onStage), awaits two animation frames to let it settle, calls record() with ensure/dateOf/progress callbacks, saves the resulting bytes via saveMovie, and manages an idle/recording/saving/done phase state machine with cancel-via-ref, error display, and codec-aware messaging; restores stage/playhead in a finally block.
- predicted: most · documented: some · derivable: no · legible: some · trap: no

## web/src/components/Fields.tsx

### the file itself
- spec 3 · read at `c7f47be9f60c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:03Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Defines two small shared UI building blocks used across dialogs: a Field component (a labelled block wrapper) and a Choice component (a selectable chip/pill), extracted to prevent visual drift between dialogs that would otherwise each restate their own similar-but-slightly-different versions.
- found: Field is a labelled wrapper div; Choice is a toggle-able pill button with accent styling when on, an optional parenthetical note, and disabled state — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `Field`
- spec 3 · read at `3e61844d0f48` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:00Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A small presentational wrapper component: renders a container div with a label (e.g. a small caption/heading styled span) above or beside its children, used to give consistent spacing/typography to labelled controls across dialogs.
- found: Renders a div with a small uppercase muted label above the children — exactly the labelled-block wrapper the file doc described.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `Choice`
- spec 3 · read at `c9f03f7639d7` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:46Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a selectable "chip" button used inside dialogs' choice groups — a small pill/button showing `label` (and a parenthetical `note` if given), styled differently when `on` is true (selected) vs false, disabled when `disabled` is true, and calling `onClick` on click.
- found: A styled chip/button: shows label plus optional parenthetical note, border/background/color swap when `on`, disabled styling, calls onClick.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/FileZoom.tsx

### the file itself
- spec 3 · read at `c8b6d358e48d` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:45:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Defines the FileZoom React component (plus a `fanOf` helper) responsible for rendering the "zoomed into a file" view of the sunburst — laying out that file's function wedges into a fan/ring once the file's functions have been fetched/populated (per the model.rs docs about files losing their function ring until `file_functions` is asked for), likely with `fanOf` computing each function's angular slice from its lines/score. It probably also handles interaction like clicking a function wedge or zooming back out to the parent directory.
- found: Renders the transition of a file's sunburst wedge opening into a polar "fan": a squarified treemap of its functions (via `tileFunctions`) laid out against the destination fan sector and animated (lerped) from the source wedge sector, with click/double-click/hover handlers, stale-reading hatch texture, rollup-dots for aggregated overflow patches, and labels that fade in once settled. `fanOf` is a thin wrapper around `fanFor` computing just the destination sector (not per-function placement, as I'd guessed) — the per-function layout is a separate treemap-tiling step.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No docs were handed in the task, but the file itself has a substantial header comment explaining the polar-vs-rectangular design rationale (replacing an earlier `FileStack` rectangular treemap) — that context wasn't available to predict from, only visible on opening.

### `fanOf` — QUIRKY
- spec 2 · read at `4c58496076c4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Wraps a lower-level fanFor() so a null source sector doesn't return null: computes a bearing (either from the source sector's angle/midpoint or a default constant when from is null) and passes it plus paneAspect to fanFor to get the angular span/Sector that a wedge opens into, scaled so wider panes get a wider fan.
- found: It's a one-line passthrough wrapper: fanOf just calls fanFor(from, paneAspect) and returns its result. All the actual null-handling and fan/wedge logic described in the docs lives inside fanFor, not in this function — fanOf exists only as the exported name/entry point.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe behavior (null source still gets a fan) that actually lives in fanFor, not in this wrapper's own body — so the doc explains the callee, not this function.

### `FileZoom`
- spec 3 · read at `9c0622d9e140` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a zoomed-in treemap/fan-style layout of the functions inside `root`, computing patch geometry via `fanOf` using ranks/views/paneAspect/unitsPerPx/minPatchArea to skip patches too small to render. Animates between `from` and `root` using transition progress `t`, with `settled` short-circuiting once the transition finishes, and wires up onSelect/onDrill/onHover for interaction with the rendered patches.
- found: Squarify-tiles root's children into arc-shaped "patches" within a fan sector computed via fanOf/arcOf, colors them via colorFor, and lerps between `from` and destination sector across transition `t`. Draws patch paths with click/dblclick/hover handlers for select/drill/hover, adds stale-hatch overlay for stale agent readings, rollup-dot texture for aggregated 'rest' patches, trap-pulse styling, and only renders text labels once `arrived` (settled or no `from`) to avoid distorting names mid-animation.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

## web/src/components/Find.tsx

### the file itself
- spec 3 · read at `7465135e3434` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:50Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A single React component (Find) implementing a search/filter UI: a text input bound to state, filtering some list of items (likely files or paths in the visualized repo) by substring/fuzzy match, rendering a dropdown/list of matching results, and supporting keyboard navigation (arrow keys, enter to select, escape to close) plus highlighting matched text.
- found: A modal "Find" panel: debounced (120ms) search-as-you-type against a backend API (searchProject), min 2 chars, up/down arrow to move a clamped selection, Enter to pick (calls onPick then onClose which flies the camera via the existing zoom transition), Escape to close, click-outside to close. Renders distinct empty/guard states for replaying, no open project, short query, and no-hits, and result rows show kind glyph, name, right-truncated path, and loc count.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `Find`
- spec 3 · read at `0dd7ad5e9b7b` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:46:31Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a single-field search overlay (visible when open) that debounces input and queries a Rust backend search endpoint (search::find) scoped to projectKey, showing a short list of matching hits. Selecting a hit calls onPick(hit) to fly the camera there via the existing zoom/ring-transition logic. When replaying is true, renders a different simpler panel (e.g. "not available during replay") instead of the live search UI, and onClose resets/dismisses state.
- found: A single-input search overlay that debounces (120ms) queries to a backend searchProject() call scoped to projectKey, guards against stale/out-of-order responses, and shows a scrollable hit list with keyboard navigation (arrows/Tab/Shift-Tab to move, Enter to pick, Escape to close). Selecting a hit calls onPick then onClose. Renders distinct informational states for replaying, no project open, short query, and no results, and truncates paths from the left (RTL) to preserve the distinguishing tail.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## web/src/components/Findings.tsx

### `lensColor`
- spec 3 · read at `bd1c591aaba1` · commit `74e9537` · read by claude-sonnet-5 · via claude · when 2026-09-03T06:57:38Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns a CSS color string for a given lens id, delegating to `modeToken(id)` for most lenses so colors match the map's wedges/legend, but special-cases `id === 'size'` to return a neutral color since size isn't a lens/mode but describes line width.
- found: Returns var(modeToken(id)) if id is a known mode and not 'size', otherwise falls back to muted-foreground; guards against unknown ids resolving to an undefined CSS var rather than assuming membership.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the explicit membership check against MODE_LABEL (I assumed only 'size' was special-cased, not unknown ids in general) — the doc comment explains why that guard exists.

## web/src/components/HistoryBar.tsx

### the file itself
- spec 3 · read at `c5756d748f2b` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:32:03Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component (HistoryBar) that renders a scrubbable timeline/progress bar for the commit-history replay feature seen elsewhere in this codebase (colorMode.ts referenced a "replay"). It likely has play/pause controls and a draggable scrubber, with helper functions `pace` (computing tick spacing/scaling along the timeline, e.g. logarithmic or time-based positioning of commits) and `speed` (mapping a playback speed setting to an actual interval or multiplier for advancing through history).
- found: HistoryBar is the replay transport: play/pause, a scrub range input, keyboard shortcuts (space, arrows), a movie-export button/dialog, and duration buttons. `pace` formats a duration in seconds as a human label (30s/3m); `speed` formats it as a multiple of a standard 30s playthrough (e.g. 1x, 3x) — both label formatters, not tick-spacing math as I guessed. The clock is driven by elapsed real time via requestAnimationFrame rather than a fixed per-tick step, specifically so duration promises hold regardless of machine speed or repo size.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `pace` — QUIRKY
- spec 2 · read at `f97e230c1fec` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:51:49Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a total count, returns a human-readable pace label by bucketing the number into ranges (e.g. "slow", "steady", "fast") for display in the HistoryBar UI. Likely a simple if/else or ternary chain comparing total against threshold constants.
- found: Formats a duration in seconds as a short string: minutes rounded with 'm' suffix if >= 60 seconds, otherwise raw seconds with 's' suffix. Not actually a "pace" label like slow/fast — it's a duration formatter, likely misnamed relative to what I expected.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `speed` — QUIRKY
- spec 3 · read at `2ffb530ecac5` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:48Z · by ross@rossturk.com · warm reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes `total / STANDARD` to get the multiple, then formats it — showing one decimal place only when the value isn't a whole number (e.g. `0.3x` vs `1x`), returning a string with an `x` suffix.
- found: Computes STANDARD/total (inverted from my guess — a shorter duration means a faster/larger multiple), then formats with one decimal via toFixed if x<1, else rounds to a whole number, appending 'x'.
- predicted: some · documented: full · derivable: no · legible: full · trap: no

### `HistoryBar` — TANGLED
- spec 3 · read at `9b766bdfe9cf` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:17Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders the bottom transport strip: a play/pause button that drives an animation loop (using the `pace`/`speed` helpers) advancing `index` through `frames` over `duration` seconds via onIndex/onPlaying, a scrub slider/range input bound directly to index for manual seeking, a flashes toggle wired to onFlashes, and a duration control. It likely also renders/triggers an export-movie dialog, passing through name/slug/scope/dateOf/ensure/mode/keyFor so the dialog can build a MovieKey and fetch timeline data as needed. No second info row (per the doc, that was removed as duplicate of the commit log).
- found: Renders play/pause, a scrub range input, a row of duration-preset pill buttons, a flashes toggle, and an export button that opens ExportDialog. Playback is driven by a requestAnimationFrame clock (not a fixed-step timer) that tracks a fractional playhead in a ref and only emits integer index changes via onIndex, rate-scaled to the scoped frame count so a drilled-in subtree still plays in the chosen duration; also wires space/arrow-key keyboard shortcuts (skipping when the export dialog is open or a range input has focus).
- predicted: most · documented: some · derivable: no · legible: some · trap: no

## web/src/components/LensHelp.tsx

### the file itself
- spec 3 · read at `c4b24faa4a1d` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:55:26Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Defines the single source-of-truth reference data for each lens (name, prose description, color swatches/steps) ordered to match the lens switcher menu, plus small rendering helpers (B, Ramp, Steps, Languages) and a LensHelp component that displays this content, triggered by a HelpButton — essentially an in-app help/legend panel rather than a data-fetching or logic-heavy file.
- found: A modal help panel with two tabs: 'Lenses' (the predicted reference content — one Lens row per color mode, in switcher order, with prose + swatches) and 'Languages' (a capability table showing which languages support call-following and branch-counting, which I did not predict), plus the HelpButton trigger.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc header only describes the lens-reference responsibility; it says nothing about the second Languages tab, which is a distinct concern bolted onto the same file/component.

### `B`
- spec 3 · read at `fa539b27ccf2` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:55:01Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A tiny inline helper component that wraps children in a bold/emphasized element (like <strong> or a styled span) for use in the lens help prose text.
- found: Renders children in a <b> tag with semibold weight and foreground-color styling, a bold-text helper for the help prose.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `Ramp`
- spec 3 · read at `d99d750a62a6` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:53:28Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A tiny presentational React component that renders a small swatch (likely a span/div) with a CSS linear-gradient background running from color `from` to color `to`, used inline in the lens help text to show the reader what a lens's color ramp looks like.
- found: Renders a div with a horizontal CSS linear-gradient background from `from` to `to`, a small color-ramp swatch.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `Steps`
- spec 3 · read at `5038577205f2` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:53:47Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders a horizontal row of small flat-colored swatches, one per entry in `fills`, each just a colored box with no text label — used for the discrete lenses (bands/mark states) as opposed to a continuous gradient ramp.
- found: A flex row of equal-width flat-colored swatches, one span per fill color, no labels.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `Lens`
- spec 3 · read at `047b87a3e881` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:50Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a two-column row for one lens: the swatch and name on the left as a key/label, and on the right a description assembled from `measures`, `values`, `ramp`, and `needs` props plus any `children`, describing what the lens shows and what data it requires.
- found: Renders a two-column grid row: left column has swatch, name, and "needs X" text; right column has a "Measures" paragraph plus optional "Values:" and "Ramp:" lines, and optional children content, all styled per detailed comments about label/colon conventions.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Languages`
- spec 3 · read at `c850612296d3` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:52:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a static table/sheet: one row per supported language, with three columns of boolean claims (functions parsed, branch kinds known/complexity supported, calls resolved), sourced from a hardcoded array of language capability data (mirroring the three-lens distinction described in the doc), rendered with some kind of check/cross or dot marker per cell plus a caption explaining what each column means.
- found: Fetches the language-support list asynchronously (with loading and error-as-empty states, explicitly not conflating "failed to load" with "parser supports nothing"), then renders a table with Language/Extensions/Callers·Reach/Complexity columns, tick-marking calls and branches support per language, plus a summary sentence counting how many languages have each capability.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I missed the async fetch + loading/error UI entirely and assumed a static hardcoded array; also missed that "functions parsed" isn't its own column since it's a baseline, not a per-language variable.

### `LensHelp` — QUIRKY
- spec 3 · read at `f7d74c1b789b` · commit `74e9537` · read by claude-sonnet-5 · via claude · when 2026-09-03T06:57:26Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a modal/panel listing every lens (from the file's lens reference data) in menu order, showing each lens's key, name, and description/swatch, using the small helper components (B, Ramp, Steps, Lens, Languages) as peers. It likely has a close button or backdrop click that calls onClose to dismiss the panel, and possibly keyboard handling (Escape) to close.
- found: Renders a modal (via Overlay) with a segmented tab control switching between 'Lenses' and 'Languages' views, Escape-to-close handling, a lens-order-mapped list of ENTRIES for the lenses tab, a Languages component for the other tab, and a footer 'Done' button that also calls onClose.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `HelpButton`
- spec 3 · read at `ab86dc1f8552` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:33Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A small pill/icon button rendering a "?" glyph, styled with an active/highlighted state when `on` is true, that calls onOpen() on click to toggle the lens-help panel open — structurally similar to FindButton, sitting beside the lens switcher.
- found: Matched the pill structure, active styling, and onClick=onOpen exactly as predicted; the "?" is a hand-drawn SVG (circle, hook stroke, dot) rather than a text glyph, mirroring FindButton's icon approach, which I got the gist of but not the exact rendering.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/LensPane.tsx

### the file itself
- spec 3 · served in 4 parts · read at `d2f96fdf4dd9` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:35:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This file implements the whole "lens" system for the Detail pane: the `LensPane` dispatcher plus every per-mode section component it switches to (SurpriseSection, DocsSection, TrapsSection, WiringSection, LanguageSection, HistorySection, AgeSection, ChurnSection, TangleSection, LegibleSection/LegibleKey), along with the small shared UI primitives and helpers they all lean on (Block, Absent, StaleNote, Ladder, RefRow/RefList, NoteBox, Passage, ExpandIcon, Touch, Edge, useFitToPane, and utility functions like spanOf/dirOf/bandSpan/px/when). It's a large, single-responsibility-per-lens module — one file because the lenses share so much visual vocabulary and the "absent measurement" convention, rather than because it's one concern.
- found: Confirmed: the file holds the LensPane dispatcher plus one section component per lens (Surprise, Legible/LegibleKey, Docs, Traps, Wiring for callers/reach/clones, Language, Tangle, History/Churn/Age) and the shared building blocks (Block, Absent, Ladder, StaleNote, RefRow/RefList, NoteBox, Passage, ExpandIcon, Touch/Edge, useFitToPane/px, when, dirOf/spanOf/bandSpan). Extremely dense with rationale comments explaining design history for nearly every visual decision (why churn is a calendar not a count, why blame/churn/age share one fetch, why the calendar's month/week labels are placed as they are, etc.) — the file has no top-of-file header doc at all despite being the single largest, most design-justified component in the app.
- predicted: full · documented: none · derivable: no · legible: not judged · trap: no
- note: There is no file-level doc comment at the top of LensPane.tsx, unlike most of the design-heavy prose that lives inline per-function — a reader skimming just the file header gets nothing, and has to read the whole 1868 lines to find the file's own rationale (in LensPane's own docstring, which describes the pane split rather than the file).

### `LensPane`
- spec 3 · read at `3439c18fb592` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A switch/dispatch on `mode` that renders the matching lens-specific section component (SurpriseSection, LegibleSection, DocsSection, TrapsSection, WiringSection, LanguageSection, TangleSection, HistorySection, etc.), forwarding the relevant subset of props (node, repoKey, replaying, siblings, ranks, views, tangleBands, tangleOver, onJump) to whichever section is active. Each branch is responsible for its own "absent measurement" messaging per the docs, so this function is mostly plumbing/routing rather than logic itself.
- found: Two guards before the switch I didn't predict: if `replaying`, short-circuits to an explanatory Absent block instead of any section (since all lenses read the working tree); and for non-function nodes, restricts which modes get a section at all (only surprise/docs/traps/blame, plus a special LegibleKey for 'legible'). Only then does it switch on `mode` to render the matching lens section component, passing through the relevant props.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Block`
- spec 3 · read at `0fa4c4027ff0` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders the shared section wrapper used by every lens section: a full-bleed top border (-mx-4, repadded with px-4) so the rule spans the whole pane width, a heading row with `label` on the left and `aside` (e.g. the grade word) right-aligned, an optional small `hint` shown near the label as a caveat/tooltip rather than repeated in the body text, and then `children` below as the section's content.
- found: Wrapper div with full-bleed top border (-mx-4/px-4) that is suppressed on the first section (`first:mt-0 first:border-t-0`) since the pane header now draws that line itself, a heading row with label (cursor-help + title=hint when a hint is given) and right-aligned aside, then children.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `Absent`
- spec 3 · read at `53b9364cb6f9` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:25:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A tiny presentational component that wraps its children (an explanatory sentence) in a styled "empty state" container — likely muted/italic text with some padding — used whenever a LensPane has nothing to show, so the UI always displays a reason rather than a blank area.
- found: Renders children as a small muted paragraph — a minimal empty-state text style, simpler than I imagined (no padding/container, just a styled <p>).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Ladder`
- spec 3 · read at `00d46e962452` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:24Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders the four grade rungs (e.g. full/most/some/none) as rows, each showing its word label and its full description text (`rungs[grade]`), colored by sampling the `ramp` function at `at[grade]`. The row matching `grade` is highlighted/lit (bold, background, etc.) while the rest are dimmed; if `grade` is undefined (legend mode) all four rows are colored normally with none lit, since there's no reading to point at. `dated` presumably desaturates/greys the whole thing when the reading is stale.
- found: Matches my prediction closely: four fixed-order rows (none/some/most/full), swatch colored via heatColor(at[g], ramp), word label and rung description, matching row lit/highlighted via text color and an outline ring on the swatch. I got legend mode right (colors every swatch, highlights text on all rows) but missed the exact mechanism: swatch color for a non-legend, non-matching row is just a flat `var(--secondary)` grey rather than a dimmed/desaturated version of its ramp color, and `dated` only suppresses the ON row's color (falls back to grey) rather than greying the whole ladder as I guessed.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `StaleNote`
- spec 3 · read at `220727e6bc5b` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:43Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a short fixed warning message/paragraph (no props) saying the reading below is stale because the code has moved since it was read, styled as a small caveat line similar to Absent, always placed before the content it applies to.
- found: A fixed warning paragraph (no props) stating the code has changed since it was read, so what follows describes a body no longer present; kept as history and doesn't drive any coloring.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `RefRow` — TANGLED
- spec 3 · read at `22a7d13b5170` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:04Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders one clickable row (whole row is the hit target, calling onJump(r.path, r.line)) showing the function's name beside its owner (not folded together), its file path, and either a code snippet (when code is true and snippet is fetched) or the given note text instead — with distinct handling for snippet === undefined (loading) vs null (fetch failed/unavailable).
- found: Renders a clickable row (name+owner label, path:line, optional note), and when `code` is true shows a fetched snippet as a CodeBlock (with a "moved" or "truncated" caveat) or, for rows past the initial fetch batch, a "Show code" button that lazily fetches the snippet on demand; shows a "could not be read" message when the fetch returned null.
- predicted: most · documented: full · derivable: no · legible: some · trap: no

### `spanOf`
- spec 3 · read at `0759b4ec2e05` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:27Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Converts a FuncRef (with path, line, and loc) into a span object of the shape function_sources expects, computing the end line as line + loc - 1 (or similar) so callers can request the source range without carrying a redundant end-line field.
- found: Builds {path, start, end, name} from a FuncRef, with end computed as line + loc - 1.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `RefList`
- spec 3 · read at `fcfec382eaf6` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:13Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a list of function references (neighbours). When `code` is true, it makes one batched call (via something like `functionSources`) to fetch source for all refs at once, keyed by repoKey, rather than each row fetching its own — matching the docs. It then maps over `refs`, rendering a `RefRow` for each with its fetched source (if any), the corresponding entry from `notes` by index, and wires `onJump` through for navigation.
- found: Fetches sources in a useEffect keyed on repoKey/refs/code (with a `live` flag guard against stale async updates), but only for the first SNIPPETS refs — it caps the batched fetch and shows a 'Source shown for the first N of M' note when refs exceed that cap. Renders a RefRow per ref with its snippet, note, and onJump.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The SNIPPETS cap and its truncation message aren't mentioned in the docs, which only explain why the fetch is batched at the list level.

### `dirOf`
- spec 3 · read at `434164960692` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Finds the last "/" in the path and returns the substring before it, or the empty string if there is no slash (root-level file).
- found: Exactly as predicted: lastIndexOf('/') and slice before it, empty string if no slash.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `SurpriseSection`
- spec 3 · read at `ec325e8ca272` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:10Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a section inside the node detail pane showing the "prediction test" data for this node: the reader's expected prediction, what was actually found, and whether it was flagged (e.g. surprised/predicted rating, trap). Likely uses Block/NoteBox to lay out expected vs found text, shows something when there's no prediction data (via Absent), and always renders even matching "expected X, found X" cases rather than only showing misses, per the docs.
- found: Matches my prediction well: Absent state for unread nodes, Block/Passage for expected/found, "read as expected" fallback when no note. I missed several specifics: the "warm read" badge for non-cold reads, backward-compat handling for old readings that only recorded surprised-or-not (mapped to the ends of a grade scale via `r.predicted ?? (r.surprised ? 'none' : 'full')`), staleness handling (agentStale disabling the aside/warm badge/dating the Ladder), and an entirely separate "hotspots" evidence section showing token-level probability collapse points — a whole additional feature I didn't anticipate at all.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The hotspots/probability-collapse evidence block is a distinct feature this file's docs snippet didn't hint at — worth knowing this section does double duty (grade UI + token-level evidence).

### `Passage`
- spec 3 · read at `ee39f7cfc7d1` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:54Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a heading row containing `label` and a `CopyButton` (copying `text` to the clipboard as markdown), with `hint` shown as a title attribute or tooltip on the label, followed by a paragraph displaying `text` as the reader's prose for that section.
- found: Heading row with uppercase `label` and a CopyButton (copies `text`, tooltip is `hint`), followed by `text` rendered through a Markdown component.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `NoteBox` — QUIRKY
- spec 3 · read at `5f083ce5de33` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:23Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders the note text inside a small styled box/paragraph. The trapped flag adjusts styling — likely a border or left-accent bar — but per the docs the note text itself stays normal (non-pink) color since the loud pink coloring is reserved for the tab elsewhere, not duplicated here.
- found: Renders a bordered box with a small header row (warning icon, 'trap'/'note' label, CopyButton) whose background is pink (var(--trap)) when trapped and neutral otherwise, and a body below rendering the note text as Markdown.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I guessed the note body itself would stay uncolored when trapped, but it's actually the small header bar (not the tab) that gets the pink --trap background here — the doc's 'color goes on the tab and nowhere else' describes intent elsewhere, not a constraint this component itself honors.

### `LegibleKey`
- spec 3 · read at `17700dd9bd6f` · commit `c4c6042` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A no-argument component rendering a static key: a small heading plus a list of the four legibility words (clean, nuanced, tangled, unclear), each paired with a one-line definition of what that word means (since nowhere else on screen explains them). No props, no counts, no data — purely static markup.
- found: Renders a Block with a shared Ladder component (legend mode) displaying the four legibility words/ramp, plus a caption explaining that legibility is graded per-function, not per-file.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Reuses the same Ladder component other lens keys presumably use, rather than a bespoke list — worth checking peers like a DocsSection key for the same pattern.

### `LegibleSection`
- spec 3 · read at `25f1f8bc89af` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders the Legible lens for a function: if there's no `report` (nobody has read this function) it shows an empty/placeholder state; otherwise it shows a Ladder widget for the legibility grade (full/most/some/none), a StaleNote if `stale` is true (grade predates the current code), a NoteBox with the reader's `found` prose (per the docs, not `expected`), and a LegibleKey legend explaining the grade scale.
- found: No-report case shows an Absent placeholder explaining legibility only arrives with a reading. Otherwise renders a Block with the grade word as aside, a StaleNote when stale, a separate note when the grade is `dated` (answers an old/rewritten question, no longer counts), a Ladder widget for the grade itself, a fallback note when there's no grade at all (banked before the axis existed), and a Passage showing the reader's `found` prose (never `expected`, per the docs' surprise-vs-legibility distinction).
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `DocsSection`
- spec 3 · read at `7392cc566180` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:14Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a Docs panel showing the actual doc comment text for the node alongside its signature (via the shared CodeBlock component), rather than just a coverage score. If an AgentReport is passed, it likely displays the grade the agent gave the doc (documented/derivable) next to the doc text so the reader can compare the doc against the judgment. If `stale` is true it shows a StaleNote warning that the doc may be out of sync with the current code, and if there's no doc at all it falls back to an "Absent" style message.
- found: Renders signature and doc text verbatim (unhighlighted, sized to viewport) via CodeBlock, plus a Ladder showing the graded documented level (forced to "none" display style if marked derivable) with a warning callout when derivable, a StaleNote when stale, an "ungraded" message when no report exists, and an Absent fallback when there's no doc comment at all.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `TrapsSection` — QUIRKY
- spec 3 · read at `9024c995dfbe` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:53Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders nothing if the node has no trap. Otherwise shows the trap warning text prominently/large at the top, then filters `siblings` to other functions in the same file that also have a trap flag, and lists them below as clickable rows (via onJump with path/line from spanOf) so the reader can jump to related hazards in the same file.
- found: For non-func nodes with no trap, renders nothing; otherwise always renders a Block distinguishing several states: staleness note, a NoteBox if a trap is reported, or one of three distinct absence messages (never read, answered-but-since-dated, or explicitly reported clean). Below that, if same-file siblings (excluding self, stale/untrapped filtered out) have their own reported traps, lists them via RefList with jump links and notes, deliberately showing only the note/link rather than the function body.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The interesting logic isn't the trap display itself but the absence-state taxonomy: unread vs dated-answer vs explicitly-checked-clean are rendered as three distinct messages, since for a function 'nobody looked' and 'looked and it's fine' are different states, not both silence.

### `WiringSection`
- spec 3 · read at `99621e1060f3` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:39Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Fetches (on mount/selection change, via functionLinks) the neighbour lists for the selected function's line — callers, calls, or clones depending on `mode` — and renders them as a list of RefRow entries with jump-to-source callbacks (onJump). Shows an Absent/loading state while the fetch is pending or when the language's wiring hasn't been resolved (wired===false), and otherwise renders each neighbour grouped/sorted, probably with the directory shown via dirOf for entries outside the node's own directory.
- found: Fetches functionLinks on selection with a cancellation guard, handling loading/missing states; for 'clones' mode shows two Block sections (this function vs its clones, or an absence explaining the comparability floor); for callers/reach shows a wired/unwired distinction, an away-from-home-directory count sentence, and the RefList.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Predicted the fetch/cancel/loading/RefList shape correctly but missed the clone-specific two-section layout and the away-directory-count sentence, which are the most bespoke parts of the body.

### `LanguageSection` — QUIRKY
- spec 3 · read at `1135d82240b3` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:38Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a small section in the LensPane showing the node's language, but instead of just printing the language name as plain text, it derives a color/status indicator from two pieces of coverage info: whether calls in that language were actually parsed (vs. simply not analyzed), and whether the function body was long enough to be included in copy/duplicate detection. It likely returns some kind of colored badge or key-value row using shared style helpers like px, Edge, or LegibleKey from its peers.
- found: Renders a Language block showing the signature code, then a textual list of "gaps" (missing coverage) across three axes derived from node fields: wired (callers parsed), comparable (long enough for clone detection), and historied (git history reaches it) — printing a positive "fully supported" message only when none of the three gaps apply.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `bandSpan`
- spec 3 · read at `794ecfcc5335` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:35:40Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Computes the display string for a complexity size band, e.g. "(100–199 lines)" or "(200+ lines)" for the top open-ended band. Takes `loc` (and optional `over`, the population's actual min/max) and uses `tangleBandOf` plus `TANGLE_EDGES` to recover the band's low/high edges, rendering the last band specially since it has no upper edge.
- found: Exactly as predicted, matching my earlier full-file read: derives the band's low/high edges from TANGLE_EDGES/tangleBandOf and renders '(lo–hi lines)' or '(lo+ lines)' for the open top band.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: I had already read this exact function in full during the preceding file-level task, so this was a warm read, not a cold prediction.

### `TangleSection`
- spec 3 · read at `be4dc4c42314` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:36:19Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders the Complexity/Tangle lens detail: fetches this node's complexity "sites" (the individual fork/chain/logic charges from cognitive_walk, read live from the working tree via repoKey) and lists each with its cost and reason, and also shows a comparison of this body's score against the repo's own median for bodies of similar size (using bands/over), with whichever of the two readings (raw count vs weighted-against-median, per `read`) currently selected in the map shown more prominently/bolder.
- found: Fetches this function's fork/complexity breakdown live from the working tree (functionForks) and renders it two ways: a small numeric block (raw count, or — only when `read` is 'weighted', not both simultaneously as the doc comment claims — the comparison against this repo's median for bodies that size) and a separate 'Body' section showing the actual source with per-line cost marks and a note if the live file has since diverged from the scanned count.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment says "Both are shown under either reading, which one is on decides which is bolder" but the code only renders one of the two dl blocks depending on `read` — the other reading's numbers aren't shown at all.

### `HistorySection`
- spec 3 · read at `efdaa99844d2` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Fetches blame data for the given node/repoKey (shared across all three lenses), then branches on `mode` to render either a list of people (blame), a calendar-style churn view, or a timeline age view — likely delegating to ChurnSection/AgeSection peer components after computing derived data (dates, counts) needed for each, with a loading/empty state while the fetch is in flight.
- found: Fetches per-line history via functionHistory(repoKey, path, line, endLine) (0 = whole file) into state, shows loading/empty fallbacks, then for churn/age delegates to ChurnSection/AgeSection with a shared HINT string. For blame mode it renders inline: the newest touch via a shared Touch row, and (only for func nodes) an author breakdown bar list plus a 'where these lines came from' list of surviving touches — the file case only shows the last commit, since Summary already breaks files down by author elsewhere.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The docs explain the three-lens design philosophy well but don't mention the func-only author-breakdown/touches-list split or the whole-file-vs-function history scope (0 sentinel) — those are only in code comments inline.

### `px`
- spec 3 · read at `005dc57c72a8` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:36:37Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Parses a CSS pixel-length string (as returned by getComputedStyle, e.g. "12px" or "") into a number, returning 0 when the string is empty/unset rather than letting parseFloat produce NaN that would silently propagate through later arithmetic.
- found: Parses a CSS pixel string via parseFloat, returning 0 instead of NaN when it isn't a finite number (e.g. an empty/unset computed style).
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The doc block attached to `px` is almost entirely about `useFitToPane`'s measuring strategy (top/bottom/layout-effect timing) — only its last two sentences actually describe `px` itself, so this reads as a doc comment that landed on the wrong adjacent declaration.

### `useFitToPane`
- spec 3 · read at `6ed74237374d` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:14Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A layout-effect hook that measures the vertical space between `box` and whatever sits `below` it (or the viewport bottom), and sets `box`'s max-height/overflow style so its content doesn't overlap what follows, clamped to a minimum of `floor` pixels. It re-measures whenever `deps` changes (e.g. content changing) and probably also listens for window resize to keep it fitted.
- found: Finds the nearest scrolling ancestor of `box`, computes its content-bottom (border box minus bottom padding), subtracts the `below` element's full margin box height and a 10px slack, and returns the resulting max height as state (`cap`) — clamped to `floor` — rather than setting the style directly; recomputes on `deps` change and window resize.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The careful padding/margin arithmetic (content-bottom vs border-box, below's margins counted explicitly) is called out in code comments as hard-won fixes for real overflow bugs, not obvious from the signature.

### `AgeSection`
- spec 3 · read at `ef6b11796c44` · commit `9f5abcc` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T22:48:14Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a timeline of every commit that touched these lines (newest at top), each as a Touch row, rather than just printing oldest/newest dates as a sentence — using spanOf to summarize the span/gaps and hint for context text, passing repoKey through so each row can expand into its commit.
- found: Pins the newest and oldest commits (as Edge rows) at top/bottom of the block and puts every commit in between in its own scrollable region sized via useFitToPane, rather than one date-positioned scrolling column — so the two endpoints (the actual answer to "how old is this") always stay visible regardless of how much history is in between.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Uses history.changes (not history.touches) deliberately — changes includes rewritten-away commits, touches would understate the lifespan by only counting surviving lines.

### `Edge`
- spec 3 · read at `483dcf98d1c9` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:56:48Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering one endpoint of a two-point lifespan/history pair (the other end presumably rendered by a sibling like Ladder). It displays the given label alongside the date/commit info from t: TouchRow, styling it more prominently when bright is true, and likely uses repoKey to link out to the commit.
- found: Renders a small uppercase label above a Touch component, passing t/bright/repoKey straight through — it's purely a labeled wrapper, all the actual date/commit rendering logic lives in Touch.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `ExpandIcon`
- spec 3 · read at `9f566aa62008` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:29Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A small button/span rendering an SVG "expand" glyph (likely a diagonal arrows or chevron icon) matching the icon used on code tiles, with a title attribute for tooltip/accessibility and an onClick handler wired to the passed onClick prop. It's a purely presentational corner control, no internal state.
- found: A button rendering a small 10x10 SVG diagonal-arrows expand glyph, styled as a bordered/backgrounded chip (not a bare glyph) so it reads as a control among small grey text, with title/aria-label for accessibility and an onClick that stops propagation before calling the passed handler.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The doc comment's design rationale is essentially restated verbatim as an inline code comment, so it adds little beyond what the code already says.

### `Touch`
- spec 3 · read at `0f5d608ba734` · commit `9f5abcc` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T22:47:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders one git commit ("touch") as a row: commit hash/short id, author/date, and message, highlighted with different styling when `bright` is true. Includes a clickable/expand element using `repoKey` to construct a link or trigger navigation into that commit's full detail (diff/context), possibly using an ExpandIcon-like affordance.
- found: Renders a single commit-touch row with a colored dot (bright/newest gets a heat-ramp color, others muted), relative time, short commit hash, a labeled line count (or "gone" if the commit's changed lines were fully superseded), an expand icon (only if repoKey is set and the commit hash looks like a real sha, not "uncommitted"), a truncated summary, and an optional "in {path}" line for renamed files. Clicking expand opens a CommitCard modal showing the full commit.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The comments explain non-obvious design decisions (why zero shows 'gone' instead of '0 lines', why paths can be stale due to rename-following) that wouldn't be derivable from the code alone.

### `ChurnSection` — TANGLED
- spec 3 · read at `c5f77030db57` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:26Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a scrollable, vertically-oriented GitHub-style commit calendar (weeks as rows going back to the oldest commit, weekday columns) built from `history.changes` — i.e. per-function commit dates, not the file's aggregate churn. A pinned header shows weekday letters and a legend/key plus a total count, while the grid itself scrolls through the full history so long-dormant vs. actively-churned functions are visually distinguishable rather than being compressed into a fixed 26-week window.
- found: Renders a GitHub-style vertical commit calendar from history.changes (per-function, not per-file), bucketed by local midnight into week-rows with weekday columns, colored via the shared churn heat ramp, scaled to peak day. It shows a pinned weekday key, scrolls through full history to the oldest commit with month labels and per-week commit counts, and a footer noting total commits/busiest day plus caveats for renames (origin path), a file older than the lines, and uncommitted dirty-worktree state.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: Missed several concrete mechanics: local-midnight day bucketing, empty-history early return, per-week counts drawn beside each row, and the three footer caveats (rename/older-file/dirty).

### `when`
- spec 3 · read at `09bfaf43a6ee` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Converts a unix timestamp in seconds to a relative string like "3 months ago" if within the last year, computing the difference from now in days/months and picking the coarsest sensible unit; falls back to a locale-formatted date string (e.g. toLocaleDateString) once the gap exceeds a year.
- found: Guards zero/falsy timestamp as 'unknown', then buckets by days elapsed: today, yesterday, "N days ago" up to 60 days, "N months ago" up to 365 days, then falls back to a locale date string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/MascotFigure.tsx

### the file itself — QUIRKY
- spec 3 · read at `2d17f93e2a77` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:16Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a mascot character (likely an SVG figure) whose appearance/expression changes based on app state — probably the overall health/surprise score of the current scan, via `moodFor` mapping a score to a mood (happy, worried, etc). `loadOrMint` likely generates or loads a persisted/cached identity for the mascot (e.g., a random seed or variant stored per repo, minted once and reused), and `pick` selects a random variant from a set of options (colors, poses, accessories).
- found: Wraps a canvas-based creature-animation bundle (Mascot) and drives it from live agent activity: loadOrMint loads (or randomly mints and persists) a per-project mascot blueprint; moodFor maps an MCP tool-call name to an animation set (bigger/rarer reactions for surprising reports, quiet ones for polling); events are replayed in sequence-number order, one per beat, when new agent calls arrive. It also aims the creature's gaze at whatever sunburst wedges are "flashing" (dwelling on one direction at a time), wakes on mouse movement while idle, plays a repeating "confused" animation while a run is being torn down, and measures/lifts the creature to sit centered in its box once the bundle reports its resting silhouette.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file header; the file's real scope (gaze-tracking toward sunburst activity, wake/idle/stopping lifecycle, sequence-based event replay) is far beyond what the peer list (loadOrMint/pick/moodFor/MascotFigure) suggests on its own.

### `loadOrMint`
- spec 3 · read at `816728647b9c` · commit `cecdbb2` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:35:13Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up a cached MascotConfig for `project` in localStorage (keyed by project name or a generic key), and if none exists, generates a new random one (likely via the `pick` helper for random selection) and persists it back to localStorage before returning it.
- found: Checks storedMonster(project) for a cached config and returns it if present; otherwise mints a fresh one via randomizeMascot(), saves it with saveMonster(project, fresh), and returns it.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Comment clarifies this is the single mint point, shared deliberately with the sidebar's "forget monster" reset path.

### `pick`
- spec 2 · read at `cfbf6454f730` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:54Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Picks a random element from the `from` array (Math.random() * length, floored) and returns it as the chosen MascotAnimation.
- found: Returns a random element from the array via Math.floor(Math.random() * from.length).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `moodFor`
- spec 2 · read at `cda216f69fc2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:05Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Maps a tool name string to a list of candidate mascot animations that fit that tool's "mood" — e.g. a search/read tool maps to curious/looking animations, a write/edit tool to focused/working animations — likely via a switch or lookup table with a default fallback list for unrecognized tool names, to be randomly picked from by a caller like `pick`.
- found: Looks up the first entry in a MOODS table whose `match` regex tests the tool name, returning its `play` animation list, falling back to DEFAULT_PLAY if none match.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Guessed a switch/lookup with default correctly; actual mechanism is a regex-match table (MOODS) rather than a switch.

### `MascotFigure` — QUIRKY — TANGLED — TRAP
- spec 3 · read at `1155b518fee3` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:33Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This component loads (or mints, via `loadOrMint`) a persistent per-project "blueprint" describing the creature's look, computes a mood from `state`/`events` via `moodFor`, and renders an SVG creature whose eyes track the `gaze` targets (or wander when null) while animating differently for sleeping/working/torn-down states; `pick` is probably used to select randomized visual traits from the blueprint. Re-minting happens when `remint` changes.
- found: Loads/mints a per-project blueprint and remounts on remint as predicted, but the bulk of the function is several useEffects: computing vertical 'lift' offset from the bundle's reported rest extent, aiming gaze at one of several targets on a dwell cycle, waking the creature on any window mouse activity, playing a 'confused' animation loop while state is 'stopping', and replaying queued AgentCall events (via moodFor) in sequence while 'working', plus registering a mascotClock hook for movie export.
- predicted: some · documented: none · derivable: no · legible: some · trap: yes
- note: Addressing the renderer via `renderer.shared.engine` (three levels down) instead of `renderer` directly is silently wrong — the typeof guards make a wrong address just as harmless-looking as a missing method, so gaze tracking or clock-lending can quietly no-op with nothing on screen indicating why.

## web/src/components/Overlay.tsx

### the file itself
- spec 2 · read at `dc471b0c1afa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:20Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A generic UI overlay wrapper component — a fixed/absolute-position <div> that sits on top of other content, likely used for a dialog/tooltip or the detail panel shown over the Sunburst chart. Probably takes children and maybe a visibility or position prop, minimal logic.
- found: Dimmed fixed-position backdrop that centers modal children; clicking the backdrop calls onClose (children are expected to stop propagation to avoid closing on inner clicks).
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `Overlay`
- spec 2 · read at `90bafbe9ef93` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:09Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A fixed, full-viewport div with a semi-transparent/dark background and flex centering, whose onClick calls onClose. Inside it wraps `children` in another div with onClick calling e.stopPropagation() so clicks on the modal content itself don't bubble up and trigger the close.
- found: Fixed, full-viewport, centered dark-backdrop div with onClick=onClose, rendering children directly with no stopPropagation wrapper of its own — that responsibility is left to whatever panel component is passed as children, per the docs.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs describe the stopPropagation half of the contract as if it belonged to this function; it's actually the caller's responsibility, not code in this function.

## web/src/components/Phases.tsx

### the file itself
- spec 3 · served in 2 parts · read at `17271bab776f` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:00:12Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders the row of three fixed-width "phase" pills (scan, trace, read) shown per project, each acting as both a button and a progress gauge: its fill width tracks percent-complete, its label states the action and its cost (e.g. "106k commits"), and it degrades to a flat non-interactive marker once there's nothing left to do. Helpers: `compact` formats large numbers (e.g. 106k), `seconds` formats durations, `fnv` hashes something (maybe for a stable key or color), `phasesOf`/`traceOf` derive each pill's display state from the project/run data, `Pill` is the single reusable pill component, and `Phases` is the exported component that lays out all three.
- found: Matches my prediction closely for the helpers (compact/seconds/fnv/Pill/Phases) and the button-is-gauge concept. What I missed: the trace pill's fill is multi-chamber (one per depth: log walk, blame, replay) rather than a single fraction, since the three depths are a 1:10:100 cost ladder that a single bar can't represent honestly; a rich state machine of na/done/stale/label markers per phase; a "pressed" state held until the next poll acknowledges it (to bridge the up-to-1.5s polling gap); and an idle decorative `Sprig` plant (seeded per-project, mixed with a session random) that fills the note line when nothing is hovered or running, replacing what would otherwise be a blank strip.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header doc explained the pill-as-gauge design well, but the multi-chamber trace gauge and the idle Sprig decoration are significant pieces of the file's actual shape that a reader would only get from the body.

### `compact`
- spec 3 · read at `73bcbba467b7` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:08Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Formats a number compactly for a narrow UI label. For n below 1000, returns it as-is. For thousands, uses "k" suffix — one decimal place while in the first decade (1000-9999, e.g. "5.2k"), then rounds to whole numbers above that (e.g. "12k"). Same pattern for millions with "m" suffix (e.g. "1.2m", then "12m").
- found: Formats a number with k/m suffix, one decimal in the first decade of each unit (1000-9999 and 1000000-9999999), whole number otherwise, using toFixed to round.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `fnv`
- spec 3 · read at `fdf959d81bcc` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Standard FNV-1a hash implementation — iterates chars/bytes of text, XORs each into a running hash starting at the FNV offset basis, multiplies by the FNV prime (with 32-bit overflow handled via >>> 0 or Math.imul), and returns the final numeric hash.
- found: Standard FNV-1a: offset basis 0x811c9dc5, XOR each char code then Math.imul by prime 0x01000193, returns h >>> 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `seconds`
- spec 3 · read at `958cc9bcf2f6` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Converts a seconds estimate into a short coarse human-readable duration string, rounding hard (no decimals) — likely something like "<1m", "2m", or "1h" depending on magnitude, used as a wait-time label in the phase pill.
- found: Returns "~Ns" for under 60s (rounded, min 1) or "~Nm" for 60s+ rounded to nearest minute — only two units, no hours tier.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `phasesOf`
- spec 3 · read at `95df3cb2a9b5` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:04Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds the array of exactly three Phase objects (scan, trace, read) from a ProjectSummary, each with a label, a progress fraction (for the fill), and whether it should render as an actionable button vs. a flat 'done' marker — deriving state like 'no history', 'in progress', 'behind/stale', or 'complete' per phase from distinct fields on p so the three states can't collapse into each other. The replayBlocked flag likely disables/greys out the trace or read pill's button when replay can't currently run.
- found: Builds [scan, trace, read] Phase objects. Scan branches on scan_cost/loading/behind/else into estimate/in-progress-with-stop/stale-needs-rescan/done states. Trace is delegated to a separate traceOf(p, scanned, replayBlocked) helper. Read branches on reading(running or stopping)/not-yet-scanned(na)/fully-assessed-done/in-progress, carefully keeping 'unread' and 'stale' as disjoint counts rather than one derived by subtraction, per an explicit design note.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `traceOf` — QUIRKY — TANGLED
- spec 3 · read at `f707f58acdc3` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds the Phase object for the Trace pill, combining three progress fractions (commit-log walk, blame pass, full replay) into chamber values for the gauge. Computes a label describing the cost of tracing (commit/line counts) and determines whether the pill is clickable/active based on scanned (must complete scan first) and replayBlocked (replay chamber gated independently).
- found: A long cascade of state checks (not scanned, running trace by step, priced but not started, no git history, unblamed files remaining, edits-depth not reached, replaying now, commits left to replay, fully done) each returning a Phase with a 4-value fill gauge (log/blame/edits/story), a verb/act pair, and a short note string describing cost or progress at that state.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: I predicted three chambers/fractions combined into one Phase; the actual gauge has four (log, blame, edits, story) and most of the function's weight is in ordering ~9 mutually exclusive states, not in combining fractions.

### `Pill` — QUIRKY
- spec 3 · read at `d386696a8cdb` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a single phase pill: a fixed-width button-like element whose background has a positioned fill block (not a gradient) sized to the phase's progress fraction, snapped to an exact pixel column. It shows a label describing what pressing it would do/cost, a border when it's actually pressable (a button), a checkmark/tick when the phase is finished, and a dash when the phase doesn't apply (marker state) rather than dimming opacity for these states (per the docs' accessibility rationale). Wires onPress/onHover to the underlying element, and reflects `busy` by disabling interaction or showing some in-progress visual instead of dimming.
- found: Renders three mutually-exclusive shapes based on phase state: a dashed marker with just "—" when phase.na; a plain non-interactive span (with body: chambers + label) when there's no verb (done/inapplicable-to-press); and an actual <button> (bordered, disabled when busy) otherwise. The "body" is shared: a row of per-step fill chambers (one per phase step, e.g. three for a trace's three depths) each filled to its own fraction with a minimum 6% floor so started-but-tiny progress is still visible, using a diagonal hatch background instead of solid when phase.stale, plus a label that shows "N ✓" when done or the verb/label otherwise. Opacity (`ink`) varies by state (busy/done/in-progress) to indicate emphasis without dimming the label text itself, addressing a specific contrast-accessibility issue mentioned in the docs.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The chamber boundaries are computed (used for width math) but never visually drawn — a divider would be nearly invisible against the fill (measured 1.07:1) and the note line already spells out which sub-phase is running.

### `Phases` — QUIRKY
- spec 3 · read at `ebeb74e6824a` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:02Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: `Phases` computes state for each of the three phases (scan/trace/read) via `phasesOf`/`traceOf` helpers, then renders three `Pill` components side by side — each showing progress-filled background, a label describing what pressing it would do and its cost, and becoming a flat non-interactive marker when that phase is complete. It uses `replayBlocked` to disable/gray the trace pill when another repo is replaying, and `stopping` to show an acknowledging "stopping…" state rather than looking unresponsive, calling `onAct(action)` when a pill is clicked.
- found: Renders three Pill components from phasesOf(project, replayBlocked); tracks an optimistic "pressed" action cleared when a signature of real backend state changes; shows a note line for the hovered pill or the running phase, else fills the space with a per-project seeded decorative Sprig plant when idle.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

## web/src/components/Prose.tsx

### the file itself
- spec 3 · read at `a7057d1927a1` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:47Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A component file with no header doc. It exports a Markdown component that renders markdown-formatted text (e.g. docs/notes/report content) into styled HTML using prose typography classes, and a CopyButton component, likely placed near rendered code blocks or the whole passage, that copies the raw text to the clipboard.
- found: Markdown is a hand-rolled minimal renderer (no library) supporting only code spans, bold, italic, and paragraph breaks — split code-first so asterisks inside identifiers aren't misread as emphasis. CopyButton copies raw source text (markdown, not rendered) to the clipboard and only shows a "Copied" state when the clipboard write actually resolves successfully.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The per-function doc comments (missing from the docs field since this was scored as a file task) carry real design rationale — e.g. why no markdown library, why copy raw text not rendered — that a header summary wouldn't reproduce.

### `Markdown`
- spec 3 · read at `799387943ea1` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Splits the text into paragraphs on blank lines, and within each paragraph first splits out backtick code spans (rendering them as <code>), then processes the remaining segments for **bold** and *italic* markers, returning an array of React elements/paragraphs. Doing code spans first avoids misinterpreting a `*` inside a code identifier as emphasis markup.
- found: Splits on blank lines into paragraphs, then per paragraph splits code spans first (rendered as <code> with a currentColor-derived background), then within non-code chunks splits bold/italic markers into <strong>/<em>/<span>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Docs explained the code-first ordering rationale well; missed only the currentColor-mix styling detail, which is implementation detail rather than behavior.

### `CopyButton`
- spec 3 · read at `e3b423a23636` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:29:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a button; on click it calls navigator.clipboard.writeText(text) and only sets a "copied" state to true (triggering a checkmark icon / "Copied" label, likely reverted after a timeout via setTimeout) once that promise resolves successfully. If the write throws/rejects (no permission, insecure context), it leaves the copied state false rather than lying about success. `title` is used for a tooltip or aria-label on the button.
- found: Renders a small icon button (square/copy icon vs checkmark) that writes `text` to the clipboard on click, stopping propagation. It uses a `done` boolean state, set true only when the clipboard write promise resolves (false on rejection), and an effect auto-resets `done` to false 1.2s later. Title shows "Copied" while done, otherwise the passed `title`; aria-label always uses `title`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/ReadDialog.tsx

### the file itself
- spec 3 · served in 2 parts · read at `3a9b933e8f34` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:55:38Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: The modal component for starting a reading run — letting the user pick a harness/model and how many readers, with a slider (backed by `Slider`) to choose how much of the repo to read against the reading-curve data fetched via the `read_curve` command, showing an estimated token/cost via `tokensFor`, with `snap`/`approx` as small helpers to quantize the slider to sensible stopping points and format approximate numbers for display.
- found: The modal for starting a reading run: picks agent/harness (chips, falling back to a datalist/select for models the agent doesn't enumerate itself), defaults harness/model from the project's own banked/recent readings rather than local preference (so a repo already read on one scale doesn't silently drift), and offers a snapping slider bounded by a fetched reading-curve to choose how many functions to read next. It shows four live gauges (Functions, Readers, Lines, Tokens) computed from measured per-reader and per-function token constants and the curve data, warns when the chosen model differs from the corpus's banked model, and calls setReader/startCheck on submit. My prediction correctly identified the slider/cost-estimate/model-picker shape but missed the extensive logic for defaulting model/harness from corpus history, the enumerated-vs-alias model input strategy, and the four-gauge display.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `tokensFor`
- spec 2 · read at `0446577e1881` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:46Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Computes number of batches as Math.ceil(functions / batch), then returns an estimated total token cost combining a fixed per-batch overhead with a per-function token cost (batches * overhead + functions * perFunctionCost), used to preview how many tokens a read run will consume before starting it.
- found: Exactly batches*ENTER_TOKENS + functions*PER_FUNCTION_TOKENS, matching prediction precisely.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `Slider`
- spec 2 · read at `8ab9b251b162` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a wrapper div containing a native <input type="range"> (opacity 0 or similar, so it still handles drag/click/keyboard/focus/accessibility) layered over custom-drawn track, fill, and thumb elements built from divs/spans styled via computed percentages. The fill width and thumb position use `(value - min) / (max - min)` consistently, and detent notches are rendered at `(d - min) / (max - min)` percent positions along the track, with label and valueText displayed as text near the slider.
- found: Renders a transparent native range input on top for interaction/accessibility, with drawn-underneath track/fill/thumb positioned via one consistent (v-min)/span percent helper; detents render as small vertical bars painted in the card background color so they stay visible against both track and fill. label/valueText are used only as aria-label/aria-valuetext, not visible text.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `snap`
- spec 2 · read at `c6a1890c842e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:37Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Checks each value in detents and, if v is within a catch window sized as a percentage of the range (using left as part of the range calc) of that detent, returns the detent instead of v; otherwise returns v rounded to the nearest step.
- found: Computes a catch window as max(step, (left-step)*0.02), finds the first detent within that window of v, and returns it; otherwise returns v unchanged (not rounded).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `approx`
- spec 2 · read at `21533db1a284` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:52Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Formats a number as a human-readable approximate string, e.g. abbreviating thousands as "~1.2k" or similar, likely used to display an estimated token count (paired with `tokensFor`) in a dialog without pretending to false precision.
- found: Formats a number into an abbreviated string: millions get one decimal + 'M', thousands round to the nearest whole 'k', anything smaller is just the plain number as a string.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Predicted the abbreviation behavior correctly but assumed a '~' prefix that isn't actually there.

### `ReadDialog` — QUIRKY — TANGLED
- spec 2 · read at `311c14be34c5` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:47Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A modal dialog component with three controls: agent choice, model choice (remembered per-project, likely via localStorage or the project record), and an extent/budget slider (using Slider/snap/tokensFor to show an approximate token cost estimate via `approx`). On confirm, it kicks off a read run (probably an API call) for `project`, then calls onStarted() and onClose(); Field/Choice are small presentational subcomponents used to lay out each option.
- found: A large dialog: picks agent from installed harnesses, resolves model from a priority chain (corpus-banked > recently-used > per-agent default), renders model choice as chips/select/datalist depending on how many the harness enumerates, shows four Gauge dials (functions/readers/lines/tokens) plus a slider with rounded detents for choosing how many functions to read, and on submit calls setReader + startCheck then onStarted/onClose.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The doc block explained the high-level 'why' of the dialog (asking replaced an orchestrator prompt) but the body's real complexity — three-source model precedence, chip/select/datalist branching, four-dial coverage readout — went far beyond what I predicted.

## web/src/components/Rings.tsx

### the file itself — QUIRKY
- spec 3 · served in 2 parts · read at `650c713a65ab` · commit `74e9537` · read by claude-sonnet-5 · via claude · when 2026-09-03T06:57:44Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Rings.tsx renders a concentric-ring visualization (tree-ring style, likely representing commit history/age per file or function) plus its accompanying control panel: small subcomponents for ring count, band width, spacing menu, color count, and toggles (lens, marker, derivable), along with readouts like age, churn window, and "tangle" (complexity/coupling). It's primarily rendering/UI code with interactive controls bundled in the same file, and the lack of a file header doc suggests no one has written down its overall responsibility.
- found: A collection of small, tightly-scoped control components for the ring-map's crumb bar: RingCount (stepper for ring depth), BandWidth (slider), SpacingMenu (popover with three sliders for border/slice/ring gaps plus a shared Slider primitive), ColorCount (stepper through discrete color caps), LensToggle (shared on/off switch styling used by several toggles), MarkerToggle, AgeReading (segmented newest/oldest), DerivableToggle, ChurnWindow (dropdown of repo-scaled day windows), and TangleReading (weighted vs raw complexity switch). Each has extensive prose comments justifying UI/interaction design choices (why a stepper vs segmented control vs dropdown, etc). No actual ring/sunburst rendering logic lives here — that's elsewhere (Sunburst).
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `RingCount`
- spec 3 · read at `054d30d5cc62` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A stepper matching ColorCount's structure: minus/plus buttons that increment/decrement `rings` by 1 within some fixed min/max range, disabling at the ends rather than wrapping, with the current count and the fixed noun "rings" displayed in the middle, calling onRings on click.
- found: Exactly as predicted: minus/plus buttons clamp rings between RINGS_MIN/RINGS_MAX (disabled at ends, no wrap), current count plus "rings" noun shown in the middle pill, matching ColorCount's visual structure closely.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: None.

### `BandWidth`
- spec 3 · read at `7e9eb8b093d1` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:28Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a labeled range/slider input (label "band" plus the current percentage) bound to `share`, calling `onShare(v)` with the new fractional value on change/input. It's a continuous control with some min/max/step (likely 0 to 1, maybe capped below 1), rendered inline in the toolbar alongside the other Rings controls, with no persistence — just reflects the live `share` prop.
- found: Range slider (0-100, mapped to a 0-1 fraction) labeled 'band' with a live percentage readout, calling onShare on change — exactly as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `ColorCount`
- spec 3 · read at `166ea5cefb2b` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:35Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A stepper control that finds cap's index in a CAPS array of discrete allowed values, and renders minus/plus buttons that step to the previous/next CAPS entry (clamped at the ends) calling onCap with the new value, displaying the current cap number alongside a noun label like "colors". It's only rendered for categorical lenses (mode is presumably checked by the caller or here), matching RingCount's structure closely.
- found: Steps cap through the CAPS array via findIndex, with an unrecognized value snapping to the top rather than erroring. Minus/plus buttons step and disable at the ends, and the noun in the tooltips ("people" vs "languages") is chosen from `mode`, while the visible unit word is always "colors" — I'd assumed the noun itself was the visible label.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: None.

### `LensToggle`
- spec 3 · read at `b086436a2bd8` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:35:23Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders a single button styled as a switch (role="switch", aria-checked={on}) showing the glyph (children) followed by word text, with accent background/bold text when on and muted styling when off, calling onToggle(!on) on click, with title as tooltip.
- found: Renders a single switch-role button with the glyph (children) then word text, accent-colored/bold/shadowed when on, muted when off, calling onToggle(!on) on click.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `MarkerToggle` — QUIRKY
- spec 3 · read at `81ddb648578d` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering a labeled on/off switch (likely a button or checkbox styled as a toggle) for whether directory rims show the pointing-dot markers. It displays some label text (e.g. "dots" or "markers"), reflects the current `on` boolean in its visual state, and calls `onToggle(!on)` on click.
- found: Delegates to a shared LensToggle component, passing word="markers" and a title tooltip that explains the on/off states in prose. The visible control isn't text or a checkbox but a small SVG of three dots, dimmed (opacity 0.45) when off and full opacity when on, deliberately mirroring the dot markers it toggles.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: The dot-SVG-as-icon design (mirroring the thing it controls) and delegation to LensToggle aren't guessable from the signature/peers alone, though the doc field explains the rationale well.

### `AgeReading`
- spec 3 · read at `8e5eab640c39` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:36Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a two-segment toggle control with segments labeled "oldest line" and "newest line" (matching AgeRead values), styling the segment matching the current `read` prop as pressed/active, and calling `onRead` with the newly selected value when the other segment is clicked.
- found: Renders a pill-shaped two-segment toggle ("newest"/"oldest") with tooltips explaining each reading; the active segment is colored with the age lens's own color and gains a "line" suffix (e.g. "oldest line"), the inactive one stays plain muted text; clicking calls onRead with that segment's key.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `DerivableToggle`
- spec 3 · read at `8c94a0333d7a` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Like MarkerToggle, delegates to LensToggle with word="derivable" and an on/off title explaining what marking derivable docs does, but draws its icon as a small pulsing dot (referencing the '.derivable-pulse' CSS class) rather than the three-dot marker icon, dimmed when off.
- found: Same LensToggle delegation pattern as MarkerToggle, with word="derivable" and explanatory title text. The icon is three horizontal bars of decreasing width/opacity (mimicking lines of text/a comment), which gets the `derivable-pulse` class (breathing animation) when on, rather than a single pulsing dot as I guessed.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: None.

### `ChurnWindow`
- spec 3 · read at `6e7ad357c17d` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:17Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a dropdown/select control listing the four `windows` values (in days) as options, each labeled with its day count (e.g. "30d"), with the option at index `at` shown as selected, and calling `onPick(i)` with the chosen index when the user picks a different one.
- found: A custom pulldown (button + backdrop + listbox popover, not a native select) showing the current window's label ('1 day'/'N days'/'Nd'), toggling open state, and calling onPick(i) + closing on option click.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `TangleReading`
- spec 3 · read at `e32d9ca845be` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:34:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a small toggle/button switching between two tangle-measurement readings (analogous to sibling AgeReading), calling onRead with the new TangleRead value on click; the docs shown (about a Complexity weighted/raw glyph) appear to describe a different, unrelated toggle and likely don't match this function.
- found: A LensToggle wrapper switching TangleRead between 'weighted' (measure a function against the median length of others its size) and 'raw' (flat count of decision points against a fixed published bar of 15), with a two-bar SVG glyph and a title tooltip explaining each mode.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I wrongly guessed the docs (about a 'Complexity' weighted/raw toggle) didn't apply to this function — they actually describe it exactly, just using 'Complexity' as the lens's display name while the code/type calls it Tangle.

## web/src/components/RollupDots.tsx

### the file itself — OBSCURE
- spec 2 · read at `90b11b65fd3e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:54Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A small, self-contained component file with no header doc, whose job is to render a compact row of colored dots summarizing a rolled-up/collapsed group of nodes (e.g. one dot per function or per grade bucket, colored by its reading/heat). `dotsId` is a small helper generating a stable id (probably for SVG defs/gradients or React keys) and `RollupDots` is the component itself, likely taking counts or nodes and a color function as props.
- found: Not a row of summary dots at all — it generates a rotated SVG `<pattern>` (a repeating single-dot tile, angle-aligned to the wedge's mid-angle and translated to the patch's own center) used as a texture fill marking roll-up patches in the sunburst chart as "a collection, not a function," distinct from the stale hatch. `dotsId` builds a collision-free SVG id from a file path by escaping non-alphanumeric characters to their char codes.
- predicted: none · documented: none · derivable: no · legible: not judged · trap: no

### `dotsId`
- spec 2 · read at `d813a04c4855` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:48Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a collision-free CSS/SVG id from a file path by replacing each character that isn't a letter, digit, or hyphen with an escape sequence encoding its character code (e.g. "_" + code), rather than collapsing all non-alphanumeric characters to a single "-" which would let different paths collide. Likely uses charCodeAt and some prefix like "id" + code.toString(36) or similar, joined together with allowed characters left as-is.
- found: Prefixes with "dots-" and replaces each non-alphanumeric character with "-<charCode>-", so the escape is delimited by hyphens on both sides rather than a single prefix character.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: My guess about the exact escaping scheme (prefix+base36) was wrong in detail, but the core idea (escape to char code to stay injective) matched.

### `RollupDots` — OBSCURE
- spec 2 · read at `5f2e48bfa4bb` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:07Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Draws a small cluster of dots (like an ellipsis "…") near (cx, cy), offset outward along `angle`, to indicate that this wedge is a rollup of several collapsed children rather than a single leaf. Uses `dotsId` to build a unique SVG element id derived from `id` for defs/reuse (maybe a <symbol> or <use>), and probably renders 3 small <circle>s spaced along a line perpendicular or parallel to the angle direction.
- found: Emits a single <defs><pattern> — a repeating dot-grid texture, one small circle per tile — that is rotated to the wedge's mid-angle and translated so the lattice is anchored to the patch's own center rather than the chart's global origin, meant to be used as a fill (like StaleHatch) rather than as literal drawn dots.
- predicted: none · documented: none · derivable: no · legible: most · trap: no
- note: Expected a small cluster of ~3 literal dots (an ellipsis marker); it's actually an infinite tiling pattern definition analogous to StaleHatch, with careful translate+rotate math to anchor the grid per-patch rather than globally.

## web/src/components/SideBar.tsx

### the file itself — QUIRKY
- spec 3 · served in 2 parts · read at `2d52cb76976f` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:32:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The sidebar listing tracked projects/repos, sorted by recency of use unless the user has manually reordered them (drag-and-drop, with DropLine rendering the insertion indicator between rows). ProjectItem renders one repo's row — name, maybe size/status, a delete button, and controls for which harness/model reads it. SideBar itself likely also has an "add project" affordance and manages selecting/switching the active project.
- found: SideBar renders the project list with custom pointer-based drag-to-reorder (not HTML5 DnD, because the Tauri webview swallows it), DropLine as the insertion indicator, and a right-click context menu (Reset/New monster/Remove). ProjectItem is a much richer per-row status display than I predicted: it tracks running/stopping/failed/reading state, shows a three-phase Scan/Trace/Read pill row (Phases component) with replay progress folded into the trace pill, a bottom-edge sweep while anything is working, and a failure transcript overlay — not a simple name+delete+harness-picker row.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `SideBar` — QUIRKY
- spec 3 · read at `4867f93b7b88` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders the full-height left sidebar column: an add button, and a list of ProjectItem rows built from `projects`, passing through active/replay state and forwarding the various callbacks (select, read, forget, reset, remint, replay, trace, scan, stop trace, error). Includes drag-and-drop reordering of the list using DropLine to render an insertion indicator between rows as the user drags a project to a new position.
- found: Renders the project list column with an add button and empty state, mapping projects to ProjectItem rows. Implements pointer-event-based (not HTML5) drag-to-reorder with a measured-once slot layout, a DropLine gap indicator, and a dragged "ghost" row positioned via direct DOM transform for performance; also owns a right-click context menu (Reset/New monster/Remove) and a failure-transcript overlay sheet, plus a "blocked" computation gating Trace/Replay to one repo at a time based on backend-reported tracing state.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `DropLine` — QUIRKY
- spec 3 · read at `7cf9ac969254` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:17Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering a placeholder div in normal document flow (not absolutely positioned), sized to roughly the height of a project row, used as a drop-target indicator during drag-and-drop reordering in the sidebar's project list.
- found: Renders a thin (h-0.5) accent-colored rounded line with small vertical margin, aria-hidden, as an in-flow drop indicator — not a full-row-height placeholder as I guessed, just a slim line.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I overestimated its size — it's a 2px accent line, not a row-height placeholder block.

### `ProjectItem` — QUIRKY — TANGLED
- spec 3 · read at `1f6358cc3b7b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a div (not button) acting as a row: role + tabIndex + onKeyDown for click semantics, onClick, onContextMenu, and onPointerDown wired to onGrab for drag start. Shows project name/icon, with `active` and `dragging` controlling CSS classes. The right-side slot conditionally renders: a Progress/percentage view when `replay` is non-null, action buttons (Read, Stop trace, Scan) when this row is active or hovered, otherwise a static count (e.g. file/issue count) — with `blocked` disabling or styling the trace-related control differently.
- found: Renders the row div as predicted (role=button, onClick, onContextMenu, onPointerDown=onGrab, active/dragging styling), but the right-side "slot" I predicted (inline Read/Stop/Scan buttons) is actually delegated entirely to a separate `Phases` subcomponent. The bulk of the function is a state machine deriving `running`, `winding`, `stopping`, `busy`, `reading`, `working`, `failed`, and `open` from `project.run` plus local `cancelling`/`asked` state (with effects to reset them), used to drive a bottom-edge "sweep" progress indicator, a pulsing icon, and a failure chip that opens a transcript — none of which I predicted.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

## web/src/components/Sprig.tsx

### the file itself
- spec 3 · read at `705845ca81b0` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:34Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Defines a small seeded-RNG helper (rng) and a Sprig React component that procedurally draws a decorative one-stem plant (SVG paths for stem + leaves) to fill the blank line under a project row's pills when idle. The shape is deterministic per project (seeded from something like the project id/path) so it looks different per row but stable across renders, purely decorative with no real data displayed.
- found: Mulberry32 seeded PRNG plus a Sprig component that procedurally draws a wandering stem (sum of two sine waves plus a lean) with alternating leaves (borrowing leafPath from Bloom.tsx) as an SVG filler for the blank line under an idle project row's pills, seeded per-project so it's stable across polls but different every app session.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header doc is unusually thorough (explains rejected alternatives: showing a number, keeping the rose bud, a single sine wave) so almost nothing in the body was a surprise beyond exact constants/geometry.

### `rng`
- spec 3 · read at `23eeeccc94cb` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:01Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Implements the Mulberry32 PRNG algorithm — takes a numeric seed and returns a closure that, on each call, advances internal state with the standard Mulberry32 bit-mixing steps (xor-shifts and multiplications) and returns a float in [0,1). Small self-contained generator with no external deps, deterministic per seed.
- found: Standard Mulberry32 PRNG: seeds a 32-bit state, returns a closure that mixes it with the canonical constant/xorshift/imul sequence and returns a float in [0,1) per call.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `Sprig`
- spec 3 · read at `6a67c1b8c88c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:43Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A decorative SVG component that uses a seeded PRNG (rng) to deterministically generate a unique-looking twig with a curving stem and a handful of small leaves branching off it, so each row gets a different-but-stable sprig based on its seed (likely derived from the project key/name), filling empty space under a project row's pills when there's nothing else to show.
- found: Generates a stem as sum of two irrational-frequency sine waves plus a slight lean (to avoid looking mechanical/plotted), extending off both tile edges; then walks along it placing alternating-side leaves whose angle is derived from the stem's local tangent slope plus jitter, each leaf drawn via the shared leafPath helper.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/StaleHatch.tsx

### the file itself
- spec 2 · read at `c7b7b8e9ed73` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:10Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Defines a small React component rendering an SVG <pattern> of diagonal hatch lines, used as a fill overlay (via url(#id)) to visually mark "stale" segments (e.g. in the Sunburst chart) — old/unchanged code — distinct from color-coded surprise/heat. Likely just a <defs>/<pattern> block, minimal logic, maybe a prop for color/id.
- found: A component (not a bare <defs> block, deliberately, so the SVG pattern id is unique across mounted views) rendering a diagonal-line hatch pattern with id "stale-hatch", meant to mark wedges whose reading has "expired" (code moved) — a texture rather than a second color so it doesn't compete with the single color encoding.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `StaleHatch` — QUIRKY
- spec 3 · read at `1ad2ee84fce4` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:23Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: StaleHatch renders a single SVG element containing a <defs><pattern id="stale-hatch">...</pattern></defs> block with diagonal hatching lines, mounted once at the app root so that any wedge can reference it via fill="url(#stale-hatch)" without duplicating the id across multiple mounted views.
- found: StaleHatch returns a <defs> block with THREE distinct SVG patterns, not just one: "unreadable-hatch" (a coarse cross-hatch for wedges nothing can ever read, distinguishing from grey/unread), "fold-hatch" (a fine cross-hatch marking a folded directory's handle), and "stale-hatch" (diagonal parallel lines rotated 45deg for expired readings) — each mounted once so their ids resolve unambiguously across the app.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The function/file name and the doc comment only describe the stale-hatch pattern; the function actually defines two additional, differently-motivated hatch patterns (unreadable-hatch, fold-hatch) that a reader relying on the name/docs would miss entirely.

## web/src/components/Summary.tsx

### the file itself
- spec 3 · served in 2 parts · read at `bafbba0b8201` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:49:09Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Frontend sidebar/panel component rendering the statistical summary for a selected node in the sunburst: a top-level Summary component assembling breakdown sections (using breakdownTitle/rowNote helpers for labels), a Buckets component rendering a histogram from the backend's columnized function data (Cols), a Spread component showing a distribution or min/max/mean range, and a ListWindow component for a scrollable/virtualized list of related items (e.g. files or hotspots) within the panel.
- found: Summary.tsx is the sidebar detail panel for the currently-selected node: Summary assembles a header (Counts, path, about), a breakdown section headed by breakdownTitle, showing either Buckets (per-lens histogram bar, e.g. authors/languages/age bands, widths in lines) or Spread (the surprise-grade distribution bar, widths in counts, with unread/expired as inert segments), and a windowed ListWindow of the picked bucket/grade's functions (manual virtualization via fixed ROW_H and scroll-position math, not a library) with rowNote supplying the one extra fact each row can say beyond its bucket heading.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: No file header existed at all (docs: []) despite very heavy prose-comments throughout the body explaining design history — the module-level 'why' is scattered across individual function/component doc comments rather than summarized at the top.

### `breakdownTitle` — QUIRKY
- spec 3 · read at `beb0a1c071a4` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a heading string for a breakdown section based on the ColorMode (e.g. "Hue breakdown"), and for the one view/lens among `views` whose rows depend on a "reading" being resolved, appends a qualifier or note to the title when that reading isn't yet resolved (e.g. pending/unresolved indicator).
- found: Returns a static title per ColorMode via a lookup table, except for 'surprise' (hardcoded), 'age' (picks 'Oldest line'/'Newest line' based on views.age.read), and 'tangle' (picks 'Complexity' vs 'Complexity for its size' based on whether views.tangle is 'raw' or weighted).
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `rowNote` — QUIRKY
- spec 3 · read at `77c5ab5bcea8` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:22Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes the small trailing-column string shown next to each row in a bucketed list. For 'age'/'churn' (band-based) modes it formats the specific underlying value within the band (like "5d ago" or "11 in 90d") using views data. For categorical modes (author, language, grade, trap) it instead returns a line-count string since the category itself is already shown as the heading.
- found: Per-mode formatting: age gives 'today'/'Xd ago' or em dash; churn gives 'N changes' for the commits at the selected window (explicitly not a duration string); callers/reach give complementary caller/callee counts depending on which side is zero; clones gives clone-group location info; default (categorical) falls back to a line count.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The inline comments explicitly warn against the exact wrong assumption I made for churn (that it prints a duration like 'in 90d') — worth flagging as a documented gotcha for future editors.

### `ListWindow`
- spec 3 · read at `06c7d1411232` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:44:49Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Uses a scroll container ref plus state for scrollTop/height (via a scroll listener and likely ResizeObserver), computes visible row indices from a fixed row height with overscan padding above/below, and renders only that slice as spacer-padded rows — each showing a swatch from `paint`/colorFor, the node's name, and a trailing note from `rowNote` for the given `mode`/`rowViews`, wired to `onSelect`/`goTo` on click.
- found: Matches prediction closely: scroll/resize-observed ref state drives a windowed slice with overscan and spacer divs; each row shows a swatch, name, and rowNote. Missed detail: click selects while double-click calls goTo, and scroll resets to top whenever the `rows` array changes.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Spread`
- spec 2 · read at `3f49c9056efd` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders a horizontal stacked bar whose segments are widths proportional to counts: one segment per Grade in cold-to-hot order (colored from the same heat ramp as the sunburst), plus separate neutral-colored segments for `stale` and `unread`. Below or beside it is a key/legend listing each segment's label and count; clicking a segment or key entry calls onPick(grade) to filter the list, toggling to onPick(null) if the same one that's already `picked` is clicked again.
- found: Builds segments for each Grade (heat-colored) plus stale ('expired', neutral) and unread (neutral), filters zero-count ones, renders a stacked bar with widths as percentage of total. Below it, a key lists each segment with swatch/label/count; only grade segments are clickable buttons (toggling onPick(grade)/onPick(null)), while stale/unread rows are inert divs since they represent absence of a reading rather than a reading outcome.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted stale/unread would also be clickable filters; code deliberately keeps them inert since they're not reading outcomes.

### `Buckets`
- spec 3 · read at `40ee33ef97c2` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:43:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a horizontal stacked bar whose segment widths are proportional to each bucket's total loc (not function count), plus a key/legend list below mirroring Spread's layout. Every row/segment is clickable, calling onPick with the bucket's key to select it (highlighting matches picked), and clicking the picked one again calls onPick(null) to clear.
- found: Stacked bar segments proportional to bucket.lines/total, plus a scrollable (max 33vh) key list below where each row toggles onPick(key) on/off, highlighting the picked row and showing lines (the sort key) as the visible number with count in the tooltip.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Summary`
- spec 3 · read at `0d9ab3023030` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:45:09Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a header (title, path crumbs, about), computes counts/breakdowns of node's subtree keyed on mode (functions, lines, categories) using breakdownTitle for section labels, renders a Spread bar and Buckets histogram for the distribution, then a ListWindow of notable rows (e.g. most surprising/oldest functions) wired to onSelect/onDrill, with footer pinned at the bottom.
- found: Matches the general shape (header/counts/about, breakdown, scrollable list, footer) but the real logic is a mode-dependent branch: under 'surprise' it shows a Spread with grade-picked (defaulting to hottest non-empty grade) reading list, and under any other lens it shows Buckets with a picked-bucket (defaulting to the biggest) ListWindow — plus a goTo helper that drills then selects, and deliberately no per-note list (explained in a removed-feature comment).
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## web/src/components/Sunburst.tsx

### the file itself — QUIRKY — STALE
- spec 3 · served in 6 parts · read at `e0ac41c46bf9` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:46:55Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: The core sunburst/radial visualization: computes each node's angular arc from its line-count share, lays out concentric rings per depth, colors wedges via colorMode, handles hover (feeding WedgeTip) and click/drill/select interactions, animates morphing transitions between frames during replay, folds thin wedges into roll-ups, and draws directory rim bands (sub-distribution histograms) with trap/clone marker dots.
- found: Confirmed as the core radial visualization renderer with arc layout, coloring, hover/tooltip, drill/select and rim histograms with markers — but it is really the whole rendering engine: it also owns a level-change zoom/keyframe transition system (entering/exiting wedges, a clicked directory "coring" into the hub), a continuous morph/chase animator for replay frames, an open-file "unroll" path via FileZoom, function tiling inside file bands with roll-up dot textures, a mascot gaze system that tracks active/reading wedges, a selection-dimming mask technique, dynamic label fitting/sizing, pixel-calibrated thresholds for what is worth drawing at the current density, and a folded/hidden-count caveat chip — none of which the file header (absent) or the name alone suggested.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `outOf` — QUIRKY
- spec 3 · read at `c45da41818f1` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:55:04Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Formats a string like "n noun (X%)" showing n out of of as a percentage, with variable decimal precision depending on the share's magnitude, printing "<0.01%" for shares that would round to zero, and omitting the percentage part entirely (just "n noun") when `of` is 0/falsy since the denominator is unknown.
- found: Formats n with locale thousands separators, pluralizes the noun (adds 's' unless n===1), and appends whatever `share(n, of)` returns (the percentage formatting with its variable precision lives in that separate peer function, not here).
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The doc block describes the precision/rounding behavior that actually lives in the peer `share` function, not in `outOf` itself — docs cover the enclosing concern, not this function's own body.

### `share` — QUIRKY
- spec 3 · read at `e0d2f75c25bc` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:51:25Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes the percentage that n represents of "of" and returns it as a formatted string like "42%" or "42.0%", likely guarding against division by zero (returning "0%" or similar when of is 0).
- found: Formats n/of as a percentage wrapped in " (...%)" with tiered precision (0 decimals >=10%, 1 decimal >=1%, 2 decimals below), a special "<0.01%" case for tiny nonzero shares, and returns empty string when of<=0.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `heatShare`
- spec 2 · read at `735127f33e96` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:47Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a damping multiplier (0-1) for how strongly a ring's color should read, based on kind (e.g. 'dir' vs 'file'/'func') and mode. Returns 1 (no damping) for every mode except 'surprise', where directory-kind nodes get some reduced value since their color there is only a rolled-up "hot share" rather than a direct measurement, while under all other modes (churn, age, blame, lang) it always returns 1 since those aggregates are legitimate readings of the same quantity.
- found: Under 'surprise' mode, looks up a per-kind damping value from a HEAT_BY_KIND table (defaulting to 1 if kind isn't in it); under every other mode it always returns 1 (no damping).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `SunburstView` — TANGLED
- spec 3 · served in 5 parts · read at `fe517d226ef2` · commit `74e9537` · read by claude-sonnet-5 · via claude · when 2026-09-03T06:58:01Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Top-level React component rendering the whole sunburst radial map: lays out wedges from `root` (using rings/spacing/density), draws SVG arcs colored per `mode`, renders the central hub with mascot/go-up control, and wires pointer interactions for select/drill/clear. Holds substantial internal state (hover/tooltip, morph animation, memoized layout) and reacts to `reading`/`replaying` to highlight in-progress or unread nodes.
- found: The component computes a radial sunburst layout from `root`, converting every visual threshold (arc width, patch area, rim width, fold-handle size) from pixels to user-space units via `unitsPerPx` so density is a property of the render target (screen vs export) rather than the tree. It manages a hand-rolled rAF-driven transition system for level changes (zoom in/out, becoming/leaving the hub, opening/closing files) plus an optional continuous "chase" animation that eases wedges toward a moving target (used for history replay and directory folding), all keeping per-wedge geometry in refs to avoid a React re-render per frame. On top of layout it draws: directory "rim" bands (either colored distribution histograms or single-color fills or pointing dots for traps/clones), function patches tiled inside file wedges, escalated events for replay commits that have no wedge of their own, a mascot gaze direction averaged/individuated from active reading or replay events, hover/selection rendering via a dimming mask + outline rather than a redrawn overlay, and a footer chip enumerating hidden/unparsed/folded content so the picture never silently implies completeness.
- predicted: most · documented: full · derivable: no · legible: some · trap: no
- note: The prop docblock is exhaustive and well-written, but is not itself the whole story — nearly all of the real design reasoning (why pixels convert to units, why the chase exists, why selection dims rather than outlines, why rim runs are computed once and shared with the tooltip) lives in inline comments inside the 2600-line body, not in the signature's docs.

## web/src/components/WedgeLabel.tsx

### the file itself — QUIRKY
- spec 2 · read at `80d8479138b2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:16Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the text label for a single wedge/sector in this radial visualization — likely computing the label's position (radius, angle) and rotation so it sits legibly within or along the wedge's arc, and probably truncating or hiding the text when the wedge is too small/thin to fit it. Likely a single exported component function with maybe one or two small helper functions for geometry (angle-to-position, text-fit checks).
- found: A single unified label renderer for two placement modes (Placement.axis === 'arc' vs radial), replacing two previously-separate renderers (labelArc+textPath in Sunburst, horizontal text in FileZoom). For arc placement it builds a hidden <path> in <defs> via labelArc and puts text on it with <textPath>; for radial placement it computes a rotate/translate/rotate transform to point text outward along the radius, flipping direction in the left half so text always reads left-to-right. Positioning/fit decisions belong to a separate `fitLabel`; this component only draws. Styling (font, weight, tracking, opacity) is imported live from labelStyle.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: Missed that this is a deliberate merge of two previously-duplicated renderers, and the left-half text-flip trick for readability — my prediction assumed a single rendering mode with truncation logic that actually lives elsewhere.

### `WedgeLabel`
- spec 2 · read at `bd61464a726d` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:53Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A single component that draws a label given a `Placement` (`at`) which may describe either a curved arc (ring) or a straight/radial position (fan). For arc placements it builds a <path> in <defs> keyed by `id` and a <text><textPath> along it, flipping the path direction when the arc would otherwise render the text upside-down; for straight placements it renders a plain <text> element. Styling (font, weight, letter-spacing, fill/opacity) comes from calling `labelStyle`.
- found: Two branches on at.axis: 'arc' draws a <defs><path> plus <text><textPath> along it; otherwise draws a radial <text> positioned via rotate/translate/rotate transforms, flipped 90 vs -90 depending on which half of the circle it's in so labels always read left-to-right. Styling uses local FAMILY/TRACKING/WEIGHT constants inline, not a separate `labelStyle` function call as the docs implied.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Docs say styling "comes from labelStyle, live" but the body sets font/tracking/weight from local constants directly — no labelStyle function is called here. Also the upside-down-flip logic I expected on the arc branch is actually on the radial/fan branch instead.

## web/src/components/WedgeTip.tsx

### the file itself
- spec 3 · read at `38cfc35cf710` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:46:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Implements the hover tooltip for a sunburst wedge: a small floating component (WedgeTip) showing the node's name, size in lines, and for a directory its file/function counts via the countFiles helper, positioned near the cursor. No other responsibilities in this file.
- found: Confirmed as the wedge hover tooltip with name/path, size, and countFiles, positioned near the cursor with edge-flip logic — but it does much more than predicted: it's lens-aware (shows reading state as unread/stale/too-large-to-read/label, extra churn/age fields), shows the hovered rim slice's own label/share when present, and shows fold/drill affordance hints for directories.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `countFiles`
- spec 2 · read at `84865977315d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:23Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree — if n.kind === 'file' returns 1, otherwise sums countFiles(child) over n.children (via reduce), giving the total file count under the subtree rooted at n.
- found: Recursive walk: returns 1 for a file node, otherwise sums countFiles over children in a for loop.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `WedgeTip` — TANGLED
- spec 3 · read at `3c2487ab0e65` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:02Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders the floating tooltip card shown when hovering a wedge: positions itself near (x, y) but flips to the other side when close to the pane edges (using `box`), and shows the node's name/path, a colour swatch matching the wedge's current lens reading (never a raw number), a "not measured yet" or "stale" label when the reading is absent/expired, the folded-node's share of lines when `folded` is true, and — when `slice` is given — details of the specific rim segment under the pointer (its label, share of the distribution, and how many merged values it stands for). It's geometry-agnostic, working purely off the passed node/position/box rather than any arc or rectangle math.
- found: Got the overall shape right (edge-flipping position, swatch-not-number reading, not-measured/stale states, folded share, slice detail) but missed a lot of the specifics: a separate 'too large to read' state for unreadable nodes, mode-specific extras (commits/age rows for churn/age lenses), function vs directory naming layout differences, file/function counts and roll-up 'rest' counts, and directory-specific fold/drill hint text.
- predicted: most · documented: some · derivable: no · legible: some · trap: no

## web/src/components/Wordmark.tsx

### the file itself
- spec 2 · read at `43bbe6381ea5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:20Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A tiny presentational React component (no doc header, so purely self-evident) that renders the app's text logo/wordmark — probably a styled span or SVG with the product name, used in a header or nav bar. Likely just one exported function `Wordmark` returning some JSX with a font/style treatment, no real logic or props beyond maybe className.
- found: An inline SVG wordmark component using currentColor fill (so it works in both ink/white themes without duplicate assets), with a default height of 18 chosen for optical (not arithmetic) size-matching against a sibling "tally" wordmark.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted the shape correctly (tiny presentational SVG component) but the docs revealed brand-system reasoning (currentColor theming trick, optical vs arithmetic height matching to a sibling mark) that isn't derivable from the code itself.

### `Wordmark`
- spec 2 · read at `33a03e9cdc4e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: An SVG React component rendering the inline "sanity" wordmark path(s) using currentColor fill so it adapts to theme, scaled from a default height prop of 18 with proportional width computed from the SVG's native aspect ratio, and no other configurable props per the brand rule against recoloring/effects/rotation.
- found: An SVG with fixed viewBox, fill=currentColor, height prop (default 18), aria-label "Sanity", containing six inline <path> elements for the wordmark letterforms. No width prop — width scales automatically via the viewBox aspect ratio since only height is set explicitly, matching my prediction.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/components/shell/SideBarHeader.tsx

### the file itself — QUIRKY
- spec 2 · read at `cef9ad3d6d95` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:28Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering the header area of a sidebar panel within the app shell — probably a title/logo, plus maybe a collapse/toggle button or action icons. Given its location under components/shell, it's likely a simple presentational component with minimal props (like a title string and onToggle/onClose callback) styled with Tailwind classes to match the rest of the shell chrome.
- found: Renders the top-left header cell of the sidebar containing just the Wordmark logo, as a Tauri drag-region. It tracks fullscreen state to conditionally reserve left padding for macOS's overlay traffic-light buttons, collapsing that padding in fullscreen since the traffic lights hide then.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: Expected a generic title/toggle-button header; the actual function is almost entirely about macOS Tauri traffic-light spacing and drag regions, not a typical sidebar header with controls.

### `SideBarHeader`
- spec 2 · read at `048333edc686` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:54Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a div/header styled to match the TopRow's height, with left padding sized to clear the macOS traffic-light overlay buttons, containing the app's wordmark/logo text. Likely marked as a Tauri drag region so the window can be moved by dragging this area.
- found: Renders a Tauri drag-region div at fixed titlebar height, with left padding reserved for macOS traffic lights only when on Tauri-mac and not fullscreen (fullscreen hides the traffic lights, so the reserve collapses), containing a pointer-events-none Wordmark so clicks fall through to the drag region beneath it.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the fullscreen-state tracking (traffic lights hide in fullscreen so padding must collapse) and the pointer-events-none click-through detail explaining why the wordmark itself isn't the drag target.

## web/src/components/shell/TopRow.tsx

### the file itself
- spec 2 · read at `017ffc141fa9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A tiny layout component in the app shell — a thin wrapper rendering its children inside a flex row div (probably justify-between/items-center) that forms the top bar of the app, likely holding title/nav/controls. Just a presentational wrapper, no real logic, which is why it's only 11 lines.
- found: A thin flex wrapper header for the top strip of the right column, height-matched to SideBarHeader, centering its children (now just the color-mode switcher after tabs/open-button/theme-toggle were removed for various reasons documented in comments). It's also a Tauri drag region via data-tauri-drag-region, with the note that Tauri only drags on the actual event target carrying that attribute, so buttons inside it still receive their own clicks.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Got the wrapper/layout shape right but missed the drag-region/Tauri chrome detail and the history of what used to live here (tab rail, open button, theme toggle) and why it was removed.

### `TopRow`
- spec 2 · read at `1754b4518de0` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:09Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders a thin div strip with the Tauri drag-region data attribute on the container, centering the passed children (the color-mode switcher), sized/styled to match SideBarHeader's height so the two form one continuous bar across the window.
- found: A header with data-tauri-drag-region, flex-centered children, select-none, height set via the --titlebar-h CSS var to match SideBarHeader.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/api.ts

### the file itself — TANGLED
- spec 3 · served in 4 parts · read at `aaa0164c68a0` · commit `74e9537` · read by claude-sonnet-5 · via claude · when 2026-09-03T06:58:01Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is the web app's client-side API/data layer: functions that call the backend (or a bundled server) for project management (list/select/reorder/forget/reset projects), scanning/checking repos, reading source/functions, findings and decisions, agent reports, and CLI install status, plus event subscription helpers (onScanProgress, onSetTheme, etc). It probably also has some unrelated visualization/color-ramp helper functions (heatColor, rampAt, wedgeHeat, temperature) that got placed here rather than in a separate module, suggesting this file has grown into a general "shared utilities" dumping ground beyond just API calls.
- found: A large client-side data layer: wire-format type mirrors of the Rust backend (Node, Score, ProjectSummary, Findings, AgentReport, etc.), snake_case-to-camelCase normalization (toNode/toScan), Tauri invoke wrappers for every backend command (projects, scanning, tracing, findings/decisions, agent reports, blame/history, CLI install), tree aggregation logic that mirrors Rust's Node::aggregate (reaggregate/applyScores/readInto/applyAgentReports), grade-to-word/number vocabulary tables (HEAT_WORDS, LEGIBLE_WORDS, DOC_WORDS, GRADE_SURPRISE), a repo-wide summarize() function, and color-ramp/heat helper functions (temperature, wedgeHeat, shareRamp, paintHeat, heatColor, rampAt) that compute what colors wedges on the visualization.
- predicted: most · documented: none · derivable: yes · legible: some · trap: no

### `languages`
- spec 3 · read at `8b90410603f0` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:54:20Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls the Tauri invoke("languages") command with no arguments and returns the resulting promise of LangSupport[], since this is a build-wide fact rather than per-repo.
- found: Thin wrapper calling invoke('languages') with no args, returning the promise of LangSupport[].
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `churnSaturation`
- spec 3 · read at `4af2acf63574` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:55:09Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Scales the CHURN_SATURATION constant (documented as roughly one commit/week over a quarter) to an arbitrary window: something like Math.max(1, Math.round(CHURN_SATURATION * days / QUARTER_DAYS)), so the rate stays consistent as the window size changes rather than a fixed count skewing brightness.
- found: Math.max((CHURN_SATURATION * days) / 90, 1) — scales the constant linearly by days/90 (a quarter) and floors at 1.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Predicted the exact shape but guessed a rounding step that isn't there.

### `pruneExcluded`
- spec 3 · read at `387ef5c13909` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:29Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively rebuilds the tree, dropping any file-kind node marked excluded (and any directory left with no children as a result), and recomputing each surviving directory's loc as the sum of its remaining children's loc rather than trusting the size Rust computed — so excluded subtrees stop inflating wedge sizes on screen.
- found: Recursively filters out any child marked excluded (checked at any node, not just files) and recurses into survivors; func nodes pass through untouched, file nodes keep their own loc as-is, and only directory nodes get loc recomputed as the sum of surviving children.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I assumed only file-kind children get filtered by `excluded`; the code checks the flag on whatever kind the child is, trusting that only files ever carry it (per the doc's inheritance note) rather than enforcing that here.

### `localityOf`
- spec 3 · read at `f3702b0c8e99` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Reads two counts off the node (e.g. n.outside and n.wired/n.neighbours) representing wiring that leaves the directory vs total wiring, and returns outside / total as the locality ratio, or null if total is zero/undefined (nothing wired to it).
- found: Returns null if n.incident or n.away is null/undefined or n.incident is 0; otherwise returns n.away / n.incident.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `showsShare`
- spec 3 · read at `e52fc0ff471b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:36Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns true when this node's wedge is colored by hot_share rather than temperature — i.e. when node.kind is 'dir' or 'file' rather than 'func', matching the model.rs distinction that only leaf functions show raw temperature while containers show the share of their lines that are hot.
- found: Returns true when node.kind !== 'func' (matching my prediction) OR when node.rest !== undefined — an additional case for some kind of aggregated/rolled-up pseudo-node I didn't anticipate.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: `node.rest` isn't explained anywhere in what I was shown — a future reader needs to know what that field represents to understand the second disjunct.

### `unreadable`
- spec 3 · read at `85c6bf1ef9a7` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:58:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns false if node.bytes is null (unknown size treated as readable), otherwise compares bytes against a fixed size threshold constant and returns true if it exceeds that threshold, meaning the content is too large to display/read in the UI.
- found: Returns node.bytes !== null && node.bytes > READ_CEILING — null bytes (unknown) is treated as readable, and bytes beyond a fixed ceiling constant is treated as unreadable.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `toNode`
- spec 3 · read at `5ec5a733bd4c` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:45:06Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a WireNode (backend JSON with snake_case field names) into the frontend Node type, remapping fields like last_author, clone_group, calls_resolved etc. into camelCase equivalents, and recursively maps over w.children calling toNode on each to build the nested tree. May also normalize/default some optional fields (e.g. score, hotspots) for easier consumption by the UI.
- found: Maps a WireNode's snake_case fields to the frontend Node's camelCase equivalents, recursively converting children via children.map(toNode). Uses `?? null`/`?? undefined` deliberately rather than `?? 0`/`?? []` for measurement fields (callers, tangle, cognitive, unparsed, cols) so that \"backend never measured this\" stays distinguishable from \"measured and found zero/none\".
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No docs provided, but the code's own comments explain the null-vs-zero convention clearly enough that none were needed.

### `agentActivity`
- spec 2 · read at `498e4cdbcd05` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:44Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Simple fetch wrapper that calls a backend endpoint (likely /health or similar) and returns the parsed JSON as an AgentActivity object, used by the sidebar to poll whether an agent is currently active and show last-activity info.
- found: Calls Tauri's invoke('agent_activity') and on failure falls back to a default inactive AgentActivity object (active: false, empty tool/events, nonce 0) rather than throwing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Used Tauri invoke (IPC to Rust backend) rather than an HTTP fetch as I'd guessed, with a graceful error fallback to a default value.

### `pickProject`
- spec 2 · read at `819957eba1c8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:16Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Opens a native folder-picker dialog (via Tauri's dialog API) for the user to choose a project directory, then sends that path to the backend to register/open it, returning the resulting Added project info or null if the user cancels the dialog.
- found: Opens Tauri's native directory picker dialog, and if the user picked a single directory (string result), invokes the `add_project` backend command with that path and returns the Added result; returns null if cancelled.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `saveMovie`
- spec 3 · read at `36307f93f094` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:33Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Converts the Uint8Array bytes into a base64 string, then calls invoke('save_movie', { bytes: base64, suggested }) (or similarly named Tauri command), which opens a native save dialog on the Rust side, writes the file if the user picks a location, and returns the chosen path as a string. If the user cancels the dialog, the Rust side returns null and this function passes that through unchanged.
- found: Opens the native save dialog via the Tauri dialog plugin (defaulting to `suggested` path, mp4 filter); if the user cancels (non-string path) returns null; otherwise base64-encodes the bytes with the `encoded` helper from ./movie and calls invoke('save_movie', {path, data}) to have Rust write the file, then returns the chosen path.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `installCli`
- spec 2 · read at `68f2c3a4f02f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:44Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Calls invoke('install_cli') (or similar) on the Tauri backend, which creates a symlink to the sanity binary in /usr/local/bin or ~/.local/bin, and returns the resulting { path, on_path } object.
- found: Thin invoke wrapper calling the 'install_cli' Tauri backend command, returning the { path, on_path } result.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `readCurve`
- spec 2 · read at `1c6a5b2181e8` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:48Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Makes a GET request to the backend for the given project key, fetching a precomputed array of cumulative line counts (one entry per ten functions read so far), and returns it as a number[]. Returns an empty array if the project is unknown or the read is complete, per the docs.
- found: Uses Tauri's invoke('read_curve', {key}) rather than an HTTP GET as I guessed, catching any error to an empty array.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `selectProject`
- spec 3 · read at `7472e8cc6b88` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:53Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Calls a backend endpoint (invoke/fetch) with the project key to mark it as the currently selected/active project, persisting that choice server-side so a restart reopens the same project, and likely updates a local store/state to reflect the new selection.
- found: A one-line thin wrapper invoking the Tauri backend command 'select_project' with the key — no local store update happens in this function itself.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The docs handed to me actually describe forgetProject's removal-from-sidebar behavior ('Take a project out of the sidebar... re-adding it restores everything it knew'), not selectProject — only the trailing sentence about restart-persistence fits this function, so the doc block reads as mismatched/misattributed rather than describing this function.

### `reorderProjects`
- spec 3 · read at `4f15725a072b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:46Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes the Tauri command `reorder_projects` with the given keys array, awaiting the backend call to persist the new sidebar order.
- found: Thin invoke wrapper calling the Tauri command 'reorder_projects' with keys.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `forgetProject`
- spec 3 · read at `3664d593232e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:35Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls the Tauri `invoke` bridge with a command like 'forget_project' and { key }, delegating to the backend to remove the project from the index — same one-line pattern as its sibling API functions.
- found: One-line wrapper calling invoke('forget_project', { key }).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `resetProject`
- spec 3 · read at `f396fe923cf8` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:38Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A thin async wrapper that invokes the backend command `reset_project` (likely via Tauri's `invoke`) passing `key` as the project identifier argument, and returns/awaits the resulting Promise<void>.
- found: Thin wrapper calling Tauri's invoke('reset_project', { key }) and returning the Promise<void>.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `harnesses`
- spec 2 · read at `2458c1de1e62` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin async wrapper that calls the Tauri backend command (likely invoke('harnesses')) and returns the resulting array of HarnessInfo describing available agent harnesses the tool can drive.
- found: Thin wrapper invoking the Tauri 'harnesses' command, swallowing any error and returning an empty array instead.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Missed the silent-failure fallback to an empty array on error.

### `setReader`
- spec 2 · read at `65639281d69f` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:15Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin API wrapper function that sends the project key along with harness and model (which may be null) to a backend endpoint or Tauri invoke call, to record which agent/harness is reading that project. It returns a Promise<void> and likely does no other logic beyond the network/invoke call.
- found: Thin wrapper that calls Tauri's invoke('set_reader', { key, harness, model }) and returns the resulting promise.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `startCheck`
- spec 2 · read at `5e348db3d3b8` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:10:08Z · by ross@rossturk.com · warm reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin invoke() wrapper calling the 'start_check' Tauri command with key, and opts.model/readers/batch/limit each defaulted to null via ?? when undefined, returning the backend's { ok, error?, hint?, harness? } response directly.
- found: Exactly as predicted: invoke('start_check', {...}) with each optional field defaulted to null.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Already read this exact function verbatim in the prior api.ts file task, so this was recall, not prediction — reporting cold:false.

### `stopScan`
- spec 3 · read at `460200c485de` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin frontend wrapper that invokes a Tauri command (e.g. invoke("stop_scan")) to signal the backend to stop the running scan, with no arguments, returning a promise that resolves once the command completes.
- found: Calls invoke('stop_scan') with no args, returning the Promise<void>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `stopCheck`
- spec 3 · read at `8ff5e7dff082` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:28Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin IPC wrapper calling Tauri's invoke('stop_check', { key }) (or similarly named backend command) to tell the Rust backend to halt an in-progress agent "check"/read run for the given project key, returning a promise that resolves when the backend acknowledges.
- found: Exactly as predicted: a one-line Tauri invoke wrapper calling the 'stop_check' backend command with the project key.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `readable`
- spec 2 · read at `d8ec7b19b2c0` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:18Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes a ProjectSummary and returns a single number representing total readable units — summing something like p.functions + p.files (or their respective counts), consolidating the "total to read" calculation so it isn't duplicated across call sites.
- found: Returns p.functions + p.files, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `stopTrace`
- spec 3 · read at `f040b070dc9b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:43Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin frontend wrapper invoking the Tauri stop_trace command with the repo path, awaiting the result and returning the boolean indicating whether the running trace was successfully stopped.
- found: Exactly as predicted: a thin wrapper calling invoke('stop_trace', { path }) and returning the Promise<boolean>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `estimateTrace`
- spec 3 · read at `b7fd2560710b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:47Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper that calls Tauri's invoke("estimate_trace", { path }) and returns the resulting TraceCost promise, mirroring the Rust `estimate` function.
- found: Thin Tauri invoke wrapper: invoke('estimate_trace', { path }) returning Promise<TraceCost>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `explainTrace`
- spec 3 · read at `a77324d6dcda` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:48Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin frontend wrapper that invokes the Tauri backend command "explain_trace" and returns the resulting boolean promise, mirroring the Rust explain_trace function.
- found: Exactly as predicted: a one-line invoke() wrapper calling the 'explain_trace' Tauri command.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `setExplainTrace`
- spec 3 · read at `3baa2870cb8b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:52Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin Tauri IPC wrapper: calls invoke("set_explain_trace", { explain }) and returns the resulting promise, toggling a backend flag controlling whether explain/trace output is produced by subsequent calls.
- found: Thin Tauri IPC wrapper: invoke('set_explain_trace', { explain }).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `listProjects`
- spec 2 · read at `352ee0c679ef` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:18Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin async wrapper that calls the backend (via Tauri invoke or an HTTP fetch to the loopback API) to fetch the current ProjectList — the set of projects sanity is holding plus which one is active/selected — and returns the parsed JSON result.
- found: Thin wrapper calling Tauri's invoke('projects') and returning the resulting ProjectList promise.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `repoRemote`
- spec 3 · read at `21e0142657a1` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:18Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A thin frontend wrapper that calls into a backend command (likely Tauri's invoke) named "repo_remote" with the given path, awaits the result, and returns it as a string or null, possibly catching errors to return null.
- found: A thin wrapper calling Tauri's invoke('repo_remote', {path}) and catching any error to return null instead of throwing.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `readSource`
- spec 2 · read at `47b1b31b57df` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:20Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls Tauri's invoke("read_source", { repo, relPath }) and returns the resulting Promise<string>, delegating the actual path-containment check to the Rust side.
- found: Thin wrapper calling Tauri invoke('read_source', { repo, relPath }) returning Promise<string>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `openCodeWindow`
- spec 2 · read at `4031a63c7534` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:23Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper calling Tauri's invoke with a command like 'open_code_window', passing repo and relPath, to open a new native window displaying that file's source. Returns the invoke promise directly.
- found: Thin wrapper calling invoke('open_code_window', { repo, relPath }).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `fileFunctions`
- spec 3 · read at `1870df3e44bb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Makes a single batched API call (not one per file) passing the project key and the list of paths, asking the backend to return the parsed function nodes for each file. Parses the JSON response into a Map keyed by path, with Node[] values, defaulting to empty arrays for any path not returned by the backend since paths absent from the tree are simply missing from the response.
- found: Single tauri `invoke('file_functions', {key, paths})` call returning a Record<path, WireNode[]>, converted into a Map with each WireNode mapped through toNode() to produce Node[].
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `searchProject`
- spec 3 · read at `5c0afd87bbd9` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:26Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper calling invoke<Hit[]>('search_project', { key, query, limit }) and returning the resulting Promise, delegating to the Rust `search::find` backend described in the docs.
- found: Thin wrapper: invoke<Hit[]>('search_project', { key, query, limit }).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `functionLinks` — QUIRKY
- spec 3 · read at `d53379c5dcfc` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:29:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: An async client-side API wrapper that calls a backend endpoint (e.g. GET /api/function-links or similar) passing key, path, and line as query params, parses the JSON response into a `Related` object, and returns null if the server responds with no data (e.g. 404) or an equivalent "not found" signal, rather than throwing.
- found: Thin wrapper delegating to a generic `invoke` helper (Tauri IPC, not HTTP) with command name 'function_links' and the three params, returning Related or null straight through.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: This is a Tauri desktop app — `invoke` is IPC to a Rust backend, not fetch/HTTP; the file name api.ts is misleading if you assume web REST calls.

### `functionForks`
- spec 3 · read at `9a2dcc2a97a0` · commit `27654c8` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:36:51Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A thin async wrapper that invokes the Tauri `function_forks` backend command with the project key, file path, and line number, returning the parsed Forks result (or null when the language has no branch table or the function has moved/vanished since the scan) — mirroring the other one-line invoke wrappers in this file like fileFunctions and functionSources.
- found: One-line Tauri invoke wrapper for the `function_forks` command, taking project key/path/line and returning the parsed Forks or null.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `functionSources`
- spec 3 · read at `06c9dd1bd95c` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:30Z · by ross@rossturk.com · warm reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper delegating to `invoke('function_sources', { key, spans })` (Tauri IPC to the Rust backend), returning the array of Snippet|null positionally matching the input spans, per the docs' description of batching reads into one call.
- found: Thin invoke() wrapper for the 'function_sources' Tauri command, passing key and spans straight through.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Predicted correctly this time only because a prior task in this same run (functionLinks) already established the invoke() wrapper pattern for this file — not purely cold knowledge.

### `commitDetail`
- spec 3 · read at `f70b37de3c2e` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:30Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line wrapper that calls `invoke('commit_detail', { key, sha })` (Tauri IPC) and returns the result directly, since validation and the null-for-not-found logic already live in the Rust command.
- found: One-line Tauri invoke wrapper: `return invoke('commit_detail', { key, sha })`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `functionHistory`
- spec 3 · read at `f020bba0f71f` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:37Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (e.g. "function_history") with path, start, and end line numbers (and key for caching/identification), awaiting the result and returning it as a LineHistory, or catching an error and returning null.
- found: Invokes the Tauri 'function_history' command with key/path/start/end, and maps the snake_case `file_first` field to camelCase `fileFirst` on the returned object (or passes through null); no try/catch, so errors propagate rather than being swallowed.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `projectScan`
- spec 2 · read at `0736de93c985` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:24Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri invoke wrapper calling something like 'project_scan' with the key, returning the Scan result or null if the backend has no scan for that project yet.
- found: Invokes the Tauri 'project_scan' command with the key, getting back a WireScan or null, and converts the wire type to the app's Scan type via toScan() before returning (or passes through null).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I missed the wire-type-to-domain-type conversion step (toScan), predicting a plain passthrough.

### `isReportStale`
- spec 2 · read at `fa05e056065b` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:26Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Compares some fingerprint stored on the AgentReport (e.g. a hash of the source, or line span/loc) against the current node's corresponding value, returning true if they differ — meaning the code has changed since the report was recorded, mirroring the Rust assessment::is_stale logic.
- found: Returns false if either the report or node lacks a `body`; otherwise compares the report's stored body text directly against the node's current body text and returns true if they differ.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `legibleOf`
- spec 3 · read at `5525a4eb829b` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:07Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns r?.legible, but first checks whether the report is stale (e.g. via isReportStale or comparing a version/ask field) — if the grading question has since changed, it returns undefined instead of the stored value so stale grades don't get treated as current.
- found: Guards against a dated (stale) legible grade by checking the r.legibleDated flag directly rather than calling a separate staleness helper, returning undefined in that case, otherwise the stored grade.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `trapOf`
- spec 3 · read at `794c438640c3` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:50:35Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: trapOf(r) returns whether the report has trap=true AND its spec is current (not dated) — a small accessor gating r.trap on r.trapDated/spec currency so a stale reading's trap answer no longer counts, returning false for undefined/dated reports.
- found: !!r?.trap && !r.trapDated — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `reportGrades`
- spec 2 · read at `340334c0f8d1` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:37Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Converts an AgentReport's categorical grades (predicted, documented, derivable, and legacy surprised) into numeric scores. For legacy reports lacking the new fields, maps the boolean surprised to the two extremes of the surprise scale. Enforces that when derivable is true, the returned documented value is forced to null/0 regardless of the recorded documented string.
- found: Exactly as predicted: maps legacy surprised bool to predicted grade, forces documented to 'none' when derivable is true, then looks both up in numeric grade tables.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `readingWords`
- spec 2 · read at `efb363b3ad5a` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:23Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns null if the node has no fresh agent reading (no `node.agent`, or `node.agentStale` is true, or the reading isn't reader-sourced); otherwise calls `reportGrades`/similar to get the reader's surprise and documented grades and maps them through word tables (like `HEAT_WORDS`/`DOC_WORDS` seen in `Dials`) into `{ heat, documented }`, with `documented` null if the reader didn't grade docs.
- found: Returns null unless the node is a function with a fresh (non-stale) agent reading. Otherwise derives the predicted grade (falling back from surprised boolean), maps it through HEAT_WORDS, and computes documented as DOC_WORDS.none if the reader marked the doc derivable, else the reader's documented grade mapped through DOC_WORDS, else null.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `agentReports`
- spec 2 · read at `e7c66ce4c92d` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:27Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls invoke('agent_reports', { key }) (or similar snake_case command) and returns a Promise<AgentReport[]>, passing the project key through to the Rust backend so it looks up reports for that specific project rather than a globally-tracked "current" project.
- found: Thin wrapper calling invoke('agent_reports', { key }) returning Promise<AgentReport[]>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `readInto` — QUIRKY
- spec 3 · read at `0f982de8c428` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:59Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns node unchanged if r is undefined or has no derivable score. Otherwise maps r.predicted to a binary extreme (full/most vs some/none) rather than a graded probability, and returns a new Node with that reading (score/temperature plus grade metadata) folded in, likely using helper peers like legibleOf/trapOf/reportGrades to attach the rest of the report's fields.
- found: Returns node unchanged if no report or no existing score. If the report is stale (code changed since reading), attaches the report but falls back to node.proxyScore for the actual score, marking agentStale true. Otherwise attaches the report, saves the old score as proxyScore, and merges in surprise (and documented, only if the reader graded it) from reportGrades(r), with source: 'agent' and analyzedShare: 1.
- predicted: some · documented: full · derivable: no · legible: most · trap: no

### `readIntoRing`
- spec 3 · read at `02985bf0b25d` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Maps over the ring's nodes, using readInto (or similar) to merge in each node's matching entry from byId when present, and preserves array identity when nothing in the ring changed (no node has a report in byId) — returning the same array reference in that case rather than a new one, and a new array only when at least one node was updated, so downstream memoization keyed on reference equality skips unaffected rings.
- found: Maps ring nodes through readInto(n, byId.get(n.id)), tracks whether any node reference changed, and returns the original ring array unchanged if nothing moved, else the new mapped array — exactly as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `applyAgentReports` — QUIRKY — TANGLED
- spec 3 · read at `86ba55659d48` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes the scanned repo tree (root) and a batch of AgentReport objects (grading data from sanity_report), and returns a new tree with each report's data merged onto the node whose id matches the report — likely building an id→node index first, then immutably reconstructing the tree with updated grading fields (predicted/documented/legible/trap etc.) on matched nodes.
- found: Merges AgentReport data onto a Node tree: builds an id-indexed map plus a path-grouped map of reports for functions no longer present (loc:0 orphans dropped) so a file can still show pending readings for children it wasn't sent. Recursively visits the tree bottom-up, folding children via reaggregate only when something changed, and separately attaches a file's own header reading (with staleness check) without letting it affect the rolled-up score.
- predicted: some · documented: none · derivable: no · legible: some · trap: no

### `countPending`
- spec 2 · read at `ed6f00b2ea70` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:30Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree from `root`, incrementing a `stale` counter for func nodes whose reading is stale and an `unread` counter for func nodes with no reading at all (unanalyzed), skipping functions a .sanityignore excluded so it stays scoped identically to `summarize`. Uses simple counters with no array allocation or sorting, returning { stale, unread } directly.
- found: Recursively walks the tree propagating an outOfScope flag (once excluded, always excluded down the subtree), counting func nodes as stale (agentStale) or unread (no agent reading) while skipping excluded ones; returns plain counters, no arrays.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `summarize` — QUIRKY — TANGLED
- spec 3 · read at `be62f90d6cce` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:59Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks the Node tree once and produces a RepoSummary combining basic repo stats (total functions/files/loc) with reading-progress stats derived via the peer helpers — countPending, reportGrades, legibleOf, trapOf, readingWords, isReportStale — tallying how many functions have been assessed, their grade breakdowns, and how many readings are stale or pending.
- found: Walks the tree accumulating counts (functions, excluded, read/stale/unread, grade spread, legible spread, traps), treating a file's unfetched-children `funcs` count and any `pending` readings it carries as standing in for children whose ring hasn't loaded, and separately tallying func-kind nodes' own `agent`/`agentStale` readings — propagating out-of-scope/excluded status down subtrees. It also collects and sorts (by temperature then loc) a `hot` list and per-grade `byGrade` lists of nodes, and derives `unread` as functions minus read minus stale so the three always sum to the total.
- predicted: some · documented: none · derivable: no · legible: some · trap: no

### `scanRepo`
- spec 2 · read at `252492de7a28` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: An async thin wrapper that invokes a Tauri command like 'scan_repo' with the given path and awaits/returns the resulting Scan object describing the repo's structure or functions found.
- found: Invokes 'scan_repo' with { req: { path } }, getting a WireScan, then converts it via toScan() into the app-level Scan type before returning.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `toScan`
- spec 3 · read at `5a9ad3426d12` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:55Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Converts a raw wire-format WireScan (as received from the backend, likely with different field names/types, e.g. snake_case fields or serialized timestamps) into the app's internal Scan type, mapping/renaming fields and parsing dates or numbers as needed.
- found: Maps a WireScan (snake_case backend fields) into the internal Scan type: converts root via toNode, and remaps stats fields to camelCase with defaults for fields an older/pre-ladder backend might omit (churnWindows, churned, tangleBands, authors, commits), pulling tangle bands out of a nested {median, over} object.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The comment on churnWindows/churned defaults explains a non-obvious backward-compatibility intent (absence means 'not measured, full ladder' rather than zero) that isn't derivable from the code alone.

### `onScanScore`
- spec 2 · read at `64991aedf868` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:27Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri backend event (likely named "scan-score" or similar) via listen(), invoking cb with the event payload's id and Upgrade data as each per-function reading streams in during a scan; returns an unlisten function to unsubscribe, mirroring the pattern of onScanProgress.
- found: Listens for Tauri "scan-score" event with payload {id, surprise, hotspots}, reshapes it into an Upgrade object {surprise, hotspots}, and calls cb(id, upgrade); returns a function that unlistens once the listen promise resolves.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Got the shape right but didn't predict the exact event name or the surprise/hotspots field reshaping into Upgrade.

### `applyScores`
- spec 2 · read at `81d9f5c34a2f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree recursively; for each leaf node whose id/path is a key in `scores`, clones it and applies the Upgrade (score/hot fields). For internal nodes, recurses into children, and if any child changed, clones the node and recomputes its aggregate fields (LOC-weighted mean score, hot share over analyzed lines) from the (possibly updated) children — mirroring Node::aggregate in Rust. Nodes with no changed descendants are returned unchanged (shared, not cloned), and the function returns the new root.
- found: Recursively visits the tree; for leaves present in the scores map, clones the node and patches only the `surprise` field of its score (plus hotspots, source, analyzedShare), leaving age/churn/doc fields untouched. For internal nodes, recurses and reaggregates via `reaggregate` only if a child actually changed, otherwise returns the same node reference for React reconciliation.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I expected the whole score object to be replaced by the Upgrade; actually only `surprise` (plus hotspots/source/analyzedShare) is patched, with churn/age/doc coverage explicitly preserved as historical/code properties.

### `reaggregate` — QUIRKY — TANGLED
- spec 3 · read at `ca0e7e0c0def` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:28Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recomputes a parent node's rolled-up score fields (loc, churn, surprise/hot share, etc.) as a weighted combination of the given children's scores, mirroring the same arithmetic as the Rust `Node::aggregate`, and returns a new (or mutated) node with those fields updated and `children` set to the given array — used client-side when new scan results for a subset of children arrive incrementally and the ancestor totals need to be refreshed without re-walking the whole tree from Rust.
- found: Got the weighted-rollup structure and mirroring-Rust intent right, but missed many specifics: commits/allCommits are carried through unchanged rather than recomputed (a directory can't sum children's commit counts without double-counting), source tracks the 'strongest instrument' used (agent > model > proxy) rather than being fixed, age takes the max while lastTouchedDays takes the min, hotShare/analyzedShare are computed differently for func vs non-func children, and tangle is weighted only over children that have a tangle value.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `stopHistory`
- spec 3 · read at `6057a674c87c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:48Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper around Tauri's invoke() that calls the "stop_history" Rust command and returns the resulting promise, with no extra logic on the frontend side.
- found: Thin invoke() wrapper calling the 'stop_history' Tauri command.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onScanProgress`
- spec 3 · read at `8d628373cc95` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:37Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri backend event (something like "scan-progress") via listen(), invoking cb with the event payload's project and Progress fields whenever it fires, and returns an unsubscribe function that calls the listener's unlisten.
- found: Subscribes to Tauri's 'scan-progress' event via listen(), destructuring project/progress off the payload into cb; returns a synchronous unsubscribe closure that awaits the listen promise then calls the resulting unlisten function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onSetTheme`
- spec 2 · read at `cf820892bc70` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:35Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Registers a Tauri event listener (e.g. 'set-theme' emitted from the Rust menu handler when the user picks a View → Appearance item) that calls cb with the new theme string, and returns an unsubscribe function that removes the listener.
- found: Listens for the Tauri 'set-theme' event and calls cb with the event payload; returns a cleanup closure that resolves the listen promise and calls the unlisten function.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `onOpenProject`
- spec 2 · read at `09397a88134b` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:36Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri menu event (something like 'menu-open-project' or 'open-project') via listen(), invoking cb() when it fires, and returns an unsubscribe function that tears down the listener — likely handling the fact that listen() returns a Promise<UnlistenFn> by wrapping it in a synchronous callback.
- found: Subscribes to Tauri 'open-project' event via listen(), calling cb() on fire, returns an unsubscribe fn that resolves the listen promise and calls the resulting unlisten function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `cliStatus`
- spec 2 · read at `31d26e37e056` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:53Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Calls the Tauri backend (via invoke) to check whether the CLI tool is installed/available on the system, returning a Promise resolving to a CliState object describing its install status (e.g. installed, path, version).
- found: Invokes the Tauri 'cli_status' command and returns its CliState; on failure, catches and resolves to a default "not linked" state (linked: false, path: null, on_path: false, resolved: null, is_this_app: false) instead of rejecting.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `onInstallCli`
- spec 2 · read at `cb552cac5719` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:39Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Registers cb as a listener for the Tauri menu event fired when the user clicks "Sanity → Install Command Line Tool…", likely via listen('menu://install-cli', cb) or similar, and returns the unlisten/unsubscribe function so the caller can clean up.
- found: Calls listen('install-cli', () => cb()) and returns a synchronous closure that resolves the listen promise and calls the returned unlisten function — same shape as predicted, missed the promise-wrapping detail in the return.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `syncThemeMenu`
- spec 2 · read at `6746257ef32c` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri command (e.g. 'sync_theme_menu') passing the theme string, telling the native menu to update its checked/ticked state on the matching appearance item so it reflects the actual current theme rather than defaulting to System.
- found: Invokes 'sync_theme_menu' with { theme } and silently swallows any error via .catch(() => {}).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `temperature` — QUIRKY
- spec 2 · read at `d5e606c9b5ce` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:46Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Given a Score (or null, returning some baseline like 0), maps the score's `predicted` grade to a numeric surprise value — e.g. full=0, most/some/none scaling up — used to color the wedge visualization. The doc note implies it used to also factor in `documented`/derivable but now returns just the raw surprise from `predicted` alone, without any discount multiplier.
- found: Returns 0 for a null score; otherwise just clamps the score's already-computed `surprise` field to [0,1]. No grade-mapping arithmetic happens here — that lives elsewhere and this function is just the clamp/gate.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I assumed this function derived the surprise value from the predicted/documented grades itself; it actually just clamps a precomputed `s.surprise` field, so the real computation lives elsewhere.

### `wedgeHeat`
- spec 2 · read at `8d7a802b49e3` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Branches on whether node is a function (kind === 'Func' or similar): if so returns node.score.temperature, otherwise (file/dir/overflow) returns node.score.hot_share — the value that should color this wedge, per the doc's distinction between a single body's temperature and a collection's hot share.
- found: Returns 0 if the node has no score; otherwise delegates to a showsShare(node) helper to decide between node.score.hotShare (collections) and temperature(node.score) (single function), matching the doc's collection-vs-body distinction.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `shareRamp`
- spec 2 · read at `7f443945c094` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:48Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Takes a share fraction (0..1, e.g. hot_share) and remaps it through a nonlinear curve (like a sqrt or power curve) before it's used for visual purposes such as ring/wedge sizing or color intensity, so that the perceptual weighting of area or color doesn't scale linearly with the raw share value. Returns the transformed number, still roughly in 0..1 range.
- found: Clamps share to [0,1], divides by a SHARE_BAND constant (compressing the range considered before the ramp maxes out), then raises to SHARE_SKEW power — a nonlinear remap for visual intensity, not a plain sqrt as I'd guessed.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Correctly guessed a power-curve remap for perceptual weighting but missed the SHARE_BAND rescaling before exponentiation.

### `paintHeat` — QUIRKY
- spec 2 · read at `656341ed88cd` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:50Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Computes the color-paint value for a node by taking its raw heat/share from wedgeHeat(node) and remapping it through the ramp's own scale (likely via shareRamp), returning a number used to position the color on the gradient rather than the raw reported percentage.
- found: Returns 0 if no score; otherwise branches on showsShare(node) — if true, maps node.score.hotShare through shareRamp; otherwise uses temperature(node.score). Not wedgeHeat at all, contrary to my guess.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `isAnalyzed`
- spec 2 · read at `3e00264afba3` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:26Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Checks node.score and returns true only if the score's source/provenance field indicates a real model reading (not the 'proxy'/offline-heuristic source seen in scoreInto earlier) — distinguishing "actually looked at" from "guessed via the offline proxy," so proxy-scored nodes are treated as unanalyzed (gray) rather than colored.
- found: Returns false if no score. For container nodes (showsShare true) checks analyzedShare > 0; for leaf nodes checks score.source is 'model' or 'agent' (excluding 'proxy').
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `heatColor`
- spec 2 · read at `1cb793b31e21` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes a normalized value t (likely 0-1) and a ramp name, locates which of the five CSS custom-property stops t falls between (using a helper like rampStop or rampAt), and returns a CSS color-mix() or var() expression blending the two adjacent stops proportionally, so the actual colors stay defined in index.css.
- found: Uses rampAt to get the bracketing stop indices and fractional position, then returns a CSS color-mix(in oklch, ...) expression blending the two adjacent var() stops by that fraction as a percentage.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `rampStop`
- spec 2 · read at `9284629ce7d1` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:50Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Takes a fraction t (0-1) along the given ramp and computes which discrete color stop it's nearest to by rounding t against the ramp's stop count, then returns that stop as a CSS custom-property name string like --heat-3.
- found: Delegates to rampAt(t, ramp) to get stops array, index i, and fraction f, then returns stops[i] or stops[i+1] depending on whether f rounds down or up — same "nearest stop" idea I predicted, but the interpolation logic lives in rampAt rather than here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `rampAt`
- spec 2 · read at `2e632ef3d0ea` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a normalized position t (0-1) and a Ramp (array of color stops), finds the two stops bracketing t, and linearly interpolates between them to return an interpolated color value, for use by a heat/color ramp rendering system.
- found: Builds an array of 5 CSS custom-property names from the ramp name (e.g. --{ramp}-0..4), computes a clamped fractional index x into that array, and returns {stops, i, f} — the bracketing stop names and interpolation fraction — leaving the actual color computation/interpolation to the caller (likely via CSS variables).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected it to return an interpolated color value directly; instead it returns CSS variable names plus index/fraction for the caller to interpolate, and Ramp turned out to be a string name rather than an array of stops.

## web/src/lib/cn.ts

### the file itself — QUIRKY
- spec 2 · read at `82b9285f7d8d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Standard "cn" classname utility: a thin wrapper around clsx (join/filter conditional className strings), likely export function cn(...inputs) { return clsx(inputs) } or a direct re-export of clsx as cn. No tailwind-merge given the file is only 3 lines.
- found: Defines its own tiny clsx-like function (not importing the npm package) that filters falsy parts and joins the rest with spaces — a homegrown minimal classnames joiner.
- predicted: some · documented: none · derivable: yes · legible: not judged · trap: no
- note: The "peer" named clsx was this file's own local function, not the npm library I assumed it wrapped.

### `clsx`
- spec 2 · read at `e8933499c48d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:26Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Filters out falsy entries (false/null/undefined) from the variadic parts array and joins the remaining strings with a space, giving a minimal reimplementation of clsx for conditional className composition.
- found: One-liner: filters falsy parts and joins the rest with a space.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/colorMode.ts

### the file itself
- spec 3 · served in 5 parts · read at `fa955ff39f99` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:27:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file is the core "color mode" engine for a code-visualization tool (a treemap/map of a repository): it computes what color/paint each node (file, function, directory) gets under various lenses — age, churn, blame/author, language, tangle, docs coverage, legibility, surprise, traps, clones — and the shape is a large collection of small pure helpers (ramps, band/label functions, share calculators, rank utilities) plus a few heavier aggregation functions (contribute/contributeCols/contributeHeld, bucketsFor, histogramsFor, legendFor) that roll per-node data up into directory-level distributions and legends. It has no file-level doc header, so the "why" lives in scattered function-level comments rather than a shared design note.
- found: A large no-header module implementing the "lens" system for a repo-visualization sunburst/treemap: ColorMode type and per-mode metadata (labels, hints, ramps, replay eligibility), colorFor (per-node paint under a mode, including replay flash events), the categorical author/language palette with rank-based slot assignment and capping, band tables for callers/reach/clones/churn/age/tangle, and the aggregation trio contribute/contributeCols/contributeHeld feeding both bucketsFor (panel breakdown) and histogramsFor (per-directory rim distributions), plus legendFor for the categorical legend ranking.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `replayNote`
- spec 3 · read at `e4a707db5280` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:31Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a ColorMode and returns a short explanatory string only for the mode representing "replay" (or when the mode is derived from a parse rather than a reading), explaining why colors are unavailable — something like "recomputed per commit" — and returns null for all other modes.
- found: Returns null if REPLAY[mode] is 'live' (meaning the mode replays fine), otherwise returns a message using MODE_LABEL saying the mode isn't replayed because it would need recomputation at every commit and the timeline doesn't carry it.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The historical reasoning in the docstring (why it went from two sentences to one, shard folding) isn't visible in the code — it's institutional memory only preserved in the comment.

### `paintsFromReadings`
- spec 2 · read at `09004cfe8323` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns true if the given ColorMode is one derived from a reader's report (e.g. surprise/predicted, legibility, documentation) rather than from git history or static parse data. Likely implemented as a small array/set membership check or an equality chain against the reading-based mode names.
- found: Returns true if mode is one of 'surprise', 'legible', 'docs', or 'traps' — the four reading-derived color lenses, as opposed to git- or parse-derived ones.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted 3 of the 4 modes correctly (guessed 'legibility' instead of 'legible') but missed 'traps' as a fourth reading-derived lens.

### `paintsFromWiring`
- spec 3 · read at `816c459c7f97` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:53:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A tiny predicate that returns true if `mode` is one of the call-graph-derived modes ('callers', 'reach', maybe 'clones'), checked via equality/inclusion against a small set of ColorMode values — used elsewhere to decide whether a gray wedge means "this language's call shape was never parsed" rather than "nobody has read this".
- found: Returns true only for 'callers' or 'reach' — the two call-graph-derived color modes; clones is not included.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I hedged by including 'clones' as a maybe, but it's not part of the wiring set — clones apparently has its own gray-means-something-else story.

### `bandOf`
- spec 3 · read at `01d8530090da` · commit `758c706` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:04:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns bands.find(b => n >= b.min), relying on bands being sorted descending by min so the first band whose threshold n meets or exceeds is the correct (highest applicable) one. No fallback/default handling since docs say it's never called with an unresolved value.
- found: Returns the first band whose min the value n meets or exceeds (relying on descending sort order), falling back to the last band in the array if none match.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I missed the fallback-to-last-band clause (?? bands[bands.length - 1]), which the docs don't call out either.

### `calledShare`
- spec 3 · read at `b789829a7561` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:10Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Reads precomputed roll-up counts off the node (how many resolvable functions underneath it, and how many of those are called/referenced) and returns called / resolvable, returning null when the resolvable count is zero. Likely mirrors wiringShare/hotShare in reading fields directly off the node rather than recursing.
- found: Reads node.resolvable and node.orphans; returns null if either is missing or resolvable is 0; otherwise returns 1 - orphans/resolvable, i.e. the share of resolvable functions that ARE called.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `reachingShare` — QUIRKY
- spec 3 · read at `a10f7a376d07` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:10Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks the leaf functions under this node, counts how many have a resolvable "away"/fan-out count greater than zero (i.e. call something else in the repo) versus how many have any resolvable away count at all, and returns the ratio reaching/total. Returns null if there are no functions with resolvable data underneath (e.g. an empty or all-unresolvable subtree).
- found: Uses precomputed rollup fields on the node (resolvable and sinks) rather than walking children; returns null if resolvable is null/0, otherwise 1 - sinks/resolvable — the share of resolvable functions that are NOT sinks (i.e. reach out to something).
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `rampEnds`
- spec 3 · read at `19b9f2764a59` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:26:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Switches on ColorMode to return a tuple of legend endpoint labels for an age-based ramp: something like ["old","recent"] for a "touched" mode and ["old","new"] for a "born" mode, per the doc comment distinguishing the two lenses. Returns undefined for non-ramp color modes (e.g. author-based) where no gradient legend applies. Likely doesn't need much from `views` beyond checking whether the mode has ramp data to show.
- found: Returns a fallback lookup (RAMP_ENDS[mode]) for most modes, but special-cases 'age' mode: depending on views.age.read being 'oldest' or not, returns ['long-standing','new'] or ['old','recent'] — the two different labelings for the same ramp direction the docs describe.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's 'touched' vs 'born' terminology maps to views.age.read values ('oldest' vs otherwise) but the code doesn't use those words, so the mapping isn't obvious without the doc.

### `rampOf`
- spec 3 · read at `e786fc27f56a` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:47:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A simple lookup/switch mapping a ColorMode value (e.g. "age", "author", "calls", "reach") to its corresponding Ramp object — likely a small switch statement or object literal indexing into predefined ramps, mirroring the same mapping used for wedge coloring elsewhere in the file.
- found: A one-line lookup into a RAMP_OF table/object keyed by ColorMode, returning the associated Ramp.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `modeToken`
- spec 3 · read at `4520f42ae293` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:26Z · by ross@rossturk.com · warm reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns the custom-property name representing one ColorMode's swatch color: hard-coded tokens for traps/clones/callers/reach and the two categorical lenses (blame/language, which get their own dedicated --lens-blame/--lens-language tokens since they have no ramp), and otherwise falls back to stop 3 of that mode's ramp via rampOf.
- found: Returns the custom-property name for a lens's representative swatch color: fixed tokens for traps/clones/callers/reach and dedicated --lens-blame/--lens-language for the two categorical lenses, otherwise stop 3 of the mode's ramp.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no
- note: Already seen this exact function while reading the whole colorMode.ts file at item 3, so this is a warm recall rather than a genuine cold prediction.

### `isAuthor`
- spec 2 · read at `9578a38649cd` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:36Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Type guard returning true when key is a non-null string that represents a genuine git author, filtering out sentinel values like "Not Committed Yet" or similar git-internal placeholders that aren't real people, since those get treated as neutral/unanalyzed rather than attributed.
- found: Type guard: true when key is non-null and not equal to the UNCOMMITTED sentinel constant, narrowing to string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `slotColor`
- spec 3 · read at `dd396195ba49` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:47:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Maps a numeric rank to a palette color string: ranks within the named palette size get their own unique color, while ranks beyond it wrap around (via modulo) into the recycled "unnamed" color slots so overflow entries share colors rather than all becoming one flat "other" color.
- found: Ranks under the full CATEGORICAL palette length get their own unique color; ranks beyond that wrap via modulo into only the recycled tail (the slots after the NAMED ones), so overflow entries share colors from the unnamed portion rather than the whole palette.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `shared`
- spec 3 · read at `ec88e88ee374` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:43Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns true if this rank's assigned color slot is also used by another rank, most likely because the palette size is smaller than the number of ranks so colors wrap around (e.g. rank modulo paletteSize causes reuse); used to decide whether the legend should mark this entry as sharing a color.
- found: Returns true if rank is beyond the categorical palette length, meaning its color slot wraps around and is shared with an earlier rank.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `capRanks`
- spec 3 · read at `c4ba8c2968fe` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:48:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Given a name->rank map and a cap count, returns a new map containing only the entries whose rank is below `cap` (the top `cap` ranked entries), dropping the rest so downstream code that already treats a missing key as "other" handles the cap for free. If `ranks` is undefined it returns undefined, and if `cap` is Infinity/covers everything it likely returns the ranks unchanged (or a copy).
- found: Returns ranks unchanged if undefined, cap is non-finite (Infinity), or the map already fits within cap; otherwise builds a new map keeping only entries with rank < cap, dropping the rest to fall into 'other' downstream.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `flash`
- spec 3 · read at `1cd1abae062e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:17Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: flash(token, label) returns a Paint object built directly from the token color as-is, with no blending/decay/mixing math (since 'flat' replaced the earlier decaying-mix approaches per the doc), plus the label field attached — likely something like { fg: token, bg: token, label } or similarly using the token verbatim.
- found: Returns a Paint using the token verbatim as a CSS var for fill, keeps the raw token as stop, computes a contrasting ink color via inkOn(token), and attaches the label — confirming the 'flat, no mixing' design the doc describes.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `flashPaint`
- spec 3 · read at `b2f01c7f93bb` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:08Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper that calls the peer `flash(kind)` function to get the birth/touch color, and returns it packaged with a `label` field (something like "birth" or "touch") describing the escalated event — same color as flash(), not diluted, per the docs.
- found: Delegates to the peer `flash` helper, mapping 'birth' to the '--birth' CSS var with label 'new', and 'touch' to '--touch' with label 'changed'.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc explains why this exists (escalated wedge display) but not derivable from code that this is specifically for the case where the function/file itself isn't drawn.

### `ramped`
- spec 2 · read at `179de516bc35` · commit `9ea3e1f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:04:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Looks up the given ramp's stops, finds the stop nearest to v (clamped/quantized), computes the fill hex for that stop, and calls inkOn(fill) to get the readable ink color, returning {fill, stop, ink} as a Paint object so callers can't use one without the other.
- found: Delegates to rampStop(v, ramp) for the stop and heatColor(v, ramp) for the fill separately (both computed from v/ramp directly rather than fill being derived from stop), and inkOn(stop) takes the stop rather than the fill hex — my prediction had the right shape (bundling fill+stop+ink) but wrong data flow between the three helper calls.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I assumed ink was computed from the fill color's luminance directly; instead inkOn takes the stop, meaning ink readability is decided per ramp-stop rather than per exact fill hex.

### `ageSpanOf`
- spec 2 · read at `91acacf4eb3c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:32:54Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line accessor that returns root.ageDays directly (already aggregated as the max over children elsewhere), with no floor or minimum clamp applied, per the docs' explicit rejection of a floor.
- found: Returns Math.max(root.score?.ageDays ?? 0, 0) — reads ageDays off the root's score object (optional), defaulting to 0, clamped non-negative. I predicted a bare accessor with literally no floor, but there is a 0-floor via Math.max, and the field is nested under `.score` rather than directly on the node.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ageOf`
- spec 3 · read at `690284f2e7c5` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:55:05Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Pulls an age-in-days number out of the Score object based on which AgeRead variant is requested (e.g. distinguishing file age vs authored/touched age), returning null when that particular score node doesn't carry that reading.
- found: A two-way switch: 'oldest' reads s.ageDays, anything else reads s.lastTouchedDays — no null branch actually appears since Score fields presumably can themselves be null/number.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `ageLabel` — QUIRKY
- spec 3 · read at `6265cb631558` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:52:13Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Given a day count `d` and which reading mode is active (`read: AgeRead`), this returns a human-readable label string for a tooltip/wedge — something like "last touched {d}d ago" for one reading and "oldest line still standing: {d}d" (never "first seen") for the other, pluralizing/formatting the day count appropriately.
- found: Formats a day count as 'today' or '{n}d ago', then prefixes it with 'oldest line' or 'newest line' depending on the AgeRead mode — simpler than I guessed (no "last touched"/"first seen" wording, just oldest vs newest line).
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `ageBandNoun` — OBSCURE
- spec 3 · read at `7489ddb0d4e1` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:55:09Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Takes an AgeRead (presumably containing an age in days), walks the AGE_BANDS boundary list to find which band the age falls into, and returns that band's noun/label string (e.g. "week", "month", "quarter", "year").
- found: Simple ternary: AgeRead is 'oldest' or something else, mapping to 'oldest line' or 'newest line' strings, not a numeric age-band lookup at all.
- predicted: none · documented: some · derivable: no · legible: full · trap: no
- note: AgeRead is a two-value enum ('oldest'/'newest'), unrelated to the AGE_BANDS numeric boundaries the docs reference — the doc comment describing 'the same list of boundaries read two ways' misled me toward a band-lookup implementation.

### `ageRamp`
- spec 2 · read at `8d335d901c03` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:08Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A function that normalizes `days` (age of a node) against `span` (the repo's own oldest-to-newest range) to produce a 0–1 ramp value, using a logarithmic scale within that span so the oldest thing in the repo lands at the cold end and small differences among old items compress while young items separate more — replacing an earlier version that used a fixed 366-day span regardless of actual repo age.
- found: Clamps span to >=0, returns 1 (hottest) if span < 1 day (avoids 0/0 when everything is same-day-fresh), clamps days into [0, span], then returns 1 - log10(days+1)/log10(span+1) — a logarithmic ramp where day 0 maps to 1 (hot/new) and the oldest thing in the repo's own span maps to 0 (cold).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `opaqueShare`
- spec 2 · read at `2e6034b00e58` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node's subtree, summing lines-read where the reading's `legible` value indicates difficulty (weighting "none" more than "some", say), divided by total lines read in that subtree; returns null if no lines were read anywhere under the node.
- found: Walks the subtree, and for each func node with a non-stale agent reading, adds its loc to `read`, and if the reading's legible grade is "some" or "none" also adds to `opaque`. Returns opaque/read, or null if nothing was read. Excludes stale readings (agentStale), which I hadn't predicted.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `docGrade`
- spec 3 · read at `912acc916ed1` · commit `1edee41` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T07:07:09Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Pulls the reader's report for node n (if any); if derivable is true, forces the result to "none" regardless of the raw documented field; otherwise returns the raw documented grade; returns undefined if there's no report at all.
- found: Returns undefined if there's no agent report or if it's marked stale; otherwise returns 'none' if derivable is true, else the raw documented grade.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `undocShare`
- spec 2 · read at `b4f77e8ad637` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Walks the subtree over both file and function nodes that have a reading, counting one vote per graded node (not weighted by lines) — incrementing a total and, when its doc grade is "none"/undocumented, an undoc counter — then returns undoc/total, or null if nothing underneath has been graded.
- found: Walks file/func nodes, and for each with a docGrade, increments graded, and if the grade is "some" or "none" increments bare; returns bare/graded, null if nothing graded. I predicted "none" alone counted as undocumented, but it's actually "some" OR "none" — matches the opaqueShare sibling's same two-grade threshold, which I hadn't connected until seeing it.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `saysNothing`
- spec 2 · read at `0aafd4177d54` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:30Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns true when a color mode's question doesn't apply to this node's kind — e.g. mode is 'trap' or 'blame' or 'language' and node is a directory (not a file/function) — as opposed to the mode applying but simply having no data yet, which is treated as a different (measured-absence) case elsewhere.
- found: Returns true (mode inapplicable) when mode is 'traps' and node is not a func (so both files and dirs are excluded, not just dirs), or when mode is 'blame'/'language' and node is a dir; otherwise false.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Docs (module-level, not per-function) fully explained the rationale; I slightly misjudged the traps condition as dir-only when it's actually func-only (excludes files too).

### `colorFor` — QUIRKY
- spec 3 · read at `05d232634811` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:26:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A large switch/dispatch over ColorMode values (age, churn, docs, language, tangle, ownership/contribute, category rank, etc.), calling sibling helpers (ageOf/ageRamp/ageLabel, tangleBandOf/tangleRamp/tangleLabel, docGrade/undocShare/saysNothing, standScore/contribute*, rankCategories) to compute a color+label pair for the node under that mode, using ranks/views for calibration, returning null when the mode has no data for this node.
- found: A big per-mode dispatcher for the map's color lenses. It first checks replay flash/birth/touch state (with a REPLAY[mode] gate for modes that don't apply to replay frames), then branches on mode ('surprise', 'legible', 'docs', 'traps', 'callers', 'reach', 'clones', 'churn', 'tangle', 'age', and a final 'blame'/language fallback), each with its own null-when-unmeasured logic, share-vs-single-reading distinction for containers vs leaves, and mode-specific label formatting. Returns a Paint+label or null when the mode has nothing to say about this node.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `rankCategories`
- spec 2 · read at `3520bac67344` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree from root, groups nodes by category (as determined by mode), sums lines per category, sorts categories descending by total line count, and returns a Map from category name to its rank/slot index (0 = biggest category).
- found: It just delegates entirely to legendFor(root, mode), taking the ordered legend names and building a name→index map from their order. All actual grouping/sorting logic lives in legendFor, not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment describes the overall purpose well but doesn't reveal that this is a thin wrapper around legendFor.

### `tangleBandOf`
- spec 3 · read at `ca5733eecb5a` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:16:08Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper mapping a function's line count into a discrete size bucket/band index via a few fixed thresholds, mirroring the Rust tangle::band_of so the frontend buckets function sizes the same way the backend does when computing complexity medians per band.
- found: Finds the index of the first TANGLE_EDGES threshold >= loc; returns TANGLE_EDGES.length (the last/overflow band) if loc exceeds every edge.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `tangleRamp` — QUIRKY
- spec 3 · read at `67f308442890` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:16:01Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Looks up the size band for loc (via something like tangleBandOf), reads that band's median cognitive score from medians (falling back to the raw cognitive value itself when the band's median is null, floored at 1 to avoid divide-by-zero), then returns a two-element tuple [weighted, raw] where raw is cognitive / median clamped to 0..1, and weighted is a variant of that ratio adjusted by some size/weight factor so bigger functions' scores carry more visual weight.
- found: raw is cognitive/TANGLE_RAW_HOT clamped 0..1, independent of medians; weighted looks up the band's median (falling back to raw entirely if null), computes ratio = cognitive/max(median,1), then maps (ratio-1)/(TANGLE_WEIGHTED_HOT-1) clamped 0..1.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I assumed raw was median-relative like weighted; it's actually a fixed-constant scale independent of the band median, which is the opposite of what 'raw' vs 'weighted' suggested to me.

### `tangleLabel`
- spec 3 · read at `6b3f9f0af6fb` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:26:54Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns a plain count-based string like "${cognitive} decision points" (with singular/plural handling), and some neutral placeholder text when cognitive is null.
- found: Returns 'not counted here' when cognitive is null, else "${n} decision point(s)" with correct pluralization.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `churnLabel`
- spec 3 · read at `0823213172b2` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:54:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Formats a short label combining the commit count and the window size, e.g. pluralizing "commit"/"commits" and appending the day count like "N commits / Xd". Purely a string template with no branching beyond pluralization.
- found: Builds a window string like "27d", then returns "unchanged in 27d" for zero commits or "N change(s) in 27d" pluralized otherwise.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `standScore`
- spec 3 · read at `f507e025f669` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:15:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns a full `Score` object, filling in every field with a "no claim" default (surprise 0, documented 0, analyzedShare 0, provenance 'none', source presumably 'proxy'), then overwrites only the fields present in `measured` (churn/commits, ageDays, lastTouchedDays, tangle, cognitive) with their supplied values, leaving unmeasured fields at their neutral defaults so downstream code can treat it like any other Score without special-casing.
- found: Spreads defaults, then `measured`, then re-forces the analyzed-related fields (surprise, documented, provenance:'none', hotShare, source:'proxy', analyzedShare) unconditionally after the spread — so those specific fields can never come from `measured` even though the type would allow it. Matches prediction closely; the one nuance missed was the ordering (defaults → measured → forced-unmeasurable fields) rather than measured simply overwriting a uniform default object.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `contribute` — QUIRKY — TANGLED
- spec 3 · read at `388e3f0aaff2` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:26:52Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A dispatcher that, given a node and the active ColorMode, computes the node's value for that mode (delegating to helpers like ageLabel/tangleBandOf/docGrade/churnLabel/standScore) and calls `put` to record it into an accumulator (e.g. building histograms/buckets/legend data). Likely skips or special-cases nodes when outOfScope is true, and uses ranks/view for normalization/calibration specific to the mode.
- found: A giant per-mode dispatcher that, for a node, computes and reports (via `put`) the bucket/color/value it belongs to for the current ColorMode (language, blame, age, churn, tangle, docs, surprise, legible, traps, callers, clones, reach). It handles three shapes specially: folded roll-up stand-ins (n.rest !== undefined) which recurse back through contribute per synthetic per-file/per-window stand-in node so folded and drawn nodes land in the same bands; file-level rows for blame/language/docs; and per-function rows for every other mode, each with its own absence/unknown handling.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no
- note: The recursive self-call on synthetic stand-in nodes for folded roll-ups is easy to miss without the surrounding comments; the mechanism for keeping folded and drawn nodes in the same distribution bands is non-obvious from the signature alone.

### `contributeCols` — QUIRKY — TANGLED
- spec 3 · read at `93adb81e9109` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:12Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the file's column-summarized function entries (a compact per-column representation used when the full function ring hasn't been fetched), reusing a single pre-allocated stand-in Node whose relevant score fields are overwritten for each column entry, then calls the shared `contribute` function with that stand-in plus the given mode/ranks/view/put so each column's value lands in the same bucketing logic as real per-function nodes. The single mutable stand-in avoids allocating a fresh Node object per column entry for performance on large files.
- found: I had the loop/stand-in-reuse/contribute-call structure right, but missed the FROM_COLS lens gating (only lenses columns can actually answer run at all), the -1 absence-sentinel decoding per field, the three-way absence check for Complexity vs the git lenses, and the inline churn-saturation computation needed to avoid a crash on ring-less files.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `contributeHeld`
- spec 3 · read at `c14841180c0d` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:43:17Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the file's held readings, and for each non-stale reading calls put with a color/label derived via the mode from the reading, weighted by the reading's loc. Stale readings are skipped/ignored. Computes the unread remainder as file.loc minus the sum of loc across (non-stale?) readings, and calls put for that remainder into an unread/absence bucket, so coverage always sums to the file's total loc.
- found: Guarded to only run for modes that care about agent-reading data (legible/docs/traps/surprise). For each held reading it reuses a single mutable synthetic 'stand' Node, sets its loc/agent/agentStale from the reading, and calls contribute (not skipping stale ones — staleness is passed through for contribute to interpret). Then computes the unread remainder (file.loc minus sum of read loc) and, if positive, contributes that too with agent undefined, so total loc always sums correctly.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `sortBuckets` — TRAP
- spec 3 · read at `5212e31cee72` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T03:33:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes generic rows (each with key and lines) and returns them sorted according to the active ColorMode — likely switching on mode to choose a sort key (size-based mode sorts by lines descending, other modes sort alphabetically or by a computed severity/score), with some default fallback ordering.
- found: Looks up a BUCKET_ORDER spec for the mode: if it's the literal 'lines', sorts by lines descending; otherwise calls a function returning a fixed label order and ranks rows by their index in it (unlisted keys sort last via a deliberate -1 fallback fix). Then does a final stable partition pass moving UNKNOWN keys to the very end and OTHER_KEY just before them, regardless of the primary sort.
- predicted: most · documented: none · derivable: yes · legible: most · trap: yes
- note: The final two-tier partition (UNKNOWN last, OTHER_KEY second-last) is a second sorting pass layered on top of the mode-specific one, and the comments explain a subtle indexOf(-1) bug-turned-feature that isn't visible from the signature at all.

### `bucketsFor` — QUIRKY
- spec 3 · read at `04942f3f31b5` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:26:52Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the subtree once, respecting .sanityignore exclusions so bucket counts sum to the functions header total. Computes each node's color/ramp value via colorFor's inputs, and groups nodes into buckets: for ramped modes fixed bands with color = heatColor at the mean of members' ramp inputs; for categorical/other modes, counts per distinct category value. Nodes colorFor can't classify go into a final structural-neutral bucket rather than being dropped, and the resulting Bucket[] is returned (possibly already sorted for legend display).
- found: Walks the subtree once via `contribute` (delegating actual per-node bucket/color logic to it and to `contributeCols`/`contributeHeld` for file-level function summaries), tracking out-of-scope/excluded nodes. Ramped-mode buckets get their fill set afterward to `ramped(mean, rampOf(mode))` so the swatch is a color actually reachable on screen. Synthetic stand-in nodes contribute their line count to the bucket total but are never pushed into the node list, avoiding a prior bug where one mutated placeholder object was pushed many times.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The actual per-node classification (which bucket a node falls into, including the "structural neutral" catch-all) lives in `contribute`, not in `bucketsFor` itself — reading just this function undersells how much logic is elsewhere.

### `histogramsFor` — TANGLED
- spec 3 · read at `d8ec7dd04096` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:26:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree bottom-up (post-order): for each leaf/file node it computes its own single-bucket or few-bucket histogram (likely via something like bucketsFor or an inline per-node classification based on mode), then for each directory it merges the histograms of its children into a combined bucket list rather than averaging. To avoid quadratic cost, it only fully materializes/sorts (allocates Slice[] rows, sorts buckets) for directories present in the `want` set, while still visiting every node so the merged data is complete. Returns a Map from node path/id to an array of Slice objects representing the distribution for that container.
- found: Bottom-up post-order walk that merges per-node contributions (from contribute/contributeCols/contributeHeld) into an accumulator, but only opens a fresh accumulator Map at directories being asked for (want set) rather than at every node, passing the sink down to avoid O(nodes×depth) map copies. It tracks a 'whole' boolean per subtree (files without arrived function rings are holes unless the mode's standsIn logic allows the file to answer for itself) and only materializes/sorts a directory's histogram if the subtree is whole and non-empty, computing ramped-mode fill colors from the mean of summed ramp inputs at that point.
- predicted: most · documented: most · derivable: no · legible: some · trap: no

### `legendFor`
- spec 3 · read at `10460785a966` · commit `cecdbb2` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:34:48Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Switches on `mode` — for categorical color modes (like author, doc grade) it walks the tree from `root`, collects the distinct category value for each node using a mode-specific helper (e.g. `isAuthor`, `docGrade`), dedupes them into a list, and returns that as the legend labels. For continuous/ramp modes (age, wiring share, etc.) it returns an empty array since those don't need a discrete legend.
- found: Only handles 'blame' and 'language' modes (returns [] otherwise). Walks the tree summing loc per key (lastAuthor or lang), but only counts a node if it's a func, or a file that has no fetched func ring yet (funcs>0 acts as a stand-in so files don't get double-counted with their children). Filters blame keys through isAuthor to exclude non-human authors like uncommitted. Returns keys sorted descending by total loc, not just distinct values in arbitrary order.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The long comment explains a subtle bug history (empty legend after drilling into large repos) — worth reading in full before touching this function.

## web/src/lib/fan.ts

### the file itself
- spec 2 · read at `eba48bb0d5c9` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:01Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Provides the geometry/layout math for the "fan" view — when a file node is opened in the sunburst, its functions are laid out as sub-sectors fanning out from a chosen bearing rather than as a rectangular treemap. Helpers compute each function's angular sector (sectorOf, arcOf, share, room), unit conversions (deg), interpolation for animated open/close transitions between the collapsed wedge state and the expanded fan state (lerp, lerpSector), and placement/centering helpers (place, center), with fanFor as the main entry point returning the full layout for a node's children.
- found: Geometry for opening a file's wedge into a "fan": a bigger annular sector on the same bearing, tiled affinely in (angle, v=r²/2) space so the collapsed-wedge-to-open-fan animation is a pure arcPath interpolation with no morph/resampling. fanFor picks the best span (searched in 5° steps between MIN/MAX_SPAN) to maximize on-screen area given pane aspect; lerpSector interpolates two sectors in (θ,v); place maps a cell's fractional position in dest back into live coordinates; center/room give screen midpoint and label-space estimate for a patch.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no

### `sectorOf`
- spec 2 · read at `d0b697ca5f5d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:57Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A small arrow-function constructor that packages the four numbers into a Sector object literal {a0, a1, r0, r1} — a typed wrapper for the sector's angular and radial bounds, with no other math computed here.
- found: Packages angle bounds as-is but transforms the two radii through a vOf() function before storing as v0/v1 rather than storing r0/r1 directly — I predicted the object-wrapper shape correctly but missed that a value transform is applied to the radii.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Field names in the Sector output (v0/v1) differ from the parameter names (r0/r1), implying a radius-to-something-else conversion (likely area-preserving radius, given file doc talks of polar geometry) I didn't anticipate.

### `arcOf`
- spec 2 · read at `0be99cb3858e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:55Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a Sector (angular range plus radial range) into an Arc object with the geometric values (start/end angle in degrees or radians, inner/outer radius) needed to render an SVG arc path, likely calling deg() to convert units.
- found: Builds an Arc from a Sector by carrying the angular bounds a0/a1 through unchanged and converting the sector's radial values v0/v1 into actual radii via rOf().
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `deg`
- spec 2 · read at `2daab0c4a6ff` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:55Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Converts a radian value to degrees by multiplying by 180/Math.PI, a one-line helper used elsewhere in this polar/fan geometry file for angle math.
- found: Converts radians to degrees via r * 180 / Math.PI, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `fanFor` — TANGLED
- spec 2 · read at `b427b46737a1` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:24Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Given the source sector's bearing (angle), generates candidate sectors at that same bearing with different angular spans, fits each to the pane's aspect ratio the way the viewBox would, and picks the candidate maximizing on-screen area — returning it as a Sector. If src is null, falls back to some default full/centered sector.
- found: Computes the midpoint bearing from src (or a default NO_WEDGE_BEARING if null), then sweeps candidate angular spans from MIN_SPAN to MAX_SPAN, computing each candidate's bounding box extent, the scale needed to fit paneAspect, and the resulting on-screen area; keeps the best-area candidate and returns it as a Sector with fixed core/rim radii.
- predicted: most · documented: most · derivable: no · legible: some · trap: no

### `lerp`
- spec 2 · read at `2a17dbad7eb0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:56Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A basic linear interpolation helper: returns a + (b - a) * t.
- found: Standard linear interpolation: a + (b - a) * t.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lerpSector`
- spec 2 · read at `ade4c7e00f40` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Linearly interpolates each field of the Sector (its angular bounds and its v-space radii bounds) between a and b by t using the `lerp` helper, returning a new Sector object with the interpolated values.
- found: Linearly interpolates all four Sector fields (a0, a1, v0, v1 — angle bounds and v-space bounds) between a and b by t using lerp, returning the new Sector.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `share`
- spec 2 · read at `0660f08c622c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:11Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A one-line inverse-lerp helper: `(at - lo) / (hi - lo)`, returning the 0-1 fraction of where `at` sits between `lo` and `hi`, used somewhere in the fan/sector geometry math for placing or scaling a value along a span.
- found: Inverse-lerp helper: fraction of `at` between `lo` and `hi`, guarded to return 0 when the range is degenerate (hi <= lo) rather than dividing by zero or a negative range.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Missed the hi>lo guard against a degenerate/zero range.

### `place`
- spec 2 · read at `be52dcaa99f5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:43Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes the cell's fractional position/size within `dest` (its start and span as a fraction of dest's total span), then applies that same fraction affinely to `live`'s span/start to compute the corresponding Arc within live. Essentially an affine remap: (cell - dest.start)/dest.span gives a fraction, which is then scaled and offset by live.start/live.span to produce the returned Arc.
- found: Affinely remaps the cell's Arc from dest-sector fractional coordinates into live-sector coordinates: angles (a0/a1) are remapped directly via share() and lerp; radii (r0/r1) are first converted to some other space via vOf (likely area-linearizing), remapped by the same fraction/lerp, then converted back via rOf.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Correctly predicted the affine-fraction-remap structure for angle, but missed that radius goes through a vOf/rOf space conversion rather than being remapped directly like angle.

### `center`
- spec 2 · read at `56c3766c17a4` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:18Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the midpoint radius r = (g.r0+g.r1)/2 and midpoint angle a = (g.a0+g.a1)/2 of the arc, then converts to screen coordinates x = r*sin(a), y = -r*cos(a), returning {x, y, r, a}.
- found: Computes midpoint angle and radius of the arc, converts to screen coords via x=r*sin(a), y=-r*cos(a), returns {x,y,r,a}.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `room`
- spec 2 · read at `440ea093ab45` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:13Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Given an Arc (inner/outer radius + start/end angle), computes the arc's mid-radius as (inner+outer)/2, then w = arc length at that radius (angle span in radians × mid-radius) and h = radial thickness (outer - inner), returning {w, h} as the label's available width/height.
- found: w = angle span × mid-radius (arc length at mid radius), h = r1 - r0 (radial thickness); exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/history.ts

### the file itself
- spec 3 · served in 4 parts · read at `d7f40898cfac` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:15:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The frontend counterpart to history.rs: wraps Tauri commands (scanHistory, traceProject, warmHistory) and implements the fold/replay engine turning base Tables plus streamed deltas into a frameTree for any commit index. Maintains a checkpoint cache (freeze/thaw/weigh/evict/remember/nearest) so backward seeks don't require refolding from scratch, builds the sunburst-style directory tree (aggregate/collapse/dirNode/shapeOf), and attaches per-function readings/scores (gradeAt/readingInto/scoreInto) plus author bookkeeping (authorsOf/authorId/authorName). No file-level doc comment, notable given how documented the Rust side is.
- found: Exactly as predicted: Tauri IPC wrappers (scanHistory/traceProject/warmHistory/onHistoryProgress), a checkpoint/replay fold engine (Frame/Checkpoint/freeze/thaw/weigh/evict/remember/nearest/replay/advance) that turns base Tables plus streamed deltas into dense typed-array frames with a spread checkpoint cache for fast backward seeks, and a sunburst tree builder (shapeOf/frameTree/aggregate/collapse/dirNode/standIn/crowd) that thresholds/rolls up thin nodes and attaches per-function readings (gradeAt/readingInto/scoreInto) and author bookkeeping (authorsOf/authorId/authorName), plus binary-search helpers (posOf/realOf) for scoped playhead positions.
- predicted: full · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file-level doc comment despite being the single densest, most heavily commented-per-line file I've seen — every design decision is justified inline (perf numbers, failure modes averted) but there's no header summarizing the module's overall shape/responsibility the way history.rs's file_doc does.

### `scanHistory`
- spec 3 · read at `5cb544ec5c94` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (e.g. "scan_history") passing path, trace, fresh, and limit, awaits the result, and returns it as a TraceResult — trace=false does a cheap read of already-walked commits while trace=true triggers the expensive walk of unwalked commits.
- found: Thin Tauri invoke wrapper calling the 'scan_history' backend command with path, limit, trace, fresh, returning the TraceResult promise directly.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `traceProject`
- spec 3 · read at `1a442f471908` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:29Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Thin frontend wrapper that POSTs to the backend's /trace endpoint (same one the CLI `trace` command hits) with the project path and optional depth ('files' or 'lines'), awaits the JSON response, and resolves with the `seconds` field from the result so the app can compare actual cost to its own estimate.
- found: A one-line wrapper around Tauri's `invoke('trace_project', { path, depth })`, resolving to the seconds elapsed as reported by the backend Rust command — it's an IPC call to the app's own Tauri backend, not an HTTP fetch to a separate server process.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: This is the Tauri desktop-app path (invoke), a separate call surface from the HTTP /trace endpoint the CLI uses — worth knowing there are two client entry points into tracing.

### `warmHistory`
- spec 3 · read at `ff9955356789` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A thin 3-line wrapper that invokes a Tauri backend command to pre-warm/cache git history data for the given project path, returning a boolean indicating whether history is available/was warmed successfully.
- found: Thin wrapper invoking the Tauri 'warm_history' command with the path, returning its boolean result.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `onHistoryProgress`
- spec 2 · read at `362d617cee23` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:44Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a backend event (e.g. Tauri's listen('history-progress', ...)) that reports progress of a history scan, calling cb with the Progress payload each time it fires. Returns an unsubscribe function that cancels the listener, likely handling the async nature of Tauri's listen by wrapping unlisten in a closure.
- found: Subscribes to Tauri's 'history-progress' event, invoking cb with each event's payload, and returns a cleanup function that resolves the pending listen() promise and calls the resulting unlisten function.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `daysBetween`
- spec 2 · read at `d174e1052ee9` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:38Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes (now - then) / 86400 to convert seconds to days, then clamps the result to be non-negative with Math.max(0, ...), since "then" could theoretically be after "now".
- found: Exactly as predicted: (now - then) / 86400 clamped to a minimum of 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `authorsOf` — OBSCURE — TRAP
- spec 3 · read at `e68107924b92` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Scans the Tables history data for all distinct author name strings, builds a deduplicated list array (in first-seen or sorted order) and a Map from author name to its index in that list, so other code can store compact numeric author ids instead of strings.
- found: A memoization guard keyed on object identity of hist: if the same hist object was seen last time, returns the cached {list, at} struct unchanged; otherwise resets interned to fresh empty list/map tied to this hist and returns that (population happens elsewhere via mutation of the returned objects, not shown here).
- predicted: none · documented: none · derivable: no · legible: full · trap: yes
- note: The function name and signature imply it computes the author list itself, but it only caches/resets an empty struct; the actual population must happen elsewhere by mutating the returned list/map in place, which is not discoverable from this function alone and risks callers assuming it's pure.

### `authorId`
- spec 3 · read at `91b6cd0d6666` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:50Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Interns an author name into a numeric id within the Tables structure: looks up name in an existing authors array/map, returning its index if found, or appending it and returning the new index if not. Pairs with authorName for the reverse lookup.
- found: Interns author name into id using a table with both a Map (name->id) and a list (id->name), via authorsOf(hist) accessor; returns existing id or pushes new entry and registers it in both structures.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `authorName`
- spec 3 · read at `bba813e4d097` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:19Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Looks up authorsOf(hist).list[id] and returns it, returning null if id is out of bounds (e.g. a -1 sentinel meaning no author).
- found: Returns null for negative id (sentinel for no author), otherwise looks up authorsOf(hist).list[id], falling back to null if missing.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `widthOf`
- spec 3 · read at `dc45349ad9df` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:26Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A one-line function returning the max of hist.funcCount and the number of functions paged into hist.funcs so far, ensuring typed arrays for a frame are sized to cover both what's promised and what's actually loaded.
- found: Returns Math.max(hist.funcCount, hist.funcs.length), exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `blank`
- spec 3 · read at `180826796a7a` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:15:24Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Allocates a fresh Frame with every field at its empty/zero state — likely typed arrays or maps sized against hist's function/path counts (for perf, since this is the frontend replay hot path) rather than growing objects, with order as an empty array, lines: 0, and container-count structures pre-sized but zeroed, ready for opening/advance to populate incrementally.
- found: Allocates a Frame of typed arrays sized to function count, path count, and directory count, each filled with a sentinel "absent" value (NO_TS, NO_AT, NO_AUTHOR, NO_GRADE, NO_COG), including per-function and per-path churn history buffers (hits/pathHits sized by CHURN_MEMORY), starting ts at hist.baseTs and at at -1.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `opening`
- spec 3 · read at `fa59f52578ab` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:14:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds the initial Frame object representing the state accumulated by truncated/dropped earlier commits (i.e., hist.base) before any recorded commit frame is applied — the JS/TS mirror of the Rust scan.base starting point, mapping function indices to their sizes/locations so the frontend's replay can start from a non-empty baseline when history was truncated.
- found: Builds a blank frame, then seeds it from hist.base (and baseRead/baseCog): sets loc/live/lines/order for each pre-window function, census's their containers so they're counted from frame one, and deliberately leaves them unmarked as touched/born since their actual write time is unknown.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says only 'the opening state', missing the deliberate semantics around counted-but-not-dated and carrying baseRead/baseCog forward.

### `enter`
- spec 3 · read at `a6d46c8d0021` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:39:53Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Marks function p as existing in frame at time ts, incrementing its count. Separately, walks up the containing file/directory hierarchy in shape and records a birth event only where a container's count transitions from 0 to 1, so a single function's arrival doesn't spuriously "light up" ancestors that already had other functions.
- found: Calls census(frame, shape, p) to increment path p's live count and check for 0→1 transition; if not a fresh birth, returns early. Otherwise records the file's birth position/timestamp, then walks shape.ancestors[p] marking any directory whose live count just became 1 as born at position `at`.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `census`
- spec 3 · read at `3948e6c114f5` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:30:54Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Looks up the file (and its ancestor directories) that function p belongs to in shape, increments each one's function count in frame, and returns true if the file's count was zero before this increment (i.e., this function is the file's first, making it a fresh "arrival"), false otherwise.
- found: Increments the function's own path-liveness counter; if it was already live (count now > 1) returns false immediately without touching ancestors. Only on the first arrival (count goes 0->1) does it walk shape.ancestors[p] and bump each ancestor directory's live count, then returns true.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `leave` — QUIRKY
- spec 3 · read at `4af2377a07e7` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Mirror of enter: removes a function (id p) from frame's tracked state for shape, decrementing the owning file's function count. If that was the file's last function, the file entry itself is deleted from tracking (not just zeroed), so a later reappearance is treated as a fresh arrival rather than a continuation.
- found: Decrements frame.pathLive[p] (floored at 0, not wrapped, since the store is unsigned). If it hits 0, resets the path's born-at/born-timestamp sentinels, then walks shape.ancestors[p] decrementing each ancestor directory's live count too, clearing its born-at sentinel when a directory itself reaches zero.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I underestimated: this also propagates the departure up through ancestor directories' live counts, not just the single path/function entry.

### `advance` — QUIRKY — TANGLED
- spec 3 · read at `28bb131feb90` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:14:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates commit indices from frame.at+1 through to, looks up each commit's delta in hist/deltas, and applies it to frame's in-place state, advancing frame.at as it goes. If a commit is missing it breaks early and returns false; otherwise returns true after fully catching frame up to `to`.
- found: Applies commits (frame.at, to] to frame in place: for each commit, updates per-function state (loc, live, touched, author, editedAt, born/bornAt on arrival, a fixed-size ring buffer of recent touch timestamps), handles deletions (leave, clearing state), applies grading/cog reads, and updates per-path author/timestamp and churn ring. Rather than splicing frame.order on every arrival/departure (O(live) each), it batches all arrivals/departures for the whole step into two sets and does a single linear merge into a new order array at the end for performance. Returns false if it runs out of fetched commits before reaching `to`, otherwise true; frame.at and frame.ts are updated to the reached point.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `freeze` — QUIRKY
- spec 3 · read at `1354e622a688` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:15:13Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Snapshots the current mutable state of a Frame (its node tree, live file/author tracking maps, position in the commit sequence, etc.) into an immutable Checkpoint value, copying/cloning whatever mutable structures need to survive further replay steps so a later `thaw` call can restore the frame to this exact point without being affected by subsequent mutation.
- found: Snapshots a Frame's structure-of-arrays state (flat typed arrays for per-function and per-path/per-dir churn, timestamps, liveness, authorship, cognitive scores etc.) into a Checkpoint, compacting the ragged ring buffers (hits/pathHits, which are stored as fixed-stride CHURN_MEMORY slots per entity) down into tightly packed Uint32Arrays using the hitLen/pathHitLen counts, while other arrays are just sliced (shallow-copied) as-is.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `thaw`
- spec 3 · read at `2a242348194b` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:15:09Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Reconstructs a live `Frame` object from a serialized `Checkpoint`, the inverse of `freeze`: unpacks the checkpoint's compact/packed arrays (loc, cog, timestamps, etc.) into the Frame's working data structures so replay can resume from this point without re-walking from the start.
- found: Reconstructs a Frame from a Checkpoint: unpacks ragged-array-style compact hit lists (pathHits/hits) back into fixed-stride Uint32Arrays using per-entry hitLen counts, rebuilds the `order` list of live function indices, and copies the rest of the checkpoint's flat arrays directly across.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `weigh`
- spec 3 · read at `b4fb07068bb6` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:15:22Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Sums the byte lengths (or element counts) of the Checkpoint's various typed arrays to produce an approximate memory-size estimate for the checkpoint, used by the checkpoint cache (remember/evict/nearest) to enforce a memory budget.
- found: Sums the byteLength of all the typed arrays held in a Checkpoint to give a total memory-size estimate in bytes, used for checkpoint cache budgeting.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `evict`
- spec 3 · read at `fc7f56dda765` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:34:26Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Mutates `kept` in place by finding the interior checkpoint (excluding index 0 and the last) whose two neighboring checkpoints' commit indices are closest together (smallest gap), and splicing that one checkpoint out of the array — leaving the first and last checkpoints untouched since they anchor the ends of the story.
- found: Exactly as predicted: guards length<3 (nothing interior to evict), scans interior indices for the one whose combined neighbor span (i+1 minus i-1) is smallest, and splices that single checkpoint out, leaving the two ends untouched.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Doc fully and accurately explains the rationale; the body is a direct, short implementation of exactly what it describes.

### `remember`
- spec 3 · read at `37bf061880df` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:32:57Z · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Banks a checkpoint of the current frame into the module-level bank if enough commits (CHECKPOINT_EVERY) have passed since the last one, then evicts checkpoints (keeping the count/byte budget within CHECKPOINTS/CHECKPOINT_BUDGET) by dropping the one whose neighbors are closest together, recomputing total bytes afterward.
- found: Exactly as predicted — bank a checkpoint if far enough past the last one, then evict down to budget/count.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Already read this exact function's body earlier in the file-level task for history.ts, so this was a warm rather than cold read.

### `nearest`
- spec 3 · read at `533bc9280ca2` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:08Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Searches a stored collection of checkpoints in hist for the highest one whose index is <= the given index, likely via binary search over sorted checkpoint indices, returning null if none exists (e.g. index precedes the first checkpoint).
- found: Checks a module-level `bank` cache is present and tied to this exact `hist` object; if not, returns null. Otherwise linearly scans bank.at (checkpoints) for the one with the highest `.at` that is still <= index.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Result depends on a module-level `bank` cache being populated and matching `hist` by reference identity — not visible from this function alone.

### `replay`
- spec 3 · read at `607de9b4055b` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:53Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: replay() reconstructs the Frame (visualization state) at the given `index` into the history by finding the nearest cached/frozen frame (via `nearest`/`thaw`) and applying the intervening `deltas` incrementally forward (or backward) to reach the target index, rather than recomputing from scratch each time. It likely caches (freezes) the resulting frame afterward for future replay calls to reuse as a new starting point.
- found: replay() first checks a single-slot `memo` cache for the same history whose frame is already at or before the target index, mutating it forward in place via `advance` (fast path, tracked by `cost.folded`); otherwise it invalidates/rebuilds the author interning table if the timeline changed, finds the nearest frozen snapshot via `nearest`/`thaw` (or builds an opening frame), advances it to the index, remembers it if changed, and caches it as the new memo.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

### `headSizes`
- spec 3 · read at `f5ebe8bd7403` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:30Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks the live Node tree (root) recursively, visiting every node and recording its id and its size (e.g. lines) into a Map<string, number>, then returns it read-only. A straightforward single traversal, with no special handling for missing entries — that default (0) is applied by callers, not built into this function.
- found: Recursively walks the tree, and for every non-func node (dirs and files) records its id -> loc into a Map; func nodes are skipped entirely. Returns the map read-only.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed that func nodes are excluded from the map — only dirs/files get sizes recorded.

### `inStep` — QUIRKY
- spec 3 · read at `81b7b111bc96` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:41Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns whether index falls between since and at (e.g. index > since && index <= at), marking events that occurred during the commits the playhead just advanced through this frame/step.
- found: Returns at > since && at <= index — checks we're moving forward and the event's index is at or ahead of the new playhead position, not a since/at bracket on index as I'd guessed.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `gradeAt`
- spec 3 · read at `770cd81e8c0d` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Extracts a small integer field from a bit-packed number at the given shift (e.g. (packed >> shift) & mask), then maps that value to a Grade via lookup array, returning undefined if the extracted value is 0 or otherwise indicates no grade.
- found: Shifts packed right by shift, masks with 7 (3 bits), and indexes into GRADES array; returns undefined if out of range.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `readingInto`
- spec 3 · read at `4bdb5f4cb16e` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:42Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Unpacks the two-byte `packed` value into four grade fields (predicted/documented/legible/trap or similar) via bit masking/shifting, writing them into the `into` object if given (reusing it, pooling-style) or creating a fresh minimal AgentReport otherwise, with prose/provenance/model left empty/default and the "dated" flags all set false since an absent grade already means unread after packing dropped it.
- found: Unpacks a two-byte int into an AgentReport: predicted/documented/legible via gradeAt at bit offsets 0/3/6, trap as a single bit at offset 9, and derivable as a tri-state 2-bit field at offset 10 (0=undefined/never asked, else true/false), reusing the passed-in `into` object or creating a minimal one.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `scoreInto` — QUIRKY
- spec 3 · read at `deade2b5c9fa` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:14:44Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds (or reuses `into`) a Score object for function `f` as of `frame`: reads its loc/cognitive from the frame's tables, computes age from `since`/frame timestamp, computes churn using `windows`, computes a tangle ramp from `bands` if available, and unpacks `packed` into a color/reading value if not NO_GRADE. Since surprise isn't replayed, it leaves surprise at 0 and analyzedShare at 0 so the map doesn't color it as analyzed.
- found: Fills (or reuses pooled) Score for function f at this frame: computes churn per window by scanning recent hit timestamps against 4 windows, age/lastTouched from born/touched timestamps, surprise/documented/analyzedShare/hotShare/source from unpacking `packed` if present (not just left at 0 — it decodes grade info when available), cognitive/tangle from frame.cog and bands, and appeared/edited flags for whether born/edit fell within the current step.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `aggregate` — QUIRKY — TANGLED
- spec 3 · read at `2cc48c71c638` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:14:54Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a node's children (post-order), computing a LOC-weighted aggregate score for the container, taking the oldest child's age and the newest child's last-touched date. Also implements the "folded" roll-up mechanism referenced elsewhere: functions/files too small to draw individually get tallied into the parent's `folded` structure (time/lang/author/tangle arrays) rather than being aggregated normally, using `appearedOf` to resolve when a child's history begins.
- found: Recursively aggregates children post-order, summing loc, rolling up birthBelow/touchBelow flags, and then computing a LOC-weighted mean for churn/hotShare/analyzedShare/tangle, a max-per-window for commits, a sum for cognitive complexity, max ageDays (oldest) and min lastTouchedDays (newest). It explicitly SKIPS folded roll-up stand-in children (c.rest !== undefined) when aggregating scores (their lines already counted via node.loc), clears score to null if no measurable children contributed, and writes appeared from appearedOf while always nulling edited since containers don't show touch flashes.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `collapse`
- spec 3 · read at `cdad908c9ada` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:23Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the tree, first collapsing children, then checks if this node is a directory with exactly one child that is itself a directory; if so, merges them into a single node whose name/path is the joined "parent/child" string, repeating until no longer collapsible. Returns a new Node with collapsed children otherwise.
- found: Mutates children in place (avoiding array reallocation) while recursing bottom-up, then if this dir has exactly one dir child, merges into a new node combining names with "/". Only collapses one level per call rather than looping to collapse chains of >2, relying on the recursion itself having already collapsed the child's own single-dir-child chain before this check runs.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The in-place mutation of kids and the performance rationale (avoiding per-frame array allocation) wasn't derivable from the signature/docs alone.

### `dirNode` — QUIRKY
- spec 3 · read at `af5ab22752da` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns a new Node object representing a directory entry in a file-tree structure, given its full path and its own name. Likely initializes fields such as an empty children collection, a flag marking it as a directory, and default size/count accumulators to be filled in as the tree is built up (used alongside insertSorted/removeSorted and other tree-building peers).
- found: Builds a Node literal for a directory: sets id/name/path/kind='dir', and explicitly nulls out the large set of file-analysis fields shared with file nodes (callers, calls, incident, away, resolvable, orphans, sinks, cloneGroup/cloneSize, comparable, copied, loc=0, line, endLine, bytes, lang, lastAuthor, doc, signature, owner, score, body), plus initializes hotspots=[], children=[], funcs=0.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Node is one big shared shape for both files and dirs — most fields are meaningless/null for a dir; a reader predicting from the name alone won't guess how many analysis-specific fields exist.

### `flashOnly`
- spec 3 · read at `f27170295d18` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:43Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns null when neither `birth` nor `edit` is true (nothing to flash), otherwise builds and returns a Score object with an `event` field set to describe which happened (birth/edit), while every measurement field (commits, churn, tangle, ageDays, lastTouchedDays, source, etc.) is left at its "no claim" default (0/null) so this stand-in score doesn't get mistaken for a real reading during aggregation.
- found: Got the null-guard and all-defaults-except-event structure right; missed that the event is split into two separate fields (`appeared`/`edited`, each 1 or null) rather than one combined field, and the explicit provenance: 'history' tag.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `reuse`
- spec 3 · read at `b2412acd9c6c` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:05Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes a pooled Node and resets all per-frame derived fields (score, size, children, aggregated counts, etc.) back to empty/zero/undefined, leaving identity fields (id, path, name, kind, lang) untouched, then returns the same mutated node — clearing a pooled object for reuse rather than reallocating.
- found: Clears exactly 5 derived fields on a pooled Node (children array truncated to 0, loc, score, birthBelow, touchBelow) leaving identity fields untouched, returns the node. Fewer/more specific fields than I guessed (no generic size/aggregated-count fields, specifically loc/birthBelow/touchBelow).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains the WHY (avoiding stale scores) well but doesn't enumerate the exact derived field set, which is only visible in the body.

### `shapeOf`
- spec 3 · read at `b45771b9e773` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: shapeOf builds the static directory/file tree skeleton from the full path list recorded in the history tables — the structural hierarchy (likely collapsing single-child directory chains, matching how the live scan collapses them) that is invariant across the whole replay. This skeleton is what frameTree then decorates per-commit with scores, since computing the tree structure itself only needs to happen once rather than on every frame.
- found: Builds and memoizes (via a module-level `shaped` cache keyed on the Tables object and path count) the static directory/file tree structure from the history tables' full path list: assigns each directory an index, records each file's owning directory, and precomputes each file's ancestor-directory chain as an Int32Array for fast per-frame tree walks.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: I predicted it collapses single-child directory chains like the live scan does; it doesn't — every directory in the path gets its own node, and the only optimization is the precomputed per-file ancestor chain plus a cache keyed on object identity and path count.

### `scopeOf`
- spec 3 · read at `21209e3f2b38` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:28Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Iterates all paths in hist.paths and collects the indices of paths that fall under `scope`, using segment-wise prefix matching (so "web/src" doesn't match "web/src-old"), returning them as a Set<number> for fast membership checks elsewhere (e.g. filtering which functions/files are in view during replay).
- found: Memoized: if the last computed scope set matches the same hist and scope, returns the cached Set directly. Otherwise walks hist.paths collecting indices where path equals scope or starts with scope+'/', caches the result in a module-level `scoped` variable, and returns it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `historyLangs`
- spec 3 · read at `edc4ca790989` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:00:28Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Walks every path that has ever existed in the history tables under `scope` (excluding excluded paths), buckets them by language extension, counts files per language, and returns the language names sorted by file count descending — supplying a stable ordering for languages that no longer exist at HEAD so they still get a consistent color/position in a replay instead of falling into an "other" bucket.
- found: Counts files per language across `hist.langs`, skipping excluded/unlabeled paths and paths outside `scope` if given, then sorts descending by count with an alphabetical tiebreak and returns just the language names.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `pathIndexOf`
- spec 3 · read at `adbb902f8645` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:48Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds a Map<string, number> from hist's paths table (some array of path strings) to their index position, giving O(1) lookup from path string to its row/column index for later use in other functions like dirsOf/scopeOf.
- found: Builds a Map from path string to index over hist.paths, but memoizes it in a module-level `index` variable keyed by reference equality to `hist`, returning the cached map if the same hist object is passed again.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `frameTree` — QUIRKY — TANGLED
- spec 3 · read at `8521652d3121` · commit `fbd391a` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:15:17Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds a Node tree matching the sunburst's shape for commit `index`, rooted at `scope`. Walks paths/functions in hist, applies the minLoc rollup threshold (scaled by density) to decide which functions get their own tile vs get folded into a rollup node, computes per-node scores/grades via scoreInto/readingInto, aggregates stats up through directories via aggregate/collapse, and marks functions touched in (since, index] as flashing when `flashes` is true. Likely composed of several internal passes given its length.
- found: Builds the sunburst Node tree for a replayed frame at commit `index`. Replays to the frame, then does a bottom-up pass over live functions computing per-file/per-dir aggregate LOC, cognitive/tangle totals, and birth/edit flags, using a size threshold (minLoc, scaled by density and scope) to decide which functions get real nodes vs get folded into per-file/per-directory 'stand-in'/'crowd' roll-up nodes carrying summarized language/author/time/tangle tallies. Nodes are pooled and reused across frames (keyed by path) rather than reallocated. Then does a top-down walk building only the subtree actually large enough (or forced by `scope`) to draw, aggregates birth flags for flash coloring, and collapses the result into the final tree.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `posOf` — QUIRKY
- spec 3 · read at `077496c8f1ea` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:27Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Binary search over the sorted `frames` array to find the position of `index` — returning the exact match position, or an insertion point if not present.
- found: Binary search that returns the index of the rightmost element in `frames` that is <= `index` (a "floor" search), or -1 if every element is greater than `index` — not an exact-match/insertion-point search as I guessed.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: This is a floor/predecessor search (largest frames[mid] <= index), not a general binary search for exact match — worth naming explicitly since 'posOf' alone doesn't convey the <= semantics or the -1 sentinel.

### `realOf` — QUIRKY
- spec 2 · read at `d12300962075` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:42Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: If pos is -1, returns fallback (the commit just before this scope's first). Otherwise indexes into frames[pos] to return the real commit number corresponding to that scoped position.
- found: Empty frames returns fallback; pos<0 returns frames[0]-1 (not the passed fallback); otherwise clamps pos to frames.length-1 and indexes.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I got the -1 case's intent right but wrong mechanism (frames[0]-1, not fallback), and missed the empty-array guard and clamping.

## web/src/lib/ink.ts

### the file itself
- spec 2 · read at `def5ec74d317` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:08Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A small color-math library: srgb/luminance/contrast implement WCAG-style relative luminance and contrast ratio calculations, over composites a color over a background, resolve turns a CSS color or var into concrete RGB values, theme reads the app's current theme as a fallback, and inkOn(backgroundColor) is the exported function that picks light or dark ink for a label based on which achieves sufficient contrast against that specific wedge's color rather than the app's theme setting.
- found: Exports fixed PAPER/INK literals (not theme-flipped) and inkOn(token, alpha) which resolves a CSS custom property to a hex color, composites it over the background at the wedge's fillOpacity, computes WCAG luminance/contrast against both PAPER and INK, and returns whichever contrasts more — falling back to CHROME_INK (var(--foreground)) when the token can't be resolved to a plain hex value (e.g. a color-mix). Results are cached keyed by theme+token+alpha since theme is the only thing that invalidates a resolved custom property.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `inkOn`
- spec 2 · read at `80e76d1ad85c` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Resolves the custom property token to an actual color (via `resolve`/`srgb`), composites it with the given alpha over the pane background using `over`, then computes luminance and picks between two candidate inks (light/dark) by comparing contrast ratios via `contrast`, returning whichever wins. If the token doesn't resolve to a plain color, it falls back to returning the chrome/foreground ink directly rather than guessing.
- found: Builds a cache key from theme+token+alpha and returns cached result if present. Resolves the token and background color to hex; computes the composited luminance (or plain luminance if alpha>=1 or background missing). Picks PAPER or INK by comparing contrast ratios, or CHROME_INK if the color didn't resolve. Caches and returns.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the memoization cache entirely; got the compositing/contrast decision logic right.

### `theme`
- spec 2 · read at `92ea90ceffc7` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:28Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A one-line function that reads the current theme (light/dark) from the DOM, likely checking document.documentElement's class list or a data attribute, returning 'light' or 'dark'. Used by inkOn/resolve to decide which ink color to use based on the active theme.
- found: Returns document.documentElement.className (guarding for SSR by returning a single space string if document is undefined), so callers presumably check whether 'dark' is a substring of the returned className rather than getting a clean enum value.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Returns the raw className string (with an SSR fallback of a single space), not a normalized 'light'/'dark' value as I expected.

### `resolve`
- spec 2 · read at `dae3c6f83baf` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:31Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up a CSS custom property's resolved value (e.g. via getComputedStyle on document.documentElement or a probe element), and returns it as a string. Returns null if the value isn't a plain hex color (e.g. if it's a color-mix() expression), since callers rely on parsing this as a simple hex sRGB stop.
- found: Strips a var(--x) wrapper down to the bare custom-property name, guards for SSR (no document), reads the resolved value via getComputedStyle, and returns it only if it matches a strict 6-digit hex pattern, else null.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `luminance`
- spec 2 · read at `d09f89e8db80` · commit `9ea3e1f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:04:29Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Parses hex into r,g,b 0-1 channels, applies the sRGB linearization formula to each (dividing by 12.92 below threshold, else the gamma power-curve formula), then returns the weighted sum 0.2126*R + 0.7152*G + 0.0722*B per the WCAG spec.
- found: Delegates hex parsing and sRGB linearization to a separate `srgb()` peer function, and this function itself is just the weighted-sum reduce over the three linearized channels with the WCAG coefficients — I correctly predicted the formula but attributed the linearization step to this function rather than a helper.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `over`
- spec 3 · read at `764d29607998` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:47Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: This converts both `hex` and `ground` to linear-light RGB channels (via `srgb`), alpha-composites each channel (`hex*alpha + ground*(1-alpha)`), and then computes the luminance of the resulting composited color (via `luminance`) — doing the blend in linear space per-channel rather than averaging the two luminances directly.
- found: Converts hex and ground to linear sRGB channels, composites each channel with alpha, and sums the channels weighted by the Rec.709 luminance coefficients (0.2126, 0.7152, 0.0722) to get the resulting luminance.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `srgb`
- spec 2 · read at `17e3b63929cc` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:36Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a hex color string into its three RGB channels (0-255), normalizes each to 0-1, and applies the standard sRGB-to-linear gamma correction (dividing by 12.92 below a threshold, otherwise the ((c+0.055)/1.055)^2.4 power curve) to each channel, returning the linearized [r, g, b] array for use in relative luminance/contrast calculations.
- found: Parses a hex color string's R/G/B channels, normalizes to 0-1, and applies the standard sRGB-to-linear gamma correction for each channel, returning the linearized [r,g,b] array used in luminance/contrast math.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The file-level doc explains WHY (label ink contrast against heat-ramp wedges) but that context lives at the file level, not on this specific helper, which is pure standard color math.

### `contrast`
- spec 2 · read at `fcc143c88c68` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:31Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Implements the standard WCAG contrast ratio formula: given two luminance values a and b, computes (max(a,b) + 0.05) / (min(a,b) + 0.05), so the result is the same regardless of argument order.
- found: Standard WCAG contrast ratio: (max(a,b)+0.05)/(min(a,b)+0.05).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/keys.ts

### the file itself
- spec 3 · read at `56b60f1fae8e` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:50:01Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A small pure module that centralizes keyboard-shortcut interpretation into one testable function (peer `actOf`), replacing a scattered pile of early-return guards that used to live inside a useEffect. It likely defines an action type/union (the possible things a keypress can mean, e.g. navigate lens, toggle something, digit entry) and a single function that takes a KeyboardEvent (or key string + modifiers) and returns which action it corresponds to (or none), with the guard ordering made explicit and readable top-to-bottom rather than buried in effect logic.
- found: Exports Press/Where input types (deliberately not a raw KeyboardEvent, and deliberately excluding lock/replay state per a documented rationale), an Act union (find/history/lens+mode), and one actOf(e, w) function with ordered guards: Tab (unmodified, suppressed while typing/finding) → require bare Cmd → Cmd+/= for history → Cmd+f for find → reject Shift → Cmd+digit maps to a ColorMode via LENS_KEYS index into MODE_LABEL keys.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header doc's rationale about Locked/replayNote deliberately not being in Where is substantial context not derivable from actOf's body alone.

### `actOf` — QUIRKY
- spec 3 · read at `fb0668e4a60a` · commit `74e9537` · read by claude-sonnet-5 · via claude · when 2026-09-03T06:57:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A sequence of ordered guard clauses mapping a keypress+focus (Where) to an Act: Tab handled first since it's the only non-Cmd key, then a `+`/Shift-`=` toggle check, then Find, then a replay guard, finally falling through to pass any other modified press straight on as a generic/passthrough Act.
- found: Maps a keypress+focus context to an Act via ordered guards: Tab (only when unmodified) returns find-or-null depending on focus; then requires meta without alt/ctrl for everything else; then `+`/Shift-`=` maps to history; then `f` maps to find; then blocks any other shifted key; then checks a LENS_STEP table for `[`/`]` stepping; then finally maps digit-like keys through LENS_KEYS/MODE_LABEL to a specific lens mode action.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: My prediction got the doc-described ordering right but missed the actual substantive logic (lens digit mapping via LENS_KEYS/MODE_LABEL and the step table) and invented a 'replay guard'/generic passthrough that isn't in this function body.

## web/src/lib/label.ts

### the file itself
- spec 2 · read at `0d1a191b1b3f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:40Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A small geometry/text-fitting module for sunburst wedge labels: `widthPerPx` estimates the average pixel width of a character for measuring how much text fits, `middleTruncate` truncates a string in the middle (preserving start and end, replacing the middle with an ellipsis) to fit a given pixel budget, and `fitLabel` is the main exported function that picks whether a label runs along the arc or along the radius based on the wedge's width-vs-depth shape, then truncates accordingly and returns positioning/orientation info for rendering.
- found: Confirmed the three functions do what I predicted at a high level, but fitLabel is considerably more involved: it computes max sizes for both arc and radial axes (capping arc size by an allowed bend in radians, centering the radial run and solving a fixed-point equation for its size), prefers the axis matching the wedge's own shape, falls back to the other axis if the preferred one can't hold the full name at all, and only as a last resort middle-truncates on the shape's own axis down to a length/character floor (MIN_KEPT/MIN_SHARE) before giving up and drawing nothing.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: File header and inline comments are unusually extensive design-history prose (why axis is chosen by shape not size, why bend is capped, why truncation is middle not tail) — none of that reasoning is derivable from the code alone.

### `widthPerPx`
- spec 3 · read at `ba81f995f47e` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:24Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up a cache (keyed by text+weight) for a previously computed width-per-pixel ratio; on miss, creates/reuses an offscreen canvas 2d context, sets font to some fixed reference size and the given weight, calls measureText, and divides the resulting width by that reference size to get a per-px ratio, storing it in the cache. If canvas/context creation fails, falls back to multiplying text.length by a constant average character-width ratio instead of measuring.
- found: Caches width-per-px by weight+text key; on miss lazily creates a canvas 2d context, measures text at a reference font size and family, divides by ref size, applies a 1.06 fudge factor to account for measureText undereporting actual ink width, and caches it. Falls back to text.length*0.6 if no canvas context is available.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The 1.06 fudge factor and font-family inclusion in the cache key weren't predictable from docs/signature alone.

### `middleTruncate`
- spec 2 · read at `b7213f9d08f3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:07Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Truncates `name` down to roughly `keep` characters by keeping the head and tail and replacing the middle with an ellipsis character, splitting the kept budget between the two ends (e.g. floor/ceil of keep/2) so both the shared prefix and the distinguishing suffix survive. Returns `name` unchanged if it already fits within `keep`.
- found: Returns name unchanged if it fits; returns empty string if keep is below a minimum threshold; otherwise splits keep between head (ceil half) and tail, joining with an ellipsis.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Didn't anticipate the MIN_KEPT empty-string case, but the core middle-truncation logic matched exactly.

### `fitLabel` — TANGLED
- spec 3 · read at `8a2b8a484244` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:48Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Determines whether the cell is wider-than-deep or deeper-than-wide to pick a preferred axis (arc vs radial), then tries the full name on that axis, falling back to the full name on the other axis, then middle-truncated versions on each axis in the same preference order, returning the first Placement that fits (with orientation, text, and position) or null if nothing fits even truncated.
- found: Computes max size along arc and radial axes (with centering math for radial), picks the shape's preferred axis (arc unless the outer arc is shorter than depth), tries the full name on the preferred axis then the other, and if neither fits at MIN_SIZE, middle-truncates progressively on the preferred axis until something fits or gives up (returns null).
- predicted: most · documented: most · derivable: no · legible: some · trap: no

## web/src/lib/mascotClock.ts

### the file itself — QUIRKY
- spec 3 · read at `3f345ae889fd` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small injectable clock abstraction for the mascot feature: a `mascotClock()` getter returning current time (wrapping Date.now()) and `setMascotClock()` setter to override it, letting tests/storybook control mascot animation timing deterministically instead of using real wall-clock time.
- found: Defines a MascotClock interface (hold/step/release) and a module-level singleton slot (setMascotClock/mascotClock) used to let the movie-export code take over the mascot's own animation loop and drive it frame-by-frame in file-time instead of wall-clock time, so exports play the creature at true speed regardless of how long rendering actually took on the machine doing it.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: My prediction assumed a generic testable time-provider (Date.now wrapper); the actual purpose — synchronizing a live animation loop to an export's frame time via hold/step/release — is a much more specific and non-obvious design that only the docstring reveals.

### `setMascotClock`
- spec 3 · read at `27aad1144c3a` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:50Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Just assigns the given clock (or null) to a module-level variable, presumably named mascotClock, so other code can look it up later via the peer export.
- found: Assigns the argument to a module-level `current` variable.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `mascotClock`
- spec 3 · read at `37b3fba49ae9` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:04Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A trivial getter that returns a module-level variable (set elsewhere by setMascotClock) holding the current MascotClock instance/creature driving the mascot hub, or null if none is currently active.
- found: Trivial getter returning the module-level `current` variable, presumably set by setMascotClock.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/monster.ts

### the file itself
- spec 3 · read at `aafd01a92733` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:59Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A small localStorage persistence utility for a per-project "monster" (likely a playful mascot/pet UI element tied to each project's key). keyFor builds the storage key from a project identifier, storedMonster reads and deserializes the saved monster state for that key, saveMonster serializes and writes it, and forgetMonster removes it — no business logic beyond simple get/set/delete against localStorage.
- found: localStorage persistence for a per-project mascot/creature blueprint: keyFor builds the key from project path, storedMonster/saveMonster/forgetMonster read/write/delete it, all with silent failure handling. Deliberately excludes minting a new creature (that lives in a separate heavy three.js bundle loaded lazily by MascotFigure) so this lightweight file can be imported by the always-visible sidebar without pulling in 1.2MB of three.js.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: Docs (none present as a header, only per-function JSDoc) explained something the file's shape already implied (no mint function present) plus a bundle-size rationale that wasn't derivable from code alone.

### `keyFor`
- spec 3 · read at `b6c7a2957f27` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns a localStorage/cache key string built from the project path, e.g. `monster:${project}`, falling back to a fixed sentinel string when project is null/undefined so all no-project windows resolve to the same stored creature.
- found: Concatenates a module-level PREFIX constant with the project path, defaulting to empty string when project is null/undefined, so all no-project windows share one key.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `storedMonster`
- spec 3 · read at `a0347f090540` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:34Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes a localStorage key via keyFor(project), tries to read and JSON.parse the stored value, wrapped in a try/catch so any error (storage unavailable, corrupt JSON, missing key) returns null rather than throwing.
- found: Reads localStorage at keyFor(project), JSON.parses it if present, and returns null on any failure (missing key or thrown error) via try/catch.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: None.

### `saveMonster`
- spec 3 · read at `40ed68247741` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:40Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes a localStorage key via keyFor(project) (probably returning early/no-op if project is null/undefined), JSON.stringifies `config`, and writes it to localStorage inside a try/catch that silently swallows any error (e.g. quota exceeded or storage unavailable), since the docs say failure is not worth surfacing.
- found: Writes JSON.stringify(config) to localStorage under keyFor(project), swallowing any error silently.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `forgetMonster`
- spec 3 · read at `9533540c82f7` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:49Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the storage key for `project` via keyFor and removes it from localStorage (or whatever storage backs saveMonster/storedMonster), so the next call to look up this project's monster finds nothing and mints a fresh one instead of reusing the old blueprint.
- found: Removes the localStorage entry for keyFor(project), wrapped in a try/catch that silently no-ops if storage is unavailable.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/movie.ts

### the file itself
- spec 3 · served in 2 parts · read at `d862f458162f` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:59Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Implements the export-to-movie pipeline for HistoryBar/ExportDialog: a Shot class draws one frame of the replay onto an offscreen canvas (map/wedges, caption, legend, timeline, signature/watermark), reading CSS custom-property colors via varCss/ink/faceCss/background so the recording matches the live theme. Surrounding functions (settings, preflight, probe, record, encoded, base64) drive a MediaRecorder-style capture loop: checking codec/capability support, stepping through frames, recording them, producing a base64-encoded video blob for download.
- found: Confirmed the core architecture: Shot rasterizes the live SVG per commit onto a base canvas (caption/legend/timeline/signature drawn in Canvas2D reading resolved CSS custom properties), then composites the WebGL mascot creature per output frame, and record() drives the frame loop, calling ensure/setIndex/settle to advance the app's own state before rastering. Missed the actual encoding stack: not MediaRecorder but the mediabunny library using WebCodecs directly, with an explicit preflight/probe step that tries H.264 then H.265 by actually encoding 10 blank frames (since canEncodeVideo lies), a within() timeout wrapper around every awaited step to detect encoder/decoder hangs, and detailed five-stage (fetch/fold/raster/draw/encode) progress/cost reporting. base64/encoded() is indeed for handing the finished MP4 bytes to Rust.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `mapRect`
- spec 3 · read at `e7e68e2675f3` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:22:39Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the square region for the map within a width×height frame: calls mapSide(height) (or similar) to get the side length as 0.72 of the frame height, then returns {x, y, side} with x placing it right-aligned (x = width - side, or width - side - some margin) and y vertically centered ((height - side) / 2), leaving the remaining left-hand column for the caption.
- found: Computes side = height*(1-2*PAD), x = width - height*PAD - side (right-aligned with a PAD margin), y = (height-side)/2 (vertically centered); returns {x, y, side}.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The side/x math is done inline with a PAD constant rather than delegating to the peer mapSide, which I'd assumed it called.

### `mapSide` — QUIRKY
- spec 3 · read at `2f803f5cc5cd` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:22:52Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns Math.round(height * (1 - 2 * PAD)) — the same side-length formula used inline in mapRect, extracted as its own export so callers like ExportDialog can report the layout size without needing the full rect.
- found: Delegates to mapRect(height*ASPECT, height).side — reconstructs a full 16:9 frame from the height alone (using the ASPECT constant) and reuses mapRect's own side computation, rather than duplicating the PAD formula.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I had the delegation direction backwards — mapSide calls mapRect, not the other way around — and didn't know about the ASPECT constant it uses to reconstruct a full frame from just a height.

### `ink`
- spec 3 · read at `4bb5b17e7502` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:23:02Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Calls getComputedStyle(from).getPropertyValue(name).trim() to read a CSS custom property's resolved value off the given element (the staged SVG/pane during export), returning it as a plain color string usable in Canvas2D fillStyle.
- found: getComputedStyle(from).getPropertyValue(name).trim() — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `base64`
- spec 3 · read at `679d78a3ef04` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Converts a Uint8Array to a base64 string. Avoids String.fromCharCode.apply(null, bytes) on large arrays (which throws due to argument/stack limits) by processing bytes in fixed-size chunks, building up a binary string piece by piece, then calling btoa on the concatenated result.
- found: Chunks the byte array in 0x8000-byte slices, converts each chunk with String.fromCharCode(...chunk) to avoid exceeding the call-stack/argument limit, concatenates into a binary string, then base64-encodes with btoa.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `faceCss`
- spec 3 · read at `609a08282997` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Fetches @font-face CSS declarations and inlines the referenced font file(s) as base64 data URIs (likely using the base64 and varCss helpers), returning a self-contained CSS string so fonts render correctly in an offscreen/exported canvas snapshot used when recording a "shot" or movie of the UI.
- found: Fetches each font file listed in FACES, base64-encodes it, and builds an @font-face CSS rule embedding it as a data URI (woff2) for the 'LINE Seed JP' family at each weight, joining all rules into one CSS string.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `varCss`
- spec 3 · read at `4a1f19053778` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:01Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks the document's stylesheets to collect every custom property name (--foo) declared anywhere, then uses getComputedStyle(from) to resolve each to its current value given whatever theme is active, and returns a CSS string (e.g. a `:root { --foo: value; ... }` block or inline style text) that can be attached to the cloned/exported element so its var() references still resolve without needing the original stylesheets.
- found: Collects all `--foo` custom property names by regex-scanning every stylesheet's cssText (skipping cross-origin sheets that throw), resolves each via getComputedStyle(from) — deliberately the passed element rather than `<html>`, since the export stages its ground on the pane — and emits a single `svg{ --foo:val; ... }` rule string.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `background`
- spec 3 · read at `0653551529f0` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:54Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Reads the `--background` custom property off getComputedStyle(from) and returns it trimmed, defaulting to reading it from the document root but accepting a specific element since the ground can be staged on the pane rather than globally during a recording.
- found: Reads and trims the `--background` custom property via getComputedStyle(from), falling back to `#fff` if empty.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `constructor` — QUIRKY
- spec 3 · read at `5d076a57b010` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:43Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This constructor mostly just assigns its constructor-parameter fields (svg, w, h, bg are already parameter-properties) and manually stores title/scope since those aren't marked private in the signature, plus perhaps injects the passed style string into a <style> element inside the SVG so each exported frame carries its own CSS rather than depending on the live document.
- found: No CSS injection into the SVG — instead it computes the map layout rect via mapRect(w,h), creates two off-screen canvases (main + base) sized w×h, grabs their 2D contexts, and throws if either context is unavailable. I also misread title/scope as not being parameter-properties when they actually are (marked private), so I invented a manual-assignment step that doesn't exist.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `target`
- spec 3 · read at `89dc2df62df9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:37Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Simple getter returning a stored canvas element field on the Shot instance, the HTMLCanvasElement this Shot draws to — no computation involved.
- found: Exactly as predicted: returns this.canvas.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `draw` — QUIRKY
- spec 3 · read at `a53a123488df` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:03Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Stores the given Playhead as this.at, then rebuilds the whole static frame onto the base canvas from scratch: clears/draws the background, renders the sunburst map at the current commit state, draws the caption, column, legend and signature, and calls this.timeline() to draw the scrub bar. It's async because it likely awaits loading an image/icon (creature) or some other asynchronous resource before compositing.
- found: Rasterizes the live SVG map by cloning it, sizing/styling the clone for export, serializing to a blob URL, and loading it as an Image with a decode() call raced against a timeout (worked around a WebKit bug where decode() can hang forever); once decoded, draws background + the map image onto the base canvas, then calls caption/timeline/legend/signature to composite the rest of the frame, revoking the blob URL in a finally block.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `frame`
- spec 3 · read at `65322ab9b269` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:08Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Draws the current base frame (e.g. via this.draw()) onto the output canvas, then checks whether there's a mascot/creature to composite; if so it computes its position from the current viewBox and hub box (not from the live DOM transform) and draws the creature canvas on top via this.creature(), silently skipping if no creature exists yet. Likely also encodes/stamps the resulting frame for the video via the encoder.
- found: Draws the precomposited base image onto the canvas context, then calls this.creature() to composite the mascot on top — all the positioning/silent-when-absent logic described in the docs lives inside creature(), not here.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs are almost entirely about what creature() does internally; frame() itself is just the two-line call site.

### `creature`
- spec 3 · read at `1cb5f5e22d7f` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:21:53Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Draws the WebGL mascot canvas composited on top of the base map frame, since the mascot lives outside the SVG and cloning the SVG doesn't carry it. It reads the mascot canvas's DOM position relative to the hub layer, computes an equivalent position/scale in the export's coordinate space using the SVG viewBox and map rect, and drawImages the mascot canvas onto the frame's context at that computed location; it's a no-op if no mascot canvas is present.
- found: Finds the mascot's DOM canvas and hub layer, computes a scale from the SVG viewBox to the export's map rect, then derives the canvas's on-screen offset relative to its layer box (accounting for the sprite's internal "lift" offset) via getBoundingClientRect ratios, and drawImages it onto the frame at the computed position/size; no-ops if there's no mascot canvas.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: Already read this exact function body verbatim as part of the movie.ts whole-file reveal a couple tasks earlier, so this was a warm/recall reading, not a cold prediction.

### `column`
- spec 3 · read at `9a0d12e04439` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes the horizontal region reserved for the caption — the area to the left of the map. Returns `left` as the frame's margin offset and `room` as the available width between that margin and where the map begins (map's left edge minus margin), so caption text knows where it can be drawn without overlapping the map.
- found: Computes left as 2x a padding value derived from frame height, and room as the distance from that left edge to the map's x position minus one pad — i.e. the caption column's position and available width.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `caption` — QUIRKY — TANGLED
- spec 3 · read at `1b97535cae9d` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A private method on the `Shot` class that draws a text caption (likely the repo/slug/scope name, and possibly the current date) onto the canvas at a fixed position using ctx.fillText, styled via CSS variables (see `varCss`/`faceCss` peers) — probably the title/header area of the exported movie frame, separate from `signature` and `timeline` which draw other overlay elements.
- found: Draws the title block onto the canvas: splits `this.title` into owner/name, computes available room via `column()`, and dynamically shrinks font size to fit either an inline "owner name" layout or falls back to a stacked layout with owner above name — never eliding text, only shrinking it (with a hard floor). Also draws an optional scope (drilled path) line beneath the name, sized independently, and records the resulting bounding box in `this.rule` for later use (presumably by `timeline`/`signature`).
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

### `legend` — QUIRKY — TANGLED
- spec 3 · read at `08de76ed109f` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Draws the lens/legend key onto the canvas, anchored to the bottom of the caption column area rather than stacked dynamically under the caption. It measures the key content, checks whether it would overlap the caption block, and skips drawing entirely if there isn't room, computing position from the shot's existing layout (column/caption bounds) and calling a draw/text-rendering primitive for each row.
- found: Draws a legend/key in the space between the title-date block and the byline, centered by baseline in that gap. It computes how many rows fit, lays entries out in up to 4 columns sized to the widest label, truncates with a "+N more" indicator if there isn't room for all entries, or (for a ramp-type key) draws a 5-swatch gradient bar with low/high end labels instead of a list.
- predicted: some · documented: most · derivable: no · legible: some · trap: no

### `signature`
- spec 3 · read at `5748c3e6361f` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Draws the byline/signature text (the instrument/author name) onto the canvas at a fixed vertical offset below the date block, within the column. It likely sets font/alignment (probably bottom or middle aligned) and renders a string via ctx.fillText, positioned above the legend block.
- found: Draws the fixed SIGNATURE constant left-aligned at a computed baseline near the bottom of the canvas, using a small muted-foreground font colored via CSS var fallback chain.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `timeline`
- spec 3 · read at `11e75abd2b46` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Draws a scrub-bar rule on the shot's canvas, filling it up to the current commit's fraction of the total commit count. Labels one end with the commit's own date and the other with its ordinal/number, except for frames before the window (the opening state) where no date is drawn since none can be honestly claimed. It reads canvas dimensions/styles from helpers like varCss and only redraws when called (i.e. when the playhead actually moves, per record).
- found: Draws a muted background rule plus an accent-colored fill proportional to progress through the commit list, then labels the left end with the formatted commit timestamp (via stamp) and the right end with "current / total" commit counts.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `round` — QUIRKY
- spec 3 · read at `454635e06be1` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Draws a short horizontal bar using a canvas stroked line with ctx.lineCap set to 'round': moves to (x, y) and strokes a line to (x+w, y) with lineWidth = h, so the rounded end caps produce a pill-shaped bar rather than a sharp-edged rectangle.
- found: Draws a filled rounded-rectangle/pill shape at (x,y) sized w×h using four arcTo calls with corner radius h/2, then fills the closed path — not a stroked round-capped line as I guessed.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc's mention of 'caps' made me predict a stroke+lineCap approach; actual implementation is a filled arcTo path, which achieves the same pill look but works differently (e.g. behaves correctly with any fillStyle/alpha, no stroke state needed).

### `stamp`
- spec 3 · read at `32c58c4d592a` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:22:04Z · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Formats a commit timestamp (seconds since epoch) as a locale date string including the year, month, and day, for display under the timeline in the exported movie; returns a fallback string like "before this history" when ts is null (for frames before the export window).
- found: Exactly as predicted: null returns 'before this history', otherwise formats as a locale date string with year/month/day.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Already read this exact function in the earlier movie.ts whole-file reveal, so this is a warm/recall reading.

### `within`
- spec 3 · read at `f598d9fd28de` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:15Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Races `work` against a timer of `limit` milliseconds; if the timer fires first, rejects with an Error whose message incorporates `whenNot` (naming what failed to happen in time), otherwise resolves/rejects with whatever `work` does. Implemented via Promise.race with a setTimeout-based timeout promise, probably clearing the timeout on success to avoid leaking a dangling timer.
- found: Races `work` against a setTimeout(limit) that rejects with new Error(whenNot); clears the timer via .finally() on the work promise so it doesn't linger after work settles.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `settle`
- spec 3 · read at `fcf1c7023e63` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:44Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns a Promise that resolves after two chained requestAnimationFrame calls, giving React time to commit the DOM update and the browser to paint before the caller reads back the frame.
- found: Two nested requestAnimationFrame calls resolving a Promise, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `settings` — QUIRKY
- spec 3 · read at `c4117a755b56` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:39Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns the encoder config object (bitrate derived from quality via preferBitrate, codec, latencyMode: 'realtime') used both by the preflight check and the actual recording, so the two paths can't drift apart.
- found: Just packages codec, quality, and latencyMode: 'realtime' into a plain object — no bitrate derivation, quality is passed through as-is.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I expected a preferBitrate conversion mentioned in the file doc to happen here, but this function is just the trivial object literal; the actual quality-to-bitrate logic must live elsewhere (or inside mediabunny's Quality type).

### `probe`
- spec 3 · read at `c9ebc1ef3f14` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:14Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Sets up a real mediabunny output/encoder with the given width/height/encoding config, feeds it ten blank (e.g. black canvas) frames, and finalizes/closes it — resolving if the whole pipeline actually produces output, and letting any thrown error (from WebCodecs or mediabunny) propagate up uncaught so the caller (preflight) can just try the next codec without needing to know why this one failed.
- found: Draws a background-filled canvas, builds a real mediabunny Output/CanvasSource/Mp4OutputFormat/BufferTarget pipeline with the given encoding, and wraps start/each of 10 frame adds/finalize in `within(..., PREFLIGHT_LIMIT, slow)` so a codec that hangs rather than errors still fails with a clear message; always cancels the output afterward since only the pass/fail verdict matters, not the produced bytes.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The `within` timeout wrapper is the key detail the doc/signature don't hint at — this guards against codecs that hang silently instead of throwing.

### `preflight`
- spec 3 · read at `9e5e446fdd2b` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:00Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over candidate codec configurations (probably from `settings`/`probe` helpers) for the given width/height/quality, checking each with something like canEncodeVideo, but since that check can lie, it likely actually attempts a real encode (via `record`/`encoded`) to confirm a packet is produced. Returns the settings object for the first codec that truly works, and throws/returns an app-authored error message (not WebCodecs' raw error) if none do.
- found: Loops through CODECS, building settings via settings(quality, codec) and calling probe(width, height, encoding, deps) to actually try it; returns the first settings that don't throw. If all codecs fail, throws a custom Error naming all tried codecs and the resolution, telling the user to try a smaller resolution — deliberately not surfacing WebCodecs' own error message, matching the doc's point about the refusal being "the app's own sentence."
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `record`
- spec 3 · read at `1a5d0ebfaae6` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Loops over every output frame (total = duration * FPS), maps frame index to a commit index in the replay, and only re-renders the Shot (calling its draw/frame/creature/column/caption/legend/timeline methods) when the commit under the playhead changes from the previous frame — otherwise reuses the last rendered bitmap. Each frame is fed to a video encoder, and once all frames are done the function finalizes/muxes and returns the resulting MP4 as a Uint8Array.
- found: Sets up an mp4 muxer (mediabunny) with codec preflight, loads fonts, builds a Shot renderer off the live sunburst SVG, then for each output frame maps frame index to a commit position, only re-fetches/folds/rasterizes the map when the commit actually changes, steps the mascot's own clock and draws every frame regardless, encodes each frame, reports detailed timing/cost/ETA, and finalizes to return the MP4 bytes. Handles cancellation and always releases the mascot clock hold.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The per-stage cost accounting (fetch/fold/raster/draw/encode) used to estimate remaining time is intricate and not derivable from the doc comment alone.

### `encoded`
- spec 3 · read at `f3a2a05b43bb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:40Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a Uint8Array of binary movie/image data into a base64-encoded string, likely delegating to the peer `base64` helper function, so it can be sent as a JSON-safe string over the Tauri invoke bridge to Rust for writing to disk.
- found: Thin exported wrapper delegating to the base64() peer function on the given bytes.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/palette.ts

### the file itself
- spec 3 · read at `cc2669823cee` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:55Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small persistence/labeling utility for the categorical-color "cap" setting — doesn't compute actual colors or cap values themselves (those live in colorMode.ts's CAPS), but provides KEY (storage key per lens), loadCap/saveCap (localStorage read/write), isCapped (type guard/check for whether a mode supports capping), and capLabel (human-readable label for the current cap). Whole responsibility is remembering and describing the user's per-lens cap choice across sessions.
- found: Matches prediction on overall shape (persistence + labeling for per-lens color cap, thin, quiet-failure-on-storage-unavailable). Missed one behavior: loadCap doesn't just return the stored value, it snaps an out-of-range stored value to the nearest valid step in CAPS, and handles Infinity specially via string round-tripping.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc explains the design rationale (why per-lens not per-project) in real depth that isn't derivable from code alone — this is a case where the comment genuinely earns its place.

### `isCapped`
- spec 3 · read at `5b698452b0aa` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:35Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A type guard checking whether the given ColorMode is one of the categorical lenses that has a color cap (like 'blame' or 'language'), as opposed to a continuous/non-categorical mode. Likely implemented as a simple equality check or Set.has against one or two known mode string literals.
- found: Exactly a type guard checking mode === 'blame' || mode === 'language', matching the prediction precisely.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `capLabel`
- spec 3 · read at `f97e83570e07` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: capLabel(cap) returns "all" when cap === Infinity, otherwise returns the number stringified (e.g. String(cap)), matching the doc's note that Infinity is displayed as "all" rather than a numeral or "∞".
- found: Exactly as predicted: Number.isFinite(cap) ? String(cap) : 'all'.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `KEY`
- spec 3 · read at `54507eb54226` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:49:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds the localStorage key string used to persist/retrieve the per-lens color cap, parameterized by `mode` (e.g. `palette-cap-${mode}`), so `loadCap`/`saveCap` can store a separate value per lens (blame vs language).
- found: Builds a namespaced storage key string `sanity.colors.${mode}`, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `loadCap`
- spec 3 · read at `03a27b893e54` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:47:51Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads the stored cap value for `mode` from localStorage (keyed via KEY), parses it as a number, and if it exists but falls outside this build's valid step range, clamps/snaps it to the nearest allowed step rather than discarding it; if nothing is stored, returns a default cap for that mode.
- found: Reads the stored raw value for `mode`, returns CAP_DEFAULT if missing or non-finite (including Infinity), otherwise snaps it to the nearest finite value in CAPS via a reduce; wrapped in try/catch to fall back to CAP_DEFAULT if storage throws.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains only the philosophy of snapping vs refusing, not the Infinity-as-default or try/catch details.

### `saveCap`
- spec 3 · read at `a798f63a3134` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:47:08Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Persists the given cap (max number of categorical colors) for the given lens mode (e.g. blame vs language) to localStorage, keyed per-mode via KEY(mode), so loadCap can restore it in a future session.
- found: Writes the cap to localStorage under a per-mode key, serializing Infinity as the literal string "Infinity" (since round-tripping via Number() only works for that exact spelling) and swallowing any storage errors so a failed write just means the preference won't survive a restart.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The docs shown describe the file/type-level concept of per-lens caps, not this specific function's localStorage/Infinity-serialization behavior.

## web/src/lib/rim.ts

### the file itself
- spec 3 · read at `c3896db548ad` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:50:05Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small, framework-free module holding the arithmetic for turning a directory's distribution of contributions (e.g. lines per author) into drawable band segments for a rim/sunburst chart — computing each band's width/share and handling the merging of small entries into a single tail run, including what that merged run should be labeled/captioned. Its main export is `rimRuns`, called by the Sunburst component (which keeps only the geometry/rendering) and checked by scripts/rim-check.ts.
- found: A framework-free module exporting rimRuns, which turns a directory's slice distribution into drawn Run bands: it merges sub-pixel/under-floor segments into adjacent runs (never dropping them), distinguishes categorical merges (which go neutral and just report a count) from ramped merges (which keep the largest member's color but still report a count), and computes each run's angular span (a0/a1) proportional to its share of the total.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc header is unusually thorough — it explains not just what the code does but the specific historical bug (kibana x-pack overstated/mislabeled band) that justified each design choice, which code alone would not convey.

### `rimRuns`
- spec 3 · read at `6015298c3da4` · commit `db7b69c` · read by claude-sonnet-5 · via claude · when 2026-08-30T07:47:19Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Converts a directory's slice values into angular segments across [a0,a1], then walks them in order merging any run of adjacent segments narrower than floor into a single combined segment (summing widths so total angle is preserved). For a merged run, color/label differ by names: a ramp-like merge keeps the largest member's color, while a categorical merge (names true) uses a neutral "other" label/color and reports how many members it holds. Returns {runs, total}, or null if nothing to draw.
- found: Builds runs by walking slices in order, starting a new run whenever a segment is itself wide enough (>= floor) or the previous run was not merged; a run that started under-floor keeps absorbing subsequent segments regardless of their own width, tracking the widest member's color/label. After merging, any categorical (names=true) run with 2+ members gets relabeled to a neutral "N others" swatch. Finally assigns a0/a1 angles proportionally over the merged runs so total angle is preserved. Returns null for empty slices or zero total.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

## web/src/lib/rings.ts

### the file itself
- spec 3 · read at `6acd32bad795` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:48Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small config/persistence file for the sunburst visualization's ring depth setting: it defines a default ring count and exports loadRings/saveRings functions that read and write that user-adjustable number (likely via localStorage), rather than computing anything about the tree itself.
- found: Defines the sunburst's ring-depth preference: RINGS_DEFAULT/RANGE/MIN/MAX constants, and loadRings/saveRings which persist a user's chosen ring count to localStorage under 'sanity.rings', clamping stored values into range and failing silently if storage is unavailable.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `loadRings`
- spec 3 · read at `ba1899fb4dda` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:27Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Reads a stored ring-count preference (likely from localStorage), parses it, and clamps it into the valid RINGS_RANGE before returning; falls back to RINGS_DEFAULT if nothing is stored or the value is invalid/unparseable.
- found: Reads the value from localStorage under `KEY`, and if it's a finite positive number, clamps it (rounded) between RINGS_MIN and RINGS_MAX. Falls back to RINGS_DEFAULT if unset, invalid, or if localStorage throws (e.g. disabled storage).
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `saveRings`
- spec 3 · read at `82ee705f2a1e` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:11Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: saveRings(n) persists the chosen ring count to localStorage (or similar), likely under a fixed key, so the next load can call loadRings to restore the user's chosen depth; probably wrapped in a try/catch in case storage is unavailable.
- found: Writes the ring count to localStorage under KEY, wrapped in try/catch that silently swallows failure (the preference simply doesn't persist).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## web/src/lib/runtime.ts

### the file itself
- spec 2 · read at `fe42178ca3d5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A small runtime-detection module exporting isTauri() (checks for a global like window.__TAURI__ without static-importing @tauri-apps/api), isMac() (checks navigator.platform/userAgent), isTauriMac() (combines both), and onFullscreenChange() which lazily/dynamically imports the Tauri API only when actually running inside Tauri to subscribe to fullscreen events, falling back to a plain DOM fullscreenchange listener in browser mode.
- found: Detects Tauri via window.__TAURI_INTERNALS__, isMac via userAgent, isTauriMac combines them (guards traffic-light gutter space), and onFullscreenChange is a no-op outside Tauri-Mac but otherwise lazily imports @tauri-apps/api/window and polls fullscreen state off the window's resize event (not a DOM fullscreenchange listener) to keep the reserved traffic-light gutter in sync.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: I assumed a plain-browser DOM fullscreenchange fallback existed; instead it's a pure no-op outside Tauri-Mac, and the live-tracking is driven by window resize rather than a fullscreen event.

### `isTauri`
- spec 2 · read at `33a9a1078966` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:57Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns whether a Tauri-specific global (like window.__TAURI__ or window.__TAURI_INTERNALS__) exists on the window object, without importing the Tauri API module — a cheap presence check usable in both desktop and plain-browser bundles.
- found: Checks typeof window !== 'undefined' and '__TAURI_INTERNALS__' in window.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Guessed the exact global name (__TAURI_INTERNALS__) among a couple plausible options and also predicted the SSR-safety typeof window check.

### `isMac`
- spec 2 · read at `18634f7d04cb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:51Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Checks navigator.platform (or navigator.userAgent) for a substring like 'Mac' and returns a boolean — a simple one-liner used to decide whether to render Mac-style traffic-light window chrome vs other OS chrome.
- found: Guards for navigator being undefined (SSR/non-browser), then regex-tests userAgent for Mac, iPhone, or iPad.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `isTauriMac`
- spec 2 · read at `cd44802ba44b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function returning `isTauri() && isMac()` — combining the two peer checks to detect the specific case of running inside the Tauri shell on macOS.
- found: Returns isTauri() && isMac(), exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onFullscreenChange`
- spec 2 · read at `3bca05eb1d24` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:38Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Dynamically imports the Tauri window API (to avoid a module-load-time dependency), gets the current window, subscribes to its resize event, and on each resize checks isFullscreen() and calls `cb` with the boolean result. Returns a cleanup function that unsubscribes the listener (likely async, since Tauri's listen() returns a promise for an unlisten function).
- found: No-ops outside Tauri-on-Mac. Otherwise dynamically imports the window API, reads fullscreen state immediately and on every resize, calling cb each time; tracks a `dead` flag so if the returned cleanup fires before the async setup finishes, the just-obtained unlisten function is invoked right away instead of leaking, and future reads are suppressed.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the isTauriMac() gate and the initial synchronous read() before the first resize; also missed the dead-flag race handling for early unsubscribe.

## web/src/lib/shape.ts

### the file itself
- spec 3 · read at `fbcc82d43fcd` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file handles an early "shape" event streamed from the Rust scanner — a lightweight signal of the directory/file layout (paths and sizes) that arrives before functions are parsed and scored. `dirNode` builds a placeholder directory Node, `shapeTree` assembles the partial tree from the shape data, and `onScanShape` is the event handler that wires this into the frontend so the sunburst can render its skeleton immediately while the real scan (with scores) is still running.
- found: Streams a "scan-shape" Tauri event carrying file paths/langs/function names+sizes before scoring completes, and shapeTree folds the accumulated batch into a placeholder gray Node tree (dirNode builds empty-score dir/file/func nodes) with careful dedup-by-latest-path and ordinal-suffixed ids to avoid React key collisions on duplicate function names, then sums sizes up the ancestry.
- predicted: full · documented: none · derivable: no · legible: not judged · trap: no
- note: Since docs was empty at the file-task level but the actual file has a rich header doc plus per-function docs, `documented`/`derivable` here reflect that the file-level `docs` field handed to me was empty even though the code itself is heavily commented.

### `onScanShape`
- spec 3 · read at `397f67f53a75` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri backend event (something like "scan-shape") via listen, invoking cb(project, files) with the event payload when it fires, and returns an unsubscribe/unlisten function to remove the listener.
- found: Listens for the Tauri 'scan-shape' event, calling cb with project and files from the payload; returns a function that unlistens (handling the async listen() promise).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `dirNode` — QUIRKY
- spec 3 · read at `a664ef42bf14` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:41:42Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: `dirNode` looks like a small factory that builds a bare `Node` object for the tree shape — given a `path`, display `name`, and whether it's a `dir` or `file`, it returns an object with those fields plus sensible defaults (like an empty `children` array for dirs, zeroed score/count/value fields) ready to be filled in as the tree is built by `shapeTree`/`onScanShape`.
- found: Builds a bare Node with id/name/kind/path set and every other field (loc, line ranges, bytes, lang, excluded, lastAuthor, doc, signature, owner, score, body, hotspots, and a large set of call-graph/clone-detection fields like callers/calls/incident/away/resolvable/orphans/sinks/cloneGroup/cloneSize/comparable/copied) explicitly nulled/zeroed/emptied, with children:[] and funcs:0 — a comment explains the call-graph fields are null (not zero) because streaming scan results haven't wired cross-file edges yet.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `shapeTree` — QUIRKY — TANGLED
- spec 3 · read at `f09cd05a78a4` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:04Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a fresh root Node named `repoName`, then for each file in `files` splits its path into directory segments and walks/creates intermediate directory nodes (via the `dirNode` peer helper) as children, attaching the file itself as a leaf child of its parent directory. After inserting all files it sums `loc` up the ancestry so every directory node's size is the total of its descendants, leaving `score` unset everywhere (so unscored nodes render as neutral).
- found: Dedupes files by path (last one wins, for re-streamed scans), builds directory nodes lazily via a path→Node map, attaches each file as a leaf with per-function child nodes (disambiguated with an ordinal suffix when a file has same-named functions, e.g. from #ifdef branches), accumulates loc up through file and directory ancestry, and leaves score unset.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Missed the dedup-by-path step and the per-function leaf nodes with duplicate-name ordinal disambiguation entirely — assumed files were leaves with no children.

## web/src/lib/splash.ts

### the file itself
- spec 2 · read at `1fe713949d2b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A tiny module with one exported function, dismissSplash, that hides/removes the app's startup splash screen element (likely by id) once the real UI is ready — probably toggling a class or display style, maybe with a fade transition, and possibly guarding against calling it more than once.
- found: Idempotent dismissSplash() (module-level `gone` flag) fades the #splash element via a CSS class then removes it from the DOM after a 400ms timeout so it can't linger and swallow clicks; called both when the app has real content to show and by a timeout cap elsewhere in case readiness never arrives.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Got the mechanics right (idempotent, fade+remove) but missed the deeper rationale in the docs: it's timed to "has something to say" rather than first paint, and is deliberately raced by two callers.

### `dismissSplash`
- spec 2 · read at `cc88d07e92b6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:37Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Finds the splash screen DOM element and hides or removes it, likely via a CSS class toggle or fade-out animation, marking it as dismissed so it won't show again this session.
- found: Guards against double-dismissal with a module-level `gone` flag, finds #splash, adds an 'is-gone' class to trigger a fade, then removes the element from the DOM after a fixed 400ms timeout (as a safety net in case the CSS transition never fires).
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The setTimeout-based removal (rather than transitionend) is explained by an inline comment as a deliberate safety net against clicks being swallowed.

## web/src/lib/stopwatch.ts

### the file itself
- spec 3 · read at `956f3a683199` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A tiny timing utility exporting mark() to record a timestamp/checkpoint and marked() to compute elapsed time since a given mark, used for lightweight perf instrumentation like logging scan duration. No file header doc.
- found: Dev-only frontend timing instrument: mark() records named timestamps relative to page load (once each, no-op in prod), and marked() is called once when the first map paints — it adds a final 'painted' mark (deferred a frame for actual browser paint) and console.logs all marks as one line, then goes silent.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `mark`
- spec 3 · read at `0ed9e38656e5` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:44Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Records the current time (performance.now() or Date.now()) into a module-level map/store keyed by the `what` label, so a later call to `marked` can compute elapsed time since this mark was set — a lightweight manual timing utility.
- found: Records performance.now() into a module-level map `at` keyed by `what`, but only in dev mode, only once per key (skips if already set), and not at all once some global `done` flag is set.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No docs at all on this function; the dev-only gate and the "done" latch that stops marking entirely aren't discoverable without reading the body or the rest of the file.

### `marked` — QUIRKY
- spec 3 · read at `b5cc07ba3800` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:51Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Called once when the first sunburst/map paints on screen; it checks whether it's already fired (a guard flag), and if not, calls mark() to get the elapsed time since the stopwatch started, console.logs a "time to first map" line, and sets the guard so subsequent calls are no-ops.
- found: Dev-only, fire-once guard (`done`). Schedules a requestAnimationFrame callback so timing reflects actual paint rather than React handoff; records a 'painted' timestamp into the shared `at` Map, then logs all accumulated marks (name + ms) joined into one console line.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/sunburst.ts

### the file itself
- spec 3 · served in 2 parts · read at `d29118dbd0ff` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:08Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The pure-geometry/layout engine for the app's central sunburst visualization — turning the scored repo tree into concentric arc wedges (files/directories sized by lines, colored via `heatOf` from surprise scores), with `layout`/`arcPath`/`aggregate`/`vOf`/`rOf` computing positions and rolling up values, and `worstRatio`/`rowPlacement`/`tileFunctions`/`sliceFunctions` implementing a squarified-treemap-like placement for functions inside a wedge's inner ring, plus `labelArc` for positioning readable text along a curved arc.
- found: Exactly as predicted: `layout` partitions the tree into radial wedges sized by lines (or heat/even), `arcPath` draws annular sectors as SVG paths, `aggregate` builds a synthetic roll-up Node for functions that don't fit, `vOf`/`rOf` convert between radius and an area-preserving coordinate so a squarified treemap (`worstRatio`/`rowPlacement`/`tileFunctions`) can tile a file's functions by area inside its wedge (with floor/stretch/promotion logic to keep hot short functions visible), `sliceFunctions` does the angular equivalent for a drilled-into file view, and `labelArc` builds a text-path arc that flips direction in the bottom half so labels stay upright. I underweighted just how much intricate floor/promotion/stretch budget logic tileFunctions contains, but got every function's role and the overall geometric strategy (area-preserving radius transform, squarified treemap for the inner ring) right.
- predicted: full · documented: none · derivable: no · legible: not judged · trap: no

### `heatOf` — QUIRKY
- spec 2 · read at `72fdba84ea74` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:14Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Small accessor returning a node's heat/temperature score for sunburst coloring — reads n.heat (or similar field) directly if present, falling back to 0 or an aggregate (max/average of children) for directory/aggregate nodes without their own score.
- found: Returns 0 if the node has no score; otherwise returns either s.hotShare or s.surprise depending on whether showsShare(n) is true, selecting which numeric field represents "heat" for that node's display mode.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `layout` — QUIRKY — TANGLED
- spec 3 · read at `a547c73d8126` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:34Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree recursively (breadth capped at maxDepth), assigning each node an angular span proportional to its line count within its parent's span, and a ring/radius based on depth. Sorts children either biggest-first by size or by heat value depending on opts, then builds and returns a Layout object (probably a flat list or map of node->arc geometry) usable for rendering the sunburst.
- found: Recursively assigns angular wedges to nodes, sized by loc/heat/even weighting, starting at 9 o'clock clockwise. Handles collapsed directories by giving them a fixed-size "handle" angle (capped at half the ring), culls sub-minimum-angle wedges (except functions and handles) while tallying hidden file/dir counts for a summary, and returns wedges plus hidden counts and max depth.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: The collapsed-directory handle mechanism, thinness culling with hidden-count tallying, and the 9-o'clock start rationale were not derivable from the signature — much richer than a basic angle-by-size layout.

### `arcPath`
- spec 3 · read at `e48073887a6d` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the four corner points of the annular sector (inner/outer radius at start/end angle) by converting each angle to x/y via sin/cos, adjusted for clockwise-from-12-o'clock convention, determines the SVG large-arc-flag from whether a1-a0 exceeds pi, and returns an SVG path string with an outer arc, a line to the inner radius, an inner arc back, and a closing line, handling (or special-casing) the near-full-circle case to avoid a degenerate zero-length path.
- found: Converts the four corners of the annular sector to x/y via sin/cos (clockwise from 12 o'clock), computes the SVG large-arc-flag from a1-a0 > pi, and builds a path: move to inner-start, line to outer-start, outer arc to outer-end, line to inner-end, inner arc back to inner-start, close. Special-cases a near-full-circle span (can't be drawn as one arc since start/end coincide) by drawing two half-circle arcs for the outer ring and two for the inner ring instead.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `aggregate`
- spec 3 · read at `b0f97aea77b7` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:55Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a synthetic Node (the "rest" bucket) for functions in fns that couldn't be drawn individually — sums their loc, sets rest to the count/list of members, and computes score as the LOC-weighted mean across only the members that have actually been scored/read (not a neutral placeholder). id/name derived from filePath.
- found: Builds a synthetic 'func'-kind Node with id `${filePath}#/rest`, name `${count}+`, summed loc, and children set to the actual member fns (so the detail panel can list them). Score fields (surprise, documented, churn, ageDays, tangle, cognitive, hotShare, analyzedShare, etc.) are each LOC-weighted means computed only over members that were actually scored (source model/agent), with hotShare/analyzedShare specifically avoiding inheriting confidence from unread members.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `vOf`
- spec 2 · read at `52de10c15242` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:40Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function that computes v = r*r/2 (or r**2/2), the substitution described in the docs that turns annulus-sector area into a plain rectangular product for squarified tiling.
- found: Computes v = r*r/2, exactly the substitution the doc describes for area-preserving annulus-to-rectangle mapping.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The math derivation in the docs explains WHY this formula is correct in a way the one-liner alone would not — genuinely non-derivable rationale.

### `rOf`
- spec 2 · read at `10225c7853a6` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:29Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function that converts a value into a radius using a sqrt scale (Math.sqrt(v) times some radius constant), so that area rather than radius is proportional to the value in the sunburst chart.
- found: Sqrt scale converting a value to radius, but with a factor of 2 inside the sqrt rather than a separate multiplier constant — got the shape right but not the exact formula.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `worstRatio`
- spec 2 · read at `1380b267cb2f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:23Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates the array of {w,h} screen-space dimensions and, for each, computes max(w/h, h/w) — the aspect ratio away from 1 (square) — then returns the maximum of those across the whole array, i.e. the least-square cell in the row.
- found: Computes worst (max) aspect ratio deviation from square across dims, starting worst at 1, and short-circuits to Infinity if any dimension is zero or negative.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `rowPlacement`
- spec 2 · read at `c12261b3c923` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:32:36Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Implements a squarified-treemap-style row layout adapted to radial/polar coordinates: given items with precomputed areas and a target sector, computes a row thickness (angular band for radial rows, or stacked wedge otherwise) sized to fit the total area, divides the row into per-item Slots, and returns the slots plus each item's width/height (for squareness scoring) and how much of the sector's extent was consumed.
- found: Computes total area of items, then for radial rows divides angle proportionally at fixed radial thickness (dv), and for wedge rows divides radius proportionally at fixed angular width (da); builds Slots and w/h dims for each, returns consumed extent — matches predicted squarified-row layout.
- predicted: full · documented: most · derivable: no · legible: most · trap: no

### `tileFunctions` — QUIRKY — TANGLED
- spec 3 · read at `878259fa9e6b` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:52Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Treats the wedge (r0..r1, a0..a1) as a rectangle-equivalent area and runs a squarified-treemap-style algorithm (using worstRatio/rowPlacement helpers) to tile the file's functions by their size (lines) into sub-regions within that wedge, alternating between splitting along the radial and angular axes to keep aspect ratios reasonable. If there are too many functions to fit at a legible minimum size, it collapses the smallest/overflow ones into a single rollup slot, similar to the old floor-based overflow behavior, and returns an array of Slot objects each with computed r0/r1/a0/a1 bounds.
- found: Computes each function's proportional area share of the wedge; functions clearing a minimum-patch floor are shown directly, sub-floor ones go to a tail that's rolled up into an aggregate slot, except hot or near-floor ones which get promoted/lifted into their own patch (bounded by a max-stretch factor and available capacity). All shown members' 'wants' (own area, or floor, or roll-up minimum) are summed and the whole set is scaled to exactly fill the wedge area. Then a squarified-treemap row-placement loop (choosing radial vs angular row direction by whichever is the shorter side) lays out slots in file order, and finally tags the rollup slot with how many functions it represents.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: The doc/comments explain the reasoning well but the actual heat-vs-size promotion and want/scale normalization logic is much more elaborate than the top-level doc conveys — a reader needs the inline comments, not just the file doc, to reconstruct it.

### `sliceFunctions`
- spec 2 · read at `103298d152b8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Takes the function-level children of a file node and an angular range [a0, a1], and divides that range among them proportionally by line count (like a pie/sunburst slice), producing Wedge objects each with its own start/end angle — replacing fixed-radius radial-band stacking with something that scales to hundreds of functions.
- found: Divides angular range [a0,a1] among a file's function children proportionally by loc (or evenly if opts.even), with each slice guaranteed a minAngle floor. If the function count exceeds capacity (computed from span/minAngle), the lowest-heat functions are collapsed into a single aggregate wedge so the rest stay clickable/labellable rather than shrinking below floor.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Docs explained why (scaling past ~40 functions) but not the overflow-aggregation mechanism (ranking by heat, collapsing the tail into one Node via `aggregate`), which I missed entirely in my prediction.

### `labelArc`
- spec 3 · read at `6125784b3f83` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:44Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds an SVG arc path string (for use as a <textPath> d attribute) at radius r spanning angles a0 to a1. Computes the wedge's midpoint angle to decide if it's in the bottom half of the circle; if so, it swaps/reverses the start and end points so the arc is drawn in the opposite direction, keeping text upright instead of upside-down. fontSize is probably used to offset r slightly (e.g., centering the text vertically within the wedge band).
- found: Normalizes the midpoint angle to detect bottom-half wedges, flips arc direction for those to keep text upright, and offsets the radius by a font-size-scaled baseline correction (different constant depending on direction) to work around WebKit not honoring dominant-baseline:central on textPath content.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## web/src/lib/text.ts

### the file itself — QUIRKY
- spec 2 · read at `81445c50569e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:24Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small text-formatting utility module with two exported functions and no file header. `elide(str, maxLen)` truncates a string to a maximum length, appending an ellipsis ("…") when it's cut short, and returns the string unchanged if within bounds. `compactCount(n)` formats a number into a compact human-readable form for UI display (e.g. "1.2k", "3.4M") for things like counts/badges.
- found: elide() shortens a string by cutting out the MIDDLE and keeping both head and tail (weighted 65% to the tail) joined with an ellipsis, rather than truncating the end — designed for file paths where the tail (filename:line) matters most. compactCount() formats a number using locale comma-separated exact digits below 100k, then switches to 'k' (0 decimals) below 1M, and 'M' (1 decimal) above, prioritizing exact readability until digits would overflow a fixed-width column.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: File has no header doc (docs=[] as reported), but each function carries a substantial JSDoc explaining non-obvious design rationale (why middle-elide, why 65% tail weighting, why the 100k/1M thresholds) that isn't derivable from the code alone.

### `elide`
- spec 2 · read at `199d5d451e32` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns s unchanged if its length is <= max; otherwise keeps a shorter head and a longer tail (weighted toward the tail, since the end of a path is the informative part), joined with an ellipsis in the middle, sized in characters so the total length equals max (accounting for the ellipsis character(s)).
- found: Returns s unchanged if within max length. Otherwise splits the budget (max-1, for the ellipsis char) 65% to the tail and the rest (min 1) to the head, slicing s into head...tail joined by an ellipsis.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Exact match including the 65% tail-weighting and the -1 budget for the ellipsis character.

### `compactCount`
- spec 2 · read at `3d19f02e2df4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:11Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Formats a number with comma separators when under 100,000 (e.g. 16,072), and switches to a compact k/M suffix with one decimal place once it wouldn't fit otherwise (e.g. 16.1k, 2.3M).
- found: Uses toLocaleString comma formatting below 100k, whole-number k suffix below 1M, and one-decimal M suffix above that.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/theme.ts

### the file itself
- spec 2 · read at `dd33e147c7ef` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:05Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This file implements light/dark/system theme handling for the app: it loads and saves a theme preference (defaulting to 'system') via loadTheme/saveTheme, detects the OS preference with prefersDark (via matchMedia), applies the resolved theme to the DOM via applyTheme/applyStoredTheme (setting a class or data attribute), and watchSystemTheme listens for OS-level theme changes to reapply automatically when the preference is 'system'. It's driven by the app menu (View → Appearance) rather than an in-app settings toggle.
- found: Theme (light/dark/system) module: Theme type, THEMES/THEME_LABEL constants for a menu, loadTheme/saveTheme via localStorage (with try/catch fallback to 'system'), prefersDark via matchMedia, applyTheme toggling a 'dark' class on <html> (Tailwind v4 class-based dark mode), applyStoredTheme for applying at module load (complementing a blocking inline script in index.html that already prevented first-paint flash), and watchSystemTheme which only subscribes to OS changes when preference is 'system', returning a teardown.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header explains the *why* (no toggle, menu placement, class vs media-query) in ways not derivable from code alone — genuinely useful design-rationale docs, not restated code.

### `loadTheme`
- spec 2 · read at `85c8c2f73557` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads a persisted theme preference (likely from localStorage), validates that it's one of the allowed Theme values ("light"/"dark"/"system"), and returns "system" as the default if nothing is stored or the stored value is invalid.
- found: Reads the theme key from localStorage; if it's exactly 'light', 'dark', or 'system' returns it, otherwise (including if localStorage throws, e.g. unavailable) falls back to 'system'.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc describes the feature/product rationale for theme following the OS, not this specific function's behavior — so documented is about the enclosing file, not loadTheme itself.

### `saveTheme` — QUIRKY
- spec 2 · read at `bb2b7c2c4125` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Persists the theme choice ('light' | 'dark' | 'system') to localStorage under a fixed key, then calls applyTheme(t) to immediately apply it to the document so the UI updates without needing a reload.
- found: Just writes the theme to localStorage under KEY, wrapped in a try/catch that silently swallows failure (comment: "the preference just won't survive a restart"). Does not call applyTheme or anything else — callers are responsible for applying the theme separately.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: I assumed it also applied the theme to the DOM; it's purely a storage write, nothing more.

### `prefersDark`
- spec 2 · read at `864605f25436` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns `window.matchMedia('(prefers-color-scheme: dark)').matches` — a one-line check of the OS-level color scheme preference, used by the theme system to resolve the 'system' setting to an actual light/dark value.
- found: Returns window.matchMedia('(prefers-color-scheme: dark)').matches exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `applyTheme`
- spec 2 · read at `37763c7b64ab` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:13Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Resolves t (which may be 'system') to an actual light/dark value — using prefersDark() when it's 'system' — and sets that resolved value as a data attribute or class on document.documentElement so CSS can key off it.
- found: Resolves 'system' via prefersDark(), else dark===t==='dark', then toggles the 'dark' class on documentElement.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `applyStoredTheme`
- spec 2 · read at `d23f20061bcb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:24Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Calls loadTheme() to read the persisted theme preference (falling back to "system") and passes it to applyTheme() to set the appropriate class/attribute on the document, run once at module load time.
- found: applyTheme(loadTheme()) — reads stored preference and applies it.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: Doc explains the why (relation to index.html's blocking script) rather than the what, which the one-liner body doesn't need explained.

### `watchSystemTheme`
- spec 2 · read at `6d2fb81ba7f4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: If t is not 'system', returns a no-op teardown function immediately. Otherwise sets up a matchMedia('(prefers-color-scheme: dark)') change listener that calls applyTheme (or similar) whenever the OS theme flips, and returns a function that removes that listener.
- found: Applies the theme immediately regardless of mode, then if t is 'system', subscribes to the OS dark-mode media query to reapply 'system' on change, returning an unsubscribe teardown; otherwise returns a no-op teardown.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed that it calls applyTheme(t) unconditionally up front before branching on system mode.

## web/src/lib/timeline.ts

### the file itself
- spec 3 · read at `2a42fb4daadb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:04:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This module manages commit-history data for the timeline view on the frontend without holding the whole history in JS memory — since a large repo's log/deltas can be tens of MB and freeze the window if received all at once. It fetches small bounded tables once (historyTables) and lazily fetches per-commit data (log entries, deltas, funcs) on demand as the user scrubs, via functions like historyLog/historyScoped/historyDeltas/historyFuncs. The Funcs and Deltas classes cache what's been fetched so far and track a "watermark" (how far into history has been loaded) with an `ensure`/`have`/`at` API so repeated scrubbing doesn't re-fetch already-loaded ranges.
- found: Matches my prediction closely: Tauri invoke wrappers fetch tables once, then log rows (screenful, thrown away) and deltas/funcs (fetched in growing blocks and KEPT since folding needs a full contiguous prefix). Funcs and Deltas classes page in blocks with in-flight dedup and watermark tracking so the delta fold never indexes a function that hasn't arrived yet — a coordination detail (watermark ordering funcs-before-deltas) I didn't anticipate.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The ordering guarantee — Deltas.ensure awaits funcs.ensure(watermark) before pushing the block — is the subtle correctness-critical part and isn't obvious from class/method names alone.

### `historyTables`
- spec 3 · read at `2d80e2ab30a4` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:47Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: historyTables invokes the Tauri backend's `tables` command with `path`, awaiting the bounded, repo-sized (not history-sized) lookup table data, and returns it as a Tables object — or null if the invoke fails or there is no cached data.
- found: A thin wrapper that invokes the Tauri command 'history_tables' with { path } and returns the Tables | null result directly.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `historyLog`
- spec 3 · read at `d2edce7b84c3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:44Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (likely "history_log") passing path, offset, count, and scope, returning a promise of a page of LogRow entries fetched lazily from Rust rather than held in the frontend. It probably does no caching itself, just forwards the paginated request to the backend and returns the raw array.
- found: Thin wrapper invoking the Tauri 'history_log' backend command with path/offset/count/scope, returning a promise of LogRow[].
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc describes the module's overall design but this specific function has no docstring of its own.

### `historyScoped`
- spec 3 · read at `e60a230d0f8e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:51Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Thin async wrapper that invokes the Rust `scoped` Tauri command with path and scope, returning the array of commit indices where that path/scope appears in the history, like the sibling history* wrappers in this file.
- found: invoke('history_scoped', { path, scope }) returning Promise<number[]>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `historyDeltas`
- spec 3 · read at `f31c38a9ab75` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:53Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper that calls the Tauri invoke('history_deltas', { path, from, count }) backend command and returns the parsed Delta[] result, possibly routing through a Deltas cache object's ensure/have methods to avoid re-fetching frames already loaded.
- found: Directly calls invoke('history_deltas', { path, from, count }) and returns the promise, no caching logic in this function itself (that lives in the separate Deltas class).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `historyFuncs`
- spec 3 · read at `e04b4ddd0e4b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:53Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes the Tauri command 'history_funcs' with path, from, and count, returning the promise of HistoryFunc[] straight from the backend without additional client-side logic.
- found: Thin invoke wrapper calling the Tauri command 'history_funcs' with path, from, count.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `constructor`
- spec 3 · read at `b6d4826a79ac` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:57Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Initializes a Funcs instance that lazily caches per-commit function tables for a given repo path, storing `path` and `total` (total commit count) as fields alongside an empty cache structure (e.g. a Map or array) and a watermark of 0, to be filled in by `ensure()` as commits are scrolled into view.
- found: Just stores path and total as fields — no cache/watermark initialization here, presumably those are declared as class field initializers elsewhere or added lazily by ensure().
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I predicted extra cache/watermark setup in the constructor that isn't there — likely declared as class property defaults instead.

### `ensure`
- spec 3 · read at `44d868506881` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:58Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A method on `Funcs` that lazily pages in function data up to `index`. It checks the current watermark (how far it has already fetched), and if `index` is beyond that, calls `historyFuncs` to fetch the missing range, storing results and advancing the watermark. It clamps to the timeline's actual length so an out-of-range index triggers one fetch attempt and then gives up rather than looping.
- found: Loops fetching `FUNC_BLOCK`-sized chunks via `historyFuncs` until `this.list` reaches `min(index+1, total)`, appending results each time. Concurrent callers share one in-flight fetch via `this.pending` rather than issuing duplicate requests, and a short read (fetch returned fewer than requested, i.e. list length unchanged) is treated as end-of-data and returns early instead of looping forever.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's "asks once and stops" undersells that it's actually a block-by-block loop with de-duped concurrent fetches, not a single request.

### `watermark`
- spec 3 · read at `583b120231cb` · commit `841cc43` · read by claude-sonnet-5 · via claude · when 2026-09-02T01:14:11Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the deltas in `block`, and for each delta finds the function index(es) it references, tracking the maximum seen. Returns -1 if the block is empty or no delta references a function index, otherwise returns the highest index found.
- found: Scans each delta's set/del/cog collections for function indices and tracks the max, returning -1 if none found. The `set` and `cog` entries are [index, ...] tuples so only the first element is checked.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `baseWatermark`
- spec 3 · read at `4a86d66f6d22` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:46Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the `base` array of [index, count]-like pairs (the opening state) and returns the maximum function index found, likely via Math.max over one element of each pair, defaulting to -1 or 0 if base is empty.
- found: Loops over `base` pairs, destructuring the first element `f` (function index) of each, tracking and returning the max, starting from -1.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `constructor` #2
- spec 3 · read at `550e113b9748` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:00Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Stores path and funcs on the instance, and initializes empty cache state (e.g. a map/array of loaded delta chunks and a watermark set to 0) that have/at/ensure will later populate lazily as more history is fetched.
- found: Just assigns this.path = path and this.funcs = funcs; no extra cache state initialized here (presumably declared as class field defaults elsewhere).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `have`
- spec 3 · read at `1ea40cf3a7c3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:02Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns the count of frames already fetched/cached locally in the Deltas instance — likely the length of an internal array or map of loaded delta frames, representing how far the map can fold without another network request.
- found: Returns blocks.length * BLOCK — data is stored in fixed-size blocks rather than a flat per-frame array, so the count is derived by multiplying loaded block count by block size, not a direct array length.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `at`
- spec 3 · read at `6000321c5b34` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:03Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Deltas.at(index) is a simple accessor returning the cached Delta at that frame index from an internal array or map populated by ensure(), returning undefined if that index hasn't been fetched/loaded yet.
- found: Indexes into a blocked/chunked storage (this.blocks) using div/mod by a BLOCK constant, returning undefined via optional chaining if the block or slot isn't populated.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Storage is block-chunked (this.blocks[i/BLOCK][i%BLOCK]) rather than a flat array — worth knowing before assuming a simple index lookup.

### `ensure` #2
- spec 3 · read at `a7651302aa04` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:44Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Loops, fetching successive blocks of delta data (via historyDeltas or similar) from the backend starting at the current watermark, until the loaded range covers the requested `index`. After each block is merged in, it calls onProgress with the new watermark/count so a caller can show progress during a long jump, and it likely short-circuits immediately if the data already covers `index`.
- found: Loops fetching BLOCK-sized delta pages from historyDeltas starting at the current watermark until have() covers index, sharing a single in-flight `pending` promise so concurrent callers await the same fetch rather than double-requesting; within each fetch it ensures the funcs table is loaded up to the new watermark BEFORE pushing the block (to avoid a window where a frame could be folded before its functions exist), calls onProgress after each block, and detects end-of-timeline via a short (< BLOCK) final page.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/tokens.ts

### the file itself
- spec 3 · read at `793cbf4705d3` · commit `d92c31f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-20T23:29:57Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file exports a single `tokenize` function providing a lightweight, shared lexer used for syntax highlighting: it takes a source string (possibly with a language hint) and returns an array of token objects (e.g. {type, text}) classifying spans as keywords, strings, comments, identifiers, etc. It exists so both the main CodeView and the smaller code snippets shown in the panel apply identical coloring, avoiding a second approximate tokenizer that would drift from the first.
- found: Exports KEYWORDS regex (a union of keywords across ~6 languages) and tokenize(line), which runs one combined regex per line (not per whole source, no language parameter) matching comment/string/number/word/space/punct in priority order and returns Tok[] with {text, cls} for CSS-class-based coloring. It's a deliberately approximate single-pass, per-line lexer, not a real per-language grammar.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Predicted a language-hint parameter and per-source-string call; actually it's per-line, no language argument, and keyword sets for all languages are unioned into one regex.

### `tokenize`
- spec 3 · read at `c196b013b7f0` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:15Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A lightweight, language-agnostic tokenizer for one line of source code: scans left to right with regexes matching strings, comments, numbers, keywords/identifiers, and punctuation/operators, pushing each match as a Tok with a type and text so the code view can apply syntax coloring without a real parser.
- found: Single-regex pass over the line matching comment/string/number/word/space/punct groups in longest-match-first priority order, classifying words as keyword vs plain via a KEYWORDS regex test, and pushing each match as a {text, cls} token.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## web/src/lib/zoom.ts

### the file itself
- spec 3 · read at `ec9388c390b5` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:45:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the geometry and transitions for zooming/drilling into the sunburst chart — arc geometry helpers (geoOf, hubGeo, extentOf), hierarchy relationships and zoom direction (under, ancestors, direction, enterFrom, exitTo), and interpolation between two views for animated pan/zoom transitions (lerp, lerpGeo, lerpView, ease, viewFor, viewBoxOf). A pure-geometry/math module with no React or DOM code, feeding the sunburst's drill-in/out animation. No file header doc present.
- found: Pure geometry/math module computing zoom-transition state for the sunburst: direction detection (in/out/across via path containment), per-wedge annular geometry (geoOf, excluding function wedges which are drawn inside their file's band), interpolation (lerpGeo/lerpView/lerp), enter/exit origin points for wedges appearing/disappearing, computed (not measured) bounding-box extent of annular sectors, and easing/timing constants — all feeding a continuous, non-remounting drill-in/out animation instead of the old scale-and-fade approach.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The sanity_next tool reported docs as empty for this file task, but the file actually opens with a long, detailed design-rationale doc comment (on the Geo interface) that functions as the file header — the empty `docs` field given upfront was misleading.

### `under`
- spec 2 · read at `c4d3ff9b9a40` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns true if `child` path is equal to `parent` or starts with `parent + '/'`; when `parent` is the empty string (root), it matches everything since every path starts with '/' after the empty prefix... more precisely it guards against plain prefix matching (e.g. "src" wrongly matching "src-tauri") by requiring the character after the parent prefix to be the '/' separator.
- found: If parent is the empty-string root, returns true for any non-empty child (root is an ancestor of everything but not of itself); otherwise returns whether child starts with parent + '/'. No equality case — a node is not considered "under" itself.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I assumed child===parent would count as 'under' and mispredicted the root case as unconditionally true; actual code excludes self and excludes empty child from matching root.

### `direction`
- spec 2 · read at `255565b9af99` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:27Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Compares two path strings to classify the zoom transition: if toPath is a descendant of fromPath (via the under helper) returns "in", if fromPath is a descendant of toPath returns "out", and if neither contains the other returns "across" rather than guessing.
- found: Returns 'across' if the paths are equal, 'in' if toPath is under fromPath, 'out' if fromPath is under toPath, else 'across' as the default when neither contains the other.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `geoOf`
- spec 3 · read at `759f88eaeaaf` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:02Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Iterates the wedges, skipping any whose node is a function (kind === 'func'), and for each remaining wedge computes its Geo (radial r0/r1 from rInner + band*depth, angular a0/a1 possibly padded by gapOf(kind)), inserting into a Map keyed by node id so callers can look up on-screen geometry without hitting the phantom function ring.
- found: Builds a Map from node id to Geo, skipping function-kind wedges. For each remaining wedge, r0 = rInner + (depth-1)*band and r1 = r0 + band - gapOf(kind), with a0/a1 taken directly from the wedge's own angles.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `lerp`
- spec 2 · read at `45b2910ff09a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:40Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns a + (b - a) * t, the standard linear interpolation between a and b by fraction t.
- found: Standard linear interpolation: a + (b - a) * t.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lerpGeo`
- spec 2 · read at `0f1f4fe27429` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:31Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Linearly interpolates a Geo (likely a rect-like shape with x/y/width/height fields) between a and b by fraction t, calling the lerp peer helper on each numeric field and returning a new Geo object.
- found: Lerps each of a0, a1, r0, r1 (angle/radius pairs — an arc/sunburst geometry, not a rect) between a and b by t using the lerp helper — mechanism matched, but I guessed x/y/width/height fields instead of the actual angle-radius shape.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `ancestors`
- spec 2 · read at `848a8fdedee0` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Given a path-like id string (e.g. "a/b/c.ts"), repeatedly strips the last "/"-separated segment to build the list of ancestor path strings, ordered nearest-parent first up to the root, by doing string manipulation (lastIndexOf('/') / slicing) in a loop rather than walking any tree structure.
- found: Loops stripping the last '/'-segment via lastIndexOf/slice, pushing each shorter path, nearest-first, then pushes '' for the root at the end.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `enterFrom`
- spec 2 · read at `f6d0a76bb77e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:47Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Walks up the ancestor chain of `id` (via ancestors) looking for the nearest one present in the `was` map (a previously-visible geometry), and if found returns that ancestor's old geo as the starting point for the enter animation. If no ancestor was visible before, it falls back to a degenerate point on the inner edge of the wedge's own target ring (same angle as target, r at target's inner radius) rather than the hub or nothing.
- found: Walks ancestors(id) to find the nearest previously-visible geo in `was`; if none exists, returns a zero-width degenerate wedge at the target's midpoint angle and inner radius.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `exitTo`
- spec 2 · read at `294d7ff11dca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:55Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the destination geometry for a wedge that is leaving the view during a zoom transition, based on `dir`. When drilling in, exiting wedges move outward past `rOuter` (off the rim) since they're the scenery not being drilled into. When drilling out, exiting wedges move inward toward the hub (using `rInner`) since they're the levels being left behind. When the direction is "across", the wedge's geometry is left as-is (`from`) since it just fades in place with no motion.
- found: For 'in', pushes the wedge's radii outward by 55% of the (rOuter-rInner) gap; for 'out', pulls radii inward toward rInner by 75% of the distance from r0 to rInner; for 'across', returns the geometry unchanged.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `ease`
- spec 2 · read at `44eb2f74d2fe` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:46Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A symmetric ease-in-out easing function mapping t in [0,1] to an eased value, likely implemented as a cosine curve (1 - cos(π*t)) / 2 or a cubic smoothstep-like formula, used to animate zoom/pan transitions so they accelerate then decelerate rather than starting at full speed.
- found: Clamps t to [0,1] and applies the standard cubic ease-in-out curve (4x³ for the first half, mirrored 1-(-2x+2)³/2 for the second half), giving a symmetric accelerate-then-decelerate easing for zoom animation.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Guessed cosine-based easing; actual is cubic easeInOutCubic — same symmetric shape/purpose, wrong specific formula.

### `hubGeo`
- spec 2 · read at `2db0dc30a449` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns a Geo object representing a small disc centered at the origin: startAngle 0, endAngle 2*Math.PI (full circle), innerRadius 0, and outerRadius set to rInner, matching the inset circle drawn at the middle of the chart.
- found: Returns a full-circle disc geometry (a0=0, a1=2π, r0=0) with outer radius rInner-4, a small inset I didn't predict.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `extentOf`
- spec 2 · read at `f827dd1fc8b1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: For each Geo (an annular sector with inner/outer radius and start/end angle), compute the four corner points (r0,r1 × a0,a1 mapped via x=r*sin(a), y=-r*cos(a)), plus extra points wherever the sector's angular span crosses a quarter-turn (0, 90, 180, 270 degrees) since those are where x or y hits its radius extreme. Track running min/max x and y across all geos (and presumably account for hubR as a minimum extent at the origin), returning the bounding box as {x0,x1,y0,y1}.
- found: Starts the bounding box at ±hubR on both axes (hub is always drawn at origin), then for each geo with positive radius and span, expands via the four corners plus quarter-turn crossings within [a0,a1] (only at outer radius r1, walked from the first multiple of π/2 ≥ a0), skipping degenerate geos (r1<=0 or a1<=a0).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `viewFor`
- spec 2 · read at `a985a34e5091` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:41Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes a square View around the extent e: finds the larger of width (x1-x0) and height (y1-y0), uses that as the side length, adds margin padding on all sides and extra chromeBottom padding at the bottom for the legend/hidden-count chip overlay, then centers the resulting square box on the extent's center (adjusting for the asymmetric bottom padding), returning {x, y, width/scale} fields matching the View type.
- found: Computes half-extent 'reach' as max(width,height)/2, margins x0/x1/y0 by reach*margin, and y1 additionally by reach*chromeBottom for bottom chrome room, then returns a View as {cx, cy, side} — center point and square side length — rather than a corner+width box.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `lerpView`
- spec 2 · read at `9bdc7a6a3f90` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:40Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Linearly interpolates each numeric field of a View (likely x, y, width/scale, zoom level) between View a and b by fraction t, using the sibling lerp() helper per-field, and returns a new View object with the interpolated values.
- found: Interpolates a View's three fields (cx, cy, side — a center point and a square side length) between a and b by t, using the lerp() helper on each.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Guessed the general shape correctly (per-field lerp via the helper) but the actual View fields (cx/cy/side, i.e. a centered square viewport) were more specific than my generic x/y/width/scale guess.

### `viewBoxOf`
- spec 2 · read at `73db378301fe` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:32:44Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function converting a View (zoom/pan state with center and scale/radius) into an SVG viewBox string "x y width height" for setting the SVG element's viewBox during zoom/pan transitions.
- found: Builds an SVG viewBox string centered on v.cx/v.cy with a square side length v.side, i.e. "x y w h" where x/y are offset by half the side.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
