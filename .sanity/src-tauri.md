# src-tauri — sanity assessment

287 of 409 functions read · 13 surprising · 43 stale

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## src-tauri/build.rs

### `main` — as expected
- read at `4b8ff0908edc` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The entry point for a Rust build.rs script. Likely contains minimal build-time configuration, possibly just calling framework setup functions like tauri_build::build() or similar.
- found: The build.rs entry point that calls tauri_build::build(), which is the standard Tauri build configuration for compile-time setup.
- predicted: full · documented: none · derivable: yes

## src-tauri/src/agentapi.rs

### `persist` — nearly
- read at `ff0713758319` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A 27-line method on AppState that writes the project list to disk. Based on the extensive doc, it likely reads the existing project list from disk, performs a merge (keeping projects not in the current session and updating ones that are), then writes back the merged result. This prevents data loss when restarts occur during restore operations or when projects become temporarily unavailable.
- found: The method builds a `live` list of KnownProject structs from the current in-memory projects with key, repo path, name, and touched timestamp. It loads the existing index from disk, retains only projects not in the current session (so on-disk projects not loaded are kept), then extends with the live projects (updating current ones). It conditionally updates the active project only if the current session has one. Finally, it sorts by touched timestamp (most recent first) and saves the merged index back to disk.
- predicted: most · documented: full · derivable: no

### `touch` — nearly — STALE
- read at `9472c98218bb` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Mark the resource identified by the key as touched/accessed by updating a timestamp or counter, and trigger persistence to save the state change. Likely used to track when projects were last accessed.
- found: Increments the clock counter, stores the value, sets the touched timestamp on the project with that key to the current clock value, sets the active project to this key, and calls persist() to save the state.
- predicted: most · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ping` — nearly
- read at `0facbb877de9` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Records that a tool was called, possibly extracting and storing the outcome from the tool name suffix for decision-making purposes.
- found: Records a tool call by updating the last agent timestamp and tool name, incrementing a call counter, and appending (counter, tool name) to a recent calls deque. Maintains a bounded history by removing the oldest entries when the deque exceeds RECENT_CALLS limit.
- predicted: most · documented: most · derivable: no

### `for_client` — as expected — STALE
- read at `f2ffe2ecd7c1` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Returns the project key the client call belongs to. If a project is supplied, checks if it exists and returns it; if not found, returns None rather than falling back to active (preventing cross-repo contamination). If no project supplied, returns active project.
- found: Matches on project parameter: if Some(k), checks if k exists in projects and returns it or None; if None, returns active project.
- predicted: full · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `load_reports` — as expected
- read at `01746026f963` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Loads all project readings from the .sanity directory in the repo, parsing assessment files and returning a HashMap of stable keys (path#name#ord) to Report objects, using the scan to determine function identities.
- found: Delegates to crate::assessment::load(repo, scan) which handles loading reports from .sanity/.
- predicted: full · documented: full · derivable: no

### `save_reports` — nearly
- read at `28bb790d71ff` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Persists agent reading reports to the repository's .sanity/ directory. Takes the scan and reports map, writes them to files in the repo, and returns a detailed error if the write fails (ensuring failures are visible to the caller rather than silently falling back to a hidden file).
- found: A thin wrapper around `crate::assessment::save()` that delegates the actual persistence logic. On error, wraps it in a detailed message that specifies the failed directory path and warns that readings are held in memory but NOT saved, advising the user to fix permissions or risk losing work when Sanity closes.
- predicted: most · documented: none · derivable: yes
- note: It's primarily a wrapper that delegates to assessment::save() and focuses on error formatting, not the actual save logic as I initially predicted.

### `project_key` — nearly
- read at `d71433e7a371` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function canonicalizes a file path to a project key, normalizing relative paths (`.`), home directory paths (`~/x/`), and absolute paths (`/x`) so they all resolve to the same unique identifier.
- found: It calls std::fs::canonicalize() to resolve the path to an absolute canonical form, falls back to the original path if canonicalization fails, and returns the result as a string.
- predicted: most · documented: none · derivable: yes

### `surprise` — as expected
- read at `408dcd0a0e86` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This method converts a prediction grade (full/most/some/none) into a numerical surprise value from 0 to 1. The scale is non-linear, with closer spacing between confident grades (full/none) to distinguish the meaningful boundary between "expected" and "unexpected" code.
- found: Maps Grade variants to specific surprise values: Full→0.08, Most→0.30, Some→0.62, None→0.92. The spacing is non-linear with distinct gaps between each grade.
- predicted: full · documented: most · derivable: no

### `documented` — as expected
- read at `a7b49816438a` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This is a method on the Grade type that returns a floating-point score representing how well documented the code is at this specific grade level. It extracts the documentation quality metric from the Grade struct.
- found: It matches on Grade variants and returns a corresponding f32 score: 0.95 for Full, 0.7 for Most, 0.35 for Some, and 0.0 for None.
- predicted: full · documented: full · derivable: no

### `blank` — as expected
- read at `473c0710bb81` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function constructs and returns an empty Report struct with all fields initialized to their default values. It serves as a template for parsers and tests to build up field by field.
- found: Returns a Report struct with all 14 fields explicitly initialized to defaults: String fields to String::new(), booleans to false, and Options to None. Provides an empty template for incremental field population.
- predicted: full · documented: none · derivable: yes

### `grades` — nearly
- read at `3e2a55e7efcf` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This method returns a tuple of two grades from a Report: a primary grade and an optional documented grade. It likely handles backwards compatibility with old reports that only had a boolean surprised field, and applies the derivable rule to force documented to None if the documentation could be machine-generated.
- found: Returns a tuple of (predicted, documented) grades. For predicted: uses the reported field if present, otherwise maps the legacy surprised boolean (true → Grade::None, false → Grade::Full). For documented: if derivable is true, forces it to Some(Grade::None), otherwise returns the reported documented grade.
- predicted: most · documented: full · derivable: no

### `neighbours` — as expected
- read at `f6938e55b595` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function extracts a window of neighboring function names centered around index i, handling edge cases by sliding the window to fit within the slice bounds. It returns the selected neighbors and a count of how many were omitted from the full list.
- found: Extracts neighboring function names around index i, filtering out the function at i itself. If all names fit in the window, returns all except i with 0 omitted. Otherwise calculates a centered window using saturation and min to stay within bounds, then counts how many names were omitted.
- predicted: full · documented: none · derivable: yes

### `qualify` — as expected
- read at `0bf13326c7c5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function takes a function name, an optional owner type, and an optional language, and returns a qualified name string formatted according to language conventions. For example, it might return 'Type::method' for Rust or 'Type.method' for other languages.
- found: The function returns just the name if there's no owner. If there is an owner, it uses '::' separator for Rust, C++, and PHP, and '.' separator for all other languages. Ruby is explicitly not in the '::' list because in Ruby Foo::bar means constant lookup and Foo#bar is the method.
- predicted: full · documented: full · derivable: no

### `collect_tasks` — nearly
- read at `1ce35cf398d4` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: The function recursively walks a node tree, collecting unread or stale functions into scored tasks. It checks whether a function has a prior reading and whether that reading is still valid (not stale), and skips functions with active leases or unbroken prior readings. For file nodes, it processes children recursively while tracking file order, then assigns each child task a neighborhood of peer functions from the same file.
- found: If node is Func: checks prior reading staleness and active leases, creates a Task with priority (surprise + 1.0 if stale), returning early if fresh or leased. If node is File: recursively collects tasks from children (skipping excluded files), tracks which child produced which task by index, then assigns each task a list of peer functions in file order and counts omitted peers. Otherwise: recursively processes children without creating tasks.
- predicted: most · documented: none · derivable: yes

### `all_tasks` — nearly
- read at `02b4d8d6612c` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This function generates all possible tasks from a scan without any filtering or leasing. It creates a Task for each function, including the complete peer list of all siblings in each file. This is used for measurement/analysis of the full payload, not for actual reader distribution.
- found: Calls collect_tasks with empty HashMaps and the repo path to generate all tasks without filtering or leasing, then extracts and returns just the Task objects from the results.
- predicted: most · documented: most · derivable: no

### `default_n` — unrecognisable
- read at `6a6d3617691f` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Returns 10, the default batch size for functions handed to a reader, determined by token cost analysis and measured absence of warming effects.
- found: Returns the constant 1, representing one function per handout; the protocol then calls this function 10 times to achieve the full batch without the warmth penalty of fetching all at once.
- predicted: none · documented: none · derivable: yes
- note: Misread the architecture: thought it returned batch size but it returns handout size. The docs explain this clearly but I missed the crucial distinction between n-at-a-time vs n calls.

### `open_project` — nearly — STALE
- read at `f76d7c8d8408` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This function opens a repo by validating the path, performing an initial scan using the proxy model, loading stored assessments, and returning the tree structure and initial scores so the frontend can display the sunburst visualization.
- found: The function validates the path, performs a fresh scan with the proxy every time (to detect staleness), loads and re-keys reports from disk against the new tree, creates a Project struct with metadata and dropped leases, and returns a detailed JSON response including project key, name, function/excluded counts, shape, stale count, guidance about .sanityignore, and the protocol for agents.
- predicted: most · documented: most · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `work_left` — nearly
- read at `c258e9e8dba4` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Calculates remaining work for a project by examining assessed items, stale items, and task counts, returning a WorkLeft struct with information about remaining vs completed items.
- found: Collects all unread tasks and filters them to find those with active leases (leases younger than LEASE duration). Returns WorkLeft containing: remaining (count of unread tasks), in_flight (count of valid leases), and outstanding (list of (id, age) pairs sorted by newest lease first).
- predicted: most · documented: none · derivable: no

### `count_stale` — nearly
- read at `0a7c140e20ff` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function counts stale readings by comparing reports against the current scan. It likely iterates through reports, finds each function's current state in the scan, and counts those where the body hash no longer matches, indicating code has changed since the reading was taken.
- found: Uses visitor pattern to iterate through all nodes in scan. Filters to Func nodes only. For each function, looks up its report in HashMap. Calls crate::assessment::is_stale to check staleness, increments counter for stale reports, returns total count.
- predicted: most · documented: none · derivable: yes

### `assessed` — as expected
- read at `c530f428ccee` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Returns the count of functions with valid (non-stale) readings by taking total reports and subtracting those that are stale (body hash mismatch).
- found: Returns project.reports.len() minus count_stale(), using saturating_sub to get only non-stale readings.
- predicted: full · documented: full · derivable: no

### `count_funcs` — nearly
- read at `41825ab09066` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes a Scan and counts functions in two categories: those in scope and those excluded by .sanityignore. Returns both counts as a tuple by recursively traversing the scan tree and partitioning functions.
- found: Recursively walks the scan tree with a nested walk function, tracking whether nodes are in out-of-scope sections marked by node.excluded. When a NodeKind::Func is found, increments kept or dropped counter based on scope status. Returns (kept, dropped).
- predicted: most · documented: full · derivable: no

### `shape_of` — nearly
- read at `9211c713f99b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function takes a Scan and returns JSON describing the repo's shape as function counts per top-level directory, enabling agents to propose `.sanityignore` entries with concrete numbers while avoiding function names to prevent recall contamination.
- found: Recursively walks the tree tracking included and excluded function counts per top-level directory in a BTreeMap, sorts directories by total count (descending), returns the top 15 as JSON objects with dir name, functions count, and excluded count.
- predicted: most · documented: most · derivable: no
- note: Docs don't mention the top 15 limit or that excluded and included functions are tracked separately.

### `interleave_by_file` — nearly
- read at `f414de85af40` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Reorders a ranked list of tasks to spread them across files while maintaining score-based ordering. Returns top n tasks such that consecutive tasks come from different files, preventing readers from recalling functions from the same file consecutively.
- found: Sorts input by score descending, then groups tasks by file path into by_file (maintaining score order within each file). Uses round-robin over file indices to interleave: in each round, takes the next task from each file if it exists. This ensures files appear in round-robin order while maintaining score-based ordering at the file level. Returns up to n tasks, stopping when n is reached or no progress occurs.
- predicted: most · documented: full · derivable: no

### `mark_of` — as expected
- read at `7a2f5c3c060d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Reads the file's metadata from disk and returns a tuple of its modification timestamp and size in bytes, or None if the file cannot be read.
- found: Gets filesystem metadata for the file at repo/rel_path and returns a tuple of the modification time and file size, or None if metadata cannot be read.
- predicted: full · documented: none · derivable: yes

### `resync_file` — nearly
- read at `ade69f5eec77` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Rescan a single file's functions against the current state of the file on disk. Update positions, signatures, docs, and body hashes for existing functions. Remove functions that have been deleted. Keep node IDs stable by keying on (name, ordinal) to avoid breaking the reports map. Return false if the file cannot be found or read, true otherwise. Do not add newly written functions.
- found: Finds the file node by recursive search, returns false if missing/unreadable. Parses fresh functions using the language parser and creates a (name, ordinal) map. Uses retain_mut to iterate existing children, looking each up in the fresh map. Updates line, end_line, loc, signature, doc, owner, and body_hash for functions that still exist. Removes functions not in fresh map. Returns true on success.
- predicted: most · documented: full · derivable: no

### `resync_changed` — nearly
- read at `55f4e098a9e9` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function scans the project's files to detect which have been modified (by checking mtime and file length), re-parses those files to update function positions and metadata, and returns the count of resynced files. It updates existing functions but doesn't add new ones (those come on the next full scan).
- found: Walks the scan tree to collect current file marks (mtime and size) for all files, compares against cached marks to identify changed files, calls resync_file on each changed path to update it, recalculates parent node widths via aggregate(), and returns the count of resynced files.
- predicted: most · documented: full · derivable: no

### `spread_across_files` — as expected
- read at `b16a290469ea` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Selects n tasks from a scored list and spreads them across different files. Prefers "rested" files (not recently accessed) to provide variety while avoiding reader fatigue from staying in one file. Returns a prioritized Vec of tasks that balances score quality with file diversity.
- found: Partitions scored tasks into fresh (rested) and resting (recently accessed) based on the recent map and a FILE_REST threshold. Fresh files are those not in the recent map or where FILE_REST duration has elapsed since last access. Prefers fresh tasks, but falls back to resting tasks if no fresh tasks exist. Calls interleave_by_file to spread the selected set of n tasks across their respective files.
- predicted: full · documented: full · derivable: no

