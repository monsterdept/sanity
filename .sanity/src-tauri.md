# src-tauri — sanity assessment

739 of 739 read · 118 surprising

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
- spec 3 · read at `4e06767cd642` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:52:08Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Implements sanity's whole agent-facing loopback API: AppState (the set of open projects, persistence/restore across launches, active/order/focus), a work queue that hands functions/files to an agent one at a time under leases (preventing re-serving, re-cutting when a file changes mid-lease, spreading picks across files), grading/report storage and aggregation into summaries/health, background model-run orchestration (start/stop/detach waves of assessment), and a small local HTTP router exposing sanity_next/sanity_reveal/sanity_report-style endpoints an agent process calls. Given the file's size, it's the most load-bearing file in the codebase — the actual product logic rather than the scan engine or UI.
- found: The monolithic agent-facing backend: AppState/Project (project set, leases, run state, restore/watch tracking), a task queue with staleness/priority-scored construction and leasing (Task/Grade/Report/Event), multi-reader run orchestration that spawns actual agent subprocesses and polls them, a background watch_tick for repo-change detection, and an axum/tokio HTTP router exposing ~10 endpoints (open/queue/reveal/report/status/summary/etc). Roughly 77% production code, 23% extensive integration-style tests. Comments are a large fraction of the raw size — long prose "incident report" style justifications for nearly every field/decision.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: Didn't anticipate the reader-subprocess spawning (actual agent processes launched and polled) or the scale of prose-comment-as-documentation throughout — the header doc explains motivation but nothing about the file's actual internal shape.

