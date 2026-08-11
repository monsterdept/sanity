# src-tauri — sanity assessment

425 of 462 functions read · 21 surprising · 286 stale

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## src-tauri/build.rs

### the file itself — as expected
- read at `85fd5a79591b` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The standard Tauri build script: a three-line file whose main calls tauri_build::build() to generate app context and embed resources at compile time. No header comment, no custom logic.
- found: Exactly that — `fn main() { tauri_build::build() }` and nothing else. No header comment at all.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main` — as expected
- read at `4b8ff0908edc` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The Tauri build script — a single call to tauri_build::build().
- found: Exactly that, one line.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/agentapi.rs

### `persist` — nearly — STALE
- read at `ff0713758319` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Converts each live project into an index entry (key, repo path, name, touched), loads the KnownProjects already on disk, merges the live entries over the top rather than overwriting the map, and writes it back with save_index, ignoring write failure.
- found: That, plus two details I did not cover: the merge is done on a Vec by retaining only on-disk entries whose key is not loaded and then extending with the live ones; and `active` is written only when this session has one, so a restore that has not reached the last session's project cannot blank it. It also sorts by touched descending before saving.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The long doc comment covers the projects merge thoroughly but never mentions the `active` guard, which is the second and subtler half of the same argument.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `touch` — nearly — STALE
- read at `059e8573aa81` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Moves the project to the front of the recency history — I predicted a Vec of keys with the entry removed and re-inserted at position 0, deliberately not setting `active`, possibly followed by persist().
- found: Recency is a monotonic counter, not list position: it increments a `clock` on AppState, stamps that value onto the project's `touched` field in a map, and calls persist(). Ordering is derived by sorting on the stamp elsewhere.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: "Front of the history" is implemented as a Lamport-style clock stamp, and an unknown key is silently ignored — the clock still advances.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `focus` — as expected — STALE
- read at `e35bafd30ef3` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Sets self.active = key and returns true when either `asked` is true or nothing currently holds the view (active is None, or names a key not present in the loaded projects map); otherwise leaves active alone and returns false. Probably calls persist after moving.
- found: Exactly that: computes `vacant` as active being None or naming a key absent from `projects`, early-returns false when neither asked nor vacant, then sets active, calls persist(), and returns true.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm only in that this is my second function from agentapi.rs; the previous one was an unrelated test at the far end of the file.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ping` — as expected
- read at `91298fd27435` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Push a record of the tool call onto a bounded activity log on AppState — tool name, trimmed to a cap so the mascot/UI can react — and bump a last-activity instant used by the idle check.
- found: Exactly that: sets last_agent to now, stores last_tool, increments a monotonic ping counter, pushes (seq, tool) onto a VecDeque and pops from the front while it exceeds RECENT_CALLS. The sequence number rather than a timestamp is the only detail I did not name.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `most_recent` — as expected — STALE
- read at `c656bc3a5ffe` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Returns the key of the most recently OPENED project rather than the window's active one, by reading the touched bookkeeping that touch bumps on every open — max-by-timestamp over the loaded projects, key cloned, None when nothing is open.
- found: Exactly that: projects.iter().max_by_key(p.touched).map(clone the key).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs handed to me appear to be two doc comments run together — the first several paragraphs are plainly for_client's, describing key resolution and the not-found case, and only the last third belongs to this function.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `for_client` — as expected — STALE
- read at `a472ec3dff4b` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Resolves which project a request is about: a supplied key is returned only if it names a loaded project, otherwise None; with no key it falls back to the last project opened/touched rather than the focused one.
- found: Exactly that — `contains_key(k).then(|| k.to_string())` for the supplied key, `self.most_recent()` for the None case.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Discount this one: the repo's CLAUDE.md is in my system context and describes `for_client`'s fallback rule by name, so my prediction was not made from the handout alone even though I had not opened the file.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `load_reports` — as expected — STALE
- read at `01746026f963` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A three-line delegation: hand repo and scan to assessment::load and return its map, with unwrap_or_default so a repo with no .sanity/ yields an empty map rather than an error — no fallback store, no migration.
- found: A single line delegating to crate::assessment::load(repo, scan); the load itself already returns a HashMap, so there is no error to absorb.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: A one-line pass-through carrying a 20-line doc comment about a destructive migration that no longer exists — the docs are entirely history, none of it derivable from the body.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `save_reports` — as expected — STALE
- read at `28bb790d71ff` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A thin wrapper delegating to assessment::save(repo, scan, reports), mapping any error into a String for the caller, with no fallback or hidden mirror so failure propagates to the report handler.
- found: Exactly that; the map_err builds an actionable message naming assessment::dir(repo) and telling the agent the reading is in memory but unsaved and will be lost when Sanity closes.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `project_key` — as expected — STALE
- read at `d71433e7a371` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Canonicalize the path with fs::canonicalize, fall back to the path as given on error, and return it as a lossy String used as the map key identity.
- found: Exactly that: canonicalize, unwrap_or_else to the original PathBuf, to_string_lossy, to_string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lock` — as expected — STALE
- read at `1b07729e40fe` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: state.lock().unwrap_or_else(|e| e.into_inner()) — take the mutex and, on PoisonError, pull the guard out of the error so a guard is always returned and no call site has a Result to swallow.
- found: Exactly that, verbatim.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: A twenty-line doc comment over a one-line body, and every line of it is history the code cannot state — this is the ratio the repo's own metric argues for.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `surprise` — nearly — STALE
- read at `408dcd0a0e86` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A match over the four Grade variants returning a fixed float apiece, deliberately non-linear: Full at 0.0 with Most just above it (~0.15), then a jump to Some ~0.6 and None 1.0, so the "I knew this" versus "I did not" gap gets most of the scale.
- found: A four-arm match returning 0.08 / 0.30 / 0.62 / 0.92. The ordering and the rough midpoint were right, but neither end reaches 0 or 1 — every grade keeps a floor and a ceiling of doubt.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc claims the steps are "not evenly spaced" with the two confident ones close together, but the actual gaps are 0.22 / 0.32 / 0.30 — very nearly uniform, so the body does not have the property the comment sells.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `documented` — nearly — STALE
- read at `a7b49816438a` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A match over the four Grade variants (Full/Most/Some/None) returning coverage as an f32 around 1.0/0.66/0.33/0.0, the mirror of Grade::surprise which maps the same variants the other way.
- found: Match returning 0.95 / 0.7 / 0.35 / 0.0. Full stops short of 1.0 rather than claiming total coverage.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The constants are bare magic numbers with nothing saying why Full caps at 0.95 rather than 1.0, which reads like a deliberate refusal to claim certainty but is not written down anywhere near it.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `blank` — as expected — STALE
- read at `94662ea9f433` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Returns a Report with every field zeroed or defaulted — empty strings for key, note, by, at, body hash and model; None for the optional grades (predicted, documented, derivable, position); false for booleans like cold, trap, surprised — so the Markdown parser can fill it in field by field. Essentially a hand-written Default at 20 lines.
- found: Exactly that: a 16-field struct literal of String::new(), false and None. The one detail I got wrong is that `derivable` is a plain bool defaulting to false rather than an Option, unlike the three graded fields (predicted, documented, legible) which are Option.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: `derivable` blanks to false, which is the "docs explain something real" answer, whereas the grade fields blank to None — a parse that drops the field silently asserts a credit rather than an absence.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `grades` — as expected
- read at `ff2b681f16b3` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Returns (surprise, documented): surprise from `predicted` when present, else the legacy `surprised` bool mapped to the two ends of the scale with no invented middle; documented from the reader's field as an Option, except a true `derivable` forces it to the lowest grade regardless of what the reader said.
- found: Exactly that: `predicted.unwrap_or(if surprised { None } else { Full })`, then `derivable` short-circuits to `Some(Grade::None)` otherwise passes `self.documented` through.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `neighbours` — as expected — STALE
- read at `f6938e55b595` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Given all function names in a file and the index of the current one, return up to 20 neighbours as a window centred on `i` — `start = i.saturating_sub(10)`, clamped so a full 20 still fits when `i` is near either end of the file — and the count of names left outside that window (`peers_omitted`). The subject itself is excluded from the returned slice.
- found: Exactly that. Short-circuits when the file has PEER_WINDOW+1 or fewer names, returning everything but self and 0 omitted; otherwise `start = i.saturating_sub(PEER_WINDOW/2).min(len - PEER_WINDOW - 1)`, takes the inclusive span of PEER_WINDOW+1 entries, filters out index `i`, and reports `len - 1 - peers.len()` omitted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `qualify` — nearly
- read at `eb82576b9d9d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Formats a qualified member name with the separator the language actually writes: `Owner::name` for Rust/C++/PHP, `Owner#name` for Ruby, `Owner.name` for the dot languages, bare `name` when there is no owner. Pure formatting.
- found: Just that, except Ruby: a comment says it is deliberately excluded from the `::` list because `Foo::bar` is a constant lookup and `Foo#bar` is the method, so it falls through to the dot default. The `::` set is exactly Rust, Cpp, Php; everything else, including an unknown language, gets a dot.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The Ruby comment argues neither separator is obvious and then picks the dot, which in Ruby denotes a class-method call — the same small untruth the doc comment says the function exists to avoid, just a quieter one than `::`.

### `collect_tasks` — nearly — STALE
- read at `1ce35cf398d4` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A recursive tree walk: recurse through dirs/files carrying the file's doc down as file_doc; for each function look up `done`, skip readings whose hash still matches, keep drifted ones as STALE, skip unexpired leases; build a Task with name, owner, signature, docs, line span, abs path and the nearest twenty peers plus peers_omitted; push with a priority float putting stale ahead of unread and otherwise ordering by proxy score; skip .sanityignore-excluded nodes.
- found: All of that, with the peer mechanism more involved than I described: peers are not attached at the function level at all. The File arm builds the qualified child-name list in file order, records a `from` vector mapping each task emitted to the child index that produced it (because skipped children break positional inference), then back-fills peers/peers_omitted via `neighbours` over the tasks appended during that file. Priority is literally `surprise + 1.0` when stale, defaulting to 0.5 when there is no score. Lookups key on `node.id`, and the exclusion check sits on the File node, not per function.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment on the function itself, but the inline comments carry the reasoning better than a docstring would; the `from` index vector exists precisely because skipped children make position in `out` unreliable, and that is spelled out.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `all_tasks` — as expected — STALE
- read at `02b4d8d6612c` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Walks the whole scan tree building a Task for every function — the same payload collect_tasks produces, but with an empty reports map and no lease filtering, so the token-measurement tool sees exactly what a reader receives. Probably a thin call into collect_tasks with blank maps and no cap.
- found: Exactly that: one call to collect_tasks with two empty HashMaps (reports and leases), Some(repo), no limit, then strips the sort/priority key from each pair and returns the bare Tasks.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docstring's last paragraph is stale: it says `peers` "is every function in the file, and a 400-function file sends all 400 names", but peers is now bounded to the nearest twenty with peers_omitted reporting the rest.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `default_n` — as expected — STALE
- read at `6a6d3617691f` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A serde default hook returning the handout size as a literal: 1, since the doc's closing sentence makes default_n the size of one HANDOUT while the protocol asks for ten separate calls.
- found: `fn default_n() -> usize { 1 }`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs open "Ten readings per reader" over a function that returns 1, and only the last sentence resolves that the constant is the handout, not the batch — a reader who stops early predicts 10.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `contract_note` — as expected — STALE
- read at `fab70694378c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Compares a contract version/fingerprint the caller sent against the one this binary was compiled with; returns Some(warning) on mismatch telling the operator the shim is stale and must be restarted so readers get the current report fields, None on match, and probably a note too when None was sent since silence is the pre-fix case.
- found: Exactly that: fetches crate::mcp::contract_fingerprint(), matches sent — equal fingerprint returns None, a differing one returns a message explaining tools/list is answered from the shim's own process image so readers silently omit unknown fields and it must be restarted, and None returns a softer note that the shim predates the contract check.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `open_project` — nearly — STALE
- read at `efb41a6872a3` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The handler behind sanity_open: validate the path, run the full structural scan (walk, tree-sitter, churn, proxy scoring), load committed .sanity readings and fold them into the tree, insert the project into the shared map keyed by client, bump touched, focus only if asked, run assessment::refresh and report it as `index`, and return JSON with project, repo, functions, excluded, assessed, stale, shape, showing, protocol/next_step.
- found: All of that, plus three things I did not cover. (1) A git_root gate that rejects a non-repo with a dedicated message, because agents hand over parent directories. (2) A pre-scan "restoring" placeholder pushed into the sidebar before the blocking scan and removed on every exit path via a `settled` closure, so the user is not staring at an onboarding screen during the silent scan window. (3) It deliberately rescans even a reopened project (`reopened` is reported), drops all leases rather than carrying them, keeps `touched`, and reloads reports from disk via load_reports rather than carrying the old ones across the rescan. The response also carries scan_ms/scan_note, a contract_warning, and a long `sanityignore` advisory string.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: 193 lines of which the large majority is comment prose arguing past bugs; the doc comment above it describes the feature's intent and none of the mechanism, so the two are complementary rather than overlapping.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `scan_note` — as expected
- read at `229afd11d13f` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns None when ms is under a slowness threshold (silence for fast opens), otherwise a human sentence explaining the wait, worded differently depending on `reopened`: a first open pays to parse and blame every file, a re-open pays only for what changed, phrased so it reassures rather than reading as a fault.
- found: Exactly that shape: SLOW_MS = 5000, early None below it, otherwise a formatted sentence giving the duration in seconds, saying the parse/blame cache is per machine and later opens cost only what changed, with a parenthetical appended when `reopened`, plus an explicit 'it is not a hang, and retrying restarts it'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `work_left` — nearly
- read at `e02e7715161c` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Counts outstanding work without letting leases hide it: collects every unread-or-stale queueable item as `remaining` ignoring leases, counts live unexpired leases separately as `in_flight`, returns both in WorkLeft.
- found: That, via collect_tasks with an empty lease map so leases cannot filter the list, plus a third field I did not predict: `outstanding`, the itemised (id, age_secs) of live leases that still cover unread work, sorted oldest first. A lease is only in flight if its task is still in the unread set and its age is under LEASE.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No doc comment on a function whose whole reason for existing (coverage must never be reported off a lease-filtered list) is an explicit project rule — only an inline comment about leases carries it.

### `count_stale` — nearly
- read at `200e2b695720` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Walks the live functions in the scan (not the reports map), looks each up in reports by key_of(path, name, ord), and counts those whose stored reading hash differs from the function's current reading hash — readings that exist but have expired. Returns a usize, skipping unread and probably excluded functions.
- found: Right in shape — a visitor over scan.root counting nodes whose report is_stale against the node's current body. Two details I missed: it counts FILE readings as well as function readings, deliberately, because assessed() subtracts this from reports.len() which holds every kind and an expired file reading was being left in the numerator; and the lookup is by node.id, with staleness delegated to assessment::is_stale rather than compared inline. No exclusion filter.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: This keys the in-memory reports map by node.id, which reads oddly against the repo's stated rule that nothing durable is keyed on a node id since ids embed @line — worth confirming the in-memory map really is id-keyed while the committed store is key_of-keyed.

### `assessed` — as expected — STALE
- read at `c530f428ccee` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: reports.len() minus stale readings — saturating_sub(count_stale(&project.scan, &project.reports)) — the single definition matching the ProjectSummary line so /status and the sidebar agree.
- found: Exactly that, token for token.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Prediction was assisted: I had read the identical expression in ProjectSummary::from_state two functions earlier, so this is recall of a peer as much as prediction; the doc is not derivable because it is about a past divergence between two call sites, which the body cannot show.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `count_funcs` — nearly
- read at `7b3363869ffa` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Walks the scan's node tree returning (functions in scope, functions excluded by .sanityignore), incrementing one counter or the other per function node from an excluded flag, so both figures come from one pass and are reported together.
- found: Exactly that, via a nested recursive `walk` that carries an `out_of_scope` boolean INHERITED down the tree (`out_of_scope || node.excluded`), so excluding a directory excludes every function beneath it rather than requiring the flag on each leaf. Picks the counter with an `if` inside the deref. One pass, both totals.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Warm: this is my second function from agentapi.rs, though 1500 lines from the first and I had not read this region.

### `shape_of` — nearly
- read at `453b5df49bf7` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Walk the scan tree, bucket each function under its top-level path segment, count functions (and excluded) per bucket, sort descending, and return JSON rows of directory name plus counts — never function names.
- found: That, with a recursive inner walk carrying an inherited `excluded` flag down the tree so a function under an excluded ancestor lands in the `excluded` column rather than `functions`. Sorted by kept+excluded descending and truncated to the top 15 — the cap is the one thing I did not predict.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The silent top-15 truncation is undocumented: a repo with many top-level directories would show an agent a partial shape it has no way to know is partial, which is the "narrowed subset presented as the whole" failure this field exists to avoid.

### `interleave_by_file` — as expected
- read at `52681135f9b4` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes tasks pre-sorted by descending proxy score, buckets them by file path preserving rank order within each bucket, then round-robins across buckets taking each file's top remaining task until n are collected or buckets empty; file order determined by rank of each file's best task.
- found: Exactly that. It re-sorts `ranked` descending itself (doesn't assume sorted input), buckets by path via a HashMap of path->index into a Vec of Vecs so first-seen order equals descending-best-score order, then loops `round` taking `file.get(round)` from each bucket, breaking when a full pass makes no progress.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `mark_of` — as expected — STALE
- read at `7a2f5c3c060d` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Stats repo.join(rel_path) and returns (mtime, len) as the change-detection mark that resync_changed compares — both together because two writes in one second can share an mtime — returning None on any IO error.
- found: Exactly that: `fs::metadata(...).ok()?` then `Some((m.modified().ok()?, m.len()))`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `resync_file` — nearly — STALE
- read at `ade69f5eec77` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Reads repo/rel_path off disk, re-parses it with the file's language, keys the fresh functions by key_of(path, name, ord). Finds that file's node in root and for each existing function child looks up its key: on a hit overwrites line/end_line, signature, docs and the reading hash while leaving the node id alone; on a miss removes the child. New functions are ignored. Returns whether the file was found/changed.
- found: As predicted, with the mechanics slightly different: a nested recursive `find` locates the File node by path, and three early returns (no node, no lang, unreadable file) yield false. Ordinals are computed inline into a (name, ord) map rather than through key_of, and the drop/update is one `retain_mut` pass that also refreshes `loc` and `owner`, and rehashes with reading_hash(doc, body). It returns true unconditionally once the file is found — the bool is "resynced", not "changed".
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The ordinal keying is duplicated here by hand instead of going through key_of, so the two definitions of "which twin is this" can drift apart.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `stamp_marks` — as expected — STALE
- read at `e7dcabe2cdda` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Walks the scan tree and for every file node stats the file on disk via mark_of to get its (mtime, length), building a map from the file's path to that pair — the marks resync_changed later compares against. Files that fail to stat are omitted.
- found: Exactly that, via Node::visit with a closure filtering on NodeKind::File and mark_of(repo, path), inserting only Some results.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: The docs handed over are two comments run together — the first half documents `resync_changed` and the second the marks map/field, and neither is a doc comment on this function; the actual mechanism (walk the scan, stat each file) is described nowhere.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `resync_changed` — nearly
- read at `27c3c551c46d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Iterate the project's files, compare each file's current mtime and byte length against the recorded stat, call resync_file on any that differ to refresh positions/signature/docs/hash, update the stored stat, and return how many were re-cut.
- found: That, via visit() over File nodes collecting mark_of() stats, then a filter using file_marks.insert(...).is_some_and(|was| was != m) so a first-seen file is deliberately not counted as moved. Extra step I missed: it calls scan.root.aggregate() afterwards so parent widths/roll-ups follow the changed line counts. Returns moved.len().
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: No doc comment on a function whose ordering (must run at the top of `queue`) is the whole reason it exists; the insert-and-compare idiom on line 1838 is dense enough to deserve one.

### `spread_across_files` — nearly
- read at `60f93358437e` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Given tasks already ranked by score, splits them by whether their file appears in `recent` within a cooldown relative to `now` — rested files first in score order, recently-drawn ones as fallback — and returns the top n Tasks, probably via a stable sort on a 'touched lately' boolean, dropping the score.
- found: A three-line partition on `recent[path]` being absent or older than FILE_REST, then it hands EITHER the fresh set or — only if fresh is empty — the resting set to interleave_by_file(_, n). So it is all-or-nothing rather than a preference ordering: resting tasks are not appended behind fresh ones, they are simply not considered unless nothing is fresh. Score-dropping and the top-n cut both happen inside interleave_by_file, not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc's phrase "preferred, not forbidden" is precise about the fallback but understates the switch: with even one fresh task available, every resting task is excluded outright rather than ranked lower.

### `queue` — nearly
- read at `6d80194c3b51` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: The axum handler behind sanity_next: resolves the caller's project via for_client(p.key) under the shared lock, calls resync_changed first so line numbers match the file as it is now, gathers candidates (stale ahead of unread) via collect_tasks, drops anything already leased, passes the ranked list through interleave_by_file to take p.n, stamps a lease on each, returns JSON.
- found: That, with two additions. Leasing is not just excluded from collection — `recent_files` is stamped alongside `leased`, and the ranked list goes through `spread_across_files(tasks, &project.recent_files, now, p.n)` rather than `interleave_by_file` directly, so coldness is enforced ACROSS concurrent readers, not merely within one handout. And the state is `ping`ed with a distinguishing event: `sanity_next:done` only when nothing was handed out AND `work_left(project).remaining == 0`, so an empty response while work is leased reads as an ordinary wait rather than as the job finishing. Both no-project paths return an empty Vec rather than an error.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: An unresolvable project returns `Json([])`, which a reader cannot distinguish from "the assessment is finished" — the one case the `:done` ping is careful to separate is invisible on the wire.

