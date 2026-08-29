# src-tauri — sanity assessment

936 of 936 read · 155 surprising

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

## src-tauri/build.rs

### the file itself
- spec 2 · read at `85fd5a79591b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:58Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Standard Tauri build script — a tiny main() that calls tauri_build::build() to run Tauri's build-time codegen (embedding icons, generating context) before the app compiles. Boilerplate, no custom logic.
- found: Standard Tauri build script: main() calls tauri_build::build(). Nothing else.
- predicted: full · documented: none · derivable: yes · legible: not judged · trap: no

### `main`
- spec 2 · read at `4b8ff0908edc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Standard Tauri build script: calls tauri_build::build() and nothing else.
- found: Calls tauri_build::build(), the standard Tauri build script boilerplate.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/agentapi.rs

### the file itself
- spec 3 · served in 14 parts · read at `abd508d5a474` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:32:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file implements the full loopback HTTP API server backing the agent-driven sanity protocol: project/app state (open, rescan, persist, focus/select), a task queue that spreads readings across files without repeats and resyncs on file changes, the lease-based reveal/report flow that enforces predict-before-reveal and refuses revision or partial reports, grade aggregation and summary/health/status endpoints, plus an extensive embedded test suite (the many snake_case `a_..._is_...` functions) that pins down these invariants.
- found: Confirmed: project/app state, the file-spreading lease-based queue, the reveal/report protocol enforcing predict-before-reveal (with paged bodies and mangled-call detection), aggregation/summary/status/health endpoints, and the huge embedded test suite are all here. Beyond my prediction: it also runs and orchestrates reader subprocesses itself (run_wave/check/detached), restores/rescans all known projects on launch across two size-based lanes, watches the filesystem for changes (watch_tick/resync_changed), handles daemon lifecycle (retire/build_id/headless), and publishes/reads a loopback endpoint file for coordination between the CLI, window, and MCP shim.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `persist` — TRAP
- spec 3 · read at `6b38c32ca845` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:41Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Loads the on-disk project index, then for each project this session actually has loaded in memory, updates/inserts its entry (touched, files, scan_ms, harness, model, etc.) into the loaded index by key — leaving entries for projects not currently loaded (still restoring, or unreadable) untouched rather than dropped — then saves the merged index back to disk. This avoids a half-restored in-memory map from clobbering the full on-disk list.
- found: Loads the on-disk index, builds fresh KnownProject records for every currently-loaded project (carrying forward harness/scan_ms/trace_depth/model from the EXISTING banked index entry rather than from memory, since AppState doesn't track those), drops on-disk entries for keys that are currently loaded, extends with the live records, conditionally merges `active` and `order` only when this session has them set, sorts by touched, and saves. A test-thread debug_assert guards against writing outside a sandboxed data_home during tests.
- predicted: most · documented: full · derivable: no · legible: most · trap: yes
- note: The trap: if a caller ever builds the KnownProject fields for harness/scan_ms/trace_depth/model from the live in-memory project instead of re-reading `banked` from the freshly-loaded index, any other code path that writes those fields directly to the index gets silently erased on the next persist() — this already happened twice per the comment.

### `forget`
- spec 3 · read at `b772b61df6ab` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:40:00Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Removes the project from self.projects (in-memory) and edits the persisted index on disk directly to drop that key, so both the sidebar row and the on-disk index agree immediately. Does not touch .sanity/ readings in the repo itself, and doesn't need to clear a 'last repo opened' pointer since that's scoped per-project and leaves with the entry.
- found: Removes the project from self.projects, awaiting, and restoring; clears self.active if it pointed at this key; then edits the on-disk index directly (retaining all but this key, clearing its active too) and saves it; finally calls self.persist(), which must run after the index write so it doesn't write the removed entry back.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Also clears `awaiting` and `restoring`/`active` state, not just projects+index, to avoid a ghost row reappearing.

### `unload` — QUIRKY
- spec 3 · read at `05182537667e` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:34:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Removes the in-memory scan/tree state (and any cached derived data) for the project keyed by `key` from AppState's live maps, so the app forgets what it has scanned without removing the project's row from the project list/index. Also clears that key's entries from the declined and pending lists, since those refer to a scan that no longer exists in memory.
- found: Removes the project's entry from `self.projects` (the live scan state) and `self.awaiting`, drops it from `self.restoring`, and clears `self.active` if it was the active project — but does not touch the project list/index itself.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The doc's language ('declined and pending lists') doesn't map cleanly onto the actual field names (`awaiting`, `restoring`) — a reader matching doc prose to fields has to guess the correspondence — and the doc doesn't mention the `active` clearing at all.

### `touch` — QUIRKY
- spec 2 · read at `55fd28ba8d19` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:33:19Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Finds key in AppState's project history list (likely a Vec<String>), removes any existing occurrence of it, and inserts it at the front — implementing most-recently-used ordering for the sidebar — without touching the separate field that tracks the currently focused/active project.
- found: Not a Vec reorder as I guessed: projects is a map keyed by project key, and recency is tracked via a monotonically incrementing logical clock (self.clock) stamped onto the project's `touched` field, then persisted to disk. Ordering is presumably derived by sorting on `touched` elsewhere rather than list position.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `focus`
- spec 2 · read at `082b08f3133b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:34Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This sets which project the UI window is showing. If `asked` is true, it switches unconditionally. Otherwise it only switches when nothing is currently being actively viewed — fresh launch, headless/no window yet, or the currently-active project key no longer refers to a loaded project — and returns whether it actually moved the view.
- found: Checks whether the active slot is vacant (no active key, or the active key names a project no longer in the map). If not asked and not vacant, declines and returns false. Otherwise sets active to the given key, persists state, and returns true.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I didn't predict the persist() call after switching, but otherwise matched the logic exactly.

### `select` — QUIRKY
- spec 3 · read at `23ae5d01c5de` · commit `3528c54` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:04:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Sets an internal "current/selected project" field on self to the given key (a plain field assignment), without touching or updating any last-used timestamp — deliberately avoiding what commands::select_project used to do by calling touch, since selection should not reorder the most-recently-used sidebar list.
- found: A one-line delegate: calls self.focus(key, true) — presumably the bool signals "selection, not touch" to focus's internal logic, avoiding the touched-timestamp bump that plain opens trigger.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: The body itself is just a delegating call; the real logic and the touch/focus distinction live in focus(), which is where the meaningful prediction target actually is.

### `ping`
- spec 2 · read at `91298fd27435` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:03Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Splits `tool` on a `:` suffix to separate tool name from outcome, then updates some internal AppState field (e.g. last-called tool, activity timestamp, or a counter) used to drive the mascot's reaction/animation state. Likely a lightweight recorder with no return value.
- found: Records a call: sets last_agent timestamp, stores last_tool name, increments a pings counter, and pushes (pings, tool) onto a bounded recent-calls deque (evicting oldest beyond RECENT_CALLS).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Docs handed to me were the file-level module doc, not anything describing ping itself.

### `most_recent`
- spec 2 · read at `8f2248ffb5a5` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:14Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the AppState's map of projects, finds the entry with the maximum `touched` timestamp field (the one bumped by every open), and returns a clone of its key as Some(String); returns None if the map is empty.
- found: self.projects.iter().max_by_key(|(_,p)| p.touched).map(|(key,_)| key.clone()) — returns the key of the project with the max touched timestamp, or None if empty.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `for_client`
- spec 2 · read at `ba69fe737561` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:34Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Matches on `project`: if Some(key), looks it up in the loaded-projects map and returns Some(key) only if it's actually loaded, otherwise None (no fallback to active); if None, returns the current `active` project key as the fallback.
- found: Matches on project: Some(k) returns Some(k) only if k is in the loaded projects map (else None, no fallback), None delegates to most_recent() for the active-project fallback.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `owner_of`
- spec 2 · read at `7996e7e9c902` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:09Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Determines which project a task id belongs to: checks the caller-provided `asked` key first, but that's not authoritative; the real check is whether a live in-flight lease matches this id (via holds_id or similar), and failing that, scans loaded projects' stored reports/tasks for one that still recognizes the id. Returns None if no loaded project claims the id.
- found: Checks the asked project first if it actually holds the id (lease or scan); otherwise collects all loaded projects that hold the id, sorts for determinism, and on ties prefers the most-recently-opened project, else the first alphabetically.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `holds_id`
- spec 2 · read at `7b2894141274` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:17Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Looks up whether `id` is present among the scan's current nodes (functions/files), returning true only if found exactly as-is right now — since ids embed @line, a stale id from before a rescan won't match. Likely a simple iteration/contains check over scan's function or file list.
- found: Recursively visits the scan's tree (scan.root.visit) checking each node's id against the target, returning true if any node matches.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `load_reports` — QUIRKY
- spec 2 · read at `fa12f19321c7` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:30Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads and parses the .sanity directory in repo (via the assessment module's load/parsing functions) into Reports, then reconciles/filters them against the current scan (using something like live_funcs or is_stale) so only reports for functions still present are returned, keyed by a stable id string.
- found: One-line delegation to crate::assessment::load(repo, scan); all the actual reading/parsing/filtering logic I predicted lives in that callee, not here.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `save_reports`
- spec 2 · read at `8a688d237d03` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:17Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Writes the given reports map into the repo's assessment file at its real path (derived from repo/scan), returning Err(String) with a clear message if the write fails (permission denied, read-only checkout) instead of silently falling back to writing somewhere else like a temp or hidden directory.
- found: Delegates to assessment::save, mapping any error into a descriptive message naming the assessment directory and warning the reading is only held in memory and will be lost, rather than silently falling back elsewhere.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `project_key`
- spec 2 · read at `6a33b539f2ed` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:02Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Canonicalizes the given path (resolving symlinks, `.`, `..`, and expanding to an absolute form) and converts it to a String, so that different textual representations of the same directory map to the same key in AppState's project maps.
- found: Canonicalizes the path via std::fs::canonicalize, falling back to the original path unchanged if canonicalization fails (e.g. path doesn't exist), then converts to a lossy String.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `lock`
- spec 2 · read at `ca72bf09f016` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:29Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Calls state.lock(), and on Err(poisoned) recovers via poison.into_inner() rather than propagating the error, always returning a usable MutexGuard since the state holds nothing precious enough to protect via poisoning.
- found: Exactly as predicted: state.lock().unwrap_or_else(|e| e.into_inner()).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `surprise` — QUIRKY
- spec 2 · read at `f4498e5794ce` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:00Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A match over the Grade enum (Full, Most, Some, None) returning an f32 in [0,1]. Full and Most are close together near the low end since both mean "I basically knew this", while Some and None are spread further apart at the higher end to separate "partially right" from "completely wrong". E.g. something like Full=0.0, Most=0.15, Some=0.5, None=1.0.
- found: Match over Grade returning fixed f32 constants: Full=0.08, Most=0.30, Some=0.62, None=0.92 — none of them at the extremes 0/1, and the spacing is fairly even rather than the two-close-together pattern the doc implied.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I predicted Full/Most would be tightly clustered near 0 per the doc's framing, but the actual gaps are closer to evenly spaced (~0.22-0.32 apart) and nothing touches 0 or 1.

### `documented`
- spec 2 · read at `aa3d2140395e` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:58Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A match over the Grade enum (Full/Most/Some/None) that converts the qualitative documentation-coverage grade into a numeric score in [0,1], e.g. Full -> 1.0, Most -> 0.66, Some -> 0.33, None -> 0.0, used for aggregating/averaging documentation quality across many reports.
- found: Match over Grade enum mapping Full->0.95, Most->0.7, Some->0.35, None->0.0 as f32.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Got the enum-to-score mapping shape right but the exact constants (0.95/0.7/0.35, not 1.0/0.66/0.33) — Full is deliberately capped below 1.0.

### `blank`
- spec 3 · read at `865eb844781a` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:31:03Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Report struct literal with every field set to its empty/default value — empty strings for text fields, None for optional grades, false for booleans, 0 for counters — as a starting point that callers (parsers, tests) then fill in field by field rather than using ..Default::default().
- found: Struct literal constructing a Report with every field at its zero/empty/default value (empty strings, 0, false, None) — exactly the predicted blank starting point for parsers/tests.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `grades` — TRAP
- spec 3 · read at `ff2b681f16b3` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:16Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a tuple (predicted_grade, documented_grade) derived from the Report's raw fields. If the report only has the old `surprised` boolean (no `predicted` grade), it maps true/false to the extreme ends of the Grade scale rather than inventing a middle value. Separately, if `derivable` is true, it forces the documented grade to None regardless of what `documented` field the reader actually set, since a doc a model could regenerate explains nothing.
- found: Computes predicted grade from self.predicted, falling back to Grade::None/Full based on the old surprised boolean when absent; computes documented grade by forcing Some(Grade::None) when derivable is true, otherwise passing through self.documented unchanged.
- predicted: full · documented: most · derivable: no · legible: full · trap: yes
- note: The docs note this exact issue: the TS mirror `reportGrades` documents both override rules while this Rust version's doc comment only mentions the derivable-forces-None rule inline, not the surprised-boolean fallback, so a reader diffing the two implementations could miss that this one applies a second silent rule.

### `neighbors`
- spec 2 · read at `946e01897a8c` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:59Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes a window of nearby entries around index i in names — probably up to ~20 total, split before/after i, sliding toward the array edges when i is near the start or end so it still returns a full window rather than padding with nothing. Returns the selected slice of names plus a count of how many were left out of the window.
- found: Builds a window of up to PEER_WINDOW+1 names centered on index i, sliding toward the edges of the array when i is near the start or end (via saturating_sub and min clamp against len), excludes the entry at i itself, and returns the peer names plus how many were omitted from the full list. If the whole list already fits within the window, it just returns everyone else with 0 omitted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `qualify`
- spec 2 · read at `eb82576b9d9d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:26Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Given a function name, an optional owner type name, and an optional language, builds the display string used to label a task (e.g. "Tag::parse" for Rust, "Tag.parse" for other languages like Python/JS/TS). If owner is None, just returns name.to_string(). The lang match picks the separator: Rust uses "::", everything else uses ".".
- found: Matches owner: None returns bare name; Some with lang in {Rust, Cpp, Php} uses "::" separator; all other langs (including Ruby, deliberately excluded due to its Foo::bar vs Foo#bar ambiguity) use ".".
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Docs shown were for the whole file, not this function; qualify itself had no doc comment, just an inline code comment explaining the Ruby exclusion.

### `collect_tasks` — QUIRKY — TANGLED
- spec 3 · read at `1bb5e9141df8` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:29Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This recursively walks a Node tree (the parsed structure of the target repo, e.g. files containing functions) and appends candidate (priority_score, Task) pairs to `out` for anything eligible to be handed out via sanity_next. It skips nodes already present in `done` (already reported) and nodes currently checked out in `leased` (unless their lease has expired), uses `qualify` to decide whether a node is a valid unit to assess, and threads `file_doc` down so that a function nested inside a file carries that file's own doc comment along with it into its Task.
- found: Recursively walks the Node tree, pushing (priority, Task) pairs to `out` for functions and files that are eligible to be handed out. For functions: skips oversized (unreadable) bodies entirely, skips ones whose prior reading is still fresh (not stale/dated) and not currently leased, and assigns priority from a surprise score plus a stale/dated offset (stale ranks above unread, which ranks above dated/superseded-answer). For files: similar staleness/lease/emptiness/oversize gating, builds a Task carrying every child as a peer (not windowed, since a file reading judges the whole list) with a fixed FILE_ASK prompt, then recurses into children passing the file's own doc down, and afterward computes a windowed `neighbors` peer list for each function task produced by tracking which child index produced which entry in `out` (since not every child yields a task).
- predicted: some · documented: none · derivable: yes · legible: some · trap: no
- note: The peer-windowing pass after the recursive call relies on a parallel `from` index vector to map `out` entries back to child indices, since skipped children (already read/leased) make position-in-out an unreliable proxy for child index.

### `all_tasks`
- spec 2 · read at `2c3019c16f73` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:12Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds a Task for every function (and file-task) in the Scan, unconditionally — no filtering by lease state, read state, or staleness, unlike the queue's collect_tasks. Unlike the normal task-building path, peers here is the full unbounded list of every function name in the file rather than a windowed neighborhood, since this exists purely to measure the true payload size, not to hand work out.
- found: Reuses the same collect_tasks walker as the real queue-building path, but passes empty HashMaps for leases and reads and None for whatever the last param is, so nothing gets filtered out or marked read/leased — then discards the keys and returns just the Task values.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I assumed it built the task list independently to get unbounded peers; instead it cleverly reuses collect_tasks with empty state maps to get the same effect.

### `default_n`
- spec 2 · read at `368876d2ad6b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:30Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns 1, the default batch size for a single handout, since the doc explains one-at-a-time fetching is preferred over a shared batch fetch even though 10 total readings are done per reader.
- found: Returns 1, exactly as predicted from the extensive doc explaining the one-at-a-time protocol.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `priming_note`
- spec 2 · read at `46e73a09a277` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the repo has a CLAUDE.md/AGENTS.md-style file and, if so, returns Some with a carefully-hedged one-sentence message asking (not asserting) whether that file was loaded into the current session's context, since the file's existence on disk doesn't prove it was injected. Returns None when the repo has no such file.
- found: Checks agent_docs(repo) for CLAUDE.md/AGENTS.md-style files at the root; if any exist, returns a detailed hedged message telling the orchestrator to check its own context (not trusting file-on-disk or this message as evidence), explaining the two branches (clean run vs priming risk) and what to do in each, and noting each reader still self-reports `primed`. Returns None if no such docs exist.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `contract_note`
- spec 2 · read at `3ed19309ec38` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:01Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Compares the tool-contract version/hash the caller claims to have (`sent`) against the shim's own current in-process contract version; if they differ (or `sent` is None while a contract is expected), returns Some(warning string) noting the shim may be serving a stale schema from before a rebuild; returns None when they match.
- found: Compares `sent` against crate::mcp::contract_fingerprint(): matching Some returns None (silent); mismatched Some returns a detailed warning about a stale shim process serving an older schema; None (no fingerprint sent at all) returns a softer warning that the client predates the contract check.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I assumed None meant no warning (nothing to compare); actually a missing fingerprint is itself treated as suspicious and produces a (milder) warning — only an exact-match Some is silent.

### `reader_prompt`
- spec 3 · read at `55520503d7ca` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:58Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a formatted string built with format!, substituting n as a literal digit (not spelled out) into a sentence like "you are assessing EXACTLY {n} THINGS, ONE AT A TIME." The rest of the string lays out the sanity_next/sanity_reveal/sanity_report loop tersely — predict before revealing, report before requesting the next, one at a time — plus a note that a repo's CLAUDE.md/AGENTS.md may already be injected into context and the reader should disclose that via the primed field rather than pretend it wasn't seen. It deliberately avoids restating the full tool schema since the tool definitions already carry that.
- found: format!-builds the exact protocol text with n substituted as a digit — this is verbatim the system prompt governing my own current task (predict-reveal-report loop, one-at-a-time rule, parts-outstanding rule, primed/brief disclosure clause, don't-read-.sanity/ rule).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Meta observation: this function's output is byte-for-byte the instructions I was given for this very assessment run.

### `resolve_open`
- spec 2 · read at `6b0b5db53b39` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:00:57Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes an optional path string and checks it against known repo candidates (added via sanity init, sanity check, or the window's Add project). If asked matches one of those known paths, returns Ok(PathBuf). If asked is None or doesn't match any known candidate, refuses to pick and returns Err(serde_json::Value) with the candidate list for the agent to present to the human, since the doc says an agent must never choose the project itself.
- found: Resolves which repo path an /open should use. If a path is asked for, it's accepted only if it's already known (loaded in state or in the on-disk index) — otherwise returns an Err JSON with candidates and a hint. If no path is asked: 0 known projects errors, exactly 1 known project auto-resolves (not a guess since there's no ambiguity), 2+ known projects errors with the candidate list, refusing to guess which one.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs explain the overall philosophy (agent never picks) well but don't call out the single-known-project auto-resolve special case, which I initially predicted as always requiring a match.

### `open_project` — QUIRKY
- spec 3 · read at `10f9c2bba954` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:30:20Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: An Axum handler that takes an OpenRequest (a repo path), validates/resolves it via resolve_open, either finds an existing project in Shared state or creates a new one and kicks off background scanning/parsing, and returns a JSON summary (project id, counts via count_files/count_funcs, maybe a note like scan_note/priming_note) describing the opened project's initial state to the CLI/frontend.
- found: Resolves/validates the path (must be a dir and a git repo), registers it in a "restoring" list so the UI shows progress during the scan, runs a full blocking scan+shallow blame trace with a persistent scan cache, reloads/refreshes the `.sanity/` report index and README against the fresh scan, rebuilds the Project via `Project::rescan` (preserving prior state but clearing leases/recent_files since ids/bodies may have shifted), and returns a large JSON blob with counts (functions/files/excluded/oversize/assessed/stale), repo shape breakdown, contract/priming warnings, sanityignore guidance, scan timing, and the full agent protocol text embedded in the response.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The doc field shown was actually the file_doc (module-level rationale for the API's existence), not documentation of this specific function, so `documented` should be graded as none for open_project itself.

### `scan_note`
- spec 2 · read at `229afd11d13f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:42Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns None if ms is below some threshold (fast open needs no comment). Otherwise returns Some(message) explaining the wait, distinguishing a first-time full scan/parse/blame (reopened=false) from an incremental rescan of only changed files (reopened=true), so the caller understands the delay wasn't a fault.
- found: Returns None under a 5s threshold; otherwise a message explaining the scan took N seconds due to per-machine caching of parse/blame, noting retry restarts it rather than being a hang, with an extra clause when reopened=true.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `work_left` — QUIRKY
- spec 3 · read at `96541c3b8f1a` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:45:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: This computes how much work remains for a project by counting unread and stale functions (excluding any already leased out), likely via `count_stale`/`assessed`/`unread_lines` helpers, and packages the result into a `WorkLeft` struct with at least a `remaining` count — the same struct `queue()` checked (`remaining == 0`) to decide whether to ping "done".
- found: Collects ALL unread tasks (ignoring leases, via an empty map) to get `remaining`, then separately cross-references that list against the project's actual lease table to find which of those tasks are currently leased and still within the LEASE window, sorting them by lease age descending to produce `in_flight`/`outstanding` — so remaining counts total outstanding work while outstanding/in_flight tracks what's actively being worked on.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `each_unit`
- spec 2 · read at `d600b20192db` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:19Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the scan's node tree, tracking whether the current file/branch is excluded (via Node::excluded, set at the file level), and invokes the callback f on each node that represents a unit of work (function or file header) as long as it isn't under an excluded file — propagating exclusion down to children rather than checking each node in isolation, unlike a plain `visit`.
- found: Recursive inner `walk` that ORs exclusion down the tree (out_of_scope || node.excluded), calls f on Func/File nodes only when not excluded, then recurses into children with the propagated flag.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `count_stale`
- spec 3 · read at `50c1ec3faf55` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:26Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks the `reports` map, looks up each report's corresponding node in the current `scan`, and counts how many have changed since the reading was taken (e.g., a content hash/signature mismatch or a node no longer found at the same location) — the same "stale" condition `render_entry` displays with the `— STALE` marker.
- found: Walks every unit (file or function) in the scan via `each_unit`, and for each one that has a matching report, calls `assessment::is_stale` against the node's current body/bytes to decide if the reading is stale, incrementing a counter. Explicitly covers both files and functions, per the comment, since both kinds are handed out and can expire.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `assessed`
- spec 3 · read at `64a263f03f3b` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:44Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Walks the live scan tree (via `each_unit`, same as `count_stale`) and, for each node that has a matching report in `project.reports`, counts it only if that report is *not* stale (per `assessment::is_stale`) — directly computing "things whose reading still describes them" from the live side rather than as `reports.len() - count_stale`, so deleted or moved functions can't inflate the total.
- found: Exactly as predicted: walks live scan nodes via each_unit, counts those with a non-stale matching report.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `offline_counts`
- spec 3 · read at `dc247d3afee2` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Walks the Scan tree and the reports map to tally: total function/file count, how many nodes already have a matching report (assessed), and how many reports are stale (their recorded hash no longer matches the current node's body hash). Returns an OfflineCounts struct bundling these numbers, used to show progress/coverage without invoking a model.
- found: Composes several existing helpers rather than walking the tree itself: count_funcs for functions/excluded/oversize, collect_tasks to build the unread list (remaining), an each_unit walk that counts assessed nodes (reported and not stale via assessment::is_stale), count_files for files, and count_stale for stale. Bundles all into OfflineCounts.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: A comment explains files are deliberately kept separate from functions in the denominator rather than folded in, which I didn't anticipate.

### `unread_lines`
- spec 3 · read at `116ffcdcd1ae` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the project's functions, filters to those that are unread or whose reading is stale, and sums each function's line count (end_line - start_line + 1, or a loc() helper) into a running total, returning that as the outstanding-work estimate in lines of code. Files/containers are excluded to avoid double-counting their functions' lines.
- found: Recursively walks the project's node tree, tracking an `out_of_scope`/excluded flag inherited down from parents; at each func node not out of scope, checks whether it has a report that is not stale (via `assessment::is_stale`), and if unread/stale adds its `loc` to a running total. Returns the sum.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc explains the WHY (unit consistency, avoiding double-count, stale-counts-as-outstanding) very well but doesn't mention the tree-walk mechanics or the inherited exclusion flag, which is fine since that's implementation rather than the contract.

### `count_funcs`
- spec 3 · read at `52854f698849` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:40:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the Scan's list of discovered functions and tallies two numbers: the total count of functions found, and how many of those were excluded via .sanityignore. Returns them together as a Counts struct (e.g. Counts { total, excluded }) so callers can't report one without the other.
- found: Recursively walks the scan's node tree, inheriting an out_of_scope flag down through children (a node is out-of-scope if it or any ancestor is excluded). At each Func leaf it buckets into one of three Counts fields — excluded, oversize (unreadable), or kept — checking scope before size, per an explicit comment explaining that a function which is both should read as excluded rather than oversize.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `count_files` — QUIRKY
- spec 3 · read at `6fd69ff26cc7` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:16Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Filters scan's files down to those treated as their own reading (whole-file tasks) and not excluded by .sanityignore, further dropping files with zero declarations (mirroring count_funcs's rule that there must be something to grade against). Tallies the result into a Counts struct (total vs. assessed/read count) so file-level coverage can be reported alongside function-level coverage without double counting.
- found: Recursively walks the Node tree (not a flat file list), threading an out_of_scope flag down from parent directories so a node under an excluded ancestor counts as excluded even if not itself marked. For each File node with children (declarations), it buckets into one of three counts: excluded, oversize (node.unreadable(), e.g. the 856KB file case mentioned in the doc comment), or kept — a three-way split I didn't anticipate (I expected a simpler total/assessed tally).
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `shape_of` — QUIRKY
- spec 3 · read at `3524c9a2971f` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:28Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Walks the scan tree's top-level (first-level) directories and, for each, counts files and functions beneath it (likely via count_files/count_funcs helpers), building a Vec<serde_json::Value> of objects like {"path": name, "files": N, "functions": M} — counts only, no function names — so an agent can see which top-level directories are large and propose .sanityignore entries. Probably sorted by size descending.
- found: Recursively walks the tree counting functions (not files) per top-level directory, splitting each directory's count into kept vs. already-excluded (propagating an `out` flag once a node is `excluded`), sorts directories by total (kept+excluded) descending, takes the top 15, and emits {"dir","functions","excluded"} JSON rows.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `interleave_by_file`
- spec 2 · read at `52681135f9b4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Groups the ranked (score, Task) pairs by file path, keeping each file's tasks in descending score order, then round-robins across the groups (taking one from each file's bucket in turn, cycling through files) to build an n-long output list — so the top picks span many files instead of being dominated by one file's cluster of high scores, while still roughly respecting the original ranking within each file's turn.
- found: Sorts descending by score, buckets tasks by file (files ordered by first/best appearance), then round-robins one task per file per round in file order until n items are collected, so the top of the queue never gives two functions from the same file back to back while other files have candidates.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Matched almost exactly, including the file-ordering-by-strongest-candidate detail.

### `mark_of`
- spec 2 · read at `c13c189db655` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:07Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Stats the file at repo joined with rel_path and returns Some((modified_time, len)) reflecting its current state on disk, or None if the file cannot be read/stat'd. Used to detect staleness by comparing against a previously recorded mark.
- found: Gets fs::metadata for repo.join(rel_path), returns Some((modified_time, len)) or None if metadata/modified fails.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `resync_file`
- spec 2 · read at `04ce80873340` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:16:05Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Finds the given file's node in the tree (by rel_path) under root, re-parses the file from disk, and for each function that still exists (matched by key_of(path, name, ord)) updates its position, signature, doc, and body hash while leaving its id untouched. Functions no longer present are removed from the node's children; functions newly present in the file are NOT added (that's left to a future full rescan). Returns a bool indicating whether the file node was found/updated.
- found: Finds the file node, re-parses it, and updates both the file node's own doc/body-hash and each surviving function's line range, loc, signature, doc, owner, and reading hash (keyed by name+ordinal so same-named functions stay distinct); functions no longer present are dropped via retain_mut, new functions aren't added. Returns false early if the file/lang/read fails, true otherwise.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: Missed that the file node itself also gets its doc and body hash refreshed, not just child functions.

### `stamp_marks`
- spec 2 · read at `fe22a15ea032` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:10Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates the files in `scan` and, for each one, reads its current on-disk state (mtime and byte length, or similar) via the filesystem, building a HashMap from file path to that (SystemTime, u64) mark. This is called at scan time so the mark reflects the exact moment positions were cut, avoiding the lazy-first-resync bug described in the docs.
- found: Walks scan.root's tree via visit(), and for each File node computes its mark (mtime/size, via mark_of) at repo-relative path, inserting into a HashMap keyed by path; skips files where mark_of returns None.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `resync_changed`
- spec 3 · read at `bc80ab8137e4` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:17Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Walks the project's tracked files, checking each against its last-seen mtime/hash to detect which have changed on disk since the last scan. For each changed file it calls `resync_file` (or similar) to re-parse and re-cut that file's function line ranges so any queued/outstanding ranges point at current code, skipping files whose first pass just recorded their shape with nothing yet to correct. Returns the count of files that were re-cut.
- found: Visits every file node in the scan tree, computes its current mark (mtime/size) via mark_of, and diffs against the stored file_marks map (updating it in place via insert's return value) to find which files moved; for each moved file calls resync_file to re-cut it, then re-runs aggregate() on the tree root so rollups reflect the changed sizes, returning the moved-file count.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `spread_across_files` — QUIRKY
- spec 2 · read at `60f93358437e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:48:25Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Takes the score-ranked tasks, and for each candidate applies a penalty to its score based on how recently its file appears in `recent` (using `now`), effectively demoting warm files rather than excluding them. It then re-sorts by the adjusted score and returns the top n tasks — so an untouched file's function usually wins, but if all remaining candidates are in recently-touched files, the best-scored one is still returned rather than leaving the queue empty.
- found: Partitions tasks into "fresh" (file not in `recent`, or last touched more than FILE_REST ago) versus "resting" (recently touched), uses fresh if any exist else falls back to resting, then delegates to interleave_by_file(_, n) to do the actual per-file spreading and top-n selection.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Expected a continuous recency-based score penalty; actual mechanism is a hard threshold partition (FILE_REST) with binary fresh/resting fallback, delegating the real interleaving to a separate helper.

### `queue`
- spec 3 · read at `80aafc0a0ea2` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:45:16Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: This is the HTTP endpoint agents poll to get their next batch of work: it parses `QueueParams` (project key, maybe batch size), locks state, builds the ordered task queue (stale-first, spread across files) similarly to `reading_curve`, takes/leases a batch-sized slice of it (stamping those tasks as in-flight so concurrent readers don't collide), and returns that slice as JSON.
- found: Resolves the client's project, resyncs any changed ranges first (so stale line positions aren't handed out), collects and orders tasks excluding already-leased ones, hands out `p.n` of them via spread_across_files, marks each as leased and touches recent_files to steer round-robin, logs each as an 'out' note, and pings a done/not-done event depending on whether anything remains.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `default_batch`
- spec 2 · read at `be58df657f50` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a hardcoded constant usize (likely 10, matching the "ten functions" batch size referenced elsewhere in the docs) representing the default number of functions handed to a reader per batch, exposed for external callers that need to estimate pricing/cost.
- found: Returns the module-level BATCH constant rather than an inline literal; I predicted a constant value correctly but didn't know it was named/shared as BATCH elsewhere.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `reading_curve`
- spec 3 · read at `b26313126914` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:59Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: This looks up the project's queue (stale-first, then unread, round-robined across files, ignoring in-flight leases), walks it in `BATCH`-sized chunks, and for each chunk sums up the lines-of-code of the functions in it, accumulating cumulatively so entry `i` is the total lines the first `i` batches would hand out — giving the frontend a lookup table instead of an approximation.
- found: Collects all tasks for the project, orders them via spread_across_files (the same ordering a fresh run would use), then walks the order accumulating a running total of lines, pushing a cumulative entry at every BATCH boundary and also at the very end (so a tail shorter than a full batch still gets an entry).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `check` — QUIRKY
- spec 2 · read at `093c37e54faa` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads project/harness/model/batch settings from CheckRequest, spawns the wave-orchestration loop (calling something like run_wave or start_run) as a detached background task via tokio::spawn, and immediately returns a JSON acknowledgment without awaiting the run's completion.
- found: It's a one-line Axum handler that just delegates entirely to start_run(&state, req) and wraps the result in Json — no validation logic of its own.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The docs handed to me for this task actually describe run_wave (a different function), not check — mismatched docs, so I graded documented as none.

### `start_run` — TANGLED
- spec 3 · read at `91fbf6d1bb70` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:41Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Validates/normalizes the CheckRequest (e.g. picks files/batch size via helpers like default_batch/spread_across_files), then kicks off a new scoring run against the shared Project state — likely registering it in Shared so it can be tracked/stopped later, and possibly spawning an async task rather than blocking. Returns a JSON value describing the started run (e.g. a run id/status) rather than the full results, since this is the "start" half of a check/stop pair.
- found: Locks shared state to resolve the project and check whether a run is already active (using ended/live process count, not just ended), refusing with a structured error if so. Resolves harness (request > project config), validates it's known and available on PATH, resolves the callback backend URL and model (request > project's suggested model), then registers a new Run struct in shared state and spawns the async wave via a runtime-agnostic `detached()` helper (since this function must work from both sync Tauri commands and async HTTP handlers), returning a JSON status describing the started run.
- predicted: most · documented: some · derivable: no · legible: some · trap: no
- note: The double-run guard checks both `ended.is_none()` and a live process counter, and the spawn uses a custom `detached()` instead of `tokio::spawn` because this fn must also be callable synchronously from a Tauri command with no async runtime in scope.

### `stop`
- spec 2 · read at `67720eec2400` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:17Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the run/project from StatusParams, marks it stopped/cancelled in shared state (clearing its queue), and forcibly kills any live child reader processes tracked for that run (e.g. via a stored child handle), then returns a simple JSON acknowledgment like {"ok": true}.
- found: Looks up the project via for_client, and if it has an active (unended) run, sets an atomic `stop` flag on that run to true. Returns JSON {ok, stopped} — it does not itself kill any process, just signals; the actual killing (per the doc, described elsewhere) must happen wherever that flag is polled/checked.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says 'kill the readers it has out' but the code just flips an atomic flag — the actual kill must live in whatever polls run.stop, not in this function.

### `trace` — QUIRKY — TANGLED
- spec 3 · read at `2eec90f1f6fe` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:30:37Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: HTTP handler taking TraceParams that synchronously walks the repo's git history to build (or extend) History/Blame data — depth 1 quick, depth 2 the expensive full walk — honoring a stop flag so the caller (having already seen a cost estimate) can cancel it, and returns the resulting trace data as JSON without imposing the request budget/gate other endpoints use.
- found: Resolves the target project, picks a depth (explicit "files"/"lines", or one step past whatever depth the project is currently at), clears the stop flag, and runs crate::trace::deepen in a blocking task with progress/scan-snapshot callbacks so a window watching the project sees live ticks. Afterward it stores the resulting scan, computes whether the pass was stopped short by comparing the depth actually reached to the one requested (reading it off deepen's return rather than the flag, since the flag gets replaced), banks the reached depth via note_trace, and returns ok/depth/stopped/elapsed-seconds as JSON.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `scan_now` — QUIRKY
- spec 3 · read at `b0588c5d3d0d` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:37Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Axum handler that reads a project key from StatusParams, removes that project from state.awaiting (the declined-for-cost list), then calls open_project to force the scan through regardless of the cost estimate, returning a JSON status/result once done.
- found: Resolves the target project key via state.for_client(p.project), looks up its repo path from the on-disk index, then delegates to open_project with that path (defaulted OpenRequest) to force the scan through — no direct touch of state.awaiting; open_project presumably handles bypassing the cost gate.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `stop_trace`
- spec 3 · read at `19a264cb9cb5` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:41Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Axum HTTP handler that looks up the project by key from StatusParams, then sets a shared cancellation flag/token that the running trace loop (polled inside trace::deepen) checks periodically to stop early, keeping partial results rather than discarding them. Returns a JSON {"ok": true}-style response, possibly erroring if no trace is running for that project.
- found: Resolves the project by client key, and if found stores true into an atomic `trace.stop` flag on that project (Relaxed ordering) so a running trace loop polling it exits early; returns {ok:false, error} if no project, otherwise {ok:true, stopped: bool}.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `detached`
- spec 2 · read at `f2536bd31875` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:52Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a Tokio runtime handle is currently available (Handle::try_current()); if so, spawns fut on that handle. If not, spawns a new OS thread that builds its own runtime (likely single-threaded) and blocks on fut, so the caller never hits the tokio::spawn-without-runtime panic regardless of whether it's called from an axum handler or a synchronous Tauri command.
- found: Spawns on the current Tokio handle if one exists, else spins up a new thread with its own current-thread runtime and blocks on the future; logs on runtime-build failure instead of panicking.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `run_wave` — QUIRKY — TANGLED
- spec 2 · read at `c7890249c53c` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Runs a loop that spawns async reader tasks (up to `width` concurrent) pulling items off the project's work queue, invoking the harness executable per item and feeding results back into shared state/reports, tracking in-flight count via the `live` atomic. It keeps topping up the pool as tasks finish until the queue is empty, `limit` is hit, or `stop` is set, and includes a stall-guard that exits if `remaining` stops decreasing while `live` is zero (a misbehaving harness producing no work). Likely uses tokio::spawn and a channel or shared mutex-protected queue, joining/awaiting outstanding tasks at the end.
- found: Writes reader config to a scratch dir, then loops spawning waves of reader subprocesses sized by remaining work, width, and the limit's granularity (10 readings/reader). Each spawned reader is tracked via a live counter, has its stderr drained concurrently to avoid deadlock/blocking, and is raced against the stop flag via tokio::select so it can be killed mid-run; failures are deduped/capped, stop-kills aren't counted as failures, and three consecutive wave-wide zero-progress rounds ends the run. Leases are cleared when the loop ends so the map doesn't show phantom in-flight work.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `rescan`
- spec 3 · read at `33263092b07c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:40:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Constructs a new Project from the fresh scan/reports/repo/name, but if prev is Some, copies over all the volatile in-flight state keyed by node id — predictions, leased, run, and similar wave/reader state — directly from the old project into the new one, since ids are stable via key_of and survive code moving; if prev is None those fields start empty/default.
- found: Builds a new Project, computing fresh file_marks/marks/trace(default)/behind(false) from the new scan, while carrying over from prev (if any) all volatile wave state: leased, recent_files, predictions, revealed, run, events, touched, last_agent, and scanned incremented by one (not just copied) to signal the window that a rescan happened.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: I expected trace state to also survive from prev but it's explicitly reset to default since trace depth belongs to the specific scan, and scanned is incremented rather than merely carried over.

### `note`
- spec 2 · read at `6e0184e00ac2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:12:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a small record (stage, name, path, plus a status/summary derived from `found` if present) and pushes it onto a ring buffer (likely a VecDeque field on Project) representing recent activity. If the buffer exceeds some fixed capacity, it pops/removes the oldest entry to keep it bounded.
- found: Assigns a monotonically increasing seq number, extracts predicted/documented/legible/derivable grades from the optional Report (via r.grades() and fields, with legible filtered if dated), pushes an Event onto the events VecDeque, then pops from the front while length exceeds EVENTS_KEPT.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Docs were a one-line accurate summary; the seq numbering and grade-extraction details weren't derivable from the doc alone but matched my structural guess.

### `recent_model`
- spec 2 · read at `7f9da50f6140` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:38Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Finds the newest dated reading among the project's readings (by `when` timestamp) and returns its `asked` field if present, falling back to that reading's `model` field if `asked` is absent. Returns None if there are no dated readings at all, since undated readings predate the `when` field and can't be identified as most recent.
- found: Filters reports to dated ones, finds the max by `when` (lexicographic = chronological), prefers `asked` over `model` as fallback, and filters out empty strings before returning.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `suggested_model` — QUIRKY
- spec 2 · read at `3a95d26d7740` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:38Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Checks the project's stored corpus/assessment data for a model preference tied to `key` first (since it travels with the repo), and if absent falls back to `recent_model` (the last model a local run asked for on this machine), returning None if neither is set — meaning the harness's own default applies.
- found: Tries recent_model(p) first, then one_model(p), then falls back to the corpus-stored model_for(key) from reports, returning None if all three are absent.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I predicted the corpus preference would be checked first per the doc's stated rationale, but the code actually tries recent_model and one_model before the corpus lookup — the doc's ordering claim doesn't match the visible precedence in this function.

### `model_tally`
- spec 2 · read at `2456bc4d7ccf` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:48:04Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Walks the project's reports, tallies how many reports were produced by each distinct model, and returns a Vec<ModelCount> (model name + count) sorted descending by count — likely used to power a "which model(s) read this repo" summary in the UI, complementing one_model/one_harness.
- found: Tallies reports by model into a HashMap, converts to a Vec<ModelCount>, and sorts by count descending with model name as tiebreaker (to keep sort order stable across polls and avoid spurious frontend re-renders).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `one_harness`
- spec 2 · read at `f2ee638f9162` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:36Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the project's stored readings/reports, collects the distinct agent/harness identifiers used to produce them, and returns Some(harness) if there's exactly one distinct value across all readings, or None if there are zero or more than one (disagreement) — mirroring one_model's logic but keyed on the harness field instead of the model field.
- found: Walks p.reports, skips reports with an empty/blank harness field, and tracks the first non-empty harness seen; if a later report disagrees, returns None immediately, otherwise returns the single agreed harness (or None if no reports had a harness set).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `one_model`
- spec 2 · read at `d74050c41550` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:43Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Inspects the project's readings/reports and, if every one of them was produced by the same model name, returns Some(that model); otherwise (mixed models or no readings) returns None. Likely used to decide whether a project's assessment can be summarized under a single model label.
- found: Iterates p.reports, skipping empty model strings, and returns Some(name) only if every non-empty model string seen is identical; any disagreement returns None early.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `drop`
- spec 2 · read at `5a9ffd6b98d7` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:00Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: LiveGuard is an RAII guard tracking an in-flight/live agent task; its Drop impl decrements an in-flight counter or removes the task's id from some shared "active" set/map, ensuring cleanup happens even if the task is cancelled or panics, so state doesn't leak as "still running" forever.
- found: Decrements an atomic counter (self.0) with Relaxed ordering — an in-flight count, matching the "in_flight" field seen in tool responses. Simpler than a set/map as I guessed, just a raw counter.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `assessed_now` — QUIRKY
- spec 2 · read at `5ddb6ef8f3a2` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:15Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Looks up the project by key in state, then counts how many entries in its reports map are not stale (comparing each report's recorded hash against the current scan), returning that count as usize.
- found: Locks the shared state, looks up the project by key, and delegates to a separate `assessed` helper to compute the non-stale reading count, defaulting to 0 if the project isn't found.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: I predicted the filtering logic would be inline here, but it's a thin wrapper delegating to an `assessed` helper not shown in the peers list.

### `whole`
- spec 3 · read at `bdf59408b742` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:01:10Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns true if every part of the revealed body has been fetched — comparing the count (or set) of seen part indices against `self.parts`, the total number of parts the body was split into. Used by the report handler to refuse a report when parts are still outstanding.
- found: Exactly as predicted: `self.seen.len() >= self.parts`, a one-line check that every part has been fetched.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `missing`
- spec 3 · read at `a01eaa4d9cdf` · commit `3528c54` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:04:20Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Revealed::missing likely holds a total part count and a record of which parts have been fetched so far (e.g., a Vec<Option<..>> or a set). This method computes the complement — the part indices not yet fetched — and returns them so an error message can tell the caller exactly which parts are still owed.
- found: Returns the part numbers 1..=self.parts not present in self.seen, i.e. exactly the complement/missing set, using a filter over the range.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `parts_of`
- spec 3 · read at `5a2aa1752db3` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:40Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Splits `source` into a Vec of string slices, each at most PART_BYTES, breaking only on line boundaries (using split_inclusive to keep the newlines so the parts concatenate back to the original exactly). It greedily accumulates lines into the current part until the next line would push it over budget, then starts a new part; a single line longer than PART_BYTES becomes its own oversized part rather than looping or splitting mid-line.
- found: Exactly as predicted: short-circuits if the whole source already fits in one PART_BYTES budget, otherwise walks lines via split_inclusive('\n') tracking byte offsets, flushing a part whenever the next line would push it over budget, with a single overlong line simply becoming its own part.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `reveal` — TANGLED
- spec 3 · read at `f1a9a5c5a286` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:32Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the task by id in shared state, refusing (returning an error JSON) if there's no live lease for it. It re-cuts the line range via resync_changed against the current file on disk (since the file may have changed since the scan), records the caller's `expected` prediction, reads the file bytes for that line range (or the whole file for a file task), and returns the source chunked into numbered parts if it's large, along with part/parts-total metadata.
- found: Validates project/lease ownership for the id, resyncs the scan against the current file, refuses if the node exceeds a read-size ceiling, reads the file (whole file or 1-based inclusive line range), records the first-ever prediction for the id (idempotent via or_insert), splits the source into parts, tracks which parts have been seen, and returns the requested part plus a next_step nudge telling the caller to fetch remaining parts before reporting.
- predicted: most · documented: most · derivable: no · legible: some · trap: no

### `trap_without_note`
- spec 3 · read at `a445b5c3d632` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:50:32Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: One-line function: returns r.trap && r.note.trim().is_empty() — true when trap is flagged but the note is empty or whitespace-only.
- found: Exactly r.trap && r.note.trim().is_empty(), as predicted (and as already inferred from the prior test's behavior).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Already saw this function's behavior fully specified via the preceding test, so this reading was effectively warm despite not having opened this exact file/line before.

### `mangled` — QUIRKY
- spec 3 · read at `847515da75be` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Inspects a Report struct for a malformed/garbled text field (likely `found`, `note`, or similar) — checking for things like empty strings, truncation, or corrupted/non-sensical text — and returns a static string naming which field is mangled, or None if the report looks clean. Used to flag low-quality reports from weaker models.
- found: Two checks: (1) if predicted/documented/legible grade fields are all present, returns None early (report is fine); (2) otherwise scans expected/found/note text fields for tool-call XML leakage markers (</parameter>, <parameter name=, or a closing tag matching the field name) and returns which field name leaked, indicating the model's report text accidentally contains raw tool-call payload rather than prose.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: This checks two unrelated things (missing grade fields vs. XML-leak detection in text fields) but only returns info about the leak case — the missing-fields case just returns None without saying which field was missing, so callers can't distinguish "clean" from "grades absent but no leak".

### `report` — QUIRKY — TANGLED
- spec 3 · read at `c5fca7bf32a3` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This is the axum handler behind sanity_report: given a ReportRequest (id plus the grade fields), it looks up whether that id was actually revealed to this caller (via the reveal/parts-of tracking, erroring if parts are still outstanding or nothing was ever revealed — 'mangled' state), enforces that trap:true reports carry a note (trap_without_note), builds and stores a Report against the node, updates running aggregate/tally statistics, releases whatever lease was held on that id, and returns a JSON summary/status blob.
- found: The sanity_report handler. It first rejects malformed calls (mangled field truncating the rest of the JSON, or trap:true with no note) before touching any state, then routes the id to its owning project, refuses if the body was only partially revealed (parts still outstanding) or the id can't be found at all (rather than silently no-op'ing as it apparently used to), and only then accepts the report. It overwrites/stamps several fields itself rather than trusting the caller (body hash, spec version, paged/legible_dated/trap_dated, by/at/when, harness/asked, agent_docs), classifies the outcome as stale/hot/cold based on whether the id already had a report and whether the grade was Some/None, persists via save_reports, and returns a JSON status blob that includes repo-wide surprise-rate stats and a coaching hint when the repo's surprise rate looks implausibly low or the write failed.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no
- note: Several fields (body, spec, paged, legible_dated/trap_dated, by/at/when, agent_docs) are deliberately server-stamped rather than accepted from the request precisely because they're the fields a self-grading reader could otherwise fake to make its own reading look more credible.

### `status` — QUIRKY
- spec 3 · read at `957012c8a5d7` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:40:19Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Resolves the target project from a session/project identifier in StatusParams rather than the global `active` field, fixing the bug where polling picked up whatever repo was globally active. Gathers assessment counts (assessed, surprised, queue size, etc.) for that specific project and returns them as JSON, including the repo name/key so the caller can confirm the subject matches what it asked about.
- found: Resolves the caller's own project via `state.for_client(p.project)` rather than the global `active` field, then builds a large JSON status blob: function/file/excluded/oversize/assessed counts, remaining/in_flight/outstanding lease info, stale readings, trace depth/cost, run progress (spawned/finished/failed/stopping/live), suggested model/harness, and a human-readable `next_step` hint telling an agent whether to wait or spawn another wave. Falls back to an `open: false` response with a hint distinguishing 'transient restart' from 'nothing open' when the project isn't loaded.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Far larger in scope than the docstring suggests — the docstring only explains the active-vs-project bug fix, not the extensive run/lease/next_step diagnostics that make up most of the body.

### `add`
- spec 2 · read at `5fc70728b6d5` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:01Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Increments a counter on self corresponding to the given grade (matching on Grade::Full/Most/Some/None variants), and if g is None (no grade given) increments a separate "missing" or "unset" counter, building up a tally of how many functions fell into each grade bucket.
- found: Matches the Option<Grade> and increments the corresponding counter field (full/most/some/none/ungraded) on self.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `add` #2
- spec 3 · read at `94a6842dfb80` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:39Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes a Report and increments running counters on self (Tally) — bumping grade-spread counts (delegating to something like GradeCounts::add), legibility counts, a trap counter, and possibly other totals — mutating in place with no return value.
- found: Increments running counters on self from a Report: readings count, predicted/documented grade tallies via a sub-add, derivable count, cold count, and traps count — but legible and trap are only counted if the report's spec is still 'current' (not superseded by a schema/question change), filtering out stale-question answers so the aggregate reflects only answers to the currently-asked questions.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The legible_current/trap_current filtering (excluding answers to superseded questions from aggregates) isn't guessable from the signature alone — worth flagging for anyone extending Tally with a new gradable field.

### `aggregate`
- spec 2 · read at `ecaf4c953547` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:59Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that pulls the project's reports/assessments and calls the more general `aggregate_of` helper on them to build an Aggregate summary (tallying grades like predicted/documented/etc.), returning it.
- found: Thin wrapper calling aggregate_of with the project's scan and reports.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `aggregate_of`
- spec 3 · read at `84e742d5ed13` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:31Z · by ross@rossturk.com · warm reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks every reading in `reports` against the scan's tree, tallying grade histograms (via GradeCounts/Tally) into an Aggregate: overall totals, a breakdown by which model produced each reading, a breakdown by position-in-batch (the warming curve), a priming exposed/clean count, and a stale count — mirroring whatever the peer `aggregate` function computes from a live Project, just sourced from a raw Scan+HashMap instead of live state so the two answers never drift apart.
- found: Walks func nodes via each_unit (honoring exclusions), skips ones with no report, and for stale ones increments agg.stale and stops there (excluded from every other bucket). For live ones: adds to agg.total, buckets by_model (missing model name becomes an explicit 'unattributed' bucket rather than being merged), computes a three-way priming split (not_applicable/exposed/clean — I only predicted the two-way exposed/clean and missed that 'no brief in the repo at all' gets its own bucket), and buckets by_position using only the predicted grade (not the full grade set) or an 'unrecorded' bucket when there's no position.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `summary` — QUIRKY
- spec 3 · read at `c95a3c2a8c0d` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:53Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: An async Axum handler resolving the target project from SummaryParams' key, then aggregating repo-wide totals from all non-stale reports in `.sanity/`: a grade distribution (full/most/some/none) via GradeCounts/Tally, a stale count, and possibly a quadrant breakdown or hot-share percentage — but nothing naming a specific file or function, per the doc's explicit design constraint that this must stay aggregate-only so an orchestrator can't reconstruct per-file signal.
- found: Resolves the project by key, then returns aggregate-only JSON: function/file/excluded/oversize/assessed/stale/remaining counts plus `agg.total`, `agg.by_model`, `agg.by_position` (grades bucketed by how far into a batch the reader was — a learning-curve check), and `agg.priming` (count of readers exposed to this repo's own CLAUDE.md while predicting, which invalidates their predicted-rate). A long embedded `note` field explains all of this inline to the calling agent.
- predicted: some · documented: full · derivable: no · legible: most · trap: no
- note: I anticipated a simple grade-distribution/quadrant summary; the actual payload is built around by_position learning-curve and priming-exposure tracking — this endpoint is instrumenting the assessment protocol itself, not just summarizing repo health.

### `from_state` — QUIRKY
- spec 3 · read at `08cbea4a8983` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:20:07Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the projects tracked in AppState (paths/names/config) and collects them into a ProjectList struct, likely including basic status or metadata for each project.
- found: Builds the full sidebar ProjectList by merging three sources: loaded projects (state.projects, mapped to ProjectSummary with counts, trace/scan stats, run status, a 60s "working" heuristic, etc.), declined-scan projects (state.awaiting, cross-checked against the index for name/path, loading:false), and in-progress restores (state.restoring, loading:true with live progress). Dedupes across the three lists by key, then sorts by manual arrangement order (state.order) falling back to most-recently-touched.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `health`
- spec 2 · read at `3e18f26fffcc` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:05:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns a small JSON object such as {"ok": true, "pid": <process id>} with no side effects and no calls to ping — just enough for a caller to confirm the backend is up and compare pids to detect it has been superseded by a newer daemon.
- found: Returns a JSON object with ok:true, the process pid, a build_id(), and headless() flag — no side effects, no state touched, matching the docs that this is a cheap liveness probe distinct from /status.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `build_id`
- spec 2 · read at `a1c6fdffb964` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Uses a OnceLock (or similar) to compute and cache, on first call, a fingerprint string combining CARGO_PKG_VERSION with the size and mtime of the current executable (via std::env::current_exe() and fs metadata), returning the same cached &'static str on subsequent calls. Falls back to a string like "unknown" if the executable can't be stat-ed, rather than panicking or guessing.
- found: Exactly as predicted: a OnceLock caches a fingerprint of CARGO_PKG_VERSION plus the executable's size and mtime (as "len-secs"), computed once via a closure that returns None on any stat failure, falling back to "unknown".
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `set_headless`
- spec 2 · read at `830fbd71bb3b` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:08Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Sets a global flag (likely an AtomicBool or OnceCell) to true, marking that the app is running in headless mode — probably used elsewhere (the headless() peer) to check whether to skip GUI-only behavior like opening windows.
- found: Stores true into a global HEADLESS AtomicBool with Relaxed ordering, exactly as predicted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `headless`
- spec 2 · read at `a2803c5c013f` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Reads a global/static flag (likely an AtomicBool set by set_headless) indicating whether the app is running headless (no GUI window, e.g. in CI or agent-driven mode), returning its current value.
- found: Loads and returns the value of a static HEADLESS AtomicBool with Relaxed ordering.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `retiring`
- spec 2 · read at `6d832360abdc` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:13Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A tiny accessor that reads a global/static AtomicBool flag (something like RETIRING) with a relaxed or acquire ordering and returns whether the backend process has been marked as retiring/shutting down, so other code paths (like retire() or watch_tick) can check it and stop accepting new work.
- found: Reads a static RETIRING AtomicBool with Relaxed ordering and returns its value.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `any_run_live`
- spec 2 · read at `616cfd85f3a0` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:01Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the projects held in the shared state and returns true if any of them has an in-progress "wave" (an active analysis run), likely by checking a run/wave status field or an Option/handle being Some. Probably just `state.projects.values().any(|p| p.wave.is_some())` or similar, used to gate whether the app can shut down or start a new run.
- found: Locks the shared state and checks if any project has a `run` that is Some and whose `ended` field is None — i.e. a run that has started but not finished, meaning it's still live.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `retire`
- spec 2 · read at `a46b5cad45be` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:52Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Checks two conditions before agreeing to stand down: whether any window is currently open (refuse, telling caller a window is open) and whether any run is live via any_run_live (refuse, telling caller a wave is in flight). If neither blocks, it sets the shared "retiring" flag (e.g. via headless/set_headless-like atomic) to true and returns a JSON success response. It does not itself exit the process or stop the server — that's left to the watch loop in cli::serve to observe the flag.
- found: Refuses if not headless (window reason) or if a run is live (busy reason), each with a JSON ok:false and hint string. Otherwise sets a global RETIRING atomic flag and returns ok:true with the process pid.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I guessed the flag was called "retiring" via set_headless-style state rather than a dedicated global RETIRING atomic, and I didn't anticipate returning the pid — the doc's rationale (why not exit here, why two refusals) was more thorough than the mechanism, which I got mostly right.

### `router`
- spec 3 · read at `a9ed9eba1878` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:10:02Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns the Axum Router for the loopback agent API — registering routes like /open, /status, /next, /report, /trace, /health, etc. to their handler functions, attaching the Shared state, and probably layering in tracing/logging middleware. Mostly a flat list of .route(...) chained calls with little logic of its own.
- found: Flat list of .route() registrations (health, retire, open, queue, reveal, check, stop, report, scan, trace, trace/stop, status, summary) with .with_state(state), no middleware.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Only the file-level doc exists; the function itself has none, which is appropriate since it's fully self-explanatory.

### `endpoint_file`
- spec 2 · read at `836f29d29a70` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns the filesystem path where the backend publishes its claimed port (and pid), likely under a temp or app-data directory (e.g. dirs::runtime_dir() or env::temp_dir() joined with something like sanity-endpoint.json), returning None if that base directory can't be determined.
- found: Returns Some(path) joining reports::data_dir() with "agent-endpoint.json", or None if data_dir isn't available — the well-known file where the claimed port/pid gets published.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `url`
- spec 2 · read at `8cd0a583018e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:06Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Formats and returns a loopback HTTP URL string built from the Endpoint's stored port (and possibly host), e.g. format!("http://127.0.0.1:{}", self.port).
- found: Formats "http://127.0.0.1:{port}" from self.port.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `read_endpoint`
- spec 2 · read at `50286e4f7a32` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:45Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Gets the endpoint file path (likely via endpoint_file()), reads its contents, and parses out the published pid and url/port into an Endpoint struct, returning None if the file doesn't exist or fails to parse. Does not check process liveness.
- found: Reads endpoint_file() path, parses its contents as JSON, and extracts port (u16) and pid (u32) into an Endpoint struct via chained Option combinators, returning None on any missing field, parse failure, or IO failure.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `stop_all_runs`
- spec 2 · read at `508c278e30ca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Iterates the shared state's active runs/tasks belonging to this backend and signals each to stop (e.g. aborting a handle or setting a cancellation flag), then performs a short, bounded wait (brief sleep or timeout) for those reader processes to exit. It does not block indefinitely — it's a best-effort tidy-up so that on normal app exit, orphaned agent readers aren't left running and spending tokens after the backend that spawned them is gone.
- found: Sets an atomic stop flag on every project's active run, then polls (every 50ms, up to a 5s deadline) a per-run atomic 'live' counter summed across projects until it hits zero, rather than sleeping a fixed duration — an inline comment explains the fixed-sleep approach reliably left orphaned processes because it races the scheduler.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc block given describes the intent well but the specific polling-on-count-not-clock mechanism is explained only in an inline code comment, not in the header doc.

### `release_endpoint`
- spec 2 · read at `3d80e3d397a0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:46Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Deletes the endpoint file written for this process (via endpoint_file(pid)), cleaning up the on-disk record of where this server's loopback API was listening, so a later read_endpoint doesn't find a stale/dead entry after the process exits.
- found: Checks that the currently-recorded endpoint file actually belongs to this pid (read_endpoint().pid == pid) before removing it, so a newer process's endpoint file isn't accidentally deleted by an older process's shutdown/cleanup. I got the deletion right but missed this ownership guard, and wrongly assumed endpoint_file() took the pid as an argument.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `set_order`
- spec 3 · read at `869b1f40f23e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes the shared app state and a list of project keys representing the desired sidebar order, locks the shared state, and stores this list as the new ordering. Likely also persists this to the on-disk index (e.g. calling `touch`) so the ordering survives restarts.
- found: Locks the shared state, replaces the order field with the given keys, and persists state to disk.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The docs attached to this handout actually describe the `restore` function, not `set_order` — file_doc/docs field mismatch.

### `drain` — QUIRKY
- spec 3 · read at `f8482eb480d9` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:01Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loops over the queue of projects, popping each one, running the scan for it, invoking on_shape with resulting shape files and on_tick with progress updates. When queue empties, pulls more work from state via claim_next/wanted and continues until nothing left, tracking which project should become the active/landing project relative to `active`.
- found: Pops one project from the queue (letting claim_next steer which one, so the window's wanted project goes first), removes stale/missing rows, and gates the actual scan behind a cost estimate (skipping big repos unless a warm tree cache makes the estimate wrong) before falling back to the estimate being declined. On the happy path it runs crate::scan::scan with progress/shape callbacks, banks size/rate stats for future pricing, resolves trace depth within budget, loads reports/marks, and inserts a full Project into state.projects. active is compared once per iteration to decide whether the window should switch to the just-restored project, and the comment explains why that must happen post-scan rather than pre-loop.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `claim_next`
- spec 3 · read at `b95946e3ccb5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:34Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks for the project named in `wanted` inside `queue`; if found, clears `wanted` to None (consuming it, since this lane can serve it) and returns that project's index. If `wanted` is None or the named project isn't in this lane's queue, leaves `wanted` untouched and returns index 0, defaulting to the front of the running-order queue.
- found: Finds the position of the project named by `wanted` in `queue`; if present, clears `wanted` (consumes it) and returns that index; otherwise leaves `wanted` alone and returns 0 (head of the running order).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `restore`
- spec 3 · read at `9d7e7abb3bfa` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T06:39:52Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loads previously persisted application state (projects, endpoints/order, pending tasks or runs) from disk into the shared in-memory state on startup. For each restored project it likely re-kicks off any scan/task work that was in-flight or pending, wiring on_shape and on_tick callbacks so progress/shape updates continue to be reported as background threads process them. Essentially this resumes the agent's work queue after a process restart rather than starting fresh.
- found: Loads a persisted project index, immediately publishes it as `restoring`/`order`/`active` so the UI sidebar fills in before scans finish, then spawns a background thread that reorders the queue to scan the active project first, measures unknown-size repos to bucket them into a big/small lane so a huge repo's scan doesn't block small ones, runs both lanes concurrently, joins them, falls back `active` to the most-recently-touched project if the original is missing, and persists the final state.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The two-lane big/small partition and the active-project-first reordering were the surprising, undocumented-by-signature parts — the doc comments inline are extensive and explain the why very well, but none of that is visible from the signature/peers alone.

### `trace_within_budget`
- spec 3 · read at `fc55b01150d8` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Attempts to read git history for the repo up to some time/commit budget, using the scan cache and any banked resume token, reporting progress via on_progress as it goes. Returns a TraceState describing how far it got and what remains unread, since this is the gated/implicit path (background restore or watcher) rather than the full deepen_project used for explicit requests.
- found: Uses trace::go to decide whether to auto-run or ask first (respecting the budget/cost estimate for large repos). If running, tries to reuse a banked "lines" cache via relines to skip re-blaming an unchanged repo, then calls trace::deepen to walk history up to the decided depth, reporting progress, and returns a TraceState with the reached depth/counts. If go says Ask, returns an Untraced state carrying the cost estimate instead of running.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The banked-cache reuse optimization (relines) and the Go::Run vs Go::Ask branching were not derivable from the signature alone.

### `watch_tick`
- spec 3 · read at `d49c579cb009` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Runs periodically to check each watched project's filesystem for changes. For projects with pending changes, checks whether leases are currently held; if none held, performs a rescan and notifies the window; if leases are held, defers the rescan rather than forcing one, consistent with the described refusal-while-leased design. Likely only briefly holds the lock for the check, not across the directory walk.
- found: Filters projects with no active leases, probes each for filesystem changes, and if changed: estimates whether a rescan fits the budget (marking `behind=true` and advancing marks if not), otherwise performs a full rescan (scan + trace_within_budget) off-lock, then re-checks leases under the lock before committing the new scan/reports/marks/trace state, incrementing a scanned counter.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `serve`
- spec 2 · read at `7b1cd59ca231` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:33Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: serve builds the axum router() for this state, binds a TcpListener on an ephemeral/loopback port, writes the resolved endpoint (host:port) out via endpoint_file/read_endpoint so other processes (the CLI, MCP clients) can discover it, spawns the server to run in the background, and returns the bound port number as a u16.
- found: Binds a TcpListener on 127.0.0.1:0, writes port+pid to the endpoint file, spawns the axum router as a background task, spawns a second periodic loop calling watch_tick to keep repo staleness/blame state current over time, and returns the bound port.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `task`
- spec 2 · read at `8b8a852f0203` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:11Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Constructs a `Task` value used to track a spawned background job for a given project — likely builds a Task struct/handle keyed by `name` and pointing at `path`, initializing fields like status/id/start time so it can later be found and stopped (via stop_all_runs) or reported on. Probably just field assignment, no real logic.
- found: Test-fixture constructor building a minimal Task struct with id "path#name" and placeholder/default values for all other fields (line 1, end_line 10, empty signature/peers/docs).
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Not a real "spawned job tracker" as I guessed by name/peers — it's just a plain test helper for constructing Task fixtures with dummy field values, unrelated to process/run tracking.

### `project_of` — QUIRKY
- spec 3 · read at `35f1fd4b0e7c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:52Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test-helper that constructs a minimal fixture Project for a given directory path — deriving the key/name from dir and filling the rest of the struct's fields (scan, reports, etc.) with empty/default placeholder values — so the many test functions in this file can seed Shared.projects without running a real scan.
- found: Runs a real (ephemeral-cache) scan of `dir`, computes file marks via `stamp_marks` and watch state via `crate::watch::probe`, and assembles a full `Project` struct with that real scan plus empty maps for reports/leases/predictions/etc. and name hardcoded to \"t\" — a genuine fixture built from an actual scan, not a stubbed-out placeholder.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I expected a cheap placeholder Project; it actually runs the full scan pipeline (parse + score) each call, which matters if tests call it often since it's not free.

### `a_superseded_answer_is_re_offered_after_everything_else` — QUIRKY
- spec 3 · read at `573c67310d97` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:20Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test that seeds a repo/store with one function already reported using an old/mismatched contract (missing fields like `legible`/`trap`), plus some other functions that are genuinely unread or stale, then calls the task-collection logic and asserts ordering: the superseded answer is queued behind the unread and stale ones, i.e. last, rather than being silently treated as satisfied or jumping the queue.
- found: Builds a fake file with four functions in different states — a stale one (body hash changed since the report), an unread one (never reported), a dated one (trap flagged under an older spec version, before TRAP_SINCE), and a current one (fully up to date) — runs collect_tasks, sorts by priority, and asserts the offered order is stale, unread, dated, with the current one not offered at all.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The file doc's mention of missing legible/trap fields describes a different scenario (a stale shim schema) than what this specific test exercises (body-hash staleness and spec-version-gated trap re-asking) — the file doc covers the module's motivation broadly, not this test's exact mechanism.

### `a_trap_must_say_what_it_is`
- spec 3 · read at `8660069cfe98` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:04Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A unit test that submits a report with trap: true but no note (or an empty note) and asserts the API/handler rejects it (returns an error rather than silently accepting or coercing trap to false), enforcing the invariant described in the doc that a trap claim without an actionable note is not allowed to be stored.
- found: A unit test for a `trap_without_note` predicate: trap=true with no note or whitespace-only note returns true (bare trap, not a finding); trap=true with an actual sentence returns false (stands); trap=false always returns false regardless of note.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_shim_serving_a_stale_contract_is_told_to_restart`
- spec 3 · read at `df1e4e73450a` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:57Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test (name-as-sentence style) asserting that when an agent-facing shim/endpoint is serving an outdated contract version (e.g. mismatched schema/API version from a prior run), the loopback API detects the mismatch and responds by telling that shim to restart itself, rather than silently continuing to serve it stale data or crashing. Probably constructs an endpoint/state with an old contract stamp, invokes the relevant check (maybe via serve/watch_tick), and asserts a restart signal or error in the response.
- found: Tests contract_note(): a matching fingerprint (crate::mcp::contract_fingerprint()) returns None (no warning needed); a mismatched fingerprint string returns Some(message) containing "restart"; and a caller sending no fingerprint at all (None) also gets Some(...) — an old-enough shim that can't even report its contract is treated the same as a stale one. Got the concept (stale contract -> told to restart) right but expected it to go through endpoint/serve/watch_tick machinery rather than a direct pure function test of contract_note.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_file_edited_before_the_first_handout_is_still_re_cut`
- spec 3 · read at `4ff4733ad210` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:54Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A regression test: it scans a project, edits a file's content BEFORE ever calling resync_changed/handing out a task for it (so file_marks would have been empty/lazily-populated), then triggers the handout/resync path and asserts the returned range/positions reflect the post-edit file rather than being silently wrong because the first sighting recorded post-edit content against pre-edit assumptions. It's asserting the fix described in the doc: marks are stamped at scan time, not lazily on first resync_changed call.
- found: Writes a file, scans the project, then edits the file again before any resync_changed/handout call has run. Asserts resync_changed reports 1 changed file and that the `second` function node's line has been re-cut to its new post-edit position (line 5), confirming marks are stamped at scan time rather than lazily on first resync_changed call.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `the_project_somebody_asked_for_is_scanned_next` — QUIRKY
- spec 3 · read at `39be568f2d64` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:08Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test sets up a queue with multiple projects (e.g. a large repo queued ahead of a small one), simulates a user clicking/selecting the small queued project, and then asserts that claim_next() returns that clicked project rather than following the normal last-active-then-recency order — verifying that clicking bumps a queued project to the front.
- found: Tests claim_next(&mut requested_key, &queue) -> index: returns the index of the requested project and clears the request when found; returns 0 (default order) when nothing was requested; and importantly leaves a stale/not-found request un-consumed so another lane can still see and use it.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc only explains the UX motivation (clicking bumps a queued item), not the multi-lane claim_next(&mut Option<String>, &queue)->usize contract or the crucial 'do not consume a request meant for another lane' behavior.

### `a_big_repo_scans_in_its_own_lane`
- spec 3 · read at `8226d5e30436` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:36Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up two projects — one whose last-scan size is huge (like the 65,757-file linux example) and one small or unknown — enqueues scan work for both, and asserts that the small project's work becomes available/dequeued without waiting behind the large project's queue, i.e., they're served from separate lanes keyed by size class. It likely also checks that an unscanned (unknown-size) project is treated as small.
- found: Builds a queued list of four projects with varying known file counts (including one never-scanned/None), partitions into big/small by BIG_REPO_FILES threshold, and asserts the big lane gets linux+ceph while the small lane gets sanity+fresh, confirming unscanned repos count as small.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `queued`
- spec 3 · read at `7b0a66caa3f1` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test-fixture helper that builds a Vec<KnownProject> from a slice of (key, files) tuples, likely used to seed KnownProjects.projects in tests about scan queue ordering/lane assignment. Each entry sets key/repo/name from the string and files from the Option<usize>, with remaining fields (touched, scan_ms, trace_depth, harness, model) defaulted.
- found: Test-fixture helper building a Vec<KnownProject> from (key, files) tuples, using the key string for key/repo/name and defaulting all other fields (touched=0, scan_ms/trace_depth/harness/model=None).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `a_project_added_but_not_yet_scanned_is_in_the_index` — QUIRKY
- spec 3 · read at `d548cff5aa96` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test that adds a project but does not let its scan complete (so `touch` never ran), then checks/persists the project index and asserts the project is still listed there rather than being dropped — verifying the fix where a quit before first scan completion used to lose the project entirely.
- found: Test calls remember() to add a project and checks it appears in the on-disk index immediately (before any scan). It then also verifies that re-adding (remember called again, as happens on every add) does not duplicate the project or reset configured harness/model set via set_reader.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The doc explained the historical bug (quit-before-scan lost the project) but the test body's second half, about remember() being idempotent and preserving reader config, wasn't hinted at by the docs.

### `a_project_on_two_lists_is_still_one_row`
- spec 3 · read at `f53e7257e771` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:49:59Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: I have already read this exact function's source earlier in this session (as part of the full-file read of agentapi.rs). It creates a temp repo, adds it via `remember`, then sets it as both an `awaiting` (declined) entry and a `restoring` (pending) entry, asserting `ProjectList::from_state` only lists it once; then inserts it into `projects` (loaded) and asserts it still appears exactly once — verifying a project shows as one row regardless of which of the three lists it's on.
- found: Exactly as recalled: registers a project in the index, puts it on both the `awaiting` and `restoring` lists and asserts it appears once in `ProjectList::from_state`; then loads it into `projects` and asserts it still appears exactly once.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: This exact function's source was already fully read earlier in this session (part of the whole-file read of agentapi.rs), so this reading is recall rather than a genuine cold prediction.

### `a_touch_cannot_erase_what_only_the_index_knows`
- spec 3 · read at `1b1e7991da45` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:50:46Z · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: I already read this exact function earlier in this session (part of the whole-file read of agentapi.rs). It creates a temp repo/project, writes harness/model/scan_ms/trace_depth into the index via reports:: functions, then calls touch() on this project's key and on a different unrelated key, and asserts that the index entry for the first project still retains its trace_depth, scan_ms, harness, and model — proving that persist()/touch() rebuilding a live entry does not wipe index-only fields for other or the same project.
- found: Exactly as recalled: writes harness/model/scan_ms/trace_depth into the index for one project, touches that project and then an unrelated key, and asserts the first project's index-only fields (trace_depth, scan_ms, harness, model) all survived both touches.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: This exact function's source was already fully read earlier in this session (part of the whole-file read of agentapi.rs), so this reading is recall rather than a genuine cold prediction.

### `a_save_mid_restore_does_not_erase_projects_it_has_not_loaded`
- spec 3 · read at `5c9ab20ad609` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This test seeds an index with several known projects, simulates a restore in progress where only one has been rescanned/touched so far, then triggers a save/persist mid-restore and asserts the on-disk index still contains all the original projects (not just the one loaded) — proving save merges against the existing record rather than overwriting it wholesale from the partially-populated in-memory map.
- found: Seeds an on-disk index with projects /a and /b, then simulates a session that has only restored /b, updates its touched count, and calls persist(). Asserts the reloaded index still contains both /a and /b (no duplicates), that /b's touched value was updated in place, and that active reflects the session's choice.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `drop` #2 — OBSCURE
- spec 2 · read at `04e9140a98c8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Drop for DataHome::drop performs cleanup when the struct goes out of scope — likely calling something like stop_all_runs() to cancel in-flight agent work and release_endpoint() to free a held port/lock, so the data-home doesn't leak background processes or a claimed endpoint when the app shuts down or the object is replaced.
- found: A test-fixture guard's Drop impl: clears a global HOME_THREAD lock to None and restores (or removes) the SANITY_DATA_DIR env var to whatever it was before the guard was created, rather than doing any run-stopping or endpoint-release cleanup.
- predicted: none · documented: none · derivable: no · legible: full · trap: no
- note: Owner name DataHome and peer list (stop_all_runs, release_endpoint) misled me into expecting production shutdown logic; it's actually a test-only env-var/lock guard.

### `data_home`
- spec 3 · read at `6936aefd7812` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:26Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test helper that creates a fresh temporary directory to act as an isolated data home (so tests don't collide with each other or the real user data directory), likely setting an env var or similar to point the app at it, and returns a DataHome guard struct whose Drop impl cleans the temp directory back up when the test ends.
- found: Test helper: takes a global ENV_LOCK mutex guard (serializing tests that touch env vars), creates a tempdir, sets SANITY_DATA_DIR to it (saving the previous value), records the current thread id in HOME_THREAD, and returns a DataHome guard bundling the lock guard, tempdir, and previous env value for restoration on drop.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `standing_down_withdraws_only_its_own_claim`
- spec 2 · read at `47867a4f2199` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:37Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that writes the endpoint file with this process's own port/claim, then simulates a second writer overwriting it with a different port (as if the app already took over the backend), calls the stand-down/release cleanup that runs on daemon exit, and asserts the endpoint file still contains the second writer's data rather than being deleted — proving removal is conditional on the file still matching this process's own claim.
- found: Three-part test: (1) release_endpoint with a pid that doesn't match the file's current pid leaves the file untouched (supersession case), (2) release_endpoint with a matching pid deletes the file, (3) calling release_endpoint again on an already-gone file doesn't panic (race-safety). I predicted case 1 correctly but missed the matching-pid deletion and the idempotent-double-call assertions.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `outstanding_itemises_only_live_leases_on_unread_work`
- spec 3 · read at `26f338e3a92b` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:40Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Sets up a project with a run/queue, hands out one or more leases (e.g. via claim_next), then simulates a reading landing for one of those leased functions independently (as if a duplicate/late report arrived) without going through the normal lease-release path. It then calls `outstanding` and asserts the now-already-read function's lease is NOT counted, verifying outstanding only itemises leases whose work is still genuinely unread rather than trusting the lease table blindly.
- found: Builds a fixture with two functions, checks work_left reports zero in_flight/outstanding with no leases, then inserts a lease for one function directly and checks it's counted in both remaining and in_flight/outstanding by id. Finally inserts a Report for that same id directly (simulating the reading landing without clearing the lease) and asserts in_flight drops to 0 and outstanding is empty even though the stale lease entry is presumably still present, proving outstanding cross-checks leases against reports rather than trusting the lease table alone.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_rescan_does_not_throw_away_the_run_it_lands_in_the_middle_of` — QUIRKY
- spec 2 · read at `578cafb4e1b5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:02Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Sets up a project with an active run where a reader has already committed a prediction (via the reveal step) for some function, then triggers a rescan of that project (e.g. re-opening or re-scanning it), and asserts that the in-flight run's predictions map still contains the previously-committed prediction afterward rather than being reset/rebuilt to empty by the fresh scan.
- found: Builds a Project with an in-flight lease, a committed prediction, an active Run, and an event, then calls Project::rescan with the previous project passed in and asserts predictions, leased entries, the run, and events all survive into the rescanned project, while the `scanned` counter increments (so the UI can detect a fresh rescan happened). A second case confirms a project rescanned with no prior state (None) starts completely empty — nothing is inherited from nowhere.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Missed that the test also verifies leased work, the run object's fields, the events log, and the scanned-counter increment — the doc's one example (predictions) was just the headline case, not the whole test.

### `the_summary_counts_neither_stale_readings_nor_unknown_positions_as_good_news` — QUIRKY
- spec 2 · read at `d5c2b1fa80cf` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:24:23Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test that constructs a scan with several reports: one current/fresh reading with a known position, one stale reading (expired relative to current code), and one reading with position unset/unknown. It then computes the summary and asserts the stale reading is excluded from the assessed/coverage count, and the unknown-position reading is not counted toward whatever metric tracks "first readings" (e.g. distinguishing batched vs one-at-a-time runs).
- found: Test builds a project with 3 functions and 3 reports: two fresh (positions 1 and 7, different models), one stale (body doesn't match current code). Asserts aggregate() excludes the stale reading from total.readings and from its model's tally, but counts it in agg.stale. Also verifies by_position buckets by exact position number (not first-vs-later), with no bucket invented for positions not seen, and a separate `unrecorded` counter for readings with no position field at all (distinct from being bucketed as position 1).
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I predicted the stale-exclusion correctly but wrongly assumed 'unknown position' related to a first-vs-batched-run concept; actually it's a distinct per-position bucketing scheme with its own unrecorded counter, and I missed the per-model tally exclusion detail.

### `same_named_methods_arrive_with_the_type_they_hang_off`
- spec 2 · read at `e605c5741ade` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:04:10Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Constructs a scenario with two same-named methods on different owning types (e.g. `parse` on two different structs) in one file, opens/scans a project, requests a handout, and asserts that the returned task correctly carries its owner field distinguishing which one it is, and that the peers list includes both same-named entries distinctly (not deduped into one bare-name entry), likely checking peer entries are qualified by owner.
- found: Writes a temp file with two impl blocks each defining a `parse` method on different types, scans it, collects tasks, and asserts both tasks have the correct owner (DescriptorTag vs LogicalVolumeDescriptor), each sees exactly one peer (the other twin) qualified as "Type::parse" rather than a bare name, with peers_omitted at 0, and that a function is never listed as its own peer.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Got the scenario, owner-qualification, and peer-visibility assertions right; missed the specific peers.len()==1/peers_omitted==0 exactness and the not-your-own-peer check via qualify().

### `an_excluded_file_leaves_the_queue_and_stays_in_the_count` — QUIRKY
- spec 3 · read at `5a6bc7c51cef` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a scan containing a file marked excluded by .sanityignore, then asserts it never appears among the tasks the queue offers (e.g. via collect_tasks/queued/work_left) while still being counted in the repo's total/denominator figures — distinguishing a deliberate human exclusion from an oversized/unreadable file, which per the earlier collect_tasks code is dropped from the denominator entirely rather than just skipped in the queue.
- found: Confirms there's no default ignore (everything counted with no .sanityignore present), then writes a .sanityignore excluding tests/, and checks four things: count_funcs reports (kept, excluded) as (1,2) rather than silently dropping the excluded ones; collect_tasks only ever offers the one non-excluded function; and shape_of (a per-directory summary, presumably for proposing new exclusions) still reports both the excluded count and the (zero) function count for the tests/ directory.
- predicted: some · documented: full · derivable: no · legible: full · trap: no

### `a_reading_for_a_deleted_function_is_not_coverage`
- spec 3 · read at `45b2f29624fc` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:03Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Unit test: builds a project/scan containing a function, creates a report for it, then simulates the function being removed (rescanning without it or replacing the scan), and asserts that the coverage/assessed count no longer includes that orphaned report — verifying the fix where deleted functions' readings used to inflate `assessed` forever.
- found: Writes a two-function file, scans it, creates reports for both functions, asserts assessed==2, then rewrites the file to remove one function, rescans, swaps in the new scan (keeping old reports), and asserts assessed==1 — the orphaned report for the deleted function no longer counts.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `deleting_a_twin_expires_the_survivors_reading_rather_than_moving_it`
- spec 3 · read at `4a0eea5e5cf5` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:38Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Creates a file with two same-named functions (twins) with different bodies, records a report/reading for the first one, then rewrites the file deleting that first twin so the surviving second twin takes over ordinal 0 (the deleted one's old slot). After a resync, it asserts the survivor's reading is expired/stale rather than silently treated as valid coverage for the survivor, because the recorded body hash doesn't match the survivor's actual body — proving positional matching alone doesn't wrongly transfer a reading between twins.
- found: Matches prediction closely: two same-named twin functions, reports recorded for both (body snapshot = original body text), first twin deleted so the survivor slides into ordinal 0, resync_changed runs, and it asserts the survivor's inherited reading is flagged stale via assessment::is_stale comparing recorded body against the survivor's actual current body.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_file_is_queued_as_its_own_reading`
- spec 2 · read at `a037ddcfa76d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:47Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test verifying that a file with a substantial header/doc comment gets queued as its own reading task (separate from the functions inside it), so the header itself is judged rather than silently used as unattributed context for every function reader. It likely scans a fixture file with a banner comment, pulls from the queue, and asserts one of the queued items is the file itself (not a function) with the header doc attached.
- found: Writes a fixture file with a `//!` module doc header and two functions, collects tasks, and asserts exactly one file-level task is produced (keyed by path, not `#`), carrying the header doc, listing every declaration as peers, a non-empty `ask` field, and separately confirms the two functions still get their own unchanged (non-file) tasks.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Got the overall concept right but missed specifics: the id being the bare path (vs function ids containing '#'), peers listing all declarations, and the explicit count check that functions are unaffected.

### `a_file_reading_expires_on_its_header_and_its_surface` — QUIRKY
- spec 2 · read at `011abc3cd53e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:57Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that creates a file, records a reading of it, then edits only the function body and asserts the reading is still valid (not expired), then edits the file's banner/doc comment or top-level declarations and asserts the reading is now expired.
- found: Tests the underlying hash used to gate file-reading validity, not an actual reading/lease lifecycle: it computes a content hash for a file's declarations via project_of/scan, and asserts the hash changes when the doc banner changes, when a declaration's signature changes, or when a new declaration is added, but stays the same when only a function body changes.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I expected an end-to-end expiry check via a reading/lease API, but it actually just compares a derived hash string across file edits.

### `a_long_file_sends_the_neighborhood_and_counts_the_rest`
- spec 2 · read at `f3ec72c0fa86` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:05Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up a file with many functions (more than the neighborhood/peer window size), calls the next/open handler for one of them, and asserts that the returned peers list is capped/truncated to some fixed size while peers_omitted correctly reports the count of remaining functions not included, verifying the two numbers are consistent (peers.len() + peers_omitted == total siblings).
- found: Unit test of a `neighbors` helper: for a 100-function file it checks the window is centered around the middle index and equals PEER_WINDOW size with the correct omitted count, that the window slides (not truncates asymmetrically) at the first and last index, that a function never appears as its own peer, and that a file small enough to fit entirely returns all peers with omitted=0.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I predicted the general truncation/count invariant but missed the specific edge-sliding behavior and the self-exclusion assertion, which turned out to be the more interesting parts of the test.

### `a_file_that_moved_is_re_cut_before_anything_is_handed_out`
- spec 2 · read at `25a55854a18c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:03Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test that takes a scanned file, then edits it (e.g. inserts lines above a function so everything below shifts), and verifies that when a task/reveal is handed out for that file afterward, the line ranges are recomputed against the current file content rather than the stale scan — so the reader gets correct extents instead of code that has shifted underneath the recorded range. It probably asserts the returned source/lines match the function's new position, not the original cached one.
- found: Writes a two-function file, scans it, then rewrites the file with three comment lines inserted above (shifting both functions down) plus a new third function. Calls `resync_changed` and asserts it reports 1 changed file, that the line numbers for the existing functions follow the shift, that the body hash for the unmoved function is unchanged (so its reading isn't expired by a pure line-shift), and that the brand-new function does NOT appear yet — new declarations only arrive on a full rescan, not resync.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the specific mechanism name (resync_changed) and the important distinction that resync only re-cuts existing nodes' positions/hashes without inventing new ones — that's the real point of the test, which I only partially anticipated.

### `a_function_that_is_gone_stops_being_offered` — QUIRKY
- spec 2 · read at `ac71df55ca7a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:50Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that scans a repo containing a function, queues it for assessment, then rewrites the file to remove that function and triggers a rescan, and asserts that a subsequent next/handout call never returns that now-deleted function — it's dropped from the queue rather than being served at a stale line range.
- found: Writes a file with two functions, resyncs (0 changes), rewrites the file dropping one function, resyncs again (asserts 1 change detected), then walks the resulting scan tree and asserts only the surviving function's name remains — verifying the deleted function is scrubbed from the tree itself via resync_changed, not tested through a next/handout call.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I assumed the test would go through the queue/next handout path since the doc says 'not handed out at stale lines', but it actually verifies removal at the scan-tree level via resync_changed.

### `a_backend_with_a_wave_in_flight_is_not_retired` — QUIRKY
- spec 2 · read at `45c5c6442ea8` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:04Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is a test verifying that calling /retire on a backend that currently has a wave (batch of concurrent in-flight readings) is refused rather than acted on immediately. It likely sets up a backend, marks/starts an in-flight wave, calls the retire endpoint, and asserts the response/backend state shows refusal — the backend remains active rather than being torn down mid-wave.
- found: A three-stage test: first a window-backed project refuses retire with reason \"window\"; then a headless backend with a live run (3 spawned, 0 finished) refuses with reason \"busy\" and confirms the watch loop's `retiring()` flag stays false; finally, once the run's `ended` is set, retire succeeds and `retiring()` becomes true.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `status_answers_about_the_callers_repo_not_the_window`
- spec 3 · read at `207740eb8703` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:52Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up two projects, makes one of them the "open"/focused project in the window's shared state, then calls the /status endpoint passing the other project's key as a query param, and asserts the response describes that queried project (not whatever the window currently has open) — proving /status is keyed by request param, not window focus.
- found: Sets up two projects, sets state.active to 'theirs' (simulating the window having drifted to a different repo) but touches 'theirs' then 'mine' last. Calls status() with an explicit project=/mine param and asserts it answers about mine, not the active window project. Then calls status() with no project param and asserts it still answers about 'mine' — the most-recently-touched/opened project, not state.active — proving status resolves by caller-supplied key or recency-of-open, never by whatever the window happens to be showing.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: Missed that the no-key case specifically tests recency-of-touch vs state.active, not just 'param vs window' — that's a second, distinct assertion beyond my prediction.

### `lease_kind`
- spec 2 · read at `ffaf4f3556c5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:35Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test helper that repeatedly requests/pops tasks from the shared queue for the given project key, discarding (but leasing, so they're not handed out again) any task that doesn't match the wanted kind (file vs function, per want_file), until it finds and returns one that does match. This avoids tests being order-dependent on which kind of task the queue happens to serve first.
- found: A test-fixture helper that calls the real `queue` endpoint in a loop (up to 16 times), requesting one task at a time for a given project key, and returns the first task whose `file` flag matches `want_file`. Panics with a descriptive message if it never finds a matching one within the retry budget.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The bounded retry (16 attempts) and panic-with-message on exhaustion were details I didn't predict, though the core mechanism matched.

### `reveal_serves_the_functions_own_lines_and_no_more`
- spec 3 · read at `436ea881c407` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:19Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds a small fixture scan with a file containing a function at a known line range, drives it through the agent API to get a task and then reveal it, and asserts the source returned is exactly the function's own lines (start_line..end_line) — not the whole file's contents and not neighboring lines outside that range.
- found: Writes a fixture file with two functions (one printing "1", the other printing "SECRET"), leases a task, calls reveal, and asserts the returned source contains the leased function's own name but not the sibling function's distinguishing content — checking for leakage rather than an exact line-range slice equality.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `an_oversize_function_leaves_the_queue_and_is_counted_apart` — QUIRKY
- spec 3 · read at `bb173b63af52` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:58Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Sets up a project/scan with a function whose byte extent exceeds READ_CEILING, then verifies the three places that must agree: the task queue never hands it out, the counts report it under `oversize` distinct from `excluded`, and calling reveal against it is refused rather than serving a body — proving the queue, the count, and reveal all treat it consistently as unreadable.
- found: Writes a file with one oversize function (past READ_CEILING) beside one small readable one, then checks `count_funcs` reports oversize=1/kept=1/excluded=0, and drains the `queue` endpoint to confirm the small function is handed out while the huge one never is. It does not exercise `reveal` at all, and the real point of the test — that the small function survives having an unreadable sibling in the same file — is something I didn't anticipate.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc claims three places (queue, count, reveal) must agree, but this particular test only exercises two of them (queue and count) — reveal's agreement must be covered by a different test.

### `a_paged_body_reassembles_to_the_original`
- spec 3 · read at `d2e1e5d13a4e` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:39Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds a large string body, calls the part-splitting function (likely `parts_of`) to cut it into multiple parts, then concatenates all the returned parts back together and asserts the result is byte-for-byte identical to the original body — proving paging doesn't lose or alter any bytes.
- found: Confirmed the core reassembly assertion (`cut.concat() == body`), plus two things I missed: every part must be ≤ PART_BYTES, and every part but the last must end on a line boundary (`\n`) so a cut never lands mid-line and reads as a syntax error to the reader.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc only explains the reassembly guarantee, not the line-boundary-cut invariant, which is arguably the more interesting design constraint in the test.

### `a_small_body_is_served_whole_in_one_part`
- spec 3 · read at `f317231d8ef8` · commit `3528c54` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:04:29Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A unit test that constructs a small function body (a few lines) and passes it through the paging/reveal logic, then asserts the resulting response reports parts == 1 and has no next_step / continuation, confirming small bodies are served whole rather than entering the paging protocol.
- found: A unit test that calls parts_of() directly on a small 3-line function body string and asserts it returns a single-element vec equal to the original body — simpler than going through a full reveal response object, but confirms the same "small bodies aren't paged" behavior.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_report_with_parts_outstanding_is_refused`
- spec 3 · read at `a30acc5a93ce` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:01:16Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds a fixture with a function large enough that its body pages into multiple reveal parts, leases the task, calls reveal for part 1 only (not fetching the remaining parts), then immediately submits a report and asserts the server rejects it (ok: false / an error) because outstanding parts were never revealed — the server enforces this itself rather than relying on the reader to have honestly fetched everything first.
- found: Confirmed the refusal (ok:false, saved:false) when reporting with parts outstanding, but the test goes further than I predicted: it then fetches the remaining parts (each with a different, deliberately wrong `expected` string that "must not land"), resubmits the original report which now succeeds, and asserts the lease survived the refusal (same task still reportable) and that the stored prediction is still the very first one written, plus that `paged` is stamped with the server's own part count rather than anything reader-supplied.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_second_reveal_cannot_revise_the_prediction`
- spec 3 · read at `335b6855eb85` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:15Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Sets up a fixture project, leases a task, calls reveal with expected="first guess" and again with expected="second guess" for the same task id, asserts both calls return the identical source text, and checks internal state (e.g. the task's stored prediction field, or the behavior of a subsequent report call) to confirm the recorded prediction is still "first guess" — the second call did not overwrite it.
- found: Two reveal calls with different `expected` strings on the same task return identical source; a report is then submitted carrying the revised expected value ("actually it prints 1"), and the stored report's expected field is asserted to still be the original first guess ("a wild guess") — confirming the report handler ignores/discards a client-supplied expected rather than trusting it.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `reveal_without_a_lease_is_refused`
- spec 3 · read at `cbb4e5bfda30` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:41Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test: spins up a test app/state with a scanned project, picks a valid node id that was never handed out via sanity_next (so it has no entry in `leased`), calls the `reveal` handler directly with that id, and asserts the JSON response comes back `ok: false` with an error mentioning the id isn't out with the caller — exercising the lease-check branch seen in `reveal`.
- found: Builds a test project from a temp dir with one function, takes its id straight from the scan (never leased via sanity_next), calls the `reveal` handler directly, and asserts ok:false, null source, and — beyond what I predicted — that no prediction got recorded for that id despite the refused call.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Missed the extra assertion that a refused reveal must not record a prediction, which matters given `reveal`'s or_insert-into-predictions logic seen earlier.

### `a_file_task_is_revealed_whole`
- spec 3 · read at `6de8acc84299` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:51Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This is a test verifying that when sanity_next hands out a file-kind task, sanity_reveal returns the entire file rather than truncating to the file node's end_line (which the docs say only reaches the last declaration). It likely sets up a scan with a file whose declarations end before the file's actual length, requests a file task, reveals it, and asserts the returned source spans the full file rather than being cut short.
- found: Test: writes a small .rs file with a header comment before the one function and a trailing comment after it, leases a file-kind task for it, reveals it, and asserts the response is whole_file:true with source containing both the header and trailing comment — proving the file isn't sliced down to its last declaration's end_line.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_pathless_open_answers_from_what_a_human_added`
- spec 3 · read at `6dfdb0f08d2c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:53Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Exercises resolve_open(&state, None) across three scenarios: zero known projects (errors, since only a person can fix "none"), exactly one known project (succeeds, returning that project's path since it's the only candidate), and multiple known projects (errors rather than guessing, e.g. picking the most recent).
- found: Tests resolve_open(&state, None) with zero projects (errors, hint mentions "add"), one project (succeeds with that path), and two projects (errors, and the error's "projects" array lists both candidate paths for the human to choose from).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_path_the_human_never_added_is_refused` — QUIRKY
- spec 3 · read at `ddefb2243364` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:13Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Creates a real, valid temp directory/repo on disk that was never registered via the human "add project" flow, then calls the API function that resolves a project by path directly with that raw path, and asserts the call is refused/errors — proving realness of the path isn't enough, only being in the human-added project list matters.
- found: Seeds the known-projects index with a single project at key "/added", then asserts resolve_open succeeds for that exact path but returns an error JSON (ok:false, error naming the requested path) for an unrelated path "/somewhere-else" that was never added, using fabricated paths rather than real filesystem repos.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `work_detaches_from_a_thread_with_no_runtime`
- spec 2 · read at `fe845b17e4cf` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:07Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A plain #[test] (no tokio runtime) that calls start_run (or similar) from a bare OS thread with no tokio context, then blocks/polls on a channel or flag until the detached spawned work actually executes, asserting no panic occurs and that the work genuinely ran (not just that detachment returned without crashing).
- found: A plain #[test] calling `detached` with an async block that sends on an mpsc channel, from a thread with no tokio runtime, then asserts recv_timeout succeeds within 5s — proving the future actually ran, not merely that detaching didn't panic.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `work_detaches_from_inside_a_runtime`
- spec 2 · read at `47b1ca72e105` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:07Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Async test that verifies a "work" helper (likely spawning blocking work onto a separate thread/runtime for CPU-bound or blocking tasks) functions correctly even when invoked from within an already-running tokio runtime, mimicking the axum handler's calling context. It probably calls the helper inside an async fn (itself run on a runtime) and asserts the result comes back successfully without panicking (e.g., avoiding a "Cannot start a runtime from within a runtime" error), contrasting with a sibling test that calls it from a plain thread with no runtime at all.
- found: Test confirms that `detached(async move { ... })` actually runs the given future even when called from inside an existing tokio runtime (the axum handler's context), by sending a signal over a channel and using spawn_blocking to wait on it with a timeout.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I predicted it wrapped blocking/sync work onto a thread; actually `detached` takes an async future directly, and the test just proves it executes rather than testing panic-avoidance.

### `a_project_key_that_is_not_loaded_is_refused_rather_than_swapped`
- spec 2 · read at `65ead1581dca` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test function verifying that calling the API with a project key that isn't currently loaded returns a refusal/error, rather than silently falling back to the "active" project and misattributing a reading to the wrong repo.
- found: A unit test that builds an AppState with one loaded project ("/loaded", active), then checks state.for_client(): asking for the loaded key returns it, asking for an unloaded key ("/not-restored-yet") returns None instead of falling back to active, and asking for no key (None) defaults to the active project.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `looking_at_a_project_moves_neither_the_list_nor_the_routing`
- spec 3 · read at `c9c6a207ee69` · commit `3528c54` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:04:15Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This test creates two projects, establishes an initial "most recently opened" ordering via an explicit open/touch, then calls a project-viewing/selection action (e.g. select_project) on the other project, and asserts two things together: that the sidebar ordering list is unchanged (the viewed project didn't jump to the top), and that for_client(None) still resolves to the originally-opened project rather than the one just viewed — i.e. viewing a project is read-only and distinct from opening it.
- found: A test asserting that state.select() (the sidebar click action) leaves both the sidebar ordering (touched timestamps) and the keyless for_client(None) routing untouched — only touch()/open moves those — while still updating state.active to record what's currently being viewed, since a restart should resume on the last-viewed project.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs explain the motivation/design rationale well but don't mention the third assertion (state.active must still move) — that's the part not derivable from docs alone, only from reading the code.

### `a_reading_lands_where_its_task_came_from` — QUIRKY
- spec 2 · read at `279e84fbe9f7` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:16Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This test opens/leases a task from project A, then retargets the ambient/active key to project B (simulating another subagent calling sanity_open), submits the report for the leased task without specifying a project, and asserts the report was recorded against project A (the one the lease came from) rather than project B or being silently dropped.
- found: Sets up two projects, each with one function, and directly exercises AppState::owner_of(id, caller_key) with three key variants for an id from /theirs: caller_key=Some(\"/mine\") (a sibling reader's ambient key), Some(\"/theirs\"), and None. All three resolve ownership to \"/theirs\" — the project the id actually belongs to — proving owner_of ignores/overrides a mismatched caller key rather than trusting it.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I imagined a full lease/report round-trip through sanity_open and report submission; the actual test is narrower, unit-testing owner_of() directly rather than the end-to-end reporting flow.

### `a_reading_for_an_id_no_project_holds_is_refused` — QUIRKY
- spec 2 · read at `ff711e283b82` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up a project/session, then calls the report endpoint with a bogus/nonexistent function id, and asserts the call returns an explicit error (not `saved: true`) since no function in the project matches that id — verifying the fix described in the docstring where an unmatched id used to be silently swallowed.
- found: Tests `state.owner_of` directly: an id with no matching function and no lease returns None (both scoped to a project and unscoped), but once a lease exists for that id (even for a nonexistent function, keyed by line), owner_of resolves it to the owning project — leases outlive re-cuts.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `a_file_just_drawn_from_is_passed_over_on_the_next_call`
- spec 2 · read at `67217c463b2e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:49Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that draws one task from a queue spanning multiple files, then draws a second task and asserts it comes from a different file than the first draw — verifying that "last file drawn from" state persists across separate calls (not just within one batch), regression-testing the bug described in the file doc where a single-item batch had nothing to spread.
- found: A four-part test of spread_across_files: (1) with no recent draws, ranking alone picks the top function; (2) after hot.rs was just drawn from, the next call prefers a lower-ranked function from a different, unopened file over hot.rs's sibling; (3) if the only file with remaining work is the rested one, it's still handed over rather than returning nothing; (4) once the FILE_REST window has elapsed, ranking decides again regardless of recency.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `queue_spreads_across_files`
- spec 2 · read at `2d5ef9f4073a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:35Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Sets up a scan/project with multiple files each having several functions, builds the queue, and asserts that consecutive items handed out don't come from the same file back-to-back — verifying the interleave-by-file behavior described in the doc, likely checking against a naive score-only ordering that would cluster by file.
- found: Builds a ranked task list dominated by one file (hot.rs highest scores, mid.rs, cold.rs lowest), runs interleave_by_file to hand out 6, then asserts no two consecutive picks share a file, and that the top-ranked file/task still comes first (so interleaving doesn't degrade into ignoring the ranking).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `queue_falls_back_when_one_file_remains`
- spec 2 · read at `fe50b27b0f2e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:04Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test setting up a queue/project with only one file's readings left, then asserting that repeated draws still yield tasks (not none/starvation), since normally the queue interleaves across files but must fall back to serving from the single remaining file.
- found: Builds 4 ranked tasks all from the same file "only.rs", calls interleave_by_file asking for 3, and asserts it still hands back 3 tasks despite there being only one file to interleave across.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `queue_never_repeats_or_overruns`
- spec 2 · read at `5d37dac2518c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:11Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that populates the task queue with a known small number of items, then calls the "next" draw function more times than there are items, asserting that: each item is only ever returned once (no repeats), the total returned equals the number of items available (not more), and no panic occurs on the extra calls — matching the doc note that over-asking returns everything, not a panic and not a repeat.
- found: Tests interleave_by_file: requesting 25 items from a ranked list of 2 tasks returns exactly 2, with distinct ids (no duplicate hand-outs).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted the right behavior (over-asking returns everything, no repeats) but expected a loop calling a 'next' function repeatedly rather than a single call to interleave_by_file with a large n.

### `two_projects`
- spec 2 · read at `ccdba1707d8d` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:10Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test helper that creates a temp directory as a throwaway repo, builds a DataHome and AppState, then scans that same repo twice and inserts two Projects into the state keyed /x and /y (since focus reasons about keys, not distinct repos), returning all three so the caller can exercise touch/focus without losing the DataHome.
- found: Creates a data_home, a tempdir with one file (a.rs), builds default AppState, and inserts project_of(dir) twice under keys /x and /y — matches predicted shape exactly, missed only that it writes one small source file into the repo first.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `an_unasked_open_does_not_steal_the_window`
- spec 2 · read at `ccd2b12870a2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that opens a second project via a non-interactive/headless path (not a human's explicit "open" click) while a human's window is already pointed at another project, then asserts the active/current window pointer is unchanged — the new project becomes loaded and queryable, but doesn't steal focus.
- found: A test of `state.focus(path, asked)`: with the active window on "/x", calling focus("/y", false) (an unasked/implicit open) returns false and leaves active as "/x"; calling focus("/y", true) (an explicit open, e.g. --show or the Open command) returns true and moves active to "/y".
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Docs matched the intent exactly; I got the behavior right but not the concrete boolean-parameter API shape (`focus(path, asked)`).

### `an_open_takes_a_window_that_nobody_holds` — QUIRKY
- spec 2 · read at `5fdf359bc236` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:16Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test simulating a headless daemon with no window ever set as "active": it opens a project without any prior active claim and asserts the open call sets itself as the active project anyway, so that a subsequent keyless call resolves to it rather than finding no active window and failing.
- found: Tests `state.focus()` (not "open" as the name suggests to an outsider): first with no active project set, focusing a project succeeds and becomes active; then with `active` pointing at a project path that isn't loaded ("/gone"), focus still succeeds and overwrites it — because a dangling active key isn't really "somebody's view" being taken away, so focus doesn't need permission to override it.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: Got the headless/no-claimant idea right but missed that the real mechanism under test is `focus()` and its second, more interesting case: an active key pointing at an unloaded project is treated the same as no claim at all.

### `a_keyless_call_follows_the_last_open_not_the_window`
- spec 2 · read at `fa6903e398b2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A Rust test asserting that a keyless call (next/report with no explicit project key) resolves to the most-recently-opened project, not whatever project the UI window currently has focused on. Likely opens project A, then project B, simulates the window staying on A, and asserts a keyless call operates against B.
- found: Test uses a two_projects() fixture, opens/focuses /x then touches /x and /y (touch = last-opened marker distinct from focus). Confirms active/focused view stays /x while a keyless for_client(None) call resolves to /y (last touched). Also checks explicit key always wins, and an unknown key resolves to None rather than falling back.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Also covers explicit-key-wins and unknown-key-returns-None cases beyond what I predicted, via state.focus/touch/for_client helpers I hadn't guessed the names of.

### `endpoint_reads_back_what_was_published` — QUIRKY
- spec 2 · read at `f66a505968be` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:15Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This test publishes some in-memory state (e.g. project/queue state) to the endpoint file used for the loopback API, then reads that file back through the same parser used elsewhere in the app, and asserts the round-tripped data matches the original — verifying a single shared parser handles both write and read consistently.
- found: Constructs an Endpoint{port,pid}, checks its url() formats as http://127.0.0.1:<port>, then serializes port/pid to JSON and parses it back with serde_json, asserting the values survive the round trip. No actual file I/O — the "published" file format is just simulated inline with json! and from_str.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: Expected an actual file write/read through the app's endpoint-file mechanism; instead it's an inline serde_json round trip plus a URL-formatting assertion.

### `the_priming_warning_asks_rather_than_asserts` — QUIRKY
- spec 2 · read at `c51236a9ccda` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:47Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test that renders/fetches the priming-warning string and asserts it is phrased as a hedge/question rather than a flat assertion that the reader is primed (e.g. doesn't contain something like "you are primed" as fact), while still asserting the warning names the --setting-sources flag so a human can act on it.
- found: Test asserts priming_note() returns None with no instructions file, and when CLAUDE.md exists returns a string naming the file, the --setting-sources user flag, admitting "cannot see", delegating with "CHECK YOUR OWN CONTEXT", offering "the run is clean" as the alternative, and when both CLAUDE.md and AGENTS.md exist, names both files together.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `a_report_carrying_its_own_tool_call_is_refused` — QUIRKY
- spec 2 · read at `da4694a4ddef` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:03Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This test checks the guard that rejects a submitted report whose text fields contain what looks like a leaked/truncated tool-call fragment (e.g. an XML-ish tag pattern), while still allowing legitimate report text that happens to mention markup like JSX. It constructs a report with a fake tool-call-like string in a field and asserts it's refused, and a report with ordinary JSX-mentioning prose and asserts it passes.
- found: Tests the `mangled()` detector: a report field containing a closing tag like `</found>` or `</expected>` followed by leaked tool-call-ish text is flagged as mangled (returns Some(field_name)); it also checks that a missing `predicted` field would default to Grade::Full via grades(). A third report with ordinary prose mentioning HTML/JSX tags (`<div>`, `<p>`, `<hr>`) but no closing-tag-of-its-own-field pattern is not flagged (mangled returns None).
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I got the overall refuse-leak/allow-prose behavior right but missed the specific heuristic — it's keyed on a field's own closing tag (e.g. </found> inside `found`) rather than generic tool-call-shaped text, and missed the Grade::Full-on-missing-predicted assertion entirely.

### `a_leak_with_its_grades_intact_is_a_reading_and_is_kept` — QUIRKY
- spec 2 · read at `6a2a0bdf22b2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:47Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Submits a report whose `found` text contains a leak-like trailing tag but has all grade fields present, and asserts the call succeeds (not refused) and the stored reading keeps the tag exactly as sent, rather than the server trying to strip or parse it back out.
- found: Builds a Report with a leak-like trailing tag in `found` but all three grade fields present, and asserts mangled() returns None (not flagged) and the reader's actual grade is preserved rather than upgraded to Full. Then removes one grade field and asserts mangled() flags \"found\" as the culprit — showing the guard is about completeness of grades, not the leak text itself.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Didn't anticipate the specific `mangled()` function name/API or the second contrasting case in the same test.

## src-tauri/src/assessment.rs

### the file itself
- spec 3 · served in 4 parts · read at `872b80d4ea6c` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:21Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: This file implements the on-disk `.sanity/` assessment store: markdown files (with embedded structured data) committed into the repo itself, replacing the old per-machine JSON cache in Application Support. It covers reading/writing/parsing these markdown "shards" (one per top-level directory), keying/hashing functions and their bodies so a reading can detect staleness when code or docs change, rendering entries/shards/an index, computing grades and dates, and pulling git metadata (author, HEAD) — plus a large battery of round-trip and staleness tests asserting the format's invariants (position, spec, priming, model, hash-ignores-formatting, etc).
- found: Covers everything predicted, plus a per-axis question-versioning system (SPEC/PREDICTED_SINCE/LEGIBLE_SINCE/TRAP_SINCE) that expires individual grades when what they mean changes rather than the whole reading, a packed u16 bit-encoding of a reading for the replay timeline, priming/agent-docs detection, extra provenance fields (position, asked-vs-model, harness, when, by), and an orphan-shard sweep that only removes files the previous index itself linked.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no

### `legible_current`
- spec 2 · read at `8c75b2b322f6` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:16Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns spec >= some constant representing the current 'legible' question version, so readings tagged with an equal-or-newer spec number are trusted/current, while older (including default 0) specs are considered stale/untrusted.
- found: Returns spec >= LEGIBLE_SINCE, exactly as predicted from the docs' explanation of the >= semantics.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment explains the WHY (asymmetric trust direction) that the one-line body itself couldn't convey — good example of non-derivable documentation.

### `trap_current`
- spec 3 · read at `6d01b9f28351` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:50:27Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: trap_current(spec) compares the reading's spec version number against a current "trap question" spec constant using >=, returning true if the reading answered today's version of the trap question (matching the same currency check legible_current does for its axis).
- found: spec >= TRAP_SINCE — a one-line comparison against a constant marking when the trap question was last redefined.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `packed`
- spec 3 · read at `ef75792ef708` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:20:17Z · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Packs a Report's four graded axes into one u16: predicted/documented/legible each as a 3-bit grade value (via a `g()` helper mapping None/Some/Most/Full to 0-4) at bit offsets 0, 3, 6, and the trap boolean at bit 9 — applying `grades()`'s derivable-forces-documented-to-none rule and gating legible/trap through legible_current/trap_current so a superseded-spec answer doesn't leak into the packed value.
- found: Exactly as predicted: packs predicted/documented/legible as 3-bit grade values at offsets 0/3/6 and trap as a bit at offset 9, gating legible/trap through the current-spec checks and using grades() for the derivable override.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `dated_axis` — QUIRKY
- spec 3 · read at `09495a3a8937` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:11Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Given a Report, returns whether its particular axis/field is one whose truth is tied to the code's CURRENT body — such that if the function changes underneath it, this reading can go stale — as opposed to axes recording something about the reader's process itself (e.g. which model made it) that don't depend on the code at all. Probably a match on some kind/axis enum on the Report, returning true for things like predicted/trap/legible and false for others.
- found: Returns true if the report's `legible` field is set but was recorded under a schema/spec version older than `legible_current`, or if `trap` is true but recorded under a spec older than `trap_current` — i.e. flags a report as dated only for these two specific fields whose meaning/criteria changed at a known spec version, not a generic per-axis staleness check.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: The mechanism is version-gating two specific fields (legible, trap) against a `r.spec` version number, not a general classification of which axes are code-dependent — my prediction guessed the right theme (staleness) but the wrong mechanism.

### `reading_hash`
- spec 2 · read at `06911bed7259` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:16:05Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Concatenates the file_doc (if present), the function's own doc (if present), and the body into one string, then hashes that combined string to produce a fingerprint. This makes the hash sensitive to changes in either the module-header doc, the function's own doc comment, or the code body itself, so a reading is correctly marked stale if any of the text it was predicted from changes — not just the body.
- found: Collects doc and file_doc (in that order) into a stack, filtering out None; if both are absent, hashes the body alone (byte-identical to the old two-arg hash, so headerless files don't churn); otherwise hashes the joined doc stack plus a space plus the body, so any doc text change changes the hash too.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `body_hash`
- spec 2 · read at `b719bea07049` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:37Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Collapses/normalizes whitespace in `body` first (so reformatting doesn't change the hash), then runs an FNV-1a-shaped fold loop (XOR byte then multiply by a fixed, deliberately-frozen non-standard prime constant) over the normalized bytes to accumulate a u64 hash, and formats that as a hex string to return. Used as a stable content fingerprint to detect whether a committed reading has gone stale against current code.
- found: Splits body on whitespace and flattens to bytes (normalizing away formatting), FNV-1a-shaped XOR-then-multiply fold with a frozen non-standard constant, then masks to 48 bits and formats as 12 hex digits — matches prediction except I didn't anticipate the specific 48-bit truncation for compact display.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `dir`
- spec 2 · read at `086b47bb78c4` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns the path to the .sanity/ directory inside the given repo, likely just repo.join(".sanity").
- found: Joins ".sanity" onto the repo path, nothing more.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `shard_of`
- spec 2 · read at `ac17c9f7e62c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns the shard name for a repo-relative path: if the path has no slash (a root-level file), returns a shared constant name for the root shard; otherwise returns the first path component (top-level directory) as the shard.
- found: Splits path on first '/'; if there's a non-empty top-level component returns it as the shard name, else returns "root" for root-level files.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `shard_links`
- spec 2 · read at `ebec6dfdb1ee` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Scans the index Markdown for links of the form `[label](name.md)` (the shape `row` renders) and extracts just the `name.md` filename from each match, returning them as a Vec<String>. Likely implemented with a simple manual scan or regex looking for "](" followed by ".md)".
- found: Manually scans for "](" then finds the closing ")" to extract the filename, but only keeps it if it ends in .md, has no '/', and isn't "README.md" itself (avoiding self-links and non-shard links).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted the core scan mechanism correctly but missed the exclusion filters (no slash, not README.md) that guard against false matches.

### `shard_file`
- spec 2 · read at `321691534c5d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:15Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Given a shard key/name, returns the filename (or relative path) of the markdown file that stores that shard within the .sanity/ directory, e.g. formatting it as "{shard}.md" or similar.
- found: Sanitizes a shard key by replacing any character that isn't alphanumeric, '-', '_', or '.' with '-', then appends ".md" to produce a safe filename for that shard.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `file_key`
- spec 2 · read at `4de367e6855c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:38Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Likely just returns path.to_string(), a trivial identity wrapper turning the path into the key string, relying on the fact that no function key contains a bare path without '#'.
- found: Exactly a trivial identity wrapper: returns path.to_string() as the key.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `key_of`
- spec 2 · read at `34546cf94a0f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:15Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds the string "path#name" when ord is 0 (or 1, the first occurrence), and appends "#{ord}" (e.g. "#2", "#3") for subsequent same-named functions in that file, using simple string formatting/concatenation.
- found: Formats "path#name" for ord==0, else "path#name#{ord+1}" for duplicates, matching the documented durable-id scheme.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `grade_word`
- spec 2 · read at `25328bac3021` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A simple match statement converting a Grade enum value into a static string label (like "green"/"amber"/"red" or similar) used for display or markdown rendering of assessment results.
- found: A match statement mapping Grade::Full/Most/Some/None to their lowercase string names "full"/"most"/"some"/"none".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `parse_grade`
- spec 2 · read at `6efa4a4b952e` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:59Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Parses a grade word (e.g. "full", "most", "some", "none", matching the enum used elsewhere for predicted/documented/legible) from a markdown-stored string back into the Grade enum via a match statement, returning None for anything unrecognized. This is the inverse of grade_word, used when reading the .sanity/ markdown store back in.
- found: Matches trimmed string against "full"/"most"/"some"/"none" to the Grade enum variants, None otherwise.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `flat`
- spec 2 · read at `cb995229a222` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:40Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a multi-line string and collapses it into a single line, replacing newlines and runs of whitespace with single spaces, then trimming, so it can be embedded as a one-line markdown bullet field without breaking a line-oriented parser.
- found: Collapses any whitespace (including newlines) into single spaces via split_whitespace + join, normalizing multi-line prose into one line.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `load`
- spec 2 · read at `5ce1ef6cbfcc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:13Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Reads the .sanity/ markdown store (likely via read_all/parse_shard) for the given repo, parses each shard into Report entries keyed by function id, and filters the result down to only those ids present in scan (dropping readings for functions that no longer exist in the current scan) before returning the HashMap<String, Report>.
- found: Reads all stored shards, then for every live function/file in the current scan looks up its durable key in the stored map, clones the found Report, rewrites its id to the live node id, and inserts into the output — so stale/deleted entries are naturally excluded since they're never iterated.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_all`
- spec 2 · read at `23599632fd93` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:27Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates every shard file under the .sanity directory (using dir/shard-listing helpers), parses each one with parse_shard, and merges all entries into a single HashMap<String, Report> keyed by "path#name" — assembling the full assessment index from the on-disk store.
- found: Reads all .md files (except README.md) in the given directory, reads each to a string, and merges parsed entries via parse_shard into one HashMap keyed path#name; returns empty map if the directory can't be read.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: Matched almost exactly, though I hadn't anticipated the explicit README.md exclusion or the silent empty-map fallback on unreadable dir.

### `parse_shard`
- spec 3 · read at `f7f4eac0b3a1` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:52Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Walks the markdown text line-by-line, treating some heading convention as entry boundaries (likely one heading per path#name function), accumulating fields (grade, expected, found, body/hash, etc.) into a builder for the current entry. On hitting the next boundary or EOF, it validates the accumulated entry and inserts a Report into `out` keyed by path#name only if required fields (expected/found) are present, dropping it otherwise. Unrecognized lines are simply skipped rather than causing a parse failure.
- found: Confirmed the structural shape: `## ` headings mark a file, `### ` headings mark a function entry within it (with ordinal-suffix disambiguation for same-named siblings), a macro flushes the current entry into `out` keyed by path#name whenever a new heading starts or the loop ends, and it's dropped unless expected/found is non-empty. What I underestimated: the sheer number of fields packed into one '·'-separated metadata bullet line — spec version, paged byte count, body snapshot, commit, model, asked-for question, harness, timestamp, author, cold/warm, priming (with the docs-in-context list folded into the same token), run position, and four separate predicted/documented/derivable/legible/trap grading fields — each parsed independently by prefix so a hand-edit reordering or dropping one only costs that one segment.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Every unparseable numeric/enum field defaults to a specific meaningful state (0, None, false) rather than erroring, and the doc comment on each explains why that default is the safe direction — worth preserving if this format is ever restructured, since the mapping isn't visible from the field names alone.

### `live_funcs`
- spec 3 · read at `10edd80b73ec` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:58:26Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over all functions discovered in the current `Scan` and builds a BTreeMap from a unique key (function identity, likely file+name based, mirroring `key_of`) to a `Live` struct holding current location/line info. This lets other code (e.g. `is_stale`) compare a previously recorded assessment entry against the current state of the codebase to see if the function still exists / hasn't moved.
- found: Walks the scan tree collecting all Func nodes grouped by file, sorts each file's functions by (line, id) for determinism, then assigns each a per-file, per-name ordinal (to disambiguate same-named functions/overloads) and inserts into a BTreeMap keyed by key_of(path, name, ordinal), with a Live value carrying id, path, name, line, ordinal, body, and byte size.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `live_files`
- spec 3 · read at `9cfc76740cce` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:40:48Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over scan's files, computes each file's file_key, skips files with no declarations (mirroring collect_tasks), and builds a BTreeMap<String, Live> keyed by file_key with a Live value per file (likely containing a doc/hash summary).
- found: Walks the scan tree via scan.root.visit, and for each node that is a File, not excluded, and has children (declarations), inserts a Live entry keyed by file_key(path). The Live value carries id/path/name/body(doc)/bytes with line and ord zeroed (irrelevant for file-level entries, presumably meaningful for function-level Live entries).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment is really about the module/store design (why .sanity/ exists) rather than this specific function's mechanics, so it explains motivation but not the visit-based tree-walk implementation.

### `is_stale` — QUIRKY
- spec 3 · read at `ec9e53887299` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:32Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: If report has no stored hash, return false (not stale — taken at its word). If node_body is None (function not found in current scan), return false — deletion/gone functions are handled elsewhere. Otherwise compare node_body's hash (possibly with extent as a quick pre-check) against the report's stored hash and return true on mismatch, false on match.
- found: Two checks, not one. First: if the body's extent exceeds PART_BYTES and the report has no `paged` record, it's unconditionally stale — a large body graded before paging existed couldn't have been served whole, so the reading is untrustworthy regardless of whether the text matches. Second, only if that passes: plain string equality between report.body and node_body (empty recorded body or no current body both count as not-stale), not a hash comparison as I guessed.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The extent/paged pre-check is the load-bearing half of this function and is invisible from the signature or peer list — a caller reading only the doc's staleness definition would miss that a byte-identical body can still be forced stale.

### `row` — QUIRKY
- spec 2 · read at `6f5e58cf55bc` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This method on `Compiled` builds a summary tuple for one shard/file to be used by `render_index` when rendering the top-level markdown index table. I expect it returns something like (file name/path, total function count, count fully predicted, count with some prediction, count with no prediction, count of traps or documented issues) — essentially aggregating per-function report fields into counts for a table row.
- found: Returns a tuple of (shard name, read count, total count, surprising count, stale count, dated count) pulled directly from fields on self — a simple field-tuple accessor with no computation.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `compile` — QUIRKY
- spec 3 · read at `5aef9fab781c` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Groups the entries in `reports` by shard (derived from each function/file's path), and for each shard group renders the markdown text via render_shard, producing a Compiled struct (shard name + rendered content) per shard. Returns the list of Compiled shards without touching the filesystem, so both save() and refresh_index() can call it and get byte-identical results.
- found: Driven off the scan's live functions and files (not the reports map directly, to avoid resolving readings back to functions by name where same-named twins could get confused) — for each live entry with a report, buckets it by shard-of-path then by file path, sorting file-reading first then by line/name. For each shard it builds a markdown body via render_entry per placed entry inline, and tallies read/total/surprising/stale/dated counts, packaging all of it into a Compiled struct per shard.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The doc explains why this exists (byte-identical output for save vs refresh_index) but not the coverage-counting logic (read/total/surprising/stale/dated) or the live-function-driven traversal that avoids the name-resolution ambiguity bug.

### `repo_name`
- spec 2 · read at `e44c150f0a11` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:19Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns the repo's display name by taking the final path component of the given Path and converting it to a String, with some fallback (like "repo") if the path has no file name component.
- found: Takes the final path component of repo as the display name, falling back to the string "this repo" if there is none.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `as_str` — QUIRKY
- spec 2 · read at `63d2ebc25082` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:33:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A trivial accessor on the Index type, returning a borrowed &str view of the underlying stored string field (e.g. &self.0 on a newtype wrapper), with no computation.
- found: Index is an enum (Current/Refreshed/Absent/Failed(String)), not a newtype wrapper as I guessed; as_str matches each variant to a status word, with Failed carrying its own error string through.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `refresh`
- spec 2 · read at `d14e3b642865` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Checks whether `.sanity/` already exists in `repo`; if not, does not create it (returns early, likely via load/compile with no writes). If it exists, calls compile() with scan and reports to produce a fresh Index and shard contents, then writes README.md and shard files back to disk only where the new bytes differ from what's currently on disk (comparing file by file), avoiding touching mtimes for identical content. Returns the compiled Index.
- found: Detects absence by trying to read README.md (returns Index::Absent if missing, never creating anything). Compiles fresh content via compile(), then for each shard and for the index, writes back only if the freshly rendered content differs from what's on disk (skipping shards that don't exist yet, so no shard is invented). Returns a status enum: Absent, Failed(reason), Refreshed (something changed), or Current (nothing changed) — not the compiled data itself.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I expected it to return the compiled Index data; it actually returns a status enum (Absent/Failed/Refreshed/Current) describing what happened to the on-disk files.

### `save` — QUIRKY
- spec 2 · read at `fa0335ff0e2f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:41Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: save compiles the scan+reports into some intermediate structure (via compile/Compiled::row), then partitions/renders it into shard markdown files plus an index markdown (via render_shard/render_index), and writes all of these out under a .sanity/ directory inside repo, along with a JSON sidecar that's the authoritative machine-readable copy — creating directories as needed and returning an io::Result for any filesystem failure.
- found: Compiles scan+reports into shards, writes each shard's markdown file and builds an index, writes README.md as the rendered index, then diffs the previous README's shard links against the new set to delete only orphaned shard files this tool previously created and no longer claims — ordered so a write failure never leaves the shards and index disagreeing.
- predicted: some · documented: none · derivable: no · legible: most · trap: no

### `render_entry`
- spec 3 · read at `8125eea02c6d` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Formats one assessed item (function or file) into a Markdown block for the `.sanity/` store — a heading with the name/ordinal, then fields drawn from `Report` (predicted, documented, derivable, legible, trap, note, model, etc.) rendered as readable text/list items, with some visual marker when `stale` is true to indicate the code changed since the reading.
- found: Renders one Report as a Markdown entry: a heading (function name or FILE_ENTRY, with an ordinal suffix only if it's a duplicate name, plus terse skim-markers like OBSCURE/QUIRKY/UNCLEAR/TANGLED/TRAP/STALE only for the extreme/notable grade values), a provenance bullet line assembled from optional metadata (spec version, paging, body location, commit, model, asked-for-model mismatch, harness, when, by, cold/warm, run position, priming), then expected/found lines, a grades summary line (predicted/documented/derivable/legible/trap), an optional note, and a trailing staleness warning if the underlying code changed since the reading.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

### `render_shard`
- spec 3 · read at `937d543802a9` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: render_shard builds the markdown text for one shard file in the `.sanity/` store: a header line naming the shard and summarizing progress stats (read/total, surprising, stale, dated counts), followed by the body of rendered entries, formatted as a single markdown string to write to disk.
- found: Formats the shard's markdown header: title, read/total/surprising counts plus optional stale/dated notes, boilerplate explaining what a reading entry is and what 'read at' means, an optional spec-versioning explanation when dated readings exist, a README link, then appends the body of rendered entries.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `render_index` — QUIRKY
- spec 2 · read at `9cb8e1d98830` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:24Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders the top-level `.sanity/` index Markdown file for a repo: a heading naming the repo, then sums the per-shard counts (total functions, assessed, surprised, etc.) across `shards` into repo-wide totals, followed by a Markdown table with one row per shard (name plus its counts) linking to each shard's own file. Returns the whole thing as one String to be written to disk.
- found: Builds the table (with a conditionally-included 'dated' column and summed totals row) as I predicted, but that's only a fragment embedded inside a large fixed Markdown document — a full README-style explanation of what Sanity is, how to install/run it, and how to keep the assessment fresh, which I completely missed.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `git`
- spec 2 · read at `15b063d45267` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:30Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Runs `git <args>` as a subprocess in `repo` via std::process::Command, capturing stdout; returns Some(trimmed stdout) if the command succeeds, or None if it fails to spawn or exits non-zero/produces invalid UTF-8. A small helper for things like current commit hash used elsewhere in assessment.rs.
- found: Runs `git -C repo <args>`, returns trimmed stdout wrapped in Some on success and non-empty output, None on failure or empty output.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `head`
- spec 2 · read at `cbac4ef71821` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Runs `git rev-parse HEAD` in the repo directory, trims the output, and returns it as the commit hash string; returns empty string if the command fails or the directory isn't a git repo.
- found: Delegates to a git() helper for `rev-parse --short HEAD`, defaulting to empty string on failure; I predicted the mechanism but not that it uses --short.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Doc explains the empty-outside-git-repo behavior which isn't derivable purely from the one-line body without knowing what git() does on failure.

### `who` — QUIRKY
- spec 2 · read at `186f3cd382b9` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Runs git in the repo (likely `git config user.name` and `user.email`, or `git var GIT_AUTHOR_IDENT`) to build a "Name <email>" identity string matching what git would put on a commit, with some fallback if git config is unset.
- found: Returns git config user.email, falling back to user.name, falling back to an empty string — not a combined "Name <email>" string as I predicted.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `agent_docs`
- spec 2 · read at `5f22d8c33257` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:59Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Checks the repo root for known agent-instruction filenames (e.g. CLAUDE.md, AGENTS.md), and returns a comma-joined string of which ones exist there — empty string if none are present.
- found: Filters a static AGENT_DOCS list of filenames to those existing at repo root, joins with ", " — exactly as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `now_iso`
- spec 2 · read at `d718b0876fd4` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:13Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Reads SystemTime::now(), computes seconds since UNIX_EPOCH, and formats it as an ISO-8601 UTC timestamp string (e.g. "2026-08-13T05:12:03Z") — likely by delegating the seconds value to the sibling `iso_of` function which does the actual civil-date conversion and formatting.
- found: Computes seconds since UNIX_EPOCH from SystemTime::now() (defaulting to 0 on error), then calls iso_of(secs) to produce the ISO-8601 string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `iso_of`
- spec 2 · read at `daf428b23611` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Converts epoch-seconds into an ISO-8601 string without a datetime crate — splits secs into whole days and seconds-of-day, calls civil_from_days (a manual civil-calendar algorithm) to get year/month/day, then formats those plus hours/minutes/seconds into YYYY-MM-DDTHH:MM:SSZ.
- found: Splits epoch seconds into days/remainder via div_euclid/rem_euclid, converts days to y/m/d via civil_from_days, breaks remainder into h/min/s, and formats as ISO-8601 YYYY-MM-DDTHH:MM:SSZ.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `civil_from_days`
- spec 2 · read at `fd5191d18b4b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:58Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Implements Howard Hinnant's civil_from_days algorithm: converts an integer day count since 1970-01-01 into a (year, month, day) tuple via era/year-of-era/day-of-year integer arithmetic, correctly handling the proleptic Gregorian calendar including negative day counts.
- found: Howard Hinnant's civil_from_days: shifts the epoch, computes era/day-of-era, then year-of-era, day-of-year, and month/day via the standard integer formulas, returning (year, month, day).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_human_file_in_the_assessment_survives_a_save` — QUIRKY
- spec 3 · read at `2915f57ce914` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:27Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up a `.sanity/` directory containing both a human-authored `.md` note and a generated shard file, runs the save/sweep logic, and asserts the human file survives while an old/stale shard gets removed — verifying the sweep only deletes files derived from the outgoing index rather than anything it didn't write.
- found: Scans a tiny temp repo, saves the assessment once, then writes a human note (NOTES.md) and an orphan shard-looking file (gone.md) directly into the `.sanity` dir, saves again, and asserts BOTH files survive — not just the human one. The sweep only removes files that were linked by an index it itself wrote, so an untracked file (human or not) is left alone; it never distinguishes 'human' from 'shard' by content, only by provenance in its own index.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The name and docs imply the test distinguishes human notes from stale shards, but the actual assertion is that both survive equally — provenance (linked-by-our-index or not) is the only criterion, not content type.

### `report`
- spec 2 · read at `32cbdf97d4e6` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small test-helper constructor that builds a Report struct with the given id and note, filling all other required fields (predicted, documented, legible, trap, etc.) with plausible default/placeholder values, used by the round-trip tests listed as peers.
- found: Test-helper constructor building a Report with fixed placeholder values for every field (expected/found/predicted/documented/etc.) and the given id/note, filling the rest via Report::blank() default, used across the round-trip tests.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `round_trips`
- spec 2 · read at `e0c283a4dc23` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:55Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a Report/reading with a fairly complete set of fields (grades, position, spec, agent, model, timestamp, etc.), renders it out to the markdown assessment format, parses it back in, and asserts the parsed result equals the original — verifying the markdown store is a lossless round trip, not just a display rendering.
- found: Builds a report, renders it to markdown via render_entry/render_shard, re-parses via parse_shard, and asserts every field survives — including secondary/second-axis fields (legible, trap, predicted, documented, position) that the comment says were previously silently dropped by an out-of-sync schema copy.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Comment reveals this test exists because four fields were once silently lost in the store despite being declared in the schema and held by Report.

### `a_reading_without_a_position_does_not_claim_to_be_the_first`
- spec 2 · read at `5acab90a066a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:08Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Markdown/JSON reading record lacking a `position` field (simulating data written before that field existed), parses it back through the assessment loader, and asserts the resulting position is None/unknown rather than defaulting to Some(1).
- found: Builds a markdown shard string for a reading that omits the `predicted at position N` style marker, runs it through `parse_shard` into a HashMap, and asserts the parsed record's `position` field is `None` rather than defaulting to 1.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_reading_without_a_spec_does_not_claim_todays_question`
- spec 2 · read at `7697285ad73e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test that constructs a Reading with no spec set, round-trips it through the markdown-based assessment store (save then parse back), and asserts the spec field is still None/absent after reload rather than being defaulted to a current SPEC constant — guarding against code that would make old unspecced readings silently appear to answer today's question.
- found: Parses a markdown shard whose reading bullet omits a spec line, then asserts the resulting Reading has spec==0 (default) and that its legible grade (Full) is preserved as data, but legible_current(spec) returns false — i.e. the grade is kept but not counted as answering the current spec's question.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `each_axis_expires_on_its_own_spec`
- spec 3 · read at `fe4a3f53842f` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:50:11Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a Report stamped at spec 2, then asserts legible_current returns true (not yet expired) while trap_current returns false (expired, since trap moved at spec 3) — proving the two axes expire independently rather than sharing one combined 'dated' flag.
- found: Asserts legible_current(2) is true and trap_current(2) is false (confirming the two axes expire on different spec boundaries), plus boundary checks: trap_current(TRAP_SINCE) is true, trap_current(SPEC+99) is true (future builds still trusted), and trap_current(0) is false (unversioned counts as unknown, not current).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_reading_from_a_newer_build_is_still_trusted` — QUIRKY
- spec 2 · read at `c47a941b7865` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:37Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A unit test that constructs a fake report/reading whose `spec` field is set higher than the current build's `SPEC` constant, then asserts that the code path deciding whether to trust/count that reading (probably a `>=` comparison against SPEC) treats it as valid/current rather than stale, likely alongside or contrasted with an older-spec case being rejected.
- found: Tests legible_current() directly against LEGIBLE_SINCE, SPEC+99, LEGIBLE_SINCE-1, and 0 — confirming the >= trust semantics I predicted, but via a specific named helper/constant rather than a constructed fake report, and it's the 'legible' spec-question, not a generic reading.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `a_spec_round_trips_as_provenance`
- spec 2 · read at `18eccc66febd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:37Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A unit test that constructs a Report with a spec value set, renders it to the markdown store format and parses it back, then asserts the spec field round-trips correctly and that it appears on the provenance line (alongside read-at/by) in the rendered markdown rather than being folded into the grades line.
- found: Parses a hand-written markdown shard containing a `spec 7` provenance line into a Report via parse_shard, asserts the parsed spec field is 7 and legible_current(spec) holds, then re-renders the entry and asserts the rendered text still contains \"- spec 7 · read at\" on the provenance line.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Assumed the test builds a Report programmatically then serializes it; actually it goes the other direction — parses hand-written markdown text in, then renders back out.

### `priming_round_trips_and_is_silent_when_there_is_nothing_to_say`
- spec 2 · read at `7b841a044285` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:20Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds a report/reading with the (repo_had_instructions, reader_was_primed) pair set, serializes to the markdown store format and parses it back, asserting both values survive the round trip. Also asserts that when repo_had_instructions is false, no priming segment/line appears in the rendered markdown at all.
- found: Parses markdown shard text containing "priming: CLAUDE.md in context" and "priming: CLAUDE.md, AGENTS.md excluded" lines into Report structs, checking `primed` bool and `agent_docs` string (comma list survives despite internal comma) round-trip correctly, that render_entry reproduces the same priming text, and that a Report with primed=true but no agent_docs set renders no priming segment at all — primed alone isn't sufficient to print one.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `the_asked_for_model_round_trips_and_is_silent_when_it_agrees` — QUIRKY
- spec 2 · read at `3340b4abc7e7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:16:19Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test with two cases: (1) a report where the model used matches the model asked for — serialize to markdown, parse it back, assert the asked-for model round-trips correctly but the rendered markdown text does NOT contain a separate visible "asked for X" annotation since they agree; (2) a report where they differ — assert the markdown DOES show the mismatch and both fields still round-trip through save/load.
- found: Three cases, not two: (1) parses a markdown shard line with "read by haiku · asked for sonnet" and checks the parsed Report's model/asked fields and that render_entry reproduces "asked for sonnet"; (2) a Report built directly where model==asked shows no "asked for" text since agreement is silent; (3) a hand-driven Report with no `asked` at all must show neither "asked for" nor "via " — an unasked reading must not grow a phantom claim.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Missed that it parses from markdown text via parse_shard rather than a full save/load cycle, and missed the third no-asked case entirely.

### `a_reading_says_when_it_was_taken` — QUIRKY
- spec 2 · read at `51ff8e76f83d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a Reading with a specific `when` date (likely including a leap-day or year-boundary date like 2024-02-29 or Dec 31), writes/serializes it and reads it back through the round-trip machinery (civil_from_days / days_from_civil conversion), then asserts the parsed date exactly equals the original to catch off-by-one errors in the civil date arithmetic.
- found: Tests iso_of() timestamp-to-ISO-string conversion at epoch, a 2026 timestamp, a leap-day (2024-02-29) timestamp, and the last second of 2025, plus that string comparison of iso_of outputs preserves instant ordering. Then separately tests that parse_shard correctly extracts the `when` field from a markdown-formatted reading entry into a Report struct, that render_entry round-trips it back into text, and that readings predating the `when` field (blank/old Report) render without any "when " text at all rather than defaulting to the epoch.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Docs focus entirely on the leap/year-boundary motivation for iso_of, but the test body is really two tests in one: iso_of correctness, and a separate parse_shard/render_entry round-trip plus an undated-reading-omits-when case that the docs don't mention at all.

### `the_agent_that_read_round_trips`
- spec 2 · read at `4f73f29cea1a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test creates a Reading with an agent field set (a harness/model identifier), round-trips it through save/parse of the markdown assessment store, and asserts the agent value survives intact — guarding the banked_harness preselection feature from silently regressing to None.
- found: Parses a shard line with both a model ("claude-sonnet-4.6") and a harness ("via agy"), asserts both are captured separately on the Reading (model vs harness fields), and asserts the rendered entry includes "via agy" — establishing that the agent identity is a (model, harness) pair, neither half sufficient alone.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `an_unknown_segment_costs_that_segment_and_nothing_else`
- spec 2 · read at `04f6b100758f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:16Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a shard/bullet string containing a made-up, unrecognized segment prefix mixed in with normal recognized ones, runs it through parse_shard, and asserts the recognized fields still parse correctly while the unknown segment is silently dropped rather than causing the whole entry or shard to fail.
- found: Unit test: parses a shard bullet block containing two unrecognized segments (`confidence high` on the header line, `vibes: good` on the grade line) mixed with recognized fields, and asserts the recognized fields (body/hash, by, legible, spec) still parsed correctly from the resulting map, proving unknown segments are dropped in isolation without breaking the rest of the entry.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_shard_counts_grades_that_answer_an_older_question`
- spec 3 · read at `300d51c385f6` · commit `9f5abcc` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T22:48:04Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A Rust test verifying that a shard's summary counts, per grading axis (e.g. legibility), how many past readings were taken under an older question/spec and are now stale — while carefully NOT counting readings that simply never graded that axis (ungraded, not "expired") as stale. It likely builds a couple of synthetic readings with different spec hashes/versions and asserts the resulting count matches expectations.
- found: Builds three synthetic readings (old-spec graded, current-spec graded, ungraded) and asserts the shard's `dated` count is 1 — only the pre-spec grade counts, not the never-graded one — and that the rendered shard text mentions '1 of these answered an earlier version of a question'. Then extends the test to show any graded axis (not just `legible`) contributes to `dated` by adding a `trap` grade under an older spec version to the previously-ungraded reading, bumping dated to 2, and finally checks a clean shard's render says nothing about an 'earlier question'.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Reveals cross-file coupling: SPEC/LEGIBLE_SINCE/TRAP_SINCE constants track per-axis spec versions, and compile()/render_shard() must aggregate staleness across all graded axes, not just one.

### `key_ignores_line_numbers`
- spec 2 · read at `efd0813c8a57` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:41Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A short test that constructs a key for the same function twice, with different line numbers, and asserts the resulting keys are equal — confirming the key format is `path#name` and does not embed the line number, so a reading survives code shifting above the function.
- found: Builds two scans of the same function "foo" at different line numbers (12 vs 480) via scan_of, then asserts live_funcs() produces the same set of keys for both, confirming the key doesn't depend on line number.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `same_named_functions_in_one_file_stay_apart`
- spec 3 · read at `2e4ed770ddb4` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:07Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A regression test for the bug described in its doc: two same-named functions (e.g. two `init`s) in one file used to hash/key to the same string, so the second's report overwrote the first's. It builds two Node/function entries sharing a name and owner-less context in one file, computes their `key`, and asserts the two keys differ — and probably also that storing a report under each keeps both instead of one clobbering the other.
- found: Builds a scan with two same-named `init` functions plus one differently-named function in one file, asserts all three survive keying (none lost to collision) with the second same-named one getting a disambiguating `#2` ordinal suffix on its key, checks each twin's body hash is kept separate, then round-trips reports for all three through save/load to a temp dir and asserts none come back stale.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_file_reading_round_trips_beside_its_functions`
- spec 3 · read at `1467d0fd745b` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:10Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a Report for a file (keyed by bare path) and a Report for a function inside that same file (keyed by path#name@line), writes them both into a shard/store, reloads it, and asserts both come back correctly and distinctly — the file's reading is not mistaken for or merged with a function's, and its title reads as prose rather than a function-like name.
- found: Scans a fake file with two functions, builds reports for both functions plus the file itself, saves to a temp shard directory, checks the raw shard text titles the file entry in prose (`### {FILE_ENTRY}`) distinct from a function's backtick-name heading, then reloads and asserts all three come back keyed correctly with the file's reading not stale.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `hash_ignores_formatting`
- spec 2 · read at `c5649fd3947c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This test likely hashes two versions of the same function body that differ only in whitespace/formatting (e.g. reformatted with different indentation, spacing, or line breaks) and asserts the two resulting hashes are equal — proving that a pure reformat doesn't change the hash used to key a cached reading, so it doesn't expire.
- found: Asserts body_hash of the same code with different indentation is equal, and body_hash of genuinely different code (go() vs stop()) is not equal — confirming the hash normalizes whitespace but is sensitive to real content changes.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_reading_expires_when_its_documentation_changes`
- spec 2 · read at `4d1404b407ff` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:57Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test verifying that the staleness/hash key used to validate cached readings includes the doc comment text, not just the function body — so changing a doc comment (with the body unchanged) causes a previously-recorded reading to be treated as stale/expired. It likely constructs a reading against one doc string, then re-checks staleness against the same body but a different doc string, and asserts the reading no longer matches (is considered stale).
- found: Tests reading_hash(spec, doc, body): asserts different doc text on the same body produces different hashes, that adding a doc where there was none also changes the hash, but that whitespace-reflowed doc text (same words, different line breaks) produces the SAME hash — so only substantive doc changes expire a reading, not cosmetic rewrapping.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Correctly predicted the doc-changes-invalidate-hash mechanism but missed the specific reflow-insensitivity case, which is the more interesting/subtle assertion in the test.

### `a_reading_expires_when_its_module_header_changes`
- spec 2 · read at `d7599e3f1463` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:20Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a task/function with a given module doc (file_doc), computes its content hash/key, then rebuilds the same function but with a changed module banner, computes the hash again, and asserts the two hashes differ — proving that a stored reading is treated as stale when the file's doc comment changes, since the module doc is folded into the hash.
- found: Uses reading_hash(file_doc, fn_doc, body) directly (no full task struct) and checks three things: changing the module doc changes the hash, gaining a module doc from None changes the hash, and swapping which doc holds which sentence (module vs function) also changes the hash — showing the two doc slots aren't just concatenated.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the None-header and doc-slot-ordering assertions in my prediction.

### `stale_when_the_body_moves`
- spec 3 · read at `74af80340fd9` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:59:33Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A short unit test that writes an assessment entry for a function keyed with a body hash, then simulates the function's body changing (different hash), and asserts that looking up/reading that entry back reports it as stale — because the code moved out from under the recorded reading.
- found: Tests `is_stale` against a report's recorded body hash: matching hash is not stale, a different hash is stale, and — the part I missed — a migrated report with an empty/unset hash is trusted (not stale) regardless of the current hash, since there's nothing to compare against.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The third assertion (empty-hash reports are exempt from staleness) is the interesting edge case and isn't guessable from the function name alone.

### `a_large_body_read_without_paging_is_expired`
- spec 3 · read at `9e6f7e0b1624` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:01:00Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a body/source larger than PART_BYTES and a Report whose stored body hash matches it correctly but whose `paged` field is None (i.e. nothing recording that it was served across sanity_reveal parts), then asserts is_stale returns true for it despite the hash matching — because a body that size could only have been read correctly if it came back paged, so an unpaged reading of it is untrustworthy regardless of hash. Probably also checks that the same report WITH `paged` set to the correct part count is NOT stale.
- found: is_stale takes the report, a matching body hash, and a separate current-extent-in-bytes option. With the hash matching throughout: a small extent is fine either way; a large extent (>PART_BYTES) with no `paged` record on the report is stale; the same report with `paged: Some(4)` set is not stale; and an unknown extent (None, e.g. a cache predating the field) is deliberately NOT treated as stale, since failing an entire corpus over a missing field would be the worse of the two wrong defaults.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I mispredicted the signature — the 'large body' isn't the literal source text but a separate numeric extent argument compared against PART_BYTES, decoupled from the hash check.

### `survives_a_mangled_entry`
- spec 2 · read at `e86d2cfa71aa` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:42Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds a markdown assessment blob containing one deliberately corrupted/malformed entry alongside one or more well-formed entries, parses it with the module's parser, and asserts that the well-formed entries still come back correctly while the mangled one is simply dropped/skipped rather than causing the whole parse to fail or panic.
- found: Test builds markdown text for one file with two function entries — "broken" has no reading bullet lines and "intact" has a full valid reading — calls parse_shard, and asserts the broken entry is entirely dropped from the output map while the intact one survives with correctly parsed fields (predicted grade, derivable flag).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `scan_of` — QUIRKY
- spec 3 · read at `68d8679266b2` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:41Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture builder that takes an array of (path, name, ord, src) tuples, computes each function's identity via key_of(path, name, ord), hashes the source text (normalized per hash_ignores_formatting), and inserts entries into a map to construct a Scan struct, used by tests to build synthetic scans without the real scanner.
- found: Builds a full synthetic Node tree (dir root -> file nodes -> func nodes) from (path, name, line, body) tuples, auto-incrementing an ordinal per (path, name) pair to compute key_of, hashing bodies via body_hash, synthesizing a file-level body hash from a fake header string, and wrapping it all in a Scan with a stub ScanStats (model "test", zero counts).
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `a_stale_index_is_rewritten_on_open_and_an_absent_one_is_not_created`
- spec 2 · read at `81d89007d616` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:23:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test that: (1) when a stale/outdated index file exists in .sanity/, opening the assessment rewrites/updates it to the current format without requiring a new reading; (2) when no index file exists at all, opening does not create one.
- found: Test with a three-way Index enum (Absent/Current/Refreshed) checked via refresh(): confirms opening a repo with no assessment yet creates nothing on disk (Absent), a freshly-saved index needs no rewrite (Current, and importantly no rewrite of identical bytes to avoid dirtying checkouts), a stale index (old README copy text) gets rewritten (Refreshed) with updated content, and that refresh's rewritten output is byte-identical to what save() produces directly, to prevent the two paths from fighting over the file.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: I got the general shape right but missed the specific three-state Index enum (Absent/Current/Refreshed) and the important 'no rewrite of identical bytes' and 'refresh output byte-identical to save output' invariants, which are the real point of the test.

### `writes_and_reloads_a_repo_assessment` — QUIRKY — TANGLED
- spec 3 · read at `f9119e0a5992` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:00:22Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a temp repo with a function, records a reading/report for it, writes the assessment out to .sanity/ via the write path, then edits the source file to insert lines before the function (so its line number shifts down), rescans, and reloads the assessment — asserting the reading is still matched to that function via its stable key rather than its now-moved line number, proving the store survives code moving beneath it.
- found: Saves reports for two functions in two different top-level dirs, checks the assessment shards per top-level dir (.sanity/src-tauri.md, web.md) with a README index pointing to the app, then reloads against a rescanned version where both functions moved down and one function's body also changed — asserting both readings are found by stable key, the unchanged-body one is still fresh, and the changed-body one is marked stale.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no
- note: Missed the sharding-by-top-level-dir and README-index assertions entirely, and missed that the test deliberately distinguishes staleness-by-body-change from mere line-movement rather than just testing the move survives.

### `shards_by_top_level_dir`
- spec 2 · read at `6b812ed1b7d8` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: This is a short test verifying that .sanity/ shard files are partitioned by a path's top-level directory — e.g. two files both under src/ map to the same shard, while a file under a different top-level dir maps to a different shard. It calls a shard-naming/grouping helper directly on a couple of paths and asserts equal/unequal shard identifiers accordingly.
- found: Tests shard_of(path) returns the path's top-level directory name (e.g. \"src-tauri\" for a nested file), root-level files map to the literal \"root\", and shard_file(dirname) appends \".md\" to produce the shard's filename.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No docs were attached to this function at all (empty docs array), unlike every other function so far.

## src-tauri/src/bin/history.rs

### the file itself
- spec 2 · read at `855b2edad4c9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:09Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A CLI binary (`just history <path>`) that walks a git repo's commit history and replays it through the same function-tracking/walk logic the main app uses, then prints a headless summary: total commit count, final function count, and the largest "frames" (biggest changes) per commit. It's a diagnostic tool for catching walk bugs like renames misclassified as adds or functions landing in the wrong file, mirroring what `just scan` does for the metric side. Likely a single main() that parses a path argument, drives the walker/replay, and prints stats to stdout.
- found: A CLI main() parsing path/--limit/--files/--json/--cached flags, running history::read (or read_cached), then replaying the commit deltas (set/del) into a live function->loc map to compute totals, peak function count, and optionally per-file breakdown and the 8 busiest commits by files touched.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Got the overall shape (headless replay + summary stats) right but missed the specific flags (--files/--json/--cached/--limit) and the per-file reconciliation-with-scan detail.

### `main` — TANGLED
- spec 3 · read at `905f1f341977` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:28Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Parses a repo path argument from the command line, then runs the same commit-by-commit history walk/replay used by the app (probably calling into a shared walk/scan module) while accumulating stats. At the end it prints a summary: total commit count, final function count, and details of the biggest/most impactful frames (e.g. largest diffs or function count deltas), to let a developer sanity-check the walker after changes without opening the GUI.
- found: CLI entry point: parses PATH plus --limit/--files/--json/--cached/--help flags, runs history::read (or read_cached) with a throttled stderr progress ticker, then either dumps JSON or replays the commit deltas (set/del) to compute live function counts and peak, and prints a summary (commit count, file/function counts, optional per-file breakdown, and the 8 busiest commits by change size).
- predicted: most · documented: most · derivable: no · legible: some · trap: no

## src-tauri/src/bin/sample.rs

### the file itself
- spec 2 · read at `cf7c3dc1db75` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small standalone Rust binary (`just sample <repo> <out> [n]`) that reuses this project's own candidate-extraction logic to pull N functions out of a target repo, then serializes them (JSON, matching the sanity_next handout shape) to a file on disk — bypassing the normal lease/report/.sanity/ bookkeeping since it's meant for feeding the same batch to multiple readers for inter-rater comparison rather than doing a real single-reader assessment. Likely just a `main()` that parses argv, calls into a shared module for extraction, and writes output.
- found: A main() that scans a repo with the same scan/agentapi machinery as the live tool (using ephemeral memos so nothing is banked), takes every stride-th task (fixed stride sampling, not random, for reproducibility) up to N, slices out each function's source by its recorded line range, and writes two files per exercise (NN_head.md with name/owner/signature/docs/peers, NN_body.txt with the raw body) to an output directory — plus a summary line to stdout.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted JSON output and reuse of the sanity_next handout format, but it actually writes paired markdown/txt files per exercise and samples by fixed stride rather than randomness — both details I got wrong.

### `main`
- spec 3 · read at `cf6b856a2537` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:38Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Parses CLI args (repo path, output path, optional n count), scans/extracts candidate functions from the repo (reusing shared extraction logic), randomly samples N of them, and writes them as JSON to the output file, bypassing the leasing/reporting/.sanity state used by the main tool.
- found: Parses repo/out/n args, runs the shared scan::scan over the repo with ephemeral memos and Ordering fidelity to get all_tasks, then strides evenly through the task list to pick ~n of them spread across the whole set (not random sampling), slices each function's body directly from the file by line range, and writes a paired NN_head.md (name/owner/signature/docs/peers) and NN_body.txt (source) per exercise to the output directory.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: I predicted random sampling but it actually uses even striding (len/want) through the task list, and re-slices bodies live from disk rather than from any stored snapshot.

## src-tauri/src/bin/scan.rs

### the file itself
- spec 3 · read at `2a8ca448e274` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:02:49Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: CLI binary `main` that takes a repo path, runs the same scan/score pipeline as the app (scan::scan) headlessly, and prints a human-readable report to help a developer sanity-check the surprise metric: a histogram of scores (histogram), wiring/call-graph stats (wiring), clone-detection stats (copies), a baseline sanity check comparing against some expected/prior distribution (baseline_check), and a ranked list of the hottest functions labeled by score quadrant (quadrant_label), with long names/docs truncated (truncate) and output organized into labeled sections (section) so the top surprises can be eyeballed against what the developer already knows about the repo.
- found: Headless CLI scorer matching the prediction closely: parses path/--local, runs scan::scan at full fidelity with ephemeral memos, prints headline stats (files/functions/lines/% hot), then a temperature histogram, wiring stats (call resolution %, orphans, caller-count bands, locality deciles), clone/copies group-size stats, a baseline_check that specifically tests metric-ranking-vs-raw-size-ranking overlap as a falsification test, and two ranked sections (hottest, bulkiest-predictable) formatted via section/quadrant_label/truncate.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: legible/trap are N/A for this file-level task; values are placeholders since the schema requires them.

### `main`
- spec 3 · read at `af07567e0776` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:11Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Parses a repo path from CLI args, runs the scanner over it computing surprise scores for every function, then prints a formatted report to stdout using the peer helpers — a histogram of scores, wiring/copies stats, a baseline_check sanity check, and per-function sections labeled by quadrant_label with names truncated — so a human can visually confirm the highest-surprise functions are the ones they'd expect.
- found: Parses PATH and --local WEIGHTS args (falling back to HeuristicModel unless built with local-model feature), runs a full-fidelity scan, collects all Func nodes, prints summary stats (files/functions/lines, % hot lines by temperature), then calls the peer helpers (histogram, wiring, copies, baseline_check) and finally two ranked sections (HOTTEST and BULKIEST PREDICTABLE) sorted by temperature×lines and Bloat-quadrant lines respectively.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: Missed the --local/local-model feature-gated model selection and the specific temperature×lines and Bloat-quadrant ranking formulas, but got the overall report structure right.

### `histogram`
- spec 2 · read at `4c74b4d20fb0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Buckets the surprise scores of funcs into fixed-width ranges (e.g. 0.0-0.1 ... 0.9-1.0), counts how many fall in each bucket, and prints an ASCII bar chart to stdout showing the distribution — evidence of whether the metric spreads scores out (long cold tail, thin hot end) or piles everything into one bucket.
- found: Buckets each node's temperature (0-1, missing score treated as 0.0) into 10 deciles, then prints a scaled unicode bar chart (relative to the peak bucket) with counts, labeled "TEMPERATURE SPREAD".
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `wiring` — QUIRKY
- spec 3 · read at `52ca8e68966b` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:29Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This CLI function computes and prints the three calibration numbers described in the docs — coverage, resolution, and unreferenced percentage — from the funcs slice and ScanStats, likely printing a warning if any falls below a usability threshold, and probably lists the top unreferenced functions as the actionable finding.
- found: Prints resolution/coverage/unreferenced percentages, then renders an ASCII bar-chart histogram of caller counts by band (0,1,2,3-5,6-15,16+), then computes per-function locality gap and renders a second ASCII bar-chart of its decile distribution — early-returning with a gray-lens message if no functions have caller data or none are wired.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The two ASCII histograms (caller-count bands and locality-gap deciles) are the bulk of the function and weren't guessable from the name/docs alone — they're what actually lets a human eyeball whether the distribution is a usable ramp or flat/saturated.

### `copies`
- spec 3 · read at `a20f08146b60` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Groups the given functions by a shape/similarity signature (likely a precomputed hash on Node), then prints a report of clone-group sizes as a distribution rather than a single count — e.g. listing groups sorted by size, so a human can see whether there's one large N-way clone group vs many small pairs. May also print example function names/locations for the largest groups to let a developer sanity check whether MIN_SHAPE_TOKENS is set correctly.
- found: Prints a "COPIES" report: percent of functions big enough to compare, percent that are clones, then buckets clone groups into size bands (2, 3-5, 6-15, 16+) with an ASCII bar histogram, and finally names the single biggest clone group's example member.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: I called the overall shape (group-size distribution + biggest-group example) but missed the concrete band buckets and ASCII bar rendering, plus the comparable/cloned percentage stats up front.

### `baseline_check`
- spec 3 · read at `7880792fd405` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:42Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Sorts the given functions by the real metric (temperature * lines) to get the top-K, then separately sorts the same slice by line count alone to get its own top-K, computes the overlap (set intersection size) between the two top-K lists, and prints that overlap count/percentage as a warning-style line — high overlap meaning the metric adds nothing beyond raw size.
- found: Guards on having at least 15 functions, then takes the top-15 IDs sorted by temperature*loc versus top-15 by loc alone, counts the overlap, and prints a tiered qualitative verdict (0-6/7-11/12-15 shared) about whether the metric is doing real work versus just recovering size.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `section`
- spec 3 · read at `a7cc9bd8f056` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Prints a section header using `title`, then sorts `funcs` in place by the `rank` closure (descending), and prints a short list of the top entries (name + rank value, maybe truncated to some fixed count) to stdout as part of the CLI scan report.
- found: Sorts funcs descending by rank score, prints a header, then for up to 15 entries with rank>0 prints a formatted row: temperature percentage, truncated name, LOC, quadrant label, and file:line location.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `quadrant_label`
- spec 2 · read at `db90c53d6314` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:42Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A simple match over the Quadrant enum variants (likely combining high/low surprise with documented/undocumented) returning human-readable static strings like "hot, undocumented" / "hot, documented" / "cold, undocumented" / "cold, documented" for use in the CLI's report/histogram output.
- found: A match over Quadrant returning static labels: CrownJewel -> "crown-jewel", Trouble -> "trouble", Bloat -> "bloat", Quiet -> "quiet".
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Got the mechanism (trivial enum-to-string match) right but guessed the wrong axis pairing — it's named/themed (crown-jewel/trouble/bloat/quiet) rather than a literal documented×surprise cross-product I imagined.

### `truncate`
- spec 2 · read at `93d56c49406a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:38Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Truncates a string to at most n characters, likely appending "…" or "..." if it was longer, used for printing headless-scan output like function names/paths without overflowing terminal width. Probably handles char boundaries safely rather than byte slicing.
- found: Truncates a string to n chars max, char-wise (not byte-wise) to avoid panicking on UTF-8 boundaries, appending "…" when truncated.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/bin/tokens.rs

### the file itself
- spec 2 · read at `f9ef6d6755a2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:48Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A standalone CLI binary (`just tokens <path>`) that measures and reports the token cost of some text/file — likely the MCP tool schema/prompt text — using a `tok` function to count tokens, `pct`/`row`/`big` as formatting helpers to print a breakdown or histogram table, and `main` to parse the path argument and drive the report. Its purpose is to make the per-reading token overhead (tool contracts, subagent prompt) visible and measurable rather than left to guesswork.
- found: CLI binary printing a token budget report: fixed per-reader prefix (MCP tool schemas + subagent prompt), the orchestrator-only protocol text, then scans a target repo to compute per-function payload/body size distributions (median/p90/max), and projects a whole-repo token total, including the savings from splitting reader vs orchestrator tool surfaces.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Doc explains the motivation (batching hid the fixed-prefix cost) in real depth I couldn't have predicted, but the functional shape matched my guess closely.

### `tok`
- spec 2 · read at `a3cf659559cc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:05Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a character count into an estimated token count using a simple fixed-ratio heuristic, most likely dividing by 4 (the common rough chars-per-token approximation for English text), rounded somehow — used to estimate the token cost of tool-schema descriptions and prompts without calling a real tokenizer.
- found: Simple integer division of chars by a CHARS_PER_TOKEN constant — a fixed-ratio heuristic tokenizer estimate, exactly as predicted (didn't confirm the constant is 4 but the mechanism is right).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `row`
- spec 2 · read at `37b1893f0661` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:08Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Prints one line of the token-cost report: given a label and a character count, converts chars to an estimated token count (via `tok`) and prints them formatted (likely using `big` to comma-format the number), e.g. "label: N chars (~M tokens)".
- found: Prints a formatted row with label, char count, and estimated token count via tok(chars), aligned columns.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `pct`
- spec 2 · read at `cf8ee2539f59` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:49Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the p-th percentile (p as a 0-1 fraction) of a pre-sorted slice by indexing at round(p * (len-1)) or similar, returning that element. Probably has a guard for an empty slice returning 0.
- found: Empty-slice guard returns 0; otherwise indexes at round((len-1) * p) into the sorted slice.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `big`
- spec 2 · read at `607385e1263f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:15Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Formats large counts into a compact human string — checks thresholds (>=1_000_000 → divide by 1e6, one decimal, "M" suffix; >=1_000 → divide by 1e3, "K" suffix; else just the plain number as a string), likely using format!("{:.1}M", ...).
- found: Match on thresholds: >=1M formats as one-decimal millions with 'M', >=1000 as one-decimal thousands with lowercase 'k', else the plain integer string.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main`
- spec 3 · read at `7b58aa87da0b` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Parses a CLI path argument, computes token counts (via `tok`) for the fixed protocol prefix (tool schemas/subagent prompt) plus per-function reading costs, and prints a formatted report/table using `row`/`pct`/`big` helpers — showing how many tokens each reading costs, what fraction is fixed overhead vs per-function content, and likely a breakdown/histogram across the repo's functions.
- found: Measures the token budget of the sanity reading protocol: prints the fixed per-reader prefix (reader tool surface + subagent prompt), separately reports the orchestrator-only protocol size and how many chars are kept out of a reader's context by the role split, then scans the given path for real functions and computes size distributions (median/p90/max) of task JSON/peers/docs/signature/body-lines, and finally projects a whole-repo token total (fixed prefix × N functions + payloads + estimated bodies) with percentages, plus the tokens saved by not shipping orchestrator tools to every reader.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The peer list (tok/row/pct/big) gives no hint of the reader-vs-orchestrator tool split or the live repo scan — those are only discoverable by reading the body.

## src-tauri/src/blame.rs

### the file itself
- spec 3 · served in 3 parts · read at `fb53fd5119d4` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:35Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Runs `git blame --porcelain` per file to get per-line author/commit/timestamp data, so Churn/Age/Blame color lenses can vary within a file down to the function/line level instead of being flat per-file as in churn.rs. Provides a Blame store (get/absorb/read/len) with range lookups that follow lines across renames and clamp out-of-range requests, plus a Slots concurrency limiter that fairly caps how many blame subprocesses run at once across active projects, guaranteeing every active project a slot and letting waiting projects compete fairly for freed ones.
- found: Per-line git blame for the map's Churn/Age/Blame lenses: parses `git blame --line-porcelain` into a compact per-line Line/FileBlame store (Blame::read/get/absorb/len), with a fair Slots concurrency limiter across projects (floor-guaranteed allowance, waiter-aware). Also provides a separate on-demand panel subsystem (range_detail, line_history, fold_line_log, fold_porcelain, Touch/Contributor/RangeDetail/LineHistory/Origin) that runs `git log -L` plus blame together to show a function's full commit history (not just surviving lines) with renames, uncommitted-line handling, and dirty-worktree detection — a much larger surface than just coloring wedges.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `range`
- spec 2 · read at `748ef27fe388` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:15Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Looks at the blame data for lines start..=end (1-indexed inclusive, with end clamped to the actual number of blame lines available so a stale function end doesn't return nothing), and reduces those per-line commit records into a RangeHistory with four fields — likely last author, last-touched timestamp (most recent commit among those lines), a "born"/earliest timestamp, and a churn/commit count — computed relative to now. Returns None if the range is empty (e.g. start beyond available lines).
- found: Clamps start/end into the blame lines slice (1-indexed, end clamped to len), returns None if empty. Walks the slice collecting a HashSet of distinct commit ids (churn), the newest line (for last_touched_days/last_author) and oldest time (age_days, noted as a lower bound since blame reports last-touch per line not creation). Converts times to days-ago via `now`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `get`
- spec 2 · read at `5632b94cd15f` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Looks up and returns a reference to the FileBlame for the given path from an internal map/collection on Blame, returning None if the path hasn't been blamed.
- found: Looks up the FileBlame for a path in the `files` map, returning Option<&FileBlame>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `absorb`
- spec 3 · read at `95ca6ed83f75` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:34:26Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: absorb takes ownership of other: Blame and merges its per-file blame results into self — since blame is computed independently per file, this is a union/extend of other's file map into self's, likely also carrying over other.now's timestamp into self if self.now hasn't been set by a real pass yet.
- found: Sets self.now from other.now only if self.now is still zero (unset), then extends self.files with other.files — a plain union since each file's blame is independently complete.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `len`
- spec 3 · read at `e297ea2e22dd` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:18Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Trivial accessor on Blame returning the number of entries in its internal map, likely self.files.len() or similar, counting how many files have per-line history stored.
- found: Returns self.files.len(), the count of files with per-line history stored.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `is_empty`
- spec 3 · read at `153604a81602` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:36Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Standard is_empty/len idiom: returns self.len() == 0, delegating to the Blame::len peer method.
- found: Returns self.files.is_empty(), checking the internal files map/collection directly rather than routing through len().
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `read`
- spec 3 · read at `ba161613f04e` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:20Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Parallelizes (likely via rayon) over the given file paths, checking `cache` for already-current per-file blame data before invoking blame_file/git blame on each stale file, calling done(path) as each file starts for progress reporting, respecting `stop` for early cancellation, and silently swallowing per-file failures (untracked/symlink/non-git) by omitting those files rather than propagating an error — assembling results into a Blame collection.
- found: Runs a parallel iterator over paths (rayon), calling done(path) on each before processing; for each file checks cache.cached_blame keyed on (content hash, last commit) and returns cached result without acquiring a slot; otherwise acquires a rationed slot via slots::shared().acquire, runs blame_file, and stores the result in cache. The whole pass runs inside a freshly built private rayon thread pool (sized to at least the shared pool's thread count) so that one large repo's blame pass cannot starve a second repo's tasks from ever being scheduled; falls back to running on the default pool if building a private one fails. Returns a Blame struct wrapping the collected per-file results and the current unix timestamp.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `contenders`
- spec 3 · read at `d3d9904921bb` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:00:58Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Counts distinct other projects with a claim on the shared pool: iterates the state's holders map and its waiters collection, unions the project keys from both (excluding `key` itself), and returns the size of that set.
- found: Builds a HashSet of project keys with positive counts in either state.holding or state.waiting, then counts entries in that set excluding the given key.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `allowance` — QUIRKY
- spec 3 · read at `5142288830e5` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:31Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Divides total by (others + 1) to give each contending project a fair share of the pool, using max(1, ...) or similar so the result is never zero even when others >= total, avoiding a deadlock where a project can never acquire a slot.
- found: Returns total minus others (saturating at 0), clamped to a minimum of 1 — reserving one slot per other contending project rather than dividing the pool evenly.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `admits`
- spec 3 · read at `b91198c0680c` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:34Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A short pure function: computes a fairness floor via allowance(total, others) and returns inflight < total && mine < allowance(total, others) — admits a new slot only if there's global capacity left and this key hasn't exceeded its fair share, so it can't starve a waiting project.
- found: Returns inflight < total && mine < allowance(total, others), exactly as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `new` — QUIRKY
- spec 3 · read at `3f8351d1c4a7` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:34Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Slots struct with `total` capacity, initializing internal bookkeeping (e.g. a map/set tracking active projects and how many slots each holds, plus an empty waiting queue) all empty/zeroed, ready for acquire/release calls to populate.
- found: Constructs a Slots with a Mutex-wrapped default State, a Condvar for waking waiters when slots free up, and total clamped to at least 1 so a zero-concurrency config can't deadlock everything.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the concurrency primitives (Mutex/Condvar) entirely and the total.max(1) floor, which are the only two non-trivial things this constructor does.

### `acquire`
- spec 3 · read at `4be626e6c476` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:01Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Registers `key` in a shared map/counter of in-flight work, then blocks (loop or condvar wait) until an `admits`/`allowance` check says this key is allowed to proceed given current `contenders`, then returns a `Slot` guard whose Drop impl releases it — a per-key concurrency limiter capping simultaneous git-blame work per file.
- found: Locks shared state (ignoring mutex poisoning intentionally), increments a `waiting` counter for the key, then loops: computes total inflight, contenders for other keys, and this key's own held count, and checks an `admits` fairness function against `self.total`. If admitted, moves the key from waiting to holding and returns a `Slot` guard; otherwise waits on a condvar (`self.freed`) until notified.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `waiting_for`
- spec 3 · read at `7d8043b648e6` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:22Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Locks self.state and returns st.waiting.get(key).copied().unwrap_or(0) — a simple read accessor exposing the waiting count for a key, used by tests to poll until a waiter registers.
- found: Locks state and returns the waiting count for `key`, defaulting to 0 if absent.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `release`
- spec 3 · read at `a54ae54d70a9` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:00:23Z · by ross@rossturk.com · warm reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Decrements the holding count for key under the mutex, removing the entry entirely when it hits zero, then calls notify_all on the condvar to wake every waiter rather than just one, since a freed slot may only be legal for a specific waiting project.
- found: Exactly as predicted: decrements holding[key] or removes it at zero, under the lock, then notify_all (not notify_one) because a freed slot may only be legal for a specific other waiter.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: I had already read this file's full body in item 7 of this run, so this is a warm reading despite predicting correctly.

### `drop`
- spec 3 · read at `71eb3354f63f` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:34Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Calls self.slots.release(self.key) (or similar) to return the held slot back to the pool it borrowed from when the Slot guard goes out of scope.
- found: Calls self.slots.release(&self.key) to return the slot to the pool when the guard is dropped.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `shared`
- spec 3 · read at `530fc93c47c5` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Lazily initializes and returns a reference to a static Slots singleton, likely using OnceLock::get_or_init, with the pool size set to the number of available CPU cores (or similar concurrency measure) so a single repo's blame pass gets the same resources it would have had before this pooling mechanism was introduced.
- found: Lazily initializes a static OnceLock<Slots> singleton, sized to rayon::current_num_threads().max(2), and returns a reference to it.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `range_detail`
- spec 3 · read at `9b312fbe90de` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Runs its own `git blame` process directly against the repo/path bounded to [start, end] via `-L`, rather than reading the cached FileBlame. If end==0, it omits the -L bound (or passes start,+0 differently) to blame the whole file in one command. Parses the porcelain output (likely via parse_porcelain/fold_porcelain) into a RangeDetail struct containing per-line sha, author name, and timestamp; returns None if git fails or the path isn't found.
- found: Runs git blame --line-porcelain directly via Command, adding -L start,end only when end>0 (clamping start to at least 1 and end to at least start), then pipes stdout through fold_porcelain to build the RangeDetail. Returns None on process failure.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `line_history` — QUIRKY
- spec 3 · read at `371298c8e189` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:56:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Runs `git log -L start,end:path` (following renames) and folds each commit touching that line range into a LineHistory capturing churn count, age (first/last commit times), and author(s) for that specific range, likely via fold_line_log. Returns None if the git command fails or the path is untracked. Also records how the far end of the walk terminated (rename vs creation vs still-open).
- found: Runs four git subprocesses concurrently via thread::scope: range_detail (blame for the range), a `git log -L` walk (skipped if start/end aren't both >0), the file's full commit log (for first-commit time), and a dirty check (`git diff --quiet`). It folds the -L walk into changes/origin via fold_line_log, then overwrites each change's line count with the authoritative count from the blame detail (joined by commit sha), inserts an 'uncommitted' entry at the top if present, and extracts the file's first commit time from the oldest line of its log.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Missed the concurrency design (4 parallel git processes) and the sha-based join reconciling walk vs blame line counts — the docs' framing (churn.rs being file-keyed) didn't hint at this function's actual internal structure.

### `fold_line_log`
- spec 3 · read at `1c9a9151c280` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:56:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Splits the `git log -L` text output on a sentinel marker into per-commit stanzas, parsing each into a `Touch` (sha, author, timestamp, path) — reading the path from the `+++` side of the diff header rather than `---`, since the oldest/creating commit has `/dev/null` on the a-side. Returns the list of Touches plus an `Origin` derived only from the oldest stanza (e.g. whether the walk ended at file creation or at a rename), since only that stanza reveals information the commit dates alone don't.
- found: Splits `git log -L` text on a `\u{1}` sentinel byte into per-commit headers (sha/author/timestamp/summary, null-separated), and for each stanza's diff body checks for `--- /dev/null` to flag `created`, and records `+++ b/<path>` as the commit's `path` only when it differs from the current path (a rename). Since stanzas are walked oldest-last... actually oldest is the LAST parsed, so `created`'s final value (from the last stanza processed) becomes the returned Origin::Created vs Origin::Added.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Origin is just a binary Created/Added flag read off the last-processed (oldest) stanza's `--- /dev/null` line, not a richer rename-vs-creation distinction as I guessed; rename info is carried separately per-Touch via `last.path`.

### `fold_porcelain`
- spec 3 · read at `bdddaaf6ecfc` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:07Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Iterates the porcelain text line by line, tracking the current commit sha from the `<sha> <orig> <final>` header lines. On a commit's first appearance it records its author and summary/time into a map keyed by sha (since later repeats omit those fields); it also tallies a per-sha line count as it walks. It skips over the actual content line (prefixed by a tab) and, for an uncommitted line, names it (e.g. "Not Committed Yet") rather than a sha. At the end it folds the per-sha counts/metadata into a RangeDetail aggregating totals per commit and per author.
- found: Parses porcelain lines into a HashMap<sha,Meta> (author/time/summary/filename/lines) in insertion order, counting only tab-prefixed content lines, naming all-zero shas "uncommitted", truncating real shas to 8 chars, attaching a path only when it differs from the queried path, then aggregates into sorted `touches` (by time desc) and `authors` (by lines desc, name tiebreak) inside a RangeDetail.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `blame_file`
- spec 2 · read at `cccd80c43f49` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:49Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Runs `git blame --line-porcelain` (or similar) on `path` within `repo`, captures stdout, and passes it to `parse_porcelain` to build a `FileBlame` per-line author/time record, returning None if the git command fails.
- found: Runs `git -C repo blame --line-porcelain -- path`, returns None on command failure or non-success exit, otherwise parses stdout with parse_porcelain into a FileBlame. Matches my prediction closely.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `parse_porcelain`
- spec 3 · read at `9af37f5e7799` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates lines of the porcelain output, maintaining current sha/author/author-time as it parses header and key-value lines (author, author-time), and when it reaches a line starting with a tab (the actual source line) it commits an entry keyed by the final line number parsed from the header record into a per-line vector inside FileBlame, growing/indexing that vector by final line number rather than by output order.
- found: Streams porcelain lines, tracking a current commit (sha truncated/parsed as u64), interned author index (via a HashMap<String,u16> + Vec<String> to dedupe author names), and author-time; on the tab-prefixed source-line record it resizes/writes into a `lines` Vec indexed by final line number minus one, then returns a FileBlame{lines, authors}.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Author names are interned to u16 indices and commit shas truncated to a u64 via hex parse — compact representation not obvious from the signature/docs.

### `fixture`
- spec 3 · read at `a8d04b789c3c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Constructs a minimal FileBlame with exactly one line entry, using the given author name and some placeholder sha/timestamp, so other modules' tests (like scancache's) can create a FileBlame value without access to its private fields.
- found: Matches prediction closely: builds a FileBlame with a single Line (commit=1, author index 0, time 0) and an authors list containing just the given name.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `the_last_free_slot_belongs_to_whoever_is_waiting`
- spec 3 · read at `06fc71277b0c` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:00:34Z · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Asserts admits() behavior at the exact boundary: alone with the pool full (4 total, 3 held, 3 mine, 0 others) it may take the last slot; with one other contender (holding or waiting) it must not; below its allowance it proceeds normally; and a genuinely full pool refuses regardless of anyone's cap.
- found: Exactly as predicted: four admits() assertions pinning the boundary case — alone may take the last slot, one contender blocks it, below-allowance still admits, and a genuinely full pool always refuses.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Also a warm reading — this exact test body was already visible in item 7's full-file read.

### `a_project_waiting_with_nothing_in_hand_is_still_a_contender`
- spec 3 · read at `69f62783bf30` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:22Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a State where a project has a positive entry in `waiting` but zero/nothing in `holding`, then calls contenders() with a different key and asserts the count includes that waiting project — demonstrating that a project holding no slots but waiting still counts as a contender.
- found: Builds a State with one holder, confirms zero contenders; adds a waiter and confirms it counts as a contender from both perspectives, ties it to admits() rejecting the incumbent's reacquisition; then sets the waiter's count to a stale zero and confirms it no longer counts as a contender.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `every_active_project_is_owed_a_slot`
- spec 3 · read at `d15a866a9420` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A table-driven test with multiple cases (numbers of active projects vs. total available slots/concurrency), asserting that whatever allocation function is under test never gives an active project zero slots — i.e., a floor guarantee overriding naive proportional/percentage division that would round some small projects down to zero. Likely iterates a table of (projects, total) pairs checking every project's allotted slot count is >= 1.
- found: A series of assert_eq! calls on an `allowance(mine, others)` function, verifying each active project is guaranteed at least 1 slot even when a naive percentage/proportional split would round it to zero, including a queuing case where projects outnumber slots.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The file_doc explained the motivation (percentage schemes fail); the inline comments per-assertion carried most of the actual reasoning, not the docstring shown.

### `a_waiting_project_cannot_be_out_competed_for_a_freed_slot`
- spec 3 · read at `03cee8997afb` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:22Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up an incumbent holding the pool at its capacity/allowance, registers a second project as a waiter, then has the incumbent release a slot; it asserts that the freed slot goes to the waiter deterministically rather than being re-taken by the incumbent, likely repeating across threads/iterations to rule out a probabilistic (coin-flip) pass.
- found: A concurrency test: an incumbent holds a pool of 4 slots, releases one, a waiting 'small' project is registered before the release and gets the freed slot; a second 'big' acquire attempt from the incumbent then blocks (proving it can't out-compete the waiter) until 'small' finishes, after which the incumbent's acquire succeeds.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `a_slot_is_returned_however_its_holder_leaves` — QUIRKY
- spec 3 · read at `e5f0da2f3380` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:14Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test: builds a Slots pool, acquires a slot inside a scope/closure that exits early (e.g. via `?` or early return before normal completion), drops the guard, then asserts the pool's available/holding count returns to its prior state — proving Drop releases the slot on every exit path, not just normal completion.
- found: Creates a Slots pool with capacity 1, loops 3 times acquiring and implicitly dropping a slot for key "one" each iteration (would deadlock on the 2nd iteration if the slot weren't released), then acquires once more after the loop as a final check.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `parses_a_commit_author_and_time_per_line` — QUIRKY
- spec 2 · read at `83b21a2d2547` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:22Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test that feeds a small hand-written git-blame --porcelain formatted string into parse_porcelain, then asserts the resulting per-line records carry the expected author and commit timestamp for each line.
- found: Unit test parsing a SAMPLE porcelain blame string, then testing FileBlame::range() over line ranges: verifies authors are interned (deduped) rather than repeated per line, that a single-commit range reports the right commit count and author, and that a multi-commit range reports the most-recently-touching author (not the first), plus last_touched_days and age_days values.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I expected direct per-line author/time assertions; it actually tests the range() aggregation API (commit counts, most-recent author, age) built on top of the parsed lines.

### `a_range_is_blamed_against_the_lines_it_names`
- spec 3 · read at `3e1ee1ea3a27` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:17Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Creates a real temporary git repository, commits a file in two stages so two different commits each own one half of the file's lines, then calls the actual blame_file/range function against real git with a line range covering only one half, and asserts the returned commit/author matches only that half's commit — verifying the -L range flag passed to git is correct, not just that the porcelain parser works on a hand-written sample.
- found: Creates a real temp git repo, two commits by different authors each adding two lines to a.rs, then calls range_detail three ways: (0,0) for the whole file (asserting end=0 means whole file, 2 touches), (3,4) for just the tail (only Grace's commit reaches it), and (1,2) for just the head (only Ada's commit) — verifying real git -L ranging is correctly bounded on both ends.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_commits_fields_are_kept_by_sha_not_by_whatever_came_last`
- spec 3 · read at `4de32f6c74dc` · commit `9f5abcc` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T22:48:55Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A Rust test that feeds parse_porcelain (or similar) a blame porcelain sample where two commits' lines interleave — porcelain gives full metadata only on the first occurrence of a sha — and asserts each line is still correctly attributed by looking up fields keyed by sha in a map, rather than falling back to whichever commit's fields were most recently seen in the stream.
- found: Feeds fold_porcelain three lines from two commits where the third line reuses commit "a"'s sha without repeating its header fields (porcelain shorthand), and asserts the resulting touch for commit "a" aggregates to 2 lines with Ada as author (not Grace, who was the most recently seen author) — confirming per-line attribution is keyed by sha via a lookup, not by mutable "last seen" state. Also checks touches are sorted newest-first and authors sorted by most surviving lines.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `an_uncommitted_line_is_named_not_shown_as_a_sha`
- spec 3 · read at `89010367353b` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test verifying that uncommitted lines (git's all-zero SHA in porcelain blame output) get a human-readable label like "Uncommitted" rather than displaying the raw 40-zero hash string. It likely constructs synthetic porcelain output with a zero-SHA line, runs it through the parser, and asserts the resulting author/commit field reads as a named placeholder instead of the hex zeros.
- found: A unit test that feeds synthetic git porcelain blame output with the all-zero SHA (working-tree/uncommitted marker) through fold_porcelain, and asserts the resulting touch's commit field is the literal string "uncommitted" rather than the zero hash.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `places_lines_by_their_final_number` — QUIRKY
- spec 2 · read at `9e9766ada15f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:16Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A unit test verifying the documented invariant that a function's blame/history lines are placed under a neighbor according to its FINAL line number, not any earlier line number. It likely builds two overlapping or out-of-order line ranges (e.g., one function whose start comes after another's end but whose final line is earlier or vice versa) and asserts the ordering/grouping in the output matches final-line placement rather than insertion order or start-line order.
- found: It's a unit test for parse_porcelain: given git blame porcelain output where the hunk for line 3 appears before the hunk for line 1 (out of order), it verifies parse_porcelain still places each line at its correct final line number in the resulting Blame struct, so range(1,1,..) returns Grace (the line-1 author) and range(3,3,..) returns Ada (the line-3 author) regardless of the order they appeared in the porcelain stream.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `a_range_past_the_end_is_clamped`
- spec 2 · read at `0e1791f1edfc` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:14Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a small blame/history structure with a known number of lines, then requests a range extending past the end (e.g. line 100 on a 5-line file). It asserts this doesn't panic or return an error, but instead returns whatever lines are actually available, clamped to the real length.
- found: Test parsing a sample git blame porcelain output, then checking that a range partially overlapping the end returns Some (clamped data), while a range entirely past the end returns None.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted the clamp-to-available-data case but not that a range wholly beyond the file returns None rather than an empty clamped result.

### `a_range_is_followed_across_a_rename` — QUIRKY
- spec 3 · read at `afb8aae3fde0` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:30Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Sets up a temp git repo, commits a file, renames it (and maybe edits it), then runs the range/line history walk against the post-rename path and asserts commits from before the rename are still included — proving the code follows renames despite `git log -L` not supporting --follow directly.
- found: Builds a temp git repo, commits a file, edits above the function (no range change), renames it, then edits inside it again. Asserts line_history walks through the rename to the origin commit, records the rename crossing on the last change row, and that the renamed file's own file_first log (no --follow) stops at the rename — newer than the creation commit reached via the line walk, which is why the panel gates an 'older file' claim on that ordering. Also checks dirty-worktree detection, that whole-file queries (0,0) return no line-level changes, and that a never-seen path returns None.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The extensive inline comments explain a real gotcha: a path's own git log stops at its rename (no --follow), so file_first can appear newer than the true creation date reached via the line walk — code consuming file_first must not assume it's the oldest date available.

### `the_far_end_of_a_walk_says_which_kind_of_end_it_is`
- spec 3 · read at `3b384cbef411` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:56:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test function verifying that when a git blame/history walk reaches its terminal point, the code correctly distinguishes two cases — "file created" vs "lines written into a pre-existing file" (a rewrite) — and produces the correct classification/sentence for each, rather than treating both as the same kind of "end".
- found: A test that builds two tiny git repos with real commits: one where lines are added into a file that already existed (Origin::Added, one change, file older than the lines), and one where lines are wholesale-rewritten (Origin::Created — walk continues through the rewrite back to file creation, changes.len()==2, with the join showing surviving lines vs replaced lines via a lines==0 marker on the replaced commit). It verifies there's no separate 'Replaced' variant since git's line-following handles that case by walking further back.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The key insight the docs partially convey but the code makes concrete: a rewrite doesn't terminate the walk, it's Origin::Created reached via two changes, distinguished from a simple Added by walk depth and the lines==0 marker, not by a distinct enum variant.

## src-tauri/src/cache.rs

### the file itself
- spec 2 · read at `4e55b9ae8945` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Implements a Cache type for storing per-function analysis scores keyed by an FNV-style hash of function identity/body (so renaming or moving a function within a file doesn't invalidate its entry, but a body change does), with both an ephemeral in-memory mode and a persistent disk-backed mode under a `scores/` directory, separated per model so two models never share a cache file. Includes get/put/flush/len/is_empty operations and unit tests enforcing the invalidation invariants named in the peers list. Per the docs, only the ephemeral path is actually used today since the offline proxy rescans fast enough that persistence isn't worth it.
- found: A content-addressed score cache: key is (path#name, hash of body XOR'd with doc hash) so line moves don't invalidate but body/doc edits do; separate cache file per (repo, model) hashed into the filename to prevent the proxy pass and model pass from clobbering each other; ephemeral (in-memory, no path) vs persistent (writes to scores/ via temp-file+rename, flushed every 25 puts) modes; FORMAT_VERSION guards against silently reusing scores whose meaning changed; tests pin all of these invariants plus that Entry's serialized fields haven't silently grown.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: Didn't anticipate that the doc string is folded into the cache key (not just the body) — that's because the model is shown the doc as part of its prompt, so editing a comment must invalidate the score too.

### `key`
- spec 2 · read at `10263b9832dd` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:25:15Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds a cache key tuple: a String identifier from path+name (no line number, so moving a function within the file doesn't invalidate it), and a u64 hash (via the fnv peer) computed over the body and doc text combined, so that editing the doc or body changes the hash and misses the cache.
- found: Nearly as predicted: string key is "{path}#{name}", hash is fnv(body) xored with fnv(doc) rotated left 1 (combining rather than hashing concatenated bytes as I loosely guessed).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Got the shape right but the exact combination (xor of two separate fnv hashes with a rotate) is more deliberate than my vague 'hash over body and doc combined'.

### `fnv`
- spec 2 · read at `47065865d5b9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes a 64-bit FNV-1a-shaped hash of the byte slice: start from some offset basis, then for each byte XOR it into the hash and multiply by a constant multiplier, looping over all bytes and returning the final u64. Per the doc, the multiplier used is deliberately not the real FNV-1a prime, so it's FNV-shaped but not standard FNV-1a.
- found: Standard FNV-1a shape: starts at the real FNV offset basis (0xcbf29ce484222325), XORs each byte in then multiplies by a constant (0x100000001b3, which is actually the real FNV-1a prime, not a wrong one as the doc implies), wrapping on overflow.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc claims the multiplier is deliberately not FNV-1a's real prime, but 0x100000001b3 IS the standard FNV-1a 64-bit prime — the doc/comment may be describing a different function (perhaps the "twin in heuristic.rs") rather than this one.

### `ephemeral`
- spec 2 · read at `7b869a5d74b4` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Cache with an empty in-memory map and no filesystem path (path field None or similar), so get/put work in memory but flush/open never touch disk. Used by tests and the headless scanner for reproducibility.
- found: Builds a Cache with path: None, empty model string, an empty Mutex-wrapped Stored default, and a dirty counter at 0 — an in-memory-only cache that never touches disk.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `open`
- spec 3 · read at `809bffb3874f` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes the cache file path for this repo+model pair (via Cache::path_for), then tries to read and deserialize that file from disk. If it exists and parses successfully and its stored model matches `model`, returns a Cache populated with those entries; otherwise returns a fresh empty Cache (falling back to ephemeral-like behavior). Given the file doc says nothing currently writes to scores/, this read path likely just never finds a file and always returns empty.
- found: Builds the cache path, reads and JSON-deserializes it if present, and only keeps it if the stored version and model match the requested model; otherwise builds a fresh empty Stored struct. Wraps it all in a Cache with Mutex-guarded inner state and a dirty counter.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `path_for`
- spec 2 · read at `8973c016a1ad` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:56Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes a cache file path under a scores/ directory (likely in the app's data dir), combining an FNV hash of the repo's canonicalized path with a sanitized version of the model name into the filename (e.g. scores/{hash}-{model}.json), returning None if the data directory can't be resolved or the repo path can't be canonicalized.
- found: Joins data_dir()/scores, creates the dir, then hashes both the repo path and the model name with fnv and joins them as a hex filename {repo_hash:016x}-{model_hash:016x}.json.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I expected the model name to appear as readable text in the filename per the doc's framing ('the model belongs in the filename'), but it's hashed too, not kept literal.

### `get`
- spec 3 · read at `2850f04aa371` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:28Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Looks up the in-memory cache map by the (id, body_hash) key tuple — a hit requires matching both the function's id and a hash of its body — and returns a cloned Reading if found, None on a miss.
- found: Locks the inner map, looks up entry by id string, filters on matching body_hash, and maps to a Reading (surprise + hotspots) clone; returns None on lock failure, missing id, or hash mismatch.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `put`
- spec 2 · read at `c5a3bbeeac83` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Inserts the (name, body-hash) key and Reading into the cache's internal shared map (likely a Mutex<HashMap> since &self is not &mut self), so a hit requires both the same function name and the same body hash — renaming or moving code changes the hash-relevant key and thus misses. If the cache is persistent (not ephemeral) it marks state dirty for a later flush() to write to scores/, but doesn't touch disk itself here.
- found: Locks the entries map and inserts an Entry (body_hash, surprise, hotspots pulled from the Reading) keyed by name. Then increments a separate dirty counter under its own lock, and once it reaches FLUSH_EVERY, resets it and calls self.flush() itself — so persistence happens automatically every N puts, not via an external caller deciding when to flush.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Docs shown were file-level (about the persistence feature being unreachable) not this function; the function itself has no direct doc comment, so `documented: none` for this handout even though the module doc was informative context.

### `flush`
- spec 2 · read at `01f40ef313ca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:48:09Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Early-returns if the cache is ephemeral (no backing path) or has nothing to write. Otherwise serializes the in-memory score map to some format, writes it to a temp file path near the real cache file, then renames the temp file to the real path so a crash mid-write never leaves a corrupt/partial cache file on disk.
- found: Returns early if no backing path, locking fails, or serialization fails. Otherwise serializes the locked inner map to JSON, writes it to a `.json.tmp` sibling file, and renames it over the real path — all failures silently swallowed.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `model`
- spec 2 · read at `e381187a6109` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:19Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A trivial getter returning a reference to the Cache struct's stored `model` field (the model name string this cache was created for), with no other logic.
- found: Trivial getter returning &self.model.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `len`
- spec 2 · read at `acdccc35d5d5` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:22Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Trivial getter that returns the number of entries in the Cache's internal storage map, e.g. self.entries.len().
- found: Locks the inner mutex-guarded state and returns the length of its entries map, defaulting to 0 if the lock is poisoned/fails.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `is_empty`
- spec 2 · read at `525f411ae90a` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:25:22Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns self.len() == 0, a trivial wrapper around the len() method.
- found: Exactly as predicted: self.len() == 0.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `a_new_cached_field_cannot_be_added_silently`
- spec 2 · read at `b4e0a0c82be1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:37Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test that captures the cached record struct's field names (or a serialized golden example) and asserts it against a hard-coded list/version, so adding a new field to the cache schema without deliberately bumping a version constant fails this test instead of silently deserializing old cache files with a defaulted field.
- found: Constructs an Entry, serializes to JSON, sorts and asserts its object keys exactly equal [\"body_hash\", \"hotspots\", \"surprise\"] with a message telling the editor to bump FORMAT_VERSION and update the list. Exactly matches my prediction.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `two_models_never_share_a_cache_file`
- spec 2 · read at `cb74c330673d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:49Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test that opens two Cache instances configured with different model names pointing at the same directory, puts a value in one, flushes, and asserts the other model's cache does not see that value — verifying that Cache::path_for incorporates the model identifier so different models get distinct cache files on disk.
- found: Directly calls Cache::path_for with the same repo path but two different model name strings and asserts the resulting paths differ (and both are Some) — simpler than a full put/flush/get roundtrip, but confirms the same underlying property.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The inline comment reveals the real regression: the proxy heuristic pass runs right before every model pass, and previously both wrote the same cache file, wiping model scores each time.

### `a_hit_needs_the_same_body_not_just_the_same_name`
- spec 2 · read at `506d9cc797b2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:10Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This is a unit test verifying that Cache::get (or the key() function) only returns a cached score when the function's current body hashes to the same key as when it was cached — i.e. it puts a score under a key derived from some (name, body) pair, then looks it up with the same name but a different body, and asserts the cache misses (returns None), proving the cache key includes body content and not just the function's name/path.
- found: Test: puts a Reading under a key(path, name, body, None) for one body, confirms a hit; builds a second key with same path/name but edited body text, and asserts the cache misses, proving the key incorporates body content.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `moving_a_function_within_a_file_does_not_invalidate_it`
- spec 2 · read at `727fa03d8533` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes the cache key for a function twice — same name/body/owner, but at two different line positions within the file — and asserts the two keys are equal, confirming the cache key is based on content (body/name) rather than physical location, so a pure move (no edit) still hits.
- found: Calls key() twice with identical (path, name, body, None) arguments and asserts equality — the point (line numbers aren't part of the key) is made via a comment, not by actually varying a line-number argument, since key() doesn't appear to take one at all. Weaker/more trivial test than I predicted: I assumed the two calls would differ by a simulated line position.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `renaming_or_moving_a_function_misses`
- spec 2 · read at `078a7675a445` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Stores a cache entry keyed by a function's name/path identity (and body), then looks it up under a different name or file path but the same body, and asserts Cache::get misses — showing the cache key incorporates identity (name/location) so renaming or moving a function is treated as a new function, unlike the peer test showing moves within a file don't invalidate.
- found: Puts an entry under key(file=a.rs, name=run, body=\"body\"), then asserts misses both when the name changes (walk) and when the file changes (b.rs), same body — confirming the key includes both name and path, so renames/moves miss.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `an_ephemeral_cache_never_touches_disk` — QUIRKY
- spec 2 · read at `325602066f11` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:54Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Creates a Cache::ephemeral, puts an entry and calls flush, then checks that no file was written to disk (e.g. by checking a directory stays empty or path_for returns None), proving the ephemeral cache is purely in-memory.
- found: Puts one entry into an ephemeral cache, calls flush (a no-op for ephemeral caches), and asserts len()==1 — i.e. flush doesn't lose or fail on data with no backing file, rather than explicitly checking the filesystem.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `a_cache_written_by_another_model_is_dropped_not_merged`
- spec 3 · read at `c28377d0945f` · commit `758c706` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:04:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test verifying cache isolation between models: it writes/puts entries into a cache opened under one model name, flushes to disk, then opens the same cache file/path under a different model name and asserts the previously written entries are NOT present (dropped rather than merged) — i.e., Cache::open discards content belonging to another model instead of merging it into the new in-memory cache.
- found: A test that plants a cache file directly (bypassing Cache::open) under "old-model", confirms opening under the same model reads it back, then confirms opening under a different model name drops the entry (not merged), and finally confirms a stale FORMAT_VERSION under the correct model is also dropped by the same filter in Cache::open.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/churn.rs

### the file itself
- spec 3 · served in 2 parts · read at `85c2a9b0151f` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:38Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file implements the "stability axis" (age/churn) of the analysis via a single `git log` pass, building a History of per-path/directory commit counts, ages, last-touched/author info, with directory credit propagating to ancestors. It supports incremental refresh/banking (delta walk vs full walk, detecting rewritten history to force a full re-walk), a windowed/saturating churn score to avoid runaway values from one pathological file, a progress-reporting callback, and tests validating incremental-vs-full equivalence and monotonic progress reporting.
- found: Single-pass `git log` history module distinguishing total_commits (a SIZE, lifetime) from recent_commits/churn (a RATE, 90-day window) — two different questions from one walk, both needed since a cap used to conflate them. Builds History with directory-level ancestor crediting (once per commit, not per touched file), supports banking/refresh with three cases (no-bank/rewritten-history → full walk, HEAD moved → delta walk absorbed, unchanged+fresh → skip entirely via WINDOW_DRIFT), streams the git log pipe for progress ticks with a stop flag, saturates churn at an absolute anchor (not repo-relative) to prevent one generated file from squashing everything else's score, and includes extensive tests for incremental/full equivalence, monotonic progress, directory crediting, and edge cases.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I underestimated: didn't predict the total-vs-recent distinction, the streamed/interruptible git log with a stop flag, the WINDOW_DRIFT skip-entirely optimization, or the absolute (non-repo-relative) churn saturation rationale — all load-bearing design decisions spelled out at length in the doc comments.

### `authors`
- spec 3 · read at `9112ed59253d` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Simple accessor returning &self.authors, a field on History populated during the single git log walk and already sorted by commit count descending, matching the doc "most commits first". No computation happens here.
- found: Simple accessor: returns &self.authors.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `churn_of`
- spec 3 · read at `a7307b69edc1` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:04:15Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Looks up the FileHistory entry for `path` (returning 0.0 if absent), then normalizes its recent_commits count to 0..1 by dividing by the absolute CHURN_SATURATION constant and clamping/capping at 1.0, so a file with commits at or above that threshold reads as maximally churny rather than being scaled relative to the busiest file in the repo.
- found: Returns 0.0 for an unseen path, otherwise recent_commits divided by CHURN_SATURATION, clamped to 0..1.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `commits_of`
- spec 3 · read at `2dac66e5874a` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:03Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up `path` in an internal map built from the git log parse (mapping path -> commit info/list) and returns the raw commit count touching that path, defaulting to 0 if the path has no recorded history. Likely a one-line HashMap lookup with `.map_or(0, ...)` or similar.
- found: Looks up path in self.files map and returns the recent_commits field of the matching entry, or 0 if not found. Confirms it's a simple map lookup as predicted, but the field is specifically "recent_commits" (window-scoped), distinct from a total_commits_of peer — a distinction I didn't capture in the prediction.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `total_commits_of`
- spec 3 · read at `99f9cb3b042c` · commit `c4c6042` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:08:01Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Looks up path in self.files, returning Some(entry.total_commits) — a field separate from recent_commits — if the entry exists, or None if the path was never seen by git, preserving the None-vs-zero distinction the doc emphasizes.
- found: Exactly as predicted: map lookup returning Some(total_commits) or None.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `last_touched_of`
- spec 3 · read at `604a71858502` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:40:06Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A 3-line method that looks up the file's last-commit timestamp from an internal map and returns days-since-then as an f32 via a days_since/now_secs helper, returning None if the file has no recorded history.
- found: Looks up the file's record in self.files, maps to days_since(self.now, h.newest_ts); None if the file has no entry.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Correctly predicted the shape but guessed 'now_secs' would be involved rather than a precomputed self.now field.

### `last_author_of`
- spec 3 · read at `fb92b041606d` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:12Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Simple accessor: looks up `path` in a map inside `History` (built from the single git-log pass) and returns the author of the most recent commit touching that file, cloned into an Option<String>, None if the path has no recorded history.
- found: Looks up path in self.files map, maps to h.last_author.clone(), then filters out empty-string authors, returning None in that case too.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The empty-author filter suggests some commits in the parsed log can yield a blank author string that should be treated the same as no history.

### `age_of`
- spec 3 · read at `9ab1782d6e31` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:40:06Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Looks up the file's oldest touching commit timestamp from a map inside the History struct (built from the one git log pass), and converts it to an age in days via days_since/now_secs, returning None if the path has no recorded history (untracked or no git).
- found: self.files.get(path).map(|h| days_since(self.now, h.oldest_ts)) — exactly as predicted, using a stored `now` rather than recomputing it per call.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `last_commit_of`
- spec 3 · read at `b2d3d99e6d5f` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:15Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up path in the internal files map and returns the stored commit oid (as &str) of the most recent commit that touched it, wrapped in Some; returns None if the path isn't present in the map (never touched, per the docs).
- found: Looks up path in files map, maps to last_commit field as &str, then filters out empty strings so an empty-but-present sentinel value also yields None.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted the map/get correctly but missed that there's an extra filter for empty-string oids, which the doc's None-means-"never seen" framing doesn't fully explain (empty string is a distinct internal sentinel).

### `is_empty`
- spec 3 · read at `fa82152d23c7` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:06Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the History struct has no data at all — likely returns true if the internal map of path->stats (or total commit count) is empty, used to detect repos/directories with no git history so callers can fall back to scoring without history.
- found: Returns whether the internal `files` map is empty, i.e. no per-file history was recorded.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Field is named `files` not a generic map/count, and there's no directory-level field checked separately — good to know since the module also tracks directory-level churn.

### `read`
- spec 3 · read at `d3e4b3e656e8` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: `read` invokes the full `git log` walk (likely delegating to `walk`) starting from scratch (no prior state), parses the output via `parse_log`, and builds a `History` struct populated with per-file churn/commit data. Since it "never fails," it probably checks if `repo` is a valid git repo first and returns an empty/default `History` if not, rather than propagating an error.
- found: Delegates entirely to walk(repo, &[], now_secs(), &NEVER, no-op callback), matching Done to return the History and Stopped (unreachable given NEVER stop flag) to History::default().
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `walk`
- spec 3 · read at `30b565676c87` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:00Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Spawns a `git log` child process (with --name-only or similar, and the given bounds as revision range/--since args) using a custom format that delimits commit records with \x01. Rather than calling Command::output() (which buffers everything and blocks until done), it reads the child's stdout pipe incrementally in chunks, counting \x01 bytes as they pass to call tick(count) so progress can be reported as the walk proceeds, and checking the stop AtomicBool periodically so the walk can be aborted early. The accumulated bytes are handed to parse_log to fold into per-path commit/author/date records, returned as a Walked value (which may be partial if stopped).
- found: Spawns `git log --no-merges --format=%x01%ct%x02%an%x02%H --name-only` plus the given bounds, reads stdout in 64KB chunks (not Command::output()), counting \x01 bytes to call tick(seen) as it goes, and checks the stop flag each loop iteration — killing and reaping the child (to avoid EPIPE-triggered buffering and zombies) and returning Walked::Stopped if asked to stop. On successful completion it hands the collected text to parse_log(...) wrapped in Walked::Done; any spawn failure, missing stdout, read error, or non-success exit status collapses to an empty History rather than a partial one.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `refresh` — QUIRKY
- spec 3 · read at `683643946ce5` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:26Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a previous Bank exists and is still an ancestor of HEAD; if not (no bank or rewritten history), does a full walk from scratch. If the bank is valid but HEAD moved, does an incremental walk of banked..HEAD and absorbs those commits into the existing bank. If HEAD hasn't moved, returns the bank unchanged. Recomputes the 90-day window every time, checks `stop` for cancellation, and calls `tick` for progress. The returned bool likely indicates whether the bank changed.
- found: Checks a freshness guard first (unchanged HEAD + within WINDOW_DRIFT) and returns the bank untouched with `false` if so, to avoid re-serializing a huge bank. Otherwise picks a full walk or an incremental `banked..HEAD` walk depending on ancestry, then ALWAYS also does a separate `--since=N days ago` window walk and calls `history.rewindow` on it regardless of which branch was taken. It tracks a running commit count across all walks for the tick callback, times the whole operation to bank a rate estimate (only if enough commits were counted), and returns None outright if any walk is stopped via the atomic flag.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The always-present trailing window walk and rate-timing logic aren't hinted at by the doc's three-case framing, which reads as if the three branches are the whole story.

### `commits_since`
- spec 3 · read at `b39018530e6e` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:50Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Shells out to `git rev-list --count <head>..HEAD` in the given repo, parses the numeric output, and returns it as u32, defaulting to 0 on failure. A cheap content-free count used to estimate how much has changed since a repo's last traced commit, so the caller can decide whether re-tracing is worth the cost.
- found: Runs `git rev-list --no-merges --count <head>..HEAD`, parses the trimmed stdout as u32, and returns 0 on any failure (command error, non-success exit, or parse failure).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `packed_objects`
- spec 3 · read at `93f5a2371224` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:12:28Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Runs a cheap git plumbing command (likely `git count-objects -v`) to sum object counts across pack files without walking history, returning 0 on failure since it's meant to be a free, best-effort estimate.
- found: Runs `git -C repo count-objects -v`, parses the `in-pack: N` line from stdout, returns N or 0 on any failure to run/parse.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc's calibration numbers (measured timings and accuracy across five real repos) justifying the tenth-of-objects heuristic used elsewhere aren't visible from this function alone.

### `head_of`
- spec 3 · read at `ef500906834c` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:52Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Runs git rev-parse HEAD in the given repo and returns the trimmed commit SHA as a String, returning an empty string on failure.
- found: Runs `git -C repo rev-parse HEAD`, returns trimmed stdout as String on success, empty string otherwise.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `is_ancestor`
- spec 3 · read at `cf1321ba0dd2` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Shells out to `git merge-base --is-ancestor <old> HEAD` (or equivalent) with cwd set to `repo`, via std::process::Command, and returns true iff the command exits with status 0 (old is an ancestor of HEAD). Likely treats any failure to spawn/run git as false, defaulting to "history rewritten" on error since it's used as a conservative safety check before reusing cached history.
- found: Runs `git -C <repo> merge-base --is-ancestor <old> HEAD` and returns whether it exited successfully; any spawn/exec failure is treated as false via unwrap_or.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment explains the *purpose* (why this check exists, used by scancache/history) which isn't derivable from the 8-line body alone, so it adds real value beyond the code.

### `days_since`
- spec 3 · read at `a6474efd1e76` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:40Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes (now - ts) as f32, divides by 86400.0 to convert seconds to days, then clamps to 0.0 minimum with .max(0.0) so a future-dated commit doesn't produce a negative age.
- found: Computes ((now - ts) as f32 / 86_400.0).max(0.0) — seconds-to-days conversion clamped at zero.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `now_secs`
- spec 3 · read at `fbdc243743ae` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:06:58Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns the current time as Unix seconds (i64), likely via SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() cast to i64, used to compute age/recency elsewhere in churn calculations.
- found: Returns current Unix time in seconds as i64, using SystemTime::now().duration_since(UNIX_EPOCH), defaulting to 0 on error (e.g. clock before epoch).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `credit` — QUIRKY
- spec 3 · read at `4256b4a8dde1` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:45Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Looks up or inserts a FileHistory entry for `key`, then updates commit count, last-touched timestamp, and author set, marking whether the commit is within the recent window (ts >= recent_from). Guards against double-counting the same commit for the same key (e.g. a directory hit by multiple files in one commit) by comparing against the last recorded oid.
- found: Gets-or-inserts a FileHistory for `key`, updates newest_ts/last_author/last_commit only if this commit's ts is newer than what's recorded (not "first seen", since a delta walk can fold newer commits into an existing older record), tracks oldest_ts similarly, and increments total_commits plus recent_commits if within the recent window.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: No oid-based dedup guard lives here — the comment implies dedup for same-commit-multiple-files is handled by the caller/walk logic, not inside credit itself.

### `flush_commit`
- spec 3 · read at `d97e1e531394` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: For each file path in `touched`, updates its FileHistory entry (bumping total commit count, recent count if ts >= recent_from, last author/oid/timestamp). Then walks up each touched file's ancestor directories, deduplicating them into a set so a commit touching multiple files in the same directory only credits that directory once, then credits each ancestor directory's FileHistory for this commit. Finally clears `touched` for reuse.
- found: Applies one commit: for each touched file, credits its FileHistory; collects all ancestor directories (deduped via HashSet, built by cutting at each '/') and credits each once; then explicitly credits the empty-string root path too (since the ancestor-walk loop never emits it), which the comment flags as a real bug fix — the root directory would otherwise never get credited. Guards against ts==0 or empty touched by clearing and returning early.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The root-directory credit (empty string path) is not derivable from the function doc alone — the doc says "every ancestor directory" but doesn't hint that root needs special-casing outside the walk loop.

### `parse_log`
- spec 3 · read at `97c573fc5cd1` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:40:21Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Parses the raw text output of the single `git log` invocation (a custom --format with per-commit metadata like hash/author/timestamp followed by the list of changed file paths), building up a History by iterating commits, crediting authors, tracking each file's oldest/newest commit timestamps and commit counts, and rolling those counts up to containing directories — using helper functions like credit, flush_commit, and rank seen in peers. Takes `now` as a parameter rather than reading the clock so it's pure and testable.
- found: Streams over the git log text line by line, detecting commit-header lines by a \x01 prefix, splitting timestamp/author/oid with \x02 delimiters (rsplit for oid so an author name containing \x02 doesn't corrupt it), collecting touched file paths until the next header, calling flush_commit to fold the completed commit's data (author credit, per-file oldest/newest ts and commit counts, directory rollups) into `files`/`by_author`, then ranking authors at the end into the final History.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The delimiter parsing (rsplit_once for oid vs author) is the subtle bit — matches the git log --format string elsewhere, not shown here.

### `rank`
- spec 3 · read at `60f4ef6267cd` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:49:27Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Takes a map of author name to commit count and returns the author names sorted descending by count, breaking ties alphabetically by name for deterministic, stable ordering across repeated reads.
- found: Sorts authors descending by commit count, ties broken ascending alphabetically by name, returning just the names.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `absorb`
- spec 3 · read at `21ec43f242c2` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:11:56Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Merges a newer incremental History walk into the existing one — for each path/directory entry, adds commit counts and rolls forward the newest-touch timestamp while keeping the oldest, using timestamp comparison (via `credit`) rather than list order, so the combined result is equivalent to a full walk over the whole range.
- found: For each path in the newer walk, adds commit counts to the existing entry, updates newest timestamp/commit/author using `>=` (deliberately different from the `>` used within one walk, for tie-breaking reasons explained in the comment), and lowers oldest timestamp if the newer walk found an earlier one. Also merges per-author commit counts and re-ranks authors.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the by_author merge and re-rank; the doc's explanation of why `>=` vs `>` differs by direction (log order within a walk vs. head-descended delta across walks) is a subtle invariant not visible from the code's shape alone.

### `rewindow`
- spec 3 · read at `4ea7f1cead28` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:30Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Takes the freshly-walked `window` History (bounded by the --since cutoff) and copies its per-path churn/commit counts into self, replacing whatever stale window counts were stored, while leaving the all-time totals and ages alone except re-deriving 'days since' from the passed-in now rather than whenever the walk happened.
- found: Stores `now` on self, then for every file entry sets recent_commits to the window History's total_commits for that path (0 if the path isn't present in the window at all), leaving everything else on the entry untouched.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Simpler than expected: 'age re-dating' turns out to be just storing `now` once rather than recomputing per-file age fields here — ages are presumably derived lazily elsewhere from self.now.

### `refreshed` — OBSCURE
- spec 3 · read at `2eaebdfde6cc` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Short dispatcher: if `banked` exists and its stamped HEAD is still current/an ancestor of the repo's HEAD, return it unchanged (no walk); otherwise perform a fresh git log walk (parse_log) or incrementally absorb new commits into the existing bank, returning the updated Bank.
- found: A test-only helper that calls the real `refresh` function with a never-firing cancellation token and a no-op progress callback, unwraps the Result (expecting success since nothing can stop it), and returns just the Bank half of the tuple. The actual incremental-vs-full-walk logic lives in `refresh`, not here.
- predicted: none · documented: none · derivable: yes · legible: full · trap: no
- note: This is a test helper wrapping `refresh`; the doc block at the top of the file describes `refresh`'s design, not this function's, so it reads as documentation for the wrong symbol.

### `repo`
- spec 3 · read at `cf1ff5a7d361` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:20:07Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Creates a temporary directory, runs `git init` in it, then loops n times committing alternately to one of two files (e.g. "a.txt" and "b.txt"), writing some content and running `git add` + `git commit` each iteration so the resulting repo has n commits split across two files. Returns the TempDir handle so it stays alive for the caller to inspect with git log.
- found: A git test-repo builder: inits a repo with test user config, then commits n times alternating between src/a.rs and src/b.rs, each commit writing distinct content and message.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `shape`
- spec 3 · read at `3d30952a4973` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:36Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Iterates every path tracked in `h` and builds a Vec of tuples (path, commit count, distinct commit count, oldest timestamp, newest/recent timestamp, last author) — a flattened, comparable snapshot of the History used by property tests to assert a refreshed/incremental walk produces the same result as a full walk.
- found: Nearly exact match to prediction: maps h.files into tuples of (path, total_commits, recent_commits, oldest_ts, newest_ts, last_commit) and sorts the result. Two details missed: the second u32 is `recent_commits` (a churn window) not a "distinct commit count", the trailing String is `last_commit` (likely a hash) not necessarily the author, and I didn't predict the final sort.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_refreshed_walk_matches_a_whole_one`
- spec 3 · read at `805aaf6f560b` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:45Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a test repo, takes a full walk/bank at an earlier commit, adds more commits, then calls `refresh` with that stale bank to get an incrementally-updated History via the delta path. Separately does a fresh full walk from scratch at the current HEAD. Asserts the two histories are equal (e.g., same churn/commit counts per path), proving the incremental "absorb" path produces the same result as walking everything from zero.
- found: Full walk at commit 4, adds 3 more commits, then compares a refreshed-from-bank walk against a fresh full walk: same history shape, authors, head, and a specific total-commits-of check for the touched file (5 = 2 + 3).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `an_unchanged_repo_is_not_walked_again`
- spec 3 · read at `45cb74def6e5` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds a test repo, creates a Bank with head matching current HEAD and a fresh taken_at timestamp, then calls refresh with a tick closure that asserts it is never invoked (proving no git walk happens). Asserts the returned tuple's bool is false (nothing changed) and that the bank/history returned matches what was passed in.
- found: Confirms the freshness short-circuit: a bank matching HEAD with a fresh taken_at causes zero ticks and changed=false, with history intact. Then goes further and tests the flip side — a bank with taken_at=None (pre-stamp/stale) is treated as unknown and walked again, asserting changed=true.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the second half of the test (stale/unstamped bank still gets walked) in my prediction — the doc only motivates the fresh-case behavior.

### `a_new_commit_still_refreshes_a_stamped_bank`
- spec 3 · read at `9f63cebf634f` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test: it builds a temp repo, does an initial walk/refresh so the bank is stamped at the current HEAD, then makes a new commit and calls refresh again. It asserts the second refresh actually walks the new commit (updating history/counts) rather than being short-circuited by the "unchanged repo" fast path that a sibling test (an_unchanged_repo_is_not_walked_again) covers.
- found: Builds a temp repo, does an initial refresh to bank it, commits a new change, then refreshes again and asserts changed==true, tick callback fired, and bank.head matches the new HEAD — confirming a stamped bank still gets walked when HEAD moves.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_stopped_walk_is_never_banked`
- spec 3 · read at `a3e28b284de7` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:11Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Constructs a History or walk result representing a Walked::Stopped (partial) git log outcome, feeds it into the absorb/banking path, and asserts that the resulting state is not marked complete/banked — e.g. a completeness flag remains false or the partial data is discarded/not trusted as the full history.
- found: Creates a fixture repo, calls refresh with a stop flag already set to true, asserts refresh returns None (no bankable result), then asserts a fresh refreshed() call afterwards still walks the repo successfully (nothing was corrupted/half-written).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `the_gauge_only_ever_counts_upward`
- spec 3 · read at `465290a5490d` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:17Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test that exercises refresh's progress reporting across its up to three walk phases (delta/whole log, then churn window), verifying reported progress ticks never decrease between phases thanks to an 'onward' offset that carries the previous phase's total forward instead of resetting to zero.
- found: Sets up a repo, banks an initial refresh, adds 3 more commits, then re-refreshes while recording every progress tick via a callback. Asserts ticks are monotonically non-decreasing AND that the max equals 3 (the delta) + the window's commit count — proving counts are carried across walk phases as one running total rather than reported per-walk (which would still look monotonic but be wrong).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains the 'onward' motivation well but doesn't mention the specific numeric assertion (3 + window_commits) that is the actual regression check — that's only in the code comment.

### `a_rewritten_history_is_walked_again_rather_than_extended`
- spec 3 · read at `c10d44da6794` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:36Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test verifying that when a repo's history is rewritten (e.g. rebase changes commit hashes), the churn refresh logic detects the divergence and re-walks from scratch rather than folding the new log onto the old stored one — likely builds two histories that share no common ancestor commit and asserts the result reflects only the new one.
- found: Builds a repo, banks a refreshed history, amends the last commit (rewriting HEAD), then re-refreshes using the old banked state and asserts the head changed and the resulting shape matches a completely fresh walk — proving the incremental refresh detects rewrite and doesn't fold stale data in.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_commit_touching_three_files_counts_once_for_their_directory`
- spec 3 · read at `63739de855ec` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:32Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a fake git log with one commit touching three files in the same directory, parses it with parse_log, and asserts commits_of (or total_commits_of) for that directory equals 1 rather than 3 — proving directory commit counts are deduplicated per-commit rather than summed per-file.
- found: Matches prediction: builds a one-commit log touching three files in src/, parses it, asserts commits_of on the file is 1 and commits_of on the directory "src" is also 1, not 3.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `directory_commits_accumulate_and_reach_every_ancestor`
- spec 3 · read at `f47ef4001865` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:53Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds a synthetic git-log-formatted string with two or more separate commits touching a file nested several directories deep (e.g. a/b/c/file.rs), runs it through parse_log, and asserts that commits_of (or similar) on each ancestor directory (a, a/b, a/b/c) reflects the accumulated count across both commits — i.e. commit counts propagate up through every level of nesting, not just the immediate parent.
- found: Confirms the core prediction: commits_of accumulates through every ancestor directory level (a/b and a both get count 2). One detail I got wrong: the two commits touch two *different* files in the same directory (a/b/one.rs and a/b/two.rs), not the same file twice — so it's testing directory-level accumulation across distinct files, not repeated touches to one file. Also includes an extra assertion on last_touched_of confirming "newest first" ordering that I didn't predict.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `oldest_commit_sets_age_and_recent_ones_set_churn`
- spec 3 · read at `da87db8bcdd7` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:04:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a synthetic log for one file with a very old commit (long before `now`) plus several recent commits close to `now`, parses it, and asserts that `age_of` reflects the old/first commit (the file has existed a long time) while `churn_of`/commits reflects only the recent activity — confirming the two axes are computed from different ends of the commit history rather than one timestamp doing double duty.
- found: Builds a log with a.rs touched at -1d, -10d (shared with b.rs), and -400d; asserts age_of reflects the oldest commit per file (400 for a.rs, 10 for b.rs, None for an unseen path), that last_author_of returns the newest commit's author (not oldest), and that a.rs's churn exceeds b.rs's since two of its three commits fall inside the 90-day window versus b.rs's one.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_total_counts_every_commit_and_an_unseen_path_has_none`
- spec 3 · read at `9001a0184ac0` · commit `c4c6042` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:08:07Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A regression test verifying: (1) total_commits_of reports the true full commit count even when internal processing is capped/windowed, not silently truncated to the newest N commits; (2) a path git has never tracked returns None/absent, distinguished from an old-but-tracked file that just has no recent commits. Likely builds synthetic log data exceeding the cap and asserts both cases with assert_eq!.
- found: Builds a synthetic parsed log with three commits on src/a.rs (one recent, two old) and one on src/b.rs, then asserts commits_of (windowed) vs total_commits_of (all-time) diverge correctly, that directory aggregation counts a multi-file commit once, that a fully-outside-window file still has a total, that a never-seen path returns None, and that the root path aggregates everything.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc summary only covers two of the five distinct assertions this test makes — directory aggregation and the root-path case are additional properties not hinted at in the header.

### `one_pathological_file_does_not_squash_the_rest`
- spec 3 · read at `fb523f1b5799` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:07Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a synthetic commit log where one file is touched in almost every commit (pathologically high churn) while another file is touched in only a couple of commits, runs it through the history-building pipeline (parse_log/flush_commit), and asserts that the second file's churn/commit numbers come out unaffected by the first file's huge count — i.e. churn is computed per-file rather than normalized against the busiest file in the repo, so one hot file doesn't visually flatten everything else.
- found: Builds a synthetic git log with a "Cargo.lock" touched 500 times (pathological churn) and "src/hot.rs" touched only 10 times, parses it, and asserts the lockfile saturates to churn 1.0 while hot.rs still reads above 0.5 rather than being flattened toward zero by the lockfile's dominance — confirming churn is on an absolute saturating scale, not normalized relative to the busiest file.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `churn_saturates_rather_than_running_away` — OBSCURE
- spec 3 · read at `6ce81a27853d` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:13Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A unit test building a History with one file that has an extremely high commit count and another with a moderate count, then asserting churn_of returns values that compress toward some ceiling (e.g. both close to 1.0, or the ratio between them much smaller than the ratio of raw commit counts) rather than scaling linearly — showing churn uses a saturating function like log or a capped ratio so one hyperactive file doesn't dominate the churn axis.
- found: Builds a log with a single commit touching one file and just asserts churn_of returns a value within [0.0, 1.0] — it doesn't compare a high-commit file against a low-commit one or check compression of an extreme ratio at all, just bounds-checks the simplest case.
- predicted: none · documented: none · derivable: no · legible: full · trap: no
- note: The test name promises a saturation property but the body only checks a trivial single-commit case stays in [0,1]; the actual saturating behavior is asserted nowhere near this test.

### `a_directory_that_is_not_a_repo_scores_without_history`
- spec 3 · read at `7a695399e67b` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:04:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A short test that calls `read` (the public entry point) on a temp directory that has no `.git`, and asserts it doesn't error but instead returns an empty History (`is_empty()` true), so a non-repo directory still scores fine with churn/age simply absent rather than the scan failing.
- found: Calls `read` on a nonexistent/non-repo path and asserts the resulting History is empty, with churn_of returning 0.0 and age_of returning None for any path — confirming graceful degradation rather than an error.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/cli.rs

### the file itself
- spec 3 · served in 4 parts · read at `e90fbe0ecd58` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:10:51Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: The entire sanity CLI: main parses subcommands and dispatches to init, check, serve, status, summary, trace, resume, refresh, interactive. Manages ensuring a backend process is running (spawn-lock file to prevent concurrent starts, probing/health-checking, waiting for it to come up) and talks to it via get/post HTTP helpers, falling back to offline_status/offline_summary when no backend can be reached. A large chunk is terminal-output formatting helpers (fancy, plural, bar, elapsed, grade_ink, tail, commas, project_header) for rendering progress bars and grade coloring in the terminal.
- found: Full CLI: clap-based Verb enum (init/check/trace/status/summary/refresh/serve/mcp) dispatched from main; ensure_backend spawns/finds the per-machine daemon using an O_EXCL spawn-lock file with staleness-based takeover; get/post talk to it over HTTP; interactive init/check prompt for harness/model when a terminal is present; tail() live-renders progress with ANSI redraw-in-place, handling detach (Ctrl-X) vs stop (Ctrl-C), backend handover mid-run, and reconnection; read-only verbs (status/summary) fall back to in-process offline_status/offline_summary when no backend answers; retire_stale_backend hands off to a newer build.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The comments throughout explain a long history of specific production bugs each design choice fixes (Ctrl-C killing the daemon via process group inheritance, orphaned readers on SIGTERM, the scroll-region redraw eating the banner) — none of that is inferable from signatures/peers, only from having hit those bugs.

### `spawn_lock_path`
- spec 2 · read at `d361e1076438` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns the path to the one-spawner-at-a-time lock file: locates the per-machine data directory (same one the endpoint file uses) and joins a fixed filename like spawn.lock, returning None if the data directory can't be resolved.
- found: Joins crate::reports::data_dir() with "backend.lock", returning None via ? if the data dir can't be resolved.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `drop`
- spec 2 · read at `69cf296adc7d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A Drop impl for SpawnLock that releases the spawn lock by deleting the lock file on disk (best-effort, ignoring errors), so a subsequent take_spawn_lock call can acquire it again.
- found: Drop impl removes the lock file at self.0, ignoring any error (best-effort cleanup) so the spawn lock is released.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `take_spawn_lock` — QUIRKY
- spec 2 · read at `fa780535fef0` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:21Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Tries to create the spawn lock file with OpenOptions::new().create_new(true) (O_EXCL). On success, returns Some(SpawnLock) wrapping the path. On failure because it already exists, checks the file's age against SPAWN_LOCK_STALE; if stale, removes it and retries the atomic create once (racing safely with other processes), otherwise returns None to signal someone else already holds the lock.
- found: Thin wrapper that just calls take_spawn_lock_after(SPAWN_LOCK_STALE) — the O_EXCL/staleness mechanism I described (from the docs) actually lives in the peer function, not here.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `take_spawn_lock_after`
- spec 2 · read at `ed57494c5c9f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Tries to atomically create/lock the spawn-lock file; if it already exists, checks the file's age (mtime) against `stale` — if older than that threshold, treats the previous process as abandoned, removes/overwrites the lock, and takes it anyway; otherwise returns None since a live process presumably holds it. Returns Some(SpawnLock) wrapping the acquired lock (with a Drop impl to clean up), used so tests can pass a small stale duration instead of waiting for a real file to age.
- found: Attempts an atomic create_new claim on the spawn-lock file (writing the pid); if that fails because it exists, checks the file's mtime elapsed time against `stale`, and if abandoned, removes the file and retries the claim once. Returns Some(SpawnLock(path)) on success, None otherwise.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `await_backend`
- spec 2 · read at `da14bbe73ef3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:44Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Loops until deadline, repeatedly checking for a published endpoint (e.g. reading an endpoint/lock file written by whichever process is starting the backend) and probing it for liveness via probe/live, sleeping briefly between attempts. Returns Some(endpoint) once found and live, or None if the deadline passes first.
- found: Loops calling live() to check for a published endpoint, returning Some(ep) if found; otherwise checks the deadline and returns None if passed, else sleeps 250ms and retries.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I predicted it would also use probe() separately from live(), but live() alone does both lookup and liveness check.

### `probe`
- spec 2 · read at `d164870d3169` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:26Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Makes a GET /health request to the given Endpoint's URL; on success, parses the JSON response and extracts the pid field, returning Some(pid); on any failure (connection error, bad response) returns None.
- found: Delegates to a `health` helper (peer) to fetch the health response, then extracts the "pid" field as u64 and converts to u32, returning None on any failure via and_then/? chaining.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `health`
- spec 2 · read at `9b63ec0a01c4` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:52Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Issues a GET request to the backend's health endpoint (via a helper like `get`) and returns the parsed JSON body as Some(Value) if the request succeeds, or None if the backend isn't reachable or the response isn't valid JSON. Unlike a simpler `live` check that just returns a bool, this returns the full deserialized health payload for callers that need details (e.g. project list, version).
- found: Builds its own short-timeout blocking reqwest client, GETs {ep.url()}/health, and returns the parsed JSON body as Option<Value>, using ok() chaining to collapse any failure (client build, request, or parse) into None.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `retire_stale_backend`
- spec 2 · read at `c829752846d6` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:31Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Probes the currently-registered backend (via the endpoint file) for its /health build_id, compares it against this process's own build_id() from agentapi, and if they differ, POSTs to a /retire endpoint asking that backend to stand down for future callers rather than killing it — since the window's own backend is excluded/reported-and-left-alone. Any failure to probe, an old backend without /retire, or a matching build_id all fall through to doing nothing further, and the function always lets the caller's run proceed afterward rather than blocking on the mismatch.
- found: Reads the endpoint file, probes /health, compares build ids treating "unknown" on either side as indeterminate (not a mismatch). On a real mismatch, POSTs /retire; if that fails or isn't acknowledged, prints a hint (defaulting to a manual kill command) and returns, letting the run proceed against the stale backend. If retire succeeds, polls `live()` for up to START_WAIT, sleeping 250ms between checks, returning as soon as the endpoint clears or the deadline passes either way.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `live`
- spec 2 · read at `94a2ad12969a` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:25Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Reads the endpoint file to get a candidate Endpoint (via read_endpoint), then probes it with a health check to verify the backend process is actually up and responding, returning Some(endpoint) only if reachable, None if no endpoint file exists or the probe fails.
- found: Reads the endpoint file, then probes it; if the probe succeeds (returning a pid), returns the Endpoint with that pid substituted in, else None.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Didn't anticipate probe returning a pid that gets spliced back into the Endpoint rather than just a bool.

### `get`
- spec 2 · read at `311c7de833b5` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:12Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Sends a blocking HTTP GET request to ep's base URL joined with path, then parses the response body as JSON and returns it as serde_json::Value, converting any request or parse failure into an Err(String) with a description.
- found: Blocking HTTP GET to ep.url() + path, chained into .json() parsing, with any error (request or parse) mapped to its string representation.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `post`
- spec 2 · read at `6097e8772f8d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:20Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Makes a synchronous HTTP POST request to the backend endpoint's URL joined with path, sending body as JSON, then parses and returns the JSON response, mapping any network or non-success-status errors into a String error.
- found: Uses reqwest::blocking Client to POST ep.url()+path with body as JSON, chains .json() to parse response, maps any error (network or parse) to a String via to_string() — matches prediction closely.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `ensure_backend` — QUIRKY
- spec 3 · read at `2437cd3c63fc` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:45:33Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: First checks SANITY_BACKEND env var and returns that Endpoint if set. Otherwise probes for an already-live backend (via probe/health/live, possibly retiring stale state via retire_stale_backend) and returns it if found. If none is live, calls take_spawn_lock — if it wins, spawns `sanity serve` on the current executable (via std::env::current_exe) with null stdio, then waits for it to come up via await_backend; if it loses the lock, waits on the winner's backend instead of spawning its own. Returns the resulting Endpoint or an error string on timeout/failure.
- found: Checks live() first (not SANITY_BACKEND first as I guessed); if not live and SANITY_BACKEND is set, errors immediately rather than spawning. Otherwise takes the spawn lock, re-checks live() under the lock to avoid a double-spawn race, then spawns `sanity serve` via current_exe with null stdio and (on Unix) its own process group so a terminal Ctrl-C doesn't SIGINT the daemon along with the CLI. Waits for it via await_backend with a 15s deadline, returning descriptive error strings on each failure mode.
- predicted: some · documented: full · derivable: no · legible: most · trap: no
- note: The Unix process_group(0) detail — spawning the backend into its own process group so Ctrl-C on the CLI doesn't also kill the daemon — is a load-bearing fix documented only in an inline comment, not derivable from the signature; also retire_stale_backend, despite being a listed peer, isn't actually called here.

### `commas`
- spec 2 · read at `9e6a9f989078` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:51Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Formats a u64 as a decimal string with comma thousands separators (e.g. 1234567 -> "1,234,567"), by converting to a digit string and inserting commas every three digits from the right, likely via chunking and reversing.
- found: Converts n to a digit string and inserts a comma before every group of three digits from the right (checked via (len-i) % 3 == 0), building the output left to right in one pass.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `num`
- spec 2 · read at `fe762c4e62a4` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:22Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Extracts v[key] from a serde_json::Value, calls as_u64() on it, and defaults to 0 if the field is missing or not a number — a small helper for pulling numeric fields out of JSON responses from the backend.
- found: Gets v[key], converts to u64 via as_u64, defaults to 0 if missing/wrong type — exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `text`
- spec 2 · read at `7b81ea5945d2` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:27Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Looks up `key` in the JSON object `v` and returns it as a &str, falling back to an empty string "" if the key is missing or the value isn't a string.
- found: Extracts a string field by key from a JSON Value, defaulting to empty string if absent or not a string.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `resolve`
- spec 2 · read at `ad2b1804e3c0` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:30Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Calls std::fs::canonicalize on the path (via PathBuf::from(path).canonicalize()), mapping any IO error to a readable String error message, so the resulting PathBuf matches the canonical form the backend uses as project_key.
- found: Calls std::fs::canonicalize(path) directly, mapping the error to a formatted string including the original path and the error — matches prediction closely, minor difference being it doesn't go through PathBuf::from first.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `serve` — QUIRKY
- spec 3 · read at `efc3b1895176` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:07Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the loopback backend is already answering (via something like `health`); if so, prints that it's already running and returns 0 without starting anything. Otherwise it starts the backend server process/listener in the current process (no window), binding to the loopback port and blocking to serve the API, returning an exit code when it eventually stops.
- found: Idempotent early-return if already live, otherwise builds a tokio runtime, restores prior state, binds the loopback server, and enters a watch loop: it spawns a signal handler that stops all runs and exits on SIGTERM/ctrl-c, and the main loop periodically checks for retire-requests, being superseded by a newer endpoint owner (e.g. the window app), the endpoint file disappearing, or idling out — stopping all runs and releasing the endpoint on any of those exits.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The file/function doc only covers the idempotency property; the far larger surface is the shutdown-discipline invariant ("nothing this backend spawned outlives it") threaded through every exit path, including a specific past bug where a poisoned mutex read as \"not idle\" and kept the daemon alive forever.

### `interactive`
- spec 2 · read at `bd3deef0c049` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:31Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Checks whether both stdin and stdout are connected to a terminal (using something like an is-terminal check on both), returning true only if both are, so prompting is safe. False if either is piped/redirected, covering cases like `sanity check . | tee log`.
- found: Uses std::io::IsTerminal to check both stdin and stdout are terminals, exactly as predicted (the docs basically told me this one).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `choose`
- spec 2 · read at `0341d3dcc597` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Prints the prompt followed by a numbered list of `options` (and maybe marks the default), then reads a line from stdin. If the input is empty, returns `default.map(String::from)` or None. If it parses as a number in range, returns the corresponding option; otherwise treats the raw trimmed input as free text and returns Some(it) — letting the caller "type something else."
- found: Prints numbered options with the default marked, reads a line from stdin, returns default on empty/error input, parses a number to pick an option, otherwise returns the raw typed text as a free-form answer.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `reveal_in_window`
- spec 3 · read at `bb4943dd22e8` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:50Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: If `show` is false, does nothing; if true, it calls ensure_backend() to make sure the daemon is running, then fires a request (likely post) to the backend telling it to open/focus a window on the given `repo` path — swallowing any error since the docs say failures here are silent.
- found: Early-returns if show is false or ensure_backend() fails; otherwise POSTs to /open with the repo path and focus:true, discarding the result.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `init` — QUIRKY
- spec 3 · read at `a4fa56dd1271` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:31Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Resolves the given path to an absolute repo path, ensures the backend process is running (ensure_backend), and posts a request to record the harness name and optional model for that project (persisted per-project, not into global MCP config as the docs stress). Prints some confirmation text, optionally opens/reveals the app window if `show` is true, and returns a process exit code (0 on success, non-zero on failure like an invalid path or unreachable backend).
- found: Resolves and validates the repo path, records an explicit model choice independent of harness, then determines the harness either from the flag, an interactive prompt (only in a TTY, only if none configured), or by printing current status and available agents when nothing can be decided; validates/records the chosen harness, optionally prompts for a model interactively if unset, reveals the window, and prints a status/next-steps message, returning different exit codes for bad path/no agents/unsupported harness.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `check` — QUIRKY — TANGLED
- spec 3 · read at `0eab40fa38b4` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Resolves the repo path, ensures the backend is running, and spawns `readers` (or a computed default) concurrent CLI subprocesses each running as a stateless MCP client reader loop against the given `model`, looping/polling until the repo is fully read or `limit` items have been assessed. It prints live progress (using bar/elapsed/grade_ink peers), optionally detaches to run in the background if `detach` is set, and returns a process exit code.
- found: Resolves the repo, retires any stale backend, ensures the backend is up, opens the project via POST /open, resolves which model to use (from the CLI flag, else the backend's known model for that project, else an interactive prompt, else silent default), then POSTs /check to kick off the run on the backend (which owns spawning/coordinating readers, not this function). Handles the 'already running' case by attaching via `tail` instead of erroring, builds a banner explaining the model choice, and either prints-and-returns immediately (detach) or hands off to `tail` to live-watch progress with Ctrl-C/Ctrl-X semantics.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The actual reader-spawning/concurrency happens inside the backend behind POST /check — this function is just the CLI's orchestration/UX layer (model resolution, banners, attach-vs-start, detach), which the docs' framing ('this owns model choice and concurrency') slightly overstates for the function itself.

### `resume`
- spec 3 · read at `4ede0ab882c1` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:45:16Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Resolves the wanted repo path/spec via resolve, then makes a request to the backend Endpoint to (re)open that project — similar to what happens when a window opens a repo — and kicks off a fresh assessment wave (re-triggers scanning/model dispatch) on it, printing a status header via project_header and returning Err(()) on failure so the CLI can exit non-zero.
- found: POSTs /open with the repo path to the backend endpoint, checks ok, then POSTs /check with project key/model/readers/limit to restart the assessment wave, checking ok again; returns Err(()) on any failure or non-ok response, Ok(()) otherwise. No resolve() or project_header() call — those were my invention.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I predicted extra steps (resolve, project_header printing) that aren't in the actual body — it's a lean two-POST sequence.

### `fancy`
- spec 2 · read at `2ed08bb71b2e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:32Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Checks whether stdout is a terminal (e.g. std::io::stdout().is_terminal()), returning true if so, to decide whether to draw progress with carriage returns or just print plain lines.
- found: Returns std::io::stdout().is_terminal() using the IsTerminal trait.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `plural`
- spec 2 · read at `5d2354082e2b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns a formatted string like "{n} {word}" or "{n} {word}s" — appending "s" to word when n is not 1, and leaving it singular when n equals 1.
- found: Formats "n word" for n==1, else "commas(n) words" with comma-separated thousands via a `commas` helper.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed that the plural branch also comma-formats the number, not just pluralizing.

### `bar`
- spec 2 · read at `d5c39b979261` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:42Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a fixed-width text progress bar string, filling a proportion of block/fill characters equal to frac (0.0-1.0) and leaving the rest as empty characters, for display in CLI status output.
- found: Clamps frac to [0,1], rounds to nearest integer count of BAR-width filled blocks, and returns a string of that many '█' followed by '░' for the remainder.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `elapsed`
- spec 2 · read at `eb69519c2bbf` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:03Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes since.elapsed() and formats it as "{m}m{s}s" when 60 seconds or more, or just "{s}s" when under a minute.
- found: Formats since.elapsed() as seconds-only "{s}s" under a minute, or zero-padded "{m}m{ss}s" at or above a minute.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `grade_ink`
- spec 2 · read at `728d01d8f1e4` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:22Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Maps a grade string ("full", "most", "some", "none") to a pair of ANSI escape codes (start, reset) used to color terminal output, with "full" dimmed/gray and "none" the brightest/boldest, and intermediate grades getting intermediate emphasis. Likely returns empty strings when not writing to a terminal.
- found: Checks fancy() (terminal capability) and returns empty codes if not fancy; otherwise matches grade to ANSI codes: full=dim, most=no styling, some=yellow, none=bold yellow, with a fallback default of dim for unknown strings.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `tail` — QUIRKY — TANGLED
- spec 2 · read at `ebcc282fd7da` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Polls the backend Endpoint repeatedly for the project keyed by `key`, printing/updating a live progress display (bar, elapsed time, plural counts) using the banner lines as a header, until the scan reaches the state described by `want` (e.g. finished scanning, certain grades ready). Returns an integer exit code reflecting success, failure, or timeout, for use as the process's exit status.
- found: A long-lived polling loop that tails a running scan: handles Ctrl-C (stop the run) vs Ctrl-X (detach and let it continue) via signal/raw-mode key capture threads, polls /status every 2s, redraws a fixed in-place block of recent readings plus a progress bar (with reader counts, elapsed time), handles the backend dying and a new one taking over (reconnect/resume), and prints a final summary with exit code 0/1 depending on how it ended.
- predicted: some · documented: none · derivable: no · legible: some · trap: no

### `project_header`
- spec 3 · read at `3063afe4e046` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Prints a shared header block (repo name and a progress fraction — functions assessed out of total, with one consistent definition of what counts as "to go", including whether stale readings and file-level headers count) parsed out of a JSON Value, used by both status and summary (and other read-only verbs) so they no longer disagree about the denominator.
- found: Prints project name, segment count (functions+files, with excluded count), read/unread/stale counts with percentages (unread computed as remaining minus stale since remaining contains stale), a trace_depth-dependent line about history coverage and its cost if untraced, in-flight reader count if nonzero, and the assessment file location.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the trace_depth/history-cost reporting block and the in-flight readers line entirely; also didn't anticipate that 'remaining' is a superset containing stale rather than a disjoint third bucket.

### `offline_status`
- spec 2 · read at `bb642af55251` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Scans the repo in-process (no HTTP call to a backend), loads existing .sanity reports, and assembles a JSON Value shaped exactly like the /status endpoint response — with counts of functions/files/assessed/stale etc — but leaves out fields only a running backend could know (like in_flight) rather than defaulting them to zero/false, since reporting zero would falsely claim no work is in progress. Returns None if the path can't be resolved/scanned as a repo.
- found: Uses read_repo to scan and load reports in-process, computes counts via offline_counts, and builds a JSON object with project name, repo path, functions/files/excluded/assessed/remaining/stale counts and the assessment dir path — omitting backend-only fields like in_flight. Returns None if read_repo fails.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `offline_summary`
- spec 2 · read at `df7017f7e5c0` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:53Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Reads the repo's persisted .sanity state directly from disk (no running backend needed), calls the shared aggregate_of function on it to compute the same aggregate payload the /summary endpoint would produce, and returns it as a serde_json::Value, or None if no saved scan/state exists for that repo.
- found: Reads persisted scan/report state via read_repo, computes counts and aggregate via offline_counts/aggregate_of, and merges them with project header fields (name, assessment_file path, repo path) into one JSON object matching what the live /summary endpoint would return.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_repo`
- spec 3 · read at `a281610f2d73` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:57Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Performs an offline (non-backend) parse of the given repo path via the scan module, and separately loads whatever agent readings/reports have been committed to the repo (e.g. from a `.sanity` directory or similar file), returning both bundled together as a tuple — or None if the repo can't be parsed/found. It's shared groundwork used by the CLI's read-only verbs (status, summary, grades, etc.) so each doesn't need to redo the parse+load itself.
- found: Opens the scan cache, runs scan::scan with a heuristic proxy model, Ordering fidelity (not Full — proxy scores don't matter for this printer) and Untraced depth (deliberately skips git blame since these verbs only report reading coverage, not history), printing an error and returning None on failure; then loads committed agent reports via assessment::load and returns both.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The Ordering/Untraced choices are deliberate cost-saving decisions tied to what this verb prints, not defaults — worth preserving if this function is ever reused for a verb that needs real scores or git data.

### `read_verb` — QUIRKY
- spec 2 · read at `b00c20b44efb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:33Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a backend is already running at endpoint and whether it has this repo (path) open, without ever starting one itself; if the repo isn't currently open there, it returns Err with an exit code after printing/explaining which command (e.g. resume or open) the user should run instead — otherwise it returns Ok with the JSON project data fetched from the running backend.
- found: Resolves the repo path, and if no backend is live or the backend doesn't have this repo open, answers offline by computing status/summary directly from the repo's committed .sanity/ data (never starting a daemon or rescanning) rather than refusing; otherwise fetches the endpoint's JSON from the live backend keyed by project.
- predicted: some · documented: full · derivable: no · legible: most · trap: no

### `trace` — QUIRKY
- spec 3 · read at `06cc925e7006` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:17Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Opens/reads the repo at `path` (likely via read_repo), then runs the git-history fold (blame/churn/age) that a normal launch skips due to its time budget, with `lines` selecting file-level vs line-level trace depth. Prints the cost/time taken since costs are "printed rather than guarded", then saves the resulting tree to the cache so future launches see the traced data, returning an exit code.
- found: Resolves the CLI path, ensures a backend process is running, posts /open to make sure the backend knows the project, then posts /trace with a depth (lines vs files) and prints a human-readable summary of the result (time taken, whether it was stopped early, and a hint to use --lines for finer resolution) based on the JSON response — it's a thin HTTP client to the backend, not a direct in-process trace/cache operation.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The actual git-history fold and treecache save happen server-side behind /trace; this function is purely a CLI-to-backend RPC wrapper plus output formatting.

### `status` — QUIRKY
- spec 2 · read at `139061bd94ca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:45Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Resolves the repo path, queries the running backend's /status endpoint (falling back to offline_status/offline_summary if no backend is reachable), then formats the result using project_header, a progress bar, elapsed time, and grade_ink coloring, printing it to stdout and returning an exit code (0 on success, nonzero if there's no repo or data to show).
- found: Fetches /status JSON via read_verb (which internally handles online/offline), returning early on error. Then prints whether a backend is running (pid/port) and, if so, whatever it's currently reading (model, live reader count, spawned/failed counts) or 'nothing reading right now'; prints project_header; and prints either 'up to date' or a count of segments needing `sanity check`. Always returns 0 once past the initial fetch.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I predicted use of bar/elapsed/grade_ink formatting helpers and an explicit offline_status fallback call, but the function is much plainer — no progress bar or color, and the online/offline distinction is handled inside read_verb rather than here.

### `summary`
- spec 2 · read at `6685b01b20a8` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Resolves the repo path, loads the assessment data, and aggregates it into repo-wide statistics — counts of functions read, breakdown by predicted/documented/legible grade buckets, number of traps flagged, coverage percentage — then prints that as a single aggregate block (deliberately not per-file), possibly falling back to offline_summary if it can't reach a live backend. Returns an exit code.
- found: Calls read_verb(path, "/summary") to hit the backend, prints project header, then a table of predicted/documented/legible grade histograms (full/most/some/none), trap and derivable-doc counts, a by_model breakdown of reading counts, a priming (exposed vs clean) line, and a by-position curve of full-prediction rate across a reader's batch. Returns early with a "nothing read yet" message if readings is 0.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `refresh`
- spec 3 · read at `5f0b957a6aac` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a repo path, locates its .sanity/ directory, parses each stored assessment shard (Markdown) with the current-format reader, and rewrites it back out in the current format — a pure read-and-rewrite (not a schema translation) done in-process without touching any running backend. Returns an i32 exit code: likely 0 on success, and some nonzero/informational code if there's no .sanity/ or nothing to rewrite, printing a status message either way.
- found: Canonicalizes the path, bails if no .sanity/ dir exists, then runs a full (untraced, ordering-fidelity) scan to recompute keys, loads existing reports against that scan, and calls assessment::refresh which returns an Index enum (Failed/Absent/Current/Refreshed) each printing a specific status message and exit code (2/1/0/0/0).
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: I underestimated that it needs a real scan (not just raw markdown parsing) to key/match existing shards before rewriting them.

### `grades`
- spec 2 · read at `734a8bc65ba7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Formats one row of a grade histogram (full/most/some/none counts) pulled out of a JSON `Value`, right-aligning each count into a fixed-width column that lines up under a header row printed elsewhere in the CLI output. Missing or absent counts likely default to 0 rather than erroring.
- found: Formats one row of the full/most/some/none grade histogram: each count is pulled from the JSON value, comma-formatted (thousands separator via `commas`), and right-aligned to width 7, concatenated with no separator. If `v` is None, returns a single right-aligned em-dash placeholder instead of four columns.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that a None value collapses to one placeholder column rather than four zero columns, and missed the thousands-separator formatting via commas().

### `main`
- spec 3 · read at `5917cf9b9a21` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Parses args[0] as a subcommand and dispatches to the matching handler (serve, check, status, trace, summary, refresh, grades, read_repo, read_verb, etc.), printing results or errors to stdout/stderr. Returns 0 on success and a nonzero exit code for an unrecognized command or handler failure.
- found: Uses clap to parse args (with "sanity" prepended as argv[0] since callers strip it), returning exit code 2 on parse error printed to stderr or 0 if it was --help/--version. Then matches on cli.command and dispatches to serve(), mcp::run(), init(), trace(), check(), status(), summary(), or refresh(), passing through their parsed fields.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Function had no doc comment of its own; the substantive context was in the file-level doc, not attached to main itself.

### `the_progress_line_reads_correctly_at_both_ends` — QUIRKY
- spec 2 · read at `e58761c44962` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:15Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test that builds a progress line out of helper pieces (bar, elapsed, grade_ink, tail, fancy, plural, resume) and checks the resulting string is correct/well-formed at both extremes — likely the start (0% / just begun) and the end (100% / complete) of a scan, verifying things like the bar rendering, elapsed time formatting, and pluralization don't break at either boundary.
- found: A unit test verifying bar() renders 0 filled blocks at fraction 0.0, 0 empty blocks at 1.0, always the same fixed width (BAR) regardless of fraction (including out-of-range 1.4, clamped rather than panicking), and that plural() correctly pluralizes "reader"/"readers" for counts 1, 0, and 5.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: "Both ends" turned out to mean the two extremes of the bar fraction (0.0/1.0) and the fixed-width invariant, not two stages of a progress scan as I guessed.

### `a_flags_value_is_not_the_repo`
- spec 2 · read at `23ede843bbce` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:00Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A unit test that parses CLI args like ["sanity", "init", "--harness", "claude"] using the real parser and asserts the resolved repo path is the default (e.g. current dir), not "./claude" — confirming --harness's value isn't mistaken for a positional repo argument.
- found: A parameterized unit test using a path_of helper that parses CLI args via clap and extracts the resolved path from various Verb variants. It asserts --harness (both space and = forms) doesn't get treated as the repo path, that a real path wins regardless of position relative to flags, that valueless flags like --show don't swallow the next arg, and that unknown flags produce a parse error.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `only_one_caller_may_start_a_backend_at_a_time`
- spec 2 · read at `e9104fbd590c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:19Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Simulates multiple concurrent callers (e.g. threads) racing to start the backend via the spawn-lock mechanism, and asserts that only one caller actually performs the spawn (e.g. by counting spawn attempts or checking a lock file/pid), while the others detect the lock is held and wait/attach to the backend that's already starting rather than launching a second one.
- found: Sequential (not threaded) calls to take_spawn_lock(): first call succeeds, second call while held returns None, then after dropping the first guard a third call succeeds again — testing lock exclusivity and drop-based release directly rather than via simulated concurrency.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I assumed the test used real concurrent threads to race for the lock; it actually tests exclusivity/release synchronously by calling take_spawn_lock() twice in sequence.

### `an_abandoned_spawn_lock_is_taken_rather_than_blocking_forever`
- spec 2 · read at `da454e03c676` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:25Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test verifying the stale-lock-takeover logic described in the doc comment: it creates a lock file (via O_EXCL) and artificially backdates its mtime past START_WAIT, then calls the lock-acquisition routine and asserts it succeeds (takes over the lock) rather than blocking/timing out, proving an abandoned lock from a dead process doesn't wedge future callers. It may also check the complementary case that a young/fresh lock is NOT taken over.
- found: A test that verifies stale-lock takeover: it acquires the spawn lock, confirms a large age threshold (3600s) refuses to steal it (still live), then confirms a zero threshold does steal it (abandoned lock case). It also checks that after both the original holder and the thief drop their locks, a fresh caller can still acquire it — i.e. release-by-path doesn't get confused by the two lock handles pointing at the same file.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted the age-threshold behavior correctly but not the exact mechanism (a threshold parameter to take_spawn_lock_after rather than backdating mtime), and missed the release-by-path double-drop safety check entirely.

## src-tauri/src/clones.rs

### the file itself
- spec 3 · read at `0214e79cbaba` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This file implements clone/duplicate-function detection. It defines a Copies struct wrapping a per_site: HashMap<(usize, usize), Copy2> index (with an `at` lookup and a `cloned` accessor to enumerate clone groups). A find/family pair of functions walks all parsed functions, computes a normalized structural signature of each body (ignoring identifier names, per the "renamed copy is the same shape" test), groups functions sharing a signature into families, skips bodies under a minimum size floor (too small to compare), assigns group numbers in walk order, and never merges functions across separate families. The remaining declarations are unit tests verifying these specific behaviors.
- found: Clone detection: family() maps languages into comparison buckets; find() does two passes over FileView slices, hashing each function's precomputed shape into (family, shape) buckets, keeps only groups with >1 member, numbers groups by first-appearance order (not hash order) for stability across scans, and builds Copies{per_site, sizes}. Copies::at looks up a site's group/size; cloned() returns per_site.len(). Tests cover renamed-copy detection, the MIN_SHAPE_TOKENS floor, cross-language non-mixing, and stable group numbering.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `family`
- spec 3 · read at `c17625d97270` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:57Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Maps a Lang enum value to a small u8 bucket id grouping languages with similar syntax (e.g. curly-brace/C-family languages together, Python/indentation-based languages together, etc.), via a match statement, so that shape-based clone detection only compares functions within the same syntactic family and not across unrelated languages.
- found: Groups C/C++ into bucket 1, TS/TSX/JS into bucket 2, and every other language gets its own distinct bucket (3 + discriminant) — so only C-family and JS-family get merged comparison groups, everything else stays language-specific.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Only two families are actually merged (C/C++ and JS/TS family); all other languages map 1:1 to their own bucket, which is narrower than "similar syntax families" might suggest.

### `find`
- spec 3 · read at `870aaa9c3e90` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks all functions across the given files, computes a normalized representation of each function's body (so renamed copies with identical shape still match), and groups functions whose normalized bodies are equal into "families". Bodies under some minimum size (a "floor") are excluded from comparison so trivial one-liners don't count as clones. Assigns each family a sequential group number in walk order and returns a Copies struct that can be looked up by (file, func).
- found: Groups functions by a precomputed `shape` hash (combined with a language "family" bucket) into a HashMap; keeps only groups with more than one member (actual clones); numbers groups by first appearance in the file-walk order (not hash order) for stable output across runs; builds a per-(file,func) lookup table plus a sizes vector, returned as Copies.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The shape/normalization and any size "floor" happen elsewhere (func.shape is precomputed) — this function only does the grouping and stable numbering, not the hashing itself.

### `at`
- spec 3 · read at `c190261f3fd3` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:57Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Looks up the function identified by (file, func) in an internal map/index built during clone detection, returning Some(Copy2) with the group info if that function belongs to a duplicate-body group, or None if it's unique or the group was too small to count. Likely a simple HashMap lookup with .get(&(file, func)).copied().
- found: A simple HashMap lookup: self.per_site.get(&(file, func)).copied().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `cloned`
- spec 3 · read at `60044cb61216` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:03Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Sums the number of functions that belong to any clone group — total membership count across all groups — by iterating the struct's internal group/mapping data structure and counting entries (not the number of distinct groups).
- found: Returns the length of the `per_site` map — i.e. the number of functions that are members of some clone group.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_renamed_copy_is_the_same_shape`
- spec 3 · read at `ea5933d09c04` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:42Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test with two functions that have identical bodies/logic but different names, parsed and run through find(); it asserts they are detected as clones of each other despite the rename, since the shape comparison ignores function identifiers.
- found: Uses the RUST fixture (3 functions: alpha, beta, and a third distinct one), runs find(), and asserts alpha and beta land in the same clone group with size 2 (renamed bindings still count as a copy), while the third function matches nothing.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_body_under_the_floor_is_not_compared`
- spec 3 · read at `4b8d13e0fd76` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:32Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is a test asserting that the clone-detection "floor" (a minimum size/complexity threshold) excludes trivially small function bodies from comparison — it builds two tiny functions (e.g., simple accessors) that would otherwise look identical, runs the clone-family logic, and asserts they are NOT grouped as a family together, proving the floor filters them out.
- found: Parses two tiny accessor-like functions, asserts their shape is None (below MIN_SHAPE_TOKENS floor), and asserts find() reports zero cloned functions since bodies under the floor are never compared.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `families_do_not_mix`
- spec 3 · read at `7d78ba3553fa` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that creates two functions written in different languages whose token shapes (braces/parens/placeholders) happen to collide, runs the clone-family detection, and asserts they are NOT grouped into the same family/group — showing that language identity is part of what makes two functions "copies," not just shape equality.
- found: Parses a Rust file containing twin functions (RUST constant) and a TypeScript file with a function that shape-collides with them, runs find(), and asserts the Rust twins still match each other (size 2) while the TS function at index 1 matches nothing (None) — confirming clone families don't cross language boundaries even under shape collision.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `group_numbering_follows_the_walk` — QUIRKY
- spec 3 · read at `a4b38a383533` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:03Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a small fixture with a few duplicate function bodies inserted in a known file/tree order, runs the clone-grouping walk, and asserts the resulting group ids are deterministic and match walk order — not renumbered by hash-map iteration order.
- found: Parses a shared Rust fixture string into functions, runs the clone-finder 8 times, and asserts the group id at position (0,0) is always 0 — proving determinism/repeatability rather than comparing against a hash-map-derived alternative.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Uses a pre-existing RUST fixture constant rather than constructing its own — worth knowing that fixture's shape is shared across other tests in the file.

## src-tauri/src/commands.rs

### the file itself
- spec 3 · served in 3 parts · read at `8897577e4249` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:31:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This file is the full Tauri IPC surface: a flat collection of #[tauri::command] async functions, one per frontend-invokable operation, with little shared structure beyond that tag. Judging from the peer names, it groups into project management (add/select/reorder/forget/reset), git history/scanning (scan_repo, scan_history, history_log/deltas/funcs, commit_detail), code search/reading (search_project, file_functions, read_source, function_sources), execution tracing (trace_project, estimate_trace, explain_trace, stop_trace), CLI setup (install_cli, cli_status, cli_link_dirs), and misc utilities (sync_theme_menu, save_movie, read_curve, agent_reports). Most functions are probably thin wrappers that delegate real logic to other modules and just adapt types/errors for Tauri.
- found: This is indeed the full Tauri IPC command surface, grouped roughly as predicted: scanning (scan_repo, scan_history), history replay (history_tables/log/scoped/deltas/funcs, commit_detail, function_history), project lifecycle (add/select/reorder/forget/reset_project), tracing (trace_project, estimate_trace, explain_trace, stop_trace), code reading (read_source, open_code_window, function_sources), search/links (search_project, function_links), CLI install (install_cli, cli_status, cli_link_dirs), agent-facing polling (agent_reports, agent_activity, projects, harnesses, start_check/stop_check, set_reader), and misc (sync_theme_menu, save_movie, read_curve). What I underestimated: these are NOT thin wrappers — many carry substantial inline logic (progress streaming, cancellation flags, staleness/live-tree reconciliation in agent_reports, careful path-canonicalization security checks, git subprocess parsing with custom delimiters in commit_detail) and are extensively commented with design rationale (why a guard was removed, what hazard something replaced) rather than mechanical description.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The single doc line "The `invoke` surface. Frontend ↔ Rust is Tauri commands — no server, no sidecar." describes only the file's category, not its actual density of embedded design decisions and non-trivial logic per command.

### `scan_repo`
- spec 3 · read at `a2cfffd87778` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:30:12Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: The Tauri command invoked from the frontend to scan a repo: walks the pipeline (scan → parse → heuristic/surprise scoring), likely emitting progress events to the app handle along the way (feeding the assembling-map UI), registers/updates the project in the shared agentapi state, and returns the whole scored Scan tree as one payload (per the docs) rather than streaming it, converting any error to a String.
- found: Validates the path is a git repo, publishes a placeholder "restoring" project entry (in memory and on disk) before doing any work so quitting mid-scan isn't lost, runs scan::scan on a blocking thread (emitting scan-progress/scan-score/scan-shape events for the live-assembling UI), then deepens history to Depth::Files (reading the commit log, since this is an explicit user-initiated open), clears the restoring placeholder, banks scan timing stats for future estimates, publishes/updates the project in shared state and explicitly focuses it (unlike agent-initiated scans), then returns the tree slimmed of functions.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The pre-registration of a placeholder "restoring" row before the scan starts (so a slow/wrong scan is visible immediately) and the explicit distinction between window-initiated focus vs agent-initiated scans were not derivable from the doc/signature alone.

### `scan_history` — QUIRKY
- spec 3 · read at `0a84dbcc23aa` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:07Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This command resolves the repo path to a cache slug, then depending on `fresh`/`trace` either reads the cached history file, wipes it and starts fresh, or extends the existing trace with new commits since last run. The actual heavy lifting (tree-sitter parsing of each commit's changed files) is dispatched to a blocking thread (e.g. via spawn_blocking) to avoid stalling the async runtime, and the function returns the count of commits processed, converting any internal errors into a String for the Tauri boundary.
- found: Validates the path, spawns blocking work: if fresh, forgets the cached history; if trace isn't requested, just returns the count of already-stored commits (cheap); if trace is requested, it takes an exclusive "claim" lock (refusing with an error string if another trace is already running on this repo), sets up a throttled progress-emitter that records claim state before emitting the Tauri event, and runs the actual cached history walk, returning the resulting commit count.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Missed the concurrency guard (Tracing::claim) and the progress-throttling/event-emission machinery entirely — those aren't hinted at by the signature or top doc.

### `history_tables`
- spec 3 · read at `944124f67494` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:23Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command wrapper: converts the string `path` to a Path/PathBuf and delegates to a function in the `history` module (something like `history::tables`) that builds the Tables struct (paths, languages, functions, opening state) from the stored/cached history data, returning None if there's no history for that repo.
- found: Thin wrapper that converts the string path to a PathBuf and delegates to history::tables.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `history_log`
- spec 3 · read at `e828b856de48` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:04:00Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that opens the git repo at `path`, walks its commit log (optionally filtered to commits touching the directory named by `scope`), and returns a page of `count` LogRow entries starting at `offset`. It likely delegates most logic to a helper in the `history` module rather than doing the git walk inline.
- found: Thin delegation to crate::history::log, converting path to PathBuf and scope Option to a &str default of empty string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `repo_remote`
- spec 3 · read at `81f0db8182d8` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:21:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Opens the repo at `path` with git2 (or shells out to git), looks up the `origin` remote URL, falling back to the first remote if `origin` doesn't exist, and returns None if there's no remote or the path isn't a git repo. It then parses the URL's last two path segments (handling both `git@host:owner/name.git` scp-form and `https://host/owner/name` URL form via string splitting rather than a proper URL parser) and joins them as `owner/name`, stripping a trailing `.git` if present.
- found: Shells out to `git -C <path> remote get-url origin`, falling back to the first listed remote if origin doesn't exist; returns None if git fails or there's no remote. Delegates the actual owner/name extraction from the URL (scp-form or https) to a separate `slug_of` helper rather than parsing inline.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: URL-shape parsing lives in the peer `slug_of`, not in this function — I'd assumed it was inline here.

### `slug_of`
- spec 3 · read at `460d4258690f` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:21:41Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a git remote URL into an `owner/name` string: handles both HTTPS (https://github.com/owner/name.git) and SSH (git@github.com:owner/name.git) forms, strips a trailing `.git` suffix and any trailing slash, and returns None if the URL doesn't split into at least an owner and a name segment.
- found: Trims trailing slash and .git suffix, then splits on the last '/' or ':' (covering both URL and scp-style SSH forms with one rsplit) to get the last two segments as name/owner, rejecting if either is empty or owner still contains '://' (meaning there weren't really two path segments).
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The single rsplit(['/', ':']) trick handling both URL-form and scp-form hosts in one pass is neater than the two-branch parse I expected.

### `history_scoped`
- spec 3 · read at `34d7298820c1` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:43Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Loads the history for the repo at `path` and, if `scope` is given (e.g. a file or function key), filters down to the frame indices touching that scope; if `scope` is None, returns all frame indices. Returns a Vec<u32> of frame indices for the frontend to drill into.
- found: Thin Tauri command wrapper that converts path to PathBuf and delegates to crate::history::scoped, defaulting scope to empty string when None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `history_deltas` — QUIRKY
- spec 3 · read at `35f335ef166f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:14Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Tauri command that looks up the cached history state for `path` (from a global store/cache), slices the frame range [from, from+count), and returns each frame's delta serialized as serde_json::Value, returning an empty vec if history isn't loaded or the range is out of bounds.
- found: Thin Tauri command wrapper that just converts path to PathBuf and delegates to crate::history::deltas(&path, from, count) — the actual logic lives in the history module, not here.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: This is a one-line delegate to history::deltas; the real implementation is elsewhere so this signature alone doesn't tell you the folding/caching behavior implied by the doc comment.

### `history_funcs`
- spec 3 · read at `262fed1a41cb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command wrapper that loads/looks up the history state for `path` and delegates to a `history::funcs` helper to return the prefix slice of HistoryFunc from index `from` up to `from + count`.
- found: Converts the string path to a PathBuf and delegates directly to crate::history::funcs.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `warm_history`
- spec 3 · read at `dbc982ec9b36` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:34:47Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This command checks whether a history/timeline database already exists for the given repo path, and if so incrementally updates it to be current (a lightweight "top up" rather than a full rebuild); it returns a bool indicating whether an existing timeline was found and refreshed (true) or none existed (false), with errors likely swallowed since it's fire-and-forget from the frontend.
- found: Validates the path is a directory, then delegates to crate::history::warm (run in a blocking thread) with an ALL_COMMITS scope, returning false on any failure (invalid dir, thread panic, or history::warm's own false).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The actual "top up only if a timeline already exists" logic lives in history::warm, not in this function — this is just path validation plus a blocking dispatch.

### `estimate_trace`
- spec 3 · read at `1df655b4f796` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:11:14Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command wrapper — converts path: String to a Path, calls crate::trace::estimate(&path) (the free, packed-object-count-based pricing function), and maps any error to a String for the frontend.
- found: Validates path is a directory (else returns an error string), then runs crate::trace::estimate on a blocking thread via spawn_blocking and maps the join error to a String.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that estimate runs inside spawn_blocking and that there's an explicit is_dir guard before calling it.

### `explain_trace`
- spec 3 · read at `17cea7ac8c87` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command wrapper that calls KnownProjects::explain_trace() (likely reading a persisted setting/flag) and returns whether the add-project dialog should show its explanatory text about tracing.
- found: Thin Tauri command that delegates to crate::reports::explain_trace() rather than KnownProjects as I guessed.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `set_explain_trace`
- spec 3 · read at `fc38556dd57c` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:36Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A simple Tauri command that stores a global boolean flag (likely an AtomicBool or similar static) indicating whether "explain" mode is on — used later by explain_trace to decide whether to compute/return an explanation. Just a setter, no side effects beyond storing state.
- found: A thin Tauri command wrapper that delegates directly to crate::reports::set_explain_trace(explain) — the actual state storage lives in the reports module, not here.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: This file is just the invoke surface; the real flag/state lives in crate::reports, so behavior can't be fully understood from this command alone.

### `trace_project`
- spec 3 · read at `9e46f04857b0` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:30:08Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: trace_project is the Tauri command the frontend invokes to deepen git tracing on the already-open project at `path` to the requested `depth`, calling into trace::deepen (or similar) with progress/publish callbacks that emit events back to the window, using shared state to track the stop flag and current scan. It measures and returns the elapsed wall-clock time in seconds as an f32, so the UI can compare actual duration against the earlier estimate shown to the user, returning an error string on failure (e.g., repo not open or already tracing).
- found: trace_project resolves the requested depth (explicit "files"/"lines" string, or auto-escalate one step past the project's current depth), clears the stop flag and sets a running-phase placeholder, then spawns a blocking task calling trace::deepen with progress/publish callbacks that update shared locked state (running phase, and on each published chunk, the live scan + a `scanned` counter bump so the window knows to refetch). After completion it stores the reached depth/resolved counts into project.trace, records the depth via reports::note_trace for persistence across reopens, and returns elapsed wall-clock seconds.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `stop_trace`
- spec 3 · read at `16ff68f48518` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:50:12Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Resolves the project key from `path`, looks it up in shared state, and if found sets its trace.stop atomic flag to true (mirroring the HTTP stop_trace handler in agentapi.rs), returning true if a project was found and signaled, false otherwise.
- found: Computes the project key from the path, looks it up under the state lock, and sets its trace.stop flag to true if found, returning whether a project was found.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `read_source`
- spec 2 · read at `c6b6cbc66ab8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:45Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that joins rel_path onto repo, canonicalizes both the repo root and the resulting path, and returns an error if the canonicalized path isn't inside the canonicalized repo root (blocking path traversal / symlink escapes). Then it reads the file, checks its size/length against some cap, and either returns the text or an error string if it's too large, truncated, or unreadable.
- found: Runs in spawn_blocking: canonicalizes the repo root and the joined rel_path, rejects if the resolved file isn't inside the root (traversal/symlink guard), rejects if the file's byte size exceeds a 2MB cap, then reads and returns the file as a string, with each fallible step mapped to a descriptive error string.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed that it's wrapped in spawn_blocking for the async runtime, and the exact 2MB cap constant, but the security/size-check structure matched closely.

### `open_code_window`
- spec 2 · read at `b5c68b62facf` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:58Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Derives a Tauri-safe window label from rel_path by sanitizing disallowed characters, checks if a window with that label already exists (focusing it if so), and otherwise builds a new WebviewWindowBuilder pointing at the app's URL with ?code= (and repo) query params set, with a title derived from the path, then shows/focuses the new window. Returns Ok(()) or an error string on failure.
- found: Sanitizes rel_path into a label, focuses an existing window with that label if present, otherwise hand-percent-encodes rel_path and repo into a query string, builds a new WebviewWindowBuilder with sized dimensions and (on macOS) matching overlay titlebar/traffic-light positioning to match the main window, then builds and returns Ok(()) or an error string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the hand-rolled percent-encoding (avoiding a crate dependency) and the macOS-specific titlebar/traffic-light styling to match the main window — both called out in code comments as deliberate.

### `agent_reports` — QUIRKY — TANGLED
- spec 3 · read at `12623447b839` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Reads the shared agent state and filters the stored reports down to those belonging to the specified `key` (the project the window is showing, not necessarily the "active" one) — falling back to the active project if `key` is `None` — and returns a cloned Vec<Report> for the frontend's poll.
- found: Filters shared agent state to the given project key (falling back to active project), then for that project's reports: walks the live scan tree once (only if there are reports) to build a map of function id -> (body, bytes, loc), and for each stored report recomputes loc (0 if function gone), a `stale` flag via is_stale comparing against the live body/bytes, and two never-persisted 'dated' flags (legible_dated, trap_dated) that reflect whether current assessment-spec constants have moved since the reading was recorded, before returning cloned reports.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `agent_activity` — QUIRKY
- spec 2 · read at `9961e7b7663e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Locks the shared agentapi state and builds an AgentActivity snapshot struct (in-flight count, remaining/queued work, etc.) by reading fields out of the mutex-guarded state, returning a plain value for the frontend to poll via Tauri invoke.
- found: Locks shared agentapi state and returns an AgentActivity snapshot: whether an agent is "active" (last_agent timestamp within a 60s idle window), the last tool name, a pings nonce, and a list of recent (seq, tool) events mapped to AgentCall structs.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `projects`
- spec 2 · read at `609bd3dd15cc` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Locks the shared state and builds a ProjectList snapshot: the currently active/focused project (what the window should switch to, set elsewhere by sanity_open) plus the list of all known projects, so the frontend can poll it to decide what to render.
- found: Locks the shared state and delegates entirely to ProjectList::from_state to build the snapshot; this function is just a thin Tauri command wrapper.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `project_scan` — QUIRKY
- spec 3 · read at `f17018ba6714` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:53Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This Tauri command looks up the project by `key` in the shared app state, and returns the cached `Scan` (the scored function tree) for that project if one exists, or `None` if the project hasn't been scanned yet.
- found: Three-tier lookup: if the project is already loaded, return a slimmed (function-free) scan; if not loaded, mark it as `wanted` (signaling the scan queue to prioritize it) and return a cached shallow map if one exists from a previous run; otherwise, drop the lock and synchronously load a stale/cached tree from disk via treecache so a queued-but-unscanned project still shows something instead of an empty pane.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `file_functions`
- spec 3 · read at `a4341ecc8576` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:59Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that, given a project key and a list of file paths, looks up the shared scanned-project state and for each path collects the function/symbol nodes declared in that file, returning a HashMap from path to Vec<Node>. This backs the UI's "drill into a file" interaction where the ring inside a wedge shows that file's individual functions.
- found: Locks shared state, looks up the project by key, and delegates to scan.root.functions_of(paths-as-set) to get a path->Node map, defaulting to empty if project not found.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `search_project`
- spec 3 · read at `f50da62472e3` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:43Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the project by key in shared state, delegates to a crate::search backend function that queries the previously-built name index for `query`, and returns up to `limit` hits ordered best-match-first — returning an empty vec if the project has no scan/index yet.
- found: Locks shared state, looks up the project by key, and if found calls crate::search::find on the project's scan root with the query and limit; returns empty vec if project not found.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `function_links`
- spec 3 · read at `ba8562fef0bd` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:29:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that looks up the cached tree for the given project key, locates the function at path/line, and returns its Related links (callers, callees, clone group) — returning None when the tree hasn't been scanned yet or no function starts at that exact line.
- found: Locks shared state, looks up the project by key, and delegates to scan.links.at(path, line), returning None via early-return if the project key isn't found.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `function_sources`
- spec 3 · read at `85f52a03a69a` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:21Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Groups the input spans by file, reads each distinct file from disk once (using project/state lookup by key), then for each span slices out the matching lines/bytes into a Snippet. Returns a Vec<Option<Snippet>> aligned to the original spans order, with None where the file can't be read or the span falls outside the file's bounds.
- found: Looks up the repo path for the project key (returning all-None if unknown), then in a blocking task canonicalizes it and, per unique file path, canonicalizes+checks it stays within the repo root before reading and caching its lines. For each span it slices the requested line range (clamped), truncates to MAX_SNIPPET_LINES, and sets a `moved` flag if the function's name isn't found in the first 3 lines of the snippet (to detect declarations that have drifted from their recorded span).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `commit_detail`
- spec 3 · read at `db2c73ac3582` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:22Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Looks up the repo path for `key` in shared state, then runs `git show --numstat` (with a custom --format for subject/body/author/email/date/sha) against `sha` as a subprocess, parses stdout into a CommitDetail struct (message, author, files with added/removed line counts), and returns Ok(None) if the commit isn't found in this repo (e.g. non-zero git exit) rather than erroring, reserving Err for actual failures like the repo key not being registered.
- found: Looks up repo path by key (Ok(None) if unregistered), validates sha is non-empty hex-only (guarding against `git show` revision-expression injection like `--` or `HEAD~1`), then in spawn_blocking runs `git show --numstat` with a custom \x01/\x02-delimited format string, parses the header fields and per-file numstat lines (treating `-`/`-` binary markers as zero added/removed but still listing the file) into a CommitDetail.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Docs explain the UX rationale (numstat not patch) but say nothing about the sha validation or the \x01/\x02 delimiter scheme, which is the part that actually matters for correctness/safety.

### `function_history`
- spec 3 · read at `580798b5b729` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:54Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: This Tauri command looks up the project by `key` in shared state, resolves its repo path, acquires (then releases before the git call) a semaphore limiting concurrent git subprocesses to four, and calls blame::line_history for the given file path and line range, mapping any error to a String for the frontend.
- found: Looks up the project's repo path under a short-lived state lock (returning None if the key is unknown), then runs blame::line_history on a blocking thread pool via spawn_blocking, mapping join errors to a String.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted a semaphore limiting concurrent git processes to four lived in this function, but that limiting (mentioned in line_history's docs) must live inside line_history itself, not here — this command is just lock-scoped lookup + spawn_blocking.

### `sync_theme_menu`
- spec 2 · read at `38f284dd1ae9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up the app's menu by id, finds the appearance/theme submenu items (e.g. System/Light/Dark), and sets checked=true on the item matching the `theme` argument while setting the others to false/unchecked, so the native menu reflects the frontend's current localStorage-stored preference.
- found: Fetches the app's managed `ThemeMenu` state (if present) and delegates to its `select(&theme)` method, which presumably ticks the matching menu item — the actual checked/unchecked logic lives in ThemeMenu, not here.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `sync_theme_menu` #2
- spec 2 · read at `b9bdcea5cb6f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:01Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A no-op stub for platforms/configs without an app menu; empty function body doing nothing with the unused _app and _theme params.
- found: Empty function body, exactly as predicted — a no-op stub.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `stop_scan`
- spec 2 · read at `f04a714f4d1c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Sets a shared cancellation flag (e.g. an AtomicBool in global/static state) to signal a running background scan task to stop; the scan loop checks this flag and exits early, keeping whatever results were already scored.
- found: Sets a global CANCEL AtomicBool flag to true, as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `stop_history`
- spec 3 · read at `1e4b5f97a27b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:15Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command wrapper (marked #[tauri::command]) that simply calls crate::history::cancel() to signal the running history replay to stop, without returning or awaiting any result — the replay's own state keeps what it had already computed.
- found: Thin wrapper that calls crate::history::cancel() to stop the running replay.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `add_project` — OBSCURE
- spec 3 · read at `e1a49349b213` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:24Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Validates that `path` exists and is a git repository, then adds it to a persisted list of known projects (writing to some config/state file), returning an Added struct with details like project name/id, or an error string if the path is invalid, not a git repo, or already added.
- found: Despite the name, this doesn't persist anything or require a git repo. It checks the path is a directory, and if the directory itself isn't a repo, scans its immediate children for nested `.git` dirs (up to 3 names, plus a total count) so the frontend can warn the user before treating a huge folder (like ~/projects) as one project. Returns an `Added` struct with path, a project key, and that warning info; actual persistence must happen elsewhere.
- predicted: none · documented: none · derivable: yes · legible: full · trap: no
- note: The name `add_project` is misleading — this is a validation/preflight step, not the actual persistence; the real add must happen in a separate command not shown here.

### `cli_link_dirs`
- spec 2 · read at `6b071bfebc5a` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:24:32Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns a prioritized list of candidate directories (e.g. /usr/local/bin, /opt/homebrew/bin, ~/.local/bin) where the `sanity` CLI symlink could be installed, likely filtered or ordered by which are actually present on PATH.
- found: Returns a simple static list of two candidate dirs: /usr/local/bin and ~/.local/bin (no /opt/homebrew/bin, no PATH filtering/checking logic here — presumably that happens elsewhere).
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I overestimated the complexity — expected PATH-checking/filtering and more candidates (homebrew), but it's just two hardcoded paths.

### `install_cli`
- spec 2 · read at `a853479ec17b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:27Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Gets the running executable's path via std::env::current_exe(), then tries candidate bin directories (via a cli_link_dirs helper) to find one that's writable/on PATH, removes any existing stale symlink at the target "sanity" path, creates a new symlink pointing to the current executable, and returns a CliLink struct describing where it linked — or an error string if no directory was writable or the symlink creation failed.
- found: Loops candidate dirs from cli_link_dirs(), creates the dir if needed, removes any stale existing "sanity" link/file, symlinks (or hard-links on non-unix) to current_exe, returns CliLink{path, on_path} for the first dir that works (checking PATH membership), or an error string with manual ln -s instructions listing all refused dirs.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Predicted the whole mechanism correctly including candidate-dir iteration and stale-link cleanup; only missed the non-unix hard_link fallback and the manual-instructions error message format.

### `cli_status` — QUIRKY
- spec 2 · read at `d7e5137120d0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:38Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that checks whether the sanity CLI tool is installed and available on the user's system — likely checking if a binary/symlink exists at a known location (e.g. /usr/local/bin or similar) and/or running `which`/checking PATH, then returns a CliState struct (installed: bool, path: Option<String>, version maybe) describing the result so the frontend can show install/link status in settings.
- found: Checks whether this app previously linked a `sanity` binary into one of its known link dirs; separately resolves what `sanity` on PATH (or login shell PATH) points to; then canonicalizes and compares that resolved path against the currently-running executable's own path to determine if the PATH's `sanity` actually is this app instance (vs. e.g. a Homebrew install), returning all of it in CliState.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The comment explains a genuinely non-obvious motivation (two installs coexisting, PATH order deciding which wins) that the code alone wouldn't convey as clearly.

### `select_project`
- spec 3 · read at `61221aabb4d6` · commit `3528c54` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:04:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Locks the shared AppState and calls state.focus(key) (or equivalent) to set `active` to the given project key and persist it, without bumping the `touched` timestamp — since per the docs, a sidebar click is a selection, not an "open", and should not affect the most-recently-opened resolution used by keyless callers.
- found: Locks the shared AppState and calls .select(&key) on it — a one-line delegation to a `select` method on the state wrapper, which per the docs sets `active` and persists but deliberately does not bump `touched`, distinguishing a sidebar-click selection from an "open".
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `reorder_projects`
- spec 3 · read at `aa66b86ad90b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:19Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Locks the shared state and overwrites the stored project ordering with the given full list of keys, then persists the updated config/state to disk.
- found: One-line Tauri command that delegates entirely to agentapi::set_order(&state, keys).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `forget_project`
- spec 2 · read at `3c24fd237f79` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin Tauri command wrapper that locks the shared state and delegates to AppState::forget(key), removing the project's sidebar listing without touching the repo or its .sanity/ readings.
- found: Exactly as predicted: locks shared state and delegates to forget(&key).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `reset_project`
- spec 3 · read at `f0e288768938` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:31Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: reset_project is a Tauri command: it looks up the project's repo path from state by `key`, calls something like `reports::forget_all(&repo)` to wipe all cached artifacts (tree, scan log, blame, timeline) for every build tag, clears the banked pricing numbers (files/scan_ms/trace_depth) in the index, and removes/unloads the live Project from AppState so the row reverts to an unscanned state — all while leaving `.sanity/` readings untouched.
- found: Looks up the repo path from the on-disk INDEX (not live state, since a declined/pending project has no live Project), calls forget_all to wipe caches, clears files/scan_ms/trace_depth in the index, unloads (not forgets) the live project, then saves the index — unload before save so persist's merge doesn't restore the just-cleared numbers.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `save_movie`
- spec 3 · read at `523d3814ebaa` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:23Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Validates that `path` ends with `.mp4` (returning an Err string if not, to avoid overwriting an unrelated file), decodes `data` from base64 into bytes, and writes those bytes to `path` via std::fs::write, mapping any IO/decode error into the Err(String) variant.
- found: Checks the path's extension is "mp4" (case-insensitive), else returns an Err. Decodes `data` as standard base64 into bytes, returning a descriptive Err on failure, then writes the bytes to the path via std::fs::write, mapping IO errors to a descriptive Err string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `read_curve`
- spec 2 · read at `fcbe1637651f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command wrapper: looks up the project/state by `key` in `Shared`, then delegates to `agentapi::reading_curve` (or a method on the found project) to compute and return the Vec<u32> of cumulative line counts at each stopping point of a partial read, for the frontend's Read dialog.
- found: Exactly a one-line delegation to crate::agentapi::reading_curve(&state, &key), returning its Vec<u32> directly as the Tauri command's output.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `harnesses`
- spec 2 · read at `affff1c729cd` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:14Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command exposed to the frontend that iterates over Harness::all() (the known coding-agent harnesses like Claude, Codex, etc.), checks each one's availability on the machine (via something like Harness::available()/which), and returns a Vec of JSON objects with fields like name/label/available for the picker UI to render — so the frontend can show which agents are actually installed rather than requiring manual MCP configuration.
- found: Tauri command mapping Harness::all() to JSON objects with id, installed (via h.available()), models (fetched only if installed), and enumerated (whether the model list is the agent's own real catalog vs. free text), for the picker UI.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Correctly guessed availability-checking shape but didn't anticipate it also fetches each installed harness's model list and an "enumerated" flag distinguishing real catalogs from free-text entry.

### `set_reader` — QUIRKY
- spec 2 · read at `3b146afe17e3` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Looks up the project by key in shared state, and if it doesn't already have a recorded reader (harness/model), sets it from the provided harness and model options — persisting this once so subsequent calls for the same project don't overwrite it. Returns an error string if the project key isn't found/loaded.
- found: Looks up the project's repo path and name from shared state by key, then delegates to crate::reports::set_reader with the key/repo/name and the harness/model (empty strings treated as None) — the once-per-project dedup logic lives in reports::set_reader, not here.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I expected the once-per-project guard to be inline in this function; it's actually delegated to crate::reports::set_reader.

### `start_check`
- spec 3 · read at `ce75fb44f837` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:49:12Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command that locks shared state and calls agentapi::start_run directly (per the doc, bypassing loopback) with the given project key, model, readers, and limit, returning whatever JSON result that function produces — essentially a wrapper with minimal logic of its own.
- found: Wraps args into a CheckRequest (harness: None) and calls agentapi::start_run with the shared state, returning its JSON result directly.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `stop_check`
- spec 2 · read at `77d97c269c9f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:43Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the running wave/check identified by `key` in the shared Tauri state and sets a cooperative stop flag (e.g. an AtomicBool or channel signal) that the wave's loop polls between readers, rather than forcibly killing it mid-read. Returns Ok(()) on success, or an Err string if the key isn't found.
- found: Locks shared state, looks up the project by key, gets its current run (erroring with descriptive messages if the project isn't open or nothing is running), and sets the run's `stop` AtomicBool to true with Relaxed ordering.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `a_remote_url_reduces_to_owner_and_name`
- spec 3 · read at `beabaabb2a39` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:22:25Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A #[test] function asserting slug_of's behavior across the URL shapes git remotes actually take: https://host/owner/name(.git), git@host:owner/name.git (scp-form), and a deeper GitLab-subgroup-style path, checking each reduces to "owner/name". It also asserts the two must-be-None cases the docs mention — likely a URL with too few path segments (no owner) and something degenerate like an empty string or a bare host — asserting slug_of returns None rather than fabricating a partial owner/name.
- found: Table-driven test asserting slug_of over scp-form, https (with/without .git), ssh://, a GitLab subgroup path, a plain filesystem path (which also reduces to its last two segments), and two None cases: a URL with no owner/name segments and a bare string with only one segment.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I didn't anticipate that slug_of is also exercised against a plain filesystem path (not just git remote URL shapes) and reduces it the same way — the fallback-to-directory-name behavior implied in repo_remote's docs is actually tested here via slug_of itself.

## src-tauri/src/edges.rs

### the file itself
- spec 3 · read at `982de7117e88` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file builds a call graph on top of the already-parsed function list: it resolves each call site to a definition (matching by name, preferring same-directory definitions, crediting all candidates when locally ambiguous, and giving up when globally ambiguous), tracking family (e.g. C and C++ headers count as one language family) so cross-family calls don't wire. From these resolved edges it computes two per-function stats — caller count, and "locality" (the share of a function's neighbours that live outside its own directory) — exposed via Wire/Wiring types. The trailing snake_case functions are inline unit tests encoding these invariants (e.g. an uncalled function has zero callers, a function calling itself doesn't count, unwired functions have no locality rather than perfect locality).
- found: Exactly what I predicted: builds a call graph from parsed functions, resolving each call name via same-file/same-directory/global-unique tiers within a language family (C+Cpp, JS/TS/TSX families), then folds edges into per-function Wire stats (callers, calls, incident, away) and exposes locality_gap as the share of neighbours outside the function's own directory. Missed the extensive philosophical framing in the doc comment about what this refuses to claim and why it's deliberately not fed back into readings/gradings.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc comments carry a lot of design rationale (None vs zero, why not a dependency graph, why not an input to reading_hash) that isn't derivable from the code shape alone.

### `locality_gap`
- spec 3 · read at `2d7696bf7f63` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes the fraction of this Wire's outgoing/neighbor calls whose target lives outside its own directory: counts total resolved neighbor calls and how many cross directories, returns cross/total as f32. Returns None if there are zero calls, rather than defaulting to perfect locality.
- found: A thin method delegating to a free function locality_gap(Some(self.away), Some(self.incident)) — the actual ratio computation lives elsewhere, this just wraps the struct's away/incident fields.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The real logic is in the free-standing locality_gap function, not this method — this is just a field-forwarding wrapper.

### `locality_gap` #2
- spec 3 · read at `c97c2a09763d` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:59:38Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes away as a fraction of incident (away as f32 / incident as f32) to get the share of wiring leaving the directory, returning None when either input is None or when incident is zero, so an unwired function reports no locality rather than a misleading zero or perfect score.
- found: Matches (away, incident): only Some(a)/Some(i) with i>0 yields Some(a/i as f32), otherwise None.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `family`
- spec 3 · read at `a9c6fb721ab5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns a small integer "family id" grouping languages that share a call namespace: C and C++ map to the same value, and the JS/TS family (JS, TS, TSX, possibly JSX) map to another shared value. All other languages fall through to a distinct value per language, likely derived from the enum discriminant itself (lang as u8) so they remain distinguishable but don't collide with the grouped families.
- found: Groups C/C++ into family 1, JS/TS/TSX into family 2, and gives every other language a distinct value offset by 3 plus its enum discriminant, guaranteeing no collision with 1 or 2.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `at`
- spec 3 · read at `a21ff610fe57` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up a precomputed Wire struct for the given (file, func) pair from an internal map/collection on Wiring, returning Some(wire) if present, or None if that function's language resolves no calls or there's simply no entry for that key.
- found: Looks up the (file, func) key in a per_site map and returns a copy of the Wire if present, None otherwise.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `dir_of`
- spec 3 · read at `74b166571dcd` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:59Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Finds the last '/' in path and returns the substring before it (parent directory); returns "" if there's no slash, i.e. the file sits at repo root.
- found: rsplit_once('/') and takes the prefix, or "" if no slash exists.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `wire`
- spec 3 · read at `febf30c61535` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:21:34Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Three-pass implementation: (1) build a name->definition index (possibly a HashMap<&str, Vec<Def>> to handle ambiguous names) from all functions across files; (2) walk every function's call sites and resolve each call name against that index, respecting family/locality rules (skipping cross-language-family resolution, preferring local definitions when ambiguous, crediting all candidates when locally ambiguous, resolving to nothing when globally ambiguous); (3) fold the resulting edge list into a Wiring struct holding, per function, a caller count and a locality score (fraction of resolved neighbors outside its own directory). Returns a Wiring value wrapping these per-function stats plus lookup methods like `at`.
- found: Builds a name→definitions index (with family and directory) for resolvable-language functions, resolves each call site against that index (skipping self-recursion, deduplicating edges into a HashSet), seeds a per-site Wire record (calls/callers/incident/away counts) for every resolvable function so absence is a fact not a missing key, then folds edges into those per-site counts and computes incident/away neighbour counts per function, finally sorting edges for stable output and returning a Wiring struct.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: The locality score itself isn't computed here — this only produces the incident/away raw counts; locality_gap (a peer) presumably derives the ratio from these.

### `resolve`
- spec 3 · read at `182393be1725` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:00Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: resolve looks up all definitions matching `name` filtered to family `fam`, then checks tiers in order: any candidates in the same `file` win outright and are returned (even if there are several, all of them); else any candidates in the same `dir` win and are returned; else if exactly one candidate exists anywhere in the family it's returned as the sole global match; otherwise (multiple or zero global candidates) it returns an empty Vec.
- found: Looks up defs by name, filters to same family, then returns same-file candidates if any exist, else same-directory candidates if any exist, else all same-family candidates if their count is <= GLOBAL_UNIQUE (otherwise empty, treating it as an unresolvable common name).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `def`
- spec 3 · read at `67e13c921cc6` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:19Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test-fixture constructor — given a name and a list of call targets, builds a minimal FuncDef with those two fields set and everything else (location, language, etc.) defaulted/placeholder, so the scenario tests below (a_call_becomes_a_caller, etc.) can build inputs tersely.
- found: Test-fixture constructor building a minimal FuncDef from a name and call list; other fields (signature synthesized from name, empty body, no doc/owner/shape, placeholder line numbers) are filled with defaults.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `wired`
- spec 3 · read at `c1fbcab5289f` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T01:00:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Test helper that converts the (path, lang, funcs) tuples into parsed-file-like structures and calls `wire` over them, returning the resulting Wiring, letting tests describe a tiny fake multi-file repo inline instead of going through real parsing.
- found: Maps each (path, lang, funcs) tuple into a FileView struct and calls wire(&views), returning the Wiring result — exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_call_becomes_a_caller`
- spec 3 · read at `c789f01a1fab` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is a #[test] that builds a tiny fixture with one function calling another, runs the wiring/resolve pass to build the call graph, and asserts that the callee now has a caller count of 1 (verifying that a raw call edge gets turned into a caller-count fact).
- found: Test wires one file with a function 'top' calling 'helper', then checks that helper's callers count is 1, top's calls count is 1, and top's own callers count is 0.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I predicted the general shape correctly but didn't anticipate the specific w.at(dir,idx) indexing API or that it would also assert the caller's own callers=0.

### `an_unreadable_language_is_absent_and_an_uncalled_function_is_zero`
- spec 3 · read at `d739b362580b` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:25Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds two scenarios: one function in a language edges.rs can't parse/resolve calls for, and one function in a supported language that simply has zero callers. It asserts the first yields None/absent (no wiring data at all) while the second yields Some(0) or an explicit zero caller count, proving the two "no calls" cases are distinguishable in the resulting data structure.
- found: Builds a Rust orphan function and a SQL orphan function via `wired`, then asserts the Rust one's caller count is Some(0) (measured, zero) while the SQL one's is None (language never analyzed), and that `resolvable` counts only the one language that could be read.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_function_does_not_call_itself_into_the_ranking`
- spec 3 · read at `bee4285b1321` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:19Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a scan containing a self-recursive function (one that calls itself), runs it through wire/wired, and asserts that the function's caller count does not include itself — i.e., a recursive call doesn't inflate its own "called by N others" ranking.
- found: Builds a wired scan with a single self-recursive function 'loopy' that calls itself, then asserts both callers==0 and incident==0 for it, confirming self-calls don't count toward either metric.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `edges_do_not_cross_language_families`
- spec 3 · read at `1e091d35316f` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:59:28Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Constructs two functions both named "main" but in different language families (e.g. Python and Go), runs them through resolve/wire, and asserts that no call edge is created between them — same name alone must not cause cross-language wiring.
- found: Builds a Python file with a function `start` calling `main`, and a Go file defining `main` with no callers; asserts the Go `main` has zero callers (not wired to the Python call) and that the call is counted as unresolved.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_c_file_and_a_cpp_header_are_one_family`
- spec 3 · read at `10676b343bd7` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:26Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This test builds a fixture with a .c file (parsed as C) calling a function whose def lives in a .h file (parsed as C++), then asserts the call is wired despite the differing Lang values — because family() groups C and C++ into one family rather than requiring exact Lang equality.
- found: Builds a wiring fixture with a .c file (Lang::C) calling thing_init, defined in a .h file (Lang::Cpp), and asserts the header definition's callers count is 1 — confirming C and C++ are treated as one language family for edge resolution.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_locally_ambiguous_name_credits_every_candidate`
- spec 3 · read at `d34d7e370bd2` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Unit test verifying that when a call site's name resolves to multiple equally-plausible local candidates (locally ambiguous, e.g. same name defined twice in one file), the resolver credits all of them as being called rather than arbitrarily picking one or dropping the call — asserting each candidate's caller count increments from a single call site.
- found: Constructs a file with a caller `top` and two functions both named `parse` (one with an owner/impl block), calls `parse` once from `top`, and asserts both `parse` definitions get callers=1 — confirming a locally ambiguous name credits every same-named candidate rather than picking one.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_globally_ambiguous_name_resolves_to_nothing`
- spec 3 · read at `98cb58005543` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:11Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Defines the same function name (e.g. get) in multiple different directories with no local candidate near the caller, has some function call that name, and asserts none of the candidates get credited as callers — i.e., when a name is ambiguous across the whole repo rather than locally, the call resolves to nothing rather than crediting every candidate.
- found: Two-part test: (1) 'get' defined in two different dirs, both far from a caller of 'get' — neither gets credited (callers==0 each) and w.unresolved==1; (2) same name defined exactly once repo-wide does resolve (callers==1), confirming the rule is about ambiguity not distance.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_local_definition_shadows_a_distant_one`
- spec 3 · read at `861dfa415c5a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:50Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is a test asserting that resolve() (or similar name resolution), when a called name has both a definition in a near directory tier and one further away, picks only the near-tier definition(s) and excludes the far one — not merging both into the candidate set. It likely builds a small fixture with two same-named defs at different distances and asserts the resolved set only contains the near one.
- found: Builds a wiring fixture with a same-file helper and a same-named helper in another directory, then asserts the same-file definition's callers count is 1 (credited by the call) and the distant same-named one's callers count is 0 — confirming shadowing rather than merging across tiers.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `locality_is_the_share_of_neighbours_outside_the_directory`
- spec 3 · read at `1dd4fe9ecbf3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:00Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds a wired scan with a function that has several call neighbours, some in the same directory and some in other directories, then asserts its locality_gap (or similar field) equals the fraction of those neighbours that are outside its own directory (e.g., 2 outside of 3 total → ~0.67).
- found: Three functions across two directories: hub calls near (same dir) and far (other dir); asserts hub's locality_gap is 0.5, near's is 0.0 (called only from next door), far's is 1.0 (called only from elsewhere) — testing locality_gap from all three participants' perspectives, not just the caller's outgoing share.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `an_unwired_function_has_no_locality_rather_than_perfect_locality`
- spec 3 · read at `cd90ab451c24` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:41Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds a Wiring/Wire for a function that has no incoming or outgoing calls, computes its locality_gap, and asserts the result is None (not Some(0.0)) — confirming that a disconnected function is treated as having undefined locality rather than perfect (zero-gap) locality.
- found: Unit test: builds a single-function file with no calls at all, then asserts locality_gap() on that function is None, confirming disconnected functions get no locality value rather than 0.0.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_mutual_pair_counts_once_from_each_side`
- spec 3 · read at `c72802fc0d80` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:37Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A #[test] function that sets up two functions which call each other (a mutual pair), runs the edge-resolution logic (wire/resolve), and asserts each function ends up with exactly one caller count — verifying that a reciprocal call relationship isn't double-counted as two callers for either side.
- found: Builds a Rust file with two functions ping/pong that call each other, wires the edges, and asserts each function's `incident` (caller) count is 1, not 2 — confirming a mutual call pair is counted once per side.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/harness.rs

### the file itself
- spec 3 · served in 2 parts · read at `98362179931f` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Defines the Harness type enumerating supported coding agents (Claude, Codex, OpenCode, Gemini/Antigravity, etc.) with methods to parse/identify a harness by name, locate its binary and check availability (which, is_runnable), enumerate its models, and build the sandboxed launch environment/command (via_login_shell, mcp_config, reader_command, write_config) that spawns a reader as a restricted MCP client with no filesystem access to the repo. Tests at the bottom enforce that isolation (readers launched outside the repo, can't reach the filesystem) and harness-specific quirks (Gemini vs Antigravity not conflated, each pointed at its own config).
- found: Defines Harness (Claude, Codex, OpenCode, Agy) with parse/name/label/program, an available()/resolve() pair that finds the binary via inherited PATH, login shell, or a short list of known install dirs (all cached), and per-harness model enumeration (Codex via JSON-RPC app-server, OpenCode/Agy by shelling out and parsing output, Claude via a hardcoded alias list since it has no real catalog). write_config and reader_command build per-invocation, per-harness isolation: a scratch cwd outside the repo, harness-specific MCP config (flag for Claude, a private CODEX_HOME with a symlinked auth.json for Codex, opencode.json/.agents/mcp_config.json for the others), and flags that strip approval prompts and repo-brief priming. warm() prefetches all this on a background thread so the Read dialog isn't slow. Tests assert the PATH-fallback behavior, name round-tripping (gemini deliberately rejected rather than aliased to agy), cwd isolation, the Claude tool allowlist, and that Agy's config lands where --add-dir makes it discoverable.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `parse`
- spec 2 · read at `bd103db291a6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:07Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A match/lookup on the string s against known harness name literals (e.g. "claude", "codex", "agy", "opencode"), returning the corresponding Harness enum variant wrapped in Some, and None for any unrecognized string (including "gemini", which is deliberately not mapped to Agy).
- found: Trims and lowercases the input, then matches against known harness aliases ("claude"/"claude-code", "codex", "opencode", "agy"/"antigravity"), returning the matching Harness variant or None otherwise.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted the shape correctly but missed the trim/lowercase normalization and the specific alias pairs (claude-code, antigravity).

### `name`
- spec 2 · read at `8ce0121ef21e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:36Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A match over the Harness enum variants (Claude, Codex, Opencode, Agy, etc.) returning each variant's short lowercase identifier string, used elsewhere for labeling/config.
- found: Match over the four Harness enum variants returning each one's lowercase static string identifier.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `label`
- spec 2 · read at `1939ccacef2e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:02Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A match statement over the Harness enum variants (Claude, Codex, opencode, agy, etc.) returning a static human-readable display string for each, e.g. "Claude Code", "Codex", "opencode".
- found: Simple match over the four Harness variants returning their static display labels: "Claude Code", "Codex", "opencode", "Antigravity".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The doc string "What a person calls it" applies to the file/type level, not this specific function body detail (e.g. Agy maps to "Antigravity" which isn't derivable from the variant name alone).

### `program` — QUIRKY
- spec 2 · read at `6407d229b2ba` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A match over Harness enum variants, returning the literal PATH executable name for each variant (e.g. "claude", "codex", "opencode", "agy"), a pure lookup with no side effects.
- found: Simply delegates to self.name() rather than containing its own match/lookup table.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: Expected an inline match producing the executable name; instead it's a one-line delegation to name(), implying program() and name() are treated as aliases (or program name happens to equal the internal name).

### `available` — QUIRKY
- spec 2 · read at `48ce4fb30fdf` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:08:07Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Calls self.program() to get the expected binary name, then uses the `which` helper to check whether that binary can be found on PATH, returning true/false as a cheap pre-check before spawning agents.
- found: Resolves the binary path via self.resolve() (cached), returning false if not found; then actually spawns it with `--version` (stdio suppressed) and returns whether that succeeded, proving the binary is not just present but actually runnable — not merely a PATH lookup via `which`.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I assumed it just checked PATH presence via `which`; it actually runs `--version` to prove the binary is genuinely executable, which the doc explains is the point (a broken install or stub satisfies mere existence).

### `all`
- spec 2 · read at `7ad4df3219b0` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns a fixed array of all 4 Harness enum variants (Claude, Codex, OpenCode, and Agy, based on sibling functions like codex_models/opencode_models/agy_models/claude_aliases) — a simple const-like list with no branching logic.
- found: Exactly as predicted: returns [Claude, Codex, OpenCode, Agy].
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `enumerates`
- spec 2 · read at `df3ab97c1975` · commit `10d6afa` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:03:21Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A match on the Harness enum variant that returns true for Codex, Opencode, and Antigravity (which have real model catalogs) and false for ClaudeCode (which only has aliases), used by the UI to decide whether to show a free-text model field.
- found: Returns true for every Harness variant except Claude, matching my prediction exactly, though written as a negation rather than an explicit enumeration.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment fully explained the why; the code itself gives no hint of the reasoning, just an inverted match.

### `models`
- spec 2 · read at `3aa8ee740c71` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:06Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Harness::models is a dispatcher — a match on self (Claude/Codex/OpenCode/Agy variant) that delegates to the harness-specific enumeration method (claude_aliases, codex_models, opencode_models, agy_models) and returns whatever Vec<ModelChoice> that produces, unifying the "properly enumerated" and "alias list" cases behind one signature.
- found: Checks a static process-wide OnceLock<Mutex<HashMap>> cache keyed by harness name first; on miss, dispatches to the harness-specific method (codex_models/claude_aliases/opencode_models/agy_models), caches the result, and returns it.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `codex_models`
- spec 3 · read at `5afe7fba648d` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:53Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Spawns the codex binary as a subprocess with piped stdin/stdout, writes an `initialize` JSON-RPC request followed by a `model/list` request. Reads stdout on a separate thread so a deadline/timeout can be enforced from the calling thread (e.g. via a channel with recv_timeout), scanning replies for one whose id matches the model/list request. Parses the matching response into a Vec<ModelChoice>, returning an empty vec on any spawn failure, write failure, parse failure, or timeout.
- found: Spawns `codex app-server`, writes initialize + model/list JSON-RPC requests, keeps stdin deliberately open (closing it early makes the server exit before replying, per inline comment), reads stdout on a thread scanning for the response with id 2, waits up to 10s via a channel, then kills the child and parses the result array into ModelChoice, filtering out entries marked `hidden`.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The keep-stdin-open requirement is a non-obvious, previously-broken behavior (closing stdin after write caused an always-empty list) — worth flagging to anyone tempted to 'clean up' the drop timing.

### `opencode_models` — QUIRKY
- spec 3 · read at `bc36ff03a605` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:45:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Runs the `opencode models` CLI command (likely via `via_login_shell`), captures stdout, and splits it into lines of the form "provider/model". Each non-empty line is trimmed and turned into a ModelChoice (id = the "provider/model" string, label = same or a prettified version). Returns the resulting Vec<ModelChoice>, possibly empty if the command fails or opencode isn't installed.
- found: Resolves the opencode binary path, runs `<path> models`, parses stdout lines containing '/', then filters them down to only providers found in opencode's own auth.json (via opencode_providers()) — showing everything if that credential list is empty or unreadable — before mapping survivors into ModelChoice{id,label,default:false}.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `agy_models`
- spec 2 · read at `c6add828cfcf` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Runs `agy models` as a subprocess (likely via via_login_shell, given the peer), captures stdout, and parses each line by splitting on a tab character into an id and display name; lines without a tab (like the "Fetching available models..." banner) are skipped. Collects the parsed pairs into a Vec<ModelChoice>, with no explicit default/isDefault marking since the doc doesn't mention one.
- found: Runs `agy models` via the resolved binary path, captures stdout, splits each line on the first tab into id/label (skipping lines without a tab or empty id, e.g. the "Fetching..." banner), and collects into Vec<ModelChoice> with default always false.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Guessed via_login_shell for spawning; actual code runs the resolved path directly — a minor mechanism miss, core parsing logic was exact.

### `claude_aliases`
- spec 2 · read at `ccb58c4703fd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns a hardcoded Vec<ModelChoice> built from the four fixed alias names mentioned in the docs — "fable", "opus", "sonnet", "haiku" — each wrapped into a ModelChoice struct/variant, since these are deliberately written down rather than enumerated live like Codex's versions.
- found: Maps the four fixed alias strings ["haiku", "sonnet", "opus", "fable"] into ModelChoice{id, label, default} where id==label==the alias and default is true only for "sonnet", chosen as the mid-range default since Claude Code reports no default itself.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that one of the four is picked as the default (sonnet), with a comment explaining why — a detail the docs on the function didn't mention but an inline comment did.

### `resolve` — OBSCURE
- spec 3 · read at `159dee955238` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This method tries three resolution strategies in order of cost: first `which()` against the inherited PATH, then asking the user's login shell for its PATH and searching that, then falling back to a fixed list of common install locations. It returns the first absolute path that passes `is_runnable`, or `None` if all three fail.
- found: A static OnceLock-guarded HashMap cache keyed by harness name. On a hit it returns the cached Option<PathBuf> immediately; on a miss it calls self.look() to do the actual resolution, stores the result in the cache, and returns it.
- predicted: none · documented: most · derivable: no · legible: full · trap: no
- note: The three-tier PATH/login-shell/fixed-list strategy described in the docs actually lives in the peer function `look()`; `resolve()` itself is just a process-wide memoization cache wrapper around it.

### `look`
- spec 2 · read at `fb3565d5d1d7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Harness::look resolves the on-disk binary for this harness variant (claude, codex, opencode, etc.) by trying `which`/`via_login_shell` lookups for the harness's program name, returning Some(PathBuf) if found and None otherwise. It's the underlying probe that `available`/`is_runnable` build on.
- found: Tries which(prog) then via_login_shell(prog), and if both fail falls back to a short hardcoded list of common install dirs (~/.local/bin, /opt/homebrew/bin, /usr/local/bin, ~/.bun/bin, ~/.volta/bin), returning the first runnable match.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the third-tier hardcoded candidate-directory fallback.

### `is_runnable`
- spec 2 · read at `338b2a723696` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:26Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks that the path exists and is a regular file, then on unix checks the file's permission bits include an executable bit (mode & 0o111 != 0); on other platforms it probably just returns whether it's a file.
- found: On unix, checks metadata is a file and has any executable bit set (mode & 0o111); on non-unix platforms, falls back to just is_file().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `which`
- spec 2 · read at `a93abc71387b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:08Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Splits the PATH env var by the platform's path separator, joins each directory with `prog`, and returns the first resulting path that exists on disk (possibly checking executability). Returns None if PATH is unset or no directory contains the program.
- found: Splits PATH by platform separator, joins each dir with prog, returns first path for which is_runnable() is true, or None if PATH is unset or nothing matches.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `via_login_shell`
- spec 2 · read at `69d673cf9290` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:21Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Spawns the user's $SHELL (falling back to /bin/sh or similar if unset) with -l -c "command -v <prog>", captures stdout, trims whitespace, and returns Some(PathBuf) if non-empty, else None if the shell command fails or prints nothing.
- found: Gets $SHELL (or /bin/sh fallback), runs it with -lc "command -v <prog>", stdin/stderr null. Returns None on spawn failure or non-success exit. Trims stdout to a path and returns it only if is_runnable(&p) passes.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `via_login_shell` #2
- spec 3 · read at `444f25d9976b` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:50Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A platform-gated stub (likely #[cfg(not(unix))]) — since Windows has no login-shell concept, it just returns None unconditionally, ignoring _prog.
- found: Unconditionally returns None, ignoring the argument — a non-unix platform stub for the login-shell PATH lookup.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `mcp_config`
- spec 2 · read at `b2d4e63edaf4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:12:52Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds and serializes to a JSON string an MCP server config object naming the `exe` path as the command to launch, with `backend` and `project` passed in as args or environment variables — likely a {"mcpServers": {"sanity": {"command": ..., "args": [...], "env": {...}}}} structure used to write a per-invocation config file for the spawned reader agent, keeping it out of the user's own ~/.claude.json.
- found: Serializes a JSON MCP server config naming exe as the command with args ['mcp'], and env vars SANITY_ROLE=reader, SANITY_PROJECT=project, SANITY_BACKEND=backend so the spawned reader knows its role/project/backend without touching the user's own MCP config.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `opencode_providers`
- spec 2 · read at `541932c3294f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Locates opencode's own auth/credentials file (likely under a config or data dir, e.g. ~/.local/share/opencode or ~/.config/opencode), reads and parses it as JSON, and returns the list of provider id keys that have stored credentials. Returns an empty Vec if the file is missing or unparsable, since this is a "what's available" probe rather than something that should panic.
- found: Reads $XDG_DATA_HOME/opencode/auth.json (falling back to ~/.local/share/opencode/auth.json), parses it as a JSON object, and returns its keys as the provider ids with stored credentials. Returns an empty Vec on any missing path/file/parse failure.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `warm`
- spec 2 · read at `def742d8a3bd` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Spawns a single background thread that sequentially resolves each of the ~4 supported harnesses (looking up the binary, running --version, enumerating models) to populate the shared mutex-guarded resolver/model caches, with no return value and nothing waiting on completion.
- found: Spawns one background thread that iterates all harnesses, and for each one that's available, calls .models() (discarding the result) to prime its cache.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `supported`
- spec 2 · read at `d32c01a289c0` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:53Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates over Harness::all(), maps each variant to its name/label, and joins them with ", " to produce a string like "claude, codex, gemini" for use in error messages.
- found: Maps Harness::all() to names and joins with ", ", exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `toml_string`
- spec 2 · read at `8504a333ca24` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:54Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Wraps `s` in double quotes and escapes backslashes and embedded double quotes (basic TOML string escaping), returning the quoted, escaped String for safe embedding in generated TOML config text.
- found: Exactly as predicted: quotes the string and escapes backslashes then quotes via replace.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `write_config` — QUIRKY
- spec 2 · read at `f31d79b88879` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:52Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Matches on harness and, for each non-Claude harness, writes the appropriate MCP config file into dir (the reader's scratch working directory) — opencode.json for opencode, .agents/mcp_config.json for Antigravity, and a Codex-style TOML config (using toml_string) for Codex — each pointing at exe as the MCP server command with backend/project passed as args or env so the reader connects to the right Sanity backend. For Claude it's a no-op since Claude takes --mcp-config as a CLI flag instead.
- found: Matches on harness: Claude is a no-op (uses --mcp-config flag). Codex gets a private CODEX_HOME under dir with a symlinked auth.json (never copied) and a config.toml declaring the sanity MCP server. OpenCode writes opencode.json with an mcp.sanity block. Antigravity (Agy) writes .agents/mcp_config.json with an mcpServers.sanity block. All non-Codex configs pass SANITY_ROLE/PROJECT/BACKEND via an env object; Codex inlines them in the TOML.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Missed the Codex-specific auth isolation logic (private CODEX_HOME, symlinked auth.json, why --ignore-user-config and per-key overrides don't work) — assumed it would just be a similar config-file write like the others.

### `reader_command` — QUIRKY
- spec 3 · read at `97330b944fca` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:09Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Matches on `harness` to build a per-agent tokio::process::Command: resolves the right CLI binary/args for that harness (claude/codex/gemini/opencode/antigravity, etc.), passing `model` and `prompt` in whatever form that CLI expects (arg vs stdin), pointing it at an MCP config (possibly writing one via write_config first) so the reader only has the three sanity_* tools and, for Claude specifically, no filesystem tools. Sets env vars that carry `project`/`backend`/role info through to the MCP shim, and sets the command's working directory to `cwd` (deliberately outside the repo) so the reader can't stumble onto the repo's own files/brief.
- found: Matches on harness (Claude/Codex/OpenCode/Agy), building very different flag sets per binary's quirks: Claude gets --strict-mcp-config + --allowedTools + --setting-sources user to keep it sandboxed and un-primed; Codex needs --dangerously-bypass-approvals-and-sandbox (weaker settings silently no-op MCP calls) plus a CODEX_HOME env pointing at a written config; OpenCode reads opencode.json from cwd with no per-invocation MCP flag; Agy needs --add-dir cwd or it silently loads no MCP at all. Common tail sets current_dir, null/piped stdio, and kill_on_drop(true) so readers die with their spawning task.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Each harness branch encodes a specific hard-won failure mode (e.g. Codex reporting success with zero actual tool calls, Agy silently loading no MCP) that isn't visible from the signature — worth reading the inline comments before touching any branch.

### `an_agent_is_found_without_a_shell_path`
- spec 2 · read at `81c427e9f09d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:32Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test that temporarily sets PATH to a minimal Finder-launched-style value (like /usr/bin:/bin:/usr/sbin:/sbin), then calls the harness's resolve/which/look function to find an installed coding agent, asserting it's still found (e.g. by checking known install locations like ~/.local/bin or /opt/homebrew/bin directly rather than relying on PATH). If no agent is actually installed on the machine, the test is skipped rather than failing, to avoid a false failure in CI.
- found: Finds an installed harness via resolve() (warming its cache), records the real path, sets PATH to a minimal Finder-style value, calls look() (a cache-bypassing/blind variant, not resolve) to confirm it still finds the same path, restores PATH, then asserts the blind lookup matches. Skips (returns early) if no agent is installed at all.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: I guessed 'which/look' generically but didn't know look() specifically exists to avoid a warm-cache false pass — that's the key subtlety the comment calls out.

### `a_harness_name_round_trips`
- spec 2 · read at `c6cbbc8dab35` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A unit test asserting that converting a Harness variant to its string name and back via Harness::resolve/look yields the same variant — likely iterating over all harness variants (claude, gemini, opencode, antigravity, etc.) and checking Harness::resolve(h.name()) == Some(h) or similar round-trip equality.
- found: Test iterating Harness::all() variants, asserting Harness::parse(h.name()) round-trips to Some(h); also checks an alias/case-insensitive form ('Claude-Code' -> Claude) and an unknown name ('cursor' -> None).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_reader_is_never_launched_inside_the_repo`
- spec 2 · read at `37a056ae5cca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:55Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A #[test] that builds the command/config used to spawn a reader (via reader_command or similar) for a given repo path, then asserts the working directory set for that spawned process is NOT the repo's own path — confirming readers are launched pointed away from the repo so they can't pick up its CLAUDE.md/AGENTS.md and falsely report themselves as cold.
- found: A #[test] that loops over every Harness variant, builds its reader_command pointed at repo "/repo" but with an explicit "away" cwd ("/tmp"), and asserts the spawned process's current_dir equals "away" (not the repo) for every harness — confirming no harness accidentally launches its reader inside the repo.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `the_shims_environment_carries_the_project_and_the_role`
- spec 2 · read at `ab67f1afb80c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:42Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test verifying that when a reader command/config is built, the project key and role are passed as environment variables on the spawned shim process rather than embedded anywhere in the prompt/tool-schema text. It likely constructs a Harness or reader_command, asserts the resulting env map contains the expected project/role entries, and asserts the prompt string does not contain them.
- found: Unit test that builds mcp_config for a given binary/backend URL/project path and asserts the generated config JSON string contains SANITY_ROLE, SANITY_PROJECT, and SANITY_BACKEND env entries with the expected values.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_claude_reader_cannot_reach_the_filesystem`
- spec 2 · read at `f2f2f13c6dbd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:34Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that builds the reader command/config for a Claude-flavored harness and asserts its --allowedTools argument contains only the three named MCP tools (sanity_next/reveal/report), with no filesystem, bash, or general-purpose tool names present — verifying a Claude reader is confined to the sanity MCP surface.
- found: Builds a reader_command for Harness::Claude and inspects its CLI args: asserts --strict-mcp-config and --allowedTools are present, finds the arg containing the tool allowlist and checks it contains sanity_next/sanity_reveal/sanity_report but not \"Read\", and asserts no --model flag is passed when none was requested.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the --strict-mcp-config check and the assertion that no --model flag is injected by default.

### `gemini_is_not_an_alias_for_antigravity` — QUIRKY
- spec 2 · read at `13a38e2892f0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:16:14Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test that resolves the harness/agent name "gemini" and asserts it produces a distinct Harness variant/config from "antigravity", confirming that a project configured for the deprecated Gemini CLI does not silently get treated as configured for Antigravity, even though the two are related.
- found: Asserts "agy" and "antigravity" both parse to Harness::Agy, but "gemini" parses to None (unsupported, not merely a distinct harness) — plus a loop confirming every supported harness's name round-trips through parse and appears in supported().
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `an_antigravity_reader_is_pointed_at_its_own_config`
- spec 2 · read at `14b8276bfa6b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:51Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Test that spawning/configuring an Antigravity reader writes its MCP config file to the exact path Antigravity's `agy` binary looks for it, and that the generated reader command includes the corresponding `--add-dir` (or similar) flag pointing at that same location — asserting both halves together so neither a misplaced config file nor a missing directory flag would go unnoticed.
- found: Writes the Agy config to a temp dir and checks the resulting `.agents/mcp_config.json` has the sanity MCP server entry with the reader role and project env vars set correctly. Separately builds the reader command and asserts it has an `--add-dir` flag whose value equals the same temp dir path — verifying both the config file's location/content and the command's directory flag point at the same place.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Got the two-halves structure right; missed the specific config path (.agents/mcp_config.json) and the env var checks (SANITY_ROLE/SANITY_PROJECT).

## src-tauri/src/heuristic.rs

### the file itself
- spec 2 · read at `50076f351b4c` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:53Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Implements the offline heuristic "surprise" proxy: tokenizes function bodies (lex/words), computes several independent signals — structural branch density, vocabulary novelty vs. a corpus, near-duplicate/distinctiveness detection via shingling and Jaccard similarity, whether a doc comment adds information beyond the signature ("documented"), and incompressibility as an unpredictability proxy — then combines and calibrates them into one bounded surprise score. Includes unit tests covering edge cases like tiny functions, non-ASCII text, and duplicate handlers.
- found: Offline heuristic "surprise" proxy combining four 0..1 signals (distinctiveness via shingling/Jaccard, vocabulary novelty vs. signature, incompressibility via deflate, branch density) with fixed weights, then calibrated through a skewed curve; each term abstains to UNDECIDED=0.5 on insufficient evidence to avoid biasing tiny functions as hot. Also includes a separate lexical `documented()` doc-coverage estimate. Extensive unit tests cover each edge case.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `linmap`
- spec 2 · read at `f8ee7245574d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes (v - lo) / (hi - lo) to linearly rescale v from [lo, hi] into [0, 1], then clamps the result to that range to guard against v falling outside [lo, hi].
- found: Linearly rescales v from [lo,hi] to [0,1] via (v-lo)/(hi-lo), clamped to [0,1].
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `words`
- spec 2 · read at `3a6091c43ac8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:21Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Tokenizes source text into lowercase word-parts by scanning characters, splitting identifiers at camelCase/snake_case/kebab-case boundaries and on punctuation/whitespace. It then filters the resulting words, dropping any shorter than 3 characters and any considered "structural" (via is_structural), returning the remaining lowercase words as a Vec<String>.
- found: Character-scan tokenizer: splits on non-alphanumeric chars and on lowercase→uppercase transitions (camelCase), lowercases everything, then filters out words under 3 chars or flagged structural.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `is_structural`
- spec 2 · read at `6499097e3618` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:03Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a given word is one of a hardcoded set of common language keywords/plumbing tokens (e.g. "let", "self", "return", "err", "if", "for", "const", "func") shared across languages, returning true if so — used to filter these out before computing vocabulary similarity between functions so unrelated functions don't look similar just from shared syntax words.
- found: Checks membership of a word in a large hardcoded list of cross-language keywords/plumbing tokens (let, self, return, err, class, import, etc.), returning true if it's in that structural/noise set.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lex`
- spec 2 · read at `71bb58aefa58` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:01Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Iterates src.char_indices(), tracking a start index for the current run. When it sees an alphanumeric or underscore char, extends the current identifier run; when it hits whitespace, ends any run and skips; when it hits any other punctuation character, ends any current run and pushes that single character as its own one-char token slice. Collects and returns all these &str slices (identifier runs and individual punctuation marks) as a Vec<&str>, using byte offsets from char_indices to slice safely at codepoint boundaries.
- found: Uses a peekable char_indices iterator: skips whitespace, greedily extends alphanumeric/underscore runs into identifier slices via peek-ahead, and emits every other char as its own single-char punctuation token, all using byte offsets so multi-byte UTF-8 is sliced safely.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Docs explained the why (whitespace-splitting glues punctuation to identifiers; byte-stepping panics on multibyte chars) but not the peekable-lookahead mechanism itself — that part was derivable from the signature and problem statement though.

### `shingles`
- spec 2 · read at `ebfd5c09109e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:14Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Calls `lex` to tokenize the source (keeping keywords, unlike `words`), then slides a window of 3 consecutive tokens across the stream, hashes each triple (likely via `fnv`) into a u64, and collects the results into a HashSet<u64> for later Jaccard comparison between functions.
- found: Lexes the source into tokens, returns empty set if fewer than 3 tokens, otherwise slides a window of 3 tokens, joins each triple with spaces, hashes with fnv, and collects into a HashSet<u64>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `fnv`
- spec 2 · read at `9383702865ee` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:26Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A hash function that iterates over `bytes`, maintaining a running `u64` accumulator initialized to an FNV-offset-like value, XORing in each byte and multiplying by a constant that looks like FNV-1a's prime but is actually a "0x1000_0000_01b3" typo/variant (same digits, mis-grouped) rather than the true FNV-1a prime — so it mixes similarly but isn't real FNV-1a, matching the doc's admission that this is deliberately left uncorrected.
- found: FNV-1a-shaped hash: starts from the standard FNV offset basis, XORs each byte into the accumulator then multiplies by a constant, but the multiplier (0x1000_0000_01b3) is not the real FNV-1a prime (0x0000_0100_0000_01b3) — same digits, mis-grouped, per the doc's explanation. Uses wrapping_mul for overflow-safe multiplication.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `jaccard`
- spec 2 · read at `5e908dda6254` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:23Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Computes the Jaccard similarity coefficient between two sets of u64 hashes (likely shingles): intersection size divided by union size, returning 0.0 if both sets are empty to avoid division by zero.
- found: Standard Jaccard coefficient over two u64 hash sets, with an early return of 0.0 for empty inputs and a defensive union==0 check before dividing.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `incompressibility`
- spec 2 · read at `0b49fd4d2b9a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:20Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Deflate-compresses the body string (likely via flate2) and returns a ratio of compressed length to original length (or its inverse) as an f32 score, where text that compresses poorly (little repetition) scores high, indicating less boilerplate/more surprising code. It may include a guard or early return for very short bodies where compression ratios are unreliable/noisy.
- found: Normalizes whitespace, returns a neutral UNDECIDED midpoint for bodies under 200 bytes (deflate overhead swamps the ratio there), otherwise deflate-compresses and linearly maps the compressed/original ratio between 0.25 (templated) and 0.70 (dense hand-written) calibration points.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Nailed the mechanism; missed the specific calibration constants and the UNDECIDED-on-error/short-input fallback.

### `branch_density`
- spec 2 · read at `d1519d356654` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:58Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Counts branching constructs in the body (if, match, while, for, &&, ||, and the `?` operator) by scanning for keywords/tokens, then divides by the number of lines to get a density float. Higher density suggests more decision points per line, correlating with lower predictability/more surprise.
- found: Tokenizes the body on non-alphanumeric chars (keeping &, |, ?), counts tokens matching a branch-keyword list (if/else/match/case/switch/for/while/loop/try/catch/except/&&/||/?), divides by line count, and maps that ratio through linmap(0.02, 0.25) into a normalized score. Returns UNDECIDED if the body has fewer than MIN_LINES_FOR_BRANCHING lines.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `vocabulary_novelty`
- spec 2 · read at `40682e32b324` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:04:00Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: vocabulary_novelty tokenizes the signature into a word/identifier set via words, tokenizes the body the same way, and computes the fraction of body words that are not in the signature's vocabulary — returning that ratio as an f32, so a body that only repeats terms already in the name/signature scores near 0, while one introducing new domain vocabulary scores higher.
- found: Builds word sets from signature and body via words(), returns UNDECIDED if the body has too few words to judge, otherwise computes the fraction of body words absent from the signature's vocabulary and rescales it through linmap(0.35, 0.85) into the calibrated output range.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `fingerprint`
- spec 3 · read at `1a987b583dcf` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:49:00Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes shingles over the body text (via shingles), hashes each shingle with fnv, and packs the resulting hash set into a Fingerprint struct — used later for jaccard similarity comparisons between functions.
- found: Just wraps shingles(body) into a Fingerprint struct — no separate hashing step here (fnv presumably happens inside shingles).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `distinctiveness`
- spec 2 · read at `0fe9a609594f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:28Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Computes jaccard(me.shingles, peer.shingles) for each peer, takes the maximum similarity (closest sibling), and returns 1.0 minus that value. If peers is empty, returns a neutral default like 0.5 rather than claiming maximal distinctiveness, consistent with 'a lone function is undecided not unique'.
- found: Returns UNDECIDED if peers is empty or the body is too short to shingle (below MIN_SHINGLES). Otherwise takes the max jaccard similarity to any peer (closest match) and returns 1.0 minus that value linearly remapped between empirically-chosen bounds (0.08, 0.55), since near-duplicates rarely exceed ~0.6 jaccard once identifiers differ.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I got the UNDECIDED-on-empty-peers and max-jaccard logic right but missed the short-body floor and the linmap rescaling — both are calibration details the one-line doc didn't mention.

### `surprise`
- spec 2 · read at `4eff4ffdff03` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:23Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Combines several component signals — incompressibility(body), branch_density(body), vocabulary_novelty(signature, body), and the passed-in distinctiveness — into a single weighted average, clamped to 0.0..=1.0, representing the overall mixed offline surprise proxy score for one function.
- found: Exactly the four components I predicted (distinctiveness, vocabulary_novelty, incompressibility, branch_density), weighted-summed via a shared WEIGHTS array, then passed through a separate calibrate() function rather than a simple clamp.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `calibrate`
- spec 2 · read at `9ee354aa2b11` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:53Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Clamps `raw` into the calibrated observed band (roughly 0.15..0.95), rescales that clamped value linearly to 0..1, then raises it to a calibrated exponent greater than 1 to skew the distribution right (most values pushed toward cold/0, only a thin tail reaching hot/1), returning the result as the presentational score.
- found: linmap(raw, FLOOR=0.30, CEIL=0.95) then .powf(SKEW=2.2) — linear rescale into the observed band followed by a right-skewing power, exactly as predicted in shape/mechanism though I guessed the floor constant wrong (0.15 vs 0.30).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `documented` — QUIRKY
- spec 2 · read at `3406ce98e4d7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:12:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Tokenizes doc, signature, and body into word sets (via words_split_identifiers_and_drop_noise), removes words that appear in the signature from both the doc set and body set, then computes what fraction of the remaining doc words also appear in the body word set. Returns 0.0 if doc is None or the doc set becomes empty after subtraction.
- found: Subtracts signature words from both body and doc word sets; if body-minus-signature is empty returns 1.0, if doc-minus-signature is empty returns 0.0. Otherwise computes what fraction of the body's uncovered words appear in the doc, then linearly maps that coverage fraction (0..0.4) to a 0..1 score so ~40% vocabulary overlap earns full credit.
- predicted: some · documented: full · derivable: no · legible: most · trap: no
- note: I had the overlap direction backwards (doc-covered-by-body vs body-covered-by-doc) and missed the linmap threshold scaling entirely.

### `words_split_identifiers_and_drop_noise`
- spec 2 · read at `4d91000cb3c8` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:32Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A unit test that calls the tokenizer/word-splitting function on a sample identifier string (e.g. camelCase or snake_case) and asserts it splits into the expected lowercase words while dropping punctuation/numeric noise. It's one of a battery of small assertion-style tests named after their claim, verifying lexing behavior used by the surprise/incompressibility heuristics.
- found: Unit test asserting `words()` splits camelCase and snake_case identifiers into lowercase parts (with consecutive caps like HTTP staying glued to the following word, e.g. "httpheader"), and that keywords/short tokens in a code snippet yield an empty vector.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: File doc was about the whole heuristic module's purpose, not this specific test; didn't predict the exact camelCase boundary rule (HTTP+Header merging rather than splitting).

### `a_comment_that_restates_the_signature_documents_nothing`
- spec 2 · read at `4e798aed459f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:10Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A #[test] function that calls documented() with a doc string that just echoes words from the signature (e.g. "increments the counter" for fn increment_counter) and asserts the returned score is at or near 0.0, verifying the signature-word-subtraction behavior described in the module docs.
- found: Test asserting documented() returns exactly 0.0 for a doc that echoes the signature (increment_counter example) and >0.5 for a genuinely explanatory doc on the same signature/body.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed the exact example (increment_counter) shown in the file-level docs, and correctly predicted both the near-zero and the explanatory-doc contrast case; missed that it asserts an exact 0.0 rather than 'near'.

### `no_doc_is_no_explanation`
- spec 2 · read at `8b58e47ed66c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:13Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A unit test asserting that when a function has no doc comment, the `documented()` heuristic returns a "none"/absent result rather than some default score.
- found: Asserts documented(None, sig, body) == 0.0, confirming the no-doc case scores zero rather than returning an Option; I predicted the behavior but assumed an Option-style None result rather than a numeric 0.0.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `twelve_copies_of_a_handler_are_not_distinctive` — QUIRKY
- spec 2 · read at `3f563f4b7e0f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A #[test] function that builds a small corpus containing twelve near-identical copies of a boilerplate "handler"-style function, runs the distinctiveness/fingerprint/jaccard scoring over it, and asserts the resulting distinctiveness score is low — proving that code duplicated many times across a repo is correctly judged unsurprising/non-distinctive rather than flagged as noteworthy.
- found: A #[test] that fingerprints two structurally-similar boilerplate handler functions (get_user/get_order) and a third genuinely novel retry-loop snippet, then asserts the distinctiveness score between the two similar handlers is both lower than the score against the novel snippet and below 0.5 — i.e. near-duplicate template code scores as unsurprising.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Name says "twelve copies" but the test only uses two near-duplicate fingerprints plus one novel one — the name is rhetorical/illustrative, not literal, which threw off my prediction of the mechanism.

### `a_lone_function_is_undecided_not_unique`
- spec 2 · read at `b35e9fdd99bc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:23Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that when a function has no peers to compare against (e.g. it's the only function in the corpus), the distinctiveness() measure returns "undecided"/None rather than a maximal "fully unique" score — i.e. lack of evidence should not be conflated with a positive signal of uniqueness.
- found: Asserts distinctiveness() called with an empty peer list returns the UNDECIDED constant rather than a maximal uniqueness score, exactly as predicted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `short_bodies_decline_to_report_compressibility`
- spec 2 · read at `f12600d8d19e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test asserting that `incompressibility` (the compression-ratio-based surprise measure) returns None for a very short function body, since a few bytes can't produce a meaningful compression ratio — consistent with the "every term declines to measure when it runs out of evidence" pattern used elsewhere in this module.
- found: Asserts incompressibility("a + b") equals UNDECIDED, because deflate's fixed per-stream overhead would otherwise make every tiny function look artificially novel/incompressible.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `non_ascii_source_does_not_split_a_codepoint`
- spec 2 · read at `d8b4593d2bb6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs source code containing non-ASCII (multi-byte UTF-8) characters and runs it through the module's lexing/fingerprinting/tokenizing logic, asserting the function doesn't panic (e.g. from slicing a string at a non-char-boundary byte index) and produces sane output.
- found: A test verifying lex() correctly tokenizes strings containing multi-byte UTF-8 characters (em dashes, middle dots, accented letters) without panicking on a non-char-boundary byte slice, plus a smoke check that fingerprint() runs on similar input.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Comment reveals this guards against a real prior panic inside a rayon worker, not a hypothetical.

### `lex_separates_punctuation_from_identifiers`
- spec 2 · read at `4636503cbcc0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:17Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds source like foo(bar) or x+y through the module's lex tokenizer and asserts punctuation characters (parens, operators) come out as separate tokens from adjacent identifiers, rather than being glued into one token — checking the exact token list.
- found: Asserts `lex("db.query(USERS, id)")` produces the exact token list ["db", ".", "query", "(", "USERS", ",", "id", ")"] — punctuation split from identifiers as separate tokens.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Comment reveals this property backs a "sibling comparison" (likely jaccard/distinctiveness) that depends on one changed word not perturbing surrounding tokens — not derivable from the name alone.

### `a_tiny_function_cannot_be_the_hottest_thing_in_the_repo`
- spec 3 · read at `70e904f6f0e2` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:58Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a very small function (e.g. a few lines of code) with otherwise maximal surprise-inducing properties (high vocabulary novelty, low compressibility, no docs) and asserts that the resulting surprise/temperature score is capped below the maximum, verifying that LOC size dampens or bounds the score so tiny functions can't rank as the hottest.
- found: A regression test reproducing a real bug (a trivial main() scoring as most surprising): builds a tiny 2-line body and a synthetic 40-line body, computes surprise scores for each via fingerprint/distinctiveness, and asserts the tiny one scores under 0.5 while the long one outranks it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `every_term_declines_to_measure_when_it_runs_out_of_evidence`
- spec 2 · read at `c089239d4f06` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:14Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test asserting that each of the individual heuristic term functions (incompressibility, branch_density, vocabulary_novelty, distinctiveness, etc.) returns the UNDECIDED neutral value when given input with insufficient evidence (e.g., an empty or trivial body/context), verifying the "decline to measure" contract is honored uniformly across all terms rather than just one.
- found: Asserts that incompressibility, branch_density, vocabulary_novelty, and distinctiveness all return UNDECIDED on tiny/trivial inputs, confirming all four abstain consistently rather than reporting a confident but meaningless score on insufficient evidence.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `surprise_stays_in_range`
- spec 2 · read at `6657f6fb4ca1` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This test likely calls surprise() on a variety of inputs (empty string, tiny snippet, large/weird code) and asserts the returned score is always clamped within a fixed range, e.g. 0.0..=1.0, no matter how extreme the input.
- found: Iterates over empty, single-char, and a large repetitive body, calling surprise(signature, body, some baseline float) and asserting the result is always within 0.0..=1.0.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/history.rs

### the file itself
- spec 3 · served in 4 parts · read at `1514d1455502` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file replays a repo's git history commit-by-commit to reconstruct how the function/file tree looked at each point in time, feeding the "history" view of the sunburst. It walks raw diffs (classifying edits, renames/moves, copies, deletions), interns functions so identity survives renames, parses blobs (possibly in parallel via a pool), and folds commits into a Replayer that can be cancelled, checkpointed, and resumed. It also caches finished timelines to disk (save_cache/load_cache/bank) so re-opening a repo can extend a prior walk incrementally rather than replaying from scratch, and carries an extensive suite of invariant tests (naming like "a_copy_does_not_retire_its_source") guarding these replay/cache semantics.
- found: Replays a repo's git history commit-by-commit into resumable/cacheable HistoryScan frames for the sunburst's history view: it streams raw diffs, classifies edits/renames/copies/deletions, interns functions by (path,owner,name,ord) identity across renames, batches and parallel-parses file versions on a dedicated thread pool, joins committed .sanity/ shard readings to functions by key, and checkpoints/extends/caches the resulting timeline to disk so re-opening a repo tops up rather than re-walking. It also exposes a paged serving layer (Tables/LogRow/funcs/log/scoped/deltas) so the frontend never receives the whole multi-megabyte timeline at once, plus a per-repo Tracing claim/progress registry and a warm() top-up path, all backed by an extensive invariant test suite.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no

### `key_of`
- spec 2 · read at `19a1795e6717` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds an identity string from `path` and the function's name (and owner type if present on HistoryFunc), formatted like "path#owner::name" or "path#name", used as a stable diff key across commits.
- found: Builds "path#owner::name#ord" — I had the shape right but missed the trailing ordinal (f.ord), which presumably disambiguates same-named overloads/shadows at the same path.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `is_shard`
- spec 3 · read at `b6c768f76ab0` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a given path string is inside the .sanity/ directory and has a .md extension, identifying it as one of the committed Markdown shards (including README.md, which counts too since the function doesn't special-case it).
- found: Exactly as predicted: checks path starts with '.sanity/' and ends with '.md', no special-casing of README.md.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `reading_key`
- spec 3 · read at `a654922fe394` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a string key from `path` and `f` (name/ordinal) matching the format `key_of` uses, so a history reading can be matched to the same .sanity/ file entry. It converts f's one-based ordinal to zero-based (subtracting 1) before delegating to or replicating key_of's suffixing logic, with the first occurrence getting no suffix and later duplicates getting one based on the adjusted ordinal.
- found: Delegates to crate::assessment::key_of(path, &f.name, f.ord.saturating_sub(1) as usize), converting the one-based FuncAt ordinal to key_of's zero-based expectation via saturating_sub to avoid underflow panics.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `lang_of` — QUIRKY
- spec 2 · read at `addd3d34929a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:08:08Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Extracts the file extension from `path` and matches it against known extensions to return the corresponding Lang variant (Rust for .rs, Python for .py, TypeScript/TSX for .ts/.tsx, Go for .go, etc.), returning None for unrecognized or missing extensions.
- found: First checks if any path component matches a VENDORED set and returns None if so (skip vendored dirs); otherwise extracts the extension after the last '.' and delegates to Lang::from_extension, returning None if there's no extension.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `open`
- spec 2 · read at `c68f908e0fea` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:51Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Spawns a `git cat-file --batch` (or similar) subprocess in the given repo directory with piped stdin/stdout, and wraps the child process handle plus its stdin/stdout pipes into a Blobs struct, returning None if spawning fails. This lets Blobs::read later write a blob sha to stdin and read its content back from stdout on demand rather than shelling out per blob.
- found: Spawns `git cat-file --batch` with piped stdin/stdout, wraps the child, stdin, and buffered stdout in a Blobs struct for later on-demand blob reads.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `read` — QUIRKY
- spec 3 · read at `09c3d1d73042` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up the blob's text by sha, checking an internal cache first; on a miss, fetches raw bytes from git via a pool/backend, checks for binary content or a size limit, decodes to UTF-8 String, caches it, and returns None if missing/binary/too large.
- found: A one-line delegation to read_within(sha, MAX_BLOB_BYTES) — all the actual cache/fetch/decode logic I predicted lives in that other function, not here.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The docstring describes the overall behavior (cache, binary/size checks) but that logic is entirely in read_within; this function is just a size-limit default wrapper.

### `read_within` — QUIRKY
- spec 3 · read at `8ecf25d98cc5` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:44Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the blob by `sha` (likely delegating to or sharing logic with `Blobs::read`), checks its size against `cap`, and returns None if it exceeds the cap (or fails to decode as UTF-8), otherwise returns Some(content) as a String. This lets callers like shard reads impose a size ceiling different from the default max blob size.
- found: Writes the sha to a `git cat-file --batch`-style subprocess pipe, reads the response header (oid, kind, size), returns None if not a blob, always drains the full payload from the pipe to keep it in sync for future reads, then returns None if size exceeds cap, otherwise returns the payload as a UTF-8 String.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `drop` — OBSCURE
- spec 3 · read at `af7d03b498b1` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Blobs is a cache wrapper around git blob reads; this Drop impl likely logs or flushes cache statistics (hits/misses) or releases some resource explicitly before the struct is deallocated, since a manual Drop suggests non-trivial cleanup beyond what auto-derived drop would do.
- found: Blobs wraps a spawned `git cat-file --batch` child process. Drop closes stdin (by dropping it) which signals the batch process to exit, then waits on the child to reap it and avoid a zombie/hang.
- predicted: none · documented: none · derivable: yes · legible: full · trap: no

### `intern`
- spec 3 · read at `2b37076c9aba` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:24Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Looks up or creates a stable u32 id for the function described by `f` at the given path, keyed by something like path_idx plus the function's name/signature; if already present in an internal map it returns the existing id, otherwise it pushes a new entry (probably into a Vec) and inserts the new id into the map before returning it — a classic string/entity interner pattern for deduplicating function identities across commits.
- found: Interner: returns existing id from `self.index` keyed by `f.key` if present; otherwise pushes a new HistoryFunc (path, name, owner, ord) onto `self.list`, inserts the new id into `self.index`, ALSO inserts into a second map `self.by_reading` keyed by `reading_key(path, f)`, and returns the new id.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The only docs available were the file-level module doc, not a doc for this specific function.

### `functions_of`
- spec 3 · read at `722d5c06a992` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:45:54Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Parses `src` (using the language-appropriate parser for `lang`, likely via parse_raw) to extract its function-like declarations, and builds a FileState keyed by each function's identity (name plus an `ord` index disambiguating same-named siblings at this path, mirroring assessment::key_of) so the same function can be tracked as the same entity across commits during replay. Likely records each function's line span/size for the replay to diff against later versions.
- found: Parses `src` via parse::parse_functions(lang, src), and for each parsed function assigns an `ord` (1-based occurrence count keyed by owner+name) to disambiguate same-named siblings, builds a composite `key` string (`path#owner::name#ord`), and computes a hash over the verbatim signature+body (distinct from the whitespace-collapsing reading_hash) so a commit that only reformatted a function is still distinguishable from one that changed it. Collects the resulting FuncAt entries into a FileState.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The hash here is deliberately verbatim (not whitespace-normalized) unlike the reading-staleness hash elsewhere — conflating the two would make a reformat-only commit look like a real edit for replay purposes.

### `parse_raw`
- spec 2 · read at `c0a02791bacc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:49Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Parses a git `--raw` diff line of the form `:100644 100644 <src> <dst> <status>\t<path>[\t<path2>]`, splitting on whitespace/tabs to pull out the status character and path(s), building a Change enum/struct (e.g. Added/Modified/Deleted/Renamed with paths). Quoted paths are left as-is rather than unescaped, and malformed lines yield None.
- found: Strips the leading colon, splits metadata from path(s) on tab, pulls src/dst mode+sha and status via `?`, then branches on the status byte: Delete yields Change with no sha; Rename/Copy consumes a second path and sets `from` only for rename (copy leaves the source in place); everything else (Add/Modify) is a plain Change with the dst sha.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Expected an enum of change kinds; it's actually one flat Change struct (path, sha, from) with the kind implied by which fields are populated, plus a deliberate first()? instead of indexing to avoid a panic on an empty status field.

### `commits_named`
- spec 3 · read at `461fcd2c5519` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:13Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Invokes `git log --no-walk` in chunks (to stay under command-line length limits) for the given SHAs, parses the output into RawCommit structs via a shared parsing helper, and returns them in the given order rather than git's ancestry order — used by callers that have already decided the apply order.
- found: Runs `git log --no-walk --raw --find-renames` in chunks of 2000 SHAs, parses each chunk's output via parse_commits, then explicitly re-sorts each chunk's results back into the caller's given order (since --no-walk returns them newest-first regardless of argument order); appends chunks together and returns.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs field bundled in what reads as another function's docstring (about --max-count/--reverse/merge exclusion) ahead of this function's own paragraph — a reader trusting the whole docs blob would misattribute that unrelated behavior to commits_named.

### `commits`
- spec 3 · read at `5b7a410e1a26` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:54Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Spawns `git log --reverse` (likely with --raw and a custom format) as a child process, then reads its stdout line by line (not all at once) to parse into RawCommit structs, calling `progress` periodically as it streams so a phase line can show real progress instead of blocking silently. It checks `stop()` each iteration/commit to break out early and stop the child process for cancellation, and returns the collected Vec<RawCommit> along with a usize that's probably the "truncated" count — how many older commits exist beyond what `range`/limit captured.
- found: Spawns `git rev-list --count` on a background thread purely to get a denominator later, then spawns `git log --no-merges --reverse --root --raw --find-renames` immediately and streams its stdout with a reused buffer via read_until, feeding lines to absorb() which groups them into RawCommit records at commit boundaries, checking stop() and reporting progress once per completed commit (using the concurrent count as 'expected' if unbounded, else the fixed limit). Kills and reaps the child on exit/cancellation, joins the counting thread, and returns the list plus `total.saturating_sub(limit)` as the truncated/omitted-commit count.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Missed the concurrent rev-list --count thread used only as a progress denominator, the ALL_COMMITS sentinel vs --max-count handling, and the reused-buffer/read_until streaming detail — my prediction had the right shape (spawn git log --reverse, stream lines, stop() cancellation, kill child) but not these specific mechanisms.

### `parse_commits` — QUIRKY
- spec 3 · read at `bbb6e3cbf8d4` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:53:49Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: parse_commits is a thin wrapper that splits the raw git log --raw output text into per-commit chunks and maps each chunk through a lower-level parse_raw helper to build a RawCommit (sha, author, timestamp, subject, list of file changes), collecting the results into a Vec<RawCommit>.
- found: Iterates the raw log text line by line, feeding each line into `absorb` which incrementally builds up the Vec<RawCommit> (presumably detecting commit-header lines vs raw-diff change lines), rather than splitting into chunks and parsing each with a separate parse_raw call as I'd guessed.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `absorb`
- spec 3 · read at `f2645367e23e` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Parses a single line from `git log --raw` output. If the line is a commit header (recognizable prefix/format containing hash and metadata), it creates a new RawCommit and pushes it onto `list`, returning true. Otherwise it parses the line as a file-change entry (mode/blob/status/path) and appends it to the last commit already in `list`, returning false.
- found: If the line starts with the \u{1} commit-header marker, splits fields on \u{1f} to build a new RawCommit (sha, ts, author, subject) and pushes it, returning true. Otherwise delegates to parse_raw to parse a file-change line and appends it to the last commit's changes, returning false in both the fallback and normal file-line cases.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `tree_of`
- spec 2 · read at `3e188ba7eaf3` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:40Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Opens the git repo at the given path, resolves the commit for `sha`, and walks its tree recursively collecting every blob, returning a Vec of (path, content) pairs — essentially a full snapshot of the source at that commit. Likely filters to source-code file extensions and uses the git2 crate's tree-walk API, since this seeds the replay when history is deeper than the sliding window being tracked.
- found: Shells out to `git ls-tree -r <sha>` and parses each line, filtering to blob entries whose path has a recognized source language (via lang_of), returning (path, blob-sha) pairs — not file contents, just the tree listing with blob object ids for later lookup.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Expected git2 crate + actual blob content; it's actually a CLI subprocess call returning blob hashes, not contents.

### `prefetch`
- spec 3 · read at `01c1058403af` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates the given slice of RawCommits, collecting all (path, blob) pairs referenced across their file changes, deduplicating so a blob seen multiple times (e.g. reverted or shared across commits) is only read and parsed once. For each unique pair it reads the blob via Blobs, parses it into a function list, and drops the source text immediately after parsing to save memory. It reports progress via the `progress` callback using the passed-in `at`/`total` (the window's file count) rather than computing its own fraction, and returns a Parsed collection mapping blobs to their parsed function lists.
- found: Collects unique (path, blob-sha) pairs from the commit slice's changes, skipping paths with no recognized language, then delegates actual reading/parsing to parse_batch, and zips results back with their keys into a Parsed map. Progress is forwarded using the batch's phase word but the walk's own at/total counters.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `pool`
- spec 3 · read at `b73167f08d55` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:32Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Lazily builds (via a static OnceLock/OnceCell) a dedicated rayon ThreadPool sized to the number of available CPUs, caching it for reuse across calls. Returns Some(&'static pool) on success, or None if building the pool fails, so callers can fall back to the global rayon pool.
- found: Static OnceLock caches a lazily-built dedicated rayon ThreadPool (named "trace-N" threads, default size = num CPUs), returning Some(&pool) or None if the build failed.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains WHY a separate pool exists (starvation between scan and trace) but the code itself gives no hint of that motivation — pure win from the doc.

### `on_pool`
- spec 3 · read at `a564aac5b4b2` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:56Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Checks for a trace-scoped rayon thread pool (likely stored in a thread-local or passed context) and if present calls pool.install(work) to run the closure on it; otherwise falls back to running the closure directly (or via the global rayon pool). This lets parallel work be scoped to a specific trace's pool when one exists, without requiring callers to check.
- found: Checks pool() for an available thread pool; if present runs work via p.install(work), otherwise just calls work() directly.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `parse_batch` — TRAP
- spec 3 · read at `8c57302ef5c6` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:54Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Sequentially reads each (path, blob-sha) pair in `want` from `blobs` (a single git cat-file --batch process/pipe) to collect raw source bytes, then hands the whole batch off to a parallel parse step (e.g. via a thread pool/rayon) that runs tree-sitter parsing per file into a FileState. It calls `progress` periodically as items complete, and returns the resulting Vec of (path, FileState) pairs — deliberately not interleaving the sequential git reads with the parallel parsing to avoid serializing the CPU-bound work behind the pipe.
- found: Sequentially reads each wanted blob from `blobs`, skipping unknown languages and refusing (as None) any blob with an overlong line (minified), while reporting read progress; then processes sources in PARSE_CHUNK-sized chunks on a dedicated thread pool, parsing each chunk in parallel via rayon into FileState (empty for refused/skipped sources), reporting parse progress per chunk, and returns all (path, FileState) pairs — treating the read+parse as one combined progress count of total*2.
- predicted: most · documented: most · derivable: no · legible: most · trap: yes
- note: A refused/unparseable/minified blob is kept as an explicit empty FileState rather than dropped from the output — dropping it would silently leave a file's stale functions live forever since no later commit could ever remove them from the map.

### `empty`
- spec 3 · read at `78efadbeaf1b` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:57Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A constructor that builds a fresh Replayer with all internal state initialized to empty/default — empty maps for function locations, touches, births, hits, etc., commit index at zero or -1 — representing the starting point before any commits have been folded in, contrasted with `resume` which restores from a saved snapshot.
- found: Constructs a fresh Replayer with all fields at their empty/default state: empty BTreeMaps for paths/state/shards, Funcs::default(), and a HistoryScan with all empty Vecs, base_ts 0, empty head string, and truncated 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `resume`
- spec 3 · read at `2b7ea95d20dd` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:10Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Takes a previously saved HistoryScan and reconstructs a Replayer by starting from an empty state (like Replayer::empty) and folding through each of the scan's existing frames one by one (via a fold helper) to rebuild the derived parse state (path index, func index, per-file FileState map) — rather than deserializing any stored state directly — so a resumed walk's internal state is guaranteed to match a fresh walk that reached the same point. It sets `out` to the scan itself (reusing its commits/head) once folding completes.
- found: Rebuilds paths/funcs index tables directly from the scan's stored lists, then replays all commits' set/del entries into a live BTreeMap<func_index, loc> (starting from scan.base) to determine which functions are currently alive and at what size, reconstructs a FuncAt per path from that (with hash explicitly None since there's no parse to hash against), and finally assigns scan itself to r.out — no separate named 'fold' helper is called, the inline set/del replay over a map IS the folding.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `path_idx`
- spec 2 · read at `d5a1043f2ce2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Interns a path string on the Replayer: looks it up in an existing HashMap<String,u32> (or similar), returning the existing index if found; otherwise inserts it into the map and a parallel Vec<String>, assigning it the next index (current length), and returns that new index.
- found: Interns a path string: returns existing index from self.paths map if present, otherwise pushes the path onto out.paths and a derived language label onto out.langs (parallel arrays), inserts into self.paths, and returns the new index.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `seed` — QUIRKY
- spec 3 · read at `af4c175fd895` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the (path, blob_hash) pairs in `tree`, and for each one parses/loads the blob content (via `blobs`) and inserts the resulting parsed representation into the Replayer's internal state (e.g. path index / file map) so it reflects the tree as of the start of the replay window. Calls `progress` periodically to report how far seeding has gotten, since this could be a large tree.
- found: Partitions the tree into shard files vs source files. Parses sources in a batch, interning each parsed function into the path/func index and pushing base locations, storing per-path parsed state. Then reads each shard blob and folds it into read-coverage state via fold_shard — shards are processed after sources specifically so their entries can join against already-known functions, with nothing to retire since this is the initial seed.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `fold_shard`
- spec 3 · read at `ef05ba6660bb` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:20:08Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Parses the shard's text (None meaning the shard was deleted at this version) into its reading entries, joins each entry to an interned function via path/name lookup, and diffs against the reading state this Replayer already carries for that shard path: entries whose packed grade changed are pushed as (func_index, packed) into `read`, entries that dropped out (removed from this version or the shard deleted) are pushed as func_index into `unread`. Entries that cannot be joined to a known function (excluded path, or never interned) are silently skipped. Updates the carried state for this shard path to the new set before returning.
- found: Parses the shard text (or nothing if deleted) into packed readings, diffs against the previously carried map for that shard path, pushes (func_index, packed) for changed entries into `read` and func_index for dropped entries into `unread` (looking up indices via funcs.by_reading, skipping unjoined keys), and replaces the carried state — but only stores it back if the new set is non-empty.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `apply` — TANGLED
- spec 3 · read at `d479567f19e6` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Applies the file changes recorded in `commit` (using pre-parsed data from `ready`) to the replayer's internal tree/path state — updating or inserting blobs into `blobs` for added/modified files and removing entries for deleted ones. After mutating the tree, it builds a new frame (a snapshot of the tree/map state at this point in history) and appends it to the replayer's list of frames, likely also advancing some counter or index tracking progress through the commit sequence.
- found: Builds a HistoryCommit frame for this commit: retires deleted/renamed paths first (removing their functions), folds any .sanity/ shard changes in this commit into read/unread lists, re-parses changed files (using prefetch results or a fallback parse), diffs new vs old functions BY KEY (hash comparison) to populate `set` (changed/new functions) and `del` (removed functions), updates self.state, then dedups touched files and pushes the frame onto self.out.commits while updating self.out.head.
- predicted: most · documented: none · derivable: yes · legible: some · trap: no
- note: Comment block documents a known subtlety: `set` means every function whose hash changed in a touched file, not a line-level diff — worth flagging to future readers of `frame.set`.

### `fold`
- spec 2 · read at `0df155ab1a9f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:00Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: While the number of stored frames exceeds `limit`, pops the oldest frame(s) and merges their changes into an opening/base accumulator state, clearing the last-touched date info for any functions folded this way so they're left uncolored/undated instead of falsely dated to the window edge.
- found: Computes how many oldest commits exceed `limit`, drains them from `self.out.commits`, folding each commit's set/del changes into a `base` map (func id -> loc) and advancing `base_ts` to the last folded commit's timestamp. Writes the merged base back and bumps `truncated` by the count folded. Matches the gist of my prediction (fold oldest into base state) but the mechanics are a BTreeMap of loc-by-func-id plus a timestamp, not date-clearing logic per se — the 'losing dates' effect is implicit (base has no per-function date, only base_ts).
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `finish`
- spec 2 · read at `ff7e0b5aed6f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:13Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Consumes self after all commits have been replayed via apply/fold, and converts the accumulated internal state (per-commit tree snapshots) into the final HistoryScan struct, possibly with final cleanup/sorting.
- found: Much simpler than predicted: just moves self.funcs.list into self.out.funcs and returns self.out — a single assignment, not general cleanup/sorting.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `snapshot`
- spec 3 · read at `9fb3213ec3ee` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:43Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Clones the Replayer's current internal state (the timeline/tree built so far, plus head commit) into a new HistoryScan value and returns it, without consuming self or stopping the ongoing replay — so it can be written to disk mid-walk while replay continues.
- found: Clones self.out, overwrites its funcs field with a clone of self.funcs.list, and returns it — a cheap copy of the accumulated output state without touching the ongoing walk.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `cancel`
- spec 3 · read at `839e676ae1c2` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Sets a global cancellation flag, likely an AtomicBool, to true — the replay loop polls this flag each commit and breaks out when it sees it set, letting the caller persist the partial timeline as-is.
- found: Stores true into a global CANCELLED AtomicBool with Relaxed ordering, exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `cancelled`
- spec 3 · read at `761978bbdfb9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads a module-level static AtomicBool flag (set by the `cancel` function) and returns its current value, used by the long-running commit-replay loop to check periodically whether it should abort early.
- found: Loads a static AtomicBool CANCELLED flag with Relaxed ordering.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `new`
- spec 3 · read at `1d1ebc5ac5d8` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checkpoint::new() constructs a fresh Checkpoint with its internal timer/counter initialized to the current time (Instant::now()) or zero, used later by Checkpoint::maybe to decide periodically whether to save/emit progress during the commit replay.
- found: Constructs Checkpoint with `at: Instant::now()` and `every: CHECKPOINT_MIN`, a fixed interval constant.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `maybe`
- spec 3 · read at `92ef35729bfa` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:12Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a checkpoint is due (based on some counter/threshold of commits processed since the last write, tracked on self). If due, calls `snapshot()` to build the (expensive) HistoryScan copy and writes/caches it to disk for `repo` at `limit`, then resets the counter/timer that governs the next due check. If not due, does nothing.
- found: Time-based (not commit-count) gate: returns if less than `self.every` has elapsed since last write. If due, times the snapshot+save, then sets the NEXT interval proportionally to how long this write took (times a budget constant, clamped to min/max) — an adaptive interval that rations wall-clock time spent checkpointing, and resets the clock after the write so the write's own cost isn't double-charged.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The self-tuning `every` interval (scaled by actual write cost, clamped) is the load-bearing trick here and isn't hinted at by the signature or file doc at all.

### `read` #2 — QUIRKY
- spec 3 · read at `c0355cf47082` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:28Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Orchestrates the full history replay: tries to resume from a cached partial timeline (read_cached/extend) keyed by the last-applied commit (head), walks the remaining git log commit-by-commit feeding each into a Replayer (seed/fold_shard/apply/fold/finish) to build frames, periodically checkpoints to disk via Checkpoint::maybe (time-bounded), reports progress via the progress callback, checks cancelled() to bail early, and returns the HistoryScan, handling a repo with no git history gracefully with an empty timeline rather than erroring.
- found: This overload just walks the commit log directly (via `commits()` with CommitRange::Last(limit)) rather than resuming from a cache (that logic must live in a different `read`/wrapper, not this one). It opens Blobs, seeds Replayer state from the tree just before the truncation boundary if the log was truncated, then processes commits in WINDOW-sized batches — prefetching/parsing each window's blobs together but applying commits one at a time to keep frames per-commit — checkpointing periodically and reporting two distinct progress phases (byte-level log parsing vs per-commit replay).
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The doc block describing caching/resume (read_cached/extend/head) applies to a sibling `read` overload, not this one — this one always walks the full requested range from scratch.

### `read_cached`
- spec 3 · read at `eb07ab35410e` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:51Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Tries to load a cached HistoryScan from disk (load_cache); if there's none, falls through to a full `read`. If there is one, calls `extend` with it and matches on the Carry result: Same returns the cached scan unchanged, Grew saves the new scan back to the cache (ignoring write failures) and returns it, and Refused triggers a full `read` from scratch (also saving the fresh result to cache). Any cache read/write failure is swallowed rather than propagated, since the cache is just an optimization over data recomputable from git.
- found: Resets the CANCELLED flag, loads a cached scan if present and calls extend on it: Same returns it as-is, Grew saves it to cache and returns it, Refused (or no cache) falls through to a full read() followed by bank() to save it and unload() to drop the in-memory held copy.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: A comment documents a real historical bug: treating extend's Same/no-op result as \"cannot be carried\" caused full replays on every open of merge-heavy repos like ceph.

### `forget`
- spec 3 · read at `181b1569e296` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:55Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Deletes the on-disk cache/meta files for this repo's history trace (via cache_path/meta_path) so the next trace has no stored head to resume from and starts over from scratch. The `limit` parameter is probably passed through to whatever logging/bookkeeping happens, or used to bound how much of something (log_shas?) gets removed/reported.
- found: Calls unload() (clears in-memory state) then deletes the cache and meta files on disk for this repo+limit, so the next trace has nothing to resume from.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Guessed limit might bound something to remove/report; actually it's just part of the cache-key path (cache_path/meta_path take it directly), and I didn't anticipate the unload() in-memory clear.

### `stored`
- spec 3 · read at `9357be16c560` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:24Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads whatever cached history trace exists on disk for this repo (via load_cache/cache_path) and returns it as-is, up to `limit`, without walking any commits or extending/resuming a partial trace — returns None if nothing was banked yet. It's the "read only, never compute" counterpart to read_cached.
- found: Thin wrapper delegating directly to load_cache(repo, limit) — the doc's "exactly as banked, or nothing" contract lives in load_cache itself.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `grew`
- spec 3 · read at `98054ed0c548` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Carry is an enum representing the result of trying to add a commit to a timeline in a test (e.g. variants like Grew(HistoryScan), Rejected, NoOp/Unchanged). grew(self) consumes self, matches on the Grew variant to return the inner HistoryScan, and panics with a descriptive message for any other variant, since the test expects the commit to have landed.
- found: Carry is a test-only enum (Grew(HistoryScan), Same(_), Refused) representing the outcome of extending a timeline with a new commit. grew(self) unwraps the Grew variant to its HistoryScan, and panics with a specific message for each of the other two variants.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `extend`
- spec 3 · read at `dcea5dc05fde` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Given a previously cached HistoryScan, check whether the repo's current state is still compatible with it (e.g. the cached tip commit is still an ancestor of HEAD, via `is_ancestor`). If so, walk forward from the cached tip up to `limit` new commits, reporting progress via the callback, and return a Carry variant (like Carry::Grew) wrapping the extended scan. If the cache is stale/incompatible (history rewritten, branch changed), return a different Carry variant explaining why the cache can't be reused, without doing any walking.
- found: Checks cached.head is still an ancestor of HEAD (else Refused), re-derives the log and verifies the cached tip's position/sha still match (else Refused), returns Carry::Same if nothing new or the log read was cancelled, refuses if more than `limit` commits ahead, otherwise walks the new commits in prefetch windows with checkpointing and returns Carry::Grew with the extended scan.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the Carry::Same short-circuit for cancellation/already-current, and the windowed prefetch+checkpoint machinery — only guessable once inside the body.

### `tracing`
- spec 3 · read at `d167270bd003` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:24Z · by ross@rossturk.com · warm reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Locks the same TRACING map, using unwrap_or_else(|e| e.into_inner()) to recover from poisoning, looks up repo, and returns a cloned Progress value (or None if absent), releasing the lock quickly since it just copies out.
- found: Locks TRACING (recovering from poison), and returns a cloned Progress for repo if the map exists and contains it, else None.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `claim`
- spec 3 · read at `987a89048995` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks a shared/global registry (likely a Mutex<HashSet<PathBuf>> or similar) of repos currently being traced; if the repo is already present it returns None, otherwise it inserts the repo and returns Some(Tracing { .. }), an RAII guard whose Drop impl removes the repo from the registry when the walk ends.
- found: Locks a global TRACING map (PathBuf -> Progress); if the repo key already exists returns None (another walk in progress), otherwise inserts a starting Progress and returns Some(Tracing(repo)) as an RAII guard.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `at`
- spec 3 · read at `97d1166af14c` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:18Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Stores the given Progress snapshot into a shared/interior-mutable field on Tracing (e.g. a Mutex or lock), so that other code polling the tracing state between ticks can see the current replay progress. Simple setter, no branching.
- found: Locks a global static TRACING map (handling lock poisoning), and if tracing is currently active (map is Some), inserts/updates the Progress keyed by self's identifier (self.0), so tracing is a global on/off registry rather than a per-instance field.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `drop` #2
- spec 3 · read at `0f88126d39fa` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:19Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is Drop for Tracing, the RAII guard returned by Tracing::claim. On drop it removes the repo's entry from whatever global registry (likely a Mutex<HashSet<PathBuf>> or similar) marks it as "currently being traced," so that a subsequent claim() call for the same repo succeeds again — releasing the lock whether the trace finished normally or the task was aborted/panicked.
- found: Locks the global TRACING registry (poison-tolerant via into_inner) and removes this repo's key from it, releasing the claim so a future Tracing::claim can succeed.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `warm` — QUIRKY
- spec 3 · read at `0949b5e0acb5` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: warm checks whether a timeline for repo already exists on disk (via stored/load_cache); if not, it returns false immediately without building one. If one exists, it finds the commits since the timeline's last recorded position (via log_shas/is_ancestor), replays/extends the timeline forward through those commits up to limit, saves the updated cache, and returns true.
- found: Returns false fast if there's no cache path or no existing cached timeline file. Otherwise cheaply computes how many commits the cache is behind HEAD (via log_shas count minus banked count) and bails (false) if that's more than WARM_MAX — refusing to silently resume a large unfinished trace. Only if the gap is small does it call read_cached to actually top up the timeline and return true.
- predicted: some · documented: full · derivable: no · legible: full · trap: no

### `log_shas`
- spec 3 · read at `c9c4de753c0d` · commit `758c706` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:04:23Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Spawns `git log --reverse --format=%H` (or similar) as a subprocess, streams stdout line-by-line collecting commit shas into a Vec, calling `progress` periodically and checking `stop()` to allow interruption. Returns `None` only if the git process fails to spawn/start (distinct from an empty but successful run, which returns `Some(vec![])`).
- found: Spawns `git log --no-merges --reverse --root --format=%H HEAD`, streams stdout line-by-line into a Vec<String>, reporting progress every 1024 shas and checking stop() at the same cadence. Returns None if the process fails to spawn, if stdout can't be captured, or if stop() fired mid-read (gave_up); otherwise returns Some(shas) even if empty.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed that stop()-triggered cancellation also returns None (matching the doc's care about None vs Some(vec![]) semantics), not just spawn failure.

### `is_ancestor`
- spec 2 · read at `bb2d9c040a16` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:36Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Shells out to `git merge-base --is-ancestor <sha> HEAD` (or equivalent), returning true if the exit code indicates the commit is reachable from HEAD (still on the current branch's history and not from a rebased-away/orphaned line), false otherwise — likely treating any command-spawn error as false.
- found: Runs `git -C <repo> merge-base --is-ancestor <sha> HEAD` with stderr suppressed, returning true on success exit code and false on any spawn error.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `cache_path`
- spec 3 · read at `d509fc61eaa4` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes the on-disk path for this repo's cached commit-history timeline, presumably hashing the repo's path (similar to reports.rs's slot_hash) and folding in `limit` (how many commits back the timeline covers) so different limits don't collide, placed under the app's data_dir in a "history" subdirectory. Returns None if the data directory can't be resolved/created.
- found: It's a one-line delegation to reports::cache_slot("timelines", repo, &tag(limit)) with a .json extension appended, reusing the generic versioned cache-slot mechanism from reports.rs rather than doing its own hashing.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The docs shown were the file-level module doc, not anything specific to cache_path.

### `tag`
- spec 3 · read at `00eb1f9dbad1` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:06Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds a cache-tag string starting with a human-readable form of `limit` (some named constant like "all" when it's usize::MAX/unbounded, otherwise the number itself), followed by version numbers for the parsing/format logic that invalidate the cache when they change — something like "{limit}-p{PARSE_VERSION}v{other_VERSION}", mirroring the p4v7-style tags seen in reports.rs tests.
- found: Builds "{window}-p{PARSE_VERSION}v{CACHE_VERSION}" where window is "all" for the unbounded sentinel ALL_COMMITS or the numeric limit otherwise.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `load_cache`
- spec 3 · read at `5059d14fbd73` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:11:58Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Attempts to load a previously saved HistoryScan from disk cache for this repo. Likely uses cache_path(repo) to locate the file, reads/deserializes it (e.g. JSON), and checks that it's still valid for the given limit (e.g. cached scan covers at least `limit` commits) before returning Some(scan); returns None if the file doesn't exist, fails to parse, or is stale/invalid.
- found: Locates the cache file via cache_path (which itself encodes the limit), marks it used for a separate sweep/cleanup process, reads and deserializes it, then validates cache/parse version and limit match before returning the cached scan, else None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `meta_path`
- spec 3 · read at `a264b15e6000` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Mirrors cache_path: derives a cache directory (likely based on the repo path, possibly hashed) and returns the path to a metadata sidecar file associated with the given limit, returning None if the cache directory can't be resolved.
- found: Calls cache_path(repo, limit) and, if it returns Some, swaps the extension for "meta.json" to get the sidecar metadata file path; returns None if cache_path does.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `banked`
- spec 3 · read at `c43b473c3d56` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loads the cached replay state for `repo` (likely via load_cache/cache_path) and returns the number of commits already stored, capped at `limit`. If no cache exists yet, returns 0.
- found: Reads the meta file for this repo/limit combo (via meta_path), parses it as JSON into a Banked struct, and returns its `commits` field, or 0 if the file is missing/unparseable.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `bank`
- spec 3 · read at `5f7600772807` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:54Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the freshly walked HistoryScan actually applied any commits (non-empty); if so it calls save_cache to overwrite the banked timeline for that repo/limit, and if the scan applied nothing (a cancelled or empty walk) it returns early without touching the cache, per the doc's guarantee that a stopped walk can't erase a banked timeline.
- found: Returns early if scan.commits is empty; otherwise calls save_cache to write the scan over the banked cache, exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `save_cache`
- spec 3 · read at `fcb762a67c2f` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:20Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Serializes the HistoryScan (likely via bincode, mirroring treecache's approach) and writes it to cache_path(repo), plus writes a small meta file (meta_path) recording the limit and maybe a version/tag so load_cache can validate staleness later. Probably best-effort (ignores/logs errors) since it's a cache write, not a correctness-critical path.
- found: Prunes stale slots for other --limit variants, then best-effort writes a small JSON meta file (head sha + commit count) and a full JSON cache file (version, parse version, limit, and the cloned scan) to disk, silently swallowing any serialization/IO errors since a failed timeline cache costs only a slower next replay.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

### `a_new_stored_timeline_field_cannot_be_added_silently`
- spec 3 · read at `144bd9f9204e` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:40Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A tripwire test: it asserts that the serialized/reflected shape of the stored timeline struct (its field names or count) matches a hardcoded expected list. Adding a new field to the struct without updating this test causes it to fail, forcing whoever adds the field to consciously decide whether a missing/default value for it is safe to replay across (per the doc's warning about defaulted fields silently corrupting extended timelines).
- found: Serializes a HistoryScan to JSON, sorts its keys, and asserts them against a hardcoded list of expected wire (camelCase) field names, with a failure message instructing to bump CACHE_VERSION and update the list.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `raw_line_reads_a_plain_edit`
- spec 2 · read at `a64938b36a40` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A unit test that feeds a single git raw-diff status line (from `git log --raw`) representing a normal file modification (status "M") into the parsing function, and asserts the parsed result correctly identifies it as a plain edit — with the old and new path both set to the same file, and no rename/copy/deletion markers set. It's part of a family of sibling tests each checking one raw-line status code classification.
- found: A unit test that parses a git raw-diff line for a plain modification (status M) and asserts the resulting struct has the correct path, the new blob sha, and no `from` (rename/copy source) set.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `raw_line_reads_a_rename_as_a_move`
- spec 2 · read at `044ad3a0c674` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:43Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a raw git log line representing a rename (something like "R100\told_path\tnew_path") and asserts that parsing/applying it results in a move: the old path is removed/retired from the state map and the new path is added in its place, rather than both existing simultaneously.
- found: A unit test that calls parse_raw on a raw git diff-tree rename line and asserts the resulting change has path set to the new path and from set to Some(old path) — testing the low-level line parser, not the higher-level state-map retirement behavior the docs paragraph describes.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The docs attached are file-level/module doc about the broader rename-retirement rule, not specific to this narrow parse_raw test.

### `a_copy_does_not_retire_its_source` — QUIRKY
- spec 2 · read at `e2f906d9b378` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that simulates a git copy (as opposed to a rename/move) during history replay, then asserts that the source file remains present/tracked in the resulting state rather than being removed, since a copy operation should not retire the original path the way a rename does.
- found: A unit test that parses a raw git diff-tree copy line (C075) and asserts the parsed record has path set to the destination and `from` as None, confirming copy parsing doesn't populate a rename-source field.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `raw_line_reads_a_deletion`
- spec 2 · read at `af77b3401146` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:46Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a raw git diff/log line representing a file deletion and asserts that the parsing function correctly identifies/reads it as a deletion event, distinct from an edit or rename, likely checking the resulting struct's fields (e.g., old path present, new path absent, or a Deleted variant).
- found: A unit test that parses a raw git diff-tree line for a deletion (mode 100644->000000, status D) and asserts the resulting struct has path "src/gone.rs" and sha is None, confirming the parser reads deletions without a target blob sha.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `same_named_functions_in_one_file_stay_apart`
- spec 2 · read at `64630814eb97` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:46Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a synthetic repo/commit history where a file contains two functions with the same name, runs it through the history replay logic, and asserts the two functions remain tracked as separate identities rather than merging into one — so the second one's arrival doesn't read as the first one changing size.
- found: A single-commit (not multi-commit history) test: two impl blocks (A::new, B::new) with the same method name `new` in one file, parsed via functions_of, asserting two distinct keys are produced and they differ — i.e. identity keys disambiguate by owner type, not just name.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I expected a multi-commit replay scenario given the file's history-replay theme, but it's actually a single-snapshot test of functions_of's key uniqueness — no commit replay involved.

### `a_cancelled_walk_does_not_erase_a_banked_timeline`
- spec 3 · read at `6fd5f2857551` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a repo with commit history, banks (caches) a timeline for it, then triggers a resumed walk that gets cancelled during the log read (producing an empty result via a cancellation flag/token), and asserts that the previously banked/cached timeline is still present and unchanged afterward — i.e. the empty walk result did not overwrite the cache.
- found: Builds a 4-commit repo, reads/caches its full timeline (asserts 4 banked), then directly calls bank() with an empty HistoryScan::default() (the exact state a cancelled log read produces) and asserts the banked cache still has 4 commits and load_cache still returns 4 — the empty result did not overwrite it.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Test calls bank() directly with HistoryScan::default() rather than actually triggering a cancellation token, so the 'cancel' is simulated at the data level, not the control-flow level.

### `a_cancelled_log_read_stops_at_the_first_commit`
- spec 3 · read at `25b6ba7fb6ce` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test verifying that streaming git log reading respects a cancel flag: it sets up a repo with multiple commits, triggers a log read with the cancel flag already set (or set after the first commit is read), and asserts that the resulting history only contains the first (oldest) commit rather than the full set or an empty result — confirming the cancel check happens per-commit during streaming rather than only after the whole read completes.
- found: A test that builds a 12-commit repo, calls commits() with a cancel closure that always returns true, and asserts the returned log has exactly 1 entry — confirming the stream stops at the first commit rather than reading all twelve or returning zero.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `streaming_and_batched_parsing_agree` — QUIRKY
- spec 3 · read at `a603f4d8e1d7` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:42Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This test builds a synthetic `git log` output (multiple commits), feeds it to the batched parser as one string via `commits_named`, then feeds the same text line-by-line to the streaming reader, and asserts both produce identical parsed commit lists/timelines — proving the two entry points share one underlying parser.
- found: Builds a real git fixture repo with 6 commits, walks it with the streaming commits() reader, then re-fetches the same SHAs via commits_named() (batched), and asserts sha/ts/subject/changed-paths match across both for every commit.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `repo_with`
- spec 2 · read at `5e199a0e7027` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:08Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Creates a temp directory, runs `git init` in it, then loops n times: each iteration appends a new function (e.g. named fn_0, fn_1, ...) to src/lib.rs, stages it, and commits with a message. Returns the TempDir handle so the test fixture stays alive and can be pointed at by the scanner/history code.
- found: Builds a tempdir git repo, configures user.email/name, then for each of n commits rewrites src.rs to contain functions f0..fi (cumulative) and commits — matches the doc's intent (n commits each adding one function) but writes to src.rs, not src/lib.rs as the doc says, and doc doesn't mention the git config lines.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs say src/lib.rs but the code writes to src.rs at repo root.

### `shape` — QUIRKY
- spec 2 · read at `d4761ced1893` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:18Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test-helper that reduces a HistoryScan to an order-independent summary for equality checks between two differently-numbered replays (e.g. resumed vs fresh walk): returns the list of file paths, a total function count, and a vector of (function name, some stable per-function value like line count) — deliberately excluding the raw numeric function indices since those can differ between walks that describe the same repo state.
- found: Replays a HistoryScan's commits over its base to compute the live function->loc map at HEAD, converts each surviving function to a stable (path+name key, loc) pair via key_of, sorts them, and returns (commit SHAs, truncated flag, sorted alive functions) — an order-independent fingerprint for comparing two differently-indexed scans of the same repo state.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: I guessed the general order-independence purpose right but got the actual tuple fields wrong (commit SHAs + truncated flag, not file paths + function count).

### `a_walk_stopped_early_holds_what_a_shorter_walk_would_have` — QUIRKY
- spec 3 · read at `ab4db8380db9` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:53:03Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Sets up a repo fixture with several commits, runs a full replay but stops/cancels it after commit 2 (snapshotting via Replayer::snapshot), then separately replays a repo containing only the first two commits to completion, and asserts the two Timeline/state results are equal — proving a stopped walk's checkpoint is indistinguishable from a genuine short walk's output.
- found: Replays a 3-commit repo by hand, applying only the first 2 commits, then snapshots. Asserts the checkpoint's head/commit count are right and its shape matches a genuine 2-commit repo's full replay. Then it also extends that checkpoint the rest of the way and asserts the result matches a full fresh replay of the 3-commit repo — covering both the stop point and the resume.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `extending_a_cached_timeline_matches_replaying_it_whole`
- spec 3 · read at `b92d9e5e2d97` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:44:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds a small test repo with several commits, first walks only a prefix of them (simulating a stale cache), then adds more commits and re-walks with the cache in place (an incremental "extend"), and separately does a full from-scratch replay of the entire history. Asserts the two resulting timelines are identical, proving the incremental cache path produces the same result as replaying everything.
- found: Reads a cached 3-commit timeline, adds one real new commit, extends the cached timeline, then does a fresh from-scratch read, and asserts the shapes match — essentially what I predicted, though it's "read prefix, add 1 commit, extend" rather than my imagined "walk prefix, add several".
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `extending_past_the_window_folds_to_the_same_state`
- spec 3 · read at `9fbff6039cbb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:44:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Similar to the sibling test but uses a small `limit` so the commit count exceeds the window: builds a repo, does an initial windowed read/cache, adds enough new commits that extending pushes the oldest cached frames out of the window (exercising `fold`, which retires the oldest frames into a summarized base state), then compares the extended result's shape against a fresh windowed read from scratch, asserting they match — proving fold produces the same base state a fresh parse would.
- found: Matches prediction: 3-commit repo, limit=2 window (truncated=1 confirms overflow), adds a 4th commit, extends with same limit=2 (exercising fold), and asserts both commit count stays windowed at 2 and shape matches a fresh windowed read.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_timeline_with_nothing_ahead_of_it_is_current`
- spec 3 · read at `a84f1c76147b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:34Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds a small repo (via `repo_with`), walks its full history to build a timeline whose stored head is the last non-merge commit (not HEAD), then attempts to extend/carry it forward and asserts the outcome is the "Same"/current variant rather than "Refused" or triggering a full re-walk — confirming that a timeline with no non-merge commits ahead of it is correctly recognized as up to date.
- found: Builds a 3-commit repo, reads/walks a cached timeline for it, then calls extend and asserts it returns Carry::Same rather than Refused or a re-walk.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_history_that_was_rewritten_is_not_extended`
- spec 3 · read at `c0a4cfd77e5f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:15Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test confirming that when a repo's history has been rewritten (amend/rebase) so cached timeline frames no longer lead to HEAD, the incremental "extend" logic detects the mismatch and falls back to a full replay instead of naively appending new commits onto stale ones.
- found: Builds a repo with 2 commits, reads a cached timeline, then corrupts cached.head to a bogus all-zero hash (simulating a rewritten history whose cached head no longer matches), and asserts extend() returns Carry::Refused rather than trying to splice onto it.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `vendored_paths_have_no_language`
- spec 2 · read at `c07db8bce984` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:54Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A unit test constructing/parsing a path under a vendored directory (like node_modules or vendor) and asserting that the language-detection function returns None for it, confirming vendored files are excluded from language classification rather than the file walker.
- found: A unit test for `lang_of` asserting vendored/non-source paths (node_modules, README.md) return None while a real source file (tsx) returns Some.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted it tested a commit-processing path but it directly tests the lang_of helper with plain strings, and also checks README.md returns None which I hadn't anticipated.

### `one_walk_at_a_time_and_the_claim_lets_go`
- spec 3 · read at `42355061d853` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:33Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test function exercising the tracing claim guard: claims a repo once (succeeds), attempts a second claim for the same repo while the first guard is still held (expects refusal/None), then drops the first guard and claims again to confirm it now succeeds — verifying both the mutual-exclusion and the release-on-drop behavior.
- found: Test confirms the claim guard is per-repo (a second repo can claim independently while the first is held), verifies claim/refuse/drop/re-claim semantics, and also checks that progress recorded via claim.at() is visible through tracing() while the claim is held.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_shard_is_read_past_the_size_a_source_file_is_refused_at`
- spec 3 · read at `a5c8e52a7ced` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a repo/commit containing a .sanity/ shard blob larger than MAX_BLOB_BYTES (the cap normally applied to source files), replays it through the Replayer, and asserts the shard's contents were still folded into read/unread (i.e. not silently dropped/refused) — proving shards bypass the source size cap, unlike an ordinary oversized source file which would be refused.
- found: Creates a temp git repo with one source commit and a second commit adding a .sanity/ shard padded (with filler function-reading entries) past MAX_BLOB_BYTES; replays it via `read`, and asserts exactly one read entry landed and it names the one real function ('one') — confirming the shard's real entry was parsed despite the file exceeding the source blob size cap.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc explains WHY this matters (a real VectorLand 1.7MB shard bug) which is not derivable from the test code itself.

### `a_committed_reading_lands_on_the_function_it_describes`
- spec 3 · read at `3d7d674c1534` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:31Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test verifying the key-translation join described in the docs: it builds a repo with a function and a committed .sanity/ reading keyed as `path#name` (or `path#name#2` for a twin), runs the history walk which keys by `path#owner::name#ord`, and asserts the reading is correctly attached to the matching function's history entry rather than being silently dropped because of a key-format mismatch.
- found: Integration test: builds a real git repo with one file/two functions, commits a .sanity/ shard with one reading for `one`, runs history::read, and asserts the reading joins to function `one` with correctly-packed predicted/documented/legible/trap bits. Then deletes the shard in a new commit and asserts the reading shows up as retired/unread in that commit — a part not covered by my prediction.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_trace_reports_one_denominator_and_never_goes_backwards`
- spec 3 · read at `eaf638216cb5` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:04Z · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that creates a small temp repo with several commits, calls `read` while collecting all progress callbacks, and asserts that all progress reports (excluding the separate "reading the log" phase) share a single denominator (`total`) and that `done` never decreases across the sequence of reported progress — verifying the walk's progress reporting doesn't alternate between two different counters.
- found: Builds an 8-commit temp repo, calls `read` collecting every progress callback with total>0, filters out the separate "reading the log" phase, then asserts there's exactly one distinct `total` across the remaining walk progress and that `done` never decreases across them.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Already read this exact function in full during the earlier file-level task on history.rs, so this is a warm read rather than a cold prediction.

### `with_loaded`
- spec 3 · read at `6447ae5e3a8a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:13Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Checks a cached/loaded HistoryScan (thread-local or static cache keyed by repo path) — if the cached timeline matches `repo`, reuses it; otherwise loads/builds a new one for that repo. Calls `f` with a reference to that HistoryScan and returns Some(result), or None if no timeline could be loaded/built for that repo.
- found: Locks a global mutex-guarded Option<(PathBuf, HistoryScan)> cache. If the cached repo path doesn't match the requested one, replaces it by calling stored(repo, ALL_COMMITS), propagating None via `?` if that fails. Then calls f with a reference to the cached HistoryScan and returns Some(result).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `unload`
- spec 3 · read at `4dd8d325d41f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:28Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Locks the single global loaded-history state (Mutex/OnceCell) and clears it to None, dropping whatever timeline was cached so the next access re-replays from scratch.
- found: Locks the global LOADED mutex (recovering from poison) and sets it to None.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `tables` — QUIRKY
- spec 3 · read at `1e5a66f71166` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:46Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Given a repo path, checks whether a persisted history/replay cache exists (or whether the path is a git repo at all) and, if so, loads and returns a `Tables` struct providing access to the replayed data (functions, log, touches, deltas, etc. per the peer accessor names); returns None when there's nothing to load, e.g. not a git repo or no cached timeline yet.
- found: Uses with_loaded to access the repo's in-memory replay state and builds a Tables snapshot from it: paths, langs, func_count, base/base_read/base_ts, head, truncated flag, commit count, plus an `excluded` mask computed by checking each path against the repo's gitignore scope.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `funcs`
- spec 3 · read at `bde288f745f1` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that loads/gets the repo's cached timeline state, reads its interned functions vector, and returns a slice [from, from+count) clamped to the vector's length (short read at the end rather than panicking), cloned into Vec<HistoryFunc>.
- found: Uses with_loaded to access the repo's loaded timeline state, then skip(from).take(count).cloned().collect() over s.funcs, defaulting to an empty vec if the repo isn't loaded.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `log`
- spec 3 · read at `6ab9aa97e5f3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: log opens the repo's commit history and walks commits starting after `offset`, collecting up to `count` of them into `LogRow` structs (hash, message, author, date, etc.). When `scope` is a non-empty directory path, it filters commits by checking each commit's changed-file list for a path prefix match against `scope`, skipping non-matching commits without counting them toward offset/count. If the walk runs out of commits before reaching `count`, it returns however many it found rather than erroring.
- found: Uses with_loaded to get cached repo state, filters s.commits by touches(s, c, scope) when scope is non-empty (before skip/take, so scope-filtering doesn't count against offset/count as I predicted), then skips offset, takes count, and maps each HistoryCommit into a LogRow with sha/short/ts/author/subject and set/del counts. Returns empty vec on load failure via unwrap_or_default.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `touches`
- spec 3 · read at `12bb000f3d8b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:06Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Looks up the set of file paths changed by commit `c` (likely via scan's file/commit index) and checks whether any of them fall under `scope`, using segment-wise prefix comparison (matching on path components rather than raw string prefix) so that "web/src" as scope does not incorrectly match a path like "web/src-old/foo.ts". Returns true if at least one changed path is within scope.
- found: Checks whether any of commit c's changed file indices resolve to a path (via scan.paths) that starts with scope followed by a '/' boundary — segment-wise prefix match, avoiding false positives like "web/src-old" matching scope "web/src".
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `scoped`
- spec 3 · read at `f174840aabcd` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:09Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Given a repo and a path/scope string, runs a git log restricted to that path (e.g. `git log --reverse --format=%H -- scope`) to find the commits that actually touched files under that subtree, then maps each of those SHAs to its integer index/position in the full commit timeline (via a lookup table or cache), returning that as a Vec<u32> of frame indices, oldest first. This is used to build a scrub bar limited to only the commits relevant to a drilled-in subtree, rather than the whole repo's commit count.
- found: Uses the already-loaded in-memory commit list (via with_loaded) and returns either all indices 0..len if scope is empty, or filters commits by a `touches(s, c, scope)` predicate and collects their indices as u32, oldest first; returns empty vec if the repo isn't loaded.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `deltas` — TRAP
- spec 3 · read at `5e777f9cf7d6` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:43Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Loads or accesses cached history state for `repo` (perhaps via a `with_loaded` helper), then for commit indices in [from, from+count) builds a delta object per commit (set/del/read/unread/files, as seen in the `advance` function's Deltas type) and serializes each into a serde_json::Value, returning them as a Vec for the frontend to consume via a Tauri command.
- found: Uses `with_loaded` to get cached history state for `repo`, slices commits [from, from+count) via skip/take, and maps each to a JSON object with ts/author/set/del/read/unread/files, returning the collected Vec (or empty Vec if the repo isn't loaded, via unwrap_or_default).
- predicted: full · documented: most · derivable: no · legible: full · trap: yes
- note: unwrap_or_default() silently returns an empty Vec when with_loaded fails (repo not loaded/error), which is indistinguishable on the JS side from a genuinely empty commit range — a caller folding forward could stall silently instead of erroring.

## src-tauri/src/lib.rs

### the file itself
- spec 2 · read at `5d3455064e52` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:05:28Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Tauri application crate root: builds the main window (build_window), the app menu including a theme submenu (build_menu, ThemeMenu::select), and exposes a run() entry point that constructs and launches the Tauri app, wiring up shared state and command handlers used to drive the scan/parse/score pipeline described in the header doc.
- found: Crate root: declares the pub mod list for the whole pipeline, builds the main window with macOS-specific traffic-light/titlebar overlay handling, builds the app menu (including the ThemeMenu radio group and an install-cli item), and defines run() which sets up shared agent-API state, registers the Tauri invoke_handler command list, spawns the loopback agent API server, restores the previously open project, and on exit stops all runs and releases the endpoint file so other processes know the backend died.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no

### `build_window`
- spec 2 · read at `b7ebd27862ee` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:18Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Uses tauri::WebviewWindowBuilder to construct the main window programmatically (title, url, inner size, min size, resizable), setting a hidden/overlay titlebar style with a custom traffic-light button inset position, then calls .build() and handles the Result (likely unwrap or log on error). This exists because the traffic-light inset position isn't expressible in tauri.conf.json.
- found: Builds the main webview window with title/inner size/min size, then on macOS only (cfg-gated, since the API doesn't exist elsewhere) sets an overlay title bar with hidden title and a custom traffic-light position; logs to stderr if build() fails rather than panicking.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `select`
- spec 2 · read at `637ea3e71aa8` · commit `10d6afa` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:03:30Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the ThemeMenu's checkable menu items (theme options), setting each item's checked state to true if its id/label matches `which` and false otherwise, so the OS menu reflects the currently active theme.
- found: Directly sets checked state on three fixed fields (light/dark/system) by comparing each to `which`, rather than iterating over a generic collection of menu items as I predicted.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I imagined a loop over a collection; it's actually three fixed named fields, implying ThemeMenu has exactly three hardcoded theme options rather than an arbitrary list.

### `build_menu`
- spec 3 · read at `aaa0ebec0623` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:59Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Constructs the app's menu bar using Tauri's predefined menu items for standard behaviors (About, Hide/Hide Others, Quit, Edit menu's copy/paste, Window menu's ⌘W close), plus a custom submenu (likely under a "View" or app menu) holding a three-way theme toggle (Light/Dark/System) as checkable menu items. Returns the built Menu along with a ThemeMenu struct that holds handles to those three theme items so their checked state can be updated later when the theme changes.
- found: Builds Sanity app menu (about/install-cli/hide/quit), File menu with "Add Project…", Edit menu with predefined clipboard items, View menu with an Appearance submenu of three checkable theme items (light/dark/system, system checked by default), and a Window menu; returns the assembled Menu plus a ThemeMenu holding the three checkbox item handles.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `run`
- spec 3 · read at `758056b76e74` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The Tauri application entry point: builds the app with tauri::Builder, registers plugins, sets up shared app state (scan cache, project list), builds the window and menu via build_window/build_menu, registers the invoke_handler with all the command functions (scan, trace, project management, etc.), and starts the event loop with .run(). Likely also wires up the loopback/agent API server mentioned in the file doc.
- found: Builds the Tauri app: manages shared agentapi state, sets up the window/menu (macOS-only theme/open-project/install-cli menu handling), restores prior projects with shape/progress event emitters, spawns the agentapi loopback server, registers single-instance/dialog/opener plugins, registers the full invoke_handler command list, and on RunEvent::Exit stops all runs and releases the endpoint file so external MCP clients know the backend died rather than retrying into a hole.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: The exit-handling rationale (endpoint file release ordering vs stopping runs, and why it matters for MCP shim retry logic) wasn't derivable from the signature — it's the most surprising/load-bearing part of the function.

## src-tauri/src/links.rs

### the file itself
- spec 3 · read at `a529ee72768c` · commit `758c706` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:04:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: links.rs defines a Links lookup table built once alongside the caller/clone-count "wedges" — it precomputes, per function, the actual lists of callers/callees and clone-siblings (not just counts) by consuming crate::edges and crate::clones output, so the UI panel can answer "which fourteen callers" on click. It exposes Links::build, Links::at/reference for lookup, len/is_empty, and includes unit tests encoding edge cases (unparsed language not zero, clone group excludes self, too-short bodies flagged, absent line numbers).
- found: A cached lookup table, built once alongside the scan tree, mapping each function to its actual callers/callees/clone-siblings (not just counts) so the UI panel can drill into "which fourteen callers" without a repo-wide reparse. Distinguishes `wired: false` (language not parsed for calls) from an empty list, and `comparable: false` (body too short to clone-compare) from an empty clone list; keyed by (path, start-line) since node ids would orphan on edits.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `build`
- spec 3 · read at `e5cce837558a` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:23Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: build walks files in the same flat indexing as wiring and copies, and for each function populates a Links entry listing its actual callers, actual callees, and clone-group twins by name/id (not just counts) — assembling the lookup table the detail panel queries to answer "which fourteen callers" without re-deriving it from wiring/copies each time.
- found: Assigns each function a dense id in file-walk order (also indexing by file+start_line), records per-entry metadata (name, owner, loc, whether the language resolves calls, whether it's shape-comparable), then populates calls/callers lists from wiring.edges via id lookup, and inverts Copies' group membership into sorted per-group member lists.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `at`
- spec 3 · read at `7005b2a6b176` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:29:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up the function starting at `line` in `path` within an internal map (keyed by path and line), and returns a `Related` struct bundling caller names, callee names, and clone-group info for that function. Returns None if no function is recorded at that exact path/line.
- found: Looks up the file index by path, then the entry id by (file, line) via an index map; fetches the entry, resolves callers/calls/clones lists via a `reference` helper, and returns a Related bundling those plus the entry's wired and comparable flags. Returns None if the path isn't found or no entry starts at that line.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `reference`
- spec 3 · read at `1cd85c138c35` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:11Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Takes a function id and looks it up in the internal function table, returning a small Ref struct (name, path, line) that identifies that function for display — used when building the caller/callee/clone lists returned elsewhere by this module.
- found: Indexes self.entries by id, then builds a Ref by cloning path (via a files interning table), name, owner, and copying line and loc — a display-ready identifier for a function used to populate caller/callee/clone entries.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `len`
- spec 3 · read at `0c539301cd32` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns self.entries.len() — the number of functions in the lookup table, zero when the table was never built.
- found: Returns self.entries.len(), exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `is_empty`
- spec 3 · read at `53cf79b44577` · commit `d92c31f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-20T23:30:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A trivial boolean accessor on Links that returns whether the lookup table has zero entries, most likely implemented as `self.len() == 0` delegating to the len() peer, used to detect a repo/language with no parsed wiring data at all.
- found: Delegates to self.entries.is_empty() rather than a len()==0 comparison, otherwise exactly as predicted.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `func`
- spec 3 · read at `581959df9526` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper (given the surrounding snake_case sentence-style test names) that constructs a FuncDef struct from the given name, line, calls slice, and optional shape hash, filling in any other FuncDef fields with sensible defaults so tests can build sample function tables concisely.
- found: Test helper constructing a FuncDef from name/line/calls/shape, defaulting signature/body to empty, doc/owner to None, and end_line to start_line+4.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: docs field shown was the enclosing module's file_doc, not this function's — it has no doc of its own.

### `table`
- spec 3 · read at `b91a4ffa1194` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:53Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds the raw per-function lookup table (path+line -> Related) that Links::build wraps: for each function definition across all files, resolves its callers/calls edges (via crate::edges) and its clone group (via crate::clones), and inserts an entry keyed by (path, line) into a HashMap, which is what Links::at then looks up on demand from the panel.
- found: A tiny test-helper that wraps a list of (path, funcs) into FileViews (hardcoded Lang::Rust), computes wiring via edges::wire and copies via clones::find, then delegates to Links::build — it doesn't build the table itself, just assembles the inputs Links::build needs.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc is for the whole links.rs module, not this function specifically (documented:none is fair here) — this is clearly a private test-setup helper (peers are all test names) rather than the production table-builder I initially guessed at from the name alone.

### `a_caller_and_its_callee_name_each_other`
- spec 3 · read at `66d8d7304550` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a Links table from a fixture with one function that calls another (using func's edges parameter), then calls at() on both, asserting that the caller's calls list contains the callee and the callee's callers list contains the caller — verifying edges are recorded symmetrically in both directions.
- found: Builds a table with a caller function edging to a target function; asserts the callee's callers list names the caller and its own calls list is empty, and the caller's calls list names the target.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `an_unparsed_language_is_an_absence_not_a_zero` — QUIRKY
- spec 3 · read at `2e5bdff248ba` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:37Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A unit test building Links for a function in an unparsed/unsupported language and one in a parsed language with no callers, then asserting Links::at (or similar) returns None for the unparsed one versus Some(empty lists) for the parsed-but-uncalled one, mirroring the same absence-vs-zero distinction tested in edges.rs.
- found: Builds Links for a SQL function (unparsed) and asserts `links.at(...)` still returns Some(entry) but with `wired: false`; builds the same for a Rust function and asserts `wired: true`. The absence/zero distinction lives in a boolean field on the entry, not in Links::at returning None vs Some.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: I expected the None-vs-Some(empty) split to happen at Links::at's Option return, but it actually happens via a `wired` bool field on the always-present entry.

### `a_clone_group_lists_the_twins_and_not_the_function_itself`
- spec 3 · read at `cadf00d68fba` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:09Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds a Links table from a small fixture containing at least two clone-similar functions, calls at() on one of them, and asserts that the returned clones list contains the other member(s) but not the function itself, verifying self-exclusion from clone groups.
- found: Builds a table with two clone-matching functions in different files plus an unrelated third; asserts the clone-group member excludes itself and lists the other file, that it's marked comparable, and that the unrelated function has an empty clones list while still being comparable (long enough to compare, just shares nothing).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_body_too_short_to_compare_says_so`
- spec 3 · read at `e005b027a2da` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:25:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a unit test verifying that a function whose body is too short to be compared for clones reports `comparable: false` in the Links lookup table, rather than just having an empty clone list. It likely constructs a small synthetic function/node with a trivial body, runs it through Links::build, and asserts on the `comparable` field being false and clones being empty.
- found: A unit test building a table with one tiny function (empty body) and asserting that its `comparable` field is false via `links.at(...)`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `neighbours`
- spec 3 · read at `b3e46eac9647` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:07Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: An #[ignore]-marked test: reads a REPO env var pointing at a real repo, scans it, builds the Links table via Links::build, then prints the ten most-called functions (sorted by caller count) and the largest clone group to stdout via --nocapture, as a manual sanity check that the tables have real content rather than being empty on a tiny fixture.
- found: Reads REPO env var, runs the real scan() (not Links::build directly) to get a Scan with a links table, prints function count/scan time/encoded table size, then the ten most-called functions and the largest clone group with a few of its members, all via println for --nocapture.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Docs explain the WHY (cheapest way to catch an empty-but-well-formed table) which isn't recoverable from the code itself, so derivable=false despite full coverage.

### `a_line_no_function_starts_at_is_absent`
- spec 3 · read at `324cc6de97de` · commit `d92c31f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-20T23:30:36Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a Links table from a small fixture, then calls Links::at with a (path, line) that does not correspond to any function's start line (e.g. an interior line, or a line from before an edit shifted things), and asserts the returned lookup is None/absent rather than some zeroed-out default result.
- found: Tests two absence cases: a wrong line number in a known file, and any line in a file not in the table at all — both return None via Links::at.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc's "before an edit" scenario isn't literally tested here; the test just covers wrong-line and wrong-file cases, both collapsing to the same None outcome.

## src-tauri/src/local.rs

### the file itself
- spec 2 · read at `286441edffd6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:01Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Implements an on-machine scoring backend (alternative to the Ollama/HTTP path) that loads a local LLM directly via a Rust inference crate, discovers available local model files on disk, and computes per-token surprisal for an entire function body in a single forward pass with logits requested at every position, avoiding the per-token generation cost of the HTTP path. Exposes a LocalModel type (load/label/is_model/surprisal/surprise) plus discover_models and score_one entry points mirroring the interface the rest of the app expects from any scoring backend.
- found: local.rs implements local scoring via llama_cpp_4: LocalModel loads a GGUF and spawns a dedicated owner thread (context is !Send) that receives scoring jobs over a channel; score_one tokenizes prefix+body, decodes in one batch requesting logits only over the body span, and computes mean bits-per-token surprisal via log-softmax. discover_models scans Ollama's blob store directory for files over 100MB as a cheap way to find already-downloaded weights, with no format/magic-number check.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `load`
- spec 3 · read at `8c523f909942` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:57Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Opens the GGUF file at path using a llama.cpp binding, builds a model + context, and spawns a dedicated OS thread that owns that context since llama contexts aren't Send/thread-safe for concurrent use. Sets up an mpsc channel between the returned LocalModel handle and that thread so callers can send scoring requests, and returns the LocalModel struct wrapping the sender plus a derived label (e.g. filename stem).
- found: Derives a label from the filename, spawns an owner thread that loads the backend/model/context (leaking backend and model to 'static since LlamaContext borrows the model and the struct would be self-referential otherwise), sends the load result back over a one-shot ready channel so load() can return a proper Result synchronously, then loops receiving (prefix, body) scoring jobs off an mpsc channel and replying via a oneshot reply channel per job until all senders drop. Returns LocalModel{label, jobs: Mutex<Sender<Job>>}.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The Box::leak-to-'static trick for the self-referential model/context pair, plus the separate ready_rx handshake to surface async load errors synchronously, aren't obvious from the signature/docs alone.

### `surprisal` — OBSCURE
- spec 2 · read at `476dc5b143b1` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:04:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Locks the model behind a mutex, then tokenizes prefix+body (prefix as context, body as the target text), runs one decode pass requesting logits at every position, and computes -log2(P(actual token)) averaged over just the body's tokens (excluding prefix tokens), returning the mean as bits/token in Some, or None on tokenization/scoring failure.
- found: It doesn't compute anything itself — it packages (prefix, body) into a job, sends it over an mpsc channel to a worker (guarded by a mutex on the sender side), and blocks on a reply channel for the result, returning None if any step fails.
- predicted: none · documented: some · derivable: no · legible: full · trap: no
- note: I predicted the mutex directly guarded the matmul/decode computation in this function; actually this function only dispatches a job to a separate worker thread via channels and blocks for the reply — the real computation lives elsewhere (likely score_one).

### `score_one`
- spec 2 · read at `7e93f16195bd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:53Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Tokenizes prefix + body, runs one `decode` call on the full sequence with logits requested at every position (getting P(token | prior tokens) for the whole body in a single forward pass instead of Ollama's one-pass-per-token trick), then sums/averages the negative log-probabilities of the body's actual tokens into a surprisal score. Returns None if tokenization, context capacity, or decode fails.
- found: Tokenizes prefix/body separately, rejects bodies under 8 tokens, truncates the body to at most half of MAX_TOKENS and trims the context (never the body) to fill remaining room, then does a single decode requesting logits only at the positions needed to predict each body token (not every position, for speed), computes log-softmax manually with a max-subtraction for numerical stability, and returns the average surprisal in bits per token.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: I assumed logits were requested at every position; it actually only requests them at the specific positions needed to score body tokens, which the comment says roughly triples cost if done naively over full context.

### `label`
- spec 2 · read at `4f50426f582a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:58Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Trivial accessor returning a human-readable identifier for this local model, likely the model's file/name string (perhaps prefixed like "local:<name>") used for display or cache keying — one line delegating to a stored field.
- found: Returns a clone of the self.label field — a stored string, not derived from a model name field or prefix as I guessed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed a name/prefix-derived string; it's just a stored `label` field, so I got the shape right but the specific field wrong.

### `is_model`
- spec 2 · read at `67310d59233c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:18Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A trivial trait-implementation marker: returns `true` (hardcoded) to identify that this scorer is a local, in-process model (as opposed to a remote/API-based one), likely used by calling code to decide which code path or UI messaging to use.
- found: Returns hardcoded `true`, a trait-implementation marker identifying this scorer as a local model.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `surprise`
- spec 2 · read at `b4a87facc399` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:28Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Calls self.surprisal(item) to get the model's real per-token logprob-based surprisal score for the item's body text, then wraps it into a Reading (score, source='model', etc.), using `proxy` as a fallback value if surprisal computation fails or as a comparison/blend factor rather than the primary score.
- found: Builds a prefix from item.context + item.signature (matching the HTTP backend's conditioning context), calls self.surprisal(prefix, item.body); if Some(bits), returns Reading::plain(calibrate_surprisal(bits)); if None, falls back to Reading::plain(proxy).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `discover_models`
- spec 2 · read at `6300ccb643a9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:04Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Locates the Ollama blob store directory (likely ~/.ollama/models/blobs or similar), lists its entries, and filters for files whose size exceeds a 100 MB threshold, treating those as model weight files. Returns the resulting paths as a Vec<PathBuf>, with no format/magic-number validation.
- found: Reads ~/.ollama/models/blobs, keeps entries over 100MB as presumed model weights (no format check), and returns the sorted list of paths.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The docs handed to me essentially stated the implementation (100MB threshold, no format check) rather than describing intent, so this one was pre-solved by the doc text itself.

## src-tauri/src/main.rs

### the file itself — QUIRKY
- spec 2 · read at `85fd5a79591b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:02Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Standard minimal Tauri desktop entry point: a windows_subsystem attribute to suppress the console window on Windows release builds, and a fn main() that just delegates to a run() function defined in the crate's lib.rs to build and launch the Tauri application. No real logic lives here — it's boilerplate wiring, not the app's responsibility.
- found: Single-binary dispatch: the windows_subsystem attribute is there as expected, but main() isn't a pure passthrough to a run() function — it branches on argv. `mcp` as first arg runs the stdio MCP server; any other args go to a CLI dispatcher (serve/check/read verbs); no args opens the Tauri window. The comments explain this is deliberate: one binary avoids a second installable (the CLI/MCP server) drifting from the GUI app.
- predicted: some · documented: none · derivable: yes · legible: not judged · trap: no
- note: Same binary serves as GUI app, CLI, and MCP server depending on argv — not the boilerplate-only entry point I expected.

### `main`
- spec 2 · read at `751e5a336219` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:38Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Checks std::env::args() for a subcommand (like `mcp` for the stdio MCP server mode, or other CLI subcommands) and dispatches to CLI handling code if present, otherwise falls through to launching the Tauri GUI application via tauri::Builder setup and .run(...).
- found: Special-cases `mcp` as first arg to run the stdio MCP server; any other args go to the headless CLI dispatcher (serve/check/read verbs); no args launches the Tauri GUI window.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/mcp.rs

### the file itself
- spec 3 · served in 2 parts · read at `5e84fc27ff6c` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:55:15Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Implements the stdio MCP server that ships inside the app binary itself (`sanity mcp`), replacing an old separate Node script. Defines two disjoint tool surfaces — reader tools (the predict/reveal/report loop for an agent doing a sanity_next-style assessment) and human/CLI tools — talks to the app's own state via HTTP-style helper functions (client/get/post/urlencode/decode/with_retry/heal) against a local loopback server, dispatches incoming tool calls by name, and includes a contract fingerprint plus tests asserting the two surfaces are complete, disjoint, and that everything advertised is dispatchable and vice versa.
- found: A stdio MCP server embedded in the app binary, with a per-role tool surface (Reader gets only next/reveal/report; Human/orchestrator gets open/check/status/summary), forwarding calls as HTTP requests to a loopback backend it can start itself. It maintains per-process state (PROJECT, set from env or from a successful sanity_open) so concurrent sessions on different repos don't collide, implements a resilient retry/heal loop that distinguishes transient connection failures from fatal HTTP error responses (4xx vs 5xx get different, carefully worded advice to the calling model), computes an FNV contract_fingerprint hashing the whole tool schema to catch schema drift between the two halves, and includes tests asserting the reader/human surfaces are disjoint and complete and that everything advertised is dispatchable and vice versa. I underpredicted the depth of the retry/backend-healing machinery and the deliberately model-directed error copy (UNREACHABLE vs NOT_RUNNING), and didn't anticipate the per-session PROJECT isolation being the actual reason for the shim's statefulness.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no

### `project` — QUIRKY
- spec 2 · read at `828a0c7bf6ed` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:22Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads some environment variable or config value (perhaps SANITY_PROJECT or similar) to determine the current project identifier/name, returning None if it's not set or empty. Likely used to scope API calls to a specific project.
- found: Returns a clone of a global mutex-guarded PROJECT static, or None if unset/lock fails. Not an env var read as I guessed — it's in-memory shared state, presumably set elsewhere (a tool call setting the active project).
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `role`
- spec 2 · read at `bfd62ab401fa` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Reads an environment variable (or similar external signal) to determine whether this MCP server process should present itself as the reader/agent role or the human role, and returns the corresponding Role enum variant, defaulting to one of them if unset.
- found: Reads the SANITY_ROLE env var; returns Role::Reader if it's exactly "reader", otherwise defaults to Role::Human.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `base_url` — QUIRKY
- spec 2 · read at `9307f3f15219` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:46Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Reads the port file the running app publishes (some fixed path, likely under a temp or config dir), parses out the port number fresh on every call (no caching, since the app may have restarted on a new port), and returns Some(format!("http://127.0.0.1:{port}")) on success or None if the file is missing/unreadable/unparsable.
- found: Checks a SANITY_BACKEND env var override first, then falls back to delegating the actual file read/parse to agentapi::read_endpoint(), converting the result to a URL string; returns None if that fails.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Missed the env var override and the delegation to a shared parser in agentapi — I invented the file-reading logic myself instead of predicting it was factored out elsewhere.

### `with_retry` — QUIRKY
- spec 2 · read at `72c9619e1d27` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:24Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Loops for a bounded time window, each iteration re-resolving the endpoint via base_url() and calling attempt(&url). Ok returns immediately. A retryable connection-level error triggers a heal/restart-backend attempt (only once across the whole loop) then a short sleep before retrying; a parsed HTTP response (non-connection error) returns immediately as Err since it's already an answer. If the window closes without success, returns Err(String) describing the timeout/failure.
- found: Loops until a deadline; each pass gets the base_url (missing file is treated as "still starting", not an error) and calls attempt. Fatal errors return immediately; transient ones fall through. On deadline expiry it distinguishes UNREACHABLE vs NOT_RUNNING via a live-process probe rather than endpoint-file presence. If nothing is live, it triggers heal() exactly once across the whole call (gated by a `healed` flag and by cli::live().is_none()), retrying immediately on success rather than sleeping; otherwise it sleeps RETRY_EVERY and loops.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `heal`
- spec 3 · read at `893c3d008631` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Restarts/relaunches the backend process (spawns it fresh), then synchronously reopens the previously-remembered repo by reading the path from the shim's own PROJECT state (not from any tool argument) and issuing an open-project call against the new backend. Returns Ok(()) if PROJECT is empty/unset (cold-start, nothing to restore) or after successfully reopening; returns Err(String) if either the restart or the reopen call fails.
- found: Calls ensure_backend() to make sure a backend is up, then if no remembered project path exists returns Ok immediately (cold start). Otherwise it directly POSTs to {base}/open with the remembered path, deliberately bypassing the normal `post` helper (which is what calls heal on failure) to avoid infinite recursion.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains the surrounding recovery design well but doesn't mention the deliberate bypass of `post` to avoid recursion — that's only in an inline comment, which is the real payoff detail.

### `client`
- spec 2 · read at `0f6714dc0296` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:40Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Constructs a reqwest::blocking::Client (e.g. with a timeout set) for use by the MCP server's HTTP calls to the local loopback API, wrapping any build error as a RetryableError.
- found: Builds a reqwest::blocking::Client with REQUEST_TIMEOUT set, mapping any build failure to RetryableError::Fatal.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `decode`
- spec 2 · read at `e2ffb668c1d8` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks the response status before parsing. On success, parses and returns the JSON body as Ok(Value). On 4xx, reads the plain-text rejection body (e.g. from axum's extractor) and returns a non-retryable RetryableError explaining the caller's arguments were bad and nothing was recorded, so fix-and-resend is required. On 5xx, returns a retryable RetryableError noting Sanity's own fault, since something may have been recorded and blind resending is unsafe.
- found: Success: parses JSON, but even that has a Fatal-error path if the body doesn't parse (not just green-path Ok). Failure: reads and truncates the text body to 400 chars, then builds a detailed instructional message — but BOTH 4xx and 5xx return RetryableError::Fatal, just with different wording (4xx says fix-and-resend; 5xx says stop and report to human, do not resend) — there is no separate 'retryable' variant as I predicted.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Expected a distinct retryable-vs-fatal enum split on 4xx/5xx, but both map to the same Fatal variant with different prose — the retry semantics live entirely in the message text, not the type.

### `get`
- spec 2 · read at `f8fa773a68b5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:13Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: An HTTP GET helper for the MCP server talking to the app's loopback API: joins `base_url()` with `path`, issues the request via `client()` (likely wrapped in `with_retry`), and decodes the JSON response body into a serde_json::Value, returning a String error on failure (network error, non-200 status, or decode failure).
- found: Wraps a GET request in with_retry: builds a client, sends a GET to base+path, maps a send failure to a Transient retryable error, and decodes the response into a Value on success.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `post`
- spec 2 · read at `34314aa7895c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:12:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds a URL from base_url() + path, issues an HTTP POST with `body` as JSON using the shared client() (likely wrapped in with_retry for resilience against a backend that's still starting), and decodes the response into a serde_json::Value via `decode`. Returns Err(String) with a readable message on network or decode failure.
- found: Wraps the POST in with_retry(base -> ...), builds URL from base+path, sends body as JSON via client(), mapping a send failure to RetryableError::Transient so with_retry can retry against a backend that may still be starting up, then decodes the response.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `urlencode`
- spec 2 · read at `6ead12706987` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Percent-encodes a string for a URL query string: iterates over the input, passing through unreserved characters (alphanumeric and a small safe set like -_.~) unchanged, and escaping everything else, including spaces, as %XX hex byte sequences, built as a small hand-rolled loop rather than via an external crate.
- found: Hand-rolled percent-encoder over bytes: passes through alphanumerics plus -_.~/ unchanged (the / left alone since keys are paths), escapes everything else as %XX uppercase hex.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `all_tools`
- spec 2 · read at `205e1de8a76c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:06Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns a single JSON Value (array) that is the union of reader_tools() and human_tools() — the full tool contract used purely as input to contract_fingerprint, not filtered by caller role the way tools() is.
- found: Concatenates the arrays from reader_tools() and human_tools() into one Vec and wraps it as a JSON Value::Array — the whole tool contract, unfiltered by role.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `tools`
- spec 2 · read at `b365171e0236` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:25:05Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Determines the connection's role (reader vs human, via the `role` peer) and returns the JSON tool-list Value appropriate to that role — reader_tools() for a reader connection (just sanity_open/reveal/report per the docs) or human_tools()/all_tools() for a human/orchestrator connection — so a reader is never shown tools it can't call.
- found: Exactly as predicted: matches role() and dispatches to reader_tools() or human_tools().
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `reader_surface`
- spec 2 · read at `942441d295fa` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:19Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns the JSON value describing the reader tool surface by calling reader_tools() directly (not tools(), which depends on an env var set at process spawn time), so a non-server process like `just tokens` can measure a reader's exposed schema deterministically.
- found: Just returns reader_tools() directly.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `reader_tools`
- spec 3 · read at `86332db7aba0` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:41:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns a serde_json::Value describing the MCP tool schemas exposed to the "reader" role — sanity_next, sanity_reveal, and sanity_report — each with a name, description text, and JSON input schema. It's the reader-facing half of the tool surface, complementing human_tools, and gets merged into all_tools/tools.
- found: Returns a json! array of the three reader-facing MCP tool definitions — sanity_next, sanity_reveal, sanity_report — each with name, a long prose description (identical to what a reader sees when calling these tools), and an inputSchema. Also carries load-bearing inline comments explaining that sanity_report's schema field ORDER matters because a mangled emission swallows content into whatever field precedes it.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The `docs` handed alongside this function ("What a reader may say. Multiplied by the function count — see tools.") don't describe this function at all — they read like they belong to some other declaration (maybe a comment count or total-readings concept), so documented is graded none rather than against this mismatched text.

### `human_tools` — QUIRKY
- spec 2 · read at `ecee0d4f15ea` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:43Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns a hardcoded serde_json::Value array of MCP tool schema definitions (name, description, input JSON schema) for the human/client-facing side of the MCP surface — likely tools like starting a study/scan, checking status, listing projects — as distinct from reader_tools, which serves the narrower loop a reader agent gets. Since it's loaded once per session rather than per-reading, I'd expect richer/longer description text embedded directly as string literals.
- found: Returns a hardcoded JSON array of four MCP tool definitions for the human-driving side: sanity_open (pick/open a repo, get protocol+shape+excluded), sanity_check (kick off a scan with model/readers/limit params), sanity_status (poll remaining/in_flight/outstanding leases), and sanity_summary (final aggregate report, explicitly repo-wide with no file/function names). Descriptions are long, imperative, and encode a lot of orchestration protocol directly (don't read .sanity/, don't spawn readers yourself for check, use held_for_s age not just remaining to detect dead waves).
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Correctly guessed the hardcoded-JSON-schema-array shape and rich-description intent, but invented the wrong tool set entirely rather than the actual open/check/status/summary lifecycle.

### `contract_fingerprint`
- spec 2 · read at `36de63dce2a4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:49Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Serializes the full set of MCP tool schemas (likely via all_tools(), in a canonical/deterministic order) to bytes, runs an FNV hash over them, and formats the result as a short hex string used to detect schema drift between builds.
- found: Serializes all_tools() (deliberately the full surface, not just the caller's own) to JSON via serde_json, then runs a manual FNV-1a 64-bit hash over the UTF-8 bytes, returning it as a 16-digit hex string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Comment explains it must hash all_tools() rather than just tools() (the caller's own surface) because a past incident involved the reader's half going stale unnoticed.

### `dispatches`
- spec 2 · read at `7aa93d1c2a45` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:35Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A simple function taking a tool name string and returning true/false via a match/matches! against the literal list of tool names handled in `call` (sanity_next, sanity_reveal, sanity_report, sanity_open, etc.), used to check dispatchability without actually invoking the tool.
- found: Exactly as predicted: a matches! macro against the literal list of seven tool names (sanity_open, sanity_check, sanity_status, sanity_next, sanity_reveal, sanity_summary, sanity_report) that call() handles.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `call`
- spec 2 · read at `d3711b565c61` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:27Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Dispatches an MCP tool call: matches the `name` string against a big match/if-else covering every advertised tool (both reader tools like sanity_next/reveal/report and human tools), extracts/validates fields out of `args`, calls the corresponding internal function, and wraps the result as a JSON Value or returns an Err string for unknown tool names or bad args.
- found: MCP tool dispatcher that first checks the name is a known dispatchable tool, then blocks reader-role callers from admin tools (sanity_open/status/summary), then matches on name to proxy each call over HTTP (get/post) to a local backend server, injecting the session's stored project key into most request bodies/queries, with sanity_open specifically starting the backend and remembering the returned project key.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `run`
- spec 3 · read at `0eb2cb945e5e` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Main loop for the MCP stdio server: reads JSON-RPC requests line-by-line from stdin, handles the initialize handshake and tools/list requests (via tools/all_tools), dispatches tools/call requests to the matching handler (via dispatches/call), and writes JSON-RPC responses to stdout, looping until stdin closes (EOF).
- found: First sets the global PROJECT from a SANITY_PROJECT env var if present (so a launcher-spawned shim always knows its repo even without an explicit sanity_open call). Then loops reading stdin lines, parsing JSON-RPC, skipping notifications (no id), and handling initialize/tools/list/tools/call methods, writing JSON-RPC responses to stdout; tool call errors are returned as isError:true content rather than transport-level errors so the model can read and act on them; unknown methods get a JSON-RPC error response.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The SANITY_PROJECT env-var precedence over sanity_open, motivated by avoiding cross-repo attribution bugs when multiple studies run concurrently, isn't visible from the signature.

### `names`
- spec 2 · read at `969474ddc35d` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:20Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Takes a JSON Value representing a list of tool definitions (as returned by tools/all_tools) and extracts each entry's "name" field into a Vec<String>, used by tests that check tool-surface invariants (disjoint sets, dispatchable-vs-advertised, etc).
- found: Unwraps v as an array and maps each element's "name" field to a String, collecting into Vec<String> — exactly as predicted, a test helper for tool-list assertions.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `the_two_tool_surfaces_are_disjoint_and_complete`
- spec 2 · read at `9006283b4ec0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:28Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A #[test] function asserting that reader_tools() and human_tools() are disjoint sets (no tool name appears in both) and that their union equals the full set of all tools — every tool is served to exactly one of the two surfaces, none to both and none to neither.
- found: A test asserting reader_tools() and human_tools() are disjoint (no name in both) and that their combined names equal all_tools()'s names, exactly matching my prediction.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_reader_is_offered_exactly_its_own_loop`
- spec 2 · read at `f4effee0cfce` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Calls reader_tools() (or similar) and asserts the set of tool names equals exactly {"sanity_next", "sanity_reveal", "sanity_report"} — comparing by name rather than count, so that swapping one tool for another would fail even though the count stays the same.
- found: Gets reader_tools(), extracts and sorts their names, and asserts the sorted list equals exactly ["sanity_next", "sanity_report", "sanity_reveal"] — verifying the reader-facing tool surface is precisely those three, named individually.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `every_advertised_tool_is_dispatchable`
- spec 2 · read at `69644f5ef702` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:37Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that iterates over all_tools() (the full advertised tool schema list) and, for each tool's name, asserts that the `dispatches` helper returns true — i.e. that `call`'s dispatch match actually has an arm for that name — without spawning a real server or invoking sanity_open. This guards against the exact regression described in the docs: a tool added to the schema but not wired into `call`'s match statement.
- found: Iterates all_tools() names and asserts dispatches(&name) for each, exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `nothing_is_dispatchable_that_is_not_advertised`
- spec 3 · read at `e899b57d66a0` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:48Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test (like its peers `every_advertised_tool_is_dispatchable` and `the_two_tool_surfaces_are_disjoint_and_complete`) that checks the converse invariant: it enumerates the tool names `call` actually dispatches on and asserts each one appears in the advertised tool list (from `tools`/`all_tools`/`names`), failing if a dispatchable tool exists that isn't advertised in any schema — the "dead code that still answers" case described in the docs.
- found: A test asserting that every name in a hardcoded list of the actual sanity_* tool names `call` dispatches is present in the advertised tool set from `all_tools()`, catching the case where a tool was removed from the schema/advertisement but its dispatch arm in `call` was left behind.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The dispatchable set is a hand-maintained literal string list rather than derived from `call`'s match arms, so this test only catches drift if someone remembers to update this list too.

### `the_fingerprint_sees_the_readers_half` — QUIRKY
- spec 2 · read at `1e5340813abc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:22Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that computes contract_fingerprint() as seen by the orchestrator role and asserts it is derived from the reader's tool schemas (not the orchestrator's own), likely by comparing it to a fingerprint computed directly from reader_tools(), or by mutating a reader tool's schema and checking the fingerprint changes.
- found: Test serializes all_tools() to JSON and asserts every reader tool's name appears as a substring in it, confirming the fingerprinted/advertised surface includes the reader's tools rather than only the caller's own.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I expected it to exercise contract_fingerprint() directly by name; instead it checks all_tools() output textually, a simpler proxy for the same claim.

## src-tauri/src/model.rs

### the file itself
- spec 3 · served in 2 parts · read at `2a0cd07ba488` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:31:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Defines the core data model for the visualization: a Node tree (files/directories/functions) with size (lines) and color (Score, based on "surprise"/temperature vs documentation/stability), plus Lang and Provenance enums for classifying source. It implements aggregation logic that rolls scores up from functions to files to directories — weighted by lines of code rather than averaged per-function or per-child, with special handling for unreadable/unanalyzed subtrees so they don't get treated as zero. Includes a battery of inline tests asserting these aggregation invariants (hot share, quadrants, wiring/edges vs children, model-authored text not cooling a wedge).
- found: Core data model: Lang enum (huge language list) with extension-sniffing, Provenance/Source/Quadrant enums encoding trust and origin of a score, Score with surprise/documented/churn/hot_share/analyzed_share, and Node (the tree) with aggregate() doing LOC-weighted roll-up of scores and edge-sum (not averaged) wiring stats, plus slim()/Cols for shipping a byte-budget-safe tree to the frontend without functions. Heavily tested for aggregation invariants.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `from_extension`
- spec 2 · read at `5697288466f2` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:48Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A large match/if-chain over the file extension string mapping known extensions (rs, ts, tsx, js, jsx, py, go, etc.) to their corresponding Lang enum variant, returning None for anything not explicitly recognized — no fuzzy or best-guess matching, just an exhaustive literal lookup table, which is why the function runs 93 lines despite being conceptually a single lookup.
- found: Exhaustive literal match over ~60 languages' extensions to Lang variants, None for unrecognized. Missed the interesting part: deliberate tie-break comments for ambiguous extensions (.h→Cpp not C for asymmetric-parse-failure reasons, .v→Verilog not V, .pl→Perl not Prolog, .zsh gets its own grammar).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `label`
- spec 2 · read at `036f950c5ee4` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:10Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A match over Lang variants returning a &'static str display name for each supported language (e.g. Rust => "Rust", Python => "Python", etc.), mirroring the from_extension peer's variant list — likely covering a fairly long list of languages given the 67-line length.
- found: Match over every Lang variant returning its display name string, covering a much longer list of languages (62 variants) than I guessed.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `weight` — QUIRKY
- spec 2 · read at `853d530c5d2c` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:43Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A match over the Provenance enum returning a float weight per variant: full weight (1.0) for human-authored documentation, zero weight for model/agent-authored text (since it cannot cool a wedge at all per the doc), and a partial discount for some ambiguous/unknown-source variant where authorship can't be determined.
- found: Match over Provenance: None=0.0, Source=0.6, History=0.85, Human=1.0 — a graduated confidence discount rather than the binary human/model split I expected.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I expected a binary/near-binary split (human=1.0, model-authored=0.0) with one discounted middle case; actual is four graduated tiers including a History variant I hadn't anticipated, and no explicit model/agent-authored variant at all.

### `temperature`
- spec 2 · read at `14c8abb66a9f` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:22Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns self.surprise directly as f32, with no adjustment for documentation coverage or anything else — a one-line passthrough kept as a named method because it's the single number the wedge color represents.
- found: Returns self.surprise clamped to [0.0, 1.0].
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the clamp, which is a real detail (guards against a surprise value going out of the valid color range) but a minor one.

### `is_stable`
- spec 2 · read at `09cb01dcd499` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:26Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns true if self.age (in days) is at least some generous threshold like 90 days (a quarter), indicating the code hasn't changed recently and reads as settled rather than in-flight.
- found: Requires BOTH churn < 0.25 AND age_days > 90 (via is_some_and, so None age is not stable) — I only predicted the age half, missing the churn condition and the Option-handling default.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `quadrant` — QUIRKY
- spec 2 · read at `7cff2a45459f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:57Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Combines temperature (surprise) and is_stable() to classify the score into one of four Quadrant variants (hot/unstable, hot/stable, cold/unstable, cold/stable). The loc parameter guards against very small or unanalyzed wedges, returning a neutral/no-heat quadrant when there isn't enough analyzed code to trust the reading.
- found: Classifies into one of four named quadrants (CrownJewel, Trouble, Bloat, Quiet) based on (surprise >= HOT, is_stable()); loc only matters in the not-hot case as a size threshold (BULKY=40) distinguishing Bloat from Quiet, not as a data-sufficiency guard.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `of`
- spec 3 · read at `479ef9ed0f5c` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:40Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a `Cols` struct by iterating over `funcs`, skipping any non-function nodes defensively, and pushing each function's loc/commits/touched/callers/calls/clone-group info into parallel Vec columns — using a -1 sentinel wherever the underlying Option is None (mirroring the wire format described in api.ts's `Cols` interface, which said absences are -1 rather than null to keep columns flat number arrays).
- found: Matches the -1-sentinel prediction, but the details are more nuanced than a generic "push value or -1": commits/touched are gated together on `age_days.is_some()` (both -1 if no history at all, even if commits itself could be known), and clones uses a genuine three-state encoding (-1 never compared, 0 compared-no-twin, N clone size) rather than a simple absence check.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The file-level doc explains the size/color philosophy but says nothing about the -1 sentinel encoding scheme; that rationale lives only in inline comments on this function.

### `dir`
- spec 3 · read at `a5506c8e4df7` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:30:32Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A simple constructor that builds a Node representing a directory — setting its path and name, kind to Dir, an empty children vec, and zeroed/default aggregate fields (loc, score, counts) that will later be filled in by aggregate once its children are known.
- found: Exactly a plain struct literal constructor: id/path set to `path`, name to `name`, kind Dir, and every other field (score, loc=0, children=empty, funcs=0, bytes=None, etc.) at its default/None — with a comment noting `bytes: None` specifically is deliberate (a directory has no extent since it's never read directly, rather than a summed value).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `aggregate` — TANGLED
- spec 3 · read at `c55fcd29bfdd` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:29Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A recursive, post-order method on Node: first calls aggregate() on each child, then rolls up loc as the sum of children's loc, and computes the node's own Score as an LOC-weighted aggregate of children's scores (churn, temperature/hot_share) rather than a simple mean, so a tiny hot file doesn't dominate a big cold directory. It likely treats unreadable/unanalyzed subtrees as excluded from the weighted denominator (absent, not zero) per the test names, computes hot_share as the LOC-weighted share of hot lines rather than an average temperature, and rolls up "wired" status by counting edges rather than by whether children are wired.
- found: Post-order recursion, LOC-weighted rollup, wiring summed as edges (not children) and left absent if nothing underneath resolves calls — all as predicted. Missed several specifics: age is max (oldest surviving code) and touched is min (most recent) exactly as I guessed for the TS twin but got right here conceptually; hot_share is computed only over analyzed lines with leaf-vs-directory branching (Func leaves count in/out binary, directories carry their own analyzed_share*hot_share); commits/all_commits are deliberately left as 0/None here because a separate history pass fills them in (summing children would double count a shared commit) — I did not predict that gap at all; also surprised by the comment noting a real bug found by a previous reader (reaggregate in api.ts disagreeing on the Proxy-source exclusion).
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: commits/all_commits are intentionally left as placeholders (0/None) here, filled later by apply_dir_history — anyone reading aggregate() in isolation would wrongly assume commit counts are rolled up here.

### `unreadable`
- spec 3 · read at `ec2b0b2bb922` · commit `3528c54` · read by claude-sonnet-5 · via claude · when 2026-08-24T22:04:10Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This checks whether a node's extent exceeds agentapi::READ_CEILING, returning true if so. Per the docs, an unknown/None size (from an old cached tree) must NOT count as unreadable — it should return false in that case, since defaulting unknown to "too large" would wrongly empty the queue.
- found: Returns true only when self.bytes is Some and exceeds READ_CEILING; None (unknown size) yields false via is_some_and, matching the doc's stated policy of treating unknown extent as readable.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `visit`
- spec 2 · read at `bdb1f7563573` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:06Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Depth-first pre-order traversal: calls f(self) first, then iterates over self's children (likely a Vec<Node> field) recursively calling child.visit(f) on each, so parents are visited before their children.
- found: Calls f(self) then recursively calls c.visit(f) for each child in self.children — exact pre-order depth-first walk as documented.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `slim` — QUIRKY
- spec 3 · read at `551417dd696d` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:57Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: slim() recursively clones the Node tree, keeping directory and file nodes with their already-rolled-up aggregate fields (size, score, language) intact, but drops each file's function children, replacing them with just a count of how many functions it holds. Directories recurse into their children calling slim() on each, while files construct a stripped copy with an empty/absent children list plus a function count field.
- found: slim() builds a new Node with every field explicitly listed (not struct-update syntax, to avoid an expensive full clone of all descendant children), keeping rolled-up aggregate fields (score, hotspots, wiring shares like orphans/away/incident) but dropping per-function-only fields (callers, calls, clone_group, clone_size) that only make sense for a single function. For File nodes it clears the children vector, stores the function count in `funcs`, and computes `cols` from the about-to-be-dropped children; directories instead recurse by mapping slim() over children.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `functions_of`
- spec 3 · read at `7e86c4b34314` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A single recursive walk over the Node tree that, for each descendant node whose path is in the given `paths` set, collects its function-kind children into a Vec<Node>, accumulating results into one HashMap<String, Vec<Node>> keyed by path — replacing what used to be a separate full-tree walk per requested path (one walk total instead of one per file).
- found: One tree walk via `visit`, matching File-kind nodes whose path is in the requested set and inserting their children (functions) into the output map keyed by path; short-circuits to an empty map when the requested set is empty.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I predicted the mechanism correctly but assumed it filtered children by function-kind explicitly; it just clones all of a File node's children wholesale, trusting a File's children are functions.

### `score`
- spec 3 · read at `9693a414bc56` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:04:04Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A small test-fixture helper (likely #[cfg(test)]) that constructs a Score struct from just the four given fields (surprise, documented, churn, age), filling in the remaining fields (commits, hot_share, analyzed_share, provenance, source, last_touched_days, all_commits, age_days) with fixed/sensible defaults so tests can build minimal Score values without listing every field.
- found: Matched exactly as predicted: a minimal test-fixture constructor filling the four named fields and defaulting the rest (commits=0, all_commits=None, last_touched_days=None, provenance=Source, hot_share=0.0, source=Model, analyzed_share=1.0). Only minor miss was guessing age would map to a plain `age` field rather than `age_days: Some(age)`, and I didn't anticipate source defaulting to Model specifically (vs e.g. Proxy) — a sensible choice for exercising the "analyzed" test paths given peer test names about hot_share/temperature.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `wired`
- spec 3 · read at `ad3c638b9d17` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:53:58Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper that builds a function Node with the given name and loc, and sets its Provenance/wiring fields (callers, incident, away edge counts) to the given values, leaving other fields (like score) at defaults — used by the wiring-related unit tests listed as peers to construct nodes with specific wiring counts without going through a real scan.
- found: Test-fixture builder: starts from Node::dir, overrides kind to Func, sets loc plus wiring fields directly on the Node (callers, calls=0, incident, away, resolvable=1, sinks=0), and derives orphans as 1 iff callers==0 — used by wiring/scoring unit tests to build nodes with specific edge counts without a real scan.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `wiring_rolls_up_by_edges_not_by_children`
- spec 3 · read at `96609c6c72af` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a unit test that builds a small Node graph: a "hub" with nine wiring edges of which three "leave" (are cross-boundary) and a "helper" child with one edge that stays. It then computes the aggregated/rolled-up ratio via Node::aggregate (or similar) and asserts it equals 3/10 (30%), explicitly checking that this differs from the naive mean of the two children's individual ratios (which would be ~17%), demonstrating that counts are summed across edges before taking the ratio rather than averaging ratios.
- found: A unit test building a directory Node with two wired() children (hub and helper), calling dir.aggregate(), and asserting that away/incident counts sum across children (3/10, not a mean), that orphans/resolvable also sum, and that callers/calls stay None for a container since containers don't participate in per-function call edges.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `an_unreadable_subtree_rolls_up_as_absent_rather_than_as_zero`
- spec 3 · read at `d8897f06258d` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:59:51Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a directory containing a file in a language whose calls are never parsed (unwired), runs Node::aggregate on it, and asserts the parent directory's wiring/locality stats come back as None rather than Some(0), confirming that unanalyzed code rolls up as an absence rather than a false "nothing is called here" zero.
- found: Two-part test: (1) a dir with an unwired func child aggregates to (None,None) for resolvable/orphans and incident/away rather than zero; (2) a mixed tree with one readable dir (with orphan/used funcs) and one unreadable dir aggregates so resolvable/orphans only count the readable half, not diluted by the unreadable one.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `temperature_is_surprise_and_documentation_does_not_discount_it`
- spec 2 · read at `ee09177fb7eb` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:34Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Unit test constructing a Score with high surprise and full/good documentation coverage, then asserting Score::temperature equals the surprise value unchanged — proving that having documentation does not lower the reported temperature, since a well-documented surprising function is still surprising code.
- found: Unit test asserting Score::temperature equals the surprise value (first score() arg) regardless of the second arg (documentation-related), across a couple of value combinations, confirming documentation does not discount temperature.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `quadrants_split_on_surprise_and_stability` — QUIRKY
- spec 2 · read at `ed9fa2e5401e` · commit `9ea3e1f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:04:10Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Constructs several Score instances with varying temperature/surprise and stability values and asserts that Score::quadrant returns the expected one of four quadrant labels for each combination (high surprise + low stability, high surprise + high stability, etc.).
- found: Tests Score::quadrant(loc_threshold) against named quadrants (CrownJewel, Trouble, Bloat, Quiet), showing quadrant depends on surprise, stability, age, AND a size/LOC threshold parameter — richer than the two-axis model I predicted, plus a special case where young code can't be a CrownJewel regardless of surprise.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: I only predicted two input axes (surprise, stability); the real function also takes an external LOC threshold and treats code age as a gating condition, not just an axis.

### `a_directory_reports_the_share_of_it_that_is_hot_not_the_mean`
- spec 2 · read at `de33883da0fd` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:43Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Constructs a directory Node with a mix of child function scores — some clearly hot, some clearly cold, weighted by different line counts — and asserts the directory's aggregate score equals the fraction of lines that are hot (a share/percentage) rather than the arithmetic mean of the children's temperature values, likely picking numbers where a mean and a hot-share would diverge to make the distinction unambiguous.
- found: Builds a directory with a 100-line fully-surprising child and a 300-line fully-unsurprising child, aggregates, and asserts hot_share is exactly 0.25 (loc-weighted fraction hot) while the mean surprise stays under 0.3 — demonstrating the two diverge and hot_share is the one that should drive color.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: This function itself had no docs (only the file doc applied), unlike most peers in this file.

### `unanalyzed_lines_are_left_out_of_hot_share_entirely`
- spec 2 · read at `f6c37e427b6e` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:05Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a small tree/directory node containing some functions with scores and some lines/wedges that have never been analyzed (no Score at all), then asserts that the directory's aggregated hot_share is computed only over the analyzed lines — i.e. unanalyzed lines are excluded from both the numerator and denominator rather than being treated as cold/zero, so they don't dilute or otherwise affect the hot-share percentage.
- found: A unit test with two func-kind children of a dir node: one fully analyzed (Source::Model, analyzed_share implicit 1.0) and one with a Proxy score whose analyzed_share is explicitly 0.0. After aggregate(), it asserts hot_share is 1.0 (only analyzed lines count, and they're all hot) and analyzed_share is 0.25 (100 of 400 total loc), confirming unanalyzed lines are excluded from hot_share's numerator/denominator but still counted in analyzed_share's denominator.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The 'unlooked' child still carries a Score (Proxy source, analyzed_share=0.0), not an absent score as I predicted — unanalyzed-ness is represented by a zero analyzed_share field, not by omitting scoring entirely.

### `a_wedge_nothing_has_analyzed_reports_no_heat_at_all` — QUIRKY
- spec 2 · read at `9f9ef8551327` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:53Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a unit test verifying that a wedge/node which has not been analyzed (no Score data) reports zero/no heat — i.e. Score::temperature or the aggregate temperature for an unanalyzed node returns 0.0 or None rather than some default nonzero value. It probably constructs a Node with no Score set, computes its aggregate, and asserts the resulting temperature is falsy/zero, distinguishing "no data" from "cold but analyzed".
- found: A unit test constructing a dir Node containing one Func child whose score has analyzed_share=0.0 (Source::Proxy), then calls Node::aggregate() and asserts the parent's aggregated score has analyzed_share==0.0 and hot_share==0.0 — confirming aggregation doesn't manufacture heat from unanalyzed nodes.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `hot_share_composes_through_nested_directories`
- spec 2 · read at `28c110c559a5` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:46Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds a two-level directory tree (a top dir containing a subdirectory, which contains hot and cold function children with different LOC), calls aggregate on the tree, and asserts the top-level directory's hot_share correctly reflects the LOC-weighted share of hot lines across the whole subtree — proving hot_share composes properly through nesting rather than double-counting or averaging per-directory.
- found: Unit test: root dir contains a mid subdir containing one 50-loc maximally-hot func and one 50-loc cold func; calls root.aggregate() and asserts the root's hot_share is 0.5, proving hot_share propagates correctly up through two levels of nesting rather than being lost or double-averaged.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `aggregation_is_loc_weighted_not_per_function`
- spec 2 · read at `bc3e46fb40fe` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:18Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test constructing a directory/node with multiple child functions of differing line counts and scores, then asserting that Node::aggregate's resulting score/hot-share is weighted by each child's LOC rather than being a simple unweighted average across functions — e.g. a large hot function dominates the aggregate more than a small one would.
- found: Unit test: builds a dir with a tiny (3-loc) maximally-surprising child function and a large (300-loc) zero-surprise child, calls Node::aggregate, and asserts total loc sums correctly and the directory's surprise score stays near ~0.01 (LOC-weighted) rather than the ~0.5 a per-function average would give.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `model_authored_text_cannot_cool_a_wedge`
- spec 2 · read at `33d84bc80b8e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This tests that documentation attributed to a model (not a human) does not reduce a wedge's temperature/score — only human-authored docs can discount surprise, since model-generated docs could just restate the code.
- found: Asserts Provenance::None.weight() is 0.0 and Provenance::Source.weight() is less than Provenance::Human.weight() — there's deliberately no Provenance variant for model-authored text, so it can never carry weight to cool a wedge's score.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Docs shown were the file_doc (module-level), not per-function docs, so documented=none for this specific function.

## src-tauri/src/parse.rs

### the file itself
- spec 3 · served in 4 parts · read at `9087fd27d3ea` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:55:08Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: The single multi-language parsing front-end for the app: it walks a tree-sitter concrete syntax tree per supported language (Rust, Python, TypeScript, Go, Swift, C++, and possibly a lisp-family language) using node-kind matching rather than tree-sitter queries, and extracts each top-level function into a FuncDef — its name, signature, body span/header end, doc comment (leading comment or docstring, distinguished from file-level doc and license headers), owner (for methods/nested types), and the calls it makes (resolved to callee names, deduplicated, capped, deterministic in document order). The bulk of the file is the language-specific extraction logic plus an extensive test suite covering doc-attachment edge cases, call resolution, and owner naming across languages.
- found: A massive (~1690 line) multi-language parsing module supporting ~60+ languages via tree-sitter, matching node kinds rather than queries. It defines FuncDef and extracts name/signature/body/doc/owner/calls/shape per function, plus a file_doc extractor with license-header filtering and truncation, a PARSE_VERSION/PARSE_OUTPUT_STABLE_SINCE versioning scheme for cache invalidation, a structural-shape hash for clone detection (shape_of/MIN_SHAPE_TOKENS), stack-safe cursor-based tree walks (to avoid overflowing worker stacks on deeply nested trees), and call-site resolution per language (call_sites/callee_name/is_identifier) feeding a dependency-edge graph elsewhere. Roughly half the file is an extensive per-language test suite, much of it regression tests for specific real-world parsing failures.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: The module-level doc only explains the kind-matching-vs-queries design choice; it says nothing about the versioning scheme, clone detection, doc-attachment rules, or owner disambiguation that make up most of the file's actual complexity — those are documented instead via extensive inline comments on individual items.

### `loc`
- spec 2 · read at `0e1677eba3db` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:13Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns the line count of this function definition, computed as (end_line - start_line + 1) cast to u32, using whatever span fields FuncDef stores from the tree-sitter node.
- found: Computes line count as end_line minus start_line plus 1, using saturating_sub for safety instead of plain subtraction.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `language`
- spec 2 · read at `bf7d31809fbd` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:46Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A match statement over the Lang enum that returns the corresponding tree_sitter::Language by calling each language grammar crate's constructor function (e.g. tree_sitter_rust, tree_sitter_python, tree_sitter_javascript, etc.), one arm per supported language, which is why it spans many lines.
- found: A match over Lang with ~60 arms, each returning the tree_sitter::Language from the corresponding grammar crate.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: More languages supported than I guessed (60+), impressively broad.

### `func_kinds` — QUIRKY
- spec 3 · read at `5df5fdd15d81` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A match on the Lang enum returning a static slice of tree-sitter node-kind strings per language — e.g. "function_item" for Rust, "function_definition" for Python, and for JS/TS family a list including "function_declaration", "method_definition", "variable_declarator" (to catch const Foo = () => {...}), deliberately excluding bare arrow_function/function_expression.
- found: A match over ~40 Lang variants returning tree-sitter node kinds per language; correctly got the mechanism and the Rust/Python/JS cases, but the function covers a huge long tail of languages with non-obvious quirks (Elixir/Clojure/Lisp have no function node and rely on `accepts` for filtering, Erlang's unit is the clause not the declaration, R/OCaml bind functions via assignment-shaped nodes, Swift deliberately omits subscripts/deinits).
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment only explains the JS variable_declarator/arrow_function case; the much larger long-tail-language complexity is documented only in scattered inline comments, not the file/function doc.

### `declarator_is_function`
- spec 2 · read at `b42761bf14e5` · commit `10d6afa` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:03:56Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Given a variable_declarator node, finds its value/initializer child and checks whether its kind is one of arrow_function/function/function_expression, returning true only if so, so declarations like `const n = 4` are excluded.
- found: Checks the declarator's "value" child field's kind against arrow_function/function_expression/function/generator_function, matching my prediction almost exactly (I missed generator_function specifically but had the right set of concepts).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `text`
- spec 2 · read at `ec98efc5bd5b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Slices src using node's byte range, i.e. &src[node.start_byte()..node.end_byte()], returning the raw source text spanned by that tree-sitter node.
- found: Uses tree-sitter's node.utf8_text helper to get the node's source text, falling back to empty string on invalid utf8 rather than manually slicing by byte range.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `leading_doc`
- spec 3 · read at `e476d7e6be02` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:45Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks backward from node through its preceding siblings, skipping over attribute/decorator nodes (e.g. #[derive(...)], @override) to find the comment(s) actually attached to the definition, then checks that the comment sits with no blank line gap (comparing row numbers) before treating it as a doc comment. It collects contiguous comment lines directly above, strips comment markers, and returns the joined text, or None if nothing sits immediately adjacent.
- found: Walks backward over preceding siblings, stepping past attribute/decorator nodes, and also explicitly excludes inner doc comments (//! or /*!) which belong to the module rather than the following item (a case the blank-line check can't catch because tree-sitter gives them a trailing newline that closes the row gap). Stops on a blank-line gap or a non-comment/non-attribute sibling, collects and reverses the comment lines, strips markers, and returns the joined trimmed text or None.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `wrapper_doc`
- spec 2 · read at `3bb3df0748bc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:48Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Walks up from the function's node through immediate parent nodes that are "wrapper" constructs (like a variable declarator wrapping an arrow function), checking at each step whether that node kind still counts as a wrapper. As soon as it reaches a parent that is not a wrapper (an enclosing class, function, or type), it stops climbing — returning the doc comment (via leading_doc) attached to the last wrapper node reached, or None if there's no such doc or no wrapper chain at all.
- found: Climbs up to 3 parent levels; at each step if the parent's kind isn't in DOC_WRAPPERS it returns None immediately, otherwise checks leading_doc on that parent and returns it if present, else continues climbing (cur = parent) up to the 3-step cap, returning None if exhausted.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the hard 3-level climb cap and that it bails to None (not just stops) the instant a non-wrapper parent is hit.

### `owner_of` — QUIRKY
- spec 2 · read at `335ae57df339` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:46Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Walks up node's parent chain looking for an enclosing type/class/struct/impl declaration matching lang's node kinds, and if found returns Some(name). For Go, instead reads the receiver off the function node itself (no ancestor walk), strips a leading '*' pointer sigil, and cuts off any generic parameter list by taking the first identifier rather than the last, so Parser[T] resolves to "Parser" not "T". Returns None if no owner is found.
- found: For Go, extracts receiver text, strips generic params via split_once('['), then rsplit on non-identifier chars to get the rightmost identifier segment (handles pointer sigil and package qualifiers). For other languages, walks the FULL ancestor chain collecting names of nested OWNER_KINDS types (via 'name' or 'type' field), caps at 3 innermost levels, reverses to outermost-first order, and joins with '.' to produce a dotted owner path (e.g. Boolean.Input) rather than just the nearest enclosing type.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `python_docstring`
- spec 3 · read at `f1f29c7a3c13` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes the body block of a Python function definition, looks at its first statement, and checks whether it's a string expression node (the docstring convention). If so, it extracts the string literal's text, strips the quote characters/prefix, and returns it as the doc comment; otherwise returns None.
- found: Skips leading comment nodes to find the first real statement, unwraps an expression_statement to get at the inner node, and if it's a string node, returns its text trimmed of quote characters and whitespace. The comment-skipping exists specifically to handle shebang lines that would otherwise occupy child slot 0.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `strip_comment_markers`
- spec 2 · read at `eaf5f3ec3e46` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Takes a raw extracted comment/docstring block and strips per-line comment syntax (leading //, /**, *, #, etc.) and surrounding whitespace from each line, joining the cleaned lines back together, so downstream doc-extraction functions get plain text without comment punctuation.
- found: Per-line, trims whitespace then strips common comment markers (///, //!, /**, //, /*, #, trailing */, leading *) from each line, then rejoins and trims the whole block.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `file_doc` — QUIRKY — TANGLED
- spec 2 · read at `b241ba57c76c` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:38Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Dispatches by language: for Rust, scans leading lines for `//!` inner doc comments and joins them; for Python, looks for a module-level docstring (string literal as first statement) and returns its contents; for other languages, falls back to taking a leading run of `//`-style comments only if followed by a blank line before the next item, mirroring leading_doc's adjacency rule. Returns None if no such file-level doc is found, using strip_comment_markers to clean up comment syntax.
- found: Walks the file's top-level children past leading imports/includes, collecting runs of leading comments (broken by blank lines) as header candidates; for Rust only //! / /*! comments count as file doc, for Python it delegates to python_docstring on the root node. It disqualifies a comment run that's adjacent to the first real declaration (so it isn't double-counted as that declaration's own doc), joins remaining runs, strips license-marker text, and truncates to FILE_DOC_MAX chars on a word boundary.
- predicted: some · documented: most · derivable: no · legible: some · trap: no

### `parse_functions`
- spec 2 · read at `a53faa73c822` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:44Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Sets up a tree-sitter parser for the given language, parses the source into a tree, and if parsing fails returns an empty Vec. On success it walks the tree with a cursor (likely delegating to a `collect` or `extract` helper) matching node kinds to build up a Vec<FuncDef> of the functions found.
- found: Creates a tree-sitter Parser, sets language (returning empty vec on failure), parses source (returning empty vec if None), then gets func_kinds for the language and calls collect() on the root node to populate a Vec<FuncDef>, which is returned.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `collect`
- spec 3 · read at `7e01b7267ae9` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:34:49Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the syntax tree using a TreeCursor (goto_first_child/goto_next_sibling/goto_parent) instead of recursive calls, to keep stack usage O(1) regardless of tree depth. For each node visited, checks if its kind is in `kinds`; if so, extracts a FuncDef (name, signature, doc, span, etc., likely via helper functions like name_node/body_node/leading_doc) and pushes it into `out`. The traversal continues until the cursor returns to the root and has no more siblings, implementing a manual pre-order traversal stack/loop.
- found: Iterative pre-order traversal via TreeCursor. For each node, if it matches a target kind (and, for variable_declarator, only if it's actually a function-valued declarator), extract a FuncDef and push it, and skip descending into that node's children (so nested closures aren't double-counted as separate top-level entries or double-counted in line spans). Otherwise descend into the first child; when no child, climb via next-sibling/goto-parent until a sibling is found or the walk returns to root and terminates.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `accepts` — QUIRKY
- spec 3 · read at `5b99000898b6` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: For most languages, just checks whether node.kind() is contained in the `kinds` slice. For Elixir specifically, since every function/module/import parses as a generic `call` node, it special-cases: when kind is "call" it looks deeper (e.g. at the callee identifier's text via `src`) to check if it's actually "def"/"defp"/"defmodule" etc., rather than trusting the kind alone.
- found: First checks node.kind() is in `kinds`, then per-language disambiguates further since many languages reuse one node kind for both definitions and non-definitions: Elixir checks the call target is def/defp/defmacro/defmacrop, OCaml checks for a `parameter` child, F# checks for a function_declaration_left, R/Nix check the bound expression is a function definition, Clojure/Scheme/Racket inspect the list head symbol, and Prolog checks for a rule body. Default is to accept anything matching kind alone.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The handed docs only explained the Elixir branch; the function actually special-cases seven languages, each with its own structural disambiguation and its own inline comment.

### `first_of_kind`
- spec 2 · read at `acfd540f9c99` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Iterates the direct named children of node and returns the first whose kind() equals kind, via tree-sitter's cursor/child API; returns None if none match. One level deep only, not recursive.
- found: Exactly as predicted: node.children(&mut node.walk()).find(|c| c.kind() == kind).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lisp_head`
- spec 2 · read at `b844a821dd9f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Gets the first named child of `node` (the list) and returns its source text slice via `src`, wrapped in Option in case there is no named child. This covers both Clojure's sym_lit/sym_name nesting and Scheme/Racket's bare symbol since either way the first named child's text is the symbol.
- found: Gets the first named child's text via the `text` helper and trims it, returning None via `?` if there is no named child; matches prediction except I didn't anticipate the trim() call.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `name_node`
- spec 3 · read at `3ef303e9614c` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:11Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A large per-language match: the default case calls `node.child_by_field_name("name")`, but many languages (Lisp-family via lisp_head, anonymous-function-heavy languages, ones where the name is nested inside a declarator or identifier list) get bespoke handling to dig out the actual name-bearing node, since assuming the common `name` field would silently yield None and make those languages look like they have no functions.
- found: A ~25-arm per-language match, each digging out the name node its grammar actually uses: C/C++ walks a nested declarator chain (with special cases for reference_declarator and operator_cast), ObjC/Odin/D just grab the first bare identifier, Elixir/SQL/Prolog/CMake reach through call-argument or functor structure, several Lisp dialects index into named_child positions, and many others (Fortran, Ada, Vhdl, Pascal, Elm, Verilog, PowerShell, Julia, F#, R, Nix, OCaml, Dart, GLSL/HLSL/Slang/GdShader) each have their own field/kind lookup; falls back to child_by_field_name("name") by default.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `body_node` — QUIRKY
- spec 3 · read at `463255b4ca1d` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:40Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Given a tree-sitter node for a function/chunk and its language, locates and returns its body child node (e.g. a "block", "compound_statement", or similar per-language kind). It likely dispatches on `lang` to try `child_by_field_name("body")` first, falling back to scanning children for the appropriate block-like kind name for languages that don't expose a named "body" field, returning None if no body is found (e.g. for interface/abstract declarations).
- found: First handles a handful of languages (R, Nix, Odin, Prolog, GdShader) whose body sits one or two levels down from the node in a language-specific field/kind path; then tries the common `child_by_field_name("body")`; then falls back to a per-language literal kind-name scan for languages with unnamed body fields (Kotlin, ObjC, Sql, Elixir, Haskell, D, Vhdl, PowerShell, Ada, Cmake); and as a final default, checks `value` → `body` to catch things like arrow-function initializers.
- predicted: some · documented: none · derivable: no · legible: most · trap: no

### `body_span`
- spec 2 · read at `1f2c8fc01706` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:26Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Tries to find a dedicated body node via `body_node(node, lang)`; if found, returns its byte range as Some((start_byte, end_byte)). For languages without a distinct body node (Julia, Fortran, lisps, Visual Basic), it falls back to computing the span as everything from `header_end` to the node's end byte, since the statements hang directly off the definition with no wrapping node.
- found: Tries body_node first and returns its byte range if present; otherwise falls back to header_end..node.end_byte, and guards against an empty/inverted span with a start<end check before returning.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Missed only the small guard against start >= end producing None instead of an invalid span.

### `header_end`
- spec 3 · read at `0fe99155c821` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:46:18Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Matches on `lang` (and possibly node kind) to find the specific optional grammar field that ends a function's header for languages whose body is "unwrapped" (e.g. VB's return type, Emacs Lisp's docstring), using node.child_by_field_name to fetch that field and returning its end_byte. Returns None for languages/node kinds where no such special field exists, so callers fall back to a simpler default header-end calculation.
- found: A per-language match arm (Julia, Fortran, Elisp, CommonLisp, VisualBasic, Verilog/SystemVerilog, OCamlLex, Scheme/Racket, Clojure) each picking a different grammar field or node kind to mark where the header ends, returning its end_byte; falls back to None for every other language.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `extract` — QUIRKY
- spec 3 · read at `de5a44013c29` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:49Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Given a tree-sitter node, checks whether its kind matches a known function-like shape for the language (via shape_of); if not, returns None. If it does match, pulls out the name via name_node, the body span via body_node/body_span and header_end, collects doc comments, and calls calls_in (if the language resolves calls) to gather callee names, assembling all of it into a FuncDef.
- found: Pulls name and body span (returns None early if either is missing, not via shape_of gating), slices out the signature text before the body, extracts doc comments with per-language logic (Python docstring-as-first-statement, Elisp docstring field, everyone else leading-comment-or-walk-out-through-wrapper-declarations), gathers calls via calls_in, and assembles a FuncDef including owner_of and shape_of (used to classify, not to gate).
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: shape_of isn't a filter/early-return as I assumed — extract only bails via the name/body Option chain, and shape_of is computed at the end just to tag the result.

### `shape_of`
- spec 3 · read at `7b38e9a9bd9c` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:03:53Z · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Walks the body's token stream between body_start and body_end via the cursor, normalizing every identifier to one placeholder token and every literal to another while keeping keywords/punctuation as-is and skipping comments, then feeds that normalized token sequence into a hash (likely FNV-1a) to produce a u64 "shape" fingerprint. Returns None if the body has fewer than some minimum token count (MIN_SHAPE_TOKENS), since a short body would collide by coincidence rather than by being a real copy.
- found: FNV-1a hash over an iterative (non-recursive) cursor walk of leaf tokens within [body_start, body_end): comments skipped, identifier-like kinds mapped to '#', literal-like kinds to '$' (matched by substring rather than a per-grammar table, deliberately, so a misnamed kind costs one token rather than a whole language), everything else hashed by its literal kind string with a separator byte between tokens; returns None if fewer than MIN_SHAPE_TOKENS leaf tokens were found.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Had secondhand knowledge of this function from a subagent's earlier summary of the whole parse.rs file, so this was not a cold prediction despite not having personally opened the file before.

### `resolves_calls`
- spec 3 · read at `452f309691af` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:29Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Derives its answer from the call_sites table/function rather than a separate list: likely matches lang against the same match arms as call_sites (or calls call_sites and checks for Some/non-empty), returning true only for languages that table actually covers.
- found: Calls call_sites(lang) and returns true if the resulting collection is non-empty — matches the predicted derivation-from-call_sites idea, just via is_empty() on a returned list rather than is_some().
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `call_sites`
- spec 3 · read at `fae90d9fc4e6` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:49:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: This is a big match lang { ... } returning a static slice of (node_kind, callee_field) pairs per language — e.g. Rust's call_expression with field "function", plus constructor-call node kinds like object_creation_expression — with an empty/default arm for languages whose call shape hasn't been parsed and asserted yet.
- found: A match over Lang returning per-language static slices of (node_kind, callee_field) pairs for ~40 languages, each pair backed by an inline comment explaining a grammar quirk (JSX elements as calls, Elixir's def-is-a-call, lisps matching any list head, Fortran's array/call ambiguity, etc.), with an empty slice default for unhandled languages.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Each arm carries real per-language nuance (multiple node kinds, None fields for languages with no named callee field, dedup/filter tricks) that only reading the whole match reveals — the peer list undersells how much language-specific judgment is packed in here.

### `skip_fields`
- spec 3 · read at `3858b11579e9` · commit `c4c6042` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A match statement on lang returning a static slice of field names to skip during the call walk: something like &["signature"] for Julia, &["parameters"] for Elisp, &["lambda_list"] for Common Lisp, and &[] (empty) for every other language.
- found: Exactly as predicted: a match on lang returning the field names to skip (signature/parameters/lambda_list) per the three languages named in the doc, empty slice otherwise.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `callee_name`
- spec 3 · read at `3c270c6e0918` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks at node.kind() and matches against known callee shapes across languages: plain identifier returns its text; member/field access (a.b.c) recurses into the field/property child to get just "c"; scoped/path expressions (T::c) recurse into the last segment. Uses depth to bound recursion depth and returns None for shapes it doesn't recognize.
- found: It generically walks known field names (CALLEE_FIELDS) to descend toward the callee's name-bearing child, recursing on whichever field matches; if no field matches but there are named children, it recurses into the last one (handles field-less shapes like Kotlin's navigation_expression and lisp wrappers); at the leaf it takes the node's text and returns it only if is_identifier confirms it's a valid identifier for that language. Depth is bounded by CALLEE_DEPTH to prevent runaway recursion.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The doc's "receiver is discarded deliberately" is explained by field lookup order (field child preferred) plus the last-named-child fallback, not obvious without seeing CALLEE_FIELDS.

### `is_identifier`
- spec 3 · read at `883fa1276d59` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:49Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Checks that the first character of `t` is alphabetic (rejecting flags, negative numbers, bare operators), then checks the remaining characters are alphanumeric/underscore plus a per-language allowlist of extra characters: hyphen for PowerShell and the lisps, `?`/`!` for Ruby and Elixir, and `.` for R. Implemented as a match on `lang` selecting which extra-char set to test against, returning a bool.
- found: Delegates the per-language extra-character set to a separate `name_chars(lang)` helper rather than matching inline; checks non-empty, first char alphabetic-or-underscore, and every char alphanumeric/underscore/in the extra set.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I expected the per-language logic inline (a match on lang); it actually delegates to the peer `name_chars` function, and the first-char rule allows underscore too, not just alphabetic.

### `name_chars`
- spec 3 · read at `a15418e16bc8` · commit `6cf7dc9` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T07:07:44Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns a per-language string of extra characters allowed in identifiers beyond alphanumerics/underscore (e.g. '-' for languages like Lisp/Clojure, '$' for JS/PHP), via a match over the Lang enum, used by is_identifier to validate callee names against what that language's own definitions are actually named.
- found: Match over Lang returning extra allowed name characters per language: Ruby/Elixir/Julia get \"!?\", R gets \".\", shell languages get \"-\", and lisp-family languages get a wide set \"-?!*/+<>=.\"; everything else gets empty string.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `calls_in`
- spec 3 · read at `d11b61257f23` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:27Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Walks the function body's tree-sitter node (probably via `walk_calls`/`call_sites`) to find call expressions for the given language, extracts each callee's name via `callee_name` (only accepting identifiers per `only_identifiers_become_call_names`), and builds a `Vec<String>` of distinct names in first-appearance order — deduplicating so a name called many times only appears once, and likely capping the list length per `the_call_list_is_capped`. The `name` parameter is probably the enclosing function's own name, used to exclude self-recursive calls from the list.
- found: Gets call_sites for the language (empty vec if unresolvable), seeds the `seen` set with the function's own name so recursion/self-reference never enters the list, then delegates the actual walk/dedup/ordering to `walk_calls` which mutates `out` and `seen` in place. The self-exclusion comment reveals a specific bug it prevents: Scheme's `(a)` definition-signature syntax is indistinguishable from a call node, so without excluding the own name it would falsely appear as a self-call edge.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The comment explaining self-exclusion cites a concrete language quirk (Scheme signature-as-list-syntax) that isn't derivable from the signature or file doc alone.

### `walk_calls`
- spec 3 · read at `9565a041bdc8` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:43Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: An explicit-stack (or tree-sitter cursor-based) depth-first walk over the syntax tree in document order, visiting every node including nested definitions. At each node it checks whether the node kind matches one of the call `sites` (kind + optional field name for the callee), extracts the callee identifier text via a helper (skipping fields in `skip`), and if it's a plain identifier and not already in `seen`, pushes it into `out` and marks it seen — deduping repeated calls to the same name and capping the list at some max length, all using a manual stack rather than recursion to avoid stack overflow on deeply nested trees.
- found: Cursor-based DFS in document order as predicted, matching sites by kind+field, extracting callee name, deduping via `seen`, capping at MAX_CALLS. I correctly predicted the mechanics but missed the specific reason for `skip`: it's not just skipping arbitrary fields, it's specifically to prevent a definition node from matching its own call-site table (Elixir/lisp `def`/`defn` share node shape with call nodes) — a subtlety I didn't anticipate. Also missed that `skipped` still allows descending into children (just prevents recording that node as a call) — skip suppresses recording, not traversal into the subtree.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: `skip` only suppresses treating a node itself as a call site — it still walks into that node's children, which isn't obvious from the parameter name alone.

### `calls`
- spec 3 · read at `329ea292e6a0` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:23Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test helper that parses the given source with parse_functions for the given language, takes the first (only) function found, and returns its `calls` list — used throughout the test suite to check what callee names extract/calls_in found for a small source snippet.
- found: Test helper: parses source with parse_functions, asserts exactly one function was found, and returns its calls list clone — matches prediction exactly including the assert on count.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `every_resolving_language_finds_its_calls`
- spec 3 · read at `5af7b500291f` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:16Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Iterates over every language that has a resolved call shape (from resolves_calls/shape_of), parses a small per-language fixture string containing a bare call, a receiver call, and a qualified/constructed call, extracts calls via calls_in/walk_calls, and asserts the expected call names come out (non-empty, receiver stripped) for each language — so a grammar rename shows up as a specific failing assertion rather than a silent empty result.
- found: A single test with ~50 assert_eq! calls, one per supported language, each parsing a tiny fixture snippet and asserting the exact ordered list of call names extracted (bare call, receiver call, constructor/qualified call), with inline comments explaining specific grammar traps (C++ template args, TSX component invocation, Lisp def-forms not counting as calls).
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `a_name_may_hold_what_that_language_lets_a_name_hold`
- spec 3 · read at `89ba2d1a2a6c` · commit `c4c6042` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T07:07:56Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A unit test verifying calls using language-specific name characters (like PowerShell's Write-Output, or Ruby's save!) are correctly resolved as call edges rather than silently dropped, by parsing source with a definition and a matching call, then asserting the resolved calls list contains that name.
- found: Table-style test across five languages (PowerShell, Shell, Ruby, R, Clojure) confirming each language's special name characters resolve calls correctly, plus two negative cases confirming names must start alphabetic (flags and operators are excluded).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_language_with_no_call_shape_says_so_rather_than_reporting_zero`
- spec 3 · read at `70b88548243e` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:10Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test that picks a language whose call shape isn't wired (e.g. Verilog, per the file doc), parses a small fixture in it, and asserts that some `resolves_calls`-style flag/function reports false for that language while the calls list itself comes back empty/None — distinguishing "we didn't look" from "we looked and found zero," which is the point made in the doc.
- found: Asserts resolves_calls(Sql) is false and resolves_calls(Rust) is true (the honesty contrast), then parses a SQL fixture containing a call to b() and asserts the parsed function's calls list is empty — confirming SQL parses fine but yields no calls rather than erroring, exactly the case the doc named.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I guessed Verilog as the example language from the file doc's mention of it, but the doc's actual worked example was SQL, which is what the test uses.

### `a_call_made_forty_times_is_one_dependency`
- spec 3 · read at `3759c9b4ec5a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:30Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test: parses a function body that calls the same callee many times (e.g. 40x in a loop or repeated statements) and asserts that calls_in/calls dedupes to a single edge for that callee rather than one per call site.
- found: Test asserts repeated calls to the same callee (push x3, pop x1) dedupe/collapse in the extracted calls list, confirming the dedup behavior though the literal "forty times" in the name is just flavor, not the actual count used.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `only_identifiers_become_call_names` — QUIRKY
- spec 3 · read at `0df32689a223` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:00Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A short unit test that calls is_identifier (or callee_name) on a few sample tokens — an operator like "+" or a string/number literal — and asserts they are rejected (false/None), while a normal identifier string is accepted, confirming the resolver's symbol table can't be polluted by non-name tokens.
- found: Parses real Rust source containing an immediately-invoked closure `(|x| x)(1)` alongside a normal call `b()`, then asserts every name that `calls()` extracted passes `is_identifier`, and that "b" is among them — proving the closure invocation didn't leak a non-identifier callee name into the list.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `the_call_list_is_capped`
- spec 3 · read at `5f253882a3d9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:05Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds/parses a function body that calls some other function far more times than a defined cap (so the raw call list would be very long), runs it through the call-extraction logic, and asserts the resulting call list's length does not exceed a fixed maximum — verifying the cap exists so an unbounded list can't blow up scancache's storage.
- found: Unit test: generates a Rust function body with MAX_CALLS+40 distinct calls (f0(), f1(), ...), parses it, and asserts calls() returns exactly MAX_CALLS entries — confirming the cap truncates rather than silently allowing unbounded growth.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_deeply_nested_body_does_not_overflow_the_call_walk`
- spec 3 · read at `55873cd72c1e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:36Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Test generates source code with a very deeply nested function body (thousands of nested blocks/if-statements) containing a call, runs the call-walking function (calls_in/walk_calls) on it, and asserts it completes without a stack overflow and finds the expected call — verifying the walk is iterative rather than naively recursive.
- found: Builds a deeply nested expression (40,000-term addition chain) as the function body plus one real call, and asserts calls() finds just that call without overflowing the stack.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I expected nested blocks/if-statements for the depth; the actual test uses a deep binary-expression chain instead, which stresses a different kind of tree nesting.

### `the_call_list_is_deterministic_and_in_document_order`
- spec 3 · read at `dadfa28bb922` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:36Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This test parses a snippet with multiple function calls in a specific order, runs calls()/calls_in() (possibly twice) and asserts the returned call names come back in the same document order every time — proving the extraction is deterministic and not reordered (e.g. by a HashMap/HashSet internally).
- found: Parses a Rust snippet with nested calls (first, second inside a block, third) and asserts calls() returns them in document order ["first","second","third"], then asserts calling calls() twice on the same source yields equal results.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `names`
- spec 2 · read at `1bdc565ae5e3` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:54Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test-helper that parses `src` for the given language, extracts the functions (via the same machinery as parse_functions/extract), and maps them to a Vec<String> of just their names, so other tests can assert on names concisely instead of comparing full structs.
- found: Test helper: calls parse_functions(lang, src) and maps the results to just their `.name` field, collecting into a Vec<String>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `rust_functions_and_doc_comments`
- spec 2 · read at `e5e3f78997a1` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:52Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds a small Rust source snippet containing a couple of functions, some with preceding /// doc comments and some without, into the parser, then asserts the extracted function list has the right names and that each doc comment is correctly attached to its following function (and undocumented functions have no doc).
- found: Parses a snippet with a doc-commented `add` function (with #[inline] attribute) and an undocumented `undocumented` function containing a closure, asserting exactly 2 functions are found (proving the closure inside doesn't become its own wedge), the doc text/signature for `add` are correct, and `undocumented` has no doc.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed that the test specifically guards against closures being parsed as their own functions.

### `a_blank_line_severs_a_comment_from_the_function`
- spec 2 · read at `844e0d52fc9b` · commit `10d6afa` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:03:11Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that parses a small Rust source snippet containing a comment, a blank line, then a function definition. It asserts that the comment is NOT attributed as the function's documentation because the blank line breaks the association between comment and following item.
- found: A test asserting that a license-header comment followed by a blank line before a function is NOT treated as that function's doc comment, using an SPDX header as the concrete example.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I predicted the mechanism correctly but not the specific concrete case (SPDX license header) that motivates the test.

### `typescript_arrow_consts_and_methods`
- spec 2 · read at `5b2665e4cff3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:04:58Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test verifying that the TypeScript extraction logic in parse.rs correctly picks up both `const foo = () => {...}` arrow-function assignments and class methods as "functions" — it parses a small TS snippet and asserts the extracted names/kinds match expectations.
- found: Test parsing a TSX snippet with an arrow-function const (with JSDoc), a plain non-function const, and a class method; asserts `names()` includes the arrow const and method but excludes the plain const, and that `parse_functions()` attaches the JSDoc comment as the arrow function's doc.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `rust_module_docs_are_the_file_doc`
- spec 3 · read at `af3861a24319` · commit `9f5abcc` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T22:48:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A Rust test that parses a snippet of source containing //! inner doc comments at the top of the file and asserts the parser correctly extracts that text into file_doc, distinguishing it from a /// item doc (covered by the sibling test rust_item_docs_are_not_the_file_doc).
- found: Parses a snippet with a //! module doc followed by a /// item doc on a function, asserts file_doc() extracts the module doc text and parse_functions()[0].doc extracts the function's own doc separately — confirming the two never bleed into each other.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `rust_item_docs_are_not_the_file_doc`
- spec 2 · read at `ed75e12a612b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:44Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a small Rust source string containing only a `///` doc comment above a function (no `//!` module doc), then asserts the file-level doc extracted is empty/None while the function itself carries the `///` text as its own doc — confirming `///` item docs are not conflated with file docs.
- found: Parses `/// Opens it.\npub fn open() {}` and asserts `file_doc(Lang::Rust, src)` returns None, confirming an item-level `///` doc comment is not mistaken for the file's `//!` doc.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_license_header_is_not_documentation`
- spec 2 · read at `f3b7f12d0bd5` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that parses a small fixture source string containing a license-style header comment at the top of the file, runs the file-doc extraction logic, and asserts the result does NOT pick up the license text as the file_doc (i.e., returns None or something other than the license comment).
- found: A unit test asserting that file_doc(Lang::Go, src) returns None when the file's only leading comment is a two-line copyright/license header followed by a blank line before the first function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_comment_attached_to_the_first_item_is_not_the_file_doc`
- spec 2 · read at `eae2b6a4731b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:18Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test parsing source where a comment sits immediately above the first function with no blank line in between; it asserts that this comment is attributed to the function as its doc comment, and that the file-level doc extraction does NOT also claim this same comment as the module/file doc.
- found: Tests file_doc() directly (not the function's own doc extraction): attached comment (no blank line) yields None for file_doc; a comment with a blank line before the attached one yields Some of the detached comment as the file doc. Confirms the adjacency rule from the file_doc side.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I predicted it would check the function's doc attribution too, but it only tests file_doc(), not the function-level doc extraction.

### `a_header_below_the_imports_is_still_the_file_doc`
- spec 2 · read at `43073eb52d07` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:44Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This test parses a source file (likely .tsx) whose top-of-file doc comment appears after the import statements rather than before them, and asserts the parser's file_doc extraction still finds that comment as the file doc rather than returning empty — regression test for the bug where imports-before-header caused readers to get an empty header.
- found: Builds a TypeScript source string with two imports, then a comment block separated by a blank line, then another comment directly touching an interface declaration; asserts file_doc() picks the first (post-import) comment as the file doc, not the one attached to the declaration.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_shebang_does_not_hide_a_python_module_docstring`
- spec 2 · read at `29555f714925` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:19Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test: parses a Python source string that starts with a `#!/usr/bin/env python` shebang line followed by a triple-quoted module docstring, then asserts that the extracted file-level doc equals that docstring's content — verifying the shebang comment (which tree-sitter treats as a named node) isn't mistaken for the docstring slot at named_child(0), which would otherwise leave the file looking undocumented.
- found: Parses a Python source with a shebang line followed by a module docstring, and asserts file_doc extracts the docstring content correctly despite the shebang being a named comment node.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `python_module_docstrings_are_the_file_doc`
- spec 2 · read at `838387d02e52` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:24:55Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A short test with a Python source snippet starting with a triple-quoted string literal at module level, followed by some code/functions; asserts parse_functions or file_doc extraction picks up that string as the file's doc, analogous to how a function's leading docstring becomes its doc.
- found: Exactly as predicted: a Python snippet with a leading module docstring and a function, asserting file_doc() extracts the docstring text.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_long_header_is_cut_and_says_so`
- spec 2 · read at `86baa925f59f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:21Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A #[test] function that builds a source file whose file-level doc comment/header exceeds FILE_DOC_MAX in length, parses it, and asserts that the extracted file_doc is truncated to the max length and ends with an explicit truncation marker (like … or [truncated]) rather than silently stopping mid-sentence.
- found: Test builds a Rust source with a 400-word `//!` header, parses its file_doc, and asserts the result is bounded near FILE_DOC_MAX and ends with the '…' truncation marker.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `python_docstrings_are_the_doc`
- spec 2 · read at `71b25bfaa267` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that parses a small Python source snippet containing a function whose first statement is a string literal (docstring), runs it through the parser, and asserts that the extracted function record's doc/comment field equals the docstring's text content (with quotes stripped).
- found: A unit test that parses a Python snippet with a triple-quoted docstring as the function body's first statement, and asserts the parsed function's name and doc field match ("go" and "Runs the thing.").
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `go_methods_and_functions`
- spec 2 · read at `6ac5d1f4bc5e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:53Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that parses a small Go source snippet containing both a plain function and a method with a receiver, then asserts the extracted chunks include both, with the method's owner set to its receiver type name.
- found: A test parsing a Go snippet with a plain function and a pointer-receiver method, asserting the extracted names list is [\"Add\", \"Load\"].
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_method_is_qualified_by_the_type_it_hangs_off`
- spec 2 · read at `0e8fb83a87fa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:17Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that parses a small source snippet containing a method inside a type/impl block (or class) and asserts that the parsed function's `owner` field equals the enclosing type's name, verifying methods are qualified by their owning type rather than left owner-less like free functions.
- found: Parses a Rust snippet with two same-named `parse` methods in different impls, an `impl Read for Tag` trait impl, a trait default method, and a free function; asserts owners are the concrete type name in all impl cases (trait impls belong to the type, not the trait) and None for the free function.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `owners_across_the_languages_that_claim_one`
- spec 2 · read at `af858851ba0b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:14Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Iterates over a table of (language, source snippet, expected owner) covering each language whose grammar supports method-owner qualification (e.g. Rust impl blocks, Go receivers, C++ classes, Swift, TypeScript classes), parses each snippet, and asserts the resulting function/method node's owner field matches the expected type name — a cross-language sweep of the "owner" concept rather than a single-language deep dive.
- found: Checks method owner extraction across Python, Swift, TypeScript, Go (including a pointer receiver and a generic receiver `Parser[T]`, which must resolve to "Parser" not "T"), and a Rust free function which must have no owner at all rather than inheriting the file's context.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Got the general cross-language sweep shape right but missed the specific edge cases under test — generic Go receivers and the free-function-has-no-owner negative case were the real payload, per the inline comments referencing an actual bug caught this way.

### `a_nested_owner_names_its_whole_path`
- spec 2 · read at `afb27290539a` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:46Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test that parses a Python (or similar) snippet with a doubly-nested class, e.g. `class Boolean: class Input: def as_dict(self): ...`, and asserts the parsed function's `owner` field is the full dotted path "Boolean.Input" rather than just the innermost class name "Input" — demonstrating the fix described in the doc where stopping at the nearest enclosing class produced ambiguous owners.
- found: Parses Python with two classes (Boolean, Image) each containing a nested Input class with an as_dict method, asserts owners are "Boolean.Input" and "Image.Input" (full path, disambiguating same-named inner classes), and a second case confirms a single-level class owner has no trailing dot.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `unparseable_input_yields_nothing_rather_than_panicking`
- spec 2 · read at `28372eae137c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Feeds malformed/garbage source (or unsupported syntax) to the parsing function and asserts it returns an empty list of functions instead of panicking or erroring.
- found: Tests two cases: malformed Rust source ("fn (((") and empty Go source, both asserted to yield empty parse_functions results without panicking.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_deeply_nested_file_does_not_overflow_the_stack`
- spec 3 · read at `eea5fd905795` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:48Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds a synthetic C source with ~50,000 chained binary expression terms (e.g. a long `|`-separated table), spawns a thread with an explicit 512 KiB stack (smaller than a rayon worker's) to run the parse/collect on, and asserts the call completes without crashing/overflowing — likely also checking the result yields some sane function list rather than panicking.
- found: Matches prediction on mechanism (512KiB thread, 50,000-term chain, parse_functions call). The chain is placed in a top-level array initializer (outside any function body, since collect stops descending once it accepts a function), followed by a real function; asserts exactly one function is found and it's the one after the deep node — proving the walk survived the depth rather than merely not crashing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The inline comment (not part of the handed-out doc) explains WHY the chain must sit outside a function body — that placement detail is the actual point of the test and isn't derivable from the function name alone.

### `a_nested_type_does_not_inherit_the_enclosing_docstring`
- spec 2 · read at `780e67b80776` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:17Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A unit test that parses a small snippet (likely Swift, given the nearby doc note) with an outer documented type containing a nested type whose member has no doc comment of its own, then asserts that the parsed function's docs come back empty rather than climbing up to the enclosing type's docstring — regression-guarding the "walked three parents" bug described in the doc comment.
- found: Parses a Swift snippet with a documented outer class, a nested Context struct with an undocumented init, and two methods (one documented, one not), asserting undocumented functions at any nesting depth get None docs rather than inheriting the enclosing type's docstring, while the genuinely documented method still gets its own doc.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_cpp_header_yields_its_methods_not_its_namespace`
- spec 2 · read at `7226e2895307` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:49Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A regression test that parses a fixture .h file containing C++ constructs (a namespace, a class with a field initializer like `T v{};`, and real methods) using Lang::from_extension to resolve the language, and asserts the resulting Vec<FuncDef> contains only the genuine methods — not a bogus function named after the namespace, not one named after the field default-initializer, and not a class whose span swallows unrelated siblings — confirming the C++ grammar is now used instead of the C grammar that used to misparse it.
- found: Parses a fixture .h with a namespace, a templated struct with a field default-initializer and constructor init-list, and two classes with same-named methods. Asserts the extracted function names are exactly the real methods (not the namespace, not the field), that owners correctly disambiguate same-named methods across classes, and that one method's span doesn't bleed into the next class's body.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `swift_functions_methods_and_inits`
- spec 2 · read at `a0261177f953` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test that parses a Swift snippet containing a top-level free function, a class/struct with a method, and an `init` initializer, then asserts parse_functions(Lang::Swift, ...) finds all three, with the method and init getting `owner` set to the enclosing type name and the init's name being "init".
- found: Parses a Swift snippet with a free function, a struct with a doc'd method, an init, a static func, and an extension method; asserts all five names/order are found, checks doc/signature propagation, and asserts extension methods aren't mislabeled as containing "extension" in their name.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `every_language_finds_its_functions`
- spec 2 · read at `79ed7431da3f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:58Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A long test with one block per supported language: define a small snippet of source code containing a couple of functions/methods, call the parse/extract function for that Lang, and assert_eq! the extracted names vector matches the expected list of function names, covering languages like Rust, Python, Go, TypeScript/JS, C/C++, Swift, Java, etc.
- found: A table of ~50 languages (far more than typical mainstream ones — includes Zig, Gleam, Odin, Verilog, VHDL, Prolog, jq, etc.), each with a snippet and expected function-name list, run through parse_functions(); collects all mismatches into a `broken` vec and asserts it's empty at the end so every language is checked before failing, rather than stopping at the first mismatch.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Undersold the scope — ~50 esoteric languages, not a handful of mainstream ones — and missed the accumulate-all-failures-then-report pattern versus per-case assert_eq.

### `classes_are_not_chunks`
- spec 2 · read at `955da9aa2e4c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:13Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is a unit test that parses a small source snippet containing a class with multiple methods, then asserts the resulting chunk list contains only the methods (not a chunk for the class itself), verifying that class_declaration-like container nodes are excluded from the chunking kind-list so a class doesn't get counted as one giant overlapping chunk.
- found: Parses a Java class with two methods and asserts only 2 chunks result (not 3, i.e. the class itself isn't a chunk), then parses a Ruby class with one method with a body and asserts 1 chunk, distinguishing this from the unrelated case of an empty-bodied Ruby method being dropped.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/reports.rs

### the file itself
- spec 3 · read at `01e0bd08d3c9` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:31:35Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A Tauri backend module maintaining a persisted index of tracked repos/projects (not the readings themselves, which live elsewhere). It tracks per-project metadata like which harness/model/reader was used, notes about size/scan/trace, and manages cache slots (hashing, marking used, pruning stale ones, forget_all to clear). Provides load_index/save_index to persist this to a data_dir on disk, plus some inline tests for edge cases around tags and sweep/prune behavior.
- found: Maintains the persisted project index (KnownProject list: key/repo/name/touched/files/scan_ms/trace_depth/harness/model) plus sidebar order and an explain_trace toggle, with per-repo/per-kind cache slot management (hashed, tagged by version, aged out via prune_slots, wiped via forget_all) and atomic load/save of projects.json.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `harness_for`
- spec 2 · read at `9449cc8e7d8f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:58Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index (via `load_index`), looks up the entry matching `key` (the repo path or project id), and returns its configured harness/agent name if one is set, else None. Small read-only accessor mirroring `model_for`/`set_harness`.
- found: Loads the project index, finds the project entry with matching `key`, and returns its `harness` field — but only if non-empty, filtering out an empty string as if it were unset.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `set_harness` — QUIRKY
- spec 2 · read at `3f25e179c972` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:59Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, looks up the entry by key (creating a new one with repo/name if absent), sets its harness field to the given value, and saves the index back to disk.
- found: It's a one-line delegator to set_reader(key, repo, name, Some(harness), None) — the load/lookup/create/save logic I predicted lives in set_reader, not here.
- predicted: some · documented: full · derivable: no · legible: full · trap: no

### `model_for`
- spec 2 · read at `c8b52b6bf902` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:00Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index (via load_index), looks up the entry matching the given project key, and returns its configured `model` field cloned as Some(String) if set, or None if the project isn't found or has no model configured.
- found: Loads the index, finds the project by key, and returns its model field, additionally filtering out an empty string as if it were None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `remember`
- spec 3 · read at `ccf46951dc19` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, and if there's no entry for `key` yet, inserts a new entry with the given repo path and name, touched set to 0 (unused/never scanned), then saves the index back to disk. If an entry for `key` already exists, it leaves it untouched (idempotent) so re-adding doesn't reset harness/model config.
- found: Loads the index, checks if a project with this key already exists (idempotent no-op if so), and otherwise pushes a new KnownProject with touched:0 and all optional fields (files, scan_ms, trace_depth, harness, model) set to None, then saves the index.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `note_size`
- spec 3 · read at `ae9773f1bce3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:40Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, looks up the entry by `key`; if found, sets its files/size field to `files` and saves the index back to disk. If the project isn't in the index, does nothing (no entry created).
- found: Loads index, finds project by key, returns silently if not found; also skips the save if the value is unchanged (avoiding needless writes); otherwise sets files and saves.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc explains WHY this exists (walk-time recording vs scan-completion) well but not the unchanged-value short-circuit, a minor implementation detail.

### `note_scan` — QUIRKY
- spec 3 · read at `f2cc532647dc` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:14Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Loads the persisted project index, finds or creates the entry for `key`, computes a per-file scan rate from `files` and `ms` (e.g. ms/files) and stores it as the entry's `scan_ms` field, then saves the index back to disk.
- found: Loads the index, finds the existing entry for `key` (returns early/no-op if missing rather than creating one), skips the write if `files`/`ms` are unchanged, otherwise stores the raw `files` and `ms` values directly (no rate computation) and saves the index.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `note_trace`
- spec 3 · read at `2aba229c9a38` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:45Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, finds the KnownProject matching key, sets its trace_depth field to depth.to_string(), and saves the index back to disk.
- found: Loads index, finds project by key, and if trace_depth already equals depth returns early without writing; otherwise sets trace_depth = Some(depth.to_string()) and saves the index.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `set_reader`
- spec 3 · read at `343bbd207df2` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:23Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Loads the persisted project index, finds the entry for `key` (creating one with `repo`/`name` if absent), overwrites the `harness` field only if `harness` is Some and the `model` field only if `model` is Some (leaving each alone when None), then saves the index back to disk.
- found: Loads the index, pushes a new KnownProject entry with default fields if `key` isn't present yet, then finds the entry by key and sets `harness`/`model` only where the corresponding Option is Some, leaving the other field untouched. Saves the index back to disk.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc's explanation of why name/repo are create-only (avoiding an accidental silent rename) is a design rationale not visible from the code itself.

### `data_dir`
- spec 2 · read at `304076d2f901` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:08Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Checks the SANITY_DATA_DIR environment variable first (the test seam) and returns it as a PathBuf if set; otherwise falls back to the OS's standard data directory via the `dirs` crate, joined with an app-specific subfolder, returning None if the OS can't supply one.
- found: Resolves the SANITY_DATA_DIR env var if set, else dirs::data_dir() joined with "Sanity"; then eagerly creates the directory (create_dir_all) before returning it, returning None on either a missing OS data dir or a failed mkdir.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that it also creates the directory as a side effect, not just resolves the path.

### `cache_slot`
- spec 3 · read at `44e91de8c934` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:03Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Joins data_dir()/kind with a filename built from slot_hash(repo) formatted as hex plus the tag, e.g. "{hash:016x}-{tag}.bin", returning None if data_dir() is unavailable.
- found: Builds dir = data_dir()/kind, creates it (create_dir_all, failing to None on error), and returns dir joined with "{hash:016x}-{tag}" where hash = slot_hash(repo). No file extension.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `mark_used`
- spec 3 · read at `5beb415015ad` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:53Z · by ross@rossturk.com · warm reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Opens the file at `path` and updates its modified timestamp to now (a touch/utimes), silently ignoring any failure, so that prune_slots' age-based sweep sees this slot as recently used and spares it even though nothing was written to it.
- found: Opens the file for write and sets its modified time to now, silently ignoring failures, so a read-only cache hit still counts as "used" for the age-based eviction sweep.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: I had already read this function's source earlier in this session via the file-level reveal of reports.rs, so this was a warm reading, not a cold prediction.

### `forget_all`
- spec 3 · read at `2d0b20b2ecf5` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:32:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: forget_all computes the repo's hash (like slot_hash) and then removes every cache file/slot in the cache directory whose name starts with or contains that hash, deleting all tags/builds at once rather than just the current build's slot.
- found: Computes the repo's hash, then for each cache "kind" directory removes every file whose name starts with that hash, deleting every build/tag's slot for the repo at once, best-effort (ignoring remove errors).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `prune_slots`
- spec 3 · read at `15f6344f4d4c` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Scans the on-disk cache index for slots belonging to the given kind+repo, and deletes/removes entries that don't match the current tag (or are stale/unused), freeing their storage. Likely keeps slots for tags still considered "live" and only prunes ones that are abandoned, matching the peer test about the sweep sparing another build until it's abandoned.
- found: Deletes files in the kind's data dir that share the repo's hash prefix but not the current tag, only if their mtime is older than KEEP_SLOTS — i.e. prunes old sibling slot files (.slim.bin, .links.bin, .tmp, and pre-tagging unsuffixed names) for the same repo once they age out, leaving the current tag's slot and any recently-touched ones alone.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `slot_hash`
- spec 3 · read at `7d06683183dd` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:09Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Hashes the repo's absolute path into a u64 using an FNV-1a-shaped (but not the exact FNV-1a prime) fold, to be used as part of a cache slot filename so different repos don't collide. Likely iterates path bytes, xoring and multiplying by a constant, matching duplicated logic in cache.rs/scancache.rs.
- found: Exactly as predicted: an FNV-1a-shaped fold over the repo path's UTF-8 bytes, xor then multiply by the same constant seen in treecache.rs's `mix`, producing a u64 used to name cache slot files distinctly per repo.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains why this isn't fixed to true FNV-1a's prime (intentional consistency with duplicated twins elsewhere) — a fact not derivable from this function alone.

### `explain_trace`
- spec 3 · read at `38a98fcba470` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:39Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Reads a persisted boolean flag (paired with set_explain_trace) that controls whether the add-project dialog shows explanatory text about tracing/blame. It loads the index via load_index and returns the stored flag, likely defaulting to true if unset.
- found: Exactly as predicted: loads the persisted index and returns explain_trace, defaulting to true when unset.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `set_explain_trace` — OBSCURE
- spec 3 · read at `e42d98fea43f` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Sets a global flag (likely a static AtomicBool) recording whether the explain output is wanted — a simple store operation, no index/persistence involved despite sitting near cache/index functions.
- found: Loads a persisted index struct, sets its explain_trace field to Some(explain), and saves the index back — this is persisted state via load_index/save_index, not an in-memory atomic as I guessed.
- predicted: none · documented: some · derivable: no · legible: full · trap: no
- note: I explicitly guessed against persistence despite sitting next to index/cache-slot peers — should have weighted proximity to load_index/save_index peers more heavily.

### `index_path`
- spec 2 · read at `dd06184e0634` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:17Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Calls data_dir() to get the app's data directory and, if present, joins it with a filename like "projects.json" or "index.json" to produce the path to the persisted project list file; returns None if data_dir() returns None.
- found: Joins data_dir() with "projects.json", returning None if data_dir() is None.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `load_index`
- spec 2 · read at `bb72b464d58d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Reads the file at index_path(), and if it exists, parses its contents (likely JSON) into a KnownProjects struct; if the file is missing or unparseable, returns a default/empty KnownProjects instead of erroring.
- found: Chains index_path() -> read_to_string -> serde_json::from_str, using .ok() at each fallible step and unwrap_or_default() at the end, so any failure (missing file, bad JSON, unresolvable path) silently yields a default KnownProjects.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `save_index`
- spec 2 · read at `d5573add5411` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:58Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Serializes the KnownProjects index to JSON, writes it to a temp file (projects.json.tmp) next to the real index path, and atomically renames it into place. If the write or rename fails, it removes the leftover temp file and otherwise swallows the error silently, since nothing is waiting on this call and it's just the reopen list, not measured readings.
- found: Serializes to JSON, writes to a .json.tmp file, renames it over the real path, and cleans up the temp file if the rename fails. All failures silent.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `one_repo_under_two_tags_is_two_files`
- spec 3 · read at `195abdfe4c1d` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:13Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A #[test] that calls cache_slot with the same repo/kind but two different tags and asserts the resulting paths differ, proving the tag is embedded in the slot filename so different builds don't collide/evict each other.
- found: Test: same repo, two different tags → cache_slot paths differ but share a parent dir; and two different repos under the same tag also produce different paths.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `the_sweep_spares_the_other_build_until_it_is_abandoned`
- spec 3 · read at `33480b2ad86f` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:10Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test that creates two cache slot files for the same repo under different tags (e.g. different build/format versions), marks one as recently used, then calls prune_slots with the current tag. It asserts that the other-tagged slot survives if recently touched (still in use by another build) but gets removed once its mtime is made old, confirming the sweep only removes slots that are both foreign-tagged AND stale.
- found: Confirmed the two-condition sweep, but with more scope than expected: it also checks that this build's own slot and its "slim" sibling file survive regardless of age, that a pre-tag legacy filename is swept as if foreign, and that a same-tag slot for a different repo is untouched entirely.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/scan.rs

### the file itself — QUIRKY
- spec 3 · served in 3 parts · read at `3f1d4ac1c0dc` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:59:44Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: The core scan pipeline: given a repo path, detect whether it's a git repo (git_root/not_a_repo/repos_inside), walk the filesystem respecting gitignore (collect_files/rel), parse each file with tree-sitter into functions (parse_file/context_for/scope_of), score them along multiple dimensions like documentation and surprise (score_dir/file_surface/apply_model_scores/estimate), assign stable identities to functions so edits above them don't change identity, fold single-child directory chains into one ring (collapse_chains) so the sunburst isn't needlessly deep, and build a tree whose parent widths equal the sum of their children's — reporting progress incrementally via the Progress struct/throttled callback — with `scan`/`run` as the entry points and `payload` shaping the final output for the frontend.
- found: Covers what I predicted (git detection, gitignore-respecting walk, tree-sitter parse with caching, per-function scoring folded into a tree, single-child chain collapsing, parent widths = sum of children, stable identity via name+ordinal so edits above a function don't rename it) plus much I missed: a whole-scan result cache (treecache) keyed by a content signature to skip rescanning unchanged repos; a cost `estimate`/`BUDGET` gate; a `Fidelity::Full` vs `Ordering` mode that skips the expensive all-pairs distinctiveness term; repo-wide call-graph wiring (`edges::wire`) and clone detection (`clones::find`) done once before per-directory scoring; a `Links` neighbor table built and stored separately (skip-serde) from the tree; and — the largest missing piece — an optional model-scoring pass that builds a priority-ordered work queue (by proxy surprise), streams upgraded scores as they land, and caches per-function readings so a stopped/resumed scan reuses prior model output.
- predicted: some · documented: most · derivable: no · legible: not judged · trap: no
- note: The file is much more heavily about cost-control (caching at three separate layers: parse cache, treecache, model-score cache) and cross-cutting analysis (call graph, clones) than the name/header alone suggested — a fair reading from the header would guess "walk, parse, score" but not the extent of the pricing/caching machinery.

### `git_root`
- spec 2 · read at `bfbf34880a2f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:48:12Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Runs `git rev-parse --show-toplevel` (or manually walks up looking for a `.git` directory) starting from `path`, returning Some(toplevel_path) if `path` is inside a git work tree, or None if it is not — deliberately refusing rather than falling back to any parent-directory heuristic.
- found: Shells out to `git -C path rev-parse --show-toplevel`, returns Some(trimmed path) on success and non-empty output, None otherwise.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `repos_inside`
- spec 2 · read at `676bc5135f06` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:01Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Reads the immediate (one-level) subdirectories of path, checks each for a .git marker, and returns the names of those that are git repos, without recursing further — used to detect a "folder of projects" so the scanner can offer per-repo scanning instead of treating the whole folder as one repo.
- found: Reads immediate directory entries of path, filters to those containing a .git subpath, maps to sorted file names; returns empty vec if read_dir fails.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the final sort, and the docs' rationale (why one level only, "expensive thing this refusal exists to avoid") wasn't derivable from the code itself.

### `not_a_repo`
- spec 2 · read at `1262c25954c2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:08Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds the error message shown when the user picks a directory that isn't a git repo. It calls `repos_inside` to check whether the chosen folder contains nested repositories; if it does, it lists them by name as suggestions ("did you mean one of these?"), and if not, it returns a plain message saying the path isn't a repo, without speculating about why the user picked it.
- found: Builds the "not a git repo" error message: lists up to 3 nested repos found via repos_inside (plus a count of "and N more"), or a plain not-a-repo message if none found, both suffixed with an explanation of why Sanity needs git specifically.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the truncate-to-3-plus-count detail and the shared 'need' blurb explaining why git history is required at all.

### `at`
- spec 3 · read at `82d67e0656fc` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:59:00Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Progress value directly from a `done`/`total` pair, likely setting an internal counting/step variant of Progress with those two fields, used to report "N of M" progress on a countable job whose unit (files, commits, etc.) the caller already knows.
- found: Plain struct constructor: builds a Progress with the given done/total, leaving phase/unit/at as empty strings and step at 0.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Progress is a plain struct (not an enum with variants as I guessed), so this is just a bare-field constructor with everything else defaulted.

### `phase`
- spec 3 · read at `29dc60f967f0` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:56Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructor that builds a Progress instance labeled with the phase name `what` and zeroed/unknown counts (done=0, total=0 or None), representing a job that has started but hasn't yet determined how much work there is.
- found: Constructs a Progress with done=0, total=0, phase set to the given label, and empty unit/at strings and step=0 — exactly a zeroed, uncounted job marker as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `counting`
- spec 3 · read at `75e2b4e34714` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:58Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: `counting` is a constructor on `Progress` that builds a struct instance from the given phase name (`what`), unit label (`unit`), and `done`/`total` counts — essentially a plain field-assignment builder, a sibling to `Progress::phase` and `Progress::at`.
- found: Plain constructor: builds a Progress with done/total/phase/unit from args, at defaulted to empty string and step to 0.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `on`
- spec 3 · read at `4a2b6e1820bb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:32Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builder-style method on Progress that sets the current subject (e.g. file path being processed) into a field on self, then returns self so it can be chained with other builder methods like phase()/counting()/at() before being emitted as a progress event.
- found: Builder-style setter that assigns path into self.at field and returns self for chaining.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `step`
- spec 3 · read at `b5e126c4ff84` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:01:41Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builder-style setter that assigns the given step value to a field on self (likely self.step) and returns self, chaining with sibling builder methods like at/phase/counting/on to configure how progress reporting fills its gauge.
- found: Simple builder setter: assigns step to self.step and returns self.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `throttled`
- spec 3 · read at `c9629ad1b732` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Wraps the given progress callback `to` in a closure that tracks the last-sent time (e.g. via Cell<Instant>) and only forwards Progress ticks if enough wall-clock time has elapsed since the last forwarded one. It always forwards phase changes and the final/completed tick unconditionally, regardless of timing, so those are never dropped by the rate limit.
- found: Returns a closure that forwards Progress events only if the phase string changed since last call, the job is done (total>0 and done>=total), or enough time (TICK_GAP) has elapsed since the last forwarded event; otherwise the tick is dropped.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `shape_of`
- spec 3 · read at `ae9aad72ed1f` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T01:00:14Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Maps each ParsedFile into a lightweight ShapeFile summary (e.g., path and some size/function-count metric) stripped of the full parsed contents, likely used downstream to compute a stable signature/ordering of the repo's structure for cache validity checks.
- found: Maps each ParsedFile to a ShapeFile with rel_path, lang, and a vec of (function name, loc) pairs for each parsed function — a structural fingerprint of the file's functions and their sizes.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `collect_files`
- spec 2 · read at `64d0f6950920` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds an ignore::WalkBuilder rooted at `root` (respecting .gitignore/.ignore), walks it, and for each file entry determines its Lang from the extension via some lookup/match. Files with a recognized extension are collected into a Vec of (PathBuf, Lang); files with unknown extensions or walk errors are skipped.
- found: Walks root with ignore::WalkBuilder (hidden, gitignore, git_global, require_git(false) so it works outside a repo too), filters to files with a recognized extension via Lang::from_extension, then further filters out files over MAX_FILE_BYTES and files under a vendored path component (VENDORED set), collecting the rest as (PathBuf, Lang).
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `rel`
- spec 2 · read at `f57e03277bd1` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:07Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Strips root as a prefix from path, then joins the remaining components with '/' explicitly (rather than using the OS path separator) so the resulting relative path string is identical whether computed on Windows or Unix.
- found: Strips root prefix (falling back to path itself if strip fails), then rejoins path components with '/' for a platform-independent relative path string.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `ephemeral`
- spec 2 · read at `0b24b07d3a89` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:23Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns a fresh, empty (Cache, ScanCache) pair — both default/new in-memory, non-persistent — so callers like `just scan` and tests measure against the repo directly rather than a cached file.
- found: Delegates to Cache::ephemeral() and ScanCache::ephemeral() rather than constructing directly — the actual emptiness logic lives one level deeper than I assumed.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `scope_of`
- spec 2 · read at `5d62e1de983e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:40Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks for a `.sanityignore` file at the repo root; if it exists, builds and returns a Gitignore matcher from it using GitignoreBuilder (gitignore syntax). If the file doesn't exist, returns None, meaning no scoping/filtering is applied.
- found: Checks for .sanityignore at root; if absent returns None, otherwise builds a Gitignore matcher from it and returns it (ignoring build errors as None too).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `context_for`
- spec 2 · read at `ac5ad744664b` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:00:59Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds the prompt context string for a given file: collects the file's import/use statements, then picks a couple of sibling function bodies from the same ParsedFile to show as style examples, skipping the function at index `skip` (the one being scored) so it isn't leaked into its own prompt. Given the docs' complaint about a past bug, I expect it selects siblings nearest to `skip` in file order (e.g. immediately before/after) rather than just taking the first two in the file, and concatenates everything into one String.
- found: Builds the prompt context: file.head (imports) plus, for each non-skipped sibling function within a window centered on `skip` (clamped to the start), its signature and body truncated to CONTEXT_SIBLING_LINES lines, concatenated into one String. I missed the per-sibling body-line truncation and signature-first formatting.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `parse_file` — QUIRKY
- spec 3 · read at `1ec39fdf06f0` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:41:28Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This looks like the core parse-with-cache function for the "sunburst" scan: given a file path and language, it checks `cache` for a hit (probably keyed on path+content hash/mtime) and reuses the stored parse, but per the doc still recomputes per-function fingerprints from the body unless fidelity == Fidelity::Ordering, in which case it skips fingerprinting entirely for speed. On a cache miss it actually parses the file fresh (respecting the scope gitignore filter) and returns None if the file can't be read, is out of scope, or fails to parse.
- found: Looks up the file in `cache` by relative path/identity; on Unreadable returns None, on Hit reuses the cached funcs/file_doc/head/hash/len, on Miss actually parses (skipping minified files and files with no functions), extracts file_doc and a head snippet in the same pass, and stores the new parse in the cache. Fingerprints are computed from the (possibly cached) function bodies unless fidelity is Ordering. Exclusion (via .sanityignore) is recomputed fresh every time regardless of cache and the file is still fully parsed and returned (with `excluded` set) rather than skipped, so exclusion counts stay accurate.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `estimate`
- spec 3 · read at `c14e1864a52c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:11:03Z · by ross@rossturk.com · warm reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes a per-file rate from scan_ms/files when both are known and files > 0, otherwise falls back to COLD_MS_PER_FILE; multiplies the rate by files to get seconds (0.0 if files is None); returns Estimate{seconds, files, cold: scan_ms.is_none(), fits: seconds <= BUDGET.as_secs_f32()}.
- found: Exactly matches memory: rate from scan_ms/files with COLD_MS_PER_FILE fallback, seconds = files*rate/1000, Estimate{seconds, files, cold: scan_ms.is_none(), fits: seconds<=BUDGET}.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm reading — I'd already read this function's body in full while reading scan.rs whole-file earlier in this session.

### `score_dir` — QUIRKY — TANGLED
- spec 3 · read at `6b42989c5d65` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:26Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the functions in the files belonging to one directory, computing each one's heuristic signals (distinctiveness relative to its directory peers, wiring fan-in/out, clone/copy involvement, history/blame-derived churn or staleness) at the given Fidelity level, and packages each into a Node with a score. Returns a Vec<(String, Node)> keyed by function name/id, to be inserted back into the overall tree by the caller.
- found: Returns one (path, Node) pair per FILE, not per function: for each file it builds a File-kind Node whose children are Func-kind Nodes for every function in that file. Each function node is built from distinctiveness against same-file (or, when the file has only one function, directory-wide) peers, a surprise/documented heuristic score, wiring (callers/calls/orphans/sinks), clone-group membership, and file/blame-derived churn/age/commit trace — all packaged into a Score, with plenty of fields deliberately left as Option/None/0 to be filled later by aggregate().
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `ordinals`
- spec 2 · read at `6eedc9651175` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks the function list and, for each entry, computes how many earlier functions in the file share its name (via a running counter/hashmap keyed by name), returning a parallel Vec<usize> giving each function's zero-based position among its same-named twins.
- found: Uses a HashMap<&str, usize> to track counts per name, mapping over funcs and for each returning/incrementing the current count for that name, producing a parallel vector of zero-based ordinals among same-named functions.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `file_surface`
- spec 2 · read at `808877986a14` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds a deterministic string summarizing the file's declarations (e.g. function names and/or signatures) in file order, by iterating funcs and joining their names/signatures with a separator. This string is used as a stable fingerprint of the file's shape so that scan and resync_changed can compare it to detect whether a reading is still current.
- found: Maps each FuncDef to its signature string and joins them with newlines, producing a stable fingerprint string of the file's declarations in order.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `apply_model_scores`
- spec 2 · read at `3e3c5ffe62ae` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:35Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree; for each leaf whose id is a key in `upgrades`, overwrites its score's surprise (and marks provenance/source as model-derived / analyzed) using the corresponding Reading, while leaving the `documented` field untouched since documentation grading isn't part of this scoring path. Recurses into children for non-matching or interior nodes.
- found: Recurses the tree; for a Func node found in `upgrades`, overwrites score.surprise, marks source as Model with analyzed_share 1.0, and copies over the reading's hotspots, leaving `documented` untouched — then returns without descending (funcs have no children). Non-func/non-matching nodes recurse into their children.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `insert`
- spec 2 · read at `6b89f111df90` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:15Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Splits rel_path on '/' into path segments. Walks down from root, and for each intermediate segment looks up (or creates, if absent) a directory-kind child Node in the current node's children collection, then descends into it. For the final segment, inserts the given `node` (the file node) as a child of the current directory node, likely keyed by name in a Vec or HashMap. Does not compute scores or widths here — just builds the tree shape.
- found: Splits rel_path on '/', walks/creates directory Nodes via linear search in a Vec<Node> children list (matching by name+Dir kind), tracking the accumulated relative path for each new dir node's own path field, then pushes the final file node onto the last directory's children.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `collapse_chains`
- spec 2 · read at `372859bc858a` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:53:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Recursively mutates the tree in place: for a directory node whose only child is itself a directory (nothing else alongside it), merges the child into the parent by concatenating names with "/" and splicing in the grandchild's children, repeating until the node has more than one child or a non-directory child, then recurses into whatever children remain. This produces the collapsed "src/main/java/com/x" single-node chains referenced in the doc.
- found: Recurses into children first, then repeatedly collapses a directory node with exactly one directory child by folding the child's name (joined with "/"), id, path, and children into the parent, continuing until the node no longer has a single directory child.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `scan` — QUIRKY — TANGLED
- spec 3 · read at `9e362457acf1` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:57:35Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is the top-level orchestration function for the whole repo-scan pipeline. It walks the directory tree from root (skipping gitignored paths), parses each file (likely via parse_file/tree-sitter), computes per-function "surprise" scores using the given SurpriseModel (via score_dir/apply_model_scores/context_for/scope_of), and assembles a hierarchical tree (with directory chains of single children collapsed via collapse_chains, and ordinals/insert building node structure) sized by lines and colored by score, which is what the sunburst UI renders. Along the way it invokes on_progress per directory scanned, on_scored the instant each function's score is known, and on_shape with each directory's parsed files so the UI can render incrementally rather than waiting for the whole scan. It checks the cancel AtomicBool periodically to allow early stopping (keeping partial results, since there's no length filter otherwise), uses memos for caching previously computed results, fidelity to control how precise/expensive the scoring pass is, and depth to control how much (if any) git history/blame data to layer in (since git operations dominate scan time on large repos). Returns a fully assembled Scan struct (or an error) wrapping the tree and associated metadata.
- found: scan orchestrates the whole pipeline as I expected in broad strokes (walk, parse, blame/history, score, build tree, stream progress, cancellable), but the actual implementation has far more structure than I predicted: it short-circuits entirely via a treecache signature/load for non-model passes; it groups files by directory in a BTreeMap for stable sibling order; it computes call-graph wiring and clone detection repo-wide before scoring; for the model pass specifically it builds a priority-ordered work queue (sorted by proxy-surprise intensity, not size-weighted) so the most consequential functions get scored first and stream in as they land, with per-function cache reuse keyed on content hash; blame is per-line and only run at Depth::Lines, falling back to file-level numbers otherwise; there's a SANITY_TIMING env var for phase timing instrumentation; and directory aggregate scores are recomputed (and dir-history reapplied) after every aggregate call since aggregation zeroes commit counts.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The treecache short-circuit at the top (return cached Scan directly when the proxy signature matches) is easy to miss and means most of the function body doesn't even run on a repeat scan of an unchanged repo.

### `a_scan_is_priced_from_the_last_one_and_an_unknown_size_is_not_refused`
- spec 3 · read at `9425cab1ac7d` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:22Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test exercising the scan budget-gate logic across four scenarios (known-small, known-large-over-budget, known-large-under-budget, unknown-size/never-scanned), asserting that only the known-and-large case is blocked/needs confirmation and that the unknown-size case is specifically allowed through rather than refused.
- found: Test calling scan.rs's own estimate(files, seconds) with four cases: a banked fast rate (not cold, fits budget), the same file count with a 5x slower measured rate (not cold, doesn't fit), a larger known repo that clearly exceeds budget, and unknown (None, None) which is cold, reports no file count, but still 'fits' so it's never refused.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: This estimate() takes (files, seconds) directly rather than a repo path/bank like trace.rs's estimate — easy to conflate the two similarly-named functions across files.

### `fixture`
- spec 2 · read at `f6944d8e34fb` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:31Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Shared test helper that creates a tempfile::TempDir, writes a small set of sample source files (a few functions, maybe multiple languages/dirs) into it to be scanned by the surrounding tests, and returns the TempDir handle for the caller to point scan() at.
- found: Creates a temp dir with a nested src/deep/nest/a.rs containing two documented functions, plus a .gitignore excluding vendor/ and a vendor/huge.rs file that should be skipped by the scan — set up specifically to test gitignore exclusion.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_scan_builds_the_neighbour_table_beside_its_tree`
- spec 3 · read at `db08fcd4907c` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:29:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that runs a Scan over a fixture repo and asserts that scan.links (the neighbour table) is populated/non-empty and references functions present in the tree, guarding against the #[serde(skip)] default silently making it empty when a Scan is rebuilt via some other path (slim copy, cache, restore).
- found: Runs a scan on a fixture repo, asserts links.len() equals the function count (one entry per function), then looks up a specific function 'add' at a known location and asserts it's marked 'wired' (Rust call resolution worked) with an empty callers list (nothing in the fixture calls it).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `the_streamed_shape_matches_the_tree_it_precedes`
- spec 3 · read at `0be5d362a4d9` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:24Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that runs scan() on a fixture repo with an on_shape streaming callback, capturing the shape it emits, then compares that captured shape against the final returned tree — asserting they describe the same structure (same files/dirs), to catch cases where the streamed preview silently fails to fire or emits an empty/wrong shape.
- found: Runs scan() on a fixture with an on_shape callback that collects streamed ShapeFile entries, then compares the (path, function name, loc) triples extracted from the streamed shapes against the same triples walked from the final returned tree, asserting they're identical sets after sorting.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `payload`
- spec 3 · read at `6dea818731ad` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:27Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: An ignored benchmark: reads a REPO env var, runs a full scan on it, serializes the resulting tree/scan struct to JSON (as it would be sent over Tauri's IPC to the frontend window), and prints the size in bytes so a large repo's payload cost can be measured against the drawing cost.
- found: Benchmark: scans REPO with a persistent cache (to measure launch cost), serializes the full tree to JSON, then times trimming to the "slim" tree (what's actually sent to the window) and its own serialization, printing sizes for both the full and slim payloads plus a per-field (docs/ids/paths/names/bodies) byte breakdown across all functions.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ordering_fidelity_changes_the_score_and_nothing_else`
- spec 3 · read at `936bce26bf18` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:31Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This test scans the same fixture repo twice — once at Full fidelity, once at Ordering — and asserts the resulting trees are structurally identical (same file/function ids, lines, shape), then checks that only the surprise score differs, specifically confirming the distinctiveness term reads UNDECIDED at Ordering instead of a measured value.
- found: Runs a full scan and an Ordering-fidelity scan of the same fixture, then asserts function count, files scanned, and root loc match, and that the sorted set of function ids is identical (and non-empty) between the two — confirming tree shape is fidelity-independent. It does NOT actually assert anything about the surprise score or UNDECIDED distinctiveness despite the doc comment describing that as the allowed difference.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment frames this as testing that scores differ while structure doesn't, but the test body only checks structural equality — the score-side claim is asserted nowhere in this function.

### `run` — QUIRKY
- spec 3 · read at `dcad5d8f74d2` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:52Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Top-level orchestrator: walks the given directory (respecting gitignore), builds the file/function tree via file_surface, collapses single-child directory chains, applies scoring, and assembles the result into a Scan struct that gets returned. It's a short glue function that calls out to the other helpers in this file in sequence.
- found: A test/fixture helper: builds ephemeral memo caches and no-op progress callbacks, then delegates entirely to the real `scan()` function with HeuristicModel, Fidelity::Full, and Depth::Lines, unwrapping the result. It doesn't do any walking/scoring itself — it's just a thin harness around the real scan().
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: This `run` is a test fixture wrapper, not the top-level scan orchestrator that name/file_doc suggested — the real work is in `scan()`.

### `gitignored_paths_never_enter_the_picture`
- spec 2 · read at `ae7a09b435fc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:12Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Sets up a fixture repo (via the `fixture` helper) containing a .gitignore that excludes some file or directory, runs `scan` on it, and asserts that the ignored path does not appear anywhere in the resulting tree/output.
- found: Builds a fixture repo, runs the scanner, collects all node names via a tree visit, and asserts that a known non-ignored name ('add') is present while a known gitignored name ('vendored') is absent.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Didn't anticipate the positive-control assertion for 'add' alongside the negative one for 'vendored'.

### `single_child_directory_chains_collapse_to_one_ring`
- spec 2 · read at `4a6e2aaffd42` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This test creates a nested directory structure where each directory has exactly one child directory (e.g. a/b/c/file.rs), runs the scan and collapse_chains logic, and asserts that the resulting tree merges that single-child chain into one combined node/ring (e.g. labeled "a/b/c") rather than producing a separate ring for each directory level.
- found: Uses a shared fixture with a src/deep/nest single-child directory chain, runs the scan, and asserts the root has exactly one child named "src/deep/nest" (the collapsed chain), while the root itself retains the repo directory's own name regardless of chain depth.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `parents_are_exactly_as_wide_as_their_children`
- spec 2 · read at `19946b1cfeb3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:57Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a unit test verifying an invariant of the sunburst tree: for any directory node, its width (or score) equals the sum of its children's widths. It likely builds a small fixture tree via `scan`/`fixture`, then recursively asserts parent.width == sum(child.width for child in children) across the whole tree.
- found: A test that builds a fixture repo, runs the scanner, and checks that a specific file node's `loc` equals the sum of its children's `loc`, and that the root's `loc` also equals that sum — verifying LOC rolls up the tree rather than checking width/score generically or recursively at every level.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `documentation_is_graded_not_discounted` — QUIRKY
- spec 2 · read at `874cdb525a8d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:14Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test that scans a fixture repo containing functions with documentation of differing quality (e.g. a good/accurate doc comment vs a poor/vague or misleading one) and asserts their scores differ accordingly — showing that documentation affects the score based on how well it actually describes the code, not via a flat discount just for having any comment present.
- found: Scans a fixture, finds funcs 'add' (documented) and 'sub' (undocumented), asserts sub.documented==0.0 and add.documented>0.0 (graded, not binary), and explicitly asserts temperature equals raw surprise (not multiplied by doc grade) — with a comment explaining a prior version asserted add<=sub which passed vacuously when doc no longer affected temperature, so that assertion was removed as untrustworthy rather than kept as a false signal.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `a_repo_without_git_says_so_rather_than_guessing`
- spec 2 · read at `3afe426ce180` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a fixture repo directory without a .git folder, runs the scan pipeline, and asserts the resulting tree explicitly marks git-history data as absent (None/empty) rather than a fabricated or zeroed default — verifying the scanner doesn't crash or silently guess when git is missing.
- found: A unit test that runs the scan on a fixture repo without git, then asserts s.stats.without_history is true and that every node with a score has score.age_days == None, confirming the scanner flags the absence of history explicitly rather than inventing an age value.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_functions_context_is_its_neighbors`
- spec 3 · read at `ed771ac11a3a` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This test builds a fixture source file containing several functions and runs the neighbor-context computation used for scoring/prompts. It asserts that a function's neighbor context is drawn from the functions actually adjacent to it in the file, not from the first two functions at the top — verifying the fix for the bug described in the docs where context depended on file position rather than true adjacency.
- found: Builds a fixture of 8 functions f0..f7 and calls context_for(&file, 6), asserting the context contains the immediate predecessor (f5) but not the file's first function (f0) or the function itself (f6). It also checks the edge case: a function at index 0 (top of file) still gets a full window of neighbors, taken from the side that has them (f1 and f2), not f0 itself.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc text explains the bug being regression-tested but doesn't mention the top-of-file edge-case behavior (window falls back to one side) that the second half of the test actually covers.

### `an_edit_above_a_function_does_not_change_its_identity`
- spec 3 · read at `b8bdae76b417` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:36Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds a fixture source file, scans it to get a function's id, then modifies the fixture by inserting a line above the function (e.g. an import) and rescans, asserting the id is unchanged between the two scans — verifying ids no longer encode line number.
- found: Writes a fixture with two functions, scans it, collects+sorts function ids, then rewrites the fixture with an unrelated `use` line inserted above and rescans, asserting the sorted id lists are identical.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc's history about ids used to carry `@line` and the cascading invalidation cost (report map, leases, selection/drill-in) is context the test itself can't convey.

### `same_named_functions_keep_separate_identities`
- spec 3 · read at `d3a30aca553c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:40:13Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a fixture source file containing two functions with the same name, runs it through scan(), and asserts the resulting tasks/tree entries get distinct identities (different IDs), verifying identity is derived from structural/positional order rather than name or raw line number alone.
- found: Writes a fixture file with two distinct impls (A and B) each defining a method `go`, scans it, collects all Func node ids, and asserts they are `a.rs#go` and `a.rs#go#2` — i.e. same-named functions in the same file get a numeric suffix appended to disambiguate rather than colliding on one id.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The file doc's line about "position, which the line number was only ever a proxy for" undersells the actual mechanism: ids are just a bare name plus an incrementing numeric suffix, with no positional/line encoding visible in the id itself.

### `scanning_an_empty_directory_is_not_an_error`
- spec 2 · read at `b0c1952516fb` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:56Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Creates an empty temporary directory, calls scan() on it, and asserts the result is Ok with an empty (or root-only, childless) tree rather than an error or panic.
- found: Creates an empty tempdir, calls run() on it, and asserts the resulting stats have zero functions and the root node has zero lines of code — confirming an empty directory scans cleanly rather than erroring.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/scancache.rs

### the file itself
- spec 3 · served in 2 parts · read at `60fd9563adae` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:59Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Implements an on-disk, append-only cache (ScanCache) keyed by file content hash that memoizes the two expensive per-file scan costs — tree-sitter parsing and git blame — so open_project's mandatory rescan-on-every-open doesn't redo them for unchanged files. Provides open/warm/ephemeral constructors, lookup/hash helpers, separate put paths for parse vs blame (a harmless reparse keeps blame, an uncommitted edit drops it), git-ancestry helpers to validate cached blame against current HEAD, retain/touched bookkeeping to drop entries for files no longer in the scan, and an append-only save format resilient to a torn last line.
- found: An append-only, line-per-file JSON log cache keyed by relative path, storing parse (funcs/file_doc/lang) and blame separately per entry. Uses (mtime,len) as a cheap gate before falling back to content hash as the true key; blame additionally keyed on last-touching commit oid to handle revert-and-reapply. Lazy-loads from disk on first use (not on open/construction) so a launch served entirely from treecache never reads it. Batches writes (FLUSH_EVERY) as appends, only rewriting/compacting the whole file when removals occurred or the log has grown past COMPACT_RATIO times the live entry count. FORMAT_VERSION (whole-store) and PARSE_VERSION (per-entry) are separate invalidation axes so a parser bump doesn't discard expensive blame data, and a rewritten git history drops only blame, not parses.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `ephemeral`
- spec 3 · read at `317698ae6317` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:39Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Constructs a ScanCache with path set to None so store()/save() never touch disk, an empty in-memory Stored map, an empty dirty tracker, default/empty head, and an empty repo path — a purely in-memory no-persistence cache for tests and the headless scanner.
- found: Constructs a ScanCache with path: None, inner pre-populated (not lazy) with an empty Stored{version: FORMAT_VERSION, ..Default}, an empty Dirty tracker, empty head string, and empty repo PathBuf — a fully in-memory, non-persisting cache.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `open`
- spec 3 · read at `417a14c0e057` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:17Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Constructor: computes the cache path via path_for(repo), resolves current git HEAD via git_head, stores the repo path, and initializes inner to Mutex::new(None) so the actual disk load and invalidation is deferred lazily to store(). Also sets up an empty dirty/append-tracking state. No disk I/O happens here.
- found: Sweeps stale format-version cache slots and the old untagged name via prune_slots, computes the cache path, marks it as used (for that same sweep's benefit) if it exists, then constructs the ScanCache with an unopened (None) inner mutex, a fresh Dirty tracker, the current git HEAD, and the repo path — deferring the actual file read/invalidation to store() on first access.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `warm`
- spec 3 · read at `6f62262e1ced` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:45Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Forces the lazily-loaded cache file content (normally read on first `store` access during the first `parse_file` call) to be read eagerly right now, while still in a phase labeled appropriately for this cost, instead of letting it silently happen under the "reading the commit log" phase label. It probably just touches/locks the store and reads it once, doing nothing (cheaply) if there's no cache file to read.
- found: Calls self.store() and immediately drops the returned guard, forcing the lazy file load (and the lock acquisition/release) to happen now under this call's own labeled phase, rather than under whatever later phase happens to trigger the first store() access.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `store`
- spec 3 · read at `d0c0adc14986` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:03Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Locks a mutex guarding Option<Stored>; if None, lazily loads the cache from disk (deserializing entries), then applies invalidation: drop all entries if the format/parser version differs from current, and drop just the blame half of entries whose commit history was rewritten (detected via ancestry/git log check) while preserving still-valid parse results. Returns the MutexGuard for the caller to use.
- found: Lazily loads the on-disk cache into the mutex on first access: reads and parses the log file, discards it entirely if the stored format version doesn't match FORMAT_VERSION (falling back to an empty Stored), and if the stored head isn't empty, differs from the current head, and isn't an ancestor of it (i.e. history was rewritten rather than fast-forwarded), clears blame on every entry while keeping parses. Also stashes the line count read into a separate `dirty` mutex for later append bookkeeping, then stores and returns the guard.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `path_for`
- spec 3 · read at `541f78f57668` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:31Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns the on-disk cache file path for a given repo, deriving it from a hash/identifier of the repo path plus FORMAT_VERSION (not PARSE_VERSION), placed under some cache directory (e.g. via dirs::cache_dir()). Returns None if the cache directory can't be determined.
- found: Delegates to a shared `crate::reports::cache_slot("scans", repo, "f{FORMAT_VERSION}")` helper to compute the slot path, then forces a ".json" extension. Confirms the prediction that it's keyed by FORMAT_VERSION not PARSE_VERSION, but the actual path derivation (hashing, cache dir) lives in `reports::cache_slot`, not here — the function itself is just a thin wrapper/formatter.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The docs explain WHY format vs parse version matters but say nothing about this function's actual one-line delegation to cache_slot — documented as 'some' since the rationale is real but the mechanism isn't described.

### `look`
- spec 3 · read at `624e75c68312` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:21Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the cache entry for rel_path and decides whether its stored parse is still valid for `path` given `last_commit`. It likely first checks a cheap signal (e.g. stored commit oid or mtime) to avoid reading the file; only if that's ambiguous does it read/hash the file contents and compare against the stored hash. Returns a `Look` value (e.g. Fresh/Stale/Miss) that callers use to decide whether to re-parse, while leaving the blame portion of the same entry untouched even on a parse miss.
- found: It checks a cheap mtime+len gate against the stored entry first (fast path, no read); if that misses, it reads and hashes the file content and checks the hash against the stored entry (handles reformats/touches/checkouts that don't change bytes) restamping-eligible; only if both fail does it read the source and return Look::Miss with the freshly computed ident. In both hit paths, blame is only returned if the stored blame_commit matches the wanted commit, otherwise None — so a parse hit can still carry a stale/missing blame independently.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc explained the "why" (why blame isn't invalidated on parse-version bumps) but not the actual mechanism (mtime+len gate, then hash fallback) — that mechanism is the derivable-from-code part, so documented is 'most' not 'full'.

### `hash_of`
- spec 3 · read at `c6c45ef2aed5` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:24Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up the cached entry for rel_path in the ScanCache's internal map and returns the stored content hash (computed during the last parse) if the file is present in the cache, or None if it isn't cached.
- found: Looks up rel_path in the store's entries map and returns the cached content hash if present, via an optional store accessor.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `has_blame`
- spec 3 · read at `e2215505a8ff` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:22Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the cache entry for rel_path, checks that the stored hash matches `hash` (file unchanged) and possibly that last_commit is compatible with what's cached, returning true if valid blame data already exists without copying it out.
- found: Looks up the entry for rel_path in the store; returns false if missing, otherwise returns true only if the hash matches, the cached blame_commit equals last_commit (defaulting to a sentinel ANCIENT), and blame data is actually present.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `cached_blame`
- spec 3 · read at `f41988f043d5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Looks up the cache entry for rel_path in the store; if found, compares its stored content hash against `hash` and its stored last-commit oid against `last_commit`, and returns the cached FileBlame (cloned) only if both match. Returns None if the entry is missing or either condition fails to hold, since either mismatch alone can indicate the blame is stale.
- found: Looks up the store entry for rel_path; returns None if the store or entry is missing, or if the entry's hash differs from `hash`, or its blame_commit differs from last_commit (using a sentinel ANCIENT value when last_commit is None). Otherwise clones and returns the stored blame (which is itself an Option, so a hit can still yield None).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: last_commit=None is mapped to a sentinel ANCIENT string for comparison rather than special-cased — worth knowing if adding a new no-commit case.

### `put_parse` — QUIRKY
- spec 3 · read at `b6e245ba6e40` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:30Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a cache entry (lang, funcs, file_doc, a hash/identity from ident, and head) with blame left as None, inserts/overwrites it in store().entries keyed by rel_path, and marks the key dirty so it gets appended to the on-disk log on the next save.
- found: Looks up the previous entry for rel_path; if its hash matches the new ident's hash (bytes unchanged), carries over its blame/blame_commit, otherwise clears them. Inserts a new Entry with mtime/len/hash/lang/funcs/file_doc/head/parse-version plus that carried (or cleared) blame, then calls touched(rel_path) to mark it dirty for the log.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `put_blame`
- spec 3 · read at `0f860d8dc8ec` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:43Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Locks the inner Stored map, looks up the entry for rel_path; if it exists (meaning a parse entry is already stored), sets its blame field to the given blame/last_commit and marks the entry dirty for saving. If no entry exists yet for that path, does nothing — the blame is dropped rather than creating an orphan entry.
- found: Locks the store, and if an entry exists for rel_path, sets its blame and blame_commit (defaulting to ANCIENT sentinel if no last_commit given); does nothing if no entry or store is None. Then calls touched(rel_path) to mark it dirty, outside the lock.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I expected a "dirty" marker set inline under the same lock; actual code drops the lock first then calls a separate touched() method — a minor structural detail I didn't predict, plus the ANCIENT sentinel default I didn't anticipate.

### `retain`
- spec 3 · read at `bf2b4879d552` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Locks the internal map(s) of cached per-file entries and removes any entry whose file path key is not present in the `live` set, so files deleted from the repo don't linger in the cache forever. Likely iterates over both the parse-cost and blame-cost maps (or a combined entry map) and calls something like `.retain(|k, _| live.contains(k))`. Probably also marks the cache as touched/dirty so it gets persisted.
- found: Locks the store, drops entries whose key isn't in `live`, and if anything was dropped marks the dirty state as needing a full rewrite (since the append-only log format can't represent a removal, only an update).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The comment explaining why removal forces `rewrite: true` (append-only log can't represent deletion) isn't derivable from the signature/file_doc alone — it's a good example of a non-obvious invariant worth documenting at the call site too.

### `touched`
- spec 2 · read at `24669c45b5dd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Records that a cache entry's key changed, buffering it (probably via interior mutability like a Mutex/RefCell since it takes &self not &mut self) into a pending list; once that pending buffer reaches some threshold size, it flushes/appends the accumulated entries to the on-disk cache log rather than writing on every single touch.
- found: Locks a dirty set, inserts the key, and if the set has reached FLUSH_EVERY size, calls self.save() to persist the cache to disk.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `save`
- spec 3 · read at `b408aba188e0` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:23Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Checks whether anything is dirty (changed since the last save) and returns early if not. If so, appends `entry_line`-formatted rows for just the changed/new entries to the cache file on disk (opened in append mode), tracking how far the on-disk log has grown past what a full compact rewrite would cost; once that ratio crosses a threshold it instead rewrites the whole file fresh via `header_line` + every live entry (a compaction) to bound future append cost. Any I/O error is swallowed rather than propagated/panicking, per the module's stated "silent on failure" policy.
- found: Appends entry_line rows for just the dirty keys in the common case; when the accumulated log lines exceed a ratio of the entry count (plus a flush-every floor), or a rewrite/empty-log flag is set, instead rewrites the whole file fresh (header + all entries) atomically via a temp file + rename. The append path now also uses create(true), fixing a prior bug where a deleted cache file made every append silently no-op since nothing reads the write error.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the temp-file+rename atomicity technique for the compaction path and the exact staleness formula, but got the append-vs-compact branch structure and silent-failure policy right.

### `header_line`
- spec 3 · read at `1fce0024a0d3` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:39Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds the JSON string for the log's first line — a header record pulled from the Stored struct's top-level fields (e.g. version and head commit), serialized via serde_json, so read_log can validate/seed itself before applying the per-file entry_line records that follow.
- found: Serializes version and head from the Stored struct into a single JSON object string, appends a newline, and returns it (empty string on serialization failure) — the header line written first in the log-per-line store.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `entry_line`
- spec 2 · read at `21a32316ab68` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Serializes an Entry (its cached hash/data fields) plus the given key into a single delimited text line, for writing to the on-disk line-based cache file that ScanCache reads back later.
- found: Serializes {key, entry} as one JSON object per line (JSONL format), swallowing serialization errors into empty string.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Format is JSON-lines rather than a custom delimited format; error path is silently swallowed via unwrap_or_default.

### `read_log`
- spec 3 · read at `1a08f73cac34` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:17Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Splits the log text into lines, parses the first line as a header (git_head/version info), then uses rayon to parse the remaining lines in parallel directly into Entry structs (one pass, not double-parsed via serde_json::Value), building up a Stored map keyed by file path. Returns the Stored struct plus a usize count (likely number of entries read or lines skipped due to errors).
- found: Parses header line for version/head, then parallel-parses remaining lines into Row{k,e} structs via rayon, filtering out unparseable lines, and collects them into a HashMap keyed by k. Returns the Stored struct plus a read count (rows + 1 for the header).
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `git_head`
- spec 2 · read at `cc6a1ef855dc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Shells out to `git rev-parse HEAD` (or similar) in the given repo directory, captures stdout, trims it to a commit hash string, and returns an empty string on any failure so callers can treat that as no git info available.
- found: Runs `git -C <repo> rev-parse HEAD`, checks exit status success, trims stdout to a string, and returns empty string on any failure (spawn error or non-zero exit).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `is_ancestor`
- spec 2 · read at `98aa0378ebf1` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:33Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Runs `git merge-base --is-ancestor <old> HEAD` (or equivalent) as a subprocess in the given repo path, and returns true if the command exits successfully, meaning `old` is an ancestor of HEAD (i.e., history was not rewritten).
- found: Shells out to `git -C <repo> merge-base --is-ancestor <old> HEAD` and returns whether it exited successfully, defaulting to false on any subprocess error.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `fnv`
- spec 2 · read at `50d273b4c38d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:16Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Implements an FNV-1a-shaped hash over the byte slice: starts from an offset basis, and for each byte XORs it into the running hash then multiplies by a constant "prime" (deliberately not the real FNV-1a prime, per the doc), returning the resulting u64 as a fast content hash used to detect whether a file's bytes changed since it was cached.
- found: FNV-1a-shaped hash: starts from the standard FNV offset basis 0xcbf29ce484222325, then for each byte XORs it in and multiplies (wrapping) by a constant that is NOT the real FNV-1a prime, per the doc's warning, returning the u64 result.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: The doc's warning about the multiplier being intentionally non-standard (and matching a twin in cache.rs) is the kind of fact you could never derive from this function alone — it explains why nobody should "fix" it.

### `func`
- spec 3 · read at `f8d501c47268` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:53:13Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: func is a small test-helper utility (given the peer list of sentence-named test functions) that constructs a minimal FuncDef populated with a given name and otherwise dummy/default values for its other fields (signature, body, doc, etc.), used to build test fixtures for ScanCache tests without repeating full struct literals everywhere.
- found: Test-fixture helper building a minimal FuncDef with the given name, a synthesized one-line signature/body, and default/empty values for everything else (doc, owner, shape, calls).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_new_cached_field_cannot_be_added_silently`
- spec 3 · read at `3c8952dd4a89` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:39Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a default/sample Entry, serializes it (e.g. to JSON), and asserts the resulting set of field names exactly matches a hardcoded list of expected fields. If someone adds a new field to Entry without updating this list (and presumably bumping FORMAT_VERSION), the assertion fails, forcing a deliberate acknowledgment per the doc's warning about the file_doc/reading_hash incident.
- found: Same as predicted, but it also pins a second, nested struct (FuncDef) one level down inside Entry.funcs, since a silently-added field there would cause the same stale-cache problem.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `seeded`
- spec 2 · read at `bf58a00896a7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:08:03Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test helper: writes `body` to a file inside `dir`, creates a ScanCache, parses the file and stores the result via put_parse (and maybe put_blame), then calls look()/cached_blame on the same untouched file to warm/verify the cache entry, and returns the (ScanCache, PathBuf) so the caller can make further assertions against a pre-seeded cache.
- found: Writes body to dir/a.rs, creates an ephemeral ScanCache, calls look() expecting a Miss (panicking otherwise) to get the ident, then stores a synthetic parse (single func "one") via put_parse keyed by that ident/lang/head, and returns the cache plus path.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Guessed the shape but not that it asserts the first look() must be a Miss (an explicit precondition check) or that put_parse is fed a hardcoded single function named "one" rather than a real parse of body.

### `an_untouched_file_is_taken_from_the_cache`
- spec 2 · read at `975b7e067eab` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that seeds the scan cache with an entry for a file, then scans again without modifying that file, and asserts the second scan reuses the cached parse/blame entry (e.g. via ScanCache::touched or an equality check) rather than recomputing it — verifying the cache-hit path for files whose mtime/hash haven't changed since the last scan.
- found: Seeds a cache with one file, then calls cache.look() on the same path/content and asserts it returns Look::Hit with the expected parsed function name, rather than a miss.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Matched the intent closely; only missed the exact API shape (`look` returning a `Look` enum) which I couldn't have known without opening the file.

### `an_uncommitted_edit_is_never_served_from_the_cache`
- spec 2 · read at `cb8bc87a3c92` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:12:40Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a ScanCache, seeds/saves a cached scan for a file at some committed state, then modifies the file's on-disk bytes without committing (making it dirty), reruns the cache lookup/scan, and asserts the cache does not return the previously cached parse/entry for that file — forcing a fresh parse instead of serving stale line data.
- found: A test seeding a ScanCache with a parsed one-line file, then overwriting the file on disk (uncommitted, so git tree is dirty) with an added second line, and asserting cache.look returns Look::Miss rather than the stale cached entry.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_parse_bump_costs_the_parse_and_keeps_the_blame`
- spec 3 · read at `84d36b1cab4c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A unit test that seeds a cache entry as if written by an older parse version, then simulates loading it under a newer PARSE_VERSION, and asserts that the parse result is discarded/re-parsed (so functions are re-detected under the new parser) while the git-blame data attached to that entry is still reused rather than re-computed, since blame is independent of the parser version.
- found: Writes a cache entry, then rewrites the on-disk JSON's "parse" stamp to a newer version and separately to 0 (absent/pre-versioning), reopening the cache each time and asserting the parse is a cache Miss while cached_blame still hits for both cases.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: I anticipated the newer-version case but not the second case testing a missing/zero parse version being treated the same way.

### `re_parsing_unchanged_bytes_keeps_the_blame`
- spec 3 · read at `50d06371d757` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:57Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A unit test that simulates a PARSE_VERSION bump: it seeds an entry with both parse and blame data, forces a re-parse (via put_parse) with the same bytes/ident but a newer parser, and asserts that the blame data is still present/unchanged afterward — proving put_parse carries forward the old blame rather than dropping it when only the parse half is rewritten.
- found: Seeds a cache entry, adds blame, looks it up (Hit), then calls put_parse with a new parse result over the same ident/bytes, and asserts cached_blame still returns Some — confirming blame survives a parse rewrite when the underlying bytes are unchanged. Matches the prediction closely; it doesn't explicitly simulate a version bump but the effect (re-parsing without bytes changing) is the same scenario the doc describes.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `identical_bytes_with_a_new_mtime_still_hit`
- spec 2 · read at `f5433394105c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:13Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A #[test] function: writes a file, populates the ScanCache for it (parse + blame), then rewrites the file with byte-identical content but a fresh mtime (e.g. via touch or sleep+rewrite), rescans/looks up the cache entry, and asserts it was served from cache (hit) rather than reparsed — likely checking the content hash key matches even though the (mtime, len) gate changed.
- found: Test: seeds a cache for a file containing "fn one() {}", then rewrites it to a different two-function version, sleeps 20ms, then rewrites it back to the original single-function bytes (same content, new mtime). Calls cache.look and asserts it returns Look::Hit with the cached parse (funcs[0].name == "one") rather than treating the changed mtime as a cache miss.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_reverted_and_reapplied_file_keeps_its_parse_and_loses_its_blame`
- spec 2 · read at `c989d299b24b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:04:14Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Caches a file's parse and blame at one commit, then commits a change to the file and commits again reverting its content back to the original bytes (same content hash, different last-touching commit). Looking the file up again should be a hit for the parse (content hash matches) but treat blame as stale/miss because blame is additionally keyed on the last commit that touched the file, which is now different — asserting the parse is reused while blame gets recomputed.
- found: Seeds a cache entry for a.rs with parse+blame at commit "aaa", then looks it up again claiming the last-touching commit is now "bbb" (same bytes). Asserts the result is a Hit with the parse intact (funcs[0].name == "one") but blame.is_none(), and that cached_blame() queried directly for that content hash + "bbb" also returns None.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Got the core hit-parse/miss-blame behavior right; didn't anticipate the setup was a direct two-commit seed rather than a literal revert-and-reapply sequence.

### `on_disk`
- spec 2 · read at `78dc5ad1cdbc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:54Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test helper that writes the given (name, content) pairs as real files under repo on disk, then constructs and returns a ScanCache that persists to (and is loaded from) an actual log file at that path — used instead of the in-memory ephemeral cache so tests can exercise the real save/read-log format rather than just the in-memory map.
- found: Opens a real ScanCache at repo, and for each (name, body) pair writes the file to disk, confirms a miss via cache.look, populates it via put_parse with a single dummy function and a "head" hash, then saves the cache to its on-disk log and returns it.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `saving_appends_rather_than_rewriting_the_whole_store`
- spec 3 · read at `bfc474655c85` · commit `10edcdb` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:39:41Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A unit test that creates a ScanCache, performs several save() calls with incremental changes across many simulated files, and asserts the on-disk log's size/line-count growth is proportional to what changed (linear) rather than re-encoding the whole store each save (which would be quadratic) — verifying the "write costs the size of what CHANGED" claim in the module docs.
- found: Seeds a cache with one file, then adds three more files one at a time, calling save() after each; asserts the log file ends up with exactly 5 lines (1 header + 1 per file) rather than growing quadratically, and separately reopens the store fresh to confirm all 4 entries are readable back.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: n/a

### `a_torn_last_line_costs_only_its_own_entry`
- spec 3 · read at `00ad2945d35d` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:44:08Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test that writes a log-style cache file with several entries (via save/put_parse), then simulates a crash by truncating/corrupting only the final line, and asserts that read_log still successfully recovers all the earlier, well-formed entries — losing only the torn last one rather than failing to parse the whole file.
- found: Builds a real on-disk cache with two entries, appends a hand-crafted incomplete JSON line (simulating a torn write for a third entry "c.rs"), reopens the cache, and asserts exactly the original 2 good entries are still present rather than the whole store failing to parse.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_dropped_file_does_not_come_back_on_the_next_open`
- spec 3 · read at `b9d6041be276` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:22Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a ScanCache, adds/saves an entry for some file, then simulates a second scan that no longer includes that file (calling retain or similar to drop it), saves again, reloads the log from disk, and asserts the dropped file's entry is no longer present — verifying retain's removal persists across saves rather than being re-appended by a stale in-memory copy.
- found: Builds an on-disk ScanCache seeded with two files (a.rs, b.rs), calls retain with only a.rs, saves, reopens the cache fresh from disk, and asserts a.rs is present but b.rs is gone — confirming retain's drop survives a save/reopen round-trip rather than being re-appended.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `files_no_longer_in_the_scan_are_dropped`
- spec 2 · read at `4ca43586469c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test: sets up a small repo with two files, scans it (populating the cache with entries for both), then deletes/removes one file from disk and rescans. It asserts that the cache no longer holds an entry for the removed file — i.e. the cache doesn't accumulate stale entries for files that vanished from the tree, confirming the cache is pruned to match the current file set rather than growing unbounded.
- found: Seeds a cache with one file's entry, calls cache.retain() with an empty set of live paths (simulating that no files remain in the scan), then asserts a lookup for that file now misses — confirming retain() prunes entries for files not in the given set.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/screen.rs

### the file itself — QUIRKY
- spec 2 · read at `f9c5a1e00d99` · commit `d88c484` · read by claude-sonnet-5 · via claude · when 2026-08-13T23:09:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A terminal helper for the "sanity check" watch UI: a Screen-ish construct that computes the cursor's current row and sets a DECSTBM scroll region relative to it (so a pinned header of ~2 lines survives scrolling, rather than pinning absolute rows 1-2), and a Keys guard type with capture()/drop() that puts the terminal into raw mode to read a single keypress (e.g. to quit watching) without killing the underlying run, restoring cooked mode via Drop/RAII.
- found: The file only contains the Keys RAII guard (unix: raw-mode-minus-ISIG termios toggle to read a keystroke without newline/echo, restored on Drop; non-unix: a no-op stub). The DECSTBM/scroll-region approach I predicted was explicitly abandoned per the module doc comment — that redraw logic lives elsewhere (`check`), not in this file. The doc comment explains the history/reasoning (why not DECSTBM, why not full raw mode, why the non-unix Drop impl exists despite doing nothing) in a way the code alone wouldn't convey.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted a Screen/scroll-region struct that turned out not to exist in this file at all — the docs describe it as a rejected approach, not something implemented here.

### `capture`
- spec 2 · read at `a52863241018` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:04Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Enables terminal raw mode on stdin so individual keypresses can be read without waiting for Enter, allowing the watcher to detect a "stop watching" key. Returns Some(Keys) as an RAII guard (paired with Keys::drop to restore the terminal) if successful, or None if stdin isn't a TTY or raw mode can't be enabled.
- found: Checks stdin is a TTY, uses libc tcgetattr/tcsetattr directly to save current termios and switch to raw mode (disabling ICANON and ECHO, VMIN=1/VTIME=0 so reads block for exactly one byte with no timeout), returning Some(Keys(before)) holding the original settings for restoration, or None on any failure.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Predicted the high-level RAII/raw-mode shape correctly but not the specific libc termios mechanism used to implement it.

### `drop`
- spec 2 · read at `88ed03051d4a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:40Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Restores the terminal's original mode/settings that Keys::capture switched away from (e.g. raw/cbreak mode back to cooked mode via termios), undoing the capture so the shell isn't left in a broken input state when the watcher exits. May also signal or join a background thread that was reading keypresses.
- found: Restores the original termios struct saved in self.0 via unsafe libc::tcsetattr on stdin, undoing whatever Keys::capture changed (e.g. disabling ECHO/raw mode), so the terminal isn't left broken when the process exits.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `capture` #2 — QUIRKY
- spec 2 · read at `64edade0a68b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:56Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Keys::capture() puts the terminal into raw/non-canonical mode so keypresses can be polled without blocking or waiting for Enter, returning Some(Keys) as an RAII guard that restores terminal state on drop, or None if stdin isn't a TTY or raw mode can't be enabled. Likely one of two platform-specific implementations (Unix termios vs Windows console API) given the #2 suffix.
- found: This is the non-Unix (fallback) stub of an apparently cfg-gated pair — it just always returns None, doing no raw-mode setup at all. The real implementation must be the other `capture` overload guarded for the supported platform.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I predicted an actual raw-mode implementation; this variant is a trivial always-None stub for whichever platform lacks the real one.

### `drop` #2 — OBSCURE — TRAP
- spec 3 · read at `cf6ca66c9379` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:04Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A one-line Drop impl that disables raw mode (e.g. crossterm::terminal::disable_raw_mode()) to restore normal terminal input behavior, undoing whatever Keys::capture enabled, ignoring any error since Drop can't propagate one.
- found: An empty Drop impl body — it does nothing. Presumably exists only so Keys is droppable/RAII-shaped, or cleanup happens elsewhere (e.g. explicitly in capture's counterpart) and this is a leftover no-op.
- predicted: none · documented: none · derivable: yes · legible: full · trap: yes
- note: Whoever reads this expecting Drop to restore terminal state (raw mode, etc.) will be wrong — it's a no-op; if cleanup is meant to happen, it must happen somewhere else or not at all, worth checking where Keys::capture's effects actually get undone.

## src-tauri/src/search.rs

### the file itself
- spec 3 · read at `754f71ad1555` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:51Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Implements backend full-repo name search over the Node tree: a public `find(tree, query, limit)` entry point, a `tier`/scoring helper that ranks candidates by kind (function > file > directory) and match quality (exact/prefix beats substring, case-insensitive), a recursive `walk` that traverses the tree collecting and ranking candidates while skipping excluded paths, plus test-only Node-builder helpers (dir/file/func/repo) and a battery of unit tests each encoding one named ranking rule (prefix beats substring, case-insensitivity, minimum query length, limit keeps best not first, exclusion cascades to child functions, stem-exact file match).
- found: Exactly as predicted: a Hit struct, a tier() scoring function (exact/stem > prefix > substring > path-fallback, tie-broken by kind func>file>dir), a find() entry point that walks the whole tree, ranks, sorts, and truncates, a walk() that prunes excluded subtrees rather than filtering post-hoc, and a full test module with fixture builders and one test per named ranking rule.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `tier`
- spec 3 · read at `11f7533e3a66` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:38Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: tier() returns a categorical rank combining node kind (function > file > directory > path-only match) and match quality (exact > prefix > substring) into a single u8, or None if `name`/`path` doesn't contain `needle` case-insensitively at all. It probably has an early branch for exact stem match on a file, then falls through checking prefix vs substring within name, then falls back to checking the path only, assigning tiers so no combination in a lower-kind tier can outrank a higher-kind tier regardless of match quality.
- found: tier() strips a file's extension to get its stem (since nobody types extensions) but not for func/dir kinds, then checks exact match, prefix match, substring match, and finally path-substring match in that priority, each tier banded by 10s (30/20/10/0) with a per-kind base offset (Func=2,File=1,Dir=0) added within each band so kind never lets a lower-priority match beat a higher one, returning None if nothing matches.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `find`
- spec 3 · read at `52c4f935d334` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:11Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks the whole tree collecting every node whose name or path contains the query (case-insensitive), computing a rank/tier for each hit via the `tier` helper (function > file > directory, prefix match beats substring match), skips queries shorter than 2 characters (returns empty), then sorts all matches by that rank and truncates to `limit` at the end rather than stopping the walk early — so the best hits are kept even if they're reached late in tree order.
- found: Matches prediction closely: lowercase/trim query, reject under 2 chars, walk collecting (tier, Hit) pairs, sort by tier desc then loc desc then path/line for stable tie-breaking, truncate after sorting. One detail I didn't anticipate: the tie-break also uses size (loc) as a secondary rank before falling back to path/line purely for determinism, not for relevance.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment fully explains the truncate-after-sort design rationale; nothing here was surprising once read.

### `walk`
- spec 3 · read at `e63e1d3ab753` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: walk recursively descends the tree matching each node's name against `needle` (case-insensitively), classifies the match quality via `tier` (exact/prefix/substring, favoring functions > files > dirs), pushes (tier, Hit) pairs into `out` for qualifying nodes, but stops descending into any node marked excluded so functions inside an excluded file never get offered as hits.
- found: Prunes excluded subtrees, scores each node's name/path against needle via `tier`, pushes matching Hits (with id/path/name/kind/line/loc/lang) into out, then recurses into children.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `dir`
- spec 3 · read at `0a2eea09cf02` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Node representing a directory: sets its name and path from the arguments, sets its kind/type to directory, attaches the given children Vec<Node>, and fills any other fields (like size/loc) with zero/default values.
- found: Delegates to Node::dir(path, name) for the base construction, then sets the children field to the given Vec<Node> and returns it.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `file`
- spec 3 · read at `cdf9233dab1e` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:36Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper that constructs a Node with kind File, given name/path and a list of child Nodes (functions), filling in the remaining Node fields (like excluded) with defaults, mirroring the sibling `dir` and `func` helpers used to build the `repo()` fixture tree.
- found: Test helper: starts from Node::dir(path, name), overrides kind to File, sets lang=Rust and loc=100 (fixed fixture values), attaches children, returns it.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `func`
- spec 3 · read at `2e2e058611db` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:37Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Test-fixture helper that constructs a Node representing a function: sets name, path, line, and loc from the arguments, and fills the remaining Node fields (like children/kind) with defaults appropriate to a leaf function node, used to build the fake `repo()` tree used in the search tests.
- found: Test-fixture helper that builds a Node starting from Node::dir(path, name), then overrides it into a function node: sets id to "path#name@line", kind to Func, line, loc, and lang to Rust.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `repo`
- spec 3 · read at `6e1ca317c1cd` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:18Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns a synthetic Node tree (root with nested directories/files/functions) by hand, hardcoding names chosen to exercise the various search-ranking test cases (prefix vs substring matches, case sensitivity, excluded files, name collisions across kinds) used throughout this file's test suite.
- found: Hand-builds a small fixture Node tree: an osdc dir with Objecter.cc containing func objecter_read, a sibling objecter dir with notes.md, and a top-level other.rs containing a func literally named Objecter — deliberately colliding directory/file/function names to test search ranking across kinds.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc explains the fixture's real-world motivation (ceph's Objecter class) but that context lives at the file level, not attached to this function.

### `a_named_function_beats_a_file_beats_a_directory_beats_a_path`
- spec 3 · read at `57f67c73f3c1` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:34:12Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: This test builds a small synthetic tree (using the dir/file/func helpers) containing a function, a file, a directory, and a path-only match, all matching the same query string, then calls find and asserts the returned hits are ordered function-first, then file, then directory, then the path-only hit — pinning the tier ranking described in the module doc.
- found: Uses a shared `repo()` fixture (not built inline) and calls find(&repo(), "objecter", 10), asserting the exact ordered list of 5 hit ids: an exact-named function first, then a file matching by stem, then a directory, then a substring function match, then a path-only file — pinning the full tier ranking, not just four categories.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `case_is_ignored_on_both_sides`
- spec 3 · read at `58f5cffb33a2` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:18Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A unit test using the `repo()` fixture, calling `find` with a lowercase query like "objecter" against a tree that has a mixed-case name "Objecter", asserting a hit is found; and possibly also testing the reverse (uppercase query against lowercase name) to confirm case-insensitivity applies to both the query and the indexed name.
- found: Test: asserts find(repo(), "OBJECTER", 10) and find(repo(), "objecter", 10) both return exactly 5 hits, confirming query case doesn't affect match count.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_prefix_outranks_a_substring`
- spec 3 · read at `8b3315c18e89` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:34:28Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A unit test that constructs a small fake tree containing two names where one has the query as a prefix (e.g. `read_source`) and another merely contains it as a substring (e.g. `spread`), runs `find` (or similar) with the query "read", and asserts that the prefix match is ranked/ordered ahead of the substring match — verifying the tiering rule described in the module doc.
- found: Builds a fake tree with functions `spread` and `read_source` under one file, searches for "read", and asserts `read_source` (prefix match) ranks first and `spread` (substring match) ranks second — exactly matching the doc's stated example.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `the_limit_keeps_the_best_hit_not_the_first_one_found`
- spec 3 · read at `1cf50597661a` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a small tree where a lower-ranked match is encountered early in the walk order and a higher-ranked match (e.g. exact/prefix name match) is encountered later, calls find() with limit: 1, and asserts the returned hit is the better-ranked one rather than the first one the walk reached.
- found: Calls find() on a shared repo() fixture with query "objecter" and limit 1, asserting the single returned hit is the named-function match (src/other.rs#Objecter@7) rather than whatever the walk order would find first.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The actual tree fixture (repo()) that seeds the ranking scenario is defined elsewhere in the file, not visible in this function.

### `a_query_under_two_characters_finds_nothing`
- spec 3 · read at `28cbd021f9d5` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:28Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Calls find(&repo(), "a", N) with a single-character query and asserts the returned hits are empty, verifying that queries shorter than two characters are rejected/return no results rather than matching everything as a substring.
- found: Asserts find() returns empty results for a single-letter query, a single-space query, and an empty query.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `excluding_a_file_excludes_the_functions_in_it`
- spec 3 · read at `ac6f22b06fbd` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds a small synthetic tree containing a file marked excluded (e.g. via .gitignore or an exclude flag) with at least one function inside it, runs the search/walk function against a query that would match the function's name, and asserts the result list is empty — proving exclusion propagates recursively to children rather than just filtering top-level file/dir entries.
- found: Test: takes a fixture repo tree, marks one child (a file, index 2) as excluded=true, searches for a function name known to live inside that file ("objecter"), and asserts no hit has that file's path — verifying exclusion of a file also hides functions nested inside it.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_file_matches_exactly_on_its_stem`
- spec 3 · read at `5e0d9c175303` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a small tree containing a file (e.g. "foo.rs") and asserts that searching "foo" scores it as an exact match/top tier because the extension is stripped before comparing to the query, rather than being demoted to a prefix match.
- found: A unit test using the real ceph repo fixture: it searches "objecter" and asserts the file src/osdc/Objecter.cc ranks above the directory src/objecter, confirming stem-based exact matching beats a directory of the same name.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/surprise.rs

### the file itself
- spec 2 · read at `75a0de2ab589` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:05:40Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Defines a SurpriseModel trait (min_lines, is_model methods) implemented by HeuristicModel, which passes the offline heuristic.rs proxy through untouched as a no-model/no-network fallback. Also defines a Reading struct with a plain() constructor representing a scored function/reading, and a calibrate_surprisal function that normalizes raw surprisal values onto the product's temperature scale.
- found: Defines an Item struct (the context bundle a scorer sees: name, signature, body, peers, doc, context, lines), the SurpriseModel trait (label, surprise, min_lines, is_model with defaults), HeuristicModel which passes the precomputed heuristic proxy straight through as Reading::plain, a Hotspot struct capturing contrastive surprisal evidence, the Reading struct (surprise + hotspots) with a plain() constructor, and a feature-gated calibrate_surprisal mapping bits-per-token to the 0..1 scale. Extensive doc comments explain why a prior forced-decoding/Ollama model-scoring approach was removed in favor of MCP-based agent readers.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no

### `min_lines` — QUIRKY
- spec 2 · read at `87f752bfa9dd` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:37Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Trait method on `SurpriseModel` returning a constant small `usize` threshold (likely a fixed literal like 3 or 5), used by callers to decide whether a function body is too short for real scoring and should just return the proxy value instead.
- found: Default trait method returning 0 — no minimum line threshold by default; presumably other implementors (e.g. a model-backed one) override this with a real cutoff below which they skip real scoring and fall back to the proxy.
- predicted: some · documented: full · derivable: no · legible: full · trap: no

### `is_model`
- spec 2 · read at `7b3af1f6fcb3` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A trait default method on SurpriseModel returning false, signaling "not a real model" by default; the offline HeuristicModel proxy relies on this default (or explicitly returns false) so wedges scored by it render neutral instead of being colored as if a real model looked at them.
- found: Default trait method returning false, marking a scorer as not a real model (used by the offline proxy) so its output isn't rendered as heat on the map.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `label`
- spec 2 · read at `0184b56586a1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:23Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns a short static string identifying this as the heuristic (non-ML) model, e.g. "heuristic" — used for logging/display/reporting which surprise backend produced a score.
- found: Returns the static string "heuristic (no model)" identifying this SurpriseModel implementation.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `surprise`
- spec 2 · read at `78ac12cfba68` · commit `9ea3e1f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:04:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Ignores _item entirely and wraps proxy directly into a Reading::plain(proxy) or similar, since HeuristicModel is documented as an honest proxy that passes the heuristic surprisal value straight through without modification.
- found: Exactly as predicted: ignores _item, wraps proxy in Reading::plain(proxy).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The peer test name basically gave this one away.

### `plain`
- spec 3 · read at `b678779c35f3` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:44Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A small constructor that wraps a raw surprise f32 value into a Reading struct, filling in other fields (like documentation info or explanation text) with defaults/None since this is a "plain" reading with no extra context.
- found: Constructs a Reading with the given surprise value and an empty hotspots vector.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `calibrate_surprisal`
- spec 2 · read at `c5251cafb465` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:53Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Maps a bits-per-token surprisal value to the 0..1 surprise scale via a simple monotonic transform — likely a linear rescale between two calibrated bit thresholds, clamped to [0,1], since the doc says this only positions where the interesting band sits rather than reshaping the distribution like the heuristic's calibration does.
- found: Linear rescale of bits from [0.5, 4.0] to [0,1], clamped at the ends.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `predictable_code_is_cold_and_unexpected_code_is_hot` — QUIRKY
- spec 2 · read at `a685216cfeda` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:59Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds two contrasting code snippets (one boilerplate/predictable, one unusual) through the surprise calculation (likely HeuristicModel::surprise or calibrate_surprisal) and asserts the predictable snippet gets a lower surprise score than the unexpected one, confirming the core 'boilerplate is cold, novel code is hot' definition.
- found: Tests calibrate_surprisal directly on raw numeric inputs, not code snippets: checks low input (0.2) clamps to 0.0, high input (9.0) clamps to 1.0, and that the function is monotonic between two mid-range values (1.0 < 3.0 in output).
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I assumed the test would run actual code snippets through a surprise model; it actually tests the calibration/clamping function directly on raw float inputs.

### `the_heuristic_model_passes_the_proxy_through_untouched`
- spec 2 · read at `840042693013` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:17Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds a `Reading` (or similar) with a known proxy surprise value, calls `HeuristicModel::surprise` on it, and asserts the returned value equals the input proxy value exactly (untouched/unchanged), confirming HeuristicModel is just an identity passthrough for the proxy metric rather than transforming it.
- found: Test builds a trivial Item and asserts HeuristicModel.surprise(&item, 0.73).surprise == 0.73, confirming the heuristic model passes the proxy value through unchanged.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/trace.rs

### the file itself
- spec 3 · served in 2 parts · read at `14f3eef5d135` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:31:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A module that performs the expensive "trace" phase of the scan — git blame and log history — separately from the initial tree-sitter parse/map draw, since blame dominates scan time. It defines a Depth enum/tags for progressive levels of blame effort (depth1, depth2, deepen further), a bank/cache mechanism (bank_config, bank_path, load_bank) to avoid re-blaming unchanged repos, a FileTrace type holding per-line author/commit info (last_author, func), and apply/apply_to/apply_dir_history functions that fold trace results onto the map's rows after the fact so blame can be computed lazily/incrementally and merged in without blocking the initial draw. The trailing snake_case functions are property-style tests asserting invariants like idempotency of applying a trace twice, chunked vs unchunked blame agreement, deferred vs inline trace equivalence, and correct cost/pricing accounting for cached vs freshly-walked repos.
- found: The module splits the scan into a fast, git-free draw and a deferred trace phase that reads git log (depth 1, Files) and per-line blame (depth 2, Lines), banking history in a versioned bincode cache keyed per repo, estimating cost from the bank or free evidence (count-objects) to decide whether to run silently under a 10s budget or ask the user (Go::Run/Go::Ask), applying results idempotently onto an already-built tree in publish-chunked increments so progress is visible live, and filling in per-function/per-file/per-directory commit, churn, age and author fields via FileTrace/apply/apply_to/apply_dir_history. Tests pin invariants: chunked landings are monotonically increasing and match an unchunked pass, a deferred trace equals an inline one, applying twice is idempotent, cached blame/tree answers are priced as free, and cold vs warm estimates differ correctly.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc comments carry design history, rationale and measured numbers (e.g. why bincode over JSON, why chunked publishing, why BANK_FORMAT bumps aren't adopted) that aren't derivable from the code alone but are essential to understanding why the code is shaped this way.

### `tag_str`
- spec 3 · read at `f649a901ef1e` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:17Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Depth is an enum representing how deeply git history has been traced for a file/repo (e.g. none, log-only, full blame). tag_str matches on self and returns a short static string name for each variant, used as a key/label when banking or displaying trace depth in the index/window.
- found: Matches the Depth enum (Untraced, Files, Lines) and returns a static string name for each variant.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `tag`
- spec 3 · read at `ea60a348650f` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:26Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Depth is an enum with a few variants for how deep the git trace went (e.g. names-only, last-author, full history). tag matches self and returns a distinct static byte-string literal per variant, used as a cache-key discriminant alongside a sibling tag_str returning the str form.
- found: Matches on the Depth enum (Untraced, Files, Lines) and returns a static byte-string literal naming the variant, for use as a cache key discriminant.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Actual variants are Untraced/Files/Lines — a progression of trace depth, not scan granularity as I guessed.

### `estimate`
- spec 3 · read at `23ddc928e7f4` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:07Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the repo has a stored trace bank; if so, counts commits since the bank via `git rev-list --count` plus the churn window count, multiplies by that repo's measured seconds-per-commit to get a cost estimate. If never walked, falls back to `git count-objects -v` and a corpus ratio, returning an Estimate marked as a cold/rough guess rather than a real measurement.
- found: Loads the stored bank; if it has a head, computes commits since via churn::commits_since plus window_commits, multiplied by the bank's measured rate (or a cold default rate) for seconds, marked not cold. Otherwise estimates commit count from packed object count / objects-per-commit ratio, multiplied by the cold rate, marked cold. Returns an Estimate also stating whether it fits within a fixed BUDGET.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that even the "banked" branch can fall back to COLD_RATE when b.rate is None, so the cold/not-cold flag isn't purely about which branch was taken — it's really about whether a bank record exists at all.

### `relines`
- spec 3 · read at `09603caa8223` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:02Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks whether restoring this scan to per-line trace depth would be free: iterates the scan's files, and for each checks whether scancache already has a cached blame keyed by content/last-commit (via history). Returns true if every file's blame is already cached (so no wait is needed to reline), false if at least one file would require a fresh git blame call.
- found: Walks the scan's files, counting how many lack a cached blame (via scancache's has_blame keyed on content hash and last commit), then estimates the total blame cost for the missing files (missing * BLAME_MS_PER_FILE) and returns true if that estimated cost fits within a fixed BUDGET — i.e. it's not a strict all-cached check but a "cheap enough to just do it" threshold.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `go`
- spec 3 · read at `de9ed7b418ce` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:29Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns a `Go` value describing whether this repo's history can be read without explicit user consent, and at what depth. Likely loads a previously banked/measured blame-rate estimate for this repo path (via load_bank or similar) and if present decides depth1 vs depth2 automatically; if no bank exists yet, returns a value indicating the caller must explicitly ask before doing the expensive depth-2 blame pass.
- found: Calls estimate(repo) to get a projected cost/rate; if it fits (cheap enough) returns Go::Run(Depth::Files) to proceed automatically, otherwise returns Go::Ask(e) so the caller can prompt the user with the estimate.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I guessed a cached 'bank' lookup gates the decision; actually it's a live estimate() call each time, with the estimate itself carried in the Ask variant for the caller to display.

### `bank_config`
- spec 3 · read at `e227bdbb1fb5` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:37Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A one-liner that returns bincode's standard configuration (likely `bincode::config::standard()`), used consistently by both the encode and decode calls elsewhere in this file so the bank format stays compatible across reads and writes.
- found: Returns bincode::config::standard() — a one-line shared config helper.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The docs shown are the enclosing file_doc/comment above about bincode vs JSON tradeoffs, not documentation of this specific function.

### `bank_path`
- spec 3 · read at `eea7942a104b` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:17Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds the filesystem path to a cached "bank" file associated with a repo — likely joining the repo's .git directory (or a cache dir) with a fixed filename related to blame/trace caching data, returning None if the repo path is invalid or lacks a .git directory.
- found: Delegates to crate::reports::cache_slot with namespace "traces" and a format-versioned filename (BANK_FORMAT), then forces the extension to .bin. Not tied to .git directly — it's a generic cache-slot lookup, presumably keyed by repo path elsewhere.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `depth1` — QUIRKY
- spec 3 · read at `5e62a4b71cd6` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:17Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This walks the repo's git log (first-parent depth) to build a History of per-file stats: age, churn count, commit count, and last author. It likely iterates commits from HEAD backward, updating a per-path map, calling `tick(n)` after each commit processed for progress reporting, and checking `stop` periodically to allow cancellation, returning None if stopped early. It's the "cold" full walk (as opposed to a bank-refresh which would only process new commits).
- found: Loads the on-disk bank, delegates the actual git walk/incremental update to churn::refresh (which returns the updated bank plus a changed flag), and only if changed does it prune old report slots and persist the bank as bincode via atomic tmp-file write + rename. Returns Some(bank.history), or None if refresh signals it was stopped.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The real walking logic is in churn::refresh, not here — depth1 is just load+delegate+conditionally-persist.

### `load_bank`
- spec 3 · read at `7b2b723d559f` · commit `6a8b7c4` · read by claude-sonnet-5 · via claude · when 2026-08-26T21:50:16Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Resolves a cache/config path for the given repo (using bank_path/bank_config helpers), checks if a serialized Bank file exists there, reads and deserializes it (e.g. via serde/JSON), and returns None if the file is missing or fails to parse.
- found: Resolves the bank path for the repo, reads the file, marks it used for report tracking, and decodes it with bincode using a shared config; returns None on any missing/unreadable/undecodable path with no fallback or format migration — the design intentionally recomputes rather than maintaining a second reader for old formats.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `blamable` — QUIRKY
- spec 3 · read at `98f92eafcce9` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:36:09Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks the scan's tree to collect every non-excluded, parsed file (skipping ones already cached in `scans`/ScanCache), returning a Vec of (path, loc-or-size) pairs in the exact order the blame pass will process them — likely sorted so larger files or some priority order comes first, since callers (progress estimation, chunking) need to know total work and order in advance.
- found: Visits every node in scan.root, and for each File node pushes (path, cached content hash from ScanCache, defaulting to 0) into a Vec, returned in tree-visit order — no exclusion filtering or sorting.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `depth2`
- spec 3 · read at `9e50f448662f` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:31:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: depth2 runs the full/deep git-blame pass over the repo's files: it iterates the scanned files, checks a ScanCache to reuse existing blame results, periodically checks the `stop` atomic to allow cancellation, invokes `on_file` with progress info per file, and returns a `Blame` combining per-file/per-line commit ownership derived from git blame.
- found: depth2 filters the scan to blamable files, wraps the on_file progress callback with an atomic counter to compute (index, total), and delegates the actual git-blame work to Blame::read, passing through repo, history, scans cache, and the stop flag.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `deepen` — TANGLED
- spec 3 · read at `1491fd4701ad` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:43Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: deepen() incrementally runs git blame/log tracing (the deferred, expensive half of a scan) on `repo` up to the requested `depth`, checking the `scans` cache to avoid redoing work already done and checking `stop` periodically to allow cancellation. As it processes files it calls `on_progress` to report status and `on_publish` (via `apply`/`apply_to`/`apply_dir_history`, which are idempotent) to merge newly-traced data onto the already-drawn `scan` map incrementally rather than all at once. It returns the depth actually reached along with counts such as how many files or lines were processed (or remaining/failed).
- found: deepen() runs the log walk (depth1) then, if Depth::Lines, chunks blame across files (blamable/Blame::read), applying and publishing incrementally per chunk so progress is visible live rather than all at once at the end; it checks `stop` between chunks/within the log walk to support cancellation, and returns the depth actually reached (which may be less than requested if stopped) plus resolved/considered file counts — with careful handling so a stopped pass reports meaningful partial progress and a completed pass always reports 100%.
- predicted: most · documented: some · derivable: no · legible: some · trap: no

### `of` — QUIRKY
- spec 3 · read at `ce53158b6c85` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:52Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructor for FileTrace: looks up the given path's commit history within `history` (likely filtering/borrowing the relevant entries) and pairs it with the borrowed `blame` data, returning a FileTrace struct that holds the path, its history slice, and a reference to blame for later per-function/per-line queries.
- found: Builds a FileTrace by pulling several separate per-path metrics off History (churn, age, commits, last-touched, last-author) and the blame entry for the path, plus blame's `now` timestamp.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `last_author` — QUIRKY
- spec 3 · read at `372613bf0f7c` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the file's path in the History data held by FileTrace, finds the most recent commit touching that file, and returns its author name, or None if there's no history entry for the file.
- found: It's a trivial getter that clones an already-computed `last_author` field on the struct; the actual lookup/computation happens elsewhere (likely in FileTrace::of), not in this function.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `func`
- spec 3 · read at `e593dbbafa4c` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:53Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Checks whether per-line blame data is actually available and covers this line range (i.e., depth reached Lines and the file is tracked); if so, derives the function's own churn/age/last-author from just the blame lines in start..end. Otherwise falls back to the whole-file-level trace values, since untracked files, no-git repos, or shallower depths can't offer anything finer than file resolution.
- found: Tries self.blame.range(start, end, now); if it returns a per-line history, builds FuncTrace with churn normalized by TRACE_SATURATION (a different saturation constant than the file/window one) and the range's own age/commits/last_touched/last_author. Otherwise falls back to copying the file-level fields (self.churn, self.age_days, etc.) unchanged.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Confirms the prediction closely; the one detail not obvious from the signature/docs alone was that churn uses a distinct TRACE_SATURATION constant from blame.rs rather than reusing whatever the file-level churn was normalized by.

### `apply` — TRAP
- spec 3 · read at `2d75355dbdf3` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:41Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Walks the Scan's tree (root node) and, for every file (and possibly function) node, overwrites its age/churn/author fields by reading fresh values from history and blame — likely delegating per-node to apply_to/apply_dir_history, and folding dir-level aggregates on the way back up. Because it's idempotent, it always computes each field directly from the two inputs rather than incrementing or merging with whatever the node currently holds.
- found: Calls apply_to on the root to fold per-file/function blame+history, then aggregate() to rebuild container scores (which zeroes commit counts), THEN apply_dir_history to re-credit directories — an order dependency the comment calls out explicitly. Also sets scan.stats.authors (top N from history), without_history flag, and stats.commits from history.total_commits_of("") rather than a separate git rev-list call, since the walk already counted it.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The comment itself flags the ordering trap (aggregate must run before apply_dir_history or directory commit counts get zeroed), so this is a documented trap, not an undocumented one — reporting trap:true per the code-level hazard even though a comment explains it, since 'the repo knows' language in the grading guide is about hazards a comment warns of, though the instructions say a warned hazard is NOT a trap; downgrading awareness only.

### `apply_to`
- spec 3 · read at `afd08bc75576` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:11:06Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the Node tree (files, dirs, funcs) and fills in git-derived score fields — age, churn, last author, commit counts — using history for file/directory-level stats (via History::age_of/churn_of/last_author_of/commits_of) and blame/FileTrace::func for per-function line-level provenance where available, falling back to the file's numbers for functions blame couldn't resolve. It's the fold step that applies git data onto a tree drawn without it, and should be idempotent.
- found: Recursively walks the tree; for File nodes only, builds a FileTrace once and sets the file's last_author, then for each Func child looks up per-line stats via file.func(start,end) and overwrites churn/age_days/commits/last_touched_days/last_author on the child's score (explicitly nulling all_commits since that would cost a git log -L per function). Directory-level history isn't touched here (handled elsewhere by apply_dir_history) — recursion just continues into all children regardless of kind.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `apply_dir_history`
- spec 3 · read at `360000a34ebc` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree; for every node (both directory and file, per the doc's warning that files need it too) it looks up the node's own path in `history`'s per-path distinct commit count and overwrites node.commits with that value, then recurses into children. This corrects the zero left behind by aggregate for directories and files alike.
- found: Recurses over dir and file nodes, setting score.commits from history.commits_of(path) and also score.all_commits from history.total_commits_of(path), then recurses into children.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed that it also fills in all_commits (lifetime total) alongside commits — doc covered this but I only predicted the commits field.

### `repo`
- spec 3 · read at `0a8bac4e4e45` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:41Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test fixture that creates a temp directory, runs git init, and creates a small file with a few functions — each added and committed separately (so each function has a different blame/commit-time), giving trace tests a repo where per-function last-author/age genuinely differs from the file's own. Returns the TempDir handle for the caller to point trace functions at.
- found: Creates a tempdir git repo, configures user, then over 4 commits grows a.rs by appending one more function each time (f0..f3, cumulative) while fully rewriting b.rs each commit to a single new function (g0..g3, replacing not accumulating). Returns the TempDir.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the asymmetry between the two files: a.rs accumulates functions across commits while b.rs replaces its single function each commit — likely deliberate so tests can distinguish per-function blame from whole-file churn.

### `a_blame_pass_lands_before_it_finishes`
- spec 3 · read at `be24fd366f1a` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:26Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A test that runs `deepen` (or the blame pass it wraps) over a small multi-file repo fixture with a snapshot callback, collects the tree snapshots emitted during the run, and asserts that at least one intermediate snapshot already carries more per-function blame/author data than the initial one — i.e. it fails if snapshots are only emitted once at the very end. It likely checks something concrete like a middle snapshot having a non-empty author on some function while a later file is still unprocessed.
- found: Close to prediction: it chunks the blamed files one at a time, accumulates blame incrementally, applies each accumulated step to the scan, and records the growing size of the accumulator after each step, then asserts there's more than one landing and each is strictly larger than the last, ending at the full file count. It directly measures the count of accumulated blame entries rather than inspecting per-function author fields on the tree, which is a simpler and more direct check than what I guessed.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Doc fully explains the bug/intent; the actual test verifies growth of an internal accumulator size rather than inspecting tree node fields directly, a cheaper proxy for the same property.

### `a_chunked_blame_pass_matches_an_unchunked_one`
- spec 3 · read at `e7f4f1a3ada0` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:35:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A property test that generates a synthetic repo/blame trace, then runs the blame pass both in one unchunked call and in multiple chunks, and asserts the resulting tree/rows are identical (chunking doesn't change the final answer).
- found: Builds a test repo and scan, computes Blame both in one call over all files and via chunks of size 1 absorbed together, checks the lengths match, then applies both blame results to cloned copies of the scan tree and asserts the resulting rows are equal.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `scan_of`
- spec 3 · read at `d9e2164401af` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:13Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A lightweight repo scan (parsing files via tree-sitter, no git blame) at the given Depth, returning a Scan struct that can later have trace/blame data applied to it via apply/deepen. Likely a thin wrapper delegating most work to crate::scan.
- found: A test-helper wrapper around crate::scan::scan that sets up ephemeral memoization, no-op callbacks (progress/reading/cancel), and forces Fidelity::Full, then unwraps the result with .expect("scans"). It's used to produce a full-fidelity Scan (likely for comparing against deferred/incremental trace application in tests) rather than being the lightweight/deferred scan I predicted.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Function is private (no pub) and sits near test-named peers, suggesting it's a test helper rather than production code — worth confirming scope before assuming it's on a hot path.

### `rows` — QUIRKY
- spec 3 · read at `78c70e04cee8` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:47Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Iterates the scan's parsed files (and their functions), building one Row per file or function with path/name and line-count/size info derived purely from the scan (no git calls), returning the full list as the base map data that trace/blame info is later applied onto via `apply`/`apply_to`.
- found: Visits the scan tree and, for every node that has a `score` (skipping ones without), collects a tuple/Row of id, churn, age_days, commits, all_commits, last_touched_days, and last_author — i.e. the trace-relevant scoring metrics, not general file/function structural info. Given the peer names (property-test-style function names), this looks like a test helper for comparing scan state before/after applying a trace, not production row-building.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `same`
- spec 3 · read at `1c8be5807b12` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:16Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test-helper assertion function that compares two slices of Row for equality field-by-field, except it allows age_days and last_touched_days to differ by a small tolerance (~0.001, i.e. ~86 seconds) rather than requiring exact equality, panicking/asserting if anything else differs.
- found: Test helper asserting two Row tuple-slices match: same length and tree order, churn/age/touched compared with a 0.001 tolerance (age and touched allowing None on both sides), commits/all_commits/last_author compared exactly, each with a descriptive assert message.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_trace`
- spec 3 · read at `1e78a00d1402` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:49:05Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A synchronous helper (likely test-only) that runs the commit log walk to build History (depth1) and then per-line blame over the scan's files (depth2), returning both as a (History, Blame) tuple with no caching or stop-flag handling.
- found: Right overall shape (build History, build Blame, return both, no real caching), but wrong on mechanism: uses `churn::read` for History (not a `depth1` helper), collects file paths by visiting the scan tree, and calls `Blame::read` with an ephemeral cache, a fresh stop flag, and a no-op progress callback rather than calling `depth2` directly.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_deferred_trace_lands_exactly_where_an_inline_one_did`
- spec 3 · read at `ac80c5b3b5bc` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Scans a test repo twice: once with git-derived fields deferred/wiped and then applied afterward via `apply`, and once "inline" with git available from the start. Converts both resulting trees to comparable rows (via `rows`) and asserts they're equal (via `same` or `assert_eq!`), proving deferring the trace produces an identical map to computing it inline.
- found: Matches prediction closely: scans inline, scans deferred/untraced, applies the trace, and compares rows via `same`. Additionally asserts the fixture actually has history (so the test isn't vacuous) and asserts the untraced scan's rows are all-zero/none in the git-derived fields rather than just differing from the traced version.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_repo_already_blamed_goes_back_to_the_line_for_nothing`
- spec 3 · read at `a2d21e7dd1e6` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:29:59Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test: sets up a repo that has already been traced to line depth (blame cached per file), simulates a restart/restore path, and asserts that returning to line depth costs nothing — i.e. the cache is reused rather than a full blame pass being redone. Probably checks some cost/price function returns zero or near-zero for the "remainder" when nothing is missing from the cache.
- found: Confirms relines() returns true (affordable/free) both when cold on a tiny fixture and after deepen() has banked the blame cache, then separately shows an ephemeral/empty cache has missing blame entries for every file (establishing the contrast case rather than asserting a cost function directly).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The third assertion doesn't call relines against the empty cache directly — it just shows the empty cache lacks blame data, leaving the "priced per file" claim from the docstring implicit/asserted by construction rather than exercised here.

### `a_cached_answer_is_not_priced_as_though_it_had_to_be_derived` — QUIRKY
- spec 3 · read at `390523f455a8` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:30:47Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test (named as an assertion sentence) that sets up a repo/cache where blame data is already cached, then calls whatever estimates the cost of tracing/deepening, and asserts the estimate reflects only the missing work (near-zero) rather than pricing the whole repo as if starting from scratch — verifying the "price what's left, not what's in principle" rule the docs describe.
- found: A test asserting `treecache::warm` returns false before a scan (nothing cached) and true after (tree is cached), then separately runs `deepen` to blame depth and asserts `relines` returns true — checking the tree-cache half and the blame-cache half of the rule with two different boolean predicates (`warm`/`relines`) rather than an actual cost/time estimate.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: I expected it to test a numeric cost estimate function directly; it actually tests boolean "is this cached/warm" predicates (warm, relines) as proxies for that pricing rule.

### `an_unwalked_repo_is_priced_from_free_evidence_and_a_walked_one_from_its_own`
- spec 3 · read at `9435ac260b65` · commit `4bf0da1` · read by claude-sonnet-5 · via claude · when 2026-08-26T20:58:42Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: This is a unit test (the sentence-name convention suggests these are test functions) that builds a fixture repo, calls the cost/estimate function before any history walk has happened, and asserts the returned estimate is flagged as unmeasured/a bound (derived from `git count-objects`) rather than a real measurement — then performs a walk and asserts a bank is left behind for later reuse.
- found: Test: estimate() on a fresh fixture repo is cold with commits=None and fits=true; after depth1() walks it, estimate() is warm with commits=Some(4); and go() then returns Go::Run(Depth::Files).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `applying_a_trace_twice_changes_nothing`
- spec 3 · read at `8663fe21e511` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:49:16Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This test builds a small repo/scan, applies a git trace (blame/history) to it once, snapshots the resulting node fields, then applies the same trace a second time and asserts nothing changed — guarding against a bug where re-applying a trace (e.g. depth 2 landing on an already depth-1 tree) would double-count or corrupt fields like churn/age/author rather than being idempotent.
- found: Scans a fixture repo untraced, reads the history/blame trace once, applies it to the scan, snapshots the resulting rows, applies the same trace a second time, and asserts the rows are unchanged — confirming `apply` is idempotent.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/treecache.rs

### the file itself
- spec 3 · read at `c07b8cc2dc31` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Persistence layer for the fully-built/aggregated scan tree (vs scancache's raw parse/blame ingredients). Computes a signature/tag (git HEAD + config hash) to detect staleness (stale/warm vs current), and provides save/load to serialize the tree to disk so launch is a read not a rebuild. slim/read_slim/slim_path is a lighter cache format; links/halves/split suggest the tree's link data is stored in pieces (possibly borrowed vs owned); path_for/config locate cache files per-config.
- found: Persists the fully-folded scan tree (not just parse/blame ingredients) to disk as bincode, keyed by a signature hashing parse version, cache format version, fidelity, trace depth, HEAD (only if traced), .sanityignore contents, and per-file path/size/mtime — so a launch can skip parsing, scoring and folding entirely if the signature matches. Writes three files: the whole tree, a 'slim' functionless copy for fast drawing, and a separate neighbour/links table, in that order (slim then whole then links) so partial-write failures degrade gracefully. `stale`/`warm` answer whether a cache exists without proving full validity, trading a cheap file read for occasional staleness that a fast rescan then corrects.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The version-bump discipline (VERSION comments explaining exactly why each field addition required a bump, tied to #[serde(default)] silently loading None) is a load-bearing convention that isn't obvious from the code shape alone — only the doc comments teach it.

### `config`
- spec 3 · read at `1723b014079a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:07Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns a shared bincode::config::Configuration used for both saving and loading the tree cache, likely bincode::config::standard() with some explicit settings (e.g. fixed-width integers or little-endian) chosen for fast, deterministic encoding/decoding, so save/load call sites don't have to repeat the same config inline.
- found: Just returns bincode::config::standard() with no customization — a single shared config constant for save/load call sites.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I over-predicted custom settings (fixed-width ints, endianness); it's the plain default standard() config.

### `current`
- spec 3 · read at `4cf7f60d49bd` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:10:07Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls the file's `signature` helper with `repo`, folding in `fidelity` and `depth` (likely via `mix`), returning a u64 hash representing the repo's present state — used as a cache key to decide if a cached tree is still valid.
- found: Calls `crate::scan::collect_files(repo)` to get the current file list, then passes it plus `fidelity`/`depth` to `signature` to compute the cache-key hash.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc explains this is for callers outside the scan (which already has the file list) vs `slim`; the code itself doesn't say why `collect_files` needs to be redone here.

### `slim`
- spec 3 · read at `5211cc855c8f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes the slim cache path for repo, reads/deserializes the trimmed tree file, and checks its stored signature matches the given signature (cache still describes this repo state) — returns Some(Scan) if valid, None if missing or the signature doesn't match.
- found: Delegates to read_slim to load the cached (signature, scan) pair, then returns the scan only if the signature matches, else None.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `warm`
- spec 3 · read at `79388ae952a4` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:26Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the cached tree is still valid without loading the full tree — walks the repo to compute a current signature, reads just the slim/header record, and compares signatures (accounting for fidelity/depth), returning true if the cache is still good.
- found: A one-line composition: computes the current signature via current(repo, fidelity, depth) and checks whether slim() finds a matching cached record, returning true/false via is_some(). Matches my prediction of the mechanism exactly, just expressed as delegation to two other functions rather than inline logic.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The real logic (walk cost, signature comparison) lives in current() and slim(), not here — this function is just the boolean-returning glue, so understanding it fully requires those two functions.

### `stale`
- spec 3 · read at `04470122e2f9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:09Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Calls read_slim(repo) and, if present, returns its Scan field immediately without checking whether the repo has changed since — matching the doc's description of drawing "the last map without asking whether it is still true," to be shown while a fresh scan runs behind it.
- found: Reads the slim cache and returns its Scan unconditionally-of-repo-freshness, but does gate on the parser version matching PARSE_VERSION — the one thing the doc says is not skipped, since a stale-but-same-parser scan is fine to show immediately while a stale-parser one is not.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_slim`
- spec 3 · read at `0d449e171325` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads the pre-aggregated "slim" cache file for a repo (likely at a path derived from slim_path/tag), deserializes it into a Cached struct, and returns None if the file doesn't exist or fails to parse/deserialize. This is the fast-path load that avoids re-parsing/re-blaming/re-aggregating the whole tree, as described in the file doc.
- found: Resolves the slim cache path, marks it used (for a separate sweep/GC pass), reads the file bytes, bincode-decodes into a Cached struct, and returns it only if the embedded version matches the current VERSION constant (else None), covering missing file, decode failure, or version mismatch as None.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `slim_path`
- spec 3 · read at `ec5a956b05d6` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes the filesystem path to the cached "slim" tree file for a given repo, probably by deriving a key from the repo path (hash or normalized name) and joining it with a cache base directory; returns None if that base directory is unavailable.
- found: Delegates to path_for(repo) for the base cache path, then swaps the extension to "slim.bin" — simpler than a hash/key derivation, just reuses the existing path_for logic.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `tag`
- spec 3 · read at `681d44905eb1` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:13:18Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns a string tag combining PARSE_VERSION and VERSION (e.g. "p{PARSE_VERSION}v{VERSION}") used as part of the cache slot name so builds with different parser or cache-shape versions are stored in separate files rather than overwriting each other.
- found: Exactly as predicted: formats "p{PARSE_VERSION}v{VERSION}" as the cache slot tag.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: I had already read this exact function's body earlier in this session as part of the whole-file treecache.rs reveal (item 4), so this is a warm reading — I recognized rather than predicted it.

### `path_for`
- spec 3 · read at `2daac89febc3` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:31Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes the on-disk cache path for the full (non-slim) tree cache for this repo, likely combining a cache-root directory with a tag/hash derived from the repo path (similar to slim_path), returning None if the cache directory can't be determined.
- found: Delegates to the shared reports::cache_slot helper with category "trees", the repo path, and the current tag(), then forces a .bin extension on whatever slot path comes back.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `mix`
- spec 3 · read at `c6aa92602bb0` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:18Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: mix implements the standard FNV-1a fold-in step — for each byte in bytes, XOR it into *h then multiply by the FNV prime, mutating h in place.
- found: Standard FNV-1a byte-folding loop: for each byte, XOR into *h then wrapping-multiply by the FNV prime 0x100000001b3.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `signature` — QUIRKY — TRAP
- spec 3 · read at `117b4b8b4933` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes a u64 cache-key hash summarizing what a scan run depends on: the file list (paths + languages), fidelity level, and depth setting, combined via a hasher (e.g. FxHash/DefaultHasher). Used to detect whether a previously cached tree is still valid for this repo scan configuration, without re-deriving the tree. Likely does not hash file contents/mtimes directly since that's handled by scancache's content-keyed store.
- found: Builds a u64 hash from PARSE_VERSION, module VERSION, fidelity mode, depth tag, the repo HEAD commit (only when depth != Untraced, so untraced trees don't turn over on every commit), the raw bytes of .sanityignore (if present), and per-file path + size + mtime. This is the cache-invalidation key deciding whether a previously saved tree can be reused for a given scan configuration.
- predicted: some · documented: none · derivable: yes · legible: full · trap: yes
- note: The conditional git-HEAD mixing (only when traced) is load-bearing for ceph not thrashing a 36MB tree on every commit to an untraced repo — easy to 'simplify' away by always mixing HEAD, which would silently regress that.

### `head_of`
- spec 3 · read at `cf9e54b3cc4f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns the current git HEAD commit hash (as a string) for the given repo path, used as part of the cache key/signature so a saved tree is only reused when the repo is still at the same commit. It likely reads .git/HEAD and resolves symbolic refs itself rather than shelling out to git, falling back to something (like "unknown") if the repo has no commits or isn't a git repo.
- found: Shells out to `git -C repo rev-parse HEAD` and returns the trimmed stdout, or empty string if the command fails/repo has no git.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `load`
- spec 3 · read at `a619dc4c12f9` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:07Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Loads the previously-saved finished Scan tree for this repo from disk (via path_for or similar), checking that the stored signature matches the passed-in signature (which presumably encodes repo state/config) before returning it. Returns None if no cache file exists, it fails to deserialize, or the signature doesn't match — meaning the tree needs to be rebuilt from scancache ingredients instead.
- found: Reads a bincode-encoded Cached struct from path_for(repo), validates version+signature match, then separately tries to load a neighbour-links table (load_links) and attach it to the scan if present, treating its absence as non-fatal.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Uses bincode rather than serde_json (unlike history.rs's load_cache), and links are stored/loaded separately from the main scan under the same signature.

### `load_links`
- spec 3 · read at `25a921225e3f` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:16Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Computes the links file path via links_path(repo, signature), checks it exists, reads and deserializes the bytes into a links::Links struct, and returns None if the file is missing, unreadable, or fails to deserialize — a straightforward cache-read mirroring load but for the neighbour table instead of the tree.
- found: Reads the links cache file's bytes, decodes with bincode into a CachedLinks (version + signature + links), and returns the links only if both the format version and the signature match the caller's — otherwise None.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `links_path`
- spec 3 · read at `98c03064d7dc` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:28Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Computes the filesystem path where the cached links/neighbour table for a given repo is stored, likely built from a cache-directory root plus a hash or identifier derived from the repo path, appended with a fixed filename; returns None if the cache directory cannot be resolved.
- found: Delegates to path_for(repo) to get the base cache path, then swaps its extension for 'links.bin' to get the links cache file path; returns None if path_for fails to resolve one.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `save`
- spec 3 · read at `7d95bad24bbb` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-25T20:12:29Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Serializes the Scan (wrapped in a Cached struct with version and signature) via bincode and writes it to path_for(repo), probably via a temp-file-then-rename for atomicity, silently ignoring errors (no reporting) per the doc note. It likely also writes the links table separately to links_path using load_links's counterpart, and may write a "slim" version of the scan (via `slim`/`slim_path`) for cheaper partial reads, using `split`/`halves` to separate owned vs borrowed link data.
- found: Writes three separate files atomically (temp+rename each): the full scan, a "slim" scan (root.slim(), stats, empty links) written second but meant to be read first, and finally the links table in its own file (skipped if empty). Also calls prune_slots for cache sweeping before writing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The ordering comments explain a subtle safety invariant: slim is written after full but read before it, so a slim-without-full is cheap to detect (rescan) while the reverse would silently under-report.

### `the_borrowed_links_record_decodes_as_the_owned_one`
- spec 3 · read at `5740965ff842` · commit `758c706` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:04:23Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This test creates a default owned Links struct, encodes it with bincode into a buffer, then decodes it using the borrowed record type, checking that the decode consumes the entire buffer (asserting the returned consumed-length equals buffer length) and that the resulting borrowed struct equals a default borrowed instance — proving the two struct layouts encode/decode identically for the empty-table case.
- found: Builds a populated Links fixture, encodes it via the borrowed CachedLinksRef, decodes it back as the owned CachedLinks, and asserts version/signature round-trip, that decode consumed every byte (proving no field mismatch left a silent tail), and that the same number of functions came back.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `halves`
- spec 3 · read at `7f7bc6746322` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:34Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: An ignored benchmark test: reads REPO env var, loads/builds the cached tree for that repo, then measures and prints (via --nocapture) the size/time cost of reading just the "slim"/drawable half versus the full tree — showing how much cheaper it is to read only what the map needs to draw versus the whole cached structure.
- found: Benchmark reading REPO env var: times a fresh signature walk, then reading the cached "stale"/slim tree, then loading the full whole tree, and prints elapsed seconds plus node counts for slim vs whole so you can see how much cheaper the slim read is.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `split` — QUIRKY
- spec 3 · read at `50dc995f2631` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: An #[ignore]d benchmark test that reads a TREE env var pointing at a cached tree binary, loads it, times how long the "split" step (splitting the tree into halves, per the halves peer) takes, and prints that duration via --nocapture so a developer can measure that specific stage of a warm launch.
- found: Ignored benchmark reading TREE env cache file, timing the raw file read separately from the bincode decode ('split' refers to splitting the timing between those two phases, not the tree itself), then counts functions in the decoded tree and prints size/timings.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Name 'split' is about splitting read-time from decode-time measurement, not about the 'halves' tree-splitting function seen among peers — easy to conflate.

## src-tauri/src/watch.rs

### the file itself
- spec 2 · read at `3bc87fd9322e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:45Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Implements a lightweight polling "has the repo moved" probe rather than a real filesystem watcher — computes a cheap fingerprint (hash) of repo state (mtimes/sizes of tracked files, or git HEAD), records a stamp of that fingerprint at scan time, and probe compares current vs stamped fingerprint to tell the app the on-disk state has diverged from what was last scanned (an edit or a commit), while explicitly not counting the app's own .sanity/ assessment writes as a change.
- found: A stat-based (not notify/inotify) probe: probe() walks the repo with the scan's own ignore rules (excluding .sanity/) hashing each file's path+mtime+length into a tree fingerprint, plus a separate git fingerprint from .git/HEAD and .git/index metadata, combined into a Marks{tree,git} struct; comparing Marks across ticks tells the app the on-disk state diverged from the last scan (edit, new file, or commit) without a real filesystem watcher.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `hash`
- spec 2 · read at `ab046fa6235f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:42Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Standard FNV-1a: loops over bytes, XORing each byte into h then multiplying by the FNV prime (0x100000001b3), returning the accumulated h. Takes h as a parameter rather than starting from the fixed offset basis internally, so callers can fold multiple byte slices (e.g. several stat fields) into one running hash by chaining calls.
- found: Exactly FNV-1a as predicted: XOR byte then wrapping_mul by the FNV prime, per byte, returning accumulated h.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `stamp`
- spec 2 · read at `37e54f4bc220` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:54Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Combines an incoming hash `h` with data derived from the file's Metadata (likely modified time and/or file length) to produce a new combined hash/stamp value — used as a cheap fingerprint of observed filesystem state so repeated stat probes can detect that something changed without hashing file contents or using a filesystem watcher.
- found: Extracts modified-time as nanoseconds since epoch (defaulting to 0 on failure) and file length, chain-hashing both into the incoming hash h to produce a combined stamp — exactly as predicted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `probe` — QUIRKY
- spec 2 · read at `d105b40f71a7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:40Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Walks the repo's files the same way scan::collect_files does (excluding .sanity/), and for each file collects a cheap fingerprint — likely mtime and size, not content — combining them into some aggregate/hash plus maybe file count, returned as a Marks struct. This lets the caller cheaply detect later whether the repo has changed (via a stat probe) without doing a full content rescan or using a filesystem watcher.
- found: Walks the repo (excluding hidden dirs like .sanity, respecting gitignore) folding each file's path and stat metadata into a rolling hash (`tree`). Separately hashes the mtimes of .git/HEAD and .git/index into a second hash (`git`). Returns both as a Marks struct — one fingerprint for file-tree changes, one for commit/staging changes.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `an_edit_moves_the_marks_and_an_untouched_repo_does_not`
- spec 2 · read at `ed16a8152686` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:57Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that takes a stat-based stamp of a repo (via stamp/hash), edits a file (changing mtime/length), probes again and asserts the stamp/probe result differs (marks moved); then probes again without any further edit and asserts the stamp is unchanged (untouched repo yields the same stamp, so no false positive is reported).
- found: Test using a tempdir: probe() on an untouched repo returns equal results across two calls; editing an existing file changes probe().tree; adding a new file also changes probe().tree — confirming the stat-based probe detects both edits and additions but is stable when nothing changed.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `writing_the_assessment_is_not_a_change_to_the_repo`
- spec 2 · read at `f6a514b2c896` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:16Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up a temp repo, computes the watch stamp/hash baseline via probe, writes a .sanity/ assessment file as the app would after a reading, re-probes, and asserts the stamp/hash is unchanged — proving the stat-probe watcher ignores .sanity/ writes and won't fire on the app's own output.
- found: Test: writes a source file to a temp dir, takes a baseline probe() reading, then writes a .sanity/README.md into that dir (simulating the app's own assessment output) and asserts probe() is unchanged, proving the watcher ignores its own writes.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_commit_moves_the_marks_without_touching_a_file`
- spec 2 · read at `657fd2f8a7b0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:03Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A #[test] that sets up a git repo, takes a baseline stamp/probe reading, then makes a commit that doesn't touch any working-tree file (e.g. git commit --allow-empty or amends metadata), and asserts the probe's result (likely incorporating the current commit hash) differs afterward — proving the staleness detector notices commits, not just file writes.
- found: Builds a fake bare-minimum git repo (just a .git dir with a HEAD file) plus one source file, probes it, then edits only .git/HEAD (simulating what a commit/checkout does to repo state) and probes again — asserting the tree field is unchanged (no file touched) but the git field differs.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Expected a real `git commit`, but the test fakes it cheaply by just rewriting .git/HEAD; also didn't anticipate probe() returning a struct with separate .tree/.git fields.