### `queue` — nearly — STALE
- read at `e7564887ef3c` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This is an async endpoint handler that builds and returns a queue of tasks for agents to process. It likely takes QueueParams from the query, resyncs any changed files, determines which functions still need assessment, applies some interleaving strategy (based on the `interleave_by_file` peer), and returns a Vec<Task> to be processed.
- found: Locks shared state and gets the project, updates last_agent timestamp, resyncs changed files, collects scored tasks, spreads them across files with interleaving using `spread_across_files`, marks tasks as leased (with timestamp) to prevent duplicate assignment to concurrent agents, tracks recent files, determines if work is complete, pings UI with done/wait status, and returns the handed tasks.
- predicted: most · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `report` — nearly — STALE
- read at `3e6839b8e449` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Receives a reading from an agent, validates the project, stamps provenance fields (by and at from git), saves the report to disk, and returns a JSON response with status and remaining task counts.
- found: Handles an incoming report: removes the function from the in-flight lease, stamps provenance (body, by, at) from the scan and git, classifies the outcome (stale/hot/cold based on whether it's a re-read or surprising), saves reports to disk, computes repo-wide aggregates (total, surprised count, warm count), generates quality hints for the agent if surprise rate is low or write fails, and returns JSON with status, remaining/in_flight counts, aggregates, and hint.
- predicted: most · documented: none · derivable: no
- note: Core mechanism was correct but the function does significant quality monitoring and in-flight task management beyond basic report persistence.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `status` — nearly — STALE
- read at `643f03263264` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This async endpoint handler returns assessment progress for the caller's project. It extracts the project key from StatusParams, retrieves the current scan state, and returns structured JSON with counts of assessed functions, remaining work, and progress metadata.
- found: Locks state and returns early if unavailable. Pings for activity tracking. Collects all projects' summaries, then resolves the caller's specific project via for_client(). Calculates WorkLeft (remaining, in_flight, outstanding leases), counts stale readings, and returns comprehensive JSON including function counts, assessed/remaining/in_flight counts, oldest outstanding leases with age, stale count, assessment file path, and dynamic next_step guidance based on completion status and stale reading presence. On project not found, returns helpful error distinguishing transient vs. permanent failures.
- predicted: most · documented: full · derivable: no
- note: The WorkLeft calculation with lease tracking, stale reading handling, and context-aware next_step guidance required reading the full state machine logic; signature alone suggested simple counting.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `add` — as expected
- read at `6d13901c3e9d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This method increments a counter for the given Grade within GradeCounts. It likely maintains tallies of how many functions have each grade (Full/Most/Some/None), and handles the None case for ungraded functions.
- found: Increments the appropriate counter in GradeCounts based on the grade: full, most, some, or none for each Grade variant, or ungraded if None.
- predicted: full · documented: none · derivable: no

### `add` #2 — nearly
- read at `0e8f68bbb95e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This is a method on the Tally struct that adds a report's grades to the accumulator. It likely increments counts and sums the documented and surprise grades from the report into the running totals maintained by Tally.
- found: Extracts predicted and documented grades from report via r.grades(). Increments readings counter. Calls add() on self.predicted and self.documented accumulators with the extracted grades. Increments derivable and cold counters by converting boolean flags to usize.
- predicted: most · documented: none · derivable: yes

### `aggregate` — nearly
- read at `9ecba3dca52d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Takes a Project reference and produces an Aggregate struct, likely collecting summary statistics from the project's scan, reports, and assessment state (e.g., how many functions assessed, remaining work, grade distribution) into aggregated metrics.
- found: Visits all function nodes in the project tree, filters for non-stale reports, accumulates grade statistics into total tally, per-model buckets (with unattributed fallback), and per-position buckets for grade distribution by reading position.
- predicted: most · documented: none · derivable: yes

### `summary` — nearly — STALE
- read at `cdf529429b5c` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: An HTTP endpoint that computes and returns repository-wide aggregate statistics about assessed functions, excluding stale readings, from the current project.
- found: Locks state, gets project, calls aggregate() and work_left(), counts functions, and returns JSON with repo path, function counts, assessed/stale/remaining counts, and aggregates by model and by_position, plus detailed note on methodology.
- predicted: most · documented: most · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `from_state` — surprising
- read at `1e1384212f9c` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Constructs a ProjectList by iterating through the projects in AppState, creating ProjectSummary entries for each with their metadata, and possibly initializing any work queues or syncs needed for the list.
- found: Iterates through loaded projects in state.projects and creates ProjectSummary entries with counts of functions and assessed work, checking if each is actively being worked on (based on last_agent timestamp). Also includes projects being restored from state.restoring that haven't fully loaded yet, with progress tracking. Sorts all projects by most recently touched first, then wraps in a ProjectList with the active project key.
- predicted: some · documented: none · derivable: no

### `router` — as expected — STALE
- read at `c1bf5c2e20f9` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function creates and configures an HTTP router by registering handler functions for various endpoints. It likely sets up routes like /queue, /report, /status, and /summary that are mentioned in the peer functions, attaches shared state, and returns the configured router.
- found: The function creates a new Router, registers POST /open to open_project, GET /queue to queue, POST /report to report, GET /status to status, GET /summary to summary, and attaches the shared state.
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `endpoint_file` — nearly — STALE
- read at `a3cb589c4a07` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: The endpoint_file function returns the path where the app writes the actual claimed port for the MCP server, PID-stamped to prevent port conflicts and ensure the MCP server connects to the correct port.
- found: Returns the path to "agent-endpoint.json" in the Sanity subdirectory of the platform data directory, creating the directory if it doesn't exist, or None if directory creation or data_dir lookup fails.
- predicted: most · documented: most · derivable: no
- note: Docs mention PID-stamping but this function just returns the path; PID-stamping happens when the file is written elsewhere.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `restore` — nearly — STALE
- read at `ef48454d12a9` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function restores previously open projects by rescanning the code trees (not loading cached trees since they'd be stale), loading the assessments from disk, and handling cases where files have moved or been deleted. It iterates through projects and rebuilds the state.
- found: The function loads the project index, spawns a thread to rescan each project in reverse order, loads their assessments from disk, creates Project structs with metadata, tracks the active project (with a fallback to most recent), handles deleted/moved repos gracefully, and calls persist() once at the end to avoid partial saves.
- predicted: most · documented: most · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `serve` — as expected
- read at `75b39671788f` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This is an async function that starts an HTTP server bound to the loopback interface (127.0.0.1) on port 0, allowing the OS to automatically assign an available port. It serves a read-only API view of the shared scan state. The function returns the assigned port number.
- found: The function binds a TcpListener to 127.0.0.1:0, retrieves the assigned port, optionally writes the port and process ID to an endpoint file (for discovery), creates a router from the shared state, spawns an async task to run the axum server, and returns the port.
- predicted: full · documented: none · derivable: yes

### `task` — nearly
- read at `5343cfc0054f` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function constructs a Task object from a file path and function name, likely representing a single assessment task to be queued for a reader.
- found: Constructs a Task struct initialized with the given path and name, setting the id to "path#name" format, with default line bounds 1-10, and empty signature, peers, and docs vectors.
- predicted: most · documented: none · derivable: no
- note: Initializes with fixed default bounds (1-10) that seemed arbitrary without context.

### `project_of` — nearly — STALE
- read at `56979d1d4599` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Constructs a Project by scanning the directory with the heuristic model, loading any existing .sanity/ assessments, computing initial scores for all functions, and returning a fully initialized Project struct.
- found: Calls scan() with HeuristicModel and ephemeral cache (test mode, no persistent caching), then constructs a Project with the scan result, empty reports/leases/marks hashmaps (no loading of existing assessments), a hardcoded name "t", and zero touched/no last_agent.
- predicted: most · documented: none · derivable: no
- note: High-level concept correct (scan and construct) but misses the testing context: ephemeral cache, empty reports, hardcoded test name.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_save_mid_restore_does_not_erase_projects_it_has_not_loaded` — nearly — STALE
- read at `b6eccac47da9` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Sets up a scenario with two projects in the index, creates a session state that has only partially loaded one of them, modifies and persists that one, then verifies that the unloaded project is still in the saved state and the loaded one was updated in place.
- found: Saves an initial index with projects /a and /b, creates an AppState with only /b loaded, modifies /b's touched timestamp, persists it, and asserts the loaded index still contains /a (preserved), has no duplicates, and /b was updated with the new timestamp.
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `outstanding_itemises_only_live_leases_on_unread_work` — as expected
- read at `d2fe708a8895` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Creates a project with two unread functions, verifies initial state has no leases and no in-flight work, adds a lease on one function and verifies it's counted in in_flight and outstanding, then adds a reading for that function and verifies the stale lease is dropped from both counts.
- found: Sets up two functions, collects their task ids, checks initial state (no leases), adds a lease for function 1 and asserts it appears in in_flight and outstanding, then inserts a Report for function 1 and asserts the stale lease drops from both counts while remaining decrements.
- predicted: full · documented: full · derivable: no

### `the_summary_counts_neither_stale_readings_nor_unknown_positions_as_good_news` — nearly
- read at `8c0a0e90d983` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This is a comprehensive test validating that the summary function properly handles stale and unknown-position readings. It likely creates readings with various states (valid, stale, unknown position), calls the aggregate function, and asserts that stale readings don't count toward coverage, unknown positions are tracked separately, and only valid readings contribute to summary statistics.
- found: The test creates three readings: two valid ones with known positions and models, one stale (body mismatch). It verifies that aggregate counts only 2 readings (stale excluded), that model tallies exclude stale readings, that position buckets are created per actual position (no phantoms), and that readings with None position are tracked separately in by_position.unrecorded.
- predicted: most · documented: full · derivable: no

### `same_named_methods_arrive_with_the_type_they_hang_off` — nearly
- read at `139f58d55c82` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test that verifies same-named methods (twins in the same file) are returned with their owner type/qualifier so they are distinguishable to readers and both appear in the peers list.
- found: Creates a test file with two `parse` methods in different impl blocks; collects tasks; verifies both are present with correct owners; verifies each sees the other qualified with `::` in peers; verifies no self-references; verifies peers fit in window.
- predicted: most · documented: most · derivable: no

### `an_excluded_file_leaves_the_queue_and_stays_in_the_count` — as expected
- read at `5594e3ea2b7d` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This test verifies that `.sanityignore` properly excludes files from the queue while still counting them in the totals. It likely creates files in and out of an ignored directory, scans without exclusions, then with a `.sanityignore` file, and checks that excluded functions are not offered for assessment but are still reflected in the function counts.
- found: The test creates a repo with one function in keep.rs and two in tests/drop.rs. Without `.sanityignore` it counts (3, 0). After creating `.sanityignore` with "tests/", it counts (1, 2). It verifies that collect_tasks only returns "one" (excluded functions are not handed out), and that the shape report shows tests/ with excluded: 2, functions: 0.
- predicted: full · documented: full · derivable: no

### `a_long_file_sends_the_neighbourhood_and_counts_the_rest` — as expected
- read at `a005e6eb0c28` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test verifying that when a file is large, it returns a window of nearby functions (the "neighbourhood") excluding the target function itself, reports the count of omitted functions, and for small files returns the complete list with zero omitted.
- found: Tests the neighbours() function across multiple scenarios: (1) middle of a 100-function file returns PEER_WINDOW functions, omits the rest, excludes the target function, includes neighbors; (2) at boundaries (first/last), the window slides rather than half-emptying; (3) small files that fit in the window are returned complete with zero omitted.
- predicted: full · documented: full · derivable: no

### `a_file_that_moved_is_re_cut_before_anything_is_handed_out` — nearly
- read at `ae6a03515fc8` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This is a test function that verifies when a file is edited and line ranges shift, the ranges are recalculated and corrected before being handed to readers or agents, preventing them from receiving outdated line references.
- found: Tests that resync_changed recalculates line numbers after edits, verifies body hashes stay constant (so readings aren't expired on reformat), verifies new functions aren't added yet (waiting for next scan), and that function positions follow their actual locations in the updated file.
- predicted: most · documented: full · derivable: no

### `a_function_that_is_gone_stops_being_offered` — nearly
- read at `f21e05b68e22` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: This test verifies that when a function is deleted from the codebase while in the assessment queue, that function gets dropped from the queue and is not offered to readers at stale line numbers.
- found: Creates a temp directory with a Rust file containing keep() and go() functions. Syncs the project. Deletes go() from the file and calls resync_changed, expecting it to detect 1 change. Then visits the tree to collect function names and asserts only "keep" remains—verifying the deleted function is actually removed from the tree.
- predicted: most · documented: none · derivable: yes

### `status_answers_about_the_callers_repo_not_the_window` — as expected — STALE
- read at `87e59836a1ed` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 3 of its run
- expected: This test function validates that the status endpoint correctly returns data for the caller's project, not the active window project. It sets up multiple projects, sets the window to one, makes a status call for another with an explicit project key, and verifies the response describes the calling session's repo, not the window's.
- found: Creates two temp directories and projects (mine/theirs), sets window active to /theirs. Calls status with project=/mine and asserts the response has project=mine (not theirs) with correct repo path. Then calls status with project=None and asserts it defaults to the window's active project (theirs).
- predicted: full · documented: full · derivable: no
- note: Cold=false because the same file was read for the previous function (status endpoint at 1588-1702); this test is at 2655-2683 in the same file.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_project_key_that_is_not_loaded_is_refused_rather_than_swapped` — as expected
- read at `ed53d881df27` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Test verifying that when a project key is specified that hasn't been loaded, the system refuses the request instead of silently falling back to an active/default project.
- found: Creates an AppState with one loaded project '/loaded' as active. Tests three scenarios: (1) requesting '/loaded' returns it, (2) requesting '/not-restored-yet' returns None (refusal, not fallback), (3) requesting None returns '/loaded' (appropriate fallback to active). Demonstrates that explicit requests are honored or refused; only implicit requests use the fallback.
- predicted: full · documented: full · derivable: no
- note: Well-designed test that demonstrates an important safety principle: explicit requests must never be silently substituted.

### `a_file_just_drawn_from_is_passed_over_on_the_next_call` — as expected
- read at `df28c62030f2` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This test verifies that the task queue correctly interleaves functions across different files, ensuring a recently-used file is skipped on the next call to avoid reading warm code and maintain freshness across the reader's work.
- found: Tests spread_across_files() with scenarios: first call takes highest-ranked regardless, second call prefers unread files over recently-opened ones, falls back if only recent files remain, and expires the preference after FILE_REST duration passes.
- predicted: full · documented: full · derivable: no

### `queue_spreads_across_files` — nearly
- read at `78102b6f097e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This is a test verifying the queue distributes work across files rather than exhausting one file's functions before moving to another. The docs explain that score-based ranking clusters functions by file (since distinctiveness is file-local), causing reader warmth. The test likely confirms the queue uses round-robin or interleaving to spread functions across files to keep readings cold.
- found: Creates ranked tasks from three files with different score ranges, calls interleave_by_file(6), and asserts: no two consecutive tasks share a file (while other files remain), and the highest-scoring file still leads. Ranking is respected within the spreading constraint.
- predicted: most · documented: full · derivable: no
- note: Missed that ranking is still respected—spreading does not collapse to pure round-robin that ignores scores.

### `queue_falls_back_when_one_file_remains` — as expected
- read at `fd22eb01b352` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This is a test that verifies when only one file is left in the queue to read, the queue still returns work items instead of starving or returning nothing, since there's no longer anything to interleave.
- found: Test creates 4 tasks from a single file and requests 3 items via interleave_by_file, asserting that all 3 are returned even when there's no interleaving possible (only one file).
- predicted: full · documented: full · derivable: no

### `queue_never_repeats_or_overruns` — as expected
- read at `5cb1e89f22c8` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This short test verifies that when requesting more functions from the queue than actually exist, the function returns all available items without panicking or repeating any. It likely creates a small set of tasks and requests more than available, then asserts the correct count and uniqueness.
- found: The test creates a ranked list of 2 tasks (from different files), calls interleave_by_file requesting 25 items, asserts the result has exactly 2 items, and verifies they have different ids.
- predicted: full · documented: none · derivable: yes

## src-tauri/src/assessment.rs

### `reading_hash` — as expected
- read at `7592537f71be` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This computes a combined hash from both the doc and body (collapsing whitespace), ensuring that when either the code or documentation changes, the reading is marked stale—fixing the prior bug where doc changes alone weren't detected.
- found: If doc is present, concatenates it with body and hashes the result; if no doc, hashes just the body. Uses body_hash to normalize whitespace.
- predicted: full · documented: full · derivable: no

### `body_hash` — as expected
- read at `22efbec4236b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function computes a stable hash of the function body to detect when it has changed. It collapses whitespace before hashing so that formatting changes don't trigger staleness. It uses a FNV-1a-like hashing algorithm with a custom multiplier to ensure stability.
- found: Initializes hash with fixed constant, then splits body by whitespace and iterates over each byte. For each byte: XORs with hash, then multiplies by custom multiplier 0x1000_0000_01b3. Takes lower 48 bits and formats as a 12-character hex string. Whitespace collapsing ensures reformatting doesn't invalidate the hash.
- predicted: full · documented: full · derivable: no

### `dir` — as expected
- read at `9f01c2a78302` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function takes a repo path and returns the PathBuf for the assessment directory (likely `.sanity/` based on CLAUDE.md context) where assessment readings are stored.
- found: Returns repo.join(".sanity"), the path to the .sanity subdirectory within the given repo.
- predicted: full · documented: none · derivable: yes

### `shard_of` — as expected
- read at `8b4520464080` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Extracts the top-level directory from a repo-relative path by splitting on the first slash and returning the first component, or returns "root" if the path has no directory (i.e., a root-level file).
- found: Splits the path on the first '/' using split_once. If a split occurs and the first component is non-empty, returns that as the shard name. Otherwise, returns "root" to group all root-level files into a single shard.
- predicted: full · documented: full · derivable: no

### `shard_file` — as expected
- read at `e9ae8063597e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function converts a shard name into a safe filename by sanitizing or escaping special characters, replacing problematic filesystem characters.
- found: Maps each character in the shard name, keeping alphanumeric characters, hyphens, underscores, and periods unchanged while replacing all other characters with hyphens, then appends the .md extension and returns the result.
- predicted: full · documented: none · derivable: yes

### `key_of` — nearly
- read at `c5dbf2ea00fd` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Formats a stable key from path, name, and ordinal position. Returns `path#name` for the first occurrence (ord 1) and `path#name#N` for subsequent occurrences, where N is the ordinal.
- found: Returns `path#name` when ord is 0, and `path#name#{ord+1}` for ord >= 1, creating an explicit ordinal suffix for same-named functions beyond the first.
- predicted: most · documented: none · derivable: yes
- note: Got the general structure but missed that ord is 0-indexed and the +1 offset in the suffix.

### `grade_word` — as expected
- read at `cd401b37ca7f` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Converts a Grade enum value to its corresponding human-readable string representation (such as "full", "most", "some", or "none").
- found: Matches on the Grade enum and returns the corresponding static string: "full" for Full, "most" for Most, "some" for Some, and "none" for None.
- predicted: full · documented: none · derivable: no

### `parse_grade` — as expected
- read at `7050ddd0e504` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function parses a string representation of a grade ("full", "most", "some", "none") into the corresponding Grade enum value, returning None if the string doesn't match a valid grade.
- found: Trims the input string and matches it against "full", "most", "some", "none", returning Some(Grade::*) for valid matches and None for unrecognized input.
- predicted: full · documented: none · derivable: no

### `verdict` — nearly
- read at `a9724c12309c` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function takes a Report and returns a human-readable verdict string derived from the report's grade (like "full", "most", "some", or "none").
- found: The function extracts the primary grade from the report and maps it to narrative verdict strings: Grade::Full becomes "as expected", Grade::Most becomes "nearly", Grade::Some becomes "surprising", and Grade::None becomes "unrecognisable".
- predicted: most · documented: none · derivable: yes

### `flat` — as expected
- read at `906c4bda7d98` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: This function flattens multi-line prose into a single line by collapsing whitespace and newlines. It's used to normalize text fields that must be stored as single lines in a markdown format where line boundaries are meaningful.
- found: Splits the input string on any whitespace (spaces, newlines, tabs), collects the resulting non-empty tokens into a vector, and joins them back together with single spaces, effectively collapsing all whitespace to single spaces.
- predicted: full · documented: none · derivable: yes

### `load` — nearly
- read at `8f1a65c4473b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Loads committed assessment reports from .sanity/ directory. Parses report files and filters by live functions in the current scan, dropping readings for deleted functions. Returns HashMap mapping node IDs to Report objects.
- found: Calls read_all to load all stored reports. Gets live_funcs from scan. For each live function, looks up stored report by key, clones it, updates its id to the live node's id, and inserts into output HashMap indexed by node id. Filters out any reports with no live function.
- predicted: most · documented: full · derivable: no

### `read_all` — as expected
- read at `53f32af6959d` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function loads all assessment entries from all shards (markdown files) in a given directory. It returns them in a HashMap keyed by "path#name" strings (the unique function identifier). It likely iterates through all shard files in the directory and aggregates all parsed reports into a single map.
- found: The function creates an empty HashMap, reads the directory, and iterates through its entries. It filters to only .md files (excluding README.md), reads each markdown file, parses it with parse_shard to populate the HashMap, and returns the aggregated results. Returns an empty map if the directory doesn't exist.
- predicted: full · documented: none · derivable: yes

### `parse_shard` — nearly
- read at `e0b786b04455` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function parses a markdown shard file into Report entries, using `path#name` as the map key. It iterates through the markdown, extracting function assessments and their grades, and populates a HashMap. It's deliberately forgiving of malformed input (skips unrecognized lines, drops incomplete entries) to handle hand-edits and merges without destroying the entire file.
- found: Parses markdown shard with hierarchical structure: level-2 headings are file paths, level-3 headings are function entries (with optional ordinal #N for twins), bullet points are data. Handles expected/found/note fields, and segment-based lines split by '·' for metadata (read_at, commit, read_by, by, cold/warm, position, grades). Uses flush macro to save only complete entries (with expected or found). Silently skips unrecognized content, keys entries via key_of(file, name, ord).
- predicted: most · documented: most · derivable: no

### `live_funcs` — nearly
- read at `aaf16c01c90c` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Takes a scan and returns a map keyed by durable function keys (from key_of), with Live records for each function. Assigns ordinals by line order within each file and builds the resulting map.
- found: Groups functions by file, sorts each file's functions by line then by id for determinism, assigns ordinals by counting name occurrences within each file, and inserts Live records (containing id, path, name, line, ordinal, body) keyed by key_of into the output map.
- predicted: most · documented: none · derivable: yes
- note: Missed the secondary sort by id for determinism and the per-name ordinal tracking for handling duplicate names in the same file.

### `is_stale` — nearly
- read at `713c98701a0f` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Checks if a reading is stale by comparing stored body against current node_body. Pre-migration readings (no hash) are taken at face value. Stale if body has changed, current if unchanged, non-stale if node no longer exists.
- found: Matches on (report.body, node_body): empty report.body returns false, recorded vs now comparison returns true if different, None node_body returns false.
- predicted: most · documented: full · derivable: no

### `save` — nearly — STALE
- read at `eb5b6204deb6` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function persists agent assessment reports to disk by rewriting the entire `.sanity/` directory structure—one file per top-level directory plus an index. It likely iterates through the reports, groups them by directory, renders them as markdown, and writes them to the filesystem.
- found: Writes assessment reports to disk by creating the `.sanity/` directory and grouping live functions into a nested BTreeMap by shard/file/position. For each shard, it collects statistics (read count, surprising, stale), renders markdown entries sorted by line and name, writes shard files, cleans up orphaned files from deleted readings, and finally writes a README.md index with aggregate statistics.
- predicted: most · documented: most · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `render_entry` — nearly
- read at `0087893dc036` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function renders a single assessment entry (reading) to a string format. It takes the function name, ordinal position, the Report with assessment data, and a flag indicating whether the reading is stale. It likely formats these into a markdown or text representation for storage or display in the assessment file.
- found: The function renders a markdown entry for a reading. It builds a heading with function name, ordinal (for twins), verdict, and stale marker. Then it outputs metadata (body hash, commit, model, reader, warm/cold, position), the expected vs found predictions, the grades (predicted, documented, derivable), an optional note, and if stale, a warning that the code has changed.
- predicted: most · documented: none · derivable: yes

### `render_shard` — as expected
- read at `51984db42506` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: The function renders a markdown shard or section of an assessment report. It formats statistics (read count, total count, surprising count, stale count) with the body text into a markdown section that becomes part of the assessment file written to disk.
- found: Returns a markdown-formatted string containing: header with shard name, summary line with read/total/surprising/stale counts (stale count only shown if > 0), explanatory text about readings and staleness, and the body content.
- predicted: full · documented: none · derivable: yes

### `render_index` — surprising — STALE
- read at `201faa7cc7ba` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Renders a markdown index/table of contents document for the assessment file. Takes repo name and shard data (file names with line/count statistics), generates a markdown table listing all shards with their statistics, and returns the formatted markdown string.
- found: Renders a comprehensive markdown report for the assessment that includes: a markdown table summarizing shard statistics (read/total/surprising/stale counts) with links to each shard file, totals row, and extensive explanation text about what readings are, how to interpret them, how to use the app, instructions for updating the assessment, notes about collaboration and file organization, and advice to commit the assessment directory.
- predicted: some · documented: none · derivable: yes
- note: I got the table generation right but missed that this generates a full report document with extensive explanatory text about the assessment process, not just a simple index.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `git` — as expected
- read at `ce1c2ecff671` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function likely wraps a git command execution in the given repository, running git with the provided arguments and returning the output as a string. It probably handles the subprocess call and error cases by returning None if the command fails or produces no output.
- found: Executes a git command in the specified repo using Command, passing -C to set the working directory and the provided args. Returns the trimmed stdout as a String wrapped in Some, or None if the command fails, has a non-zero exit status, or produces empty output.
- predicted: full · documented: none · derivable: yes

### `head` — as expected
- read at `95141b281c2b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: This function retrieves the current git HEAD commit hash for the repo, returning an empty string if the repo is not under version control or git is unavailable.
- found: It calls git rev-parse --short HEAD to get a short commit hash for the current HEAD, returning an empty string if the git command fails.
- predicted: full · documented: none · derivable: yes

### `who` — nearly
- read at `58e1cbad58ed` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function retrieves the git user identity (name and email) that will be stamped on assessment readings, using the repo's git configuration to determine who the current reader/author is.
- found: It queries git config for user.email, falls back to user.name if that fails, and returns the first available value or empty string if neither exists.
- predicted: most · documented: none · derivable: yes

### `report` — surprising
- read at `0710116ce476` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Creates a Report struct from the given id and note, adding metadata like git author and commit information.
- found: A test fixture that creates a Report with the id and note from parameters, but fills all other fields with hardcoded test values: expected/found messages, grades (Some/Full), position, body hash, and git metadata (ross@rossturk.com, 37eb765).
- predicted: some · documented: none · derivable: no

### `round_trips` — nearly
- read at `6eb839a6669c` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This test verifies assessment data integrity through write-and-read cycles. It likely creates test assessment entries, serializes them to storage, deserializes them back, and asserts the round-tripped data matches the original.
- found: Creates a test report entry, renders it to markdown format via render_entry and render_shard, then parses the markdown back via parse_shard into a HashMap. Validates that all fields (expected, found, note, body, git hash, author, cold, derivable, grades, position) survive the round-trip intact.
- predicted: most · documented: none · derivable: yes

### `a_reading_without_a_position_does_not_claim_to_be_the_first` — as expected
- read at `d3b54c913fc8` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This is a test function that verifies an old reading without a recorded position is treated as unknown (0.5) rather than defaulting to position 1. It likely creates or loads a legacy reading entry and asserts that accessing its position returns a neutral/unknown value instead of assuming it was the first function in a batch.
- found: Parses a markdown reading entry (without a position field) using `parse_shard`, then asserts that the resulting reading has `position` set to `None` rather than defaulting to a value.
- predicted: full · documented: full · derivable: no

### `key_ignores_line_numbers` — as expected
- read at `c5ac57efcd3b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test verifying that function keys are based on path and name only, not line numbers, ensuring readings survive code edits that shift line positions.
- found: Creates two scans with identical file and function name but different line numbers (12 vs 480), then asserts that live_funcs generates identical keys for both, proving line numbers are excluded from the key.
- predicted: full · documented: none · derivable: yes

### `same_named_functions_in_one_file_stay_apart` — as expected
- read at `1cdce84846de` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This test validates that when multiple functions share the same name within one file, they are kept separate and maintain their distinct identities. It likely creates a scenario with duplicate function names, verifies they get unique keys (with ordinal suffixes), and confirms that readings for each are preserved correctly through a save/load cycle.
- found: The test creates a scan with two `init` functions in A.swift at different lines, generates keys for them (first as `A.swift#init`, second as `A.swift#init#2`), verifies each retains its correct body hash, then writes readings to a temp directory, reloads them, and asserts all readings came back without becoming stale.
- predicted: full · documented: most · derivable: no

### `hash_ignores_formatting` — as expected
- read at `a0142f082ca2` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test that verifies the hash function used for staleness detection ignores whitespace/formatting differences, ensuring reformatting doesn't invalidate previous readings.
- found: Tests that body_hash produces the same hash for the same code with different indentation, and different hashes for genuinely different code.
- predicted: full · documented: none · derivable: yes

### `a_reading_expires_when_its_documentation_changes` — nearly
- read at `9cfc6082bbdb` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This is a test verifying that readings become stale when documentation changes. It likely creates a function with a reading, modifies its doc comment, and checks that the reading is marked as expired. The test probably verifies that hashing includes documentation along with the body.
- found: A unit test of the reading_hash function that verifies: (1) changing doc text produces a different hash, (2) adding documentation to an undocumented function produces a different hash, and (3) reflowing documentation to different line breaks produces the SAME hash. The test demonstrates that the hash function is reflow-invariant by design.
- predicted: most · documented: full · derivable: no
- note: Test elegantly demonstrates the hash function's reflow-invariance property, preventing false expirations from formatting changes.

### `stale_when_the_body_moves` — as expected
- read at `496e1e61a819` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This test verifies that when a function's body changes (line numbers move or content is modified), any existing reading for that function is marked as stale. It likely compares the body hash of a reading against the current function body to detect staleness.
- found: Tests the `is_stale` function by checking that a reading is not stale when its body hash matches, is stale when the hash differs, and handles migrated readings without a recorded hash as valid.
- predicted: full · documented: none · derivable: no

### `survives_a_mangled_entry` — as expected
- read at `dc8ce65785f5` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Based on the name and doc, this is a test function verifying that the assessment file parser is resilient to corruption. It likely creates a `.sanity/` assessment file with one intentionally mangled/malformed entry and verifies that the parser still successfully reads the remaining valid entries without data loss.
- found: A test that creates a text string with two assessment entries: one broken (missing grade fields like predicted/documented/derivable) and one intact (complete with grades). It calls parse_shard to parse the text into a HashMap. It asserts the broken entry is not in the output (dropped), and that the intact entry survives with the correct parsed Grade::Most for predicted and derivable=true.
- predicted: full · documented: none · derivable: yes

### `scan_of` — nearly
- read at `47536b04ee75` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Takes function metadata tuples and builds a Scan structure holding functions keyed by the `path#name@line` format, organizing them hierarchically by file.
- found: Creates a tree: root → files (by_file mapping) → functions. Each function becomes a Node with id "path#name@line", with line number and body hash. Returns a Scan with the tree root and stats (including function count, "test" model, without_history flag).
- predicted: most · documented: none · derivable: yes

### `writes_and_reloads_a_repo_assessment` — as expected — STALE
- read at `4dd8c8c54659` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This end-to-end test creates an assessment, saves it to the repo, reads it back, and verifies that readings survive and are properly marked stale when the source code functions move to different lines.
- found: Creates scan with functions, generates reports, saves to .sanity/ shards, verifies files exist and index is correct, then creates a new scan with functions moved and one body rewritten, loads readings back, verifies they're found by key (not line), and are marked stale correctly.
- predicted: full · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `shards_by_top_level_dir` — surprising
- read at `3e71ff49437a` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test function, likely creating test data or fixtures related to organizing assessments by top-level directory structure.
- found: A test function that verifies the sharding logic: asserts that file paths are correctly sharded into top-level directories (e.g., "src-tauri/src/scan.rs" → "src-tauri"), root-level files map to "root", and shard filenames are correctly constructed (e.g., "src-tauri" → "src-tauri.md").
- predicted: some · documented: none · derivable: no

## src-tauri/src/bin/sample.rs

### `main` — nearly — STALE
- read at `beca877b6182` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Entry point that initializes the sanity tool, parses command-line arguments (repo path, output directory, sample size), scans the repository for functions, performs sampling, and writes function metadata and code to separate output files for review exercises.
- found: Creates sampling exercises by scanning repo, extracting all functions, calculating stride-based sampling to evenly select from total functions, and writing markdown head files (metadata: name, owner, docs, peers) and text body files (code) for each sampled function. Reports count and output location.
- predicted: most · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/bin/scan.rs

### `main` — nearly — STALE
- read at `4ad0f03429e3` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Entry point for the scan binary. Parses command-line arguments for a repo path, runs the scoring logic on that repo, and uses helper functions to format and print a histogram of the surprise distribution.
- found: Parses CLI args (PATH and --local WEIGHTS). Conditionally loads a local model or uses heuristic proxy based on compilation features. Calls scan::scan with ephemeral cache and full fidelity. Prints summary stats, handles missing git history warning, calculates hot line percentage. Calls histogram, baseline_check, and section helpers to print ranked results sorted by temperature × lines (not just temperature).
- predicted: most · documented: most · derivable: no
- note: Features detailed comments on design rationale but would benefit from higher-level overview of the stages.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `histogram` — as expected
- read at `87f3ee24e884` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Prints a calibration histogram showing the distribution of surprise scores (temperature) across functions. Buckets functions by temperature ranges and displays the count in each bucket to help visualize whether the metric is working properly.
- found: Creates 10 buckets for temperature ranges 0-10, 10-20, ..., 90-100. For each function, buckets it by its temperature score (0.0-1.0 scaled to 0-9). Finds the peak bucket count for scaling. Prints 'TEMPERATURE SPREAD' header and for each bucket: range label, ASCII bar chart (█ characters scaled to peak), and count.
- predicted: full · documented: most · derivable: no
- note: Warm reading: same file as position 4. Simple ASCII visualization implementing the documented calibration principle.

### `baseline_check` — nearly
- read at `bc6ed4b330bb` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function computes and prints the overlap between the current ranking (temperature × lines) and a naive ranking by line count alone. It likely sorts the functions by size, compares the ordering to the current order, and prints a metric showing how much they agree.
- found: Returns early if fewer than 15 functions. Uses a closure to get top-15 IDs by a ranking function, then gets top-15 by metric (temperature × LOC) and top-15 by raw LOC. Counts shared entries and prints the overlap count, with interpretive message: 0-6 shared means metric is adding value, 7-11 means mixed results, 12+ means size is doing all the work.
- predicted: most · documented: most · derivable: no

### `section` — nearly
- read at `194d05adc8c6` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function takes a title, mutable slice of Nodes, and a ranking function. It sorts the functions by rank in descending order, prints the title, then displays the top functions with information about their rank, name, LOC, and location.
- found: The function sorts functions by descending rank score. It prints the title, then iterates through the top 15 functions that have rank > 0.0. For each, it prints a formatted line showing temperature (as 0-100 degree angle), truncated name (28 chars), LOC, a quadrant label, and file path with line number.
- predicted: most · documented: none · derivable: no

### `quadrant_label` — as expected
- read at `29d9cd256d76` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function takes a Quadrant enum value and returns its string label for display purposes, mapping each variant to a human-readable string.
- found: A simple match statement that maps the four Quadrant variants (CrownJewel, Trouble, Bloat, Quiet) to their corresponding string representations for display in output.
- predicted: full · documented: none · derivable: yes

### `truncate` — nearly
- read at `5db024cd301c` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: truncate limits a string to a maximum length n characters and returns it as a String. Given its peers (histogram, section, quadrant_label), it's likely used to format output labels or text to fit within a display width.
- found: Truncates a string by counting characters (not bytes) and if over n chars, returns the first n-1 characters followed by an ellipsis "…" to indicate truncation. If under or equal to n, returns the original string unchanged.
- predicted: most · documented: none · derivable: yes
- note: Truncates to n-1 plus ellipsis, and emphasizes character-wise not byte-wise truncation to avoid UTF-8 panic.

## src-tauri/src/bin/tokens.rs

### `tok` — as expected
- read at `d85e7f4d901a` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Convert a character count to a token count by dividing by some constant approximation factor (likely around 4, since English text tokens average roughly 1/4 the character count).
- found: Divides the input character count by CHARS_PER_TOKEN, a constant, to estimate the token equivalent.
- predicted: full · documented: none · derivable: no

### `row` — as expected
- read at `2366b6afe64b` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A 3-line utility function that formats and prints a row of output for token metrics. Given it takes a label string and a character count, it likely prints a formatted line showing the label and character count (perhaps with formatting like percentages or spacing) as part of the `tokens` binary's output.
- found: A function that prints a formatted row with: label left-aligned in 34 characters, character count right-aligned in 8 characters, the literal " ch ~", and the token count (via tok() function) right-aligned in 7 characters followed by " tok". Each row displays a metric's character and approximate token count.
- predicted: full · documented: none · derivable: yes

### `pct` — as expected
- read at `7caadf1e0773` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function calculates a percentile from a sorted array of unsigned integers. Given a percentile value p (typically 0.0 to 1.0), it computes the corresponding value at that percentile position in the array, likely using index calculation and rounding.
- found: The function returns 0 for an empty array. Otherwise, it calculates an index using the formula (len-1)*p rounded to the nearest integer, then returns the value at that index in the sorted array.
- predicted: full · documented: none · derivable: yes

### `big` — as expected
- read at `e570f48990c5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function takes a usize and formats it into a human-readable magnitude string, abbreviating large numbers with suffixes (M for millions, K for thousands, etc.), based on the example of 39_300_000 becoming "39.3M".
- found: Uses pattern matching to format numbers: >= 1 million gets .1f M suffix, >= 1 thousand gets .1f k suffix, otherwise returns the raw string. Exactly matches the documented example.
- predicted: full · documented: most · derivable: no
- note: Docs frame purpose ("number a person can hold") rather than stating the thresholds (k, M) and fallback behavior explicitly.

### `main` — surprising — STALE
- read at `207918e6c0bb` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This is the entry point for a binary/CLI tool that calculates or displays token counts. Given the peers (tok, row, pct, big), it likely reads input and computes token statistics, displaying them in a formatted output (rows, percentages, big values).
- found: Scans a repo, calculates per-reader token budgets (fixed prefix tools/prompts + function payloads + body reading costs), generates statistics for each task component (median, p90, max), projects whole-repo costs across functions, and identifies unused tool descriptions as potential budget savings.
- predicted: some · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/blame.rs

### `range` — nearly
- read at `562e7a6f580b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Extracts blame history for a line range in the file. Takes 1-indexed line numbers (inclusive both ends) and current time, collapses blame data into four key facts (RangeHistory), and clamps the end line to actual file length.
- found: Validates and clamps line range (0-indexed conversion). Gets slice of lines or returns None if invalid. Accumulates distinct commit hashes and tracks newest (max time) and oldest (min time) commits. Computes age_days from oldest and last_touched_days from newest. Returns RangeHistory with commit count, last_touched_days, age_days, and last_author name.
- predicted: most · documented: full · derivable: no

### `get` — as expected
- read at `e56abfd7a7f8` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This getter method retrieves blame information for a specific file path from the Blame struct, returning an optional reference to FileBlame data. It likely performs a simple lookup in an internal map or cache.
- found: Delegates directly to the internal files map's get method, returning an optional reference to the FileBlame entry for the given path.
- predicted: full · documented: none · derivable: no

### `read` — as expected — STALE
- read at `6295486f5fc5` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This is a Blame type method that reads git blame history for multiple files in parallel. It takes a repository path and list of file paths, runs blame on each (silently handling failures per-file), and returns a Blame struct containing the aggregated blame data. Individual file failures are gracefully ignored, allowing the caller to fall back to file-level history.
- found: The method captures the current Unix timestamp (falling back to 0 if time retrieval fails), then uses rayon's par_iter to iterate in parallel over the file paths. For each path, it calls blame_file and uses filter_map to silently drop failures, keeping only successful blame results. Returns a Blame struct containing the files map and the captured timestamp.
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `blame_file` — as expected
- read at `ed62f32435e8` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Executes git blame on a file in the repository and returns a FileBlame struct by parsing the blame output, or None if the blame command fails.
- found: Runs `git blame --line-porcelain` on the specified file path in the repo, executing the command with git -C to change to the repo directory. If the command fails, returns None; otherwise parses the stdout using parse_porcelain and returns Some(FileBlame).
- predicted: full · documented: none · derivable: yes

### `parse_porcelain` — nearly
- read at `972c61b33c9b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function parses git blame porcelain output into a FileBlame structure. It extracts sha, author, and author-time from headers and maps them by final line number, handling the fact that header order follows the original file, not the current one.
- found: The function iterates through lines, extracting author names (deduplicating via HashMap), author-time, and header info (sha, orig, final line number). When it encounters a source line (prefixed with tab), it places the Line record by final_line number, resizing the vector if needed. It validates the sha (at least 16 hex chars) and converts it to u64. Returns FileBlame with the lines and deduplicated authors.
- predicted: most · documented: most · derivable: no

### `parses_a_commit_author_and_time_per_line` — nearly
- read at `56b2b6d18c2a` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This test verifies that git blame porcelain output is correctly parsed to extract commit author and timestamp information for each line. It likely creates sample porcelain input and asserts that the resulting blame data contains the correct author and time per line.
- found: Parses sample porcelain output and asserts that lines are parsed, authors are interned without duplication, line ranges correctly aggregate commits and identify the most recent author, and age calculations in days are accurate.
- predicted: most · documented: none · derivable: no

### `places_lines_by_their_final_number` — surprising
- read at `4d55066975f1` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This is a test function that verifies functions are placed in the correct order based on their final line number (where they end) rather than their start line. It likely creates test cases where end-line order differs from start-line order and asserts proper sorting by final line number.
- found: Creates git blame porcelain output with lines out of order (third line appears first in data, first line appears second), parses it, and asserts that range queries correctly map line numbers to authors (line 1→Grace, line 3→Ada), verifying that line placement is correct even when blame entries arrive out of sequence.
- predicted: some · documented: none · derivable: yes

### `a_range_past_the_end_is_clamped` — nearly
- read at `83aa9cdafb95` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test verifying that when blame information is requested for a line range extending beyond the file's length, it clamps to available lines rather than panicking, handling the case where scan line numbers are stale due to file changes.
- found: A test parsing sample blame output and checking two cases: (1) a range that partially extends past the available end returns Some (clamped), and (2) a range entirely past the end returns None, confirming the function distinguishes between partially and completely out-of-bounds ranges.
- predicted: most · documented: full · derivable: no

## src-tauri/src/cache.rs

### `key` — nearly
- read at `34dcfb2c0cdc` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Creates a cache key combining path and name with the fnv hash of body and optionally the doc, ensuring changes to documentation invalidate the cached result since doc is part of the model's prompt.
- found: Returns a tuple of (path#name) string and a u64 hash computed by fnv-hashing the body and XORing with the rotated fnv-hash of the doc (if present).
- predicted: most · documented: none · derivable: yes
- note: Got the concept but missed the specific XOR + rotate mechanism for combining body and doc hashes.

### `fnv` — as expected
- read at `8af94d41bcae` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function implements an FNV-1a-style hash algorithm: it takes a byte slice, initializes a hash to an offset basis, and for each byte, XORs the byte into the hash and multiplies by a prime (though with a non-standard multiplier rather than FNV-1a's official prime).
- found: Initializes hash to 0xcbf29ce48422_2325 (FNV offset basis), then for each byte: XORs the byte into h, multiplies h by 0x100000000_1b3 using wrapping multiplication, and returns the final hash value.
- predicted: full · documented: none · derivable: yes

### `ephemeral` — as expected
- read at `6f8cdf40de2d` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This is a factory method that creates a Cache instance configured to not persist data to disk. It's designed for test scenarios and headless scanning where reproducibility is critical and state should not carry between runs.
- found: It constructs and returns a Cache struct with path set to None (preventing disk writes), empty model string, default empty storage, and clean dirty flag.
- predicted: full · documented: full · derivable: no

### `open` — as expected
- read at `f2067e1cdd56` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Loads a cached scoring result for a repository and model combination from disk, returning an existing cache if it's valid for the current state, or an empty cache if none exists or it's stale.
- found: Attempts to load a cache file from disk by constructing the path, reading and deserializing JSON, then validating that the version and model match. Returns the loaded cache if valid, or constructs a default empty Stored cache otherwise. Wraps the result in a Cache struct with mutexes for inner state and dirty flag.
- predicted: full · documented: none · derivable: yes

### `path_for` — nearly — STALE
- read at `a54e7ff236f3` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: path_for is a Cache method that constructs a filesystem path for a cache file based on the repo and model name. Since the docs emphasize the model must be in the filename, this function likely combines the repo identifier with the model name to create a unique cache file path, returning Option<PathBuf> in case construction fails.
- found: Gets platform data directory, joins with Sanity/scores, creates the directory structure, hashes both repo path and model name using FNV to 64-bit hex IDs, and returns a path formatted as {repo_hash}-{model_hash}.json to avoid platform filename issues.
- predicted: most · documented: none · derivable: yes
- note: Uses FNV hashing to create platform-agnostic filenames that handle separators and illegal characters.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `get` — nearly
- read at `7560cbc74312` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Simple cache lookup method: takes a key and returns optional cached Reading. Likely uses HashMap internally for fast retrieval of assessments during scan to avoid re-reading unchanged functions.
- found: Locks inner mutex and retrieves entry by string key. Validates cached entry's body_hash matches key's hash (tuple: String, u64). Returns Option<Reading> with surprise/hotspots if hashes match. Stale entries (body changed) return None.
- predicted: most · documented: none · derivable: yes

### `put` — nearly
- read at `99ae0f14ff86` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Stores a reading in the cache using a key tuple of (function name, body hash). Serializes and writes to disk or memory depending on whether the cache is ephemeral. The body hash ensures cached readings invalidate when code changes.
- found: Locks the inner cache and inserts an Entry with the name as key, storing body_hash, surprise value, and cloned hotspots. Increments a dirty counter that tracks unflushed changes. When dirty reaches FLUSH_EVERY, resets the counter to 0 and calls flush() to write the in-memory cache to disk.
- predicted: most · documented: none · derivable: no

### `flush` — as expected
- read at `0d8f104fdb55` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This method writes the cache to disk atomically. It likely serializes the cache state to a temporary file, then atomically renames it to the final cache path. This ensures that if the app is killed during the write, the old cache remains intact and uncorrupted.
- found: Returns early if no path or lock fails. Serializes inner to JSON, returns on failure. Writes JSON to temp file (.json.tmp). If write succeeds, atomically renames temp to final path. All errors silently ignored.
- predicted: full · documented: none · derivable: yes

### `model` — as expected
- read at `296534f11708` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A simple getter method that returns a string reference to the model name associated with this cache instance.
- found: Returns a reference to the model field of the Cache struct.
- predicted: full · documented: none · derivable: yes

### `len` — as expected
- read at `6cfe686c964a` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A simple getter method that returns the number of entries currently in the cache, likely delegating to an internal collection's length method.
- found: Locks the inner cache structure, returns the length of the entries collection within, and returns 0 if the lock fails (using map and unwrap_or).
- predicted: full · documented: none · derivable: no

### `is_empty` — as expected
- read at `e5808564fa07` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This checks whether the cache is empty by returning true if it contains no entries, likely delegating to an internal map's is_empty method.
- found: Returns true if self.len() equals 0, checking if the cache contains no entries.
- predicted: full · documented: none · derivable: yes

### `two_models_never_share_a_cache_file` — nearly
- read at `76338bc3ecb6` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This is a test function verifying that cache files are model-specific. It likely creates two Cache instances with different models, performs some operation on each, and asserts they use separate cache files rather than conflicting with each other.
- found: Test that Cache::path_for() returns different cache file paths for two different model names. Asserts both paths are Some and not equal to each other. The comment explains this guards against a regression where both model and proxy passes wrote to the same file.
- predicted: most · documented: full · derivable: no

### `a_hit_needs_the_same_body_not_just_the_same_name` — as expected
- read at `7317a14f3419` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Test that cache validation requires matching function bodies, not just names. Creates two functions with the same name but different bodies and verifies they produce different cache keys and results.
- found: Creates ephemeral cache and inserts a Reading for a function with body "let x = 1;". Verifies get returns cached value. Then creates a new key for same function name with edited body "let x = 2;" and verifies it returns None (cache miss). Demonstrates body changes invalidate cache entries.
- predicted: full · documented: none · derivable: yes

### `moving_a_function_within_a_file_does_not_invalidate_it` — nearly
- read at `516f0356e06c` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This test validates that the cache key function ignores line positions. It likely simulates a function moving by testing cache lookups with different line numbers for the same function, ensuring the cache hits because the key is based on name and content hash rather than position.
- found: This test verifies that two calls to the `key()` function with identical parameters (file path, function name, body content, and no ordinal) produce the same cache key. The comment explains that since line numbers are not part of the key, adding an import at the top of a file won't invalidate cached entries for functions below it.
- predicted: most · documented: none · derivable: yes
- note: I predicted it would test different line numbers, but it just tests the same key twice—the test shows line numbers aren't parameters to `key()` rather than simulating actual position movement.

### `renaming_or_moving_a_function_misses` — as expected
- read at `30997eea13f6` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A test verifying that when a function is renamed or moved to a different file, the cache lookup misses. It tests that the cache key includes both file path and function name, so changing either one prevents hitting the cached entry from the original function's key.
- found: Creates an ephemeral cache, stores a reading under the key for function "run" in "src/a.rs", then verifies cache misses when querying with a renamed function ("walk") or when querying with the same function name but in a different file ("src/b.rs").
- predicted: full · documented: none · derivable: yes
- note: This is a warm read—I read cache.rs for the first function assessment, so I already knew this file's structure.

### `an_ephemeral_cache_never_touches_disk` — nearly
- read at `0c540f5a8a8c` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This test verifies that an ephemeral cache implementation doesn't write anything to disk by creating an ephemeral cache, performing cache operations, and asserting that no files were created on the filesystem.
- found: Creates an ephemeral cache, stores a reading via put(), calls flush(), and asserts the cache length is 1. The test implicitly validates that flush() doesn't create disk files by virtue of the operation succeeding without file-system side effects.
- predicted: most · documented: none · derivable: no

### `a_cache_written_by_another_model_is_dropped_not_merged` — nearly
- read at `c2053b43e1c3` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This test verifies that when a cache was written by a different model, the cache is dropped and not merged, ensuring that incompatible cache entries are not used.
- found: The test creates a cache entry with model "old-model", writes it to disk, reads it back, and asserts that it's different from "new-model", verifying the model field can be detected to distinguish caches written by different models.
- predicted: most · documented: none · derivable: no

## src-tauri/src/churn.rs

### `churn_of` — as expected
- read at `486c62b6f280` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This method on History queries git commit history for a given path and returns a normalized 0-1 churn value representing how frequently the file has been modified, with saturation preventing extreme values.
- found: Looks up the path in the files map, returns 0.0 if not found, otherwise divides the recent_commits count by CHURN_SATURATION and clamps the result to 0-1 range.
- predicted: full · documented: none · derivable: yes

### `commits_of` — as expected
- read at `0441a99964cb` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This method returns the raw commit count for a given file path from the git history window, providing an unnormalized count (as opposed to the normalized churn percentage). It probably looks up the file in an internal history map and returns the commit count.
- found: Looks up the file in the internal files map, extracts the recent_commits field from the history entry, and returns it; if the file has no entry, defaults to 0.
- predicted: full · documented: none · derivable: yes

### `last_touched_of` — as expected
- read at `73cc1733597a` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This method on History returns the number of days since the most recent commit touched the given file path. It likely looks up the file in an internal data structure and returns the age in days as an Option.
- found: The method looks up the path in self.files map and returns the last_touched_days field via map.
- predicted: full · documented: none · derivable: yes

### `last_author_of` — nearly
- read at `1cb69a5869c3` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This method looks up the file path in the git history and returns the name/email of the author who made the most recent commit to that file, or None if no such history exists.
- found: Retrieves the cached history entry for the given path, extracts the last_author field, clones it, and filters out empty author strings, returning Some(author) or None.
- predicted: most · documented: full · derivable: no

### `age_of` — nearly
- read at `214a1a9bae02` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns the age of a file or directory as a floating-point number (likely years), calculated from its git history. Returns None if there's no history available for the given path.
- found: Retrieves and returns the precomputed `age_days` field from the internal `files` map for the given path, or None if the path has no entry.
- predicted: most · documented: none · derivable: no
- note: The age is in days, not years; I predicted calculation instead of lookup.

### `is_empty` — nearly
- read at `a5d8b66ddc2f` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This method checks if the History object has any git commits or history recorded. It likely returns true if there are no commits in the internal history data structure, false otherwise.
- found: Returns whether the internal `files` collection is empty by delegating to its `is_empty()` method.
- predicted: most · documented: none · derivable: no

### `read` — as expected — STALE
- read at `f16b98f461b6` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Reads git history for a repository, parsing commit logs to calculate churn and age metrics. It gracefully handles non-git directories by returning a History object without git data.
- found: Runs `git log` command with custom format to extract timestamp and author, limiting to MAX_COMMITS and filtering out merges. Includes file paths (--name-only). Returns default History if git command fails or exits with error. Parses the log output with parse_log, passing the current timestamp.
- predicted: full · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `now_secs` — as expected
- read at `785486d94a76` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This is a utility function that returns the current Unix timestamp as an i64 representing seconds, likely used for time-based calculations in the churn tracking system.
- found: Gets the current system time, calculates duration since Unix epoch, converts to seconds as i64, and returns 0 on error (if system time is before epoch).
- predicted: full · documented: none · derivable: yes

### `credit` — nearly — STALE
- read at `659595849b26` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function records a single commit event against a specific file or directory path by updating the FileHistory entry in the files HashMap. It takes the path key, the age of the commit in days, and the commit author, and updates the corresponding FileHistory structure to track this commit.
- found: Records a commit by getting or creating a FileHistory entry, setting last_touched and last_author on first sighting, incrementing recent_commits only if within CHURN_WINDOW_DAYS, and always updating age_days (relying on git log walking newest-first to find the oldest age).
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `flush_commit` — nearly — STALE
- read at `657564a9e74e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Processes a single commit by iterating through touched files, updating their histories with the commit timestamp and author, and crediting each ancestor directory exactly once to avoid double-counting commits touching multiple files in one directory.
- found: Validates timestamp and touched list. Calculates age_days from timestamp. Extracts all ancestor directories from touched paths by splitting on '/' and storing in HashSet. Calls credit() for each touched file and each collected directory. Clears the touched vector.
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `parse_log` — nearly — STALE
- read at `940a52e35ee4` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function parses git log output text and a current timestamp to build a History struct tracking commit data (timestamps, authors, touched files). The doc emphasizes this is where parsing bugs live and is testable independently. Given peers like `churn_of`, `age_of`, `last_touched_of`, it likely processes commit records to extract temporal metadata for churn and age scoring.
- found: The function parses git log text by iterating line-by-line. It recognizes commit boundaries by lines prefixed with the SOH character (\u{1}), extracting the timestamp and author separated by STX (\u{2}) from each commit header. It collects file paths touched in each commit. When a new commit is encountered or at the end, it calls flush_commit to accumulate the commit's data (timestamp, author, touched files) into a HashMap of FileHistory per path. Returns History with the aggregated file history data.
- predicted: most · documented: some · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_commit_touching_three_files_counts_once_for_their_directory` — as expected
- read at `d79af032ecd6` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This is a test that verifies that when a git commit modifies multiple files in the same directory, the directory's churn count increments by 1 (not 3), demonstrating that directory-level churn aggregates commits rather than files.
- found: Creates a git log with a single commit by Ada touching three files in src/, parses it, and verifies that while src/a.rs records 1 commit, the src/ directory also records 1 commit (not 3), confirming directory churn counts commits not files.
- predicted: full · documented: full · derivable: no

### `directory_commits_accumulate_and_reach_every_ancestor` — as expected
- read at `0dd8e8b3f37f` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This test verifies that commits to files in subdirectories are properly aggregated and attributed to their parent directories all the way up to the directory hierarchy ancestors.
- found: The test creates a git log with two commits on separate files in subdirectories, parses it, and asserts that the file has 1 commit, the directory has 2 commits (accumulated), parent directories also get 2 commits, and the last touched date reflects the most recent commit.
- predicted: full · documented: none · derivable: yes

### `oldest_commit_sets_age_and_recent_ones_set_churn` — nearly
- read at `b57db60a534f` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This is a test verifying that git history analysis correctly computes age from the oldest commit and churn from recent commits, checking that these metrics are calculated and associated with functions properly.
- found: It parses mock git logs with commits at different timestamps, verifies age_of() returns days to oldest commit, last_author_of() returns newest author, and churn_of() ranks files by recent commit activity within a window.
- predicted: most · documented: none · derivable: yes

### `one_pathological_file_does_not_squash_the_rest` — nearly
- read at `fc87b31ebf71` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This is a test function that verifies a file with pathological commit history (extreme churn, many edits) doesn't distort the churn metrics for other files in the same directory. It likely creates a mock history with one problematic file and sibling files, then asserts the siblings' churn metrics remain reasonable.
- found: A test that creates a git log with 500 commits to Cargo.lock (a lockfile) and 10 commits to src/hot.rs, parses the log, and verifies that Cargo.lock saturates at churn=1.0 while src/hot.rs maintains churn > 0.5, proving that pathological files don't flatten real source code metrics.
- predicted: most · documented: none · derivable: no

### `churn_saturates_rather_than_running_away` — nearly
- read at `7015eaa5c9f5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This is a test function verifying that churn saturation works correctly - checking that the churn metric for a file stays bounded and doesn't grow unboundedly as commits accumulate. The test likely creates a mock history with repeated commits and verifies the churn score plateaus rather than continuing to increase.
- found: A test that creates a single mock commit one day in the past touching src/a.rs, parses it into a history, and asserts that the computed churn for that file is within [0.0, 1.0], confirming the metric stays normalized and doesn't exceed the saturation bound.
- predicted: most · documented: none · derivable: no
- note: The test name is clear but the implementation is simpler than expected—it's just checking one-time normalization, not demonstrating saturation across multiple commits.

### `a_directory_that_is_not_a_repo_scores_without_history` — nearly
- read at `0d897bf18153` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This test verifies graceful handling of non-git directories during scoring. It likely creates a temporary directory, confirms it's not a git repo, analyzes it, and asserts that scoring succeeds with default/empty history metrics.
- found: Calls read() on a non-existent path, then asserts the returned history is empty, churn_of() returns 0.0 for any file, and age_of() returns None. Verifies that absence of git history is handled gracefully with sensible defaults.
- predicted: most · documented: none · derivable: yes

## src-tauri/src/commands.rs

### `scan_repo` — nearly — STALE
- read at `67a22744acc7` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This async command handler takes a ScanRequest and orchestrates scanning a repository. It will coordinate with the app state to parse the repo, calculate the surprise/temperature metric for functions, and return the complete scored tree as a single Scan result payload to the frontend.
- found: Validates the repo path, resets cancellation flag, spawns CPU-bound scanning on a blocking thread with a HeuristicModel. Streams progress and individual function scores live via emit callbacks. Uses an ephemeral cache and Ordering-level fidelity (just enough precision to sort, not color the UI). Loads existing agent reports from .sanity, updates shared project state, and returns the completed Scan tree.
- predicted: most · documented: most · derivable: no
- note: Docs omit streaming of individual scores via emit and the state management around project registration; the design reasoning about parsing frames and wedge dependencies is not derivable from code alone.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read_source` — as expected
- read at `515cf731af35` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This async function reads a source file from the repo by joining the relative path to the repo root, canonicalizing both paths to prevent directory traversal attacks, and returning the file contents as a String. It likely caps file size to prevent large files from freezing the UI.
- found: Canonicalizes the repo root and the joined full path to catch symlinks and traversal attempts. Checks that the canonical full path starts with repo root. Gets file metadata and rejects files larger than 2MB. Reads and returns the file as a String in a spawned blocking task.
- predicted: full · documented: full · derivable: no

### `open_code_window` — nearly
- read at `a06312cc03cc` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function creates a new Tauri window for viewing code, loads the app bundle with a query parameter to show only the code view, sanitizes the path for use as a window label, and returns Ok or an error string.
- found: Creates a sanitized window label, checks if a window with that label already exists and focuses it if so, manually URL-encodes the path and repo parameters, builds a WebviewWindow with the encoded URL, title, and configurable dimensions, applies macOS-specific title bar styling and traffic light positioning, then builds and returns the result.
- predicted: most · documented: full · derivable: no

### `agent_reports` — as expected — STALE
- read at `2a8618d78133` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A Tauri command that polls and returns all agent-reported assessments for a project. It takes an optional project key parameter; if not provided, it uses the currently active project. Returns a vector of Report objects containing all assessments collected for that project, or an empty vector if the key is invalid or state cannot be accessed.
- found: Locks the shared state, retrieves the provided key or falls back to the active project key, looks up the project's reports in the projects map, clones all report values into a vector, and returns it. Returns an empty vector if any step fails (state lock fails, key is invalid, or project not found).
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `agent_activity` — nearly — STALE
- read at `ed8e92e26ed7` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: This is a Tauri command that accesses the shared agent state and returns an AgentActivity struct containing information about current agent activity/status.
- found: Locks the shared agent state and returns an AgentActivity struct with active (true if agent touched within 60 seconds), last tool name, ping count as nonce, and recent events mapped to AgentCall structs; returns default empty AgentActivity if lock fails.
- predicted: most · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `projects` — nearly — STALE
- read at `ea8670a0d028` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function retrieves the list of available projects from the application state and returns a ProjectList that the frontend uses to populate the UI and handle project selection.
- found: Locks the shared state, maps it to a ProjectList using ProjectList::from_state, and returns the result or a default ProjectList if locking fails.
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `project_scan` — as expected — STALE
- read at `cd1fb638d2fa` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This Tauri command retrieves the full scored tree for a project when the UI window switches to it. It likely locks the shared state, looks up the project by the given key, and returns a clone of its scan tree.
- found: The function locks the shared state, gets the projects map, looks up the project by key, and returns a clone of its scan field using map and the ? operator for error handling.
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `sync_theme_menu` — as expected
- read at `dbabffd78808` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function updates the application menu to reflect the current theme preference by taking the theme string and synchronizing the native menu to show which theme option is currently selected.
- found: Gets the ThemeMenu state from the Tauri app and calls select() with the provided theme string to mark it as the active theme option.
- predicted: full · documented: none · derivable: yes

### `sync_theme_menu` #2 — nearly
- read at `e3ee3dd70022` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This function is a no-op stub that takes an app handle and theme string but doesn't perform actual synchronization. The underscore-prefixed parameters suggest they're unused. The comment indicates it's a placeholder for cases where no app menu exists to sync.
- found: Empty function body with unused parameters (prefixed with _). Compiled only on non-macOS platforms via #[cfg(not(target_os = "macos"))]. A no-op Tauri command for platforms without app menus.
- predicted: most · documented: some · derivable: no

### `stop_scan` — as expected
- read at `9b4031738fc1` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This command stops the current model pass. It likely sets a cancellation flag or sends a signal that the scanning loop checks to know when to stop, allowing results scored so far to be kept and returned.
- found: The function stores true in an atomic CANCEL variable using relaxed ordering.
- predicted: full · documented: none · derivable: yes

### `this_exe` — as expected
- read at `d5834403c0b0` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This is a helper function that returns the path to the currently running executable as a String. It's likely used internally by command handlers to locate the app binary for subprocess or system calls.
- found: It retrieves the current executable path via std::env::current_exe(), converts it to a string (lossy for non-UTF8 paths), and returns it, defaulting to empty string on error.
- predicted: full · documented: none · derivable: no

### `mcp_command` — surprising
- read at `25f0e32c2320` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: The function constructs and returns an McpCommand structure that defines the MCP command interface. It likely builds up the command definition, argument schema, and handler mappings for MCP operations.
- found: Gets the executable path via this_exe(), creates an args vector containing "mcp", builds a JSON string with an mcpServers configuration object, and returns an McpCommand struct with the command path, args, and JSON string.
- predicted: some · documented: none · derivable: yes

### `client_defs` — as expected
- read at `3aaff8bec443` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function returns a vector of client definitions, likely configuration for available MCP (Model Context Protocol) clients. It probably constructs a fixed set of client definitions for the sanity MCP server.
- found: Returns a hardcoded vector of five ClientDef entries defining MCP client configurations for Claude Desktop, Claude Code, Cursor, Windsurf, and Codex, each specifying the client's id, display name, config file path (resolved relative to home/config dirs), the JSON key to look for mcpServers, and whether the config is JSON or TOML.
- predicted: full · documented: none · derivable: no

### `mcp_clients` — nearly
- read at `14034386da36` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The mcp_clients function is a Tauri command that returns a vector of MCP client configurations, likely loading them from the application's stored settings or configuration.
- found: Returns a vector of McpClient objects by loading config files for each client definition, parsing JSON or TOML, checking if the config exists and is registered, comparing the configured command against the current executable to determine if it's current, and including file writability.
- predicted: most · documented: some · derivable: no
- note: No docstring explaining the McpClient status fields (present, registered, current); only an inline comment about TOML parsing fallback.

### `edit_client` — nearly
- read at `8bac4700205e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: The function takes a client ID and a boolean indicating whether to add or remove sanity from that client's config file. It locates the client definition, loads and parses the config as JSON, then either adds or removes a sanity entry depending on the connect parameter, and writes the modified config back to disk, erroring if the file doesn't exist or isn't valid JSON.
- found: The function looks up a client by ID, verifies its config is JSON (not TOML), loads or creates the config file, then adds or removes a sanity server entry depending on the connect parameter. Special handling: Claude Desktop can have a config created on first connection, but other clients must already have a config file; disconnecting from a non-existent config returns the path rather than erroring; sanity entries include command and args fields.
- predicted: most · documented: full · derivable: no
- note: Docs said only existing, parseable configs are edited, but code actually creates configs for Claude Desktop specifically—the exception is documented in-code but not in the docstring.

### `mcp_connect` — nearly
- read at `58e5ef3ccab3` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A Tauri command that initiates a connection to an MCP client by ID, activating the client connection and returning a success message or error.
- found: Calls edit_client with the provided ID and true (enabling the connection), returning the result.
- predicted: most · documented: none · derivable: yes

### `mcp_disconnect` — as expected
- read at `fca84f2b9372` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A Tauri command handler that disconnects an MCP client by delegating to edit_client, likely passing false to indicate disconnection.
- found: Calls edit_client(&id, false) and returns the result, acting as a thin wrapper.
- predicted: full · documented: none · derivable: no

## src-tauri/src/heuristic.rs

### `linmap` — as expected
- read at `7787beaf4518` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Maps a value v from the range [lo, hi] to [0, 1] by linear interpolation, with clamping to ensure the output stays in the valid range.
- found: Computes (v - lo) / (hi - lo) and clamps the result to [0, 1], mapping v from [lo, hi] onto the full output range.
- predicted: full · documented: none · derivable: yes

### `words` — as expected
- read at `44e22cccb037` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function should take source text, split identifiers on camelCase and snake_case boundaries, convert to lowercase, remove punctuation, filter out words shorter than 3 characters and structural words, and return the resulting vector of meaningful word-parts.
- found: The function iterates through characters, detecting camelCase boundaries when an uppercase letter follows a lowercase one; it accumulates characters into words, converts to lowercase, treats non-alphanumeric characters as word separators, and finally filters words to keep only those >= 3 characters and non-structural using the is_structural predicate.
- predicted: full · documented: full · derivable: no

### `is_structural` — as expected
- read at `63ecb03e38d3` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function checks if a word is a structural keyword or language plumbing term (like `let`, `self`, `return`) that should be excluded from vocabulary comparisons since they're universal and don't indicate function distinctiveness.
- found: Checks if a word is in a hardcoded STRUCTURAL array containing ~40 keywords and universal terms like let, return, self, null, true, false, class, import, etc. Returns boolean result.
- predicted: full · documented: none · derivable: yes

### `lex` — as expected
- read at `8a2e3fec8e11` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function takes source code and returns a vector of token string slices. It lexes the source into identifier runs (consecutive alphanumeric chars and underscores) and individual punctuation marks, using char_indices to properly handle multi-byte UTF-8 characters. Whitespace is skipped.
- found: The function iterates through char_indices, skipping whitespace. For each alphanumeric character or underscore, it collects the entire identifier run (using peek to look ahead). For other characters (punctuation), it pushes single-character slices. Uses len_utf8() to properly handle multi-byte characters.
- predicted: full · documented: full · derivable: no

### `shingles` — as expected
- read at `81960912c1ad` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Lexes the source code into tokens, then generates 3-grams (consecutive triplets of tokens), hashes each 3-gram using FNV, and returns them as a HashSet. Returns an empty set if the source has fewer than 3 tokens.
- found: Lexes the source into tokens with lex(). Returns empty HashSet if fewer than 3 tokens. Creates sliding windows of 3 tokens, joins each window with spaces, hashes the result via fnv() on the bytes, and collects all hashes into a HashSet.
- predicted: full · documented: full · derivable: no

### `fnv` — as expected
- read at `da564edbd754` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An 8-line hash function taking bytes and returning a u64. Based on the comprehensive doc explaining FNV-1a's shape with a deliberately different multiplier (0x1000_0000_01b3), it likely iterates through the bytes array, mixing them with the constant via an FNV-like loop pattern to produce a stable hash for shingle generation.
- found: An FNV-1a-shaped hash function with initialization constant 0xcbf2_9ce4_8422_2325. It iterates through each byte, XORing it into the accumulator h, then multiplies by the deliberately non-standard multiplier 0x1000_0000_01b3 using wrapping arithmetic. Returns the final hash value as u64.
- predicted: full · documented: full · derivable: no

### `jaccard` — as expected
- read at `31e2cccaa44b` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This computes the Jaccard similarity coefficient between two sets by calculating the ratio of intersection size to union size, returning a float between 0 and 1 representing how similar the two sets are.
- found: Calculates Jaccard coefficient: handles empty sets (return 0.0), counts intersection, computes union as (len(a) + len(b) - intersection), and returns intersection / union ratio.
- predicted: full · documented: none · derivable: yes

### `incompressibility` — nearly
- read at `f23ecd69841b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Measures code incompressibility by compressing the body string and returning the ratio of compressed to original size. Low ratios indicate repetitive boilerplate, high ratios indicate varied unique code. Uses deflate compression.
- found: Normalizes body by removing whitespace variations. Returns UNDECIDED for bodies under 200 bytes. Compresses normalized string using DeflateEncoder. Calculates compression ratio and maps it from measured range [0.25, 0.70] to [0, 1] using linmap. Returns UNDECIDED on compression errors.
- predicted: most · documented: full · derivable: no

### `branch_density` — nearly
- read at `098a7ba7e8eb` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function calculates the density of branching/decision points in code. Given the doc stating "Decisions per line" and the note that `?` counts as a branch, it likely counts control flow structures (if, match, loops, try operators) and returns a normalized metric per line.
- found: Counts branching keywords and operators (if, else, match, switch, for, while, try, catch, &&, ||, ?) in the code body. Returns UNDECIDED if the body has fewer than MIN_LINES_FOR_BRANCHING lines. Otherwise, splits the body on non-alphanumeric characters (preserving &, |, ?), counts how many tokens match the BRANCH list, divides by line count to get density, and maps the result to a normalized scale (0.02-0.25) using linmap.
- predicted: most · documented: full · derivable: no

### `vocabulary_novelty` — nearly
- read at `892df490f297` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Extract vocabulary from the signature and body, measure what fraction of the body's words were not already present in the signature, and return a normalized float representing how unexpected the body's vocabulary is given what the name and signature promised.
- found: Extracts words from signature into a set, extracts words from body. Returns UNDECIDED if body is too short. Calculates the ratio of novel (body words not in signature) to total body words, then maps this ratio through linmap from range [0.35, 0.85] to return a normalized score.
- predicted: most · documented: full · derivable: no

### `fingerprint` — surprising
- read at `2d240d0ac69c` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Computes a Fingerprint structure from a code body string, extracting various metrics like vocabulary, structural features, and compressibility to be used in later surprise/distinctiveness calculations.
- found: Creates a Fingerprint struct containing only the shingles (extracted from the body via the shingles function).
- predicted: some · documented: none · derivable: no
- note: I predicted multiple metrics but the function only extracts shingles.

### `distinctiveness` — nearly
- read at `0c1a7968428a` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function measures how unique a function is compared to its siblings. It takes the function's fingerprint and the peers' fingerprints, computes similarity (likely Jaccard) to each sibling, finds the closest match, and returns 1 minus that maximum similarity as the distinctiveness score, where 1 = completely unique and 0 = identical to a sibling.
- found: Returns UNDECIDED (0.5) if no peers or the function is too short to shingle meaningfully. Otherwise computes Jaccard similarity between the function's shingles and each peer's shingles, finds the maximum similarity, and maps that value from the [0.08, 0.55] range to [0.0, 1.0] using linmap to produce the final distinctiveness score.
- predicted: most · documented: full · derivable: no

### `surprise` — as expected
- read at `f75d4f2ecad0` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function computes the main surprise metric (0-1) that measures how predictable a function is. It takes the signature, body, and distinctiveness score, and combines multiple heuristics into a final normalized surprise value that the proxy uses as the offline temperature measurement.
- found: Combines four terms (distinctiveness, vocabulary_novelty, incompressibility, branch_density) by weighting each with predefined WEIGHTS, sums them for a raw score, and calibrates the result to 0-1 range.
- predicted: full · documented: full · derivable: no

### `calibrate` — as expected
- read at `d19b3e49a255` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This function transforms a raw heuristic score (0..1) into the final visualization temperature using a calibrated monotonic curve. It applies an exponent to skew the distribution right, concentrating the meaningful variation in a hot tail while keeping most code appearing cold, which better represents real code distributions.
- found: It performs linear mapping from the raw score to [0.30, 0.95] using constants FLOOR and CEIL, then applies a power function with SKEW exponent 2.2 to create the right-skewed distribution.
- predicted: full · documented: full · derivable: no

### `documented` — as expected
- read at `ca96226a5b96` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Computes a lexical score (0-1) of documentation quality by extracting words from doc, signature, and body, removing signature words from both doc and body to avoid crediting mere repetition, then calculating what fraction of the remaining body vocabulary appears in the doc text.
- found: Returns 0.0 if no doc; 1.0 if signature alone covers everything; otherwise removes signature words from both doc and body, then computes coverage as (shared words / uncovered body words), scaled to give full credit at 40% vocabulary overlap via linmap(coverage, 0.0, 0.40).
- predicted: full · documented: full · derivable: no

### `words_split_identifiers_and_drop_noise` — as expected
- read at `60b2def7030a` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test function verifying that identifier splitting and noise-dropping logic works correctly.
- found: A test function with three assertions: splits camelCase and lowercases it, splits snake_case on underscores, and filters out keywords and one/two-letter names as noise.
- predicted: full · documented: none · derivable: yes

### `a_comment_that_restates_the_signature_documents_nothing` — as expected
- read at `4caff0d46264` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This is a test function that verifies the documentation scoring system correctly identifies that a comment merely restating the function signature should document nothing. It probably runs a comment through the scoring function and asserts the documentation score is zero or minimum.
- found: Test that calls documented() twice on a signature-body pair: once with a comment that restates the signature (asserts score = 0.0), once with a comment that explains the real behavior (asserts score > 0.5). Validates that restatements cool nothing and real explanations cool the wedge.
- predicted: full · documented: none · derivable: yes

### `no_doc_is_no_explanation` — as expected
- read at `e88fec43c2a5` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This test verifies that the documentation grading returns none or zero when a function has no documentation, ensuring undocumented code is not credited with explanation.
- found: Calls documented() with None (no docs), a signature, and a body, and asserts the result equals 0.0.
- predicted: full · documented: none · derivable: yes

### `twelve_copies_of_a_handler_are_not_distinctive` — nearly
- read at `5bde5f829630` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Test that verifies the distinctiveness metric correctly identifies boilerplate handler code (multiple copies with similar patterns) as non-distinctive. Tests that repeated similar implementations score lower than novel code.
- found: Creates fingerprints of two similar handler implementations (get_user, get_order) and novel complex code. Calls distinctiveness on template against one peer and novel against two peers. Asserts template distinctiveness is below novel and below 0.5 threshold.
- predicted: most · documented: none · derivable: no

### `a_lone_function_is_undecided_not_unique` — as expected
- read at `accf341a051d` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Based on the test name alone, this is a 4-line test verifying that when there's only one function in context (no peers to compare against), the distinctiveness heuristic returns 0.5 (UNDECIDED) rather than falsely claiming the function is unique. It likely creates a single function and asserts the score is 0.5.
- found: A test that calls distinctiveness with a fingerprint of "whatever it says" and an empty slice (representing no peer functions), asserting the result equals UNDECIDED. Includes an inline comment explaining that returning 1.0 would incorrectly mark every single-function file as the hottest in the repo.
- predicted: full · documented: none · derivable: yes

### `short_bodies_decline_to_report_compressibility` — as expected
- read at `c06585b6822d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test verifying that the incompressibility metric returns UNDECIDED for short function bodies.
- found: A test asserting that calling incompressibility on a minimal expression ("a + b") returns UNDECIDED, to prevent deflate's fixed overhead from incorrectly marking tiny functions as novel.
- predicted: full · documented: none · derivable: yes

### `non_ascii_source_does_not_split_a_codepoint` — nearly
- read at `022f33318c11` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This is a test that validates UTF-8 handling, specifically that processing non-ASCII source code doesn't split valid Unicode codepoints into invalid sequences.
- found: A test that verifies the lex function correctly tokenizes source with non-ASCII characters (em dashes, middle dots, accented letters, arrows) as whole tokens without splitting UTF-8 codepoints, and also calls fingerprint on non-ASCII source to ensure it doesn't panic.
- predicted: most · documented: none · derivable: no

### `lex_separates_punctuation_from_identifiers` — as expected
- read at `f40325225ebb` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This test verifies that the lexer correctly separates punctuation characters from identifier tokens when tokenizing code. It likely passes sample code with mixed punctuation and identifiers and asserts that the lexer produces the expected separation between these token types.
- found: Tests the `lex` function by passing sample code `"db.query(USERS, id)"` and asserting it produces a vector of tokens with identifiers and punctuation properly separated: identifiers like db, query, USERS, id and punctuation like ., (, ), , as distinct tokens.
- predicted: full · documented: none · derivable: no

### `a_tiny_function_cannot_be_the_hottest_thing_in_the_repo` — nearly
- read at `081e4ac07ca5` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: This test function verifies that very short functions don't rank as the most surprising code in the repo, even if they have minimal content. It creates a tiny function and a longer one, calculates their surprise scores with distinctiveness, and asserts that the tiny one scores below 0.5 and lower than the long function.
- found: Creates a tiny_body with just sanity_lib::run() and a long_body with 40 similar if-statements. Fingerprints both and calculates surprise scores using distinctiveness. Asserts tiny < 0.5 (preventing fn main() regressions) and asserts long > tiny to ensure longer functions outrank tiny ones.
- predicted: most · documented: some · derivable: no

### `every_term_declines_to_measure_when_it_runs_out_of_evidence` — as expected
- read at `4aeb738e05f5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This is a test verifying that all heuristic metrics return an UNDECIDED value (0.5) when they lack sufficient evidence, preventing confident claims on edge cases like very short functions.
- found: Tests that four specific metrics (incompressibility, branch_density, vocabulary_novelty, distinctiveness) all return UNDECIDED on minimal code snippets, ensuring no metric becomes a pure length metric.
- predicted: full · documented: some · derivable: no
- note: Test name perfectly describes the behavior; inline comment explains the purpose (preventing length-metric behavior) but no docstring listing which four metrics are tested.

### `surprise_stays_in_range` — as expected
- read at `1923d0feb480` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This is a test function that verifies the surprise metric calculation stays within expected bounds (likely 0-1 range), probably testing edge cases or various code patterns.
- found: Tests the surprise() function with three body sizes (empty, single character, and large repeated string) and a fixed prior of 0.5, asserting each result stays within 0.0-1.0 range.
- predicted: full · documented: none · derivable: no

## src-tauri/src/lib.rs

### `build_window` — nearly
- read at `93fcfbc0e9d7` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Build the main application window using the Tauri app handle, setting window properties like title, size, and appearance, with special handling for macOS traffic-light positioning which cannot be configured in tauri.conf.json.
- found: Creates a WebviewWindowBuilder for a "main" window pointing to index.html, sets title to "Sanity", sets inner size to 1440x900 with minimum 1280x720. On macOS only, enables overlay title bar style, hides the title, and positions traffic lights at TRAFFIC_LIGHTS coordinates. Attempts to build and prints errors on failure.
- predicted: most · documented: most · derivable: no

### `select` — as expected
- read at `43b16757b8b3` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A method on ThemeMenu that marks a specific theme option as active in the menu. Takes a theme name string and sets the checked state on the corresponding menu item (light, dark, or system) to true while unchecking the others, syncing the menu's visual state with the user's preference.
- found: Sets the checked state on three theme menu items (light, dark, system) based on whether the provided `which` parameter matches each one. Each menu item's checked state becomes true only if its name matches `which`, and false otherwise. Ignores any errors from the set_checked calls.
- predicted: full · documented: none · derivable: yes

### `build_menu` — nearly
- read at `445fce5c922b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function builds and returns the app menu for the Tauri application, creating a Menu with the platform default items (Hide, Quit, copy/paste, etc.) and extracting a ThemeMenu for appearance/theme toggle handling. It rebuilds the menu from scratch rather than modifying a stock menu.
- found: Builds a macOS app menu with Sanity, File, Edit, View, and Window submenus; creates CheckMenuItems for Light, Dark, and System theme with System selected by default; combines all menus and returns both the Menu and a ThemeMenu struct containing the three theme items.
- predicted: most · documented: full · derivable: no

### `run` — nearly — STALE
- read at `809e98a95a2d` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This is the main entry point for the Tauri application. It likely initializes the Tauri app builder, configures the window (via build_window), sets up the menu (via build_menu), and runs the event loop to start the application.
- found: The function creates shared agent API state, builds a Tauri app with that state managed. In setup, it builds the window, handles platform-specific macOS menu setup with theme selection, restores previously open projects, and spawns an async task to start the agent API server. It adds single-instance, dialog, and opener plugins, registers command handlers for UI invocation, and runs the Tauri context.
- predicted: most · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/local.rs

### `load` — nearly
- read at `bcb1d7fe62d5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This constructor loads a GGUF model file from the given path, which is an expensive operation taking hundreds of milliseconds. It initializes the LocalModel and starts its owner thread for managing the model lifecycle, returning a Result wrapping the LocalModel.
- found: Creates two mpsc channels (jobs and readiness signal), spawns a thread that loads LlamaBackend and LlamaModel (using Box::leak for 'static lifetimes to handle self-reference), creates a LlamaContext, signals readiness, then enters a job loop processing scoring requests. Main thread waits for readiness signal and returns LocalModel wrapping the sender channel.
- predicted: most · documented: most · derivable: no
- note: Missed the two-channel architecture and Box::leak lifetime management; performance and frequency are domain knowledge not in code.

### `surprisal` — nearly
- read at `f7d1490b235a` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function combines the prefix and body strings and passes them to an underlying language model to compute the mean surprisal in bits per token. It returns Some(f32) on success or None if the computation fails.
- found: The function creates an mpsc channel and sends a tuple of (prefix, body) strings along with a reply channel to a jobs queue. It then waits for the reply on the receiving end of the channel, returning the result or None if any step fails. The actual computation is delegated to a background worker thread.
- predicted: most · documented: full · derivable: no

### `score_one` — nearly
- read at `47759ec38adc` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function takes a Llama context, a code prefix (likely signature), and a body string, then computes a surprise score by having the language model predict the body conditioned on the prefix. It returns an Option<f32> with the resulting surprise measurement or None on failure.
- found: The function tokenizes the prefix and body, validates body length >= 8, trims prefix to fit within MAX_TOKENS while preserving the full body, creates a batch with selective logits computation (only from the transition point through body), decodes it, computes log-softmax carefully per body token position to avoid overflow, and returns the average negative log probability in bits per token as the surprise score.
- predicted: most · documented: full · derivable: no

### `label` — as expected
- read at `8245bbbbdd5f` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This method on LocalModel returns a human-readable label or name for the local model instance, enabling identification and display to users.
- found: Returns self.label.clone() - a simple accessor that returns a cloned copy of the label field from the LocalModel struct.
- predicted: full · documented: none · derivable: yes

### `is_model` — as expected
- read at `af36895b6641` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This is a simple method on LocalModel that likely just returns true, indicating that this type is indeed a model implementation (as opposed to a proxy or other type).
- found: The method simply returns true.
- predicted: full · documented: none · derivable: yes

### `surprise` — nearly
- read at `d038a18f9b62` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This method takes an Item and a proxy score (fallback value), computes the actual surprise reading using the LocalModel's scoring logic, and returns a Reading struct. It likely delegates to surprisal() for the actual computation and wraps the result in a Reading, using the proxy if needed.
- found: Builds a prefix from item context and signature, calls surprisal(&prefix, item.body), calibrates the resulting bits with calibrate_surprisal(), and wraps in Reading::plain(). Falls back to Reading::plain(proxy) if surprisal returns None.
- predicted: most · documented: none · derivable: no

### `discover_models` — as expected
- read at `d9f25575bafc` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Searches Ollama's blob store directory in the home directory, iterates through files, filters for files larger than 100 MB, and returns a Vec of PathBuf entries for discovered model files.
- found: Gets home directory, constructs path to .ollama/models/blobs, reads all entries in that directory, filters for files with metadata.len() > 100,000,000 bytes, collects matching paths, sorts the result, and returns the sorted Vec.
- predicted: full · documented: none · derivable: yes

## src-tauri/src/main.rs

### `main` — nearly — STALE
- read at `f4ff0d9e142f` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This is the entry point function for the Tauri app. It will initialize and launch the application window, setting up any necessary configuration before handing control to the frontend.
- found: The entry point checks if the first command-line argument is 'mcp'; if so, it runs the MCP server via sanity_lib::mcp::run(). Otherwise, it calls sanity_lib::run() to launch the normal Tauri app.
- predicted: most · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/mcp.rs

### `project` — nearly
- read at `5859c08a6e19` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function returns the current project name or path as an Option<String>, likely retrieving it from an environment variable, command-line argument, or global configuration state set elsewhere in the app.
- found: It retrieves a cloned Optional<String> from a shared mutex-protected static variable called PROJECT, using lock().ok().and_then() to safely access the inner value.
- predicted: most · documented: none · derivable: yes

### `base_url` — nearly — STALE
- read at `b10c9e157e80` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: base_url reads a file to discover the app's current port and constructs a base URL string. Since the app publishes a new port each startup, the function must re-read the file every time to get the current address rather than caching it.
- found: Checks if SANITY_BACKEND environment variable is set and returns it if present; otherwise reads the endpoint file path, parses its JSON, extracts the port field, and returns a formatted http://127.0.0.1:{port} URL.
- predicted: most · documented: none · derivable: yes
- note: Missed the environment variable override (SANITY_BACKEND) that provides an alternate path before file reading.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `with_retry` — nearly — STALE
- read at `c1dba3d1748d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This is a retry utility that takes a closure and repeatedly calls it with an endpoint URL until it succeeds or encounters a fatal error. It only retries on transient connection failures, not on parsed HTTP responses or fatal errors. It stops when the window closes or a deadline is reached.
- found: The function sets a deadline (now + RETRY_FOR) and loops, calling the attempt closure with the base URL. On success it returns Ok(v), on Fatal error it returns that error immediately. On Transient error it continues. When the deadline is reached, it checks if the endpoint file exists to distinguish between UNREACHABLE (exists but unreachable) and NOT_RUNNING (doesn't exist), then sleeps between iterations.
- predicted: most · documented: most · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `get` — as expected — STALE
- read at `0f1107220ccb` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function makes an HTTP GET request to a base URL with the given path, retrying on transient errors, and returns the parsed JSON response or an error.
- found: The function wraps a GET request in with_retry, constructs a URL from base + path, makes a blocking request, and parses the response as JSON, distinguishing between transient (network) and fatal (parse) errors.
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `post` — as expected — STALE
- read at `6acb4b90e1ab` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Makes an HTTP POST request to the given path with a JSON body, returning a JSON response or an error message. It likely handles retries and uses shared HTTP client infrastructure.
- found: Makes an HTTP POST request by wrapping the operation with with_retry for retry logic. Creates a new reqwest blocking client, posts to the formatted base URL + path with JSON body. Maps send errors as transient (retryable) and JSON parse errors as fatal (non-retryable), returning the parsed JSON response.
- predicted: full · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `urlencode` — nearly
- read at `a37075a00bd1` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function performs percent-encoding on a project key (absolute file path) to make it safe for query strings. It converts spaces and special characters to their percent-encoded equivalents (%20 for space, etc.) so paths survive URL transmission.
- found: Iterates over input bytes and maps each: unreserved characters (A-Z, a-z, 0-9, -, _, ., ~, /) pass through unchanged; all others are percent-encoded as %HH in uppercase hex. Collects results into String.
- predicted: most · documented: none · derivable: yes

### `tools` — as expected — STALE
- read at `a91a7982501e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function constructs and returns a JSON Value representing the MCP tool contract/schema with all five tools and their input schemas and descriptions.
- found: Returns a JSON array containing the five MCP tool definitions (sanity_open, sanity_status, sanity_next, sanity_report, sanity_summary), each with name, description, and inputSchema properties specifying their parameters.
- predicted: full · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `call` — nearly — STALE
- read at `5f2f79573519` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function dispatches MCP tool calls by name, routing the args Value to the appropriate handler (get/post with retry logic), and returns the tool's result or an error message.
- found: Matches on tool name (sanity_open, sanity_status, sanity_next, sanity_summary, sanity_report) and routes to HTTP get/post calls. Injects current project context via project() into query strings or request bodies. For sanity_next, handles the optional n parameter with clamping to 1-25 and only includes it if the caller provided it (to defer to default_n constant).
- predicted: most · documented: none · derivable: yes
- note: The n parameter handling required reading the comment to understand the design decision; the project context injection was a detail not evident from signature alone.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `run` — nearly
- read at `d53dea6f65ee` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Main entry point that starts the MCP server, setting up routes/handlers for tools and processing MCP protocol messages.
- found: Reads JSON-RPC 2.0 messages from stdin, handles initialize/tools/list/tools/call methods, calls the tool handler for each request, writes JSON responses to stdout. Skips notifications and invalid JSON.
- predicted: most · documented: none · derivable: no

## src-tauri/src/model.rs

### `from_extension` — as expected
- read at `f2fd6472f7ae` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function maps file extensions to Lang enums conservatively, returning None for unrecognized extensions rather than guessing. The docs emphasize this is critical: mis-parsing invents functions that corrupt the scoring, so false negatives (returning None) are better than false positives (guessing a language).
- found: Pattern matches on extension strings with specific mappings (rs→Rust, ts/mts/cts→TypeScript, tsx→Tsx, etc. through ~20 languages). Includes comments on ambiguous cases (.h→C not C++, .m→ObjC not MATLAB, chosen for typical repos). Returns None for unrecognized extensions via default case.
- predicted: full · documented: most · derivable: no
- note: Docs cover design principle well but not which extensions are actually supported or the multi-variant mappings.

### `label` — as expected
- read at `ca3ba2c7725e` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Returns a human-readable static string label for a programming language variant, such as "Rust", "TypeScript", "Python", etc.
- found: Matches on the Lang enum variant and returns the corresponding human-readable static string label for that language.
- predicted: full · documented: none · derivable: yes

### `weight` — nearly
- read at `1518ec3b7f08` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Returns a weight factor that determines how much a documented explanation can cool the surprise metric, where model-authored text gets 0 weight (doesn't cool), Source gets a discounted weight (uncertain origin), and user-written documentation gets full weight.
- found: Returns a weight factor matching on Provenance variants: None (0.0), Source (0.6), History (0.85), and Human (1.0).
- predicted: most · documented: none · derivable: yes
- note: I didn't predict the History variant, but the weighting hierarchy matched my expectation.

### `temperature` — as expected
- read at `e01555eadc29` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Returns the surprise value (f32) from the Score, representing how unpredictable the code is, which determines the color of the wedge on the visualization. The value should be between 0.0 and 1.0.
- found: Returns the surprise value clamped to the range [0.0, 1.0], ensuring it stays within valid bounds even if the raw surprise value was calculated outside that range.
- predicted: full · documented: full · derivable: no

### `is_stable` — as expected
- read at `d95b09da8cc5` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This method on Score determines whether a reading is settled (old and unchanged) versus in-flight, using a generous threshold where approximately a quarter duration without changes still counts as stable.
- found: Returns true if churn is less than 0.25 (under 25%) and age_days is at least 90.0 days, combining thresholds for both low modification rate and sufficient age.
- predicted: full · documented: most · derivable: no

### `quadrant` — nearly
- read at `f5561346044b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: quadrant is a Score method that determines which quadrant a code snippet belongs to based on lines of code (loc). Given peer functions mentioning "surprise_and_stability", quadrants likely represent a 2x2 grid mapping surprise (temperature) and stability/age (churn) to categorize code as hot/cold and new/old.
- found: Matches on (surprise >= HOT, is_stable()) to return one of four quadrants: CrownJewel (hot, stable), Trouble (hot, unstable), Bloat (cold and loc >= 40), or Quiet (cold and loc < 40). Size only factors into cold code decisions, not hot code.
- predicted: most · documented: none · derivable: yes
- note: Quadrant names are CrownJewel/Trouble/Bloat/Quiet; size (loc) only checks for cold code, not hot.

### `dir` — as expected
- read at `cc2c6f154037` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This is a constructor that creates a Node representing a directory with the given path and name, likely initializing it with empty children collections and default scoring values.
- found: It constructs a Node with NodeKind::Dir, setting id and path to the path parameter, name to the name parameter, initializing all metadata (lang, author, doc, signature, owner, body, end_line, score) to None, and children/hotspots to empty vectors.
- predicted: full · documented: none · derivable: yes

### `aggregate` — nearly
- read at `84afc09441d1` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: The aggregate method traverses child nodes and accumulates their lines of code and temperature scores up the tree in an LOC-weighted manner, ensuring a directory's temperature reflects the heat of its actual lines rather than averaging function-level surprises.
- found: Recursively aggregates child nodes by: summing LOC for non-function nodes, weighting surprise/documented/churn metrics by LOC, separately tracking hot lines (analyzed lines exceeding HOT threshold) vs total analyzed lines to compute hot_share, computing age as the maximum (oldest code) and last_touched as minimum (most recent touch), and returning aggregated scores with provenance kept as a leaf property.
- predicted: most · documented: most · derivable: no
- note: Docs explain LOC-weighted aggregation but omit how analyzed_share and hot_share are computed separately from analyzed vs total lines.

### `visit` — as expected
- read at `a76307ff6edf` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: This method performs a depth-first traversal of the tree, calling the provided callback function on each node with parents visited before children. It likely visits the current node first, then recursively visits each child.
- found: Executes depth-first traversal: calls callback on current node, then recursively calls visit on each child with the same callback. Parents are visited before their children's subtrees.
- predicted: full · documented: none · derivable: yes

### `score` — nearly
- read at `ea788d40ab06` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function computes a Score from four metrics: surprise, documentation quality, churn, and age. It likely combines these dimensions into a Score struct that includes temperature (the visual encoding) and quadrant classification based on surprise and stability dimensions.
- found: It constructs a Score struct by passing the four input metrics, mapping age to age_days, and initializing other Score fields with defaults: commits to 0, hot_share to 0.0, analyzed_share to 1.0, provenance to Source, and source to Model.
- predicted: most · documented: none · derivable: no

### `temperature_is_surprise_and_documentation_does_not_discount_it` — as expected
- read at `a1ecaa58ac1f` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: An 8-line test verifying a core design principle: temperature (color in the sunburst) should equal surprise, and the presence of documentation should not reduce it. Given peers like `quadrants_split_on_surprise_and_stability` and `model_authored_text_cannot_cool_a_wedge`, it likely creates a well-documented but surprising function and asserts the temperature remains high despite the docs.
- found: A test with an inline comment explaining the principle: documentation reaches the model's input (the reader's instrument), not the temperature arithmetic. It calls score() with (surprise, documented, ...) parameters and asserts three cases: surprise=1.0 doc=0.0 gives temp=1.0, surprise=1.0 doc=1.0 ALSO gives temp=1.0 (documentation doesn't reduce temperature), and surprise=0.8 doc=0.5 gives temp≈0.8. Temperature directly reflects surprise independent of documentation.
- predicted: full · documented: none · derivable: no

### `quadrants_split_on_surprise_and_stability` — nearly
- read at `5d1e265b41e2` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Tests that code is correctly classified into quadrants based on surprise and stability (age/churn) by creating scores with various combinations and asserting they map to correct quadrants (CrownJewel, Trouble, Bloat, Quiet).
- found: Tests quadrant assignment with five cases: high-surprise-old yields CrownJewel, high-surprise-churny yields Trouble, high-surprise-young yields Trouble, low-surprise comparisons yield Bloat or Quiet depending on context LOC.
- predicted: most · documented: none · derivable: no

### `a_directory_reports_the_share_of_it_that_is_hot_not_the_mean` — nearly
- read at `c34377f2549c` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This test verifies that directory-level heat aggregation reports the proportion/share of lines that are 'hot' (high surprise), not the arithmetic mean of individual temperatures. It likely constructs a test tree with varied temperatures and asserts the aggregate correctly represents the fraction of surprising code.
- found: Creates a directory with two child functions: one hot (100 LOC at temperature 1.0) and one cold (300 LOC at temperature 0.0). Aggregates them and asserts hot_share is 0.25 (LOC-weighted: 100/400). Also checks that mean surprise remains < 0.3 to show why share, not mean, drives the wedge color.
- predicted: most · documented: none · derivable: no

### `unanalysed_lines_are_left_out_of_hot_share_entirely` — nearly
- read at `5cbfa2c67966` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test that creates two function nodes (one analyzed with hot score, one unanalyzed with cold score), aggregates them, and asserts that hot_share counts only analyzed lines in its denominator, preventing the directory from reading cold early in a scan.
- found: Creates an analyzed function (100 LOC, hot) and an unanalyzed function (300 LOC, cold with analyzed_share=0), aggregates them, and asserts hot_share=1.0 and analyzed_share=0.25, confirming unanalyzed lines are excluded from hot_share denominator.
- predicted: most · documented: most · derivable: no

### `a_wedge_nothing_has_analysed_reports_no_heat_at_all` — as expected
- read at `601f7a0fb28a` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This is a test that creates a node with no analyzed reports and verifies that the resulting heat/temperature score is zero.
- found: The test creates a directory with a function child having a score with analyzed_share = 0.0, then aggregates up and asserts that both analyzed_share and hot_share equal 0.0 in the parent, ensuring unanalyzed code produces no heat signal for the frontend to render.
- predicted: full · documented: none · derivable: yes

### `hot_share_composes_through_nested_directories` — as expected
- read at `fc08d7fd60f1` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Tests that hot_share properly composes through nested directories by creating a root with a mid-level directory containing two functions (one hot, one cold), aggregating up, and asserting the root's hot_share correctly reflects the composition.
- found: Creates nested structure (root > src dir > two functions: 50 LOC hot + 50 LOC cold), aggregates, and asserts root.hot_share = 0.5, confirming composition through hierarchy.
- predicted: full · documented: none · derivable: no

### `aggregation_is_loc_weighted_not_per_function` — as expected
- read at `7c6700b188a2` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Test verifying that aggregating child scores uses LOC weighting rather than per-function averaging, so larger functions have proportionally more influence on parent scores.
- found: Creates a directory with one small hot function (3 LOC, surprise=1.0) and one large cold function (300 LOC, surprise=0.0), calls aggregate(), and asserts the directory's total LOC is 303 and surprise is less than 0.05 (proving LOC weighting, not per-function averaging which would give 0.5).
- predicted: full · documented: none · derivable: yes

### `model_authored_text_cannot_cool_a_wedge` — surprising
- read at `e30b0ece04a2` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This is a test verifying that model-authored documentation doesn't reduce code's surprise score. It likely creates a scenario with model-generated docs, reads against code, and asserts the surprise/heat rating stays high and isn't reduced by the docs (since they're not genuine explanation but derivable from code).
- found: Test asserts Provenance::None weight equals 0.0 and Provenance::Source weight is less than Provenance::Human weight. Comment explains the guard: prevents LLM-generated docs from making everything green and lying about the map. Enforces that there is no Provenance variant with weight for model-authored text.
- predicted: some · documented: full · derivable: no

## src-tauri/src/parse.rs

### `loc` — surprising
- read at `b4c7a2ed711e` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Returns the line number of the function definition, likely the start line or a key position in the file.
- found: Returns the line count (length) of the function: end_line minus start_line plus 1, using saturating_sub to safely handle potential underflow where end_line might be less than start_line.
- predicted: some · documented: none · derivable: no

### `language` — as expected
- read at `591fe4521481` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function maps a Lang enum variant to the corresponding tree-sitter Language object, allowing the parser to handle syntax-specific parsing for different programming languages.
- found: A match statement that maps each Lang enum variant to its corresponding tree-sitter Language constant, supporting 21 programming languages from Rust to SQL.
- predicted: full · documented: none · derivable: no

### `func_kinds` — as expected
- read at `9e738b909033` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Returns a static slice of tree-sitter node kind names that identify functions in the given language, matched by language with language-specific selections.
- found: Matches on the language and returns a static slice of strings containing the tree-sitter node kinds that represent functions for that language, with careful exclusions (e.g., bare arrow functions in JS) and inclusions (e.g., variable_declarator for React components).
- predicted: full · documented: full · derivable: no

### `declarator_is_function` — as expected
- read at `6f33e56848e5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function checks if a tree-sitter declarator node represents a function definition (e.g., `const Foo = () => {...}`), returning true only if the initializer is a function expression or arrow function.
- found: It retrieves the "value" child field of the declarator and checks if its kind is one of: arrow_function, function_expression, function, or generator_function, returning true if any match.
- predicted: full · documented: none · derivable: yes

### `text` — as expected
- read at `b9d14121ca24` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This function extracts the text content from the source code corresponding to a given tree-sitter node, using the node's byte range to slice the source string.
- found: It calls node.utf8_text() with the source bytes to extract the UTF-8 text corresponding to the node's byte range, returning an empty string if the extraction fails.
- predicted: full · documented: none · derivable: yes

### `leading_doc` — as expected
- read at `c96ddd4a8f73` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This function extracts the leading documentation comment for a function by walking backwards from the function node, collecting comment lines that are immediately above with no blank line separation, and skipping over any decorators or attributes that sit between the comment and the definition.
- found: Walks backwards through preceding siblings, skipping over attribute_item and decorator nodes. Collects lines from comment nodes that are immediately adjacent (no blank line). Checks if previous node's end row + 1 equals current start row; if not, breaks (blank line found). Strips comment markers, reverses the collected lines, joins them, and returns None if empty.
- predicted: full · documented: full · derivable: no

### `wrapper_doc` — as expected
- read at `db95dda4521d` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Extracts the doc comment directly from a function node, stopping at wrapper parents and avoiding climbing into enclosing types or functions to get their documentation instead.
- found: Walks up the AST for up to 3 levels, checking if each parent is in the DOC_WRAPPERS whitelist. Returns None immediately if a non-wrapper parent is encountered. For wrapper parents, attempts to extract and return leading_doc. Returns None if no documentation is found after traversing 3 levels.
- predicted: full · documented: full · derivable: no

### `owner_of` — nearly
- read at `2bace59ecc24` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function walks up the tree-sitter node hierarchy to find the enclosing type/class/struct that a function belongs to, extracting and returning its name. For Go, it extracts the receiver type from the function signature. For generic types, it strips type parameters to get the base type name. Returns None if there's no enclosing type.
- found: For Go, extracts and returns the receiver type (stripping generic parameters). For other languages, walks up the AST collecting all ancestors matching OWNER_KINDS, extracting names via 'name' or 'type' field lookups, building a full chain (capped at 3 levels), reversing and joining with dots to create a qualified owner name like Outer.Middle.Inner.
- predicted: most · documented: full · derivable: no

### `python_docstring` — nearly
- read at `14f098029780` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Given a TsNode representing a Python function's body and the source code, this function extracts the docstring (the first string literal statement) from inside the Python function body and returns it as an Option<String>. It handles Python's convention where documentation is embedded as the first statement in the function.
- found: Extracts the Python docstring from a function body by getting the first named child, unwrapping it if it's wrapped in an expression_statement, checking if it's a string kind, and then extracting and trimming the text (removing quote characters and whitespace).
- predicted: most · documented: full · derivable: no

### `strip_comment_markers` — nearly
- read at `206c453e8d95` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Language-agnostic utility that removes comment syntax markers from raw comment blocks, handling various formats (//, /*, #, etc.) and returning clean extracted text for comparison to function signatures.
- found: Line-by-line marker stripper: trims each line, sequentially removes leading markers (/// before // before /*, etc.) and trailing */, joins lines, returns trimmed result. Handles Rust doc comments, C multi-line, single-line comments, and basic python-style comments.
- predicted: most · documented: none · derivable: yes

### `parse_functions` — as expected
- read at `039258235721` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Uses tree-sitter to parse source code with the appropriate language grammar, traverses the parse tree to find function definitions, extracts metadata (name, location, signature, docs), and returns a vector of FuncDef structs. On parse errors, returns an empty vector rather than erroring.
- found: Creates a Parser, sets the language grammar (returns empty vec if unsupported), parses the source (returns empty vec if parse fails), retrieves function kinds for the language, calls collect() to traverse the tree and extract FuncDef structs, and returns the result.
- predicted: full · documented: full · derivable: no

### `collect` — nearly
- read at `e61b1db3462a` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function recursively traverses a tree-sitter node, filters for function definitions of the specified kinds/types, extracts their metadata (name, docs, location), and pushes FuncDef entries to the output vector. It's the core recursive collector used by the parsing pass.
- found: Checks if node accepts the given kinds (handling variable_declarators specially), extracts the function if matched, and returns early without descending (closures are part of the body, not siblings). For non-matching nodes, recursively walks children.
- predicted: most · documented: none · derivable: no

### `accepts` — nearly
- read at `427f246c4998` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function checks if a node's kind is in the provided kinds array. For Elixir, since everything parses as a `call` node, it must do additional structural checks beyond the kind match to identify true function definitions.
- found: Checks if the node's kind is in the kinds array; if not, returns false. For Elixir, extracts the "target" field and checks if its text is one of the specific keywords: def, defp, defmacro, defmacrop. For other languages, returns true after the kind check passes.
- predicted: most · documented: most · derivable: no

### `name_node` — nearly
- read at `9dab25574354` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function extracts the node representing the function/chunk name from a tree-sitter node. It likely pattern-matches on the language to handle different naming conventions across languages—most have a direct 'name' child, but some may require navigating a different structure. Returns None if the name node can't be found.
- found: Pattern-matches on language with language-specific logic: C/C++ walks nested declarators; Dart checks name field or signature→name; Objective-C finds first identifier (no fields); SQL finds object_reference→name; Elixir finds arguments node, gets first child, then its target or itself. Default case uses standard child_by_field_name("name").
- predicted: most · documented: most · derivable: no

### `body_node` — nearly
- read at `5ef5a69d8dc1` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Extracts the body node from a function node by checking language-specific field names or node kinds for the body structure, returning None if the body cannot be found.
- found: First tries "body" field; if not found, uses language-specific strategies: for Kotlin/SQL finds kind "function_body", for ObjC finds "compound_statement", for Elixir finds "do_block"; for others tries value.body (for arrow functions); returns None if none found.
- predicted: most · documented: some · derivable: no

### `extract` — nearly
- read at `666bdfd1aff1` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function extracts a single function definition from a tree-sitter node, parsing its name, location, documentation, owner (type), and body to construct a FuncDef. Given the peers like `leading_doc`, `owner_of`, and language-specific parsing functions, it likely orchestrates calls to those helpers to build a complete function definition.
- found: Extracts a function definition from a tree-sitter node by calling helper functions to get the name and body, then reconstructing the signature by slicing the source code from node start to body start. Handles documentation differently based on language (Python checks docstrings first, others check leading/wrapper comments). Returns a FuncDef struct with name, signature, body, doc, owner, and line number range.
- predicted: most · documented: none · derivable: no

### `names` — as expected
- read at `41927d2f73c8` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Parses source code for a given language and returns a vector of function/method names found in it by calling the language-specific parser and extracting the name field.
- found: Calls parse_functions to parse the source, then maps over the results to extract just the name field from each Function, collecting into a Vec<String>.
- predicted: full · documented: none · derivable: yes

### `rust_functions_and_doc_comments` — nearly
- read at `04e3d8220d06` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test for the Rust language parser verifying it correctly extracts function definitions and associates doc comments with them. Given peer tests like `typescript_arrow_consts_and_methods`, `python_docstrings_are_the_doc`, and `go_methods_and_functions`, this likely tests that the Rust parser recognizes `///` doc comments and attaches them to the following function.
- found: A test that parses Rust source with two functions: `add` (with multi-line `///` doc comments) and `undocumented` (with no doc). The `add` function also has an `#[inline]` attribute. The test verifies: closures nested in functions don't create separate entries (len==2), the first function name is "add", its doc combines both comment lines with newlines, the signature is captured ("fn add(a: u32, b: u32) -> u32"), and the undocumented function has no doc.
- predicted: most · documented: none · derivable: yes

### `a_blank_line_severs_a_comment_from_the_function` — as expected
- read at `f459376e878e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This test verifies that when there is a blank line between a comment and a function, the comment is not associated with that function—ensuring that only immediately preceding comments are treated as documentation.
- found: It parses Rust code with a license comment, blank line, and function, asserting that parse_functions returns the function with no doc field set, demonstrating blank lines sever comment-function association.
- predicted: full · documented: none · derivable: yes

### `typescript_arrow_consts_and_methods` — nearly
- read at `029a5677e652` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Test function verifying that the parser correctly identifies TypeScript arrow functions assigned as constants and arrow functions used as class methods as trackable functions.
- found: Test that verifies: (1) arrow function constants like 'const Panel = () => {}' are recognized as functions, (2) regular constants like 'NOT_A_FUNCTION = 42' are not recognized as functions, (3) class methods are recognized as functions, (4) doc comments on arrow functions are preserved correctly.
- predicted: most · documented: none · derivable: yes
- note: Straightforward test covering arrow functions, method recognition, and constant filtering in TypeScript parsing.

### `python_docstrings_are_the_doc` — as expected
- read at `695d4275a732` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This test verifies that when parsing Python code, docstrings are correctly extracted and stored as the documentation for the function.
- found: The test parses a Python function with a docstring, then asserts that the parsed function's name matches and its doc field contains the extracted docstring text.
- predicted: full · documented: none · derivable: yes

### `go_methods_and_functions` — as expected
- read at `60356498a371` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test function that verifies the parser correctly extracts methods and functions from Go source code, likely using tree-sitter to identify both standalone functions and receiver methods.
- found: A test that parses Go source containing a standalone function and a receiver method, calls names() to extract function names, and asserts it returns both ["Add", "Load"].
- predicted: full · documented: none · derivable: yes

### `a_method_is_qualified_by_the_type_it_hangs_off` — as expected
- read at `ec72aaab9a17` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This test verifies that methods are correctly identified and differentiated by their containing type/owner. It likely tests that duplicate method names in different types are parsed as separate entities with their type/owner properly recorded, preventing them from being confused.
- found: Parses Rust code with multiple implementations and trait methods, then asserts that each function is attributed to the correct owner: Tag and LogicalVolumeDescriptor own their parse methods, Tag owns the Read trait impl, Descriptor owns the trait method, and free_standing has no owner.
- predicted: full · documented: full · derivable: no

### `owners_across_the_languages_that_claim_one` — nearly
- read at `03ac0562d97e` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This test verifies that function "owners" (the types/classes that methods belong to) are correctly extracted across multiple programming languages. It likely parses code in various languages and asserts that methods have their owning type identified properly.
- found: Tests owner extraction via parse_functions across Python, Swift, TypeScript, Go, and Rust. Verifies class/struct names are captured as owners for methods. Includes edge cases: Go receiver syntax (* normalization), generic type parameters (Parser[T] → Parser not T), and free functions (no owner).
- predicted: most · documented: none · derivable: yes

### `a_nested_owner_names_its_whole_path` — nearly
- read at `0a5dd80599c9` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This is a test function that verifies nested types record their full owner path to avoid ambiguity. It likely creates a test case with nested types and asserts that the owner field contains the complete path (e.g., "Outer::Inner") rather than just the immediate parent.
- found: Parses Python code with nested classes (Boolean.Input and Image.Input, each with as_dict method). Asserts owner fields are ["Boolean.Input", "Image.Input"] using dot notation. Also verifies non-nested method (Suggester.next) has owner "Suggester" with no trailing path.
- predicted: most · documented: none · derivable: yes

### `unparseable_input_yields_nothing_rather_than_panicking` — as expected
- read at `dd58ebb6de65` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This short test validates that the parser handles malformed or empty input gracefully, returning empty results rather than panicking. It likely tests a few invalid inputs across different languages.
- found: The test calls parse_functions with Rust and malformed code "fn (((", asserts empty result, then calls with Go and empty string, asserts empty result.
- predicted: full · documented: none · derivable: yes

### `a_nested_type_does_not_inherit_the_enclosing_docstring` — as expected
- read at `e8a8732ad160` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A unit test verifying that nested type members in Swift do not inherit their enclosing class's docstring. It parses Swift code with a documented class containing an undocumented nested struct and methods, then validates that the nested init and other members have no docs (not inheriting the class's doc), while documented members retain their own docs.
- found: Parses Swift code containing a documented `SentenceSuggester` class with an undocumented nested `Context` struct and `init`, plus documented and undocumented methods. Asserts that `init` has no doc (not inheriting the class's), `untouched()` has no doc (not inheriting from parent), and `next()` still contains its own doc about returning the next suggestion.
- predicted: full · documented: none · derivable: yes

### `swift_functions_methods_and_inits` — as expected
- read at `29c96a23a8ba` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This is a test function that verifies the parser correctly extracts Swift functions, methods, and initializers from source code, likely checking that the parser identifies and categorizes all three constructs properly.
- found: It defines Swift source with functions, methods, inits and extensions, parses them, verifies all five are extracted by name, and checks that docs, signatures are correct and extension methods are not named with "extension".
- predicted: full · documented: none · derivable: yes

### `every_language_finds_its_functions` — as expected
- read at `86894e4aa152` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Tests that each supported language correctly finds functions in sample code by creating test cases with (Language, sample_code, expected_names), parsing each, and asserting extracted names match expectations across all languages.
- found: Creates tuples of (Lang, source_code, expected_function_names) for 15 languages, parses each sample, extracts function names, and asserts they match expected names.
- predicted: full · documented: full · derivable: no

### `classes_are_not_chunks` — as expected
- read at `2985aebfeeaf` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This is a test function verifying that class/type containers are not parsed as individual wedges. The docs indicate the bug: if class declarations are treated like function nodes, lines get double-counted and scores are wrong. The test likely confirms that classes are skipped as chunks while their methods are parsed individually.
- found: Test that parses Java and Ruby classes and asserts exactly the methods (not the class itself) are returned as functions. First case: class with two methods yields 2 parsed functions. Second case: Ruby class with one method yields 1 parsed function.
- predicted: full · documented: full · derivable: no

## src-tauri/src/reports.rs

### `index_path` — nearly — STALE
- read at `03555470a6fa` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Utility function that returns the file path where the assessment report or index is stored, likely in a .sanity directory in the repo or in a standard assessment storage location.
- found: Returns the path to a global projects.json index file stored in the system data directory (~/Library/Application Support/Sanity on macOS). Creates the directory if it doesn't exist, then returns the path to projects.json inside it.
- predicted: most · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `load_index` — as expected
- read at `134516bb5dcc` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function loads a saved index of known projects from disk. It probably reads a file at the path provided by `index_path` and deserializes it into a KnownProjects struct, returning it or a default empty value if the file doesn't exist.
- found: Gets the path from `index_path()`, reads the file to a string, deserializes it from JSON, and returns the result or a default KnownProjects if any step fails (the chain uses Option combinators to handle errors).
- predicted: full · documented: none · derivable: no

### `save_index` — nearly
- read at `8587a2dec70e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function saves the known projects index to a file atomically. Based on the docs mentioning atomic writes and temp file cleanup, it probably writes to a temporary file first, then renames it to the actual projects.json file, ensuring that any temp file leftover from a failed rename is cleaned up.
- found: Gets the index path, serializes the index to pretty JSON, writes to a .json.tmp file, then renames it to the final path. If the write succeeds but the rename fails, it removes the temp file. Returns silently without reporting errors at any stage.
- predicted: most · documented: full · derivable: no

## src-tauri/src/scan.rs

### `collect_files` — nearly
- read at `3d31d2bb20ab` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This function walks the directory tree from root, respects .gitignore/.ignore patterns to skip directories like node_modules and target, and returns a vector of tuples with file paths and their detected programming languages for each parseable source file found.
- found: Uses ignore::WalkBuilder to traverse the tree, respecting .gitignore/.ignore patterns and requiring git=false so it works on non-git repos. Filters to files only and for each file: extracts extension to detect Lang, checks file metadata, excludes files in VENDORED directories (node_modules, vendor, etc.), and skips files larger than MAX_FILE_BYTES. Returns vector of (path, lang) tuples.
- predicted: most · documented: full · derivable: no

### `rel` — as expected
- read at `f6fcec444e0e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: This function computes a relative path from a root to a target path, normalizing all backslashes to forward slashes to ensure cross-platform consistency in node IDs (so Windows and macOS scans produce identical identifiers).
- found: Strips the root path prefix from the path (falling back to the full path if stripping fails), then decomposes it into OS-agnostic path components, converts each to a string, and joins them with forward slashes.
- predicted: full · documented: none · derivable: yes

### `scope_of` — as expected
- read at `c6d23af04a47` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function loads and parses the `.sanityignore` file from the repo root using gitignore syntax, returning a compiled Gitignore matcher or None. The matcher is used to exclude directories/files from analysis based on user configuration.
- found: Constructs path to `.sanityignore` at the root, returns None if it doesn't exist, otherwise builds and returns a compiled gitignore matcher from the file, returning None if the build fails.
- predicted: full · documented: most · derivable: no

### `context_for` — nearly
- read at `2510f48391d5` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Given the doc and signature, this function builds a string for the model prompt by concatenating the file's imports and 1-2 sibling function bodies around the `skip` index, excluding the target function itself. This provides the model with file-level context (imports, conventions, nearby code) for predicting whether the function being scored is boilerplate.
- found: The function builds a context string by starting with the file's preamble/imports (file.head), then iterating through functions in order, skipping the one at index `skip`, taking the first CONTEXT_SIBLINGS functions, and for each appending its signature and the first CONTEXT_SIBLING_LINES lines of its body. This provides the model prompt with the file structure and neighboring function patterns without the target function.
- predicted: most · documented: none · derivable: yes

### `parse_file` — nearly — STALE
- read at `c3b3e6347d94` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function takes a file path, language identifier, and fidelity level, then parses the source file to extract function/definition locations, handles gitignore scoping, and returns a ParsedFile structure containing the parsed functions and metadata.
- found: The function reads the source file, rejects minified files (lines > MINIFIED_LINE_BYTES), parses functions for the language, returns None if no functions found, conditionally computes fingerprints based on fidelity level (Full vs Ordering), extracts the first N lines as file head context, checks gitignore scope to set the excluded flag, and returns a ParsedFile with all metadata.
- predicted: most · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `apply_dir_history` — as expected
- read at `2754a8f9bc96` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Applies git history information to a node by looking up and filling in the DISTINCT commit count for that directory or file path from the History data, handling both directories and files despite the name.
- found: For Dir or File nodes with a score, looks up commits from History using the node's path and sets score.commits. Recursively applies the same operation to all child nodes in the tree.
- predicted: full · documented: full · derivable: no

### `score_dir` — nearly
- read at `fd77e841b207` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: This function scores a collection of parsed files using git history and blame data, generating a vector of scored nodes (likely representing directory-level aggregations). It probably accumulates statistics from individual files and computes aggregate scores based on the fidelity setting.
- found: For each parsed file, extracts git history (churn, age, commits, author). For each function in the file, gets function-specific blame or falls back to file-level history, determines peer functions based on fidelity, calculates distinctiveness and surprise scores, then constructs scored Node objects for each function. Returns tuples of (file_path, file_node_with_function_children).
- predicted: most · documented: none · derivable: no

### `apply_model_scores` — nearly
- read at `a18a00e74148` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function iterates through nodes (possibly a tree), and for each node that has a corresponding entry in the upgrades HashMap, replaces the proxy surprise score with the model's surprise score and marks those leaf nodes as analyzed.
- found: For Func nodes, looks up the node.id in the upgrades HashMap and if found, replaces surprise with the reading's surprise, sets source to Model, sets analyzed_share to 1.0, and copies hotspots from the reading; otherwise recursively applies model scores to all children.
- predicted: most · documented: full · derivable: no

### `insert` — as expected
- read at `e3ece70114bb` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Inserts a file node into the tree at its relative path, creating intermediate directory nodes as needed by splitting the path and traversing down, creating missing Dir nodes along the way.
- found: Splits the relative path by '/', iterates through all path parts except the last (the file). For each directory part, searches for an existing child with matching name and NodeKind::Dir; if found uses it, if not creates and appends a new Dir node. Updates cur to point to each directory as it traverses/creates them. Finally appends the file node to cur.children.
- predicted: full · documented: none · derivable: yes

### `collapse_chains` — nearly
- read at `d7b9b654eeb3` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Recursively collapses chains of single-child directories into single nodes. Traverses the tree to find directories where each node in the chain has only one child directory. Merges these chains by concatenating names and updating path information to preserve the full path while reducing visual rings.
- found: Post-order traversal: recursively calls collapse_chains on all children first. Then uses a while loop: while node is Dir with exactly 1 child that is also a Dir, removes the child and merges it into parent by: concatenating names with '/', updating id and path to child's values, moving child's children up. Loop continues to handle entire chains, not just pairs.
- predicted: most · documented: full · derivable: no
- note: Elegant loop-based approach that handles arbitrarily long chains and preserves full paths via name concatenation.

### `scan` — nearly — STALE
- read at `fafd39db392a` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: This is the main entry point that orchestrates the entire scanning pipeline. It likely collects files, parses them, applies directory history, scores everything, applies model scores, and fires callbacks as it progresses. It handles cancellation via the atomic bool and returns a Scan result.
- found: Orchestrates the complete scanning pipeline: collects and parses files in parallel, builds a fast proxy-scored tree for immediate display, optionally runs a model pass with work queue prioritized by proxy intensity, parallel scoring with streaming callbacks inside the map, caches results, applies model scores and history, properly reaggregating after each phase, and returns Scan with stats.
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fixture` — nearly
- read at `60d889d6f8b2` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This test fixture creates and returns a temporary directory for use in test cases, initializing a basic directory structure that tests can use.
- found: Creates a temporary directory with a nested src/deep/nest structure, writes a .rs file with sample Rust functions (add, sub), creates a .gitignore file, and adds a vendor directory with a file to test that gitignore patterns are respected by the scanner.
- predicted: most · documented: none · derivable: no

### `ordering_fidelity_changes_the_score_and_nothing_else` — nearly — STALE
- read at `f3bd21643386` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Test verifying that Ordering fidelity produces identical tree structure and node properties as Full fidelity scanning, with only surprise scores potentially differing.
- found: Scans a fixture with both Full and Ordering fidelity, then asserts that function counts, file counts, and total LOC match, and that both produce identical function IDs (proving tree structure is identical), ensuring fidelity only affects scores.
- predicted: most · documented: none · derivable: yes
- note: Captured the general concept but missed the specific stat assertions and the id collection helper used to verify tree identity.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `run` — as expected — STALE
- read at `0a361133a50e` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This is a test helper function that performs a complete scan of a directory and returns the Scan result, likely wrapping the main scan function with test setup/configuration.
- found: Calls scan() with the directory, HeuristicModel scorer, empty callback closures, a false cancellation flag, ephemeral cache, and Full fidelity, then unwraps the result.
- predicted: full · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `gitignored_paths_never_enter_the_picture` — as expected
- read at `1350304cce85` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This appears to be a test function based on the descriptive name and peer functions that also look like test names. It likely verifies that files matching .gitignore patterns are correctly excluded from the scanning/parsing process and don't appear in results.
- found: A unit test (marked with #[test]) that verifies gitignored paths are excluded from scan results. It gets a test fixture directory, runs the scan on it, collects all node names from the result tree via visit(), then asserts that an included file "add" is present and an ignored path "vendored" is absent from the results.
- predicted: full · documented: none · derivable: yes

### `single_child_directory_chains_collapse_to_one_ring` — as expected
- read at `288b0132c0a1` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test verifying that when scanning a repository with single-child directory chains (e.g., src/deep/nest), these chains collapse into a single node in the tree rather than being drawn as separate concentric rings in the sunburst.
- found: Tests that single-child directory chains (src -> deep -> nest) collapse into one node named "src/deep/nest" under the root, rather than creating separate intermediate nodes, while the root itself retains its own name.
- predicted: full · documented: none · derivable: no

### `parents_are_exactly_as_wide_as_their_children` — nearly
- read at `a9b150d8ddd4` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A unit test that validates the tree structure's width consistency. It scans a test fixture and verifies that each parent node's LOC (width) equals the sum of its children's LOCs, ensuring the tree aggregation is correct.
- found: Scans a test fixture, retrieves a specific file node deep in the tree (root's first child's first child), sums the LOC of all functions within that file, and asserts both that the file's LOC equals the sum of its children and that the root's LOC equals that same sum (suggesting the fixture is structured such that one file's functions account for the entire repo's LOC).
- predicted: most · documented: none · derivable: yes
- note: I got the general concept right but didn't predict which specific nodes would be tested or why the root assertion would equal a single file's children sum.

### `documentation_is_graded_not_discounted` — nearly
- read at `eb17db31b620` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This is a test function that verifies documentation is graded as a separate measurement rather than used to discount or reduce the surprise score. It likely creates a test case with documentation and asserts that the documentation grade is reported independently.
- found: Scans test fixture, collects functions by name, asserts sub (undocumented) has documented=0.0 and add (documented) has documented>0.0. Deliberately does NOT assert surprise differs, with inline comment explaining documentation now works through model prompt, not as a multiplier. Asserts add.temperature() equals add.surprise to confirm documented doesn't modify temperature.
- predicted: most · documented: none · derivable: yes

### `a_repo_without_git_says_so_rather_than_guessing` — nearly
- read at `da59b5f04c21` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Verifies that when scanning a directory without git history, the scan correctly reports this fact via a flag or message rather than guessing at age or churn metrics.
- found: Tests that scanning a non-git directory sets the stats.without_history flag to true, and as a result all nodes have age_days set to None (no age information can be computed without git history).
- predicted: most · documented: none · derivable: no
- note: Got the concept right (detect and report no git) but missed the specific mechanism (without_history flag and its cascading effect on age_days).

### `scanning_an_empty_directory_is_not_an_error` — as expected
- read at `e9061929436c` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This is a test function that verifies the scan operation handles empty directories gracefully, likely calling the scan function and asserting it returns success rather than an error.
- found: Creates a temporary empty directory, runs the scan on it, and asserts the resulting scan has 0 functions and the root node has 0 lines of code.
- predicted: full · documented: none · derivable: no

## src-tauri/src/surprise.rs

### `min_lines` — unrecognisable
- read at `da2fafdfa1fa` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: The min_lines method returns a threshold—the minimum line count below which the SurpriseModel returns the proxy score without performing actual analysis, allowing progress tracking and UI rendering to handle short functions separately.
- found: Returns the constant 0, indicating SurpriseModel has no minimum line threshold and analyzes all functions regardless of size.
- predicted: none · documented: none · derivable: yes
- note: Docs describe a purpose (threshold for skipping analysis) but SurpriseModel implements it as 0, so no functions are actually skipped; appears to be part of an abstraction where other models might have nonzero thresholds.

### `is_model` — surprising
- read at `6e15fcfcee77` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This method checks if the scorer is a real model versus the offline heuristic proxy. The docs explain that only real model readings get colored on the map; the proxy is just a sorting mechanism, so coloring it would be false. The method probably returns true for actual models, false for the heuristic proxy.
- found: The method simply returns false. This implementation (HeuristicModel's scorer) is not a model—it's the offline proxy that acts as a sorter. The architecture likely has other scorer implementations that override this to return true for real models.
- predicted: some · documented: full · derivable: no
- note: Predicted conditional logic based on the rationale in docs, but the actual implementation is a simple constant false. Extensive docs explain design intent that cannot be derived from code alone.

### `label` — nearly
- read at `917badd7dfa9` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Returns a string label identifying this HeuristicModel for display or identification purposes, something like 'heuristic' or 'heuristic_model'.
- found: Returns the literal string "heuristic (no model)".
- predicted: most · documented: none · derivable: no

### `surprise` — as expected
- read at `4ad7588cda70` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Passes the proxy score through wrapped in a Reading, with minimal transformation, since this is the heuristic model passthrough.
- found: Takes the proxy parameter and wraps it in a plain Reading by calling Reading::plain(proxy), ignoring the item parameter.
- predicted: full · documented: none · derivable: yes

### `plain` — nearly
- read at `f17c052feff9` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: This creates a Reading with the given surprise value and default values for documentation and derivability grades (likely all none or undecided).
- found: Constructs a Reading with the provided surprise value and an empty hotspots vector.
- predicted: most · documented: none · derivable: yes

### `calibrate_surprisal` — as expected
- read at `6594a80197bd` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function converts bits per token (a raw surprisal measurement from the model) into a normalized 0..1 scale. It uses calibration constants to map the unbounded surprisal value into a meaningful visual range where highly predictable code sits low and genuinely unpredictable code sits high.
- found: It performs linear normalization of bits between constants PREDICTABLE (0.5) and UNEXPECTED (4.0), then clamps the result to [0.0, 1.0].
- predicted: full · documented: full · derivable: no

### `predictable_code_is_cold_and_unexpected_code_is_hot` — as expected
- read at `9a2e92ab2932` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: This is a test function that verifies the surprise model correctly assigns low surprise scores to predictable code and high surprise scores to unexpected code.
- found: A test that verifies calibrate_surprisal correctly maps low values (0.2) to cold (0.0), high values (9.0) to hot (1.0), and maintains monotonic increasing order (lower input => lower output).
- predicted: full · documented: none · derivable: no

### `the_heuristic_model_passes_the_proxy_through_untouched` — as expected
- read at `78f34acb294b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This is a test function that verifies the heuristic model passes the proxy surprise score through without modification. Given peer functions about SurpriseModel and HeuristicModel, it likely asserts that the heuristic model returns the same surprise value as the proxy, not altering it.
- found: Test that creates a minimal Item and calls HeuristicModel.surprise(&item, 0.73), asserting that the returned surprise value equals 0.73, confirming the proxy score is passed through untouched.
- predicted: full · documented: none · derivable: yes
