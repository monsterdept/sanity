# src-tauri — sanity assessment

606 of 615 read · 109 surprising · 2 stale

409 of these graded legibility under an earlier question and are not counted; see the note below.

Each entry below is one **reading**, of a function or of a whole file. An agent was
given its name, signature, neighbouring names and comments — never its body — and
wrote down what it expected to find. Then it opened the file. The gap between the
two is the finding. A file's own entry is titled `the file itself` and asks whether
the header at the top describes what is actually in there.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

`spec` is which version of the questions a reading answered. `legible` used to ask
"how clear is it on its own terms", which defined no rung but the top one; it now
asks what reading it was like — one pass, a second look, jumping around, or never
being sure. Grades from before that are kept here, because they are what a reader
said, but they no longer colour the map. Re-read those functions to replace them.

What this is and how to add to it: [README.md](README.md)

## src-tauri/build.rs

### the file itself
- spec 1 · read at `85fd5a79591b` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Standard Tauri build script: a main() that just calls tauri_build::build() to generate compile-time bindings/config.
- found: Exactly that, three lines, no doc comment.
- predicted: full · documented: none · derivable: yes · legible: not judged · trap: no

### `main`
- spec 1 · read at `4b8ff0908edc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Standard Tauri build script boilerplate calling tauri_build::build().
- found: Exactly that.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/agentapi.rs

### the file itself — STALE
- spec 2 · read at `6e4d194b3a19` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: The entire backend implementing the sanity agent-facing service inside a Tauri app: AppState (project loading, persistence, focus/touch), task-queue construction (collecting functions/files, spreading across files, batching, leases), the grading/report data model (Grade, Report, Tally, GradeCounts, aggregate/summary), an HTTP router (router/serve/health/endpoint) exposing these as the loopback API agents call, file-watch/rescan logic to keep tasks in sync with source edits, lock/lease semantics preventing double-claims, and a large embedded test suite (snake_case sentence-named tests) encoding invariants like rescan-mid-run safety and stale-reading expiry. The doc header only explains the philosophical motivation for the tool, not its structure.
- found: A single monolithic Rust file that is the whole loopback API/backend for sanity: AppState (project load/persist/focus/touch/lock), Task/Project/Report/Grade/Endpoint data structs, queueing and grading logic (all_tasks, default_batch, reading_curve, grades, surprise, documented), an axum Router exposing endpoints (router, start_run/stop_all_runs, restore, read_endpoint/release_endpoint), plus a large #[cfg(test)] mod tests block with sentence-named test functions encoding invariants. The doc header at the top is a philosophical justification for why the tool exists (predict-first-then-look), not a structural description of the file's contents.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `persist`
- spec 2 · read at `678296663940` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Loads the current on-disk KnownProjects index (via reports::load_index), then for each project currently held in this session's live map (self.projects), upserts a KnownProject entry (key, repo, name, touched, and current harness/model) into that loaded index — leaving entries for projects not in the live map (still restoring, or on a disconnected volume) untouched — and writes the merged result back to disk via save_index. Probably also records which project is 'active'.
- found: Loads the on-disk index, builds fresh KnownProject entries for each live project (key/repo/name/touched), carrying harness/model over from the existing on-disk entry (since AppState doesn't hold those in memory at all), removes any on-disk entries whose key is in the live map, extends with the live entries, conditionally updates `active`, sorts by most-recently-touched, and saves. Also has a test-only debug_assert guarding against writing outside a controlled data_home() in tests.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Assumed harness/model were carried from in-memory state; actually AppState never holds them at all, so they're read back from the on-disk entry being replaced — same outcome, different mechanism. Missed the test-safety debug_assert and the touched-sort entirely.

### `forget` — QUIRKY — TRAP
- spec 2 · read at `f08d4013e135` · commit `5ae2737` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:35Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Removes the project from self.projects by key, then also directly edits the on-disk index file (reads it, filters out the matching entry, writes it back) rather than relying on persist(), since persist only carries through entries this session hasn't loaded. Doesn't touch the repo's .sanity/ directory or its reports at all.
- found: Removes from self.projects and clears self.active if it matched, then loads the on-disk index, filters the entry and clears its active field too, saves it, and finally calls self.persist() — ordered after the index write specifically so persist's disk-merge doesn't resurrect the entry.
- predicted: some · documented: full · derivable: no · legible: full · trap: yes
- note: I predicted persist() was deliberately NOT called here to avoid resurrecting the entry, but it IS called — just ordered after the direct index edit, which is the opposite of what I expected and a real ordering trap for a future editor who reorders these two calls.

### `touch`
- spec 1 · read at `55fd28ba8d19` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Moves the project to the front of a history list/vector to mark recency, and persists; does not touch any active/focus flag.
- found: Increments a logical clock and stamps the project's `touched` field with it (rather than physically reordering a list), then persists. Ordering by recency is presumably derived elsewhere by comparing `touched` values.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Recency is implemented via a monotonic clock stamp on the project, not list reordering as I assumed.

### `focus`
- spec 1 · read at `082b08f3133b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Switches AppState's active project to key unconditionally if asked is true; otherwise only if there's currently no valid active project (vacant), then persists and returns whether it moved.
- found: Computes vacant = active is None or points to a project no longer in self.projects; if not asked and not vacant, returns false without changing anything; otherwise sets active to key, persists, and returns true.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `ping`
- spec 1 · read at `91298fd27435` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Records the call for the mascot UI: stores tool name and timestamp so recent activity can be reflected.
- found: Sets last_agent timestamp and last_tool, increments a pings counter, and pushes (pings, tool) into a bounded VecDeque `recent`, trimming from the front past RECENT_CALLS.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `most_recent`
- spec 1 · read at `cd9df96183b4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Finds the project with max touched timestamp among self.projects and returns its key.
- found: Exactly: max_by_key on p.touched, maps to key.clone().
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `for_client`
- spec 1 · read at `ba69fe737561` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: If project is Some(key), return it only if it's actually loaded (else None, never falling back); if None, fall back to the active/most-recent project.
- found: Exactly that: Some(k) => contains_key(k).then(|| k.to_string()), None => self.most_recent().
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Doc comment for this function is unusually thorough — full backstory of a prior bug — and the body is a one-liner that matches it precisely; a rare case where docs said more than the code needed and were still accurate.

### `owner_of`
- spec 1 · read at `43668cd9209d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Checks caller's own key for a live lease/scan match on id first, else searches all loaded projects for one holding id; None if none found.
- found: Checks asked-key project first, using it only if it actually holds the id (via leased map or holds_id in scan). Otherwise collects all projects holding the id, sorts keys for determinism, and on ties prefers the most-recently-opened project (falling back to alphabetically-first if the most-recent isn't among the candidates).
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `holds_id`
- spec 1 · read at `7b2894141274` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Looks up id in scan's collection of nodes (map/set) and returns whether present.
- found: Uses scan.root.visit with a closure accumulating OR over n.id == id, i.e. a tree walk rather than a map lookup, confirming the tree-based structure implied by the doc's mention of the tree.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `load_reports` — QUIRKY
- spec 1 · read at `fa12f19321c7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Reads and deserializes the .sanity reports file in the repo into a HashMap<String, Report>, with no legacy-store migration, returning empty on missing/parse failure.
- found: One-line delegation: crate::assessment::load(repo, scan). The actual loading/parsing logic (and the migration-avoidance behavior the doc warns about) lives in assessment::load, not here — this is just a thin named wrapper in the agentapi module.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The extensive doc comment about the destructive migration describes behavior in assessment::load, not in this one-line wrapper function itself.

### `save_reports`
- spec 1 · read at `8a688d237d03` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Writes reports into .sanity/ files for the repo and returns Err(String) with the I/O error on failure, no silent fallback location.
- found: Thin wrapper: delegates entirely to crate::assessment::save(repo, scan, reports), and on Err formats a message naming the assessment dir and warning the reading is held in memory but not saved — matches doc's 'no fallback, visible failure' intent exactly.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `project_key`
- spec 1 · read at `6a33b539f2ed` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Canonicalizes a path into a normalized string key so different textual forms (., ~/x/, /x) of the same project map to one identity.
- found: std::fs::canonicalize(path), falling back to the original path if canonicalize fails, converted to a lossy String.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `lock`
- spec 1 · read at `ca72bf09f016` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Locks the mutex and recovers from poison by unwrapping into the inner guard, returning MutexGuard directly rather than a Result.
- found: state.lock().unwrap_or_else(|e| e.into_inner()) — exactly that.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `surprise`
- spec 1 · read at `f4498e5794ce` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Match on Grade variants (Full/Most/Some/None) mapping to numeric surprise scores, non-evenly spaced with the two confident grades close together and a bigger gap before the uncertain ones.
- found: match self { Full => 0.08, Most => 0.30, Some => 0.62, None => 0.92 } - exactly the four-variant match I predicted, though I didn't guess the exact numbers (0.08/0.30/0.62/0.92, with the biggest gap between Most and Some rather than evenly distributed).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `documented`
- spec 1 · read at `aa3d2140395e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Maps Grade enum variant to numeric weight, full=1.0 most~0.66 some~0.33 none=0.
- found: Matches structurally but exact values are Full=0.95, Most=0.7, Some=0.35, None=0.0 — close but not exactly the even thirds I guessed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `blank`
- spec 2 · read at `4f2079eb951d` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:07:16Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Report with every field set to its empty/default value (empty strings for id and free-text fields, None for grade enums, false for booleans, zero/empty for timestamps and collections) so that callers like parsers or tests can start from a known-empty struct and fill in only the fields they care about, rather than needing every field named at each construction site.
- found: Exactly as predicted: every Report field explicitly set to its empty/zero/None default — strings empty, options None, bools false, spec 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `grades`
- spec 1 · read at `ff2b681f16b3` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns (predicted, documented) grades, mapping old surprised-bool reports to the scale's ends and forcing documented to None when derivable is true, regardless of the stored grade.
- found: Matches, but the derivable override sets documented to Some(Grade::None) — a real grade value meaning 'no documentation' — not Option::None, which I had conflated in the prediction.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `neighbours`
- spec 1 · read at `54267878d209` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns a window of names surrounding index i (excluding i itself) up to some fixed peer-window size, centered when possible but sliding toward the edges near the start/end of the list, plus a count of how many names were left out of the window.
- found: If the whole list fits within PEER_WINDOW+1, returns everyone except i with 0 omitted. Otherwise computes a start index (i minus half the window, clamped so the window doesn't run off the end via saturating_sub and min), slices out PEER_WINDOW+1 names, excludes index i, and returns the peers plus the omitted count (total minus self minus returned peers).
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `qualify`
- spec 1 · read at `eb82576b9d9d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Produce a language-idiomatic qualified name (Owner::name for Rust-like, Owner.name otherwise), returning name unchanged if no owner
- found: Matches on owner: None returns name as-is; Some(o) with lang in {Rust, Cpp, Php} formats as `o::name`; all other languages (including Ruby, deliberately excluded from the :: group per comment since Foo::bar means something else there) format as `o.name`
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `collect_tasks` — QUIRKY — TANGLED — TRAP
- spec 2 · read at `6f73f7f2eb61` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the scan tree Node, and for each function/file chunk not already present in `done` (already reported) or currently `leased` by another in-flight reader, builds a Task (carrying signature, peers, docs, and the propagated file_doc) paired with a priority/weight float (probably the surprise score), pushing (weight, task) into out; recurses into child nodes/directories, threading the current file's doc comment down to leaf tasks.
- found: Recursively walks the scan tree building (priority, Task) pairs into `out`. For a Func node: skips if leased and not stale, treats a done-but-stale (body changed since reading) reading as needing re-queue with priority boosted by +1.0 over a surprise-based base, builds a Task with empty peers (filled later). For a File node: similarly checks staleness/lease/non-empty children to decide whether to queue a whole-file task (priority from hot_share, all children as peers, no window truncation, special FILE_ASK), then recurses into children carrying its own doc down as file_doc, and afterward fills in each pushed task's `peers`/`peers_omitted` via a sliding window (`neighbours`) computed from full sibling name list in file order. Non-file/func nodes (directories) just recurse with file_doc reset to None.
- predicted: some · documented: none · derivable: no · legible: some · trap: yes
- note: Missed the core 'stale reports outrank unread' priority mechanic and the deferred neighbour-window backfill pass entirely in my prediction.

### `all_tasks`
- spec 2 · read at `2c3019c16f73` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper around collect_tasks — calls it with the scan's root, an empty reports map, and no leases, collecting into a Vec<Task> covering every function/file in the scan, used purely for measurement (e.g. token-cost analysis) rather than actual queue dispatch.
- found: Wraps collect_tasks with empty reports/leases maps over scan.root, discards the sort-key tuple element, and returns the flat Vec<Task>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `default_n` — OBSCURE
- spec 1 · read at `368876d2ad6b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns the constant 10, the batch size the doc argues for at length.
- found: Returns 1, not 10. The doc clarifies this is the size of ONE HANDOUT (one function per sanity_next call) — the "ten" is achieved by the protocol making ten separate calls, not by this constant. I inferred the wrong number from the doc's heavy emphasis on ten.
- predicted: none · documented: full · derivable: no · legible: full · trap: no
- note: Doc is entirely about justifying the batch-of-ten policy, which made it easy to assume default_n itself returns 10; it actually returns 1, since the "ten" lives in the calling protocol, not this constant.

### `priming_note`
- spec 1 · read at `46e73a09a277` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Detects whether the repo has agent instruction files; if none, returns None; if present, returns a hedged warning message asking the orchestrator to check its own context rather than asserting priming occurred.
- found: Calls crate::assessment::agent_docs(repo); if empty returns None, else returns Some with a formatted multi-sentence message instructing the orchestrator to check its own context, explaining what is and isn't evidence, and telling it to inform the human before the first wave if primed since relaunching with --setting-sources user is the fix.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `contract_note`
- spec 1 · read at `3ed19309ec38` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Compares sent fingerprint against this process's own contract fingerprint; returns a warning string if they differ, None if they match.
- found: Matches mine: returns None only when sent equals the current fingerprint. Some(f) not matching gives a 'DIFFERENT tool contract, restart your shim' warning. sent == None gives a different warning: the caller predates the contract-check field entirely and may be running an old schema, also suggesting a restart.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I assumed sent==None meant no warning; it actually still warns, treating an absent fingerprint as evidence of an even-older shim.

### `reader_prompt`
- spec 2 · read at `7fd06a5a552e` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:22Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns the reader-facing protocol string, substituting n (as digits) into a template like "assessing EXACTLY {n} THINGS, ONE AT A TIME," describing the predict-then-reveal-then-report loop and referencing sanity_next/sanity_reveal/sanity_report tool names.
- found: Formats and returns the exact reader protocol text (the same instructions I've been following this session), with n substituted verbatim into the "EXACTLY {n} THINGS" phrasing and the position range.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: This is literally the system prompt driving my own behavior right now, verbatim.

### `resolve_open`
- spec 2 · read at `d8c1137990ed` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Given an optional `asked` path string, this resolves which repo an /open call is about without letting an agent pick a repo the human never added. It compares `asked` (if given) against the set of projects already known to state (added via sanity init/check/or the window's Add project) — likely canonicalizing paths — and returns Ok(PathBuf) if it matches one of them. If `asked` is None, it probably falls back to the sole loaded project (or errors if there's more than one/none). If `asked` doesn't match any known project, it returns Err with a JSON value listing the candidate known projects so the caller/human can choose, rather than silently opening an arbitrary path.
- found: Matches asked path against both the persisted known-projects index and the currently-loaded in-memory projects; if it matches either, returns Ok. If asked is None: errors if zero known projects, returns the sole project if exactly one, and errors listing candidates if more than one (refusing to guess). If asked doesn't match anything known, errors with the candidate list too.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `open_project`
- spec 2 · read at `0f742f0447d4` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Async HTTP handler that takes a project path from OpenRequest, validates/canonicalizes it, scans the repo to build a function/file index, stores it in Shared state, and returns a JSON summary (counts of files/functions, possibly merging in prior .sanity/ assessment data). Likely handles error cases like invalid paths or re-opening an already-open project.
- found: Resolves/validates the project path, checks it's a git repo, marks it as "restoring" in shared state for UI visibility during the scan, runs the actual repo scan in a blocking task (using a persistent scan cache), then on success reloads reports/marks from .sanity/, refreshes the index, computes staleness/assessed counts, inserts the Project into shared state (dropping stale leases/predictions), and returns a large JSON response with counts, shape, warnings (contract/priming), agent docs, sanityignore guidance, and timing/protocol info for the calling agent.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: Far more elaborate than a typical "open project" handler — much of the body is about UI-visible progress during scan, rescan staleness semantics, and rich agent-facing guidance text embedded directly in the response.

### `scan_note`
- spec 1 · read at `229afd11d13f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns None if ms is under a threshold; otherwise returns a message explaining the scan cost, worded differently depending on whether the repo was reopened.
- found: Exactly as predicted: threshold 5000ms, returns None below it, else a formatted message about seconds taken, caching behavior, and a reopened-specific clause.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `work_left`
- spec 2 · read at `50ea69a7e68e` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes a WorkLeft summary for the project: total assessable tasks (functions/files) minus already-assessed and currently-leased/in-flight ones, giving a `remaining` count (and possibly other fields like total/assessed/in_flight) used elsewhere to report progress and to decide whether the queue is truly exhausted.
- found: Collects all unassessed tasks (ignoring current leases, so `remaining` counts unread work regardless of lease state), then separately computes which of those are currently leased and still within the LEASE window (in_flight), sorted by descending age, and returns WorkLeft{remaining, in_flight, outstanding} with the outstanding (id, age_secs) pairs.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I assumed remaining subtracted out leased work; it doesn't — leases only affect the separate in_flight/outstanding breakdown, not remaining itself.

### `each_unit`
- spec 2 · read at `d600b20192db` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:38:15Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the Scan tree (dirs, files, functions) and invokes f(&node) on every unit of work — function or file header — while carrying down an inherited exclusion flag so that nodes under a file excluded by .sanityignore are skipped entirely, matching the docs' explanation that exclusion is inherited and must be propagated by the walker rather than tested per node.
- found: Inner recursive walk() carries an out_of_scope flag ORed with node.excluded down the tree, calls f on Func/File nodes not out of scope, and recurses into children regardless (so exclusion still propagates to descendants of an excluded node).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The docs field handed to me actually describes count_stale/the stale-vs-unread distinction, not each_unit itself — a mismatched doc attribution, though its general point about inherited exclusion did happen to apply here too.

### `count_stale`
- spec 2 · read at `c12c49939974` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T17:01:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over `reports`, and for each report checks whether the corresponding item in `scan` still matches what was recorded (e.g. a stored hash/line-range no longer matching the current file state), incrementing a counter for each mismatch. Returns the total count of reports that are now stale relative to the current scan.
- found: Iterates every unit (function or file) in the scan via each_unit, and for each one that has a report, uses crate::assessment::is_stale to check if the report's recorded body no longer matches the current node body, counting mismatches.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `assessed`
- spec 2 · read at `6a41aa605702` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T17:01:43Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks the project's scan tree (files/functions), and for each node looks up its report and checks it's not stale (via something like is_stale), counting those with a still-valid reading — mirroring count_stale but counting the complement, walking live scan nodes rather than the reports map so deleted/moved functions can't inflate the count.
- found: Uses each_unit to walk the live scan tree; for each node with a report present, counts it if is_stale returns false. Matches prediction closely, using each_unit instead of manual recursion.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs explain the design rationale (why walk the scan not the reports) extensively but don't literally restate the one-line body; still very helpful context, counted as most not full since the actual `is_stale` call signature wasn't guessable in detail.

### `offline_counts`
- spec 2 · read at `db7397486cf8` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:41:53Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds an OfflineCounts summary struct by combining the Scan (all discoverable functions/files) with the reports map (what's been assessed so far) — computing totals like total functions, total files, how many have been assessed/reported, and possibly how many are stale, mostly via .len() and iterator counts over the scan and reports.
- found: Builds an OfflineCounts struct: counts total functions/excluded via count_funcs, counts files separately (not folded into functions, per comment), counts assessed by iterating units and checking reports for a non-stale report, counts remaining via a separate collect_tasks pass producing an unread list, and counts stale via count_stale.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `unread_lines`
- spec 2 · read at `884bc1516061` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:08Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Iterates the project's functions, filtering to those that are unread or whose reading is stale (mirroring count_stale/assessed's logic), and sums each one's line count (end_line - line, or a stored `lines` field), skipping file-level entries entirely to avoid double-counting. Returns the total as usize.
- found: Recursive tree walk over the project's node tree, respecting an `excluded`/out_of_scope flag inherited from ancestors, summing `node.loc` for Func nodes whose report is missing or stale (via assessment::is_stale), skipping non-func nodes by recursing into children.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Got the overall shape (sum loc of unread/stale funcs) but missed the recursive tree-walk structure with inherited exclusion scoping — I expected a flat iteration.

### `count_funcs`
- spec 1 · read at `7b3363869ffa` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns (in_scope_count, excluded_count) of functions in the scan, per the doc's insistence both numbers always travel together.
- found: Recursively walks the scan tree, propagating an inherited out_of_scope/excluded flag down to descendants, and tallies func nodes into kept vs dropped accordingly; returns (kept, dropped).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `count_files`
- spec 1 · read at `0bf1cef3d458` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Counts files eligible as their own reading unit vs excluded ones, mirroring count_funcs but at file granularity, filtering files with no declarations.
- found: Recursively walks the scan tree; for File nodes with at least one child (declaration), increments 'kept' unless the file or an ancestor dir is excluded, in which case increments 'dropped'. Returns (kept, dropped).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `shape_of`
- spec 1 · read at `453b5df49bf7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Groups functions by top-level directory, counting them (and excluded ones), returning per-dir JSON objects for the shape field.
- found: Confirmed: recursive walk keeps a BTreeMap of top-level dir -> (kept, excluded) counts, sorts descending by total, takes the top 15, and emits {dir, functions, excluded} JSON objects.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `interleave_by_file`
- spec 1 · read at `52681135f9b4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Sorts tasks by descending score, groups by file, round-robins across files taking each file's next-best candidate per pass, until n items collected, so results aren't clustered from one file.
- found: Sorts descending by score, buckets into by_file preserving first-seen file order (so files stay ordered by their strongest function), then repeatedly does a pass taking index `round` from each file bucket in order, appending until length n or no bucket has anything left at that round.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `mark_of`
- spec 1 · read at `c13c189db655` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Stats repo.join(rel_path) and returns Some((modified_time, len)) or None on failure.
- found: Exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `resync_file`
- spec 1 · read at `04ce80873340` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Re-parses rel_path, finds the file node, reconciles children by key_of(path,name,ord), updates position/signature/docs/hash keeping id, drops missing functions, doesn't add new ones, returns bool for whether something changed.
- found: Finds the file node via recursive search, re-parses functions keyed by (name, ordinal), refreshes file doc and file's own reading_hash from fresh bytes, then retain_mut over children matching by (name, ordinal) to update line/end_line/loc/signature/doc/owner/body-hash, dropping unmatched (deleted) functions and not adding new ones. Returns bool as a success/found flag (false on file-not-found/no-lang/read-failure), not a 'did anything change' flag.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: Return bool means 'succeeded' not 'changed something' — a subtle mismatch from my prediction.

### `stamp_marks`
- spec 1 · read at `fe22a15ea032` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks the scan tree, and for each file computes a fingerprint (mtime + hash/size) at scan time, returning a HashMap of path to that mark, used later to detect files that moved.
- found: Walks scan.root via visit(), and for each File node calls mark_of(repo, path) to get the (SystemTime, u64) mark, inserting it into the output map when present. The actual fingerprinting logic lives in the mark_of helper, not here.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The file_doc explains WHY marks must be stamped at scan time (the resync_changed bug), not what stamp_marks itself does mechanically — good context but not a spec for this function's body.

### `resync_changed`
- spec 1 · read at `c557041e903a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Detects files changed since last scan (mtime/hash) and re-cuts their ranges via resync_file, returning a count.
- found: Visits all File nodes, looks up a (mtime,size) mark per path, updates project.file_marks via insert-and-compare-old-value to find which paths' marks changed, resync_file()s each, then re-runs aggregate() on the tree root so parent roll-ups reflect the new sizes, returning the count of changed files.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Docs (file-level) explain WHY this exists relative to the file watcher (must not race a reading in flight) but the doc block attached to this function is actually describing the surrounding subsystem rather than this body specifically.

### `spread_across_files`
- spec 1 · read at `60f93358437e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Prefer tasks from files not recently touched, using a recency threshold against the `recent` map, falling back to recently-touched files only when not enough rested ones exist to fill n
- found: Partitions tasks into fresh (file untouched or touched longer ago than FILE_REST) vs resting (touched within FILE_REST), uses fresh unless empty then falls back to resting, and hands the chosen set to interleave_by_file(_, n) to do the actual spreading/selection
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Correctly guessed the rested-preferred-not-forbidden fallback, but the mechanism is a clean binary partition against one FILE_REST constant plus delegation to interleave_by_file, not a graded recency penalty

### `queue`
- spec 2 · read at `93093fdc47ba` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Backing handler for sanity_next: reads QueueParams (likely a count `n`), selects that many not-yet-assessed tasks (functions/files) from the shared project state, using helpers like spread_across_files/interleave_by_file to distribute picks across files rather than clustering in one, marks them as issued/pending, and returns them as a JSON array of Task. May also trigger a resync of changed files before selecting.
- found: Handles the sanity_next loopback call: resolves the client's project, marks it active, resyncs any changed file ranges before ranking (explicitly to avoid handing out stale line ranges), collects candidate tasks, picks a spread via spread_across_files (avoiding recently-hit files) honoring the count from QueueParams, leases the chosen tasks and records recent-file timestamps so concurrent callers get different work, logs each handed-out task under a qualified name (owner::name or path for files), and pings a distinct "sanity_next:done" event when both nothing was handed out and no work remains, versus a plain "sanity_next" otherwise.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: File-level doc explains the rationale (predict-first, why an agent not a scoring backend) but there's no per-function doc; missed the multi-caller leasing/logging details in my prediction.

### `reading_curve`
- spec 2 · read at `2c2bd3620c6c` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds the reading queue for the project at `key` as if a fresh run were starting now (ignoring active leases and recent_files, per the docs), then walks it in BATCH-sized chunks, summing each function's line count and accumulating a running total across chunks. Returns a Vec<u32> where each entry is the cumulative lines handed out through that many BATCHes, for the Read dialog's lines-vs-tokens bar comparison.
- found: Collects all tasks for the project, orders them via spread_across_files (ignoring leases/recent_files by passing empty maps and no exclusion), then accumulates line counts, pushing a cumulative total at every BATCH boundary plus the final tail entry.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `start_run`
- spec 2 · read at `b44f62c18769` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Starting a "check" run: given a CheckRequest and shared state, it likely creates a new run record in Shared, kicks off some background/async work (spawning the actual scoring process or agent loop), and returns a JSON value describing the started run (e.g. an id/status) rather than blocking for completion.
- found: Validates project/harness/model/backend preconditions (returning structured ok:false errors with hints for each failure mode: no project, run already in progress, no harness configured/available, no endpoint), resolves the model with a specific fallback order, registers a new Run in shared state, then spawns the async run_wave via a runtime-agnostic `detached()` helper (not raw tokio::spawn, since this must be callable from a sync Tauri command without a runtime) and returns a JSON status describing the started run.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Didn't anticipate the extensive validation/error-path logic (already-running check, harness availability, endpoint check) or the runtime-agnostic detached() spawn requirement — I predicted background work + status JSON but missed the guard rails and the sync-callable constraint.

### `stop` — QUIRKY
- spec 2 · read at `67720eec2400` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Sets a cancellation flag on the project/run state (looked up via params), then kills any currently-running reader child processes for that project, and returns a JSON acknowledgment (likely {"ok": true} or similar status).
- found: Resolves the project by client key, and if there's an active (unended) run, sets its atomic `stop` flag to true; returns JSON with ok and whether a run was actually found and flagged. Does not itself kill any process — the doc says run_wave is what notices the flag and kills the reader.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Docs describe stop as killing readers, but this function only flips an atomic flag; the actual kill must happen in run_wave's poll loop.

### `detached`
- spec 2 · read at `f2536bd31875` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Checks for a current Tokio runtime via Handle::try_current(). If one exists, spawns the future on it with handle.spawn(fut). If not, spawns a new OS thread that builds a fresh runtime and calls block_on(fut) on it, so the function never panics regardless of caller context (HTTP handler vs synchronous Tauri command).
- found: Tries Handle::try_current(); if a runtime exists it spawns fut on it. Otherwise spawns a new OS thread, builds a current_thread runtime, and block_on's the future there; if the runtime fails to build, it just eprintln's and gives up silently (no fallback, no panic).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `run_wave` — QUIRKY — TANGLED
- spec 2 · read at `89a0dcaac9f2` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:22Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: An async orchestration loop that maintains up to `width` concurrently-spawned reader agents (likely via a JoinSet/FuturesUnordered), pulling functions to assess from a shared queue, decrementing `limit` and updating the `live` atomic counter as readers start/finish. It loops spawning new readers whenever a slot frees up and work remains, checking the `stop` flag each iteration, and includes a safeguard to break out if the queue stops shrinking while nothing is in flight (a broken harness exiting instantly without doing work), rather than spinning forever.
- found: Writes reader config to a scratch dir, then loops: checks stop flag, computes remaining/in_flight work, sizes a wave of tokio::spawn'd reader processes (capped by width, limit, and remaining), spawns each with stderr draining on a separate task and a select! loop that polls stop every 250ms to kill mid-flight, updates run stats (spawned/finished/failed/failures) after each wave, tracks 'barren' waves that bank nothing and aborts after 3, then clears leases and records the end reason.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Correctly predicted the width-bounded spawn loop with stop-flag and queue-exhaustion checks, but missed the barren-wave abort heuristic, stderr draining to avoid pipe deadlock, the config-writing preamble, and lease cleanup at the end — substantial real logic beyond the core loop.

### `rescan`
- spec 2 · read at `f09def59c347` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:43:09Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds a new Project from the fresh scan/reports, but if prev is Some, copies over the volatile in-progress state (predictions, leases, the active run) keyed by node id via key_of so they survive across the rescan rather than being wiped, since node ids are stable across code moves.
- found: Constructs a new Project from repo/name/scan/reports plus freshly computed file_marks and watch marks, carrying forward leased, recent_files, predictions, run, events, touched, and last_agent from prev (defaulting empty/None if prev is None), and increments the scanned counter (rather than setting a constant) so the window's change-detection fires on every rescan.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that several more fields besides predictions/leases/run get carried forward, and the increment-not-set detail on `scanned`.

### `note`
- spec 2 · read at `6e0184e00ac2` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:32Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Pushes a new entry (stage, name, path, and maybe a summary derived from `found`) onto a fixed-capacity activity log (likely a VecDeque or Vec) on `self`, and if the log exceeds some maximum length, pops/removes the oldest entry to keep it bounded. This log is presumably what powers a UI "agent activity" feed showing recent function assessments going out and coming back.
- found: Assigns a sequence number, extracts predicted/documented/legible/derivable grade fields out of the optional Report (with a special rule to hide `legible` if it's marked dated), pushes an Event onto a VecDeque, then trims from the front while over EVENTS_KEPT capacity.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The one-line doc covers the ring-buffer behavior but not the grade extraction or the legible_dated suppression rule, which is where the real logic is.

### `recent_model`
- spec 2 · read at `7f9da50f6140` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:07:49Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Iterates the project's reports, filters to those with a non-empty `when` timestamp, picks the most recent by that timestamp, and returns its `asked` field (falling back to `model` if `asked` is empty) as the suggestion for what to request next. Returns None if there are no dated readings at all.
- found: Matches prediction: finds the report with the max `when` (lexicographic = chronological), returns `asked` falling back to `model`, trimmed. I missed the final `.filter(|m| !m.is_empty())` that turns an all-blank result into None rather than Some(\"\").
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `suggested_model` — QUIRKY
- spec 2 · read at `3a95d26d7740` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:48Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Given a project and a key (likely repo path/id), returns the corpus's recorded "asked-for" model by delegating to recent_model on the project's stored readings — so a repo's own assessment history takes precedence over any local/laptop preference — returning None (harness default) if no prior run recorded one.
- found: Falls back through three sources in order: recent_model(p) (last run's asked-for model), then one_model(p) (presumably a single model if the whole corpus only ever used one), then crate::reports::model_for(key) (some other stored/keyed preference), returning None if none apply.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I only predicted one fallback step (recent_model then None); missed the one_model and reports::model_for(key) links in the chain.

### `model_tally`
- spec 2 · read at `2456bc4d7ccf` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:08:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Tallies how many reports were taken by each distinct model across the project, building a Vec<ModelCount> (model name + count), likely sorted by count descending so the UI can show a breakdown of "how many readings by which model" — the multi-model counterpart to one_model's single-agreed-value check.
- found: Matches prediction: counts reports per distinct non-empty model into a HashMap, converts to Vec<ModelCount>, sorted by count descending. I predicted the descending sort but missed the secondary tie-break by model name, added specifically to keep ties from reshuffling on every poll.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `one_harness`
- spec 2 · read at `f2ee638f9162` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:07:58Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Collects the distinct non-empty `harness` values across the project's reports; if there is exactly one, returns it wrapped in Some, otherwise (zero or more than one distinct value) returns None rather than picking a majority.
- found: Exactly as predicted: walks reports, tracks the first non-empty trimmed harness seen, returns None the moment a differing value appears, else Some of the single agreed value (or None if none were non-empty).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `one_model`
- spec 2 · read at `d74050c41550` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Scans a project's recorded assessments/reports and checks whether they were all produced by the same model (the `model` field in reports). If all entries share one model string, returns Some(that_model); if they differ or none is set, returns None. Used to label a run's model only when unambiguous.
- found: Iterates p.reports, skips reports with blank model strings, tracks the first non-blank model seen, and returns None as soon as a differing model is encountered; otherwise returns Some(shared model) or None if no reports had a model set.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `drop` — QUIRKY
- spec 2 · read at `5a9ffd6b98d7` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: LiveGuard is an RAII guard for an in-progress wave/run; its Drop impl marks the run as ended (e.g. sets project.run's ended timestamp or similar) so that even if the run task exits early/panics, status no longer reports it as still running.
- found: Decrements an atomic counter (self.0) by one on drop — a simple RAII "live count" tracker, not a timestamp-setting guard.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: I offered 'decrement a live counter' as a secondary guess but led with a more elaborate 'sets ended timestamp' theory that was wrong; the real body is a one-line atomic fetch_sub.

### `assessed_now`
- spec 2 · read at `5ddb6ef8f3a2` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:43:20Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Looks up the project by key in state, iterates its reports map, and counts entries that are not stale (using the same staleness check aggregate_of relies on), returning that count as a usize; returns 0 if the project isn't found.
- found: Locks state, looks up the project by key, and delegates to a separate `assessed()` helper on the Project, defaulting to 0 if the project isn't found.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Implementation is a one-line delegation to an `assessed` helper not in my visible peer list, rather than inline filtering logic.

### `reveal`
- spec 2 · read at `d47bab48e3aa` · commit `5ae2737` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:41Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the task/lease for req.id in shared state; if no live lease exists for that id, returns an error/refusal JSON rather than serving anything. Otherwise records req.expected as the prediction on that lease (only once — a second call must not overwrite it), calls resync_changed to re-cut the task's line extent against the current file content (since edits may have happened since the scan), then reads and returns the source slice: the whole file for a file task, or just the function's lines otherwise, wrapped in a JSON value with path/line/end_line/source fields.
- found: Resolves the project by client/session, then by the task's owning project key (not just the shim's current key), refuses if no live lease is held for the id, calls resync_changed to re-cut the extent, reads the file from disk, slices out the function's lines (or whole file), records req.expected as the prediction via entry().or_insert_with (so a second reveal cannot revise it), and returns the source as JSON — with detailed error/hint messages at each refusal point.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `mangled`
- spec 1 · read at `54a1cc9e8a4a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Detects a truncated/mangled tool call by checking for a missing grade field alongside leaked XML tag fragments in the prose fields, returning a hint string when detected.
- found: Returns None immediately if predicted/documented/legible are all present (leak check skipped entirely then); otherwise scans expected/found/note for literal `</parameter>`, `<parameter name=`, or a self-closing tag matching the field's own name, returning Some(field_name) — not a full message — identifying which field leaked.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `report` — QUIRKY — TANGLED
- spec 2 · read at `1eb88aab7db4` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:17Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The axum handler backing the sanity_report MCP tool: it takes the ReportRequest (id, predicted, documented, derivable, legible, trap, cold, position, primed, model, found, note), looks up the pending in-flight assessment for that id, validates it matches a prior reveal, builds a Report struct and stores it in the project's persistent state (likely serialized to disk), calls something like Project::note to log the event into the recent-activity ring buffer, updates aggregate grade tallies, and returns a JSON acknowledgement with fields like ok, remaining, saved, project, repo, in_flight, hint — mirroring what earlier report calls returned in this conversation.
- found: Validates the request isn't "mangled" (a field carrying the rest of the call, dropping grades), resolves the id to its owning project via a session-scoped key rather than trusting the caller, stamps provenance fields (body hash, spec version, author, commit, timestamps, agent_docs) itself rather than trusting caller-supplied values, logs the event, inserts the Report, writes through to disk immediately, and returns an ack JSON with per-repo aggregate stats (total/surprised/warm) plus a coaching hint if the repo-wide surprise rate looks implausibly low or the write failed.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: The body is dense with inline comments explaining *why* (self-certification risks, prior failure modes like silently discarding unmatched ids) rather than a doc block — none of that context was in the docs field I was given, only inferable after reading the source.

### `status`
- spec 2 · read at `8a8ef907e296` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: An axum handler that resolves the specific project named in the query params (not the globally "active" one, per the doc's history of that bug) and computes a progress summary for it: counts assessed vs total functions, aggregates grades/tallies (using GradeCounts/Tally/aggregate helpers), reports the recently-used or suggested model, and returns it all as JSON including repo and active fields so a caller can tell whether the subject matches what it asked about.
- found: Axum handler resolving the caller's own project by key (not "active"), returning a large JSON status: function/file counts, assessed/remaining/in_flight/outstanding leases, stale readings, refused reports, suggested model/harness, current run state (spawned/finished/failed/stopping/live), and a human-readable "next_step" hint telling a driving agent whether to wait or spawn another wave. Falls back to an "open: false" response with a hint distinguishing "not loaded yet, transient" from "nothing open" when the project isn't resolved.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Correctly predicted the key-scoping fix and general aggregate-status shape, but missed the run-state block, outstanding-lease listing, and especially the generated next_step guidance text aimed at a driving agent.

### `add`
- spec 1 · read at `5fc70728b6d5` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Matches on Option<Grade>, increments corresponding named counter per grade variant, increments a separate ungraded counter for None.
- found: Exactly that: full/most/some/none counters per Grade variant, plus ungraded for None.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `add` #2
- spec 1 · read at `69fb7ab175b0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Folds one Report into a running tally: increments count, updates grade-distribution counters (delegating to a GradeCounts-like add), and tracks other summary stats like derivable/cold/trap counts.
- found: Increments readings, adds predicted/documented grades via self.predicted.add/self.documented.add, adds derivable/traps/cold as usize counts, and adds legible only when the spec's legible question is still current (filtering stale legible grades to avoid the aggregate disagreeing with the map's own display logic).
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: Legible is filtered through legible_current(r.spec) so a superseded question's grade is excluded from the aggregate rather than counted — a subtlety not obvious from the signature alone.

### `aggregate`
- spec 2 · read at `ecaf4c953547` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:35Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin one-line wrapper that delegates to aggregate_of, passing the project's root tree/nodes, to compute the whole-project rollup Aggregate (grade counts, heat, etc.) rather than doing any computation itself.
- found: A one-line delegating wrapper that calls aggregate_of(&project.scan, &project.reports) to compute the project-wide Aggregate.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `aggregate_of`
- spec 2 · read at `b517577061f9` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:38:11Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Rebuilds the same Aggregate (total/by_model/by_position/priming) that `aggregate(project)` produces, but from a raw Scan + reports HashMap rather than a Project, so a caller without a live Project (e.g. the CLI's offline path) computes identical numbers via the same Tally/GradeCounts::add folding, skipping stale reports.
- found: Iterates function nodes via each_unit (honoring .sanityignore), skips ones with no report, buckets stale ones separately, folds the rest into total/by_model (with an "unattributed" bucket for blank model) and a three-way priming split (not_applicable/exposed/clean) plus by_position keyed by position number with an unrecorded bucket.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `summary` — QUIRKY
- spec 2 · read at `05f8a8d8370a` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:54Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loads all recorded readings from `.sanity/` state, filters out stale ones (whose target code changed since prediction), aggregates grade fields (predicted/documented/derivable/legible/trap) into overall counts/percentages via a Tally/GradeCounts type, and returns a JSON object with repo-wide totals and a separate stale count — no per-file or per-function breakdown.
- found: Looks up the open project, computes an aggregate grade tally plus separate function/file/stale/remaining counts, and returns a JSON object explicitly limited to repo-wide aggregates (total, by_model, by_position, priming) with an embedded note explaining why no per-file/per-function data is included and how to interpret by_position and priming.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `from_state`
- spec 2 · read at `1bd9cf146ae3` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:07:07Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a ProjectList by iterating over every project in AppState, computing per-project summary stats (function/file counts, assessed count, remaining/in_flight, stale readings, and current run status) similar to the per-project block in `status`, so the frontend sidebar or CLI can show all open projects at a glance without hitting each project individually. At 147 lines it's likely doing a fair amount of the same lease-aging/stale-counting work inline rather than just calling shared helpers.
- found: Loads the report index once, then builds a ProjectSummary per open project (counts, assessed, run status, banked harness/model tallies, a "working" heuristic based on recent agent activity vs run end time, leased/reading ids, stale count). Beyond what I predicted, it also appends placeholder zero-count ProjectSummary rows for projects still being restored (from the index, not yet loaded), and sorts the final list by most-recently-touched.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: No function-level doc; only the file_doc for the whole agentapi module was given, which doesn't describe this constructor at all.

### `health`
- spec 1 · read at `d39dce89409c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns Json({"ok": true, "pid": process::id()}), a minimal liveness endpoint touching no state.
- found: Exact match: `Json(serde_json::json!({ "ok": true, "pid": std::process::id() }))`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Doc explains why this is separate from /status (status pings and drives UI activity indicators) which isn't derivable from the two-line body.

### `router`
- spec 2 · read at `ec1156823661` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns an axum::Router wiring HTTP routes (e.g. /open, /next, /reveal, /report, /status, /health, /summary) to their handler functions, attaching the shared Shared state via .with_state(state).
- found: Builds an axum Router mapping /health, /open, /queue, /reveal, /check, /stop, /report, /status, /summary to their handlers, with shared state attached.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `endpoint_file`
- spec 1 · read at `836f29d29a70` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds a PathBuf to a file where the claimed port is published, under a cache/config dir, with the filename itself pid-stamped, returning None if the dir can't be resolved.
- found: Joins crate::reports::data_dir() with fixed filename "agent-endpoint.json" — no pid in the filename itself; the pid-stamping mentioned in docs must happen in the file's contents or elsewhere, not here.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc's "pid-stamped" detail doesn't apply to this function itself — it's a fixed filename, so the stamping must occur at a different call site.

### `url`
- spec 1 · read at `8cd0a583018e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: format!("http://127.0.0.1:{}", self.port)
- found: Exact match.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `read_endpoint`
- spec 1 · read at `50286e4f7a32` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Reads endpoint_file(), parses JSON into port+pid, returns None on any failure; doesn't check liveness.
- found: Exactly that: read_to_string, parse JSON Value, extract port (u16) and pid (u32) fields via ? chaining, None on any error.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `stop_all_runs`
- spec 2 · read at `508c278e30ca` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Locks the shared state, iterates over all open projects, and for each one that has a `run`, sets its stop AtomicBool to true (same mechanism as stop_check). Then it does a short best-effort wait (e.g. sleeping in a loop with a timeout, or polling some "readers still alive" count) for those runs' reader tasks to actually finish, without blocking indefinitely if they don't.
- found: Sets the stop flag on every unended run across all projects, then polls a per-run `live` reader count (not a fixed sleep) every 50ms until it hits zero or a 5s deadline passes, to avoid orphaning readers.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `release_endpoint`
- spec 2 · read at `3d80e3d397a0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Cleans up the endpoint file written by this process (identified by pid) when the loopback API server shuts down, so a stale file doesn't point future agent connections at a server that no longer exists. Likely reads the current endpoint file, checks it still names this pid, and deletes it only if so (to avoid a race where a newer instance already overwrote it).
- found: Checks the current endpoint file still names this pid (via read_endpoint), and if so deletes it via endpoint_file()'s path, silently ignoring failure. Guards against removing a newer instance's endpoint file in a race.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `restore` — TANGLED
- spec 2 · read at `f617f9358598` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads the persisted project index, and for each saved repo path re-scans it from scratch (dropping any that no longer exist on disk), reloading saved assessments. Accumulates results into a local list rather than mutating shared state incrementally, and only locks/installs the full list into `state` (and calls `touch` to persist) once every project has been rebuilt — likely on a background thread since it's described as happening "in the background."
- found: Loads the persisted project index, publishes a `restoring` placeholder list immediately so the sidebar fills in right away, then spawns a background thread that rescans each known repo in reverse order (dropping ones no longer a directory), reporting live scan progress into `restoring_progress`, inserting completed Project entries, and picking `active` from the saved key once done, with a fallback to the most-recently-touched project if that key didn't come back. Persists (`s.persist()`) exactly once at the very end.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: Got the overall shape (background thread, per-repo rescan, drop missing, single persist at end) but missed the immediate `restoring` placeholder publish, live progress reporting, reverse-order-for-active-selection reasoning, and the fallback-active logic.

### `watch_tick`
- spec 1 · read at `95ab0f9186f2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Periodic tick that skips projects with outstanding leases, probes filesystem for changes, and if changed, rescans and notifies the window.
- found: Filters to unleased projects, probes each; if marks changed, rescans off-lock via spawn_blocking, reloads reports and file_marks against the fresh tree, then re-checks lease status under the lock before committing scan/reports/marks/scanned-counter into shared state. Does not itself emit any window event in this body — that appears to be the caller's job despite the doc's \"tell the window\" framing.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Doc's opening line says it tells the window, but this function only updates shared state; no emit call is visible in the body.

### `serve`
- spec 1 · read at `7b1cd59ca231` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds the router, binds a listener, writes the endpoint file so callers can discover the port, spawns a background watch task, runs the server, returns the port.
- found: Binds TCP listener on 127.0.0.1:0, writes {port, pid} JSON to endpoint_file(), builds router, spawns axum::serve as its own background task (not awaited here), spawns a second background loop that sleeps WATCH_TICK then calls watch_tick(&state) repeatedly to keep repo state (e.g. blame/uncommitted status) current even with no window open, and returns Ok(port) without blocking.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: serve() returns immediately after spawning both background tasks rather than awaiting the server, which I hadn't specifically called out.

### `task`
- spec 2 · read at `8b8a852f0203` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test-helper constructor that builds a minimal Task struct with the given path and name, filling every other field (id, owner, signature, docs, peers, line numbers, etc.) with cheap placeholder/default values, used by the test functions listed as peers to set up scan fixtures without needing a real parsed file.
- found: Test fixture constructor: builds a Task with id derived from path#name, path/name set from args, and every other field (line=1, end_line=10, lines=10, owner=None, signature/docs/file_doc empty, peers empty, file=false, ask empty) set to a cheap placeholder.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `project_of` — QUIRKY
- spec 2 · read at `bd9c107039a8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Constructs a fresh Project value for a given directory path — deriving a stable key (likely a hash or sanitized form of the canonicalized path) and a display name (probably the directory's basename), and initializing the rest of the struct's fields (reports, leases, scan state) to empty/default — used both when opening a new project and when restoring previously-known ones from disk.
- found: Test helper: runs a real (ephemeral-memo, ordering-fidelity) scan of `dir` synchronously, computes file_marks via stamp_marks and watch::probe, and builds a fully-populated Project struct with hardcoded name "t" and all runtime fields (reports, leased, recent_files, predictions, run, events) empty/default — used to set up a Project fixture for tests.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Expected a lightweight constructor deriving a key/name from the path; it's actually a test fixture that performs a real synchronous scan.

### `a_shim_serving_a_stale_contract_is_told_to_restart`
- spec 1 · read at `889c2e2dbbe0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test that a shim reporting a mismatched contract fingerprint gets a restart warning, and a matching one gets none.
- found: Verifies contract_note() returns None for a matching fingerprint, Some(message containing 'restart') for a mismatched one, and also Some(...) for None (a caller too old to report a fingerprint at all) — treating silence as its own hazard.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_file_edited_before_the_first_handout_is_still_re_cut`
- spec 1 · read at `df278033b628` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Edits a file's function positions before any handout/resync has run, then triggers resync and asserts the function's recorded line reflects the post-edit position rather than a stale pre-edit one.
- found: Writes a file with two functions, immediately rewrites it (prepending 3 comment lines) before any resync, calls resync_changed and asserts it reports 1 changed file, then walks the scan tree directly and asserts `second`'s line is now 5 (post-edit), confirming the fix from the docstring.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_save_mid_restore_does_not_erase_projects_it_has_not_loaded`
- spec 2 · read at `063f7cad4ee2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test that seeds an on-disk project index with multiple known projects, simulates a Shared state with only one project loaded (mimicking mid-restore), triggers a save/persist, and asserts the on-disk index still contains all the original projects merged with the new one rather than being truncated down to just the one in memory.
- found: Seeds a two-project on-disk index, simulates a session that has only restored one of them (/b) with updated fields, persists, and asserts the reloaded index still has both projects (not truncated to one), the loaded one is updated in place (not duplicated), and the session's active project wins.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `drop` #2 — TRAP
- spec 2 · read at `04e9140a98c8` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: DataHome is a test-only RAII guard that points sanity's data directory at a temp dir for isolation (via an env var like SANITY_DATA_HOME). Its Drop impl restores the previous env var value (or removes it if unset before) so one test's override doesn't leak into the next, and the temp directory cleans itself up via its own Drop.
- found: Clears a HOME_THREAD lock entry (marking no thread currently owns a data-dir override) and restores the SANITY_DATA_DIR env var to its previous value, or removes it entirely if it was unset before the override — using unsafe env::set_var/remove_var.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: Got the env-var restore logic right but missed the HOME_THREAD lock reset, which exists precisely because global env var mutation is a cross-test/cross-thread hazard (hence the `unsafe`).

### `data_home` — OBSCURE — TRAP
- spec 1 · read at `6936aefd7812` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Resolves the production application data directory (like an app-support path), creating it if needed, possibly with a test override.
- found: It's a test fixture, not a production path resolver: takes a global ENV_LOCK mutex guard, creates a tempdir, points SANITY_DATA_DIR at it, records the previous env value and the current thread id (guarding against cross-thread reuse), and returns a DataHome RAII guard that presumably restores the env var and lock on drop.
- predicted: none · documented: none · derivable: no · legible: most · trap: yes
- note: I misread this as a real app-data-dir resolver; it's actually test isolation scaffolding — the sentence-style peer names (all clearly test cases) should have tipped me off that this is a test-support file.

### `standing_down_withdraws_only_its_own_claim`
- spec 1 · read at `47867a4f2199` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that writes a claim for one daemon/pid, has a different pid try to release/stand down, and asserts the original claim survives untouched; then has the true owner release it and confirms it's gone, verifying release only removes a claim that still names the caller.
- found: Writes an endpoint file naming pid 1234, then release_endpoint(999) (a different pid) leaves it untouched (asserts pid still 1234). Then release_endpoint(1234) (the true owner) clears it (read_endpoint is None). Then release_endpoint(1234) again on an already-cleared file is asserted not to panic (racing exits).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `outstanding_itemises_only_live_leases_on_unread_work`
- spec 2 · read at `c63aa4eb4d25` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test constructing a project with a function that is leased, then giving it a landed report (simulating the reading having completed) or leaving it unread; asserts work_left/outstanding only counts a lease when the underlying work is still unread — a lease over already-reported work does not appear in in_flight/outstanding, preventing remaining==in_flight from wrongly signalling 'wait' when the repo is actually done.
- found: Builds a two-function file, checks work_left shows nothing in-flight with no leases; leases one function and checks it appears in in_flight/outstanding by id while remaining stays at 3 (two functions + their file task, since a lease isn't a reading); then inserts a report for that function and confirms in_flight/outstanding both drop to empty/0 while remaining drops to 2 — proving a stale lease over already-read work stops being counted.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Got the core scenario right but missed the specific numeric assertions, especially that `remaining` includes the file task itself (3, not 2).

### `a_rescan_does_not_throw_away_the_run_it_lands_in_the_middle_of` — QUIRKY
- spec 2 · read at `578cafb4e1b5` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:49:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This test starts a run and records a prediction for one function (i.e. calls reveal so `expected` is committed but not yet reported), then triggers a rescan of the same project (simulating the sidebar reselect), and asserts that the in-flight reading still has its `expected` prediction intact rather than coming back empty/reset. It's a regression test guarding against rebuilding run state from a fresh scan and thereby discarding already-committed predictions.
- found: Builds a project with a leased+predicted reading and an active run, rescans it, and asserts leases, predictions, run state, event log, and the scanned counter all survive/increment correctly. Also checks that rescanning a brand-new (previously unseen) project starts fully empty rather than inheriting state.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Prediction covered the headline assertion (predictions survive) but missed the lease/run/events/scanned-counter assertions and the separate fresh-project case.

### `the_summary_counts_neither_stale_readings_nor_unknown_positions_as_good_news` — QUIRKY
- spec 1 · read at `d5c2b1fa80cf` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test that banks reports including a stale one (body mismatch) and one with unknown position, then checks the summary/aggregate excludes the stale reading and doesn't count unknown position as a fresh/first reading.
- found: Confirms stale exclusion and per-model tally exclusion as predicted, but also covers per-position bucketing (agg.by_position.positions keyed by exact position number, no invented buckets) and that a later report with position=None does not fall into position 1's bucket nor keep its old bucket — it moves to a distinct `unrecorded` counter.
- predicted: some · documented: full · derivable: no · legible: most · trap: no

### `same_named_methods_arrive_with_the_type_they_hang_off`
- spec 2 · read at `e605c5741ade` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a fixture with two same-named methods on different owning types (e.g. two `parse` methods on different structs/impls), runs the code that produces the peers list, and asserts that both appear distinguishably (e.g. qualified by owner) rather than being deduplicated into a single entry.
- found: Writes a Rust fixture with two same-named `parse` methods on different impl types, runs collect_tasks, and asserts each task's owner is set correctly and its single peer is qualified as `Owner::parse` (not bare, not self-referential).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc explains the motivating bug (dedup collapsing bare names) which isn't visible in the test code itself.

### `an_excluded_file_leaves_the_queue_and_stays_in_the_count`
- spec 2 · read at `f0387645fe87` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test that creates a temp repo with a .sanityignore pattern excluding some file, scans it, then asserts that the excluded file's functions never come back from the work-queue/next-handout call, while the summary/status counts still include it (e.g. in an "excluded" total) rather than silently shrinking the denominator.
- found: Test: builds a temp repo with a kept file and a tests/ file, verifies all 3 functions count with no .sanityignore, writes a .sanityignore excluding tests/, then asserts counts split (1 in-scope, 2 excluded) rather than shrinking, that the task queue only hands out the in-scope function, and that the reader-facing shape still reports both the excluded count and functions=0 for that directory.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Predicted the queue/count-not-shrinking behavior correctly but guessed generic helper names (work-queue/next-handout) instead of the actual collect_tasks/shape_of; also didn't anticipate the extra assertion on the reader-facing 'shape' structure.

### `a_reading_for_a_deleted_function_is_not_coverage`
- spec 1 · read at `cf9d26a07bd4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Test: create scan with two functions, add readings for both, assert assessed()==2; delete one function, rescan, assert assessed()==1 since the orphaned reading no longer counts.
- found: Exactly that, using a real temp-dir project with two functions, reports inserted for both bodies, then a rewrite removing one function and rescanning to check assessed() drops to 1.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `deleting_a_twin_expires_the_survivors_reading_rather_than_moving_it`
- spec 1 · read at `4e1be19ce4a0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test with two identically-named functions ('twins') in a file, both assessed/reported on; it deletes the first twin (whose ordinal the survivor now inherits via name+ordinal matching), rescans, and asserts that the reading which lands on the survivor via the same ordinal slot is treated as stale/expired (because the body doesn't match) rather than silently accepted as still valid.
- found: Exactly that: writes a file with two differently-bodied `go` methods on types A and B, assigns each its own report keyed by its body, deletes the first, calls resync_changed, then confirms only one function remains and that its inherited report id maps to a body that no longer matches (is_stale returns true) — the ordinal-inherited reading is expired, not silently believed.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_file_is_queued_as_its_own_reading`
- spec 2 · read at `a037ddcfa76d` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test verifying a file with a header/doc banner produces its own queueable Task (file=true) in addition to tasks for its functions, so the header itself gets judged instead of being silently fed as unassessed context to every function reader. Sets up a small project/scan with such a file, runs collect_tasks (or queue), and asserts a file-level task is present in the output.
- found: Writes a small file with a module-doc banner and two functions, runs collect_tasks, and asserts exactly one file-type Task is produced — keyed by path (no '#'), carrying the banner's doc text, listing every declaration as peers (not a windowed subset), a non-empty `ask` explaining how it differs, and confirms the two function tasks still come through separately and unmarked as files.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Predicted the overall intent correctly but not the specific assertions (id format, docs join, peers being ALL declarations, non-empty ask).

### `a_file_reading_expires_on_its_header_and_its_surface`
- spec 1 · read at `011abc3cd53e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test verifying the file reading hash changes when header/doc or declared surface (signature) changes but not when only a function body changes.
- found: Exactly that: builds a hash from a scanned file's Node.body for several source variants — header rewrite, changed param type, new function declaration all change the hash; a body-only rewrite (println content) does not.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_long_file_sends_the_neighbourhood_and_counts_the_rest` — QUIRKY
- spec 1 · read at `ed952eb59390` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a large file's declaration list and checks that a truncated neighbourhood/peer list reports how many items were omitted rather than silently presenting a partial list as complete.
- found: Tests a `neighbours(names, index)` helper that returns a fixed-size centred window (PEER_WINDOW) of peer names around an index plus an omitted count: centred in the middle, sliding rather than half-emptying at the first/last index, never including the item's own name, and for a list that fits entirely it returns everything with omitted=0.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: This is the same peers/peers_omitted mechanism used to hand out functions in this very assessment protocol — the test is exercising the tool I'm using right now.

### `a_file_that_moved_is_re_cut_before_anything_is_handed_out` — QUIRKY
- spec 1 · read at `25a55854a18c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test that scans a repo, edits the file afterward (shifting a function's position), then requests a task and asserts the returned line range reflects the current file, not the stale scan.
- found: Test exercises `resync_changed` directly rather than a task-fetch API: writes a file, scans it into a Project, confirms resync_changed returns 0 when nothing moved, rewrites the file with 3 lines and a new function prepended, asserts resync_changed returns 1 and the moved function's recorded `line` now matches its new position, that its body hash is unchanged (so an honest reading is not expired by a mere shift), and that the newly-added function does NOT appear yet (new functions only arrive on a full reopen/rescan).
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `a_function_that_is_gone_stops_being_offered`
- spec 1 · read at `ac71df55ca7a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that creates a project with a function, then deletes/removes it from the source and rescans, asserting the queue/scan no longer offers that function to the agent (rather than leaving it queued with a now-invalid line number) — matching the doc's claim that a deleted function is dropped, not handed out stale.
- found: Confirmed closely: writes a file with `keep` and `go`, syncs a project (resync_changed==0, no changes yet), rewrites the file to remove `go`, calls resync_changed again (returns 1, one file changed), then walks the scan tree and asserts only `keep` remains as a Func node — the deleted function is gone from the tree entirely, not left dangling.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `status_answers_about_the_callers_repo_not_the_window`
- spec 1 · read at `423ef47f6867` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test that /status resolves the explicit project key passed by the caller rather than whatever the app window is currently displaying (the 'active' project).
- found: Confirms that with an explicit project key, status answers for that project regardless of `active`; also confirms a keyless call resolves to the most-recently-touched/opened project rather than `active`, since report resolves the same way and a mismatch there would be costly.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `lease_kind`
- spec 2 · read at `ffaf4f3556c5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Scans the shared task queue for the first task matching the requested kind (want_file: true for a file task, false for a function task), skipping past non-matching tasks (since the queue interleaves), marks it as leased under `key`, and returns it as a Task. Likely loops/awaits on some lock or notification if no matching task is currently available.
- found: A test-fixture helper that calls the real `queue` HTTP handler up to 16 times, each time requesting one task for the given project key; if the returned task's `file` flag matches `want_file` it returns that task, otherwise it discards it and retries. Panics if 16 attempts never produce a matching task.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Docs handed to me were the file-level doc (why sanity exists), not anything specific to lease_kind, which has no docs of its own — grading documented as none.

### `reveal_serves_the_functions_own_lines_and_no_more`
- spec 2 · read at `62eed52c0ac7` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:22:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up a small project/repo fixture, calls the "next" queue to get a function-level task, then calls reveal on it, and asserts the returned source text corresponds exactly to that function's line..end_line span rather than the whole file — i.e. it checks the source doesn't leak surrounding file content. Likely also checks `whole_file` is false for this case, contrasting with the file-task variant.
- found: Writes a fixture file with two functions (one, two), gets a task via lease_kind, calls reveal on it, and asserts the returned source contains the leased function's name but does NOT contain the other function's distinguishing content ('SECRET' or '\"1\"') — proving reveal doesn't leak a sibling function's body into the handout.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_second_reveal_cannot_revise_the_prediction`
- spec 2 · read at `f047d92005d4` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:43:03Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that leases a task, calls reveal once with an expected prediction, then calls reveal again with a different expected string, and asserts both calls return identical source output — and likely inspects internal state to confirm the originally recorded prediction was the first one, not overwritten by the second call.
- found: Test leases a task, calls reveal twice with different `expected` strings and confirms identical source returned both times, then submits a report whose `expected` field is the second (revised) prediction and asserts the stored report's `expected` is still the first prediction, proving the first reveal call locked it in.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `reveal_without_a_lease_is_refused`
- spec 2 · read at `e61db649d48d` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:40:58Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test function that sets up the sanity agent-api state, then calls the reveal operation with an id that was never obtained from a prior `next` call (i.e., has no lease), and asserts that the call returns an error/refusal rather than a source-code payload, verifying the invariant described in the docstring that only leased ids can be revealed.
- found: Builds a fixture project directly from a scan (bypassing the queue) so the function id was never leased, then calls reveal() with that id and asserts ok=false, source is null, and no prediction got recorded for that id.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_file_task_is_revealed_whole`
- spec 2 · read at `aba269648c94` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:23Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test verifying that when a task is a whole-file reading (not a single function), calling reveal returns the entire file contents rather than truncating to the node's end_line — sets up a project/scan with a file, requests the task, reveals it, and asserts whole_file: true and that the returned source extends past end_line / covers the full file.
- found: Test: writes a small file with a header comment and a trailing comment past the last declaration, requests a lease/task and reveals it, asserting whole_file is true and that both the header and trailing text (beyond end_line) are present in the returned source.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_pathless_open_answers_from_what_a_human_added`
- spec 2 · read at `de6892aa5a70` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:43:17Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A plain #[test] for pathless-open resolution: registers a single project into AppState, calls the resolve-without-path function, and asserts it returns that project; then adds a second project and asserts the call is now refused (ambiguous); possibly also tests the zero-projects case as refused. Covers the one/several/none cardinalities described in the docs.
- found: Test for resolve_open(&state, None): with no known projects it errors with a hint mentioning "add"; with one project saved in the KnownProjects index it returns that project's path; with two saved it errors with a "projects" array listing both paths (ambiguous choice), asserting the human is shown the candidates.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `a_path_the_human_never_added_is_refused`
- spec 2 · read at `d72e9224b27e` · commit `5ae2737` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:46Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A unit test that sets up shared state with no projects added, then calls whatever "open by path" agent-facing function exists with an arbitrary real filesystem path, and asserts it returns an error/refusal rather than silently scanning or adding the project — verifying agents can't point a run at a repo the human never chose.
- found: Seeds the on-disk index with one known project "/added", then asserts resolve_open succeeds for that path and errors for an unadded path "/somewhere-else", checking the error JSON has ok:false and an error message naming the rejected path.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `work_detaches_from_a_thread_with_no_runtime`
- spec 2 · read at `fe845b17e4cf` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A plain #[test] (deliberately not #[tokio::test], so no runtime exists on the thread) that calls the run-starting/detach function with a future that sets a flag (AtomicBool or channel) when it actually executes, then spins/blocks waiting for that flag to become true — proving the work truly ran rather than just that the call didn't panic or that the spawn function returned.
- found: Plain #[test] that spawns a future via detached() which sends on an mpsc channel, then blocks with recv_timeout(5s) to confirm the future actually ran, failing with a message if it never did.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `work_detaches_from_inside_a_runtime`
- spec 2 · read at `47b1ca72e105` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A tokio async test verifying that the work-spawning helper (used to run agent work in the background) can be invoked from code already running inside a tokio runtime (like an axum handler) without panicking (e.g. "Cannot start a runtime from within a runtime"). It likely calls the spawn/detach function directly in this async test context and asserts the spawned task still runs to completion or its handle/result is usable, complementing the sibling test that covers calling it from a plain thread with no runtime.
- found: Async test that calls a `detached()` helper (presumably spawning work independent of the caller's lifetime) from inside a tokio runtime, sends a signal through an mpsc channel from within the spawned future, and blocks (via spawn_blocking + recv_timeout) to assert the future actually ran within 5 seconds.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The one line of doc shown ("And it still works from inside one, which is the axum handler's case.") is actually a continuation of the file-level doc, not doc for this test — documented should be scored as none for the function itself.

### `a_project_key_that_is_not_loaded_is_refused_rather_than_swapped` — QUIRKY
- spec 1 · read at `75c4e912dae3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that loads/activates one project, asks for a different unloaded project's key, and asserts a refusal rather than a silent fallback to the active project.
- found: Tests AppState::for_client directly with three cases: a known loaded key returns itself, an unknown/not-yet-restored key returns None (not a silent fallback to active), and no key given (None) falls back to the active project as the honest default for 'the window's own project'.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `a_reading_lands_where_its_task_came_from`
- spec 1 · read at `279e84fbe9f7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test that a reading/report is attributed to the project whose queue issued the task, not wherever a concurrent sanity_open moved the ambient project key.
- found: Tests state.owner_of(id, ambient_key): an id belonging to /theirs resolves to /theirs whether the ambient key says '/mine' (wrong sibling), '/theirs' (agreement), or None (keyless, the real subagent case) — ownership is derived from which project's scan contains the id, not from the passed-in key.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `a_reading_for_an_id_no_project_holds_is_refused` — OBSCURE
- spec 1 · read at `ff711e283b82` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Calls the report() endpoint with an id matching no known function in a loaded project, and asserts the response signals refusal/failure rather than silently accepting and marking saved:true (per the attached doc about the twin failure with save_reports).
- found: Actually tests state.owner_of(), not report(): with a bogus id ('a.rs@99#nothing') not held by any project, owner_of returns None both with and without a project hint; but once that same bogus id is inserted into the project's `leased` map (simulating an outstanding lease from a since-re-cut file), owner_of resolves it to the owning project. So a lease alone is sufficient grounds for ownership even for an id no live function matches.
- predicted: none · documented: none · derivable: no · legible: most · trap: no
- note: The attached doc describes a different mechanism (report()/save_reports refusing an unmatched id) than the body, which tests owner_of() and lease-based resolution; documented should be graded none per instructions since the doc describes a sibling behavior, not this function.

### `a_file_just_drawn_from_is_passed_over_on_the_next_call` — QUIRKY
- spec 1 · read at `67217c463b2e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test that draws a function from one file, then calls next again and asserts the second result comes from a different file, verifying spread state persists across calls.
- found: A direct unit test of spread_across_files with an explicit recency map: confirms a just-drawn-from file is passed over for a rested one, that this preference yields anyway when it's the only file with remaining work, and that the rest expires after FILE_REST duration so ranking reverts to normal.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The mechanism is a time-windowed 'rest' map keyed by path/Instant passed explicitly into a pure function, not an internal call-to-call state simulated through the public API as I guessed.

### `queue_spreads_across_files`
- spec 1 · read at `2d5ef9f4073a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test building a ranked queue with one file dominating the top scores, then handing out a batch via the interleaving function, asserting no two consecutive handed-out tasks come from the same file (while others still have work) so a reader isn't stuck rereading one file back to back.
- found: Exactly that via `interleave_by_file`, plus an additional assertion that the top-ranked file (hot.rs) still leads the handed-out order — confirming the interleaving spreads files without degenerating into ranking-blind round-robin.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `queue_falls_back_when_one_file_remains` — QUIRKY
- spec 1 · read at `fe50b27b0f2e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test that repeated queue calls against a single-file project still hand out work instead of starving, likely by not skipping the just-drawn file when no other file exists.
- found: Builds 4 ranked tasks all from the same file "only.rs", calls interleave_by_file(ranked, 3) directly, and asserts it hands back 3 items — confirming interleaving degrades gracefully to single-file mode instead of returning fewer than requested.
- predicted: some · documented: full · derivable: no · legible: full · trap: no

### `queue_never_repeats_or_overruns`
- spec 1 · read at `5d37dac2518c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Requests more tasks than exist and asserts the queue returns exactly the remaining items without panic, duplication, or wraparound.
- found: Calls interleave_by_file with 2 ranked tasks across 2 files but asks for 25; asserts exactly 2 are handed back and they have distinct ids (no repeat).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `two_projects`
- spec 1 · read at `ccdba1707d8d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test fixture: create a temp dir repo, scan it, register the same project under keys /x and /y in AppState, return DataHome, TempDir, AppState.
- found: Matches exactly: writes a.rs into a tempdir, builds AppState with project_of(dir.path()) inserted at both "/x" and "/y", returns (data, dir, state).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `an_unasked_open_does_not_steal_the_window`
- spec 1 · read at `ccd2b12870a2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test that opening a second project headlessly does not change which project the window is currently showing, while an explicit focus request does move it.
- found: Sets state.active to /x, calls state.focus(\"/y\", false) and asserts it returns false and active stays /x; calls state.focus(\"/y\", true) and asserts it returns true and active becomes /y.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `an_open_takes_a_window_that_nobody_holds` — QUIRKY
- spec 1 · read at `5fdf359bc236` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test that an open/focus call claims the active-window slot when nobody currently holds it, so a subsequent keyless call resolves correctly instead of finding nothing.
- found: Test calls state.focus(\"/y\", false) with no active project set (steal=false) and asserts it succeeds and sets active to /y; then sets active to a project key that is not loaded (\"/gone\") and asserts focus still succeeds and reassigns active to /y, showing a dangling/unloaded active is treated as nobody holding the window.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `a_keyless_call_follows_the_last_open_not_the_window`
- spec 1 · read at `fa6903e398b2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that opens repo A (window stays on it), then opens repo B, then calls next/report without a key and asserts it lands on B (most recently opened), not the window's A.
- found: Uses two_projects() helper to load /x and /y, focuses /x as window, touches both; asserts for_client(None) returns /y (last touched, not window), for_client(Some(\"/x\")) returns /x (explicit key wins), and for_client(Some(\"/gone\")) returns None (unknown key not redirected).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `endpoint_reads_back_what_was_published` — OBSCURE
- spec 1 · read at `f66a505968be` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Publishes a tool/endpoint schema and re-parses it through the shared parser used by both server and client, asserting round-trip equality.
- found: Constructs an Endpoint{port,pid}, checks ep.url() formats as http://127.0.0.1:<port>, then does a plain serde_json round-trip of {port,pid} and asserts the two fields survive.
- predicted: none · documented: none · derivable: no · legible: full · trap: no
- note: The file doc line ('The endpoint file round-trips through the one parser both halves now share') describes the discovery-file struct Endpoint{port,pid}, not a schema/tool-definition parser as I assumed.

### `the_priming_warning_asks_rather_than_asserts`
- spec 1 · read at `c51236a9ccda` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Asserts on the exact wording of a priming-warning string surfaced when a repo brief exists, checking it hedges as a question rather than a flat assertion, names the --setting-sources user flag, and admits it cannot see session context.
- found: Tests priming_note(dir): returns None when no instructions file exists; with CLAUDE.md present, the note names the file, mentions --setting-sources user, admits 'cannot see', delegates via 'CHECK YOUR OWN CONTEXT', and offers the clean-branch conclusion 'the run is clean'. With both CLAUDE.md and AGENTS.md present, both are named together rather than only the first.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the None base case, the explicit delegation phrase, the alternate-conclusion text, and the multi-file naming requirement — the actual test covers more distinct wording guarantees than I predicted.

### `a_report_carrying_its_own_tool_call_is_refused`
- spec 1 · read at `da4694a4ddef` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test that a report with embedded tool-call/XML markup in its text fields is refused by the mangled-detection logic, while genuine prose with angle brackets (JSX) passes through.
- found: Exactly that: three cases test `mangled()` — a leaked closing tag plus stray parameter markup in `found` is caught, a leaked `</expected>` tag in `expected` is caught, and honest JSX-in-prose across expected/found/note is not flagged. Also checks that despite being caught, `grades()` still shows what would have been banked.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_leak_with_its_grades_intact_is_a_reading_and_is_kept` — QUIRKY
- spec 1 · read at `6a2a0bdf22b2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A submitted report whose free-text field contains a leaked tool-call-like fragment but has all grade fields validly filled is still accepted/stored, contrasting with a sibling test where a tool-call in a checked field is refused.
- found: Builds a Report whose `found` field contains a leaked closing-tag-like string, with predicted/documented/legible all set; asserts `mangled(&complete)` returns None (not flagged) and that `complete.grades().0` is the reader's actual chosen grade (Most), not a Full a truncated call would produce. A second Report missing `predicted` asserts `mangled` returns Some(\"found\") — flagging which field is suspect when a grade is missing alongside a leak.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

## src-tauri/src/assessment.rs

### the file itself — STALE
- spec 2 · read at `06b9db33416e` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file implements the .sanity/ on-disk assessment store: markdown-as-storage for repo readings, sharded by top-level directory. It has hashing helpers (reading_hash, body_hash) to detect when a function's body/docs changed and mark old readings stale, key-generation for identifying functions across scans (file_key, key_of, shard_of), grade parsing/rendering (grade_word, parse_grade), load/save/refresh/compile functions to read and merge shards into a live index (load, read_all, parse_shard, compile, live_funcs, live_files, is_stale), git metadata capture (git, head, who) for provenance, markdown rendering functions (render_entry, render_shard, render_index) to write the store back out, and an extensive suite of round-trip and staleness unit tests confirming readings survive saves, expire when code changes, and preserve fields like position/spec/priming/model/agent.
- found: Implements the .sanity/ markdown store: hashing (reading_hash/body_hash) for staleness detection covering body+docs+module header, durable keys for functions/files (key_of/file_key/shard_of) that survive line moves and disambiguate same-named twins, a spec/versioning system (SPEC, *_SINCE constants, legible_current) that tracks which build's question a grade answered so rewordings don't silently misrepresent old grades as current, load/save/refresh (compile → render_shard/render_index) that rewrite the store atomically and only remove shard files the tool itself previously linked (never touching human-added notes), git provenance capture (head/who/agent_docs), and an extensive test suite covering round-tripping of every field, staleness, key collisions, and index refresh semantics.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `legible_current`
- spec 1 · read at `c629493a51d2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns spec >= some LEGIBLE-since constant, implementing the >= compatibility rule described in the doc.
- found: spec >= LEGIBLE_SINCE — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `reading_hash`
- spec 1 · read at `06911bed7259` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Combines file_doc, doc, and body into a stack string and hashes it via some hash function into a hex string, so doc changes affect staleness.
- found: Builds stack from [doc, file_doc].flatten(), joins with space; if both absent calls body_hash(body) directly (byte-identical to old behavior), otherwise calls body_hash on "{joined docs} {body}".
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `body_hash`
- spec 1 · read at `b719bea07049` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Collapses whitespace, runs an FNV-1a-shaped hash with a nonstandard multiplier over the bytes, returns a short hex string used as a stable staleness hash.
- found: Exactly that: split_whitespace+flat_map bytes, FNV-1a-shaped XOR/mul loop starting from the FNV offset basis but with a different multiplier constant, truncated to 48 bits and formatted as 12 hex digits.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc explains why the multiplier deliberately differs from FNV-1a's real prime (changing it would expire every committed reading), which isn't derivable from the code alone.

### `dir`
- spec 1 · read at `086b47bb78c4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Trivial helper returning repo.join(".sanity").
- found: Exactly that, one line.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `shard_of`
- spec 1 · read at `ac17c9f7e62c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns top-level path component as shard name, or a root sentinel for files with no directory component.
- found: Exactly: splits on first '/', returns the top component if non-empty, else "root".
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `shard_links`
- spec 1 · read at `ebec6dfdb1ee` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Scans markdown text for [label](name.md) links and returns list of referenced shard filenames.
- found: Finds all `](` occurrences, extracts the text up to the next `)`, and keeps it as a shard name only if it ends in .md, contains no slash, and isn't README.md itself.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `shard_file`
- spec 1 · read at `321691534c5d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Given a shard name (a directory/segment identifier), returns the filename for its markdown shard within .sanity/, likely with some sanitization of the name.
- found: Sanitizes shard by replacing any char that isn't alphanumeric, '-', '_', or '.' with '-', then appends '.md' — a filesystem-safe filename derivation.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `file_key`
- spec 1 · read at `4de367e6855c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Just returns the path as-is (converted to owned String), since a bare path with no '#' is itself the key for a file's reading.
- found: Exactly that: `path.to_string()`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `key_of`
- spec 1 · read at `34546cf94a0f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds path#name key, appending #N for the Nth same-named function in a file (first occurrence unadorned), per the doc's described ordinal scheme.
- found: Exactly that: ord==0 gives 'path#name', otherwise 'path#name#{ord+1}'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `grade_word`
- spec 1 · read at `25328bac3021` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Maps a Grade enum value to a short human-readable word for use in the markdown report rendering.
- found: Exact match on structure: a match over Grade variants (Full, Most, Some, None) returning static str words \"full\", \"most\", \"some\", \"none\" respectively.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `parse_grade`
- spec 1 · read at `6efa4a4b952e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a grade word string (full/most/some/none) into the Grade enum, returning None for anything unrecognized.
- found: Exactly that: matches s.trim() against the four literal strings, returns None otherwise.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `flat`
- spec 1 · read at `cb995229a222` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Collapses a string's newlines/whitespace into a single line with single spaces, so a prose field can't be mistaken for a markdown bullet's continuation.
- found: s.split_whitespace().collect::<Vec<_>>().join(" ") — exactly that: splits on any whitespace run and rejoins with single spaces.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The doc explains the WHY (parser safety) which the two-line body alone wouldn't state, but the mechanism itself (split_whitespace+join) is fully derivable from the code.

### `load`
- spec 1 · read at `5ce1ef6cbfcc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads the assessment store from .sanity/, parses it into Report entries, and filters to only those whose function id exists in the current scan, returning a map keyed by function id to Report.
- found: Reads stored reports via read_all(dir(repo)); iterates live funcs+files from the scan, looks each up in the stored map by durable key, clones and remaps the report's id to the live node id, inserting into the output map. Early-returns empty map if store is empty.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_all`
- spec 1 · read at `23599632fd93` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Iterates shard files in the dir, parses each with parse_shard, merges all entries into one HashMap keyed by path#name.
- found: Reads the directory, skips non-.md files and README.md, reads each remaining file's text and calls parse_shard to accumulate into the output map; returns empty map if dir can't be read.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `parse_shard` — QUIRKY
- spec 2 · read at `9b75cbcabf92` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:11Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Line-oriented markdown parser: scans through text looking for entry headers (something like "### path#name") to start a new Report, then accumulates fields like expected/found/grade from subsequent bullet lines into that report. When it hits the next header or EOF, it finalizes the current entry and inserts it into `out` keyed by "path#name" — but only if both expected and found were present; otherwise the partial entry is silently dropped. Unrecognized lines are just skipped/ignored rather than causing an error.
- found: A stateful line-by-line parser: '## ' lines set the current file, '### ' lines start a new Report keyed by file+name+ordinal (parsing an optional " #N" suffix, decrementing to 0-based), and '- ' bullet lines fill in fields either directly (expected/found/note) or via a '·'-separated segment format covering a dozen other fields (spec, body location, commit, model, timing, cold/warm, priming, position, grades, trap). Entries are flushed to `out` on the next heading or EOF, but only kept if expected or found is non-empty.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: My prediction caught the overall header/bullet state machine but missed the ordinal-suffix key parsing and the entire '·'-segment sub-format covering ~15 fields.

### `live_funcs`
- spec 1 · read at `3d7a51c31a86` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Groups function nodes by file, sorts by line order to assign per-name ordinals, and returns a BTreeMap keyed by key_of(path,name,ord) to a Live record.
- found: Collects (line, name, id, body) per file, sorts each file's list by (line, id) for determinism, assigns 0-based per-name ordinals via a seen-counter, and inserts Live{id, path, name, line, ord, body} keyed by key_of(path, name, ord) into the output map.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `live_files`
- spec 1 · read at `85570ce70088` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Walks the scan's file tree, skips excluded files and files with no declarations, and builds a BTreeMap keyed by file_key to a Live value carrying file metadata.
- found: Uses scan.root.visit to walk nodes; skips non-File kind, excluded nodes, and nodes with empty children; inserts into map keyed by file_key(path) a Live{id, path, name, line:0, ord:0, body} built from the node's fields.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `is_stale`
- spec 1 · read at `cbdbbaa52183` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Compares a hash of stored body vs current body; empty/no stored hash means not stale (trusted); missing current body handled elsewhere.
- found: Direct string comparison of report.body against node_body, not a hash comparison. Empty recorded body -> false (pre-dates the store). Missing node_body (function gone) -> false, correctly guessed as not this function's concern (gone-ness handled elsewhere).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I assumed a hash comparison; it's a plain string equality check, body itself is what's stored.

### `row` — QUIRKY
- spec 1 · read at `6f5e58cf55bc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a summary tuple (name, total functions, and some grade-bucket counts like full/most/some/none) for rendering one line of the index table.
- found: Returns (self.shard.clone(), self.read, self.total, self.surprising, self.stale, self.dated) — a per-shard summary tuple of read/total/surprising/stale/dated counts, not grade buckets as I guessed.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `compile` — QUIRKY — TRAP
- spec 1 · read at `ccdadd50cc08` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Groups reports by shard and renders each shard's markdown body without writing to disk, producing a Compiled struct per shard, so save and refresh_index derive identical output.
- found: Iterates live functions and readable files (not reports directly, deliberately, to avoid twin-name confusion), looks up each one's report, buckets into BTreeMap<shard, BTreeMap<path, Vec<Placed>>> for deterministic output. For each shard, sorts each file's entries (file's own reading first, then by line/name), renders markdown body via render_entry, and computes per-shard tallies (read, surprising, stale, dated counts, and total against ALL live items in that shard, not just reported ones) alongside the body text into a Compiled struct.
- predicted: some · documented: some · derivable: no · legible: most · trap: yes
- note: The 'total' denominator deliberately counts everything live in the shard (not just what has reports), which is what makes '12 of 400 read' honest — a subtlety not obvious from the signature or the file-level doc alone.

### `repo_name`
- spec 1 · read at `e44c150f0a11` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns the repo path's final component as a String, falling back to some default string if there is no file name.
- found: repo.file_name().map(to_string_lossy).unwrap_or_else with fallback literal "this repo".
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `as_str` — QUIRKY
- spec 1 · read at `63d2ebc25082` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Index is an enum for a kind of document/entry; as_str is a match returning a string literal per variant, for filenames or display in the markdown store.
- found: match self { Index::Current => \"current\", Index::Refreshed => \"refreshed\", Index::Absent => \"absent\", Index::Failed(e) => e } -- Index tracks staleness/status of the assessment index rather than a document kind, and Failed carries an error message string.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `refresh` — TRAP
- spec 1 · read at `d14e3b642865` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Re-derives what .sanity/ should say from scan+reports via compile, diffs against what's on disk, rewrites only changed files (index+shards together), never creates .sanity/ if absent, returns Index.
- found: Reads existing README.md, returning Index::Absent if missing (never creates). Calls compile() to get fresh shard/index content. For each shard, only overwrites the file if it already exists on disk AND differs from fresh content (read error other than compare mismatch is silently treated as 'not there, skip'). Same for README.md index. Tracks whether anything was written and returns Index::Refreshed, Index::Current, or Index::Failed(msg) on write error.
- predicted: most · documented: full · derivable: no · legible: full · trap: yes
- note: write_if_changed treats any read_to_string error (not just NotFound) as 'file absent, skip silently' — a permission error or transient I/O failure on an existing shard would be swallowed rather than surfaced as Index::Failed.

### `save`
- spec 1 · read at `fa0335ff0e2f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Compiles reports, writes shard markdown files plus an index (README.md), and prunes stale shard files, preserving human content in .sanity/.
- found: Matches broadly but the prune logic is narrower and more careful than a generic 'preserve human edits': it reads the OUTGOING (pre-overwrite) index's shard links to know exactly which files this tool previously created, writes the new index first, then deletes only files from that old 'ours' set that are no longer in the new keep-list (never touching files it never linked), and does so only after the new index is durably written so a mid-failure can't leave the two halves disagreeing; errors from the delete step are propagated rather than swallowed.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `render_entry`
- spec 2 · read at `f517ec0ab439` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T05:42:06Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Formats one Markdown entry for a function or file into a string block, likely a heading using `name` (maybe numbered by `ord`, with different formatting/emoji if `is_file`), followed by a bulleted list of fields pulled from the Report struct (predicted, documented, derivable, legible, trap, note, etc.), and some marker if `stale` is true (like a warning or strikethrough). This is used to serialize an assessment entry back into the markdown store described in the file doc.
- found: Builds a Markdown entry string: a heading with the name (or FILE_ENTRY for files), an ordinal suffix if this is a repeated name, and marker suffixes (OBSCURE/QUIRKY, UNCLEAR/TANGLED, TRAP, STALE) only at the extreme grades. Then a provenance bullet line (spec version, body hash, commit, model, asked-for model if it disagrees, harness, when, by, cold/warm, reading position, priming) built conditionally per field, followed by expected/found lines and a predicted/documented/derivable/legible/trap summary bullet, and a stale-warning paragraph if applicable.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `render_shard`
- spec 1 · read at `cc5e4f4fa46f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds the markdown text for one .sanity/<shard>.md file: a header with read/total/surprising/stale/dated counts followed by the pre-rendered body of entries.
- found: Formats a shard's markdown header: title, counts line (read/total/surprising, optional stale note), an optional 'dated' explanation paragraph plus a spec-note boilerplate explaining the legible-grading rubric change, a fixed explanatory paragraph about what a reading is and what STALE means, a README link, then appends body verbatim.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `render_index` — QUIRKY
- spec 2 · read at `1ccd5bcb4d22` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:41Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds the Markdown index file for .sanity/ — a header mentioning the repo name, then a table with one row per shard showing the shard's name and its numeric stats (file/assessed/warm/surprised counts etc. from the tuple), plus a totals row summing across all shards. Returns the assembled Markdown as a String.
- found: Builds a Markdown table (with a conditional 'dated' column shown only when any shard has stale-dated entries) summing per-shard stats into a totals row, then wraps it in a large fixed README-style explanation of what the assessment is, how to view it as a map, and how to regenerate it.
- predicted: some · documented: none · derivable: no · legible: most · trap: no

### `git`
- spec 1 · read at `15b063d45267` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Runs `git` with given args in the repo dir, captures stdout, trims, returns None on failure/non-zero exit.
- found: Uses `git -C repo args...`, checks exit status, trims stdout via from_utf8_lossy, and additionally returns None if the trimmed output is empty (not just on command failure).
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Note: file_doc shown was for the module, not this function, so documented is genuinely none for this function itself.

### `head`
- spec 1 · read at `cbac4ef71821` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Runs git rev-parse HEAD via a raw process call, returns trimmed full hash, empty string on failure.
- found: Delegates to a `git()` helper with args ["rev-parse", "--short", "HEAD"], using unwrap_or_default() for the empty-string-on-failure case. Uses --short, not the full hash.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc explains why an empty result is acceptable (no git repo) but not that the hash is deliberately short.

### `who` — QUIRKY
- spec 1 · read at `186f3cd382b9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Runs git config to get user.name and user.email and formats them into a combined "Name <email>" identity string, falling back to a default if missing.
- found: Just tries git config user.email first, falls back to user.name if email isn't set, and returns empty string if neither is configured — no combined "Name <email>" format, just a single value.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `agent_docs`
- spec 1 · read at `5f22d8c33257` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Checks repo root for known instruction filenames, joins the ones present with a comma, empty string if none.
- found: Filters a constant AGENT_DOCS list by repo.join(f).exists(), joins matches with ", ".
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `now_iso`
- spec 2 · read at `d718b0876fd4` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:57Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Gets SystemTime::now(), computes elapsed seconds since the UNIX epoch, and delegates to iso_of (which uses the hand-rolled civil_from_days conversion) to format it as an ISO-8601 UTC string like 2026-08-13T05:12:03Z, with no external date crate dependency.
- found: Computes seconds since UNIX_EPOCH from SystemTime::now() (defaulting to 0 on error), then delegates to iso_of to format as ISO-8601 UTC.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `iso_of`
- spec 2 · read at `daf428b23611` · commit `5ae2737` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:45Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts an epoch-seconds integer into an ISO 8601 UTC timestamp string, splitting into days and time-of-day seconds, using the peer `civil_from_days` helper to get year/month/day (implying a hand-rolled calendar calculation rather than pulling in chrono), and formatting as "YYYY-MM-DDTHH:MM:SSZ".
- found: Exactly as predicted: splits epoch seconds into days/remainder via div_euclid/rem_euclid, converts days to y/m/d via civil_from_days, computes h/min/s from remainder, formats as ISO 8601 UTC string.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `civil_from_days`
- spec 2 · read at `fd5191d18b4b` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:01Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Implements Howard Hinnant's days_from_civil inverse algorithm: shifts z by the epoch offset, computes era and day-of-era, derives year-of-era via the standard polynomial formula, then day-of-year and month-position to recover the month and day, adjusting the year for months before March. Returns (year, month, day) as a tuple of i64/u32s.
- found: Standard Hinnant civil_from_days: shift by epoch offset 719468, compute era/day-of-era, year-of-era via the polynomial, day-of-year, month-position, then recover day/month and bump year for Jan/Feb.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_human_file_in_the_assessment_survives_a_save`
- spec 1 · read at `de5fb502b4d2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that writes a human-authored markdown file into .sanity/, runs the save routine, and asserts the file still exists — proving the sweep never touches files it didn't write.
- found: It scans a temp repo, saves the assessment, then adds both a genuine human note (NOTES.md) and a shard-like orphan file never linked by the current index (gone.md), saves again, and asserts both survive — showing the sweep's rule is 'what we claimed', not 'looks like ours'.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted only the human-note case; the orphan-shard case (a file this tool once wrote but no longer references) was the sharper half of the test and not obvious from the name alone.

### `report`
- spec 1 · read at `32cbdf97d4e6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test-helper constructor building a minimal Report with given id/note and default/placeholder values for the rest, for use in test setup.
- found: Exactly that: builds a Report with id and note filled in, and fixed placeholder values (expected, found, predicted grade, documented grade, etc.) for every other field, using ..Report::blank() as the base for anything left unset.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `round_trips`
- spec 1 · read at `e0c283a4dc23` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a report/reading, renders it via render_entry/render_shard to markdown text, parses it back with parse_shard, and asserts the round-tripped entry's fields equal the originals — an identity test for the render/parse pair.
- found: Exactly that mechanism, but the assertions specifically stress the 'second axis' fields (legible, trap, predicted, documented, position) that a prior regression silently dropped between the schema, the Report struct, and the wire copy — checking each survives store round trip, not just basic fields like expected/found/note.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_reading_without_a_position_does_not_claim_to_be_the_first`
- spec 1 · read at `5acab90a066a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test that parses a serialized reading missing the position field and asserts the deserialized position is None, not defaulted to Some(1).
- found: Calls parse_shard on a hand-written Markdown shard whose bullet list omits a position line, and asserts back[\"src/a.rs#foo\"].position == None.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_reading_without_a_spec_does_not_claim_todays_question` — QUIRKY
- spec 1 · read at `7697285ad73e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test constructing a Reading with no spec set, checking it's treated as unknown/not-current rather than silently defaulting to today's SPEC via something like unwrap_or(SPEC).
- found: Parses a markdown shard missing a spec bullet via parse_shard, asserts r.spec == 0 (spec-0 sentinel for absence), that the legible grade is still preserved (Some(Grade::Full)), and that legible_current(r.spec) is false — grade is kept but not trusted as answering the current question.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `a_reading_from_a_newer_build_is_still_trusted`
- spec 1 · read at `9826cf2d43f1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that a reading tagged with a newer spec/build version than current is still treated as trusted/current, while one from an older spec is treated as stale, following the >= asymmetry described in the docs.
- found: Calls a helper legible_current with four version values (the spec that set the question, a much newer unseen build, the spec right before it, and 0/unversioned) and asserts true for the current-or-newer cases and false for the older/unversioned ones.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_spec_round_trips_as_provenance`
- spec 1 · read at `18eccc66febd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A round-trip test: parses a markdown shard whose reading line includes a spec number on the provenance line (with read-at/by), asserts the parsed Reading keeps that spec value, then re-renders it and checks the spec still appears on the provenance line rather than among the grade fields.
- found: Parses a markdown shard with `- spec 7 · read at ... · by ... · cold reading`, asserts the parsed reading's spec field equals 7 and that legible_current(r.spec) holds, then re-renders the entry and asserts the rendered text still contains `- spec 7 · read at`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `priming_round_trips_and_is_silent_when_there_is_nothing_to_say`
- spec 1 · read at `7b841a044285` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test that priming info round-trips through markdown parse/render, and that when there's no agent_docs, no priming segment is emitted even if primed were somehow true.
- found: Parses two shard entries with 'priming: X in context' / 'X, Y excluded' lines (multi-file list handled correctly despite embedded comma), checks primed flag and agent_docs field, checks render_entry reproduces the same text, then constructs a bare Report with primed:true but no agent_docs and asserts render_entry emits no priming segment at all - primed alone is not sufficient.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `the_asked_for_model_round_trips_and_is_silent_when_it_agrees`
- spec 2 · read at `3340b4abc7e7` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:22:15Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test building a Reading (or similar) with both an "asked for" model field and the actual reporting model, then round-tripping it through the markdown/JSON store (render then parse back) and asserting the asked-for model field survives intact. It likely also checks that when the asked-for model matches the actual model, the rendered markdown output stays silent/omits any note about it (no redundant "asked for X, got X" text), contrasting with a disagreement case elsewhere that would surface it.
- found: Parses a markdown shard entry with 'read by haiku · asked for sonnet' and asserts both fields land in the parsed Report, and that rendering shows 'asked for sonnet'. Then constructs a Report where model==asked=='sonnet' and asserts rendering omits 'asked for' text (redundant with 'read by'). A third case, a Report with no `asked` at all (hand-driven, no run), asserts rendering shows neither 'asked for' nor 'via ' — no empty claim.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_reading_says_when_it_was_taken` — QUIRKY
- spec 2 · read at `51ff8e76f83d` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:10Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Unit test constructing a Reading with a specific timestamp (likely a leap-day or year-boundary edge case), saving/serializing and reloading it, then asserting the `when` field round-trips to the exact same date/time — exercising the hand-rolled civil-date conversion (civil_from_days peer) for correctness at edge cases so sorting order is preserved.
- found: Tests iso_of() timestamp-to-ISO8601 conversion at edge cases (epoch, leap day, year boundary, sort order), then tests that a `when` field round-trips through markdown parse_shard/render_entry, and that undated legacy readings render without a `when` line rather than claiming the epoch.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I assumed a struct serialize/deserialize round trip; it's actually testing a raw unix-timestamp-to-ISO function plus markdown parse/render, and a separate 'undated readings stay silent' behavior I didn't anticipate.

### `the_agent_that_read_round_trips` — QUIRKY
- spec 2 · read at `4f73f29cea1a` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:21Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A #[test] that builds a Report/Grade with an agent/model or harness field set, writes it through the assessment save function, parses it back, and asserts the agent/harness value on the reloaded reading equals what was saved — proving the "banked_harness" preselection value round-trips through the markdown/JSON store rather than being dropped on save/reload.
- found: Parses a literal markdown shard string with "read by claude-sonnet-4.6 · via agy" into a HashMap, asserts the parsed Report has both harness="agy" and model="claude-sonnet-4.6" (both halves needed since one model is reachable via multiple harnesses), and asserts render_entry on that reading re-renders "via agy" — checking both parse and render directions of the round trip, not just save/reload.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `an_unknown_segment_costs_that_segment_and_nothing_else`
- spec 1 · read at `069d6ef30a8a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test parsing a shard with an unrecognized bullet segment mixed among known ones, asserting the unknown segment is dropped and the rest of the fields still parse correctly.
- found: Parses a shard entry containing an unrecognized `vibes: good` segment inside the predicted/documented/etc. bullet line, then asserts body, by, legible, and spec all parsed correctly despite it.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_shard_counts_grades_that_answer_an_older_question`
- spec 1 · read at `9845cbb7fa7e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that a shard's 'dated' count (readings that graded legibility under an older question/spec) correctly counts only spec-stale graded readings, and does NOT lump in readings that were never graded at all (which are ungraded, not dated) — likely also checking the rendered shard summary text reflects this count.
- found: Confirmed: three functions — 'old' (legible graded, stale spec), 'fresh' (legible graded, current SPEC), 'never' (ungraded) — compiled into a shard; asserts dated==1 (only 'old' counts), that render_shard's text says '1 of these graded legibility under an earlier question' when dated>0, and that a clean shard (dated=0) says nothing about it.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `key_ignores_line_numbers`
- spec 1 · read at `efd0813c8a57` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructs the same function at two different line numbers via a scan fixture, computes keys for both, asserts they're equal, confirming line-number-independence of the key.
- found: Builds two scans of function foo in src/a.rs at line 12 vs line 480 via scan_of, and asserts live_funcs(&a).keys() equals live_funcs(&b).keys(), confirming the key is identical regardless of line position.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `same_named_functions_in_one_file_stay_apart` — QUIRKY
- spec 1 · read at `da2248134fcc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Test reconstructing the Swift init-collision bug: two same-named functions in one file must keep separate readings rather than the second overwriting the first.
- found: Builds a scan with two "init" functions and one "other" in A.swift, asserts live_funcs assigns distinct keys (A.swift#init and A.swift#init#2 ordinal suffix) each retaining its own body hash; then saves reports to disk and reloads, asserting all 3 round-trip and none are marked stale, confirming the ordinal survives serialization.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `a_file_reading_round_trips_beside_its_functions`
- spec 1 · read at `8432650edb11` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test that builds a file reading and function readings together, saves them, reloads, and asserts the file's key (bare path) doesn't collide with function keys and round-trips correctly.
- found: Does that, plus specifically checks the on-disk markdown shard uses a FILE_ENTRY marker in prose (### FILE_ENTRY) distinct from function headers (### `open`), and checks the reloaded file reading is not considered stale.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `hash_ignores_formatting`
- spec 1 · read at `c5649fd3947c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test that body_hash of two whitespace-reformatted-but-equivalent bodies are equal, so reformatting doesn't invalidate cache.
- found: Exactly that plus a sanity check the other way: body_hash of differently-indented but equivalent \"if x {...go();...}\" strings are equal, and body_hash(\"go()\") != body_hash(\"stop()\") confirming it's not just always-equal.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_reading_expires_when_its_documentation_changes` — QUIRKY
- spec 1 · read at `4d1404b407ff` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test recording a reading then editing only the doc comment and confirming the reading is now stale, proving the hash covers doc text as well as body.
- found: Directly compares reading_hash() outputs across doc variants: a changed doc gives a different hash, adding a doc where none existed gives a different hash, but reflowing a doc's whitespace/line-wrap gives the SAME hash (rewrapping says the same thing and should not expire honest work).
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `a_reading_expires_when_its_module_header_changes` — QUIRKY
- spec 1 · read at `d7599e3f1463` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test computing a hash including module doc/banner via collect_tasks or similar, mutating the file-level doc, and asserting hash changes.
- found: Calls reading_hash(module_doc, doc, body) directly three ways: different module doc text changes hash; None vs Some module doc changes hash; and swapping which sentence sits in the module doc vs function doc also changes the hash (order/placement of doc content matters, not just concatenation).
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `stale_when_the_body_moves`
- spec 1 · read at `2d1b882793a3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that stores a reading with a recorded body hash, then checks staleness against a matching vs. non-matching current hash, asserting stale only when the hash differs.
- found: Builds a report via report(\"src/a.rs#foo@1\", \"\") (empty body, so presumably a specific fixed hash), asserts is_stale is false against the matching hash \"aabbccddeeff\" and true against a mismatched one \"000000000000\", then additionally checks that a Report with an empty `body` field (simulating a pre-migration record with no recorded hash) is never considered stale regardless of the current hash — an edge case my prediction did not cover.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The third assertion (empty body/hash field means never stale, for backward compatibility with migrated readings) wasn't something I predicted from the name alone.

### `survives_a_mangled_entry`
- spec 1 · read at `f0df58c52369` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Parses a markdown shard with one entry missing its reading data and one well-formed neighbour, asserting the broken entry is dropped and the intact one parses correctly.
- found: Exactly that: `broken` has a heading but no actual reading fields and is dropped; `intact` has full reading fields and parses with predicted=Most, derivable=true.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `scan_of` — QUIRKY
- spec 1 · read at `cff5ae6ffd72` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture builder that turns a list of (path, name, ord, extra) tuples into a Scan, minting each function's id via key_of(path, name, ord) matching the real scanner's identity scheme, and returning a Scan struct.
- found: Builds a Scan tree: dedups/increments ord per (path,name) via a HashMap, creates Func nodes keyed by key_of with a body hash of the 4th tuple field, groups functions under synthetic File nodes (whose own body is a hash of a fabricated header string), and returns Scan with a ScanStats where functions=funcs.len() and without_history=true.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `a_stale_index_is_rewritten_on_open_and_an_absent_one_is_not_created`
- spec 2 · read at `81d89007d616` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T17:01:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test verifying two behaviors from the docstring: (1) writing a stale/outdated index file, opening the assessment, and asserting the index gets rewritten/refreshed to current format; (2) when no index file exists at all, opening the assessment does not create one as a side effect.
- found: A test that exercises Index refresh states via a `refresh()` function: Index::Absent when no .sanity dir exists yet (and confirms opening doesn't create one), Index::Current when freshly saved bytes match, Index::Refreshed when the README copy is stale (an old prose fragment) and gets rewritten, and finally confirms save() and refresh()'s rewrite produce byte-identical output so the two paths never fight over the file.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The docstring is about the enclosing module/file concept rather than this specific test; the test itself introduces `Index::{Absent,Current,Refreshed}` variants and a `refresh()` function not mentioned in the handout docs at all.

### `writes_and_reloads_a_repo_assessment` — TANGLED
- spec 2 · read at `46adf75c47c8` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds a small in-memory assessment (repo + at least one function reading), writes it out through the .sanity/ store (markdown + JSON), then reloads it after simulating the source moving down the file (same function, different line number). Asserts the reading round-trips and is still matched to the function, proving the store's key isn't sensitive to line-number shifts.
- found: Builds a scan with two functions, generates reports, saves them, and checks the store shards by top-level directory (src-tauri.md, web.md) plus a README index mentioning sanity.monster and 'sanity check'. Then it re-scans with the same functions moved to different lines (one body unchanged, one body changed), reloads, and asserts both readings are found by identity (not position) — with the unchanged-body one still fresh and the changed-body one marked stale.
- predicted: most · documented: none · derivable: yes · legible: some · trap: no

### `shards_by_top_level_dir` — QUIRKY
- spec 1 · read at `6b812ed1b7d8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test that the store splits shard files by top-level directory, likely via a full save/load round trip across readings in different dirs.
- found: Much narrower: just three direct assertions on helper functions shard_of (returns 'src-tauri' for a nested path, 'root' for a top-level file like justfile) and shard_file (maps a shard name to its .md filename).
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Predicted a full round-trip test; actual test is a narrow unit check of two small helpers.

## src-tauri/src/bin/history.rs

### the file itself
- spec 1 · read at `855b2edad4c9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A thin CLI binary that runs the history replay headlessly on a given path and prints commit count, final function count, and info about the biggest-diff frames, to let a developer sanity-check the replay/walk logic without the GUI.
- found: Matches the summary, plus: parses flags (--files, --json, --cached, --limit, -h); --json dumps the exact HistoryScan payload the webview consumes, for cross-checking the two replay implementations; defaults to uncached reads since this tool exists to check the walk itself; manually replays the commit delta frames (set/del) to compute live function count, total lines, and peak function count, rather than trusting a precomputed total; --files prints a per-file breakdown of functions/lines alive at HEAD for reconciling against `just scan`; and \"busiest commits\" are ranked by set+del size, printing sha/added/deleted/files-touched/subject for the top 8.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `main`
- spec 1 · read at `f7bcecf09365` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Parses a repo path arg, runs the history scan/walk, prints commit count, final function count, and the biggest-diff commits as a headless check.
- found: Parses flags (--files, --json, --cached, --limit, -h/--help) plus a positional path; runs history::read or read_cached; can dump raw JSON payload matching what the webview receives; otherwise replays commits as deltas against a live HashMap of function->loc to compute peak/final counts, prints summary line, optionally a per-file breakdown reconciled against `just scan`, and always the 8 busiest commits by files touched.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the flag surface (--json/--cached/--files/--limit) and that totals come from replaying deltas rather than reading a precomputed count.

## src-tauri/src/bin/sample.rs

### the file itself — QUIRKY
- spec 1 · read at `cf7c3dc1db75` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: CLI binary that walks the repo, collects all functions, randomly samples N, and writes handouts (name/signature/owner/docs, no body) as a single JSON output file for comparing multiple readers' predictions; bypasses .sanity/ and the lease/cache system entirely.
- found: Single main(): scans repo with HeuristicModel (ephemeral memos, scores unused), gets all tasks, computes a deterministic stride (total/want) rather than random sampling, and for each sampled task writes TWO separate files per exercise: NN_head.md (name/owner/file/lines/signature/docs/peers — the handout) and NN_body.txt (the sliced source body — the answer), into an output directory. Confirms bypass of sanity_report/.sanity/.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no

### `main`
- spec 2 · read at `e0baaeade969` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Parses CLI args (repo path, output path, optional n count) from std::env::args. Uses some shared candidate-discovery logic (likely from the main sanity crate) to enumerate functions in the repo, randomly samples n of them, and serializes the resulting handouts as JSON to the output file — bypassing sanity_report/.sanity bookkeeping since this is for validation runs, not real assessment leasing.
- found: Parses repo/out/n args, scans the repo via sanity_lib::scan with ephemeral memos, gets all_tasks, then takes an evenly-strided sample (not random) of `want` tasks, slicing each function's body directly from the current file on disk. Writes each as a pair of files (NN_head.md with owner/signature/docs/peers, NN_body.txt with the source) rather than a single JSON blob.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: File-level doc explained the tool's purpose well but not the stride-sampling or two-file output format, which I guessed wrong (assumed random sampling and JSON output).

## src-tauri/src/bin/scan.rs

### the file itself — QUIRKY
- spec 1 · read at `a36589a73add` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Headless CLI (`just scan`) that scans a repo path, scores functions for surprise, and prints a ranked report: histogram of score distribution, sections grouping functions by a two-axis quadrant split, truncated names for alignment, and a baseline_check comparing output against a checked-in expected baseline to catch metric drift.
- found: Correctly a headless scorer CLI, with histogram (temperature-bucket bar chart) and section (top-15 by a rank function, printed with per-line quadrant labels) roughly as predicted. But baseline_check is not a checked-in-baseline regression test — it's a live self-falsification check comparing the metric's top-15 ranking against a plain top-15-by-line-count ranking, to prove the surprise score isn't just size in disguise. quadrant_label is a simple enum-to-string mapper, not a grouping mechanism.
- predicted: some · documented: most · derivable: no · legible: not judged · trap: no

### `main` — QUIRKY
- spec 1 · read at `281ea7569950` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Parses a path arg, runs the scan/scoring pipeline, and prints a ranked report of hottest/bulkiest functions with a histogram and a baseline sanity check.
- found: Parses PATH and --local WEIGHTS args (loading a local model behind a feature flag, else falling back to HeuristicModel), runs scan::scan with ephemeral memos and Fidelity::Full so the measurement is never cached, prints file/function/line counts plus a 'no git history' warning if stability data is missing, prints the % of lines that are 'hot' (temperature>0.5) as the headline number, then calls histogram, baseline_check, and two ranked sections (HOTTEST by temperature*loc, BULKIEST PREDICTABLE by Bloat-quadrant loc).
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: Missed the --local/HeuristicModel switch, the ephemeral-memos/full-fidelity measurement-integrity concern, and the headline 'hot lines %' stat entirely.

### `histogram`
- spec 1 · read at `4c74b4d20fb0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Buckets function surprise/score values into bins, counts each, and prints an ASCII bar chart of the distribution to stdout as a calibration check.
- found: Buckets 10 bins by score.temperature() (0.0-1.0), finds peak bucket count, prints a labeled ASCII bar chart scaled to 34 chars wide with counts, titled TEMPERATURE SPREAD.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `baseline_check`
- spec 1 · read at `6d9317dcabd3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Ranks funcs by the real metric (temperature*loc) and by raw LOC, computes overlap of top-N between the two rankings, prints it as a sanity check on whether the metric is just LOC in disguise.
- found: Exactly that, with N=15, early-return if fewer funcs than N, and an added interpretive message bucketing the overlap count into three verdicts about how much the metric is 'just size'.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `section`
- spec 1 · read at `a5b137b2efc0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Prints a titled section, sorts funcs in place by the given rank closure descending, and prints the top entries with their score, name, and file location — a formatting helper used by main to render leaderboards.
- found: Sorts funcs descending by rank(n), prints a header, then prints up to 15 entries with positive rank showing temperature%, truncated name, LOC, quadrant label, and path:line; asserts via unreachable! that ranked nodes always carry a score.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `quadrant_label`
- spec 1 · read at `db90c53d6314` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A match over a Quadrant enum returning a static human-readable label string per variant, for use in scan's printed output.
- found: Exact match returning &'static str per variant: CrownJewel->"crown-jewel", Trouble->"trouble", Bloat->"bloat", Quiet->"quiet".
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `truncate`
- spec 1 · read at `93d56c49406a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Truncates a string to n characters for CLI display, appending an ellipsis if shortened, using char-wise (not byte-wise) slicing to avoid UTF-8 panics.
- found: Exactly that: counts chars, if <= n returns as-is, else takes n-1 chars and appends '…'. Comment explicitly calls out char-wise vs byte-wise to avoid panicking mid-codepoint.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/bin/tokens.rs

### the file itself
- spec 1 · read at `f9ef6d6755a2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A `just tokens <path>` CLI binary that estimates token cost of a sanity reading — fixed prefix (tool schemas, subagent prompt) vs per-function payload/body — printing a breakdown/report to make batching costs visible.
- found: Exactly that, plus specifics: uses a flat 4-chars-per-token estimate, prices each MCP tool schema individually flagging ones a reader never calls, computes percentile (median/p90/max) distributions of task JSON/peers/docs/signature/body-lines across all functions in the scanned repo, and produces a whole-repo token projection with a call-out on how much of the fixed prefix is wasted tool descriptions.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `tok`
- spec 1 · read at `a3cf659559cc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a character count into an estimated token count via a simple fixed-ratio heuristic (chars divided by some constant).
- found: Exactly that: `chars / CHARS_PER_TOKEN`, a one-line division by a module constant.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `row`
- spec 1 · read at `37b1893f0661` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Prints one formatted table row for the token-usage report: given a label and a character count, it prints the label, the char count, and an estimated token count (via the `tok` helper), likely padded/aligned for a histogram-style CLI output.
- found: Prints a single aligned row: label left-padded to 34 chars, char count right-aligned in 8, and estimated tokens (via tok(chars)) right-aligned in 7, formatted as \"label chars ch ~tokens tok\".
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `pct`
- spec 1 · read at `cf8ee2539f59` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Computes a percentile from a sorted slice by indexing at p * (len-1), for reporting stats like p50/p90.
- found: Same as predicted: returns 0 for empty slice, else rounds (len-1)*p to nearest index and returns that element.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `big`
- spec 1 · read at `607385e1263f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Formats a count into abbreviated human-readable form with K/M/B suffix and one decimal place, falling back to plain digits for small numbers.
- found: Matches on ranges: >=1_000_000 formats as X.XM, >=1_000 as X.Xk, else plain to_string(). No billions tier.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main` — QUIRKY
- spec 2 · read at `81178b0396cf` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: main() parses a CLI path argument, reads the target file (likely a JSON tool-definitions file), computes token counts via tok() for each entry/field, and prints a formatted table using row(), pct() (percentage of total), and big() (human-readable big number formatting) — probably a per-function or per-field breakdown of token cost with a total at the bottom.
- found: Computes and prints a token-budget report for the sanity MCP tool: fixed per-reader prefix cost (reader tool schemas + subagent prompt), orchestrator-only protocol cost, the gap held back from readers by the role split, per-function payload distributions (median/p90/max for JSON size, peers, docs, signature, body lines), and a whole-repo projection extrapolating prefix×N + payload + body tokens, ending with the tokens saved by not showing orchestrator tools to readers.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

## src-tauri/src/blame.rs

### the file itself
- spec 1 · read at `230c91feb002` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Runs git blame --line-porcelain per file to get per-line author/commit/time, parses into a per-line struct, exposes a range lookup for per-function age/churn/last-author, clamped for out-of-range ends.
- found: Matches closely: FileBlame stores packed per-line commit/author/time; Blame::read blames files in parallel with cache reuse and silent per-file failure; range() collapses a line span into commits/last_touched_days/age_days/last_author, clamped and documenting that function churn here means 'distinct commits still alive' not a 90-day window like churn.rs, and age is a lower bound because blame can't see full rewrites.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `range`
- spec 1 · read at `6e16a4ebacb9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Clamps/converts a 1-indexed inclusive start..end line range into a slice of per-line blame data, then aggregates it into a RangeHistory: distinct commit count, oldest commit as age, newest commit as last-touched, and the author of the newest commit. Returns None if out of range or empty.
- found: Matches: clamps start/end into the lines vector, collects distinct commit ids into a HashSet for the commit count, tracks newest (by time) and oldest line times, converts both to day counts relative to `now`, and looks up last_author from the newest line's author index. Docs note age_days is a lower bound since blame only sees the last touch per line, not full rewrite history.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `get`
- spec 1 · read at `72dcc57ecf6c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Simple accessor on Blame looking up per-file blame data by path in an internal map, returning Option<&FileBlame>.
- found: self.files.get(path) — exactly a map lookup returning Option<&FileBlame>.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `read`
- spec 1 · read at `82059d015700` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Iterates paths in parallel, checks cache for a still-valid entry keyed by path and the u64 (mtime/size) before falling back to blame_file; failures are swallowed per-file, cache misses not written as failures. Collects into a Blame map.
- found: par_iter over paths; for each, computes want = history.last_commit_of(p), checks cache.cached_blame(p, hash, want) for a hit, else calls blame_file and caches the result via cache.put_blame. Files where blame_file returns None are dropped from the result (filter_map). Result wrapped in Blame{files, now} where now is the current unix timestamp.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `blame_file`
- spec 1 · read at `e29bf07562e4` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Runs `git blame --line-porcelain` on the given path within repo, parses stdout via parse_porcelain into a FileBlame; returns None on command failure.
- found: Exactly as predicted: Command::new(\"git\") with -C repo, blame --line-porcelain -- path, returns None if spawn fails or exit not success, else Some(parse_porcelain(stdout)).
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: docs field was actually the file_doc (module-level), not per-function docs, so documented=none is a finding about the handout, not the repo.

### `parse_porcelain`
- spec 1 · read at `2541905813c1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Walks porcelain text line by line, tracking sha/author/time from header lines, and on the tab-prefixed source line stores the record at the position given by the final line number into a FileBlame, returning it.
- found: As predicted for the header/placement logic, but also interns authors into a Vec<String> with u16 ids via a HashMap, hashes the sha's first 16 hex chars into a u64 commit id, and grows a Vec<Line> (resizing with zeroed entries) to fit final_line rather than using a map.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `parses_a_commit_author_and_time_per_line` — QUIRKY
- spec 1 · read at `241cbe85be4e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A unit test for parse_porcelain that feeds a synthetic git-blame-porcelain sample and asserts the parsed line/author/time association is correct.
- found: Parses a SAMPLE porcelain blob into a FileBlame with 3 lines and 2 interned authors (Ada, Grace), then checks FileBlame::range over different line spans returns correct commit counts, last_author (most recent toucher, not first), last_touched_days, and age_days.
- predicted: some · documented: none · derivable: no · legible: most · trap: no

### `places_lines_by_their_final_number`
- spec 1 · read at `00f5fabdccb7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds blame/line-history data with lines appearing out of order (e.g. later lines listed before earlier ones), then checks that the resulting structure places each line by its final line number in the current file rather than by the order it was read/parsed in, so a function's lines land in the right place.
- found: Parses a git blame porcelain string where the hunk for line 3 appears before the hunk for line 1 (porcelain header gives orig-line, final-line, count), and asserts b.range() correctly returns Grace as author of line 1 and Ada as author of line 3 — proving parse_porcelain places lines by final line number, not by appearance order in the porcelain text.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_range_past_the_end_is_clamped` — QUIRKY
- spec 1 · read at `98c997b6a4f9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructs blame data, requests a range extending past the end, and asserts it returns the lines that exist (clamped) rather than panicking.
- found: Parses SAMPLE into a FileBlame; asserts range(2, 999, 2_000_000) is Some (clamped to available lines) but range(50, 60, 2_000_000) — entirely past the end — is None, distinguishing partial overrun (clamped) from total overrun (nothing).
- predicted: some · documented: most · derivable: no · legible: most · trap: no

## src-tauri/src/cache.rs

### the file itself
- spec 1 · read at `4e55b9ae8945` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A Cache type memoizing model scores keyed by a content hash of the function's identity plus body (and doc) so edits invalidate correctly while line moves don't; supports ephemeral (in-memory, test/headless) and persistent (per-repo-per-model on-disk) modes with periodic flush; header says persistence is currently unreachable in the app.
- found: Exactly matches: key() hashes body+doc via a deliberately-mislabeled FNV variant, excludes line numbers and includes the doc since it's part of the prompt; Cache::open loads per-(repo,model) files (hashed filenames), drops rather than merges stale/foreign caches; put()/flush() batch-write every FLUSH_EVERY entries via temp-file-and-rename for crash safety; ephemeral() is the only path actually wired into the app today.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The module doc is unusually thorough — it even flags its own likely future deletion ('if that stays true this should go') and explains design decisions (doc-in-key, model-in-filename, hashed filenames) that are not derivable from reading the code alone, since they encode past bugs and rejected alternatives.

### `key`
- spec 1 · read at `10263b9832dd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds (path#name, hash) where hash is fnv(body) combined with fnv(doc) so line numbers don't matter but body/doc changes do.
- found: Exactly that: (format!("{path}#{name}"), fnv(body) XORed with fnv(doc).rotate_left(1) when doc present.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `fnv` — TRAP
- spec 1 · read at `47065865d5b9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: An FNV-1a-shaped non-cryptographic hash over a byte slice used to build cache keys: starts from an offset basis, XORs each byte in and multiplies by a constant each iteration, returning a u64 — except the multiplier is deliberately not the real FNV prime, per the doc's reference to a 'twin' in heuristic.rs that stays wrong on purpose.
- found: Confirmed: FNV-1a-shaped loop (offset basis 0xcbf29ce484222325, XOR-then-multiply per byte) but the multiplier is 0x1000000001b3 rather than the correct FNV prime 0x100000001b3 — one extra hex digit — the 'not FNV-1a's prime' the doc warns about.
- predicted: most · documented: most · derivable: no · legible: most · trap: yes
- note: A one-digit-off constant baked in and cross-referenced to a matching twin elsewhere (heuristic.rs) rather than fixed — a landmine for anyone who 'corrects' it without reading the doc, since a fix here without a matching fix there would invalidate every existing cache key silently.

### `ephemeral`
- spec 1 · read at `7b869a5d74b4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Cache with no backing file path, in-memory-only, used by tests/headless scanner so nothing persists.
- found: Cache { path: None, model: String::new(), inner: Mutex::new(Stored::default()), dirty: Mutex::new(0) } -- matches, plus internal mutex-guarded dirty counter and Stored struct I hadn't anticipated the exact shape of.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `open`
- spec 1 · read at `3911f8fff48d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes cache path via path_for(repo, model), reads and deserializes the file if present, and returns a populated Cache if the stored version/model match current expectations, else falls back to an empty cache.
- found: Reads and deserializes Stored from path_for(repo, model); filters to only accept it if version == FORMAT_VERSION and model matches (any mismatch drops the whole cache rather than merging/migrating); wraps result in Cache with inner Mutex and a dirty-count Mutex initialized to 0.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `path_for`
- spec 1 · read at `8973c016a1ad` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds cache path under scores/ from a hash of repo path plus model name embedded in the filename; None if dir unavailable.
- found: Both repo path and model name are FNV-hashed (not just repo) and joined as {id}-{m}.json under scores/, specifically because raw repo/model strings contain characters illegal in filenames on some platforms.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `get`
- spec 1 · read at `830ff0edef2d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up a cached Reading by (name, body_hash) key in an internal map and returns a clone if present, so a hit requires both the same function name and matching content hash.
- found: Locks the mutex-guarded inner store, looks up entry by name (key.0), filters it to require body_hash == key.1, and if it survives, maps to a fresh Reading{surprise, hotspots} (hotspots cloned) rather than cloning the stored entry wholesale.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `put`
- spec 1 · read at `c5a3bbeeac83` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Stores a Reading into the cache's in-memory map keyed by (String, u64) body hash, behind a lock, and marks dirty so a later flush persists it — periodic auto-flush was not something I predicted specifically.
- found: Locks inner map and inserts an Entry (body_hash, surprise, hotspots) keyed by function name. Then increments a dirty counter under a separate lock, and calls self.flush() automatically once the counter reaches FLUSH_EVERY.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Docs are on the file (Cache) not this function, so documented=none is about this function specifically even though the file doc is informative.

### `flush`
- spec 1 · read at `01f40ef313ca` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Serializes cache contents to JSON, writes to a temp file, and renames over the real path atomically; no-op if ephemeral.
- found: Returns early if no path (ephemeral) or lock fails or serialization fails; otherwise writes JSON to a .json.tmp sibling file and renames it over the real path, silently no-op on write failure.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `model`
- spec 1 · read at `e381187a6109` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Trivial accessor returning &self.model, the model name this cache is keyed to.
- found: Exactly that: `pub fn model(&self) -> &str { &self.model }`.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `len`
- spec 1 · read at `acdccc35d5d5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Trivial accessor returning number of entries in the cache's internal map.
- found: self.inner.lock().map(|i| i.entries.len()).unwrap_or(0) — locks a mutex-guarded inner struct, returns entries.len(), defaulting to 0 if the lock is poisoned.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `is_empty`
- spec 1 · read at `525f411ae90a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Accessor returning whether the cache is empty, likely delegating to an internal map's is_empty or len.
- found: self.len() == 0, delegating to the len() method.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_new_cached_field_cannot_be_added_silently`
- spec 1 · read at `704006cab692` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Tripwire test comparing a fingerprint (hash or field count) of the cache Entry struct against a hardcoded value, forcing a deliberate update (and FORMAT_VERSION bump) whenever a field is added.
- found: Serializes a sample Entry to JSON, sorts its top-level keys, and asserts they equal the hardcoded list [\"body_hash\",\"hotspots\",\"surprise\"], with a failure message instructing to bump FORMAT_VERSION and update the list.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `two_models_never_share_a_cache_file`
- spec 1 · read at `cb74c330673d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Unit test asserting Cache::path_for produces different paths for two different model names, so scores aren't shared/mixed across models.
- found: Exactly that: computes path_for with two different model strings and asserts both are Some and not equal to each other, with a comment explaining the regression (proxy pass writing to same file as model pass, wiping scores).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `a_hit_needs_the_same_body_not_just_the_same_name`
- spec 1 · read at `506d9cc797b2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Unit test verifying that the cache key incorporates the function body, so editing a function's body (same name/path) causes a cache miss rather than returning a stale score.
- found: Exactly that: builds a key for a function with one body, puts a Reading, asserts a hit; builds a key for the same name/path with an edited body, asserts a miss.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `moving_a_function_within_a_file_does_not_invalidate_it`
- spec 1 · read at `727fa03d8533` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a cache key for a function at one line position, then simulates the same function moved to a different line in the file, and asserts the cache key (or a cache lookup) is unaffected — proving the key doesn't include line number so a cache entry survives code shifting around it.
- found: Calls key(\"src/a.rs\", \"run\", \"body\", None) twice with identical args and asserts equality — the proof that line number isn't part of the key is structural (key's signature has no line parameter) rather than an explicit before/after line-number comparison.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `renaming_or_moving_a_function_misses`
- spec 1 · read at `078a7675a445` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Test that the cache key includes name and path, so renaming a function or moving it to a different file misses the cache even with the same body, unlike moving within a file.
- found: Exactly that: puts a reading keyed on (src/a.rs, run, body), then asserts a lookup with the name changed to walk misses, and a lookup with the file changed to src/b.rs also misses, despite the same body string in both.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `an_ephemeral_cache_never_touches_disk` — QUIRKY — TRAP
- spec 1 · read at `325602066f11` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Creates an ephemeral cache, puts/flushes, then asserts nothing was written to disk (e.g. checks the backing file path doesn't exist), verifying the persistence half is truly inert.
- found: Creates Cache::ephemeral(), puts one entry, calls flush(), and asserts len()==1. It never actually checks the filesystem at all — the test name promises disk-avoidance but the body only verifies the entry count survives a flush call, so it would pass even if flush silently wrote a file.
- predicted: some · documented: none · derivable: no · legible: full · trap: yes
- note: Test name asserts a disk-related guarantee but the body never touches or checks the filesystem — it only verifies the in-memory entry count after flush(), so a regression that made ephemeral caches write to disk would not be caught here.

### `a_cache_written_by_another_model_is_dropped_not_merged` — OBSCURE — TRAP
- spec 1 · read at `2c0e0adcb678` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Writes a cache file to disk tagged with one model, then calls Cache::open (or similar) with a different model name, and asserts the old entries are discarded rather than merged in — exercising the actual model-mismatch filtering logic in the cache-loading path.
- found: Writes a Stored struct (model \"old-model\", one entry) to a temp file as raw JSON, reads it back with plain serde_json::from_str (not through Cache::open at all), and asserts loaded.model != \"new-model\" — a tautological string comparison between two hardcoded literals that never exercises Cache::open's actual model-filtering/drop logic.
- predicted: none · documented: none · derivable: no · legible: most · trap: yes
- note: The test name promises verification that Cache::open drops a cache written by a different model, but the body never calls Cache::open — it only checks a hardcoded string inequality that would pass regardless of whether the real filtering logic exists or works.

## src-tauri/src/churn.rs

### the file itself
- spec 1 · read at `0c7433ce609f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: One git-log pass builds a History of per-path churn/age/last-touched/last-author, crediting directories once per commit and rolling up to ancestors, with churn saturating at a fixed absolute anchor rather than repo-relative, degrading gracefully for non-repos.
- found: Matches essentially exactly: History with churn_of/commits_of/last_touched_of/last_author_of/age_of/last_commit_of; read() runs one git log with a custom delimiter format; parse_log/flush_commit/credit accumulate per commit, deduping a commit's touched directories via a HashSet before crediting each once; CHURN_SATURATION=8.0 is an absolute anchor specifically to stop a generated lockfile from squashing real files' churn.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `churn_of`
- spec 1 · read at `f4b1287a3800` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Looks up recent-commit count for the path and returns it normalized to 0..1 against an absolute CHURN_SATURATION constant, clamping, with 0 for a path with no history.
- found: Exactly that: returns 0.0 if path isn't in self.files, otherwise recent_commits divided by CHURN_SATURATION, clamped to [0.0, 1.0].
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `commits_of`
- spec 1 · read at `0fca6b992d7a` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up the raw commit count for a given path in an internal map, returning the count or 0 if not present.
- found: Returns self.files.get(path).map(|h| h.recent_commits).unwrap_or(0) - looks up the file entry and returns its recent_commits field, defaulting to 0 if the path isn't tracked.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The doc comment is on the file/module (History) describing commits_of/churn_of distinction generally, not this specific one-liner.

### `last_touched_of`
- spec 1 · read at `b2dfed3bfff2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up path in an internal map and returns days since last commit as f32, computing it from a stored timestamp, or None if not found.
- found: Simple map lookup: self.files.get(path).map(|h| h.last_touched_days) — the days value is precomputed and stored on the file's history struct, not computed here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `last_author_of`
- spec 1 · read at `71fc831087df` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Looks up path in self.files and returns the cloned last_author as Option<String>, None if missing.
- found: Same, but also filters out empty-string authors, turning them into None.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `age_of`
- spec 1 · read at `f204332fb880` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up path in a map and returns computed age in days from oldest commit timestamp, computing now-minus-oldest at call time.
- found: Just does a map lookup on self.files and returns the already-precomputed h.age_days field (computed elsewhere during the log parse, not at call time).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `last_commit_of`
- spec 1 · read at `fda8fa978861` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Map lookup returning stored commit oid string for the path, None if not in window.
- found: Map lookup as predicted, plus filters out empty-string commit values, turning them into None as well.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `is_empty`
- spec 1 · read at `6c522ef55697` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Delegates to an internal collection's is_empty(), likely checking whether the parsed history has no data.
- found: Returns self.files.is_empty() exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `read`
- spec 1 · read at `8aeeb414bca3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Runs a single git log command over the repo, parses it via parse_log into a History struct; returns default/empty History if not a git repo rather than failing.
- found: Spawns 'git -C repo log --no-merges --format=%x01%ct%x02%an%x02%H --name-only --max-count=MAX_COMMITS'; on spawn error or non-zero exit returns History::default(); otherwise lossily decodes stdout and calls parse_log(text, now_secs()).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `now_secs`
- spec 1 · read at `e9ed17b3f23e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns current unix timestamp in seconds as i64, via SystemTime::now/duration_since UNIX_EPOCH.
- found: Exactly that, with unwrap_or(0) fallback if the clock is before epoch.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `credit` — QUIRKY — TRAP
- spec 1 · read at `1a421829daf9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Gets/creates FileHistory entry for key, increments commit count, and updates last-touched/author/commit-oid and age tracking based on recency comparison.
- found: Gets/creates entry; relies on git log's newest-to-oldest ordering (not timestamp comparison) so first sighting = last touched/author/commit; increments recent_commits only if within CHURN_WINDOW_DAYS; unconditionally overwrites age_days each call so the final call (oldest commit) is what sticks.
- predicted: some · documented: most · derivable: no · legible: most · trap: yes
- note: Correctness depends entirely on caller feeding commits in git log's newest-first order; nothing in the function itself enforces or checks that invariant.

### `flush_commit`
- spec 1 · read at `cd3690e69372` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Applies a commit's file list to FileHistory per file, and separately credits each distinct ancestor directory exactly once via a computed directory set, then clears the touched buffer.
- found: Guards on ts==0 or empty touched (clearing and returning early). Computes age_days from now-ts. Walks each touched path's '/' boundaries to collect the set of distinct ancestor directories. Credits every touched file via `credit`, then credits every distinct ancestor directory once via the same function. Clears touched at the end.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Docs matched the body closely, including the exactly-once directory crediting rationale.

### `parse_log` — TRAP
- spec 1 · read at `c5c2933cf7c0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Parses raw `git log` text plus a `now` timestamp into a `History` struct: walks lines, tracking commit boundaries (hash, author, timestamp) and the files touched by each commit, accumulating per-file/per-directory churn, commit counts, last-touched time, last author, and age, calling `flush_commit` at each commit boundary. Split out from `read` (which shells out to git) so this parsing logic is unit-testable without a git repo and with a fixed clock.
- found: Parses git log output using control-character delimiters (\x01 marks a new commit record, \x02 separates timestamp/author/oid within it) since it's a single `git log` pass rather than one invocation per file. It accumulates touched file paths per commit into a `touched` Vec, and calls `flush_commit` to commit accumulated state into the `files` HashMap whenever a new commit header is hit (and once more at EOF). Uses `commit_ts == 0` as a sentinel for "no commit seen yet" to skip stray path lines before the first commit header, and splits author/oid from the right to protect against `\x02` appearing inside an author name.
- predicted: most · documented: some · derivable: no · legible: most · trap: yes
- note: The commit_ts==0 sentinel doubles as both an uninitialized-parser marker and a possible (if vanishingly unlikely) real epoch timestamp, which would silently drop that commit's touched files.

### `a_commit_touching_three_files_counts_once_for_their_directory`
- spec 1 · read at `e7dd0e3164f6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test verifying a single commit touching three files in one directory counts as one commit for that directory, not three, via parse_log on synthetic data.
- found: Builds a raw git-log-format string (one commit touching src/a.rs, src/b.rs, src/c.rs), parses it with parse_log, and asserts commits_of(\"src\") == 1 while commits_of(\"src/a.rs\") == 1.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `directory_commits_accumulate_and_reach_every_ancestor`
- spec 1 · read at `37a48eee2c7f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test verifying that a commit touching a nested file credits commit counts to every ancestor directory, not just the immediate parent.
- found: Confirms commits_of for file, immediate dir, and grandparent dir all accumulate correctly across two commits touching different files in the same subdir, and also checks last_touched_of picks the most recent (newest-first) commit's age.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `oldest_commit_sets_age_and_recent_ones_set_churn`
- spec 1 · read at `e247eed68707` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test constructing a synthetic commit history with commits at different ages touching different files, then asserting age_of reflects the oldest commit for a file while churn_of reflects the count/weight of recent commits, showing age and churn are computed from different ends of the log.
- found: Builds a raw git-log-formatted string (newest-first) with three commits over 400 days touching src/a.rs and src/b.rs, parses it via parse_log, and asserts age_of returns the oldest commit's age per file (400.0 vs 10.0, None for missing files), last_author_of returns the newest commit's author (not oldest), and churn_of weights a.rs's two recent (within 90-day window) commits higher than b.rs's one, excluding the 400-day-old commit from churn.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `one_pathological_file_does_not_squash_the_rest`
- spec 1 · read at `577dcf3c2de9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test that an outlier file with an extreme commit count (e.g. a generated lockfile touched hundreds of times) saturates its own churn score rather than skewing the normalization scale so that normal source files still register meaningful, non-flattened churn scores.
- found: Builds a synthetic git log where Cargo.lock is touched 500 times and src/hot.rs 10 times, parses it, and asserts Cargo.lock churn saturates to exactly 1.0 while src/hot.rs still scores above 0.5 rather than being crushed toward 0 by the lockfile's scale.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `churn_saturates_rather_than_running_away` — QUIRKY
- spec 1 · read at `ee541947758d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test verifying churn score is bounded/saturating rather than growing unboundedly with commit count, likely comparing two files with different churn levels.
- found: Parses a single-commit log touching src/a.rs and asserts churn_of returns a value within [0.0, 1.0] — a simple range check, not a comparison across churn levels.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `a_directory_that_is_not_a_repo_scores_without_history`
- spec 1 · read at `e68b97e30a4b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Test that read() on a non-repo directory returns an empty History rather than erroring.
- found: Calls read() on a bogus path, asserts h.is_empty(), plus churn_of(\"anything\") == 0.0 and age_of(\"anything\") == None — confirming the accessor methods degrade gracefully too, not just is_empty.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/cli.rs

### the file itself
- spec 2 · read at `75e9313157f5` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This file is the CLI/headless entrypoint for the Tauri app — it implements `sanity serve`, `sanity check`, and read-only verbs (status, summary, refresh, grades) so the backend can run as a process without a GUI window. It contains spawn-lock machinery to ensure only one process starts the backend at a time (spawn_lock_path, SpawnLock::drop, take_spawn_lock*), HTTP helpers to probe/wait for and talk to that backend (await_backend, probe, live, get, post, ensure_backend), output formatting helpers (fancy, plural, bar, elapsed, grade_ink, commas, num, text), an interactive chooser, and a main() dispatching subcommands; the snake_case sentence-like names at the end are unit tests encoding invariants (progress line correctness, flags vs repo distinction, single spawn lock, stale lock takeover).
- found: It's the headless CLI backend for the Tauri app: spawn-lock machinery (spawn_lock_path, SpawnLock, take_spawn_lock/_after) using O_EXCL for atomic single-spawner enforcement with staleness-based lock stealing; HTTP helpers (probe, live, get, post, await_backend, ensure_backend) that talk to a loopback backend and spawn one via `sanity serve` on the current binary if none is running; `serve()` runs the daemon loop with idle-timeout standdown, SIGTERM/SIGKILL handling, and takeover detection when the GUI app claims the endpoint; `interactive()`/`choose()` gate any prompting on both stdin and stdout being real terminals; `init()` records harness/model choice for a repo (optionally interactively) via `reports::set_harness`/`set_reader`; `check()` opens a repo, resolves which model reads it (repo-configured vs CLI-flag vs interactively chosen), and kicks off a run. Formatting helpers (commas, num, text, resolve) support human-readable output. The module doc and dozens of inline comments extensively narrate WHY each design choice was made (deleted `sanity study`/`OllamaModel`, process-group SIGINT fix, lock staleness derivation, etc.) — far more design history than I predicted.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Predicted the mechanical shape correctly but underestimated how much of the file is dense design-rationale prose explaining historical bugs and deleted features rather than just code.

### `spawn_lock_path`
- spec 2 · read at `d361e1076438` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:31:17Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns the path to a lockfile in the per-machine data directory (next to the endpoint file), used to serialize backend-spawning attempts. Returns None if the data directory can't be resolved.
- found: Exactly as predicted: joins "backend.lock" onto the shared data_dir(), propagating None via ? if that dir isn't available.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `drop`
- spec 2 · read at `69cf296adc7d` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:35Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Releases the spawn lock: removes the lock file at spawn_lock_path (or otherwise unlocks it) so the lock does not persist past this process's attempt to spawn the backend, preventing other processes from being stuck waiting on a stale lock.
- found: Removes the lock file at self.0, ignoring errors, releasing the spawn lock on drop.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `take_spawn_lock`
- spec 2 · read at `fa780535fef0` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:40Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper that gets the current time and calls take_spawn_lock_after(now) to do the actual O_EXCL create-or-fail-with-staleness logic described in the docs, returning its Option<SpawnLock> result directly.
- found: Thin wrapper calling take_spawn_lock_after(SPAWN_LOCK_STALE), passing the staleness threshold constant rather than a timestamp.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I guessed it passed the current time to the sibling function; it actually passes the staleness duration constant instead.

### `take_spawn_lock_after`
- spec 2 · read at `ed57494c5c9f` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:31:02Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Tries to atomically create the spawn lock file (exclusive create); if that fails because the file already exists, reads its metadata/mtime and compares age against `stale` — if older than the threshold, treats the existing lock as abandoned, removes it, and retries acquiring it (the "steal"). Returns Some(SpawnLock) if the lock was acquired (fresh or stolen), None if a live lock is still held by someone else.
- found: Uses create_new (atomic exclusive create) to claim a lock file, writing the current PID into it. If claiming fails because the file exists, checks its mtime age against `stale`; if abandoned, removes and retries the claim once. Returns Some(SpawnLock) on success, None otherwise.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `await_backend`
- spec 2 · read at `da14bbe73ef3` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:31:01Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Loops, periodically reading the endpoint file and calling probe/live on it, sleeping briefly between attempts, until it gets a successful response or Instant::now() passes deadline. Returns Some(Endpoint) once a live backend is found, None if the deadline expires first.
- found: Polls live() in a loop with a 250ms sleep between attempts until it succeeds or the deadline passes, returning Some(Endpoint) or None accordingly.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `probe`
- spec 2 · read at `7ca556d1e644` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Sends an HTTP GET via the `get` helper to the backend's health/status endpoint derived from `ep`. If the request succeeds, parses the JSON response body and extracts a `pid` field, returning Some(pid). If the request fails or the response can't be parsed, returns None. Never reads a pid from the endpoint file itself.
- found: Builds a blocking reqwest client with a timeout, GETs {ep.url()}/health, parses JSON, and extracts/returns the pid field as u32, using Option chaining (?) to collapse any failure to None.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `live`
- spec 2 · read at `94a2ad12969a` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:41Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Reads the per-machine endpoint file written by a running `sanity serve`, parses it into an Endpoint, then calls `probe` against it to confirm the process is actually still alive and answering. Returns Some(endpoint) only if both the file exists and the probe succeeds; None otherwise (missing file, stale file, or dead process).
- found: Matches prediction closely: reads the endpoint file, probes it, and returns an Endpoint with the pid from the probe (not necessarily the one in the file) merged in via struct update syntax — a detail I didn't call out specifically.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `get`
- spec 2 · read at `311c7de833b5` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Does a synchronous HTTP GET to the local backend endpoint (ep's URL + path), parses the JSON response body into a serde_json::Value, and converts any transport or parse error into a String error — the GET counterpart to a `post` sibling.
- found: Blocking HTTP GET to ep.url()+path, parses JSON response into a Value, maps errors to String.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `post`
- spec 2 · read at `6097e8772f8d` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:28Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Sends an HTTP POST to the backend at ep's address/path with body serialized as JSON, then parses and returns the JSON response body as a serde_json::Value, mapping any request/connection/parse failure to a String error. Mirrors a sibling `get` function used for read-only calls.
- found: Blocking HTTP POST to ep.url()+path with body as JSON, chains .send() into .json() to parse the response, mapping any error to a String.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `ensure_backend` — QUIRKY
- spec 2 · read at `d81c3321789c` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:59Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Checks SANITY_BACKEND env var first and returns that Endpoint if set. Otherwise probes for an already-live backend and returns it if found. Otherwise calls take_spawn_lock(); if it wins the lock, spawns `sanity serve` via std::env::current_exe() (not PATH) as a child with null stdio and not detached from the terminal session, then waits for it to become live via await_backend. If the lock is already held by another process, it just waits for that other backend to come up instead of spawning a second one.
- found: Checks live() first regardless of SANITY_BACKEND; if not live and SANITY_BACKEND is set, errors immediately rather than spawning (I predicted it would return an endpoint from the env var, but the env var's value is apparently consumed by live() itself and here it's only used to decide whether to error instead of spawn). Otherwise takes the spawn lock, re-checks live() under the lock (double-check I missed), spawns `sanity serve` via current_exe with null stdio, and on Unix puts the child in its own process group specifically so Ctrl-C (which signals the whole foreground group) doesn't kill the daemon along with the CLI — a detail not obvious from the doc summary and one I did not predict at all.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `commas`
- spec 2 · read at `9e6a9f989078` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:31:09Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Formats a u64 into a string with thousands separators (e.g. 1234567 -> "1,234,567"), by converting to a digit string and inserting commas every three digits from the right.
- found: Exactly as predicted: converts to a digit string and inserts a comma every three digits from the right, using modular arithmetic on the remaining-digit count to decide placement.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `num`
- spec 2 · read at `fe762c4e62a4` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:44Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Extracts a numeric field from a serde_json::Value by key, coercing it to u64 — likely v.get(key).and_then(|x| x.as_u64()).unwrap_or(0), used to pull counters out of JSON responses from the backend's HTTP API.
- found: v.get(key).and_then(|x| x.as_u64()).unwrap_or(0) — exactly as predicted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `text`
- spec 2 · read at `7b81ea5945d2` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:44Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: JSON accessor helper: v[key].as_str() with a fallback (likely empty string) when the field is absent or not a string — the string counterpart to a `num` sibling helper for numeric fields.
- found: v.get(key).and_then(|x| x.as_str()).unwrap_or(""), exactly as predicted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `resolve`
- spec 2 · read at `ad2b1804e3c0` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:48Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Canonicalizes the given path string (via std::fs::canonicalize or similar) into an absolute PathBuf, converting any filesystem error into a String, so the CLI's path resolution matches how project_key canonicalizes paths on the backend.
- found: std::fs::canonicalize(path), mapping error to a String formatted as "{path}: {e}".
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `serve` — QUIRKY
- spec 2 · read at `18ddc942b1d5` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:38:28Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Probes for an already-live backend and exits 0 immediately if found (idempotent, not exclusive — no locking needed against another UI since the second one never starts). Otherwise takes the spawn lock, sets up/writes the endpoint file, builds a tokio runtime, runs the axum router blocking in the foreground, and returns an exit code reflecting success/failure of setup or shutdown.
- found: Checks live() and exits 0 if already serving; otherwise builds a tokio runtime, restores prior state, binds the axum server, spawns a signal handler (SIGTERM/ctrl_c) that stops all runs and releases the endpoint on kill, then loops on a watch interval checking whether the endpoint file was taken over by the window app or removed (standing down and stopping runs if so) or whether the backend has been idle past IDLE_FOR (standing down similarly), never using a spawn lock directly in this function.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: No spawn-lock usage here at all (that must live in a caller like ensure_backend) — I predicted it wrongly; the real logic is a takeover-detection + idle-timeout watch loop plus a signal handler for cleanup on kill.

### `choose`
- spec 2 · read at `ae1003f026ee` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:58Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Prints prompt + numbered options (marking default), reads a trimmed line from stdin. Empty input returns None (meaning "you decide"). A numeric in-range answer returns the corresponding option; otherwise the raw typed text is returned as Some(text), covering free-form answers.
- found: Prints numbered options with default marked, reads stdin; on read error or empty line returns default (not flatly None); a numeric in-range answer indexes into options, otherwise the raw text is returned literally as Some.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc said empty answer returns None, but code actually returns default.map(...) on empty/error, which is None only when default is None itself — simplification in the doc.

### `reveal_in_window`
- spec 2 · read at `6d65d648b846` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: If show is true, ensures a backend is running for the repo and then makes an HTTP call (likely to an /open endpoint) to point the app window at that project; if show is false it does nothing; failures are swallowed rather than propagated, matching the docs.
- found: Early-returns if show is false; otherwise ensures a backend is running and POSTs to /open with the repo path and focus:true, ignoring the result.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `init` — QUIRKY — TANGLED
- spec 2 · read at `9dcfb5c820e6` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:31:03Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: The CLI handler for `sanity init` — resolves the repo path, ensures a backend process is running (via ensure_backend), posts a request to record the harness/model choice for that project (via post), prints confirmation (and dumps current settings if show is set), and returns a process exit code.
- found: Resolves and validates the repo path, records the model if given, then interactively (or non-interactively) resolves which harness to use — prompting via `choose()` when a TTY is present and nothing is configured, otherwise printing current state and available agents without guessing. Once a harness is chosen it validates it, warns if not on PATH, records it via `set_harness`, optionally prompts for a model choice, and prints a closing summary with the `sanity check` next-step hint. Returns various exit codes for different failure/success paths.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: I assumed it called ensure_backend/post to talk to a running backend process, but it actually writes directly via crate::reports (no backend round-trip) and has much more nuanced interactive/non-interactive branching than I predicted.

### `check` — QUIRKY
- spec 2 · read at `f043dc56d790` · commit `e5ac296` · read by claude-sonnet-5 · when 2026-08-13T19:41:25Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Ensures the backend server is running, resolves the project path, then spawns `readers` concurrent reader subprocesses (each shelling out to the authenticated CLI as a stateless MCP client) that loop through next/reveal/report against the given `model`, up to `limit` items, printing progress via a bar; if `detach` is true it returns immediately rather than blocking on completion, and returns a process exit code.
- found: Resolves the repo path and backend endpoint, opens the project via HTTP POST /open, resolves which model to use (explicit flag > previously-used model from /status > interactive prompt > harness default), then POSTs /check to the backend (which owns spawning the actual reader subprocesses), prints a status message about what's reading and with what model, and either returns immediately if --detach or tails progress/output until done or Ctrl-C.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `resume`
- spec 2 · read at `0cf8aa4b1125` · commit `e5ac296` · read by claude-sonnet-5 · when 2026-08-13T19:41:26Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Re-opens the current repo (likely from cwd) against the new backend `ep` via an HTTP call like /open, then re-issues the same wave/run request using the fields in `want` (limit, filters, etc.) via something like /start. Returns Ok(()) if both calls succeed, Err(()) otherwise, so tail() can decide whether to keep following the new backend.
- found: Posts /open with the repo path to re-open the project on the new backend, then posts /check with project key, model, readers, and limit from `want` to restart the same wave. Returns Ok(()) only if both calls succeed and report ok:true, else Err(()).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `plural`
- spec 2 · read at `5d2354082e2b` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:52Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Simple pluralizer: takes a count and word, returns "{n} {word}" singular for n==1, appending "s" otherwise — e.g. "1 reader" vs "5 readers".
- found: Exactly as predicted: n==1 returns "{n} {word}", else returns "{commas(n)} {word}s" — the one detail I missed was that it routes the plural count through commas() for thousands separators.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed that plural() calls commas() internally for large counts, otherwise exact match.

### `bar`
- spec 2 · read at `d5c39b979261` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:43:14Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a text progress bar for a fraction 0.0-1.0: builds a fixed-width string of filled/empty block characters proportional to frac, with careful rounding so the bar reads correctly at frac=0 and frac=1 (fully empty/fully full), matching the file's noted test about the progress line at both ends.
- found: As predicted: clamps frac to [0,1], rounds to a fill count out of a fixed BAR width, and formats filled block chars + empty block chars. Used a named constant BAR rather than a literal, and clamp+round is exactly the correctness-at-both-ends mechanism I guessed at.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `elapsed`
- spec 2 · read at `eb69519c2bbf` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:52Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes since.elapsed().as_secs(), then formats as "3m20s" if >= 60 seconds (minutes and remainder seconds via division/modulo), or just "40s" if under a minute.
- found: Formats since.elapsed().as_secs() as "Ns" if under 60, or "Mm{SS}s" with zero-padded seconds otherwise.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `grade_ink`
- spec 2 · read at `a4f8bf69d4ec` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:43:04Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Maps a grade string ("full"/"most"/"some"/"none") to an ANSI color-code pair (open, reset) — dimmest/gray for "full" since that's the boring expected case, and brightest/most alarming (e.g. red/bold) for "none" since that's the interesting finding; likely checks terminal support and returns empty strings otherwise.
- found: Matches prediction closely: fancy()-gated ANSI pair, "full" dimmed, "none" brightest (bold yellow), but I got the middle cases wrong — "most" is plain/uncolored (not a gradient step) and "some" is yellow, "none" is bold yellow rather than red; unknown grade falls back to dim.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The color scale isn't a smooth gradient — "most" is deliberately uncolored, only "some"/"none" get warning colors.

### `tail` — QUIRKY
- spec 2 · read at `3ecfd051e457` · commit `e5ac296` · read by claude-sonnet-5 · when 2026-08-13T19:41:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Polls/subscribes to the Endpoint for the project identified by `key`, repeatedly fetching its current status and printing progress lines (like `tail -f`) filtered/formatted according to `want`, until the operation reaches a terminal state (done/error) or is interrupted. Returns an integer process exit code reflecting success (0) or failure (non-zero) of the underlying operation.
- found: Polls the backend's /status endpoint every 2s in a loop, printing a table of individual readings (name + grade columns) as new events arrive, plus a live pinned progress bar when attached to a terminal. Handles Ctrl-C by posting /stop and continuing to tail until the run actually ends; handles the backend dying mid-run (e.g. because the app window was opened) by waiting for a new backend and transparently resuming the tail against it. Prints a final summary (readings done, elapsed time, failures) and returns 0 on normal completion or 1 if the run was lost with no replacement backend found.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: Missed the backend-failover/resume behavior and the per-reading grade table entirely in my prediction; only got the general polling/progress/exit-code shape right.

### `project_header`
- spec 2 · read at `3445d23dbf96` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:41:55Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Prints a single unified header line built from a JSON Value (project state) showing project name/path and progress stats — assessed count vs total, percentage — computed consistently so status and summary agree on denominator, staleness, and whether file headers count.
- found: Prints project name, segment counts (functions + file headers, minus .sanityignore exclusions), read/unread/stale counts with percentages (computed so the three sum disjointly, unread = remaining - stale), optional in-flight readers count, and the assessment file path.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The inline comment about remaining containing stale and needing subtraction to get disjoint states was the key nuance I didn't predict.

### `offline_status`
- spec 2 · read at `bb642af55251` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Calls read_repo to get scan+reports, then builds a JSON Value shaped like the /status endpoint's payload (likely using offline_counts for the numeric fields), omitting backend-only fields like in_flight rather than zeroing them, and returns None if read_repo fails.
- found: Calls read_repo, feeds result into agentapi::offline_counts, and assembles a json! Value with project name, repo path, the counted fields, and the assessment_file directory path.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `offline_summary`
- spec 2 · read at `df7017f7e5c0` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Reads the committed .sanity/ assessment data directly from the given repo path without a running backend, computes aggregate statistics via the shared aggregate_of function, and returns them as a Value matching the /summary endpoint's payload shape — None if no assessment is found in the repo.
- found: Reads the repo's local scan+reports via read_repo, combines offline_counts (functions/files/excluded/assessed/remaining) with aggregate_of (stale/total/by_model/by_position/priming) into one JSON object matching the same shape the /summary endpoint would return, returning None if the repo has no readable state.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Didn't anticipate two separate helper calls (offline_counts vs aggregate_of) being combined into the field set.

### `read_repo`
- spec 2 · read at `920cec0756e2` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:42:03Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Scans the given repo path (via the scan module, enumerating files/functions) and loads the committed reports (presumably from a .sanity directory) into a HashMap<String, Report>, returning both as a tuple, or None if the path isn't a valid/scannable repo.
- found: Opens a ScanCache for the repo, runs crate::scan::scan with a HeuristicModel proxy scorer and no-op progress/reading callbacks at Fidelity::Ordering (since proxy scores aren't printed), prints an error and returns None on scan failure, then loads committed reports via assessment::load and returns both.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `read_verb` — QUIRKY
- spec 2 · read at `b00c20b44efb` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:55Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Resolves the given path to a canonical repo key and checks whether a backend process is already serving it. If so, makes a GET-style request to `endpoint` against that backend and returns the parsed JSON Value. If no backend is serving that repo, it does NOT start one — it returns Err with an exit code and prints/logs a message telling the caller to run the appropriate open/check command first, since read verbs must not have the side effect of opening or rescanning a repo.
- found: Resolves the path to a repo, then if no backend is live, or the live backend has no open project matching this repo, falls back to computing an offline status/summary directly from the repo/committed .sanity data rather than erroring. Only when a backend IS live and has this project open does it forward the GET request and return its JSON.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I expected a hard failure telling the user to run `check` when no backend was serving the repo, but it actually computes an offline answer from the repo itself in that case — the doc explains this reasoning but I hadn't predicted the graceful fallback, only the refusal path.

### `status` — QUIRKY
- spec 2 · read at `139061bd94ca` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:00Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Calls the local backend's `/status` endpoint for the given repo path, and formats/prints the JSON response as human-readable CLI output — likely a progress bar or percentage, counts of assessed/remaining functions, and grade summaries — using helper formatters like `bar`, `fancy`, `grade_ink`, `elapsed` from its peers. Returns a process exit code (0 on success, non-zero if the backend can't be reached or the project isn't found), and does no computation of its own beyond formatting, per the docs' warning against duplicating logic already computed server-side.
- found: Fetches /status via read_verb, then prints whether the backend daemon is running (with pid/port), whether a read is currently in progress (model, live reader count, spawned/failed counts), a project header, and finally either "up to date" or a count of segments needing `sanity check`. No progress bar or grade breakdown — it's about daemon/run state plus a remaining-work count, not scoring.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: I expected progress-bar/grade-summary formatting since those helpers were in the peer list, but this function is actually about daemon/liveness status, not grades.

### `summary` — QUIRKY
- spec 2 · read at `eff0bb2d75a1` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:05Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: CLI command handler for `sanity summary <path>` that loads the repo's assessment data, computes aggregate stats (count assessed, surprised rate, grade distribution), formats them with helpers like grade_ink/bar/fancy, prints to stdout, and returns an exit code (0 success, nonzero if no data yet).
- found: Prints an aggregate report for a repo: header, early-exit if nothing read yet, a three-row grade histogram table (predicted/documented/legible), then trap count, unhelpful-doc count, per-model reading counts, priming (primed vs clean) stats, and a by-position curve showing % of 'full' predictions at each batch position.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Got the overall shape (load data, print histogram table, exit code) but missed nearly all the specific sections: traps, derivable docs, by_model breakdown, priming stats, and the by_position curve.

### `refresh`
- spec 2 · read at `822a2c8b51c0` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:29Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Resolves the given path to a repo root, calls assessment::refresh directly in-process (bypassing any running backend/daemon, per the doc's explanation of why) to rewrite .sanity/ in the current format, prints a status/summary line (or a message saying nothing needed refreshing if there was no assessment), and returns a process exit code — 0 on success, nonzero for an invalid path or error.
- found: Canonicalizes the path, bails early if no .sanity/ exists, then actually re-scans the whole repo (needed to build the Scan/reports that assessment::refresh requires), loads existing reports, and calls assessment::refresh, matching on a 4-variant Index result (Failed/Absent/Current/Refreshed) to print a tailored message and pick the exit code for each.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `grades`
- spec 2 · read at `734a8bc65ba7` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes an Option<&Value> holding counts for the four-point scale (full/most/some/none) and formats them as one row of fixed-width, right-aligned numbers with no labels (labels now live in a shared header row printed once elsewhere). Returns some placeholder/blank row if v is None or fields are missing.
- found: Formats one grade-table row: an em-dash placeholder if v is None, else the four scale counts (full/most/some/none) each right-padded to width 7 with comma-separated thousands, concatenated with no labels.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted the shape correctly; missed that missing v renders a single dash column rather than four blanks, and the comma-formatting detail.

### `main`
- spec 2 · read at `d83e3e8cd19a` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:20Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Parses `args` to find a subcommand (e.g. "check", "status", "summary", "tail", "refresh", "grades"), dispatches to the matching handler function, and returns an integer exit code (0 success, non-zero for errors/unknown command). Likely prints usage/help when no subcommand or an unrecognized one is given.
- found: Uses clap to parse args (with "sanity" prepended since argv[0] was stripped), handling --help/--version/errors with correct stdout/stderr and exit code (0 vs 2) via clap's own error printing. Then matches on the parsed Verb enum (Serve, Mcp, Init, Check, Status, Summary, Refresh) and dispatches to the corresponding handler function, returning its exit code. Comments explain why "sanity" is re-added and why Mcp is only reached as a fallback.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `the_progress_line_reads_correctly_at_both_ends` — QUIRKY
- spec 2 · read at `e58761c44962` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:38:29Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds the CLI progress line at both boundary states — zero progress and fully complete — using the bar/elapsed/plural helpers, and asserts the rendered string is correct and sensible in both cases (no negative counts, correct pluralization, bar rendered fully empty or full), catching off-by-one or formatting edge cases in the line users watch for minutes.
- found: Unit test asserting bar(0.0)/bar(1.0) have no filled/empty chars respectively, bar() always renders at fixed width BAR regardless of fraction (including out-of-range 1.4, clamped not panicking), and plural() correctly pluralizes 0/1/5 counts.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I imagined it assembling a full composed progress-line string; it actually just unit-tests the bar() and plural() helpers directly, not the whole line.

### `a_flags_value_is_not_the_repo`
- spec 2 · read at `23ede843bbce` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:16Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that parses command lines like `sanity init --harness claude` and asserts the resolved repo path is not the flag's value (e.g. not "claude"/"./claude"), confirming clap-based parsing correctly distinguishes flag values from the positional repo path argument.
- found: Test using clap's Parser to check that path defaults to "." when only flags follow a verb (with both space and =-form flag values), that a real path wins whether it comes before or after flags, that a valueless flag doesn't swallow the next arg, and that an unknown flag errors rather than being silently dropped.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the extra cases: valueless-flag-doesn't-swallow-next-arg, and unknown-flag-errors — the doc's own point about the old hand-rolled parser's silent failure.

### `only_one_caller_may_start_a_backend_at_a_time` — QUIRKY
- spec 2 · read at `e9104fbd590c` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:31:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This is a test function that simulates a "cold wave" of concurrent ensure_backend/spawn-lock callers (likely spawning several threads at once) and asserts only one of them actually wins take_spawn_lock / spawns a backend process, while the rest wait and get the same endpoint back.
- found: A sequential (not multi-threaded) unit test: takes the spawn lock, asserts a second take fails while held, drops it, then asserts a third take succeeds — testing exclusivity and release-on-drop directly rather than via simulated concurrent callers.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Expected a simulated concurrent/threaded "cold wave"; the test actually verifies the lock semantics with plain sequential calls.

### `an_abandoned_spawn_lock_is_taken_rather_than_blocking_forever`
- spec 2 · read at `da454e03c676` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:50Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test verifying lock-staleness behavior: it creates a lock file, backdates its mtime past START_WAIT, then asserts a new caller can acquire/steal the lock instead of blocking forever; and that a fresh (young) lock is respected and blocks/waits instead of being stolen.
- found: Test that take_spawn_lock_after(threshold) refuses to steal a lock younger than the threshold (returns None when duration is large), but does steal it when the threshold is Duration::ZERO (anything counts as too old). It also verifies that after both the original holder and the thief drop their locks, a fresh take_spawn_lock() succeeds — confirming release happens by path so the thief's drop doesn't orphan or double-free the lock for a third caller.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/commands.rs

### the file itself
- spec 2 · read at `42886822b551` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:03Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: The Tauri invoke surface: a large collection of #[tauri::command] functions that are the sole bridge between frontend JS and Rust backend (no server/sidecar). Covers project management (add/forget/scan projects), git repo/history scanning, reading source/curve data, an agent activity/report viewer, MCP client config (connect/disconnect/edit clients), CLI install/link/status, and check running (start/stop). Mostly thin wiring that delegates to other modules, grouped by feature area rather than by concern.
- found: It is indeed the Tauri command surface, but far from thin wiring: each command carries real, carefully-reasoned logic and extensive prose comments explaining non-obvious design decisions (why streaming was rejected, why a global CANCEL flag rather than per-scan state, why add_project no longer requires .git, why on_path is checked via login shell not process PATH, why MCP client edits only touch files that already exist and parse). It covers repo scanning with live progress/cancellation, history replay, sandboxed source reading, a spawned code-view window, agent activity polling, project lifecycle (add/forget/rescan/focus), CLI symlink installation with PATH detection, and MCP client config detection/registration across five clients (JSON rewrite for four, read-only TOML awareness for Codex).
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `scan_repo` — QUIRKY
- spec 2 · read at `cbe57cf3c0ff` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:19:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the repo at req's path (likely respecting .gitignore via the `ignore` crate), counting lines per file and aggregating into a tree of directories/files with per-node line-count "scores" for the sunburst view. It probably does this work on a blocking thread (spawn_blocking or rayon) since it's a heavy synchronous walk, checks the shared state for a cancellation flag so a scan can be aborted mid-walk, and returns the fully-built Scan struct as one JSON payload rather than streaming partial results.
- found: Validates the path is a directory and a git repo, resets a global CANCEL flag, publishes a "restoring" placeholder into shared state for the sidebar before doing any work, then runs the actual scan on a spawn_blocking thread (rayon-parallel, CPU-bound) with callbacks that emit live "scan-progress" and "scan-score" events to the frontend as the walk proceeds. It uses an ephemeral cache for proxy scores and a persistent on-disk ScanCache for tree-sitter/git-blame memoization, clears the restoring placeholder afterward regardless of outcome, and on success inserts/updates the repo as a Project in shared state (merging in any prior .sanity-based reports) and focuses it, before returning the full Scan.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `scan_history`
- spec 1 · read at `a27e53522457` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Tauri command taking path and optional limit, offloading history::read_cached to a blocking thread since it's CPU-heavy, returning Result<HistoryScan, String>.
- found: Validates path is a directory, defaults limit to history::MAX_COMMITS, then spawn_blocking's a closure that emits "history-progress" events to the frontend via app.emit while calling history::read_cached(&root, limit, &emit); maps the join error to a string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `warm_history`
- spec 1 · read at `dac8c204bd4d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a timeline already exists for the given repo path and, if so, tops it up/refreshes it incrementally via history::warm; returns bool indicating whether it succeeded/existed. Fire-and-forget from frontend.
- found: Validates path is a directory (else returns false), then spawns a blocking task calling crate::history::warm(&root, MAX_COMMITS) and returns its result, defaulting to false on join failure.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_source`
- spec 1 · read at `c6b6cbc66ab8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Joins repo root with rel_path, canonicalizes both, checks the path is inside the repo, reads the file, and caps/truncates it at some max size.
- found: Runs in spawn_blocking; canonicalizes repo root, joins+canonicalizes rel_path, checks starts_with, then checks file metadata size against a 2MB cap and returns an Err (not a truncated read) if it's too large, otherwise reads the full file to a String.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I assumed it would truncate an oversized file rather than error out entirely.

### `open_code_window`
- spec 1 · read at `b5c68b62facf` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Sanitizes rel_path into a unique window label, focuses an existing window of that label if present, else builds a new WebviewWindow at index.html?code=... showing the file.
- found: Matches, plus: URL also carries repo= (both hand-percent-encoded, not via a crate, escaping only chars unsafe in a query string since '#' would truncate the URL); and on macOS applies the same overlay titlebar style and TRAFFIC_LIGHTS inset as the main window so secondary windows aren't visually inconsistent.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `agent_reports`
- spec 1 · read at `810b21775d1d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns the Vec<Report> for whichever project is currently shown, resolving the target from the optional `key` or falling back to the shared state's active project id, returning empty if neither resolves; used by the frontend to poll for coloring updates.
- found: Locks shared agentapi state, resolves the project key (param or fallback to active), looks up that project's reports map, and for each report recomputes `legible_dated` on the way out (via assessment::legible_current against the report's stored spec) rather than trusting a stored value, so a later change to the legibility-dating constants is reflected immediately without needing to rewrite stored data.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `agent_activity` — QUIRKY — TRAP
- spec 1 · read at `9961e7b7663e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Reads shared agent state and builds an AgentActivity snapshot with counts/status of in-flight agent sessions for the frontend.
- found: Locks shared state and builds AgentActivity with: active = whether last agent call was within the last 60s (IDLE_AFTER), the last tool name, a `nonce` (ping counter), and a list of recent (seq, tool) events mapped to AgentCall structs. Uses an is_some_and elapsed check, an idle-timeout heuristic not obvious from the signature alone.
- predicted: some · documented: none · derivable: yes · legible: most · trap: yes
- note: The 60-second IDLE_AFTER threshold for 'active' is a hardcoded magic constant baked into the command itself — future changes to what counts as 'recently active' require editing this function directly.

### `projects`
- spec 1 · read at `609bd3dd15cc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Tauri command that locks shared state and returns a ProjectList describing focus project plus all known projects, polled by frontend to follow sanity_open.
- found: Thin one-liner: locks the Shared state and delegates to ProjectList::from_state to build the actual structure.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `project_scan`
- spec 1 · read at `65127eb0a5bb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Locks shared state, looks up project by key, returns cloned scan or None.
- found: Exactly that: crate::agentapi::lock(&state).projects.get(&key).map(|p| p.scan.clone()).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `sync_theme_menu` — QUIRKY
- spec 1 · read at `38f284dd1ae9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Tauri command that ticks the matching theme menu item and unticks the others, directly manipulating menu state.
- found: Thin wrapper: fetches the ThemeMenu app state and delegates the actual ticking logic to themes.select(&theme); does no menu manipulation itself.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `sync_theme_menu` #2
- spec 1 · read at `b9bdcea5cb6f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A cfg-gated no-op stub (for platforms without an app menu) with unused, underscore-prefixed parameters and an empty body.
- found: pub fn sync_theme_menu(_app: tauri::AppHandle, _theme: String) {} — exactly an empty no-op.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `stop_scan`
- spec 1 · read at `f04a714f4d1c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Sets a shared cancellation AtomicBool to true so the scan loop stops between units of work.
- found: CANCEL.store(true, Ordering::Relaxed) — exactly that, one line.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `this_exe`
- spec 1 · read at `e4d1950a37d5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Gets current executable path via std::env::current_exe, converts to String with to_string_lossy, falls back to default/empty on error.
- found: std::env::current_exe().map(|p| p.to_string_lossy().to_string()).unwrap_or_default() -- exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `add_project` — QUIRKY
- spec 2 · read at `c839eb2b1eb1` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:38Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a user-picked directory path, validates it's a real directory (no longer requiring .git), registers it in the app's persisted project list/config, and returns the canonicalized path or project id on success, or an error string on failure (doesn't exist, already added, etc).
- found: Just checks the given path is a directory and returns its string form (or an error if not); no git check, no persistence, no dedup — actual registration must happen elsewhere (frontend or a later call).
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: Function is far simpler than the docs' historical narrative implied — it doesn't register/persist anything itself, just validates and echoes the path.

### `cli_link_dirs`
- spec 2 · read at `6b071bfebc5a` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns a Vec<PathBuf> of candidate directories, best-first, where a `sanity` symlink could be placed — likely including /usr/local/bin and ~/.local/bin/bin — for install_cli to try in order until one is writable/usable.
- found: Returns [/usr/local/bin, ~/.local/bin] — exactly the predicted best-first candidate list, with home_dir() lookup guarded by an if-let.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `install_cli`
- spec 2 · read at `a853479ec17b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Gets the currently running executable's path via current_exe, picks a suitable link directory from cli_link_dirs (likely trying each until one is writable), creates a symlink named `sanity` there pointing to the exe, and returns a CliLink struct describing the result (or an error string if none of the directories were writable).
- found: Loops candidate dirs from cli_link_dirs(), creating each if needed; for the first writable one it removes any stale existing 'sanity' link/file, symlinks (or hard-links on non-unix) the current exe there, checks if that dir is on PATH, and returns a CliLink{path, on_path}. If every dir fails, returns an error string listing them plus a manual ln -s instruction.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that it explicitly removes a pre-existing stale link first, and that the success struct also reports whether the dir is on PATH.

### `cli_status` — QUIRKY
- spec 2 · read at `d7e5137120d0` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:38:01Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Tauri command that checks the CLI link directories (via cli_link_dirs) for a symlink named `sanity` pointing at the current executable (this_exe), and returns a CliState struct reporting whether the CLI is installed, its path, and possibly whether it points to a stale/different binary.
- found: Checks cli_link_dirs for a `sanity` symlink this app made (`linked`/`path`), separately resolves what a shell would actually run via `which`/login-shell PATH lookup (`on_path`/`resolved`), and compares the resolved binary against the running app's own executable path to report `is_this_app` — distinguishing e.g. a Homebrew-installed CLI from this app's own link.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the core point: comparing the PATH-resolved binary against the running app's own exe to detect a different competing install (is_this_app), which the comment says is the entire reason for the function's structure.

### `forget_project`
- spec 2 · read at `3c24fd237f79` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:43Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Locks the shared state and calls a `forget` method (on AppState) with the given key, removing that project's entry from the in-memory projects map so it disappears from the sidebar. It does not touch the repo on disk or its .sanity/ readings.
- found: Exactly as predicted: locks shared state and delegates to AppState::forget(key), a one-line Tauri command wrapper.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `read_curve`
- spec 2 · read at `fcbe1637651f` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:26:43Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Thin Tauri command wrapper: locks/reads `state`, looks up the project by `key`, and delegates to an `agentapi::reading_curve`-style function to compute and return the per-function line counts as a `Vec<u32>`, likely returning an empty vec if the key isn't found.
- found: A one-line delegation: calls crate::agentapi::reading_curve(&state, &key) and returns its result directly.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `harnesses` — QUIRKY
- spec 2 · read at `75fdc10a2ddb` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that probes the machine for installed coding-agent CLIs (e.g. claude, maybe others) by checking if their binaries exist on PATH, and returns a Vec of JSON objects (one per known harness) with fields like name and whether it's installed/its path — so the frontend can display which agents are available without requiring MCP configuration.
- found: Maps over all known Harness variants, returning a JSON object per harness with id, whether it's installed, its available models (queried only if installed), and whether that model list is enumerated by the agent itself vs free-text.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `set_reader`
- spec 2 · read at `3b146afe17e3` · commit `2903db5` · read by gemini-3.6-flash-medium · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: set_reader is a Tauri IPC command invoked by the frontend to set the harness and model for a given project key. It retrieves the project from the shared app state, delegates to the persistent storage module to update the index, and returns Ok(()) or an error string.
- found: Tauri command looking up project repo path and name from app state lock, then calling crate::reports::set_reader with optional harness and model parameters.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Prediction accurately described the Tauri IPC command wrapper behavior.

### `start_check`
- spec 2 · read at `d100327457d3` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Tauri command invoked from the frontend: looks up shared app state, resolves the project/config identified by `key`, and calls agentapi::start_run with optional model/readers/limit overrides to kick off a wave of readers/checks. Returns a serde_json::Value describing the started run (e.g. run id or status), doing minimal work itself since the real logic lives in agentapi::start_run which is shared with the CLI and MCP tool paths.
- found: Thin wrapper that constructs a CheckRequest (project=key, harness=None, plus passed-through model/readers/limit) and forwards straight to agentapi::start_run with shared state, returning its JSON result.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Doc's point about this being the same function reached by CLI/MCP/window (avoiding a loopback socket) isn't visible in this function body alone — it's an architectural claim about the caller graph.

### `stop_check`
- spec 2 · read at `e21421c48024` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up the running "check"/wave identified by `key` in the shared state's map of active waves, and sets a stop/cancellation flag on it (e.g. an AtomicBool or similar) so that readers currently in the loop will observe it and stop once they finish their current reading, rather than being killed immediately. Likely returns Err(String) if no such key exists.
- found: Looks up the project by key in shared state, gets its current run, and sets an AtomicBool `stop` flag to true with Relaxed ordering. Returns descriptive errors if the project isn't open or nothing is running.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `mcp_command`
- spec 1 · read at `0f03810e446b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns the command/args to launch this app's own MCP server, for display/config in external MCP clients; wraps this_exe() path in a McpCommand struct.
- found: Calls this_exe() for the command, hardcodes args=[\"mcp\"], and also generates a pretty-printed JSON config snippet {\"mcpServers\":{\"sanity\":{\"command\":..,\"args\":..}}} for pasting into client configs. Returns McpCommand{command,args,json}.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `client_defs`
- spec 1 · read at `165bb3009136` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns a static list of known MCP client definitions (name, config path, format) used elsewhere to read/write client configs for connecting/disconnecting MCP servers.
- found: Exactly that: hardcoded Vec<ClientDef> for claude-desktop, claude-code, cursor, windsurf, and codex, each with id, name, config file path (built from home/config dirs), the JSON key holding MCP servers, and whether the file is JSON or TOML.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `mcp_clients`
- spec 1 · read at `c7c59f8ea31f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns known MCP client apps with status by reading each client's config file to see if Sanity is already registered as a connected server.
- found: For each known client def, reads its config file and computes present/registered/current: registered checks for a \"sanity\" entry under the client's config key, current checks whether that entry's command matches this running exe's path. Non-JSON configs (Codex uses TOML) fall back to substring search for \"sanity\" and the exe path instead of parsing.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `edit_client`
- spec 1 · read at `58fe79566d45` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Looks up client config path by id, requires the file exist and parse, then inserts/removes sanity's MCP entry depending on connect, writes back, returns success/path or error.
- found: As predicted, plus: refuses TOML-based clients outright; treats an empty existing file as {}; and explicitly special-cases claude-desktop to create its config from scratch on connect (contradicting the doc's stated absolute rule that it never creates a config) — a case the doc's own summary doesn't mention.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The docstring states the function only ever edits a file that already exists, but the body has an explicit carved-out exception for claude-desktop that creates the config file.

### `mcp_connect` — QUIRKY
- spec 1 · read at `a9ec7fc9100e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that connects to an MCP client by id, likely delegating to an mcp module function to establish the connection and returning a status string or error.
- found: It just calls the peer function `edit_client(&id, true)` — a one-line delegation. The real logic (and the meaning of the boolean flag) lives in `edit_client`, which presumably edits that client's config to register/enable the sanity MCP server (mirrored by `mcp_disconnect` presumably passing `false`).
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `mcp_disconnect`
- spec 1 · read at `4810a7f14d35` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that disconnects an MCP client by id, delegating to client-management logic, returning a success/error string.
- found: One-line delegation: edit_client(&id, false) — disconnect is implemented as editing the client's connected flag to false, sharing the edit_client function with whatever sets it to true (presumably mcp_connect).
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I expected a dedicated disconnect routine; it's actually just edit_client toggling a bool, same function likely shared with mcp_connect.

## src-tauri/src/harness.rs

### `parse`
- spec 2 · read at `bd103db291a6` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A simple match/switch over the string `s` against the known Harness enum variant names (claude, codex, opencode, agy, etc.), returning Some(Harness) for a match and None otherwise — with no special-case for "gemini", which falls through to None per the docs' explanation that it's deliberately not aliased.
- found: Trims and lowercases the input, then matches against harness names: "claude"/"claude-code" → Claude, "codex" → Codex, "opencode" → OpenCode, "agy"/"antigravity" → Agy, anything else (including "gemini") → None.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `label`
- spec 2 · read at `1939ccacef2e` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:03Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A match on self returning a static human-readable display string per harness variant, e.g. "Claude Code", "Codex", "opencode", "Antigravity" — distinct from the machine-facing `name()` or the binary `program()`, used in UI text.
- found: Exactly as predicted: static match returning display strings "Claude Code", "Codex", "opencode", "Antigravity" per variant.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `program` — QUIRKY
- spec 2 · read at `6407d229b2ba` · commit `e5ac296` · read by claude-sonnet-5 · when 2026-08-13T19:41:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A match on `self` (a Harness enum with variants like Claude/Codex/Opencode/Agy) returning the literal PATH executable name string for each variant, e.g. "claude", "codex", "opencode".
- found: It's a one-line delegation to self.name() — program() and name() apparently return the same string, at least for now, rather than doing its own per-variant match.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The doc comment shown was actually the file_doc (module-level context about MCP client architecture), not a doc for this specific function — so there was effectively no per-function documentation.

### `available` — QUIRKY
- spec 2 · read at `48ce4fb30fdf` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:19:38Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the program name for this harness variant (via self.program()) and checks whether it resolves to an executable on the system, likely delegating to a `which`-style helper (possibly via_login_shell or is_runnable) rather than just std::process::Command spawning, since the doc says this is meant to detect a missing binary in advance rather than from a failed spawn.
- found: Resolves the binary path via self.resolve() (returning false if not found), then actually spawns it with --version to confirm it's runnable, not just present, since resolve() only proves an execute bit exists.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I predicted resolution to an executable but missed that it actually spawns the process with --version to verify runnability, not just presence.

### `all`
- spec 2 · read at `7ad4df3219b0` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:41:41Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns a fixed array of the 4 supported harness enum variants, e.g. [Harness::Claude, Harness::Codex, Harness::OpenCode, Harness::Agy], as a simple literal array constructor with no logic.
- found: Returns a literal fixed array of the 4 Harness enum variants: Claude, Codex, OpenCode, Agy.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `enumerates`
- spec 2 · read at `01401f547979` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:43:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A method on Harness returning true for the three agents (Codex, opencode, Antigravity) whose models() list is a real enumerable catalogue, and false for Claude Code, whose list is just aliases — a simple match on self against the enum variants.
- found: Exactly as predicted in effect, though implemented as a negation (`!matches!(self, Harness::Claude)`) rather than an explicit match over all variants — simpler than I guessed but semantically identical.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `models` — QUIRKY
- spec 2 · read at `3aa8ee740c71` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A match on `self` (the Harness enum variant) that dispatches to the matching per-harness helper — Claude::claude_aliases, Codex::codex_models, opencode::opencode_models, Antigravity::agy_models — and returns whatever Vec<ModelChoice> that helper produces, likely with a fallback empty vec for any variant with no known enumeration.
- found: Checks a process-lifetime OnceLock-backed cache (keyed by harness name) first and returns the cached Vec<ModelChoice> if present; otherwise dispatches via match on the Harness variant to the matching helper (codex_models/claude_aliases/opencode_models/agy_models), caches the result, and returns it.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `codex_models` — TRAP
- spec 2 · read at `40fdf0854ebf` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Spawns the Codex app-server process, writes an `initialize` JSON-RPC request followed by a `model/list` request over its stdin, and reads stdout on a separate thread with a timeout/deadline so a hung server doesn't block the caller. It looks for the first reply matching the request id, parses the model list out of the JSON response into Vec<ModelChoice>, and returns an empty vector if the process fails to spawn, times out, or the response can't be parsed.
- found: Spawns `codex app-server`, writes initialize+model/list JSON-RPC requests to stdin (kept deliberately open — closing it makes the server exit before replying), reads stdout on a background thread for the reply with id=2, waits up to 10s via a channel, then parses result.data into ModelChoice, filtering out hidden models and marking the default.
- predicted: most · documented: full · derivable: no · legible: full · trap: yes
- note: Comment explicitly flags that dropping stdin early (the 'tidy' refactor) silently breaks this by making the server exit before answering — a real trap for the next editor.

### `opencode_models`
- spec 2 · read at `35fa9f148b61` · commit `2903db5` · read by gemini-3.6-flash-medium · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: opencode_models executes the opencode models CLI command or queries its configuration to discover all supported model strings across providers. It parses the output into a vector of ModelChoice structs formatted as provider/model.
- found: Executes `opencode models` command via std::process::Command, parses stdout lines formatted as provider/model, filters by authenticated providers via opencode_providers(), and maps to ModelChoice items.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Prediction closely matched execution and parsing logic; body additionally filters models against credentials in auth.json.

### `agy_models`
- spec 2 · read at `a7a920344645` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:33Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Runs the `agy models` subcommand, captures its stdout, and parses each line as `id<TAB>display name` into a ModelChoice, skipping lines without a tab (such as the "Fetching available models..." banner). Returns the resulting Vec<ModelChoice>, likely empty on a spawn/exit failure.
- found: Resolves the harness binary path, runs `agy models` capturing stdout only (stderr/stdin null), and parses lines with a tab into id/label ModelChoice entries (default: false), skipping empty-id lines; returns empty Vec on resolve or spawn failure.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `claude_aliases`
- spec 2 · read at `ccb58c4703fd` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:06Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns a hardcoded Vec<ModelChoice> of exactly four entries — fable, opus, sonnet, haiku — each built with the alias as both id and display label (or a capitalized label), since these are named aliases rather than enumerated versions like Codex's list.
- found: Maps the four hardcoded alias strings into ModelChoice{id, label} pairs (id==label), marking "sonnet" as the default since Claude Code reports no default of its own and sonnet is the middle of the cost/capability range.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `resolve` — OBSCURE
- spec 2 · read at `62479254d60c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Tries three sources in order — first a `which`-style lookup using the inherited PATH, then falls back to querying the user's login shell for its PATH, then finally checks a fixed list of common install locations (~/.local/bin, /opt/homebrew/bin, etc.) — returning the first absolute path found that's runnable, or None if all three fail.
- found: A static per-process cache keyed by harness name, memoizing the result of self.look() (the actual three-source PATH resolution) so repeated calls (once per Read dialog row, once per wave) don't repeatedly shell out.
- predicted: none · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe the three-source resolution strategy, but that logic actually lives in the separate look() function; resolve() itself is just a cache wrapper around it, so the docs describe the wrong function/owner.

### `look`
- spec 2 · read at `fb3565d5d1d7` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:15Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Tries to locate this harness's executable on disk: calls `which` (possibly via_login_shell) for self.program(), and/or checks a list of common install locations, verifying each candidate with is_runnable before returning it as Some(PathBuf). Returns None if nothing runnable is found anywhere.
- found: Tries `which(prog)`, then `via_login_shell(prog)`, then falls back to a short deliberate list of known install directories (~/.local/bin, /opt/homebrew/bin, /usr/local/bin, ~/.bun/bin, ~/.volta/bin), returning the first candidate that passes is_runnable, or None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `is_runnable`
- spec 2 · read at `338b2a723696` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:38Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a filesystem path points to something executable: verifies the path exists and is a regular file, then on Unix checks the executable permission bit (mode & 0o111 != 0). Used when probing candidate binary locations for a coding-agent harness.
- found: Checks metadata for the path is a regular file with any executable bit set (owner/group/other) on Unix; on non-Unix platforms just checks is_file() since permission bits aren't meaningful there.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `which`
- spec 2 · read at `a93abc71387b` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:05Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Splits the PATH env var on the OS path separator, joins each directory with `prog`, and returns the first one that exists as a file (possibly checking executability), returning None if PATH is unset or nothing matches.
- found: Splits PATH, joins each dir with prog, returns first that is_runnable, None if PATH unset or nothing matches.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `via_login_shell`
- spec 2 · read at `69d673cf9290` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Spawns the user's $SHELL with -l -c "command -v <prog>", captures stdout, trims it, and returns Some(PathBuf) if the output is non-empty and the command succeeded, else None — resolving a CLI tool's path the way an interactive login shell would (respecting profile-set PATH additions).
- found: Spawns $SHELL (falling back to /bin/sh) with -lc "command -v <prog>", captures stdout with stdin/stderr suppressed, returns None on failure/non-zero exit, otherwise trims the output into a PathBuf and returns it only if is_runnable confirms it.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc explains WHY -l matters (profile-set PATH) which the code alone wouldn't convey.

### `mcp_config`
- spec 2 · read at `b2d4e63edaf4` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:57Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds and serializes a JSON object describing an MCP server entry (e.g. under "mcpServers") that points "command" at the given exe with args to run it as an MCP server, and sets environment variables carrying the backend/role and project so the spawned reader knows which repo and role it's reading for. Returns the JSON as a String to be written to a per-invocation config file.
- found: Serializes a JSON mcpServers.sanity entry: command=exe, args=["mcp"], env carrying SANITY_ROLE=reader, SANITY_PROJECT=project, SANITY_BACKEND=backend, so the spawned reader knows its scope without touching the user's own config or falling back to the last-opened repo.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `opencode_providers`
- spec 2 · read at `fad7d5bf3a14` · commit `2903db5` · by ross@rossturk.com · warm reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: opencode_providers is a helper function in harness.rs that reads the provider credentials configuration file maintained by opencode and returns a list (Vec<String>) of valid provider ID strings (like "openrouter") that opencode currently holds credentials for.
- found: opencode_providers reads auth.json from XDG_DATA_HOME/opencode or ~/.local/share/opencode/auth.json, parses it as a JSON object, and returns its top-level keys as a Vec<String> of provider IDs.
- predicted: full · documented: not judged · derivable: no · legible: not judged · trap: no

### `warm`
- spec 2 · read at `def742d8a3bd` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Spawns a single background thread at startup that iterates over all harnesses, calling their resolve/availability check and model-enumeration once each so results land in shared caches before the Read dialog is opened. One thread rather than four in parallel because these calls are dominated by process-spawn latency and share a mutex-guarded cache; the function itself returns immediately without waiting on or returning anything.
- found: Exactly as predicted: one background thread, loops over Harness::all(), skips unavailable ones, calls models() on available ones purely for the caching side effect, discards the result, returns nothing.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `write_config`
- spec 2 · read at `f31d79b88879` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:50Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Matches on the `Harness` variant and writes an MCP-server config file into `dir` in whatever format/location that harness expects: a no-op for Claude (since it takes --mcp-config as a CLI flag instead), an `opencode.json` for opencode, a `.agents/mcp_config.json` for Antigravity, and something under a Codex-specific path/env convention for Codex — likely using the `toml_string`/`mcp_config` helpers to serialize a server entry that points at `exe` with args encoding `backend` and `project`. Returns an io::Result, propagating file-write errors.
- found: Matches on Harness and writes per-harness MCP config: no-op for Claude; for Codex, creates a private .codex home, symlinks the real auth.json in for credentials, and writes config.toml with an [mcp_servers.sanity] entry; for OpenCode, writes opencode.json with an mcp.sanity local server entry; for Agy (Antigravity), writes .agents/mcp_config.json with mcpServers.sanity. All pass SANITY_ROLE/PROJECT/BACKEND env vars.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the Codex auth.json symlink trick, which the comments explain is essential (Codex otherwise has no credentials in its isolated home) — that was the most interesting part of the function.

### `reader_command`
- spec 2 · read at `791fe4bab232` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:49:11Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a tokio::process::Command to launch the given harness's CLI binary as a reader. It likely matches on `harness` to construct the right args/env per tool (claude, gemini, opencode, antigravity, etc.), passing the model, prompt, and an MCP config pointing at the three sanity tools, and sets the command's working directory to `cwd` (deliberately outside the repo) plus env vars carrying `project`/`backend`/role info. Probably also handles auth/login-shell wrapping via `via_login_shell` for some harnesses.
- found: Matches on the Harness enum (Claude, Codex, OpenCode, Agy) to build very different CLI invocations per tool — flags for MCP config, permission bypass, model selection, and prompt passing — each with hard-won reasons (e.g. Codex needs --dangerously-bypass-approvals-and-sandbox or MCP calls silently no-op; Claude needs --setting-sources user to avoid repo CLAUDE.md priming; Agy needs --add-dir to discover MCP at all). Sets cwd, null stdin, piped stdout/stderr, and kill_on_drop(true) so readers don't outlive their spawning task.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Doc comments are unusually rich war-story explanations of each flag's necessity, not just restating the code — genuinely non-derivable context (e.g. why Codex approval settings silently swallow MCP calls).

### `an_agent_is_found_without_a_shell_path`
- spec 2 · read at `81c427e9f09d` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that temporarily sets PATH to a stripped value like "/usr/bin:/bin:/usr/sbin:/sbin" (simulating a Finder-launched app), then calls the harness resolution/lookup function (likely `which` or `via_login_shell`) and asserts an agent is still found. If no agent is actually installed on the test machine, it skips/early-returns rather than failing, since CI has none installed.
- found: Finds an already-resolvable agent via Harness::all()/resolve(), skips the test if none exists, then temporarily sets PATH to a stripped GUI-like value, calls `look()` (deliberately not `resolve()`, to bypass the warm cache and actually exercise the no-PATH lookup), restores PATH, and asserts the blind lookup still finds the same real path.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the specific detail that resolve() vs look() matters because of caching — I guessed which()/via_login_shell as the mechanism instead of `look()`, though the overall test structure and skip-if-none logic matched.

### `a_harness_name_round_trips`
- spec 2 · read at `c6cbbc8dab35` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T17:01:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test function verifying that a Harness name can be converted to a string and parsed back to the same value (a round-trip serialization test), likely iterating over all known harness variants and asserting something like Harness::from_str(h.name()) == Some(h).
- found: Iterates all Harness variants asserting parse(name()) round-trips to Some(h), then checks a case-insensitive/hyphenated alias ("Claude-Code" -> Claude) and an unknown name ("cursor") returns None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_reader_is_never_launched_inside_the_repo`
- spec 2 · read at `37a056ae5cca` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a reader command for a project pointing at some repo path, then asserts the resulting spawn's working directory is NOT the repo path itself — checking it's set to a neutral directory so the spawned CLI agent's cwd-based config discovery (CLAUDE.md/AGENTS.md) can't find the repo's file.
- found: For every Harness variant, builds a reader_command with repo="/repo" and cwd param="/tmp" ('away'), and asserts the constructed command's current_dir is set to 'away', not the repo path.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `the_shims_environment_carries_the_project_and_the_role`
- spec 2 · read at `ab67f1afb80c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that builds the shim's launch configuration (likely via mcp_config or reader_command) for some harness, then asserts that the resulting environment variables include the project key and role, while checking that neither value leaks into the prompt text or tool schema passed to the model.
- found: A test that calls mcp_config with a sanity binary path, backend URL, and repo path, then asserts the resulting JSON string literally contains SANITY_ROLE=reader, SANITY_PROJECT=<repo path>, and SANITY_BACKEND=<url> as env entries.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted it would also assert these values do NOT appear in the prompt/tool schema, but the test only makes the positive assertion — no negative check.

### `a_claude_reader_cannot_reach_the_filesystem`
- spec 2 · read at `f2f2f13c6dbd` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:20:55Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that builds the reader_command (or mcp_config/args) for the Claude harness and asserts that the `--allowedTools` argument is present and lists exactly the three MCP-qualified tool names (e.g. `mcp__sanity__sanity_next`, `mcp__sanity__sanity_reveal`, `mcp__sanity__sanity_report`), named explicitly rather than counted, and that no filesystem-access tools (like Read/Bash) are included.
- found: Builds reader_command for Claude, checks args contain --strict-mcp-config and --allowedTools with all three tool names and not "Read", plus an extra assertion that no --model flag is set when none was requested (which I didn't predict).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the --strict-mcp-config assertion and the no-default-model-flag check, but got the core allowedTools/no-Read assertions right.

### `gemini_is_not_an_alias_for_antigravity` — QUIRKY
- spec 2 · read at `13a38e2892f0` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:22:09Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A #[test] that calls Harness::resolve (or similar) with the string "gemini" and asserts the resolved harness is a distinct Gemini variant, not the Antigravity harness, and/or checks that a project configured with harness "gemini" does not get matched/aliased when looking up "antigravity" (or vice versa) — guarding against the two being collapsed into one lookup path.
- found: Asserts Harness::parse("agy") and parse("antigravity") both resolve to Harness::Agy, but parse("gemini") returns None (not aliased to Agy at all, contrary to my guess), then loops over Harness::all() asserting every harness name round-trips through parse and is listed in supported().
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `an_antigravity_reader_is_pointed_at_its_own_config`
- spec 2 · read at `14b8276bfa6b` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that spawning an Antigravity reader writes its MCP config to the exact path agy expects, and that the launch command includes the matching --add-dir (or equivalent) argument pointing at that same location — checking both halves so neither can silently regress.
- found: Test that writes an Antigravity config to a temp dir, asserts the resulting `.agents/mcp_config.json` has the sanity MCP server with reader role/project env vars, then builds the reader launch command and asserts `--add-dir` is present and points at that same temp dir.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the specific config path (.agents/mcp_config.json) and the exact env vars checked, but got the two-halves structure right.

## src-tauri/src/heuristic.rs

### the file itself
- spec 1 · read at `50076f351b4c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Local deterministic proxy for LLM-based surprise/perplexity scoring, combining distinctiveness, vocabulary novelty, incompressibility, and branch density into a 0..1 score, plus doc-quality scoring, with sentence-named unit tests for edge cases.
- found: Confirmed: four weighted 0..1 measurements (distinctiveness 0.35, vocabulary novelty 0.30, incompressibility 0.20, branch density 0.15) mixed into 'surprise'; explicit UNDECIDED=0.5 sentinel for insufficient evidence rather than biasing toward 0 or 1; words()/lex() tokenization with structural-keyword filtering feeds the vocabulary/jaccard comparisons. Matches my predicted shape closely, including the doc-quality and test-suite peers I inferred but did not verify by reading further.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Did not read the calibrate/surprise/documented functions or tests directly, per instructions to bound reading for file-level tasks to what's needed to judge the header.

### `linmap`
- spec 1 · read at `f8ee7245574d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Linear interpolation/remapping helper: rescales v from [lo, hi] to [0, 1], clamped.
- found: Exactly that: ((v - lo) / (hi - lo)).clamp(0.0, 1.0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `words`
- spec 1 · read at `3a6091c43ac8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Splits source into lowercased word tokens, breaking on camelCase/snake_case/kebab-case boundaries, dropping punctuation and filtering out words shorter than 3 chars or structural words.
- found: Iterates chars, splitting on non-alphanumeric boundaries and camelCase transitions (uppercase after lowercase), lowercasing each char, accumulating into words, then filters out words under 3 chars or matching is_structural.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `is_structural`
- spec 1 · read at `6499097e3618` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a word is one of the universal plumbing keywords excluded from vocabulary comparisons, via a static list lookup.
- found: Exactly that: a const STRUCTURAL slice of ~60 keywords/generic identifier names across languages, and returns STRUCTURAL.contains(&w).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lex`
- spec 1 · read at `71bb58aefa58` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Scans src via char_indices, grouping consecutive alphanumeric/underscore chars into identifier-run slices and emitting each other non-whitespace char as its own single-char token, returning Vec<&str> borrowed slices.
- found: Exactly that: whitespace skipped, identifier runs grown via a peekable iterator, punctuation emitted as single-char slices.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `shingles`
- spec 1 · read at `ebfd5c09109e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Lexes source, slides a 3-token window, hashes each triple with fnv, collects into a HashSet of u64 shingles.
- found: Lexes source; if fewer than 3 tokens returns empty set; otherwise uses windows(3), joins each window's tokens with a space, hashes the joined string bytes with fnv, and collects into a HashSet<u64>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `fnv` — TRAP
- spec 1 · read at `9ea745b82c03` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: An FNV-1a-shaped hash: starts from the standard FNV offset basis, then for each byte XORs it into the hash and multiplies by a constant that the doc says is subtly wrong (digits grouped one place out from the real FNV-1a prime), producing a u64 hash used for shingle fingerprinting.
- found: Exactly that: h starts at 0xcbf29ce484222325 (real FNV offset basis), loop XORs each byte in then multiplies by 0x10000000_01b3 — the doc-confirmed wrong constant (should be 0x100000000000_01b3 pattern) — wrapping on overflow.
- predicted: full · documented: full · derivable: no · legible: full · trap: yes
- note: The doc itself flags the constant as a longstanding, deliberately-uncorrected bug shared with cache.rs and assessment.rs's body_hash; marking trap:true since any future 'fix' to match real FNV-1a would silently invalidate every committed reading and rescore every repo.

### `jaccard`
- spec 1 · read at `5e908dda6254` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes Jaccard similarity (intersection size / union size) between two hashed shingle sets, likely used to detect near-duplicate/boilerplate functions, with a guard for empty sets to avoid divide-by-zero.
- found: Exactly that: returns 0.0 if either set is empty, otherwise intersection.count() / (len_a+len_b-intersection), i.e. standard Jaccard, with a redundant zero-union guard.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `incompressibility`
- spec 1 · read at `0b49fd4d2b9a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Deflate-compresses the body text and returns compressed_len/original_len as a float, using compression ratio as a proxy for how repetitive/boilerplate-like the code is (low ratio = repetitive, high = dense/novel), possibly with a floor for very short bodies.
- found: Normalizes whitespace, returns UNDECIDED (neutral midpoint) for bodies under 200 bytes since deflate's fixed overhead skews short input. Otherwise deflate-compresses and linearly maps the compressed/original ratio from an empirically calibrated range [0.25, 0.70] into the final score.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `branch_density`
- spec 1 · read at `d1519d356654` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Counts branch-like keywords/operators (if, match, for, while, &&, ||, ?) and divides by line count to get a decisions-per-line ratio.
- found: Tokenizes body on non-alphanumeric (except &, |, ?) chars, counts tokens matching an extended branch-keyword list (also case, switch, loop, try, catch, except), divides by line count, but first returns a sentinel UNDECIDED if the body has fewer than MIN_LINES_FOR_BRANCHING lines, and the final ratio is passed through linmap(0.02, 0.25) to normalize rather than returned raw.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the short-body UNDECIDED guard and the linmap normalization step.

### `vocabulary_novelty`
- spec 1 · read at `40682e32b324` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Tokenizes the signature into a "known" word set and the body into its own word set, then computes the fraction of body words absent from the signature's vocabulary as the novelty score.
- found: Matches, plus two details: bodies with fewer than MIN_WORDS distinct words return UNDECIDED rather than a ratio (too little text to judge), and the novel-word fraction is remapped through `linmap` onto a 0.35–0.85 range rather than returned raw as 0..1.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `fingerprint`
- spec 1 · read at `e11811e2100d` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Tokenizes/shingles the body and hashes shingles with fnv to build a Fingerprint for later Jaccard comparison.
- found: Just constructs `Fingerprint { shingles: shingles(body) }` — a one-line delegation; all the tokenizing/hashing detail lives inside `shingles()`, not here.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `distinctiveness`
- spec 1 · read at `0fe9a609594f` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: 1 - max(jaccard(me, peer)) over peers; returns an UNDECIDED/neutral value rather than 1.0 when there are no peers to compare against.
- found: Returns UNDECIDED when peers is empty OR the body is too short to shingle (MIN_SHINGLES floor, since short bodies falsely score as maximally original). Otherwise takes the max jaccard similarity to any peer and rescales it via linmap(closest, 0.08, 0.55) before subtracting from 1.0, since near-duplicates rarely exceed ~0.6 Jaccard and the interesting band sits low.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `surprise`
- spec 1 · read at `4eff4ffdff03` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Combines distinctiveness with vocabulary_novelty/incompressibility/branch_density computed from signature/body into a single weighted score, clamped/normalized to 0..1.
- found: Builds a terms array [distinctiveness, vocabulary_novelty, incompressibility, branch_density], computes a weighted sum via zip with a WEIGHTS constant, then passes the raw sum through calibrate() to produce the final 0..1 score.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `calibrate`
- spec 1 · read at `d2fe6c5debba` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Rescale raw into 0..1 band via a floor/ceiling, then apply an exponent >1 to skew right.
- found: Exactly that pattern, using a named helper `linmap` for the rescale plus `powf(SKEW)`, with constants FLOOR=0.30, CEIL=0.95, SKEW=2.2 — I had the band bounds slightly off (guessed 0.15 floor).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `documented`
- spec 1 · read at `3406ce98e4d7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Subtracts signature words from both doc and body vocabularies, then measures overlap fraction of body's uncovered words that the doc mentions, returning 0..1; 0 when doc is None.
- found: Matches the mechanism, plus two details missed: if the body has nothing left to explain after removing signature words, returns 1.0 outright; and the raw coverage ratio is remapped via `linmap(coverage, 0.0, 0.40)` so full credit (1.0) is given at only 40% vocabulary overlap, since good prose doesn't need to name every identifier.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `words_split_identifiers_and_drop_noise`
- spec 1 · read at `fad3dd028233` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test verifies words() splits camelCase/snake_case identifiers into lowercase parts and drops noise like keywords/short names.
- found: Asserts words(\"parseHTTPHeader\") == [\"parse\",\"httpheader\"] (camelCase splits but a run of caps stays merged and lowercased), snake_case splits on underscores, and a full statement of keywords/1-2 letter names yields empty.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_comment_that_restates_the_signature_documents_nothing`
- spec 1 · read at `4e798aed459f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Tests the documented() heuristic: a doc restating the signature ('Increments the counter' for increment_counter) scores as not documenting anything, while a doc describing actual body behavior scores well.
- found: documented(doc, sig, body) called with an echo doc (score asserted == 0.0 exactly) vs a real explanatory doc describing body effects (score asserted > 0.5).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `no_doc_is_no_explanation`
- spec 1 · read at `8b58e47ed66c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test asserting documented() returns 0/none when there is no doc comment for a function.
- found: Exactly that: assert_eq!(documented(None, "fn a()", "body words here"), 0.0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `twelve_copies_of_a_handler_are_not_distinctive` — QUIRKY
- spec 1 · read at `3f563f4b7e0f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test building a corpus of twelve near-identical handler functions and asserting the distinctiveness score for a duplicated one is low, showing that repeated boilerplate doesn't register as surprising/distinctive.
- found: The test only uses two near-duplicate handler fingerprints (get_user/get_order) plus one genuinely novel retry-loop snippet, and asserts distinctiveness(a vs [b]) is both lower than distinctiveness(novel vs [a,b]) and below 0.5 — the function name's 'twelve copies' is rhetorical/aspirational, not literal.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Function name says 'twelve copies' but the body only constructs two near-duplicates plus one novel snippet.

### `a_lone_function_is_undecided_not_unique`
- spec 1 · read at `b35e9fdd99bc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that with no peers to compare against, distinctiveness() returns an "undecided" sentinel rather than falsely claiming maximal uniqueness for a singleton function.
- found: Test calls distinctiveness(fingerprint(...), &[]) (empty peer slice) and asserts it equals UNDECIDED, guarding against the function defaulting to 1.0/"unique" when there's nothing to compare it to.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `short_bodies_decline_to_report_compressibility`
- spec 1 · read at `f12600d8d19e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test asserting that calling incompressibility() on a very short function body returns a "no measurement" sentinel rather than a numeric compressibility score, since there isn't enough evidence.
- found: Asserts incompressibility(\"a + b\") equals UNDECIDED, with a comment explaining deflate's fixed overhead would otherwise make every tiny function look artificially novel/incompressible.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `non_ascii_source_does_not_split_a_codepoint`
- spec 1 · read at `d8b4593d2bb6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Feeds multi-byte UTF-8 source into a byte-oriented heuristic function (guessed incompressibility/fingerprint) to ensure no panic from splitting a codepoint mid-byte.
- found: Tests lex() on strings with em-dashes, middle dots, and accented identifiers (héllo_wörld), asserting correct tokenization, plus a smoke-test call to fingerprint() on a comment with arrows/dashes to ensure no panic.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `lex_separates_punctuation_from_identifiers`
- spec 1 · read at `4636503cbcc0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A unit test verifying the lexer splits punctuation from identifiers into separate tokens rather than merging or dropping them, using a short code snippet.
- found: Asserts lex(\"db.query(USERS, id)\") produces [\"db\", \".\", \"query\", \"(\", \"USERS\", \",\", \"id\", \")\"], confirming punctuation and identifiers are separate tokens.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `a_tiny_function_cannot_be_the_hottest_thing_in_the_repo`
- spec 1 · read at `61d43ab7e698` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that surprise() dampens the score for a tiny function body so it can't rank as most surprising, likely comparing against a threshold or a longer function's score.
- found: Regression test for a real bug where `fn main() { app::run() }` ranked as most surprising: builds a tiny body and a synthetic 40-line long body, computes surprise() for each with distinctiveness derived from an unrelated fingerprint, and asserts tiny < 0.5 and long > tiny.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `every_term_declines_to_measure_when_it_runs_out_of_evidence`
- spec 1 · read at `c089239d4f06` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test calling each measurement function with degenerate input and asserting each returns None/declines rather than fabricating a value.
- found: Asserts incompressibility, branch_density, vocabulary_novelty, and distinctiveness all equal a shared UNDECIDED sentinel constant when given the same tiny input, verifying all four abstain consistently.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `surprise_stays_in_range`
- spec 1 · read at `6657f6fb4ca1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test that surprise()'s output stays within [0,1] across inputs, guarding the composite score's bound.
- found: Loops over edge-case bodies (empty string, single char, a 500x-repeated filler) calling surprise(\"fn f()\", body, 0.5) and asserts each result is in 0.0..=1.0.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/history.rs

### the file itself
- spec 1 · read at `98efeffff030` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks git history commit by commit to build a history-of-the-codebase timeline for the sunburst, caching/interning function identities across renames/copies, with a resumable/extendable on-disk cache invalidated by rebase or parser/format version changes.
- found: Matches prediction closely: a Replayer folds raw diffs per commit using a long-lived `git cat-file --batch` process, interning functions by (path,owner,name,ord), storing commits as deltas (set/del) rather than snapshots, with MAX_COMMITS/blob-size/minified-line/vendored filters mirroring scan.rs, plus a versioned on-disk cache (CACHE_VERSION + parse version) that extends forward or fully replays on rebase/format change.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `key_of`
- spec 1 · read at `19a1795e6717` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Concatenates path with function name (and possibly owner) into a fixed-format composite string key used to diff functions across commits.
- found: format!(\"{path}#{owner}::{name}#{ord}\") — combines path, owner (defaulted to empty if None), name, and ordinal into one string key.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Didn't predict the ordinal component, which presumably disambiguates same-named functions.

### `lang_of`
- spec 1 · read at `addd3d34929a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Maps a path's file extension to a recognized Lang variant, returning None for unsupported extensions.
- found: First excludes vendored paths (any path segment in VENDORED) returning None, then extracts the extension after the last dot and maps it via Lang::from_extension.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `open`
- spec 1 · read at `c68f908e0fea` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Spawns a persistent git cat-file --batch process for streaming blob reads, returns None on any failure.
- found: Spawns 'git -C repo cat-file --batch' with piped stdin/stdout and null stderr; uses ? to bail to None on spawn or handle-taking failure; wraps child process, stdin, and buffered stdout into Blobs.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `read` — QUIRKY — TRAP
- spec 1 · read at `4b11abeacd7b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Looks up a git blob by sha via some git API, checks size/binary, returns text or None.
- found: Drives a persistent `git cat-file --batch`-style subprocess: writes the sha to its stdin, reads a header line (oid, kind, size), returns None immediately for non-blob kinds, but for blobs ALWAYS reads exactly size+1 bytes off stdout (even if over MAX_BLOB_BYTES, to keep the pipe in sync for future reads) before deciding whether to return None (too big) or the UTF-8 decoded text.
- predicted: some · documented: some · derivable: no · legible: most · trap: yes
- note: Whoever edits this next must preserve the always-drain-the-payload invariant; skipping the read on any early-return path would desync the batch pipe for every subsequent blob without raising an error.

### `drop` — QUIRKY
- spec 1 · read at `af7d03b498b1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Drop impl for Blobs cleaning up an underlying git2 repo/object-database handle, possibly logging cache stats.
- found: Closes the stdin handle of a `git cat-file --batch` child process (which signals it to exit) and then waits on the child to reap it — Blobs wraps a long-running subprocess, not a git2 library handle.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed a git2 library handle; it's actually a long-running `git cat-file --batch` subprocess whose stdin must be closed to unblock the exit, which the doc list (empty) gave no hint of.

### `intern`
- spec 1 · read at `e3d8905f5ffc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Interns a function into a stable numeric id: looks up existing key in a map, else appends a new entry (path, name, owner, etc.) to a list and returns the new index.
- found: Exactly that: checks self.index for f.key, returns existing id if found; else pushes HistoryFunc{path: path_idx, name, owner, ord} onto self.list, records the new index in self.index, returns it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `functions_of`
- spec 1 · read at `1840628e7932` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Parses source via a language-specific parser selected by lang, extracts function name/owner/line-range, and disambiguates same-named siblings with an ordinal used in a generated key, returning a FileState of the file's functions.
- found: Calls parse::parse_functions(lang, src), tracks per (owner,name) occurrence counts in a BTreeMap to compute ord, builds key as "path#owner::name#ord", and collects FuncAt entries into a FileState.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `parse_raw`
- spec 1 · read at `c0a02791bacc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Parses a git diff --raw line into a Change by splitting on whitespace/tabs, extracting status and path(s), returning None for malformed lines; quoted paths passed through unescaped.
- found: Parses into a Change{path, sha, from}. Delete (D) has no sha. Rename/Copy (R/C) take a second path as the new name, sha from dst_sha, and set `from` to the old path only for renames (copy leaves source in place). Other statuses just record path+dst_sha. Uses `?` propagation throughout except one deliberate `.first()?` on status bytes to avoid a panic on empty status that previously occurred with indexing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `commits`
- spec 1 · read at `1e2337f9e5af` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Runs git log/rev-list with --no-merges and --reverse, parses commits into RawCommit list, returns them with a count of commits dropped by the Last(limit) cutoff (computed from total count).
- found: Gets total commit count via rev-list --no-merges --count, then runs git log with --no-merges --reverse --root --raw --find-renames and a custom --format using control-char delimiters, parsing header lines (sha/ts/author/subject) and raw diff lines (via parse_raw) into RawCommit.changes; dropped count is total-limit for CommitRange::Last, 0 for CommitRange::Since. Handles CommitRange::Since via a `sha..HEAD` selector.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `tree_of` — QUIRKY
- spec 1 · read at `3e188ba7eaf3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks a git commit's tree at sha and collects every source blob into a Vec of (path, content) pairs, used to seed the initial replay state when history is longer than the display window.
- found: Runs `git ls-tree -r sha`, parses each line's mode/type/blob-sha/path, filters to blob entries whose path passes lang_of (a source-file check), and returns Vec<(path, blob_sha)> — the blob content itself is not read here, only the sha reference to it.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `parse_batch`
- spec 1 · read at `b2bdfb9331e5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Sequentially reads blob contents for each (path, sha) via blobs.read, then parses them in parallel (rayon) into FileState, returning (path, FileState) pairs — sequential I/O separated from parallel CPU parse.
- found: Sequentially reads each blob, filtering by known language and refusing (treating as empty) any file with an over-long line (minified), then par_iter's the sources through functions_of to build FileState, defaulting to an empty state for unreadable/refused/unparseable files so old functions get correctly cleared rather than left stale.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `empty`
- spec 1 · read at `83013960814a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A constructor returning a default-initialized Replayer with all internal state empty, used as a starting point before seed/resume.
- found: Exactly that: builds a Replayer with empty BTreeMaps for paths/state, default Funcs, and a HistoryScan output struct with all fields empty/zero.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `resume` — QUIRKY
- spec 1 · read at `0918f6898b9a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Reconstructs a Replayer from a stored HistoryScan by replaying its commit frames through the same fold/apply logic the frontend uses, rebuilding path/func indices and current parse state without deserializing any stored state directly.
- found: Rebuilds paths and funcs indices directly from scan.paths/scan.funcs, then computes the final live-function set by folding scan.commits' set/del entries into a BTreeMap (not by calling Replayer::fold/apply), and finally builds per-path FuncAt lists from that live map before storing scan as r.out.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `path_idx`
- spec 1 · read at `d5a1043f2ce2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Interns path p, returning its existing index from a map or else appending to a paths vec and inserting the new index into the map.
- found: Same interning logic, but also pushes a parallel entry into self.out.langs (via lang_of(p)) whenever a new path is added, keeping paths and langs indexed in lockstep.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the parallel langs vec that gets populated alongside paths on every new insert.

### `seed`
- spec 1 · read at `a9d626ba5960` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Reads/parses a tree of (path, blob) pairs to build the opening replay state, interning functions and recording their initial state per path.
- found: Calls parse_batch(blobs, tree) to get parsed functions per path, interns each function via self.funcs.intern to get an index, pushes (index, loc) into self.out.base (the baseline LOC record), and stores the per-path function state in self.state.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `apply` — QUIRKY
- spec 1 · read at `53a358775c6b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: For a commit, fetches changed blobs, reparses functions, interns them, updates per-path line counts, and appends a structural snapshot frame (no surprise scoring).
- found: Builds a HistoryCommit frame (sha/short/ts/author/subject). First retires paths from renames/deletions, recording deleted function indices. Then parses batches of changed-file blobs, interning each function found (frame.set records (index, loc) for every function touched, resized or not), records functions present before but not after as deleted (frame.del), updates self.state per path, dedups touched file indices, and appends the frame to self.out.commits, updating head.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `fold`
- spec 1 · read at `b9ccd5bb244a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Removes oldest already-computed commit frames beyond limit and merges their set/del effects into a base state (no reparsing); folded functions lose their per-commit dating.
- found: If commits.len() <= limit, no-op. Otherwise drains the oldest `extra` commits, folding each commit's set/del ops into a BTreeMap base (insert on set, remove on del), updates base_ts to the last folded commit's timestamp, writes base back, and increments a `truncated` counter by extra.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `finish`
- spec 1 · read at `ff7e0b5aed6f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Consumes self, converts accumulated Replayer state into the final HistoryScan by moving/assembling fields.
- found: Simpler than expected: self.out was already a mostly-built HistoryScan; finish just moves self.funcs.list into self.out.funcs and returns self.out.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `read` #2
- spec 1 · read at `c2818f13c802` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks repo commit history up to `limit`, replaying diffs via a Replayer to build frames, calling progress along the way, returning HistoryScan; empty/no-git repos return an empty scan.
- found: Matches, plus detail not predicted: when the log is truncated (limit cuts off older history), it seeds the replayer's starting state by parsing the tree of the commit just before the window so the timeline doesn't start from nothing; also bails early (empty finish) if Blobs::open fails.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_cached`
- spec 1 · read at `51c4b5b17046` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Implements the three-outcome replay described by the doc: return cached scan if head unchanged, extend it if commits were added, else full replay; saves cache and returns HistoryScan.
- found: Matches the three-outcome structure exactly, but delegates to extend()/read() helper functions rather than calling Replayer methods directly itself; saves cache on the extend and full-replay paths.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `extend`
- spec 1 · read at `5d670b5506c8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks HEAD is a descendant of the cached scan's head via is_ancestor; if so resumes a Replayer and applies the new commits since then, reporting progress, returning the extended HistoryScan; returns None if history was rewritten.
- found: Does that, plus returns None when there are no new commits, and also bails to None when the new-commit count exceeds `limit` (an append that big should be a full rescan instead); on success it calls r.fold(limit) to trim the window before finishing.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `warm`
- spec 1 · read at `1bc17d41aed6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks if a cached timeline exists; if not, returns false without building one. If it exists, resumes/updates it with new commits and returns true.
- found: Computes cache_path; if none or the file doesn't exist, returns false. Otherwise calls read_cached(repo, limit, no-op callback) to bring it up to date and returns true — the actual resume/fold logic lives inside read_cached, not here.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `head_of`
- spec 1 · read at `fae09996471f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: I expected this to shell out to git (or use libgit2) to get the current HEAD commit hash of the given repo path, returning it as a trimmed string, with some fallback for errors.
- found: Exactly that: runs `git -C <repo> rev-parse HEAD`, takes stdout, converts to UTF-8, trims it, and returns empty string on any failure (spawn error, non-UTF8 output).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `is_ancestor`
- spec 1 · read at `bb2d9c040a16` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Shells out to `git merge-base --is-ancestor sha HEAD` in repo, returns true on success, false on any error/failure.
- found: Exactly that: Command::new(\"git\") -C repo merge-base --is-ancestor sha HEAD, stderr silenced deliberately (comment explains a non-commit sha is an ordinary answer not a fault), status().map(success).unwrap_or(false).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The one-line doc handed to me (\"Is sha still on the path to HEAD?\") already fully described it, so documented=full/derivable=false since it added the semantic framing not obvious from signature alone.

### `cache_path`
- spec 1 · read at `7a999ee4d47c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes cache file location from a hash of the repo path (and limit), under a shared cache/data directory; returns None if that directory can't be resolved.
- found: Joins data_dir()/timelines, creates the dir, computes an FNV-1a-style hash of the repo path string, and returns dir/{hash}-{limit}.json; None if data_dir or mkdir fails.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Docs on the function are absent; the file_doc describes the module's philosophy, not this helper.

### `load_cache` — QUIRKY
- spec 1 · read at `78bf03749feb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Reads and deserializes a cached HistoryScan, returning None on missing/parse failure; probably validates the cached HEAD is still an ancestor of current HEAD, and adjusts for limit.
- found: Reads text from cache_path(repo, limit), deserializes into a Cached struct, returns the inner scan only if cached.version==CACHE_VERSION, cached.parse==PARSE_VERSION, and cached.limit==limit all hold — pure version/param stamp matching, no git ancestry check here.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `save_cache`
- spec 1 · read at `1b112901bfa3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Serializes scan to JSON and writes it to cache_path(repo, limit) so a later run can load_cache instead of re-replaying history; swallows write/serialize errors since caching is best-effort.
- found: Gets cache_path (returns early if None); wraps scan in a Cached struct along with CACHE_VERSION, PARSE_VERSION, and limit; serializes to JSON and writes to disk, ignoring both serialization and write errors intentionally (documented via comment: a failed timeline save just costs a future replay, unlike a failed reading).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_new_stored_timeline_field_cannot_be_added_silently` — QUIRKY
- spec 1 · read at `2f9df0a73856` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A tripwire test mirroring the one in cache.rs: it inspects the stored-timeline struct's definition (likely by parsing source or checking field attributes) to force a deliberate decision whenever a field is added, rather than letting a serde default silently apply to older cached timelines and get replayed as if it always existed.
- found: Constructs a HistoryScan, serialises it to serde_json::Value, and asserts the exact sorted list of wire (camelCase) keys — base, baseTs, commits, funcs, head, langs, paths, truncated — with an assertion message telling a future editor to bump CACHE_VERSION and update this list. It's an exhaustive key-list snapshot rather than an attribute/derive inspection.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `raw_line_reads_a_plain_edit`
- spec 1 · read at `a64938b36a40` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Parses a git raw-diff status line for a plain modification ('M') and asserts the resulting change record has the right path, blob sha, and no rename/move source — as opposed to the rename/deletion sibling tests.
- found: Exactly that: parse_raw on a ':100644 100644 aaa bbb M\tsrc/main.rs' line yields path='src/main.rs', sha=Some('bbb') (the post-image blob), and from=None confirming it's not treated as a rename.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `raw_line_reads_a_rename_as_a_move` — QUIRKY
- spec 1 · read at `044ad3a0c674` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds a raw git rename diff line into the state-replay logic and asserts the old path is retired from the map while the new path is added, preserving line count, so a rename doesn't create a ghost duplicate.
- found: Simpler than expected: it just calls parse_raw on a raw diff-tree rename line (R096 with old/new paths) and asserts the resulting struct's `path` is the new path and `from` is Some(old path) — testing the line parser, not the map-replay/retirement logic the docs describe.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The function docs describe why renames must retire the old path in the replayed state map, but this particular test only exercises parse_raw's field extraction, not that retirement behavior — the doc reads as describing a neighbor concept in the module rather than this exact test body.

### `a_copy_does_not_retire_its_source` — QUIRKY
- spec 1 · read at `e2f906d9b378` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Full repo-replay test via a fixture (repo_with) simulating a copy commit, asserting source file isn't retired/deleted in the resulting timeline.
- found: Narrow unit test calling parse_raw directly on a raw git diff-status line with a C075 (copy) code, asserting parsed path equals destination and from is None — meaning a copy is not treated as a rename that would retire the source.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `raw_line_reads_a_deletion` — QUIRKY
- spec 1 · read at `af77b3401146` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Unit test that a raw-line parser correctly identifies a deletion line, asserting the parsed record shows a deletion (e.g. zero added lines / all removed or a deleted flag), likely from git numstat-style output.
- found: Tests parse_raw on a git diff-tree raw line \":100644 000000 aaa 000 D\\tsrc/gone.rs\" and asserts the resulting path is \"src/gone.rs\" and sha is None — not numstat-style counts as I guessed, but the raw diff-tree status-letter format.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `same_named_functions_in_one_file_stay_apart` — QUIRKY
- spec 1 · read at `64630814eb97` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test replaying a commit whose file has two same-named functions, asserting the Funcs table gives them distinct identities rather than collapsing them.
- found: Directly calls functions_of on Rust source with two different impls (A::new and B::new), asserting two distinct keys are produced (owner-qualified) rather than colliding on the bare name 'new'.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `repo_with`
- spec 1 · read at `5e199a0e7027` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test-fixture helper: git init a temp dir, then loop n times appending a new function to src/lib.rs and committing each addition, returning the TempDir.
- found: Creates a tempdir, git inits it with a fixed user.email/name, then for i in 0..n rewrites src.rs (not lib.rs) with functions f0 through fi concatenated (so each commit's file contains all functions so far, not just an appended one) and commits it as "commit i". Returns the TempDir.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Doc says src/lib.rs but the file written is actually src.rs at the repo root.

### `shape` — QUIRKY
- spec 1 · read at `d4761ced1893` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds a canonical, index-independent summary of a HistoryScan (sorted function keys, commit count, per-file info) so two independently-built timelines can be compared for equivalence.
- found: Replays all commits over the base set to compute the final live function->loc map (via BTreeMap insert/remove per commit's set/del), converts each surviving function index to its stable (path,name) key, sorts the resulting (key, loc) pairs, and returns them alongside the list of commit SHAs and the truncation flag — a tuple that is identical for two timelines describing the same repo state regardless of internal index numbering.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `extending_a_cached_timeline_matches_replaying_it_whole`
- spec 1 · read at `750488505ea4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test builds a repo fixture, reads/replays to get a baseline timeline, extends a cached timeline to a new commit, and asserts it equals a full fresh replay.
- found: repo_with(3) commits, read() to get cached timeline with 3 commits, writes+commits a 4th real commit via git CLI, then extend()s the cached timeline and compares its shape() to a fresh full read() — confirming cache-then-extend matches full replay.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `extending_past_the_window_folds_to_the_same_state`
- spec 1 · read at `8963ab99b78c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a repo with more commits than a history window, reads a truncated/cached timeline, adds another commit past the window, extends the cached timeline, and asserts the extended result folds its oldest frames into the same base state a fresh from-scratch read of the tree would produce — verifying the incremental-extend path matches the full-read path.
- found: Builds a 3-commit repo, reads with window=2 (confirming truncated=1), adds a 4th commit, extends the cached history by 2 more, and asserts both that the extended timeline has exactly 2 commits and that its `shape` equals a fresh `read` of the same window — matching the prediction closely.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_history_that_was_rewritten_is_not_extended`
- spec 1 · read at `2e91441c164d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds a repo, produces a cached timeline, rewrites history so old head isn't an ancestor, then asserts extend detects it and falls back to full replay instead of appending.
- found: Simpler than expected: builds a repo, reads a cached timeline via read(), then directly tampers with cached.head (setting it to all zeros, a hash that can't be an ancestor of anything real) rather than performing an actual git rewrite, and asserts extend() returns None — signaling the caller must fall back to a full read/replay.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `vendored_paths_have_no_language`
- spec 1 · read at `c07db8bce984` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Tests a lang-lookup helper (e.g. lang_of) returns None for a vendored path like node_modules/... since vendored trees are excluded from history/language attribution, and Some for a real source file.
- found: Exactly that, plus a third case: lang_of('README.md') is also None (not a vendoring case but a non-code extension), alongside node_modules being None and web/src/main.tsx being Some.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/lib.rs

### the file itself
- spec 1 · read at `16afe440a182` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: The Tauri app entry/shell: declares the crate's modules, builds the main window (with macOS traffic-light/titlebar tweaks) and the app menu (including a theme radio-group submenu), and has a run() that bootstraps the Tauri Builder, registers invoke handlers for the commands module, and starts the app.
- found: Matches the prediction's shape (module declarations, build_window, build_menu/ThemeMenu, run() wiring invoke handlers) but also does more: run() spins up a shared agentapi state, restores the previously open project, spawns an async loopback MCP server, registers a single-instance plugin so a second launch focuses the existing window, and on RunEvent::Exit explicitly releases the agent-API endpoint file so a dead backend doesn't leave stale callers retrying into a hole.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: The file header documents the crate-wide pipeline/philosophy (scan→parse→heuristic→surprise→churn→model, size-vs-colour), which is a fitting root-module doc but doesn't describe what this file itself actually contains (window/menu/bootstrap code) — it explains the crate, not the file.

### `build_window`
- spec 1 · read at `7001628a8abe` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds the main WebviewWindow with title/size and macOS-specific hidden-titlebar/traffic-light inset positioning, replicating what tauri.conf.json would otherwise declare.
- found: Builds WebviewWindowBuilder with title, inner_size, min_inner_size; under cfg(macos) adds overlay title bar style, hidden_title, and traffic_light_position from a TRAFFIC_LIGHTS constant; logs to stderr if build() fails rather than panicking.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `select`
- spec 1 · read at `40315c6ada50` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Sets checked state true on the matching theme item (light/dark/system) among ThemeMenu's items, false on the others.
- found: Exactly: calls set_checked(which == "light"/"dark"/"system") on each of the three menu item fields, discarding the Result of each call.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `build_menu`
- spec 2 · read at `33d8ba9a4ac5` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds the app's Tauri menu using PredefinedMenuItem for standard OS behaviors (Hide, Quit, copy/paste, ⌘W, etc.) grouped into App/Edit/Window submenus, plus a custom "Appearance" item/submenu with a three-way theme toggle (Light/Dark/System) built from CheckMenuItem or similar, wired to open a settings-like action. Returns the assembled Menu plus a ThemeMenu struct bundling the theme menu items/ids so a separate handler (ThemeMenu::select) can respond to selection events.
- found: Builds a full Tauri menu (App/File/Edit/View/Window) using PredefinedMenuItem for OS-standard behaviors, plus custom items: "Install Command Line Tool…", "Add Project…" (File menu, not Open), and an Appearance submenu with three CheckMenuItems for Light/Dark/System theme (System checked by default). Returns the Menu and a ThemeMenu struct holding the three theme CheckMenuItems.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted a settings-modal-triggering item and copy/paste under Edit as expected, but missed the "Install Command Line Tool…" item entirely and got the File menu item wrong (it's "Add Project…", not related to a settings panel) — the doc comment's history of the item's renames wasn't something I could have predicted from signature alone.

### `run` — QUIRKY
- spec 2 · read at `57194c3fd79f` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Tauri application entrypoint: builds a tauri::Builder, registers plugins, wires invoke_handler to the app's backend commands, calls build_menu/build_window to set up window and menu (including theme menu handling), and calls .run() to start the event loop, likely ending in .expect(...) for startup failure.
- found: Sets up shared agent-API state, builds the window and warms the harness, on macOS builds a native menu and wires theme/open-project/install-cli menu events to emit events to webviews, registers single-instance/dialog/opener plugins, registers a large invoke_handler command list, restores the previous project and spawns the agent API server, then on RunEvent::Exit stops all agent runs and releases the endpoint file before the process dies.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: I predicted the Tauri-builder/menu/plugins skeleton but missed the whole agent-API server lifecycle (shared state, warm, restore, spawn serve, and the exit-time stop_all_runs/release_endpoint cleanup) which is most of the function's actual purpose.

## src-tauri/src/local.rs

### the file itself
- spec 1 · read at `286441edffd6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Local (no-server) surprisal scoring via an in-process model as a faster alternative to Ollama's HTTP forced-decoding path. LocalModel loads a model file, runs a single decode pass to get per-token logprobs (surprisal/surprise), exposes label/is_model for SurpriseModel trait conformance, plus discover_models to find local model files on disk.
- found: Same overall shape, but specifically uses llama_cpp_4 (llama.cpp bindings) rather than a generic/candle backend, and LocalModel owns a dedicated background thread holding the non-Send/non-Sync LlamaContext, communicating via mpsc channels since llama.cpp contexts can't be used concurrently. discover_models scans specifically Ollama's blob store (~/.ollama/models/blobs) using a 100MB size heuristic, not a general model directory or format check.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The file doc explains the performance rationale well (why local beats HTTP, why Vulkan/Metal not CUDA) but says nothing about the owner-thread/channel design, which is instead explained inline near the LocalModel struct.

### `load`
- spec 1 · read at `59001fb85ed8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Opens the GGUF file at path, spawns a dedicated owner thread that loads the model (since the model/context isn't Send-safe or must stay pinned to one thread), and returns a LocalModel handle holding a channel to submit scoring jobs to that thread; load failures are surfaced somehow back to the caller.
- found: Spawns a thread that loads the LlamaBackend and LlamaModel (both Box::leak'd to 'static to avoid a self-referential struct with the borrowed LlamaContext), builds a context sized to MAX_TOKENS+64, and reports load success/failure back over a one-shot channel that load() blocks on before returning; on success the thread then loops forever receiving (prefix, body) scoring jobs over an mpsc channel, replying with score_one's result until all senders drop.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `surprisal` — QUIRKY
- spec 1 · read at `476dc5b143b1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Locks a mutex directly around the model/context and runs one decode pass over prefix+body, computing mean surprisal in bits/token from the logits, returning None on any failure.
- found: Actually dispatches the work to a separate worker via a job queue: sends (prefix, body) plus a one-shot reply channel through a mutex-protected `jobs` sender, then blocks on the reply channel for the Option<f32> result. The doc's comment about mutex-serialized GPU work explains why the queue exists, but the mechanism itself (channel dispatch to a worker thread) wasn't something I predicted.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `score_one`
- spec 1 · read at `7e93f16195bd` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Tokenizes prefix+body, does a single decode over the concatenated sequence with logits at every position, reads out per-token logprobs for the body, sums/averages them into a surprisal score, returns Option<f32> with None on failure.
- found: Tokenizes prefix and body separately, requires body >= 8 tokens, trims body to at most MAX_TOKENS/2 and trims prefix from the front to fit remaining room (never trimming body), clears KV cache, builds one batch requesting logits only at positions needed to predict each body token (not the whole sequence), decodes once, then computes average surprisal in BITS (log2) via a numerically-stable log-softmax over each body token position.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `label`
- spec 1 · read at `4f50426f582a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns a short human-readable identifier for this loaded local model, used for display/provenance tagging.
- found: Trivial accessor: clones and returns the struct's stored `label` field.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `is_model`
- spec 1 · read at `67310d59233c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A trivial trait-implementation marker returning a hardcoded true, letting calling code distinguish this in-process local-model scorer from an HTTP-based backend.
- found: Exactly that: returns the literal `true`.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `surprise` — QUIRKY
- spec 1 · read at `b4a87facc399` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Calls self.surprisal(item) and combines the result with the proxy score into a Reading, likely comparing model surprisal against the heuristic proxy.
- found: Builds a prefix from item.context and item.signature, calls self.surprisal(prefix, item.body) to get bits, and returns Reading::plain(calibrate_surprisal(bits)) on success or Reading::plain(proxy) as a fallback if the model call fails.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Docs shown were for the enclosing file/module, not this function specifically.

### `discover_models`
- spec 1 · read at `6300ccb643a9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Scans ~/.ollama/models/blobs, filters files by a >100MB size threshold to find model weights, returns their paths as a Vec.
- found: Exactly as predicted: uses dirs::home_dir(), joins .ollama/models/blobs, reads the dir, filters by metadata().len() > 100_000_000, collects paths, and additionally sorts the output before returning.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The function-level doc already gave away the size-threshold mechanism in detail, so this was closer to confirming a documented fact than predicting blind.

## src-tauri/src/main.rs

### the file itself — QUIRKY
- spec 1 · read at `85fd5a79591b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Thin Tauri binary entry point with the windows_subsystem attribute to suppress the console on Windows release builds, and a main() that just delegates to a run() function in lib.rs — pure boilerplate.
- found: Same windows_subsystem attribute, but main() actually dispatches on argv: 'mcp' subcommand runs the stdio MCP server, any other args go to the CLI (serve/study/read verbs), and no args opens the GUI window — all from one binary deliberately, per the comments, so agents and the desktop app never drift into separate implementations.
- predicted: some · documented: none · derivable: yes · legible: not judged · trap: no
- note: Not boilerplate — deliberate single-binary multi-mode dispatch (GUI/CLI/MCP) explained entirely in comments, which I could not have guessed from the file name/signature alone.

### `main` — OBSCURE
- spec 2 · read at `751e5a336219` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Standard Tauri entry point: builds a tauri::Builder, registers one or more plugins and/or invoke_handler commands, then calls .run(tauri::generate_context!()).expect(...) to launch the app, panicking on startup failure.
- found: Dispatches based on argv rather than launching a GUI directly: `mcp` subcommand runs the stdio MCP server, any other args go to a headless CLI (serve/check/read verbs), and no args at all opens the Tauri window via sanity_lib::run(). One binary intentionally serves as MCP server, CLI, and GUI app to avoid multiple installable artifacts drifting apart.
- predicted: none · documented: none · derivable: no · legible: full · trap: no
- note: Comments explain a deliberate architectural decision (single binary for MCP/CLI/GUI to avoid drift) that isn't derivable from the code shape alone.

## src-tauri/src/mcp.rs

### the file itself
- spec 2 · read at `5e84fc27ff6c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Implements the stdio MCP server the app binary runs as (invoked as `sanity mcp`). It determines the connection's role (Reader vs Human) and exposes a matching tool surface (reader_tools/human_tools/all_tools, with contract_fingerprint to detect drift), reads MCP JSON-RPC requests from stdin, dispatches each named tool call (dispatches/call/run/names) by translating it into an HTTP request (via a small client: base_url/with_retry/heal/client/get/post/urlencode/decode) against the loopback agentapi HTTP server that does the real work, and writes the JSON-RPC response back to stdout.
- found: Implements the stdio MCP server (run() reads JSON-RPC from stdin, dispatches tools/list and tools/call, writes responses to stdout), role-based tool surfaces (reader_tools/human_tools/all_tools via role()), a small HTTP client layer (base_url/client/get/post/decode) with careful retry-and-heal logic (with_retry, heal, RETRY_FOR/RETRY_EVERY, UNREACHABLE vs NOT_RUNNING error text) to reach the loopback agentapi backend, a contract_fingerprint to detect schema drift between the shim and backend, session-sticky PROJECT state so a single shim process stays bound to one repo, and a battery of tests checking the two tool surfaces are disjoint/complete and dispatchable.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: Got the overall shape right (stdio MCP shim forwarding to an HTTP backend, role-gated tool surfaces) but the header doc only explains why there's a single binary rather than a Node script; it says nothing about the retry/heal machinery, PROJECT session-stickiness, contract_fingerprint, or the careful 4xx/5xx error taxonomy, which together are most of the file's actual substance.

### `project` — QUIRKY
- spec 1 · read at `828a0c7bf6ed` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns the identifier of the current/active project, likely derived from an environment variable, CLI arg, or the current working directory, used to scope MCP tool calls (e.g., get/post/tools) to a specific project's backend.
- found: Returns a clone of a global `PROJECT` value guarded by a `Mutex<Option<String>>`, silently returning `None` if the lock can't be acquired (via `.ok()`) rather than panicking or propagating an error.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Right idea (current project name) but wrong mechanism — a global mutex-backed static rather than env/cwd-derived, and lock poisoning is swallowed into None rather than surfaced.

### `role`
- spec 2 · read at `bfd62ab401fa` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:26:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Inspects the process environment (env var or CLI arg) to determine whether this MCP server instance should present as a "reader" role (restricted tool surface for assessment) or a different/full role, returning a Role enum consumed by code that picks between reader_tools and human_tools surfaces.
- found: Reads the SANITY_ROLE env var; returns Role::Reader if it's exactly "reader", else defaults to Role::Human.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `base_url` — QUIRKY
- spec 1 · read at `9307f3f15219` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Read the endpoint file fresh (no caching) to get the current port, and build a base URL string, returning None if unreadable
- found: Checks SANITY_BACKEND env var first as an override; otherwise delegates entirely to crate::agentapi::read_endpoint().url(), a shared parser used by both the CLI and this MCP shim so the endpoint-file format isn't parsed twice
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Missed the SANITY_BACKEND env override and that parsing is delegated to a shared agentapi module rather than done inline

### `with_retry`
- spec 1 · read at `72c9619e1d27` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Loops within a time budget, resolving the endpoint fresh each attempt, calling attempt(endpoint), returning on success or fatal error, retrying transient errors with a sleep, and healing/restarting the backend once if nothing answers, until the deadline passes and it returns an error string.
- found: Same overall loop structure, but the deadline branch specifically distinguishes NOT_RUNNING vs UNREACHABLE based on crate::cli::live(), a distinction the doc comment says was recently fixed to use a live probe rather than file existence; healing is gated on !healed && cli::live().is_none() and retries immediately (no sleep) after a successful heal.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The inline comments carry a lot of historical/bugfix context (the file-existence vs probe discriminator bug) that isn't visible from the signature or file doc.

### `heal`
- spec 1 · read at `893c3d008631` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Restart the backend, and if a project was previously opened, synchronously reopen it against the new backend so a retried call doesn't hit the NO_PROJECT window
- found: Calls ensure_backend() to restart, returns Ok early if no remembered project key, otherwise posts directly to {base}/open with the path via a raw client call (deliberately bypassing the `post` helper to avoid recursion back into the retry loop)
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: Missed the deliberate bypass of the `post` helper to avoid recursion, though the docs explained it clearly

### `client`
- spec 1 · read at `0f6714dc0296` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a reqwest blocking Client with a short timeout for loopback calls, returning Result with RetryableError on builder failure.
- found: Exactly that: builder with REQUEST_TIMEOUT, mapping any build error to RetryableError::Fatal (a builder failure isn't something retrying would fix, unlike other RetryableError variants presumably used elsewhere).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `decode`
- spec 1 · read at `397997e3c2b3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Checks status; on success parses JSON; on failure reads body as text and builds an error message that differs for 4xx (arguments wrong, nothing recorded, safe to fix and resend) vs 5xx (Sanity's fault, may have recorded something, don't blindly resend), likely varying retryability by status class.
- found: Matches prediction on the status-based branching and message content, but both branches return RetryableError::Fatal (no distinct retryable variant used here) — the distinction lives entirely in the message text, not the error type. Also handles success-with-unparseable-JSON as its own case with a tailored message, and truncates the server's detail text to 400 chars.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `get`
- spec 1 · read at `f8fa773a68b5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds URL from base_url()+path, uses client() for a GET wrapped in with_retry/heal, decodes response into a Value.
- found: with_retry supplies base directly (not a separate base_url() call); builds URL, does client().get().send(), maps send error to RetryableError::Transient so with_retry can retry/heal, then decode(r).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `post`
- spec 1 · read at `34314aa7895c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Combines base_url and path into a full URL, sends via client() as an HTTP POST with JSON body wrapped in with_retry, decodes response via decode into a Value or error string.
- found: Exactly as predicted: uses with_retry closure over base url, builds client().post(base+path).json(&body).send(), maps transient send errors, then decode(r).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `urlencode`
- spec 1 · read at `6ead12706987` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Percent-encodes non-alphanumeric/unsafe bytes as %XX, passing safe characters through unchanged.
- found: Maps each byte: alphanumeric plus -_.~/ pass through as-is, everything else becomes %XX uppercase hex, collected into a String.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `all_tools`
- spec 2 · read at `205e1de8a76c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns a JSON array (Value) combining the full tool contract — likely by concatenating human_tools() and reader_tools() (or similar) into one list, each entry containing name/description/inputSchema, giving the complete unfiltered set that contract_fingerprint hashes and that tools() narrows by role.
- found: Concatenates reader_tools() and human_tools() JSON arrays into one Vec, wraps as Value::Array.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `tools`
- spec 2 · read at `b365171e0236` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Determines which surface this connection gets by calling role(), then returns either reader_tools() (just the three reader tools: sanity_next, sanity_reveal, sanity_report) or human_tools() (the rest — sanity_open, sanity_status, sanity_summary, etc.) as the JSON tool-list Value served over this MCP connection, so a spawned reader never even sees descriptions for tools it can't call.
- found: Matches on role() and returns reader_tools() for Role::Reader or human_tools() for Role::Human, exactly as named.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `reader_surface`
- spec 2 · read at `942441d295fa` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:49:08Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns a static JSON Value describing the reader-role tool surface, likely by calling reader_tools() directly (bypassing tools()) so the result doesn't depend on an env-configured role at spawn time — used for a deterministic token-pricing measurement of the reader loop.
- found: It's a one-line wrapper that just returns reader_tools() directly, exactly as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `reader_tools`
- spec 2 · read at `154a14999a7d` · commit `2903db5` · read by gemini-3.6-flash-medium · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: reader_tools constructs and returns a JSON Value representing the tool definitions offered specifically to reader agents over MCP (such as sanity_next, sanity_reveal, and sanity_report). It builds the schema structures defining parameters and descriptions required for standard MCP tool declaration.
- found: Returns a serde_json::json array of tool definitions (sanity_next, sanity_reveal, sanity_report) with schemas and descriptions for reader agents.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Prediction matched the implementation perfectly.

### `human_tools`
- spec 2 · read at `ecee0d4f15ea` · commit `2903db5` · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: human_tools is a function in src-tauri/src/mcp.rs that constructs and returns the JSON Value schema describing the human-facing MCP tool definitions provided by Sanity's stdio MCP server (as opposed to reader-facing tools).
- found: human_tools returns a serde_json::Value JSON array containing full tool schemas for sanity_open, sanity_check, sanity_status, and sanity_summary including tool descriptions and inputSchema properties.
- predicted: full · documented: not judged · derivable: no · legible: not judged · trap: no

### `contract_fingerprint`
- spec 2 · read at `36de63dce2a4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Serializes the tool contract (likely via all_tools() or similar, turned into JSON) into a canonical byte string, then computes an FNV-1a hash over those bytes, returning the result formatted as a hex string.
- found: Serializes all_tools() to JSON and computes an FNV-1a 64-bit hash over the bytes, formatted as 16-char hex.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Doc explains WHY all_tools() over tools() is critical (covers reader's surface too), which isn't derivable from the code alone — a real design rationale, not just restating the body.

### `dispatches`
- spec 2 · read at `7aa93d1c2a45` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:40Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the given tool name has a matching arm in the `call` dispatch function, without actually invoking it — probably a match statement (or list membership check) against all known tool name string literals, returning true/false. Used by tests to verify dispatch coverage without spinning up a server.
- found: A `matches!` against the seven literal tool name strings that `call` handles — a static membership check with no side effects.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `call` — QUIRKY — TRAP
- spec 2 · read at `d3711b565c61` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A big match name { ... } dispatcher that deserializes args into each tool's expected parameters and calls the corresponding handler (e.g., sanity_next, sanity_reveal, sanity_report, plus human-facing tools like scan/study), returning Ok(Value) on success or Err(String) for unknown tool names or malformed args — the single chokepoint where MCP tool names map to actual Rust functions.
- found: Dispatches MCP tool calls by name, but not directly to in-process handlers: it's a shim over an HTTP backend. First checks dispatches(name) for unknown tools, then blocks readers from calling orchestrator-only tools (sanity_open/status/summary) with an explanatory error. Then matches on name: sanity_open ensures the backend is running and POSTs /open with the path and a contract fingerprint, remembering the opened project key; sanity_check/reveal/report inject the current project key into the body and POST to the corresponding endpoint; sanity_status/summary GET their endpoints (with or without project query param); sanity_next clamps/encodes an optional n into a query string before GETing /queue. Unmatched names return an error.
- predicted: some · documented: none · derivable: no · legible: most · trap: yes
- note: The doc comment at the top warned about the exact trap this shows: dispatches(name) and the match arms must be kept in sync by hand, and sanity_reveal once shipped in schema without an arm here.

### `run`
- spec 2 · read at `4c2d7d2aabd2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Implements the stdio MCP server loop: reads JSON-RPC requests line-by-line from stdin, decodes each with `decode`, handles the `initialize` handshake and `tools/list`/`tools/call` methods by dispatching to `tools`/`call`/`dispatches`, writes JSON responses to stdout, and loops until stdin closes/EOF.
- found: Reads SANITY_PROJECT env var to seed the global PROJECT lock at startup (so a spawned reader knows its repo without calling sanity_open), then loops reading stdin lines, skipping blanks/unparseable/id-less (notification) messages, and handles initialize/tools/list/tools/call by writing JSON-RPC responses to stdout, wrapping tool errors as isError content rather than transport errors.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Missed the SANITY_PROJECT env-var bootstrapping entirely and the notification (no-id) skip — both explained in the doc comment I didn't have access to derive without reading the body.

### `names`
- spec 2 · read at `969474ddc35d` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a serde_json::Value (likely an array of tool-definition objects, each with a "name" field) and extracts a Vec<String> of those names — a small test helper used by the surface-comparison tests to turn tool-list JSON into a comparable set of strings.
- found: Exactly as predicted: unwraps a JSON array and maps each element's "name" field to a String, collecting into a Vec<String>, a test-only helper for comparing tool-list surfaces.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `the_two_tool_surfaces_are_disjoint_and_complete`
- spec 2 · read at `9006283b4ec0` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that gets the set of reader_tools and human_tools names, asserts their intersection is empty (disjoint) and that their union equals the full set from all_tools/names (complete) — verifying no tool is served twice and none is missing from both surfaces.
- found: Gets names of reader_tools and human_tools, asserts no reader tool name appears in human tools (disjoint), then merges and sorts both lists and compares against the sorted names from all_tools to confirm the union is complete.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_reader_is_offered_exactly_its_own_loop`
- spec 2 · read at `f4effee0cfce` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:19:47Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test function that calls reader_tools() (or similar) and asserts the returned tool set is exactly {sanity_next, sanity_reveal, sanity_report} by name — using a set/vec equality against explicit names rather than just checking the length, so a swap of one tool for another would fail rather than pass silently.
- found: Test asserting reader_tools() names, sorted, equal exactly ["sanity_next", "sanity_report", "sanity_reveal"].
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `every_advertised_tool_is_dispatchable`
- spec 2 · read at `69644f5ef702` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test that iterates over every tool name returned by all_tools() (or tools()), and for each one asserts that dispatches(name) returns true — i.e. that call's match statement has an arm for it. It's a regression test for exactly the drift described in the docs (schema advertises a tool that call doesn't handle).
- found: Iterates over names(&all_tools()) and asserts dispatches(&name) for each, with a message naming the tool that's advertised but not dispatchable.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `nothing_is_dispatchable_that_is_not_advertised` — TRAP
- spec 2 · read at `e899b57d66a0` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test asserting the inverse invariant of `every_advertised_tool_is_dispatchable`: it collects the set of tool names `call()` actually dispatches (or handles) and checks each one also appears in the advertised tool schema (from `tools()`/`all_tools()`), failing if some name is dispatchable but not advertised — i.e. no dead/hidden tool that still answers calls without being in the published contract.
- found: Asserts a hardcoded list of the seven tool names known to be dispatched by `call()` are all present in `names(&all_tools())`, the advertised schema set — guarding against a tool that answers calls without being advertised.
- predicted: most · documented: full · derivable: no · legible: full · trap: yes
- note: Predicted the right invariant direction and purpose, but expected the dispatched-name set to be derived dynamically from call()'s match arms rather than hardcoded — the hardcoding means a newly-dispatchable-but-unadvertised tool added later wouldn't be caught unless someone remembers to add it to this literal list.

### `the_fingerprint_sees_the_readers_half` — QUIRKY
- spec 2 · read at `1e5340813abc` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A unit test that computes contract_fingerprint() and asserts it reflects/changes with the reader tool schema (reader_tools()) rather than the human tool schema (human_tools()) — confirming the fingerprint is carried by the orchestrator over the surface it does not itself serve, per the doc comment.
- found: Serializes all_tools() to a JSON string and asserts every reader tool name appears as a substring in it — a simpler containment check than the fingerprint-hash comparison I predicted.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/model.rs

### the file itself
- spec 1 · read at `facd499708fc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Defines shared types Lang, Provenance, Score, and Node, with Node aggregation (dir/aggregate/visit) rolling child scores into a directory's LOC-weighted hot share rather than a mean, excluding unanalysed lines, validated by many named invariant tests.
- found: Header confirms the size-is-lines/colour-is-surprise separation and the temperature-vs-hot_share distinction between function and container wedges; Lang enum (read at top) matches prediction as the exhaustive list of parseable languages, with a comment noting unparsed languages still render as scoreless wedges. Did not read the Provenance/Score/Node bodies in full.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The header explains the design rule (size vs colour independence) very well but says nothing about Lang, Provenance, or the aggregation mechanics themselves — those are only visible via the peer list and field docs, not the module header.

### `from_extension`
- spec 1 · read at `071ed7ae1925` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A large match mapping known file extensions to Lang variants (possibly lowercased first), falling through to None for anything unrecognized.
- found: Exactly a big verbatim (not lowercased) match covering ~50 languages, with several extensively-commented deliberate tie-breaks for ambiguous extensions (.h/.cpp family to Cpp not C, .v to Verilog not V-lang, .pl to Perl not Prolog, .m to ObjC not MATLAB, .r/.R both to R), falling to None otherwise.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `label`
- spec 1 · read at `c498758b608f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A method on Lang returning a static human-readable display name via a large match over every language variant; the 67 lines is just enumerating supported languages.
- found: Exactly that: a match over all ~62 Lang variants returning their display strings (e.g. Rust, TypeScript, C++, Objective-C, GDScript, jq).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `weight`
- spec 1 · read at `77429a5e2d9b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Match on enum variants returning a discount multiplier: 1.0 for human, 0.0 for model-authored, partial (~0.5) for Source.
- found: Match returns None=0.0, Source=0.6, History=0.85, Human=1.0 — four variants, not the three I guessed, and no explicit 'model-authored' variant (None fills that role).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `temperature`
- spec 1 · read at `dbe0be3b05b2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns self.surprise as-is, a plain accessor.
- found: Returns self.surprise.clamp(0.0, 1.0) — the clamp wasn't something I predicted.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc explains the historical/design point (surprise alone, no doc discount, definition changed once) which the code itself doesn't reveal.

### `is_stable`
- spec 1 · read at `fcc7f260c9ce` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Threshold check on an age field (~90 days) treating young/busy as not-stable; didn't know the exact combination of churn and age_days fields used.
- found: Returns self.churn < 0.25 && self.age_days.is_some_and(|d| d > 90.0) - combines a churn ratio threshold with an age-in-days threshold (90 = one quarter).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `quadrant` — QUIRKY
- spec 1 · read at `7f407691f346` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Splits into four quadrants by surprise (hot/cool) and stability; loc handles an edge case like zero-analysed-lines returning a distinct 'no heat' quadrant.
- found: Matches (surprise>=HOT, is_stable()): hot+stable=CrownJewel, hot+unstable=Trouble, cool+loc>=40=Bloat, cool+small=Quiet. loc is only consulted for the cool branch to distinguish Bloat from Quiet, not as an edge-case guard.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `dir`
- spec 1 · read at `4bc0c53b8d9e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Constructor for a Node representing a directory: sets path/name, marks kind as Dir, initializes children to empty vec and score-related fields to defaults/None since directories aggregate rather than measure directly.
- found: Exactly that: builds a Node with id/path/name from path/name args, kind=NodeKind::Dir, excluded=false, all measurement-related fields (loc, line, lang, last_author, doc, signature, owner, body, end_line, score) set to zero/None, hotspots and children as empty vecs.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `aggregate` — QUIRKY — TANGLED — TRAP
- spec 1 · read at `6c303e224eac` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Recursively aggregates children, LOC-weighted, computing a hot_share fraction over analysed lines only (excluding unanalysed lines from denominator), storing result on self.
- found: Recurses into children (Func nodes are leaves and return early), recomputes loc for non-Func nodes, LOC-weights surprise/documented/churn/hot_share/analyzed_share, takes max age_days and min last_touched_days across children, fixes provenance to Source::Proxy, and excludes Source::Proxy-sourced func scores from analyzed/hot — a rule the code's own comment flags as diverging from the hand-maintained JS twin `reaggregate` in api.ts, which counts both.
- predicted: some · documented: some · derivable: no · legible: some · trap: yes
- note: The function's own comment documents a live discrepancy with a duplicate implementation (api.ts reaggregate) — two implementations of one answer disagreeing.

### `visit`
- spec 1 · read at `4934713a4512` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Calls f(self), then recurses into each child calling visit(f), a pre-order depth-first traversal.
- found: Exactly as predicted, nothing more.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `score` — OBSCURE
- spec 1 · read at `5ec5f5cc55d7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes a derived Score by combining surprise/documented into temperature and churn/age into a stability measure, with actual arithmetic/logic.
- found: It's just a test-helper constructor: a plain struct literal assigning the four inputs directly and filling the rest of Score's fields with fixed test defaults (commits=0, provenance=Source, hot_share=0.0, analyzed_share=1.0). No derivation logic at all.
- predicted: none · documented: none · derivable: yes · legible: full · trap: no
- note: This turned out to be a private test-fixture builder, not the scoring logic itself — the real computation must live in Score's methods (temperature/is_stable/quadrant) or elsewhere.

### `temperature_is_surprise_and_documentation_does_not_discount_it`
- spec 1 · read at `d6abbed69b4c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test constructing two Score instances with same surprise but different documentation, asserting temperature() equal for both, showing docs don't discount temperature.
- found: Directly asserts score(surprise, doc, 0.0, 0.0).temperature() equals the surprise value regardless of the doc argument (1.0 vs 1.0 with doc=0 or 1; 0.8 with doc=0.5), confirming temperature == surprise param exactly.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `quadrants_split_on_surprise_and_stability` — QUIRKY
- spec 1 · read at `48acd6b32ddf` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Constructs Score values varying surprise and stability, calls .quadrant(), and asserts a 2x2 cross product of hot/cold x stable/unstable quadrant labels.
- found: quadrant() takes a size/loc argument too and there's a third dimension (age, via the score() helper's 4th float arg, e.g. 400.0 vs 3.0 days) — young surprising code is forced into Trouble rather than CrownJewel regardless of stability, and low-surprise code splits into Bloat vs Quiet based on the size argument passed to quadrant(), not just the score itself.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: Quadrant depends on three inputs (surprise, age, and a size parameter passed to quadrant()), not just the two axes the file doc's headline sentence implies.

### `a_directory_reports_the_share_of_it_that_is_hot_not_the_mean`
- spec 1 · read at `dac34ae034c9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A unit test constructing a directory Node with mixed hot/cold child function wedges of different LOC, calling aggregate(), and asserting the resulting hot_share reflects the LOC-weighted fraction that is hot rather than a simple average of scores.
- found: Exactly that: builds hot (100 loc, surprise 1.0) and cold (300 loc, surprise 0.0) function children under a dir, calls aggregate(), asserts hot_share == 0.25 (100/400) while noting the mean surprise (0.25*1.0=0.25, so <0.3) is still available but not what colours the wedge.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `unanalysed_lines_are_left_out_of_hot_share_entirely`
- spec 1 · read at `9af15d2567b1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a directory with one hot analysed child and one unanalysed child (no score), aggregates, and asserts hot_share only counts the analysed portion — the unanalysed LOC is excluded from the denominator rather than counted as cold.
- found: Both children DO have a Score (not None); the unanalysed one has analyzed_share=0.0 and Source::Proxy, signaling zero coverage rather than absence of a score. hot_share comes out 1.0 (100% of analysed lines are hot) and analyzed_share is 0.25 (100/400), confirming hot_share is computed only over the analysed slice.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_wedge_nothing_has_analysed_reports_no_heat_at_all`
- spec 1 · read at `3404a3b4079b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that a Node/wedge with nothing analysed reports zero heat/temperature rather than defaulting to some hot or cold value, so the frontend correctly renders it grey instead of coloring it.
- found: Builds a dir Node containing one Func child whose score has analyzed_share 0.0 (Source::Proxy), calls d.aggregate(), and asserts the aggregated directory score has both analyzed_share 0.0 and hot_share 0.0 — i.e. an unanalysed function must not contribute any hot_share the frontend could paint the directory with.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `hot_share_composes_through_nested_directories`
- spec 1 · read at `fe5b38adc106` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds nested tree with varying hot line counts and checks aggregate hot_share composes correctly through multiple levels via LOC weighting.
- found: Two-level tree (root/mid dir containing one fully-hot 50-loc func and one fully-cold 50-loc func); after root.aggregate(), root's hot_share is exactly 0.5 — confirms LOC-weighted composition up through one level of directory nesting.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `aggregation_is_loc_weighted_not_per_function`
- spec 1 · read at `099eacd93857` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test with children of different LOC and surprise scores, aggregating and asserting the parent score is LOC-weighted rather than a simple per-child average.
- found: Directory node with two Func children — a 3-line hot (surprise=1.0) one and a 300-line cold (surprise=0.0) one — aggregated; asserts total loc=303 and aggregated surprise < 0.05, proving LOC-weighting rather than the 0.5 a per-function average would give.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `model_authored_text_cannot_cool_a_wedge` — QUIRKY
- spec 1 · read at `ee79bee061cb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test guarding that documentation existing/authored doesn't reduce a wedge's temperature/surprise score, likely comparing two Score/temperature computations directly.
- found: Test asserts Provenance::None.weight() == 0.0 and Provenance::Source.weight() < Provenance::Human.weight() — guarding that there's no Provenance variant giving weight to model-authored text, so an LLM-doc pass can't discount surprise.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Got the intent right but the actual mechanism (Provenance::weight ordering) is more specific/indirect than what I predicted.

## src-tauri/src/parse.rs

### the file itself
- spec 1 · read at `f66acd21d559` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A tree-sitter-based multi-language extraction engine producing FuncDef records (name, signature, body, doc, owner, line span) by walking the tree and matching node kinds per language, with heavy per-language special-casing for doc comments/docstrings/file docs and owner qualification for methods, backed by many named per-language test cases.
- found: Header doc confirms the kind-matching-over-queries design rationale; the FuncDef struct (read at top of file) confirms the field set and the reasoning behind each (signature as the conditioning context for surprise scoring, owner kept separate from name to avoid identity collisions, serialisable for scancache memoisation). Did not read the full 1222-line body of per-language extraction logic, only the header and struct.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: The module doc explains only the kind-vs-query design choice; it says nothing about the FuncDef shape or the extensive per-language doc-comment/owner special-casing visible in the peer list, so it covers only one facet of a much larger file.

### `loc`
- spec 1 · read at `0e1677eba3db` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Trivial accessor: end_line - start_line + 1, computing line count from stored span fields.
- found: self.end_line.saturating_sub(self.start_line) + 1 — same formula, with saturating_sub to guard underflow.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `language`
- spec 1 · read at `bf7d31809fbd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A match statement over the Lang enum mapping each language variant to its corresponding tree_sitter grammar crate's LANGUAGE constant, converted via .into() into a tree_sitter::Language.
- found: Exactly that: a match over every Lang variant, each arm calling the corresponding tree-sitter grammar crate's LANGUAGE constant (or a specific variant like LANGUAGE_TSX, LANGUAGE_PHP) and converting with .into().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `func_kinds`
- spec 1 · read at `3a5b17a6cb09` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Match over Lang returning static slice of tree-sitter node kind names that count as functions for that language, feeding parse_functions' kind matching.
- found: Exactly that, but covering roughly 45 languages, with several deliberately non-obvious choices (Elixir uses 'call', R uses 'binary_operator', lisps use 'list'/'list_lit', OCaml uses 'let_binding') where the kind alone can't identify a function and a separate `accepts` predicate carries the real test — extensively commented per-language.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `declarator_is_function`
- spec 1 · read at `520561382090` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a declarator's init value is a function-like node (arrow function/function expression) so const foo = () => {} counts as a function but const n = 4 does not.
- found: Exactly that: checks the 'value' field's kind against arrow_function, function_expression, function, generator_function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `text`
- spec 1 · read at `ec98efc5bd5b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Trivial helper extracting the source text slice for a tree-sitter node from its byte range into src.
- found: node.utf8_text(src.as_bytes()).unwrap_or(\"\") - uses tree-sitter's utf8_text helper, defaulting to empty string on error.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `leading_doc` — TRAP
- spec 1 · read at `928f9d553bf2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Walks backward through preceding siblings, skipping attribute/decorator nodes, collecting contiguous comment lines with no blank-line gap, stopping at the first gap or non-comment node; returns None if nothing adjacent found.
- found: Same backward walk/attribute-skip/blank-line-adjacency mechanism as predicted, but ALSO explicitly breaks out on inner doc comments (//! or /*!) since those describe the enclosing module rather than the following item, avoiding duplicate delivery since file_doc already collects them separately. Lines are reversed, joined, trimmed, and returned as None if empty.
- predicted: most · documented: most · derivable: no · legible: most · trap: yes
- note: The doc's own closing paragraph calls out that a cold reader predicted just the blank-line rule and missed the inner-doc-comment exclusion, which is exactly what happened here before reading the body.

### `wrapper_doc`
- spec 1 · read at `3bb3df0748bc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Walks upward through wrapper node kinds, stopping as soon as a non-wrapper parent is hit, returning the leading doc comment of the outermost wrapper found.
- found: Loops up to 3 levels: at each step, if the parent isn't in DOC_WRAPPERS it returns None immediately (does not keep climbing past a non-wrapper); otherwise checks leading_doc on that parent and returns it if present, else continues to the next level up.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `owner_of` — QUIRKY
- spec 1 · read at `335ae57df339` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks up from the function node to find the single nearest enclosing type (class/impl/struct) and returns its name, stripping generic parameters like Parser&lt;T&gt; down to Parser. For Go, special-cases the receiver since Go methods carry it on the function node itself rather than via an ancestor.
- found: For Go, extracts the receiver type name directly from the function's receiver field, stripping generic brackets and taking the last identifier segment. For other languages, walks the ENTIRE ancestor chain (not just the nearest) collecting up to 3 levels of enclosing type names, then joins them with dots (e.g. Boolean.Input) so nested generic-style wrapper classes are disambiguated.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Missed that the general-language path collects the whole ancestor chain (capped at 3, dotted) rather than just the nearest enclosing type — the docs I was handed only covered the Go receiver fix, not this chain behavior.

### `python_docstring`
- spec 1 · read at `97ab06ebed79` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Checks the first statement of the body; if it's a string expression, extracts and cleans the string as the docstring; otherwise returns None.
- found: Skips leading comment nodes (to handle shebangs) to find the first real statement, unwraps an expression_statement if present, and if the resulting node is a string node, extracts its text, strips quote chars and whitespace, returning it; otherwise None.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `strip_comment_markers`
- spec 1 · read at `eaf5f3ec3e46` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Strips comment syntax markers (//, /*, */, *, #, etc.) from each line of a raw doc-comment block across languages and returns normalized plain text.
- found: Per line: trims whitespace, strips ///, //!, /**, //, /*, leading #, trailing */, leading *, trims again, then joins lines with \n and trims the whole result.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `file_doc` — QUIRKY
- spec 1 · read at `b0c7037e17bc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Branches on language: Rust looks for //! comments, Python looks for a module docstring, others take the leading comment run before the first declaration if separated by a blank line from what follows.
- found: Parses the file with tree-sitter. Python uses python_docstring on the root. Other languages walk top-level children, skipping past import/use/package declarations (since headers often sit below them), collecting comment runs (split on blank lines), taking //! or /*! only for Rust, and popping the last run if it's adjacent to the first real declaration (so it isn't double-claimed as that declaration's own doc) — except for Rust where //! is unambiguous. Then filters out anything matching licence markers, and truncates to FILE_DOC_MAX on a word boundary with an ellipsis.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The comment explains a specific historical bug (TypeScript/Go/Java files reading as headerless because the old code stopped at the first import) — that's not derivable from the code alone.

### `parse_functions`
- spec 1 · read at `a53faa73c822` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Sets up a tree-sitter Parser for the given language, parses src into a tree, then walks the tree collecting function definitions into a Vec<FuncDef>, returning an empty vec rather than erroring if language setup or parsing fails.
- found: Exactly that: creates Parser, returns empty vec if set_language fails or parse returns None, otherwise gets func_kinds for the language and calls collect() on the root node to fill an output Vec<FuncDef>, which it returns.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `collect` — QUIRKY — TRAP
- spec 1 · read at `600851bbefb7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the tree, and for nodes matching kinds, extracts a FuncDef via extract() and pushes to out, then recurses into children regardless to find nested functions.
- found: Checks accepts(); for variable_declarator nodes also checks declarator_is_function. On successful extract, pushes and returns WITHOUT descending further (so nested closures aren't double-counted as separate functions). Only recurses into children when the node didn't match/extract.
- predicted: some · documented: none · derivable: no · legible: most · trap: yes
- note: I predicted it always recurses into children after collecting a match; it actually returns early specifically to avoid double-counting nested closures inside a matched function's body.

### `accepts` — QUIRKY
- spec 1 · read at `fe5c77dc9b54` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Straight kind-membership test, special-cased for Elixir where a generic 'call' node needs its head identifier checked against def/defp/defmacro to filter out non-function calls.
- found: Kind membership first, then a match over Lang with a distinct disambiguation rule per language where node kind alone is ambiguous: Elixir (call target is def/defp/defmacro/defmacrop), OCaml (has a parameter child to distinguish `let f a = ...` from `let x = 5`), F# (function_declaration_left present), R (rhs is a function_definition), Nix (expression is a function_expression), Clojure (lisp head is defn/defn-/defmacro/definline), Scheme/Racket (define/define-syntax head AND second child is a list), Prolog (term is a binary_operation, i.e. a rule not a bare fact); all other languages default to true.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment only explains the Elixir case; the function actually special-cases eight languages total, so the doc covers a small fraction of the disambiguation logic.

### `first_of_kind`
- spec 1 · read at `acfd540f9c99` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns the first direct child of node whose kind() equals the given kind string, or None.
- found: Exactly that, via node.children(&mut node.walk()).find(...).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lisp_head`
- spec 1 · read at `b844a821dd9f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns the text of the node's first named child as the lisp head symbol, since that covers both Clojure's wrapped sym_lit and Scheme/Racket's bare symbol.
- found: Exactly that, plus a `.trim()` on the text I hadn't predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Doc explains the cross-grammar rationale (why first named child works for both nesting styles) which is not derivable from the one-line body alone.

### `name_node` — QUIRKY
- spec 1 · read at `675b18990ee4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Falls back to child_by_field_name(\"name\") as the common case, with special handling for a few languages (JS/TS arrow-consts, Lisp head symbols, Rust quirks) where the name isn't a simple field.
- found: A large match over ~25 language variants, each with its own tree-shape-specific extraction (C/C++ declarator-chain walk handling operator overloads/casts, Dart signature nesting, ObjC/Odin/D bare identifier scan, SQL object_reference, Elixir call target, GLSL/HLSL declarator chain, R/Nix/OCaml field aliases, Lisp-family positional named_child, Julia/Fortran/Ada/Pascal/Elm statement-node lookups, CMake first argument, Verilog wrapper-or-field, Prolog functor, PowerShell function_name), defaulting to child_by_field_name(\"name\") for everything else.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `body_node`
- spec 1 · read at `5068721d7da4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Finds the body child node of a function/chunk node, per language, since tree-sitter grammars name or nest the body field differently across languages; likely a match on Lang with per-language field lookups and a fallback, returning None when nothing matches.
- found: Matches on Lang: a handful of languages (R, Nix, Odin, Prolog, GdShader) need special traversal because the body is nested one level down or under a differently-named field; then falls back to a generic `body` field lookup; then falls back to a per-language node `kind()` string search (Kotlin, ObjC, SQL, Elixir, Haskell, D, Vhdl, PowerShell, Ada, Cmake); the final default case handles arrow-function-style bindings where the body hangs off the initializer's value.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

### `body_span`
- spec 1 · read at `1f2c8fc01706` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Uses body_node if present for the span; otherwise falls back to header_end..node.end_byte() for languages without a distinct body node.
- found: Exactly that, plus a guard: the fallback span is only returned if start < end (otherwise None), rather than assuming header_end always leaves a nonempty body.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `header_end`
- spec 1 · read at `12da39905fc3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Finds byte offset ending a function's header/signature for languages with unwrapped bodies, using named grammar fields per language rather than positional indexing to avoid shifting from optional fields.
- found: A match over ~10 languages (Julia, Fortran, Elisp, Common Lisp, Visual Basic, Verilog/SystemVerilog, OCamlLex, Scheme/Racket, Clojure), each using `first_of_kind` or `child_by_field_name` with fallback chains suited to that grammar's shape, defaulting to None for every other language.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `extract`
- spec 1 · read at `678349bf1b07` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Given a candidate tree-sitter node, pulls name/body span/owner/doc and assembles a FuncDef, returning None if the node doesn't qualify.
- found: Gets name via name_node, body span via body_span (both None-propagating, no explicit `accepts` check visible here), slices signature as text before body start and body_text as the body slice. Doc extraction is language-specific: Python looks for a docstring inside the body else falls back to a leading comment; Elisp reads a `docstring` field else falls back to leading comment; everything else (incl. JS/TS arrow consts) tries a leading doc then walks outward through wrapping declarations (`wrapper_doc`) to find a comment on an enclosing `const`/`export`. Builds FuncDef with name, signature, body, doc, owner_of(...), and 1-based start/end line numbers.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

### `names`
- spec 1 · read at `1bdc565ae5e3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test helper: parses src with parse_functions for lang, extracts just the function names into a Vec<String> for easy test assertions.
- found: Exactly that: parse_functions(lang, src).into_iter().map(|f| f.name).collect().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `rust_functions_and_doc_comments`
- spec 1 · read at `e5e3f78997a1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Parses Rust functions with doc comments, asserting correct name/signature extraction and doc-comment attachment, robust to blank lines/attributes.
- found: Parses a doc-commented function (multi-line /// surviving an #[inline] attribute) plus an undocumented function containing a closure; asserts exactly 2 functions found (closures aren't separate wedges), correct name/signature/doc for the first, and doc is None for the second.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_blank_line_severs_a_comment_from_the_function`
- spec 1 · read at `c462c1e4a82b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Test that a comment separated from a function by a blank line does not become that function's doc — a doc must be immediately adjacent.
- found: Exactly that: an SPDX licence header followed by a blank line then fn thing() asserts doc.is_none(), guarding against every file's licence header being misread as its first function's documentation.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `typescript_arrow_consts_and_methods`
- spec 1 · read at `5b2665e4cff3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Unit test feeding TSX source with an arrow-function const, a plain const, and a class method into the parser, asserting arrow consts and methods are recognized as functions while plain consts are not.
- found: Exactly that, via names() and parse_functions(Lang::Tsx, src): asserts Panel and load are found, NOT_A_FUNCTION is not, and also checks the doc comment on Panel is captured as \"The component.\"
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `rust_module_docs_are_the_file_doc`
- spec 1 · read at `e9c5499ba522` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test verifying that a Rust //! module doc comment is extracted as file_doc, separate from a function's own /// doc comment.
- found: Exactly that: asserts file_doc() picks up the //! lines joined, and parse_functions()[0].doc keeps the function's own /// comment separately.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `rust_item_docs_are_not_the_file_doc`
- spec 1 · read at `ed75e12a612b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Parses Rust source with a /// comment above the first function, asserts file_doc is None (not mistaken for a //! file doc) while presumably checking the function's own doc is still captured.
- found: Exactly: src = \"/// Opens it.\\npub fn open() {}\\n\"; asserts file_doc(Lang::Rust, src) == None. Only checks the file_doc side, no separate assertion about the function's own doc.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I over-predicted a second assertion about the function's own doc being populated; the test only checks the file_doc side.

### `a_licence_header_is_not_documentation`
- spec 1 · read at `eb9b89053885` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test verifying that a copyright/license header comment at the top of a file is not treated as the file's documentation by file_doc extraction — it should return None/empty rather than the license text.
- found: Test asserts file_doc(Lang::Go, src) is None when the source starts with a Go copyright/license comment block followed by a blank line before the first function.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_comment_attached_to_the_first_item_is_not_the_file_doc`
- spec 1 · read at `eae2b6a4731b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that a comment immediately preceding the first item (no blank line) is treated as that item's doc comment, not as the file_doc, while a comment separated by a blank line before the first item IS the file_doc.
- found: Exactly that: `"// Goes.\nfunc go() {}\n"` yields `file_doc == None` (attached comment belongs to the function), while `"// The gate package.\n\n// Goes.\nfunc go() {}\n"` yields `file_doc == Some("The gate package.")` (detached by a blank line).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_header_below_the_imports_is_still_the_file_doc`
- spec 1 · read at `43073eb52d07` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Test with TS source: imports at top, doc comment below them, then a declaration with its own doc comment; asserts file_doc extraction returns the comment below imports, not the one touching the declaration.
- found: Exactly that: asserts file_doc(TypeScript, src) returns the comment under the imports, distinguishing it from the comment attached to the interface declaration.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_shebang_does_not_hide_a_python_module_docstring`
- spec 1 · read at `29555f714925` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Unit test: Python source with shebang line then module docstring, asserting file_doc extraction still finds the docstring despite the shebang preceding it.
- found: Exactly that: file_doc(Lang::Python, src) on shebang+docstring+function source equals Some(\"Generate the placeholder app icon.\").
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `python_module_docstrings_are_the_file_doc`
- spec 1 · read at `838387d02e52` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test asserting a Python module's leading triple-quoted docstring is captured as the file_doc.
- found: Exactly that: asserts file_doc(Lang::Python, src) returns the docstring content.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_long_header_is_cut_and_says_so`
- spec 1 · read at `86baa925f59f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test builds a Rust file with an oversized //! header doc, parses it, and asserts file_doc is bounded to FILE_DOC_MAX and ends with an ellipsis truncation marker.
- found: Exactly that: builds src with 400-word //! header, calls file_doc, asserts length <= FILE_DOC_MAX+2 and ends with '…'.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `python_docstrings_are_the_doc`
- spec 1 · read at `71b25bfaa267` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test parsing a Python function with a docstring, asserting the extracted function's doc field equals the docstring text, stripped of quotes.
- found: Exactly that: parses `def go(n): \"\"\"Runs the thing.\"\"\" return n+1`, asserts name \"go\" and doc == \"Runs the thing.\"
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `go_methods_and_functions`
- spec 1 · read at `6ac5d1f4bc5e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test parsing Go source with a plain function and a receiver method, asserting both are extracted as functions and the method's owner is set to its receiver type.
- found: Parses Go source with a plain function and a receiver method, but only asserts on extracted names (['Add','Load']) via the `names` helper — does not check owner qualification directly in this test.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_method_is_qualified_by_the_type_it_hangs_off`
- spec 1 · read at `0e8fb83a87fa` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Parses a Rust snippet with a type and a method, asserting the parsed function's owner equals the type name rather than being ownerless.
- found: Parses two impl Type blocks (including two same-named 'parse' methods, twins), an 'impl Trait for Type' block (owner is Tag, the type, not Read the trait), a trait default method (owner is Descriptor, the trait), and a free function (owner None); asserts the full owners vector matches.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `owners_across_the_languages_that_claim_one`
- spec 1 · read at `af858851ba0b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test iterating over several languages, parsing a method inside a class/struct/impl, asserting parse_functions reports the enclosing type as owner.
- found: Tests Python, Swift, TypeScript, and Go (twice, including a generic receiver `Parser[T]` which must attribute to `Parser` not `T` — a regression case) plus asserts a free Rust function has owner None (must not inherit the file's name).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_nested_owner_names_its_whole_path`
- spec 1 · read at `afb27290539a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test parsing nested classes (mirroring the ComfyUI example) and asserting the method owner is the full dotted path, not just the innermost class.
- found: Parses two classes each with an identically-named inner class Input containing as_dict, asserts owners are "Boolean.Input" and "Image.Input" to show same-named inner classes stay distinguished; also checks a single-level class yields just "Suggester" with no trailing dot.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `unparseable_input_yields_nothing_rather_than_panicking`
- spec 1 · read at `28372eae137c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test feeding malformed/garbage source into parse_functions and asserting it returns an empty result rather than panicking, for at least one language.
- found: Exactly that: `parse_functions(Lang::Rust, "fn (((")` and `parse_functions(Lang::Go, "")` both assert `.is_empty()`, covering both malformed syntax and an empty file.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `a_nested_type_does_not_inherit_the_enclosing_docstring`
- spec 1 · read at `bb7f1942fa6f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A regression test (matching the file_doc's bug story about Context.init and SentenceSuggester) with Swift source containing a documented outer class and an undocumented nested type/method, asserting that the doc walk does not climb past the immediate function/method to attribute the enclosing type's docstring to an undocumented member.
- found: Exactly as predicted: parses Swift source where `SentenceSuggester` has a doc comment, its nested `Context.init` and its own `untouched()` method are undocumented, and `next()` has its own doc comment. Asserts `init` and `untouched` both get `doc: None` rather than inheriting the class's docstring, while `next`'s doc is correctly extracted.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_cpp_header_yields_its_methods_not_its_namespace`
- spec 1 · read at `7226e2895307` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Parses a C++ header via Lang::from_extension('h'), asserts extracted functions are real methods only (not namespace, not field), owners are the enclosing class not namespace, and spans don't bleed into sibling methods/classes.
- found: Parses a template struct with constructor/operators plus two classes; asserts exact ordered name list (including operator overloads), explicitly checks namespace 'demo' and field 'v' are excluded, checks owner is the class for two same-named-pattern methods (step/reset), and asserts step's span ends before reset's class starts plus exact loc() of 4.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `swift_functions_methods_and_inits`
- spec 1 · read at `a0261177f953` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Parses a Swift snippet with a free function, a struct method, and an init, asserting all are extracted as functions with correct owner/name.
- found: Also covers a static func and an extension method; asserts full name list ["add","greet","init","make","extra"], checks doc comments and signature text pass through, and confirms an extension method's name isn't polluted by the extension wrapper.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `every_language_finds_its_functions`
- spec 1 · read at `79ed7431da3f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A big table-driven test: one small source snippet per supported language, parsed via the function-extraction machinery, asserting the extracted function names match an expected list for each language.
- found: Exactly that in structure — dozens of (Lang, source, expected names) tuples covering every supported grammar — but instead of asserting per case (which I assumed), it collects every mismatch into a `broken` vec across all languages and fails once at the end with all of them listed, specifically so one CI run finds every broken grammar rather than one at a time.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `classes_are_not_chunks`
- spec 1 · read at `955da9aa2e4c` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test verifying class_declaration is excluded from chunk-producing node kinds; parses a class with methods and asserts only methods are counted, not the class itself, to guard against the double-counting bug.
- found: Test parses Java class with two methods, asserts fns.len()==2 (class itself not a chunk); then tests Ruby class with one non-empty method, asserting 1 fn, with a comment noting an empty Ruby method has no body node and is dropped for unrelated reasons.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/reports.rs

### the file itself
- spec 2 · read at `6c6a8c40e045` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This file maintains the persistent index of projects the app knows about — a list of repo paths plus per-project settings like which harness (agent CLI) and which model/reader to use for scans, stored as JSON under a data directory. It provides get/set accessors for harness and reader/model per project, path helpers (data_dir, index_path), and load_index/save_index to serialize the whole list to disk. It explicitly does not store reading/assessment data, which lives in the repo's own .sanity/ directory instead — this file was trimmed down after that dual-storage design caused a bug where deleting visible data silently un-hid an older copy.
- found: Defines KnownProject/KnownProjects, a persisted (projects.json under a resolved data_dir, with a test-only SANITY_DATA_DIR override) index of repos the app has opened, each with an optional machine-local harness and model preference. harness_for/model_for read a single field, set_harness/set_reader upsert an entry, load_index/save_index handle atomic (temp+rename) JSON persistence with silent failure since nothing awaits the result.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: The module doc's title ('the sizes behind the delete button') refers to a delete-everything panel that's since been removed in favor of rm -rf .sanity — so the header is partly a historical/stale description of a feature no longer in the file, not something derivable from the current code.

### `harness_for`
- spec 2 · read at `9449cc8e7d8f` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Loads the saved project index (load_index), finds the entry for `key`, and returns its stored harness field as Option<String> — None if the project isn't in the index or has no harness configured yet.
- found: load_index().projects, find by key, and_then get harness, then filter out an empty string (treating "" the same as unset) — matches my prediction except I didn't anticipate the empty-string filter.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `set_harness` — QUIRKY
- spec 2 · read at `3f25e179c972` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, looks up the entry by `key` (creating one with the given `repo` path and `name` if it doesn't exist yet), sets its harness field to `harness`, then saves the index back to disk.
- found: A one-line wrapper delegating to set_reader(key, repo, name, Some(harness), None) — the actual index load/lookup/create/save logic lives in set_reader, not here.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `model_for`
- spec 2 · read at `c8b52b6bf902` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Loads the persisted project index (via load_index) and looks up the entry for the given project key, returning its configured "model" field (e.g. a preferred reader model like sonnet/haiku) if the project exists and has one set, otherwise None.
- found: Loads the project index, finds the project entry matching the key, and returns its model field if present and non-empty.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `set_reader`
- spec 2 · read at `0bcff2e5eeb3` · commit `2903db5` · read by gemini-3.6-flash-medium · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: set_reader updates the stored project configuration in the index file for a given project key. It modifies the project's assigned harness and/or model (leaving any None arguments untouched) and saves the index to disk.
- found: Loads project index, pushes new KnownProject if missing, updates harness and/or model if provided as Some, and saves index back to disk.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Prediction was complete and accurate.

### `data_dir`
- spec 1 · read at `304076d2f901` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Checks SANITY_DATA_DIR env var test seam first, else falls back to dirs::data_dir() joined with an app subdir, returning Option<PathBuf>.
- found: Exactly that (SANITY_DATA_DIR or dirs::data_dir().join(\"Sanity\")), plus it also calls create_dir_all to ensure the directory exists before returning it.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `index_path`
- spec 1 · read at `dd06184e0634` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Joins data_dir() with a fixed filename to produce the path to the project-list index file, returning None if data_dir is unavailable.
- found: Some(data_dir()?.join("projects.json")) — exactly as predicted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `load_index`
- spec 1 · read at `bb72b464d58d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Reads the index JSON file from index_path(), deserializes into KnownProjects, defaulting to empty on any missing file or parse failure.
- found: index_path().and_then(read_to_string).and_then(serde_json::from_str).unwrap_or_default() — exact match.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `save_index`
- spec 1 · read at `d5573add5411` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Serializes index to JSON, writes to a .tmp file next to index_path, renames atomically into place, cleaning up the temp file on rename failure, all errors silently swallowed.
- found: Exactly that: gets index_path (returns early if none), serializes to pretty JSON (returns early on failure), writes to path.json.tmp, and if write succeeded but rename failed, removes the temp file. All via let-else/let _ silent swallowing.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## src-tauri/src/scan.rs

### the file itself
- spec 1 · read at `0673131f37c7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Top-level orchestrator: walks a repo (respecting gitignore/vendored dirs, detecting nested/non-repos), parses and scores files, builds the tree the sunburst renders, with tests pinning specific invariants.
- found: Confirmed by the header comments and top of the file: git_root refuses non-repo directories rather than guessing, repos_inside detects a folder-of-projects mistake, VENDORED list is a second line of defense beyond .gitignore for non-repo subtrees, MAX_FILE_BYTES/MINIFIED_LINE_BYTES filter out generated noise — all consistent with the one-line doc but with much more nuance (specific bug histories, deliberate refusals) than the doc states.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no

### `git_root`
- spec 1 · read at `bfbf34880a2f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Shells out to git rev-parse --show-toplevel from path, returns Some(root) or None on failure, no parent-guessing fallback.
- found: Exactly that: Command::new(git) -C path rev-parse --show-toplevel, None on exec failure/non-success/empty stdout, else Some(trimmed PathBuf).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `repos_inside`
- spec 1 · read at `676bc5135f06` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Reads immediate subdirectories of path, checks each for a .git directory, collects matching names into a Vec<String>.
- found: read_dir(path), returns empty vec on error; filters entries whose path joined with .git exists; maps to filename string; sorts and returns.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `not_a_repo`
- spec 1 · read at `1262c25954c2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds a not-a-repo error string; checks repos_inside(path) and if nonempty lists nested repos as a suggestion, else gives a plain message with no guessed explanation.
- found: Exactly that, plus it always appends a fixed explanation of why git is needed (age/churn/blame come from git history, assessments are committed), truncates the list to 3 shown with a '+N more' suffix, and pluralizes/phrases the message around inside.len().
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `commit_count`
- spec 1 · read at `ce0d921725c7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Shells out to git to count commits reachable from HEAD (e.g. rev-list --count HEAD), returning 0 on any failure/no history.
- found: Exactly that: runs `git -C <repo> rev-list --count HEAD`, parses stdout as usize on success, defaults to 0 on any failure (bad exit, spawn error, parse error).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `collect_files`
- spec 1 · read at `424b1aa9b20c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Uses ignore::WalkBuilder respecting .gitignore to walk root, filters to files with a known language extension, returns Vec<(PathBuf, Lang)>.
- found: Same core walk+filter, but also: require_git(false) so .gitignore is honoured even without a real git repo, a MAX_FILE_BYTES size cap, and a VENDORED path-component exclusion list applied via strip_prefix(root).
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc explained why require_git is disabled, which the code alone wouldn't obviously justify; missed the size cap and vendored exclusion entirely.

### `rel`
- spec 1 · read at `f57e03277bd1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes path relative to root as a string with forward slashes on all platforms, likely via string replace of backslashes.
- found: strip_prefix(root) (falling back to the full path if not under root), then maps each path component to a string and joins with '/', guaranteeing forward slashes regardless of OS path separator convention.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `ephemeral`
- spec 1 · read at `0b24b07d3a89` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns a pair of fresh, non-persisted Cache and ScanCache instances for tests/just scan to avoid touching real disk cache.
- found: Delegates to each type's own ephemeral() constructor: (Cache::ephemeral(), ScanCache::ephemeral()), rather than a generic Default.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc explains why ephemeral memos exist (tests must not answer from a file) but not the trivial delegation in the body.

### `scope_of`
- spec 1 · read at `5d62e1de983e` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Checks for .sanityignore at root; if present builds a Gitignore matcher from it and returns Some, else returns None since there are no default exclusions.
- found: Exactly that: joins root with .sanityignore, returns None if absent, otherwise builds a GitignoreBuilder rooted at root, adds the file, and returns build().ok().
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `context_for`
- spec 1 · read at `b3e478b0470d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds context by combining file header/imports with nearby sibling function signatures+bodies, chosen around skip's position rather than the file's start.
- found: Starts from file.head, computes a window centered on skip (clamped via saturating_sub so near-boundary functions still get a full window from whichever side has neighbours), skips the target index, takes CONTEXT_SIBLINGS functions, and for each appends its signature plus only the first CONTEXT_SIBLING_LINES lines of its body.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `parse_file`
- spec 1 · read at `6cc452bc8899` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Looks up the file in the parse cache; on a hit reuses the cached functions/doc/head/hash, on a miss re-parses the source into functions, extracts the file doc, and stores the result back in the cache. Recomputes fingerprints fresh based on fidelity (skipped at Ordering) and returns a ParsedFile, or None if unreadable or unparseable.
- found: Matches prediction closely, plus: skips files with any minified/overlong line, returns None if parsing yields zero functions, computes 'excluded' (gitignore match) freshly every call regardless of cache since .sanityignore can change, and always parses+returns excluded files (rather than skipping them in the walk) so exclusion counts stay accurate.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `apply_dir_history` — TRAP
- spec 1 · read at `59c0254fdc87` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree, and for both Dir and File nodes (per the doc's explicit warning that the name undersells it) looks up the node's path in history and sets its score's commit count from the distinct-commit lookup, then recurses into children.
- found: Exactly as predicted: `if node.kind == Dir || File`, sets `score.commits = history.commits_of(&node.path)` when a score exists, then recurses over all children.
- predicted: full · documented: full · derivable: no · legible: full · trap: yes

### `score_dir` — QUIRKY
- spec 1 · read at `960a0466316a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: I expected this to iterate over parsed files in a directory, compute per-file surface/churn metrics via history and blame, and produce a Vec of (name, Node) pairs for insertion into the tree, building a Node per file with scored children.
- found: It does that but with much more nuance than I predicted: for each function it prefers blame-derived per-function history over file-level history when available (falling back otherwise), builds a peer set of fingerprints (same-file peers if the file has multiple, else directory-wide) to compute distinctiveness, computes a surprise score and a documentation score discounted by provenance (comments already in source code count as `Provenance::None`, not `Human`), and constructs both function-level Nodes (with full Score) and a wrapping file-level Node (with a `body` hash keyed to the file's doc + function surface, not its bytes, so implementation-only edits don't invalidate the file's documentation reading).
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The reading_hash on the file node is deliberately based on the signature surface, not full file bytes, so editing a function body doesn't retire the file-level doc assessment — a subtle design choice not guessable from the signature.

### `ordinals`
- spec 1 · read at `6eedc9651175` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates funcs in order keeping a per-name running count in a HashMap, returning a parallel Vec<usize> of each function's zero-based index among same-named functions seen so far.
- found: Exactly that: HashMap<&str, usize> seen, map over funcs incrementing and returning the pre-increment count per name.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `file_surface`
- spec 1 · read at `808877986a14` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Maps FuncDefs to their signatures (or names) in file order, joined into one deterministic string used as a stable fingerprint shared between scan and resync_changed.
- found: Exactly: maps to f.signature, collects, and joins with '\n'.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains *why* this must be deterministic/shared (avoiding flip-flopping staleness) but not derivable from code alone that it's signatures specifically vs names.

### `apply_model_scores`
- spec 1 · read at `3c84d0157f47` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree; for func leaves found in the upgrades map, overwrites the proxy score with the model reading and marks source as model, then recurses into children otherwise.
- found: For Func nodes: looks up node.id in upgrades, if present sets score.surprise, score.source=Model, score.analyzed_share=1.0, and copies hotspots from the reading; then returns (no recursion needed since funcs are leaves). For non-func nodes, recurses into children.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the hotspots field being copied and that analyzed_share is set to exactly 1.0 explicitly.

### `insert`
- spec 1 · read at `6b89f111df90` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Splits rel_path, walks/creates directory node chain under root, appends file node at the deepest directory.
- found: Exactly that: splits on '/', walks all but the last segment, finds or creates a dir child by name (tracking accumulated relative path for the new node's identity), descends, then pushes the given node as final child.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `collapse_chains`
- spec 1 · read at `372859bc858a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively walk the Node tree, and for directory nodes with exactly one directory child, merge that child into the parent (name concatenation, adopt id/path/children) to collapse chains into a single wedge.
- found: Recurses into children first, then while node is a Dir with exactly one child that is also a Dir, removes that child, merges names with '/', and adopts the child's id, path, and children — looping to handle multi-level chains.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `scan`
- spec 1 · read at `55408598cf2e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walk the repo (respecting gitignore), parse each file into functions, compute directory/context info, score functions via the SurpriseModel while reporting per-directory progress through on_progress, support early cancellation via the AtomicBool (keeping already-scored results), use the memos/cache to avoid rescoring unchanged functions, aggregate scores up into a directory tree, and return a Scan struct consumed by the sunburst UI.
- found: Collects and groups files by directory (BTreeMap for deterministic ordering), parses all files in parallel, runs git blame only on parsed files for provenance, builds a fast all-grey proxy-scored tree immediately so the UI shows repo shape in ~1s, then (if a real model is used) builds a priority-ordered work queue (by proxy surprise intensity, not size) skipping cache hits, scores in parallel while streaming per-item on_scored/on_progress calls, merges cached+scored results, re-aggregates the tree and reapplies dir history (since aggregate zeroes commit counts), and finally returns Scan with stats.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `fixture` — QUIRKY
- spec 1 · read at `f6944d8e34fb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper building a small temp repo directory with some nested source files (and probably a git init/commit) for scan() tests to operate on, returning the TempDir.
- found: Creates a tempdir with a nested src/deep/nest/a.rs containing two small functions, plus a .gitignore excluding vendor/ and a vendor/huge.rs file that should be skipped by the scan — no git init/commit involved, just a plain directory tree exercising gitignore handling.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `ordering_fidelity_changes_the_score_and_nothing_else`
- spec 1 · read at `4812ee33d4e7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Runs scan twice (Full and Ordering fidelity) on same fixture, asserts structural equality of resulting trees (files, functions, lines, ids) except that Ordering fidelity should report UNDECIDED for the distinctiveness/surprise score instead of computing it.
- found: Test runs scan at Full and Ordering fidelity on a fixture repo, asserts function counts, files scanned, and loc match, and that the sorted set of function ids is identical between the two, plus a sanity check that the fixture actually produced some functions. It does not itself check the UNDECIDED distinctiveness claim mentioned in the doc comment.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The file-level doc comment's claim about UNDECIDED distinctiveness isn't asserted in this specific test body — likely covered by a different test.

### `run` — QUIRKY
- spec 1 · read at `5cc740d026dd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Orchestrates the real scan pipeline itself: walks directory, parses files, applies dir history and model scores, collapses chains, returns Scan.
- found: A test helper that just delegates to the real `scan()` function with ephemeral memos, a HeuristicModel, no-op callbacks, an unset AtomicBool cancel flag, and Fidelity::Full, unwrapping the result. It doesn't orchestrate steps itself — scan() does that internally.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I assumed this was the production entry point manually chaining the peer helpers, but it's a test-only thin wrapper around scan() with stubbed dependencies.

### `gitignored_paths_never_enter_the_picture`
- spec 1 · read at `ae7a09b435fc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Unit test that scans a fixture repo with gitignored content and asserts the resulting tree excludes gitignored paths while including tracked ones.
- found: Runs the shared fixture/run helpers, visits all node names in the resulting tree, and asserts a known tracked name ('add') is present while a known gitignored name ('vendored') is absent.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `single_child_directory_chains_collapse_to_one_ring`
- spec 1 · read at `4a6e2aaffd42` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that a chain of single-child directories collapses into one combined node/ring instead of separate thin rings per directory level.
- found: Uses a fixture with a src/deep/nest chain, runs the scan, and asserts root has exactly one child named "src/deep/nest" (the collapsed chain), while root itself keeps the repo's own directory name rather than being collapsed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `parents_are_exactly_as_wide_as_their_children`
- spec 1 · read at `19946b1cfeb3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test asserting parent node's width/weight equals sum of children's widths, using a fixture tree and scan/run function, asserting equality.
- found: Uses fixture() and run() to build a scanned tree, then asserts a file node's loc equals the sum of its children's loc, and also the root's loc equals that same sum.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `documentation_is_graded_not_discounted`
- spec 1 · read at `874cdb525a8d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Test showing documentation status is tracked separately from the surprise grade rather than discounting it — likely compares a documented vs undocumented function and asserts the score isn't multiplied down by having docs.
- found: Runs the fixture repo, checks 'sub' (undocumented) has documented==0.0 and 'add' (documented) has documented>0.0, but deliberately does NOT assert temperature differs between them — instead asserts add.temperature() == add.surprise, proving there is no discount multiplier applied to temperature from documentation; a comment explains a prior '<=' assertion was vacuous and documentation now only affects grading via the model's own reading of the comment stack, not a formula.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The test's comment explicitly calls out that a previous version of this assertion (add.temperature() <= sub.temperature()) could never fail once the multiplier was removed — a good example of a regression test that silently stopped testing anything.

### `a_repo_without_git_says_so_rather_than_guessing`
- spec 1 · read at `3afe426ce180` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test that scans a fixture directory with no git repo and asserts the scan explicitly marks the absence (rather than fabricating placeholder git data) — likely a flag on the scan stats and null/absent per-node git-derived fields.
- found: Scans a git-less fixture, asserts stats.without_history is true, then visits every node and asserts any present score has age_days == None rather than a guessed value.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_functions_context_is_its_neighbours`
- spec 1 · read at `66b687ed9745` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds a multi-function file fixture, computes context for a mid-file function, asserts context is drawn from adjacent neighbours (not always the first functions) and excludes the function itself.
- found: Builds an 8-function fixture; context_for(file,6) contains f5 (neighbour before) but not f0 (top) or f6 (self); context_for(file,0) at the top edge still gets a full window pulled from the available side (f1 and f2), not f0 itself.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `an_edit_above_a_function_does_not_change_its_identity`
- spec 1 · read at `fb503dffef06` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test verifying function ids stay stable when code above them moves/changes, by parsing a fixture before and after inserting a line and asserting id equality.
- found: Test that writes a small Rust source to a temp dir, scans it, collects function node ids, then rewrites the file with an added `use std::fmt;` import above the two functions and asserts the ids are identical before/after.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `same_named_functions_keep_separate_identities`
- spec 1 · read at `42821d37e78b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test constructs two same-named functions in one file and asserts the scanner assigns each a distinct identity based on ordinal position rather than line number.
- found: Test writes a file with two impls each defining fn go, scans it, collects Func node ids, and asserts they are 'a.rs#go' and 'a.rs#go#2' — later duplicates get a numeric suffix appended to the name-based id rather than being distinguished by owner or line.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `scanning_an_empty_directory_is_not_an_error`
- spec 1 · read at `b0c1952516fb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test that scanning an empty temp directory succeeds rather than erroring, presumably returning an empty tree.
- found: Uses a `run` test helper on an empty temp dir and asserts stats.functions == 0 and root.loc == 0 — confirms no error and an empty tree, via specific field checks rather than a bare Ok/Err.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/scancache.rs

### the file itself
- spec 1 · read at `9b4f281d673c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A machine-local on-disk cache (ScanCache) keyed by file content memoizing tree-sitter parse and git blame per file, backed by an append-only JSONL log, with helpers for git head/ancestry and hashing, plus an extensive test suite pinning invalidation semantics.
- found: Matches: Stored/Entry/Look/Hit/Ident types, ScanCache with ephemeral/open/path_for/look/put_parse/put_blame/retain/save, a (mtime,len) gate plus content hash as the real key, a separate blame_commit oid to catch revert-and-reapply, FORMAT_VERSION/PARSE_VERSION double invalidation, append-with-periodic-compaction log strategy, and the test-name peers are indeed individual test functions encoding invalidation rules.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `ephemeral`
- spec 1 · read at `606db0e2db76` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructs a ScanCache with no backing file path (in-memory only) and empty state, so it never persists; used by tests/headless scanner.
- found: Builds ScanCache with path: None, default Stored (versioned), default Dirty, and empty head string — exactly the no-disk in-memory cache predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `open`
- spec 1 · read at `457d936d5d4e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Loads cache file for repo, drops everything on format mismatch, and drops only blame data if history was rewritten (cached HEAD not an ancestor of current HEAD), otherwise keeps the cache.
- found: Reads and parses a log-structured cache file, checks both FORMAT_VERSION and PARSE_VERSION (dropping to a fresh empty Stored on mismatch), then if the stored head is non-empty, differs from current head, and is not an ancestor of it, clears blame on every entry while keeping parses. Wraps into a ScanCache with mutexes for inner state and dirty tracking.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `path_for`
- spec 1 · read at `4e72bf5bc4c5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Hashes the repo's absolute path (likely with the fnv peer function) into a filename under some machine-local cache directory, returning None if that directory can't be resolved.
- found: Joins 'scans' onto crate::reports::data_dir(), creates the dir, hashes the repo path with fnv() into a 16-hex-digit filename with .json extension.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `look` — QUIRKY
- spec 1 · read at `a133d745ecac` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Compares last_commit oid against cached commit to decide freshness; reads/hashes the file only when there's no trustworthy commit oid (outside churn window).
- found: Fast path gates on mtime+len metadata matching the cache entry, returning cached parse data without reading the file; if that misses, reads and hashes the file content, and reuses the cached entry if the hash still matches (byte-identical rewrite); blame is only kept if its cached commit oid equals the wanted commit. Falls back to Look::Miss with the freshly read source if nothing matches.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `cached_blame`
- spec 1 · read at `2ec19d76cdac` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns Some(FileBlame) only if both stored hash and stored last-commit oid match the given ones; otherwise None.
- found: Same logic, but locks a mutex first (returning None on poison via ok()?), and treats a None last_commit by comparing against a sentinel ANCIENT constant rather than branching on Option equality directly.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `put_parse` — TRAP
- spec 1 · read at `4b9f4ca6e37b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Locks internal state and inserts/updates a cache entry for rel_path with the parsed funcs, lang, file_doc, and head, leaving blame empty for put_blame to fill later, then marks the path touched.
- found: Locks self.inner, looks up the previous entry for rel_path, and carries forward its blame/blame_commit only if the previous entry's hash matches ident.hash (same bytes) — otherwise resets blame to None. Inserts a new Entry with mtime/len/hash/lang/funcs/file_doc/head plus that carried-or-reset blame, drops the lock, then calls self.touched(rel_path).
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: Carrying blame forward keyed only on content hash (not also on head/commit) could be a staleness trap if blame data depends on more than file bytes, but I'm not certain enough of blame semantics to be sure this is a real bug rather than intended behavior.

### `put_blame`
- spec 1 · read at `b4cff4cc7c1a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Locks the internal cache map, and if an entry already exists for rel_path (i.e. a parse entry), updates its blame and last-commit fields; otherwise does nothing, since a blame without a parse entry would be an orphan.
- found: Matches: locks self.inner, and if entries.get_mut(rel_path) finds an existing entry, sets e.blame and e.blame_commit (defaulting to a sentinel ANCIENT when last_commit is None). Additionally calls self.touched(rel_path) after releasing the lock, which I did not predict.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `retain`
- spec 1 · read at `cdbd9ca0ab63` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Locks the internal entry map and removes any entries whose key is not in the live set, purging stale entries for deleted files.
- found: Does that, and also tracks whether any entries were actually dropped; if so, marks the cache's dirty state as needing a full rewrite next save, since the append-only log format can only record updates, not removals.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `touched`
- spec 1 · read at `24669c45b5dd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Buffers dirty keys and flushes to disk once the buffer crosses a threshold, batching writes instead of writing per change.
- found: Locks self.dirty, inserts key into a HashSet, checks len >= FLUSH_EVERY, and if so calls self.save() (full save, not a raw append) outside the lock guard scope.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `save`
- spec 1 · read at `8f02cea7e101` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Writes dirty entries as appended lines to the cache file, with a header if needed, then checks if the log has grown too large relative to actual data and rewrites/compacts the whole file if so; errors are swallowed silently.
- found: Locks inner state and dirty tracker; decides compact-vs-append via `stale` ratio (d.lines vs entries.len()*COMPACT_RATIO + FLUSH_EVERY) or explicit rewrite flag or zero lines. Compact path writes full file to a .tmp then renames atomically (crash safety) and resets dirty state. Append path builds only the changed entries' lines and opens with append+create (so a deleted cache file doesn't permanently silently no-op), writing and clearing dirty keys on success. All fs errors are swallowed via is_ok() checks rather than propagated.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `header_line`
- spec 1 · read at `814484f4c4b2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Serializes header metadata from a Stored struct (likely including git HEAD and a version marker) to a single JSON line for the log-format cache file.
- found: Builds a JSON object with version, parse, and head fields from Stored, serializes it, appends a trailing newline, defaulting to empty string on serialization failure.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `entry_line` — QUIRKY
- spec 1 · read at `21a32316ab68` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Serializes key and Entry into a single line of text for a flat-file cache format, likely a hand-rolled delimited string.
- found: serde_json::to_string(&json!({\"k\": key, \"e\": e})).unwrap_or_default() + \"\\n\" — one JSON object per line (JSONL format), not a delimited string.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: I expected a hand-rolled delimited format rather than JSONL.

### `read_log` — TRAP
- spec 1 · read at `92b851d4998a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a JSON-lines append log into a Stored struct: the first line is a header (version/metadata), subsequent lines are key+entry pairs merged into a map; any line that fails to parse — notably a trailing partial line from a killed-mid-write append — is silently skipped rather than treated as fatal, and it returns how many lines were successfully consumed.
- found: Matches the prediction closely: line 0 is treated as the header (version/parse/head, missing fields default to 0/empty), later lines need both a `k` string key and an `e` entry value to be inserted into the map, and any JSON-parse failure or missing field on ANY line (not just a trailing partial one) is silently skipped via `continue` without incrementing `lines`. Note the header detection is by raw enumerate index 0, not \"first successfully-parsed line\" — if line 0 were ever blank or malformed, the real header line would be misparsed as a data entry instead.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes

### `git_head`
- spec 1 · read at `cc6a1ef855dc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Runs git rev-parse HEAD in the repo path and returns the trimmed commit hash, falling back to empty string on failure.
- found: Exactly: Command::new("git") with -C repo rev-parse HEAD, filters on success status, trims and lossily decodes stdout, unwrap_or_default on any failure.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `is_ancestor`
- spec 1 · read at `98aa0378ebf1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Shells out to `git merge-base --is-ancestor old HEAD` in the repo, returning true on success exit code and false on any error.
- found: Exactly that: runs `git -C repo merge-base --is-ancestor old HEAD`, maps success status to true, defaults to false on any process error via unwrap_or.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `fnv`
- spec 1 · read at `50d273b4c38d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A simple FNV-1a-shaped byte hash: start from a fixed 64-bit offset basis, XOR each byte in, multiply by a fixed constant each step, return the final u64.
- found: Exactly that: h starts at 0xcbf29ce484222325, loop does h ^= byte then h = h.wrapping_mul(0x100000001b3), returns h.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc says 'the multiplier is not FNV-1a's prime', but 0x100000001b3 and the offset basis 0xcbf29ce484222325 both look like the actual standard FNV-1a 64-bit constants to me — the doc's claim seems questionable rather than confirmed by the code shown.

### `func`
- spec 1 · read at `047897e34ce1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test-helper constructor building a FuncDef from a name, with placeholder default values for the remaining fields, for test setup convenience.
- found: Exactly that: builds a FuncDef with the given name, a synthesized signature `fn {name}()`, a trivial body, and placeholder/default values (None, line 1) for doc, owner, and line range.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `a_new_cached_field_cannot_be_added_silently`
- spec 1 · read at `fc62ad5a76aa` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A tripwire test that guards against silently adding a field to Entry without bumping FORMAT_VERSION, likely by asserting a fixed field count or list somehow tied to the struct definition.
- found: Constructs a full Entry, serializes it via serde_json, sorts the resulting JSON object's keys, and asserts them against a hardcoded literal list of field names, with a failure message instructing to bump FORMAT_VERSION and update the list.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `seeded`
- spec 1 · read at `bf58a00896a7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Writes body to a file in dir, populates a fresh ScanCache with a parse entry for it, returns (cache, path) for other tests to reuse.
- found: Writes body to dir/a.rs, creates an ephemeral ScanCache, confirms an empty cache misses via `look`, then calls `put_parse` with a single fake function \"one\" to seed the entry; returns (cache, path).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `an_untouched_file_is_taken_from_the_cache`
- spec 1 · read at `975b7e067eab` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Seeds a ScanCache with an entry for a file, reruns the lookup on the unchanged file, and asserts the result came from cache rather than being recomputed, likely comparing parse/blame data or a hit indicator.
- found: Uses a `seeded` helper to create a cache with one file containing `fn one() {}`, then calls `cache.look(\"a.rs\", &path, None)` and asserts it returns `Look::Hit` with a function named \"one\" — confirming the cache hit path returns the parsed data.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `an_uncommitted_edit_is_never_served_from_the_cache`
- spec 1 · read at `cb8bc87a3c92` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Seeds cache with an entry, then looks up with different hash/content simulating an uncommitted edit, asserts the lookup misses/returns None rather than serving stale cached functions.
- found: Uses a real tempdir: seeds the cache against original file content, then physically overwrites the file on disk with added content, and asserts cache.look() returns Look::Miss — confirming an edited-but-uncommitted file is never served stale.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_cache_from_a_different_parser_is_not_reused` — QUIRKY
- spec 1 · read at `2b2adf3b33c6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Loads a cache written with a mismatched parser version and asserts it's treated as stale/not reused rather than served.
- found: Builds three header variants (matching parse version, parse version+1, and no parse field at all) via read_log, and checks a `live` predicate (format version + parse version match) is true only for the exact match — the +1 and missing-parse cases are both considered not live.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `identical_bytes_with_a_new_mtime_still_hit`
- spec 1 · read at `f5433394105c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Seeds a cache entry, rewrites the file with identical bytes after changing content and sleeping (to force a new mtime), then asserts cache.look still Hits on content hash.
- found: Matches exactly: writes different content, sleeps 20ms, writes original bytes back, asserts Look::Hit with the seeded function still present.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_reverted_and_reapplied_file_keeps_its_parse_and_loses_its_blame`
- spec 1 · read at `c989d299b24b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that seeds a cache entry, changes the recorded "last commit" for the same file bytes to a different commit hash, then verifies the parse (funcs) is still served from cache (hit) while the blame is treated as stale/dropped since it belonged to the old commit.
- found: Exactly that: seeds cache with content and blame tagged to commit "aaa", looks it up under commit "bbb" with identical bytes, asserts the parse hit still has funcs but blame is None, and confirms cached_blame() also returns None directly.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `on_disk`
- spec 1 · read at `78dc5ad1cdbc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test helper building a ScanCache against a real on-disk log file (vs the in-memory ephemeral() helper), writing given files and saving, so tests exercise the actual log format rather than just the in-memory map.
- found: Opens a real ScanCache at repo, writes each (name, body) to disk, asserts a fresh look() misses and yields an ident, populates the cache via put_parse with a single dummy function ('one') tagged Lang::Rust and commit 'head', then calls save() and returns the cache (not reloaded from disk, still the live in-process handle backed by a real log file).
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `saving_appends_rather_than_rewriting_the_whole_store`
- spec 1 · read at `d0d08ebb4878` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that saves the scan cache repeatedly (once per new file) and asserts the on-disk log's line count grows by exactly one line per save rather than being rewritten in full each time, proving the append-only cost model (one header line + one line per file, regardless of how many times save() was called).
- found: Matches: starts with one file already cached on disk, then adds b.rs/c.rs/d.rs one at a time, calling look/put_parse/save() per file. Asserts the final file has exactly 5 lines (1 header + 4 file entries) despite save() being called 4 times total, and separately confirms reopening the cache yields 4 in-memory entries (dedup/reconciliation of the appended log on load).
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `a_torn_last_line_costs_only_its_own_entry`
- spec 1 · read at `b183397d158e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Writes valid cache entries then appends a truncated/garbled line, reopens the cache, and asserts the earlier valid entries still load fine despite the torn trailing line.
- found: Builds an on-disk cache with two files, appends a hand-truncated JSON fragment as a third line to simulate an interrupted write, reopens via ScanCache::open, and asserts entries.len() == 2 — confirming the two good entries survived and only the torn line was lost.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_dropped_file_does_not_come_back_on_the_next_open`
- spec 1 · read at `e29ed0047d0c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Creates a cache with two files, retains only one (dropping the other), saves, reopens, and asserts the dropped file's entry is absent while the retained one remains.
- found: Exactly that: on_disk cache with a.rs and b.rs, retain(["a.rs"]), save, reopen via ScanCache::open, assert a.rs present and b.rs absent.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `files_no_longer_in_the_scan_are_dropped`
- spec 1 · read at `4ca43586469c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A unit test seeding a cache with files, then rescanning without one file and asserting that file's entry is purged rather than persisting.
- found: Seeds a cache with one file "a.rs", calls cache.retain(&empty HashSet) to simulate that file no longer being in the scan, then asserts cache.look() returns Look::Miss for it.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/surprise.rs

### the file itself
- spec 1 · read at `4899dc97d99d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Defines the SurpriseModel trait, HeuristicModel offline proxy, and a Reading result type, delegating actual heuristic computation to heuristic.rs, with tests for hot/cold calibration.
- found: Matches core structure, but I missed two significant pieces: the `Item` struct (the full prompt context — name/signature/body/peers/doc/context) that a model-backed scorer would need, and `Hotspot` (contrastive per-token evidence of surprise). The header also carries an extensive post-mortem on a removed Ollama forced-decoding model and why naive rebuilds (diffing generated bodies, raw entropy) fail — history I had no way to predict.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `min_lines`
- spec 1 · read at `98edc6d07a18` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Default trait method returning a small constant threshold (e.g. 3-4) below which the real scorer is skipped in favor of a cheap proxy.
- found: Default implementation simply returns 0 — the trait-level default disables the skip-below-threshold behavior; a real threshold must be an override elsewhere (likely on a model that needs it).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `is_model`
- spec 1 · read at `3900abe39a35` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Trait default method returning false, since the proxy isn't a real model; a real model impl would override to true.
- found: Exactly that: default impl returns false.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `label`
- spec 1 · read at `6adc7c8cf6b5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a short constant identifying-string for this model, e.g. \"heuristic\".
- found: Returns the literal string \"heuristic (no model)\".into()
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `surprise`
- spec 1 · read at `f0fae9312fa4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Passes the heuristic proxy value through unchanged, wrapping it in a Reading (ignoring the Item), consistent with HeuristicModel being an honest proxy rather than a real model.
- found: Ignores _item and wraps proxy in Reading::plain(proxy), passing it through untouched.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `plain`
- spec 1 · read at `7bb8ffa101ad` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Constructor wrapping a raw surprise float into a Reading with default/empty values for other fields, a bare reading with no extra provenance.
- found: Constructs a Reading with the given surprise value and an empty hotspots Vec (not a label as I guessed, but the same idea of a minimal/bare reading).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `calibrate_surprisal`
- spec 1 · read at `763ba74fd2db` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A monotonic clamp/linear mapping of bits-per-token onto 0..1 using calibrated thresholds, not an analytic formula.
- found: Linear map (bits - 0.5) / (4.0 - 0.5) clamped to [0,1], with PREDICTABLE=0.5 and UNEXPECTED=4.0 bits/token as the calibrated band edges.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `predictable_code_is_cold_and_unexpected_code_is_hot` — QUIRKY
- spec 1 · read at `9e9b579da256` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that runs HeuristicModel::surprise on a predictable code sample and an unusual one, asserting the predictable one scores lower and the unusual one scores higher.
- found: Tests calibrate_surprisal directly on raw numeric inputs: low input (0.2) maps to 0.0, high input (9.0) maps to 1.0, and it's monotonic between 1.0 and 3.0 - no HeuristicModel or code samples involved, just the calibration curve itself.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Peer calibrate_surprisal wasn't shown, so I guessed at code-sample-based testing rather than the numeric calibration curve it actually tests.

### `the_heuristic_model_passes_the_proxy_through_untouched`
- spec 1 · read at `bdff3ae1eb67` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Unit test verifying HeuristicModel.surprise() returns the proxy value unchanged, with no scaling or transformation applied
- found: Builds a minimal Item and asserts HeuristicModel.surprise(&item, 0.73).surprise == 0.73 — confirms surprise() takes the pre-computed proxy score as a parameter and returns it verbatim in the result struct's .surprise field
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/watch.rs

### the file itself
- spec 1 · read at `3bc87fd9322e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Repo-change detection via a cheap stat probe (not a real fs watcher): stamp/hash build a signature from file mtimes/sizes across the repo, probe() compares against a previous signature to decide whether to rescan. Tests verify an edit changes the signature while an untouched repo doesn't, the app's own .sanity/ writes don't count, and a git commit alone still moves the signature even without touching working-tree files.
- found: Exactly as predicted: Marks{tree, git} holds two FNV-1a hashes — one over every in-scope file's path+mtime+length (walked with the same ignore rules as the scanner, explicitly excluding .sanity/), one over .git/HEAD and .git/index metadata separately, since a commit/checkout/rebase changes blame without touching working-tree files. probe() builds both. The three tests confirm: edits/new files move tree, .sanity/ writes don't move anything, and a HEAD change moves git without moving tree.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no
- note: The header's justification for stat-polling over notify/fsevents/inotify (coalescing, per-user watch limits, the already-1.5s-granular poll loop) is design reasoning that could not be reconstructed from the code alone, so derivable=false despite the header matching the code closely.

### `hash`
- spec 1 · read at `ab046fa6235f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: FNV-1a hash step: XOR each byte into h then multiply by the FNV prime, return h.
- found: Exactly that — wrapping_mul by 0x100000001b3, one loop, returns h. Takes initial h as param so caller supplies offset basis and can chain/fold multiple inputs.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `stamp`
- spec 1 · read at `37e54f4bc220` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Combines an existing hash with file metadata (mtime and/or size) into a new u64 fingerprint so any change in those fields changes the stamp; used for the stat-probe change detection.
- found: Folds mtime (as nanoseconds since epoch) and file length into the incoming hash h by chaining two calls to hash(), producing a combined fingerprint.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `probe`
- spec 1 · read at `d105b40f71a7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Walk the repo with the same ignore rules as the scan (excluding .sanity/), compute a cheap stat-based signature per file (path + mtime/size), and aggregate into a Marks value that can be compared cheaply against a later probe to detect changes
- found: Walks with ignore::WalkBuilder (hidden, gitignore, global, parents, filtering out .sanity), rolling-hashes each file's path bytes plus a metadata stamp into `tree`; separately stamps .git/HEAD and .git/index metadata into `git`; returns Marks{tree, git} as two independent rolling hashes
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Did not anticipate the split into two separate hash accumulators (tree vs git HEAD/index) rather than one combined signature

### `an_edit_moves_the_marks_and_an_untouched_repo_does_not`
- spec 1 · read at `ed16a8152686` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Probes a fixture repo, confirms identical probe with no changes, then edits a file and confirms the probe's stamp/tree changes.
- found: Writes a file, probes twice with no change asserting equality; edits the file and asserts probe.tree differs; then also adds a brand new file and asserts tree differs again — three cases, not two.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `writing_the_assessment_is_not_a_change_to_the_repo`
- spec 1 · read at `f6a514b2c896` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test asserting the stat probe ignores writes under .sanity/ so the assessment's own output doesn't register as a repo change.
- found: Creates a temp repo with one file, takes probe() before, writes .sanity/README.md, asserts probe() is unchanged after — exactly the predicted invariant.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_commit_moves_the_marks_without_touching_a_file`
- spec 1 · read at `657fd2f8a7b0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that simulates a commit without touching working-tree files, and asserts the watch module's fingerprint value changes anyway, since it must be sensitive to git HEAD not just file mtimes.
- found: Test writes .git/HEAD to simulate being on branch 'main' plus a source file, calls probe(), then rewrites .git/HEAD to point at 'other' branch (no working-tree file touched) and calls probe() again. Asserts probe().tree is unchanged but probe().git differs — confirming probe() returns separate tree/git fingerprints and the git one tracks HEAD changes independent of file content.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