### `report` — nearly — STALE
- read at `fa3a75dd11b8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The /report handler: resolve the project by the session's key via for_client, fail with NO_PROJECT otherwise; locate the reported id in the scan; build the Report from the agent's grades but stamp body/by/at server-side from the scan's reading hash, git and the clock; store under a stable key; release the lease; persist via save, returning any write error in ok/error/hint rather than absorbing it; answer with saved, remaining/in_flight from work_left, and repo-wide surprise counts as a hint about reader honesty.
- found: All of that, with three things I did not cover. It stores under the node `id`, not key_of — keying to a durable key happens later, in save_reports. It classifies the reading into a mascot event (`sanity_report:stale` when the id already held a report, `:hot` when the grade is Some/None, `:cold` otherwise) and pings the window, deliberately suppressing the celebration in favour of `sanity_error` when the write failed. And it computes the honesty hint from thresholds (total >= 8 and surprised*10 < total), with a failed write overwriting the hint because a stalled save outranks coaching. The response fields are named repo_* explicitly because readers had misread them as verdicts on their own work. by/at come from assessment::who and assessment::head (git identity and HEAD sha), not a clock.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The lease is removed before anything can fail, so a report that errors on lookup or write has already released the function back to the queue.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `status` — nearly — STALE
- read at `f5d14469794c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: The /status endpoint: resolve strictly through for_client(p.project), never `active`, NO_PROJECT otherwise; count total functions, assessed() excluding stale, stale and excluded; take remaining/in_flight from work_left so leased work never reads as done; name the repo it answered about (project, repo) and probably carry a next_step note for the orchestrator.
- found: All of that, and three things beyond it. It pings the mascot with a deliberately quiet `sanity_status` mood because polling is activity and the window used to look idle through a whole wave. It returns `outstanding` — the oldest few leases with how long each has been held, capped at OUTSTANDING_SHOWN — so a dead wave is distinguishable from a busy one, with the uncapped in_flight beside it. And `next_step` is a four-branch prose instruction (done / all-in-flight so don't spawn / stale-first / spawn another wave) rather than a token. The miss case is not NO_PROJECT but `open: false` with a hint that distinguishes a transient restart from nothing being open, and every response carries the full `projects` list built before the routing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs are entirely about the routing bug and say nothing about outstanding, next_step or the mascot ping, which are most of the body.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `add` — as expected — STALE
- read at `6d13901c3e9d` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A four-arm match incrementing the full/most/some/none counters on GradeCounts, with None ignored or counted separately.
- found: Exactly that, with None counted separately into an `ungraded` field — five arms, no fallthrough.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm on the file only (I had read AppState::touch earlier); this function was unread.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `add` #2 — as expected — STALE
- read at `85b3ec18c11e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Folds one Report into a repo-wide aggregate for sanity_summary: bumps a total, pushes predicted/documented/legible into their own GradeCounts, and increments counters for the booleans trap, derivable, cold — plus possibly a per-position bucket.
- found: Exactly that, minus the position bucket: `r.grades()` yields (predicted, documented), `readings += 1`, three `GradeCounts::add` calls, and `usize::from` on derivable/trap/cold. `predicted` is wrapped in `Some` while `documented` is already an Option, which hints the two fields differ in optionality upstream.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `aggregate` — nearly
- read at `73f05887e215` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Builds the repo-wide Aggregate behind sanity_summary: folds every report into grade histograms (predicted/documented/legible via GradeCounts::add), counts traps, derivable and cold, buckets by position, and reports totals excluding stale — with no per-file breakdown.
- found: Walks the scan tree (not the reports map), takes only Func nodes that have a report, counts stale ones into `agg.stale` and skips them, then `agg.total.add(r)` plus a `by_model` bucket keyed on the self-declared model with an explicit "unattributed" bucket for a blank. Position goes into `by_position.positions[n]` carrying only the predicted grade, with a separate `unrecorded` counter. The individual grade/trap counting lives inside `Tally::add`, not here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No doc comment of its own; also note it looks reports up by `node.id` rather than `key_of`, which the project's own notes warn against keying durable things on — fine here only because it is a transient in-memory map.

### `summary` — nearly — STALE
- read at `7b0bd0b44712` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: An axum handler resolving the project via for_client from the session key, aggregating non-stale readings into repo-wide grade distributions plus by_position buckets and coverage (assessed/remaining/stale), returning JSON with no per-file or per-function detail.
- found: That, but the aggregation is entirely delegated to aggregate(project) and work_left/count_funcs — the handler only assembles JSON. It pings the idle clock, returns an {open:false, hint:"call sanity_open"} object when no project resolves, and emits functions/excluded/assessed/stale/remaining plus total, by_model and by_position. Most of its bytes are a long `note` string carrying the orchestrator guidance in the response rather than the schema: aggregates only, documented is post-provenance (derivable docs count as none), stale excluded, and read by_position as a curve not as counts.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Warm: agentapi.rs is the third function I have read from this file, though not near this one.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `from_state` — nearly — STALE
- read at `f7f818dee115` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 3 of its run
- expected: Walks the app state's map of open projects into a serialisable ProjectList — per project key/name/path, function and excluded counts, assessed excluding stale, remaining — plus the active/touched marker, and probably sorts the list.
- found: Maps state.projects into ProjectSummary with counts (count_stale, count_funcs), assessed = reports.len() - stale, and a `working` flag from last_agent within a 60s window. Then extends with placeholder rows for projects still restoring (loading: true, zero counts, read_done/read_total progress), skipping any already present, sorts by touched descending, and returns with state.active.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I did not predict the second half at all — the loading placeholder rows for projects the restore has not reached yet, with their own read progress counters.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `health` — as expected — STALE
- read at `3913659378c0` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A three-line handler returning small JSON like {"ok": true, "pid": std::process::id()}, touching no shared state so it never calls ping.
- found: Exactly Json(json!({"ok": true, "pid": std::process::id()})).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `router` — as expected — STALE
- read at `e6a3323ca2d7` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 2 of its run
- expected: An axum Router wiring the peer handlers — /queue, /report, /status, /summary, /health, /open (and maybe a projects route) — GET for the read verbs, POST for open and report, finished with .with_state(state).
- found: Exactly that, six routes: GET /health, POST /open (open_project), GET /queue, POST /report, GET /status, GET /summary, then .with_state(state). No projects route.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Marked warm only because this is the same file family I had just seen a peer list for; I had not opened agentapi.rs itself before predicting.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `endpoint_file` — as expected — STALE
- read at `5c92bf57a858` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A three-line helper returning the machine-local path where the backend publishes its claimed port and pid — an OS cache/config dir joined with something like sanity/endpoint.json, Option because the base dir lookup can fail.
- found: Exactly that: `Some(crate::reports::data_dir()?.join("agent-endpoint.json"))`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `url` — as expected — STALE
- read at `208e017ba356` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: format!("http://127.0.0.1:{}", self.port) — loopback base URL with no trailing slash, so callers append paths directly.
- found: Exactly that, character for character.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read_endpoint` — as expected
- read at `50286e4f7a32` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Reads the endpoint file via endpoint_file(), parses it into Endpoint { port, pid }, returns None on any failure — missing, unreadable, unparseable — and makes no liveness claim.
- found: Exactly that, as one `?`-chain: read_to_string, serde_json::from_str into a Value, then port and pid pulled out as u64 and narrowed with u16/u32 try_from, every step folding failure into None.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `release_endpoint` — as expected — STALE
- read at `1db3c6577d16` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Reads the endpoint file and, only if the recorded pid equals the passed pid, unlinks it; otherwise leaves someone else's live claim alone. Both read and removal are best-effort with errors swallowed, so it never panics or reports on the way out.
- found: Exactly that, in four lines: read_endpoint().is_some_and(|ep| ep.pid == pid), then endpoint_file() and a `let _ = remove_file`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: A 15-line docstring over a 4-line body — but every clause of it is a failure mode the code shape does not state, so it is not derivable.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `restore` — surprising — STALE
- read at `5fcf23658f22` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Reads the persisted projects index, spawns a background thread that for each recorded project checks the repo still exists, rescans it, loads its .sanity/ assessment back, inserts it into shared state, silently skipping missing/moved repos, never calling touch, and persisting once at the end.
- found: All of that, plus three things I did not cover: it advances s.clock to the highest `touched` in the index so this session's projects do not sort below last session's; it publishes index.projects into s.restoring before any scan and feeds scan::Progress into s.restoring_progress so the sidebar fills immediately and each row firms up, with a `settled` closure removing a row however it ends; and it resolves s.active — matching the recorded active inside the loop, then after the loop falling back to the most recently touched project that actually came back. Iteration is in reverse index order so the last-touched lands last.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc comment is thorough about persistence but says nothing about the two other jobs this function does — restoring the touched-counter high-water mark and choosing the active project.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `serve` — nearly
- read at `d72494a104f3` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Bind a tokio TcpListener to 127.0.0.1:0, read the assigned port from local_addr, build router(state), spawn axum::serve on a background task, return the port.
- found: That, plus writing the endpoint file ({port, pid}) before spawning — the claim other processes read to find this backend. The write is best-effort (`let _ =`), as is the serve future's result.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc says "bind loopback and serve" but omits that it also publishes the endpoint file — the discovery mechanism every shim depends on — and that a failed write is swallowed.

### `task` — as expected — STALE
- read at `5343cfc0054f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test-fixture helper constructing a Task from a path and function name, filling an id like path#name, key/line numbers, a placeholder signature, and empty docs/peers so tests can build queue items in one line.
- found: Exactly that: a struct literal for Task with id = format!("{path}#{name}"), abs_path and path both set to path, line 1, end_line 10, lines 10, owner None, empty signature, empty peers (peers_omitted 0) and empty docs.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `project_of` — nearly — STALE
- read at `21af42afb489` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A helper (likely test-side) turning a directory into a Project: name from the final path component, run the scan to build the tree, load existing .sanity/ reports, return the struct.
- found: A test helper that runs scan::scan with the HeuristicModel, no-op progress callbacks, a never-set cancel flag, ephemeral score and scan caches and Fidelity::Ordering, unwraps, computes file_marks via stamp_marks, and returns a Project with a hardcoded name \"t\", empty reports/leases/recent_files, touched 0 and no last_agent.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Name is hardcoded \"t\" and reports start empty, so it deliberately does not read .sanity/ — a fresh project, not a restored one.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_shim_serving_a_stale_contract_is_told_to_restart` — nearly — STALE
- read at `709ac63d7908` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A two-case unit test over the comparison of a shim's reported contract version against the server's current one: a stale/mismatched version yields Some warning whose text mentions restarting, and the current version (and probably None) yields nothing, since the doc insists the happy path stays silent.
- found: Three cases against `contract_note`: Some(current fingerprint from mcp::contract_fingerprint()) must be None; Some("0000000000000000") must be Some and its lowercased text must contain "restart"; and — the one I guessed the wrong way round — contract_note(None) must ALSO warn, because a shim too old to send a fingerprint is the same hazard.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_file_edited_before_the_first_handout_is_still_re_cut` — as expected — STALE
- read at `2495b4796190` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test that scans a temp repo, edits a source file BEFORE any queue/sanity_next call, then asks for a task and asserts the handed-out line/end_line match the function's new position — proving marks stamped at scan time let the very first look detect movement.
- found: Writes a two-function `a.rs` into a tempdir, builds the project with `project_of`, prepends three comment lines, then asserts `resync_changed(&mut p) == 1` (the file was seen to move on the first look) and walks the scan tree to assert `second` now reports line 5. It calls `resync_changed` directly rather than going through the queue endpoint.</found> <parameter name="predicted">most
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Correcting my previous submission for this id: cold was mis-entered as false; I had not read this file before predicting.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_save_mid_restore_does_not_erase_projects_it_has_not_loaded` — nearly — STALE
- read at `a1c240e5b6f2` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Seeds a persisted index with several projects, builds a state holding only one loaded project (a sanity_open landing mid-restore), persists, and asserts the on-disk index still holds all entries — a merge, not an overwrite.
- found: Exactly that, with the detail filled in: save_index writes /a and /b, a temp repo is scanned via project_of and relabelled as /b with touched 9, state.persist() runs, and load_index must still contain /a, hold exactly two keys (no duplication), have /b updated in place to touched 9, and have this session's active (/b) win over the stored one.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The docs explain the historical bug rather than restating the body, and the test also pins two things the docs do not mention: no duplication, and the live session's `active` overriding the stored one.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `drop` — as expected — STALE
- read at `f6078b583ac2` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The Drop impl for a test guard that redirects the data-home directory via an env var; drop restores the previous value, or removes the var if it was unset, so the override does not leak between tests.
- found: Exactly that: takes self.prev, set_var("SANITY_DATA_DIR", v) if Some, remove_var if None, inside an unsafe block (Rust 2024 env mutation).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `data_home` — nearly
- read at `db5ad6703c12` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test-only guard that points the process's data directory (where the endpoint/port file lives) at a fresh temp directory via an env var and returns a DataHome whose Drop restores the previous value and removes the temp dir, so tests cannot collide with a real install or each other.
- found: Exactly that, with one mechanism I did not name: because env vars are process-global it first takes a static ENV_LOCK, recovering from poisoning with `unwrap_or_else(|e| e.into_inner())` rather than honouring it, and carries the MutexGuard inside the returned DataHome so the lock is held for the guard's whole lifetime. It stashes the previous SANITY_DATA_DIR, sets the new one through the unsafe set_var, and holds the TempDir so it is deleted on drop.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The only docs handed over were the module header about the agent API; this helper carries no comment of its own, so nothing tells a reader that the returned value is a lock guard as well as a directory and must be bound, not dropped immediately.

### `standing_down_withdraws_only_its_own_claim` — nearly — STALE
- read at `321b6ad2db8d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A test under a temp DataHome guard: write an endpoint file naming this process's own pid, call release_endpoint, assert the file is gone; then write one naming a different pid (the superseding app), call release_endpoint again, and assert the file survives with the other pid intact.
- found: Both cases, in the opposite order, with the pid passed as an argument to release_endpoint rather than taken from the process: file names 1234 while daemon 999 stands down, and the claim survives; then 1234 releases its own and read_endpoint goes None. Plus a third case I did not predict — release_endpoint is called again on an already-deleted file to prove a racing double exit does not panic.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `outstanding_itemises_only_live_leases_on_unread_work` — as expected — STALE
- read at `d2fe708a8895` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test setting up a project with several functions, leasing some, landing a report for one, then asserting `outstanding` itemises only leases still covering unread functions (the read one drops out) and that its length equals `in_flight`.
- found: Exactly that, in three stages against a two-function tempdir fixture: nothing leased gives in_flight 0 and empty outstanding; leasing ids[0] gives remaining 2 (a lease is not a reading), in_flight 1, outstanding.len()==in_flight and outstanding[0].0 == ids[0]; then inserting a blank Report for ids[0] drops remaining to 1 and in_flight to 0 with outstanding empty.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `the_summary_counts_neither_stale_readings_nor_unknown_positions_as_good_news` — nearly — STALE
- read at `8c0a0e90d983` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A test building a project with a current reading, a stale one (body hash mismatch) and one with no position, then asserting the aggregate excludes the stale reading from counted coverage, and the position-less reading is not bucketed as position 1 but tracked separately so a batched run cannot look uniformly fresh.
- found: Exactly that, with more detail than I predicted: a three-function tempdir fixture, a local `reading` helper and a `bank` closure; readings at positions 1 and 7 plus one against a bogus body. Asserts agg.stale == 1, total.readings == 2, predicted.full == 2, and that the stale one is also missing from its by_model tally; then that by_position keeps one bucket per position (1 and 7 present, 2 not invented) with unrecorded == 0; then overwrites one reading with position None and asserts unrecorded becomes 1 while it lands in neither bucket 1 nor its old bucket 7.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Fourth read in agentapi.rs this run, so my prediction benefited from the file's idioms even though I had not seen these lines.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `same_named_methods_arrive_with_the_type_they_hang_off` — as expected — STALE
- read at `139f58d55c82` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test building a file holding two same-named functions on different types (Foo::parse, Bar::parse), running the task collection, and asserting each task carries a distinct owner naming its enclosing type and that the peers list shows the twin qualified rather than deduped to a single bare name.
- found: Exactly that, made concrete: a tempdir udf.rs with `impl DescriptorTag { fn parse }` and `impl LogicalVolumeDescriptor { fn parse }`, project_of + collect_tasks, asserts two tasks whose owners contain both type names, and for each task that peers has exactly one entry ending in "::parse", peers_omitted is 0, and the peer is not the function's own qualified name.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_excluded_file_leaves_the_queue_and_stays_in_the_count` — nearly — STALE
- read at `5594e3ea2b7d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test building a project with at least two files, writing a .sanityignore naming one, then asserting no task from the excluded file is handed out by the queue while the excluded functions still appear in the functions/excluded totals rather than being silently dropped.
- found: Exactly that, in three assertions plus a fourth I did not anticipate: it first scans with NO .sanityignore to prove there are no built-in defaults (3,0), then with tests/ excluded (1,2), then that collect_tasks yields only `one`, then that shape_of reports the tests/ directory with functions:0 and excluded:2 so a reader can propose an ignore from real numbers.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_long_file_sends_the_neighbourhood_and_counts_the_rest` — nearly — STALE
- read at `a005e6eb0c28` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test building a file of far more than twenty functions, asking for a task from it, and asserting `peers` is capped at the window drawn from around the target in file order while `peers_omitted` equals the remainder, so a truncated list is never mistakable for a whole file.
- found: Right shape but it exercises the `neighbours` helper directly against a 100-name vector, and covers three cases I did not: the target is never its own peer, the window SLIDES at the first and last positions rather than half-emptying, and a file that fits is handed over whole with `omitted == 0`. Sizes are asserted against `PEER_WINDOW` rather than a literal 20.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_file_that_moved_is_re_cut_before_anything_is_handed_out` — nearly — STALE
- read at `ae6a03515fc8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test that builds a temp project with a source file, scans it, then edits the file on disk so functions below the edit shift, then calls the re-cut/queue path and asserts the returned line/end_line match the new positions rather than stale scan positions, and that the right function is still identified.
- found: Writes a two-function temp file, builds a Project, asserts resync_changed returns 0 when nothing moved, then rewrites the file with three comment lines prepended plus a new `third` function. Asserts resync_changed returns 1, that `first`/`second` now report lines 4 and 5, that `second`'s body hash is unchanged (a move must not expire a reading), and that `third` is NOT added — new functions wait for a rescan.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted the re-cut but not the two extra properties it pins: the unchanged body hash, and the deliberate refusal to invent the newly-written function.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_function_that_is_gone_stops_being_offered` — nearly — STALE
- read at `f21e05b68e22` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Builds a temp repo whose file holds two functions, scans it, rewrites the file with one removed, then calls the queue endpoint; since resync_changed runs at the top of queue, asserts the deleted function is absent from the handed-out tasks rather than offered at stale lines, while the survivor appears re-cut to its new lines.
- found: Same setup and conclusion but it calls `resync_changed` directly rather than going through `queue`, and checks its return value as a count of changed files (0 when nothing moved, 1 after the rewrite). The assertion is on the scan tree itself: visit every Func node and assert the collected names are exactly ["keep"]. Nothing about line ranges is checked.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The name says "stops being offered" but the test never touches the queue — it asserts on the scan tree, so a resync that correctly dropped the node while the queue still handed it out would pass.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `status_answers_about_the_callers_repo_not_the_window` — as expected — STALE
- read at `f24e95cc04cf` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: An async test loading two project fixtures, pointing the window's active project at the second, then calling the /status handler with the first project's key and asserting project/repo and the counts describe the keyed repo rather than the focused one — plus a counterpart assertion that a keyless call falls back to the last-opened project.
- found: Exactly that: two tempdir repos inserted as "/mine" and "/theirs" into an AppState whose `active` is "/theirs" while `touch` order leaves "/mine" most recently opened; a keyed /status call asserts project == "mine" and that `repo` contains mine's path, then a keyless call asserts it still answers "mine" (last opened, not the window). It also holds a `data_home()` guard because touch persists.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Third function I have read from agentapi.rs, though a different region each time; the docs on this one carry the reasoning so completely that predicting it was nearly free.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_project_key_that_is_not_loaded_is_refused_rather_than_swapped` — as expected
- read at `75c4e912dae3` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test that builds state with one project loaded and active, calls for_client with a key naming a project that is NOT loaded, and asserts None rather than a fallback to the loaded/active one, plus a companion assertion that for_client(None) still resolves to the loaded project.
- found: Exactly that: a tempdir project inserted as "/loaded" with active set, then three assertions — a loaded key resolves to itself, "/not-restored-yet" resolves to None with a message about never answering a named project with the active one, and a keyless call falls back to "/loaded".
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The third assertion sets only `state.active`, never `touched`, so it cannot distinguish the documented keyless fallback (last repo OPENED) from the one the project notes say must never be used (`active`).

### `a_file_just_drawn_from_is_passed_over_on_the_next_call` — nearly — STALE
- read at `df28c62030f2` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Builds a project with unread functions in two or more files, then calls the queue handler twice with a batch of one, asserting the second task's path differs from the first — so the "last file drawn from" is remembered across calls, not just within one interleave_by_file batch. Probably a third call showing it returns to the first file once the others are drawn.
- found: A unit test of `spread_across_files(ranked, recent, now, n)` — the rest map and clock are passed in explicitly rather than living in handler state. Four cases: empty rest map picks the best-ranked (hot.rs); a rest entry for hot.rs pushes the draw to the lower-ranked other.rs; when every remaining task is in the rested file it hands work over anyway ("a preference, not a lock"); and a rest stamp older than FILE_REST lets ranking decide again.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Warm — my third reading from agentapi.rs, and the second from this test module, so I already knew the queue's spreading rule before predicting.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `queue_spreads_across_files` — nearly
- read at `2d5ef9f4073a` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test building a synthetic ranked list over a few files (one file scoring highest throughout), running the queue's interleave, and asserting no two consecutive handed-out tasks come from the same file.
- found: Exactly that — 5 tasks each in hot.rs/mid.rs/cold.rs with descending scores, interleave_by_file(ranked, 6), length check plus a windows(2) adjacency assertion — and additionally asserts the ranking is preserved at the head (handed[0] is hot.rs/h0), so spreading cannot degenerate into ranking-blind round-robin.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The comment claims "while other files have work left" but the assertion is unconditional adjacency; it holds only because 6 &lt; 15, not because the test checks the caveat.

### `queue_falls_back_when_one_file_remains` — as expected — STALE
- read at `fd22eb01b352` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A short test building a project whose remaining unread functions all sit in a single file, then calling the queue/interleave_by_file path and asserting it still returns work — a full batch from that one file — rather than returning empty because round-robin has nothing to alternate with.
- found: Exactly that, at the unit level: four equally-ranked tasks all in `only.rs`, `interleave_by_file(ranked, 3)`, assert three came back. It checks the count only, not which three or their order.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm: this is my second reading from agentapi.rs, though the earlier one was 2,500 lines away and in a different module section.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `queue_never_repeats_or_overruns` — as expected — STALE
- read at `5cb1e89f22c8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A short test building a small fixture and asking the queue for more tasks than exist, asserting it returns exactly the available count without panicking or padding, and that the handed-out ids are all distinct.
- found: Exactly that, but at the interleave_by_file level rather than through a project: two ranked tasks in two files, ask for 25, assert exactly 2 come back and the two ids differ.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Not cold: I had already opened a different region of agentapi.rs earlier in this run, though not this function.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `two_projects` — as expected — STALE
- read at `3ea1402927c1` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test helper: create a DataHome guard and a tempdir holding one throwaway repo, scan it once, and insert two Project entries into a fresh AppState under keys /x and /y both backed by that scan, returning the tuple so the caller keeps the DataHome alive.
- found: Exactly that. It writes a single trivial a.rs into the tempdir, then inserts project_of(dir.path()) twice under "/x" and "/y" into an AppState::default(), returning (data, dir, state). The scan is done per-insert by project_of rather than once and cloned.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_unasked_open_does_not_steal_the_window` — nearly — STALE
- read at `23c573ebbd8a` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test that pins the window to project A, opens project B without asking to be shown, and asserts the view is still on A while B remains registered and addressable; probably followed by an explicit asked open showing the view does move.
- found: Exactly the second half of that, and only that: two_projects() fixture, active pinned to /x, focus("/y", false) must return false and leave active at /x, then focus("/y", true) returns true and moves active to /y. It tests focus's return value and `active` directly rather than going through an open endpoint, and does not assert anything about /y remaining addressable — that is left to the sibling routing tests.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_open_takes_a_window_that_nobody_holds` — nearly — STALE
- read at `4e4692673ece` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test that, starting from a headless state with no `active` project and nothing holding the window, calls focus/open with asked=false and asserts focus moves anyway — `active` ends up naming the opened project — because declining would leave keyless callers resolving to nothing. Probably built on a temp DataHome fixture like its neighbours.
- found: Builds the `two_projects` fixture, asserts `state.focus("/y", false)` returns true when nothing is being looked at and that `active` becomes "/y"; then sets `active` to a project key that is not loaded ("/gone") and asserts an unasked focus still takes the window, with a comment explaining a dangling `active` points at nothing so it is not a view taken from anybody.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_keyless_call_follows_the_last_open_not_the_window` — nearly
- read at `fa6903e398b2` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: A test loading two projects, setting the window (`active`) to the first and the last-opened (`touched`) to the second, then asserting for_client(None) resolves to the second — the last opened — not the one on screen.
- found: That, via a `two_projects()` fixture: focus("/x", true) then touch("/x"), touch("/y"); asserts active is still "/x" while for_client(None) is "/y". Two assertions beyond my prediction: an explicit key still wins outright, and a key naming nothing loaded still returns None.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Its last two assertions duplicate a_project_key_that_is_not_loaded_is_refused_rather_than_swapped, and this test is the one that actually separates `touched` from `active`.

### `endpoint_reads_back_what_was_published` — surprising — STALE
- read at `0351b3dd7aea` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A short round-trip test: publish an endpoint (write the endpoint file with port and pid through the publish helper), read it back with the shared parser, and assert port and pid survive — probably under a temp DataHome guard so the real file is untouched.
- found: It never publishes and never parses. It constructs `Endpoint { port, pid }` in memory, asserts `url()` formats as http://127.0.0.1:51823, then hand-builds a JSON string with `serde_json::json!` from those same two fields and asserts serde_json reads the two numbers back. Nothing under test writes or reads the endpoint file.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The name and doc promise a round trip through "the one parser both halves share", but the body only checks that serde_json can read a JSON object this test just built by hand — the publish and parse paths are never called, so the property claimed is untested.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/assessment.rs

### `reading_hash` — as expected — STALE
- read at `7592537f71be` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Concatenates the optional doc with the body and returns the same whitespace-collapsing digest body_hash produces, delegating to body_hash on the joined string, with None treated as no doc.
- found: Exactly that: match on doc; Some(d) hashes format!("{d} {body}") through body_hash, None hashes the body alone.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `body_hash` — nearly
- read at `b719bea07049` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Collapse whitespace (split_whitespace over the body), run an FNV-1a-shaped loop over the resulting bytes seeded with the FNV offset basis but using the deliberately-wrong multiplier described in the docs, and return the digest as a short hex string.
- found: Exactly that, plus one detail I did not state: the digest is truncated to the low 48 bits and printed as 12 hex digits so it fits in a line of Markdown. The multiplier is 0x1000_0000_01b3, one hex digit wider than FNV-1a's real prime 0x100_0000_01b3 — so the doc's claim about the constant is accurate.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Correcting my own earlier note on this function: the multiplier really is not the FNV prime (extra digit), so the doc is right and my first reading of it was wrong.

### `dir` — as expected — STALE
- read at `9f01c2a78302` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Returns the .sanity directory path for a repo — repo.join(".sanity") — the single home for assessment files.
- found: Exactly repo.join(".sanity").
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `shard_of` — surprising — STALE
- read at `8b4520464080` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Returns the shard for a repo-relative path: the parent directory (everything before the last '/'), with a fixed literal like "root" when the path has no slash so loose root files share one shard.
- found: It shards by the FIRST path segment, not the parent directory — `split_once('/')` takes the top-level directory, so everything under src-tauri/ is one shard. Empty first segment (leading slash) also falls to "root", which I did get right.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The docs spell out the root-files case but never say the shard is the TOP-level segment rather than the containing directory, which is the one ambiguity that decides how many files you get.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `shard_links` — as expected
- read at `ebec6dfdb1ee` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Scans the index Markdown for `[label](name.md)` links and returns the link targets (shard filenames), so save knows which files it wrote and may sweep; likely a manual find of `](` … `)` filtering to .md names.
- found: Exactly that: match_indices("](") , slice to the next ')', keep names ending in .md, excluding any containing '/' and excluding README.md itself. Returns Vec<String>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `shard_file` — nearly — STALE
- read at `82875afa9c33` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Turns a shard name (a top-level directory or path prefix from shard_of) into the Markdown filename it is stored under in .sanity/ — slugifying path separators and awkward characters into hyphens/underscores and appending .md, with some fallback for the root or empty shard.
- found: Maps every character that is not alphanumeric, '-', '_' or '.' to '-', then appends ".md". No special case for an empty shard (which yields ".md") and no length cap or de-duplication of runs.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The sanitisation is not injective — "a/b" and "a-b" both become "a-b.md" — so two distinct shards could in principle collide onto one file; whether shard_of can produce such a pair is not visible from here.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `key_of` — as expected — STALE
- read at `c5dbf2ea00fd` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: path#name when ord is 0, otherwise path#name#(ord+1); a single branch and nothing else.
- found: Exactly that, character for character.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs are far larger than the body and carry the incident history behind it — the format is derivable from the code, the reasoning is not.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `grade_word` — as expected — STALE
- read at `cd401b37ca7f` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Counterpart of parse_grade: a match over the Grade enum returning its lowercase spelling ("full"/"most"/"some"/"none") for the Markdown store.
- found: Exactly that four-arm match, verbatim.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `parse_grade` — as expected — STALE
- read at `7050ddd0e504` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: The inverse of the neighbouring grade_word: match a trimmed, lowercased string against "full", "most", "some", "none", returning the matching Grade variant and None otherwise. Nine lines because it is a match with four arms plus a fallthrough, used when parsing the committed Markdown back in.
- found: Exactly that — `match s.trim()` with the four literal arms and `_ => None`. The only difference from my guess is that it does not lowercase, so it is case-sensitive; safe because grade_word writes the file.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `verdict` — nearly — STALE
- read at `a9724c12309c` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A match over the report's predicted grade returning a short static human-readable heading word like Surprising/Predictable, with the legacy surprised boolean handled underneath, used only for skimming.
- found: A four-arm match on r.grades().0 returning "as expected" / "nearly" / "surprising" / "unrecognisable". The legacy-boolean fallback I expected lives in grades(), not here, so this function is purely the word table.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `flat` — as expected — STALE
- read at `906c4bda7d98` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 3 of its run
- expected: Splits on whitespace and rejoins with single spaces, collapsing newlines and whitespace runs into one line — a one-liner over split_whitespace().collect::&lt;Vec&lt;_&gt;&gt;().join(" ").
- found: Exactly that, character for character.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Second function I have read from assessment.rs, though I read only the six lines of reading_hash, not the file.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `load` — nearly
- read at `5ce1ef6cbfcc` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Reads every shard via read_all into a map keyed by key_of, then walks the scan's live functions and re-keys each matching reading under that function's node id; readings matching no live function are dropped.
- found: Exactly that, with an early return on an empty store and one detail I missed: it chains live_files(scan) after live_funcs(scan), so whole-file readings are resolved by the same rule, and it stamps the live node id onto the cloned Report's own `id` field as well as the map key.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc says "readings whose function no longer exists"; the body also covers file-level readings, which the doc does not mention.

### `read_all` — as expected
- read at `23599632fd93` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Read the `.sanity/` directory, take every shard Markdown file except the index/README, parse each with parse_shard, merge the entries into one HashMap keyed path#name, and return empty (never error) when the directory is missing or a file cannot be read.
- found: Exactly that: read_dir with a `let Ok(...) else { return out }` early exit, skip non-.md and README.md, read_to_string each and hand it to parse_shard which appends into the shared map; all errors silently skipped.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The one-line doc says keys are `path#name`, but per the project's own rule keys are `key_of(path, name, ord)` and same-named twins carry a `#2`/`#3` suffix — the doc understates the key.

### `parse_shard` — nearly
- read at `8c6f058797a2` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A line-by-line state machine over one shard's Markdown: a heading line carrying path#name starts a new entry and flushes the previous, subsequent bullet lines are matched by label prefix (expected, found, predicted, documented, derivable, legible, cold, trap, by, at, body, position, model) and parsed into the Report, grades via parse_grade and booleans by word. Unrecognised lines are skipped silently and an entry lacking expected or found is dropped at the flush rather than inserted.
- found: Close, with the structure two levels deeper than I guessed: `## ` sets the current FILE and `### ` opens an entry, so a key is built from file + name rather than read off one heading. The entry heading carries a human verdict after an em dash (decoration, recomputed on write) and an optional " #2" ordinal, printed 1-based and keyed 0-based; a name equal to FILE_ENTRY keys through file_key instead of key_of. Only expected/found/note are their own bullets — every other field arrives as a middle-dot-separated segment inside one of two bullets, matched by segment prefix ("read at", "commit", "read by", "by", "cold reading"/"warm reading", "reading N of its run", then the grades) so a reordered hand-edit costs one segment. The flush guard is OR, not AND: an entry survives with either expected or found present.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says an entry "missing its expected/found is dropped on its own", but the guard keeps any entry with EITHER field non-empty, so a reading with a found and no expected is loaded — and the doc also describes keys as `path#name` when they are really key_of(path, name, ord) with a file_key special case.