### `persist`
- spec 3 · read at `7667a15353d1` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Locks the in-memory project state, reads the project list currently on disk, merges the two maps so entries this session has not loaded/touched are preserved rather than dropped, and only entries actually present in memory overwrite their disk counterparts. Then serializes the merged result and writes it back to disk, presumably via a temp-file-then-rename for crash safety.
- found: Loads the on-disk index, builds "live" records from in-memory projects (carrying over harness/model settings from the existing disk entries since AppState doesn't track those), removes disk entries whose key matches a live project and appends the live ones (so untouched disk entries survive), conditionally overwrites `active`/`order` only when this session actually has values for them, sorts by touched-descending, and saves. Also has a test-only debug_assert enforcing persist only runs inside a guarded data_home() to avoid cross-test races.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: The harness/model carry-over and the conditional active/order merge are easy to miss — a naive rewrite of live entries would silently erase settings AppState never held in memory.

### `forget`
- spec 3 · read at `f08d4013e135` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:35Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Removes the project matching `key` from AppState's in-memory `projects` collection, and separately edits the on-disk index file directly (rather than calling `persist`, since that would skip unloaded entries) to remove the same row, so both the sidebar and the index drop the entry together. It does not touch the project's repo or its .sanity/ readings on disk.
- found: Removes the project from self.projects and clears self.active if it pointed at this key; loads the on-disk index, retains all but the matching entry, clears its active too, saves the index, then calls self.persist() last (order matters: persist merges live state over disk, so writing the index first is what prevents the entry being written back).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

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
- spec 3 · read at `ea2c8667213c` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:54Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Report::blank() constructs an empty/default Report — every field (id, position, predicted, documented, derivable, legible, trap, cold, note, model, found, etc.) set to its zero value (empty string, false, or a default enum variant) so parsers/tests can fill in fields one at a time without constructing the whole literal.
- found: Constructs a Report with every field set to its zero value; matches prediction closely, though I didn't anticipate the exact field set (asked/harness/when/spec/legible_dated/trap_dated/by/at) which extend beyond the report fields visible in sanity_report's own schema.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Field list is longer/more specific than the sanity_report tool schema alone would suggest (harness, spec, legible_dated/trap_dated, by/at provenance fields).

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
- spec 3 · read at `c752f0b40365` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:45:15Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the Node tree (files/functions), and for each node not already present in `done` (already assessed) or `leased` (currently checked out to another reader), builds a Task (function or file-level) and pushes it with some priority/weight float into `out`. It carries `file_doc` down from a file node to its child function nodes so a function's task can include the file's own header comment alongside the function's own docs, and recurses into children to cover the whole subtree.
- found: Recursively walks the node tree building (priority, Task) pairs. For functions: skips if a prior report exists and is neither stale (body changed) nor dated (a graded axis was superseded), skips if actively leased; otherwise computes priority from surprise score plus a stale/dated offset (stale > unread > dated) and emits a Task. For files: skips .sanityignore-excluded and empty files, otherwise queues a whole-file task (with every child as peers, not a window) when stale/unread/not-leased, using hot_share for priority. It then recurses into children carrying the file's own doc down, and does a second pass afterward to assign each emitted task its file-order peer window via a parallel `from` index array tracking which child produced which task.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: The docs field on this function is empty — everything about staleness/dated/priority ordering had to come from reading the body and comments, not from a header describing the function itself.

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
- spec 2 · read at `7fd06a5a552e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:21Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns the reader-facing instruction string (the protocol text a subagent receives), interpolating `n` into the template (e.g. "assessing EXACTLY {n} THINGS") via format!, using digits not spelled-out words as the docs note. Likely a simple format! call combining a static template with the numeric argument, no real branching logic.
- found: Returns a format! string that is exactly the reader protocol instructions (the text I'm operating under), with n interpolated in three places (assessment count, repeat count, position range).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Amusing self-referential find: this function generates the exact prompt I was given at the start of this session.

### `resolve_open`
- spec 2 · read at `6b0b5db53b39` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:00:57Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes an optional path string and checks it against known repo candidates (added via sanity init, sanity check, or the window's Add project). If asked matches one of those known paths, returns Ok(PathBuf). If asked is None or doesn't match any known candidate, refuses to pick and returns Err(serde_json::Value) with the candidate list for the agent to present to the human, since the doc says an agent must never choose the project itself.
- found: Resolves which repo path an /open should use. If a path is asked for, it's accepted only if it's already known (loaded in state or in the on-disk index) — otherwise returns an Err JSON with candidates and a hint. If no path is asked: 0 known projects errors, exactly 1 known project auto-resolves (not a guess since there's no ambiguity), 2+ known projects errors with the candidate list, refusing to guess which one.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs explain the overall philosophy (agent never picks) well but don't call out the single-known-project auto-resolve special case, which I initially predicted as always requiring a match.

### `open_project` — QUIRKY — TANGLED
- spec 3 · read at `6d72e5f06576` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:45:37Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: An axum HTTP handler (loopback API endpoint) that opens/resolves a project from the request (path or key, via resolve_open), scans or loads its cached tree, and computes summary statistics — function/file counts, stale/assessed/unread counts, work remaining — using helpers like count_funcs, count_files, count_stale, assessed, unread_lines, work_left, each_unit, offline_counts, and shape_of. It assembles a JSON response including these counts plus contextual notes (priming_note, contract_note, scan_note, reader_prompt) that orient an agent at the start of a reading session.
- found: Validates the request path (resolve_open, must be a dir and a git repo), registers a placeholder in `state.restoring` so the sidebar shows a scan-in-progress row immediately, then runs a full rescan (always, even if the project is already held, to catch external changes) via spawn_blocking with a persistent ScanCache, clearing the restoring placeholder on every exit path. It reloads/refreshes the `.sanity/` report index against the fresh scan, rebuilds the Project via `Project::rescan` (clearing leases since a rescan invalidates them and to avoid a reopen detaching the CLI's active run from the tracked handle), touches/focuses the project, and returns a large JSON blob: counts, excluded count, repo shape, contract/priming warnings, agent docs, a `.sanityignore` guidance string, scan timing, and the reader protocol/prompt text.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: Several inline comments document specific past bugs this function's current shape fixes (stale-project skip-scan bug, restoring-row-never-shown bug, dual-Project-construction detaching a running CLI scan) — worth reading before 'simplifying' any of the restoring/rescan/lease-clearing logic.

### `scan_note`
- spec 2 · read at `229afd11d13f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:42Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns None if ms is below some threshold (fast open needs no comment). Otherwise returns Some(message) explaining the wait, distinguishing a first-time full scan/parse/blame (reopened=false) from an incremental rescan of only changed files (reopened=true), so the caller understands the delay wasn't a fault.
- found: Returns None under a 5s threshold; otherwise a message explaining the scan took N seconds due to per-machine caching of parse/blame, noting retry restarts it rather than being a hang, with an extra clause when reopened=true.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `work_left` — QUIRKY
- spec 2 · read at `50ea69a7e68e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:57Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes remaining assessment work for a project — likely counting total functions/files (via count_funcs/count_files) versus how many are already assessed, and returning a WorkLeft struct with fields like remaining/total/done counts, possibly also factoring in stale entries via count_stale.
- found: Collects all unread tasks (functions/files with no report), then filters those to ones currently covered by an active, non-expired lease to compute in-flight count and a sorted (by age descending) list of outstanding leased ids; returns WorkLeft{remaining, in_flight, outstanding}.
- predicted: some · documented: none · derivable: no · legible: most · trap: no

### `each_unit`
- spec 2 · read at `d600b20192db` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:19Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the scan's node tree, tracking whether the current file/branch is excluded (via Node::excluded, set at the file level), and invokes the callback f on each node that represents a unit of work (function or file header) as long as it isn't under an excluded file — propagating exclusion down to children rather than checking each node in isolation, unlike a plain `visit`.
- found: Recursive inner `walk` that ORs exclusion down the tree (out_of_scope || node.excluded), calls f on Func/File nodes only when not excluded, then recurses into children with the propagated flag.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `count_stale`
- spec 2 · read at `c12c49939974` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:21Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the reports map and counts how many entries refer to a function/file whose current state in `scan` no longer matches what was recorded at report time (e.g. the code has since changed, been moved, or the entry no longer exists in scan) — i.e. how many prior readings are now out of date and would need to be re-surfaced to an agent.
- found: Walks every unit (function and file) in the scan via each_unit, and for each one that has a corresponding report, checks assessment::is_stale(report, node.body) — incrementing a counter for each stale one. A comment notes this must iterate both files and functions (not just functions) so the count matches what `assessed` subtracts from reports.len(), which covers every kind.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Got the core mechanism right; missed the specific staleness check being delegated to assessment::is_stale and the file-vs-function completeness detail called out in the comment.

### `assessed`
- spec 2 · read at `6a41aa605702` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:04:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the live scan (iterating every current function/file node in project), and for each one looks up whether a reading/report exists for it and is not stale, incrementing a running count. Returns that count as the number of "assessed" items — i.e., it iterates what exists now and looks up readings, rather than iterating stored reports and matching against the scan, so deleted/renamed functions' orphaned readings are never counted.
- found: Walks the live scan via each_unit, and for each node checks if a report exists in project.reports and is not stale (via assessment::is_stale comparing against node.body); increments and returns the count.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `offline_counts`
- spec 2 · read at `db7397486cf8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds an OfflineCounts struct by walking scan and cross-referencing against reports to tally totals: function/file counts, how many are already assessed, how many are stale, and unread lines — a locally-computable progress summary (assessed vs remaining) that doesn't require calling the agent.
- found: Builds OfflineCounts: functions/excluded from count_funcs, files from count_files, assessed by counting reports whose report is not stale (via is_stale against the node's current body), remaining from the length of an unread-tasks list built by collect_tasks, and stale from count_stale.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

### `unread_lines`
- spec 3 · read at `884bc1516061` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:30Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Walks the project's node tree, and for each function-kind node (skipping file/dir nodes) checks whether it has a current, non-stale report in the project's done/reports map; if not (unread or stale), adds that function's loc to a running total, which it returns.
- found: Recursively walks the scan tree, propagating an `excluded`/out-of-scope flag down to children, and for each in-scope function node without a current (non-stale) report, adds its loc to a running total; returns the sum.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the excluded-subtree propagation (out_of_scope flag inherited by children) which isn't hinted at by the doc.

### `count_funcs`
- spec 2 · read at `7b3363869ffa` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:53:38Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Mirrors count_files but at the declaration level: recursively walks the scan tree tracking whether the current subtree is excluded (out_of_scope via node.excluded), and for each declaration/function node increments a "kept" or "dropped" counter accordingly, returning (kept, dropped) as the in-scope vs .sanityignore-excluded function counts.
- found: Same walk-and-partition shape as count_files but keyed on Func nodes instead of File nodes: recurses the scan tree, and for each function node increments "kept" or "dropped" depending on whether it or an ancestor is .sanityignore-excluded, returning (kept, dropped).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Predicted correctly this time because the immediately preceding task (count_files) revealed the same walk pattern.

### `count_files` — QUIRKY
- spec 2 · read at `0bf1cef3d458` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:53:06Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Mirrors count_funcs but at file granularity: iterates the scan's files, excludes any with no declarations (nothing to grade), and returns a (assessed, total) tuple counting how many eligible files have been read/reported versus how many exist in total — used to compute a coverage fraction that includes file-level tasks alongside function-level ones, not just functions.
- found: Recursively walks the scan tree, and for each file node with at least one declaration, increments a "kept" counter or a "dropped" counter depending on whether it (or an ancestor) is excluded by .sanityignore, returning (kept, dropped) — not an assessed/total coverage pair as I guessed.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I predicted an assessed-vs-total coverage tuple; it's actually kept-vs-excluded-by-ignore-rules, a different axis entirely.

### `shape_of`
- spec 2 · read at `453b5df49bf7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:39Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Groups the scan's functions/files by top-level directory and counts how many functions (and/or files) fall under each, returning a Vec<serde_json::Value> of per-directory summary objects like {dir, funcs} sorted by count descending — giving an agent hard numbers to justify proposing .sanityignore entries, without ever naming individual functions.
- found: Walks the scan tree recursively, bucketing function counts by top-level directory into (kept, excluded) pairs depending on whether the node or an ancestor is marked excluded, sorts directories by total count descending, takes the top 15, and returns them as {dir, functions, excluded} JSON objects.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the kept/excluded split and the top-15 truncation, both meaningful details.

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
- spec 2 · read at `c557041e903a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:23Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Scans the project's tracked files, detects which have changed on disk since they were last cut (probably via mtime or content hash comparison), and calls resync_file on each changed one to re-cut its function ranges — returning the count of files it resynced.
- found: Visits every file node in the scan tree, computes a current mark (mtime+size probably) via mark_of, compares/updates it against project.file_marks to find which files changed, re-cuts each changed file via resync_file, re-aggregates roll-ups, and returns the count of files that moved.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `spread_across_files` — QUIRKY
- spec 2 · read at `60f93358437e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:48:25Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Takes the score-ranked tasks, and for each candidate applies a penalty to its score based on how recently its file appears in `recent` (using `now`), effectively demoting warm files rather than excluding them. It then re-sorts by the adjusted score and returns the top n tasks — so an untouched file's function usually wins, but if all remaining candidates are in recently-touched files, the best-scored one is still returned rather than leaving the queue empty.
- found: Partitions tasks into "fresh" (file not in `recent`, or last touched more than FILE_REST ago) versus "resting" (recently touched), uses fresh if any exist else falls back to resting, then delegates to interleave_by_file(_, n) to do the actual per-file spreading and top-n selection.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Expected a continuous recency-based score penalty; actual mechanism is a hard threshold partition (FILE_REST) with binary fresh/resting fallback, delegating the real interleaving to a separate helper.

### `queue`
- spec 2 · read at `93093fdc47ba` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:32Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is the axum handler backing the "give me the next task(s)" endpoint. It reads the QueueParams (likely a count `n`), locks the shared state, and selects that many not-yet-assessed functions/files spread across files (using spread_across_files/interleave_by_file helpers) rather than reading one file top-to-bottom, marks them as claimed/in-flight, and returns them as JSON Vec<Task>.
- found: Axum handler: resolves the project from query, resyncs any line ranges that moved since last scan, collects candidate tasks, spreads N of them across files (avoiding recently-touched files), leases them and logs a note per handed-out task, then pings a done/next-batch event and returns the batch as JSON.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

### `default_batch`
- spec 2 · read at `be58df657f50` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a hardcoded constant usize (likely 10, matching the "ten functions" batch size referenced elsewhere in the docs) representing the default number of functions handed to a reader per batch, exposed for external callers that need to estimate pricing/cost.
- found: Returns the module-level BATCH constant rather than an inline literal; I predicted a constant value correctly but didn't know it was named/shared as BATCH elsewhere.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `reading_curve`
- spec 2 · read at `2c2bd3620c6c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reconstructs the same ordering `queue` would produce right now (stale entries first, then unread, round-robined by file, ignoring leases and recent_files), looks up each entry's line count, and returns a running cumulative sum sampled every BATCH entries — so index i is the total lines handed out after the reader has taken (i+1)*BATCH items.
- found: Rebuilds the current task ordering via collect_tasks + spread_across_files (ignoring leases/recent_files), then walks it accumulating a running sum of line counts, pushing the cumulative total into the output vector at every BATCH boundary and at the final tail element so a partial-length run still gets an endpoint.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `check` — QUIRKY
- spec 2 · read at `093c37e54faa` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads project/harness/model/batch settings from CheckRequest, spawns the wave-orchestration loop (calling something like run_wave or start_run) as a detached background task via tokio::spawn, and immediately returns a JSON acknowledgment without awaiting the run's completion.
- found: It's a one-line Axum handler that just delegates entirely to start_run(&state, req) and wraps the result in Json — no validation logic of its own.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The docs handed to me for this task actually describe run_wave (a different function), not check — mismatched docs, so I graded documented as none.

### `start_run`
- spec 2 · read at `908487db9d60` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a CheckRequest and the shared app state, validates/normalizes the request against current project state, creates a new run record with a fresh id and initial queue of items (files/functions to assess) derived from the project, stores it in Shared, and returns a JSON value with the run id and initial status — without blocking for the run to complete. It's the non-HTTP-callable version of `check`, so no serialization/HTTP-specific work.
- found: Validates the project/harness/model/backend endpoint, refuses if a run is already active (checking both `ended` and live reader count to avoid a race), builds a Run record with atomic stop/live handles, and spawns the wave as a detached async task (via a custom `detached` helper rather than raw tokio::spawn, since this must also work synchronously from a Tauri command with no runtime). Returns a JSON status immediately without waiting for the run to finish.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: Extensive inline comments explain prior bugs this code fixes (the ended/live race, the model fallback mismatch, the tokio::spawn panic from Tauri commands) — much of the value is in that history, not derivable from the code shape alone.

### `stop`
- spec 2 · read at `67720eec2400` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:17Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up the run/project from StatusParams, marks it stopped/cancelled in shared state (clearing its queue), and forcibly kills any live child reader processes tracked for that run (e.g. via a stored child handle), then returns a simple JSON acknowledgment like {"ok": true}.
- found: Looks up the project via for_client, and if it has an active (unended) run, sets an atomic `stop` flag on that run to true. Returns JSON {ok, stopped} — it does not itself kill any process, just signals; the actual killing (per the doc, described elsewhere) must happen wherever that flag is polled/checked.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says 'kill the readers it has out' but the code just flips an atomic flag — the actual kill must live in whatever polls run.stop, not in this function.

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
- spec 2 · read at `f09def59c347` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:11Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a new Project from the fresh scan/reports/repo/name. When prev is Some, it copies over volatile state that isn't derived from the scan itself — predictions recorded by sanity_reveal, active leases, and the in-progress run — keyed by node id, since those ids remain stable across a rescan even when code moves. When prev is None it just default-initializes those fields empty.
- found: Constructs a new Project from a fresh scan, recomputing file_marks/marks from disk, but carrying over prev's volatile state (leased, recent_files, predictions, run, events, touched, last_agent) when prev is Some, plus incrementing a `scanned` counter (rather than a boolean) so the frontend detects each rescan as a change.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The scanned-counter-not-boolean detail (with its own comment) was a nice touch I hadn't predicted.

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

### `reveal`
- spec 3 · read at `06169cda9b04` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Async axum handler: looks up the lease/task for req's id in shared state, erroring if no live lease is held (task already handed to someone else or expired). It re-cuts the task's line range against the current file via resync_changed to account for the file having moved since the scan, records the caller's `expected` prediction on the task, then reads the actual file bytes for that line range (or whole file if it's a file task) and returns it as JSON alongside path/line/end_line metadata.
- found: Resolves the id to a project via the shared owner shim, checks the lease is held and unexpired, resyncs the scan's line ranges against the current file, walks the scan tree to find the node's path/line/end_line/whether it's a file task, reads the file and slices the 1-based inclusive line range (or whole text for file tasks), records the caller's prediction only if none exists yet (so re-reveals don't let you revise after seeing the answer), and returns it all as JSON.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the owner_of routing step and the several distinct error/hint messages for stale ids, expired leases, and unreadable files — those are the bulk of the function by line count.

### `trap_without_note`
- spec 3 · read at `a445b5c3d632` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:50:32Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: One-line function: returns r.trap && r.note.trim().is_empty() — true when trap is flagged but the note is empty or whitespace-only.
- found: Exactly r.trap && r.note.trim().is_empty(), as predicted (and as already inferred from the prior test's behavior).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Already saw this function's behavior fully specified via the preceding test, so this reading was effectively warm despite not having opened this exact file/line before.

### `mangled` — QUIRKY
- spec 3 · read at `a6c7b510cf76` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:16Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Validates a submitted Report for internal inconsistency, returning Some(reason) describing what's wrong (e.g. trap=true without a note, or documented=none but derivable=true) or None if the report looks self-consistent. Used server-side to catch reports that violate the tool's own stated invariants (like "trap requires note").
- found: Detects a malformed/suspicious Report: if predicted/documented/legible grades are all present, it's fine. Otherwise it checks the free-text fields (expected, found, note) for signs of tool-call/XML leakage (closing parameter tags or a closing tag matching the field name) and returns which field looks mangled/injected.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `report` — TANGLED
- spec 3 · read at `886538cbaadf` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Validates the incoming ReportRequest — checks the id matches a pending reveal, detects a "mangled" emission (fields swallowed into a long prose field) and rejects with a hint, enforces that trap:true requires a note — then persists the report, updates tallies/aggregates, and returns a JSON status object (ok/error/hint/in_flight/remaining/saved/repo_assessed/etc) matching the shape seen from every sanity_report call this session.
- found: Validates the report (mangled-field detection, trap-without-note rejection, project/id routing), then re-derives provenance server-side rather than trusting the caller: overwrites body/name/path from the live scan, restores the originally-promised prediction if one was stored, stamps spec/legible_dated/trap_dated/by/at/asked/harness/when/agent_docs itself, inserts into the reports map, writes through to disk, computes repo-wide surprise-rate stats for a coaching hint, and returns a status JSON naming which project/repo it actually landed in.
- predicted: most · documented: none · derivable: yes · legible: some · trap: no
- note: Almost every field on the incoming Report is discarded/overwritten server-side except the reader's actual grades — worth knowing before assuming a field like `expected` or `at` round-trips as sent.

### `status`
- spec 2 · read at `ff8aa7b8c185` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:06Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Given a project key in `p`, looks up that specific project's state (not the globally "active" one — the doc says that was the bug it fixed) and builds a JSON status blob: counts of assessed vs total functions, queue length, current/suggested model, harness info, and repo path — using helpers like aggregate, GradeCounts, Tally, assessed_now to compute the numbers.
- found: Resolves the project from the query key (not a global "active" pointer, per the doc's postmortem), then returns a large JSON status object: function/file/assessed counts, remaining/in_flight/outstanding leases, stale count, suggested model/harness, the current run's live progress fields, and a human-readable next_step string telling a driving agent what to do next. Falls back to an `open: false` response with a hint distinguishing "transient, still loading" from "nothing open" when the project isn't found.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The docstring is really about one historical bug (status reading the wrong project) rather than describing the endpoint's full shape, which is much larger than that.

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
- spec 2 · read at `4bdbbd9baefc` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks every item in `scan`, looks up its `Report` in `reports` by id, and folds matches into `Tally`/`GradeCounts` accumulators tracking predicted/documented/legible grades and trap counts, returning an `Aggregate` that summarizes coverage and grade distribution across the whole scan (mirrored by `offline_counts` for callers without a `Project`).
- found: Iterates every func node via each_unit (respecting .sanityignore), skips nodes without a report or with a stale report (counting staleness separately), and folds the rest into agg.total, a per-model bucket (blank model -> "unattributed"), a three-way priming bucket (not_applicable/exposed/clean based on whether agent_docs existed and r.primed), and a by_position bucket keyed on r.position.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `summary`
- spec 3 · read at `05f8a8d8370a` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:05Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: An axum handler that, given SummaryParams (probably identifying a project), loads that project's reports, excludes stale ones (counting them separately), and aggregates the rest into repo-wide grade tallies (predicted/documented/legible distributions, counts) using GradeCounts::add/Tally::add/aggregate helpers. Returns a JSON object of pure totals and percentages with no per-file or per-function breakdown, since the orchestrator calling this endpoint is deliberately kept blind to anything that would let it reconstruct .sanity/'s per-item findings.
- found: Axum handler that resolves the target project (returning an "open: false" hint if none), then computes function/file counts, exclusions, assessed/stale counts, remaining work, and an aggregate (total, by_model, by_position, priming) grade breakdown, returning it all as JSON with a lengthy embedded `note` explaining how to interpret by_position as a learning curve and priming as invalidating predicted-rate claims — deliberately naming no specific function or file.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: A comment flags a past bug where this endpoint and /status computed 'assessed' from different definitions (agg.total.readings counts functions only vs. a broader count) and disagreed by 63 — worth checking both stay aligned if either is touched.

### `from_state` — QUIRKY
- spec 3 · read at `cb1a40ae0424` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:15Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a ProjectList DTO for the agent-facing API by merging the live AppState.projects map (currently loaded/scanning projects) with the on-disk project index (for projects not yet loaded this session), producing a combined, deduplicated list. Likely attaches per-project status info such as which is active, whether it's currently scanning, and perhaps summary/health stats, given the function's substantial length.
- found: Builds ProjectList by mapping state.projects into rich ProjectSummary entries (functions/files counts, staleness, harness/model info, run status, working/reading/replayed/commits, etc.), then appends placeholder loading=true summaries for projects still in state.restoring that haven't landed yet (zeroed counts, progress from restoring_progress), then sorts by the user's saved order (falling back to most-recently-touched for unordered entries), and wraps with the active project key.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: Loads the on-disk index once up front (not per-project) specifically because this function is polled every second — a per-row load would multiply file opens.

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
- spec 2 · read at `db1fdcda6f07` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:01Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns an axum Router, registering routes (e.g. /status, /health, /task, /report, /next, /reveal) to their handler functions, attaching the Shared app state via with_state, and possibly adding middleware like tracing or CORS layers.
- found: Builds the axum Router wiring the loopback API's endpoints (health, retire, open, queue, reveal, check, stop, report, status, summary) to their handlers and attaches the Shared state — no middleware/layers.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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

### `drain`
- spec 3 · read at `4a47c6cce6cd` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loops while popping projects off `queue`: for each, runs the scan (using per-repo caches), calls `on_shape` with the resulting ShapeFile list, and `on_tick` with progress updates as it goes, likely locking `state` to update per-project progress. After finishing a project, it checks the shared `wanted` queue via something like `claim_next` to see if the other lane needs it to steal/serve more work, pulling additional projects to scan if so. Returns some indication of which project ended up "active" (matching against the passed-in `active` key) so the caller can decide where the window lands, but the actual decision of the final active project happens in the caller as the docs say.
- found: Pops the next wanted project via claim_next, skips it if its dir is gone, shows a stale cached tree shape immediately then runs the real scan, and on success builds a full Project and inserts it into state, setting `active` if this is the key the caller cared about; on any failure it just removes the project from the restoring/progress tracking and moves on.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The doc comments (claim_next ordering, stale-cache-first, settled-on-failure, lock scoping for note_size) carry real non-obvious rationale that isn't derivable from the code shape alone — they're load-bearing, not decorative.

### `claim_next`
- spec 3 · read at `b95946e3ccb5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:34Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks for the project named in `wanted` inside `queue`; if found, clears `wanted` to None (consuming it, since this lane can serve it) and returns that project's index. If `wanted` is None or the named project isn't in this lane's queue, leaves `wanted` untouched and returns index 0, defaulting to the front of the running-order queue.
- found: Finds the position of the project named by `wanted` in `queue`; if present, clears `wanted` (consumes it) and returns that index; otherwise leaves `wanted` alone and returns 0 (head of the running order).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `restore`
- spec 3 · read at `24cd420e854f` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:28Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: On startup/reconnect, this reloads persisted state (list of known projects, in-flight tasks, queue order) back into the shared `state`, then kicks off re-scans for each known project so their shape/scores are fresh again — calling `on_shape`/`on_tick` callbacks as each project's scan progresses. It likely respects some priority so a project the user explicitly asked to look at scans before others ("scanned next"), and spawns each big-repo scan on its own thread/lane so one huge repo doesn't block the others.
- found: Loads the persisted project index, publishes it to state immediately so the sidebar isn't empty, then spawns a background thread that reorders projects (most-recently-touched-first, active project pinned first) and partitions them into two concurrent lanes — big repos and small — so small-repo scans aren't stuck behind one huge repo's scan (the bottleneck being concurrent git-blame subprocesses competing for disk, not CPU). After both lanes drain, it fixes up the active project if it vanished and persists the final state once.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: The two-lane disk-contention rationale (not CPU-bound) and the ordering-vs-restoring subtleties are only explained in the inline comments, not derivable from signature/peers alone.

### `watch_tick`
- spec 3 · read at `743701f2d5ed` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:40:57Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A periodic background tick that checks each tracked project for filesystem changes (via a watcher/debounce mechanism) and, for any project with no active leases, triggers a rescan to re-mint node ids; if a project still has leases outstanding, it skips rescanning that project and lets the leases expire naturally within LEASE instead of forcing a stale read. It likely prioritizes a project a user explicitly requested over background/big-repo scans, matching peer names like "the project somebody asked for is scanned next" and "a big repo scans in its own lane".
- found: Filters to projects with no active leases, probes each for fs changes via watch::probe, and if changed spawns a blocking rescan (scan::scan) with reports/marks reloaded fresh. Re-checks the lease condition again under the lock after the scan completes before committing the new scan/reports/marks/probe-marks into state, incrementing a scanned counter; a failed scan (e.g. deleted repo) is silently skipped, leaving marks untouched so it retries next tick.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The doc comment at the top of the file explains the leasing design well, but the double lease-check (before AND after the async scan) and the "marks stamped from after the scan, not before" detail aren't mentioned anywhere near the function itself.

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

### `project_of` — OBSCURE
- spec 3 · read at `ab9d3bd2950b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:07Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a Project value from a directory path: canonicalizes/absolutizes the path and derives a display name from its last path component, likely erroring or falling back if canonicalization fails (e.g. path doesn't exist).
- found: A test-fixture helper: runs a full ephemeral scan of `dir` with the heuristic model, computes file marks and watch probe state, and builds a fully-populated Project struct (empty reports/leases/predictions, scanned=1) for use in tests, given the peer list of test function names.
- predicted: none · documented: none · derivable: no · legible: full · trap: no
- note: I guessed this was a lightweight path→Project-identity helper (name/canonicalize); it's actually a heavyweight test fixture that runs an entire real scan — the name gives no hint it's test-only or that it's this expensive.

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
- spec 2 · read at `df278033b628` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:14Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Sets up a project/repo, edits a tracked file BEFORE the first call that would populate file_marks (before any resync_changed or handout), then triggers a scan/handout and asserts the returned line range for a function reflects the post-edit content — proving the first-sighting bug (where insert(..).is_some_and(...) returned None on first sighting and silently recorded no movement) is fixed by stamping marks at scan time instead of lazily on first resync.
- found: Writes a file, builds a project, edits the file again before any resync_changed call, then calls resync_changed and asserts it reports 1 changed file, then walks the tree to confirm the `second` function's line moved to its new post-edit position (5) — validating marks are stamped at scan time rather than lazily on first resync.
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
- spec 3 · read at `8ad670297d4a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a list of (project name, optional count) pairs and maps each into a KnownProject struct, setting the name and that numeric field (likely queued/remaining item count) while leaving other fields at default/placeholder values.
- found: Maps each (key, files) pair into a KnownProject with key/repo/name all set to the key string, touched=0, files carried through, and harness/model left None — a helper likely used in tests to construct known-project fixtures.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_project_added_but_not_yet_scanned_is_in_the_index` — QUIRKY
- spec 3 · read at `d548cff5aa96` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Test that adds a project but does not let its scan complete (so `touch` never ran), then checks/persists the project index and asserts the project is still listed there rather than being dropped — verifying the fix where a quit before first scan completion used to lose the project entirely.
- found: Test calls remember() to add a project and checks it appears in the on-disk index immediately (before any scan). It then also verifies that re-adding (remember called again, as happens on every add) does not duplicate the project or reset configured harness/model set via set_reader.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The doc explained the historical bug (quit-before-scan lost the project) but the test body's second half, about remember() being idempotent and preserving reader config, wasn't hinted at by the docs.

### `a_save_mid_restore_does_not_erase_projects_it_has_not_loaded`
- spec 3 · read at `8c6a421d5df8` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:59Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Regression test: seeds a project index with multiple entries on disk, simulates a `restore` that hasn't finished loading them all into the live in-memory map, then triggers something like `sanity_open` (which inserts/touches one project) and a persist/save — and asserts the saved index on disk still contains all the original projects, not just the touched one.
- found: Saves an index with two projects (/a, /b) directly to disk. Then simulates a session that has only loaded /b into its live AppState (touched bumped to 9), sets it active, and calls state.persist(). Asserts the reloaded index still has both /a and /b (not erased, not duplicated), that /b's touched value was updated in place, and that active reflects this session's choice.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

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
- spec 2 · read at `c63aa4eb4d25` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:09Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: This test checks that outstanding() (the itemized list backing in_flight) excludes leases whose reading has already landed — a stale lease left over after its report was submitted should not still show up as outstanding work. It takes a lease on a function, submits a report for it (without explicitly releasing/standing-down the lease), then calls outstanding() and asserts that function is no longer listed, proving the count is derived from actual unread work rather than the raw lease table.
- found: Builds a fixture with two functions, checks work_left() reports zero in_flight/outstanding with no leases; takes a lease on one function and checks it's itemized with in_flight=1 and remaining=3 (lease isn't a reading); then inserts a report for that same id (simulating the reading landing while the stale lease remains) and asserts in_flight drops to 0, outstanding is empty, and remaining drops to 2 — proving coverage counts come from reports, not the lease table.
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

### `an_excluded_file_leaves_the_queue_and_stays_in_the_count`
- spec 2 · read at `f0387645fe87` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:08Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Creates a project with a .sanityignore that excludes a specific file, scans it, and asserts that the excluded file's functions are never handed out by the queue/next-call, while the total count used for completeness/progress still includes that file rather than silently shrinking the denominator.
- found: Sets up a dir with a top-level fn and a tests/ dir with two fns; verifies with no .sanityignore all 3 are in-scope (0 excluded); after adding .sanityignore excluding tests/, verifies counts become (1 in-scope, 2 excluded), the task queue only yields the one non-excluded function, and the shape data for the tests/ dir reports excluded=2, functions=0 — so exclusion narrows the queue but both in-scope and excluded counts remain visible.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_reading_for_a_deleted_function_is_not_coverage`
- spec 2 · read at `cf9d26a07bd4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:26Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test that records a reading/report for a function, then removes that function from the repo (so a fresh scan no longer walks past it), and asserts the summary's "assessed" count does not include that stale reading — reproducing the bug where deleted-function readings stayed counted forever because count_stale only walks the current scan and never encounters them.
- found: Writes a two-function file, scans it, inserts reports for both functions (assessed==2), then rewrites the file with one function deleted and rescans, and asserts assessed==1 — the orphaned reading for the deleted function no longer counts toward coverage.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `deleting_a_twin_expires_the_survivors_reading_rather_than_moving_it`
- spec 2 · read at `4e1be19ce4a0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:38Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that writes two same-named functions with distinct bodies, records a reading for the second one (ordinal 1), then deletes the first so the survivor's fresh ordinal becomes 0 — the deleted one's old slot — and rescans. It asserts the reading is expired (not silently treated as still valid / moved onto the survivor) because it's checked against the survivor's actual body text, which doesn't match; expired work goes back into the queue rather than being trusted.
- found: Writes two same-named 'go' functions with different bodies, records readings for both, deletes the first (survivor slides to ordinal 0), rescans via resync_changed, and asserts the one remaining function's inherited reading is flagged stale by is_stale — since it describes the deleted twin's body text, not the survivor's, so it's expired rather than silently kept.
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
- spec 2 · read at `d15dc8555edf` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:15Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test function: sets up two different projects/repos (one likely "active" in the app window, one not), calls a `status` command/handler passing the caller's repo path, and asserts the returned status data corresponds to the caller's repo rather than whichever project is currently focused/active in the app window.
- found: A test verifying that the `status` handler, called with an explicit project key, returns data for that project regardless of which project is currently "active"/focused in the app window; and that with no key given, it falls back to the most-recently-opened (touched) project rather than the active/window one. Confirms both project name and repo path in the JSON output.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `lease_kind`
- spec 2 · read at `ffaf4f3556c5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:35Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test helper that repeatedly requests/pops tasks from the shared queue for the given project key, discarding (but leasing, so they're not handed out again) any task that doesn't match the wanted kind (file vs function, per want_file), until it finds and returns one that does match. This avoids tests being order-dependent on which kind of task the queue happens to serve first.
- found: A test-fixture helper that calls the real `queue` endpoint in a loop (up to 16 times), requesting one task at a time for a given project key, and returns the first task whose `file` flag matches `want_file`. Panics with a descriptive message if it never finds a matching one within the retry budget.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The bounded retry (16 attempts) and panic-with-message on exhaustion were details I didn't predict, though the core mechanism matched.

### `reveal_serves_the_functions_own_lines_and_no_more`
- spec 2 · read at `644a1a49aafe` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:09Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up a project/task for a function with known line..end_line bounds inside a larger file, calls the reveal endpoint/handler, and asserts the returned source text corresponds exactly to that bounded slice of the file rather than the whole file's contents.
- found: Integration test: writes a file with two functions ("one" printing "1", "two" printing "SECRET") to a temp project, leases a task, calls the real reveal endpoint, and asserts the returned source contains the leased function's name but not the sibling function's distinguishing content — proving reveal doesn't leak unread-ahead sibling bodies.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_second_reveal_cannot_revise_the_prediction`
- spec 2 · read at `f047d92005d4` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:25Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Sets up a project and gets a task via next, calls reveal with one prediction string, then calls reveal again on the same id with a different prediction string; asserts both calls return the same source text, and that the stored/first prediction is the one retained (e.g. checked via the eventual report or internal state), not overwritten by the second call's prediction.
- found: Calls reveal twice with different `expected` predictions for the same task id, confirms identical source returned both times, then submits a report whose `expected` field tries to claim the second (revised) prediction, and asserts the stored prediction is still the first one written — the store is not overwritten by what report sends.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `reveal_without_a_lease_is_refused`
- spec 2 · read at `e61db649d48d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:46Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Sets up a project/backend state, then calls the reveal handler with a function id that was never issued via `next` (so it holds no active lease), and asserts the call is refused with an error rather than returning source — verifying reveal checks the caller actually has an outstanding lease on that id before serving its body.
- found: Builds a fixture project with one function, pulls its real id directly from the scan tree (bypassing the lease queue), calls reveal() with that id, and asserts ok=false, source=null, and — beyond just refusing — that no prediction was recorded in state for that id either.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_file_task_is_revealed_whole`
- spec 2 · read at `aba269648c94` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:46Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This test sets up a project/fixture with a file that has trailing content after its last declaration (so end_line is less than the file's total line count), queues or takes a file-kind task, calls reveal on it, and asserts the returned source is the entire file content rather than truncated to end_line — proving file tasks bypass the normal line-slicing that function tasks get.
- found: Writes a fixture file with a doc-comment header and a trailing comment after the last function, loads it as a project, forces a file-kind task via lease_kind(..., true), calls reveal, and asserts the JSON response has whole_file=true and that the returned source string contains both the header and the trailing comment — proving it wasn't sliced to the last declaration's end_line.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_pathless_open_answers_from_what_a_human_added`
- spec 3 · read at `20d2891a1494` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:29Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test exercising all three cases described in the doc: with exactly one repo added by the human, calling open with no path resolves to it automatically; with two or more added repos, the pathless open is refused as ambiguous; with zero repos added, it's also refused. It likely adds/removes repos between assertions to walk through these states in one test body.
- found: Tests resolve_open with no path: zero known projects errors with a hint containing 'add'; one known project resolves to it directly; adding a second project makes it error again, listing both project paths in the error payload rather than picking one.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_path_the_human_never_added_is_refused`
- spec 3 · read at `7931a43f88a2` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:33Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A unit test: sets up the agent-facing loopback API state with no projects added (or a different project added), then calls the "open"/"next" style function passing an explicit repo path that was never registered by the human via the UI, and asserts the call is refused (returns an error/None) rather than silently scanning that path.
- found: Test seeds the known-projects index with one added project ("/added"), confirms resolve_open succeeds for that path, then confirms resolve_open for an unadded path ("/somewhere-else") errors with ok:false and an error message naming the rejected path.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 3 · read at `8f3e06228a14` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:59Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Implements the entire .sanity/ persistence layer — storing per-function/per-file readings (grades, predictions, docs) as human-readable Markdown files sharded by top-level directory, with an embedded JSON block as authoritative parse target. Computes content/doc hashes to detect staleness relative to current code, handles staleness/expiry rules per axis, maintains a compiled index for fast lookups, does git plumbing for commit/author metadata, has custom date arithmetic rather than a date crate dependency, and includes a large inline test suite validating round-tripping, staleness rules, and shard integrity.
- found: Persistence/rendering layer for .sanity/ assessments: parses/writes readings as Markdown shards keyed by top-level directory, matches readings to live code via a path#name(#ordinal) key scheme, detects staleness via content/doc hashing (body_hash with a deliberately distinct FNV-1a variant), maintains a spec-versioning system where legible/documented/trap axes can independently expire when the grading question changes, compiles a queryable index, does minimal git shell-outs for provenance (commit hash, author), hand-rolls civil-date arithmetic to avoid a dependency, and ships a large inline test suite validating round-tripping and staleness edge cases. The save routine only deletes shard files it previously linked from the index (not any .md file present) to avoid destroying human-authored notes.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: The module header explains the Markdown-as-store and sharding design well but says nothing about the spec-versioning/per-axis expiry system or the same-named-function ordinal disambiguation, both of which carry their own rich but header-absent doc comments citing real corpus incident data.

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

### `dated_axis`
- spec 3 · read at `df1820f94877` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:19Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A short boolean check, called from legible_current/trap_current-style helpers, that says whether a report's answer predates the current spec version for the axis being asked about — but only if the report actually holds an answer at all (e.g. `legible.is_some()`), since an ungraded reading isn't "dated," it's just missing. It likely compares a stored spec/version number on the report against a current constant.
- found: Returns true if either: the report has a legible grade but it predates the current legible spec version, OR the report's trap flag is true but predates the current trap spec version — combining both axis checks with OR rather than being single-axis as the name might suggest.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Despite being named "dated_axis" (singular), it actually ORs together dated-ness for two separate axes (legible and trap) in one call.

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
- spec 2 · read at `237c7181076a` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:01Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Scans the markdown text line by line, looking for a heading/marker that starts a new entry (giving the path#name key) followed by bullet lines like "- expected: ...", "- found: ...", "- documented: ..." etc that populate a Report struct. Accumulates fields for the current entry and inserts into out when it moves to the next entry or hits EOF, silently skipping unrecognized lines and dropping incomplete entries lacking expected/found.
- found: Line-by-line markdown parser using `## ` as a file heading and `### ` as an entry heading (with an optional " #N" ordinal suffix and " — verdict" decoration stripped), building the path#name key via key_of/file_key. Body lines starting with "- " are bullets; expected/found/note are direct fields, while a fourth bullet holds many `·`-separated segments (spec, read at, commit, read by, asked for, via, when, by, cold/warm reading, priming, reading N, predicted/documented/derivable/legible/trap) each parsed by prefix-matching rather than position. Entries are flushed into `out` on the next heading or EOF, kept only if expected or found is non-empty.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `live_funcs`
- spec 2 · read at `3d7a51c31a86` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:06Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Walks every file and function in scan, computes each function's durable key via key_of, and assigns it an ordinal based on its line-order position within its file (processing each file's functions together rather than one at a time), building a BTreeMap from key to a Live struct capturing the function's current file/line/ordinal/signature — a ground-truth snapshot used to detect stale or renamed readings.
- found: Groups functions by file, sorts each file's functions by (line, id) for determinism, then assigns each function an ordinal that counts occurrences of its own name within the file (disambiguating overloads/duplicates, not a flat per-file line-order index), and inserts into a BTreeMap keyed by key_of(path, name, ordinal) with a Live value carrying id/path/name/line/ord/body.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: I assumed the ordinal was a flat position within the file; it's actually a per-name occurrence counter, which matters for disambiguating same-named functions (e.g. overloaded methods) rather than just ordering.

### `live_files`
- spec 2 · read at `85570ce70088` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:37Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the Scan's files, skipping any excluded by .sanityignore and any with no declarations (matching collect_tasks), and builds a BTreeMap from each file's durable file_key to a Live value representing that file's current on-disk state (e.g. path and something like a hash/mtime used later for staleness checks against stored assessment shards).
- found: Visits the scan tree, skipping non-file nodes, excluded files, and files with no children (no declarations), and inserts a Live record (id, path, name, line=0, ord=0, body=file body or empty) into a BTreeMap keyed by file_key(path).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Got the filtering and keying right but expected the Live payload to carry staleness metadata like a hash/mtime; instead it carries id/name/body with line and ord zeroed out, presumably placeholders since a file itself has no line/ord the way a function declaration would.

### `is_stale` — QUIRKY — TRAP
- spec 3 · read at `cbdbbaa52183` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:42Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns false (not stale) when report.body is None, since a hash-less reading predates the hashing scheme and is trusted as-is; otherwise compares report's stored body hash against node_body and returns true if they differ (or if node_body is None, meaning the code disappeared).
- found: Three-way match: empty recorded body (pre-hash migration) is never stale; a recorded hash compared against a present node_body is stale iff they differ; but when node_body is None (the function/file is gone from the current scan) it also returns false, i.e. NOT stale — the opposite of what I predicted.
- predicted: some · documented: some · derivable: no · legible: full · trap: yes
- note: The `(_, None) => false` branch means a reading for code that has disappeared is reported as still-fresh by is_stale alone; nothing here documents that deletion must be handled by a separate check elsewhere (peers suggest `a_function_that_is_gone_stops_being_offered` covers it), so a future caller of just this function could wrongly treat a deleted function's old reading as current.

### `row` — QUIRKY
- spec 2 · read at `6f5e58cf55bc` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This method on `Compiled` builds a summary tuple for one shard/file to be used by `render_index` when rendering the top-level markdown index table. I expect it returns something like (file name/path, total function count, count fully predicted, count with some prediction, count with no prediction, count of traps or documented issues) — essentially aggregating per-function report fields into counts for a table row.
- found: Returns a tuple of (shard name, read count, total count, surprising count, stale count, dated count) pulled directly from fields on self — a simple field-tuple accessor with no computation.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `compile`
- spec 3 · read at `1da8911fc05d` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:15Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes the scan (list of files/functions currently in the repo) and the reports map (readings keyed by id), and for each function/file in the scan looks up its report(s), groups them by shard (probably by file or some partition key), and builds a Vec<Compiled> representing rows to be rendered — computing derived fields like grade/status per entry. It does not touch the filesystem or produce a String; it's a pure data transformation that both `save` and `refresh_index` call so they stay consistent.
- found: Iterates live functions and files from the scan, joins each against its report by id, groups into shards→files→Placed entries (sorted file-first then by line), and per shard renders each entry into a text body via render_entry while tallying read/surprising/stale/dated counts against the shard's total live count. Returns Vec<Compiled> with shard name, counts, and rendered body — driven from the live scan (not from the reports map) so stale/missing entries are handled correctly.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

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
- spec 3 · read at `9efc6d8e2d65` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:23Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Formats one assessed function/file's report as a Markdown block for the `.sanity/` store: a heading using `ord` and `name` (marking it as a file heading differently if `is_file`), then a bulleted/field list of the Report's fields (predicted, documented, derivable, legible, trap, note, found, etc.), and some indicator if `stale` is true (e.g. a "STALE" marker) since the code has changed since this entry was recorded. Returns the assembled String to be concatenated into the larger markdown document.
- found: Renders one Report into a markdown block: a heading (name + ordinal-if-twin + terse marker suffix for only the loud/notable grade ends — OBSCURE/QUIRKY/UNCLEAR/TANGLED/TRAP/STALE), a provenance meta line (spec version, read-at commit, model, asked-for-vs-model disagreement, harness, when, by, cold/warm, position in run, priming), expected/found lines, a grades summary line, an optional note, and a stale-warning paragraph. Confirmed my structural guess but missed the specific gating logic (marks only shown when still "current" per legible_current/trap_current), the omit-if-agreeing logic for asked vs model, and the exact field set.
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
- spec 3 · read at `6a1563f0a9ec` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:27Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that sets up a temporary .sanity/ directory containing a human-authored markdown file (not README.md and not a shard file) alongside some assessment data, then invokes the save/sweep logic that writes out shards and index. It asserts the human file is still present afterward, since the sweep should only remove files it recognizes as its own outgoing shards rather than deleting anything unrecognized.
- found: Sets up a scanned repo, saves the assessment once, then writes both a genuinely-new human note (NOTES.md) and a file mimicking an orphaned old shard the tool never linked in its current index (gone.md), saves again, and asserts BOTH survive — the rule the test encodes is that the sweep only removes what it currently claims in its own index, not merely what it fails to recognize as human-authored.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

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

### `a_shard_counts_grades_that_answer_an_older_question` — QUIRKY
- spec 3 · read at `ebd58acdc2c0` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test that builds a couple of synthetic Reports/specs — one with a legible/trap grade recorded against an old spec version (so it should count as "dated" under today's spec) and one that never graded legibility at all (so it should NOT count as dated even though it also doesn't match today's spec) — runs them through compile (or the shard-stat computation), and asserts the resulting dated count only reflects the first case, not the ungraded one.
- found: Builds three synthetic functions (one graded under an old spec, one under today's spec, one never graded), runs compile, and asserts only the old-spec grade counts as dated — not the ungraded one. Then extends the test to show the trap axis expires independently of the legible axis (each on its own spec version), and checks render_shard's wording for both the dated case and the fully-clean, nothing-to-say case.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Missed that the test also exercises independent per-axis expiry (trap vs legible on different spec versions) and asserts on render_shard's actual output text, not just the numeric dated count.

### `key_ignores_line_numbers`
- spec 2 · read at `efd0813c8a57` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:15:41Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A short test that constructs a key for the same function twice, with different line numbers, and asserts the resulting keys are equal — confirming the key format is `path#name` and does not embed the line number, so a reading survives code shifting above the function.
- found: Builds two scans of the same function "foo" at different line numbers (12 vs 480) via scan_of, then asserts live_funcs() produces the same set of keys for both, confirming the key doesn't depend on line number.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `same_named_functions_in_one_file_stay_apart`
- spec 2 · read at `da2248134fcc` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:35Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A regression test reproducing the bug in the docstring: it creates two functions with the same name (e.g. two `init`s) in one file, likely under different owners/types, assigns each a distinct report, saves, reloads, and asserts that each function still gets its own reading back rather than one overwriting the other's key and both ending up STALE against the wrong body.
- found: Regression test: two same-named `init` functions plus an `other` function in one Swift file scan into 3 live entries, with the second `init` disambiguated by an `#2` ordinal suffix in its key, each keeping its own body hash; saving and reloading reports preserves that distinction so neither reading is falsely marked stale.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `a_file_reading_round_trips_beside_its_functions`
- spec 2 · read at `8432650edb11` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:15Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds an assessment/shard containing both a file-level reading (keyed by bare path, no '#') and one or more function readings (keyed with '#') for the same file, writes/renders it and reparses it, then asserts the file reading survives the round trip distinctly from the function readings without collision or misidentification.
- found: Builds a scan with two functions in one file plus a file-level report, saves to a temp .sanity dir, checks the rendered shard markdown titles the file entry in prose (### FILE_ENTRY) distinct from function headings, then reloads and asserts all three readings (2 funcs + file) round trip correctly keyed and not stale.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

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

### `stale_when_the_body_moves` — QUIRKY
- spec 2 · read at `2d1b882793a3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:16:03Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test that records a reading for a function, then re-scans with the same function moved to a different location/body content (e.g. shifted or edited), and asserts the stored reading is now considered stale because the body hash no longer matches, even though the key (path#name) is unchanged.
- found: Directly tests is_stale(&report, current_hash): matching hash is not stale, mismatched hash is stale, and a report with no recorded body hash (migrated/old format) is never considered stale regardless of the current hash — it's trusted at its word.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `survives_a_mangled_entry`
- spec 2 · read at `e86d2cfa71aa` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:42Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A unit test: builds a markdown assessment blob containing one deliberately corrupted/malformed entry alongside one or more well-formed entries, parses it with the module's parser, and asserts that the well-formed entries still come back correctly while the mangled one is simply dropped/skipped rather than causing the whole parse to fail or panic.
- found: Test builds markdown text for one file with two function entries — "broken" has no reading bullet lines and "intact" has a full valid reading — calls parse_shard, and asserts the broken entry is entirely dropped from the output map while the intact one survives with correctly parsed fields (predicted grade, derivable flag).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `scan_of`
- spec 3 · read at `a670ee76f193` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:11Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test-fixture helper that takes a slice of (path, name, ord, body) tuples and builds a minimal Scan tree with one Func node per entry, computing each node's id via the same key_of(path, name, ord) function the real scanner uses — so tests exercise the same identity scheme as production code rather than a simplified stand-in.
- found: Builds a fake Scan from (path, name, line, body) tuples: for each, mints a Func node with id from key_of(path, name, ord) where ord auto-increments per (path,name) pair seen so far (not passed in), hashes the body text, groups funcs into File nodes per path (each with its own synthetic header body_hash), assembles them under a root dir, and fills in ScanStats with the function count.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `a_stale_index_is_rewritten_on_open_and_an_absent_one_is_not_created`
- spec 2 · read at `81d89007d616` · commit `51b9d8d` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T21:23:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test that: (1) when a stale/outdated index file exists in .sanity/, opening the assessment rewrites/updates it to the current format without requiring a new reading; (2) when no index file exists at all, opening does not create one.
- found: Test with a three-way Index enum (Absent/Current/Refreshed) checked via refresh(): confirms opening a repo with no assessment yet creates nothing on disk (Absent), a freshly-saved index needs no rewrite (Current, and importantly no rewrite of identical bytes to avoid dirtying checkouts), a stale index (old README copy text) gets rewritten (Refreshed) with updated content, and that refresh's rewritten output is byte-identical to what save() produces directly, to prevent the two paths from fighting over the file.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: I got the general shape right but missed the specific three-state Index enum (Absent/Current/Refreshed) and the important 'no rewrite of identical bytes' and 'refresh output byte-identical to save output' invariants, which are the real point of the test.

### `writes_and_reloads_a_repo_assessment`
- spec 2 · read at `46adf75c47c8` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A test that writes a repo assessment (with at least one graded reading) to the .sanity/ store, then reloads/reparses it back, asserting the roundtrip preserves the reading's data even after the source function it describes has shifted to a different line number in the file (verifying matching is done by content/name hash rather than line number).
- found: Writes a scan+reports to a temp dir via save(), verifying per-top-level-dir sharded .sanity/*.md files and a README index with pointer text. Then rebuilds the scan with functions moved to different lines (one with changed body), reloads via load(), and asserts readings are matched by id regardless of line move, with staleness correctly determined by body hash comparison (unchanged body stays current, changed body is stale).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Doc comment explains intent well and matches; I didn't anticipate the specific sharding/index-content assertions.

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

### `main`
- spec 3 · read at `5a0a7eead3f9` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Parses a path argument from CLI args, opens the git repo at that path, walks its commit history replaying each commit's changes to build up a timeline of function counts, tracking the biggest frames (commits with the largest function-count deltas), and finally prints a summary: total commit count, final function count, and the top few biggest frames — to catch replay bugs like renames misread as adds or desynced diffs landing in the wrong file.
- found: Parses CLI flags (--files, --json, --cached, --limit, path), reads git history via history::read/read_cached, then replays each commit's set/del deltas into a live HashMap to compute alive-at-HEAD function count and lines, tracking peak. Prints commit/file/function summary stats, optionally a per-file breakdown, and the busiest 8 commits by change count; --json dumps the raw History struct instead.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## src-tauri/src/bin/sample.rs

### the file itself
- spec 2 · read at `cf7c3dc1db75` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small standalone Rust binary (`just sample <repo> <out> [n]`) that reuses this project's own candidate-extraction logic to pull N functions out of a target repo, then serializes them (JSON, matching the sanity_next handout shape) to a file on disk — bypassing the normal lease/report/.sanity/ bookkeeping since it's meant for feeding the same batch to multiple readers for inter-rater comparison rather than doing a real single-reader assessment. Likely just a `main()` that parses argv, calls into a shared module for extraction, and writes output.
- found: A main() that scans a repo with the same scan/agentapi machinery as the live tool (using ephemeral memos so nothing is banked), takes every stride-th task (fixed stride sampling, not random, for reproducibility) up to N, slices out each function's source by its recorded line range, and writes two files per exercise (NN_head.md with name/owner/signature/docs/peers, NN_body.txt with the raw body) to an output directory — plus a summary line to stdout.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted JSON output and reuse of the sanity_next handout format, but it actually writes paired markdown/txt files per exercise and samples by fixed stride rather than randomness — both details I got wrong.

### `main` — QUIRKY
- spec 3 · read at `32ab5aa27e44` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:35:08Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Parses CLI args for repo path, output path, and optional sample count N (default some fixed number). Scans/parses the repo to enumerate candidate functions (reusing whatever extraction logic the main app uses), randomly samples N of them, and writes them out as a JSON file of handouts to the given output path — deliberately bypassing the sanity_report/.sanity queue/leasing machinery described in the file doc.
- found: Parses repo/out/N args, scans the repo with ephemeral memos (no disk cache) purely for ordering fidelity, gets all tasks, then picks an evenly-strided subset (not random) of N tasks. For each, it slices the function body straight from the current file by line range, and writes a paired 02_head.md (name/owner/file/signature/docs/peers) and 02_body.txt (source) per task into the output dir.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: I expected random sampling and a single JSON output; it's actually evenly-strided sampling and two plain-text files per exercise.

## src-tauri/src/bin/scan.rs

### the file itself
- spec 3 · read at `a9f22f9a8ba3` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:44Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A standalone CLI binary (`just scan <path>`) that runs the surprise-scoring scan on a given repo path headlessly (no UI) and prints a human-readable report to the terminal: main() parses the path argument, invokes the core scan, then prints a histogram of scores and sections listing the most surprising/hottest functions (via `section`, `quadrant_label`, `truncate` for formatting names to fit). `baseline_check` and `wiring` likely validate scan setup or compare against a known-good baseline/expectation to sanity-check the scorer itself.
- found: Headless CLI: main() parses path/--local args, runs scan::scan with full fidelity and ephemeral memos, then prints a report — overall hot-line %, a temperature histogram, a 'wiring' section reporting call-graph resolution/coverage/locality stats (calibration for the Reach/Locality lenses, not validation of scan setup as I guessed), a baseline_check comparing top-15-by-metric vs top-15-by-raw-LOC overlap to test whether the surprise metric adds anything beyond size, and finally ranked HOTTEST/BULKIEST sections via `section`.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `main` — TANGLED
- spec 3 · read at `005dbd52267f` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a path argument from CLI, runs the repo scan with the heuristic surprise model, then prints a ranked/sectioned report of results — likely a histogram of surprise scores (histogram), the hottest-scoring functions grouped by quadrant label (quadrant_label), and a baseline_check sanity comparison — so a developer can eyeball whether the metric surfaces functions they'd actually flag as surprising on a repo they know well.
- found: Parses path/--local flags, optionally loads a local scoring model (feature-gated) else falls back to HeuristicModel, runs a full-fidelity ephemeral scan, then prints summary stats, a no-history warning if applicable, percent of hot lines, a histogram, wiring stats, a baseline_check, and two ranked sections (hottest by temperature×lines, bulkiest predictable/bloat by raw lines).
- predicted: most · documented: most · derivable: no · legible: some · trap: no

### `histogram`
- spec 2 · read at `4c74b4d20fb0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Buckets the surprise scores of funcs into fixed-width ranges (e.g. 0.0-0.1 ... 0.9-1.0), counts how many fall in each bucket, and prints an ASCII bar chart to stdout showing the distribution — evidence of whether the metric spreads scores out (long cold tail, thin hot end) or piles everything into one bucket.
- found: Buckets each node's temperature (0-1, missing score treated as 0.0) into 10 deciles, then prints a scaled unicode bar chart (relative to the peak bucket) with counts, labeled "TEMPERATURE SPREAD".
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `wiring` — QUIRKY
- spec 3 · read at `7aaa61c2e501` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:17Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes three summary numbers from the parsed functions and scan stats: coverage (fraction of functions whose language resolves calls at all), resolution (fraction of call sites that resolved to a definition in-repo), and unreferenced (fraction of resolvable functions nothing calls). It prints these via `section`/formatting helpers as a CLI diagnostic block, likely flagging when resolution is suspiciously low (e.g. near 2%) as a sign the language/grammar handling is broken.
- found: Prints resolution rate, coverage (resolvable functions of total), and unreferenced share as text, matching my prediction. But it also prints two ASCII bar-chart histograms not predicted: a caller-count band histogram (0,1,2,3-5,6-15,16+) and a locality (calls leaving own directory) decile histogram, both scaled to a peak bucket and rendered with block characters.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The three headline numbers described in the file/type docs are only the first third of the function; most of its code builds the two histograms, which the docs don't mention at all.

### `baseline_check`
- spec 2 · read at `1008769e773b` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:28Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Sorts (a copy of) `funcs` by the real score (temperature × lines) to get the top N, sorts another copy by raw line count to get its top N, then computes the overlap (count or percentage of shared entries) between those two top-N sets and prints it — something like "N/50 of the hottest are also the biggest". High overlap is printed as a warning that the metric may just be reflecting size.
- found: Computes top-15 by temperature×loc and top-15 by raw loc, counts the overlap between the two id sets, and prints a verdict bucketed by how much overlap there is (low/partial/"size is doing the work").
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `section`
- spec 2 · read at `a5b137b2efc0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:58Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Prints a header line with `title`, sorts funcs in-place descending by rank(node) score, then prints the top N (some fixed cap like 10) as rows showing score, name/owner, and path (possibly truncated with the `truncate` helper), so a human scanning CLI output can see the highest-ranked functions first.
- found: Sorts funcs descending by rank score, prints title header, then for up to 15 entries with rank>0.0 prints a formatted row: temperature (rank*100 as degrees), truncated name (28 chars), LOC, quadrant label, path:line.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

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

### `main` — QUIRKY — TANGLED
- spec 3 · read at `1ad600494eea` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:15Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: CLI entry point for `just tokens <path>`: reads a path arg (or defaults to something like the MCP tool definitions / prompt files), tokenizes each relevant string (tool descriptions, subagent prompt) with the `tok` helper to get a token count, then prints a formatted table via `row` showing each piece's size, its percentage of the total via `pct`, and flags/highlights the biggest contributors via `big`, ending with a total.
- found: Prints a three-part token budget report: the fixed per-reader prefix (reader-surface tool schemas + subagent prompt, plus what the orchestrator-only tools would add), then actually scans the given repo path to build all tasks and reports median/p90/max character distributions per task field (peers, docs, signature, body lines), then projects a whole-repo token total (fixed prefix × function count + payloads + estimated body tokens) and reports the token savings from the reader/orchestrator role split.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: The function only had a file-level doc (about the tool's purpose generally), not a doc on `main` itself, so documented should read as none even though the file_doc was substantive and largely accurate context.

## src-tauri/src/blame.rs

### the file itself
- spec 3 · read at `13e71e697b15` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Implements per-line git blame as a replacement for the file-level churn data described in the doc: runs `git blame --porcelain` (or similar) per file, parses commit/author/timestamp per line, and exposes a Blame/FileBlame API (Blame::read, Blame::get, FileBlame::range) that lets callers ask for the author/age of a specific line range (a function's span) rather than the whole file. Includes porcelain parsing, placing lines by their final line number, and clamping a requested range that runs past the end of the file's known lines.
- found: Runs `git blame --line-porcelain` per file in parallel (rayon), parses commit/author/author-time per line into a compact Line struct (u64 commit prefix, u16 author index, i64 time), and exposes Blame::read/get plus FileBlame::range to collapse a function's line span into RangeHistory (distinct commits alive, last-touched days, age days, last author) — clamped to what blame actually covers. Caches per-file blame in ScanCache keyed by content hash and last commit; per-file git failures are silent so one untracked/unreadable file only loses its own history.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The module doc explicitly distinguishes function-level "commits" (distinct commits still alive in the range) from file-level churn's windowed 90-day count — an important semantic difference not obvious from field names alone.

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

### `read`
- spec 3 · read at `ac8a783c1424` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:36Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Parallelizes git blame across all given paths (likely via rayon), calling done(path) as each file's blame is started (not finished) to drive a progress bar, reusing a still-current entry from cache when available and calling blame_file otherwise, silently dropping per-file failures (untracked/symlink/non-repo), and assembling everything into a Blame struct keyed by path.
- found: Parallel (rayon) map over paths: calls done(path) first, then checks cache.cached_blame(path, hash, last_commit) and returns it if present; otherwise calls blame_file, writes the result back into cache via put_blame, and collects into Blame{files, now} where now is a captured wall-clock timestamp used elsewhere presumably for age calculations.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs (module-level) explain the done-before/cache-miss-not-stored design well; the now timestamp capture at read time isn't mentioned in the docs I saw.

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

### `parses_a_commit_author_and_time_per_line` — QUIRKY
- spec 2 · read at `83b21a2d2547` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:22Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A unit test that feeds a small hand-written git-blame --porcelain formatted string into parse_porcelain, then asserts the resulting per-line records carry the expected author and commit timestamp for each line.
- found: Unit test parsing a SAMPLE porcelain blame string, then testing FileBlame::range() over line ranges: verifies authors are interned (deduped) rather than repeated per line, that a single-commit range reports the right commit count and author, and that a multi-commit range reports the most-recently-touching author (not the first), plus last_touched_days and age_days values.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I expected direct per-line author/time assertions; it actually tests the range() aggregation API (commit counts, most-recent author, age) built on top of the parsed lines.

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
- spec 2 · read at `3911f8fff48d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:02Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the cache file path via path_for(repo, model), attempts to read and deserialize it (likely JSON), and checks the stored model field matches the requested model — if the file is missing, fails to parse, or was written by a different model, it returns a fresh empty Cache rather than merging; otherwise it returns the loaded Cache populated with the persisted entries.
- found: Reads and deserializes the Stored struct from path_for(repo, model), filters it valid only if version == FORMAT_VERSION and model matches, else builds a fresh empty Stored; wraps it into a Cache with path, model, a Mutex-guarded inner store, and a dirty counter.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the FORMAT_VERSION check (schema versioning alongside the model match) and the Mutex/dirty-counter wrapping in the returned Cache.

### `path_for`
- spec 2 · read at `8973c016a1ad` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:56Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes a cache file path under a scores/ directory (likely in the app's data dir), combining an FNV hash of the repo's canonicalized path with a sanitized version of the model name into the filename (e.g. scores/{hash}-{model}.json), returning None if the data directory can't be resolved or the repo path can't be canonicalized.
- found: Joins data_dir()/scores, creates the dir, then hashes both the repo path and the model name with fnv and joins them as a hex filename {repo_hash:016x}-{model_hash:016x}.json.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I expected the model name to appear as readable text in the filename per the doc's framing ('the model belongs in the filename'), but it's hashed too, not kept literal.

### `get`
- spec 2 · read at `830ff0edef2d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:13Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A simple lookup into an internal HashMap keyed by (String, u64) — likely (function name, body hash via fnv) — returning a cloned Option<Reading> if present. No disk I/O since only the ephemeral in-memory cache is currently reachable.
- found: Locks the inner mutex, looks up the entry by key.0 (name), filters on matching body_hash (key.1), and maps to a fresh Reading struct cloned from the cached surprise/hotspots fields; returns None on lock failure or miss.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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

### `a_cache_written_by_another_model_is_dropped_not_merged` — QUIRKY
- spec 2 · read at `2c0e0adcb678` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:48Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Writes/opens a Cache file populated under one model name, then opens it again requesting a different model, and asserts the old entries are gone (empty/fresh cache) — a mismatched model tag causes the whole cache to be discarded rather than partially reused or merged.
- found: Writes a Stored struct (model: "old-model", one entry) to a temp file, reads it back via plain serde_json deserialize, and asserts loaded.model != "new-model" — it never actually calls Cache::open or exercises the model-mismatch filtering logic the test name claims to cover.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: The test doesn't call Cache::open at all — it just round-trips JSON and checks a tautological string inequality, so it doesn't actually verify the drop-not-merge behavior its name claims.

## src-tauri/src/churn.rs

### the file itself
- spec 2 · read at `0c7433ce609f` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:09:00Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes git history stats (churn, commit counts, last-touched, last-author, age) from one `git log` pass instead of per-file git spawns. Parses the log once, accumulates commit credit up directory trees so a file's commits count toward all ancestor directories, stores results in a `History` struct with lookup methods, and applies saturation logic so one pathological file doesn't dominate scores. Includes unit tests verifying directory credit propagation, saturation, and empty-repo handling.
- found: Single-pass `git log` parser that builds a History of per-path (file and directory) commit stats: recent commit count within a 90-day churn window, age from oldest commit, last-touched/last-author/last-commit from newest commit. Directory ancestors are credited once per commit (via a per-commit touched-files buffer) rather than by summing per-file counts, avoiding double counting. Churn is normalized against a fixed absolute saturation constant (8 commits in-window) rather than relative to the repo, specifically to prevent a single high-churn generated file (e.g. lockfile) from squashing everything else's score. Includes unit tests for directory credit accumulation, saturation, oldest/newest commit semantics, and non-repo handling.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc comment on parse_log explicitly explains a documentation-drift meta-issue: a paragraph about parse_log had been misplaced above credit's definition, fooling extractors/readers into attributing it to credit.

### `churn_of`
- spec 2 · read at `2e7d59626e95` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:08Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Looks up the commit count for `path` (via an internal map built from the git log pass), divides by CHURN_SATURATION, and clamps the result to 0..1 — returning 0 if the path has no recorded commits. The absolute (not repo-relative) scale is so churn values are comparable across different repos.
- found: Looks up the file's recent_commits from self.files map, returns 0.0 if absent, else divides by CHURN_SATURATION and clamps to 0..1.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `commits_of`
- spec 2 · read at `f077c53a23d4` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:43Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Looks up `path` in an internal map (e.g. HashMap<String, u32>) built during the git log pass and returns the raw commit count, defaulting to 0 if the path isn't present.
- found: Looks up path in self.files map and returns the recent_commits field of the per-file history struct, defaulting to 0 if not found.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `last_touched_of`
- spec 2 · read at `b2dfed3bfff2` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:10Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Looks up the file's last commit timestamp in a map built by the single git log pass, and if found, computes and returns days since that commit (using now_secs() minus the stored timestamp, divided into days). Returns None if the path has no recorded history.
- found: Simple map lookup returning a precomputed last_touched_days field from a per-file history struct — the day-conversion math happens elsewhere (at parse/flush time), not here as I assumed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `last_author_of`
- spec 2 · read at `71fc831087df` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:51Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Simple accessor on History: looks up `path` in an internal per-file map built during the single git log pass, and returns the author of the most recent commit touching that file as Option<String>, returning None if the path has no recorded history.
- found: Looks up path in self.files, maps to last_author cloned, and filters out empty-string authors so an empty author reads as None rather than Some("").
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the empty-string filter guard.

### `age_of`
- spec 2 · read at `f204332fb880` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:15Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Looks up path in self.files; if present, computes the age as now_secs() minus the file's oldest/first commit timestamp (converted to some unit like days), returning Some(age); returns None if the path isn't in the map (no history).
- found: Looks up path in self.files and returns the precomputed age_days field, wrapped in Option; no computation happens here — the subtraction from now_secs happens elsewhere during parsing.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `last_commit_of`
- spec 2 · read at `fda8fa978861` · commit `10d6afa` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:03:40Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Looks up `path` in a HashMap (built during the single git log parse) that stores per-file commit history, and returns the oid of the first/most recent entry as Some(&str), or None if the path isn't present in the map.
- found: Looks up the path in a `files` map and returns a pre-stored `last_commit` field as Some(&str) unless it's empty, in which case None — close to my guess but the struct stores a dedicated `last_commit` field rather than a history list I'd have to take the first of.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The empty-string-as-sentinel-for-None filter wasn't something I anticipated.

### `is_empty`
- spec 2 · read at `6c522ef55697` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:14Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the History struct's underlying data (e.g. a map of per-file/per-directory commit records) is empty, used to detect repos with no git history at all.
- found: Returns self.files.is_empty() — checks if the per-file commit map has no entries.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `read`
- spec 2 · read at `8aeeb414bca3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:37Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Runs a single `git log` command (with --name-only or similar, and a custom format string encoding hash/author/timestamp per commit) against `repo` as a subprocess, capturing stdout. Passes the output to `parse_log` to build up per-file commit history. If the `git log` invocation fails (not a repo, git missing, etc.), catches that and returns an empty/default History rather than propagating an error, since the doc says this never fails.
- found: Spawns `git -C repo log --no-merges --format=%x01%ct%x02%an%x02%H --name-only --max-count=N`, and on subprocess spawn failure or non-success exit returns History::default(); otherwise decodes stdout lossily and hands it to parse_log with the current timestamp.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `now_secs`
- spec 2 · read at `e9ed17b3f23e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:11Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns SystemTime::now() converted to seconds since the Unix epoch as an i64, used as the "now" reference for computing commit age and recency elsewhere in the churn module.
- found: SystemTime::now() minus UNIX_EPOCH, as seconds i64, defaulting to 0 on error (clock before epoch) — matches prediction exactly except for the unwrap_or(0) fallback detail.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `credit` — QUIRKY — TRAP
- spec 3 · read at `1a421829daf9` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:41Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up or inserts a FileHistory entry for `key` in `files`, then updates it with this commit: increments a commit counter, updates the oldest-seen age (age_of) and most-recent touch/author/oid, and adds to a churn accumulator that saturates rather than growing unbounded so one pathological file doesn't squash the rest.
- found: Gets or creates the FileHistory entry; on first sighting for this key it sets last_touched/author/commit from this commit (relying on the caller feeding commits newest-first from git log); increments recent_commits only if age_days is within CHURN_WINDOW_DAYS; unconditionally overwrites age_days each call, so the final value ends up being the oldest commit's age (again relying on newest→oldest call order).
- predicted: some · documented: none · derivable: yes · legible: full · trap: yes
- note: Correctness silently depends on the caller iterating git log in newest-to-oldest order — nothing in the type signature enforces it, and calling credit() out of order would silently corrupt last_touched/author/oid and age_days.

### `flush_commit`
- spec 2 · read at `cd3690e69372` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:19Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Takes the buffered list of file paths touched by one commit, and for each file calls `credit` to record the commit (timestamp, author, oid) against that file's FileHistory. To avoid double-crediting a directory when several of its files are touched by the same commit, it collects the set of unique ancestor directories across all touched files first (e.g. into a HashSet) and credits each ancestor directory exactly once, then clears the `touched` buffer for the next commit.
- found: Guards against a zero timestamp or empty buffer, computes age_days from ts/now, then walks each touched path's slashes to collect the set of unique ancestor directories, credits every touched file and then every unique ancestor directory once each via `credit`, and clears the buffer.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the ts==0/empty early-return guard and the age_days computation.

### `parse_log`
- spec 2 · read at `c5c2933cf7c0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:01Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Walks the raw `git log` text line by line, detecting commit-header lines (hash/timestamp/author) versus file-path lines, accumulating touched files per commit and flushing them via flush_commit/credit into a History (tracking churn, commit counts, last-touched time, last author, age per file/directory), using the passed-in `now` for age/churn calculations instead of the real clock so it's deterministic in tests.
- found: Parses git log output using \x01 as a commit-header marker and \x02 as a field separator (splitting timestamp from the right-most fields since author names can contain \x02), accumulating touched file paths per commit until the next header, flushing each completed commit's file list plus timestamp/author/oid into the files map via flush_commit, and returns a History wrapping that map.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_commit_touching_three_files_counts_once_for_their_directory`
- spec 2 · read at `e7dd0e3164f6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds a synthetic git-log-style input containing one commit that touches three files within the same directory, parses it via parse_log/read, and asserts that the directory's commit count (via History::commits_of or churn_of) is 1 rather than 3 — proving the dedup-per-commit-per-directory logic works instead of naively summing per-file touches.
- found: Builds a synthetic git-log entry for one commit touching src/a.rs, src/b.rs, src/c.rs, parses it with parse_log, and asserts commits_of("src/a.rs") == 1 and commits_of("src") == 1 (not 3), confirming per-directory commit dedup.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `directory_commits_accumulate_and_reach_every_ancestor`
- spec 2 · read at `37a48eee2c7f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Constructs a small fake git log with commits touching files nested a few directories deep across multiple separate commits, runs it through parse_log/History building, then asserts that each ancestor directory (not just the immediate parent) shows a commit count equal to the number of commits that touched files beneath it, confirming counts accumulate across commits rather than being overwritten.
- found: Builds a fake git log with two separate commits, each touching one file under a/b/, parses it via parse_log, and asserts commits_of counts 1 for the individual file, 2 for directory a/b, and 2 for ancestor a — confirming accumulation and propagation to ancestors. Also checks last_touched_of reflects the newest of the two commits.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Also verifies last_touched_of picks the newest commit among the two, which my prediction didn't mention.

### `oldest_commit_sets_age_and_recent_ones_set_churn`
- spec 2 · read at `e247eed68707` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:43Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a synthetic git log (via parse_log or similar fixture) with multiple commits touching a file spread across time — an old first commit and several recent ones — then asserts History::age_of reflects the oldest commit's timestamp while History::churn_of reflects only the recent commit activity, confirming the two metrics are derived from different ends of the commit history.
- found: Parses a synthetic git-log-format string with three commits (two on a.rs 400 days apart with one recent b.rs commit in between) and asserts age_of picks the oldest commit per file, last_author_of picks the newest commit's author, and churn_of weighs commits inside a 90-day window higher than older ones.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `one_pathological_file_does_not_squash_the_rest`
- spec 2 · read at `577dcf3c2de9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:04Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds History a synthetic commit log where one file has an extremely high commit count compared to the rest, then checks that the churn score for that outlier saturates (caps) rather than blowing out the normalization range, and that the other, normally-churned files still get differentiated, non-squashed churn scores rather than being crushed toward zero by the outlier.
- found: Builds a synthetic git log with a lockfile touched 500 times and a real source file touched 10 times, parses it, and asserts the lockfile's churn saturates at 1.0 while the real file still scores above 0.5 rather than being flattened by absolute scale.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `churn_saturates_rather_than_running_away` — QUIRKY
- spec 2 · read at `ee541947758d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test asserting churn scoring is bounded/saturating rather than unbounded: feeding a file an extremely large number of commits and checking the resulting churn score stays capped (asymptotes) instead of growing linearly, via some log/diminishing-returns transform in History::churn_of.
- found: Parses a synthetic one-commit git log for a single file and asserts `churn_of` returns a value within [0.0, 1.0] — a basic range/bounds check, not a stress test with many commits.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Test name promised saturation under heavy churn but the body only exercises a single commit — the interesting many-commits case isn't actually tested here.

### `a_directory_that_is_not_a_repo_scores_without_history`
- spec 2 · read at `e68b97e30a4b` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:04Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This test likely calls read (or History construction) on a temp directory that isn't a git repo, then asserts it doesn't crash/error but returns an empty/default History — i.e., churn/age lookups on that directory return zero/None gracefully rather than propagating a git error.
- found: Calls read() on a nonexistent path, asserts the resulting History is_empty(), churn_of returns 0.0, and age_of returns None — confirming graceful degradation instead of an error/panic when there's no git history available.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/cli.rs

### the file itself
- spec 2 · read at `373da2aca67d` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:11:18Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: CLI entrypoint for `sanity`, implementing headless commands (serve, check, init, resume, status, etc.) that don't require the GUI. Manages a single per-machine backend process — spawning it if absent (with a lock file to avoid duplicate spawns), health-checking and reaping stale instances — talks to it over HTTP, and formats terminal output (progress bars, elapsed time, grade coloring, pluralization) for interactive use.
- found: The headless CLI backend/coordinator: a per-machine daemon (not per-project) reached via `sanity serve`, with spawn-locking (O_EXCL-based, stale lock stealing), health/probe checks, an HTTP client, and subcommand handlers (init, check, resume, status, summary, refresh, offline fallbacks) plus terminal formatting. My prediction of the backend-spawning/locking/HTTP/formatting shape was right, but missed the deeper architectural rationale (backend is disposable/stateless-on-disk, no `sanity stop`, no model inference path, the deleted `sanity study`/role-split history) that the header explains.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header doc is unusually rich — it explains three load-bearing design properties (per-machine not per-project, daemon holds nothing precious, no model path) and the history of a deleted command (`sanity study`), none of which I could have predicted from signatures alone.

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

### `ensure_backend`
- spec 2 · read at `d81c3321789c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks SANITY_BACKEND env var first and returns that endpoint if set, without spawning. Otherwise probes for an already-live backend via the endpoint file and returns it if found. If not live, calls take_spawn_lock; the winner spawns `sanity serve` (current exe) as a child with null stdio and not detached, then awaits it becoming live; losers instead call await_backend to wait for the winner's backend to come up. Returns an Endpoint or an error string.
- found: Checks live() first; if SANITY_BACKEND is set but nothing answers, errors immediately rather than spawning. Otherwise takes a spawn lock, rechecks live() under the lock, then spawns `sanity serve` as a child of the current exe in its own process group (unix only, so Ctrl-C doesn't kill it via SIGINT to the group) with null stdio, and awaits it. Losers of the lock just await_backend for the winner.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: I had the SANITY_BACKEND check backwards — it doesn't return an early endpoint, it just prevents auto-spawning by erroring if unset endpoint isn't live; and I missed the own-process-group Ctrl-C rationale entirely, which the huge comment block turned out to be the main point of the function.

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
- spec 2 · read at `6d65d648b846` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:23Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: If `show` is false, does nothing. If true, ensures the backend is running (via `ensure_backend`) and then makes an HTTP call (via `post` or `get`) telling it to open a window on `repo`, silently ignoring any failure (e.g. with `.ok()` or an `if let Err = ... { return }`) since the docs say failures here are silent.
- found: Returns immediately if show is false; otherwise ensures the backend is running and POSTs to /open with the repo path and focus:true, discarding the result (silent failure) via ensure_backend's `else return` and `let _ =`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `init` — OBSCURE
- spec 2 · read at `118a658e6a9b` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Resolves the given path to a canonical project path, calls ensure_backend() to make sure the backend process is running, then posts a request to the backend's HTTP API to register the project with the given harness/model (creating the project entry if needed). If show is true, calls reveal_in_window to open the GUI to that project. Prints a confirmation and returns an exit code.
- found: Resolves the path and checks it's a git repo, then handles harness/model configuration entirely locally via crate::reports (set_reader, set_harness, harness_for, model_for) rather than any backend HTTP call. If --harness isn't given, it interactively prompts (via choose()) when a TTY and agents are found on PATH, otherwise prints current config and available agents without guessing. It similarly offers an interactive model picker only when nothing is configured yet, writes the harness choice via set_harness, and finally calls reveal_in_window to optionally open the GUI, printing guidance to run `sanity check`.
- predicted: none · documented: most · derivable: no · legible: most · trap: no

### `check` — QUIRKY
- spec 2 · read at `039738e503f0` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:02:32Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: CLI entry point for `sanity check`. Ensures the backend is running, resolves/registers `path` as a project, then spawns reader subprocesses (respecting `readers` concurrency and an optional `limit`) using `model`, looping until the repo is read or the limit is hit. Prints live progress (bar, elapsed, grade summary) unless `detach` is set (in which case it backgrounds the run), and returns a process exit code.
- found: CLI for `sanity check`: resolves path, retires any stale backend, ensures a fresh backend, opens the project via /open. Resolves which model to use — passed flag, else inherited from prior /status, else prompted interactively if none known and stdin is interactive, else left to the harness's default. Posts /check to start the run; if a run is already in progress, reconnects and tails it (or just reports status if --detach) instead of erroring. Otherwise prints a banner (with a warning if no model was named) and either backgrounds the run (--detach) or hands off to `tail` to stream live progress, with Ctrl-C stopping the run itself since readers are backend children, not children of this CLI process.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Missed the model-inheritance/interactive-prompt logic and the "run already in progress" reconnect path entirely — assumed check itself owned spawning and progress printing, when it delegates the actual watch loop to tail().

### `resume`
- spec 2 · read at `0cf8aa4b1125` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:46Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Resolves the target repo/project from want, opens (or attaches to) it on the backend Endpoint, and re-starts the same assessment "wave" that was previously running (reusing prior wave parameters like model/count) — printing status output similar to check/serve and returning Ok(()) on success or Err(()) on failure to open/start.
- found: POSTs /open to attach the repo on the backend without focusing a window, then POSTs /check with project key, model, readers, and limit from want to restart the wave; returns Ok(()) only if both calls succeed and report ok, else Err(()).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 2 · read at `3445d23dbf96` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:06Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Prints a shared header line (repo name/path plus counts like assessed vs. total functions and percent read) to stdout, computed once from the Value JSON blob so that status, summary, and other verbs display identical numbers instead of each computing their own denominator/stale-inclusion logic.
- found: Prints the shared project header: total segments (functions + file headers, minus excluded), then read/unread/stale counts as disjoint numbers with percentages, an in-flight readers count if any, and the assessment file path — all derived from one JSON Value so every verb agrees.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

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
- spec 3 · read at `6043c9e6becf` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:05Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Runs a scan of the repo at `repo` (via crate::scan::Scan or similar) to get the current file/function map, and separately loads the committed agent reports/readings (probably from git notes or a stored file) keyed by some id string. Returns both as a tuple wrapped in Option, returning None if the scan itself fails; used to give CLI verbs like `status`/`summary`/`grades` everything they need without touching the running backend.
- found: Opens a scan cache, runs crate::scan::scan with a heuristic surprise model, no-op progress/reading callbacks, an ephemeral score cache, and Fidelity::Ordering (since proxy scores aren't used here), printing and returning None on error. Then loads committed assessment reports via crate::assessment::load(repo, &scan) and returns both as a tuple.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The many callback/flag args to crate::scan::scan (heuristic model, no-op callbacks, AtomicBool, Fidelity::Ordering) aren't guessable from this function's own signature/docs alone.

### `read_verb` — QUIRKY
- spec 2 · read at `b00c20b44efb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:33Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a backend is already running at endpoint and whether it has this repo (path) open, without ever starting one itself; if the repo isn't currently open there, it returns Err with an exit code after printing/explaining which command (e.g. resume or open) the user should run instead — otherwise it returns Ok with the JSON project data fetched from the running backend.
- found: Resolves the repo path, and if no backend is live or the backend doesn't have this repo open, answers offline by computing status/summary directly from the repo's committed .sanity/ data (never starting a daemon or rescanning) rather than refusing; otherwise fetches the endpoint's JSON from the live backend keyed by project.
- predicted: some · documented: full · derivable: no · legible: most · trap: no

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
- spec 3 · read at `ced28e32ea73` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:46:10Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A CLI subcommand handler (`sanity refresh <path>`) that scans the repo at `path` in-process (not via the backend, since the backend might be a stale binary that would just re-write the old format), loads the existing `.sanity/` reports, and calls `assessment::refresh` to rewrite the shards in the current format — writing nothing if there was no existing assessment. Prints a status message (success/counts, or an error) and returns a process exit code (0 for success, non-zero for failure), likely using helpers like read_repo, fancy, and plural for the console output.
- found: Canonicalizes the path (exit 2 on failure), short-circuits with exit 0 if there's no .sanity/ dir, otherwise scans the repo in-process (Fidelity::Ordering, no surprise scoring needed since this only rewrites readings), loads existing reports, and calls assessment::refresh, printing one of four outcomes (Failed/Absent/Current/Refreshed) with reading counts and, on a real rewrite, a reminder to review the diff before committing since a bullet-level change would mean a reading didn't survive the round trip.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `grades`
- spec 2 · read at `734a8bc65ba7` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Formats one row of a grade histogram (full/most/some/none counts) pulled out of a JSON `Value`, right-aligning each count into a fixed-width column that lines up under a header row printed elsewhere in the CLI output. Missing or absent counts likely default to 0 rather than erroring.
- found: Formats one row of the full/most/some/none grade histogram: each count is pulled from the JSON value, comma-formatted (thousands separator via `commas`), and right-aligned to width 7, concatenated with no separator. If `v` is None, returns a single right-aligned em-dash placeholder instead of four columns.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that a None value collapses to one placeholder column rather than four zero columns, and missed the thousands-separator formatting via commas().

### `main`
- spec 2 · read at `d83e3e8cd19a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: CLI dispatcher — parses args (subcommand + flags), matches on the subcommand name (serve, check, status, summary, refresh, grades, etc.) and calls the corresponding handler function from its peer list, printing output and returning a process exit code (0 success, nonzero for errors/unknown command).
- found: Uses clap to parse args (re-prepending "sanity" as argv[0] since main.rs stripped it), handling --help/--version/parse-errors by printing via clap's own stream logic and returning 0 or 2. Then matches the parsed Verb enum and dispatches to serve/mcp/init/check/status/summary/refresh handlers, returning their exit codes.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

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

## src-tauri/src/commands.rs

### the file itself
- spec 3 · read at `b450ae7321e0` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:53Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This file is the Tauri `#[tauri::command]` surface — the entire IPC boundary between the frontend and Rust backend, with no server or sidecar process in between. It groups thin command wrappers around domain logic living elsewhere: repo/history scanning, project list management (add/select/reorder/forget), CLI installation/linking, git history queries, agent harness config, and movie export — mostly delegating to other modules rather than containing real logic itself.
- found: Confirmed as the Tauri IPC command surface with no server/sidecar, covering scan/history/project/CLI/movie/agent-run commands as predicted. But many commands carry substantial logic themselves rather than pure delegation — scan_repo manages pending/restoring state and emits progress events, add_project counts sibling repos as a CPU-hazard warning, install_cli/cli_status manage PATH symlinks and resolve login-shell PATH, and repo_remote/slug_of hand-parse git remote URLs — plus a `remote_tests` unit test module at the bottom.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no

### `scan_repo`
- spec 3 · read at `132301c182b8` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:57Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: The main Tauri command invoked when a project is opened: resolves/validates the repo path from `req`, sets up a stop flag in shared `state` so a concurrent `stop_scan` can cancel it, opens the on-disk scan cache, and runs crate::scan::scan in a blocking task with progress/tick callbacks that emit Tauri events via `app` as the sunburst tree is built, updating the shared state's per-project entry along the way. It returns the whole scored Scan tree (or an error string) in one shot rather than streaming, since the frontend needs full sibling totals before it can draw the first ring.
- found: Validates path/git-root, resets a global CANCEL flag, publishes a pending "restoring" placeholder to shared state and disk before doing any work, then runs scan::scan in spawn_blocking with three emit callbacks (progress, per-function score, and shape-batch streamed as directories parse) all pushed to the frontend via app.emit, using an ephemeral score cache but a persistent on-disk ScanCache for parse/blame. After the scan, clears the pending marker, merges the result into shared.projects (carrying forward existing reports rather than reloading), touches and focuses the project since this is the window's own explicit Open action, then returns a slimmed Scan (functions stripped, since the window fetches those per-file on demand).
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The result is returned "slim" (functions stripped) unlike my prediction of the full tree — matches file_doc's framing of "one payload" but the doc doesn't mention slimming, which happens after scan::scan returns.

### `scan_history`
- spec 3 · read at `ebfeb2e1cf32` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:40:54Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This Tauri command resolves the repo at `path`, and if `trace` is not set (or false), just returns already-banked history data via something like `history::stored`/`read_cached`, respecting `limit`. If `trace` is true, it runs the actual commit-by-commit walk (tree-sitter parsing of each touched file version) inside `spawn_blocking` since it's CPU-heavy, optionally wiping cached state first if `fresh` is true, then persists results and emits progress events to the frontend via `app`. Returns the number of commits processed/stored, or an error string on failure (e.g. invalid path or git error).
- found: Validates the path is a directory, then in a blocking task: if fresh, wipes cached history; if not tracing, just returns the count of already-stored commits (cheap, no walk); if tracing, runs read_cached which does the actual walk while emitting progress events, and returns its commit count. Only returns a count, never the full timeline data, to avoid serializing huge JSON payloads.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The comments explain the two-flag design rationale (why trace/fresh are separate, why it returns a count not the data) better than the code alone would.

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

### `agent_reports` — QUIRKY
- spec 3 · read at `bceec9f091bd` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:23Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Locks the shared state, resolves which project's reports to return using either the given `key` override or a stored "currently displayed project" path (separate from any agent's notion of "active" project), then filters/returns that project's Vec<Report>, defaulting to an empty vec if none exist yet.
- found: Locks shared state, resolves the project key (explicit or falling back to the active project), looks up that project's reports, and returns a cloned Vec — but also recomputes two derived fields on the way out (legible_dated and trap_dated) by comparing each stored report's spec against the current build's assessment logic, rather than storing those judgements.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The recompute-on-read pattern for legible_dated/trap_dated isn't hinted at by the signature at all — it's the most interesting part of the function.

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
- spec 3 · read at `bde8ef615e1b` · commit `1850c5b` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:39:28Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Looks up the project identified by `key` in shared app state and returns its already-computed Scan (the scored tree), or None if the project isn't known or hasn't finished a scan yet — essentially a read of existing state rather than triggering new scan work itself.
- found: Three-tier fallback, not a simple state read: (1) if the project is fully loaded, return its scan with functions stripped via slim() for size; (2) otherwise mark it as `wanted` (signaling the background scanner to prioritize it) and return a `shallow` (previous-run cached) map if one exists so the UI isn't blank; (3) if neither, fall back to decoding a stale on-disk cache directly from `treecache` so a project queued behind a big rescan still shows something instead of an empty pane.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Missed entirely: the `wanted` side-effect signal, the slim() function-stripping, and the on-disk stale-cache decode fallback — I assumed this was a pure read with no side effects.

### `file_functions`
- spec 3 · read at `a4341ecc8576` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:59Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A Tauri command that, given a project key and a list of file paths, looks up the shared scanned-project state and for each path collects the function/symbol nodes declared in that file, returning a HashMap from path to Vec<Node>. This backs the UI's "drill into a file" interaction where the ring inside a wedge shows that file's individual functions.
- found: Locks shared state, looks up the project by key, and delegates to scan.root.functions_of(paths-as-set) to get a path->Node map, defaulting to empty if project not found.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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
- spec 3 · read at `72269e781445` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a project key, this locks the shared state and sets a `focus` field (distinct from `active`) to the given key, recording that this project pane is the one the user last clicked on in the sidebar. It likely does not touch `active` at all, and probably persists this choice to disk/config so a restore can read it back later.
- found: Locks shared state, calls touch(key) then focus(key, true) — two separate operations delegated to the state object rather than inline field mutation. The doc comment explains the focus/active distinction which isn't visible in this three-line body at all.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The function is just a thin delegation to touch() and focus() on shared state; the actual focus/active semantics live in those methods, not here.

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
- spec 2 · read at `d100327457d3` · commit `10d6afa` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:03:48Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri command wrapper that forwards key, model, readers and limit straight to agentapi::start_run using the shared state, then converts the result (or error) into a serde_json::Value to return to the frontend.
- found: Wraps the args into a CheckRequest (with harness explicitly None, since this is the project-key-based entry point) and forwards straight to agentapi::start_run, matching my prediction closely including the pass-through/no-transformation nature.
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
- spec 3 · read at `8a2cc830d081` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:04Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Three passes over `files`: first builds an index mapping function name to its definition site(s) (tracking directory and language family for disambiguation and shadowing); second walks every call site in every function and resolves it against that index, applying the documented rules (skip self-calls, only match within the same language family, prefer a local definition over a distant one, credit every locally-ambiguous candidate, drop globally-ambiguous names entirely); third folds the resulting edge list into a Wiring struct holding, per function, an incoming-call count and the share of its edges that leave its own directory (locality). Returns that Wiring.
- found: Indexes definitions by name (with family+dir for resolve()'s disambiguation rules), resolves each call site into a deduplicated edge set (excluding self-recursion), seeds a zero Wire for every resolvable function so absence vs zero-calls is distinguishable, then derives calls/callers counts plus a deduplicated neighbours set per function to compute incident (unique neighbours) and away (neighbours outside the function's directory) — returning it all in a Wiring struct that also tracks resolved/unresolved/resolvable totals.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The distinction between calls/callers (directed, per-edge) and incident/away (undirected, deduplicated via the neighbours set so a mutual pair counts once) isn't obvious from the signature or file_doc — worth calling out since it's easy to conflate the two count types when reading Wire's fields.

### `resolve`
- spec 3 · read at `182393be1725` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:00Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: resolve looks up all definitions matching `name` filtered to family `fam`, then checks tiers in order: any candidates in the same `file` win outright and are returned (even if there are several, all of them); else any candidates in the same `dir` win and are returned; else if exactly one candidate exists anywhere in the family it's returned as the sole global match; otherwise (multiple or zero global candidates) it returns an empty Vec.
- found: Looks up defs by name, filters to same family, then returns same-file candidates if any exist, else same-directory candidates if any exist, else all same-family candidates if their count is <= GLOBAL_UNIQUE (otherwise empty, treating it as an unresolvable common name).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `def`
- spec 3 · read at `80c7b13a0955` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:16Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Test-fixture helper that builds a FuncDef with the given name and a calls list (converting the &str slice into whatever owned collection FuncDef.calls uses), filling any other fields (like owner, line range) with dummy/default placeholder values since only name and calls matter for these wiring tests.
- found: Builds a FuncDef fixture with the given name and calls list, and placeholder/dummy values for signature, body, doc, owner, and line range.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

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
- spec 3 · read at `171ed5fcd7fe` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:46Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test that builds two functions — one in a language whose calls the resolver doesn't support/resolve, and one in a supported language that simply has no callers — computes their caller counts, and asserts the unresolvable one's count is None/absent while the uncalled-but-resolvable one's count is Some(0), confirming "nobody looked" is distinguished from "looked and found nothing."
- found: Builds a wired fixture with a Rust orphan function and a Fortran orphan function, asserts the Rust one's caller count is Some(0) (measured, found nothing), the Fortran one's is None (Fortran calls are never resolved), and that the resolvable denominator counts only the Rust file.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Also checks `resolvable` count as the denominator, not just the per-function caller value — a detail worth keeping if this test is trimmed.

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
- spec 3 · read at `ef629fe23668` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:28Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds two functions a and b where each calls the other (mutual pair), and asserts that each one's callers/incident count is 1, not 2 — i.e., the mutual relationship counts as one neighbour on each side rather than double-counting.
- found: Two functions ping/pong that call each other; asserts each has incident==1 rather than 2, confirming a mutual pair counts once per side.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## src-tauri/src/harness.rs

### the file itself
- spec 2 · read at `98362179931f` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:30Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Defines a Harness enum abstracting over the supported coding-agent CLIs (Claude, Codex, Gemini/Antigravity, OpenCode, etc.), with methods to name/label/parse them, discover which are actually installed (which, via_login_shell, is_runnable, available, all), enumerate their models, and generate per-harness MCP config (mcp_config, toml_string, write_config, opencode_providers). Its central job is building the sandboxed command (reader_command) that spawns a reader subprocess for a given harness — deliberately launched outside the repo's cwd, with no direct filesystem access, with the project/role passed through environment/shim rather than arguments — since the file replaced the old "print instructions and let a human drive" approach now that a reader is a pure MCP client needing only the three tools.
- found: Defines the Harness enum (Claude, Codex, OpenCode, Agy) with parse/name/label/resolve, per-harness model enumeration (JSON-RPC for Codex, CLI parsing for OpenCode/Agy, hardcoded aliases for Claude), PATH resolution that falls back to the login shell and fixed candidate dirs (fixing a GUI-app-inherits-minimal-PATH bug), per-invocation config writing for harnesses that need a config file rather than a flag (Codex gets its own CODEX_HOME with a symlinked auth.json, OpenCode gets opencode.json, Agy gets .agents/mcp_config.json), and reader_command which builds the actual subprocess invocation with harness-specific isolation flags (--strict-mcp-config/--allowedTools for Claude, --dangerously-bypass-approvals-and-sandbox for Codex, --add-dir for Agy) always run outside the repo cwd.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Didn't anticipate the amount of hard-won empirical detail (Codex stdin-must-stay-open, Agy's --add-dir requirement, opencode credential filtering) — the header undersells how much specific debugging knowledge is embedded per-harness.

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

### `opencode_models`
- spec 2 · read at `35fa9f148b61` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:46Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Method on Harness that shells out to run `opencode models` (likely via a via_login_shell helper), captures stdout, and parses each non-blank line (already formatted "provider/model") into a Vec<ModelChoice>, trimming whitespace and skipping empty lines. Probably returns an empty vec if the command fails rather than propagating an error, since this feeds a UI picker.
- found: Resolves the opencode binary path, runs `<path> models`, and parses non-empty lines containing '/' into ModelChoice. Critically, it then filters the list down to only providers found in opencode's own auth.json credential store (via opencode_providers()), falling back to showing everything if that store is empty/unreadable, so the picker doesn't show 341 mostly-unusable models.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Missed the credential-narrowing against opencode_providers() — the actual point of the function per its comment — and the resolve()-based binary path lookup vs a bare via_login_shell call.

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

### `resolve` — QUIRKY
- spec 2 · read at `62479254d60c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:50Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Tries three sources in order of cost to find this agent's binary: first `which`-style lookup against the inherited PATH, then falls back to asking the user's login shell for its PATH via via_login_shell, then falls back to a fixed list of common install locations (~/.local/bin, /opt/homebrew/bin, etc). Returns the first absolute path found, or None if none of the three sources locate the binary.
- found: A memoizing wrapper: checks a static per-process HashMap cache keyed by agent name for a prior lookup result, and only if missing calls self.look() (the actual three-source PATH/login-shell/fixed-list resolution) and caches the result before returning it.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc describes the three-source resolution strategy, but that logic actually lives in the peer `look()`; `resolve` itself is just a cache wrapper around it, which I didn't predict.

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
- spec 2 · read at `e11811e2100d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:49Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Takes a function body's text, breaks it into shingles (small n-gram windows of tokens/words), hashes each with fnv, and collects the resulting hash set into a Fingerprint struct — used later by jaccard() to compare two bodies for distinctiveness/similarity.
- found: Just wraps shingles(body) into a Fingerprint struct — the actual shingling/hashing logic lives in the shingles() peer function, not here as I'd implied.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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
- spec 2 · read at `61d43ab7e698` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:04:54Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that constructs a very small/short function body, runs it through the heuristic scoring pipeline (surprise/incompressibility/etc.), and asserts the resulting score is NOT the maximum/hottest — verifying that raw brevity alone doesn't dominate the "surprise" heuristic, likely because short bodies decline to report some sub-metrics.
- found: A regression test: computes `surprise` for a tiny 3-line main-like function and for a long 40-branch function, both compared against distinctiveness from an unrelated fingerprint, and asserts the tiny one scores below 0.5 while the long one scores higher — guarding against a real bug where `fn main() { app::run() }` was ranked as the most surprising code in the repo.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No docs on the function itself, but the inline comment named the exact regression this guards against, which I couldn't have derived from the name/signature alone.

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
- spec 3 · read at `9016f4469959` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:50:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Responsible for replaying a repo's git history commit-by-commit to reconstruct how the function/file/line-count tree evolved over time (feeding an animated history view), explicitly not replaying surprise/temperature scores since those are only valid against current code. Parses git log/diff output (handling renames, copies, deletions distinctly), builds an incremental Replayer that folds each commit into a running snapshot, and caches/checkpoints the resulting timeline to disk so it can be resumed/extended rather than fully re-walked, with invalidation logic for rewritten history.
- found: Replays a git repo's commits (via git log/diff/cat-file --batch, no working-tree checkouts) to reconstruct the function/file tree's evolution over time for the history-scrubbing UI. Caches the resulting timeline to disk (versioned, resumable/extendable, with rebase detection via ancestor-of-HEAD checks and log position rather than sha ancestry), checkpoints long walks for cancellability, batches/parallelizes blob parsing, and exposes a separate paginated query API (tables/log/funcs/deltas/scoped) so the frontend never has to load the whole (potentially huge) timeline at once.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: My prediction captured the headline doc claim (surprise not replayed, incremental caching) but missed the frontend-facing paginated serving layer, the checkpoint/cancel machinery for hour-long walks, and the specific rebase-detection mechanism in extend() — all load-bearing design choices explained by inline docs/comments rather than derivable from signatures alone.

### `key_of`
- spec 2 · read at `19a1795e6717` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:26:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds an identity string from `path` and the function's name (and owner type if present on HistoryFunc), formatted like "path#owner::name" or "path#name", used as a stable diff key across commits.
- found: Builds "path#owner::name#ord" — I had the shape right but missed the trailing ordinal (f.ord), which presumably disambiguates same-named overloads/shadows at the same path.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 3 · read at `4b11abeacd7b` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:34Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Looks up the git blob for `sha` (likely via git2's Repository/Odb, since owner is `Blobs`), checks if it's binary (e.g. git2's `is_binary()`) or exceeds a size cap meant to exclude non-code blobs, and returns `None` in either case. Otherwise converts the blob's bytes to a String (probably via `String::from_utf8_lossy`) and returns `Some(text)`. May cache the lookup since it takes `&mut self`.
- found: Talks to a long-lived `git cat-file --batch`-style subprocess over stdin/stdout pipes: writes the sha, reads the header line to get kind/size, bails to None for non-blob kinds, then unconditionally reads exactly `size+1` bytes off stdout (draining the payload even when it will be discarded) before checking the size cap and returning the UTF-8 text.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The payload must always be read off the pipe even when the result will be None (oversized or wrong kind) — skipping the drain desyncs every subsequent read by one blob, silently misattributing later files' functions; this isn't a git2 API call, it's a hand-rolled batch-pipe protocol.

### `drop` — OBSCURE
- spec 3 · read at `af7d03b498b1` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Blobs is a cache wrapper around git blob reads; this Drop impl likely logs or flushes cache statistics (hits/misses) or releases some resource explicitly before the struct is deallocated, since a manual Drop suggests non-trivial cleanup beyond what auto-derived drop would do.
- found: Blobs wraps a spawned `git cat-file --batch` child process. Drop closes stdin (by dropping it) which signals the batch process to exit, then waits on the child to reap it and avoid a zombie/hang.
- predicted: none · documented: none · derivable: yes · legible: full · trap: no

### `intern`
- spec 2 · read at `e3d8905f5ffc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:39Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes a stable key for the function (probably via key_of, combining path_idx with the function's owner/name/signature) and looks it up in a HashMap on Funcs; if present, returns the existing index. Otherwise it pushes a new record (built from path_idx and the FuncAt fields) into a backing Vec, inserts the key into the map with the new index, and returns that index.
- found: Interns a function record: looks up f.key in self.index, returning the existing index if present; otherwise pushes a new HistoryFunc (path, name, owner, ord) onto self.list, inserts the key into self.index with the new index, and returns it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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
- spec 3 · read at `05627868785d` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:24Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Walks the repo's git history over the given CommitRange (likely via git2 revwalk or a `git log` subprocess), collecting each commit's metadata and changed files into RawCommit structs. Returns the list of RawCommits plus a second usize that's probably the total number of commits in the full history (for progress reporting), distinct from the length of the returned (possibly filtered/limited) vector.
- found: Shells out to git twice: `rev-list --count` for total commit count, then `git log --no-merges --reverse --root --raw --find-renames` with a max-count/unbounded selector to get raw commit text, parsed via parse_commits. Returns the parsed list plus `dropped` = total minus the requested limit (commits older than the window, not the total itself).
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I guessed the second usize was total commit count; it's actually total-minus-limit (how many were dropped from the window) — a meaningfully different number for a caller doing progress/UI messaging.

### `parse_commits` — QUIRKY
- spec 3 · read at `2c74b19f1449` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:01Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Splits the raw `git log --raw` text output into per-commit chunks (using a recognizable commit-header marker line), and for each chunk extracts the commit sha plus its list of raw file changes (path, blob sha, change status) parsed from the `:mode mode sha1 sha2 status\tpath` raw diff lines, building a Vec<RawCommit>.
- found: Line-by-line scan: a line starting with \u{1} is a commit header, split on \u{1f} into sha/timestamp/author/subject (a custom --pretty format with control-char delimiters, not the standard raw-diff colon-mode line I guessed), pushing a new RawCommit with empty changes; any other line is handed to `parse_raw`, and if it parses, appended to the current (last) commit's changes.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: The delimiter scheme (\u{1} commit separator, \u{1f} field separator) implies a specific --pretty=format string on the git log call elsewhere that this function's signature gives no hint of.

### `tree_of`
- spec 2 · read at `3e188ba7eaf3` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:40Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Opens the git repo at the given path, resolves the commit for `sha`, and walks its tree recursively collecting every blob, returning a Vec of (path, content) pairs — essentially a full snapshot of the source at that commit. Likely filters to source-code file extensions and uses the git2 crate's tree-walk API, since this seeds the replay when history is deeper than the sliding window being tracked.
- found: Shells out to `git ls-tree -r <sha>` and parses each line, filtering to blob entries whose path has a recognized source language (via lang_of), returning (path, blob-sha) pairs — not file contents, just the tree listing with blob object ids for later lookup.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Expected git2 crate + actual blob content; it's actually a CLI subprocess call returning blob hashes, not contents.

### `prefetch`
- spec 3 · read at `5771c040640e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:36Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Walks the given slice of RawCommits, collects the set of unique (path, blob) pairs they touch, deduplicating so a file reverted or shared across commits is only fetched once. For each unique pair, reads the blob content via `blobs`, parses it into a function list, then discards the source text, accumulating results into a Parsed map keyed by (path, blob).
- found: Collects deduplicated (path, blob-sha) pairs across all commits' changes, skipping changes with no sha or an unrecognized language, then hands the whole list to `parse_batch` in one call and rezips results back onto their keys into the Parsed map.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc covers the dedup rationale but not the language-filter skip or that the actual read/parse work is delegated to parse_batch rather than done here.

### `parse_batch` — QUIRKY
- spec 2 · read at `b2bdfb9331e5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:30Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Sequentially reads each blob in `want` (path, oid pairs) via Blobs::read into raw byte buffers, then uses a parallel iterator (rayon) to parse each buffer into a FileState (via parse_raw/tree-sitter), returning a Vec of (key, FileState) pairs in the same order.
- found: Filters `want` to blobs with a known language and reads each sequentially via Blobs::read, refusing (treating as empty) any blob containing a minified line; then parses the surviving sources in parallel via rayon into FileState, returning empty FileState for refused/unreadable blobs so stale functions get properly cleared rather than silently retained.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `empty`
- spec 2 · read at `83013960814a` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:18Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A simple constructor that returns a Replayer with all its fields initialized to empty/default values — empty maps for interned functions/paths, empty vectors, zeroed counters — as a starting point before commits are folded in one at a time.
- found: Constructs a Replayer with empty BTreeMaps for paths and state, default Funcs, and an empty HistoryScan output struct with all fields zeroed/empty — exactly the initial state before folding commits.
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

### `seed`
- spec 2 · read at `a9d626ba5960` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:36Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Given a list of (path, blob_hash) pairs representing the tree state before the commit replay window starts, it iterates each entry, parses the blob's functions (via parse_raw/parse_batch and Funcs::intern), and inserts them into the Replayer's base/live state as (function_id, loc) so later commits can be applied as deltas on top of this opening snapshot. Mutates self and the blobs cache; no return value.
- found: Parses the tree's blobs in batch, interns each discovered function per path, pushes (func_id, loc) into the opening base state, and stores the per-path function-state map (self.state) for later diffing against subsequent commits.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed that it also stores per-path state (self.state.insert) needed for later diffing, not just populating base.

### `apply` — QUIRKY
- spec 3 · read at `40f86b4ac63f` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:00Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Applies the file changes in `commit` (adds/removes/renames) to the Replayer's current tree state, using `blobs` to look up content for size/parsing and `ready` (already-parsed data) to avoid reparsing. After updating the tree, it computes a new frame/snapshot of the tree at this commit and appends it to the replayer's history/frames list, possibly checkpointing periodically via Checkpoint::maybe.
- found: Builds a HistoryCommit frame for the commit: retires (removes) paths that were deleted or renamed-from, recording their functions as deleted; for changed files, fetches parsed FileState from the prefetch batch (or parses missing ones), and for each function only emits a 'set' entry if its content hash differs from the previous version at that path (not just because the file changed) — this hash comparison is the key mechanism preventing every function in a touched file from being marked changed. Deleted functions (present before, absent now) are also recorded. Finally dedups touched file list and appends the frame to self.out.commits.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

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

### `read` #2
- spec 3 · read at `b029ecb72074` · commit `10edcdb` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:39:57Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Top-level replay driver: gets the commit list via log_shas, feeds each commit through a Replayer (seed/apply/fold/snapshot) to build up frames, calls the progress callback as it walks, periodically checkpoints partial progress to disk via Checkpoint::maybe (time-boxed to roughly two minutes of lost work) so a long walk on a huge repo like ceph can be resumed instead of restarted, checks cancelled() to bail out early, and returns the assembled HistoryScan — never failing outright, so a repo with no history just yields an empty scan.
- found: Matches prediction closely: reads the commit log, seeds a Replayer from the pre-window tree if truncated, then walks commits in WINDOW-sized chunks — prefetching/parsing each window's blobs together via `Blobs`/`prefetch` before applying commits one at a time — reporting progress, checking cancelled() each commit, and checkpointing snapshots periodically. Returns r.finish() at every exit path (empty log, no Blobs, cancelled, or completed).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The windowed batching (parse blobs for a whole WINDOW at once, apply commits individually) wasn't guessable from the signature/docs alone — it's a perf detail invisible from outside.

### `read_cached`
- spec 3 · read at `ed27b548c2a8` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:44:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Loads the on-disk cache for this repo (via cache_path/load_cache) and compares its recorded head/SHAs against the repo's actual current git log (via log_shas/is_ancestor) to pick one of three paths: if nothing changed, return the cached HistoryScan as-is; if the repo only gained commits, parse and append just the new ones (extend) and fold overflow into the opening state; otherwise (rebase/divergence/format mismatch) discard the cache and do a full replay from scratch using the Replayer (seed/apply/fold/finish/snapshot), reporting progress through the callback and capping at `limit` commits. A failed cache read or write is swallowed rather than propagated, since the cache is purely an optimization and the scan is always recomputable from git.
- found: Resets a cancellation flag, reports a progress phase, then loads the cache and delegates the stale/current/grew decision entirely to `extend`, which returns a `Carry` enum: Same returns the cached scan immediately, Grew saves the extended scan and returns it, Refused falls through to a full `read` (fresh replay) which is then cached and the old in-memory cache unloaded.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The three-way decision the docs describe lives inside `extend`'s `Carry` return, not in this function's own branching — worth knowing before assuming the logic here is self-contained.

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

### `extend` — QUIRKY — TANGLED
- spec 3 · read at `d0d5612ad300` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:58Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Checks whether `cached`'s recorded commit log is still an ancestor of the repo's current history (via `is_ancestor`/`log_shas`); if the repo has been rebased/force-pushed past that point, returns a Carry variant saying the cache can't be reused and a fresh replay is needed. If it's still valid, walks the new commits between the cached point and `limit`, incrementally growing the cached scan commit-by-commit (reporting via the `progress` callback, checking `cancelled` periodically), and returns a Carry::grew with the extended scan.
- found: Refuses (Carry::Refused) if the cached head isn't an ancestor of current HEAD, or if the stored frame count's position in a fresh log walk doesn't match the recorded sha (rewritten/short history), or if there's nothing ahead beyond `limit`; returns Carry::Same if already current; otherwise resumes the Replayer from the cached scan and walks the new commits in prefetched windows, checkpointing periodically, reporting progress counted from the whole story's start (not just this run's portion) so a resumed long walk doesn't look like it restarted, then folds and returns Carry::Grew.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no
- note: Missed the Same-if-already-current case, the ahead.len()>limit refusal, and the windowed prefetch/checkpoint/resume mechanics entirely — only anticipated a generic incremental walk.

### `warm` — QUIRKY
- spec 3 · read at `adf3e466aa76` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:39:14Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a cached timeline already exists for repo/limit (via load_cache); if none, returns false immediately without building a fresh one. If one exists, compares its stored head against current HEAD, extends the timeline with the commits in between (using extend/log_shas/is_ancestor), writes the result back via save_cache, and returns true to indicate it did work.
- found: Returns false fast if no cache file exists. Otherwise cheaply estimates how far behind the cache is (commit count from log_shas minus the banked count from the sidecar meta file — no timeline read at all) and refuses (returns false) if that's more than WARM_MAX, to avoid silently doing an unbounded amount of work behind a click. Only within budget does it call read_cached to do the actual extend-and-save, delegating that logic rather than doing head-comparison/extend/save_cache itself as I guessed.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The WARM_MAX threshold and the banked()-vs-log_shas() cheap distance estimate are the key mechanism; I'd assumed direct head comparison and inline extend/save calls instead of delegating to read_cached.

### `log_shas`
- spec 3 · read at `25bec5f6cb4e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:57Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Runs `git log --reverse --format=%H` (or similar) in the given repo path via a subprocess, capturing stdout and splitting it into lines to produce a Vec<String> of commit SHAs in oldest-first application order. It's a thin, fast wrapper (no diff/raw parsing) that exists specifically because a full `--raw` log is too slow to use just for ordering.
- found: Shells out to `git log --no-merges --reverse --root --format=%H HEAD` in the given repo path and returns the SHAs as a Vec<String>, one per line, silently returning an empty vec on any failure.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `is_ancestor`
- spec 2 · read at `bb2d9c040a16` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:36Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Shells out to `git merge-base --is-ancestor <sha> HEAD` (or equivalent), returning true if the exit code indicates the commit is reachable from HEAD (still on the current branch's history and not from a rebased-away/orphaned line), false otherwise — likely treating any command-spawn error as false.
- found: Runs `git -C <repo> merge-base --is-ancestor <sha> HEAD` with stderr suppressed, returning true on success exit code and false on any spawn error.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `cache_path`
- spec 3 · read at `c9d6c59dc5c6` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:34:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a machine-local cache file path for this repo's replayed history, distinct from the committed .sanity/ dir. Likely uses a system cache/data directory (e.g. dirs::cache_dir()) combined with a hash or sanitized form of the repo's absolute path, and incorporates `limit` into the filename so different history-depth limits don't collide. Returns None if the system cache directory can't be determined.
- found: Joins the app's data dir with "timelines", creates it, computes an FNV-1a-style hash of the repo path as a hex filename prefix, and appends either the numeric commit limit or "all" (when limit is the sentinel ALL_COMMITS) as a human-readable suffix, returning the resulting .json path.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The docs handed to me were the file-level module doc, not anything about this function specifically.

### `load_cache`
- spec 2 · read at `78bf03749feb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:54Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Computes a cache file path from repo via cache_path, reads and deserializes it (likely JSON) into a HistoryScan, returning None if the file is missing, fails to parse, or its stored scope/limit doesn't satisfy the requested limit.
- found: Reads the cache file at cache_path(repo, limit), deserializes it as Cached JSON, and returns the inner scan only if its version, parse-version, and limit all match current expectations; otherwise returns None at any failure point via ? chaining.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No docs were attached to this function specifically.

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

### `save_cache` — TRAP
- spec 3 · read at `d117cd581b78` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Serializes the HistoryScan (with limit) to disk at cache_path(repo), likely via JSON or bincode, and writes accompanying metadata (e.g. current HEAD sha) to meta_path so a later load_cache call can validate the cache is still fresh/applicable before reuse.
- found: Writes two JSON files: a small meta file (Banked: head sha + commit count) at meta_path(repo, limit), and the full cache (Cached: version, parse version, limit, scan clone) at cache_path(repo, limit). Both cache_path and meta_path are keyed by limit, which I hadn't anticipated. All write failures are silently swallowed (a comment explains this is intentional, since a failed cache save just costs a slower next replay).
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: Silent failure on write is intentional per the comment, but nothing here enforces that Cached's schema (version bump) actually matches Banked's — two related on-disk files with no shared invariant check.

### `a_new_stored_timeline_field_cannot_be_added_silently`
- spec 2 · read at `2f9df0a73856` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:16Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A tripwire test that exhaustively destructures the stored/cached timeline struct (no `..` catch-all), so adding a new field breaks compilation of this test and forces the author to consciously decide how that field behaves under cache-extension/rebase detection, rather than silently defaulting.
- found: Builds a HistoryScan, serializes it to JSON, sorts the resulting keys, and asserts they equal a hardcoded list of wire (camelCase) field names, with a message telling the editor to bump CACHE_VERSION and update the list — a tripwire against silently adding a field to the stored/cached timeline format.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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

### `a_walk_stopped_early_holds_what_a_shorter_walk_would_have`
- spec 3 · read at `461203810b93` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This test replays a multi-commit repo but stops the walk early (e.g., at commit 2), takes a snapshot, and separately does a fresh full replay of just a two-commit version of that repo — then asserts the two timelines are equal, proving a stopped-early walk's state matches what a shorter walk would have produced from scratch.
- found: Manually walks a 3-commit repo's log, applies only the first 2 commits via Replayer, snapshots, and checks the checkpoint's head sha and commit count. Compares `shape` (function set/sizes, not raw content) against a fresh 2-commit repo replay since the two fixtures have different shas for equivalent content. Then extends the checkpoint through the remaining commit and asserts its shape matches a full fresh replay of the 3-commit repo.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

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
- spec 3 · read at `4685b26a04c5` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:58:54Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Opens the on-disk history database/cache file associated with the given repo path and returns a Tables struct bundling handles/queries for funcs, log, touches, and deltas tables; returns None if no database exists yet for this repo (i.e., no history has been scanned/cached).
- found: Wraps with_loaded to build a Tables metadata snapshot from the loaded timeline state: computes which paths are now excluded per current scope/gitignore rules, and copies paths, langs, func_count, base/head commit refs, truncated flag, and commit count. Returns None if the repo has no loaded history state.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `funcs`
- spec 3 · read at `4cee3395139f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up (or loads/replays) the cached history state for `repo`, then returns a slice of its interned-functions list covering [from, from+count), clamping to actual length rather than erroring if the range overruns (mirroring `log`'s short reads). Likely delegates to a shared accessor like with_loaded/tables rather than reimplementing load logic.
- found: Delegates to with_loaded to get the replayed state, then skip(from).take(count).cloned().collect() over s.funcs; returns empty vec if the repo isn't loaded.
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

### `deltas`
- spec 3 · read at `5ac20476d9e2` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:59:05Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Wraps with_loaded to slice the cached per-commit timeline frames from index `from` up to `from + count`, serializing each frame's delta (changed/added/removed functions or touches) as a serde_json::Value so a caller can fold them forward incrementally into a running state; returns empty vec if not loaded or range is out of bounds.
- found: Wraps with_loaded, skips to `from` and takes `count` commits from the cached timeline, mapping each to a JSON object of ts, author, set (added), del (removed), and files; returns empty vec via unwrap_or_default if unloaded.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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
- spec 2 · read at `926d3c164ea1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds the Tauri app menu from predefined platform items (About, Hide, Quit, Edit's copy/paste, Window) rebuilt manually since Tauri won't let you splice into the stock menu, plus a custom Appearance submenu with a three-way theme toggle (Light/Dark/System) whose items it also returns as a ThemeMenu handle so the checked state can be updated later.
- found: Builds Sanity/File/Edit/View/Window submenus manually. Sanity menu has About, an "Install Command Line Tool…" item (I hadn't predicted this), Hide/HideOthers, Quit. File menu has "Add Project…" (⌘O). Edit menu is standard predefined items. View menu holds the Appearance submenu with the three-way theme CheckMenuItem toggle, matching my prediction. Window menu has minimize/close. Returns the built Menu plus a ThemeMenu struct wrapping the three CheckMenuItems, as I expected.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `run` — QUIRKY — TRAP
- spec 3 · read at `da4c6a69fefc` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:19:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This is the Tauri application entry point: it builds a tauri::Builder, registers plugins (e.g. dialog, fs, shell), sets up the application menu via build_menu and a ThemeMenu, registers invoke_handler commands that expose the scan/parse/heuristic/churn/model pipeline to the frontend, sets up the window via build_window, and finally calls .run() to start the event loop, panicking on failure.
- found: Builds the Tauri app: manages shared agent-API state, builds the window and warms the harness, on macOS builds a menu and wires theme/open-project/install-cli menu events, restores the previously open project with scan-shape/scan-progress emitters, spawns the async agent API server, registers single-instance/dialog/opener plugins and all invoke_handler commands, then on RunEvent::Exit stops all agent runs and releases the loopback endpoint file before the backend thread dies.
- predicted: some · documented: none · derivable: no · legible: most · trap: yes
- note: The exit handler is the load-bearing part: the in-process agent API server dies silently with the window, so release_endpoint must run on Exit or external readers get a stale endpoint file pointing at a dead port — nothing in the function signature suggests this cleanup matters.

## src-tauri/src/local.rs

### the file itself
- spec 2 · read at `286441edffd6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:01Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Implements an on-machine scoring backend (alternative to the Ollama/HTTP path) that loads a local LLM directly via a Rust inference crate, discovers available local model files on disk, and computes per-token surprisal for an entire function body in a single forward pass with logits requested at every position, avoiding the per-token generation cost of the HTTP path. Exposes a LocalModel type (load/label/is_model/surprisal/surprise) plus discover_models and score_one entry points mirroring the interface the rest of the app expects from any scoring backend.
- found: local.rs implements local scoring via llama_cpp_4: LocalModel loads a GGUF and spawns a dedicated owner thread (context is !Send) that receives scoring jobs over a channel; score_one tokenizes prefix+body, decodes in one batch requesting logits only over the body span, and computes mean bits-per-token surprisal via log-softmax. discover_models scans Ollama's blob store directory for files over 100MB as a cheap way to find already-downloaded weights, with no format/magic-number check.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `load`
- spec 3 · read at `59001fb85ed8` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:41Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Loads the GGUF model file at `path` (likely via llama-cpp-rs bindings), builds a context, and spawns a dedicated owner thread that holds the model/context (since these types are typically !Send/!Sync) and receives scoring requests over a channel. Returns a LocalModel handle wrapping the thread's sender and a derived label (e.g. from the filename), erroring if the file can't be loaded as a valid GGUF model.
- found: Spawns an owner thread that loads the GGUF via llama-cpp-rs, leaking the backend and model to 'static to avoid a self-referential struct (context borrows model), builds a context sized for MAX_TOKENS, then reports load success/failure back over a dedicated ready channel before entering a job loop that scores requests received over an mpsc channel until all senders drop.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Missed the Box::leak-to-'static trick for the self-referential model/context borrow and the separate ready_tx/ready_rx handshake used specifically because load errors happen on the spawned thread and can't be a normal return value.

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
- spec 2 · read at `5e84fc27ff6c` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:09:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Implements the actual MCP server shipped inside the app binary (replacing an old dev-only Node script), exposing tool schemas over stdio for two disjoint surfaces: "reader" tools (the sanity_next/reveal/report loop) and "human"/project-management tools. Includes HTTP client plumbing (base_url, client, get/post, decode, urlencode, with_retry, heal) to talk to a backend tracking scan/reader state, a contract_fingerprint to catch schema drift, and a dispatch table mapping advertised tool names to handlers.
- found: The stdio MCP server hosted by the app binary, forwarding to a loopback HTTP API (the app's own when a window is open, or `sanity serve`'s otherwise). Exposes two disjoint tool surfaces (reader vs human), dispatch table, contract fingerprint, and HTTP client plumbing with retry/healing.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header doc tells a great war story about why there's only one server (a prior Node-script copy silently dropped fields like `derivable`), which is exactly the kind of non-derivable context a header should carry.

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
- spec 3 · read at `770d85cbc597` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns a JSON array/Value of MCP tool definitions (name, description, inputSchema) for exactly the three reader-facing tools: sanity_next, sanity_reveal, sanity_report — mirroring the schemas exposed to the reader agent.
- found: Returns a json!() literal array of the three tool definitions (sanity_next, sanity_reveal, sanity_report) with their names, prose descriptions, and JSON input schemas — exactly matching what I was handed as a reader this session. Also contains a load-bearing comment explaining that field order in sanity_report's schema matters because a mangled/truncated emission swallows whatever follows a long prose field, so short fields are ordered first and long prose fields (expected/found/note) last.
- predicted: full · documented: most · derivable: no · legible: most · trap: no
- note: The comment documents a real historical failure mode (argument mangling swallowing fields after long prose) that isn't visible from the schema alone — worth preserving if this function is ever refactored.

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
- spec 2 · read at `4c2d7d2aabd2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Entry point for the MCP stdio server: sets up stdin/stdout JSON-RPC line-based framing, advertises the tool list, and loops reading incoming requests, dispatching each by name to the appropriate handler until stdin closes/EOF.
- found: Reads SANITY_PROJECT env var at startup to set a global PROJECT lock (so the launcher can pin which repo this server instance targets, since the model itself never picks). Then loops over stdin lines, parses JSON-RPC, ignores notifications (no id), and handles initialize/tools/list/tools/call methods, dispatching tools/call to call() and returning errors as tool content (isError) rather than transport errors so the model can react to them.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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
- spec 3 · read at `6c8cc5993de3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This file defines the core domain model for a code-visualization tool ("sanity") that renders a tree of files/functions as sized-and-colored wedges. It has: Lang (language detection from file extension), Provenance (weight of model- vs human-authored code), Score (temperature=surprise, is_stable, quadrant classification), and Node — a recursive tree over dirs/files/functions with LOC as size — plus aggregation logic (Node::aggregate/visit/slim/functions_of) that rolls scores up directories by LOC-weighted hot-share (excluding unanalyzed code) rather than simple per-function averaging. The bottom of the file is a battery of unit tests pinning down these rollup/quadrant/wiring semantics as documented invariants.
- found: Defines Lang (extension→language mapping with many deliberate tie-break decisions documented inline), Provenance (weighting how much an explanation can cool a wedge's score, deliberately excluding model-authored text), Quadrant (surprise×stability quadrant), Source (proxy/model/agent), Score (surprise, documented, churn, age, hot_share, analyzed_share) with temperature/is_stable/quadrant methods, and Node — the tree type with many fields carrying rationale-heavy doc comments (signature/owner for reader disambiguation, excluded for .sanityignore, body hash for staleness detection, wiring fields for the Reach lens) — plus aggregate() (LOC-weighted rollup of scores/wiring counts up the tree, treating unanalyzed lines and unparsed languages as absent rather than zero), visit(), slim() (strips function children for the initial payload, written out field-by-field to avoid an O(n) clone via struct-update syntax), and functions_of() (batched lookup to avoid O(n) per-file tree walks). Bottom half is a substantial test suite pinning down the aggregation/rollup semantics.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The header doc alone underexplains the file — most of the real design rationale (hot_share vs temperature, why documented doesn't discount surprise, why Provenance excludes model text, why slim() avoids struct-update clone, why functions_of batches) lives in dense per-field/per-method doc comments throughout, not in the top-of-file summary.

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

### `dir`
- spec 3 · read at `f5ba4f8b1225` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:13Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A simple constructor that builds a Node representing a directory: sets its path and name fields from the arguments, initializes an empty children list, and sets score/kind-related fields to their default/absent state (no score yet, since directories aggregate from children rather than being scored directly).
- found: Constructs a Node with kind Dir, setting id/path/name from args and defaulting every other field (loc, score, hotspots, children, funcs, etc.) to zero/empty/None, exactly as predicted.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `aggregate` — TANGLED
- spec 3 · read at `31d650baa271` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:43Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recursively calls aggregate on children first, then rolls up LOC by summing, and computes an LOC-weighted average of the surprise/temperature score for this node from its children's scores — weighting by each child's LOC so a tiny hot function doesn't dominate a big directory. It also computes hot_share (the fraction of LOC that's actually "hot", excluding unanalyzed lines) and handles the case where a child's score is entirely absent (unreadable subtree) by excluding it from the weighted average rather than treating it as zero/cold. Likely also aggregates provenance/wiring info and picks the node's quadrant based on the rolled-up surprise and stability.
- found: Recursively aggregates children, sums LOC, sums (not averages) wiring counts (incident/away/resolvable/orphans) treating None as contagious absence, then computes an LOC-weighted average of surprise/documented/churn, a hot_share computed only over analyzed lines (excluding Proxy-sourced scores), max age_days, min last_touched_days, and leaves commits hardcoded to 0 (filled in later from git log) and provenance fixed to Source rather than averaged.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: Inline comments flag a real cross-file bug: this Rust aggregate excludes Source::Proxy from 'analyzed' for func children, but its hand-maintained TS twin `reaggregate` in api.ts counts both — worth checking that pair stays in sync.

### `visit`
- spec 2 · read at `bdb1f7563573` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:06Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Depth-first pre-order traversal: calls f(self) first, then iterates over self's children (likely a Vec<Node> field) recursively calling child.visit(f) on each, so parents are visited before their children.
- found: Calls f(self) then recursively calls c.visit(f) for each child in self.children — exact pre-order depth-first walk as documented.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `slim`
- spec 3 · read at `f1e0f2888c09` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:58:40Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively builds a copy of the Node tree with the per-function `functions` vec cleared/emptied on each node (since those are rolled up into file/dir metadata already), while keeping fields like size, score, lang, and recursing into children so the overall tree shape is preserved.
- found: Explicitly field-by-field clones a Node (avoiding the quadratic cost of `..self.clone()` which would deep-clone all children first), keeping rollup fields like score/hotspots/away/orphans, dropping per-function callers/calls, and for File nodes replacing children with an empty Vec while recording their count in `funcs`; recurses for non-File nodes.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `functions_of`
- spec 3 · read at `7e86c4b34314` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A single recursive walk over the Node tree that, for each descendant node whose path is in the given `paths` set, collects its function-kind children into a Vec<Node>, accumulating results into one HashMap<String, Vec<Node>> keyed by path — replacing what used to be a separate full-tree walk per requested path (one walk total instead of one per file).
- found: One tree walk via `visit`, matching File-kind nodes whose path is in the requested set and inserting their children (functions) into the output map keyed by path; short-circuits to an empty map when the requested set is empty.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I predicted the mechanism correctly but assumed it filtered children by function-kind explicitly; it just clones all of a File node's children wholesale, trusting a File's children are functions.

### `score`
- spec 2 · read at `b78ef871806a` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:06Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test-helper constructor that builds a Score struct from the four given inputs (surprise, documented, churn, age), filling in the remaining fields (like source, hot_share, analyzed_share) with sensible defaults such as Source::Model and 1.0, so unit tests elsewhere in this file can build Score values tersely without specifying every field.
- found: Test-helper constructor building a Score from the 4 args, defaulting age_days=Some(age), commits=0, last_touched_days=None, provenance=Source, hot_share=0.0, source=Model, analyzed_share=1.0.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `wired`
- spec 3 · read at `7a05bc8a85b4` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:41Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test-helper factory that builds a Node representing a function, given a name and loc plus wiring counts (callers, incident edges, away edges). It likely constructs a Score/Provenance with those wiring numbers plugged in and defaults for everything else (like surprise/temperature), so tests can exercise wiring-based rollup/aggregation logic without building a full Node by hand.
- found: A test-helper that builds a Node via Node::dir then overrides kind to Func and sets loc plus wiring fields directly (callers, calls=0, incident, away, resolvable=1, orphans derived from whether callers==0) — no Score/Provenance struct involved, it's flat fields on Node itself.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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
- spec 3 · read at `cc121296e1c9` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:15Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This file is the tree-sitter-based extraction layer that turns a source file's parse tree into the app's function/owner model: for each supported language (Rust, Python, TypeScript, Go, C++, Swift, Lisp, etc.) it walks the syntax tree matching node kinds (not queries, for robustness against grammar drift) to find function/method definitions, their names, owners (enclosing type for methods), signatures, body spans, and leading doc comments/docstrings, plus the file-level doc (module docstring/header comment, distinguished from license headers and item docs). It also extracts call sites within each function body to build a call graph, with dedup/capping so a function called many times counts as one dependency, and is deterministic in document order. Guards against panics on malformed/deeply-nested input, returning nothing rather than crashing. A large chunk of the file is inline tests encoding these per-language edge cases as named test functions.
- found: Tree-sitter based extraction of FuncDef (name/signature/doc/owner/body span) and call-graph call sites across ~60 language grammars, dispatched via a Lang enum and kind-matching rather than queries. Caps call lists (MAX_CALLS) and bounds recursive callee resolution (CALLEE_DEPTH) for robustness, returns empty rather than panicking on malformed input. About a third of the file (~lines 973-1457) is a narratively-named test suite encoding per-language edge cases.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: File header doc explains the kind-vs-query design rationale but says nothing about the call-graph extraction half or the FuncDef struct shape, which is a large portion of the file's actual work.

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
- spec 3 · read at `3a5b17a6cb09` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A match on `lang` returning a static string slice of tree-sitter node kind names that count as function-like units for that language — e.g. Rust's "function_item", Python's "function_definition", Go's "function_declaration"/"method_declaration", and for the JS/TS family "function_declaration", "method_definition", and "variable_declarator" (to catch `const Foo = () => {}` per the docs) but deliberately excluding bare "arrow_function"/"function_expression". Likely one match arm per Lang variant, each returning a small array literal.
- found: A large match over ~50 Lang variants (not just the handful I imagined), returning per-language tree-sitter kind lists. Most languages get an obvious kind, but many rely on `accepts` doing extra structural checks because the kind alone is ambiguous — Elixir/Clojure's `call`/`list_lit` (macro-shaped defs), R's `binary_operator` and OCaml's `let_binding` (assignment-shaped), Erlang's `function_clause` (per-clause, not per-declaration), and deliberate omissions (Swift subscripts/deinits, C++ class bodies) explained inline.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Many entries are only safe because a paired check in `accepts` narrows a structurally ambiguous kind (call/list/binding) down to an actual function — reading this list alone without `accepts` would overcount for Elixir, Clojure, Lisp, OCaml, R and Nix.

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
- spec 2 · read at `97ab06ebed79` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:07Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Given the function's body node, looks at its first child statement; if it's an expression_statement wrapping a string literal, extracts and returns the string's text with quotes (and possibly indentation) stripped, as the Python docstring. Returns None if the first statement isn't a string literal.
- found: Skips leading comment nodes to find the first real statement, then if it's an expression_statement unwraps to its inner expression (else uses it directly); if that's a string node, extracts its text, strips quote chars and whitespace, and returns it. Otherwise returns None.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

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
- spec 2 · read at `fe5c77dc9b54` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:16Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a tree-sitter node's kind is in the given `kinds` list, treating that as sufficient for most languages. For Elixir specifically, since function defs, module defs, and imports all parse as the same `call` node kind, it likely does extra work — inspecting the call's head/function-name text (e.g. checking for "def", "defp", "defmacro") — to distinguish real function definitions from other calls.
- found: First checks the node kind is in the given `kinds` list, then applies a per-language disambiguation match: Elixir checks the call target is one of def/defp/defmacro/defmacrop; OCaml/F#/R/Nix/Clojure/Scheme/Racket/Prolog each have their own structural check to distinguish a real function definition from a similarly-shaped value binding or call; other languages just return true once kind matches.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: Docs only called out the Elixir special case, but the function actually special-cases eight languages with similar value-vs-function ambiguity problems.

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

### `name_node` — QUIRKY
- spec 3 · read at `675b18990ee4` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:44Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Tries node.child_by_field_name("name") as the common case, then falls back to language- and node-kind-specific handling for grammars where the name isn't exposed as a "name" field — e.g. an arrow function assigned to a variable (walk up to the variable_declarator's identifier), a Python decorated_definition (descend into the wrapped def), or similar per-kind/per-lang special cases — returning None if no name can be found.
- found: A giant match over ~25 languages, each with its own grammar-specific path to the name node: C/C++ walks down nested declarators (with special cases for operator overloads and conversion operators), ObjC/Odin/D/PowerShell/Verilog find a bare identifier or specific wrapper kind, Elixir/Cmake/Prolog pull the name out of call arguments/functor position, Lisp-family languages index into named_child positions, and several (R, Nix, OCaml) reuse an assignment-target field (lhs/attrpath/pattern); default falls back to child_by_field_name("name").
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The file doc's framing (kind-matching over queries, failing loudly) explains why this function exists but gives no hint of just how many languages and how idiosyncratic each one's name location is — that's only visible in the body's per-arm comments.

### `body_node` — QUIRKY
- spec 3 · read at `03bfaee5dbf3` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:49Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Given a function/chunk node and its language, finds and returns the child node representing the function's body block (e.g. "block" in Rust, "statement_block" in JS/TS, "block" in Python), matching by node kind per-language since queries aren't used. Returns None when there's no body — e.g. a trait/interface method signature with no implementation, or an arrow function with an expression body instead of a block.
- found: Per-language special-cased lookup of the body node: a handful of languages (R, Nix, Odin, Prolog, GdShader) need custom nested traversal because the body binds one level down from the function node or under a differently-named field; most others try the "body" field first, then fall back to a per-language node-kind name lookup (Kotlin, ObjC, Sql, Elixir, Haskell, D, Vhdl, PowerShell, Ada, Cmake each spell it differently), and the final default handles JS/TS-style `const Foo = () => {}` by reaching into the initializer's own body field.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The doc handed with this only described a sibling node ("the node holding the chunk's body") rather than this function itself, so it gave almost no signal about the dozens of per-language branches.

### `body_span`
- spec 2 · read at `1f2c8fc01706` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:26Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Tries to find a dedicated body node via `body_node(node, lang)`; if found, returns its byte range as Some((start_byte, end_byte)). For languages without a distinct body node (Julia, Fortran, lisps, Visual Basic), it falls back to computing the span as everything from `header_end` to the node's end byte, since the statements hang directly off the definition with no wrapping node.
- found: Tries body_node first and returns its byte range if present; otherwise falls back to header_end..node.end_byte, and guards against an empty/inverted span with a start<end check before returning.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Missed only the small guard against start >= end producing None instead of an invalid span.

### `header_end` — QUIRKY
- spec 2 · read at `12da39905fc3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:03:21Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: header_end matches on lang to pick the tree-sitter field name that marks where a given language's body starts (differs per grammar — e.g. a "body" or "docstring" field), calls node.child_by_field_name(...) for that field, and if found returns that child's start_byte() as the header's end offset; returns None if the node has no such field (so the caller falls back to some other boundary-finding strategy).
- found: Matches on lang and returns the end_byte of whichever grammar-specific node/field marks the last piece of the signature for that language (with fallback chains per language: signature node, function/subroutine statement, docstring-or-parameters, defun_header, return_type-or-parameters-or-name, port list or name, name, second named child, vec_lit or second named child), None for languages not in the unwrapped-body set.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `extract` — QUIRKY
- spec 3 · read at `7d27ef901a3a` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:15Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a tree-sitter node believed to be a function-like construct, verifies it's an accepted kind for the language, then pulls out the name (via name_node), body (via body_node/body_span), and header end (via header_end) to build a FuncDef struct with location and possibly doc info — returning None if the node doesn't match or is missing a name/body.
- found: Builds a FuncDef by extracting name, computing a body span, slicing the signature text before the body, and slicing the body text. Doc extraction is language-specific: Python looks for a docstring inside the body then falls back to a leading comment; Elisp reads a docstring field then falls back to leading comment; other languages check leading comment then walk out through wrapper declarations (e.g. const/export) to find one. Also computes owner and outgoing calls via helper functions.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `resolves_calls`
- spec 3 · read at `452f309691af` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:29Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Derives its answer from the call_sites table/function rather than a separate list: likely matches lang against the same match arms as call_sites (or calls call_sites and checks for Some/non-empty), returning true only for languages that table actually covers.
- found: Calls call_sites(lang) and returns true if the resulting collection is non-empty — matches the predicted derivation-from-call_sites idea, just via is_empty() on a returned list rather than is_some().
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `call_sites`
- spec 3 · read at `9ae2e8c95888` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T01:00:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A match on Lang returning a static slice of (node_kind, Option<field_name>) pairs per language describing what tree-sitter node kinds count as call expressions (e.g. call_expression with field "function", plus constructor forms like new_expression for Java/C#/TypeScript), with Swift/Kotlin entries using None for the field since their call shape has no named field, and a catch-all arm returning an empty slice for languages whose call shape hasn't been parsed/asserted.
- found: Match over Lang returning static (kind, field) pairs per language for call-expression detection; JS/TS/TSX also include new_expression and JSX element kinds so components read as calls; Java/C#/PHP have multiple entries; Swift/Kotlin use None field; unlisted languages fall to empty slice.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `callee_name`
- spec 3 · read at `48d805213e10` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:10Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks a callee expression tree-sitter node to find the trailing bare identifier (e.g. the `c` in `a.b.c()` or `T::c()`), likely by matching on node kind and recursing into the rightmost/field child for member-access or scope-resolution nodes, discarding any receiver/qualifier. The `depth` parameter is probably a recursion-depth guard that returns None once some max is exceeded, to avoid stack overflow on pathological trees.
- found: Recurses with a depth guard (CALLEE_DEPTH); first tries known field names (CALLEE_FIELDS) on the node and recurses into the first match; if none of those fields exist, falls back to the last named child (for fieldless grammars like Kotlin's navigation_expression or lisp-shaped forms) and recurses into that; base case takes the node's own text and returns it only if it looks like a bare identifier.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The fallback-to-last-named-child branch exists specifically for fieldless node shapes (Kotlin navigation_expression, lisp-style wrappers) — not obvious without the comment.

### `is_identifier`
- spec 3 · read at `e388d0505989` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:38Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Checks whether the string t is non-empty, starts with an alphabetic character or underscore, and all remaining characters are alphanumeric or underscore — a simple identifier-shape check to reject literals, operators, and punctuation-containing expressions from being treated as callee names.
- found: Non-empty check, first char alphabetic-or-underscore, all chars alphanumeric-or-underscore.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `calls_in`
- spec 3 · read at `b37d5521ba02` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:06Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Walks the subtree under `node` (likely via `walk_calls`) collecting call sites, extracts each callee's name via `callee_name`/`is_identifier` filtering to keep only real identifiers, then builds the result by pushing each name into a Vec only if not already present (dedup preserving first-appearance order), and caps the result at some maximum length to bound cost on huge functions.
- found: Looks up the language's call-site node kinds; if none defined, returns empty immediately (a language with no call shape says so). Otherwise sets up a dedup HashSet and output Vec and delegates the actual tree walk/collection to walk_calls.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: This is mostly a thin setup wrapper — the real dedup/cap/order logic lives in walk_calls, which I folded into this function's prediction instead of recognizing it was delegated.

### `walk_calls`
- spec 3 · read at `ef00daa12a6f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:52:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Iterative (explicit-stack, not recursive) depth-first walk of the tree-sitter tree in document order, matching each node's kind against `sites` (language-specific call-node kind plus optional field name for the callee) to recognize call expressions, extracting the callee name via a helper like callee_name, keeping only identifier-shaped names, and pushing each new name onto out while using seen to deduplicate repeated calls to the same target — descending into every nested node, including nested function bodies, since it reports the full call surface under `root`.
- found: Manual cursor-based DFS (goto_first_child / goto_next_sibling / goto_parent, terminating when goto_parent fails at root) matching each node's kind against sites, extracting the callee via a field name or first named child, resolving its name via callee_name, and pushing to out (capped at MAX_CALLS) while seen dedupes repeats.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I didn't predict the explicit MAX_CALLS cap enforced inline here.

### `calls`
- spec 3 · read at `3d6a4a903fcb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:10Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: calls is a test-helper wrapper that parses src (assumed to contain exactly one function) with tree-sitter for lang, extracts that single function via extract, and returns the ordered list of callee names inside its body — likely by delegating to calls_in/walk_calls on that one function's body node.
- found: Test helper: parses src into functions via parse_functions, asserts exactly one function was found (fixtures are expected to hold one), and returns a clone of that function's precomputed `.calls` field.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `every_resolving_language_finds_its_calls`
- spec 3 · read at `1571a09808d8` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loops over every language whose resolves_calls flag is true, parses a small fixture snippet for that language, runs calls_in/call_sites on it, and asserts the resulting call list is non-empty, catching a grammar node-kind rename that would otherwise silently yield zero edges for that language.
- found: Explicit per-language assert_eq! calls (not a loop) checking calls() extracts the exact expected list of callee names from a small hardcoded fixture snippet per language, including edge cases like C++ template calls, TSX components-as-calls, and receiver-dropping.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `a_language_with_no_call_shape_says_so_rather_than_reporting_zero`
- spec 3 · read at `7e82ece7ede7` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is a test that picks a language without call-shape support in this parser, parses some trivial source, calls extract(), and asserts that the resulting resolves_calls flag is false while calls is empty — proving the two states (no calls found vs. no call resolution) are distinguishable.
- found: Test asserting resolves_calls(Fortran) is false and resolves_calls(Rust) is true, then parsing a Fortran subroutine with a `call b()` statement and asserting the resulting function's calls list is empty despite Fortran having actual call syntax in the source.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_call_made_forty_times_is_one_dependency`
- spec 3 · read at `3759c9b4ec5a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:30Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A test: parses a function body that calls the same callee many times (e.g. 40x in a loop or repeated statements) and asserts that calls_in/calls dedupes to a single edge for that callee rather than one per call site.
- found: Test asserts repeated calls to the same callee (push x3, pop x1) dedupe/collapse in the extracted calls list, confirming the dedup behavior though the literal "forty times" in the name is just flavor, not the actual count used.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `only_identifiers_become_call_names`
- spec 3 · read at `b05d97141c41` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Constructs a source snippet where a call site's callee is not a plain identifier (e.g. an operator or expression being invoked), and asserts is_identifier/callee_name rejects it so it never becomes a call name entering the symbol table — proving non-name tokens can't spuriously link two unrelated functions.
- found: Parses Rust source containing an immediately-invoked closure `(|x| x)(1)` plus a plain call `b()`, asserts every found call name passes is_identifier, and asserts `b` is among them — confirming the closure-call callee (not a plain identifier) is excluded while the real named call survives.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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
- spec 2 · read at `e9c5499ba522` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:19:35Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Test that parses a small Rust source snippet whose top begins with `//!` module-doc comment lines, runs it through the file's extraction logic, and asserts the resulting file_doc equals the text of those `//!` lines (distinguishing them from regular `///` item doc comments, which a sibling test presumably checks are NOT treated as the file doc).
- found: Asserts file_doc() on a Rust snippet with leading //! lines returns their joined text as the file doc, and separately that parse_functions() still gives the function its own /// doc, confirming the two are distinct fields that don't bleed into each other.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

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
- spec 3 · read at `7da3bb03958c` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:37Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A Tauri backend module that maintains a persisted index of known projects (repos the user has opened), storing per-project metadata like disk size (for the delete button), harness, model, and reader settings — with load_index/save_index handling serialization to a JSON file under data_dir/index_path, and remember/note_size/set_harness/set_reader as mutators plus harness_for/model_for as accessors. It explicitly does NOT store analysis readings, which live only in the repo's own .sanity/ directory, per the doc note about a past bug where a second copy of readings could get silently restored after deletion.
- found: A persisted index of known projects (KnownProject: key, repo path, name, touched timestamp, file count, harness, model) stored as projects.json under a resolvable data_dir, with load/save (atomic write via tmp+rename), remember (idempotent add), note_size (early file-count recording so classification survives an interrupted first scan), set_harness/set_reader (machine-local per-project agent/model config), and harness_for/model_for accessors. Explicitly holds no analysis readings — those live in the repo's own .sanity/ directory.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: note_size and remember are both written eagerly (before a scan completes), specifically so an interrupted long scan (e.g. hours-long) still leaves a usable index entry — not obvious without the comments.

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
- spec 3 · read at `bf682903ff6a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:07Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, and if an entry for `key` doesn't already exist, inserts a new one with the given repo/name and touched: 0, then saves the index back to disk. If the entry already exists, it's left untouched (idempotent, no-op).
- found: Loads the index, returns early if a project with this key already exists, otherwise pushes a new KnownProject with touched:0 and files/harness/model unset, then saves the index.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `note_size`
- spec 3 · read at `ae9773f1bce3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:40Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, looks up the entry by `key`; if found, sets its files/size field to `files` and saves the index back to disk. If the project isn't in the index, does nothing (no entry created).
- found: Loads index, finds project by key, returns silently if not found; also skips the save if the value is unchanged (avoiding needless writes); otherwise sets files and saves.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc explains WHY this exists (walk-time recording vs scan-completion) well but not the unchanged-value short-circuit, a minor implementation detail.

### `set_reader` — TRAP
- spec 3 · read at `63ea11ca29ae` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Loads the project index, finds or creates the entry for `repo` (keyed by `key`), sets its display `name`, and for `harness`/`model` only overwrites the stored field when the corresponding Option is Some — leaving it untouched when None so a single-field update from the CLI doesn't clobber the other. Finally saves the index back to disk.
- found: Loads the index, inserts a new project entry (with the given name) if `key` isn't already present, then finds the entry by key and overwrites harness/model only where the Option is Some, leaving the other alone — but `name` is only ever set at creation time, never updated on an existing entry, then saves.
- predicted: most · documented: full · derivable: no · legible: full · trap: yes
- note: Calling set_reader on an already-known key with a different `name` silently does nothing to the stored name — only harness/model get updated on existing entries, so a caller expecting this to also rename an existing project will be surprised.

### `data_dir`
- spec 2 · read at `304076d2f901` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:08Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Checks the SANITY_DATA_DIR environment variable first (the test seam) and returns it as a PathBuf if set; otherwise falls back to the OS's standard data directory via the `dirs` crate, joined with an app-specific subfolder, returning None if the OS can't supply one.
- found: Resolves the SANITY_DATA_DIR env var if set, else dirs::data_dir() joined with "Sanity"; then eagerly creates the directory (create_dir_all) before returning it, returning None on either a missing OS data dir or a failed mkdir.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that it also creates the directory as a side effect, not just resolves the path.

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

## src-tauri/src/scan.rs

### the file itself
- spec 3 · read at `78a8c8c6ad9a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:51:39Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: The top-level scan pipeline: locate the git root, walk the repo respecting .gitignore/.sanityignore (collect_files), parse each file (parse_file) into functions, compute git history/blame per file, wire the call graph, score each file's functions into Nodes (score_dir) using the heuristic proxy model, collapse single-child directory chains so the sunburst doesn't render pointless single-ring nesting, and aggregate everything into the final tree — while streaming shape/progress events (Progress, shape_of) as the multi-phase scan runs so the UI can show something before scoring finishes. Includes a large test suite pinning invariants like stable function identity across edits, gitignore exclusion, and graceful handling of empty/non-git directories.
- found: The full repo-scan pipeline: gitignore/.sanityignore/VENDORED-aware file walk, tree-cache early-return check, git history+blame reading, cached parsing into functions, call-graph wiring, per-function scoring (score_dir) with churn/age/documentation/distinctiveness, tree assembly with directory-chain collapsing and score aggregation, then an optional priority-ordered model-scoring pass streaming updates over three separate channels (progress/shape/scored) so the UI draws incrementally on multi-hour scans, finishing with cache persistence. A large test module pins invariants (stable function identity, gitignore exclusion, fidelity-invariant tree shape, empty/no-git handling, sibling context correctness).
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: I predicted the major pipeline stages correctly (walk/parse/history/wire/score/collapse/aggregate/stream) but missed the caching layer, VENDORED hardcoded exclusions, the priority-ordered model pass, and that there are three distinct streaming channels rather than one.

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

### `commit_count`
- spec 3 · read at `8f60522f224c` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:35:16Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Shells out to git (or uses a git library) in the given repo path to count commits reachable from HEAD excluding merge commits, e.g. equivalent to `git rev-list --count --no-merges HEAD`. Returns 0 if the command fails or there is no history (e.g. not a git repo, or no commits yet), rather than propagating an error.
- found: Shells out to `git -C <repo> rev-list --no-merges --count HEAD`, parses stdout as usize, and returns 0 on any failure (command error, non-zero exit, or parse failure) via chained Option combinators.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `at`
- spec 3 · read at `ee2b84394814` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:33Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Progress::at(done, total) constructs a Progress value by directly wrapping the done and total fields into a struct literal, representing one step of a countable job for later emission to the frontend.
- found: Constructs a Progress struct with done and total set, and phase/unit/at left as empty strings (presumably filled in by other Progress methods like phase()/counting()/on()).
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `phase`
- spec 3 · read at `3e3b26bd5870` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Progress value representing an in-progress phase labeled by `what`, with no numeric count/total yet available (since the job "cannot yet be counted"). Likely just sets a message/label field and leaves count-related fields as None or zero, used for early UI progress reporting before file counts are known.
- found: Constructs a Progress struct with done=0, total=0, phase set to the given label, and empty unit/at strings.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `counting`
- spec 3 · read at `5a097e33ccf4` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Progress with phase set to `what`, unit set to `unit`, and done/total set to the given counts, with `at` left empty since there's no specific current item name.
- found: Constructs Progress with phase, unit, done, total set, and at left empty.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `on`
- spec 3 · read at `4a2b6e1820bb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:32Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builder-style method on Progress that sets the current subject (e.g. file path being processed) into a field on self, then returns self so it can be chained with other builder methods like phase()/counting()/at() before being emitted as a progress event.
- found: Builder-style setter that assigns path into self.at field and returns self for chaining.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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

### `parse_file`
- spec 2 · read at `6cc452bc8899` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:16:07Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads the file's content and hashes it, checks the cache for a prior parse of that path with a matching hash; on a hit reuses the cached AST/function list, on a miss invokes the language-specific parser to build a fresh ParsedFile. In both cases it recomputes per-function fingerprints (as a HashSet<u64>) unless fidelity == Ordering, since fingerprints are cheap to derive but expensive to store. Returns None if the file can't be read or is excluded by the gitignore scope.
- found: Looks up the file in cache.look() by rel path (Unreadable→None, Hit→reuse cached funcs/doc/head/hash, Miss→parse via parse::parse_functions, bail if empty or any line exceeds a minified-line threshold, also parse file_doc and capture a head snippet, then store into cache). Computes fingerprints via the print() closure, skipped entirely at Fidelity::Ordering. Separately (always, not gated on cache hit/miss) recomputes whether the path is gitignore-excluded via `scope`, since .sanityignore can change independent of file content, and stamps that onto the returned ParsedFile so excluded files are still counted rather than silently dropped from the walk.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `apply_dir_history`
- spec 2 · read at `c4f036e60dfa` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the Node tree; for each Dir node it looks up the distinct commit count for that directory's path in `history` and sets it on the node, then recurses into children. Per the doc's note, it also handles File nodes the same way (looking up commits by the file's own path) since aggregate() left file commit counts at 0.
- found: For Dir and File nodes, looks up the node's path in history.commits_of and writes the result into node.score.commits (if score is Some); then recurses into all children regardless of kind.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `score_dir` — QUIRKY — TANGLED
- spec 3 · read at `3420970e5462` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:24Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Groups the given flat slice of parsed files by their top-level directory and, for each file, builds function Nodes scored via the heuristic model (using history/blame for churn/age/provenance and `wiring` indexed by `base`+offset for caller/callee counts), assembling file Nodes from those functions. Returns a list of (directory-name, Node) pairs — one aggregated subtree per top-level directory — for the caller to fold into the full repo tree.
- found: For each file (not directory-group, despite the function name) in the slice, builds a Node per function — scoring via heuristic::surprise/documented using per-function blame history (falling back to file-level history), fingerprint-based distinctiveness against same-file/directory peers (skipped at Ordering fidelity), and wiring lookup by base+index — then wraps them into a file Node whose body hash is a "surface" hash (signatures only, not text) so implementation-only edits don't expire a file-level reading. Returns one (rel_path, fileNode) pair per file.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: I assumed directory-level grouping/aggregation from the name `score_dir`; it actually operates per-file and returns one entry per file — the "dir" in the name refers to the caller's directory-batched invocation, not grouping logic inside this function.

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

### `scan` — TANGLED
- spec 3 · read at `b0aa46de4de2` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:32Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks the directory tree under root (skipping gitignored paths), calling parse_file on each file and streaming parsed files per directory via on_shape; builds the directory/file tree (insert/context_for/scope_of), applies git history via apply_dir_history, runs the surprise model over functions while invoking on_scored per function and on_progress per directory, aggregates scores upward with score_dir/apply_model_scores, collapses single-child directory chains via collapse_chains, and returns a Scan with the resulting tree. Checks cancel periodically so stopping early still returns everything scored so far rather than nothing.
- found: Walks and parses files per directory in parallel (streaming shapes via on_shape), reads git churn and per-file blame history, resolves call-graph wiring repo-wide, builds a fast "proxy" gray tree first via score_dir/insert/collapse_chains/aggregate/apply_dir_history so the UI has something instantly, then (if a real model) builds a priority-ordered work queue (by proxy surprise, not size) over all functions, reusing cached readings and streaming freshly scored ones via on_scored/on_progress, applies the upgraded scores back onto the tree and re-aggregates/re-applies history, and finally caches the whole Scan keyed on a content signature for instant reload next time.
- predicted: most · documented: none · derivable: yes · legible: some · trap: no
- note: Missed from my prediction: the treecache signature short-circuit, the separate blame-vs-churn history phases, the priority-by-surprise work queue, call-edge wiring, and the two-pass proxy-then-model tree construction.

### `fixture`
- spec 2 · read at `f6944d8e34fb` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:31Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Shared test helper that creates a tempfile::TempDir, writes a small set of sample source files (a few functions, maybe multiple languages/dirs) into it to be scanned by the surrounding tests, and returns the TempDir handle for the caller to point scan() at.
- found: Creates a temp dir with a nested src/deep/nest/a.rs containing two documented functions, plus a .gitignore excluding vendor/ and a vendor/huge.rs file that should be skipped by the scan — set up specifically to test gitignore exclusion.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `the_streamed_shape_matches_the_tree_it_precedes`
- spec 3 · read at `706486a20475` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:46Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A test that runs scan() on a fixture repo with an on_shape callback that captures the streamed placeholder shape, then runs the full scan to get the final tree, and asserts that the paths/structure captured by on_shape match (e.g. same set of file/dir paths) the final tree — proving the streamed loading picture isn't empty or wrong relative to what actually gets returned.
- found: Runs scan() with an on_shape callback collecting streamed ShapeFile entries, then walks the final scanned tree collecting (path, name, loc) for every function node, and asserts the sorted sets are exactly equal between streamed and final — also checks streamed isn't empty.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `payload`
- spec 3 · read at `5542fedce063` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:06Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: An ignored test that runs a real scan (likely on this repo itself or a fixture), serializes the resulting tree/shape to JSON as it would be sent over IPC to the frontend, and prints its size in bytes so a developer running it manually (via --nocapture) can see how large the payload gets for a big project.
- found: Ignored benchmark test: scans a repo given via REPO env var (using a persistent scan cache to measure launch cost, not cold-scan cost), serializes full and "slim" (trimmed) JSON, times the trim+encode steps, then breaks down total bytes by field (docs/ids/paths/names/bodies) across all functions and prints everything for a human to read.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the persistent-cache-vs-first-look framing and the per-field byte breakdown; the doc's point about IPC vs drawing wait time wasn't obvious from the signature alone.

### `ordering_fidelity_changes_the_score_and_nothing_else`
- spec 3 · read at `10372e253fc6` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:46:59Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Test that builds a fixture repo, runs `scan` at Full fidelity and at Ordering fidelity, then asserts the resulting trees are structurally identical (same files/functions/lines/ids) while only the surprise/score values differ — specifically that Ordering reports UNDECIDED for the distinctiveness term instead of a number.
- found: Scans a fixture repo at Full and at Ordering fidelity, then asserts stats.functions, stats.files_scanned, root.loc, and the sorted set of function node ids are all identical between the two runs (plus a sanity check that the id list isn't empty). It does not actually assert anything about the surprise/distinctiveness score differing or reporting UNDECIDED — that claim lives only in the doc comment, not the test body.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment promises the surprise term becomes UNDECIDED at Ordering fidelity, but this test never checks scores at all — only tree shape/ids — so that half of the contract is untested here.

### `run`
- spec 3 · read at `e1e3e059ac56` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:17Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A test-only helper that calls scan(dir, ...) with no-op closures for on_progress/on_scored/on_shape, a default (non-model) SurpriseModel, an unset cancel flag, and default Fidelity/Memos, then unwraps the Result to return the Scan directly — sparing the tests below from repeating scan's full argument list.
- found: Test helper: builds an ephemeral Memos, calls scan() with the HeuristicModel, no-op progress/scored/shape closures, an always-false cancel flag, and Fidelity::Full, then unwraps the Result.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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
- spec 3 · read at `ec72fda3c1ea` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:09Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A test that builds a fixture file with several functions, where the target function being scored is positioned later in the file, not among the first few. It then checks the context/peers passed to the prompt for that function are the ones physically adjacent to it (before/after in the file) rather than always the first two functions in the file, asserting the fix for the layout-dependent bug described in the doc.
- found: Builds a fixture with 8 sequential functions f0..f7, calls context_for on function index 6, and asserts the context includes f5 (immediate predecessor) but excludes f0 (top of file) and f6 (itself). Also checks a boundary case: a function at index 0 still gets a full window of neighbors (f1, f2) from the side that has them, excluding itself.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: None.

### `an_edit_above_a_function_does_not_change_its_identity`
- spec 3 · read at `ec7b278b5b75` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:31Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A test that scans a fixture file to get a function's id, then modifies the fixture by inserting a line above that function (e.g. an import), rescans, and asserts the function's id is unchanged despite its line number shifting.
- found: Scans a fixture with two functions, records their sorted ids, then rescans after inserting a `use` import above them, and asserts the id lists are identical — confirming ids are content/name-keyed rather than line-keyed.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `same_named_functions_keep_separate_identities`
- spec 3 · read at `aae47514bf3a` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:57Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds a small fixture source file containing two functions with identical names (e.g. overloaded or in different scopes), runs it through scan, and asserts the two resulting nodes get distinct ids/identities — proving identity is derived from position rather than name alone, so they aren't collapsed or confused with each other.
- found: Writes a fixture file with two `go` methods on different impls (A and B), scans the dir, collects ids of all Func nodes, and asserts they are `a.rs#go` and `a.rs#go#2` — confirming the second same-named function gets a disambiguating suffix rather than colliding with or overwriting the first.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `scanning_an_empty_directory_is_not_an_error`
- spec 2 · read at `b0c1952516fb` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:21:56Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Creates an empty temporary directory, calls scan() on it, and asserts the result is Ok with an empty (or root-only, childless) tree rather than an error or panic.
- found: Creates an empty tempdir, calls run() on it, and asserts the resulting stats have zero functions and the root node has zero lines of code — confirming an empty directory scans cleanly rather than erroring.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/scancache.rs

### the file itself
- spec 3 · read at `0d3dfea8c80e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:53Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Defines ScanCache, an append-only on-disk cache keyed by file hash/mtime that memoizes two expensive per-file scan costs — the tree-sitter parse and git blame — to avoid paying them again on every project open (measured at 51.5s/open on a large C++ repo). Includes open/ephemeral/warm for loading, look/cached_blame for reads, put_parse/put_blame for writes, retain/touched for dropping entries for files no longer in the scan, and save for appending rather than rewriting the whole store. Uses git plumbing (git_head/is_ancestor) to decide when a cached blame is still valid across commits, an fnv hash for keys, and has an extensive table of named invariant tests covering staleness rules (uncommitted edits, reverted files, torn last lines, parser version changes).
- found: ScanCache, an append-only newline-delimited-JSON log per repo, gated by (mtime,len) then confirmed by an fnv content hash, storing parse (FuncDef list + file_doc) and blame (keyed additionally by last-touching commit oid, with an ANCIENT sentinel for files outside the churn window) per file. Lazily loads the store on first actual use (not on open/construction) since many launches never need it; batches changes and appends every FLUSH_EVERY, compacting/rewriting when the log grows past COMPACT_RATIO× its live entry count or when a retain() removes entries (which an append can't express). A version mismatch (format or parser) drops the whole cache; a rewritten history (HEAD not an ancestor of stored HEAD) drops only blame halves.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Missed the deliberate lazy-load-on-first-use design (a big perf fix in itself) and the Look enum's three-way Hit/Miss/Unreadable API shape.

### `ephemeral`
- spec 3 · read at `a062c5e6098e` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:40:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Constructs a ScanCache with no backing file path (e.g. path field set to None or similar), so that store/save become no-ops and nothing persists to disk. Likely just builds a ScanCache with empty in-memory maps for parse/blame entries and a marker that suppresses writing to a cache file.
- found: Builds a ScanCache with path=None (disabling save), an inner Stored default seeded with the current format/parse version, empty dirty tracking, and empty head/repo fields.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `open` — OBSCURE
- spec 3 · read at `98943a8af1dd` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:34:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loads the on-disk cache file for `repo` (likely via `path_for` + `look`/read). If the format/version doesn't match, discards everything and returns an empty/fresh ScanCache. Otherwise gets current git HEAD, and if the previously cached HEAD is not an ancestor of it (history rewritten), it drops only the blame-related cache entries while keeping the parse entries, then returns the resulting ScanCache.
- found: open() is actually lazy — it just records the path, git HEAD, and initializes empty/unread inner cache and dirty-tracking state. The actual file read and the two-level invalidation logic described in the docs happen elsewhere (in `store`, per the comment), triggered only when something asks for a cached entry.
- predicted: none · documented: most · derivable: no · legible: full · trap: no
- note: The invalidation logic the doc comment describes is not in this function at all — it's deferred to `store`/`look`; open() is just cheap state setup.

### `warm`
- spec 3 · read at `6f62262e1ced` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:45Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Forces the lazily-loaded cache file content (normally read on first `store` access during the first `parse_file` call) to be read eagerly right now, while still in a phase labeled appropriately for this cost, instead of letting it silently happen under the "reading the commit log" phase label. It probably just touches/locks the store and reads it once, doing nothing (cheaply) if there's no cache file to read.
- found: Calls self.store() and immediately drops the returned guard, forcing the lazy file load (and the lock acquisition/release) to happen now under this call's own labeled phase, rather than under whatever later phase happens to trigger the first store() access.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `store`
- spec 3 · read at `d9785ce4a9a1` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:17Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Lazily initializes and returns a MutexGuard to the Option<Stored> cache. Locks the mutex; if the contents are None, reads the cache from disk (or creates empty), applies invalidation logic: drops everything if the format/parser version doesn't match, and drops only blame entries (not parse entries) if history was rewritten (rebase changes blame without changing file bytes). Returns the guard so callers can access the now-populated store.
- found: Double-checked locking: returns early if already populated. Otherwise reads from disk, applies version filter via a functional chain (falls back to a fresh empty Stored on any mismatch/read failure), then does the ancestor-based blame invalidation (only when head differs AND stored head is not an ancestor of current repo head), records line count in a separate `dirty` mutex, stores and returns the guard.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The doc comment explains the invalidation rationale well but doesn't mention the double-checked-lock early return or the dirty.lines bookkeeping.

### `path_for`
- spec 2 · read at `4e72bf5bc4c5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:35Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: path_for computes the on-disk cache file location for a given repo: it hashes the repo's absolute path (likely with the fnv helper seen among peers) to get a filesystem-safe identifier, then joins that hash as a filename onto some app-specific cache directory (probably from a platform dirs crate). Returns None if the cache directory can't be determined (e.g. no home directory available).
- found: Joins "scans" onto crate::reports::data_dir(), creates that directory if missing, then hashes the repo path with fnv and returns dir/{hash:016x}.json, or None if data_dir() is unavailable.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `look` — QUIRKY
- spec 3 · read at `842e7819e80c` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:39:00Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Looks up rel_path's cached entry and decides whether it's still valid, comparing the cached last_commit oid against the one passed in to short-circuit without reading the file when they match (or both are None, outside the churn window). Only reads/hashes the file's content when that commit comparison can't settle it, and returns a Look value telling the caller whether to reuse the cached parse/blame or redo the work.
- found: Freshness is actually gated by mtime+len (a stat, no read) matching the cached entry — that's the fast path returning Look::Hit without touching file bytes. Only on a gate miss does it read+hash the file; if the hash still matches the cached entry (byte-identical despite mtime/len drift) it still hits and lets a later save restamp the gate. `last_commit` isn't used for parse/hash freshness at all — it only decides whether the cached `blame` sub-field is still applicable (blame_commit == want), independent of whether the parse hit or missed.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I wrongly assumed last_commit drove the main cache-hit decision; it only gates reuse of the blame field, orthogonal to the mtime/len/hash-driven parse cache decision.

### `cached_blame`
- spec 3 · read at `f41988f043d5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Looks up the cache entry for rel_path in the store; if found, compares its stored content hash against `hash` and its stored last-commit oid against `last_commit`, and returns the cached FileBlame (cloned) only if both match. Returns None if the entry is missing or either condition fails to hold, since either mismatch alone can indicate the blame is stale.
- found: Looks up the store entry for rel_path; returns None if the store or entry is missing, or if the entry's hash differs from `hash`, or its blame_commit differs from last_commit (using a sentinel ANCIENT value when last_commit is None). Otherwise clones and returns the stored blame (which is itself an Option, so a hit can still yield None).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: last_commit=None is mapped to a sentinel ANCIENT string for comparison rather than special-cased — worth knowing if adding a new no-commit case.

### `put_parse` — TRAP
- spec 3 · read at `13e244d6f589` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:41Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Inserts/updates an in-memory cache entry for `rel_path` keyed by `ident` (probably a content hash), storing the language, parsed functions, file doc, and the current git HEAD, while leaving/preserving the blame field of the entry alone (or setting it None) since blame is populated separately by put_blame. Does not touch disk — that happens in `save`.
- found: Locks the store, carries forward the previous entry's blame/blame_commit only if the content hash is unchanged (otherwise resets to None/empty), then inserts a new Entry with mtime/len/hash/lang/funcs/file_doc/head, and marks the path touched. Matches my prediction closely including the blame-preservation detail.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The blame-carryover is gated on ident.hash matching, not on rel_path alone — a caller who calls put_parse for a changed file and expects stale blame to silently vanish is fine, but anyone assuming blame always survives a put_parse would be bitten; this is called out in the doc so it's a documented trap, not a silent one.

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
- spec 2 · read at `814484f4c4b2` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Serializes the header fields of a Stored struct (e.g. git HEAD, schema/version info) to a single-line JSON string, forming the first line of the append-only log-format cache file, used to validate cache metadata before applying subsequent per-file entry lines.
- found: Serializes version, parse, and head fields of a Stored struct into a JSON object string with a trailing newline, forming the header line of the log-format cache file.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `entry_line`
- spec 2 · read at `21a32316ab68` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:25:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Serializes an Entry (its cached hash/data fields) plus the given key into a single delimited text line, for writing to the on-disk line-based cache file that ScanCache reads back later.
- found: Serializes {key, entry} as one JSON object per line (JSONL format), swallowing serialization errors into empty string.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Format is JSON-lines rather than a custom delimited format; error path is silently swallowed via unwrap_or_default.

### `read_log`
- spec 3 · read at `7126485c2333` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:11Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Splits the text into lines, parses the first line as a header (into version/parse-version fields of Stored), then uses rayon to parse the remaining lines in parallel directly into Entry values (one parse pass, not two), folding them into the Stored map keyed by content hash. Returns the populated Stored plus the number of entries read (or lines processed) for logging/stats.
- found: Filters blank lines, parses the first non-empty line as a Header into version/parse/head fields, then rayon-parallel-parses the rest as Row(k,e) pairs (silently dropping unparseable rows), and folds them into the entries HashMap; returns (Stored, count read).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I guessed it hashed content itself, but keys come pre-attached in each Row (k field) rather than being computed here.

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
- spec 3 · read at `514d5f7eb935` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:08Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A small test-fixture helper that constructs a FuncDef with the given name and placeholder/default values for all other fields (location, body, etc.), used to build minimal function fixtures in scancache's unit tests.
- found: Test-fixture helper building a FuncDef from a name, with a synthesized signature, trivial placeholder body, no doc/owner, start/end line both 1, and no calls — used throughout scancache's unit tests.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_new_cached_field_cannot_be_added_silently`
- spec 2 · read at `fc62ad5a76aa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:34Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Serializes a default/example `Entry` to a JSON value (or similar), extracts its set of field names, and asserts that set equals a hardcoded literal list of expected field names. If someone adds a new field to `Entry`, this assertion fails, forcing them to notice and consider bumping FORMAT_VERSION — the field list itself is the tripwire.
- found: Builds a concrete Entry, serializes it to serde_json::Value, extracts and sorts its object keys, and asserts the list equals a hardcoded field-name list with a message telling the editor to bump FORMAT_VERSION and update the list — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

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

### `a_cache_from_a_different_parser_is_not_reused`
- spec 2 · read at `2b2adf3b33c6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:03Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Constructs a cache entry written under one parser version for a file, then re-reads/looks it up as if scanning under a different parser version (same content/hash), and asserts the old entry is not reused (treated as a cache miss / dropped), verifying that a parser-version change invalidates cached parses even when hash and git-HEAD staleness checks would say "unchanged."
- found: Builds JSON header strings with FORMAT_VERSION and varying `parse` version (matching, newer, or absent/None), parses them via read_log, and checks a `live` predicate (version + parse match current build) — asserting current-parser headers are live, mismatched-parser headers are not, and headers with no parse field at all are not live either.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 2 · read at `7eb1b9603ae1` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:47Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Constructs a Reading struct with the given surprise score, setting other fields (documented, legible, predicted, model label, etc.) to defaults/None since this reading comes from the heuristic proxy model rather than an actual MCP reader.
- found: Constructs a Reading with just the given surprise score and an empty hotspots Vec — the Reading struct turned out much smaller (only two fields) than I assumed; there's no separate documented/legible/model-label fields to default here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I overestimated Reading's field count, expecting several defaulted metadata fields; it only has surprise and hotspots.

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

## src-tauri/src/treecache.rs

### the file itself
- spec 3 · read at `bca1662ab80f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Caches the fully-built, aggregated project tree (the output of folding scancache's parse/blame data together) so a launch can load a saved tree instead of re-parsing and re-aggregating everything. It computes a signature/hash of current repo state (signature, mix, head_of) to check staleness (stale, current) against a saved cache, and loads/saves the tree, possibly in a reduced "slim" form, split into halves for incremental writes (slim, split, halves, load, save, path_for).
- found: Caches the fully-built Scan tree in binary form (bincode) keyed by a signature hash of everything the scan depends on (file paths/mtimes/lengths, git HEAD, parse version, fidelity, .sanityignore contents). Also writes a 'slim' version (tree without functions) alongside for fast draw-first-then-verify launches; save() writes both atomically via tmp+rename, slim second.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: halves/split are #[cfg(test)] ignored benchmarks, not part of the runtime API — not guessable from names/peers alone.

### `config`
- spec 3 · read at `1723b014079a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:07Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns a shared bincode::config::Configuration used for both saving and loading the tree cache, likely bincode::config::standard() with some explicit settings (e.g. fixed-width integers or little-endian) chosen for fast, deterministic encoding/decoding, so save/load call sites don't have to repeat the same config inline.
- found: Just returns bincode::config::standard() with no customization — a single shared config constant for save/load call sites.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I over-predicted custom settings (fixed-width ints, endianness); it's the plain default standard() config.

### `current`
- spec 3 · read at `443b674f9098` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:07Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Walks the repo now (independent of any cached data) to compute a signature/hash of its current state combined with the fidelity setting, returning a u64 that can be compared against a previously cached signature to decide whether the cache is stale.
- found: Collects the repo's current file list via collect_files and delegates to signature() with the fidelity to produce the u64 hash.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `slim`
- spec 3 · read at `5211cc855c8f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes the slim cache path for repo, reads/deserializes the trimmed tree file, and checks its stored signature matches the given signature (cache still describes this repo state) — returns Some(Scan) if valid, None if missing or the signature doesn't match.
- found: Delegates to read_slim to load the cached (signature, scan) pair, then returns the scan only if the signature matches, else None.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `stale`
- spec 3 · read at `04470122e2f9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:09Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Calls read_slim(repo) and, if present, returns its Scan field immediately without checking whether the repo has changed since — matching the doc's description of drawing "the last map without asking whether it is still true," to be shown while a fresh scan runs behind it.
- found: Reads the slim cache and returns its Scan unconditionally-of-repo-freshness, but does gate on the parser version matching PARSE_VERSION — the one thing the doc says is not skipped, since a stale-but-same-parser scan is fine to show immediately while a stale-parser one is not.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `read_slim`
- spec 3 · read at `7f5a653234e2` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:57Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes the slim cache path via slim_path(repo), reads the file if it exists, decodes it with bincode using config(), and returns Some(Cached) on success or None if the file is missing/unreadable/fails to decode.
- found: Reads and bincode-decodes the slim cache file at slim_path(repo), returning None on any missing path/read/decode failure, and additionally only returns Some if the decoded cache's version matches the current VERSION constant (otherwise treated as stale/None).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `slim_path`
- spec 3 · read at `ec5a956b05d6` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes the filesystem path to the cached "slim" tree file for a given repo, probably by deriving a key from the repo path (hash or normalized name) and joining it with a cache base directory; returns None if that base directory is unavailable.
- found: Delegates to path_for(repo) for the base cache path, then swaps the extension to "slim.bin" — simpler than a hash/key derivation, just reuses the existing path_for logic.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `path_for`
- spec 3 · read at `e0070957f8c2` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:38Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the on-disk cache file path for a given repo's cached tree, likely under some app cache/data directory, derived from a hash or sanitized form of the repo's absolute path. Returns None if the cache directory can't be determined (e.g. dirs::cache_dir() fails).
- found: Joins the app's data dir with "trees", creates it if needed, then FNV-1a hashes the repo's path string into a hex filename ("{hash}.bin"), returning None if the data dir or directory creation fails.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `mix`
- spec 3 · read at `c6aa92602bb0` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:18Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: mix implements the standard FNV-1a fold-in step — for each byte in bytes, XOR it into *h then multiply by the FNV prime, mutating h in place.
- found: Standard FNV-1a byte-folding loop: for each byte, XOR into *h then wrapping-multiply by the FNV prime 0x100000001b3.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `signature`
- spec 3 · read at `64b211df8f43` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:43Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes a single u64 hash fingerprinting everything the scan output depends on: folds together the sorted list of files (paths + languages), the fidelity setting, and likely the git HEAD commit, using a mixing helper, so a cached tree's validity can be checked with one cheap integer comparison rather than re-deriving the scan.
- found: Mixes parse/cache version constants, fidelity, git HEAD, .sanityignore contents, and each file's path plus size/mtime into a running hash to produce a single u64 signature for cache validity.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `head_of`
- spec 3 · read at `cf9e54b3cc4f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns the current git HEAD commit hash (as a string) for the given repo path, used as part of the cache key/signature so a saved tree is only reused when the repo is still at the same commit. It likely reads .git/HEAD and resolves symbolic refs itself rather than shelling out to git, falling back to something (like "unknown") if the repo has no commits or isn't a git repo.
- found: Shells out to `git -C repo rev-parse HEAD` and returns the trimmed stdout, or empty string if the command fails/repo has no git.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `load`
- spec 3 · read at `9000d0b56dbd` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:32Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up the path for this repo's cached tree file, reads and deserializes it if present, and checks whether its stored signature matches the passed-in signature (i.e. the repo hasn't changed). Returns Some(Scan) if the cache is fresh and matches, otherwise None so the caller falls back to a full scan.
- found: Reads bytes from the cached file path for the repo, bincode-decodes it into a Cached struct, and returns Some(scan) only if both the format VERSION and the signature match, else None.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I predicted json/generic deserialize and a separate signature check step; it's actually bincode with serde and a single combined version+signature check via then_some.

### `save`
- spec 3 · read at `0793bee923f4` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:36Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes a cache path via path_for(repo, signature), serializes `scan` (likely via bincode/serde), and writes it to disk, probably via a temp-file-then-rename for atomicity. Given peers slim/slim_path/split/halves, it likely also derives and writes a smaller "slim" variant of the tree. Write failures are silently swallowed (no Result returned), matching the doc that a failed write is never reported.
- found: Serializes the full Scan (with version/signature/parse-version metadata) via bincode to a temp file then renames into place for atomicity, silently returning on any failure. Then does the same for a "slim" version of the scan (root.slim() plus stats), written to a separate path — written second/read first intentionally, since a slim-without-full is just a re-scan but a full-without-slim would leave the map with no visible functions.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `halves`
- spec 3 · read at `43820175ad5a` · commit `443bab0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:59:17Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: An #[ignored] benchmark test that reads the REPO env var, times how long it takes to load just the slim/drawable half of the cached tree versus loading or deriving the whole tree, and prints timing/size comparisons via println! since it's run with --nocapture for manual inspection rather than as an assertion-based test.
- found: Reads REPO env var; times computing the current scan signature (walk), loading the cached stale/slim tree, and loading the whole cached tree by signature; counts nodes in each via visit, then prints a comparison line of timings and node counts.
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