### `live_funcs` — nearly — STALE
- read at `aaf16c01c90c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Walks the scan tree collecting every Func node grouped by file, sorts each file's functions by line, assigns per-name ordinals so same-named twins take 1/2/3, and builds a map from key_of(path, name, ord) to a Live record carrying id, path, name, owner, line and body/reading hash.
- found: That, with two details I did not have: ordinals are 0-based (first twin is ord 0), and the sort is by line THEN by node id, with a comment saying the tiebreak makes ordinals a pure function of the file so two scans of unchanged code cannot disagree about which twin is which. The per-name counter is a HashMap reset per file. Live carries id/path/name/line/ord/body — no owner.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_stale` — as expected — STALE
- read at `713c98701a0f` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Compare the report's stored body hash against the current body hash; empty/absent recorded hash returns false (taken at its word), a missing current body also returns false, otherwise stale iff they differ.
- found: A three-arm match on (report.body.as_str(), node_body): empty recorded -> false; both present -> inequality; current missing -> false. The hashing happens elsewhere; report.body already holds the hash string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs explain the no-hash case well; the field carrying the hash is named `body`, which reads like it holds source rather than a digest.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `row` — nearly — STALE
- read at `de85ede41ee8` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A tiny accessor on Compiled (one shard) returning the summary tuple the index table needs: shard name/path plus four counts — total functions, read, stale, and excluded/remaining. One expression cloning the name and copying counters.
- found: Exactly that shape: (shard.clone(), read, total, surprising, stale). The fourth count is `surprising` rather than an excluded/remaining count.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: A five-slot positional tuple of one String and four same-typed usizes is the kind of return where swapping `read` and `total` at a call site compiles fine and silently mislabels the index table.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `compile` — nearly — STALE
- read at `b1d62db51484` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Iterates the scan's live functions rather than the reports, keys each with key_of, decides staleness by comparing the stored hash against the current doc+body, buckets them into shards by directory, and for each shard renders the Markdown plus the counts (read, stale, total) the index row needs, returning Compiled values without writing anything.
- found: That, structurally. Details: it uses live_funcs keyed by l.id into the reports map (the keying happens in live_funcs, not here); BTreeMaps throughout so the byte output is deterministic and git diffs stay minimal; two nesting levels, shard_of(path) then path, holding Placed records; per shard it sorts entries by line then name, emits a '## path' heading and render_entry per function, and counts read, stale and a `surprising` tally I did not predict (grades().0 being Some or None). `total` is recomputed by re-filtering all live funcs per shard — O(shards x funcs) — so the denominator counts unread functions too.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `repo_name` — as expected — STALE
- read at `eff5fe3aeb1d` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Takes the repo path's final component as its name, converting lossily to String, and falls back to something like the whole path or a literal placeholder when there is no file name (root, or a path ending in "..").
- found: Exactly that; the fallback is the literal string "this repo", which reads as prose in the generated index rather than as a path.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `as_str` — nearly — STALE
- read at `b74e2a375a74` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Index is a small enum reporting the outcome of refreshing .sanity/'s index, so as_str is a match over about four variants — unchanged / written / absent / failed — returning a stable lowercase wire word each.
- found: A four-arm match: Current =&gt; "current", Refreshed =&gt; "refreshed", Absent =&gt; "absent", and Failed(e) =&gt; the error text itself rather than a fixed word.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Three arms return a fixed status word and the fourth returns free-form error text, so a caller comparing against known words cannot tell a failure from an unrecognised status — the failure is legible to a human but not to a match.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `refresh` — as expected
- read at `56a49170516c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns early with an absent/default Index if .sanity/ doesn't exist; otherwise compiles index + shards once from scan+reports, writes each file only when bytes differ, skips shards not already on disk, returns the Index.
- found: Exactly that: reads README.md (absence => Index::Absent), compiles, writes changed shards only if the shard file already exists, rewrites README.md if different, and returns Refreshed/Current/Failed(err).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `save` — surprising
- read at `8544e784b1ae` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Rebuilds .sanity/ from the live scan rather than the reports map: walks live functions, keys each with key_of(path, name, ord), looks up its reading, marks stale on a hash mismatch, groups into per-file shards, renders the shards and the README index, creates the directory, writes only files whose bytes differ, leaves human-authored files alone, and returns io::Error so a failed write is reported rather than absorbed.
- found: The grouping, keying and staleness arithmetic are all delegated to `compile` (shared with refresh so the index and shards cannot disagree); save itself only does the IO. What I missed entirely is the orphan sweep: before overwriting README.md it parses the OUTGOING index's shard links, and that link list is the only record of which files this tool owns — so the post-write cleanup can delete only files it previously claimed, never a human's note left in the shared directory. Order matters and is argued in comments: index written first, prune after, errors returned via `?`, NotFound treated as success. It also writes unconditionally rather than diffing bytes (that is refresh's rule, not save's).
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: save() carries no doc comment at all even though it is the durable-write entry point for .sanity/; everything explaining it is inline, so the ownership rule (only files the previous index linked may be deleted) is invisible from the signature.

### `render_entry` — nearly
- read at `8d69790154f7` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Build the Markdown block for one reading: a heading with the function name (backticked, with a #n suffix only when it has a twin, or a file marker when is_file), the verdict plus a STALE marker, then bullets for provenance (hash, commit, model, by, cold, position), expected/found, the grades (predicted/documented/derivable/legible/trap) and the note — in exactly the shape parse_shard reads back.
- found: All of that. Extras I did not name: the heading also carries skim markers NONSENSE/MURKY for the loud end of `legible` and TRAP, all of which are decoration parse_shard strips and recomputes; grades come from r.grades() and both documented and legible print "not judged" rather than a default when absent; and a stale entry gets an extra explanatory bullet at the end.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No doc comment on a function that defines the on-disk record format, though the inline comments carry the reasoning well; `let tail = marks;` is a leftover rename.

### `render_shard` — nearly — STALE
- read at `51984db42506` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Formats one .sanity/ shard Markdown file as a string: heading naming the shard, a generated-file warning, a coverage line built from read/total/surprising/stale (probably a small table or percentage), then the pre-rendered body of entries appended. Pure string assembly, no I/O, in a shape parse_shard can read back.
- found: One `format!`: an H1 "{shard} — sanity assessment", a counts line "{read} of {total} functions read · {surprising} surprising" with " · {stale} stale" appended only when stale > 0, then two fixed prose paragraphs explaining what a reading is (predict from signature/peers/docs, never the body, the gap is the finding) and what the `read at` body hash and STALE mean, a link to README.md, then the body. No percentage and no generated-file warning — instead it is written for a human landing on the file in the repo.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `render_index` — nearly — STALE
- read at `86f8ab36d4fe` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Builds .sanity/README.md as a String: a heading naming the repo, prose explaining what the directory is and that readings expire, a Markdown table with one row per shard (linked top-level directory plus its four counts) and a totals line.
- found: Exactly that shape. The table columns are read / of / surprising / stale with a bolded **total** row summing all four. The prose is longer and more outward-facing than I expected — it explains the reading protocol to a stranger, insists the files are readable without software, and carries a Homebrew cask install line, the sanity.monster URL, "study this project in sanity" instructions, a note that readings are unowned, an explanation of the shard-by-directory split as diff hygiene, and a closing argument for committing the directory.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The five-tuple parameter is positional and unnamed — (String, usize, usize, usize, usize) gives a caller no way to tell `surprising` from `stale`, and swapping them would compile and produce a plausible-looking wrong table.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `git` — nearly
- read at `15b063d45267` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A helper shelling out to `git -C repo <args>`, returning Some(trimmed stdout) on success and None if it fails to spawn or exits non-zero, used by head/who to stamp provenance.
- found: Exactly that, plus one detail I did not state: empty output is also folded into None via `(!s.is_empty()).then_some(s)`, and decoding is from_utf8_lossy rather than strict.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `head` — nearly — STALE
- read at `95141b281c2b` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Runs git rev-parse HEAD via the sibling git helper in repo and returns the trimmed sha, or an empty String when it fails / there is no git repo.
- found: git(repo, &["rev-parse", "--short", "HEAD"]).unwrap_or_default() — the only detail I missed is --short, so it stores an abbreviated sha.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc earns its place: that an empty string is a permitted, meaningful value is not derivable from unwrap_or_default alone.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `who` — nearly — STALE
- read at `58e1cbad58ed` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Uses the neighbouring git helper to read config user.name and/or user.email in the repo, returning a Name <email> style string with a fallback like "unknown" when git has no identity.
- found: Tries git config user.email, falls back to user.name, and unwrap_or_default — so the fallback is an empty string, not a placeholder, and the two identities are alternatives rather than combined.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Email is preferred over name and an unconfigured git yields an empty `by:` rather than any marker, so a machine with no identity writes readings attributed to nobody without saying so.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_human_file_in_the_assessment_survives_a_save` — surprising — STALE
- read at `f9a9563c635e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Builds a repo, saves an assessment so .sanity/ has README and shards, drops a hand-written note beside them, saves again and asserts the note survives — while a stale shard the new index no longer names IS swept away.
- found: First half right: it scans a one-function tempdir, saves, writes NOTES.md, saves again, and asserts NOTES.md survives. The second half is the opposite of my prediction — it also writes gone.md and asserts that it too survives, because the sweep only removes files the outgoing index claims, not files it merely fails to recognise.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The two inline comments about gone.md contradict each other — line 929 calls it "a shard this tool wrote and has since stopped claiming", line 936 says it "was never linked by an index this tool wrote".
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `report` — surprising — STALE
- read at `385075bfa538` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A test fixture builder: constructs a Report for the given id with `note` as its prose and everything else at plausible defaults — grades at some fixed value, derivable/trap false, empty by/at/body/model, no position — so round-trip and staleness tests can make one in a line.
- found: A fixture builder, but deliberately the opposite of defaults: every field is set to a distinct non-default value so a round-trip that drops one is caught — expected is multi-line on purpose, the three grades are three DIFFERENT variants (Some/Full/Most), trap true, cold true, position Some(3), and body/by/at carry a fake hash, email and short SHA. Only the remainder comes from `..Report::blank()`.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Second function I have read in assessment.rs, so this reading is warm; the fixture bakes in a real personal email address as the `by` value.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `round_trips` — as expected — STALE
- read at `65a58f6e2f0e` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test that builds a Report with every field populated, renders it to the Markdown store (render_entry/render_shard) into a temp dir, parses it back, and asserts the recovered reading equals the original — grades, expected/found prose, note, trap, by/at provenance and body hash all surviving the Markdown round trip.
- found: Exactly that, in memory rather than through a temp dir: `render_entry` into a hand-built file section, `render_shard` around it, `parse_shard` back into a HashMap, then field-by-field assertions on expected, found, note, body hash, at, by, cold, derivable, legible, trap, predicted, documented and position. Inline comments tie the legible/trap assertions to the four-field schema drift the repo already suffered, and note that `position` doubles as the check that the `read at` / `read by` / `reading N` prefixes still disambiguate.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_reading_without_a_position_does_not_claim_to_be_the_first` — as expected — STALE
- read at `d3b54c913fc8` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A unit test that takes a rendered assessment entry lacking a position line (or a Report with position None), parses it back through the Markdown store, and asserts the parsed position is None rather than Some(1).
- found: Exactly that: a literal shard Markdown string with no position field is fed to parse_shard into a HashMap, and the single assertion is that back["src/a.rs#foo"].position == None.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `key_ignores_line_numbers` — as expected — STALE
- read at `c5ac57efcd3b` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A tiny test asserting key_of produces the same key for the same path/name/ord regardless of line number — calling it twice against nodes whose ids differ only in @line and asserting equality.
- found: Builds two synthetic scans via `scan_of` holding the same `src/a.rs` function `foo` at lines 12 and 480, and asserts the key sets from `live_funcs` are equal. It goes through `live_funcs` rather than calling `key_of` directly, so it checks the map that actually keys stored readings.</found> <parameter name="predicted">most
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Comparing `keys().collect::<Vec<_>>()` compares ordered vectors, so this passes only while the map iterates deterministically; with one entry it cannot fail either way, so the assertion is weaker than it looks.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `same_named_functions_in_one_file_stay_apart` — as expected — STALE
- read at `1cdce84846de` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test building a scan with two same-named functions (two inits) in one file, saving readings for both, reloading, and asserting each keeps its own distinct reading — keys disambiguated by ordinal (#2), nothing lost from the totals, neither falsely stale.
- found: Exactly that: scan_of with two A.swift inits plus a third function; asserts live_funcs yields 3 keys including "A.swift#init" and "A.swift#init#2" with their own body hashes, then round-trips through save/load in a pid-named temp dir and asserts all three readings return and none is stale, cleaning the temp dir at both ends.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `hash_ignores_formatting` — as expected — STALE
- read at `a0142f082ca2` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Asserts body_hash/reading_hash collapses whitespace: hashes the same code written two ways (different indentation, line breaks, trailing spaces) and asserts equality, and probably that a real token change gives a different hash so the collapse is not too aggressive.
- found: Exactly that, minimally: the same three-line if-block at two indentation levels hashes equal, and "go()" versus "stop()" hashes unequal. Only indentation is varied — not line breaks or trailing whitespace — so the "collapses whitespace across a reflow" claim is exercised only in its indentation form.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Second function I have read in assessment.rs, so this reading is warm; the test also covers re-indentation only, not the line-rewrapping case the doc's "reformat" implies.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_reading_expires_when_its_documentation_changes` — as expected
- read at `4d1404b407ff` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test hashing a doc/body pair with reading_hash, then rehashing with the doc changed and the body identical, asserting the hashes differ so the reading goes stale — probably paired with an assertion that a whitespace reflow of the same doc does not change it.
- found: Exactly that, in three assertions: a rewritten doc differs, adding a doc where there was none differs, and a reflowed doc is equal. reading_hash takes three arguments (a leading Option I had not accounted for — the module header, per its sibling test).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `stale_when_the_body_moves` — nearly — STALE
- read at `496e1e61a819` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A short test building a reading whose body_hash was taken against one body, then asserting it reads STALE against a different body and current against the same one.
- found: That, plus a third case I did not predict: a Report with an EMPTY body hash (a migrated reading with no recorded hash) is deliberately NOT stale even against a mismatching hash — taken at its word.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `survives_a_mangled_entry` — as expected — STALE
- read at `dc8ce65785f5` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test writing a .sanity Markdown shard holding one valid entry and one mangled/incomplete entry, parsing it back, and asserting the good entry is recovered while the damaged one is skipped rather than failing the whole file.
- found: Exactly that: a literal shard with a `broken` entry that has only a "read at" line and an `intact` entry with the full field set; parse_shard into a HashMap, asserts the broken key is absent ("an entry with no reading is dropped") and the neighbour survives with predicted == Most and derivable true.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `scan_of` — nearly — STALE
- read at `436aae6ef071` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test helper turning a compact (path, name, line, body) tuple list into a Scan: grouping tuples by path into file nodes, building one function node per tuple with id `path#name@line`, its name, line and body hash, defaults elsewhere, and returning the assembled Scan for the surrounding round-trip tests.
- found: That, built via `Node::dir` and then mutated into shape (kind set to Func/File afterwards rather than a Func constructor), grouped through a BTreeMap so file order is deterministic, with `body` set to `body_hash(body)`. It also fills a `ScanStats` I did not predict: zero commits/files, `functions` = input length, `without_history: true`, `model: "test"`.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The helper stores `body_hash(body)` in `node.body` while the doc-aware `reading_hash(doc, body)` is what production stores there, so nodes built by these tests are hashed by a different rule than real ones.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_stale_index_is_rewritten_on_open_and_an_absent_one_is_not_created` — nearly — STALE
- read at `1ff6ec8eab62` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A temp-repo test: write a .sanity/README.md with stale prose, call the open-path refresh, assert it was rewritten to the freshly compiled index; then against a repo with no .sanity/ assert nothing is created. Possibly also that identical bytes are not rewritten.
- found: All of that, in four явных stages against a three-variant Index return: Absent (and .sanity/ must not exist afterwards), Current after a fresh save (no write when bytes match), Refreshed after doctoring the README to an older version's wording, with the new text checked. Plus a fourth assertion I did not predict: save() again must produce bytes identical to what refresh wrote, so open and report cannot rewrite past each other into a permanently dirty diff.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The temp directory is named from the process id alone, so two tests in this file using the same scheme would share a path under cargo's single-process parallel runner — this one is unique by prefix, but it is a convention one copy-paste away from flaking.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `writes_and_reloads_a_repo_assessment` — nearly — TRAP — STALE
- read at `cd94b39a8c4d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: End-to-end round trip: build a temp repo with a source file, scan, attach a report to a function, save .sanity/ (index plus shard Markdown), then move the function down the file, rescan, load back, and assert the reading still attaches and is not stale, because the key is key_of(path,name,ord) and the hash ignores position.
- found: That, plus the negative half I did not predict. Saves two functions in two top-level dirs, asserts both shard files and README.md exist and that the index contains "sanity.monster" and the "study this project in sanity" refresh instruction. Then reloads against a scan where `walk` MOVED (line 40 to 118, same body) and `App` was REWRITTEN (same line, div to span), asserting both readings re-attach by key but only walk is current — the rewritten one is stale.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The temp directory is keyed only on process id, so two tests in the same process that pick the same name would collide, and the leading remove_dir_all means a collision silently deletes the other's fixture rather than failing.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `shards_by_top_level_dir` — nearly — STALE
- read at `3e71ff49437a` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A tiny test asserting .sanity/ shards group by top-level directory: build readings under a few top-level dirs, run the shard/compile step, assert one shard per dir named after the directory.
- found: Three one-line assertions on the two pure helpers rather than on any compile step: shard_of("src-tauri/src/scan.rs") == "src-tauri", shard_of("justfile") == "root" (the file-at-repo-root case), and shard_file("src-tauri") == "src-tauri.md".
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/bin/history.rs

### the file itself — nearly
- read at `855b2edad4c9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A main-only CLI binary: parse a repo path plus flags (--files, a commit cap, a cache toggle), run the replayer uncached by default, time it, and print commit count, functions at HEAD, elapsed, and the biggest frames; --files gives a per-file breakdown for reconciling against just scan.
- found: Exactly that shape, with one flag I did not predict: --json dumps the same payload the webview receives so both replay implementations can be compared headlessly. It also replays the deltas itself rather than trusting a stored total, and reports functions-ever, alive-at-HEAD, lines, peak, and truncated-into-opening-frame counts, then the eight busiest commits.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The header does not mention --json, which is arguably the file's most load-bearing feature (checking the frontend replay against this one).

### `main` — nearly
- read at `f7bcecf09365` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: CLI entry: parse argv for a repo path plus flags (--files, a commit cap, a cache toggle defaulting to uncached), build the replayer, fold the timeline while timing it, then print commit count, elapsed, function count at HEAD and the biggest frames; --files adds a per-file tally for reconciling against just scan.
- found: All of that, plus a --json flag that dumps the exact serialised payload the webview receives and returns early (so the frontend replay can be checked against this one headlessly). Totals are computed by actually replaying the set/del deltas over hist.base into a live map rather than trusting a stored total, tracking peak liveness; prints files/functions-ever/alive-at-HEAD/lines/peak, an empty-history message, a truncation note, the per-file table sorted by function count, and the eight busiest commits.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Arg parsing treats any unrecognised token as the path, so a typo'd flag like --file silently becomes the repo path instead of erroring.

## src-tauri/src/bin/sample.rs

### the file itself — nearly
- read at `f695630c471b` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A small `just sample` binary with a single main: parse argv (repo, out dir, optional n with a default), run the same scan the app does, take every total/n-th function in scan order by stride, and write each as a handout file (name, owner, signature, docs, peers, path, line range — body withheld) into the out dir. No leasing, no .sanity/, prints a count.
- found: All of that, plus the piece I got wrong: it writes TWO files per exercise, NN_head.md (the handout) and NN_body.txt (the answer key sliced from the file at the task's current line bounds) — the body is not withheld, it is the graded reference. Also: scan runs with both memos ephemeral and Fidelity::Ordering because the scores are never printed, and a task whose line bounds no longer fit the file is silently skipped (deliberately, per the inline comment).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The header never mentions the head/body file pair, which is the whole output shape and the one thing a person running `just sample` needs to know.

### `main` — surprising
- read at `a594be81f1c1` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Parses argv into repo, output dir and optional n with a default, erroring on missing args; scans the repo, flattens to functions in scan order, takes every total/n-th by stride, and writes each as a handout file holding everything sanity_next sends minus the body, then prints a count.
- found: That, with two things I did not cover. Args default rather than erroring (".", "sample", 10). It scans with ephemeral memos and Fidelity::Ordering, both with comments explaining why (a cached run is not a run of the thing measured; the all-pairs term would cost 30s for a number this tool never prints). And crucially it writes TWO files per exercise, not one: NN_head.md is the handout, NN_body.txt is the sliced body — the answer key, which is the whole point of a validation exercise and the half I missed. It skips silently on unreadable files or line bounds that have drifted past the file end, with a comment arguing the drift should be preserved rather than papered over.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: `written` doubles as both the count and the filename index, so a skipped function leaves no gap in the numbering — deliberate, but it means the printed count is the only signal that a stride slot was dropped.

## src-tauri/src/bin/scan.rs

### `main` — surprising — TRAP — STALE
- read at `5b74b335a19e` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The `just scan` headless entry point: read a repo path and flags from argv, run the scanner, flatten the tree to functions, then print the hottest N with temperature, path and quadrant label, the calibration histogram of the score spread, and baseline_check comparing rank agreement against a plain wc -l sort, with names truncated to columns.
- found: That, plus a whole arg/feature layer I did not cover. Flags are only PATH, --local WEIGHTS and -h; --local selects a LocalModel behind the local-model cfg and hard-exits with a rebuild instruction when the feature is off, otherwise HeuristicModel. The scan is deliberately run with ephemeral memos and Fidelity::Full, both with comments saying a cached or reduced run would be measuring a different instrument. It prints a header line (files, functions, lines, model), a warning when there is no git history, an early return on nothing parseable, and a headline "% of lines are hot" using temperature > 0.5 weighted by loc. Then histogram, baseline_check, and TWO sections — HOTTEST ranked by temperature × loc (commented at length: intensity times extent, to match what the eye reads off the sunburst) and BULKIEST PREDICTABLE filtered to Quadrant::Bloat.
- predicted: some · documented: none · derivable: yes · legible: most · trap: yes
- note: Argument parsing lets any unrecognised token silently overwrite `path`, so `sanity-scan --lcoal foo` scans `foo` instead of erroring, and a typo'd flag is indistinguishable from a path.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `histogram` — nearly
- read at `4c74b4d20fb0` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Buckets functions' surprise/temperature scores into a fixed number of bins (probably 10 across a 0-100 scale), counts how many fall in each, and prints one line per bin with a label, a proportional bar of characters, and the count.
- found: Exactly that: ten buckets, temperature (0..1) times 10 clamped to 9, bar scaled to the peak bucket at width 34, labelled " 0-10 " etc. with the count. Two small details beyond the prediction: missing scores fall to 0.0 (so unscored functions land in the coldest bucket), and a non-empty bucket gets at least one block so it never renders as empty.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `baseline_check` — nearly
- read at `6d9317dcabd3` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Builds the real top-N ranking (temperature × lines) and a rival top-N sorted by raw line count, intersects the two id sets, and prints the overlap as k of N — the metric's own falsification test in the default output.
- found: That, with N = 15, an early return when the repo has fewer than 15 functions, a shared `top` closure that sorts the slice in place by a supplied rank fn and collects ids, and — beyond my prediction — a banded verdict sentence: 0-6 "finding things size alone does not", 7-11 "partly size", 12+ "SIZE IS DOING THE WORK: this ranking is wc -l with extra steps".
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: by_size ranks on loc alone, so ties among equal-length functions are broken by whatever order the previous sort left the slice in — the baseline number can wobble between runs on a repo with many same-length functions.

### `section` — as expected
- read at `a5b137b2efc0` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A printing helper for the headless scorer's report: sorts the borrowed slice of function nodes in place by `rank` descending, prints the title as a heading, then prints the top N (ten or so) as aligned rows — score, path, name, maybe lines and quadrant label — using truncate to keep names in column. Returns nothing, writes to stdout.
- found: Exactly that: sort_by on rank descending with partial_cmp falling back to Equal for NaN, a blank line and the title, then take(15) filtered to rank > 0, printing temperature as degrees (×100), the name truncated to 28, LOC, the quadrant label, and path:line. `n.score` is unwrapped with unreachable!('ranked nodes are scored').
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: take(15) is applied BEFORE the rank > 0 filter, so a section whose top rows rank zero prints fewer than fifteen entries while non-zero ones exist below — deliberate-looking here since the list is rank-sorted, but the ordering of the two adaptors is load-bearing.

### `quadrant_label` — nearly — STALE
- read at `29d9cd256d76` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A pure match over the four Quadrant variants returning a short static display string apiece — the surprise × age/churn quadrants, with labels along the lines of hot-and-churning, hot-and-settled, cold-and-churning, cold-and-settled. Eight lines is signature plus four arms.
- found: Exactly a four-arm match: CrownJewel, Trouble, Bloat, Quiet map to their lowercase hyphenated names.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `truncate` — as expected
- read at `93d56c49406a` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A CLI display helper: return s unchanged if at most n characters, else cut to about n-1 chars and append an ellipsis, counting chars not bytes to stay UTF-8 safe.
- found: Exactly that — chars().count() <= n returns as-is, otherwise take(n-1) plus '…', with an inline comment explaining that byte slicing would panic mid-codepoint.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Docs handed over were the file-level module docs about `just scan`, not about this function at all; n = 0 would underflow on the n-1 path, though callers pass constants.

## src-tauri/src/bin/tokens.rs

### `tok` — as expected — STALE
- read at `d85e7f4d901a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A one-line estimator turning a character count into an approximate token count for the `just tokens` report — dividing by a constant of roughly 4 chars per token, possibly with rounding up or a .max(1) so non-empty text never reads as zero.
- found: Exactly the division, `chars / CHARS_PER_TOKEN`, with no rounding and no floor — short strings truncate to 0.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `row` — as expected — STALE
- read at `2366b6afe64b` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A tiny print helper for the `just tokens` report: one aligned println with the label, the character count, and an estimated token count from tok(chars), using fixed-width formatting.
- found: Exactly that: `println!(" {label:<34} {chars:>8} ch ~{:>7} tok", tok(chars))`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `pct` — as expected — STALE
- read at `7caadf1e0773` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A nearest-rank percentile over a pre-sorted slice: guard the empty case with 0, then compute an index from p times the length, clamp it into range, and return that element without interpolating.
- found: Exactly that. Empty returns 0; index is `((len - 1) as f64 * p).round()`, indexing the last element at p = 1.0 with no clamp needed.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `big` — as expected
- read at `aa6b5b1d0ed7` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Format a count with a magnitude suffix: >=1M as one-decimal M, >=1k as one-decimal k, otherwise the plain number.
- found: Exactly that, as a three-arm match with guards.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main` — nearly
- read at `5557c2efb4b0` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Takes a repo path defaulting to '.', serialises mcp::tools() and measures each tool's schema in estimated tokens at a flat chars-per-token ratio, weighs PROTOCOL and READER_PROMPT the same way, then scans the repo and builds real task payloads for median/p90 sizes with peers broken out, and prints a table of the reader's fixed floor, the variable per-reading part, and a whole-repo projection.
- found: All of that, in three labelled sections. Per-tool rows are annotated "· never called" for anything that is not sanity_next or sanity_report; PROTOCOL is priced separately as orchestrator-only and deliberately excluded from the fixed prefix. The scan uses ephemeral memos and Fidelity::Ordering with comments justifying both. Distributions are median/p90/max over task JSON, peers, docs, signature and body lines. Two things I did not cover: bodies are ESTIMATED at a constant 38 chars/line because the scan keeps only a body hash, and the closing paragraphs state the conclusion outright — the floor is 3-4x understated because every turn re-sends, and the tool descriptions a reader never calls are priced as a repo-wide total that is 'ours to cut'.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: 161 lines of which perhaps a third is prose the tool prints or comments arguing why a constant is what it is — this file is closer to a written argument that recomputes itself than to a program.

## src-tauri/src/blame.rs

### `range` — as expected
- read at `2907ccea6d61` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Clamp the inclusive 1-indexed start/end onto the stored per-line entries, return None if that leaves nothing, then fold the slice into the four facts: distinct commit count (churn), days since the most recent line's commit, age from the oldest line's commit, and the author of the most recent line.
- found: Exactly that: lo/hi clamped with max(1)/min(len) and a `get(lo..hi)?`, an empty-slice None, one pass accumulating a HashSet of commit ids, the newest line and the oldest timestamp, then RangeHistory{commits, last_touched_days, age_days, last_author} with times converted to days via a max(0) guard and the author resolved through an interning table by index.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `get` — as expected — STALE
- read at `e56abfd7a7f8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A three-line accessor looking `path` up in the Blame struct's internal per-file map and returning Option<&FileBlame> — essentially self.files.get(path), possibly normalising separators first.
- found: Exactly self.files.get(path), no normalisation.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read` — nearly
- read at `dbcd61888ff4` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Maps over paths in parallel with rayon; for each (path, stamp) takes the cached FileBlame if still current, else calls blame_file, dropping None silently without recording a failure; collects successes into a Blame keyed by path.
- found: Exactly that, plus it captures a `now` unix timestamp into the returned Blame (for age math) and validates the cache against both the content hash and `history.last_commit_of(path)`, storing successes with `put_blame`.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `blame_file` — as expected
- read at `9fba962b21ee` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Shells out to `git blame --line-porcelain -- <path>` with -C repo, returns None if the command fails to run or exits non-zero, otherwise passes stdout to parse_porcelain to build a FileBlame of per-line author/time.
- found: Exactly that, including the lossy UTF-8 conversion of stdout and the `.ok()?` / `!status.success()` two-step for the two failure modes.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The only docs handed over were the module header about why blame is per-line; the function itself carries no comment, so `documented` is none rather than a judgement on the module prose.

### `parse_porcelain` — nearly
- read at `a65e82731dcd` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A line-by-line state machine: header lines record the current sha and final line number; author and author-time key lines update per-sha state; a tab-prefixed source line closes the record and writes sha/author/time into a vector indexed by the FINAL line number, resized rather than pushed sequentially. Returns the assembled FileBlame.
- found: Structurally that, with two compressions I did not predict: author names are interned into a Vec<String> with a HashMap giving each a u16 id, and the sha is packed into a u64 by parsing its first 16 hex digits, so a Line is three small integers. Header lines are validated (three fields, 16+ chars, first byte hex, parseable final number) and skipped otherwise. author/time are carried forward in plain mutable variables rather than remembered per sha, which is only safe because --line-porcelain repeats the full header on every line.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `parses_a_commit_author_and_time_per_line` — surprising — STALE
- read at `56b2b6d18c2a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test feeding parse_porcelain a small literal chunk of git blame --line-porcelain output and asserting the resulting FileBlame associates the expected author and commit timestamp with the right line numbers, probably across two commits.
- found: It parses a SAMPLE constant defined elsewhere in the module, then goes further than parsing: it asserts authors are INTERNED (2 authors for 3 lines) and then exercises `range` twice against a fixed clock of 2,000,000 — distinct commit counts, last_author being the most recent toucher rather than the first, last_touched_days of 0, and age_days ~11.57 from the oldest line. So the name says "parses" but most of the assertions are about the range aggregation.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: Named for parsing but five of its seven assertions test `range` aggregation, so the file's coverage of range is better than its test names suggest and a parse regression could hide behind a range failure.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `places_lines_by_their_final_number` — as expected — STALE
- read at `4d55066975f1` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test feeding parse_porcelain a synthetic blame block whose hunks arrive out of order (original-line order differing from final-line order) and asserting each author lands at its FINAL line number, via range(), catching lines filed under a neighbouring function.
- found: Exactly that: two porcelain hunks, the first with orig 9 / final 3 (Ada) and the second orig 1 / final 1 (Grace). Asserts lines.len() == 3 — so the vector is grown to the highest final line, leaving line 2 unfilled — and that range(1,1,..) is Grace while range(3,3,..) is Ada.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: The third argument to range() (900) is an unexplained magic number in the assertions — presumably a "now" timestamp — and the gap at line 2 is asserted only implicitly through the length.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_range_past_the_end_is_clamped` — nearly — STALE
- read at `83aa9cdafb95` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A unit test building a small FileBlame (via parsed porcelain sample) and calling range() with an end line past the file's length, asserting it returns the entries that do exist rather than panicking or returning empty.
- found: Parses SAMPLE with parse_porcelain, then asserts range(2, 999, 2_000_000) is_some (overlapping range clamps) and range(50, 60, ...) is_none because a range entirely past the end yields nothing. Also passes a third argument (a timestamp/now value) I did not anticipate.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc says "returns what is there", which does not hint at the second half: a range entirely past the end returns None rather than an empty/clamped result.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/cache.rs

### `key` — nearly — STALE
- read at `34dcfb2c0cdc` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns a (String, u64) cache key: a line-free identity string like "path#name", plus an FNV hash over the body combined with the doc text, with a missing doc treated as absent/empty.
- found: Hashes the body with fnv, and if a doc exists XORs in the doc's fnv rotated left by 1, returning (format!("{path}#{name}"), h). Combination is XOR-with-rotate rather than concatenation.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The docs explain WHY the doc is in the key (writing documentation must invalidate the entry) — reasoning not recoverable from the three lines of code.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fnv` — as expected — STALE
- read at `8af94d41bcae` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A tiny FNV-1a-shaped hash: start from the 64-bit offset basis, then per byte XOR into the accumulator and wrapping-multiply by a constant that per the doc is deliberately not the true FNV-1a prime, kept as-is so existing cache files still hash the same, with the name honest about it.
- found: Exactly that: h starts at 0xcbf29ce484222325 (the correct offset basis), each byte is XORed in and h wrapping-multiplied by 0x100000001b3 — which is one hex digit short of FNV-1a's 0x00000100000001b3, so the multiplier is truncated rather than arbitrary.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: The doc is the only thing marking the multiplier as wrong on purpose; the body alone reads as a plain typo, which is exactly why the doc earns its place.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ephemeral` — as expected — STALE
- read at `6f8cdf40de2d` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A constructor returning a Cache with an empty in-memory map and no file path — path: None (or similar) so flush is a no-op and path_for is never consulted; a plain struct literal with defaults.
- found: Exactly that: a struct literal with path: None, an empty model string, a default Stored behind a Mutex, and a dirty counter of 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `open` — nearly
- read at `1b7e5b67fa1b` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Computes the on-disk path for repo+model, reads and deserializes stored entries; on missing file, parse failure, or a different model, returns an empty cache for that model rather than erroring. Returns a Cache unconditionally.
- found: Exactly that: path_for, read_to_string().ok(), serde_json::from_str::<Stored>().ok(), filter on version == FORMAT_VERSION && model matches, unwrap_or_else to an empty Stored, then builds Cache with path, model, Mutex<Stored>, dirty counter. Also checks a format version I did not name.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `path_for` — nearly
- read at `5ec0ad90cc0f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Builds the on-disk cache path for a (repo, model) pair: app data dir + a scores/ subdirectory, filename from a hash of the repo's absolute path combined with a sanitised model name, e.g. scores/&lt;fnv-of-repo&gt;-&lt;model&gt;.json; None when the data dir can't be resolved.
- found: That, with the model HASHED rather than sanitised (fnv of both halves, formatted as two 16-hex-digit fields joined by a dash, .json), and it also creates the directory as a side effect, returning None if create_dir_all fails as well as if data_dir() does.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: A function named path_for creates a directory on disk, so a caller merely asking where a cache would live leaves a scores/ folder behind.

### `get` — nearly — STALE
- read at `7560cbc74312` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Locks the in-memory map (a Mutex over a HashMap keyed by (String, u64)) and returns a cloned Reading for the key, or None on a miss; ephemeral caches behave identically since they are just the memory map with no disk backing.
- found: Locks the inner Mutex, using ok()? so a poisoned lock degrades to a cache miss rather than panicking. The map is keyed on the STRING half only; the u64 body hash is applied afterwards as a .filter on the entry's body_hash, so a changed body is a miss but the entry stays. Rebuilds a Reading from the stored surprise and cloned hotspots rather than returning a stored Reading directly.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The key is a tuple but only its first half indexes the map — the hash is a post-lookup filter, which is what makes "same name, new body" a clean miss rather than a stale hit.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `put` — nearly — TRAP
- read at `fa6e28333dd1` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Inserts a reading under its content-addressed key into the in-memory map behind a mutex, marks the cache dirty, and for a non-ephemeral cache with a path appends or schedules a write for flush; an early return when there is no path so an ephemeral cache never touches disk.
- found: The key pair is split: key.0 is the map key and key.1 (the body hash) is stored inside the Entry alongside surprise and hotspots. Dirtiness is not a flag but a COUNTER — every put increments it and every FLUSH_EVERY puts resets it and calls flush, so persistence is amortised rather than deferred to a caller. There is no path check here; ephemerality must be handled inside flush. Both locks are handled with `if let Ok` / match, so a poisoned mutex is absorbed silently.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: The two locks are taken independently and both failures are swallowed, so a poisoned entries lock silently drops the insert while the dirty counter still advances and can trigger a flush of a map that never got the write.

### `flush` — as expected
- read at `78f8ab11bd80` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Serialises the in-memory score map to JSON and writes it atomically — a temp file beside the real path, then rename over it — returning early and doing nothing for an ephemeral cache with no path. Since it returns (), I expected I/O errors to be swallowed or logged rather than propagated, on the grounds a lost cache is recomputable.
- found: Exactly that: let-else on self.path returns for an ephemeral cache, the mutex is locked (a poisoned lock silently returns), serde_json::to_string of the inner map, write to path.with_extension('json.tmp'), and rename only if the write succeeded. Every failure path is a silent return or a discarded Result.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: A failed write leaves the .json.tmp behind — harmless, since the next flush overwrites it, but nothing cleans it up.

### `model` — as expected — STALE
- read at `296534f11708` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A trivial accessor returning &self.model, the model id the cache is scoped to.
- found: Exactly that: `&self.model`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `len` — as expected — STALE
- read at `6cfe686c964a` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A one-line accessor returning the number of entries in the cache's in-memory map — self.entries.len() or similar, counterpart to the neighbouring is_empty, possibly behind a lock.
- found: `self.inner.lock().map(|i| i.entries.len()).unwrap_or(0)` — a mutex-guarded entry count that reports 0 on a poisoned lock.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: A poisoned lock reports an empty cache rather than an error, which is silent but harmless here since the cache holds nothing precious.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_empty` — as expected — STALE
- read at `e5808564fa07` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: The clippy-mandated companion to Cache::len just above it: one line returning whether the cache holds no entries, almost certainly self.len() == 0 or self.entries.is_empty() on the in-memory map, ignoring disk.
- found: One line: self.len() == 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `two_models_never_share_a_cache_file` — as expected
- read at `f9a389de342f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test that derives cache paths for one repo under two different model identifiers and asserts the paths differ, so one model's scores can never be read back as another's.
- found: Exactly that: Cache::path_for(repo, "heuristic (no model)") vs "ollama · llama3.2:3b", asserts both are Some and assert_ne. A comment names the regression — the proxy pass ran before every model pass and, sharing a file, wiped the model's scores.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The docs handed to me are the module's, about the cache as a whole, and say nothing about this test — graded none per the contract; the test's own inline comment is the real documentation and it is good.

### `a_hit_needs_the_same_body_not_just_the_same_name` — as expected
- read at `297e63f04370` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A test that the cache key is content-addressed: same path and name with a changed body must miss, while the identical body hits.
- found: Exactly that — ephemeral cache, put a Reading under key("src/a.rs","run","let x = 1;",None), assert the hit returns 0.8, then assert the same name with an edited body misses.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `moving_a_function_within_a_file_does_not_invalidate_it` — nearly — STALE
- read at `516f0356e06c` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A short test asserting the cache key ignores position: store a score for a function, then look it up with the same path/name/body but a different line number and expect a hit — the complement of renaming_or_moving_a_function_misses.
- found: It calls key("src/a.rs", "run", "body", None) TWICE with byte-identical arguments and asserts they are equal. There is no line number anywhere — `key` takes none — so nothing is moved and nothing about invalidation is exercised; the assertion is only that `key` is deterministic, which is true of any hash. The inline comment states the intended property that the body does not test.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: This test cannot fail for the reason it is named: both keys are built from identical literals, so a `key` that DID incorporate line numbers would still pass it green.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `renaming_or_moving_a_function_misses` — as expected — STALE
- read at `30997eea13f6` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A test on the cache key: put an entry, then look it up with the name changed and with the path changed, asserting both miss — 'moving' meaning to another file, since a sibling test covers moving within one.
- found: Exactly that, four lines: an ephemeral cache, put on key("src/a.rs","run","body",None), then two assertions that get() is none for name "walk" at the same path and for name "run" at "src/b.rs".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_ephemeral_cache_never_touches_disk` — nearly — STALE
- read at `0c540f5a8a8c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A six-line test constructing Cache::ephemeral, putting an entry and reading it back to prove the in-memory side works, then calling flush() and asserting no file was created — checking path_for or the cache directory is absent, or that flush is a no-op that writes nothing.
- found: Cache::ephemeral(), one put of Reading::plain(1.0) under key("a","b","c",None), a flush(), and a single assert that c.len() == 1. It never reads the entry back by key and — despite the name — never asserts anything about the filesystem at all; the only claim it makes is that flushing an ephemeral cache does not empty it in memory.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The test is named "never touches disk" but makes no filesystem assertion whatsoever — it would pass unchanged if flush() wrote a file, so the property in the name is not the property exercised.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_cache_written_by_another_model_is_dropped_not_merged` — surprising — TRAP — STALE
- read at `c2053b43e1c3` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A temp-dir test: write/flush a cache tagged with model A holding an entry, then open a Cache at the same path under model B and assert it comes up empty (len 0 / get misses) rather than inheriting A's entries — the old model's scores discarded, never merged.
- found: It builds a `Stored` with model "old-model" and one entry, serialises it to a temp file, reads it straight back, and asserts `loaded.model != "new-model"` — a comparison between two literals in the test itself. `Cache::open` is never called, no cache is ever opened under a second model, and nothing about dropping or merging entries is exercised. The assertion cannot fail regardless of what open does.
- predicted: some · documented: none · derivable: yes · legible: full · trap: yes
- note: The test is named for the model-mismatch filter but never calls Cache::open — it asserts two string literals differ, so it will stay green if that filter is deleted.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/churn.rs

### `churn_of` — as expected — STALE
- read at `486c62b6f280` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Look up the path's recent commit count and divide by CHURN_SATURATION, clamped to 1.0; a path with no entry returns 0.
- found: Exactly that: let-else returning 0.0 for an unknown path, otherwise recent_commits as f32 / CHURN_SATURATION clamped to 0..1.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `commits_of` — as expected — STALE
- read at `0441a99964cb` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A lookup in the per-path map built from the git log, returning the raw commit count in the window for that path, 0 when the path is absent.
- found: self.files.get(path).map(|h| h.recent_commits).unwrap_or(0) — exactly that.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: The doc block handed over starts with a paragraph about returning None when a file has no history, which belongs to the neighbouring age_of and cannot describe a fn returning u32; only its second half ("raw commits in the window") is about this function.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `last_touched_of` — nearly — STALE
- read at `73cc1733597a` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Looks up the path in the per-file history map, takes the newest commit timestamp for it, and returns the difference from now converted to days as f32; None when the file has no history.
- found: A pure accessor: `self.files.get(path).map(|h| h.last_touched_days)`. The days figure is precomputed at parse time and stored on the per-file record, so nothing is calculated here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `last_author_of` — nearly — STALE
- read at `1cb69a5869c3` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A tiny accessor on History: look the path up in a per-path map filled during parse_log/credit and return a clone of the author of its most recent commit, or None if the path was never seen.
- found: Exactly that: files.get(path).map(clone of last_author), with one extra step I did not predict — an empty author string is filtered back to None, so a record that exists but carries no author reads as unknown rather than as an empty name.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `age_of` — nearly — STALE
- read at `214a1a9bae02` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Looks up the path's oldest-commit timestamp in the History map and returns its age, probably normalised to 0..1 against some window, with None when the path has no history.
- found: A plain map lookup: self.files.get(path).map(|h| h.age_days) — the precomputed age in DAYS, not a normalised score; None if the file is absent.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The bare f32 return carries no unit in the signature — the field name age_days is the only thing saying these are days rather than a normalised score.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `last_commit_of` — as expected — STALE
- read at `1ea3698825e9` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: The twin of last_author_of: look the path up in self.files, return a borrowed str of the stored newest-commit oid, filtering an empty string back to None so a record with no oid reads as absent rather than as an empty id.
- found: Exactly that, line for line — files.get(path), map to last_commit.as_str(), filter out the empty string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Warm: this is the same file as my second reading and structurally the same accessor, so the full grade is partly recall of last_author_of rather than prediction. The doc earns its keep by saying what None does NOT mean, which the body cannot.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_empty` — as expected — STALE
- read at `a5d8b66ddc2f` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Reports that the git history yielded nothing, by checking the internal per-path map (self.files.is_empty() or an equivalent zero count), so callers can show the no-history warning.
- found: self.files.is_empty().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read` — as expected
- read at `8aeeb414bca3` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: One `git log` pass in repo with a format carrying timestamp and author and a name-only file list, capped at a MAX_COMMITS limit, handed to parse_log to build a History keyed by file and rolled up to directories; every failure mode — not a repo, git missing, non-zero status — returns an empty History rather than an error.
- found: Exactly that. The format uses control bytes rather than newlines as delimiters (\x01 opens a commit, \x02 separates timestamp, author and oid) so a filename can never be confused for a header, it passes --no-merges, and both failure paths return History::default(). `now_secs()` is passed into parse_log rather than read inside it, which keeps the age arithmetic deterministic for the tests.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `now_secs` — as expected — STALE
- read at `785486d94a76` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns current wall-clock time as Unix epoch seconds via SystemTime::now().duration_since(UNIX_EPOCH), falling back to 0 on error rather than panicking, cast to i64 for subtraction against git commit timestamps.
- found: Exactly that: SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `credit` — nearly — TRAP
- read at `1a421829daf9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Upserts a `FileHistory` for `key`, bumps a commit count, widens oldest age via max, records the last touch/author/oid when this commit is more recent (min age_days), and increments churn only when age_days falls inside a recency window (~90 days).
- found: Entry-or-default, then: on FIRST sighting (detected by `recent_commits == 0 && age_days == 0.0`) it stamps last_touched/author/commit, because git log walks newest-first; increments `recent_commits` only when within CHURN_WINDOW_DAYS; and unconditionally overwrites `age_days` each call so the last (oldest) value wins. No total commit counter, and no min/max — both extremes come from traversal order rather than comparison.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: Both age and last-touch are correct only if the caller feeds commits newest-first, and the "first sighting" test is a value sentinel (`recent_commits == 0 && age_days == 0.0`) rather than an explicit flag — a reordered or replayed caller gets silently wrong ages and authors with no error.

### `flush_commit` — nearly
- read at `cd3690e69372` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Applies one buffered commit: updates each touched file's FileHistory (counts, churn within the recency window, newest author/oid, first-seen age), then builds the distinct set of ancestor directories and credits each exactly once with the same commit, then clears the buffer.
- found: Right shape, thinner body than predicted: it guards ts==0/empty, converts the commit time to `age_days` once, collects ancestor directory prefixes into a HashSet by scanning for '/', then delegates ALL the per-entry accounting to `credit(files, path, age_days, author, oid)` for files and once per distinct dir, then clears. All the churn/age/author logic I predicted lives in `credit`, not here.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: The manual cut/find loop building ancestor prefixes is the one part that needs a second read; a comment or a split() would carry it.

### `parse_log` — nearly — STALE
- read at `a1d0f03e305c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Walks git log --name-only style output line by line, distinguishing commit header lines (sha/timestamp/author, likely behind a sentinel prefix) from path lines, accumulating each commit's touched paths, calling flush_commit at each boundary and once at the end so the last commit is not dropped, with credit pushing churn up through ancestor directories and `now` weighting recency. Returns the assembled History.
- found: That shape exactly. Header lines are marked with a \x01 prefix and fields separated by \x02; the timestamp is split from the left and the author/oid split from the RIGHT, deliberately, so an author name containing \x02 cannot eat the oid. Non-header non-empty lines are pushed onto `touched`, skipped while commit_ts == 0 (i.e. before any header). flush_commit is called on each new header and once after the loop. Returns History { files }. The ancestor crediting and recency weighting I attributed to this function actually live inside flush_commit/credit, not here.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc explains why the function was split out and recounts a doc-drift incident, but says nothing about the \x01/\x02 wire format the body's correctness turns on.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_commit_touching_three_files_counts_once_for_their_directory` — as expected — STALE
- read at `d79af032ecd6` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test building a synthetic git log with one commit touching three files in one directory, parsing it, then asserting the directory records 1 commit rather than 3 while each file records 1.
- found: Exactly that: builds a <ts>Ada log line with src/a.rs, src/b.rs, src/c.rs, calls parse_log, asserts commits_of("src/a.rs") == 1 and commits_of("src") == 1 with the message "one commit, not three".
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `directory_commits_accumulate_and_reach_every_ancestor` — as expected — STALE
- read at `0dd8e8b3f37f` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Feeds a synthetic git log of two or three separate commits touching files under a nested path, then asserts commits_of for the deep directory equals the distinct commit count and that the same count reaches every ancestor up to the root.
- found: Builds a two-commit log (2 and 3 days old, control-character delimited, author Ada) touching `a/b/one.rs` and `a/b/two.rs`, parses it with `parse_log`, and asserts the file itself has 1 commit while both `a/b` and `a` have 2. It also asserts `last_touched_of("a/b")` rounds to 2 days, checking the newest-first recency the docs never mention.</found> <parameter name="predicted">most
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The test's name promises only accumulation across ancestors but its last assertion checks last-touched recency, which the doc sentence does not cover.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `oldest_commit_sets_age_and_recent_ones_set_churn` — nearly — STALE
- read at `b57db60a534f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test feeding a synthetic git log through parse_log with one very old commit and several recent ones on the same file, asserting age_of comes from the oldest commit while churn_of/commits_of only counts commits inside the recent 90-day window — the old commit gives age but not churn.
- found: Exactly that, with an extra assertion I did not predict: `last_author_of` must be the NEWEST commit's author ("who would I ask about this"), not the oldest. Builds a newest-first log with \u{1}/\u{2} delimiters at now-1d, now-10d, now-400d, checks age_of a.rs = 400, b.rs = 10, missing = None, authors Ada/Grace, and churn_of(a) > churn_of(b) since two of a's three commits are in the window.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The name promises age and churn but the body also pins last_author_of, a third property nothing in the name suggests.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `one_pathological_file_does_not_squash_the_rest` — as expected
- read at `577dcf3c2de9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Builds a synthetic history where one file has an enormous commit count (a generated/lockfile-style outlier) and others have modest counts, then asserts the normal files still get meaningfully non-zero, differentiated churn — churn being saturating/absolute rather than normalized by the max, so the outlier can't flatten everyone to ~0.
- found: Exactly that, concretely: 500 synthetic log entries for Cargo.lock and 10 for src/hot.rs, both spread over an 80-day modulo window, fed to parse_log. Asserts Cargo.lock saturates at exactly 1.0 and src/hot.rs stays above 0.5.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The `i % 80` on 500 iterations means each of 80 days gets ~6 duplicate commits, so the test only exercises saturation, not a genuine 500-distinct-day spread.

### `churn_saturates_rather_than_running_away` — nearly — STALE
- read at `7015eaa5c9f5` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A six-line unit test asserting churn normalisation is bounded: build a History for a file with an absurd commit count (hundreds), assert the result is at most 1.0 and near it, and probably that a moderately-churned file still scores strictly below, so the curve saturates rather than growing without limit.
- found: It builds a synthetic git log for src/a.rs dated one day before `now`, parses it, and asserts churn_of is within 0.0..=1.0. But the log is built with `.repeat(1)` — a SINGLE commit — so the test named for saturation under runaway churn never applies any churn pressure at all, and the range assertion it makes would pass for almost any implementation.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: `.repeat(1)` with a bounds-only assertion means this test exercises none of the saturation property its name promises — the repeat count looks like it was reduced during debugging and never restored.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_directory_that_is_not_a_repo_scores_without_history` — nearly — STALE
- read at `0d897bf18153` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Calls read on a directory with no .git and asserts an empty History — is_empty() true, no panic — so a repo without git degrades to no history rather than erroring or inventing ages.
- found: That, with two extra assertions on the accessors: churn_of any path is 0.0 and age_of is None. The path is a nonexistent literal (/definitely/not/a/repo) rather than a tempdir.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The name says "a directory that is not a repo" but the path does not exist at all, so the not-a-repo-but-real-directory case is never covered here.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/cli.rs

### `spawn_lock_path` — as expected — STALE
- read at `b3cc3af0ccde` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A three-line helper returning the per-machine data dir (where the endpoint file lives) joined with a fixed lock filename such as spawn.lock, Option because the data dir may not resolve.
- found: Exactly that: Some(crate::reports::data_dir()?.join("backend.lock")).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `drop` — as expected — STALE
- read at `931a7730e24b` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Drop impl for the O_EXCL spawn lock: removes the lock file at the path the guard holds, ignoring the error, releasing the claim when the guard falls out of scope.
- found: let _ = std::fs::remove_file(&self.0); — a newtype guard over the path, error deliberately discarded.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `take_spawn_lock` — as expected — STALE
- read at `23aed019ff2c` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A three-line wrapper delegating to the testable take_spawn_lock_after, passing the current time or the SPAWN_LOCK_STALE age threshold; that helper does the O_EXCL create, the staleness check and the steal.
- found: Exactly that: `take_spawn_lock_after(SPAWN_LOCK_STALE)`.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: A long and excellent doc comment about O_EXCL sits on the one-line wrapper rather than on take_spawn_lock_after, which is where the mechanism it describes actually lives.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `take_spawn_lock_after` — nearly — TRAP
- read at `c7240b27f43e` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Atomic O_EXCL create of the spawn-lock path; Some(SpawnLock) on success. On AlreadyExists, stat the file's mtime and if older than `stale` treat it as abandoned — remove and retry the exclusive create once — otherwise None so the loser waits for the winner's backend.
- found: Exactly that, via a `claim` closure using create_new(true); the one detail I missed is that the winner writes its own pid into the lock file. Metadata/mtime failures fall through to `unwrap_or(false)`, i.e. not abandoned, which fails closed.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The steal path is remove-then-create, which is not atomic: two processes that both judge the lock abandoned can each delete the other's fresh claim and both return Some, so the O_EXCL exclusivity the rest of the design leans on does not hold once a lock ages out.

### `await_backend` — as expected
- read at `c9f63b2b9a62` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Polls in a sleep loop until the deadline, each pass reading the endpoint file and probing it for life, returning Some(endpoint) the moment one answers and None when the deadline expires — the loser's half of the O_EXCL spawn lock, waiting for the winner rather than starting a second backend.
- found: Precisely that, in eleven lines: `live()` on each pass, deadline check after the probe (so one attempt always happens even with an already-expired deadline), 250ms sleep between tries.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `probe` — as expected
- read at `17274227c383` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes an endpoint, issues a /health GET against its URL, and returns Some(pid) parsed from the JSON reply body — the pid the responding process reports — or None if nothing answers or the reply doesn't parse. Should not consult a pid recorded in the file.
- found: Exactly that: builds a blocking reqwest client with PROBE_TIMEOUT, GETs {ep.url()}/health, parses JSON, pulls "pid" as u64 and narrows to u32, with every step short-circuiting to None via ok()?.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `live` — nearly — STALE
- read at `4b45601a359e` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Reads the endpoint file (port + pid) and returns it only if a probe confirms something is actually answering there — read_endpoint().filter(probe) in effect, None when the file is missing or the process is gone.
- found: Reads the endpoint, probes it, and on success returns the endpoint with the pid REPLACED by the one the probe reported — so the live pid comes from the running server rather than from the file, which the file could describe staler than reality.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: I predicted a filter; the pid is actually taken from the probe's answer rather than the file, which matters for the release_endpoint "only if it still names its own pid" rule and is not mentioned in the one-line doc.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `get` — as expected — STALE
- read at `2b0b7ae5eff3` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A tiny HTTP GET helper: builds the URL from the endpoint plus path, issues a blocking request, parses the body as JSON Value, and maps any transport or parse error to a String.
- found: Exactly that, in one expression: reqwest::blocking::get on format!("{}{path}", ep.url()), .and_then(|r| r.json()), .map_err(|e| e.to_string()).
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `post` — as expected — STALE
- read at `1e863d9e851f` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Builds a URL from the Endpoint plus path, POSTs the JSON body, returns the parsed JSON response, mapping transport/parse errors to String.
- found: Exactly that: reqwest::blocking::Client::new().post(format!("{}{path}", ep.url())).json(&body).send().and_then(|r| r.json()).map_err(|e| e.to_string()).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ensure_backend` — nearly
- read at `b3ae49564834` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Probe for an already-running backend and return its endpoint if live; if SANITY_BACKEND is set, don't spawn anything; otherwise take the spawn lock — winner spawns `sanity serve` on the current exe with null stdio, losers wait for the winner's backend — then wait for the endpoint to publish and return it, or a String error on timeout.
- found: Exactly that, plus two details I did not cover: with SANITY_BACKEND set and nothing answering it returns an Err rather than succeeding or spawning, and after acquiring the lock it re-probes `live()` because the previous holder may have finished in the gap. The lock is held across spawn AND wait (deliberately, per an inline comment), deadline is START_WAIT (15s).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `commas` — nearly — STALE
- read at `72386fc770b8` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Formats a u64 with thousands separators, probably by stringifying, reversing, chunking into threes, joining with commas and reversing back. No locale handling, no dependency.
- found: Same result by a cleaner route: forward single pass over the digits, pushing a comma before any position where the number of REMAINING digits is a multiple of three (and i > 0). Pre-sizes the String. No reversal.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `num` — as expected — STALE
- read at `81513b07ee5e` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An undocumented JSON helper beside `text`: look up `key` in a serde_json Value and return it as u64, defaulting to 0 when missing or not a number — v.get(key).and_then(|x| x.as_u64()).unwrap_or(0).
- found: Exactly that, character for character.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `text` — as expected — STALE
- read at `412a9908f0c4` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A tiny JSON helper: pulls `key` from a serde_json Value as a &str, returning "" when missing or not a string, used by the status/summary formatters.
- found: v.get(key).and_then(|x| x.as_str()).unwrap_or("") — exactly that.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `resolve` — as expected — STALE
- read at `676655d0eefa` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Canonicalises the path with std::fs::canonicalize and maps the io error into a String that names the path, so the CLI's key agrees with project_key.
- found: One line: std::fs::canonicalize(path).map_err(|e| format!("{path}: {e}")).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `serve` — nearly — STALE
- read at `bd9fe39a217d` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Probes for an already-answering backend; if one answers, prints its port and returns 0 without starting anything. Otherwise takes the O_EXCL spawn lock, binds a loopback listener on an ephemeral port, writes an endpoint file with port and pid, serves agentapi in a loop with an idle timeout, stands down if the endpoint file stops naming its pid, and releases the endpoint on exit.
- found: Exactly that minus the spawn lock (that belongs to ensure_backend/take_spawn_lock) and plus a background `agentapi::restore` so previously-open repos come back while the server already answers. Builds a tokio runtime, keeps it alive past `agentapi::serve` (which returns once the listener is spawned), then polls every WATCH_EVERY: stands down if the endpoint file names another pid (app took over) or is gone, and stands down after IDLE_FOR of no agent calls, releasing the endpoint only on that path. The idle check is deliberately unconditional — a lock failure must not read as "not idle".
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc comment covers only the idempotence contract; the idle-timeout and supersede-by-pid lifecycle, which is most of the body, is documented only in inline comments.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `study` — nearly — STALE
- read at `77d4e72e6882` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 2 of its run
- expected: Canonicalises the path, calls ensure_backend to start or heal a backend, POSTs /open with the repo path and the show/focus flag, then prints a human sentence naming the repo with its assessed/remaining counts and the prompt to hand an agent — deliberately not spawning one. Returns 0, or non-zero with an actionable message if the backend is unreachable or the open failed.
- found: That, plus a second call: the counts come from GET /status?project=key rather than the /open response, because /open's assessed counts stale readings as done and the CLI must agree with the sidebar. Prints name, path, function count with excluded always beside it when non-zero, read/to-go with a stale sub-count, the backend port, and whether Sanity is "pointed here" (from `showing`) — worded as a claim about Sanity, not about a window that may not exist. Ends with either "every function has an up-to-date reading" or the literal sentence "study this project in sanity".
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Second function I read in cli.rs, so this reading is warm.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read_verb` — as expected
- read at `bef6c1b9de43` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Resolves the repo path to a project key, probes for an already-running backend without starting one, and if nothing answers prints a message naming the command that would start it (`sanity study <path>`) and returns Err(exit code). Otherwise GETs the endpoint with the project key and returns the parsed JSON; if the backend is up but that repo is not open, prints the same hint and errors rather than opening it.
- found: Exactly that, in that order: resolve -> live() -> agentapi::project_key -> get with ?project= urlencoded -> check the response's `open` boolean -> Ok(v). Every failure path prints to stderr and returns Err(1), so the exit code carries no distinction between "bad path", "nothing running", "transport error" and "not open" — the text does. Notably the openness test is a field on the response, not a status code, and a response missing `open` is treated as not open (fail closed).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `status` — nearly — STALE
- read at `c99d3cbbc44d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Resolves the repo, ensures a backend, GETs /status and prints a human summary — project, functions/excluded, assessed, remaining, in-flight, stale — returning 0 or a non-zero code if the backend is unreachable. No arithmetic of its own.
- found: Exactly that, with the backend/resolve work delegated to read_verb(path, "/status") which returns the JSON or an exit code. Prints project — repo, function count with an optional ".sanityignore excluded" clause, a read/to-go/out-with-readers line, an optional stale line, the assessment file path, and the endpoint's own next_step string. Returns 0. Every number comes straight from the response via num()/text().
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `summary` — nearly — STALE
- read at `24183bbe3b06` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A CLI read verb that is a pure formatter over /summary: resolve the path to a project, GET the endpoint, return a non-zero code on failure; on success print repo-wide aggregates — assessed/remaining, grade distributions via `grades`, derivable count, split by model, maybe the by-position curve and the response note — then return 0, computing nothing itself.
- found: Right in shape and mechanism — read_verb(path, "/summary") does the resolve/fetch and its Err is returned as the exit code, and every printed value comes straight out of the JSON via text/num/commas/grades. The output is narrower than I guessed: repo name, function count with the .sanityignore exclusion count when non-zero, a read/to-go/stale line, and PREDICTED plus DOCUMENTED distributions only when total.readings > 0. No derivable count, no per-model split, no by-position curve, no note.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The /summary tool description promises derivable count, a split by model, a by-position comparison and a `note`; the CLI formatter over the same endpoint prints none of them, so the two front doors to one answer show different amounts of it.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `grades` — as expected
- read at `9e3e6bc661c1` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Takes an optional JSON value holding a grade histogram and renders one line in scale order — 'full N most N some N none N', labelled rather than bare — reading each key with a 0 default and returning an em-dash or empty string when absent.
- found: Exactly that: early return of "—" for None, then map over the literal scale-ordered array, each key formatted as `{k} {count}` with a 0 default, joined by three spaces. The one thing I did not name is that counts go through `commas` for thousands separators.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `main` — nearly
- read at `78657478fae5` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A flat match on args[0] dispatching the subcommand names — serve, study, mcp, status, summary, grades — passing the remaining args (a repo path defaulting to ".", flags like --show) to the corresponding function and returning its exit code; unknown or missing verbs print usage to stderr and return non-zero.
- found: That shape exactly: path is the first non-flag argument or ".", study takes rest.contains("--show"), serve/status/summary take what they need, help/--help/-h prints USAGE and returns 0, anything else prints the unknown-command line plus USAGE and returns 2. Two things off my prediction: `mcp` is not dispatched here (it must be intercepted before this), and `grades` — a sibling in the same file — has no arm either, so it is reachable only from inside summary, not as a verb.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: args[0] and args[1..] are indexed unguarded in a pub fn, so an empty slice panics rather than printing usage; nothing in the signature or doc says the caller must ensure a verb is present.

### `only_one_caller_may_start_a_backend_at_a_time` — as expected — STALE
- read at `d756a16e44fe` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test of take_spawn_lock's O_EXCL exclusion: in a temp home take the lock once and assert success, take it again as a second caller and assert it fails while the first holds it, proving two cold starts cannot both spawn a backend; probably release and re-take to show it isn't permanently sticky.
- found: Exactly that, in three assertions: a scoped temp data_home, first take succeeds, second returns None, then drop(first) and a third take succeeds — with a comment noting release is on Drop including ensure_backend's error paths.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_abandoned_spawn_lock_is_taken_rather_than_blocking_forever` — nearly — STALE
- read at `f22ea4491fd4` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A 19-line test using take_spawn_lock_after (the age-injectable variant): create a lock in a temp data dir, assert a caller whose threshold treats it as fresh cannot take it (a live attempt is respected), and that with the age past the threshold it is taken and returns Some — the doc's two halves as two cases.
- found: Both halves as predicted (3600s threshold returns None, Duration::ZERO steals it), plus a third part I did not cover: after dropping both the original holder and the thief, take_spawn_lock() must still succeed — guarding against release-by-path leaving the file behind. Note the inline comment claims the original holder's drop must not hand the lock to a third caller, but the test drops both before asserting and so never actually exercises that ordering.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The comment at line 655 promises a property — the first holder's drop must not release the thief's lock — that the assertions below it do not test, since both are dropped before the single check.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/commands.rs

### `scan_repo` — nearly — STALE
- read at `9b4e63425a47` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes a repo path from ScanRequest, walks the tree honouring ignore files, parses with tree-sitter, scores functions with the offline heuristic, aggregates lines up the tree, folds in committed .sanity/ readings, registers the project in shared state, and returns the Scan. Emits progress events and checks a cancel flag for stop_scan.
- found: Validates the path is a directory AND a git root (early, with a dedicated not_a_repo error), clears the CANCEL flag, pushes a placeholder into shared.restoring so the sidebar shows the project before the work starts, then runs scan::scan on spawn_blocking (rayon/CPU-bound must stay off the async runtime) with two closures: an `emit` that both writes restoring_progress and emits "scan-progress", and a `scored` that streams per-function surprise/hotspots as "scan-score". Uses an ephemeral score Cache but a persistent ScanCache (memoises parse + git blame), and Fidelity::Ordering to skip the expensive all-pairs term. Clears the pending row unconditionally, then on success inserts a Project into shared.projects reusing existing reports or loading from .sanity/, stamps file_marks, touches, and calls focus(&key, true) — the one path that takes the view outright.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The docs argue only about why the payload is not streamed, which is one line of a 152-line function; nearly every other decision here is explained by inline comments instead.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `scan_history` — as expected
- read at `a27e53522457` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An async Tauri command that validates the path, defaults the limit, and runs history::read_cached on a blocking thread (spawn_blocking) so the tree-sitter/rayon work stays off the async runtime, emitting progress to the frontend via the AppHandle and mapping any error to a String.
- found: Exactly that: rejects a non-directory with a message, defaults limit to history::MAX_COMMITS, spawn_blocking around read_cached with an `emit` closure firing the "history-progress" event (send failures ignored), and map_err on the JoinError. read_cached itself is infallible, so the only error paths are the directory check and a panicked/cancelled task.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `warm_history` — as expected
- read at `dac8c204bd4d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A Tauri command that spawns the work off the async runtime (spawn_blocking around history::warm) and returns a plain bool rather than a Result: true if a cached timeline existed and was topped up, false if there was none or the work failed. No error surfaces because the frontend fires and forgets.
- found: Exactly that: a directory guard returning false, then tauri::async_runtime::spawn_blocking calling history::warm(&root, MAX_COMMITS), awaited with unwrap_or(false) so a panicked or cancelled task also reads as false.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `read_source` — nearly
- read at `c6b6cbc66ab8` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Joins rel_path onto repo, canonicalises both sides, errors if the resolved path is not under the canonicalised root (defeating .. and symlink escapes), then reads the file to a String, refusing or truncating past a size/line cap so a vendored bundle cannot freeze the code view; errors returned as Err(String).
- found: As predicted, with the cap as a hard refusal rather than a truncation: MAX_BYTES = 2 MiB checked via fs::metadata before reading, returning '{rel_path} is too large to display'. The whole body runs inside tauri::async_runtime::spawn_blocking, with the join error also flattened into Err(String). Distinct error texts for an unreadable root, a missing file, and an escape ('outside the open repo').
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe the containment check and the cap but say nothing about the spawn_blocking offload, which is the only reason this async fn does not block the Tauri runtime.

### `open_code_window` — nearly — TRAP
- read at `b5c68b62facf` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Sanitises repo+rel_path into a Tauri window label, focuses an existing window with that label rather than duplicating, otherwise builds a WebviewWindow loading index.html with ?code= (and repo) in the query, titled from the path, sized, with Tauri errors mapped to String.
- found: Exactly that — label is "code-{rel_path}" with every non-alphanumeric/non-dash mapped to '-', get_webview_window short-circuits to set_focus, and the builder loads index.html?code=&repo= at 900x800. Two extras I did not predict: a hand-rolled percent-encoder for the query values (with a comment on '#' truncating the URL), and a macOS-only branch applying the overlay titlebar and the shared TRAFFIC_LIGHTS inset.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The label is derived from rel_path only, not repo, so the same relative path in two different repos collides and the second call focuses the first repo's window instead of opening the file asked for.

### `agent_reports` — as expected
- read at `3e09ba50bace` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A Tauri command that takes the shared agentapi lock, resolves the project by the supplied key (falling back to the active/last-touched project when None), and returns that project's reports cloned into a Vec, empty when nothing resolves.
- found: Exactly that, in five lines: lock, key.or_else(|| s.active.clone()) with an early empty return, then projects.get(&key) mapping reports.values().cloned().collect() and unwrap_or_default.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Two doc comments have been concatenated onto this one function (a "polled rather than pushed" paragraph and a "readings for one project" paragraph), and the fallback here is `s.active` even though the repo's rule elsewhere is that a keyless caller should follow the last repo OPENED (`touched`), not what the window is looking at.

### `agent_activity` — surprising — STALE
- read at `b38cf204734f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A Tauri invoke command that locks the shared agent state and returns a snapshot of what agents are doing — assessed/remaining counts and the live unexpired leases, for the sidebar.
- found: Not coverage at all: it reports liveness. Locks Shared and returns `active` (true if last_agent touched within a 60s IDLE_AFTER), the last tool name, a `pings` nonce, and a list of recent (seq, tool) calls mapped into AgentCall. It is a "is an agent talking to me right now, and what did it call" indicator, not a progress report.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `projects` — as expected — STALE
- read at `3cc45c850331` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A thin Tauri command that locks the shared agentapi state and returns a ProjectList — the active/showing key plus a per-project summary. Five lines, so it delegates to something on the shared state and computes nothing itself.
- found: A single expression: `ProjectList::from_state(&agentapi::lock(&state))`. Pure delegation, no logic.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `project_scan` — as expected — STALE
- read at `196ad9550bc2` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A Tauri command that locks the shared agent-api state, looks up the project by key, and returns a clone of its stored scan (the proxy-scored tree), or None if that project is not loaded. Essentially a guarded map lookup and clone.
- found: Exactly that, in one line: `agentapi::lock(&state).projects.get(&key).map(|p| p.scan.clone())`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `sync_theme_menu` — nearly — STALE
- read at `dbabffd78808` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Takes the theme string (system/light/dark), finds the matching check-menu-items in the app menu and ticks the right one while unticking the others, so the native menu reflects the webview's localStorage preference. Stores nothing on the Rust side.
- found: A four-line delegation: fetches the `ThemeMenu` from Tauri managed state with `try_state` and calls `themes.select(&theme)`; the actual tick/untick logic lives in ThemeMenu. Silently does nothing if the state is absent.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs I was handed begin with two paragraphs about an itemised disk-usage deletion panel that have nothing to do with this function — a neighbouring doc comment appears to have been absorbed.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `sync_theme_menu` #2 — as expected — STALE
- read at `e3ee3dd70022` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A platform-conditional no-op stub (non-macOS, where there is no app menu): empty body, arguments underscore-prefixed and ignored.
- found: An empty body — `pub fn sync_theme_menu(_app, _theme) {}`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs carry the entire meaning here; the empty body alone says nothing about which platform this is for.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `stop_scan` — as expected — STALE
- read at `9b4031738fc1` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Sets a global cancellation flag (a static AtomicBool) to true so the in-progress scoring pass halts, keeping what it already scored; no arguments, no return.
- found: One line: CANCEL.store(true, Ordering::Relaxed).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Docs describe the product rationale for bounding a scan rather than the one line of code, which is the useful split.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `this_exe` — nearly — STALE
- read at `d5834403c0b0` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Returns the running binary's path as a String via std::env::current_exe(), lossy-converted, falling back to something like "sanity" if it fails; used to write an absolute command path into MCP client config.
- found: Exactly that shape, except the fallback is unwrap_or_default() — an EMPTY string rather than a usable command name, so a failed current_exe() yields "" instead of anything an MCP client could run.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `mcp_command` — nearly — STALE
- read at `25f0e32c2320` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Locate the app binary with this_exe(), stringify the path (erroring if it can't be resolved), and return McpCommand { command: exe, args: vec!["mcp"] } — the invocation an MCP client config needs.
- found: That, plus a third field: it also pretty-prints a ready-to-paste `{"mcpServers": {"sanity": {command, args}}}` JSON snippet with serde_json and returns it as McpCommand.json. The Result exists for the serialization failure, not for path resolution — this_exe() is infallible here.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `client_defs` — nearly — STALE
- read at `3aaff8bec443` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A hard-coded table of the MCP clients the app can wire itself into — Claude Code, Claude Desktop, Cursor, Windsurf, maybe Zed/VS Code — each ClientDef carrying an id, display label, the config path resolved under the user's home, and the JSON key (mcpServers) where the sanity mcp entry is written.
- found: Exactly that, for five clients: Claude Desktop (under config_dir rather than home), Claude Code (~/.claude.json), Cursor, Windsurf, and Codex. The one field I did not predict is `json: bool` — Codex is the odd one out, storing its servers in ~/.codex/config.toml under key `mcp_servers`, so the struct carries a format flag alongside the key.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `mcp_clients` — nearly
- read at `c7c59f8ea31f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Walk the known MCP client definitions from client_defs(), and for each one report whether its config file exists and whether it already registers a "sanity" server pointing at this binary (this_exe), returning a Vec&lt;McpClient&gt; of name/path/installed/connected status for the UI.
- found: That, with three distinctions I did not name: `present` (file exists), `registered` (a "sanity" entry under the def's key) and `current` (its `command` equals this_exe) are three separate flags rather than one; a config that fails to parse as JSON — Codex's TOML — falls back to plain substring matching on "sanity" and on the exe path; and `writable` is carried straight from the def's `json` flag, so non-JSON configs are reported as not editable.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: No doc comment at all on a function whose three near-synonymous output flags (present/registered/current) and TOML substring fallback are exactly what a reader would want explained.

### `edit_client` — surprising
- read at `58fe79566d45` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Look up the client def by id, error if unknown; refuse if the config file is missing or unparseable; otherwise read the JSON, ensure the mcpServers-style key exists, insert a "sanity" entry {command: this_exe(), args:["mcp"]} when connect is true or remove that key when false, write it back pretty-printed, return the path.
- found: All of that, plus three branches I did not predict: a refusal for clients whose config is TOML, an explicit exception that CREATES an empty config for claude-desktop on connect, an empty-file-is-{} case, and an early Ok returning the path when disconnecting a client with no config at all.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc says "Only ever edits a file that already EXISTS" as the line between helpful and destructive, but the body has a claude-desktop branch that creates one (with create_dir_all) — the exception is only in an inline comment.

### `mcp_connect` — as expected — STALE
- read at `58e5ef3ccab3` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A thin Tauri command wrapper that looks up the MCP client by id and delegates to edit_client(id, true) to add this binary's `sanity mcp` server entry to that client's config, returning the config path or an error string.
- found: Exactly one line: edit_client(&id, true).
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The bare boolean `true` at the call site carries the whole meaning of connect-vs-disconnect and is unlabelled.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `mcp_disconnect` — as expected — STALE
- read at `fca84f2b9372` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A Tauri command removing the sanity MCP server entry from the named client's config — the inverse of mcp_connect — delegating to a shared edit_client helper with a remove/false flag and returning the path or an error string.
- found: One line: edit_client(&amp;id, false).
- predicted: full · documented: none · derivable: no · legible: most · trap: no
- note: The bare boolean at the call site (edit_client(&amp;id, false)) reads as a nameless flag; it is only legible because the wrapper's own name supplies the meaning.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/heuristic.rs

### `linmap` — as expected — STALE
- read at `7787beaf4518` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A three-line linear rescale: subtract lo, divide by (hi - lo), clamp into 0..1 — likely literally ((v - lo) / (hi - lo)).clamp(0.0, 1.0).
- found: Exactly that: ((v - lo) / (hi - lo)).clamp(0.0, 1.0). No guard against hi == lo.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `words` — as expected
- read at `8ade55130efd` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Walks the source characters, splitting identifiers on camelCase boundaries and on non-alphanumeric separators (underscore, hyphen, punctuation, whitespace), lowercases each part, and returns parts that are at least three characters long and not structural/stop words via is_structural.
- found: Exactly that, as a single char loop with a `prev_lower` flag for the camel boundary and `std::mem::take` to flush the accumulator; the filter is applied once at the end with `retain(len >= 3 && !is_structural)`. One wrinkle: digits count as "lower" for boundary purposes, so `parse2Json` splits but `HTTPServer` does not (consecutive capitals stay one word).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `is_structural` — as expected — STALE
- read at `63ecb03e38d3` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A stopword test returning true for cross-language keywords and universal plumbing tokens (let, fn, def, var, const, return, self, err, new...), implemented as a literal list checked with contains or matches!, used by `words` to drop noise before vocabulary comparison.
- found: Exactly that: a 60-odd entry `const STRUCTURAL: &[&str]` of keywords plus generic identifier stems (err, res, ret, val, out, tmp, obj, args, opts, param), and `STRUCTURAL.contains(&w)`. Linear scan, no set.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The list carries the English article "the" but omits `if` — a curious pair of choices for a list described as keywords and plumbing.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lex` — as expected
- read at `442c197a7637` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Iterate char_indices accumulating a run of alphanumeric/underscore chars and emit that slice as one token; skip whitespace; emit any other single character as its own token. Returns borrowed &str slices into src and never indexes by byte, so multi-byte punctuation is safe.
- found: Exactly that, using a peekable char_indices so the identifier run can look ahead without consuming, and advancing `end` by len_utf8 on each accepted char so every slice boundary is a codepoint boundary. Whitespace skipped, single non-word chars pushed as one-char slices.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `shingles` — nearly — STALE
- read at `81960912c1ad` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Lex the source into a token stream (keywords retained), slide a 3-token window across it, hash each 3-gram with `fnv` into a u64, and collect into a HashSet for later jaccard/distinctiveness comparison.
- found: Exactly that — `lex`, `windows(3)`, join with a space, `fnv` over the bytes, collect. Plus an explicit early return of an empty set when fewer than 3 tokens (which `windows(3)` would already yield anyway).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fnv` — as expected — STALE
- read at `da564edbd754` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An FNV-1a-shaped byte loop: start from offset basis 0xcbf2_9ce4_8422_2325, XOR each byte into the accumulator and wrapping_mul by the mis-grouped constant 0x1000_0000_01b3, return the u64.
- found: Precisely that, line for line — the docs hand over both constants and the deviation from real FNV-1a, so nothing in the body was left to guess.</found> <parameter name="predicted">full
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs also mention a hash set of u64 rather than String, which belongs to a caller and not to this function — the last paragraph documents something the body does not contain.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `jaccard` — as expected — STALE
- read at `31e2cccaa44b` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Standard Jaccard similarity over two hashed-shingle sets: intersection size over union size, and returning 0.0 (or an UNDECIDED-ish value) when a set is empty so it never divides by zero.
- found: Exactly that: early 0.0 if either set is empty, intersection counted directly, union computed as |a|+|b|-inter, and a second belt-and-braces zero-union guard before the divide.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Empty-versus-empty returns 0.0 (maximally different) rather than the repo's UNDECIDED 0.5, which is the one place this file departs from its own "never claim confidence you haven't got" rule.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `incompressibility` — nearly
- read at `0decd7684f19` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Returns UNDECIDED (0.5) for bodies below some minimum byte length (there is a peer test named short_bodies_decline_to_report_compressibility). Otherwise deflate-compresses the body, takes the ratio of compressed to original size, and maps that ratio through linmap onto 0..1 so a repetitive body scores low and an incompressible one scores high.
- found: That, with one step I did not predict: the body is whitespace-normalised first (split_whitespace joined by single spaces) and the 200-byte floor and the ratio are both taken against the NORMALISED text, so indentation neither pads the length past the floor nor inflates the compressibility. Every failure path — too short, write error, finish error — returns UNDECIDED rather than a number. The linmap band is 0.25..0.70, annotated as measured across sibling projects.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Second reading from heuristic.rs, so not cold — I had seen the file's function list and one other body.

### `branch_density` — as expected
- read at `58768acba707` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Counts decision points in the body (if/else/match/for/while/&&/||/?), divides by line count for decisions-per-line, maps through linmap onto a 0..1 band with saturation, and returns UNDECIDED for bodies too short to judge.
- found: Exactly that: a BRANCH keyword list spanning several languages (if, else, match, case, switch, for, while, loop, try, catch, except, &&, ||, ?), an early UNDECIDED return when line_count < MIN_LINES_FOR_BRANCHING, tokenisation by splitting on non-alphanumerics while keeping &, | and ? as token characters, and linmap(hits/lines, 0.02, 0.25).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `vocabulary_novelty` — nearly
- read at `76fbb10b9de1` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Tokenise signature and body with `words`, put both in sets, return UNDECIDED (0.5) when the body has too few distinct words, otherwise return the fraction of body words that do not appear in the signature's vocabulary.
- found: Exactly that, with one step I did not name: the raw fraction is passed through `linmap(_, 0.35, 0.85)`, so the observed band of real code is stretched onto 0..1 rather than the ratio being reported directly.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `fingerprint` — nearly — STALE
- read at `2d240d0ac69c` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Builds the precomputed representation distinctiveness compares: lex the body, cut it into shingles, hash each with fnv into a set of integers, and wrap that in Fingerprint so pairwise jaccard need not re-lex.
- found: A three-line constructor: Fingerprint { shingles: shingles(body) }. All the work I attributed to it lives in shingles(); this is a one-field wrapper.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: A public struct-literal wrapper around a single call — the name promises a computation the body delegates entirely.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `distinctiveness` — nearly
- read at `986d4efa5824` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Return UNDECIDED (0.5) when there are no peers — and probably when the body is too short to shingle — otherwise take the maximum Jaccard similarity of shingle sets across all peers and return 1 minus it, so a function that closely resembles a sibling scores cold.
- found: Exactly that, with both guards present (peers empty OR fewer than MIN_SHINGLES shingles), and one detail I did not cover: the closest match is not subtracted raw but passed through `linmap(closest, 0.08, 0.55)`, because real near-duplicates rarely exceed ~0.6 Jaccard so the interesting band is rescaled from that low range.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `surprise` — as expected — TRAP — STALE
- read at `f75d4f2ecad0` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Computes the offline proxy terms — incompressibility(body), branch_density(body), vocabulary_novelty(signature, body) — mixes them with the caller-supplied distinctiveness as a fixed weighted sum with named constants, then runs the raw mix through calibrate before returning 0..1, with no length guard because each term self-reports UNDECIDED on short input.
- found: Exactly that: a four-element `terms` array in the order distinctiveness, vocabulary_novelty, incompressibility, branch_density, dot-producted against a module-level WEIGHTS array and passed to calibrate.
- predicted: full · documented: none · derivable: yes · legible: full · trap: yes
- note: `zip` against WEIGHTS silently truncates: adding a fifth term without a fifth weight compiles, runs, and quietly drops the new term from the metric rather than failing.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `calibrate` — as expected — STALE
- read at `d19b3e49a255` · commit `9fe6ccf` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Six lines: normalise `raw` from the observed band (roughly 0.15..0.95) onto 0..1 with a clamp, then apply a fixed exponent above 1 via powf to skew right so most code lands cold and a thin tail stays hot. Band edges and exponent as named constants, result clamped to 0..1.
- found: Exactly that, and nothing else: FLOOR 0.30, CEIL 0.95, SKEW 2.2, `linmap(raw, FLOOR, CEIL).powf(SKEW)`. The constants are local to the function rather than file-level, and the clamp lives inside `linmap`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc says the mix occupies roughly 0.15..0.95 and the code's FLOOR is 0.30 — the prose and the constant disagree about the band's low edge.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `documented` — nearly — STALE
- read at `ca96226a5b96` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Return 0.0 when doc is None/empty; otherwise tokenise doc and body into word sets via the shared words() helper, subtract the signature's vocabulary from both, and return the fraction of remaining body words the doc covers, clamped or scaled, returning 0 when a side empties.
- found: Exactly that shape: None -> 0.0, build from_sig word set, uncovered = body words minus signature words (empty -> 1.0, full credit), doc_words = doc words minus signature words (empty -> 0.0), coverage = |uncovered ∩ doc_words| / |uncovered|. The one thing I did not predict is the final linmap(coverage, 0.0, 0.40): full credit is given at 40% vocabulary overlap rather than 100%, on the argument that explanatory prose gives the reason without naming every identifier.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The empty-uncovered early return gives 1.0 — a body whose whole vocabulary is already in the signature counts as fully documented even with a doc that says nothing, which is the opposite direction from the rest of the function's caution.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `words_split_identifiers_and_drop_noise` — nearly — STALE
- read at `60b2def7030a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A test for a words tokeniser: feeds an identifier-heavy snippet mixing camelCase and snake_case, asserts the result contains the lowercased sub-words, and asserts noise — keywords, single characters, punctuation, very short tokens — is excluded.
- found: Three assertions doing exactly that: parseHTTPHeader, retry_with_backoff, and a keyword/short-name line asserting emptiness. The detail I missed is that the acronym does NOT split — the expected output is ["parse", "httpheader"], so a run of capitals stays glued to the word that follows it, which the test pins as intended behaviour rather than treating as a defect.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: "httpheader" as an expected token means two distinct concepts fuse into one vocabulary item, so overlap scores treat HTTPHeader and Header as unrelated words.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_comment_that_restates_the_signature_documents_nothing` — as expected — STALE
- read at `4caff0d46264` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A unit test for heuristic::documented: builds a function whose doc merely repeats the signature's words, asserts the score is ~zero because signature vocabulary is subtracted from both sides, and probably contrasts it with a doc adding real vocabulary scoring higher.
- found: Exactly that: sig `fn increment_counter(&mut self)`, a body doing three things, an echo doc "Increments the counter." asserted == 0.0, and an explanatory doc naming disk persistence and watchers asserted > 0.5. An inline comment names it the load-bearing test for the cooling mechanic.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `no_doc_is_no_explanation` — as expected — STALE
- read at `e88fec43c2a5` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A three-line unit test with a single assert_eq! that `documented` returns 0.0 when the doc is absent or empty.
- found: assert_eq!(documented(None, "fn a()", "body words here"), 0.0) — exactly one assertion on the None case.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `twelve_copies_of_a_handler_are_not_distinctive` — nearly
- read at `23169be468ac` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test building ~12 near-identical handler bodies, fingerprinting them, and asserting distinctiveness of one copy is low (below 0.5/UNDECIDED), likely contrasted with a genuinely novel body scoring higher.
- found: Exactly that shape, both assertions included — but with TWO similar handlers, not twelve: `distinctiveness(&a, &[&b])` against one sibling, plus a retry-loop body as the novel contrast.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Named "twelve copies" but exercises exactly two — the many-siblings case the product's headline claim rests on is not actually tested here.

### `a_lone_function_is_undecided_not_unique` — as expected — STALE
- read at `accf341a051d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: A three-line test asserting distinctiveness of a single function with no peers returns UNDECIDED (0.5) rather than 1.0, because an empty comparison set is no evidence of uniqueness.
- found: Exactly that: one assert_eq!(distinctiveness(&fingerprint("whatever it says"), &[]), UNDECIDED), preceded by a comment noting that returning 1.0 would set fire to every single-function file in the repo.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Warm: I had already opened heuristic.rs for the `documented` reading, though at a different range.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `short_bodies_decline_to_report_compressibility` — as expected — STALE
- read at `c06585b6822d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A tiny test asserting incompressibility() on a very short body returns UNDECIDED (0.5) rather than a confident value, using a small snippet.
- found: One assertion, incompressibility("a + b") == UNDECIDED, with a comment giving the reason: deflate's fixed overhead would otherwise rate every tiny function novel.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `non_ascii_source_does_not_split_a_codepoint` — nearly — STALE
- read at `022f33318c11` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A regression test pushing multi-byte source (accents, em dashes, emoji) through the scoring entry points — lex/fingerprint/surprise — and asserting mainly that nothing panics, i.e. byte slicing for shingles or truncation lands on char boundaries. Probably a loose range assertion as the payload.
- found: Three lines: two exact `lex` equalities showing that non-ASCII punctuation (em dash, middle dot) tokenises as its own punctuation token while accented letters stay inside one identifier (`héllo_wörld`), and a bare `let _ = fingerprint(...)` over a comment full of arrows and dashes, which is the smoke half. A comment gives the real motive — sibling projects' comments are full of em dashes, and getting it wrong panics inside a rayon worker on the first real scan.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Warm: I had already read another function in heuristic.rs earlier in this run, though not this region.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lex_separates_punctuation_from_identifiers` — as expected — STALE
- read at `f40325225ebb` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A short test calling lex on something like `foo(bar, baz);` and asserting each punctuation mark is its own token rather than glued to a neighbouring identifier, so the shingle fingerprint sees structure rather than `foo(` as a word.
- found: One assert_eq on lex("db.query(USERS, id)") against the exact eight-token vector with every delimiter split out. An inline comment frames the property as "one changed word must not change the tokens around it", which is the sibling-comparison stability argument rather than the fingerprint-vocabulary one I gave.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: this is the same file as position 5, though a different region, and I had not read this function.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_tiny_function_cannot_be_the_hottest_thing_in_the_repo` — as expected — STALE
- read at `081e4ac07ca5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The regression test for the `fn main()` finding: score a trivial short body alongside a substantial one and assert the tiny function's surprise is strictly lower, showing the UNDECIDED-on-short-input terms do not compound into a top ranking; likely also an upper bound near 0.5.
- found: Exactly that, and the upper bound is literally 0.5. It builds a three-line `fn main()` body and a 40-line generated `if cond{i}` body, computes distinctiveness for each against a single unrelated fingerprint (deliberately, so the too-few-shingles abstention is exercised), and asserts tiny < 0.5 and long > tiny with messages naming the scores.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `every_term_declines_to_measure_when_it_runs_out_of_evidence` — as expected
- read at `5305c9d15239` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test asserting each of the four terms returns UNDECIDED (0.5) on insufficient input — a tiny body for incompressibility and branch_density, a thin vocabulary for vocabulary_novelty, a lone peer for distinctiveness.
- found: Exactly that: four assert_eq!s against UNDECIDED on tiny inputs, with a comment stating the property (the score must not become a length metric in either direction). The body genuinely exercises what the name promises.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `surprise_stays_in_range` — as expected — STALE
- read at `1923d0feb480` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A six-line property test running `surprise` over very different inputs — empty body, trivial one-liner, something long and gnarly — asserting every result lands within 0.0..=1.0 so no term can push the score outside the reported scale.
- found: Precisely that: loops over "", "x", and 500 repetitions of "a b c ", calls surprise("fn f()", body, 0.5), and asserts the result is in 0.0..=1.0 with the value and body in the message.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/history.rs

### `key_of` — as expected — STALE
- read at `ac745c4141b1` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Concatenates the file path with the function's identifying parts into one string key — path plus name, probably owner and/or an ordinal so same-named twins in a file don't collapse. Derived on demand, no caching.
- found: Exactly that: owner defaults to empty string when None, then format!("{path}#{owner}::{name}#{ord}").
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs explain why the key is derived rather than stored but never say what the key is made of; the ord component (the twin-separating part) is the one piece a caller would need told.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lang_of` — as expected — STALE
- read at `f6bbb5fdcee8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Refuse anything whose path matches the VENDORED patterns duplicated into this module, so history refuses what the scan refuses, then take the extension and hand it to `Lang::from_extension`, returning None when either step fails.
- found: Exactly that, in two steps: any `/`-separated component appearing in `VENDORED` returns None, then `rsplit_once('.')?` takes the extension and `Lang::from_extension` decides. Component-wise matching rather than substring, so a directory merely containing "vendor" in its name is not caught.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The doc restates the signature; it says nothing about the vendored refusal, which is the half of the body that is not obvious from the name — and per this repo's own rules is the half that has to move in step with the scan.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `open` — as expected
- read at `6bb8b155f3c4` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Spawns a long-lived `git cat-file --batch` child in `repo` with piped stdin/stdout and null stderr, storing the child and its handles in a `Blobs`, returning None on failure, so blobs are streamed by writing oids rather than paying a process spawn per object.
- found: Exactly that: `git -C <repo> cat-file --batch`, `.ok()?` on the spawn, takes stdin and wraps stdout in a `BufReader`, and holds stdin as an `Option` (so it can be dropped to close the pipe later) alongside the child.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The docs handed over are the module header, which says nothing about this function; the only local detail worth a word — why `stdin` is an `Option` — is unexplained here.

### `read` — nearly — TRAP
- read at `bebea5cc0569` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Fetches one blob by sha from a long-lived `git cat-file --batch` child it owns: writes the sha to stdin, parses the "<oid> blob <size>" header, reads exactly size bytes, returns None when missing, over a size cap, or not valid UTF-8.
- found: That, plus the stream-discipline detail that makes it correct: the payload (size + 1 for the trailing newline) is ALWAYS drained before the MAX_BLOB_BYTES check, because leaving it in the pipe would desynchronise every later read by one blob and silently attribute one file's functions to another; a non-"blob" header line has no payload, so it returns immediately and stays in step.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: `vec![0u8; size as usize + 1]` allocates whatever git reports before MAX_BLOB_BYTES is consulted, so a huge blob is fully buffered just to be rejected — and any future early-return added above line 227 would desynchronise the batch stream in the silent way the comment warns about.

### `drop` — as expected
- read at `ce1faad2890f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Blobs wraps a long-lived `git cat-file --batch` child, so Drop closes the child's stdin (dropping the pipe) then waits on/kills the process so a replay does not leak a git subprocess; errors ignored because Drop cannot report.
- found: Exactly that, in two lines: `self.stdin.take()` to drop the pipe and let cat-file exit, then `let _ = self.child.wait()`. An inline comment states the ordering dependency — without closing stdin first the wait blocks forever.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The docs handed over are the module header, not this function's — it describes history replay and says nothing about Blobs or process lifetime.

### `intern` — nearly — STALE
- read at `c9d12149e1be` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A string-interning helper on Funcs: builds a key from path_idx plus the function's identity (name/owner/ord), looks it up in a HashMap, and on miss pushes a descriptor onto a Vec and inserts the new index. Returns the stable u32 index either way so frames refer to functions by index rather than re-allocating per commit.
- found: Precisely that, except the key is not built here — FuncAt already carries `f.key`, so intern only looks it up in self.index, and on miss pushes HistoryFunc { path: path_idx, name, owner, ord } onto self.list, records list.len() as the index, and returns it.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `functions_of` — nearly — STALE
- read at `d1eb2bb21e4c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Parse one blob's source with the given Lang, then walk the functions into a FileState, computing each key via key_of(path, name, ord) where ord counts prior occurrences of the same name in the file (a small map of name to count), storing span/size per key.
- found: Just that shape, with two differences: the occurrence counter is keyed on the (owner, name) PAIR rather than the bare name, and the key string is formatted inline as `{path}#{owner}::{name}#{ord}` rather than by calling the neighbouring `key_of`. Each entry becomes a `FuncAt { key, loc, ord, name, owner }` and the iterator collects into FileState.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc says ord disambiguates "exactly as assessment::key_of does", but the key is built by an inline format! here rather than through a shared helper, so the two spellings can drift apart silently.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `parse_raw` — as expected
- read at `dd345347b18e` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Strip the leading ':', split the metadata from the tab-separated path(s), pull src/dst modes, src/dst blob shas and the status letter, use path2 for R/C statuses, and return a Change describing the path plus the resulting blob; None on any malformed line.
- found: Exactly that, with the Change shape being {path, sha: Option, from: Option}: D yields sha None, R/C take the second path as `path` and set `from` only for R (a copy leaves the source in place), everything else is path + dst_sha. Modes and src sha are discarded. An inline comment records that the status byte is taken with `first()?` rather than `[0]` because an empty status once panicked the replay.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `commits` — surprising — STALE
- read at `c2fd8eaa1169` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Shells out to git log with --no-merges, --reverse and --max-count=n for Last(n), using a delimiter-separated --pretty format (hash, author, unix timestamp, subject), parses each line into a RawCommit, and returns the vec oldest-first plus the number of older commits dropped off the front, obtained via a separate `git rev-list --count` and subtraction.
- found: All of that, plus substantial work I did not predict: the log is run with --raw --find-renames --root, so the output interleaves commit header lines (prefixed with \x01, fields split on \x1f) with per-file change lines, which are parsed by parse_raw and pushed onto the most recent commit's `changes`. There is also a second CommitRange variant, Since(sha), which uses a `sha..HEAD` selector and reports zero dropped. Errors return an empty vec silently.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The docs describe the ordering and merge-exclusion rationale well but say nothing about the function's largest job — collecting each commit's per-file changes out of --raw output.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `tree_of` — nearly
- read at `ada0584b4f39` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Runs `git ls-tree -r <sha>` in repo and parses the output into (path, blob_sha) pairs, keeping only blobs whose extension lang_of recognises as source and skipping vendored entries, returning an empty vec if the command fails.
- found: Exactly that, minus the vendored filter — the only gate is `lang_of(path)` being Some. Parsing splits on the tab first (so paths with spaces survive), then splits the metadata on whitespace to check the object type is `blob` and take the oid; every malformed line is dropped by filter_map, and a failed git invocation yields an empty vec.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `parse_batch` — nearly — STALE
- read at `a3ec4a8e0347` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Takes (path, blob-sha) pairs, reads every blob sequentially through the single Blobs git process into a Vec, then rayon-parallel-maps that into (path, FileState) by picking a Lang from the extension and running functions_of — with refused content (unreadable, minified, vendored, unknown language) yielding an EMPTY FileState rather than being dropped, so a file that turns into a bundle loses its old wedges.
- found: That, split exactly as described: a sequential filter_map doing lang_of + blobs.read + a minified-line-length rejection, then into_par_iter running functions_of, with None sources collapsing to FileState::default(). One detail I got wrong: an unknown extension is dropped from the batch entirely (`lang_of(&path)?` inside filter_map), so only blobs that failed to read or looked minified come back empty — the empty-state guarantee the comment states covers refusal by content, not refusal by language. No VENDORED check here; only MINIFIED_LINE_BYTES.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Third function from history.rs in this run, so warm on the file; the empty-state rule in the comment is enforced for unreadable/minified blobs but not for a path whose language stops being recognised, which takes the `?` and vanishes from the batch.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `empty` — as expected — STALE
- read at `3122cd5332fc` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A private constructor returning a Replayer with all state empty — path index, function interner, per-file parse state, output frames — the starting point resume and a fresh replay both build on, long only because the struct has many fields.
- found: Exactly that: paths and state as empty BTreeMaps, funcs as Funcs::default(), and an inline HistoryScan literal with four empty Vecs, base_ts 0, empty head string, empty commits and truncated 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `resume` — nearly — STALE
- read at `986ed34f3ab0` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Builds an empty Replayer, then walks the cached HistoryScan — its base/seed state plus every frame in order — folding each frame's changes into the path index and per-file function tables exactly as the frontend fold does, so the resumed parse state matches a fresh walk. Returns the replayer positioned at the scan's last commit ready for extend.
- found: That, concretely: rebuilds the path->index and func->index interning maps from scan.paths/scan.funcs (keyed by key_of, not by position alone), copies the func list, then folds base plus every commit's `set`/`del` into a live BTreeMap of func-index -> loc, and finally rehydrates r.state as path -> Vec<FuncAt>. The scan itself is moved into r.out so extension appends to it. Detail I did not anticipate: the fold is over a flat live map keyed by function index rather than a per-file structure, with the per-file grouping reconstructed only at the end.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `path_idx` — nearly — TRAP — STALE
- read at `865f3d689300` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A string interner for file paths: look p up in a HashMap<String,u32>, return the hit; on a miss push the owned path onto a Vec<String>, record the new index in the map and return it, so frames carry u32 ids instead of repeated strings.
- found: That, plus a parallel array: on a miss it also pushes the path's language label (lang_of(p).label(), empty string when unknown) onto self.out.langs, so paths and langs are index-aligned. Cache map and output vec are separate fields (self.paths vs self.out.paths).
- predicted: most · documented: none · derivable: no · legible: most · trap: yes
- note: out.paths and out.langs are two parallel vectors kept aligned only by this one function pushing both — any other write to either silently desynchronises every language label.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `seed` — as expected
- read at `445710f60576` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Takes the tree listing of (path, blob) at the window's opening commit, parses the files in batch via blobs, interns each path, and records the resulting per-file function state as the opening state — with no touch dates, so pre-window functions draw uncoloured.
- found: Exactly that, and very compact: parse_batch does the filtering/parallelism, then per file it interns the path, interns each function into self.funcs, pushes (func index, loc) onto self.out.base, and stores the parsed state under the path in self.state. Confirms the no-date claim — base entries carry only an id and a line count.
- predicted: full · documented: most · derivable: no · legible: most · trap: no
- note: Not cold: cache_path in the same file was my first reading, though from the far end of the file and nothing about the replayer.

### `apply` — nearly — TRAP — STALE
- read at `4da1205cfaf5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: For each path a commit touched: deletions clear that file's state; additions/modifications fetch the blob, refuse minified/vendored ones (yielding an empty state rather than none), parse and intern functions, diff the new set against the carried-forward state to emit added/removed/changed entries, stamp the commit date as a touch time, and push the resulting Frame with commit metadata onto self.frames.
- found: Broadly that. It builds a HistoryCommit from the raw commit's sha/short/ts/author/subject, then retires paths in a first pass — both deletions (c.sha None) and the FROM side of renames, treating a rename's arrival as an ordinary write — pushing their interned function indices into frame.del. Then it filters changes to those with a blob and a recognised lang, runs parse_batch, and for every function in the new state pushes (index, loc) into frame.set unconditionally (a comment says set is what the commit touched, not only what it resized), emits del for previous functions whose key is gone, and replaces the per-path state. Finally it sorts/dedups the touched file list, updates out.head and appends the frame. No touch-date stamping here — the frame's own ts carries that — and the minified/vendored refusal lives inside parse_batch rather than here.
- predicted: most · documented: none · derivable: yes · legible: most · trap: yes
- note: Deletions are retired before writes, so a commit that deletes path A and renames B to A in one step would retire the newly written A only if ordering held — and the del pass runs entirely before the set pass, which is the assumption nothing here enforces.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fold` — nearly
- read at `3c8f9b6619a8` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: While frame count exceeds limit, pop the oldest frames off the front and merge their structural changes (added/removed functions) into the stored opening/base state, discarding touch dates so folded functions carry no date; repeat until the window fits.
- found: Computes `extra = len - limit` in one shot rather than looping per frame, drains that many commits, and applies each commit's `set` (function id -> location) and `del` into a BTreeMap seeded from the existing base, writing the result back as a sorted Vec. Also advances `base_ts` to the last folded commit's timestamp and increments `truncated` by the number folded.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs say folded functions lose their dates, but the fold keeps a single `base_ts` for the whole folded block — the loss is of per-function dates, not of all dating.

### `finish` — nearly — STALE
- read at `6990584ec849` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Consumes the Replayer and assembles the finished HistoryScan — moving out the accumulated frames plus the interned path table (and probably the opening/base state) into the returned struct, no further folding.
- found: Moves the interner's list (self.funcs.list) into the in-progress scan's funcs field and returns the scan. The frames were already accumulated in self.out; the only thing left to transfer is the interned function table.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: No docs at all; the field names (out, funcs.list) carry the whole explanation, which works here only because the body is two lines.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read` #2 — as expected — STALE
- read at `f688fcf520c0` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Reads the repo's last `limit` commits, returning an empty HistoryScan rather than erroring when git fails or there is no history; otherwise seeds a Replayer from the state before the window, walks commits chronologically calling apply (re-parsing only touched blobs), reports Progress as it goes, and returns replayer.finish().
- found: Exactly that. Extra specifics: it records base_ts from the first commit and the `truncated` count on the scan before any early return; both the empty-log case and a failed Blobs::open return r.finish() (an empty but well-formed scan); the seed is skipped entirely when truncated == 0, with a comment that a window covering the whole repo should start empty; the seed tree comes from `{sha}^` of the window's first commit; total is len+1 so the seed is its own progress step.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Warm: I had already read Replayer::resume in this same file earlier in the run, which made the seed/apply/finish shape familiar before I predicted.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read_cached` — nearly — STALE
- read at `e2ab15245310` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Loads the cached timeline for repo; if it exists and its head still matches head_of(repo) (and limit/format agree) returns it unchanged; if the cached head is an ancestor of the current head calls extend to parse only the new commits and fold the overflow; otherwise falls back to a full read. The fresh result is written back via save_cache with errors ignored.
- found: As predicted, with the ancestry check delegated to `extend` (which returns Option, None meaning "not appendable") rather than tested here, `limit` passed into load_cache/save_cache as part of the cache key, a non-empty check on `head` guarding the unchanged path, and a synthetic progress(1/1) tick on the cache hit so callers see a completed run.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `extend` — nearly
- read at `76a17a00da52` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Appends commits made since a cached timeline was written: refuses with None if HEAD is not a descendant of the cached head (rewritten history must be replayed whole), lists the new commits, resumes a Replayer from the cached frames, applies each commit, folds the overflow past `limit` into the opening state, reports progress, returns the extended scan.
- found: That, with two refusals I did not predict: an empty new-commit log returns None rather than an unchanged scan, and an append longer than `limit` also returns None on the grounds that it is doing the whole window's work with none of its clarity. Otherwise: is_ancestor guard, commits(Since(head)), Blobs::open, Replayer::resume, apply per commit with progress, fold(limit), finish.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: `None` is overloaded here — "history was rewritten", "nothing new" and "too much new" all return it, so an up-to-date cache is indistinguishable from an unusable one and the caller presumably replays from scratch either way; I had read this file once before (Blobs::read), so this reading is warm.

### `warm` — as expected — STALE
- read at `e04211c75f78` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Checks whether a cached timeline exists for this repo (cache_path/load_cache); if none, returns false immediately without building one. If one exists, calls extend/read_cached to fold in the commits since the cached head, saves, and returns true.
- found: Exactly that, in five lines: let-else on cache_path (false if no cache path can be derived), false if the file does not exist, otherwise read_cached with a no-op progress callback and true. The extend/save work is delegated entirely to read_cached.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `head_of` — as expected — STALE
- read at `bb77919dd951` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Shells out to git rev-parse HEAD in repo, trims stdout to a sha string, and returns an empty string on any failure (non-repo, no commits) rather than erroring — the sha used to decide whether a cached timeline can be extended.
- found: Exactly that: Command::new("git") -C repo rev-parse HEAD, .output().ok(), utf8, trim, unwrap_or_default. Exit status is never checked, but a failed rev-parse writes to stderr so stdout is empty and the default falls out anyway.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_ancestor` — as expected — STALE
- read at `7b033c777314` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Shell out to `git -C repo merge-base --is-ancestor sha HEAD` and return whether it exited successfully, so a cached timeline can be extended rather than replayed; false if the command fails to run.
- found: Exactly that, with stderr nulled and a comment explaining why: an unknown sha is the ordinary answer to "was this rewritten", not an error worth printing into the app's stderr.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `cache_path` — as expected
- read at `80dc0a4d558e` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns the machine-local cache file path for this repo's replayed timeline: a platform data/cache dir joined with a filename derived from hashing the repo's absolute path, with `limit` included so different caps don't collide. None when no cache dir is available.
- found: Exactly that: `reports::data_dir()?/timelines`, created with create_dir_all (failure -> None), an inline FNV-1a hash over the repo path bytes, and a filename `{hash:016x}-{limit}.json`.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `load_cache` — nearly
- read at `9c80b0106de8` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Reads the machine-local cache file at cache_path(repo, limit), deserializes into a HistoryScan, returning None on any failure — missing file, read error, bad parse — since the timeline is always reproducible from git.
- found: That, plus a version and limit check: it deserializes into a `Cached` envelope and only yields the scan when `cached.version == CACHE_VERSION && cached.limit == limit`, so a format bump or a different window silently invalidates rather than misreads.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Second reading from history.rs, so not cold — I had seen the file's peers and helpers earlier in this run.

### `save_cache` — nearly
- read at `007a14b6309c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Serialises the replayed timeline to the machine-local cache file from cache_path(repo, limit), creating the parent directory first, then writing JSON or a binary encoding; returns () and swallows every error, because a failed cache write is deliberately silent when git can rebuild the timeline.
- found: That, minus the directory creation (cache_path evidently handles it) and plus a version stamp: it wraps the scan in a Cached { version: CACHE_VERSION, limit, scan: scan.clone() }, serialises to JSON, and lets both the serialise and the write fail silently. The limit is stored inside the file as well as being part of the path.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The docs handed to me were the module header, not this function's — it has only inline comments, so `documented` is about a doc describing the enclosing module.

### `raw_line_reads_a_plain_edit` — as expected — STALE
- read at `235556f90f9e` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A six-line unit test feeding one `git diff-tree --raw` line for a modification (`:100644 100644 <sha> <sha> M\tsrc/a.rs`) into the raw-line parser, asserting it comes back as a single edit of that path with no source path retired, in contrast with its rename/delete/copy siblings.
- found: Exactly that: `parse_raw(":100644 100644 aaa bbb M\tsrc/main.rs")` must parse, yield path `src/main.rs`, carry the POST-image sha (`bbb`, not the pre-image `aaa`), and have `from` empty.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `raw_line_reads_a_rename_as_a_move` — as expected — STALE
- read at `f821d8a59e6e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A five-line unit test feeding a git raw --name-status line for a rename (R100 old-path new-path) into the parser and asserting it yields a move: the new path as the changed file plus the old path marked for retirement, rather than a bare add.
- found: Exactly that: parse_raw(":100644 100644 aaa bbb R096\tsrc/old.rs\tsrc/new.rs") is expected to parse, then asserts c.path == "src/new.rs" and c.from == Some("src/old.rs"). The only detail beyond my prediction is the full git raw-format prefix (modes and blob hashes) and the similarity score being R096 rather than R100.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc states the consequence (a ghost copy of every moved file) that the two asserts alone would never convey.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_copy_does_not_retire_its_source` — as expected — STALE
- read at `6beb0ed06502` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A short test feeding a git raw-diff line with copy status (C###, old->new) to the raw-line parser and asserting it yields the new path as an addition while leaving the source intact — no retirement of the old file, unlike a rename.
- found: Exactly that: parse_raw on ":100644 100644 aaa bbb C075\tsrc/a.rs\tsrc/b.rs" must succeed, report path == "src/b.rs", and leave `from` as None so the source is not treated as moved away. (The parser function is named parse_raw, not raw_line as the peer test names suggested.)
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `raw_line_reads_a_deletion` — as expected — STALE
- read at `a089c039e90c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Feeds a `git log --raw` line describing a delete (status D, e.g. ":100644 000000 abc 000 D\tsrc/old.rs") into the raw-line parser and asserts it yields a change marking the path deleted — no destination path, a blob oid signalling removal — as the sibling edit and rename tests do.
- found: Exactly that, in three lines: parse_raw on a D-status raw line, expect it parses, assert the path is src/gone.rs and that c.sha is None — None being how a deletion is represented, rather than a status enum.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `same_named_functions_in_one_file_stay_apart` — as expected — STALE
- read at `7433fe1e2455` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A short test building a file holding two same-named functions in different impl blocks, running it through the history replayer's parse, and asserting the resulting state holds two distinct function identities distinguished by ordinal rather than bare name, with their own sizes, so the second's arrival does not read as the first growing.
- found: Precisely that, minimally: two one-line `impl` blocks each with `fn new`, `functions_of("src/lib.rs", Lang::Rust, src)`, then two assertions on the collected `key`s — length 2 and the two keys unequal. It does not check the sizes or the ordinal form, only presence and distinctness.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm on history.rs — I read `load_cache` in this same file earlier in the run.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `repo_with` — nearly — STALE
- read at `14a11e986a39` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test fixture: creates a tempfile::TempDir, runs git init plus user.name/user.email config, then loops n times appending a fresh function to src/lib.rs and doing git add -A / git commit each iteration, returning the TempDir so the caller keeps it alive.
- found: Exactly that shape, with a local `git` closure wrapping `git -C <dir>` and expecting success. Two details differ from the doc and from my guess: the file written is `src.rs` at the repo root, not `src/lib.rs`, and each commit REWRITES the file with functions f0..=fi rather than appending, though the net effect is one added function per commit.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The one-line doc names `src/lib.rs` but the helper writes `src.rs` at the repo root, so a test author reasoning about path-scoped history from the doc would be scoping to a directory that does not exist in the fixture.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `shape` — nearly
- read at `2c21150be191` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test helper canonicalising a HistoryScan into an index-independent form — sorted path/name keys, a count, and per-frame commit id plus count pairs — so a resumed and a fresh timeline compare equal without depending on walk-order numbering.
- found: Folds the whole timeline forward (base map, then each commit's `set` inserts and `del` removals) to get the live function set at HEAD, maps each surviving index through `key_of(path, def)` with its LOC, sorts, and returns (commit shas, `truncated`, sorted (key, loc) pairs). So it is the FINAL state plus the commit list, not per-frame counts, and the middle value is the truncation count rather than a total.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: It compares only the END state and the sha list, so two timelines whose intermediate frames differ but converge would still pass as identical.

### `extending_a_cached_timeline_matches_replaying_it_whole` — nearly — STALE
- read at `035d5aa16396` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test building a temp repo of several commits, replaying it whole, then replaying a prefix and extending the cached prefix with the remaining commits, asserting the extended timeline equals the whole-replay timeline.
- found: Builds a 3-commit repo with repo_with, reads a timeline (asserting 3 commits), writes a file and makes a fourth commit with shelled-out git, then calls extend() on the cached timeline and read() fresh, and asserts shape(extended) == shape(fresh). Comparison is via a shape() helper rather than raw frame equality.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `extending_past_the_window_folds_to_the_same_state` — nearly — STALE
- read at `bc7ddc785a42` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Same shape as its sibling extending_a_cached_timeline_matches_replaying_it_whole but with a cap smaller than the commit count so the window overflows: build a repo_with(n) fixture, get a cached timeline, add more commits, extend the cache, replay the whole thing fresh at the same cap, and assert the two are equal — comparing the folded opening state and the frame list, probably via the `shape` helper.
- found: Exactly that. repo_with(3) read at a window of 2 (asserting truncated == 1), then a fourth commit that REPLACES src.rs with a single unrelated function — so the extend has to retire f0..f2 as well as append — then assert_eq on extended.commits.len() == 2 and shape(&extended) == shape(&fresh).
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: Warm: this is my third function from history.rs and I had read repo_with, which this test uses directly.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_history_that_was_rewritten_is_not_extended` — nearly — STALE
- read at `7f20bae2f777` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A short test making a repo with a couple of commits, recording the cached head, then rewriting history (amend/reset) and asserting the cache is refused — is_ancestor false, or read_cached returning None so a full replay happens instead of an append.
- found: Same conclusion, simulated rather than actually rewritten: it reads a 2-commit repo's timeline, overwrites cached.head with forty zeroes (a sha not in the repo), and asserts extend() returns None.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: The stand-in for a rewrite is a sha that exists in no repo at all, so it proves refusal-on-unknown-head rather than refusal-on-diverged-head; a real amend would exercise the merge-base path the docs describe.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `vendored_paths_have_no_language` — as expected — STALE
- read at `833c9eab75b6` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A short test asserting history's language-detection helper returns None for paths inside vendored directories (node_modules, vendor, third_party) even with a known extension, while an ordinary src/ path with the same extension still resolves.
- found: Three assertions on `lang_of`: node_modules/react/index.js is None, web/src/main.tsx is Some, README.md is None. The third covers the unrelated "extension we do not parse" case rather than a second vendored directory.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The name says "vendored" but only one of the three assertions is about vendoring, and only node_modules is exercised — the VENDORED list duplicated here from scan.rs is otherwise untested on this side.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/lib.rs

### `build_window` — as expected
- read at `6aa91c94ecd1` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A WebviewWindowBuilder with app URL, title, inner and min sizes, macOS overlay title bar, hidden title and a traffic-light inset, then build and unwrap/expect.
- found: Exactly that, with the macOS-only calls behind a cfg(target_os = "macos") shadowed builder, and a build failure printed to stderr rather than panicking.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: If the window fails to build the app keeps running with no window and only a stderr line; nothing surfaces that to a user.

### `select` — as expected — STALE
- read at `43b16757b8b3` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Sets the check state on the theme menu's three items so only `which` is ticked — set_checked(name == which) for light/dark/system, discarding the Result. Five lines, no return.
- found: Exactly that: three `let _ = self.X.set_checked(which == "X")` lines for light, dark and system.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `build_menu` — nearly
- read at `eeb013581621` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Rebuilds the whole macOS menu bar from predefined Tauri items — app submenu (About, Hide, Quit), Edit (undo/copy/paste/select-all), Window (minimise, close) — plus one custom piece, a three-way theme toggle (System/Light/Dark) as check menu items, returning the Menu together with a ThemeMenu holding handles to those three so the current choice can be ticked later.
- found: That, with one submenu I did not predict: a File menu holding a single custom MenuItem id 'open-project' labelled 'Connect an Agent…' on CmdOrCtrl+O, since opening a project by hand is gone and a project now arrives via sanity_open. The theme items are CheckMenuItems under a nested View > Appearance submenu, with 'System' the one checked at construction, and ThemeMenu { light, dark, system } is returned alongside the Menu.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment says the menu is 'otherwise the platform default' and everything else is predefined, but the File menu's one custom item — the ⌘O connect-an-agent entry, the only route into a project — is not mentioned there at all; its reasoning is an inline comment instead.

### `run` — nearly
- read at `4269936dbc8a` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The Tauri entry point: build the Builder, register plugins, manage the shared AppState, install the invoke_handler with commands from commands.rs, build the menu and window, wire menu events (theme selection via ThemeMenu::select, an Open Project item), start the loopback agentapi backend in a setup hook, and run with an expect.
- found: All of that, plus three things I did not cover: a single-instance plugin that focuses the existing window instead of starting a second scan; `agentapi::restore` so a restart reopens the previously active project; and a RunEvent::Exit handler calling `release_endpoint(pid)` so a quitting app withdraws its endpoint claim rather than leaving readers retrying into a dead port. The whole menu block is macOS-only and a menu build failure is logged, never fatal; theme state deliberately lives only in the webview while Rust owns only the checkmarks.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/local.rs

### `load` — as expected
- read at `8d2b12a161e0` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Init the llama backend, spawn an owner thread that loads the GGUF with GPU offload and makes model/context 'static (leaked), then loops over mpsc jobs of (prefix, body, reply) answering with score_one; the load result comes back on a ready channel so failure surfaces as Err, and success returns a LocalModel holding the sender and a label from the file name.
- found: That, precisely — including the Box::leak of both backend and model with a comment explaining the self-referential lifetime, and a `ready_tx` channel because loading happens on the owner thread. Details beyond my prediction: context is sized MAX_TOKENS + 64 for both n_ctx and n_batch, the label is prefixed "local · ", the sender is wrapped in a Mutex, and the loop ends when every sender drops.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `surprisal` — surprising — STALE
- read at `f7d1490b235a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Takes a mutex guard on the model and delegates to an inner routine that tokenizes prefix+body, runs one forward pass, and averages the negative log-probability of the body tokens in bits, returning None on failure; mostly lock-and-delegate at 9 lines.
- found: Lock-and-delegate, but the mutex guards a JOB CHANNEL, not the model: it makes a oneshot reply channel, locks `self.jobs` to send (prefix, body, reply_tx) to a worker thread that owns the model, then blocks on recv. No tokenization or arithmetic here at all — every failure (poisoned lock, dead worker, closed channel) collapses to None via `.ok()?`.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The doc says "serialised behind a mutex", which reads as a lock around the model; the mechanism is actually a worker thread owning the model with a mutex only on the job queue, and the doc's explanation of WHY serialising is free is not derivable from the body.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `score_one` — nearly
- read at `ad97ea226f55` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Tokenize prefix and body into one context, decode in a single pass with logits at every position, walk the body's token positions computing log-softmax of each token's own logit, average the negative log-probs into a mean surprisal, return None on tokenize/decode failure or a too-short body.
- found: Exactly that, plus two things I did not cover: (1) a context-trimming policy — body capped at MAX_TOKENS/2 and the OLDEST prefix tokens dropped to fit, never the body; (2) logits are requested only at positions that are actually scored (last prefix token through second-to-last body token), documented as roughly a 3x cost saving. Score is mean bits (nats converted via LN_2). Rejects bodies under 8 tokens.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `label` — as expected — STALE
- read at `8245bbbbdd5f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns a human-readable display name for the LocalModel — most likely the model file's name/stem or a formatted string like format!("local:{}", self.name); a one-expression accessor cloning or formatting a stored field.
- found: Clones and returns the struct's own `label` field. A bare getter.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_model` — as expected — STALE
- read at `af36895b6641` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A one-line trait-method override returning true — the Model trait presumably defaults it to false for the heuristic proxy, and LocalModel says yes so callers can distinguish a real model reading from a proxy score.
- found: A three-line body returning the literal `true`, nothing else.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `surprise` — as expected
- read at `556459820a83` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Builds a prompt/context from the item (docs plus signature, then the body), calls `self.surprisal` for the body's per-token surprisal, calibrates it onto the reported scale and returns a `Reading`; falls back to the passed-in `proxy` when the model cannot answer rather than inventing a confident number.
- found: Exactly that in five lines: prefix is `context\nsignature\n` — deliberately the same conditioning the HTTP path used so the two backends stay comparable — then `surprisal(prefix, body)` mapped through `calibrate_surprisal` into `Reading::plain`, with `None` falling back to `proxy`.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `discover_models` — as expected
- read at `4a1a96bacd5f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Walks Ollama's blob directory (~/.ollama/models/blobs), collecting files over a 100 MB threshold as candidate models, no magic-number/extension check, empty vec if directory missing, possibly sorted.
- found: Exactly that: dirs::home_dir().join(".ollama/models/blobs"), read_dir, keep entries whose metadata len > 100_000_000, push paths, sort, return. Every failure path degrades to empty.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## src-tauri/src/main.rs

### the file itself — as expected
- read at `85fd5a79591b` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A thin Tauri binary shim: the windows_subsystem cfg_attr, and a main that dispatches to cli.rs when argv names a subcommand (mcp, serve, study, status) and otherwise calls the library run() to open the window. No logic of its own.
- found: Exactly that shape. `mcp` is special-cased first and returns rather than exiting; any other non-empty argv is forwarded to sanity_lib::cli::main and its return becomes the process exit code; empty argv opens the window. Inline comments carry the reasoning — one binary so the command an agent is told to launch always exists, and so a second installable cannot drift the way mcp/sanity.mjs did.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: No file-level header at all in a repo where every other module carries a long one; the reasoning lives in inline comments instead, so `docs` came through empty.

### `main` — as expected
- read at `84cd70f31b74` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Binary entry point: inspects env::args and dispatches to CLI subcommands (scan, mcp, serve, study, history) in cli.rs, exiting after; otherwise launches the Tauri app via sanity_lib::run().
- found: Three-branch dispatch: arg 1 == "mcp" runs the stdio MCP server and returns; any other non-empty args exit with sanity_lib::cli::main's status code; no args opens the window. Heavy inline comments explain the one-binary rationale.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment was handed over, but the body carries three substantial inline comments — the reasons are there, just not where the tool looks.

## src-tauri/src/mcp.rs

### `project` — as expected — STALE
- read at `5859c08a6e19` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Reads the shim's remembered project key — the PROJECT static, set when this client handled sanity_open — and returns a clone, None if nothing has been opened. That key rides on every backend call so a human clicking another project in the window cannot retarget this session, and it is deliberately never in the tool schema.
- found: Exactly that: `PROJECT.lock().ok().and_then(|p| p.clone())` — a Mutex-guarded Option<String>, cloned out, with a poisoned lock also yielding None.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The `.ok()` turns a poisoned lock into "no project opened", which routes the call to the backend's fallback repo rather than failing — the same fail-open shape the idle check in cli.rs was fixed for.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `base_url` — as expected
- read at `7cef72b9ecea` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Read the endpoint file the app publishes (port plus pid), parse the port fresh on every call rather than caching, return Some("http://127.0.0.1:<port>") or None if missing/unparseable; probably a SANITY_BACKEND env override first.
- found: Exactly that, in three lines: SANITY_BACKEND wins outright, otherwise it delegates to agentapi::read_endpoint()?.url(). A comment records that parsing deliberately does not live here — once the CLI needed the pid too, a local parser would have been a second reader of one format, the mcp/sanity.mjs failure in miniature.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The handed docs describe re-reading and stale-file behaviour that now lives entirely in read_endpoint, so the header is about a mechanism this body only delegates to; also SANITY_BACKEND, the one branch actually implemented here, goes unmentioned.

### `with_retry` — as expected
- read at `addb4bd1eb3a` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Loop until a deadline, re-resolving the endpoint each pass via base_url(); call attempt(&base); return Ok immediately, return Fatal errors immediately, sleep and retry on transient/connection errors. Once per call, if nothing is answering, heal by starting a backend (and reopening the shim's PROJECT). On timeout return an error distinguishing UNREACHABLE from NOT_RUNNING via a probe rather than the endpoint file.
- found: Exactly that: deadline = now + RETRY_FOR, `healed` flag, base_url() returning None is treated as "still starting" and waited through, Fatal returns, Transient falls through; on deadline it probes cli::live() to choose UNREACHABLE vs NOT_RUNNING; before sleeping, if not yet healed and probe says nothing is live, calls heal() once and continues without sleeping.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `heal` — as expected
- read at `c5150cbb1daa` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Restarts a dead backend (spawn lock / start helper, wait for a probe to answer), then if PROJECT holds a repo path, synchronously reopens that repo against the fresh backend so a retried reader doesn't hit NO_PROJECT; Ok early if nothing was opened.
- found: Calls cli::ensure_backend(), returns Ok early if project() is None, else builds base_url() and POSTs {"path": key} to /open with a raw client — deliberately bypassing the shim's own `post` helper to avoid recursing into the retry loop that called it.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The inline comment about not routing through `post` to avoid recursion is the one thing outside the docs, and it earns its place.

### `client` — as expected — STALE
- read at `08ed55c841b2` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Builds a blocking reqwest Client with a configured timeout via Client::builder(), mapping a construction failure into a RetryableError variant.
- found: Exactly that: builder().timeout(REQUEST_TIMEOUT).build().map_err(|e| RetryableError::Fatal(e.to_string())).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `decode` — nearly
- read at `9bea9c03b300` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Branch on status before parsing. Success: parse JSON, turning a decode failure into an error. 4xx: read the body as text, return a non-retryable error saying arguments were rejected, nothing recorded, fix and resend. 5xx: Sanity's fault, may have recorded something, do not resend blindly. Body text included verbatim so the useful sentence survives.
- found: As predicted, with two details I did not cover: the detail text is trimmed and truncated to 400 chars (serde paths get long), and EVERY arm returns RetryableError::Fatal — including 5xx and including an unparseable success body — so despite the type name decode never asks for a retry. The 4xx message also carries a concrete hint that all fields go at the top level with no wrapper object, which is the specific mistake that motivated the function.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `get` — nearly
- read at `ea9a44997be4` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A tiny HTTP GET helper for the shim: base_url() + path, blocking send via the shared client(), decoded JSON returned, transport and non-success responses mapped to an error String so callers can decide whether to heal and retry.
- found: That, with the retry inverted from my guess: `get` is itself the wrapper — it calls `with_retry`, which supplies the `base` and owns the heal-once logic, while the closure only sends and calls `decode`. A send failure becomes `RetryableError::Transient` rather than a plain string, which is what lets with_retry distinguish a dead backend from a real error.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `post` — nearly — STALE
- read at `d4900af3b5f0` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A tiny HTTP helper in the MCP shim: build the URL from the base plus `path`, POST the JSON body with the shared `client()`, map transport errors to a String, and hand the response to `decode`, mirroring the neighbouring `get`.
- found: That, but the whole body is wrapped in `with_retry(|base| ...)` which supplies the base URL and re-runs on failure; send errors become `RetryableError::Transient` rather than a plain string, and `decode(r)` returns the result.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `urlencode` — as expected — STALE
- read at `a37075a00bd1` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A dependency-free percent-encoder: iterate the bytes, pass through the unreserved set (alphanumerics plus -_.~ and probably /), and emit %XX uppercase hex for everything else, collected into a String.
- found: Exactly that, byte-wise via map/collect, with `/` in the pass-through set (paths stay readable in the query string) and `format!("%{b:02X}")` for the rest.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `tools` — as expected — STALE
- read at `fd47f7efb38d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Returns the tools/list JSON payload: an array of five tool definitions (sanity_open, sanity_next, sanity_report, sanity_status, sanity_summary), each with name, a terse rule-carrying description, and an inputSchema with properties and required; mostly a json! literal, with the grade enums spelled out on the report tool.
- found: Exactly that — one json! array of the five tools in the order open, status, next, report, summary. sanity_report carries the full property set including predicted/documented/legible enums, derivable, trap, the deprecated `surprised`, note, model, cold and position, with an eleven-field `required` list; status and summary declare empty schemas.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Not a cold reading in any meaningful sense: this function's return value IS the tool schema already loaded in my context, so I had read its output verbatim before predicting — the queue cannot see that a reader is structurally warm on this one function.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `contract_fingerprint` — as expected
- read at `aaf29196be5a` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Serialises the tools() list to a JSON string, runs an FNV hash over its bytes, and returns the result as a short hex string — a cheap identity for the schema this process is actually serving, so a shim built against an older contract can be spotted.
- found: Exactly that: serde_json::to_string(&tools()) with unwrap_or_default, FNV-1a 64-bit inline (offset basis 0xcbf29ce484222325, prime 0x100000001b3), formatted as 16 hex digits. Note there is a `fnv` helper in heuristic.rs; this one is open-coded rather than reusing it. A serialisation failure would silently fingerprint the empty string, though tools() cannot realistically fail to serialise.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `call` — nearly — STALE
- read at `ee8014583f5d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: The tool dispatcher: matches `name` and translates each MCP tool into a backend HTTP call, attaching the session's PROJECT key rather than taking it from the args. sanity_open posts the path (starting a backend if nothing answers) and stores PROJECT; sanity_next hits the queue endpoint forwarding `n` only if the caller supplied it; sanity_report posts the report body; status and summary are GETs; an unknown name returns an Err string.
- found: All of that. Two things I did not cover: sanity_open also sends `contract_fingerprint()` so the backend can flag a shim/backend contract mismatch, and ensure_backend()'s result is deliberately discarded because `post` retries and already carries the right error wording. `n` is clamped to 1..=25 when present and omitted entirely otherwise so serde fills it from default_n; report copies args and inserts `project` into the object.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Third function I have read in mcp.rs, so not cold; the inline comments carry the history and the function itself has no docstring.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `run` — nearly — STALE
- read at `d53dea6f65ee` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: The MCP shim's stdio JSON-RPC loop: read lines from stdin, dispatch initialize (protocol version + serverInfo), tools/list (returning tools()), and tools/call (delegating to call), writing JSON-line responses to stdout and skipping notifications.
- found: Exactly that, plus: skips blank and unparseable lines, treats a missing id as a notification and drops it, wraps tool results as MCP text content with pretty-printed JSON, returns tool errors as isError content rather than transport errors so the model can read them, and answers unknown methods with a -32601 JSON-RPC error. All writes are unchecked with flush after each.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/model.rs

### `from_extension` — nearly — STALE
- read at `741589e9d810` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A single match on the extension string (probably lowercased) mapping each known suffix to a Lang variant, dozens of arms with several extensions grouped per language, contested extensions decided in favour of one language, and a final _ => None so unknown suffixes never guess.
- found: Exactly a Some(match ext { ... _ => return None }) with ~60 arms covering 45+ languages, grouped extensions per language, and inline comments deciding the contested ones (.h to C, .m to ObjC, .v to Verilog, .pl to Perl). One detail I got wrong: the extension is NOT lowercased — it is matched verbatim, which is why R carries both "r" and "R" arms.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Matching verbatim means any extension whose only arm is lowercase (e.g. .PY, .RS on case-insensitive filesystems) silently returns None; only R is spelled both ways.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `label` — as expected — STALE
- read at `6b246a324a58` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: An exhaustive match over every Lang variant returning its human-readable display name as a &'static str, one arm per supported grammar, mirroring from_extension.
- found: Exactly that: 64 match arms mapping Lang variants to display names, with the expected casing fixes (TSX, C++, C#, Objective-C, Godot Shader, Emacs Lisp, jq).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `weight` — nearly — STALE
- read at `1518ec3b7f08` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A match over the Provenance variants returning a fixed f32 per variant: human-authored at 1.0, Source (in-repo comments, authorship unknown) discounted to roughly 0.5-0.7, no model-authored variant existing at all, remaining variants at 0.
- found: match self { None => 0.0, Source => 0.6, History => 0.85, Human => 1.0 } — the Source discount landed inside my guessed range; the fourth variant, History, at 0.85, I did not anticipate.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Not cold — this is my second reading in model.rs; the docs justify None/Source/Human but say nothing about why History banks 0.85.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `temperature` — nearly — STALE
- read at `e01555eadc29` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A one-line accessor returning self.surprise unchanged — no multiplier by (1 - explained), kept as a named method purely so the colour has one definition point.
- found: Returns self.surprise.clamp(0.0, 1.0) — the surprise, with a defensive clamp to the unit range.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_stable` — nearly — STALE
- read at `d95b09da8cc5` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Returns true when the function is both old and quiet — roughly self.age_days >= 90 && self.churn <= a small threshold, a quarter being the generous threshold the docs mention. Feeds the stability axis of quadrant.
- found: Exactly that: churn < 0.25 && age_days.is_some_and(|d| d > 90.0). age_days is an Option, so a function with no git history is never stable.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's "quarter" reads as the 90-day age window, but 0.25 is also the churn cut — two thresholds and the prose names neither explicitly.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `quadrant` — nearly
- read at `c77cb0005e42` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Cross surprise (above/below a threshold) with stability (is_stable) to pick one of four Quadrant variants; loc probably a guard so short functions land in a neutral quadrant.
- found: Matches on (surprise >= HOT, is_stable()): hot+stable = CrownJewel, hot+unstable = Trouble; cold splits on size instead of stability — loc >= 40 is Bloat, otherwise Quiet. A comment explains that Bloat is the only quadrant that consults size because it is the only claim about size.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The cold half of the grid ignores stability entirely and substitutes size, so the "four quadrants from two axes" framing in the module docs is really three-and-a-half.

### `dir` — as expected — STALE
- read at `cc2c6f154037` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A constructor for a directory Node: kind Dir, stores the given path and name, and initialises everything else empty/zero — no children, loc 0, no score, no signature/body — ready for aggregate to fill in totals once children are pushed.
- found: Exactly that, a flat struct literal filling every field; the only detail I did not name is that `id` is the path itself (directories carry no `@line`, unlike function ids), and `hotspots` is a further empty vec.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `aggregate` — surprising — TRAP
- read at `18401f3ff9a2` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A recursive post-order roll-up on Node: recurse into children first, sum their LOC into this node's LOC, then compute this node's Score as a LOC-weighted combination of the children's — hot_share as the fraction of analysed lines that are hot, with unscored/unanalysed lines excluded from the denominator, and no score at all if nothing beneath was analysed. Leaf function nodes keep their own score untouched.
- found: That, plus three mechanisms I did not cover. (a) "Analysed" means Source::Model only — a proxy-scored function counts zero toward analyzed_share, so the share is agent coverage, not scoring coverage. (b) age_days rolls up as the MAX (a directory is as old as its oldest surviving code) and last_touched_days as the MIN, both skipping None. (c) commits is deliberately reset to 0 and provenance forced to Provenance::Source, because neither averages; commits is refilled by a later git-log pass. Directory hot_share composes via each child's own analyzed_share rather than raw LOC.
- predicted: some · documented: some · derivable: no · legible: full · trap: yes
- note: aggregate() unconditionally writes commits: 0 and expects a later git pass to refill it, so any re-aggregation after the history pass silently zeroes every directory's commit count — an ordering rule that only a comment enforces.

### `visit` — as expected — STALE
- read at `a76307ff6edf` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Recursive pre-order traversal on Node: call f(self) first, then iterate self.children calling child.visit(f) on each, so callers can fold over the whole tree without writing the recursion.
- found: Exactly that: f(self), then a for loop over &self.children recursing with c.visit(f).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `score` — as expected — STALE
- read at `ea788d40ab06` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test-module helper building a Score struct literal from the four given components and filling the remaining fields (loc, analysed flag, provenance) with fixed defaults so tests can construct scores in one line.
- found: Exactly that: a Score literal taking surprise/documented/churn through, age wrapped as Some(age_days), and constant defaults for commits 0, last_touched_days None, Provenance::Source, hot_share 0.0, Source::Model, analyzed_share 1.0.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Its fixed Source::Model is quietly load-bearing for the neighbouring model_authored_text_cannot_cool_a_wedge test, and nothing in the helper says so.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `temperature_is_surprise_and_documentation_does_not_discount_it` — as expected — STALE
- read at `a1ecaa58ac1f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A short test constructing Scores with identical surprise but differing explained/documentation values and asserting temperature() equals the surprise in every case, proving documentation is reported but never subtracted from the colour.
- found: Three assertions doing exactly that — surprise 1.0 with explained 0.0 and 1.0 both yield temperature 1.0, and 0.8 with explained 0.5 yields 0.8 within epsilon — with a comment saying documentation now reaches the instrument rather than the arithmetic.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: this is my second reading from model.rs, and the first was a sibling test using the same score() helper.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `quadrants_split_on_surprise_and_stability` — surprising — MURKY — STALE
- read at `5d1e265b41e2` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: An eight-line test building four Scores from the two axes — hot/cold surprise crossed with stable/churning — via a `score` helper, asserting each maps to its own Quadrant variant so both thresholds are pinned in both directions.
- found: Five asserts against score(surprise, ?, churn, age_days).quadrant(loc). High surprise + no churn + old is CrownJewel; high surprise + churn is Trouble; and — the case I did not predict — high surprise + no churn but only 3 days old is also Trouble, because young code cannot be a crown jewel. The cold half does not split on stability at all: low surprise at loc 500 is Bloat and the identical score at loc 4 is Quiet, so quadrant() takes LOC as an argument and a third and fourth input (age, size) decide two of the four corners.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: The test is named for a split on two axes but its body shows four inputs deciding the corners — surprise, churn, age and loc — and the four positional floats of the `score` helper are unlabelled, so the assertions cannot be read without opening the helper.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_directory_reports_the_share_of_it_that_is_hot_not_the_mean` — as expected — STALE
- read at `c34377f2549c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test building a directory Node with two children at contrasting temperature and LOC, calling aggregate, and asserting the directory reports the LOC-weighted share of hot lines rather than the mean temperature — with the sizes chosen so the mean and the share disagree.
- found: Exactly that: a 100-LOC child at surprise 1.0 and a 300-LOC child at 0.0, aggregate(), assert hot_share == 0.25 within 1e-6, then assert the mean surprise is still < 0.3 to show the mean would read lukewarm. A comment states the failure it guards against.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `unanalysed_lines_are_left_out_of_hot_share_entirely` — nearly — STALE
- read at `5cbfa2c67966` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test building a directory with a mix of analysed and unanalysed function children, asserting the directory's hot share is computed only over analysed lines — unanalysed lines excluded from the denominator rather than counted cold.
- found: Exactly that: a src dir with a 100-loc analysed hot func (analyzed_share 1) and a 300-loc func with analyzed_share 0.0 / Source::Proxy; after aggregate() it asserts hot_share == 1.0 and analyzed_share == 0.25, so the unlooked lines move analysed coverage but not the hot fraction. An inline comment gives the reason (otherwise directories would appear to warm up as a scan progressed).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Both children are built with Node::dir and then reassigned kind = Func, which reads oddly but is only test scaffolding.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_wedge_nothing_has_analysed_reports_no_heat_at_all` — as expected
- read at `fba22e45bc37` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test that builds a directory whose only child has been scored but never actually analysed (analyzed_share 0, proxy source), calls aggregate(), and asserts the directory reports analyzed_share 0 and hot_share 0 — no heat claimed rather than a mean of unanalysed material.
- found: Exactly that, and it does exercise the property its name promises. One oddity in the setup: the child is built with Node::dir(...) and then mutated to NodeKind::Func rather than constructed as a function, and the child's high surprise (0.9) is what makes the hot_share == 0 assertion meaningful.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `hot_share_composes_through_nested_directories` — as expected — STALE
- read at `fc08d7fd60f1` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: A nested tree — root holding a subdirectory of functions — aggregated once, asserting the outer hot_share equals the LOC-weighted combination of the inner shares rather than being lost or re-derived at each level.
- found: Exactly that, at its simplest: root -> mid -> two 50-LOC function children at surprise 1.0 and 0.0, one aggregate() on root, assert root hot_share == 0.5. Only one intermediate level and equal LOC, so it tests composition but not weighting.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: With both children at 50 LOC and only one nesting level, a 0.5 result is also what an unweighted mean-of-means would give — the name promises composition through nesting but the numbers cannot tell correct composition from that failure; the sibling test above it does the weighting work.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `aggregation_is_loc_weighted_not_per_function` — as expected — STALE
- read at `7c6700b188a2` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A unit test building a directory node with two function children of very different line counts and different scores, calling Node::aggregate, and asserting the directory score is the LOC-weighted average rather than the per-function mean.
- found: Exactly that: a 3-line function with surprise 1.0 beside a 300-line function with surprise 0.0, aggregated; asserts loc == 303 and that the directory's surprise is under 0.05 (per-function mean would be 0.5).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `model_authored_text_cannot_cool_a_wedge` — surprising — TRAP
- read at `454b6dc01b3f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test defending the provenance rule: builds two otherwise identical scores, one whose documentation is attributed to a model, and asserts the model-authored one is no cooler — equal temperature, or a zero `weight` for the model provenance variant — so a generated-docs pass cannot turn the map green.
- found: Two one-line assertions on the existing variants only: `Provenance::None.weight() == 0.0` and `Provenance::Source.weight() < Provenance::Human.weight()`. It never constructs a score, never computes a temperature, and there is no model-authored input anywhere in it — the comment states that the defence is the ABSENCE of a weighted model variant, which no assertion can observe.
- predicted: some · documented: none · derivable: yes · legible: full · trap: yes
- note: The test is named for the product's central claim but asserts nothing that could fail if it were broken: adding a `Provenance::Model` variant with a positive weight — exactly the degenerate failure the comment describes — leaves both assertions green.

## src-tauri/src/parse.rs

### `loc` — as expected — STALE
- read at `b4c7a2ed711e` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Returns the function's line count as end_line - start_line + 1, with a saturating subtraction so an inverted span cannot underflow.
- found: self.end_line.saturating_sub(self.start_line) + 1 — exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `language` — as expected — STALE
- read at `686c9ae46166` · commit `9fe6ccf` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A flat match over every Lang variant returning the tree-sitter Language from the matching grammar crate — mostly `tree_sitter_x::LANGUAGE.into()`, with a few irregular ones where the crate exposes a differently-named constant or a sub-language (typescript vs tsx). Exhaustive with no fallback arm, so a new Lang variant fails to compile.
- found: Exactly that: 64 arms, one per Lang, almost all `tree_sitter_*::LANGUAGE.into()`, with the sub-language exceptions where a crate ships several (TypeScript/Tsx, PHP, OCaml, F#, CommonLisp, CFML, GLSL/HLSL/Slang) and a couple of fork crates (clojure-orchard, kotlin-ng, vb-dotnet, sequel for SQL, qmljs for QML). No wildcard arm.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `func_kinds` — as expected — STALE
- read at `aa4684f4a078` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A single match over every Lang variant, each arm returning a &'static [&'static str] of tree-sitter node kind names counting as function definitions — Rust function_item, Python function_definition, Go function_declaration/method_declaration, JS family function_declaration/method_definition/variable_declarator but no bare arrow or function expressions. 91 lines because ~45 grammars are supported, so mostly one line per language with a few shared arms.
- found: Exactly that: a flat match, no logic, arms grouped where languages share kinds. Comments mark the cases where the kind alone cannot decide (Elixir `call`, OCaml `let_binding`, R `binary_operator`, Clojure `list_lit`, Scheme/Racket `list`) and defer the real test to `accepts`, and note deliberate omissions (Swift subscripts/deinits, C++ class bodies) and Erlang keying on `function_clause` rather than the declaration.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `declarator_is_function` — as expected — STALE
- read at `6f33e56848e5` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Look up the declarator's `value`/initialiser child by field name and return true only when its kind is a function form — arrow_function, function_expression/function, probably generator_function — false when the field is absent.
- found: Exactly that: `child_by_field_name("value").is_some_and(|v| matches!(v.kind(), "arrow_function" | "function_expression" | "function" | "generator_function"))`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `text` — as expected — STALE
- read at `b9d14121ca24` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A tiny helper slicing the source by the node's byte range — &src[node.start_byte()..node.end_byte()] — probably via node.utf8_text(src.as_bytes()).unwrap_or("").
- found: Exactly node.utf8_text(src.as_bytes()).unwrap_or("").
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `leading_doc` — nearly
- read at `928f9d553bf2` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Walk backwards through previous siblings: step over attribute/decorator nodes, accumulate consecutive comment siblings while adjacent (end row exactly one above the next start row, so a blank line stops the walk), reverse, strip comment markers, join with newlines, None if empty.
- found: Exactly that, plus a THIRD rule the handed docs do not mention: an inner doc comment (`//!` or `/*!`) breaks the walk, because module docs would otherwise be handed to whatever function happens to follow — and the blank-line rule cannot catch it, since tree-sitter-rust gives an inner doc comment a trailing newline that closes the apparent gap.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's last paragraph was added because a cold reader missed the decorator rule — and the same thing has now happened again with the inner-doc-comment rule, which the doc still does not mention.

### `wrapper_doc` — as expected
- read at `3bb3df0748bc` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Climbs the parent chain while each parent is a wrapper kind (declarator/lexical declaration/export/expression statement), calling leading_doc at each step and returning the first comment found; stops and returns None at any parent that is a real enclosing type or function rather than inheriting its docstring.
- found: Exactly that, with the climb still bounded to three steps: `DOC_WRAPPERS.contains(parent.kind())` is the gate, `leading_doc(parent, src)` the probe, `None` on the first non-wrapper parent or after three hops.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `owner_of` — surprising
- read at `335ae57df339` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: For Go, read the receiver field off the function node, strip a generic parameter list and pointer/whitespace, reduce to the bare type identifier. Otherwise walk up the ancestors to the NEAREST enclosing type-like node, take its name node, return it; None at the file.
- found: The Go half is as predicted (split at '[', then last identifier run). The non-Go half is not: it collects the WHOLE ancestor chain of OWNER_KINDS, not the nearest, truncates to three levels, reverses to outermost-first and joins with '.' — so nested classes give `Boolean.Input`. It also tries the `name` field then falls back to `type` so Rust's `impl Foo` and `impl Trait for Foo` work without a language branch.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment covers only the Go receiver case in detail and says nothing about the multi-level dotted chain, which is the part that would surprise a caller.

### `python_docstring` — nearly
- read at `97ab06ebed79` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Given a Python function's body node, walk to the first statement in the block; if it is an expression_statement wrapping a string literal, take its text, strip surrounding quotes and trim, return Some; else None.
- found: Exactly that, plus one thing I missed: it skips leading comment nodes in a loop (comments are named nodes in this grammar, so a shebang occupied slot zero and hid file-level docstrings). Also tolerates a bare `string` node not wrapped in expression_statement.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `strip_comment_markers` — nearly — TRAP — STALE
- read at `206c453e8d95` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Strips language comment syntax line by line — ///, //, #, /*, */, leading * on continuation lines — trims whitespace and rejoins into plain prose.
- found: Exactly that, as an ordered chain of trim_start_matches/trim_end_matches per line (///, //!, /**, //, /*, #, */, *), then trim, joined with newlines and trimmed overall. Notably it does NOT handle ;; (lisp) or -- (haskell/lua/sql) despite the repo supporting those languages.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: The marker list is order-dependent and silently incomplete: no ';;' or '--' handling, so Lisp and Lua/Haskell doc comments keep their markers in the text handed to readers.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `parse_functions` — as expected — STALE
- read at `039258235721` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Builds a tree-sitter Parser, sets it to language(lang) and bails with an empty Vec if that fails, parses src and returns empty on None, then walks the tree from the root delegating to a recursive helper (collect/extract) that matches nodes against func_kinds(lang) and accumulates FuncDefs into a vec that is returned.
- found: Exactly that, down to the helper name: Parser::new, set_language guarded by is_err, let-else on parser.parse, then `collect(tree.root_node(), lang, func_kinds(lang), src, &mut out)` and return out.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `collect` — surprising
- read at `600851bbefb7` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The recursive tree walk behind parse_functions: cursor over children, and for any child whose kind is in `kinds` (confirmed by accepts/declarator_is_function) call `extract` to build a FuncDef and push it into `out`. Recurses into every child regardless so nested and method-in-impl definitions are found, passing lang and src through.
- found: It tests the node ITSELF rather than its children, and — the part I got backwards — on a successful extract it returns without descending, so a closure defined inside a function is deliberately not a sibling wedge; counting both would double the enclosing function's lines and dilute its score. It only recurses when the node was not accepted or extraction failed. `variable_declarator` is special-cased through declarator_is_function.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The docs handed over are the module's; the one decision that matters here — not descending into an accepted function, so nested closures never become wedges — is only visible in an inline comment.

### `accepts` — surprising — STALE
- read at `f90342856f27` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Returns whether a node counts as a function for this language: a literal membership test of node.kind() against `kinds`, with an Elixir special case where a `call` node only qualifies if its head identifier is def/defp (probably defmacro/defmacrop too), read out of src, so modules and imports are rejected. Possibly a C/C++ arm deferring to declarator_is_function.
- found: The kind test and the Elixir arm are as predicted (target field matched against def/defp/defmacro/defmacrop), but Elixir is one of EIGHT special cases, not the only one: OCaml requires a `parameter` child to tell `let add a = ...` from `let x = 5`; F# requires a `function_declaration_left`; R and Nix check that the bound rhs/expression is a function; Clojure matches the lisp head against defn/defn-/defmacro/definline; Scheme and Racket require a `define`/`define-syntax` head AND a parenthesised (list) name node; Prolog accepts only clauses whose term is a binary_operation, i.e. rules and not bare facts. No C/C++ arm.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc says "kind alone answers it everywhere except Elixir", but the body carries eight language exceptions — the doc has not kept up with the lisps, OCaml, F#, R, Nix and Prolog.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `first_of_kind` — nearly — STALE
- read at `a646ff1d134e` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Iterates the node's named children one level down, no recursion, returning the first whose kind() equals `kind`, else None — likely `node.named_children(&mut node.walk()).find(|c| c.kind() == kind)`.
- found: `node.children(&mut node.walk()).find(|c| c.kind() == kind)` — the same search, but over ALL children including anonymous ones, not the named children the doc claims.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The doc says "first named child" but the body walks `children`, not `named_children` — harmless for the kinds currently passed, but the one word that distinguishes the two APIs is wrong.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lisp_head` — as expected — STALE
- read at `6710c07dc452` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Takes the list node's first named child and returns its source text as Option<&str> — node.named_child(0).map(|c| text(c, src)) — relying on the first named child's text being the symbol in every lisp grammar, so no per-grammar branching.
- found: Exactly that, with `?` on named_child(0) and a .trim() on the extracted text.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `name_node` — nearly — STALE
- read at `4b22191e94d9` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A match on Lang returning the naming node: default arm child_by_field_name("name"), with special cases for languages shaped differently — C/C++/ObjC walking the nested declarator chain to the identifier, the lisps taking the head symbol after the definer, JS/TS arrow consts reaching through the variable declarator, and a handful more each commented with why the common case yields nothing there.
- found: That shape, and far wider than I guessed: ~25 arms covering C/C++ and the C-family shaders (declarator walk), GDShader (bare declarator), ObjC (first identifier child, no fields at all), Dart and Julia (name via a signature node), SQL (object_reference), Elixir (arguments is a KIND not a field, then the call's target), R (lhs), Nix (attrpath), OCaml (pattern), F#/Elm (function_declaration_left), Clojure/Scheme/Racket/CommonLisp, Fortran/Ada/VHDL/Pascal (opening statement or specification), CMake (first argument), Verilog (same-kind wrapper with a fallthrough), Prolog (head functor), PowerShell, Odin/D. There is no TS/JS arrow-const arm — those go through the default `name` field. `lisp_head` is not used here despite being a sibling.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The C/C++ arm and the Glsl/Hlsl/Slang arm are byte-identical declarator walks kept as two separate arms, so a fix to one can silently miss the other.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `body_node` — nearly — STALE
- read at `46ed333d430d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Given a definition node and its Lang, returns the child node holding the body — probably a `body` field lookup with a `match lang` for languages that spell it differently or use a distinct kind, falling back to a kind search, and None for languages with no body node.
- found: A three-stage lookup. First an early-return match for languages that bind the function one level down (R via `rhs`, Nix via `expression`, Odin via nested first_of_kind, Prolog via `term`/`right`, GdShader's `block` field). Then the generic `body` field. Then a per-language node-KIND table (Kotlin function_body, ObjC compound_statement, Elixir do_block, Haskell match, Ada handled_sequence_of_statements, CMake `body` as a kind not a field, etc.), with the default arm handling `const Foo = () => {}` by hopping through the `value` field. Final line scans children for the chosen kind.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The one-line doc says only "the node holding the chunk's body" and gives no hint of the three-stage structure; the inline comments carry all the real explanation.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `body_span` — nearly — STALE
- read at `44ba09933dad` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Tries body_node(node, lang) first and returns that node's start_byte..end_byte; when the grammar has no body node it falls back to header_end(node, lang) as the start and the definition node's end_byte as the end, returning None if neither can be determined.
- found: Exactly that, plus one guard I did not name: the fallback span is only returned when start &lt; end, via `(start &lt; end).then_some(...)`, so a header that runs to the end of the node yields None rather than an empty or inverted span.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `header_end` — nearly — TRAP
- read at `12da39905fc3` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A match on Lang that, for the languages whose statements hang straight off the definition (Julia, Fortran, the lisps, Visual Basic), finds the last present header piece via child_by_field_name — return type, then parameters, then name, plus Elisp's docstring — and returns its end byte, returning None for every language that has a real body node.
- found: That, with a wider language list than I named (Verilog/SystemVerilog via tf_port_list, OCamlLex, Scheme/Racket, Clojure) and two mechanisms rather than one: field lookups for Elisp and Visual Basic, but `first_of_kind` kind-searches for Julia/Fortran/CommonLisp/Verilog/Clojure and bare positional `named_child(1)` for Scheme, Racket and Clojure's fallback.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The doc says "each of these is read off the grammar's own fields rather than by counting children", but Scheme, Racket and Clojure's fallback use `node.named_child(1)` — precisely the positional index the doc warns will silently start the body inside the signature.

### `extract` — surprising
- read at `678349bf1b07` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Given a tree-sitter node matched as a function kind, builds a FuncDef — name via name_node/lisp_head, owner from enclosing impl/class context, body extent via body_span/header_end, signature sliced from the header, start/end lines — returning None when no name node is found.
- found: That, plus a doc-extraction arm I did not predict at all, which is half the body: Python takes the first-statement docstring from the body node, Emacs Lisp takes a `docstring` FIELD and strips quotes, and everything else falls back to `leading_doc` then `wrapper_doc` — the latter walking out through `lexical_declaration` and `export` wrappers so exported arrow-function components are not read as undocumented. Signature is `start_byte..body_start` trimmed. `?` on name_node, body_span and both `src.get` slices is the None path.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: `extract` is the one function that decides what counts as documentation for every language, and it has no doc comment of its own — the per-language reasoning lives in inline comments only.

### `names` — as expected — STALE
- read at `41927d2f73c8` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test helper that runs parse_functions over src for the given Lang and maps the results to their names as Vec&lt;String&gt;, so tests can assert on name lists.
- found: Exactly that: parse_functions(lang, src).into_iter().map(|f| f.name).collect().
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `rust_functions_and_doc_comments` — nearly — STALE
- read at `04e3d8220d06` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A test parsing a Rust snippet with a ///-documented function plus an undocumented one, asserting parse_functions finds the right names and attaches the /// lines as docs with markers stripped, possibly also checking spans or plain // comments.
- found: That, with two extras I did not predict: an `#[inline]` attribute sits between the doc comment and the fn, so the test pins that attributes do not sever a doc from its function; and the undocumented fn contains a closure, with the len()==2 assertion carrying the message "closures must not become their own wedges". It also asserts the extracted signature string stops before the body.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Warm on parse.rs from the previous reading; also the test name mentions only functions and doc comments while the load-bearing assertion is about closures.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_blank_line_severs_a_comment_from_the_function` — as expected — STALE
- read at `f459376e878e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test parsing a snippet where a comment sits above a function separated by a blank line, asserting the extracted function's docs are empty so the comment is not attached across the gap.
- found: Exactly that, with an SPDX licence header as the comment and an inline comment naming the motivation ("otherwise every file's licence header documents its first function"); asserts `parse_functions(Lang::Rust, src)[0].doc.is_none()`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `typescript_arrow_consts_and_methods` — nearly — STALE
- read at `029a5677e652` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A parser test with a TS snippet containing an arrow function assigned to a const plus a class with methods, asserting extract/names finds both — an arrow const counting as a function unit despite being a variable declaration, and class methods carrying their class as owner.
- found: Close: a TSX snippet with an exported arrow const `Panel`, a plain `const NOT_A_FUNCTION = 42`, and a class method `load`. It asserts names() finds Panel and load and does NOT find the non-function const — the negative case is the real content. It then checks the JSDoc `/** The component. */` attaches to Panel with the comment markers stripped. It never asserts owner, which the prediction claimed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The name promises "methods" but the method case is one bare assertion that `load` appears; the test's actual weight is on rejecting a non-function const and on doc attachment, neither of which the name mentions.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `python_docstrings_are_the_doc` — nearly — STALE
- read at `695d4275a732` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A six-line test parsing a small Python snippet where a function's leading string literal is its docstring; asserts the extracted function's docs contain that docstring text rather than a preceding # comment, confirming Python's doc comes from inside the body.
- found: Exactly that, minimally: one def with a triple-quoted docstring, parse_functions(Lang::Python, src), asserts name == "go" and doc == Some("Runs the thing.") — i.e. the quotes are stripped. No # comment appears, so the contrast I imagined is not actually exercised.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Corrects a mis-set cold flag on my previous report of this id: this reading was cold. The name says docstrings are "the" doc — a claim of precedence — but the body never puts a # comment beside a docstring, so nothing here would fail if the comment won.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `go_methods_and_functions` — nearly — STALE
- read at `60356498a371` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A five-line test using the `names` helper on a Go snippet with a plain func and a pointer-receiver method, asserting both are found, the method attributed to its receiver type.
- found: Exactly that shape, but the assertion is on bare names only: ["Add", "Load"], so the receiver type S never appears in the expectation.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Second test in this file whose name says "methods" but which asserts bare names only — owner qualification is left entirely to the separate `a_method_is_qualified_by_the_type_it_hangs_off` test.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_method_is_qualified_by_the_type_it_hangs_off` — nearly — STALE
- read at `ec72aaab9a17` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test parsing a small Rust snippet containing two same-named methods in different impl blocks (the `parse` twins) and asserting each extracted function's owner is the type it hangs off, so twins stay distinguishable rather than collapsing to one bare name.
- found: Exactly that, and it covers three more cases in the same snippet: two `parse` twins in impl Tag / impl LogicalVolumeDescriptor, an `impl Read for Tag` method asserted to belong to the TYPE not the trait, a default method in a `trait Descriptor` owned by the trait, and a free-standing fn with owner None. It compares the whole Vec<Option<&str>> of owners in one assert_eq, so it also pins parse order.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The test's name promises only the twins case but it silently also pins the impl-Trait-for-Type rule and trait default methods, which are the two genuinely arguable decisions here.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `owners_across_the_languages_that_claim_one` — nearly — STALE
- read at `03ac0562d97e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A table-driven test with one snippet per language that has an enclosing type (Rust impl, Swift extension/class, Go receiver, Python class, TypeScript class, maybe Java/C++/Ruby), parsing each and asserting the function's owner string, plus that free functions get owner: None.
- found: A closure `owner(lang, src)` taking the first parsed function's owner, then six assertions: Python class, Swift struct, TypeScript class, Go pointer receiver (*S normalises to S), Go GENERIC receiver (Parser[T] must give Parser, not the type parameter T), and a Rust free function giving None. The generic-receiver case is a regression test with a comment saying it was found by a sanity reader predicting a doc that disagreed with the body.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Two of the six cases are Go receiver edge cases rather than a breadth sweep, and one carries a note that this repo's own tool found the bug — the test name reads as coverage but the body is mostly regression.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_nested_owner_names_its_whole_path` — nearly — STALE
- read at `0a5dd80599c9` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A #[test] that parses a Python snippet with nested classes (class Boolean: class Input: def as_dict) and asserts the extracted owner is the full dotted path like "Boolean.Input" rather than just the innermost "Input".
- found: Exactly that: parses a Python source with two outer classes (Boolean, Image) each holding an inner class Input with as_dict, asserts owners are ["Boolean.Input", "Image.Input"], then adds a second assertion that a singly-nested method's owner is plain "Suggester" with no trailing path.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `unparseable_input_yields_nothing_rather_than_panicking` — as expected — STALE
- read at `dd58ebb6de65` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Short test feeding garbage/truncated source (e.g. "fn ( { {") to parse_functions, asserting an empty result and no panic.
- found: Two asserts: parse_functions(Rust, "fn (((") is empty, and parse_functions(Go, "") is empty. Close to verbatim what I guessed, plus the empty-string case.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_nested_type_does_not_inherit_the_enclosing_docstring` — as expected — STALE
- read at `e8a8732ad160` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A 30-line Swift test: a snippet with a documented outer class containing a nested type and an undocumented init/method, parsed via extract; asserts the inner function's docs are empty, and probably also that a genuinely documented member keeps its own comment so the fix is not "never attach docs".
- found: Exactly that, and using the SentenceSuggester/Context example straight from the doc comment's story: parse_functions(Lang::Swift, src), a by(name) lookup helper, then asserts init.doc is None, untouched().doc is None (one level down), and next() still carries its own "next suggestion" doc.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `swift_functions_methods_and_inits` — nearly — STALE
- read at `29c96a23a8ba` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test parsing a Swift snippet with a free function, a method in a type, and inits, asserting extracted names — including owner qualification and that same-named inits do not collapse.
- found: A test over a Swift snippet with a doc-commented free func, a struct holding a method, one init and a static func, plus an extension method. Asserts the bare name list ["add","greet","init","make","extra"], that docs and signature come through for two of them, and that no name contains "extension".
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Despite the name promising inits plural, the snippet has exactly one init and asserts only bare names, so it exercises neither owner qualification nor the same-named-twin case its siblings cover.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `every_language_finds_its_functions` — nearly — STALE
- read at `d81ceea969c0` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A table-driven test: a Vec of (Lang, snippet, expected names), looping over each and asserting the parser extracts exactly those function names, one case per language.
- found: Exactly that — 54 (Lang, src, want) tuples covering C through Jq, then a loop calling parse_functions and comparing name vectors. The one detail I missed: it collects failures into a `broken` Vec and asserts once at the end, deliberately so all languages are checked rather than stopping at the first bad grammar.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `classes_are_not_chunks` — as expected
- read at `955da9aa2e4c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A test parsing a small class with a couple of methods and asserting the extracted functions are exactly the methods, with no chunk for the class itself, so its lines are not double counted.
- found: Just that, across two languages: Java `class Big` with two methods yields 2, and Ruby `class C` with one non-empty method yields 1 — with an inline note that an empty Ruby method has no body node and is dropped for having nothing to measure. It asserts counts only, never the names.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Second function I have read in parse.rs, so this one is warm; only counts are asserted, so a parse that returned the class instead of one method would still pass the Ruby half.

## src-tauri/src/reports.rs

### `data_dir` — nearly
- read at `9829d45acc79` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns SANITY_DATA_DIR if set (test seam), else dirs::data_dir() joined with a sanity subdir, None when the OS supplies nothing.
- found: Exactly that (subdir "Sanity"), and additionally creates the directory with create_dir_all, returning None if creation fails.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `index_path` — as expected — STALE
- read at `2d83a77f5ccb` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Calls the sibling data_dir(), propagates None with `?`, and joins a fixed JSON filename (something like index.json) onto it, returning the path load_index/save_index use.
- found: Exactly that: `Some(data_dir()?.join("projects.json"))` — one line, the filename being "projects.json" rather than "index.json".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `load_index` — as expected — STALE
- read at `134516bb5dcc` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads the JSON file at index_path() and deserializes into KnownProjects, swallowing read and parse failures and falling back to KnownProjects::default().
- found: Exactly that: index_path().and_then(read_to_string.ok()).and_then(serde_json::from_str.ok()).unwrap_or_default() — a three-link Option chain.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `save_index` — nearly
- read at `dbae2334cb7d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Serializes `index` to JSON, writes it to `index_path` with a `.tmp` suffix (after ensuring `data_dir` exists), then atomically renames it over the real file; on a failed rename it removes the temp file. All errors swallowed, no return value.
- found: Exactly that, minus the directory creation: early-returns if `index_path()` is None or `to_string_pretty` fails, writes to `path.with_extension("json.tmp")`, renames, and removes the temp only when the write succeeded and the rename failed.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

## src-tauri/src/scan.rs

### `git_root` — as expected
- read at `bfbf34880a2f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Runs `git -C path rev-parse --show-toplevel`, trims stdout into a PathBuf, and returns None when the command fails or the path is in no repo.
- found: Exactly that, with three separate refusals: spawn failure via ok()?, non-zero exit status, and an empty trimmed stdout guarded by (!root.is_empty()).then(...).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `repos_inside` — as expected
- read at `676bc5135f06` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Read the immediate entries of path; for each directory containing a .git entry, collect its file name; sort and return, empty vec if the directory cannot be read.
- found: Exactly that. It does not test is_dir explicitly — `e.path().join(".git").exists()` is false for a file entry anyway, so the filter subsumes it.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `not_a_repo` — as expected
- read at `1262c25954c2` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Builds the refusal string: says the directory is not a git repository, calls repos_inside, and if any are found names them (capped, with "and N more") suggesting one be opened instead; otherwise the bare statement.
- found: Exactly that, capped at three with " and N more", plus a shared `need` paragraph appended in both branches explaining why git is required.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `commit_count` — as expected — STALE
- read at `f4142c445220` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Shells out to `git rev-list --count HEAD` in the repo, parses the number, and returns 0 on any failure (no repo, no HEAD, unborn branch) rather than propagating an error.
- found: Exactly that, as a single option chain: Command git -C repo rev-list --count HEAD, .ok(), filter on exit status success, parse trimmed stdout, unwrap_or(0).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `collect_files` — nearly
- read at `424b1aa9b20c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Build an ignore::WalkBuilder over root with gitignore/hidden filtering, keep regular files whose extension maps to a Lang via Lang::from_extension, skip vendored/minified and unreadable entries, and collect the surviving (path, lang) pairs.
- found: That, with the exact filters spelled out: hidden, git_ignore, git_global, parents, and require_git(false) with a comment explaining that a non-repo tarball's .gitignore still counts. Files are dropped by extension/Lang, by size over MAX_FILE_BYTES, and by any path component (relative to root) appearing in VENDORED. Minification is not checked here — it is a size cap instead, so that must happen at parse time.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Not cold: I had read one other function in scan.rs earlier in this run, though not this one.

### `rel` — nearly — STALE
- read at `f6fcec444e0e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: strip_prefix(root) with unwrap_or(path) as fallback, lossy to string, backslashes replaced with forward slashes so a Windows scan yields the same relative path as a Unix one.
- found: Same shape, but it normalises by rebuilding rather than substituting: strip_prefix(root).unwrap_or(path), then map over components() to lossy strings and join with "/". That also drops any redundant separators or "." components, which a plain backslash replace would keep.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ephemeral` — as expected — STALE
- read at `fe19878ec192` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns a freshly constructed pair of non-persisting caches — an in-memory Cache and ScanCache::ephemeral() — to be borrowed as Memos, so nothing is read from or written to disk.
- found: One line: returns (Cache::ephemeral(), ScanCache::ephemeral()).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `scope_of` — as expected — TRAP — STALE
- read at `c6d23af04a47` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Looks for .sanityignore at the repo root, returns None if absent; otherwise builds a GitignoreBuilder rooted at the repo, adds that file, and returns the compiled matcher, with errors folded into None.
- found: Exactly that shape, except the return of b.add(&amp;path) — an Option&lt;Error&gt; — is discarded, so a .sanityignore that exists but cannot be read or parsed yields an empty matcher that excludes nothing, silently, rather than None or an error.
- predicted: full · documented: most · derivable: no · legible: full · trap: yes
- note: b.add's error is dropped, so an unreadable or bad .sanityignore silently scopes nothing and the denominator quietly widens — the file's own docs argue that scoping is a claim the map makes, which makes a silent no-op the wrong failure here.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `context_for` — nearly — TRAP
- read at `43105818287c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Builds the prompt context for scoring one function: the file's leading import/use lines, then the full bodies of a couple of sibling functions (nearest or first few), skipping index `skip` since showing the model the answer measures nothing; joined with blank lines, likely length-capped.
- found: That, starting from `file.head` (the precomputed preamble) and appending each sibling's signature followed by its body truncated to `CONTEXT_SIBLING_LINES`, for up to `CONTEXT_SIBLINGS` siblings. Two details differ from my guess: the bodies are line-capped rather than whole, and the siblings are the FIRST in file order rather than the nearest to `skip`.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: `.filter(...).take(CONTEXT_SIBLINGS)` means the function being scored gets a different sibling set depending on its own index — functions at index >= CONTEXT_SIBLINGS see siblings 0..N, but function 0 sees 1..N+1 — so the context is not constant across a file and the first functions are scored against a shifted window.

### `parse_file` — nearly — STALE
- read at `d6f273c9dd42` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Reads the file, computes a cheap key (mtime+len or hash), returns the cached ParsedFile on a match while recomputing fingerprints on the hit and skipping them entirely at Fidelity::Ordering; on a miss runs the tree-sitter parse for functions with signature/docs/body/lines, marks functions excluded by the .sanityignore scope, refuses minified/vendored blobs, and stores the result back.
- found: Close to that. A `print` closure computes fingerprints only at Full fidelity. `excluded` is computed per FILE (not per function) from the scope gitignore, deliberately never cached. `cache.look` returns Unreadable/Hit/Miss; a miss refuses lines over MINIFIED_LINE_BYTES and files with no functions, grabs the first CONTEXT_HEAD_LINES as `head`, and puts the parse. Returns ParsedFile with funcs, prints, head, hash and excluded. No vendored check here, and docs/signature extraction lives in parse_functions.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc covers the fingerprint-cache reasoning fully but says nothing about the two silent None returns (minified line length, zero functions), which are the surprising part of the control flow.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `apply_dir_history` — as expected
- read at `59c0254fdc87` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A recursive tree walk that, for Dir and File nodes alike, looks the node's own path up in the History's per-path distinct-commit map and writes it into the node's commits field (which aggregate left at 0), then recurses into children; Function nodes untouched and churn not touched.
- found: Exactly that, in ten lines: kind check for Dir or File, `score.commits = history.commits_of(&node.path)` if a score exists, then recurse over all children unconditionally.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs I was handed open with a paragraph that documents a different function ("Score every function in one directory", i.e. the `score_dir` peer) before the real doc begins — a preceding doc comment appears to have been absorbed into this function's stack, which charges every reader for it and misdirects the prediction.

### `score_dir` — nearly — TRAP — STALE
- read at `fd77e841b207` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Turns a directory's parsed files into map nodes: for each file, score every function with the heuristic proxy against its file-local peers (fidelity selecting how much ordering information the scorer uses), attach churn/age from history and authorship from blame for the stability axis, wrap the functions into a file Node with aggregated LOC, and return (relative path, Node) pairs, probably with rayon parallelism.
- found: Broadly that, plain sequential iterators rather than rayon. Three mechanisms I did not cover: (1) file-level churn/age/commits/last-touched/last-author are computed once per file but then OVERRIDDEN per function when blame can resolve that exact line range, falling back to the file's values when it cannot; (2) the peer set falls back to every fingerprint in the whole directory when the file holds only one function, and is empty at Fidelity::Ordering where distinctiveness is UNDECIDED instead of computed; (3) documented is heuristic::documented multiplied by Provenance::weight(), with a comment in the source always Source and never Human. It also stamps the node id as path#name@line and body as reading_hash(doc, body), and leaves file loc at 0 for aggregate() to fill.
- predicted: most · documented: none · derivable: no · legible: most · trap: yes
- note: It enumerates file.funcs but indexes file.prints[i], so funcs and prints are assumed to be parallel arrays of equal length and nothing here enforces it — a parser change that emits a print for only some functions panics on a real repo rather than scoring wrong.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `apply_model_scores` — nearly — STALE
- read at `a18a00e74148` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A recursive tree walk: at a Func leaf look the node up in `upgrades` and, if found, overwrite score.surprise with the reading's value and mark it analysed (source = model, analyzed share full), leaving `documented` untouched; otherwise recurse into children, with parent re-aggregation left to a separate step.
- found: Exactly that: on NodeKind::Func it looks up node.id, sets surprise, Source::Model and analyzed_share = 1.0 when a Score exists, and returns; otherwise recurses over children. One thing beyond the prediction and beyond the docs: it also copies the reading's `hotspots` onto the node, which happens outside the score guard.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Keyed on `node.id`, which embeds `@line`, so these upgrades are position-fragile in the way the repo's own key rules warn about — fine for a within-scan handoff, a hazard if the map ever outlives the scan.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `insert` — as expected
- read at `6b89f111df90` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Split rel_path on '/', walk down from root through each directory component creating a Node::dir with the accumulated path when one is missing, descend, and push node as a child of the final directory. Pure mutation, no scoring.
- found: Exactly that. It iterates parts[..len-1] with saturating_sub so a bare filename walks nothing, accumulates the prefix in `walked` to give each created dir its full relative path, matches an existing child on both name AND NodeKind::Dir (so a file and a directory sharing a name cannot collide), and pushes into the cursor at the end.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `collapse_chains` — as expected
- read at `372859bc858a` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Recursively descend; where a Dir node has exactly one child that is itself a Dir, merge the child up — join names with '/', adopt the child's children — and recurse.
- found: Exactly that. Recurses children first (bottom-up), then loops while the node is a Dir with a single Dir child: appends the child's name, takes over the child's id and path, and steals its children.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `scan` — nearly — STALE
- read at `4d28ffdf529b` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Top-level pipeline: walk root collecting files, parse in parallel with rayon, score with proxy plus model, firing on_progress per directory and on_scored per function while checking cancel. Then build the directory tree — collapsing single-child chains, aggregating widths into parents, scoring dirs — attach git churn/blame, apply .sanityignore exclusions, and return a Scan with tree, totals and a no-git-history warning.
- found: Collects files, groups them by parent dir in a BTreeMap (stable sibling order so before/after diffs stay readable), reads churn history, then parses everything first (honest denominator before progress starts), then blames only the files that parsed (cache keyed on the parse's content hash), prunes the scan cache to the live file set. Builds the whole grey proxy tree via score_dir + insert + collapse_chains (children only, never the root) + aggregate + apply_dir_history. Then, only if the model is a real model, reads the proxy surprises back off the tree, builds a Work list skipping anything already in the content-addressed cache, sorts by proxy intensity alone (deliberately not intensity × lines), runs the model in a rayon par_iter that short-circuits on cancel, streams on_scored/on_progress from inside the map, then folds cached + fresh readings in, re-aggregates and re-applies dir history. Finally counts functions, saves the scan cache and returns Scan with ScanStats.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The one-line doc covers only on_progress; the ordering decisions that dominate the body (BTreeMap for stable rings, parse-then-blame, priority by intensity not intensity × lines) are all carried in inline comments instead, and they read as the real documentation.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fixture` — nearly — STALE
- read at `60d889d6f8b2` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test helper creating a tempfile::TempDir with a small synthetic source tree — a couple of source files holding a few functions, probably nested a directory deep — returned so the surrounding scan tests have something to scan.
- found: Exactly that, plus the ignore case: creates src/deep/nest/a.rs with a documented `add` and an undocumented `sub`, then writes a .gitignore listing vendor/ and a vendor/huge.rs holding a function that must not be scanned.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ordering_fidelity_changes_the_score_and_nothing_else` — nearly — STALE
- read at `7981e7e01436` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Builds a fixture repo, scans it twice — once at Fidelity::Full, once at Fidelity::Ordering — then compares the two trees for identical structure (ids, names, line counts, nesting) while allowing only the surprise scores to differ, probably via a flattened id/lines list from each.
- found: Exactly that: `run(dir.path())` for the Full side, an explicit scan(..., Fidelity::Ordering) with ephemeral memos and no-op emit/scored closures for the fast side. Asserts stats.functions, stats.files_scanned and root.loc match, then a closure collects every Func node's id via root.visit, sorts, and asserts equality with the message "the tree must not depend on fidelity". The extra I did not predict is the final guard that the id list is non-empty, so an empty fixture cannot make the test pass vacuously.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The test never asserts the scores actually DIFFER between fidelities, so it would still pass if Ordering silently became Full — it pins only the half of its name after "and".
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `run` — as expected — STALE
- read at `2829c557e304` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test helper: calls scan::scan on the directory with HeuristicModel, no-op progress and reading callbacks, an unset cancel flag and ephemeral caches, and unwraps.
- found: Exactly that, at Fidelity::Full, with the ephemeral caches held in a local tuple `m` so they outlive the borrow inside the Memos struct.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Near-duplicate of agentapi.rs's `project_of` scan setup, which differs only in Fidelity and how the ephemeral caches are held.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `gitignored_paths_never_enter_the_picture` — as expected
- read at `ae7a09b435fc` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test building a temp repo via the fixture helper with a .gitignore excluding a path, scanning it, and asserting the ignored file's functions are absent from the tree while an unignored one is present.
- found: Exactly that shape: fixture() + run(), collects every node name via s.root.visit, asserts "add" present and "vendored" absent. The gitignore content lives in the shared fixture, so the test itself never shows what was ignored — the name "vendored" is the only clue, and it reads as if it could be testing vendoring rather than gitignore.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The test's claim about .gitignore rests entirely on the shared fixture; nothing in the body ties the missing "vendored" node to gitignoring rather than to the separate VENDORED skip rule, so it could pass for the wrong reason.

### `single_child_directory_chains_collapse_to_one_ring` — nearly — STALE
- read at `288b0132c0a1` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A nine-line test building a fixture with a nested single-child chain like a/b/c/file.rs, scanning it, and asserting the tree holds one directory node with a joined path name directly under the root rather than three nested rings — collapse_chains checked by walking to the root's single child and asserting its name and child count.
- found: Exactly that, using the shared fixture()/run() helpers: asserts root has one child, that child is named "src/deep/nest", and additionally that the root itself keeps the repo directory's own name rather than being folded into the chain.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `parents_are_exactly_as_wide_as_their_children` — nearly — STALE
- read at `a9b150d8ddd4` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test over a scanned fixture asserting the sunburst width invariant: every directory/file node's lines equals exactly the sum of its children's, checked recursively over the whole tree.
- found: Same invariant but NOT recursive or general: it hard-indexes root.children[0].children[0] to reach the one fixture file, sums its function children's `loc`, and asserts both that file's loc and the root's loc equal that single sum.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: The name promises a general invariant ("parents", plural) but the body checks one hand-indexed path in a one-file fixture, so a real nesting bug would pass it.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `documentation_is_graded_not_discounted` — nearly — STALE
- read at `eb17db31b620` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test scanning the same body with and without a doc comment, asserting the temperature is unchanged (docs reported, not subtracted) while the documented grade itself is non-zero for the commented version.
- found: Scans a fixture, collects every Func node's score by name, then asserts sub.documented == 0.0 and add.documented > 0.0, and finally that add.temperature() equals add.surprise. Notably it deliberately does NOT assert the two temperatures differ — a long inline comment explains the previous `add <= sub` assertion could never fail once the multiplier was removed, and that the real cooling now happens through the model's prompt and so cannot be asserted without a model.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The test carries no doc comment of its own, yet the most valuable thing in it is the inline explanation of an assertion that was deliberately removed for being unfailable.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_repo_without_git_says_so_rather_than_guessing` — as expected — STALE
- read at `da59b5f04c21` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Scans a temp directory holding source but no .git, and asserts the scan reports the missing history explicitly (a flag or warning) while churn/age fields come back None rather than zero.
- found: Exactly that, in four lines: `run(fixture())`, assert `s.stats.without_history`, then visit every node and assert each present score has `age_days == None`.</found> <parameter name="predicted">full
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `scanning_an_empty_directory_is_not_an_error` — as expected — STALE
- read at `e9061929436c` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Creates an empty temp directory, runs scan on it, and asserts it returns a tree (root node) with zero functions and zero lines rather than erroring or panicking.
- found: Exactly that, via the local `run` helper on a tempfile::tempdir(): asserts stats.functions == 0 and root.loc == 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/scancache.rs

### `ephemeral` — as expected — STALE
- read at `d4da713ca50b` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Constructs a ScanCache with no backing file — path: None or equivalent — and empty in-memory maps for parses, blame and touched paths, so look/put_* work for the run and save becomes a no-op.
- found: Exactly that: path None, a Mutex-wrapped Stored defaulted except for an explicit FORMAT_VERSION, a default Dirty tracker, and an empty head string (so no commit is claimed and blame can never be served from a stale HEAD).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `open` — nearly
- read at `8cf41f386c20` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Locates the cache file via path_for(repo), reads it with read_log, returns a ScanCache. On a format-version mismatch it discards everything and returns an empty cache. Compares cached HEAD against current git_head with is_ancestor; if history was rewritten it strips only the blame halves from each entry, keeping the parses, and records the new head.
- found: Exactly that, plus a detail I did not cover: read_log returns a line count alongside the parsed Stored, which is seeded into a Dirty struct (keys, lines, rewrite) so later saves can decide append-vs-rewrite. The ancestry check is also guarded by stored.head being non-empty and differing from head, so a first-ever cache and an unmoved HEAD skip the git call.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `path_for` — as expected
- read at `2ec067ad94a7` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Resolve the machine-local data directory (None if unavailable), join a subdirectory, and build a filename from an fnv hash of the repo path string plus an extension, avoiding any escaping of separators.
- found: Exactly that: reports::data_dir()?.join("scans"), create_dir_all (failure short-circuits to None), fnv over the lossy path bytes, filename "{id:016x}.json".
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `look` — nearly
- read at `e4fe1ced1eee` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Looks up rel_path's memo and decides hit/miss cheapest-evidence-first: no entry means miss; if last_commit and mtime/size match, hit without touching disk; otherwise read the file, fnv-hash the bytes, hit if the hash matches (touched-but-identical still hits) refreshing the stat, else miss carrying the freshly read source so the caller does not read twice.
- found: Structurally exactly that — two gates, mtime+len first then content hash, with `Look::Miss { src, ident }` handing the source back. One thing I got wrong: `last_commit` does NOT gate the hit at all. It gates only the BLAME half — a hit is returned either way, with `blame: None` when `e.blame_commit != want`, so a parse can be reused while blame is recomputed. `None` maps to an `ANCIENT` sentinel so out-of-churn-window files compare equal. Adds a third outcome, `Look::Unreadable`, for a file that will not read. Takes the mutex twice, once per gate.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The mtime+len fast path can serve a stale parse for a file edited within the same nanosecond-resolution stat and to the same length — vanishingly unlikely, but it is the same two-writes-share-an-mtime hazard `resync_changed` guards against, and here there is no length-change requirement beyond the pair matching.

### `cached_blame` — nearly — STALE
- read at `58ad3fd61376` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Looks up the cache entry for rel_path; returns the stored FileBlame (cloned) only if the entry's recorded content hash equals hash AND its recorded last-touching commit oid equals last_commit; otherwise None.
- found: Exactly that, via a mutex lock on self.inner (returning None if poisoned/absent), with `None` last_commit substituted by an ANCIENT sentinel constant before comparison, and the stored blame is itself an Option that is cloned out.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The docs explain WHY both conditions are required (revert-and-reapply vs uncommitted edit), which the code alone never states.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `put_parse` — as expected — STALE
- read at `e6972d6c60a0` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Locks the cache's interior map, builds an entry for rel_path holding the file identity (mtime/len/hash), lang, cloned FuncDefs and head commit, carries over existing blame only when still valid for this identity, inserts it, and marks the cache touched/dirty for save.
- found: Exactly that. Notable specifics: a poisoned lock is swallowed with an early return rather than panicking; blame and blame_commit are carried across only when the previous entry's content HASH matches (mtime/len are not consulted for that decision); the lock is explicitly dropped before calling self.touched(rel_path), which presumably takes it again.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `put_blame` — nearly — TRAP — STALE
- read at `729ece61e0d8` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Locks the cache, looks up the existing parse entry for rel_path, returns without storing if there is none, otherwise attaches blame and last_commit to that entry and marks the cache dirty for save.
- found: That, with three details not predicted: a poisoned lock is a silent no-op via let-else; a missing last_commit is stored as the sentinel ANCIENT rather than left absent; and the lock is explicitly dropped before calling touched(rel_path) — touched is the "dirty" marking and takes the lock itself, so the drop is load-bearing against deadlock.
- predicted: most · documented: most · derivable: no · legible: most · trap: yes
- note: `touched` is called unconditionally, including on the dropped-orphan path the doc describes, and the explicit `drop(inner)` before it is an unstated lock-ordering requirement — folding touched inside the if, or removing the drop, would deadlock or silently mark nothing.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `retain` — nearly
- read at `233fc784bd1d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Takes the set of paths present in the current scan and, via interior mutability (&self plus a lock), drops every cache entry whose key is not in `live` — several maps to sweep, and probably a dirty flag set when something is removed so a later save knows to write.
- found: One map, not several: a single `entries` map behind a Mutex, retained on live.contains(k). The dirty flag is there and is more specific than I guessed — it sets `rewrite`, because the on-disk store is an APPEND LOG whose entries can only say 'this key now looks like this' and therefore cannot express a deletion; so a removal obliges the next write to be a full rewrite. Both lock acquisitions fail silently via let-else / if-let on a poisoned mutex.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: A poisoned `inner` returns before anything is dropped, but a poisoned `dirty` silently loses the owed rewrite while the entries are already gone — the log would then keep describing files the cache no longer holds; harmless for a recomputable cache, invisible if it ever stops being one.

### `touched` — as expected
- read at `2ef91fea9d87` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Records the key in an interior-mutable pending/dirty set (Mutex, since it takes &self), and once the buffer hits a batch threshold appends those entries to the on-disk log and clears it, amortising writes.
- found: Exactly that: locks `self.dirty`, inserts the key, computes whether len >= FLUSH_EVERY inside the scope, drops the guard, then calls self.save() outside it. A poisoned lock returns silently.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: A poisoned dirty lock silently drops the key forever, so every later scan re-derives that file; agentapi::lock recovers from poisoning deliberately, this one does not.

### `save` — nearly
- read at `857143ba36c3` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Returns early if nothing dirty; otherwise appends one entry_line per dirty entry, or rewrites the whole file (header + every live entry) when the log has grown past a multiple of the live set. Ephemeral (no path) does nothing; IO errors swallowed.
- found: That shape, with more care than predicted: the rewrite branch is chosen by an explicit rewrite flag OR the COMPACT_RATIO/FLUSH_EVERY staleness test OR lines==0, and goes through a .tmp file plus rename so a kill mid-write cannot truncate the log. It also copies self.head into inner before writing, and the append path uses create(true) so a cache deleted underneath a live process is rebuilt. Dirty bookkeeping (lines, keys, rewrite) is only cleared when the write actually succeeded.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Inline comments record two real past bugs (truncated rewrite, append-to-deleted-file) — unusually good provenance for a cache writer.

### `header_line` — as expected — STALE
- read at `8cba76363339` · commit `9fe6ccf` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A one-liner serialising the cache header — schema version, git HEAD, maybe a timestamp — to a single JSON line for the top of the log, via serde_json on a small struct or inline json!, with unwrap_or_default since it cannot fail, and a newline depending on how the caller joins.
- found: Exactly that: `serde_json::to_string(&json!({"version", "head"}))`, `.unwrap_or_default()`, plus a trailing "\n". Only version and head, no timestamp.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The docs handed over describe the file's log format, not this function — graded none for that reason, though they did make the function easy to predict.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `entry_line` — nearly — STALE
- read at `d594d261cbb6` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Serializes one cache Entry plus its key into a single delimited line of the on-disk log format, the counterpart of header_line/read_log.
- found: Serializes {"k": key, "e": entry} as JSON via serde_json, falling back to an empty string on error, and appends a newline — JSONL rather than a delimited format.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: unwrap_or_default() turns a serialization failure into a bare "\n" line rather than an error, but with a plain Entry it cannot realistically fail.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read_log` — as expected — TRAP
- read at `33673673c939` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Parses the log into a Stored plus a line count: first line is the header (version/head), later lines fold in as entries keyed by path with last-wins overwrite; unparseable or trailing partial lines are skipped rather than fatal.
- found: Exactly that, implemented as JSONL: each non-empty line is parsed as serde_json::Value, index 0 read as {version, head}, the rest as {k, e} with e deserialised into Entry and inserted last-wins. Bad lines are `continue`d and do not count toward `lines`.
- predicted: full · documented: most · derivable: no · legible: full · trap: yes
- note: The header is identified by index 0 rather than by shape, so if a leading blank or corrupt line ever survives, the real header is parsed as an entry, silently zeroing version and head.

### `git_head` — as expected — STALE
- read at `929a94d7326e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Shells out to `git rev-parse HEAD` in repo, trims stdout and returns the SHA, returning an empty String when git fails, is missing, or the directory is not a repo — matching the infallible String signature.
- found: Precisely that, as a single Command chain: git -C repo rev-parse HEAD, .output().ok(), filtered on status.success(), stdout from_utf8_lossy trimmed, unwrap_or_default for the empty-string fallback.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Warm on the file: I read the append-log test in scancache.rs at position 3, though not this function.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_ancestor` — as expected — STALE
- read at `10aac5bb78d7` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Runs git merge-base --is-ancestor <old> HEAD in repo and returns exit-status success, with any spawn failure falling back to false so an unverifiable history fails closed.
- found: Exactly that: Command::new("git").arg("-C").arg(repo).args(["merge-base","--is-ancestor",old,"HEAD"]).output().map(status.success).unwrap_or(false).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The docs are technically derivable from the body, but the second sentence — that history.rs makes the same test before appending — is the part worth having and is not in the code.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fnv` — as expected — STALE
- read at `47eeb2f298bf` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: An eight-line FNV-1a-shaped hash: start from the 64-bit offset basis, XOR each byte in and wrapping-multiply by a constant that the doc admits is not FNV-1a's real prime, return the u64. A cheap content fingerprint for cache keys.
- found: Exactly that: basis 0xcbf29ce484222325, per byte XOR then wrapping_mul by 0x100000001b3 — which is the 64-bit FNV prime with a digit dropped (0x1000000001b3), the discrepancy the doc comment is about.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `func` — as expected — STALE
- read at `1e6ca5070df7` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test-module helper that builds a throwaway FuncDef with the given name and default/dummy values for everything else (line numbers, spans, docs empty, owner none), so cache tests can construct parse results without a real parse.
- found: Exactly that: a FuncDef with the passed name, a synthesised `fn {name}()` signature, a stub body `{ 1 }`, no doc, no owner, and start_line = end_line = 1.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `seeded` — nearly — STALE
- read at `cc7e05f796a3` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test helper: writes `body` to a file inside `dir`, constructs a fresh ScanCache, seeds it with a parse for that file (probably one node from the neighbouring `func` helper, keyed by the file's current identity), and returns the cache and path so a test can look it up and assert a hit.
- found: That, with the identity obtained rather than computed: it writes dir/a.rs, makes an ephemeral cache, calls cache.look() and destructures the expected Look::Miss to get the `ident` (panicking with "an empty cache must miss" otherwise), then put_parse with Lang::Rust, one func("one") and head "head".
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docstring describes what the tests do with the helper ("then look the file up again untouched") rather than what the helper itself does, which is only the seeding half.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_untouched_file_is_taken_from_the_cache` — nearly
- read at `2602aeabfc4d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test that seeds a ScanCache with an entry for a file, then looks it up again unchanged and asserts a cache hit serving the stored parse (and blame) rather than re-deriving.
- found: Exactly that: tempdir, `seeded(dir, "fn one() {}\n")`, then `cache.look("a.rs", &path, None)` must be `Look::Hit` whose first cached func is named `one`; anything else panics. Blame is not asserted.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `an_uncommitted_edit_is_never_served_from_the_cache` — as expected — STALE
- read at `7418d0021148` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A short Rust unit test using a `seeded` helper to build a ScanCache holding a parse for a file, then writing modified bytes to that file on disk (an uncommitted edit) and asserting the cache lookup is a miss rather than serving the stale parse.
- found: Exactly that: tempdir, `seeded(dir, "fn one() {}\n")` returning cache and path, `fs::write` appending a second fn, then `assert!(matches!(cache.look("a.rs", &path, None), Look::Miss { .. }))` with a message saying an edited file must miss even though nothing was committed.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `identical_bytes_with_a_new_mtime_still_hit` — as expected — STALE
- read at `318ba5b8ec2e` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test that seeds a ScanCache with a file, then re-queries with identical bytes but a bumped mtime; the (mtime,len) gate misses while the content-hash key hits, so it asserts the cached parse is still returned.
- found: Exactly that, with a realistic round trip: seeds with "fn one() {}", writes a two-function version, sleeps 20ms so the mtime genuinely differs, writes the original bytes back, then asserts cache.look() returns Look::Hit whose first func is named "one" and panics otherwise.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_reverted_and_reapplied_file_keeps_its_parse_and_loses_its_blame` — as expected — STALE
- read at `dfbc8d95c0d5` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A unit test seeding a ScanCache with an entry under one commit, then looking the same content hash up under a different commit, asserting the parse half still hits (bytes unchanged) while the blame half is None — so the file is re-blamed but not re-parsed.
- found: Exactly that shape: `seeded` builds a cache over `fn one() {}`, `put_blame` records blame under commit "aaa", then `look(..., Some("bbb"))` must return `Look::Hit` whose `funcs[0].name == "one"` and whose `blame` is `None`, with a `panic!` on any non-Hit. It adds one assertion beyond my prediction — a direct `cached_blame` call with the same content hash under "bbb" must also return None, so the miss is a property of the accessor and not just of the `look` path.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `on_disk` — nearly
- read at `224a3ef3a536` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test helper building a ScanCache backed by a real file on disk (not the ephemeral no-write variant), seeded with the given (path, contents) pairs so the append-only log format is actually written and read back.
- found: That, with the seeding done through the real API rather than by hand: opens the cache at repo, writes each file, asserts via a let-else panic that an empty cache MISSES (so a bad Look variant fails loudly rather than silently seeding nothing), stores a one-function Rust parse under the returned ident, then calls save() to flush the log.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The docs handed to me are two unrelated comments run together — the first paragraph ("A repo shrinks as well as grows...") is a neighbouring test's doc, not this helper's, so leading_doc has attached a preceding item's comment here.

### `saving_appends_rather_than_rewriting_the_whole_store` — as expected
- read at `1826dce6d90e` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Creates a cache in a temp dir, puts a handful of file entries calling save() repeatedly between them, then reads the on-disk log and counts its lines — asserting exactly one line per distinct file plus a header, regardless of how many saves happened, so the store grew by what changed rather than being re-encoded whole.
- found: Exactly that: one file via the `on_disk` helper, then b/c/d written and saved one at a time (destructuring `Look::Miss` and panicking if it hits, which doubles as a miss assertion), then `assert_eq!(lines, 5)` — header plus four entries. Adds a second assertion I did not predict: reopening the cache from disk yields 4 entries, so the appended log is not merely small but replays correctly.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The test never re-saves an EXISTING entry, so it does not actually exercise the O(n^2) failure it is named for — a rewrite-the-whole-store implementation that appends only new keys would pass it.

### `a_torn_last_line_costs_only_its_own_entry` — as expected — STALE
- read at `8d32c580398c` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Writes a cache with a couple of entries to a temp file, truncates the file mid-way through its last line (or appends a partial JSON fragment), reloads it, and asserts the earlier entries still load while only the torn one is lost — no parse failure costing the whole cache.
- found: Exactly that: seeds a two-file repo cache via `on_disk`, reads the cache text back, appends a deliberately truncated JSON entry line for a third file `c.rs`, rewrites the file, reopens with `ScanCache::open`, and asserts the entry count is still 2. Uses a scoped `data_home()` guard so the cache lands in a temp home.</found> <parameter name="predicted">full
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_dropped_file_does_not_come_back_on_the_next_open` — as expected — STALE
- read at `97cc1ed33932` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Seeds a cache with two files, saves it, calls retain with only one, saves again, reopens from disk and asserts the dropped file is absent — the save after a retain rewrites the log rather than appending, so the removal survives the round trip while the survivor is still a hit.
- found: Exactly that shape: a scoped data_home and temp repo, `on_disk` seeds a.rs and b.rs, retain keeps only a.rs, save, then ScanCache::open re-reads and the test asserts directly on the locked inner entries map — a.rs present, b.rs absent. It checks map membership rather than a cache hit, and does not verify the log was rewritten rather than appended.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `files_no_longer_in_the_scan_are_dropped` — nearly — STALE
- read at `7fd7de8141d2` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A unit test seeding a ScanCache with entries for two or more paths, calling retain with only the subset the current scan found, and asserting the omitted file's entry is gone while the retained one survives.
- found: Simpler: it seeds one file in a tempdir, calls retain with an EMPTY set, and asserts a subsequent look returns Look::Miss. There is no surviving-entry half — the test only shows that something dropped from the keep-set disappears, not that a retained one is kept.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The plural name promises a discriminating test but retain is only ever passed an empty set, so a retain() that dropped everything unconditionally would still pass.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/surprise.rs

### `min_lines` — as expected
- read at `55c143fc4803` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A trait method on SurpriseModel with a default body returning 0 — the shipped heuristic proxy is cheap and has no floor, so only implementations that do real (expensive) work override it with a real minimum line count.
- found: Exactly that: a three-line default returning 0.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `is_model` — as expected — STALE
- read at `6e15fcfcee77` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A default trait method on SurpriseModel returning false — the offline proxy is not a real model, so real model implementors override it to true.
- found: Exactly that: `fn is_model(&self) -> bool { false }` — a default returning false.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `label` — as expected — STALE
- read at `917badd7dfa9` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A trait-impl one-liner naming this scorer for display in output/UI — a fixed literal such as "heuristic" or "proxy" turned into a String, reading no state.
- found: Exactly that: returns "heuristic (no model)".into().
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `surprise` — as expected — STALE
- read at `4ad7588cda70` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: HeuristicModel's impl of SurpriseModel::surprise ignores the item and returns Reading::plain(proxy), passing the offline proxy through untouched with no scaling or calibration.
- found: Exactly that, a single line: Reading::plain(proxy).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `plain` — as expected — STALE
- read at `f17c052feff9` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A small constructor on Reading wrapping a bare surprise value into a Reading, with the remaining fields set to defaults or None.
- found: Exactly that — constructs Reading { surprise, hotspots: Vec::new() }.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `calibrate_surprisal` — as expected — STALE
- read at `6594a80197bd` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A three-or-four line mapping from bits-per-token onto 0..1: subtract a low anchor around half a bit, divide by the width of the interesting band up to a few bits, clamp to 0..=1 — a plain linear rescale with named constants, no curve.
- found: Exactly that, and the anchors are the ones I guessed: PREDICTABLE = 0.5, UNEXPECTED = 4.0, ((bits - PREDICTABLE) / (UNEXPECTED - PREDICTABLE)).clamp(0.0, 1.0).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc carries the one thing the four-line body cannot: that the band was measured on krapow with devstral, and that this is a choice of window rather than a distribution fit.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `predictable_code_is_cold_and_unexpected_code_is_hot` — nearly — STALE
- read at `9a2e92ab2932` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A short unit test asserting the direction of the metric: feed a low raw surprisal and a high one through calibrate_surprisal (or HeuristicModel::surprise on boilerplate vs unusual code) and assert the predictable input scores strictly lower. At five lines probably two calls and one comparison on synthetic numbers rather than real code.
- found: Three asserts on calibrate_surprisal alone: 0.2 saturates to 0.0, 9.0 saturates to 1.0, and 1.0 < 3.0 in between. Synthetic numbers as expected, but two of the three assertions are about the band's clamping endpoints, not the ordering.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The name says "predictable code ... unexpected code" but no code is involved: the body only exercises the calibration curve on three bare floats, so the property the name claims is not the one tested.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `the_heuristic_model_passes_the_proxy_through_untouched` — nearly
- read at `89aede2c4f28` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A unit test asserting HeuristicModel::surprise is a pure pass-through of the offline proxy: build a small function fixture, compute the proxy score via the heuristic module, run it through HeuristicModel, assert exact equality so the wrapper adds no scaling or calibration.
- found: It builds a trivial Item ("fn f()", empty body, no peers, no docs) and asserts HeuristicModel.surprise(&item, 0.73).surprise == 0.73 — the proxy is passed IN as an argument rather than recomputed, so the test checks the wrapper returns the caller's value unmodified. Nothing else about the returned Reading is asserted.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The docs handed over are the module's, not this function's, so they say nothing about the test.
