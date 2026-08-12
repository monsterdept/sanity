# src-tauri — sanity assessment

494 of 498 read · 31 surprising · 100 stale

391 of these graded legibility under an earlier question and are not counted; see the note below.

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
- read at `85fd5a79591b` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The standard Tauri build script: a three-line file whose main calls tauri_build::build() to generate app context and embed resources at compile time. No header comment, no custom logic.
- found: Exactly that — `fn main() { tauri_build::build() }` and nothing else. No header comment at all.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main`
- read at `4b8ff0908edc` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The Tauri build script — a single call to tauri_build::build().
- found: Exactly that, one line.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/agentapi.rs

### the file itself
- spec 1 · read at `13bea21e143d` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: The central HTTP loopback API server: AppState/project registry with locking and lease/focus tracking, a task queue (collect_tasks/qualify/neighbours/interleave_by_file) that hands out functions/files while tracking staleness, the report/status/summary/health endpoint handlers, endpoint-file-based service discovery, and restore/persist logic for surviving restarts.
- found: Matches well. The header frames the whole file's reason for existing (agent-driven assessment vs scoring backends), and the Project struct carries extensive documented fields for leasing, per-file rest windows to spread handouts across files, and mtime+length file_marks to detect when a file moved under a handed-out range.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: Not a cold read of the file: I had already read the aggregate, report, and summary functions from this same file earlier in this run.

### `persist`
- read at `9026cbfb1fc1` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: Builds index entries (key, repo, name, touched) from the loaded projects, loads the on-disk index, merges live entries over it so unloaded projects survive, sets active, and writes it back.
- found: That, with two details I did not state: the merge is done by retaining only disk entries whose key is NOT live and then extending, so a loaded project is updated rather than duplicated; and `active` is written only when this session HAS one, so a mid-restore persist cannot blank the last session's choice. Also sorts by descending `touched` before save_index.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Warm: I had already read restore() in this same file, whose docs describe this merge.

### `touch` — QUIRKY
- read at `55fd28ba8d19` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Moves the key to the front of a most-recent-first history vector, removing any existing entry to avoid duplicates, possibly capping length and calling persist(); does not set active.
- found: Recency is a monotonic logical clock, not a list: increments self.clock and stamps that counter onto the project's `touched` field, then persists. No vector, no dedup, no cap. A missing key is silently a no-op.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The docs' "front of the history" reads as a list; it is actually a per-project logical-clock stamp, and touching an unknown key does nothing at all while still bumping the clock and persisting.

### `focus`
- read at `082b08f3133b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Sets active = key and returns true when asked, or when nothing holds the view (no active key, or an active naming a project not in the loaded map); otherwise leaves active alone and returns false.
- found: Exactly that, with `vacant` computed via is_none_or over projects.contains_key, plus a persist() call on the path that moves the view.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `ping`
- read at `91298fd27435` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Push a record of the tool call onto a bounded activity log on AppState — tool name, trimmed to a cap so the mascot/UI can react — and bump a last-activity instant used by the idle check.
- found: Exactly that: sets last_agent to now, stores last_tool, increments a monotonic ping counter, pushes (seq, tool) onto a VecDeque and pops from the front while it exceeds RECENT_CALLS. The sequence number rather than a timestamp is the only detail I did not name.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `most_recent`
- read at `cd9df96183b4` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Returns the key of the project with the greatest `touched` timestamp among the loaded projects — an iterate-and-max-by over the projects map, cloning the winning key, None when nothing is loaded.
- found: Exactly that: projects.iter().max_by_key(|(_, p)| p.touched).map(|(key, _)| key.clone()).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Not cold: this is my third reading in agentapi.rs, though in a distant region; the doc comment is far longer than the body and is entirely about why, not what.

### `for_client`
- read at `ba69fe737561` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Given Some(key), returns Some(key) only if that project is loaded, None otherwise with no fall-through; given None, falls back to the session's current/last-opened project, itself possibly None.
- found: Exactly that, in four lines: `projects.contains_key(k).then(|| k.to_string())` for the supplied key, and `self.most_recent()` for None.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment says the no-key fallback is `active` (the repo the window follows) but the body calls `most_recent()` — the prose and the code name different fallbacks, and the whole doc is an argument about which one is safe.

### `owner_of`
- spec 1 · read at `43668cd9209d` · commit `23c2295` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Resolves which project a reading belongs to by provenance rather than the caller's ambient key: checks the caller-supplied `asked` project first, then looks for a project holding a live lease on id, falling back to any loaded project whose scan still contains a function with that id, returning that project's key or None.
- found: Close, but the tie-break is different: `holds` treats a live lease OR the scan containing the id as equally valid evidence (no lease-first priority), collects every project that holds it, sorts for determinism, and on a genuine tie between multiple projects prefers whichever was most recently opened, falling back to the alphabetically-first key otherwise.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I assumed lease evidence would be checked before scan evidence as a stronger signal; instead they're OR'd together and disambiguation only happens when more than one project matches, via recency rather than lease-vs-scan priority.

### `holds_id`
- spec 1 · read at `7b2894141274` · commit `23c2295` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A short free function that walks scan.root and returns true if any node's id matches id exactly, false otherwise — a simple membership check used by owner_of.
- found: Exactly that: visits every node in the scan tree, OR-ing whether its id equals the target, and returns the accumulated boolean.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `load_reports`
- read at `fa12f19321c7` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A three-line wrapper delegating to the .sanity/ markdown parser, e.g. assessment::load(repo, scan).unwrap_or_default(), returning reports keyed by key_of with no fallback store.
- found: Exactly that, minus the error handling: a single-expression delegation to crate::assessment::load(repo, scan), which already returns a HashMap rather than a Result.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment is ~20 lines of post-mortem on a deleted migration attached to a one-line delegation; valuable history, but nothing in it describes this body.

### `save_reports`
- read at `8a688d237d03` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Delegates to assessment::save(repo, scan, reports) and maps the error to a String; no fallback, no hidden-file write, so the report handler can surface a real failure.
- found: Exactly that, with the error text spelling out the .sanity/ directory path and telling the agent the reading is held in memory but unsaved and will be lost on close.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Warm: I read release_endpoint in this file at position 7.

### `project_key`
- read at `6a33b539f2ed` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Canonicalises the path, falling back to the path as given when canonicalisation fails (e.g. it does not exist), and returns it as a lossy String so `.`, `~/x/` and `/x` key one project.
- found: Exactly that, four chained calls: fs::canonicalize, unwrap_or_else to the original PathBuf, to_string_lossy, to_string.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `lock`
- read at `ca72bf09f016` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 2 of its run
- expected: Call state.lock() and return the MutexGuard, unwrapping a PoisonError via into_inner() so a poisoned mutex is recovered rather than propagated. No Result, no logging.
- found: Exactly that: `state.lock().unwrap_or_else(|e| e.into_inner())`, one line.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `surprise`
- read at `f4498e5794ce` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A four-arm match over Grade returning an f32 surprise on 0..1, inverted (Full = lowest surprise, None = highest) and deliberately unevenly spaced per the doc, with the two confident grades bunched near the cold end and wider gaps separating Some and None.
- found: Exactly that: Full 0.08, Most 0.30, Some 0.62, None 0.92.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc says the two confident steps sit close together, but Full→Most is 0.22 and Most→Some is 0.32 — closer, though not as tight as the prose implies.

### `documented`
- read at `aa3d2140395e` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: A match over the four Grade variants (Full/Most/Some/None) returning a documentation-coverage fraction around 1.0/0.66/0.33/0.0, mirroring the sibling Grade::surprise.
- found: Exactly a four-arm match returning 0.95 / 0.7 / 0.35 / 0.0 — Full stops short of 1.0, which is the only choice here that carries an opinion.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `blank`
- spec 1 · read at `eecda920ae27` · commit `e159229` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Report::blank constructs a Report with every field set to its zero/empty/None/false default, used as a starting point that parsers (like parse_shard) and tests fill in field by field.
- found: Exactly that: a struct literal setting every field of Report to its empty/default value (empty strings, None options, false bools, spec 0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `grades`
- read at `ff2b681f16b3` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Returns (surprise, documented): surprise from `predicted` when present, else the legacy `surprised` bool mapped to the two ends of the scale with no invented middle; documented from the reader's field as an Option, except a true `derivable` forces it to the lowest grade regardless of what the reader said.
- found: Exactly that: `predicted.unwrap_or(if surprised { None } else { Full })`, then `derivable` short-circuits to `Some(Grade::None)` otherwise passes `self.documented` through.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `neighbours`
- read at `54267878d209` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Returns a window of up to 20 names centred on index i, clamped so it slides to the start or end rather than losing slots, plus the count of names not included (len minus window).
- found: That, with one detail I did not state: the subject itself is excluded from the window (filtered by index, not by name — which is what keeps same-named twins apart), so the window is PEER_WINDOW+1 wide and yields PEER_WINDOW peers. Short files return everything with omitted 0.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The clamp `min(len - PEER_WINDOW - 1)` is correct only because the short-file branch above guarantees len > PEER_WINDOW + 1; the two lines have to move together.

### `qualify`
- read at `eb82576b9d9d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Formats a qualified member name with the separator the language actually writes: `Owner::name` for Rust/C++/PHP, `Owner#name` for Ruby, `Owner.name` for the dot languages, bare `name` when there is no owner. Pure formatting.
- found: Just that, except Ruby: a comment says it is deliberately excluded from the `::` list because `Foo::bar` is a constant lookup and `Foo#bar` is the method, so it falls through to the dot default. The `::` set is exactly Rust, Cpp, Php; everything else, including an unknown language, gets a dot.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The Ruby comment argues neither separator is obvious and then picks the dot, which in Ruby denotes a class-method call — the same small untruth the doc comment says the function exists to avoid, just a quieter one than `::`.

### `collect_tasks` — QUIRKY
- read at `875fc8c7ff6b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Recursively walks the node tree carrying the file doc down; at each function computes its key, skips excluded or unexpired-leased ones, and builds a Task — abs path, line/end_line, signature, owner, docs, nearest twenty peers in file order plus peers_omitted — pushed into out with a priority float putting stale readings ahead of unread and ordering the rest by proxy temperature.
- found: The function branch is as predicted (keyed on node.id, is_stale check, lease check, priority = surprise + 1.0 if stale), but there are two things I did not cover. A File node gets its OWN task — same staleness and lease rules, priority from hot_share, line 1 to the max child end_line, ask=FILE_ASK, and the COMPLETE child list as peers rather than a window — skipped when the file is .sanityignore-excluded or has no children. And the peers window is assigned afterwards by the file branch: it records which child index produced each task via a `from` vector (because not every child yields one), then rewrites peers/peers_omitted on exactly the tasks added after the file's own, so the file's full list is never replaced.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Nothing in the signature or (absent) doc comment hints that this queues file-level readings as well as functions, which is half of what it does.

### `all_tasks`
- read at `5fb98f9a6ff4` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Build a Task for every function in the scan with no report lookup and no lease filtering — the same construction collect_tasks uses — and return them all, so `just tokens` weighs the real payload rather than a rebuilt copy.
- found: Exactly that: it calls collect_tasks with two empty HashMaps (reports, leases), Some(repo), no limit, then drops the sort/priority key from each pair and returns the Tasks.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: The doc's last claim is stale — it says `peers` has no bound and is every function in the file, but the tasks this API hands out now carry the nearest twenty plus `peers_omitted`.

### `default_n` — QUIRKY
- read at `368876d2ad6b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A bare serde default provider returning the batch-size constant — given the doc comment titled "Ten readings per reader" and its cost table concluding at ten, I expected `10` (or a named constant), as the one place the batch size is decided so the MCP shim can omit `n` and let serde fill it.
- found: It returns 1. The doc's final paragraph resolves this: `default_n` is the size of one HANDOUT, and "ten readings per reader" is achieved by the protocol asking for ten separate calls, not by a batch of ten.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The doc opens "Ten readings per reader" with a table arguing ten, and the function returns 1 — the reconciliation (handout size vs. call count) is the last sentence of ~50 lines, so a skimming reader predicts the wrong number.

### `priming_note`
- spec 1 · read at `46e73a09a277` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: priming_note checks whether the repo has agent instructions (CLAUDE.md/AGENTS.md) via agent_docs, and if so returns a warning string, phrased as a question rather than an assertion, telling the orchestrator to check its own context for whether the file was loaded — since the tool can only see the file's existence on disk, not whether any given session's context includes it. Returns None for a repo with no such file.
- found: Matches the prediction: builds a message naming the docs file(s), explicitly disclaiming that neither the message nor the file's presence is evidence about the session's context, telling the orchestrator to check and report `primed` honestly either way, and — if primed — to tell the human before the first wave that relaunching with `claude --setting-sources user` is the fix.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `contract_note`
- read at `3ed19309ec38` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Takes the caller's reported contract fingerprint (None for a shim too old to send one), compares to the server's compiled-in expectation, returns None on a match and otherwise Some(message) telling the caller its shim is stale and to restart it.
- found: Exactly that: compares `sent` against mcp::contract_fingerprint(); None on equality, a long "different tool contract, restart before assessing" warning on mismatch, and a softer "predates the contract check" warning when None.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Body indentation in this region is one space per level rather than the file's four, which reads as a formatting accident.

### `open_project` — QUIRKY — TANGLED
- spec 1 · read at `100a6ce93883` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: open_project is the HTTP handler backing sanity_open: it validates the given path is a directory and a git repo, registers/updates it in shared app state, kicks off a structural scan (tree-sitter, git churn) to seed offline-proxy scores, and returns a JSON summary of the project — without moving the window's focus unless asked, since opening is a claim about what's being worked on, not what should be displayed.
- found: Validates path/git-root, always rescans even if already held (staleness is hash-based and a stale scan can't detect its own staleness), adds the project to a `restoring` list so the sidebar shows progress during the scan, runs scan::scan in a blocking task with a persistent ScanCache, on failure clears the restoring entry and returns an error, then on success reloads reports keyed by the durable key_of (not node id, since ids embed line numbers), refreshes .sanity/README.md, computes staleness/assessed counts, inserts/updates the Project in state, calls focus(), and returns a large JSON payload (reopened, showing, index, contract_warning, priming_warning, agent_docs, functions/files/assessed/excluded, shape, sanityignore guidance, scan_ms/scan_note, stale, protocol text).
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

### `scan_note`
- read at `229afd11d13f` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns None when ms is under a slowness threshold (silence for fast opens), otherwise a human sentence explaining the wait, worded differently depending on `reopened`: a first open pays to parse and blame every file, a re-open pays only for what changed, phrased so it reassures rather than reading as a fault.
- found: Exactly that shape: SLOW_MS = 5000, early None below it, otherwise a formatted sentence giving the duration in seconds, saying the parse/blame cache is per machine and later opens cost only what changed, with a parenthetical appended when `reopened`, plus an explicit 'it is not a hang, and retrying restarts it'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `work_left`
- read at `e02e7715161c` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Counts outstanding work without letting leases hide it: collects every unread-or-stale queueable item as `remaining` ignoring leases, counts live unexpired leases separately as `in_flight`, returns both in WorkLeft.
- found: That, via collect_tasks with an empty lease map so leases cannot filter the list, plus a third field I did not predict: `outstanding`, the itemised (id, age_secs) of live leases that still cover unread work, sorted oldest first. A lease is only in flight if its task is still in the unread set and its age is under LEASE.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No doc comment on a function whose whole reason for existing (coverage must never be reported off a lease-filtered list) is an explicit project rule — only an inline comment about leases carries it.

### `count_stale`
- read at `200e2b695720` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Walks the live functions in the scan (not the reports map), looks each up in reports by key_of(path, name, ord), and counts those whose stored reading hash differs from the function's current reading hash — readings that exist but have expired. Returns a usize, skipping unread and probably excluded functions.
- found: Right in shape — a visitor over scan.root counting nodes whose report is_stale against the node's current body. Two details I missed: it counts FILE readings as well as function readings, deliberately, because assessed() subtracts this from reports.len() which holds every kind and an expired file reading was being left in the numerator; and the lookup is by node.id, with staleness delegated to assessment::is_stale rather than compared inline. No exclusion filter.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: This keys the in-memory reports map by node.id, which reads oddly against the repo's stated rule that nothing durable is keyed on a node id since ids embed @line — worth confirming the in-memory map really is id-keyed while the committed store is key_of-keyed.

### `assessed`
- read at `a2d6866ac3c9` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Walks the live scan's function nodes, looks up each one's committed reading, and counts those that exist and are not stale — coverage derived from the scan side rather than reports.len().
- found: Visits every node in project.scan.root, skips anything that is not Func or File, looks the node up in project.reports by node.id, and increments a counter when assessment::is_stale(report, node.body) is false. Returns the count.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I did not predict that whole-FILE readings count toward `assessed` alongside functions; also the in-memory lookup is by `node.id`, which is worth a glance given the durable store is keyed differently.

### `count_funcs`
- read at `7b3363869ffa` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Walks the scan's node tree returning (functions in scope, functions excluded by .sanityignore), incrementing one counter or the other per function node from an excluded flag, so both figures come from one pass and are reported together.
- found: Exactly that, via a nested recursive `walk` that carries an `out_of_scope` boolean INHERITED down the tree (`out_of_scope || node.excluded`), so excluding a directory excludes every function beneath it rather than requiring the flag on each leaf. Picks the counter with an `if` inside the deref. One pass, both totals.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Warm: this is my second function from agentapi.rs, though 1500 lines from the first and I had not read this region.

### `count_files`
- read at `0bf1cef3d458` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Walks the scan's file nodes, skips any with no declarations, and returns (counted, excluded) — files counting toward file-reading coverage versus those set aside by .sanityignore — mirroring count_funcs so both totals are reported together.
- found: Exactly that, via a nested recursive `walk` that inherits `excluded` down the tree (a directory's exclusion is sticky for its children) and counts a File node into `kept` or `dropped` only when it has children.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc records the bug that motivated it (sidebar reading 150/631 with 62 unqueued file readings), which no reading of the body would recover.

### `shape_of`
- read at `453b5df49bf7` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Walk the scan tree, bucket each function under its top-level path segment, count functions (and excluded) per bucket, sort descending, and return JSON rows of directory name plus counts — never function names.
- found: That, with a recursive inner walk carrying an inherited `excluded` flag down the tree so a function under an excluded ancestor lands in the `excluded` column rather than `functions`. Sorted by kept+excluded descending and truncated to the top 15 — the cap is the one thing I did not predict.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The silent top-15 truncation is undocumented: a repo with many top-level directories would show an agent a partial shape it has no way to know is partial, which is the "narrowed subset presented as the whole" failure this field exists to avoid.

### `interleave_by_file`
- read at `52681135f9b4` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes tasks pre-sorted by descending proxy score, buckets them by file path preserving rank order within each bucket, then round-robins across buckets taking each file's top remaining task until n are collected or buckets empty; file order determined by rank of each file's best task.
- found: Exactly that. It re-sorts `ranked` descending itself (doesn't assume sorted input), buckets by path via a HashMap of path->index into a Vec of Vecs so first-seen order equals descending-best-score order, then loops `round` taking `file.get(round)` from each bucket, breaking when a full pass makes no progress.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `mark_of`
- read at `c13c189db655` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Four lines returning the file's resync mark: fs::metadata(repo.join(rel_path)) and, on success, (modified time, len()) — the mtime-plus-length pair resync_changed compares, length included because two writes in one second can share an mtime. None on any error.
- found: Exactly that, with `.ok()?` on both the metadata call and `modified()`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `resync_file` — TRAP
- read at `04ce80873340` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Re-parses one file from disk, matches fresh functions to existing nodes by name+ordinal, overwrites line/end_line/signature/docs/hash while leaving node ids alone, drops functions that have gone, does not add new ones, returns false when the file is absent or unparseable.
- found: That, plus a half I did not predict: the FILE node itself is re-cut — its doc is replaced from file_doc and its own reading_hash recomputed over file_surface(&defs), because the module header is half of what a reading hashes against and leaving it stale would make readings flip between current and expired on alternate opens. Matching is by (name, ordinal) via retain_mut over the existing children.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: Ordinals are counted over the OLD children in order, so deleting the FIRST of two same-named functions gives the survivor old-ord 1 against fresh-ord 0, no match, and it is silently dropped from the tree along with the one that really went — the same twin-shifting hazard the ordinal exists to prevent, one level up.

### `stamp_marks`
- read at `fe22a15ea032` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Walks the scan tree's File nodes, calls mark_of(repo, path) on each, collects the successful ones into a HashMap of path to (mtime, len), skipping files it cannot stat.
- found: Exactly that — `visit` over the root, `NodeKind::File` filter, `if let Some(m) = mark_of(...)` insert, return the map.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm and easy: I had already read `resync_changed` in this file, which contains this exact visit-and-mark loop inline, so my prediction was recall of a neighbour rather than inference from the signature.

### `resync_changed`
- read at `c557041e903a` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Walks the project's files, stats mtime+length, compares to a stored fingerprint, calls resync_file for those that differ, records fingerprints for first sightings without re-cutting, returns the count re-cut.
- found: Exactly that — visits File nodes, collects `mark_of` marks, uses `file_marks.insert(...).is_some_and(|was| was != m)` so a first sighting is recorded but not counted as moved, resyncs each moved path, and additionally calls `scan.root.aggregate()` so parent widths follow the changed line counts. Returns `moved.len()`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `spread_across_files`
- read at `60f93358437e` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Given tasks already ranked by score, splits them by whether their file appears in `recent` within a cooldown relative to `now` — rested files first in score order, recently-drawn ones as fallback — and returns the top n Tasks, probably via a stable sort on a 'touched lately' boolean, dropping the score.
- found: A three-line partition on `recent[path]` being absent or older than FILE_REST, then it hands EITHER the fresh set or — only if fresh is empty — the resting set to interleave_by_file(_, n). So it is all-or-nothing rather than a preference ordering: resting tasks are not appended behind fresh ones, they are simply not considered unless nothing is fresh. Score-dropping and the top-n cut both happen inside interleave_by_file, not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc's phrase "preferred, not forbidden" is precise about the fallback but understates the switch: with even one fresh task available, every resting task is excluded outright rather than ranked lower.

### `queue`
- read at `6d80194c3b51` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: The axum handler behind sanity_next: resolves the caller's project via for_client(p.key) under the shared lock, calls resync_changed first so line numbers match the file as it is now, gathers candidates (stale ahead of unread) via collect_tasks, drops anything already leased, passes the ranked list through interleave_by_file to take p.n, stamps a lease on each, returns JSON.
- found: That, with two additions. Leasing is not just excluded from collection — `recent_files` is stamped alongside `leased`, and the ranked list goes through `spread_across_files(tasks, &project.recent_files, now, p.n)` rather than `interleave_by_file` directly, so coldness is enforced ACROSS concurrent readers, not merely within one handout. And the state is `ping`ed with a distinguishing event: `sanity_next:done` only when nothing was handed out AND `work_left(project).remaining == 0`, so an empty response while work is leased reads as an ordinary wait rather than as the job finishing. Both no-project paths return an empty Vec rather than an error.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: An unresolvable project returns `Json([])`, which a reader cannot distinguish from "the assessment is finished" — the one case the `:done` ping is careful to separate is invisible on the wire.

### `mangled`
- spec 1 · read at `54a1cc9e8a4a` · commit `23c2295` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A function that inspects a Report for signs that a reader's tool call got mangled by XML-vs-JSON serialization leaking closing tags into a text field, and returns a static hint string when it detects that, so the report can be refused and the reader asked to resend.
- found: Returns None if predicted/documented/legible are all present (a complete reading). Otherwise checks expected/found/note for the literal markers `</parameter>` and `<parameter name=`, or a field-specific closing tag, and returns Some(field_name) naming the first field where a leak was detected.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I expected it to return an explanatory hint message; it actually returns just the field name, presumably for the caller to build the message from.

### `report` — QUIRKY — TANGLED
- spec 1 · read at `2151ebbbd292` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The async handler backing sanity_report — validates the incoming ReportRequest (checking for the mangled field-order failure), looks up the project/node by id, stores the report into shared state, writes .sanity markdown, and returns a JSON response with ok, remaining, hint, and repo-wide stats.
- found: Does that, plus much more: rejects mangled calls with a specific corrective hint (without saving), refuses reports whose id has no owning project (rather than silently accepting and discarding, which was a prior bug), stamps provenance fields (body hash, spec, legible_dated, by, at, agent_docs) itself rather than trusting the caller, classifies the outcome as stale/hot/cold for a ping/mascot signal, writes reports through to disk on every call, and appends a repo-wide 'suspiciously low surprise rate' coaching hint when write succeeded, prioritizing a write-failure hint above it when one occurred.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

### `status`
- spec 1 · read at `28a5045367e8` · commit `8b03ada` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: An HTTP handler for the /status endpoint. It resolves the caller's project by client key (not by a global "active" project) using state.for_client, then reports progress fields such as remaining, in_flight, stale, done, an assessment_file path, a next_step hint, and a list of all open projects. If the resolved project isn't loaded, it returns an open false response with a hint distinguishing a transient restart from no repo being open.
- found: Matches the prediction closely. It pings activity, reads the refused reports counter, builds a summary list of all projects, and resolves the caller's project via state.for_client. If found, it returns project, repo, functions, excluded, assessed, remaining, in_flight, outstanding, stale, assessment_file, done, next_step, and projects; the next_step text branches on whether remaining is zero, whether remaining equals in_flight, and whether stale is greater than zero. If not found, it returns open false with a hint distinguishing a transient restart from no repo open at all.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `add`
- read at `5fc70728b6d5` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: GradeCounts holds one counter per grade (full/most/some/none); add matches Some(grade) and increments the matching field, doing nothing or bumping an "unset" counter for None. Feeds aggregate's repo-wide summary histogram.
- found: Exactly that, with the None arm incrementing an explicit `ungraded` counter rather than being dropped.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `add` #2
- spec 1 · read at `69fb7ab175b0` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Increments running totals in a Tally struct: readings count, delegates to GradeCounts::add for predicted/documented/legible axes, and likely tracks cold/warm and derivable counts.
- found: Matches closely: increments readings, adds predicted/documented via GradeCounts::add, counts derivable and trap and cold as usize sums, and gates the legible count through legible_current(r.spec) so a reading answering a superseded question doesn't count toward the current rung.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `aggregate`
- spec 1 · read at `5512fa0c1e69` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks project's stored functions/reports and computes grade-distribution counts (via GradeCounts/Tally) into an Aggregate struct, similar to what sanity_status/sanity_summary expose.
- found: Visits every Func node in the scan tree, skips ones without a report or whose report is stale (counting staleness separately), then tallies totals, per-model breakdowns (with an 'unattributed' bucket for blank model), a three-way priming bucket (not_applicable/exposed/clean), and per-position predicted-grade tallies.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `summary`
- spec 1 · read at `273da480a992` · commit `e159229` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: The async handler behind sanity_summary — resolves the project from query params, calls aggregate() to get grade distributions/model splits, and returns them as JSON with a note field, omitting per-file breakdown.
- found: Matches: pings, resolves project (or returns an 'open: false' hint if none), calls aggregate() and work_left()/count_funcs(), and returns functions/excluded/assessed/stale/remaining plus total, by_model, by_position, priming, and a long explanatory note describing how to interpret by_position as a curve and priming's exposed/clean/not_applicable split.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `from_state` — QUIRKY
- read at `96a39d72cc16` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Iterate state.projects into ProjectSummary rows (key, name, repo, functions, excluded, assessed excluding stale, stale, remaining/in-flight, touched), sort most-recently-touched first, and stamp the active project onto the returned ProjectList.
- found: That, plus two things I did not cover: a `working` flag from `last_agent.elapsed() < 60s`, and a whole second pass appending placeholder rows for projects in `state.restoring` that have not loaded yet — every count deliberately zeroed behind `loading` (including `scanned: 0` so the first real scan reads as a change) with `read_done`/`read_total` from `restoring_progress`, filtered so a row cannot appear twice. No remaining/in-flight fields exist here at all.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The name and signature give no hint that half the body exists to synthesise rows for projects that are not in `state.projects` yet.

### `health`
- read at `d39dce89409c` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A 3-line axum handler returning JSON with `ok: true` and the process pid, touching no shared state — the liveness probe serve/study use to decide whether a backend is already up, deliberately not calling ping.
- found: Exactly that: `Json(json!({ "ok": true, "pid": std::process::id() }))`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `router`
- read at `28d3d5e245cf` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Builds the axum Router: /queue, /report, /status, /summary, /projects, /open, /health wired to handlers with the right verbs, then .with_state(state).
- found: Exactly that, six routes: GET /health, POST /open, GET /queue, POST /report, GET /status, GET /summary, then with_state. No /projects endpoint (the project list rides inside other responses).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `endpoint_file`
- read at `836f29d29a70` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Path to the machine-local file holding the backend's port and pid: a well-known filename joined onto an OS data/cache dir, None when that base cannot be resolved.
- found: One line: reports::data_dir()? joined with "agent-endpoint.json", wrapped in Some.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains why the port is published and pid-stamped but never says where — the location is the one thing the name promises and the body is the only place it appears.

### `url`
- read at `8cd0a583018e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Endpoint is the endpoint-file record (port plus pid); url() formats the port into a loopback base URL like http://127.0.0.1:{port}, no I/O.
- found: Exactly that: `format!("http://127.0.0.1:{}", self.port)`, on a Copy struct holding `port: u16` and `pid: u32`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `read_endpoint`
- read at `50286e4f7a32` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Reads the endpoint file via endpoint_file(), parses it into Endpoint { port, pid }, returns None on any failure — missing, unreadable, unparseable — and makes no liveness claim.
- found: Exactly that, as one `?`-chain: read_to_string, serde_json::from_str into a Value, then port and pid pulled out as u64 and narrowed with u16/u32 try_from, every step folding failure into None.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `release_endpoint`
- read at `3706daad6cfe` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Read the endpoint file; if its recorded pid equals the argument, remove the file, ignoring removal errors; otherwise leave it alone.
- found: Exactly that, verbatim shape: read_endpoint().is_some_and(|ep| ep.pid == pid) guarding a best-effort remove_file(endpoint_file()).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `restore` — QUIRKY
- read at `b4059af11a92` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Spawns a background thread that reads the saved project index, and for each entry still present on disk rescans the repo, loads its .sanity/ readings, and inserts the project into shared state — dropping moved or deleted repos silently, never calling touch, and deferring the index write until the whole list is rebuilt.
- found: That, plus three mechanisms I did not predict: (1) before spawning, it advances `s.clock` past the highest saved `touched` so this session's projects sort above last session's, and publishes `index.projects` into `s.restoring` so the sidebar fills immediately; (2) it drives a `restoring`/`restoring_progress` pending list, with a `settled` closure removing each row whatever the outcome, and forwards scan progress per key; (3) it iterates in REVERSE so the last-touched project lands last, sets `active` when a restored key matches the index's, and after the loop falls back to the most recently touched project that actually came back. Ends with a single `s.persist()`.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The comment at the `active` assignment says it is "decided once, after the loop", but the assignment is inside the loop — only the fallback is after it; the behaviour is correct, the comment describes a different structure.

### `watch_tick`
- read at `95ab0f9186f2` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Briefly lock to snapshot each project's repo, marks and lease state; off-lock probe and, where marks differ, rescan; then re-take the lock to install the scan, re-stamp file_marks, bump `scanned` so the window refetches, and persist — skipping projects that vanished or gained a lease meanwhile.
- found: That, with both off-lock steps done via spawn_blocking and the lease re-check under the lock exactly as expected. Two things I did not cover: reports are reloaded from disk against the FRESH tree (`load_reports`) rather than carried across, because in-memory keys are node ids carrying `@line`; and `marks` are re-probed AFTER the scan so anything the walk itself touched cannot read as a change next tick. A failed scan continues without touching marks, so a repo mid-checkout retries. No persist call — `scanned` is a session counter.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `serve` — TRAP
- read at `7b1cd59ca231` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Binds a loopback listener on an ephemeral port, reads the port back, writes the endpoint file with port and pid, spawns axum serving `router()` in the background, returns the port.
- found: All of that, and additionally spawns a second task looping `watch_tick(&state)` every `WATCH_TICK` so the backend notices the repo moving (commits made after the scan) without a window.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: The endpoint-file write is `let _ = std::fs::write(...)`, so a failed claim is absorbed and `serve` still returns Ok with a port nothing can discover — the server looks healthy while every shim reports it not running.

### `task`
- read at `7f4484662fb8` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A test-module helper constructing a Task for a path and name with everything else defaulted — id `path#name`, empty docs/peers, placeholder lines — so lease and queue tests can build handout items without a scan.
- found: Exactly that: id `{path}#{name}`, abs_path and path both set to the same string, line 1 / end_line 10 / lines 10, and every other field empty or false.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I had already read the neighbouring test helper in this file at position 6.

### `project_of`
- read at `111384ad932a` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: A test helper that scans dir with the heuristic model and wraps the result in a Project with empty reports/leases and default bookkeeping, so tests get a real parsed tree without going through the HTTP handler.
- found: Exactly that: scan(dir, HeuristicModel, no-op progress/reading callbacks, un-cancelled flag, ephemeral score and scan caches, Fidelity::Ordering).unwrap(), then a Project literal named "t" with empty reports/leased/recent_files, file_marks from stamp_marks, marks from watch::probe, scanned 1, touched 0, last_agent None.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: this is my second reading in agentapi.rs, and the scan call is a near-copy of the one in open_project which I had just read, so the prediction was partly recall.

### `a_shim_serving_a_stale_contract_is_told_to_restart`
- read at `889c2e2dbbe0` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test comparing a shim's reported contract fingerprint against the current one: a mismatch produces a warning mentioning restart, a match produces nothing.
- found: Exactly that, via contract_note(Option<&str>) against mcp::contract_fingerprint(), asserting the warning text lowercases to contain "restart" — plus a third case I did not predict: contract_note(None), a shim too old to send a fingerprint at all, must also warn.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_file_edited_before_the_first_handout_is_still_re_cut`
- read at `df278033b628` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A test building a temp repo, scanning it so marks are stamped at scan time, editing the file to insert lines BEFORE any resync/queue call, then handing out and asserting the task's line/end_line match the function's real post-edit position — proving the first sighting still detects movement.
- found: Exactly that shape, calling resync_changed directly rather than going through queue: writes a.rs, project_of, rewrites it with three comment lines prepended, asserts resync_changed returns 1 (one file re-cut), then walks the scan tree for `second` and asserts its line is now 5.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm on agentapi.rs (second reading), though from a distant region; the docstring here is a genuine post-mortem the code could not have produced.

### `a_save_mid_restore_does_not_erase_projects_it_has_not_loaded`
- read at `3d6852b0122a` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test writing a persisted index with several projects, then a partially-restored in-memory map holding only one, calling persist, and asserting the on-disk index still lists all originals (merged, not overwritten).
- found: Exactly that: index with /a and /b, an AppState holding only /b with touched=9, persist(), then asserts /a survives, no duplication (len 2), /b updated in place, and this session's active wins.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `drop`
- read at `d99f9726141a` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test guard's Drop restoring the data-dir env override: set the variable back to the saved previous value, or remove it if there was none, so the override does not leak between tests.
- found: Exactly that: takes self.prev, set_var("SANITY_DATA_DIR", v) or remove_var, inside an unsafe block (Rust 2024's unsafe env mutation).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Process-global env mutation in a guard is only sound while these tests are serialised; nothing in the guard itself enforces that against Rust's default parallel test threads.

### `data_home`
- read at `db5ad6703c12` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test-only guard that points the process's data directory (where the endpoint/port file lives) at a fresh temp directory via an env var and returns a DataHome whose Drop restores the previous value and removes the temp dir, so tests cannot collide with a real install or each other.
- found: Exactly that, with one mechanism I did not name: because env vars are process-global it first takes a static ENV_LOCK, recovering from poisoning with `unwrap_or_else(|e| e.into_inner())` rather than honouring it, and carries the MutexGuard inside the returned DataHome so the lock is held for the guard's whole lifetime. It stashes the previous SANITY_DATA_DIR, sets the new one through the unsafe set_var, and holds the TempDir so it is deleted on drop.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The only docs handed over were the module header about the agent API; this helper carries no comment of its own, so nothing tells a reader that the returned value is a lock guard as well as a directory and must be bound, not dropped immediately.

### `standing_down_withdraws_only_its_own_claim`
- read at `47867a4f2199` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test writing an endpoint file naming this pid, calling release_endpoint and asserting the file is gone; then rewriting it with a different pid (a superseding app) and asserting release_endpoint leaves it untouched.
- found: Exactly those two cases, done in the opposite order with explicit pids (file names 1234, departing daemon 999, file survives; then release_endpoint(1234) removes it), in an isolated data_home. A third case I did not predict: calling release_endpoint again on an already-absent file must not panic, because two exits can race.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `outstanding_itemises_only_live_leases_on_unread_work`
- read at `e5d3b447c0db` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Build a project with several functions, lease some, land a report for one leased function and expire another; assert `outstanding` lists exactly the live leases over unread functions and that its length equals `in_flight`.
- found: A tempdir fixture with two Rust fns; collect_tasks filtered to non-file tasks; then three assertions in sequence — no leases means in_flight 0 and empty outstanding; one lease means in_flight 1, outstanding of the same length and carrying the leased id, with `remaining` unchanged at 3 (two functions plus the file itself); then inserting a blank Report for that id drops it from both remaining and in_flight. There is no expired-lease case — expiry is not exercised here at all.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Warm on the file; also, the test covers the read-but-still-leased case but never a lease that has simply aged out, which is the other half of "live".

### `the_summary_counts_neither_stale_readings_nor_unknown_positions_as_good_news`
- read at `d5c2b1fa80cf` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test building a project with a current reading at a known position, a stale one (body hash mismatch) and one with no position, then asserting the stale reading is excluded from the assessed/graded aggregates and the position-less one lands in an "unknown" bucket rather than counting as position 1 in by_position.
- found: Exactly that, built concretely: a temp repo with three one-line functions, ids harvested by visiting the scan tree, a local `reading` helper banking Reports with Grade::Full. Asserts agg.stale == 1, total.readings == 2, and that the stale one is also missing from its model's by_model tally; then that by_position has separate buckets for 1 and 7 with none invented for 2, and unrecorded == 0. Finally it overwrites the position-7 reading with a position-None one and asserts unrecorded becomes 1 while bucket 7 disappears and bucket 1 is unchanged.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `same_named_methods_arrive_with_the_type_they_hang_off`
- read at `0aac151286d0` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test building a temp project whose one file holds two same-named functions on different types, running the handout/queue path, and asserting each task carries a distinct `owner`, and that `peers` shows both twins rather than one deduped `parse`.
- found: Exactly that: writes udf.rs with two `impl` blocks each defining `parse`, calls collect_tasks, filters out the file-level task, asserts two tasks with owners DescriptorTag and LogicalVolumeDescriptor, and asserts each task's single peer is qualified (`::parse`), peers_omitted is 0, and no function lists itself as its own peer.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `an_excluded_file_leaves_the_queue_and_stays_in_the_count`
- read at `3c057371d459` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test building a temp project with two files, writing a .sanityignore matching one, then asserting the excluded file's functions never appear in the queue while the totals still report them — excluded non-zero and the overall count unchanged, so the exclusion stays visible rather than shrinking the denominator.
- found: That, in four stages: baseline (3,0) with no .sanityignore proving no defaults; (1,2) after ignoring tests/; collect_tasks yielding only "one"; and shape_of showing tests/ with excluded=2, functions=0 so a reader could propose the exclusion from numbers.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I did not predict the no-.sanityignore baseline assertion, which is the part that pins "no defaults, ever".

### `a_reading_for_a_deleted_function_is_not_coverage`
- read at `cf9d26a07bd4` · commit `6366346` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A unit test building a project whose scan holds a few functions, inserting reports including one keyed to a function no longer present, then asserting assessed() counts only readings matching live functions so the orphan is not coverage.
- found: That property, reached through a real temp repo: writes gate.rs with two functions, collects their ids and bodies from the scan, inserts a blank Report per function against its own body, asserts assessed == 2; then rewrites the file with one function, rescans, swaps in the new scan while keeping the old reports map, and asserts assessed == 1.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I predicted the reports map would be keyed with key_of and it is keyed by node id here; I had read that rule in the project brief rather than from the handout, so I graded on the handout alone.

### `deleting_a_twin_expires_the_survivors_reading_rather_than_moving_it`
- read at `4e1be19ce4a0` · commit `6366346` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A test writing a file with two same-named functions with different bodies, recording a reading against each, then deleting the first and re-syncing; it asserts the survivor, now occupying the deleted twin's ordinal, does not inherit the dead reading as valid but comes back STALE on the body-hash check and is re-queued.
- found: That, with two same-named `go` methods on different impl blocks as the twins. It seeds a blank Report per function against its own body, rewrites the file with only the second impl, calls resync_changed, then walks the scan and asserts exactly one function remains and that assessment::is_stale is true for it. It checks staleness directly and never asserts the re-queue or an assessed count.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's first line — "A file is handed out as its own reading, with the header and the whole list" — describes a different test entirely (a neighbouring peer of that name); everything after it is an accurate account of this one.

### `a_file_is_queued_as_its_own_reading`
- read at `154af36fe5c3` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A test building a small fixture project whose file carries a header comment, running the queue, and asserting that among the tasks there is one for the FILE itself — marked by kind/ask as the header reading — alongside the tasks for the functions inside it.
- found: Exactly that, via a tempdir with a two-function gate.rs and collect_tasks: it asserts exactly one task has file=true, that its id is the bare path (no `#`), that its docs are the joined module header, that peers lists every declaration with peers_omitted 0, that ask is non-empty, and that the two function tasks still come through with file=false.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Not cold — I had already read another function in agentapi.rs earlier in this run, though not this region.

### `a_file_reading_expires_on_its_header_and_its_surface`
- read at `011abc3cd53e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A 37-line test building a file reading then asserting three mutations: changing the banner/header doc marks it stale, changing the declared surface (signatures) marks it stale, and rewriting a function body leaves the reading current.
- found: Exactly that, via a hash closure that writes a temp file, rescans, and pulls the File node's body hash; four assertions — rewritten header, changed param type, added declaration all differ; a changed body does not.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_long_file_sends_the_neighbourhood_and_counts_the_rest`
- read at `ed952eb59390` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A test with a file of well over 20 functions asserting the task's peers holds exactly 20 entries around the target in file order, that peers_omitted is the remainder (total - 1 - 20), and that the target is not its own peer.
- found: Tests `neighbours(&names, idx)` directly over 100 names at four positions: middle (window size PEER_WINDOW, omitted 99-PEER_WINDOW, self excluded, immediate neighbours present), index 0 and index 99 where the window SLIDES rather than half-emptying so the count stays full, and a 5-name file handed over whole with omitted == 0.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The sliding-window edge behaviour — a function at the start of a file still gets a full window, all of it forward — is the real content and is not hinted at anywhere outside the body.

### `a_file_that_moved_is_re_cut_before_anything_is_handed_out`
- read at `25a55854a18c` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A long test: scan a temp repo with a two-function file, edit it so lines shift, then assert the handed-out task's line/end_line match the real on-disk position and that signature/docs/body hash were refreshed, while node ids stay put and functions added since the scan are not offered.
- found: Very close. It calls resync_changed directly rather than going through queue, and asserts: 0 re-cuts on a fresh scan; after prepending three comment lines and appending `third`, exactly 1 file re-cut; first/second move to lines 4 and 5; the body hash of `second` is UNCHANGED (a move must not expire a reading — the opposite of my "hash refreshed"); and `third` is absent because a new function needs peer scoring on reopen.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Warm on this file (I read one earlier test in it); the test never exercises queue despite the name saying "before anything is handed out", so the top-of-queue wiring is asserted nowhere here.

### `a_function_that_is_gone_stops_being_offered`
- read at `ac71df55ca7a` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test that scans a file, removes one of its functions from disk, then runs the re-cut (resync_changed) and asserts the vanished function is no longer handed out rather than being offered at stale line numbers.
- found: Exactly that: writes a.rs with keep() and go(), builds a project, asserts resync_changed returns 0 (nothing changed), rewrites the file with only keep(), asserts resync_changed returns 1 file re-cut, then walks the scan tree and asserts the remaining func names are exactly ["keep"]. It checks the tree rather than a queue call, which is the same claim one level down.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `status_answers_about_the_callers_repo_not_the_window`
- read at `423ef47f6867` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test registering two projects, pointing the window's active/focus at project B, then calling the /status handler with project A's key and asserting the response names A (project/repo, its own assessed/remaining) rather than B — proving /status routes by session key rather than through `active`.
- found: That, in two halves: two temp repos are registered, `active` is set to "theirs" while "mine" is touched last; /status with project=Some("/mine") must answer "mine" and name its path, and then a SECOND assertion with project=None must also answer "mine" — the keyless fallback follows the last repo OPENED (touched), not the window's active.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs cover only the keyed half; the keyless touched-vs-active half — the one that matters for `report` — is documented solely in inline comments.

### `a_project_key_that_is_not_loaded_is_refused_rather_than_swapped`
- read at `75c4e912dae3` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test that builds state with one project loaded and active, calls for_client with a key naming a project that is NOT loaded, and asserts None rather than a fallback to the loaded/active one, plus a companion assertion that for_client(None) still resolves to the loaded project.
- found: Exactly that: a tempdir project inserted as "/loaded" with active set, then three assertions — a loaded key resolves to itself, "/not-restored-yet" resolves to None with a message about never answering a named project with the active one, and a keyless call falls back to "/loaded".
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The third assertion sets only `state.active`, never `touched`, so it cannot distinguish the documented keyless fallback (last repo OPENED) from the one the project notes say must never be used (`active`).

### `a_reading_lands_where_its_task_came_from`
- spec 1 · read at `25a3b8f1958d` · commit `23c2295` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Sets up two loaded projects, leases a function id out of project A's queue, simulates the shim's ambient key having been retargeted to project B, and asserts the reading still resolves to project A — the one that actually issued the task — rather than following the swapped ambient key.
- found: Same core mechanism but simpler: it takes a real function id straight from `/theirs`'s scan (no lease needed, just scan membership), then calls owner_of with the caller's key set to `/mine`, set to `/theirs`, and unset, asserting all three resolve to `/theirs` — the project the id actually belongs to.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I over-specified the mechanism as depending on a lease; scan membership alone is sufficient evidence here, leases are exercised in the neighbouring test instead.

### `a_reading_for_an_id_no_project_holds_is_refused` — QUIRKY
- spec 1 · read at `6468feeb0ed0` · commit `23c2295` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A test asserting that calling the report handler with an id that no loaded project's scan holds returns ok:false, saved:false, and an error about nowhere to land, rather than silently succeeding as saved:true.
- found: Actually tests `owner_of` directly rather than the full report() JSON response: asserts it returns None for an unknown id both with and without an `asked` project key, then shows that inserting a live lease for that same id makes owner_of resolve it to the project — demonstrating a lease alone is sufficient evidence even when the scan doesn't hold the id.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I expected an end-to-end test of the report handler's JSON response; it's a narrower unit test of owner_of, and it adds the lease-outlives-a-recut case I hadn't anticipated.

### `a_file_just_drawn_from_is_passed_over_on_the_next_call`
- read at `67217c463b2e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test with functions across several files calling queue with n=1 twice, asserting the second task's file differs from the first — the queue remembers what it just handed out rather than relying on within-batch interleaving; probably also asserts fallback when one file remains.
- found: Tests spread_across_files directly with a ranked list and an explicit `recent` map of file -> Instant: unrested picks the top-ranked hot.rs; with hot.rs recent it picks the lower-ranked other.rs; with only hot.rs left it still hands work over (preference, not lock); and once the timestamp is older than FILE_REST, ranking decides again.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I missed the time-based FILE_REST expiry entirely — the rest is a decaying preference keyed on Instant, not a "last file" memory.

### `queue_spreads_across_files`
- read at `2d5ef9f4073a` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test building a synthetic ranked list over a few files (one file scoring highest throughout), running the queue's interleave, and asserting no two consecutive handed-out tasks come from the same file.
- found: Exactly that — 5 tasks each in hot.rs/mid.rs/cold.rs with descending scores, interleave_by_file(ranked, 6), length check plus a windows(2) adjacency assertion — and additionally asserts the ranking is preserved at the head (handed[0] is hot.rs/h0), so spreading cannot degenerate into ranking-blind round-robin.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The comment claims "while other files have work left" but the assertion is unconditional adjacency; it holds only because 6 &lt; 15, not because the test checks the caveat.

### `queue_falls_back_when_one_file_remains`
- read at `fe50b27b0f2e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test where all unread work sits in one file, calling the queue/interleave for several tasks and asserting it still hands out the requested count from that single file rather than starving.
- found: Builds four ranked tasks all in "only.rs" at score 0.5, calls interleave_by_file(ranked, 3), asserts exactly 3 come back.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Only the count is asserted; the test named for "falls back" never checks the tasks are distinct, so returning the same task three times would pass.

### `queue_never_repeats_or_overruns`
- read at `5d37dac2518c` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test that sets up a small project with a known number of queueable functions, calls queue asking for more than exist, then asserts the returned batch length equals the available total rather than panicking, and that no id appears twice.
- found: A four-line unit test on interleave_by_file directly, not on queue: two ranked tasks in different files, asking for 25, asserting the result has length 2 and the two ids differ. Same property, but tested against the pure helper with hand-built tasks rather than a project fixture.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: With only two distinct-file tasks, "never repeats" is asserted at the weakest possible size — a duplication bug that only appears when one file supplies several tasks would pass this.

### `two_projects`
- read at `ccdba1707d8d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test fixture builder: make a temp DataHome and a throwaway repo dir holding one trivial source file, scan it, then insert two Project entries into a fresh AppState under keys /x and /y sharing that scan, returning the DataHome and TempDir guards with the state so neither is dropped and the focus/touch tests never write into the real index.
- found: Exactly that in seven lines: data_home(), a tempdir holding one `a.rs` with a single fn, an AppState::default() with /x and /y both mapped to project_of(dir.path()), returned as a triple so the guards outlive the test.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `an_unasked_open_does_not_steal_the_window`
- read at `ccd2b12870a2` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Loads two projects, focuses the window on the first, opens the second with asked:false, and asserts the view still names the first while the second stays loaded and addressable.
- found: Uses the two_projects fixture, sets active to /x, asserts focus("/y", false) returns false and active is unchanged, then asserts focus("/y", true) returns true and moves active to /y. It tests only the focus return value and active, not addressability.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `an_open_takes_a_window_that_nobody_holds`
- read at `5fdf359bc236` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A test where nothing holds the view (no active project, as in a headless daemon), opening a project unasked and asserting focus still takes it — the complement of an_unasked_open_does_not_steal_the_window.
- found: That, plus a second case I did not cover: after setting active to a key that is not loaded ("/gone"), focus("/y", false) still succeeds, because an active naming an unloaded project points at nothing and so is not a view being taken from anyone. Uses the shared two_projects fixture and asserts both the bool and state.active.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Second reading from agentapi.rs, so not cold on the file — though only 18 unrelated lines of it were read earlier.

### `a_keyless_call_follows_the_last_open_not_the_window`
- read at `fa6903e398b2` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: A test loading two projects, setting the window (`active`) to the first and the last-opened (`touched`) to the second, then asserting for_client(None) resolves to the second — the last opened — not the one on screen.
- found: That, via a `two_projects()` fixture: focus("/x", true) then touch("/x"), touch("/y"); asserts active is still "/x" while for_client(None) is "/y". Two assertions beyond my prediction: an explicit key still wins outright, and a key naming nothing loaded still returns None.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Its last two assertions duplicate a_project_key_that_is_not_loaded_is_refused_rather_than_swapped, and this test is the one that actually separates `touched` from `active`.

### `endpoint_reads_back_what_was_published` — QUIRKY
- read at `f66a505968be` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Publish an endpoint (port and pid), read it back through the shared parser both halves use, and assert the parsed values match what was written — the round-trip the daemon and the shim both depend on.
- found: It never touches the shared parser. It builds an Endpoint, asserts `url()` formats as http://127.0.0.1:51823, then hand-builds a JSON object from the same two fields, parses it with serde_json and asserts the two numbers come back. Nothing writes or reads the endpoint FILE, and no publish/read function is called, so the doc's claim — "the endpoint file round-trips through the one parser both halves now share" — is not what is tested; only `url()` and serde_json itself are.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: The test named for the endpoint file round-tripping through the shared parser calls neither the publisher nor the parser — it round-trips a hand-built JSON object through serde_json, so the shared-parser property is unverified.

### `the_priming_warning_asks_rather_than_asserts`
- spec 1 · read at `c51236a9ccda` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A test verifying priming_note's wording: that it returns None for a repo with no instructions file, and for a repo with CLAUDE.md returns a message that names the file found and the remedy (the --setting-sources user flag) without flatly asserting the reader is primed — checking for hedged, non-assertive language rather than a flat claim.
- found: Confirms None on a clean tempdir; after writing CLAUDE.md, asserts the note contains "CLAUDE.md", "--setting-sources user", "cannot see", "CHECK YOUR OWN CONTEXT", and "the run is clean" (so the clean-context reader has a reachable, non-alarming conclusion too); then writes AGENTS.md as well and asserts both files are named together ("CLAUDE.md, AGENTS.md"), not just the first found.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_report_carrying_its_own_tool_call_is_refused`
- spec 1 · read at `da4694a4ddef` · commit `f41ae3a` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A test asserting `mangled()` catches a Report field containing embedded tool-call/XML-like syntax (e.g. a closing tag followed by a parameter fragment) and returns the offending field name, while a Report whose text legitimately contains angle brackets (e.g. discussing JSX) is not falsely flagged.
- found: Matches very closely. It builds a `leaked` report whose `found` contains a stray `</found> <parameter name="predicted">most` fragment and asserts `mangled` returns `Some("found")`, and separately checks what grade it would have banked (Full, since a missing `predicted` defaults there) to underline the stakes; a `trailing` report with `<div>` cut off by `</expected>` is also caught; and an `honest` report discussing real HTML tags in ordinary prose (including backticked `</p>`) is confirmed to pass with `None`.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I had already read this file earlier in this batch (agentapi.rs), so this is a warm reading of the same file, not cold — marking cold:false honestly per protocol.

### `a_leak_with_its_grades_intact_is_a_reading_and_is_kept`
- spec 1 · read at `6a2a0bdf22b2` · commit `8b03ada` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test that builds a Report whose `found` field contains a leaked tool-call/tag fragment alongside all required grades, and asserts that the `mangled` guard accepts it (returns None / not mangled) since all grades are present, keeping the trailing leak text as-is; likely also checks a companion case where a grade is missing and the guard rejects it.
- found: Builds a complete Report with a leaked `</parameter>` tag in `found` plus all three grades set, asserts `mangled` returns None (accepted) and that `grades().0` returns the actual chosen grade (Most) rather than a default. Then clones it with `predicted` set to None and asserts `mangled` now returns Some("found"), i.e. the guard flags the report by field name when a grade is missing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## src-tauri/src/assessment.rs

### the file itself
- spec 1 · read at `1d06fb26665e` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Persistence and staleness layer for the .sanity/ markdown store: hashes function bodies/docs to detect stale readings, parses/renders the markdown store (sharded by top-level directory) to/from an in-memory index, handles git provenance (head, author), and round-trips readings including edge cases like mangled entries or readings missing a position/spec.
- found: Matches closely: markdown IS the store (not a rendering of one), sharded per top-level directory plus a README index specifically to avoid concurrent-writer conflicts, staleness driven by body_hash comparison on open with no separate 'update' verb, and a versioned SPEC/PREDICTED_SINCE/LEGIBLE_SINCE provenance system so a reading records which build's question it answered rather than the file recording the question's history.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `legible_current`
- spec 1 · read at `c629493a51d2` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: spec >= LEGIBLE_SINCE
- found: Exactly that: `spec >= LEGIBLE_SINCE`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The doc explains a lot of design rationale (why >=, both-directions degrade) that isn't derivable from the one-line body alone — but the mechanical claim (this is a >= comparison) is; I marked derivable true for the mechanics, though the reasoning paragraph is not something a model could regenerate from the code.

### `reading_hash`
- read at `06911bed7259` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Joins file doc + function doc + body into one string, whitespace-collapsed so reflows do not expire readings, hashes it via body_hash, returns the digest used for staleness.
- found: Exactly that, with one deliberate detail: when both docs are absent it hashes the bare body so a doc-less function stays byte-identical to the old two-argument version and does not expire. Order is doc then file_doc, joined by a space, prefixed to the body; whitespace collapsing lives in body_hash.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `body_hash`
- read at `b719bea07049` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Collapse whitespace (split_whitespace over the body), run an FNV-1a-shaped loop over the resulting bytes seeded with the FNV offset basis but using the deliberately-wrong multiplier described in the docs, and return the digest as a short hex string.
- found: Exactly that, plus one detail I did not state: the digest is truncated to the low 48 bits and printed as 12 hex digits so it fits in a line of Markdown. The multiplier is 0x1000_0000_01b3, one hex digit wider than FNV-1a's real prime 0x100_0000_01b3 — so the doc's claim about the constant is accurate.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Correcting my own earlier note on this function: the multiplier really is not the FNV prime (extra digit), so the doc is right and my first reading of it was wrong.

### `dir`
- read at `086b47bb78c4` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Returns the assessment directory for a repo — repo.join(".sanity") — a one-line helper so the literal name appears once.
- found: Exactly that: repo.join(".sanity").
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `shard_of`
- read at `ac17c9f7e62c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns the shard name for a repo-relative path: the first path segment (top-level dir) if there is one, else a constant like "root" for files at the repo root so they collapse into one shard.
- found: split_once('/'); returns the non-empty top segment, otherwise the literal "root".
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc's reason (twenty loose config files should not become twenty files) is not recoverable from the code, only the behaviour is.

### `shard_links`
- read at `ebec6dfdb1ee` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Scans the index Markdown for `[label](name.md)` links and returns the link targets (shard filenames), so save knows which files it wrote and may sweep; likely a manual find of `](` … `)` filtering to .md names.
- found: Exactly that: match_indices("](") , slice to the next ')', keep names ending in .md, excluding any containing '/' and excluding README.md itself. Returns Vec<String>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `shard_file`
- read at `321691534c5d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Converts a shard name (top-level dir or bucket) into its .sanity/ Markdown filename: replacing separators and unsafe characters with dashes, probably lowercasing, appending .md, with a fixed name for the root shard.
- found: Maps every char that is not alphanumeric, '-', '_' or '.' to '-', then appends ".md". No lowercasing and no special-case for an empty/root shard.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The sanitiser is not injective — "a/b" and "a-b" collide on one shard file — and nothing in the function or its (absent) docs says why that is safe.

### `file_key`
- read at `4de367e6855c` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Returns the path unchanged as an owned String — a named identity function existing to make the "a bare path is the file's key" convention greppable and to pair with key_of.
- found: Exactly that: `path.to_string()`, one line.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `key_of`
- read at `34546cf94a0f` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A one-liner formatting the durable key: "{path}#{name}" when ord is the first occurrence, and "{path}#{name}#{ord+1}" otherwise — a plain conditional on ord == 0, no hashing or normalisation.
- found: Exactly that, character for character.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc is many times the length of the body and none of it is derivable from the body — the ordinal scheme's cost (91 functions lost on a real Swift repo) and its one known failure (reordering twins swaps their readings) are facts about history, not code.

### `grade_word`
- read at `25328bac3021` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: An eight-line match mapping each Grade variant to its lowercase wire word — full, most, some, none — the inverse of the neighbouring parse_grade, used when writing readings back out to Markdown.
- found: Exactly that: a four-arm match returning the lowercase word for each Grade variant.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `parse_grade`
- read at `6efa4a4b952e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: The inverse of grade_word — a match on the trimmed (possibly lowercased) string returning Some(Grade) for full/most/some/none and None otherwise, so an unrecognised word fails to parse rather than defaulting.
- found: Exactly that; it trims but does not lowercase, so a capitalised grade in the Markdown store would not parse.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `flat`
- read at `cb995229a222` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Collapses all whitespace runs, newlines included, into single spaces and trims, so a multi-line note becomes one line that cannot be mistaken for the Markdown bullet structure.
- found: One line: split_whitespace().collect::&lt;Vec&gt;().join(" "), which does exactly that including the implicit trim.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `load`
- read at `5ce1ef6cbfcc` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Reads every shard via read_all into a map keyed by key_of, then walks the scan's live functions and re-keys each matching reading under that function's node id; readings matching no live function are dropped.
- found: Exactly that, with an early return on an empty store and one detail I missed: it chains live_files(scan) after live_funcs(scan), so whole-file readings are resolved by the same rule, and it stamps the live node id onto the cloned Report's own `id` field as well as the map key.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc says "readings whose function no longer exists"; the body also covers file-level readings, which the doc does not mention.

### `read_all`
- read at `23599632fd93` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Read the `.sanity/` directory, take every shard Markdown file except the index/README, parse each with parse_shard, merge the entries into one HashMap keyed path#name, and return empty (never error) when the directory is missing or a file cannot be read.
- found: Exactly that: read_dir with a `let Ok(...) else { return out }` early exit, skip non-.md and README.md, read_to_string each and hand it to parse_shard which appends into the shared map; all errors silently skipped.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The one-line doc says keys are `path#name`, but per the project's own rule keys are `key_of(path, name, ord)` and same-named twins carry a `#2`/`#3` suffix — the doc understates the key.

### `parse_shard`
- spec 1 · read at `6d3e9e835b18` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: parse_shard parses the markdown produced by render_entry back into a HashMap of `path#name` key to Report, line by line, tolerating unrecognized lines by skipping them and dropping any entry that lacks both expected and found fields, so a hand-edit or merge conflict doesn't blow up the whole file.
- found: Walks lines tracking a current file (## heading) and current entry (### heading, parsing name/ordinal/verdict-decoration and computing its key via key_of or file_key), then for `- ` bullet lines matches expected:/found:/note: prefixes directly and otherwise splits the line on `·` to parse each provenance/grade segment independently by its own prefix (spec, read at, commit, read by, by, cold/warm reading, priming, reading N of its run, predicted/documented/derivable/legible/trap), flushing the current entry into the map whenever a new heading arrives or at EOF, but only if expected or found is non-empty.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `live_funcs`
- read at `3d7a51c31a86` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Walks the scan tree collecting every function node grouped by file, works through each file in line order counting repeats of the same name so the second twin gets ordinal 2 and the third 3, then builds a map from key_of(path, name, ord) to a Live record holding what save and staleness need — node, docs, signature, reading hash.
- found: Exactly that shape: visits Func nodes into a per-file vector of (line, name, id, body), sorts by line then id so ordinals are deterministic across scans, assigns zero-based ordinals per name via a seen map, and emits key_of(path, name, ord) -> Live { id, path, name, line, ord, body }. Live carries the reading hash as `body` and no docs/signature fields.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Ordinals are zero-based here while the key scheme is documented elsewhere as #2 for the second twin; the tie-break on id is what stops two scans disagreeing.

### `live_files`
- read at `85570ce70088` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Twin of live_funcs: walk the scan tree and for every readable file node — not excluded, holding at least one declaration — insert into a BTreeMap keyed by file_key(path) a Live value carrying the file's path/name and the reading hash of the text its header is graded against.
- found: Exactly that, via scan.root.visit with the three-way guard (kind != File, excluded, children.is_empty()), building Live { id, path, name, body } — with the two function-shaped fields `line` and `ord` pinned to 0, since a file has no position of its own and no same-named twins.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `is_stale`
- read at `cbdbbaa52183` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: False when the report has no stored hash (pre-store readings taken at their word); otherwise compares the stored hash against the current doc+body reading hash and returns true when they differ; a missing node body likely returns false rather than claiming staleness.
- found: Exactly that as a three-arm match on (report.body.as_str(), node_body): empty recorded hash is false, both present compares for inequality, and a missing current body is false. It compares pre-hashed strings — hashing happens in the caller, not here.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs cover the no-hash arm but say nothing about the missing-node arm, where a vanished function is silently reported as not stale.

### `row`
- spec 1 · read at `6f5e58cf55bc` · commit `94d194d` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Extracts (shard, read, total, surprising, stale, dated) tuple from a Compiled value for render_index.
- found: Exactly that: (self.shard.clone(), self.read, self.total, self.surprising, self.stale, self.dated).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Doc restates exactly what the one-line body does, nothing a model couldn't derive from the code alone.

### `compile`
- spec 1 · read at `ccdadd50cc08` · commit `94d194d` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Groups live functions/files by shard, builds a Compiled struct per shard with aggregate counts and rendered body text via render_entry, without writing to disk.
- found: Only includes functions/files that HAVE a report (skips unread), grouped by shard then by file (file's own entry sorts first), tracking read/surprising/stale/dated counts and rendering each via render_entry; `total` per shard is computed separately by counting ALL live functions+files in that shard (read or not), so read/total gives honest coverage.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Missed the distinct `dated` counter (legibility graded under an old spec) and that total is computed independently from the read set for honest coverage reporting.

### `repo_name`
- read at `e44c150f0a11` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Takes the path's final component as the display name for the index heading, with a fallback when there is no final component (root or relative path).
- found: file_name() lossily to String, falling back to the literal "this repo" — a prose fallback chosen so the generated index still reads as a sentence.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `as_str`
- read at `63d2ebc25082` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Index is a small enum reporting what refresh did to .sanity/ on open — absent / unchanged / rewritten / failed — and as_str matches each to a short lowercase wire string for /open's `index` field.
- found: Exactly that: Current -> "current", Refreshed -> "refreshed", Absent -> "absent", and Failed(e) -> the borrowed error message itself rather than a constant label, so the wire value doubles as the failure text.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Failed returns the raw error string where the other arms return fixed tokens, so a consumer matching on known values sees an unbounded set.

### `refresh`
- spec 1 · read at `d14e3b642865` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Loads the current on-disk assessment, recompiles the index and shards from scan+reports via compile, and writes out only the files whose new bytes differ from what's already there (never creating .sanity/ if absent, never writing a shard that doesn't exist), returning the compiled Index.
- found: Matches the prediction closely, but the return value is an Index enum reporting outcome (Absent if no README.md, Failed(msg) on a write error, Refreshed if anything was written, Current if nothing changed) rather than the compiled data itself.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `save` — QUIRKY
- spec 1 · read at `fa0335ff0e2f` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Writes the `.sanity/` Markdown store: iterates live functions from `scan`, looks up reports, renders shards/index, writing only changed bytes.
- found: Calls `compile(scan, reports)` to do the live-function iteration/grouping, writes each shard unconditionally (no byte-diff check), then writes README.md as the index. Before overwriting the index it reads the OLD README to learn which shard files this tool itself created (`shard_links`), then after the new index is safely written, deletes only shards that were in that old list but are no longer in `keep` — so it never touches a file it didn't create, and a failed write leaves both index and shards untouched rather than pruning first.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: I recalled from the project's CLAUDE.md that "save iterates live functions, not reports" before opening this — graded predicted on the handout alone, but flagging the outside knowledge as instructed.

### `render_entry`
- spec 1 · read at `4590cd1eadbc` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: render_entry formats a single assessment entry (a function or whole-file reading) into a Markdown block for the .sanity store, using name, ordinal position, whether it's file-level, the Report's grades, and a staleness flag to produce a heading and summary of the reading's outcome.
- found: Builds the markdown block for one entry: computes trailing markers (OBSCURE/QUIRKY/UNCLEAR/TANGLED/TRAP/STALE) only for loud-end grades, an ordinal suffix only when a twin exists, a heading (backtick name or FILE_ENTRY constant), a provenance meta line (spec version, read-at commit, model, author, cold/warm, run position, priming), expected/found lines, a grades line (predicted/documented/derivable/legible/trap), and an optional note/staleness explanation.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `render_shard`
- spec 1 · read at `cc5e4f4fa46f` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Renders one shard's Markdown text: a heading naming the shard with a coverage summary (read/total, surprising, stale, dated counts), followed by the pre-rendered body. Pure string formatting, no I/O.
- found: Matches the shape, plus: builds conditional explanatory notes only when stale/dated counts are nonzero (a `dated_note` sentence and a longer `spec_note` paragraph explaining what `spec`/legibility versioning means), so the boilerplate prose about expired grades only appears in shards that actually have any — avoiding release-notes text in unaffected shards. Also embeds fixed explanatory prose about what a reading is and what `read at` means, and a link to README.md.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `render_index` — QUIRKY
- spec 1 · read at `62f33ac260a3` · commit `94d194d` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Builds README.md content: title with repo name, a Markdown table of shards with counts (read/total/surprising/stale/dated) linking to shard files, a totals row, and explanatory prose.
- found: Table columns are conditional: the `dated` column (and its cell per row) only appears when any_dated, so index/shard headers stay in sync. Builds totals row in bold. The bulk of the function is fixed prose: what a reading is, how to install/open the app, how to re-run an assessment via MCP ("study this project in sanity"), a note that readings aren't owned by whoever made them, and why the directory should be committed.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Underestimated how much of the function is fixed, deliberately-worded onboarding prose rather than table logic — the conditional dated column was also not guessable from the signature.

### `git`
- read at `15b063d45267` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A helper shelling out to `git -C repo <args>`, returning Some(trimmed stdout) on success and None if it fails to spawn or exits non-zero, used by head/who to stamp provenance.
- found: Exactly that, plus one detail I did not state: empty output is also folded into None via `(!s.is_empty()).then_some(s)`, and decoding is from_utf8_lossy rather than strict.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `head`
- read at `cbac4ef71821` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A one-liner over the neighbouring `git` helper: runs `git rev-parse HEAD` (probably short form) in repo and returns the trimmed sha, or an empty string when git fails or there is no repository.
- found: Exactly that: git(repo, ["rev-parse", "--short", "HEAD"]).unwrap_or_default(), so no-git yields "".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Second reading from this file, though a different region.

### `who`
- read at `186f3cd382b9` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Uses the neighbouring `git` helper to read config user.name and user.email in the repo and returns them formatted as git stamps a commit — "Name <email>" — with a fallback like "unknown" when git or the config is unavailable.
- found: Three chained calls: git config user.email, falling back to user.name if that is absent, then unwrap_or_default. So it is one identity or the other, never the combined "Name <email>" form, and the failure case is an empty string rather than a named placeholder.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `agent_docs`
- spec 1 · read at `5f22d8c33257` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: agent_docs checks which known agent-instructions filenames (e.g. CLAUDE.md, AGENTS.md) exist at the repo root and returns them comma-joined, empty string if none are present.
- found: Exactly that: filters the AGENT_DOCS constant list to those existing at repo.join(f), then joins with ", ".
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_human_file_in_the_assessment_survives_a_save` — QUIRKY
- read at `de5fb502b4d2` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A temp-repo test writing a hand-made file into .sanity/ that the tool never wrote, plus a stale shard, then running save; assert the human's file survives while the obsolete tool-written shard is swept, proving the sweep is driven by the outgoing index.
- found: Setup as predicted (temp repo, one Rust file, a real scan, save with no reports, then NOTES.md and gone.md written into .sanity/, then a second save) — but the assertion is the opposite of my second half: BOTH files survive. The rule under test is "delete only what this index claimed", not "delete what we do not recognise", so an unlinked orphan is left alone too.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The two inline comments on `gone.md` disagree — one calls it "a shard this tool wrote and has since stopped claiming", the other says it "was never linked by an index this tool wrote".

### `report`
- read at `32cbdf97d4e6` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test-module helper that builds a Report with the given id and note and plausible defaults for every other field (expected/found, grades, cold, body hash, model, by/at) so tests need not spell out the whole struct.
- found: Exactly that: a fixture Report with a deliberately multi-line `expected`, every grade populated with a distinct variant (Some/Full/Most), derivable false, trap true, position 3, a body hash, a real git identity and commit, filling the rest from Report::blank(). The distinct values per grade field are what make round-trip tests able to catch a field swap.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `round_trips`
- spec 1 · read at `e0c283a4dc23` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A test constructing a Report, rendering it to a Markdown entry via render_entry, parsing it back, and asserting the parsed result equals the original — verifying a shard round-trips losslessly.
- found: Matches: builds a report keyed `src/a.rs#foo@12` (with the `@12` line suffix stripped on lookup, confirming key_of semantics), renders via render_entry + render_shard, parses back via parse_shard, and asserts every field survives — expected/found/note/body hash/at/by/cold/derivable, plus the "second axis" fields legible/trap/predicted/documented/position — with a comment noting this guards against the exact failure where the MCP schema once silently dropped four fields.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_reading_without_a_position_does_not_claim_to_be_the_first`
- read at `5acab90a066a` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test that parses a Markdown entry lacking a position field and asserts the parsed Report.position is None, not Some(1).
- found: Exactly that: parse_shard over a literal entry with no position line, then assert_eq!(back["src/a.rs#foo"].position, None). No positive control alongside.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_reading_without_a_spec_does_not_claim_todays_question`
- spec 1 · read at `7697285ad73e` · commit `94d194d` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Constructs a Report with spec 0 and a legible grade, asserts legible_current(0) is false.
- found: Parses a hand-written shard Markdown snippet with no spec bullet via parse_shard, then asserts the resulting Report has spec==0, legible==Some(Full) (grade preserved even though unspec'd), and !legible_current(spec).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Got the assertion right but assumed direct struct construction rather than round-tripping through parse_shard on a Markdown fixture, which is the more integration-style, higher-value test this repo tends to prefer.

### `a_reading_from_a_newer_build_is_still_trusted`
- spec 1 · read at `9826cf2d43f1` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Calls legible_current with a spec higher than the current build's, asserting it's still treated as current — a direct test of the >= asymmetry.
- found: Four assertions covering the whole boundary: legible_current(LEGIBLE_SINCE) true, legible_current(SPEC+99) (an unknown future build) true, legible_current(LEGIBLE_SINCE-1) false, and legible_current(0) (unversioned) false.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_spec_round_trips_as_provenance`
- spec 1 · read at `18eccc66febd` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Constructs a Report with a non-zero spec, renders it, parses it back, and asserts spec survives the round trip.
- found: Reversed direction from prediction: starts from a hand-written Markdown shard string with 'spec 7' on the provenance line, parses it, asserts r.spec == 7 and legible_current(r.spec), then renders that entry back out and asserts the rendered text still contains 'spec 7 · read at'.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `priming_round_trips_and_is_silent_when_there_is_nothing_to_say` — QUIRKY
- spec 1 · read at `7b841a044285` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds two Reports — one with agent_docs empty and one with agent_docs set plus primed true/false — renders to markdown and reparses, asserting the empty case emits no priming text while the other round-trips agent_docs and primed correctly.
- found: Parses handwritten markdown (via parse_shard) containing two entries with 'priming: CLAUDE.md in context' and 'priming: CLAUDE.md, AGENTS.md excluded' lines, asserts primed/agent_docs parsed correctly (including that a comma inside the file list does not break parsing since the list runs to the verdict), re-renders each via render_entry and checks the same text round-trips, then separately constructs a bare Report with primed=true but blank agent_docs and asserts render_entry emits no 'priming' text at all — primed alone is not sufficient to print the segment.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `an_unknown_segment_costs_that_segment_and_nothing_else`
- spec 1 · read at `069d6ef30a8a` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Parses a shard entry with one bullet segment parse_shard doesn't recognize, and asserts the rest of the entry's known fields still parse correctly.
- found: Matches — unknown segments ('confidence high', 'vibes: good') are inserted inline among known ones on the provenance and grade lines, and the test asserts body/by/legible/spec all parsed correctly despite them.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_shard_counts_grades_that_answer_an_older_question`
- spec 1 · read at `9845cbb7fa7e` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A test building a dated legible grade, a current-spec grade, and an ungraded reading, running them through compile, and asserting the shard's dated count includes only the genuinely dated one.
- found: Matches closely, plus a second half: it renders the shard and asserts the text contains "1 of these graded legibility under an earlier question", and separately checks a shard with dated=0 contains no such sentence ("no release notes in a clean repo") — tying this test to render_shard's conditional-note behavior from the earlier reading.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `key_ignores_line_numbers`
- read at `efd0813c8a57` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test asserting the same function at two different line numbers yields the same key, so a reading survives an import added above it.
- found: Exactly that, via two scan_of fixtures of the same file/name/body at lines 12 and 480, comparing the key sets of live_funcs.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The doc says the key is `path#name`, but CLAUDE.md and the twin test say `key_of(path, name, ord)` — the doc omits the ordinal that exists precisely because path#name is not unique.

### `same_named_functions_in_one_file_stay_apart`
- read at `da2248134fcc` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A synthetic scan with two identically-named functions (two `init`s) in one file plus different bodies; save a distinct reading per function, reload from the Markdown, and assert each resolves to its own reading by ordinal (#2 for the second), none overwritten, none stale, totals counting both.
- found: Exactly that, in two acts: first live_funcs over three entries asserts keys A.swift#init and A.swift#init#2 exist and each twin holds its own body hash; then a temp dir round trip through save/load asserts all three readings come back and none is stale against its own body. Cleans the temp dir before and after and namespaces it by process id.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains the historical bug rather than what the test asserts, but here that is the more useful half.

### `a_file_reading_round_trips_beside_its_functions`
- read at `8432650edb11` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Build reports holding both a file-level reading (keyed by bare path, no #) and function readings in the same file, save to a temp .sanity/ and load back, asserting both survive without key collision, and probably that the shard titles the file entry as prose.
- found: Exactly that, over a two-function synthetic scan of gate.rs: it checks live_files keys by bare path, saves, greps the rendered shard for `### {FILE_ENTRY}` and `### \`open\``, loads back and asserts three entries with the file keyed by path — plus one extra I did not predict, an is_stale check confirming the file reading's body hash round-trips too.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `hash_ignores_formatting`
- read at `c5649fd3947c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: A test that body/reading hashing collapses whitespace: hash a body, hash the same body reindented, assert equal, and probably assert a genuinely different body hashes differently.
- found: Exactly that, in two asserts: body_hash of the same snippet at two indentation levels is equal, and body_hash("go()") != body_hash("stop()"). Only body_hash is exercised, not reading_hash's doc half.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The test only reindents; it never checks a reflow that changes line breaks, which is the reformat CLAUDE.md actually claims must not expire a reading.

### `a_reading_expires_when_its_documentation_changes`
- read at `4d1404b407ff` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test hashing a doc/body pair with reading_hash, then rehashing with the doc changed and the body identical, asserting the hashes differ so the reading goes stale — probably paired with an assertion that a whitespace reflow of the same doc does not change it.
- found: Exactly that, in three assertions: a rewritten doc differs, adding a doc where there was none differs, and a reflowed doc is equal. reading_hash takes three arguments (a leading Option I had not accounted for — the module header, per its sibling test).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_reading_expires_when_its_module_header_changes`
- read at `d7599e3f1463` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Builds a scan of one file with a module banner and a function, saves a reading, rebuilds with only the file-level doc changed, reloads and asserts the reading now reads STALE because the banner is folded into the reading hash.
- found: No scan or save at all — three direct assert_ne! calls on reading_hash(file_doc, doc, body): a rewritten banner differs, gaining a banner where there was None differs, and swapping which of the two docs holds a sentence differs (so the pair is not merely concatenated).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Tests the hash directly rather than the expiry path, so it proves the inputs differ but never that a reading is actually marked stale; the third assertion (doc order matters) is a real property the name does not mention.

### `stale_when_the_body_moves`
- read at `2d1b882793a3` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A unit test building a reading whose body_hash was taken against one body, then presenting a changed body for the same key and asserting it reads STALE, with an unchanged body not stale.
- found: Exactly that, via is_stale(&report, Some(hash)): matching hash is not stale, differing hash is stale. Plus a third case I did not predict — a Report with an empty `body` (a migrated reading with no recorded hash) is never stale, i.e. absent provenance is taken at its word.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The empty-hash escape hatch means any reading written without a body hash can never expire; worth knowing that the name only covers two of the three cases asserted.

### `survives_a_mangled_entry`
- read at `f0df58c52369` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A parse_shard test with two entries, one corrupted; asserts the damaged one is absent from the map and the intact neighbour still parses, without panicking or losing the file.
- found: Exactly that: `broken` has only a `read at` line and is asserted absent; `intact` is fetched and its predicted (Most) and derivable (true) checked.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I read a sibling parse_shard test in this file at position 5.

### `scan_of`
- read at `cff5ae6ffd72` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test fixture builder taking (path, name, line, body) tuples, grouping them by path into file nodes under a synthetic root, minting one function node each with a node id carrying @line, a key_of(path, name, ord) identity where ord counts twins within the file, and a body hash from the body text; returns the assembled Scan.
- found: Close, with two things I did not cover: the node's `id` is set to `key_of(...)` outright rather than an @line-bearing scan id, and each synthetic FILE node also gets a body hash, of the literal string "header of {path}", standing in for what a whole-file reading is checked against. It also fills ScanStats with zeros, functions = len, without_history true and model "test".
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says this mints "the same identity the real scan mints", but it sets node.id to key_of(...) whereas real scan ids embed @line — so any code path that wrongly keys off node.id would pass under this fixture.

### `a_stale_index_is_rewritten_on_open_and_an_absent_one_is_not_created`
- read at `542b9a063e66` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test building a temp repo, writing a .sanity/ index with stale prose/counts, calling refresh, and asserting index and shards now hold current numbers; then a repo with no .sanity/ asserting refresh creates nothing, and probably that an unchanged index is not rewritten.
- found: Exactly that, via a three-state Index enum: Absent (no .sanity/, and asserts dir() still does not exist), Current (freshly saved, nothing to do), Refreshed (after hand-editing README.md to an older version's wording, refresh restores the current copy). It ends with an extra assertion I did not predict: refresh's output must be byte-identical to what save writes, so open and report cannot rewrite past each other and leave a permanently dirty diff. It only checks README.md, not the shards.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The temp dir is keyed on process id alone, so two tests in this file using the same scheme would collide — here the name is unique, but it is a convention that only works by care.

### `writes_and_reloads_a_repo_assessment`
- read at `6526fa68edb5` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: End-to-end test: build a fixture scan, attach a report per function, save into a temp dir, assert the .sanity/ Markdown exists, then rebuild the scan with a function moved to a different line, load, and assert the reading is found again and not stale — proving keys are key_of rather than the @line node id.
- found: That, plus two things I did not cover: it asserts the store is SHARDED per top-level directory (src-tauri.md, web.md) and that README.md contains "sanity.monster" and "study this project in sanity"; and the second scan changes one body as well as moving the other, so the real assertions are the staleness pair — unchanged body still current, changed body expired. Its own inline comment says the move is now invisible to this test.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc comment still names surviving a move as the point, while the body's own comment says the move is invisible here now and the assertions are about staleness and the index text — the doc describes a property this test no longer exercises.

### `shards_by_top_level_dir`
- read at `6b812ed1b7d8` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A five-line test asserting the shard-naming function maps a path to its top-level directory — nested file to its first segment, a root-level file to some fallback name — so .sanity/ splits one Markdown file per top-level dir.
- found: Three asserts: `shard_of("src-tauri/src/scan.rs") == "src-tauri"`, `shard_of("justfile") == "root"` (the fallback is literally "root"), and `shard_file("src-tauri") == "src-tauri.md"`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm on this file (third reading from it), though a different region each time.

## src-tauri/src/bin/history.rs

### the file itself
- read at `855b2edad4c9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A main-only CLI binary: parse a repo path plus flags (--files, a commit cap, a cache toggle), run the replayer uncached by default, time it, and print commit count, functions at HEAD, elapsed, and the biggest frames; --files gives a per-file breakdown for reconciling against just scan.
- found: Exactly that shape, with one flag I did not predict: --json dumps the same payload the webview receives so both replay implementations can be compared headlessly. It also replays the deltas itself rather than trusting a stored total, and reports functions-ever, alive-at-HEAD, lines, peak, and truncated-into-opening-frame counts, then the eight busiest commits.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The header does not mention --json, which is arguably the file's most load-bearing feature (checking the frontend replay against this one).

### `main`
- read at `f7bcecf09365` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: CLI entry: parse argv for a repo path plus flags (--files, a commit cap, a cache toggle defaulting to uncached), build the replayer, fold the timeline while timing it, then print commit count, elapsed, function count at HEAD and the biggest frames; --files adds a per-file tally for reconciling against just scan.
- found: All of that, plus a --json flag that dumps the exact serialised payload the webview receives and returns early (so the frontend replay can be checked against this one headlessly). Totals are computed by actually replaying the set/del deltas over hist.base into a live map rather than trusting a stored total, tracking peak liveness; prints files/functions-ever/alive-at-HEAD/lines/peak, an empty-history message, a truncation note, the per-file table sorted by function count, and the eight busiest commits.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Arg parsing treats any unrecognised token as the path, so a typo'd flag like --file silently becomes the repo path instead of erroring.

## src-tauri/src/bin/sample.rs

### the file itself — STALE
- read at `f695630c471b` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A small `just sample` binary with a single main: parse argv (repo, out dir, optional n with a default), run the same scan the app does, take every total/n-th function in scan order by stride, and write each as a handout file (name, owner, signature, docs, peers, path, line range — body withheld) into the out dir. No leasing, no .sanity/, prints a count.
- found: All of that, plus the piece I got wrong: it writes TWO files per exercise, NN_head.md (the handout) and NN_body.txt (the answer key sliced from the file at the task's current line bounds) — the body is not withheld, it is the graded reference. Also: scan runs with both memos ephemeral and Fidelity::Ordering because the scores are never printed, and a task whose line bounds no longer fit the file is silently skipped (deliberately, per the inline comment).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The header never mentions the head/body file pair, which is the whole output shape and the one thing a person running `just sample` needs to know.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `main`
- spec 1 · read at `f30468b0e00b` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md in context
- expected: Parses CLI args (repo, out dir, n), scans the repo for functions, samples n of them, and writes each one's handout info (name, signature, docs, peers) plus its source body to files in the output directory, without touching .sanity/ or leasing/reporting.
- found: Matches broadly: scans with ephemeral memos, builds tasks via agentapi::all_tasks, takes an evenly-strided sample (not random) of `want` tasks, slices each function's body straight from the current file by line bounds, and writes paired files per exercise: NN_head.md (name/owner/file/lines/signature/docs/peers — the handout) and NN_body.txt (the actual body, the answer key).
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: Sampling is deterministic striding through the task list, not random selection as I'd guessed.

## src-tauri/src/bin/scan.rs

### the file itself
- read at `a36589a73add` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A standalone CLI binary: main parses a repo path plus flags, runs the scan/score pipeline, and prints a ranked list of hottest functions, a histogram of the score distribution to check spread, a baseline_check comparing the ranking to a naive wc -l sort, and quadrant labels; section and truncate are output formatting helpers.
- found: Exactly that, plus specifics I did not name: a --local flag gated behind cfg(feature = "local-model") that selects LocalModel over HeuristicModel (and exits with a rebuild hint when the feature is off), deliberately ephemeral memos and Fidelity::Full so a headless run never answers from cache, a headline "% of lines are hot" figure, a no-git-history warning, and two sections (HOTTEST and BULKIEST PREDICTABLE) ranked by temperature × lines rather than temperature alone.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The module header states the file's purpose as falsification evidence rather than restating its output, which no reading of the code alone would produce.

### `main`
- read at `281ea7569950` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Reads a repo path and maybe flags from argv, runs the scanner/scorer, then prints a headless report: totals, a calibration histogram, a ranked list of hottest functions with scores, quadrant labels from churn/age, and a wc -l baseline comparison; usage message if no path.
- found: Parses argv for PATH and --local WEIGHTS (with -h usage), picks a LocalModel behind the local-model feature or falls back to HeuristicModel, scans with ephemeral memos and Fidelity::Full deliberately, collects Func nodes, prints file/function/line totals plus a no-git-history warning, prints percent of lines hot, then calls histogram, baseline_check, and two section listings (HOTTEST by temperature x loc, BULKIEST PREDICTABLE by Bloat quadrant).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Default path is "." rather than a usage error, and any bare arg silently overwrites the path, so `scan a b` scans b without complaint.

### `histogram`
- read at `4c74b4d20fb0` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Buckets functions' surprise/temperature scores into a fixed number of bins (probably 10 across a 0-100 scale), counts how many fall in each, and prints one line per bin with a label, a proportional bar of characters, and the count.
- found: Exactly that: ten buckets, temperature (0..1) times 10 clamped to 9, bar scaled to the peak bucket at width 34, labelled " 0-10 " etc. with the count. Two small details beyond the prediction: missing scores fall to 0.0 (so unscored functions land in the coldest bucket), and a non-empty bucket gets at least one block so it never renders as empty.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `baseline_check`
- read at `6d9317dcabd3` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Builds the real top-N ranking (temperature × lines) and a rival top-N sorted by raw line count, intersects the two id sets, and prints the overlap as k of N — the metric's own falsification test in the default output.
- found: That, with N = 15, an early return when the repo has fewer than 15 functions, a shared `top` closure that sorts the slice in place by a supplied rank fn and collects ids, and — beyond my prediction — a banded verdict sentence: 0-6 "finding things size alone does not", 7-11 "partly size", 12+ "SIZE IS DOING THE WORK: this ranking is wc -l with extra steps".
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: by_size ranks on loc alone, so ties among equal-length functions are broken by whatever order the previous sort left the slice in — the baseline number can wobble between runs on a repo with many same-length functions.

### `section`
- read at `a5b137b2efc0` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A printing helper for the headless scorer's report: sorts the borrowed slice of function nodes in place by `rank` descending, prints the title as a heading, then prints the top N (ten or so) as aligned rows — score, path, name, maybe lines and quadrant label — using truncate to keep names in column. Returns nothing, writes to stdout.
- found: Exactly that: sort_by on rank descending with partial_cmp falling back to Equal for NaN, a blank line and the title, then take(15) filtered to rank > 0, printing temperature as degrees (×100), the name truncated to 28, LOC, the quadrant label, and path:line. `n.score` is unwrapped with unreachable!('ranked nodes are scored').
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: take(15) is applied BEFORE the rank > 0 filter, so a section whose top rows rank zero prints fewer than fifteen entries while non-zero ones exist below — deliberate-looking here since the list is rank-sorted, but the ordering of the two adaptors is load-bearing.

### `quadrant_label`
- read at `db90c53d6314` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A trivial match over the four Quadrant variants returning a short human-readable static name for each, for printing in the headless scan report.
- found: Exactly that: match on Quadrant returning "crown-jewel", "trouble", "bloat", "quiet".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `truncate`
- read at `93d56c49406a` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A CLI display helper: return s unchanged if at most n characters, else cut to about n-1 chars and append an ellipsis, counting chars not bytes to stay UTF-8 safe.
- found: Exactly that — chars().count() <= n returns as-is, otherwise take(n-1) plus '…', with an inline comment explaining that byte slicing would panic mid-codepoint.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Docs handed over were the file-level module docs about `just scan`, not about this function at all; n = 0 would underflow on the n-1 path, though callers pass constants.

## src-tauri/src/bin/tokens.rs

### the file itself — STALE
- read at `35a7cd685d82` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A `just tokens` binary estimating reader cost: tok converting chars to tokens at a flat ratio, row/pct formatting a table with shares, big for large-number formatting, and main scanning a repo, weighing mcp::tools(), agentapi::PROTOCOL and real task payloads, printing fixed vs per-reading cost with percentiles.
- found: Exactly that shape. tok = chars/4 (CHARS_PER_TOKEN, documented as crude on purpose), row prints a chars+tokens line, pct is a percentile over a sorted slice, big formats 39.3M/1.2k. main scans the path with ephemeral memos and Fidelity::Ordering, builds all_tasks, prints the per-reader fixed prefix (each tool priced separately and marked "never called" if it isn't sanity_next/sanity_report), the orchestrator-only PROTOCOL, median/p90/max distributions of task JSON split into peers/docs/signature plus body lines, a whole-repo projection at 38 ch/line, and finally the token cost of tool descriptions readers never call.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `tok` — STALE
- read at `27061fb8c32c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Converts a character count into an estimated token count by dividing by a flat chars-per-token constant (~4), returning it directly in a one-liner.
- found: Exactly that: `chars / CHARS_PER_TOKEN`, integer division, no rounding.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: No function docs; the file doc carries the reasoning, which is where the estimate caveat belongs.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `row` — STALE
- read at `d83c85ba9901` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A tiny formatting helper for the report table: prints one aligned line with the label, the raw character count, and the estimated tokens from tok(chars), so every row of the breakdown lines up.
- found: One println: label left-aligned in 34 columns, chars right-aligned in 8 with a "ch" suffix, then "~" and tok(chars) right-aligned in 7 with "tok".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `pct` — STALE
- read at `3f77942cf4b9` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A percentile helper over a sorted slice: index from p*len, clamped to the last valid index, returning that element; 0 for empty input.
- found: Exactly that, using nearest-rank on (len-1)*p rounded, with an early return of 0 for empty. No clamping needed because the index is derived from len-1.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The name does not say the slice must be pre-sorted; only the parameter name carries that precondition, and nothing enforces it.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `big` — STALE
- read at `aa6b5b1d0ed7` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Format a count with a magnitude suffix: >=1M as one-decimal M, >=1k as one-decimal k, otherwise the plain number.
- found: Exactly that, as a three-arm match with guards.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `main`
- spec 1 · read at `58145e63a510` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md in context
- expected: CLI entry for `just tokens <path>`: takes a target path, computes the size in bytes/tokens of the fixed MCP tool contract and subagent prompt, scans the repo to gather per-function tasks, and prints a table/histogram of token costs (median/p90/max) per function plus a whole-repo projection, using helpers tok/row/pct/big for formatting.
- found: Matches closely: reads path arg, prices the fixed per-reader prefix (tool list JSON, subagent prompt, protocol for orchestrator), runs an ephemeral scan to build the actual task payloads, computes distributions (median/p90/max) of task JSON/peers/docs/signature/lines sizes, projects whole-repo token cost (fixed prefix × n + payloads + bodies), and finally breaks out how much of the fixed prefix is tool descriptions never actually called by a reader.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the specific breakdown of unused-tool-description cost as the closing point of the report, though I predicted the general histogram/table shape correctly.

## src-tauri/src/blame.rs

### the file itself — STALE
- read at `15aa9b5b23f0` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A `Blame` cache keyed by file path (get/read), `blame_file` shelling out to `git blame --line-porcelain`, `parse_porcelain` turning output into per-line (author, commit time) placed by final line number, and `FileBlame::range(start,end)` aggregating churn/age/author over a clamped span; rayon parallelism; three unit tests for parsing, placement and clamping.
- found: Exactly that shape, plus two things I did not predict: a packed `Line` (16-hex-digit sha as u64, interned author index u16, epoch time) with abbreviated serde names justified by disk cost on huge repos, and a `ScanCache` layer in `read` keyed by content hash plus the file's last commit, deliberately not caching misses. `RangeHistory` yields distinct-live-commits, last_touched_days, age_days and last author.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The module header explains the metric and its limits thoroughly but never mentions the scancache persistence path, which is a third of `read`'s logic.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `range`
- spec 1 · read at `6e16a4ebacb9` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md in context
- expected: Clamps the 1-indexed inclusive line range to the blamed lines available, aggregates into a RangeHistory with churn (distinct commits), age/last-touched relative to now, and last author; returns None if out of bounds.
- found: Clamps lo/hi into the lines slice, returns None if the resulting slice is empty. Collects distinct commit ids (churn), tracks the line with the newest timestamp (for last_touched_days and last_author) and the oldest timestamp (for age_days) via a per-line scan, converting to days via (now-t)/86400. Comment flags age_days as a lower bound since blame attributes each line to its last touching commit, so a wholesale rewrite of a function reads as young rather than reporting its true original age.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: documented field only covered the 1-indexed/inclusive/clamped contract, not the age-is-a-lower-bound caveat, which lives in an inline comment instead.

### `get` — STALE
- read at `2fc281e13502` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A 3-line accessor looking up a file's per-line blame in an internal map keyed by repo-relative path, returning Option<&FileBlame> — likely just self.files.get(path).
- found: Exactly `self.files.get(path)`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read`
- spec 1 · read at `82059d015700` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Parallel iterate over paths, check cache for valid blame else call blame_file, silently skip failures, collect into Blame map.
- found: Records current timestamp; par_iter over paths using filter_map — checks cache.cached_blame keyed by path+hash+wanted commit, else calls blame_file and writes the fresh result back into the cache via put_blame before returning it; failures (None from blame_file) drop the file silently via filter_map. Collects into Blame{files, now}.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `blame_file`
- spec 1 · read at `e29bf07562e4` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Runs git blame --line-porcelain on path within repo, captures stdout, parses via parse_porcelain into FileBlame; returns None on command failure.
- found: Spawns `git -C <repo> blame --line-porcelain -- <path>`, captures output; returns None if spawn fails or exit status is non-success; otherwise lossily decodes stdout as UTF-8 and passes to parse_porcelain, wrapping result in Some.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `parse_porcelain` — TRAP
- spec 1 · read at `2541905813c1` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md in context
- expected: Parses git blame --line-porcelain output line by line, tracking the current sha/author/time from header/key-value lines, and when it hits the tab-prefixed source line, uses the final line number from the header to place a record (sha, author, time) into a FileBlame structure indexed by final line number.
- found: Matches the overall shape: tracks commit/author/time/final_line state, resolves the source line (tab-prefixed) by writing into `lines` resized/indexed by final_line. Additional details not predicted: authors are interned into a Vec+HashMap to dedupe names into u16 ids, the commit sha is truncated to its first 16 hex chars and packed into a u64 (not stored as a string), and header lines are validated (sha length/hex check) to distinguish them from key/value lines.
- predicted: most · documented: full · derivable: no · legible: most · trap: yes
- note: The commit-sha-as-truncated-u64 and author-interning choices are the kind of compact-representation trap a future editor could break by not preserving.

### `parses_a_commit_author_and_time_per_line` — STALE
- read at `97252a5924c0` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A unit test feeding a hand-written git blame --line-porcelain fixture into parse_porcelain, asserting each line gets the right author and commit time, covering the porcelain's header-only-on-first-mention behaviour.
- found: Parses SAMPLE, asserts 3 lines and 2 interned authors, then exercises FileBlame::range on two windows: commit counts (1 vs 2), last_author being the most recent toucher not the first, last_touched_days 0.0, and age_days ~11.57.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Name promises per-line author/time parsing but the body mostly tests FileBlame::range aggregation, which its neighbours also cover.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `places_lines_by_their_final_number` — STALE
- read at `02f1da5686bf` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test feeding parse_porcelain a synthetic --line-porcelain stream whose header final-line numbers are out of order, asserting each line's author/time lands at its final line number rather than its position in the stream.
- found: Exactly that: two porcelain records (final lines 3 then 1) with authors Ada and Grace; asserts lines.len()==3 (vector sized to the max line) and that range(1,1) is Grace and range(3,3) is Ada.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_range_past_the_end_is_clamped` — STALE
- read at `7d707f0ec837` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Build a small FileBlame, call range with an end past the last blamed line and assert it returns what exists rather than panicking or nothing; probably also that a range entirely past the end yields None/empty.
- found: Exactly that, in two asserts over parse_porcelain(SAMPLE): range(2, 999, now) is Some (an overhanging end clamps), range(50, 60, now) is None (entirely past the end is nothing). The third argument is a fixed epoch-seconds 'now' so the age arithmetic stays deterministic.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The test asserts only is_some/is_none — it never checks WHICH lines the clamped range covered, so a clamp returning one line instead of the right span would still pass.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/cache.rs

### the file itself — STALE
- read at `00f0f287b84a` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A content-addressed score cache: `key` hashes the body via a small `fnv` alongside path/name so a rename or edit misses but a move within a file hits; `open`/`path_for`/`flush` persist a per-model JSON map under an app-support `scores/` dir; `ephemeral` is the in-memory variant that never touches disk; a cache written by another model is dropped rather than merged; tests at the tail name exactly those invariants, and the header admits only the ephemeral half is reachable.
- found: That shape, plus three things I did not predict: the DOC is folded into the hash (rotated and xor'd) because the comment stack is part of the model's prompt, so documenting a function must not serve its pre-documentation score back forever; a FORMAT_VERSION guards recalibration, checked with the model name as a filter on load; and writes flush every 25 entries through a temp-file-and-rename, with hotspots cached beside the score so a resumed scan does not show a hot wedge with no evidence. `path_for` hashes both repo path and model into the filename rather than escaping them.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: Two of the six tests here assert nothing: `moving_a_function_within_a_file_does_not_invalidate_it` compares `key(...)` with an identical `key(...)` call and never involves a line number, and `a_cache_written_by_another_model_is_dropped_not_merged` never calls `Cache::open` — it writes a Stored, reads it straight back, and asserts `"old-model" != "new-model"`.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `key` — STALE
- read at `17125856b1c3` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Builds the content-addressed key from the four inputs: a String identity of path plus name ("path#name") paired with a u64 FNV hash over the body and the doc (None treated as empty), so a moved function still hits while an edited body or comment misses.
- found: Exactly that. `fnv(body)`, and when a doc is present the doc's FNV is rotated left one bit and XORed in — the rotate keeps body and doc from cancelling when they are identical. Returns `(format!("{path}#{name}"), h)`.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: `None` and `Some("")` are not the same key here — an empty doc string still XORs in fnv("") — but the rotate_left(1) that makes that work is the one line with no comment.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fnv` — STALE
- read at `2c6953594781` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: FNV-1a-shaped byte hash: 64-bit offset basis, per byte XOR then wrapping multiply by a constant that is deliberately not the true FNV prime (per the doc), with a twin in heuristic.rs.
- found: Exactly that: h starts at 0xcbf29ce484222325, each byte XORed in then h = h.wrapping_mul(0x1000_0000_01b3). The multiplier has one hex digit too many versus FNV-1a's 0x100000001b3 — sixteen times the real prime — which is the wrongness the doc owns up to.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc is the only thing that could tell a reader the multiplier is off by a factor of sixteen; nobody would catch it by eye.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ephemeral` — STALE
- read at `03b0531f049c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A constructor returning a Cache with no disk location (dir/path None), an empty in-memory entry map, an empty model tag and a clean dirty flag, so flush and path lookups are no-ops.
- found: Exactly that struct literal: path None, empty model String, Mutex-wrapped default Stored, dirty counter Mutex at 0. The only detail beyond my prediction is that dirty is a count rather than a boolean and the fields are mutex-guarded.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `open`
- spec 1 · read at `3911f8fff48d` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes cache file path via path_for, reads/deserializes existing file, checks stored model matches given model (dropping not merging on mismatch), returns empty Cache if missing/mismatched, else populated Cache.
- found: Computes path, reads file to string then deserializes as Stored via serde_json, filters on version==FORMAT_VERSION && model==model (drops on either mismatch), falls back to a fresh empty Stored with current model; wraps into Cache struct with path, model, inner mutex, and a dirty counter (starting 0).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `path_for`
- spec 1 · read at `8973c016a1ad` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a cache file path under a scores dir using a hash of repo path and the model name embedded in the filename.
- found: Joins data_dir()/scores, creates the dir, then hashes BOTH repo path and model name separately with fnv (rather than embedding raw text) because paths/model names can contain characters illegal in filenames on some platforms; filename is {repo_hash:016x}-{model_hash:016x}.json.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I expected the model name to appear literally in the filename per the file doc's framing ('the model belongs in the filename'); it's actually hashed too, for cross-platform filename safety.

### `get` — STALE
- read at `35dee6763997` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Locks/borrows the in-memory map, looks up the (key, body_hash) tuple, returns a cloned Reading if present else None; the tuple key is what lets a moved-but-unchanged function still hit.
- found: Locks the inner mutex (returning None on poison via ok()?), gets the entry by key.0 alone, filters on body_hash == key.1, and constructs a Reading from surprise + cloned hotspots.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The map is keyed on the string only, with the hash as a post-filter, so a stale entry silently shadows rather than coexisting — deliberate, but not visible from the signature.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `put`
- spec 1 · read at `c5a3bbeeac83` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md in context
- expected: Stores a reading in the in-memory cache map keyed by (name, body hash), and periodically flushes to disk once enough writes have accumulated since the last flush.
- found: Inserts an Entry (body_hash, surprise, hotspots) under key.0 in the locked map. Separately increments a dirty counter under its own lock; once it hits FLUSH_EVERY, resets it and calls self.flush(). Both locks acquired and released independently (not nested), silently no-ops on lock failure.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Interesting given the file doc says persistence is currently unreachable/dead code — this flush-triggering logic exists but nothing calls a persistent Cache::open path today.

### `flush`
- spec 1 · read at `01f40ef313ca` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Serializes cache entries to JSON and writes atomically via temp file + rename.
- found: If self.path is Some and the lock succeeds, serializes the inner map to JSON, writes to a `.json.tmp` sibling file, and renames it over the real path — silently no-ops on any failure (ephemeral cache, lock poisoning, serialization or write failure).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `model` — STALE
- read at `3efb11562cbf` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A three-line accessor returning the cache's model identifier string — the tag entries are namespaced by, so a cache written by a different model can be dropped rather than merged.
- found: Exactly that: returns &self.model.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `len` — STALE
- read at `285e390eaaf3` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Locks the inner mutex and returns inner.entries.len(), defaulting to 0 if the lock is poisoned.
- found: Exactly that, as a one-liner: self.inner.lock().map(|i| i.entries.len()).unwrap_or(0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_empty` — STALE
- read at `f7a5ae5b92b4` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: The clippy-mandated companion to Cache::len — three lines returning whether the entry map holds nothing, almost certainly self.len() == 0 or self.entries.is_empty().
- found: `self.len() == 0`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `two_models_never_share_a_cache_file`
- spec 1 · read at `cb74c330673d` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Test that calls Cache::path_for with two different model identifiers and asserts the resulting cache file paths differ, verifying model name is part of the cache key/filename.
- found: Test calling Cache::path_for(repo, name) with \"heuristic (no model)\" and an ollama model string, asserting both are Some and not equal; comment explains this guards against the proxy pass and model pass overwriting each other's cache file.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `a_hit_needs_the_same_body_not_just_the_same_name`
- spec 1 · read at `506d9cc797b2` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test that puts a score keyed by name+body, then queries with same name but edited body, expecting a miss — confirming the cache key includes the body.
- found: Uses Cache::ephemeral(), builds key(path, name, body, None), puts a Reading with surprise 0.8, asserts get hits with surprise 0.8; builds a second key with the same path/name but edited body, asserts get returns None.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `moving_a_function_within_a_file_does_not_invalidate_it` — QUIRKY — STALE
- read at `7e01479e569d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Calls `key` twice with the same model, path, name and body but different line numbers, asserting the keys are equal — i.e. that line position is not part of the content-addressed key.
- found: A comment states the intent, then it calls `key("src/a.rs", "run", "body", None)` twice with byte-identical arguments and asserts equality. `key` takes no line argument at all, so the test is a tautology that cannot fail and exercises nothing the name claims.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The test asserts `key(x) == key(x)` with identical arguments — it can never fail and proves nothing about the property in its name, which is real only because `key` never sees a line number.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `renaming_or_moving_a_function_misses` — STALE
- read at `ea4578d3db4f` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Put an entry, then get with a different name and with a different file path but the same body, asserting None both times — the key covers name and path, complementing the sibling test that a move within a file still hits.
- found: Exactly that, in three lines against an ephemeral cache: put src/a.rs+run, assert miss for src/a.rs+walk and for src/b.rs+run.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The file_doc says the persistence half is unreachable and "if that stays true this should go" — worth a decision, since the whole module is tested but only ephemeral is used.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_ephemeral_cache_never_touches_disk` — STALE
- read at `4eab39b55c2b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A short test creating Cache::ephemeral(), putting an entry, calling flush(), and asserting nothing reached disk — path_for absent or no file created — while the entry survives in memory.
- found: It creates the ephemeral cache, puts one Reading, calls flush() and asserts only `c.len() == 1`. The in-memory half is there; the disk half — the property the name states — is never checked at all. The test really only proves flush() does not panic or clear the map.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The test is named for "never touches disk" and never inspects the filesystem — an ephemeral cache that wrote a file would pass it.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_cache_written_by_another_model_is_dropped_not_merged` — OBSCURE — TRAP — STALE
- read at `f7a59f7405a6` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Opens a cache in a temp dir under one model label, puts an entry and flushes, reopens the same path under a different model label, and asserts the entries are gone rather than inherited.
- found: It never constructs a Cache at all. It writes a Stored JSON with model "old-model", reads it straight back with serde, and asserts `loaded.model != "new-model"` — a comparison of two string literals that is true whatever `Cache::open` does. A comment says "the filter `open` applies", but open is never called.
- predicted: none · documented: none · derivable: yes · legible: most · trap: yes
- note: This test asserts a tautology ("old-model" != "new-model") and never calls Cache::open, so it would pass unchanged if the drop-not-merge filter were deleted entirely.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/churn.rs

### the file itself
- read at `0c7433ce609f` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A History struct wrapping a map of repo-relative path to a per-path record (commits in the churn window, oldest/newest touch, last author, last commit oid), built by `read` shelling out to one `git log --name-only` and parsed by parse_log, with credit/flush_commit crediting each touched file and every ancestor directory exactly once per commit. Accessors normalise: churn_of saturates against a fixed anchor, age_of comes from the oldest commit, is_empty covers the non-repo case. Tests for directory crediting, saturation, and no history.
- found: Exactly that shape. The constants carry the arguments: a 90-day window, a 5000-commit cap, and an ABSOLUTE saturation of 8 commits chosen so a 500-commit lockfile saturates instead of becoming the denominator. Two details I did not predict: the log format uses \x01/\x02 control bytes and splits the author field from the RIGHT so a name containing \x02 cannot eat the oid, and last_commit is collected here purely so scancache can distinguish an unchanged file from a reverted-and-reapplied one.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The doc drift the file itself narrates at parse_log has recurred: the "`None` when the file has no history" paragraph sits above `commits_of`, whose signature returns a bare u32 — it plainly belongs to `age_of`, two accessors down, which has no doc of its own.

### `churn_of`
- read at `f4b1287a3800` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Looks up the recent-window commit count for path, returns 0.0 when unknown, divides by CHURN_SATURATION and clamps to 1.0 — an absolute scale rather than one relative to the repo.
- found: Exactly that, five lines: self.files.get(path) else 0.0, then (h.recent_commits as f32 / CHURN_SATURATION).clamp(0.0, 1.0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `commits_of`
- read at `0fca6b992d7a` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Lookup in the per-path map built from the single git log pass, returning the raw (unnormalised) commit count for that path, 0 when absent.
- found: `self.files.get(path).map(|h| h.recent_commits).unwrap_or(0)` — exactly that, reading the `recent_commits` field of the per-file record.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Docs say "raw commits in the window" but the map is keyed by file path only; directories are covered by sibling peers, so a caller passing a directory path silently gets 0 unless `files` also holds directory keys.

### `last_touched_of`
- read at `b2dfed3bfff2` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A 3-line accessor: look up the FileHistory for `path`, map it to days since its most recent commit — (now - last_commit_time)/86400 as f32 — returning None when the file has no history.
- found: Same lookup, but the day count is already stored: `self.files.get(path).map(|h| h.last_touched_days)`. No arithmetic here; the conversion happens when the log is parsed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `last_author_of`
- read at `71fc831087df` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Looks the repo-relative path up in the per-file history map built by the single git log pass, clones the last commit's author name out of the record, and returns None for a path git has never seen (untracked, or no repo at all).
- found: That, plus one step I did not predict: an empty author string is filtered back to None, so a commit with no author name does not surface as a blank category.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `age_of`
- read at `f204332fb880` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A one-liner looking up the per-path record in the history map and mapping its earliest-commit timestamp to days elapsed since now, returning None when the path has no entry.
- found: A one-line map lookup returning the record's precomputed age_days field, or None. The days-since conversion happens elsewhere (at parse time), not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `last_commit_of`
- read at `fda8fa978861` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A one-line lookup on History's per-path map, mirroring churn_of/last_touched_of: index the path's entry and return its stored newest-commit oid as Option<&str>, None when the path was never seen in the walked window.
- found: That, plus one detail I did not cover: the stored `last_commit` is a String that may be empty, so it is `.filter(|c| !c.is_empty())` — an entry can exist with no recorded commit, and that collapses to None too.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `is_empty`
- read at `6c522ef55697` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Returns true when the parsed git log yielded nothing — the per-path map is empty — which is what drives the "no git history" warning rather than a confident half-verdict.
- found: Exactly that: delegates to self.files.is_empty(), the per-file map.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `read`
- read at `8aeeb414bca3` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: One `git log` pass in repo with a format carrying timestamp and author and a name-only file list, capped at a MAX_COMMITS limit, handed to parse_log to build a History keyed by file and rolled up to directories; every failure mode — not a repo, git missing, non-zero status — returns an empty History rather than an error.
- found: Exactly that. The format uses control bytes rather than newlines as delimiters (\x01 opens a commit, \x02 separates timestamp, author and oid) so a filename can never be confused for a header, it passes --no-merges, and both failure paths return History::default(). `now_secs()` is passed into parse_log rather than read inside it, which keeps the age arithmetic deterministic for the tests.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `now_secs`
- read at `e9ed17b3f23e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Current Unix time in seconds as i64 — SystemTime::now().duration_since(UNIX_EPOCH) — with a clock-before-epoch error mapped to 0, so ages and the churn window can be measured without a date crate.
- found: Exactly that, including the unwrap_or(0) on the pre-epoch error.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `credit` — TRAP
- read at `1a421829daf9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Upserts a `FileHistory` for `key`, bumps a commit count, widens oldest age via max, records the last touch/author/oid when this commit is more recent (min age_days), and increments churn only when age_days falls inside a recency window (~90 days).
- found: Entry-or-default, then: on FIRST sighting (detected by `recent_commits == 0 && age_days == 0.0`) it stamps last_touched/author/commit, because git log walks newest-first; increments `recent_commits` only when within CHURN_WINDOW_DAYS; and unconditionally overwrites `age_days` each call so the last (oldest) value wins. No total commit counter, and no min/max — both extremes come from traversal order rather than comparison.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: Both age and last-touch are correct only if the caller feeds commits newest-first, and the "first sighting" test is a value sentinel (`recent_commits == 0 && age_days == 0.0`) rather than an explicit flag — a reordered or replayed caller gets silently wrong ages and authors with no error.

### `flush_commit`
- read at `cd3690e69372` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Applies one buffered commit: updates each touched file's FileHistory (counts, churn within the recency window, newest author/oid, first-seen age), then builds the distinct set of ancestor directories and credits each exactly once with the same commit, then clears the buffer.
- found: Right shape, thinner body than predicted: it guards ts==0/empty, converts the commit time to `age_days` once, collects ancestor directory prefixes into a HashSet by scanning for '/', then delegates ALL the per-entry accounting to `credit(files, path, age_days, author, oid)` for files and once per distinct dir, then clears. All the churn/age/author logic I predicted lives in `credit`, not here.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: The manual cut/find loop building ancestor prefixes is the one part that needs a second read; a comment or a split() would carry it.

### `parse_log`
- read at `c5c2933cf7c0` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Parses one git-log stream into History: recognise commit header lines (timestamp, author, oid), accumulate the file paths that follow, and per commit credit last-touched, author, commit counts and windowed churn to each file and its ancestor directories; `now` injected so the recency window is testable.
- found: The scanning half of exactly that, with the crediting delegated to flush_commit. Header lines are marked by a \x01 prefix with \x02 field separators, and the author/oid split is done from the RIGHT because an author name may itself contain \x02. Paths before any header (commit_ts == 0) and blank lines are skipped, and a final flush_commit closes the last commit.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc is entirely about why the function was split out and about a doc that once drifted onto `credit`; it says nothing about the format being parsed, which is the only thing here a reader needs.

### `a_commit_touching_three_files_counts_once_for_their_directory`
- read at `e7dd0e3164f6` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A unit test that builds a synthetic git-log record for a single commit touching three files in the same directory, calls parse_log, then asserts commits_of for the directory is 1 rather than 3 while each file records its own single commit — the deduplication the doc describes.
- found: Exactly that: a hand-rolled log string with \x01 sha \x02 author and three src/*.rs paths, parsed by parse_log at a fixed now, asserting commits_of("src/a.rs") == 1 and commits_of("src") == 1 with the message "one commit, not three".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `directory_commits_accumulate_and_reach_every_ancestor`
- read at `37a48eee2c7f` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test building a synthetic log with two separate commits touching files in a nested directory, then asserting commits_of for the directory and every ancestor equals the number of distinct commits.
- found: Exactly that (two commits, a/b/one.rs and a/b/two.rs; file=1, a/b=2, a=2), plus an extra assertion that last_touched_of("a/b") takes the newest commit's age (2 days).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The name promises only accumulation/ancestors but the body also asserts last_touched recency — a claim its name does not carry.

### `oldest_commit_sets_age_and_recent_ones_set_churn`
- read at `e247eed68707` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A unit test feeding parse_log a synthetic newest-first git log with an old and a recent commit, then asserting age_of comes from the OLDEST commit while churn_of/commits_of/last_touched_of reflect only recent ones inside the 90-day window.
- found: That, over three commits and two files, using a raw /-delimited log format. Also asserts age_of returns None for an unknown path and — beyond the name — that last_author_of is the NEWEST commit's author, not the oldest. Churn is checked only as a relative inequality between the two files, not against an absolute value.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The test's name promises age and churn but its strongest assertions are about last_author_of, which no part of the name mentions — a reader looking for the authorship rule would not find it here.

### `one_pathological_file_does_not_squash_the_rest`
- read at `577dcf3c2de9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Builds a synthetic history where one file has an enormous commit count (a generated/lockfile-style outlier) and others have modest counts, then asserts the normal files still get meaningfully non-zero, differentiated churn — churn being saturating/absolute rather than normalized by the max, so the outlier can't flatten everyone to ~0.
- found: Exactly that, concretely: 500 synthetic log entries for Cargo.lock and 10 for src/hot.rs, both spread over an 80-day modulo window, fed to parse_log. Asserts Cargo.lock saturates at exactly 1.0 and src/hot.rs stays above 0.5.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The `i % 80` on 500 iterations means each of 80 days gets ~6 duplicate commits, so the test only exercises saturation, not a genuine 500-distinct-day spread.

### `churn_saturates_rather_than_running_away` — QUIRKY
- read at `ee541947758d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A short test feeding a file a huge number of recent commits and asserting churn is bounded — approaching but never exceeding 1.0 — so a pathological history saturates rather than producing an unbounded score.
- found: Builds a log with `.repeat(1)` — a SINGLE commit one day old — parses it and asserts churn_of("src/a.rs") is within 0.0..=1.0. No large or runaway commit count is ever constructed, so the saturation the name promises is never exercised; the assertion would pass for almost any implementation.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The test is vacuous: `.repeat(1)` means one commit, so nothing about saturation or runaway churn is tested — the range assertion holds trivially.

### `a_directory_that_is_not_a_repo_scores_without_history`
- read at `e68b97e30a4b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A test pointing read/History::read at a directory with no .git, asserting it returns an empty history — is_empty() true and churn/age lookups giving neutral defaults — without panicking or erroring.
- found: Exactly that: `read(Path::new("/definitely/not/a/repo"))`, then asserts is_empty(), churn_of("anything") == 0.0 and age_of("anything") == None.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/cli.rs

### the file itself
- read at `95e5f6e7e01e` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: The headless entry point and backend lifecycle: main dispatching serve/study/status/summary/refresh (and probably mcp), a spawn-lock group making startup exclusive, ensure_backend/await_backend/probe/live to start one and wait on it, a thin get/post pair against the endpoint file, resolve canonicalising a path to a repo key, read_verb as shared plumbing so status and summary are pure formatters over the endpoints, small formatting helpers, refresh running in-process, study printing an instruction rather than spawning an agent, and two spawn-lock tests.
- found: All of that, in that order. Two things I did not cover: `serve` is not just a bind — it owns a five-second watch loop that stands the daemon down when the endpoint file names another pid, when the file disappears, or when nothing has called in thirty minutes; and `main`'s match has no `mcp` arm at all, though USAGE advertises `sanity mcp`, so that verb must be intercepted before this dispatcher ever sees it. The lifetime constants (PROBE_TIMEOUT, START_WAIT, SPAWN_LOCK_STALE derived from START_WAIT, IDLE_FOR, WATCH_EVERY) each carry their derivation, and every printed line has a comment about what it must not claim.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The header names "`sanity serve`, `sanity study`, and the read-only verbs", but the file also holds `refresh`, which writes a repo's `.sanity/` in place — the one write verb here, and the one the header does not admit to; also warm, since three of my earlier readings came from this file.

### `spawn_lock_path`
- read at `e791874e7cbf` · commit `6366346` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A three-line helper returning the spawn lock's path: the per-machine data dir (same place as the endpoint file) joined with a fixed lock filename, Option because resolving the data dir can fail, creating nothing.
- found: Exactly that: Some(crate::reports::data_dir()?.join("backend.lock")).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The data dir comes from `reports::data_dir`, a module the project brief describes as deleted for holding a second copy of the store; the name is a leftover even though the function is fine.

### `drop`
- read at `79064e5f21c0` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: The Drop impl for the spawn lock: removes the O_EXCL lock file, ignoring the error because an already-missing file (e.g. a lock stolen by age) is nothing to fail over — a single `let _ = std::fs::remove_file(...)`.
- found: Exactly that: `let _ = std::fs::remove_file(&self.0)` over the path held in the tuple struct's single field.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: No docs at all here, but the neighbouring ensure_backend docstring I was handed earlier in this run explained the lock's whole lifecycle, so this was predictable for reasons outside the handout.

### `take_spawn_lock`
- read at `b2c40f308f31` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A three-line wrapper delegating to take_spawn_lock_after with the real staleness threshold (SPAWN_LOCK_STALE), the split existing so a test can inject an age, returning its Option&lt;SpawnLock&gt; unchanged.
- found: Exactly one line: `take_spawn_lock_after(SPAWN_LOCK_STALE)`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment is a long argument about O_EXCL, staleness and steal-safety, none of which is in this body — it all lives in `take_spawn_lock_after`, so the explanation sits one call above the code it explains; and I had already read the same mechanism in the project brief, so this reading is warm.

### `take_spawn_lock_after`
- read at `0ea5185ef782` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Tries an O_EXCL create of spawn_lock_path(); on success returns Some(SpawnLock) whose drop removes the file. On AlreadyExists it stats the file and, if the mtime is older than `stale`, deletes the abandoned lock and retries the create once; otherwise returns None so the caller waits for the winner.
- found: Exactly that, with `claim` as a closure doing `create_new(true)` and writing the current pid into the file; abandonment is decided from mtime elapsed >= stale, defaulting to not-abandoned when metadata or the clock fails; steal is remove-then-claim-once, else None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Disclosure: the project brief in my context already described this lock as an O_EXCL create stolen by age, so my prediction was warmer than the handout alone would make it; the handout's own doc, mentioning only "the steal" and an injected threshold, would still have got a stranger most of the way.

### `await_backend`
- read at `46d76f78a8ce` · commit `6366346` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A poll loop: until the deadline passes, probe for a published endpoint via live(), sleeping a short interval between attempts; return Some(Endpoint) as soon as one answers, None once the deadline expires.
- found: Exactly that, in five lines: loop { live() -> return Some; if now >= deadline return None; sleep 250ms }. The liveness check precedes the deadline check, so one attempt always happens even if the deadline has already passed.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `probe`
- read at `f2355a26ceaf` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Sends a health request to the endpoint's URL and, on a successful reply, parses the pid out of the response body rather than trusting the endpoint file, returning Some(pid); any failure to reach or parse yields None.
- found: Builds a blocking reqwest client with PROBE_TIMEOUT, GETs `{url}/health`, parses JSON, and returns the `pid` field narrowed to u32 — every fallible step short-circuits to None via `.ok()?`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `live`
- read at `d2536f381b43` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Reads this machine's endpoint file and returns the Endpoint only if a health probe against it answers, so a stale file naming a dead process yields None — roughly `read_endpoint().filter(probe)`.
- found: That, plus a detail I did not cover: `probe` returns the PID the live server reports, and the returned Endpoint is rebuilt with that pid rather than the one recorded in the file — so the answer describes the process actually answering, not the file's claim about it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: this is my fourth function from cli.rs, and `live` had already appeared in `read_verb`'s body, which told me its contract before I predicted it.

### `get`
- read at `3dea6cd33daa` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A five-line HTTP GET helper: build the URL from the endpoint's host/port plus path, issue a blocking request, parse the body as JSON, mapping transport or parse failure into a String error — probably a one-expression chain.
- found: Exactly that: `reqwest::blocking::get(format!("{}{path}", ep.url()))`, `.and_then(|r| r.json())`, `.map_err(|e| e.to_string())`. The URL prefix comes from `Endpoint::url()`; no status-code check, so a non-2xx response is only an error if its body fails to deserialize.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `post`
- read at `af9aacd701ee` · commit `6366346` · read by claude-opus-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Undocumented sibling of `get`: build the URL from the endpoint base plus path, blocking HTTP POST with body as JSON, return decoded JSON, mapping transport/decode errors to String.
- found: Exactly that, as one expression chain: a fresh reqwest::blocking::Client, .post(format!("{}{path}", ep.url())), .json(&body), .send().and_then(|r| r.json()), .map_err(|e| e.to_string()).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: this is my second reading in cli.rs. It has no docs and needs none, but it builds a new Client per call and sets no timeout, so a hung backend blocks a CLI verb indefinitely.

### `ensure_backend`
- read at `adb3fe3809ca` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: Return the endpoint if `live()` already answers; if SANITY_BACKEND is set, do not spawn; otherwise take the spawn lock — the winner spawns `current_exe() serve` with all three stdio streams null and waits via await_backend, losers skip the spawn and wait for the winner's backend, erroring with a string if nothing comes up in time.
- found: As predicted, with two things I did not cover: SANITY_BACKEND set with nothing answering is an outright error rather than a silent no-spawn path, and after winning the lock it probes `live()` a SECOND time, because the holder it queued behind may have finished between the first probe and the claim. The lock guard is bound for the whole call (spawn and wait together) so the next caller cannot enter while the port is still unpublished, and one `deadline` of START_WAIT covers both the queued wait and the post-spawn wait.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Not cold — this is the same file as my first reading (`probe`), though I had only opened eight unrelated lines of it; the long docstring, not the file, is what made this predictable.

### `commas`
- read at `da1fd4b095b7` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Formats an integer with thousands separators: render n to a string, walk digits from the right inserting a comma every three, return the result — probably the reverse-chunk-rejoin idiom rather than a dependency.
- found: Same result by a forward walk instead: pre-sized String, enumerate the decimal chars, and push a comma before any position where the remaining digit count is a multiple of three (using `is_multiple_of`). No reversal, no dependency.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `num`
- read at `c3e28280c361` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A one-line JSON accessor: look up key in v, read it as u64, return 0 when absent or not a number — the numeric twin of text, so a missing field prints as zero rather than erroring.
- found: Exactly that: v.get(key).and_then(as_u64).unwrap_or(0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm — I had already read cli.rs for summary, which is one of this helper's callers, though the signature alone determines the body.

### `text`
- read at `a6fb2eda2309` · commit `6366346` · read by claude-opus-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A three-line JSON accessor beside num/commas: v.get(key).and_then(as_str).unwrap_or(""), returning empty string when the key is missing or not a string.
- found: Literally that one line: v.get(key).and_then(|x| x.as_str()).unwrap_or("").
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `resolve`
- read at `5666377ab259` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: std::fs::canonicalize(path) with the io error mapped to a String that names the path, so a CLI-supplied path matches the key the backend stored.
- found: Exactly that: `std::fs::canonicalize(path).map_err(|e| format!("{path}: {e}"))`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm: third reading in cli.rs. The doc is not derivable from the body — it explains why canonicalisation is required (agreement with project_key across symlinks), which the one line does not say.

### `serve`
- read at `12d047bc45d6` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Probes for an already-answering backend, prints its address and returns 0 if one is live. Otherwise binds the loopback API on an ephemeral port, publishes the endpoint file with port and own pid, prints it, and blocks serving with a periodic idle check that stands the daemon down, plus a check that the endpoint file still names its own pid so a launching app supersedes it; releases the endpoint on exit, 0 on success and non-zero on bind failure.
- found: As predicted: `live()` short-circuits with a message and 0; builds a tokio runtime (1 on failure), restores previously-open projects on a background thread, `agentapi::serve` binds and returns the port (1 on failure), and the runtime is deliberately held in `_rt` because dropping it would kill the listener. Then a watch loop sleeping WATCH_EVERY: stand down if the endpoint names another pid (app took over) or the file is gone; otherwise compute idle from `last_agent` or process start and, past IDLE_FOR, release the endpoint and exit. The idle read is deliberately unconditional — a long comment records that an earlier `ok()` made "cannot tell" read as "not idle" and kept the daemon up forever.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Marked warm: this is my second reading in cli.rs, and the project brief in my context already described the idempotent-serve, supersede and fail-closed-idle rules by name, so my prediction was not made from the handout alone.

### `study` — QUIRKY
- spec 1 · read at `97c21576cd20` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Ensures a backend is running, POSTs to open the given repo path, prints a human-readable sentence describing next steps, and if show is true focuses the window on that project; returns an exit code.
- found: Resolves the path, ensures backend, POSTs /open with focus=show, then GETs /status separately (because assessed/remaining must exclude stale readings), and prints a multi-part report: function/excluded counts, read/remaining/stale counts, which port and whether Sanity's view is pointed here, a CLAUDE.md priming warning with the exact remedy command if agent_docs is non-empty, and finally either 'every function read' or the 'study this project in sanity' prompt telling the human's agent what to say and that it will ask which model to use.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `read_verb`
- read at `d384d930466f` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Resolves the repo path to a project key, probes for a live backend without ever starting one, and GETs `endpoint` for that repo. Returns the JSON on success; on failure returns Err(exit code) after printing a message — nothing running, or that repo is not open, run `sanity study <path>` — so a read verb never rescans or spawns.
- found: Exactly that shape: `resolve(path)` (exit 1 on error), `live()` for an existing endpoint with the message "nothing is running. Start the app, or run `sanity study <path>`", then `agentapi::project_key(&repo)` GET of `{endpoint}?project=<urlencoded key>`, and finally a check that the response's `open` field is true — otherwise "<repo> is not open. Run `sanity study <path>`."
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs' last line — "the answer to 'not open' is the name of the command that would open it" — is the whole design of the two error paths and could not be recovered from the code alone.

### `status`
- read at `02a5431be822` · commit `6366346` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: The CLI verb for `sanity status <path>`: resolve the path to a project, fetch /status through the shared read-verb helper, print a few formatted lines from the JSON via num/text/commas (assessed vs remaining, stale, in-flight, excluded, repo name), return 0 on success and a non-zero code when the backend is unreachable.
- found: Exactly that: read_verb propagates its Err as the exit code, then it prints a project — repo heading, a function count with an excluded clause only when that is non-zero, a read/to-go/out-with-readers line, a stale line only when non-zero, the assessment file path, and the response's own next_step string; returns 0.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I had opened this file earlier in the run for await_backend, so this reading is warm; the one thing I did not predict is that the human next-step sentence comes from the endpoint rather than being composed here.

### `summary`
- read at `8c2a2bae2b73` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Resolve path to a project, GET /summary through read_verb, print the repo-wide aggregates — assessed/stale/remaining plus grade distributions via grades/commas/num/text — to stdout, returning 0 on success and the error code if the backend is unreachable.
- found: That, with one thing I did not cover: it prints the .sanityignore exclusion count beside the function total whenever it is non-zero, so an exclusion never disappears from the tally. Otherwise repo name, functions, "read / to go / stale", and — only when the summary reports at least one reading — PREDICTED and DOCUMENTED grade lines. Always returns 0 once read_verb succeeds.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The docstring argues at length for what the function refuses to print and says nothing about what it does print; LEGIBLE grades exist elsewhere in the tool but are not among the aggregates shown here.

### `refresh`
- read at `fd92ae0d23c3` · commit `6366346` · read by claude-opus-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Resolves the path, then entirely in-process (no HTTP, no backend) scans the repo, loads the committed readings, and calls assessment::refresh so shards and index are re-rendered in this binary's format; prints refreshed / already current / no assessment here and returns an exit code, non-zero on failure.
- found: That, with more care in the details: canonicalize failure exits 2 while a scan or rewrite failure exits 1; an absent .sanity/ short-circuits before the scan is even paid for; the scan uses an on-disk ScanCache but an ephemeral score cache and Fidelity::Ordering, with a comment explaining that proxy scores decide nothing a shard holds; each of the four Index variants gets its own message and code, and the Refreshed arm additionally prints the reading count and instructions to read the diff — moved headings are the change working, changed bullets are a lost reading.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Warm on cli.rs (fourth reading here) and the project brief describes `sanity refresh` by name, so my prediction was better informed than the handout alone; the docstring is long but earns it, explaining why this cannot go through the backend, which no reader could derive from the body.

### `grades`
- read at `6ea80894ddb5` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Takes an optional JSON object of grade counts and formats one line with each grade named, in scale order full/most/some/none (e.g. "full 12 most 5 some 3 none 1"); returns an empty string when the value is absent.
- found: Exactly that, with two details I did not name: the absent case returns an em-dash "—" rather than empty, and each count goes through `commas` for thousands separators. Missing keys default to 0, joined by three spaces.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `main` — TRAP
- read at `3102baf96966` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Matches the first argument against the verbs — serve, study, mcp, status, summary, refresh, grades — dispatching each to its function with the remaining args and a repo path defaulting to the cwd, printing usage for an unrecognised or missing verb, returning 0 on success and 1 on error.
- found: Right shape: collects `args[1..]` as &str, takes the first non-flag argument as `path` defaulting to ".", and matches `args[0]` over serve/study/status/summary/refresh plus help/--help/-h printing USAGE and returning 0. Unknown verbs print to stderr, print USAGE, and return exit code 2 rather than 1. `mcp` and `grades` are not dispatched here despite `grades` being a sibling, and `study` is the only verb taking a flag (`--show`).
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: Both `args[0]` and `args[1..]` panic on an empty slice and nothing in the signature or the one-line doc states the non-empty precondition — the caller happens to strip argv[0] and check, but an edit that calls this with no verb crashes rather than printing USAGE.

### `only_one_caller_may_start_a_backend_at_a_time`
- read at `0806f1ba0005` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: A test that points the lock at a temp dir, takes the spawn lock twice, asserts the first wins and the second is refused (the O_EXCL create failing for the loser), then removes the lock and asserts a third call succeeds.
- found: Exactly that shape: a `data_home()` guard held for the test, `take_spawn_lock()` must return Some, a second immediate call must be None, and after `drop(first)` a third must be Some. The release is by Drop rather than an explicit delete — the comment ties that to ensure_backend's error paths — and each assert carries the consequence as its message rather than a description.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm: this is my second function from cli.rs, though from a different region of it, and the project brief in my context already describes the spawn lock as an O_EXCL create — I predicted the exclusion from that rather than purely from the handout, so treat the `full` with that discount.

### `an_abandoned_spawn_lock_is_taken_rather_than_blocking_forever`
- read at `1cd2739c4cbb` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test over `take_spawn_lock_after`, the time-injectable form of `take_spawn_lock`: create a lock in a temp home, assert a lock younger than the threshold is respected (acquisition fails) and that the same lock past the threshold is stolen (acquisition succeeds). Both halves asserted because the doc says both matter.
- found: That, with the age varied through the THRESHOLD rather than the file's mtime — a 3600s threshold makes the fresh lock untouchable, `Duration::ZERO` makes anything present by definition abandoned. Then a third assertion I did not predict: it drops both the original holder and the thief and checks a subsequent uncontended `take_spawn_lock` still succeeds, i.e. that release-by-path with two guards aliasing one file leaves nothing behind.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The third assertion checks only that the lock file is gone after everyone releases; it does not check the more interesting consequence of release-by-path, which is that the original holder's drop deletes a lock the thief still believes it holds — so exclusion during that window is untested and the test's name does not cover this half anyway.

## src-tauri/src/commands.rs

### the file itself
- read at `c40da6287cb3` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A thin Tauri #[tauri::command] layer: each function unwraps app state and delegates to scan, history, agentapi or reports, converting errors to Result<_, String>. Plus UI-adjacent bits — a bounded source read for the code view, opening a code window, theme-menu sync, cancelling a scan — and a block of MCP-client management: locating this exe, building the `sanity mcp` command line, and reading/writing known clients' config files to connect or disconnect.
- found: All of that, and scan_repo is not thin: it publishes a pending sidebar entry BEFORE the work starts so a long scan is not a hang, runs the CPU-bound scan on spawn_blocking with two emit callbacks (progress + per-function score streaming), clears the pending row on every outcome, then registers the project, loads readings from .sanity via assessment::load, and focuses the window. read_source canonicalizes both sides for path-traversal defence. Cancellation is a module-level static AtomicBool. MCP client management is a five-entry table (Claude Desktop/Code, Cursor, Windsurf, Codex-TOML-read-only) that only edits files which already exist and parse, with Claude Desktop the one create exception.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: The one-line header covers the invoke surface but nothing about the MCP client-config editing that occupies the last third of the file; also two doc comments have been concatenated onto single items (agent_reports, and the cache-panel doc stranded above sync_theme_menu), so a reader is handed prose about a function that is not there.

### `scan_repo` — QUIRKY
- read at `07c0664095ef` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: The Tauri entry point for a scan: resolve the path, walk it honouring ignore files, parse with tree-sitter in parallel, score with the offline proxy, fold into a tree, layer git age/churn, load committed .sanity/ readings and mark stale ones, register the project in shared state, emit progress and honour cancellation, return the whole Scan in one payload.
- found: It is an orchestrator, not a scanner — all walking, parsing and scoring is one call to scan::scan. What the body actually is: a directory and git_root guard that fails fast before any expensive work; clearing CANCEL; pushing a placeholder into shared.restoring so the sidebar shows the project before the scan starts; spawn_blocking so the rayon work stays off the async runtime; two closures emitting scan-progress (also written into restoring_progress) and per-function scan-score events for live colouring; an ephemeral score Cache beside a persistent ScanCache; Fidelity::Ordering to skip the all-pairs term; unconditional removal from the pending list; then publishing a Project with reports loaded from .sanity/ (reusing an existing entry's reports if present), stamping file_marks and watch marks, and calling focus(key, true) because this is the window's own Open.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc answers only "why one payload instead of streaming" and says nothing about the sidebar-registration, progress-streaming and project-publishing that are most of the 154 lines.

### `scan_history`
- read at `a27e53522457` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An async Tauri command that validates the path, defaults the limit, and runs history::read_cached on a blocking thread (spawn_blocking) so the tree-sitter/rayon work stays off the async runtime, emitting progress to the frontend via the AppHandle and mapping any error to a String.
- found: Exactly that: rejects a non-directory with a message, defaults limit to history::MAX_COMMITS, spawn_blocking around read_cached with an `emit` closure firing the "history-progress" event (send failures ignored), and map_err on the JoinError. read_cached itself is infallible, so the only error paths are the directory check and a panicked/cancelled task.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `warm_history`
- read at `dac8c204bd4d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A Tauri command that spawns the work off the async runtime (spawn_blocking around history::warm) and returns a plain bool rather than a Result: true if a cached timeline existed and was topped up, false if there was none or the work failed. No error surfaces because the frontend fires and forgets.
- found: Exactly that: a directory guard returning false, then tauri::async_runtime::spawn_blocking calling history::warm(&root, MAX_COMMITS), awaited with unwrap_or(false) so a panicked or cancelled task also reads as false.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `read_source`
- read at `c6b6cbc66ab8` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Joins rel_path onto repo, canonicalises both sides, errors if the resolved path is not under the canonicalised root (defeating .. and symlink escapes), then reads the file to a String, refusing or truncating past a size/line cap so a vendored bundle cannot freeze the code view; errors returned as Err(String).
- found: As predicted, with the cap as a hard refusal rather than a truncation: MAX_BYTES = 2 MiB checked via fs::metadata before reading, returning '{rel_path} is too large to display'. The whole body runs inside tauri::async_runtime::spawn_blocking, with the join error also flattened into Err(String). Distinct error texts for an unreadable root, a missing file, and an escape ('outside the open repo').
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe the containment check and the cap but say nothing about the spawn_blocking offload, which is the only reason this async fn does not block the Tauri runtime.

### `open_code_window` — TRAP
- read at `b5c68b62facf` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Sanitises repo+rel_path into a Tauri window label, focuses an existing window with that label rather than duplicating, otherwise builds a WebviewWindow loading index.html with ?code= (and repo) in the query, titled from the path, sized, with Tauri errors mapped to String.
- found: Exactly that — label is "code-{rel_path}" with every non-alphanumeric/non-dash mapped to '-', get_webview_window short-circuits to set_focus, and the builder loads index.html?code=&repo= at 900x800. Two extras I did not predict: a hand-rolled percent-encoder for the query values (with a comment on '#' truncating the URL), and a macOS-only branch applying the overlay titlebar and the shared TRAFFIC_LIGHTS inset.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The label is derived from rel_path only, not repo, so the same relative path in two different repos collides and the second call focuses the first repo's window instead of opening the file asked for.

### `agent_reports`
- spec 1 · read at `810b21775d1d` · commit `94d194d` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Resolves which project to show reports for from a key or fallback, looks up that project's reports in shared state, and returns the Vec cloned out for the frontend to poll.
- found: Locks shared state, resolves key (or falls back to `active`), returns empty if none. Looks up the project, clones its reports, and for each one recomputes `legible_dated` on the way out (from `spec` against current build constants) rather than trusting a stored value — a comment explains this is deliberately not persisted so a later constant bump changes the answer immediately.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `agent_activity`
- read at `9961e7b7663e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A Tauri command that locks shared agentapi state and returns an AgentActivity snapshot for the UI — in-flight/lease counts, recent report activity, last-report timestamp so the sidebar can show whether readers are working.
- found: Locks the shared state and returns AgentActivity: `active` (last agent call within a 60s IDLE_AFTER window), the last tool name, a `pings` nonce, and a list of recent (seq, tool) calls mapped into AgentCall.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `projects`
- read at `609bd3dd15cc` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A five-line Tauri command that locks the shared agentapi state and returns its ProjectList — the projects known to the backend plus which one the window should focus — delegating assembly to a helper on the shared state rather than doing work itself.
- found: One expression: ProjectList::from_state(&agentapi::lock(&state)). Exactly the delegation predicted, using the repo's poison-tolerant lock helper.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `project_scan`
- read at `65127eb0a5bb` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A six-line Tauri command that locks the shared state via agentapi::lock and returns a clone of the stored Scan for the project at key, or None if that project has no scan yet.
- found: Exactly that: one line, lock(&state).projects.get(&key).map(|p| p.scan.clone()).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `sync_theme_menu`
- read at `38f284dd1ae9` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A Tauri command that fetches the stored ThemeMenu from app state and sets the checked flag on light/dark/system, true only for the matching theme string, ignoring errors since it is cosmetic.
- found: Exactly that, delegated: `app.try_state::<ThemeMenu>()` and, if present, `themes.select(&theme)` — the per-item ticking lives in ThemeMenu::select (a listed peer), and absent state is silently a no-op.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `sync_theme_menu` #2
- read at `b9bdcea5cb6f` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: The non-macOS half of a cfg'd pair: a one-line no-op with both arguments underscored, so the frontend can invoke sync_theme_menu unconditionally while only the macOS build ticks the View → Appearance menu item.
- found: An empty body. Exactly the platform stub.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `stop_scan`
- read at `f04a714f4d1c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A three-line Tauri command flipping a global cancellation flag — an AtomicBool store(true, Ordering::Relaxed) — polled by the model-pass loop so it exits early while keeping what was already scored.
- found: Exactly `CANCEL.store(true, Ordering::Relaxed);`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc says more than the body could: that partial results are kept and that this is the only bound on a scan now that the length floor is gone — neither is derivable from one atomic store.

### `this_exe`
- read at `e4d1950a37d5` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Five undocumented lines returning the running binary's path as a String via std::env::current_exe(), lossy-converted, so the MCP client config writers can point at this exact binary rather than a name on PATH; fallback to "sanity" on failure.
- found: Exactly that, except the fallback is `unwrap_or_default()` — an empty string, not a name — so a failure yields a config entry with no command at all.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `mcp_command`
- read at `0f03810e446b` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns the command to run this binary as an MCP server: this_exe() plus args ["mcp"], packaged as McpCommand, errors mapped to String.
- found: Exactly that, plus a third field: it also renders a pretty-printed .mcp.json snippet ({"mcpServers":{"sanity":{command,args}}}) and returns it as McpCommand.json for the UI to display/copy.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `client_defs`
- read at `165bb3009136` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A hardcoded list of known MCP-host apps (Claude Code, Claude Desktop, Cursor, VS Code...), each with id/label and the config file path where a sanity mcp entry is written, built from the home directory; no I/O beyond resolving home.
- found: Exactly that: five ClientDefs (Claude Desktop, Claude Code, Cursor, Windsurf, Codex) with id, display name, config path from home/config dir, plus a `key` naming the servers map and a `json` flag — Codex is TOML with `mcp_servers`, the rest JSON with `mcpServers`.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I did not anticipate the format flag distinguishing Codex's TOML config from the JSON ones.

### `mcp_clients`
- read at `c7c59f8ea31f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Walk the known MCP client definitions from client_defs(), and for each one report whether its config file exists and whether it already registers a "sanity" server pointing at this binary (this_exe), returning a Vec&lt;McpClient&gt; of name/path/installed/connected status for the UI.
- found: That, with three distinctions I did not name: `present` (file exists), `registered` (a "sanity" entry under the def's key) and `current` (its `command` equals this_exe) are three separate flags rather than one; a config that fails to parse as JSON — Codex's TOML — falls back to plain substring matching on "sanity" and on the exe path; and `writable` is carried straight from the def's `json` flag, so non-JSON configs are reported as not editable.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: No doc comment at all on a function whose three near-synonymous output flags (present/registered/current) and TOML substring fallback are exactly what a reader would want explained.

### `edit_client` — QUIRKY
- read at `58fe79566d45` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Look up the client def by id, error if unknown; refuse if the config file is missing or unparseable; otherwise read the JSON, ensure the mcpServers-style key exists, insert a "sanity" entry {command: this_exe(), args:["mcp"]} when connect is true or remove that key when false, write it back pretty-printed, return the path.
- found: All of that, plus three branches I did not predict: a refusal for clients whose config is TOML, an explicit exception that CREATES an empty config for claude-desktop on connect, an empty-file-is-{} case, and an early Ok returning the path when disconnecting a client with no config at all.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc says "Only ever edits a file that already EXISTS" as the line between helpful and destructive, but the body has a claude-desktop branch that creates one (with create_dir_all) — the exception is only in an inline comment.

### `mcp_connect`
- read at `a9ec7fc9100e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A thin Tauri command that resolves the MCP client by id and writes the sanity mcp server entry into that client's config file, the counterpart to mcp_disconnect, delegating to a helper and returning a status/path string or the error text.
- found: A one-line delegation to edit_client(&amp;id, true) — connect and disconnect are the same routine with a boolean, so this command carries no logic at all.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `mcp_disconnect`
- read at `4810a7f14d35` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A Tauri command removing sanity's MCP server entry from a named client's config: resolve the client by id, load its JSON, delete the sanity server key, write it back, return a status string, erroring if the client is unknown or the file cannot be read/written.
- found: A one-line delegation: `edit_client(&id, false)`. All of that work lives in the shared edit_client helper, with the bool selecting removal over connection; mcp_connect is presumably the same call with `true`.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The bare `false` at the call site says nothing about what it selects; only the wrapper's name distinguishes connect from disconnect.

## src-tauri/src/heuristic.rs

### the file itself — STALE
- read at `94197c2c5bb7` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: The offline surprise proxy: lexing helpers (words splitting identifiers and dropping structural noise, lex, shingles, fnv, jaccard), four 0..1 terms — distinctiveness via min-jaccard against sibling fingerprints, incompressibility, branch_density, vocabulary_novelty — mixed by WEIGHTS in `surprise`, a monotonic `calibrate` mapping the raw mix onto the reported band, and `documented` as the offline doc grade subtracting the signature's vocabulary from both sides; every term returns UNDECIDED 0.5 on short input, with tests named for each property.
- found: All of that, with the abstention thresholds named as constants (MIN_SHINGLES, MIN_WORDS, MIN_LINES_FOR_BRANCHING, a 200-byte deflate floor) and a shared `linmap` that rescales every raw band. Two things beyond my prediction: distinctiveness takes the MAX jaccard and returns 1 − linmap of it rather than a min; and `fnv` carries a long doc admitting the multiplier is not FNV-1a's prime, deliberately left wrong because correcting it would move every shingle hash and expire every committed reading via the twin in assessment.rs.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The module header lists the four terms but never mentions `calibrate` or `documented`, which are the two exported pieces most likely to be touched by mistake.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `linmap` — STALE
- read at `27921b051bbe` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: ((v - lo) / (hi - lo)).clamp(0.0, 1.0) — one expression rescaling v from the band into 0..1 with clamping at both ends, possibly with a hi == lo guard.
- found: Precisely that expression, with no hi == lo guard: equal bounds divide by zero and yield NaN or infinity, and clamp on NaN returns NaN.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: All callers pass literal constant bands, so the unguarded division is safe today but would silently produce NaN if a computed band ever collapsed.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `words`
- spec 1 · read at `3a6091c43ac8` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Splits source into words on non-alphanumeric boundaries and camelCase/snake_case/kebab-case, lowercases, filters short and structural words.
- found: Single char-by-char scan: builds up a lowercase word buffer, splitting on non-alphanumeric chars (naturally handling snake_case/kebab-case) and on camelCase boundaries (uppercase following lowercase), then retains only words with len >= 3 that aren't is_structural.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `is_structural` — STALE
- read at `60226f970c31` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A predicate returning true for language keywords and universal plumbing — a static set of terms like let, self, return, err, if, for, fn, const, plus maybe very short tokens — so vocabulary comparisons can drop them.
- found: A flat const slice of 64 lowercase terms — keywords across several languages plus generic identifier names (err, res, val, tmp, obj, args, opts) and the stopword "the" — with a linear `contains`. No length rule.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The list is English/C-family only, so a repo whose identifiers are not English gets none of this filtering and reads as more distinctive than it is; also note "if" and "in" are absent while "the" is present.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lex`
- spec 1 · read at `71bb58aefa58` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Groups consecutive alphanumeric/underscore chars into identifier slices, emits punctuation as single-char tokens, skips whitespace, using char_indices with byte offsets for UTF-8 safety.
- found: Exactly that: peekable char_indices, skip whitespace, extend identifier runs via len_utf8 byte offsets, else push single-char punctuation slice.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `shingles` — STALE
- read at `f3797168b0b9` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Lex the source, slide a 3-token window over the stream, hash each triple with fnv into a HashSet<u64>; keywords kept unlike `words`, feeding jaccard/distinctiveness.
- found: Exactly that, with an explicit guard: fewer than three tokens returns an empty set rather than producing nothing from `windows(3)` (which would be the same result but by accident).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fnv` — STALE
- read at `754c838096aa` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: FNV-1a-shaped loop: 64-bit offset basis, XOR each byte in, wrapping-multiply by 0x1000_0000_01b3, return u64.
- found: Exactly that, with basis 0xcbf29ce484222325 and the off-by-one-grouping multiplier the docs describe.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `jaccard` — STALE
- read at `26f6f9ec3347` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Computes Jaccard similarity of two hash sets — intersection over union as f32, guarding the empty/zero-denominator case by returning 0.0 or UNDECIDED.
- found: Exactly that: returns 0.0 if either set is empty, counts the intersection, derives the union as len(a)+len(b)-inter, and returns inter/union with a second 0.0 guard for a zero union.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `incompressibility`
- spec 1 · read at `0b49fd4d2b9a` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md in context
- expected: Compresses the body with deflate and returns a ratio of compressed to original length (or its inverse) as a novelty/incompressibility score, likely with a minimum-length guard that returns a neutral/undecided value for very short bodies.
- found: Normalizes whitespace, returns UNDECIDED if under a 200-byte floor (deflate's fixed ~11 byte overhead would otherwise skew short inputs), otherwise deflates and computes compressed/original ratio, then remaps that ratio through linmap calibrated against measured bounds (0.25 templated, 0.70 dense hand-written) into the final score.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Matched the guard-for-short-bodies prediction, which the peer list ("short_bodies_decline_to_report_compressibility") had already hinted at.

### `branch_density`
- spec 1 · read at `d1519d356654` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Counts branch/decision keywords (if, match, while, for, &&, ||, ?) across the body and divides by line count to get a density ratio.
- found: Tokenizes on non-alphanumeric (except &,|,?) chars, counts tokens matching a multi-language branch-keyword list (if/else/match/case/switch/for/while/loop/try/catch/except/&&/||/?), divides by line count, but returns UNDECIDED if line_count < MIN_LINES_FOR_BRANCHING, and passes the ratio through linmap(0.02, 0.25) for calibration rather than returning it raw.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `vocabulary_novelty`
- spec 1 · read at `40682e32b324` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Extracts word sets from signature and body via `words`, computes fraction of body words not in signature's vocabulary, remaps via linmap into a bounded f32.
- found: Exactly as predicted, plus a MIN_WORDS gate returning UNDECIDED for very short bodies before computing the novel-word fraction and calling linmap(novel/total, 0.35, 0.85).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `fingerprint` — STALE
- read at `14046ed74e28` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Builds the cached comparison key for distinctiveness: lex the body into normalised tokens, form k-gram shingles, FNV-hash each into a deduped set, wrap it in Fingerprint so sibling comparison is a Jaccard over hashes rather than a re-lex per pair.
- found: Exactly that purpose, but the function itself is a three-line constructor that just delegates to `shingles(body)` and wraps the HashSet<u64>; the lexing and hashing live in `shingles`, not here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `distinctiveness`
- spec 1 · read at `0fe9a609594f` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md in context
- expected: 1 - max Jaccard similarity against peers; returns a neutral sentinel when there are no peers to compare against.
- found: Returns UNDECIDED (not 1.0) when peers is empty OR the body is too short to shingle (< MIN_SHINGLES), explicitly to avoid every single-function file or three-line accessor scoring as maximally original. Otherwise takes max Jaccard across peers and returns 1.0 - linmap(closest, 0.08, 0.55), remapping the observed near-duplicate ceiling (~0.55-0.6) onto the full output range rather than using raw 1-similarity.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Missed the linmap calibration (0.08-0.55) and the short-shingle floor condition — only predicted the empty-peers sentinel case.

### `surprise` — STALE
- read at `724338ca9496` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Computes vocabulary_novelty, incompressibility and branch_density on the body, combines them with the passed-in distinctiveness via WEIGHTS as a weighted sum, and returns calibrate() of that.
- found: Exactly that: a four-element terms array in the order distinctiveness, vocabulary_novelty(signature, body), incompressibility(body), branch_density(body), zipped against WEIGHTS, summed, and passed through calibrate.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `calibrate` — STALE
- read at `d127c0bd2211` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Six lines rescaling raw from an observed band (~0.15..0.95, as named constants) onto 0..1 by subtracting the low end and dividing by the width with clamping, then raising to a fixed exponent above 1 to skew right — most code cold, a thin hot tail.
- found: Exactly that shape: FLOOR 0.30, CEIL 0.95, SKEW 2.2, with the rescale-and-clamp delegated to a helper linmap and then powf(SKEW).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc names the band as roughly 0.15..0.95 while the code's FLOOR is 0.30.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `documented` — STALE
- read at `15122d1a475a` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Word-sets from doc, body and signature; subtract signature vocabulary from both sides; 0.0 with no doc; otherwise the fraction of remaining body words covered by remaining doc words, clamped 0..1.
- found: That, plus two edge returns and a rescale I did not predict: an empty uncovered set returns 1.0 (signature said everything), empty doc-minus-signature returns 0.0, and the raw overlap is passed through linmap(coverage, 0.0, 0.40) so 40% vocabulary overlap already earns full credit — prose explaining the reason should not have to name every identifier.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Second function I have read in heuristic.rs, so this reading is warm.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `words_split_identifiers_and_drop_noise` — STALE
- read at `108e6e6bae36` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A unit test asserting words() splits camelCase and snake_case identifiers into component words and drops noise — punctuation, keywords, very short tokens.
- found: Three asserts doing exactly that: parseHTTPHeader -> [parse, httpheader], retry_with_backoff -> three words, and "let x = self.a" -> empty. The acronym case is the detail I did not call: consecutive capitals do NOT split, so HTTPHeader stays one token.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_comment_that_restates_the_signature_documents_nothing` — STALE
- read at `a0953a7b19b0` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Scores a doc comment that only echoes the signature's words against a body, asserting it yields ~0 coverage while a genuinely explanatory comment scores higher, since signature vocabulary is subtracted from both sides.
- found: Exactly that: "Increments the counter." against `fn increment_counter(&mut self)` must score exactly 0.0, while a comment naming the persist and notify calls must exceed 0.5.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Third function I have read from heuristic.rs this run, so warm.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `no_doc_is_no_explanation` — STALE
- read at `948ca39c4031` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A three-line test asserting documented returns 0.0 for a function with no doc comment — empty docs against some body — establishing that absent documentation explains nothing rather than falling back to the 0.5 UNDECIDED value the other terms use.
- found: A single assert: documented(None, "fn a()", "body words here") == 0.0. Exactly the predicted claim, with the absent doc expressed as None and the signature passed separately (since documented subtracts signature vocabulary from both sides).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `twelve_copies_of_a_handler_are_not_distinctive`
- spec 1 · read at `3f563f4b7e0f` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md in context
- expected: Test that distinctiveness scores low for a function nearly identical to many peer handlers, vs high for genuinely novel code, using fingerprint/Jaccard comparison.
- found: Builds fingerprints of two structurally-identical CRUD handlers (a, b) and one genuinely different retry-loop snippet (novel); asserts distinctiveness(a, [b]) is both less than distinctiveness(novel, [a,b]) and below 0.5 — the 'twelve' in the test name is rhetorical/metaphorical, only two near-duplicates are actually used.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Test name says 'twelve copies' but the body only constructs two near-duplicate handlers plus one novel snippet — the name is illustrative framing, not literal.

### `a_lone_function_is_undecided_not_unique` — STALE
- read at `914ccbb2bab1` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A four-line test calling distinctiveness with a single function and no siblings, asserting UNDECIDED (0.5) rather than 1.0, since a function with nothing to compare against must not score as maximally unlike its peers.
- found: Exactly that: one assert_eq that distinctiveness(&amp;fingerprint("whatever it says"), &amp;[]) == UNDECIDED, with a comment that claiming 1.0 would set fire to every single-function file.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `short_bodies_decline_to_report_compressibility` — STALE
- read at `3721b089bd91` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A short test asserting incompressibility returns UNDECIDED (0.5) for a body too short to carry evidence, rather than a confident score.
- found: Exactly that: a single assert_eq!(incompressibility("a + b"), UNDECIDED), with a comment naming the reason — deflate's fixed header overhead would otherwise make every tiny function look novel.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The name says "short bodies" plural but only one length is exercised, so nothing pins where the threshold sits — a regression moving it to zero would still pass.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `non_ascii_source_does_not_split_a_codepoint` — STALE
- read at `fe9f4cb1db6d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Feeds multi-byte UTF-8 through the lex/fingerprint path and asserts no panic plus sensible tokenisation — guarding against slicing mid-codepoint.
- found: Exactly that: two lex assertions (em dash and middle dot as their own tokens; accented identifier kept whole) plus a fingerprint call on arrow/dash text purely for the no-panic path.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: I had already read a function in heuristic.rs this run, so this reading is not fully cold for the file.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lex_separates_punctuation_from_identifiers` — STALE
- read at `e3e7ab3d3c87` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Feeds a snippet like foo(bar); to `lex` and asserts identifiers and punctuation come back as separate tokens rather than glued together.
- found: Exactly that: one assert_eq that lex("db.query(USERS, id)") yields the eight-token vector with each punctuation mark its own token, plus a comment naming the sibling-comparison property it protects.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_tiny_function_cannot_be_the_hottest_thing_in_the_repo` — STALE
- read at `9845b41a4f91` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Builds a trivial body (e.g. `fn main() {}`) plus longer sibling bodies, scores each with surprise, and asserts the tiny one is not top-ranked / scores below the others — the regression guard for `fn main()` ranking hottest.
- found: Exactly that: a 3-line `sanity_lib::run()` body vs a 40-line generated branchy body, distinctiveness computed against one unrelated fingerprint, asserting tiny < 0.5 and long > tiny.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `every_term_declines_to_measure_when_it_runs_out_of_evidence`
- spec 1 · read at `c089239d4f06` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Test asserting several component measures return None/abstain on tiny/insufficient input rather than fabricating a score.
- found: Test asserting incompressibility, branch_density, vocabulary_novelty, and distinctiveness all equal a shared UNDECIDED sentinel constant on tiny inputs.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `surprise_stays_in_range` — STALE
- read at `10929dc8bca4` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test asserting `surprise` never leaves 0..=1, scoring a few contrived bodies (empty, tiny, a long distinctive one) and asserting each result sits within the closed unit interval.
- found: Exactly that: loops over "", "x", and 500 repeats of "a b c ", calls surprise with a fixed signature and distinctiveness 0.5, asserts the result is in 0.0..=1.0 with the value and body in the message.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Third case is repetitive rather than distinctive, so the long-and-novel end of the range is untested.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/history.rs

### the file itself — STALE
- read at `e8760b3440e8` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A backend module building a repo timeline by walking git log and applying each commit's raw diff lines to an incrementally-maintained Replayer, re-parsing only touched blobs via a Blobs reader over git objects and an interned Funcs table, emitting per-commit frames of structure plus touch dates and never surprise. Plus a machine-local cache extended rather than rebuilt, refused when history was rewritten (is_ancestor), a warm top-up, and duplicated vendored/minified refusals so history and the map agree.
- found: All of that, with more precision than I gave it. Frames are DELTAS (set/del/files) over an interned func table, not snapshots; `files` is carried separately because a rewrite that keeps the line count still glows. Blobs is one long-lived `git cat-file --batch` with strict request/response framing and a Drop that closes stdin, and it always drains a refused blob's payload to stay in sync. `Replayer::resume` derives parse state by folding frames rather than storing a copy; `fold` retires oldest frames into `base` with its own base_ts. Cache is FNV-hashed path plus limit, versioned, and a save failure is deliberately silent. Tests cover raw-line parsing of edit/rename/copy/delete, twin identity, and extend-vs-replay equivalence including the folding case.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: VENDORED and MINIFIED_LINE_BYTES are hand-duplicated from scan with only a comment holding them in step — nothing fails if they drift.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `key_of` — STALE
- read at `63b4c968ad5d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Formats a stable identity string for a function within a file version — path plus name, probably with owner and/or an ordinal folded in to keep same-named twins apart, and deliberately without the line number, so a function that merely moves is diffed as the same function rather than a delete plus an add.
- found: Exactly that: owner (empty string when absent), name and ord, as "{path}#{owner}::{name}#{ord}". No line number.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `lang_of` — STALE
- read at `30506400fb84` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Split the extension off the path and defer to Lang::from_extension, None for unknown; plus a VENDORED path-segment check returning None, since history must refuse what the scan refuses.
- found: Exactly that: any '/'-separated component in VENDORED returns None, then rsplit_once('.') feeds Lang::from_extension. Minified refusal is elsewhere (needs content, not path).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I had already read Replayer::apply in this file, which calls lang_of.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `open` — QUIRKY
- spec 1 · read at `c68f908e0fea` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Opens the git repository (likely via a git library) and wraps a handle into a Blobs struct for later reading of blob contents by OID, returning None on failure.
- found: Spawns a `git -C <repo> cat-file --batch` subprocess with piped stdin/stdout, takes the stdin/stdout handles, and wraps the child process plus a buffered reader into a Blobs struct; returns None if spawning or taking the pipes fails.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `read`
- spec 1 · read at `4b11abeacd7b` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md in context
- expected: Blobs::read looks up a git blob by SHA via some repository/odb handle, decodes to UTF-8, returns None if missing, binary, or too large.
- found: It talks to a `git cat-file --batch` subprocess over a persistent stdin/stdout pipe: writes the sha, reads the header line to get kind/size, and always drains exactly `size` bytes from stdout (even when discarding) to keep the pipe's framing in sync for subsequent reads. Returns None for non-blob kinds or oversized blobs, otherwise decodes the payload as UTF-8.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: Correct mechanism guess (git object lookup with None-on-binary/missing/too-big) but missed that it's a stateful subprocess pipe protocol, not a library call — draining is required to avoid desyncing later reads.

### `drop` — QUIRKY
- spec 1 · read at `af7d03b498b1` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Cleans up resources held by Blobs (a blob cache/reader), possibly closing a git object database handle or clearing an in-memory cache.
- found: Closes the stdin handle to a `git cat-file --batch` child process (which signals it to exit) and then waits on the child process to finish, preventing a hang/zombie process.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `intern` — STALE
- read at `0fee57883022` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A standard interner: build/look up the function's key (path plus name, owner and twin ordinal), return the existing index if present, otherwise push a HistoryFunc record onto a vec, insert the new index in the map and return it.
- found: Exactly that, with the key already computed on the FuncAt (`f.key`) rather than built here; pushes HistoryFunc { path: path_idx, name, owner, ord } and returns the new index.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `functions_of` — STALE
- read at `399486d1677c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Parses the source with parse::parse_functions, walks the results with a per-name occurrence counter so the nth same-named function gets ord = n, builds key_of(path, name, ord) for each, and collects into a FileState of key plus size per function.
- found: That, with two details I did not cover: the counter is keyed on (owner, name), not name alone, so twins in different impl blocks each start at ord 1; and despite `key_of` sitting first in the peer list, this builds the key inline as `{path}#{owner}::{name}#{ord}` rather than calling it. Each entry is a FuncAt of key, loc(), ord, name, owner.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc says ord works "exactly as assessment::key_of does", but the key is formatted inline here and the ordinal is scoped per (owner, name) rather than per name — two independent key formats that must agree by hand.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `parse_raw`
- spec 1 · read at `c0a02791bacc` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Splits a git --raw diff line into status + path(s) and builds a Change (add/modify/delete/rename/copy) with old/new path; returns None on malformed input.
- found: Parses into a Change{path, sha, from} struct: D sets sha=None; R/C read a second path as the new `path`, keep dst_sha, and set `from` to the old name only for rename (not copy); everything else (A/M/T) uses dst_sha with from=None. Uses `.first()?` on status bytes rather than indexing to avoid a panic on an empty status field, per an inline comment describing a real prior bug.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Docs mention the C-quoted-paths rationale but not the from/sha field semantics or the first()? panic-avoidance fix.

### `commits` — STALE
- read at `2a28c06e8739` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Shells out to git log --no-merges --reverse (with --max-count for Last(n), applied before the reverse) using a delimited --pretty format for sha, author, subject and unix date, parses output into RawCommits oldest-first, and separately counts how many commits precede the window (probably git rev-list --count), returning that as the truncated-prefix number.
- found: As predicted, plus the file-change parsing I did not mention: it also passes --root (so the first commit has a diff), --raw and --find-renames, and the line loop dispatches on a \x01 record prefix — header lines split on \x1f into RawCommit, everything else parsed by parse_raw and appended to the last commit's changes. dropped is total minus the limit for Last, zero for Since, and a failed git invocation returns empty rather than erroring.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: A subject containing a literal \x01 or \x1f would be mis-split, and a git failure is indistinguishable from a repo with no commits.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `tree_of`
- spec 1 · read at `3e188ba7eaf3` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Runs `git ls-tree -r <sha>` on the repo, walks the tree, and returns every blob's (path, blob_sha) pair as the opening snapshot of the history window.
- found: Shells out to `git -C repo ls-tree -r sha`, parses each line's mode/type/blob-sha/path, keeps only blob entries, and further filters to paths recognized by `lang_of`, returning (path, blob_sha) pairs; returns empty Vec on command failure.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `parse_batch` — STALE
- read at `6b6aa58dae57` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Takes (path, blob-oid) pairs, loops sequentially pulling each blob's bytes from the single git cat-file conversation in Blobs, then hands the buffers to rayon to parse in parallel — lang_of the path, refuse minified/vendored blobs to an empty FileState rather than no state, otherwise functions_of — returning (path, FileState) pairs.
- found: Exactly that: a sequential filter_map reads each blob, drops paths lang_of rejects entirely, and filters out sources with any line over MINIFIED_LINE_BYTES to None; then into_par_iter parses the survivors with functions_of and turns None into FileState::default(), so a refused blob still returns an empty state. Vendored paths are not checked here, only minification.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: A path with no known language is dropped rather than returned empty, which is the same "keeps its old wedges" hazard the comment warns about if a file's extension ever changes.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `empty` — STALE
- read at `bc72df06a030` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A constructor returning a Replayer with all state zeroed — empty path/file index maps, empty function intern table, empty per-file state — the starting point commits fold into; 17 lines because several collections are named.
- found: Exactly that: a struct literal with empty `paths`/`state` BTreeMaps, a default `Funcs` intern table, and an inlined zeroed `HistoryScan` output (paths, langs, funcs, base, base_ts 0, empty head, no commits, truncated 0).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `resume` — STALE
- read at `20ce8506c2c0` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes a previously-computed HistoryScan, makes an empty Replayer, and folds the scan's frames in order (the same fold the frontend does) to rebuild derived parse state — path index, interned functions, per-file current function sets — rather than loading a stored copy, returning a Replayer ready for new commits.
- found: Exactly that: rebuilds the paths map and funcs index (keyed by key_of) from the scan's vectors, then folds base + every commit's set/del into a live map of function index to location, and materialises each survivor as a FuncAt grouped by path into r.state. Stores the scan back as r.out.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `path_idx` — STALE
- read at `0956fb648674` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: An interning helper: look the path up in a map of path to index, and on a miss push it onto a paths vector and insert the index, returning the u32 id, so frames reference paths by small integers instead of repeated strings.
- found: Exactly that, with one thing I did not cover: on a miss it also pushes a parallel `langs` entry (lang_of(p).label(), empty string when unknown), so the two vectors are kept index-aligned by this one function.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `seed`
- spec 1 · read at `a9d626ba5960` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md in context
- expected: Takes a tree of (path, blob-hash) pairs, reads/parses each file's functions via blobs, and populates the Replayer's initial state (path index, interned functions, base output) representing the starting point before the commit window.
- found: Parses the whole tree in a batch, then for each path/function-state, interns a path index and each function, records (func_idx, loc) into self.out.base, and stores the per-path function state in self.state map.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Doc only covers intent ("parse into opening state"), not the interning/base-recording mechanics.

### `apply` — STALE
- read at `d61b82452105` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Walks the commit's changed paths: deletions drop that file's functions from carried parse state; adds/modifies fetch the blob, refuse minified/vendored, re-parse into interned functions, stamp the touch date; then append a frame of the per-file deltas.
- found: Builds a HistoryCommit frame from the commit metadata; retires paths for deletions AND rename sources first (a rename's arrival is an ordinary write), emitting del entries; then filters changes to parseable languages, parse_batch's them, interns each function and pushes (index, loc) into `set` regardless of size change, diffs against prev state to emit dels, replaces state; finally dedupes touched file indices and pushes the frame, updating head.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Rename handling (retire the `from` path, treat the arrival as a plain write) is the one thing the one-line doc gives no hint of; minified/vendored refusal lives in parse_batch, not here.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fold` — QUIRKY
- spec 1 · read at `b9ccd5bb244a` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Pops oldest frames while window exceeds limit, merging each into an opening-state map and stripping per-function dates so they're left uncoloured.
- found: Drains the oldest `extra` commits from self.out.commits (where commits.len() > limit), replays each commit's set/del diffs into a BTreeMap `base` (function id -> loc) seeded from the existing base, updates base_ts to the last folded commit's timestamp, writes base back, and increments a `truncated` counter.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `finish` — STALE
- read at `b1b630e7ca65` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A four-line consuming finalizer on Replayer that takes self by value and moves its accumulated frames and metadata into the returned HistoryScan, doing no further folding.
- found: Exactly that, in two lines: moves the interned function list (self.funcs.list) into the in-progress HistoryScan's funcs field and returns it.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The Replayer accumulates into a half-built HistoryScan (self.out) throughout, so the only thing finish does is attach the function table — legible once you know that, opaque from this body alone.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read` #2 — STALE
- read at `5abe739179ac` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Uncached top-level entry: list commits capped at limit, return an empty HistoryScan if git fails or there are none, else build a Replayer, seed the opening state from commits beyond the window, apply each commit reporting progress, and finish into frames.
- found: Exactly that shape: commits(CommitRange::Last(limit)) with a truncated flag, Replayer::empty with base_ts from the first commit, early finish() on an empty log or a failed Blobs::open, progress over total = len+1, seed from tree_of("{sha}^") only when truncated &gt; 0, then apply per commit with progress, then finish.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read_cached` — STALE
- read at `0caadb71ef7c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Load the cache; return it unchanged if its head equals current HEAD; else if the cached head is an ancestor, extend with the new commits; otherwise full replay via read, saving the cache. Failures fall through to the full path.
- found: Exactly that shape. load_cache is keyed by (repo, limit) so a different window is a miss rather than a check; the equal-head path also fires a 1/1 progress tick so a caller's bar completes; the ancestor test lives inside `extend`, which returns Option and None-falls-through to full read. Both non-hit paths save_cache.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `extend`
- spec 1 · read at `5d670b5506c8` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks cached head is still ancestor of HEAD, replays new commits via Replayer::resume/apply up to limit with progress reporting, returns updated HistoryScan or None if invalidated.
- found: Bails to None if cached head is empty/not an ancestor (history rewritten), if there are no new commits, or if the new commit count exceeds `limit` (all-or-nothing, no partial extend). Otherwise opens Blobs, resumes a Replayer, applies each new commit with progress callback, folds to limit, and returns the finished scan.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The exceeds-limit case also returns None (full rescan instead) rather than partially extending — a deliberate all-or-nothing design choice from the comment.

### `warm` — STALE
- read at `b72ef217275c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Checks whether a cached timeline exists for repo via cache_path/load_cache; returns false without building one if not; otherwise brings it up to date by extending with commits since its head and returns true.
- found: Exactly that in six lines: cache_path (None -> false), path.exists() (false -> false), then read_cached with a no-op progress callback to do the extend, and true. The extend logic lives in read_cached rather than here.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `head_of` — STALE
- read at `5ac474a045ed` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Runs git rev-parse HEAD in repo, returns the trimmed SHA as a String, and returns an empty String on any failure rather than a Result.
- found: Exactly that: git -C repo rev-parse HEAD, output().ok(), utf8 stdout, trim, unwrap_or_default. It never checks exit status, so a failure yields empty stdout and therefore the same empty-string sentinel.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_ancestor` — STALE
- read at `c3025e68f1a0` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Runs `git merge-base --is-ancestor <sha> HEAD` in repo, returning exit success; false on spawn failure. Used to decide whether a cached timeline may be extended or must be replayed whole.
- found: Exactly that, with stderr nulled because a sha that no longer exists is the expected answer to "was this history rewritten", not an error worth printing.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `cache_path`
- spec 1 · read at `7a999ee4d47c` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md in context
- expected: Builds a machine-local cache file path for a repo's commit history, likely under some app data/cache directory, keyed by the repo path and a limit (max commits), probably hashing the path for a filename.
- found: Gets the app data dir's "timelines" subfolder, creates it if needed, computes an FNV-1a hash of the repo path string, and returns a path formatted as "{hash:016x}-{limit}.json". Returns None if data_dir is unavailable or dir creation fails.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: File-level docs describe the whole history.rs module's philosophy, not this specific function.

### `load_cache`
- spec 1 · read at `78bf03749feb` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads and deserializes a cached HistoryScan from disk via cache_path(repo), returning None if missing/unreadable/unparseable; limit likely validates the cached window.
- found: Reads JSON from cache_path(repo, limit), deserializes into a Cached struct, and only returns the scan if cache version, parser version, AND limit all match the current expectations — otherwise None (silent cache invalidation via chained Option combinators).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `save_cache`
- spec 1 · read at `1b112901bfa3` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md in context
- expected: Serializes the HistoryScan (with version/limit metadata) to JSON and writes it to cache_path(repo, limit), silently ignoring failures since this is just a best-effort cache write.
- found: Exactly that: builds a Cached struct (version, parse version, limit, scan clone), serializes to JSON, writes to cache_path, and silently swallows any errors — explained in a comment as an intentional choice since losing a cache costs only some seconds on next replay.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `raw_line_reads_a_plain_edit` — STALE
- read at `7504f78153aa` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A test feeding one git raw name-status line for a modification (M plus a single path) to the raw-line parser and asserting it reads as an edit of that path with no old path — sibling of the rename and deletion tests.
- found: Exactly that: parse_raw(":100644 100644 aaa bbb M\tsrc/main.rs") must parse, path is src/main.rs, sha is the POST-image blob ("bbb", not "aaa"), and `from` is None. The sha assertion is the detail I did not name.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `raw_line_reads_a_rename_as_a_move` — STALE
- read at `8d07e9997562` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A five-line unit test handing the raw-diff line parser a git --raw rename record (R-status with old and new tab-separated paths) and asserting it yields a move — old path retired, new path added — rather than a bare add.
- found: Exactly that, via parse_raw on a full `:100644 100644 aaa bbb R096` line: asserts path is the NEW path and from is Some(old path). The retirement is expressed as the `from` field rather than as two events.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc argues about ghost copies left in the state map, but the test only checks that parse_raw carries `from` — nothing here shows the caller actually retires the old path, so the property the doc names is untested at this level.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_copy_does_not_retire_its_source` — STALE
- read at `78d73f1621ae` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Feeds a git log --raw line with a C (copy) status and two paths to parse_raw, asserting the destination is the touched path while the source is left alone rather than retired the way an R rename would be.
- found: Exactly that: parse_raw of ":100644 100644 aaa bbb C075\tsrc/a.rs\tsrc/b.rs", asserts path == src/b.rs and from.is_none().
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `raw_line_reads_a_deletion` — STALE
- read at `8fda6e4557d0` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A short test feeding one git log --raw line describing a deleted file (status D) to the raw-line parser and asserting it yields a change for that path marked as a deletion, mirroring its plain-edit and rename siblings.
- found: Exactly that: parse_raw(":100644 000000 aaa 000 D\tsrc/gone.rs") must parse, path is src/gone.rs, and deletion is expressed as sha being None (the all-zero destination blob becomes an absent sha) rather than a status field.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `same_named_functions_in_one_file_stay_apart` — STALE
- read at `a9237f409e51` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A short test parsing a source blob with two same-named functions in one file (different impl blocks), asserting the replayer produces two distinct keys/ids rather than collapsing them into one, so a twin arriving does not read as the first growing.
- found: Exactly that: two `fn new()` in `impl A`/`impl B`, functions_of over the blob, asserts two keys and that they differ.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm: this is my second reading in history.rs, though from a different region of the file.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `repo_with` — STALE
- read at `c4e191b5b641` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A test fixture: makes a TempDir, runs git init plus local user.name/user.email config, then loops n times appending a distinct fn f0/f1... to src/lib.rs, git add and git commit each iteration, returning the TempDir so the caller can replay an n-commit history.
- found: Exactly that, with a local `git` closure that shells out with -C and expects success. One difference from the doc: the file is `src.rs` at the repo root, not `src/lib.rs`, and each commit rewrites the whole file with functions f0..fi rather than appending.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The doc says `src/lib.rs` but the fixture writes `src.rs` at the repo root — a stale doc, and the path matters to anything asserting on directory rings.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `shape`
- spec 1 · read at `d4761ced1893` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md in context
- expected: Test helper turning a HistoryScan into a normalized, index-independent summary (paths, a count, per-function aggregates) so two timelines can be compared for equivalence despite differing internal function numbering.
- found: Replays base + per-commit set/del events into a live BTreeMap of func-index -> loc, converts each survivor to a (path+name key, loc) pair via key_of, sorts them, and returns (commit SHAs in order, the scan's truncated flag, the sorted alive key/loc list) — a shape keyed by stable identity rather than raw indices.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `extending_a_cached_timeline_matches_replaying_it_whole` — STALE
- read at `4c76bd8bff32` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Build a temp repo with several commits, replay to a timeline, add another commit, extend from the cached timeline, replay the whole thing fresh, and assert the two agree.
- found: Exactly that: repo_with(3), read to a cached timeline (asserting 3 commits), write and commit a fourth via git, extend the cached one, read a fresh one, and compare `shape(&extended) == shape(&fresh)` rather than the raw timelines.
- predicted: full · documented: most · derivable: no · legible: most · trap: no
- note: Equality is checked through `shape()`, so whatever that projection drops (dates, for instance) is outside the guarantee the test's name claims.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `extending_past_the_window_folds_to_the_same_state` — STALE
- read at `7b43539a5e4a` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Builds a repo with more commits than the window via repo_with, reads a capped timeline, commits more, extends the cached timeline, and asserts the result equals a from-scratch replay so the overflow-fold path cannot drift from the fresh walk.
- found: Exactly that shape at minimum size: 3 commits with a cap of 2 (asserting truncated == 1), one more commit written and committed by shelling out to git, then extend vs read compared by `shape(...)` and commit count.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: The equality is only `shape(&extended) == shape(&fresh)` — whatever `shape` omits (dates, touch stamps, the folded base itself) is unchecked, so the test is weaker than the doc's claim of arriving "at the same base".
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_history_that_was_rewritten_is_not_extended` — STALE
- read at `37b2728fb663` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test that builds a repo, caches a timeline, rewrites history so the cached head is no longer an ancestor of HEAD, and asserts the result is a fresh full replay rather than an append — probably via is_ancestor and comparing to a whole replay.
- found: Simulates the rewrite by overwriting the cached head with a bogus all-zero sha instead of actually rewriting the repo, and asserts extend returns None (refusal); the caller's fallback to a full replay is not exercised here.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: A nonexistent sha is not the same case as a real rewrite — a rewritten-but-valid commit that is not an ancestor of HEAD would take a different path through is_ancestor and is not covered.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `vendored_paths_have_no_language` — STALE
- read at `b1e52d686702` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A short test asserting a vendored path (node_modules/…, vendor/…) yields None from the history language lookup while an equivalent non-vendored path yields Some — proving history refuses what the scan refuses.
- found: Three asserts on lang_of: node_modules/react/index.js is None, web/src/main.tsx is Some, README.md is None. The third covers unsupported extensions rather than vendoring, which the name does not promise.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The test is named for vendoring but only one of its three asserts is about vendoring, and it checks a single vendored prefix — the VENDORED list history duplicates from scan is otherwise unexercised here.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/lib.rs

### the file itself
- read at `16afe440a182` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: The crate root of the Tauri app: a crate doc header naming the pipeline, pub mod declarations for scan/parse/heuristic/surprise/churn/model etc, then the desktop shell — build_window creating the main webview window, build_menu plus a ThemeMenu for the native menu bar and theme radio group, and run() as the entry point registering the commands.rs invoke handlers and starting the app. Mostly wiring, little logic.
- found: That, plus three things I did not cover: the window is built in code rather than config specifically because macOS traffic-light inset has no config key or runtime setter (TRAFFIC_LIGHTS is a shared department constant); the whole menu, ThemeMenu and its theme events are cfg(target_os = "macos") only, with the Edit menu present solely to restore clipboard shortcuts lost by replacing the stock menu; and run() also owns the loopback agent API lifecycle — a shared agentapi::Shared managed as Tauri state, agentapi::restore, a spawned agentapi::serve task, a single-instance plugin that focuses instead of rescanning, and a RunEvent::Exit hook calling release_endpoint so a dead backend stops claiming its port.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The file header describes the scoring pipeline — none of which is in this file — and says nothing about the window, menu or agent-API lifecycle that is; it reads as an architecture note that landed in the crate root because that is where rustdoc shows it.

### `build_window`
- read at `7001628a8abe` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Builds the main WebviewWindow programmatically with WebviewWindowBuilder — URL, title, default and minimum size that used to live in tauri.conf.json — then applies the macOS-only bits config cannot express (overlay/hidden titlebar, traffic-light inset) and builds, ignoring or expecting the result.
- found: Exactly that: builder for "main" at index.html, title "Sanity", inner_size 1440x900, min_inner_size 1280x720, then a #[cfg(target_os = "macos")] shadowed builder adding TitleBarStyle::Overlay, hidden_title and traffic_light_position from a TRAFFIC_LIGHTS constant. A build failure is printed to stderr rather than panicking. Comments justify each size and the cfg guard.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `select`
- read at `40315c6ada50` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Calls set_checked on each of light/dark/system with `which == "light"` etc. so exactly one is ticked, discarding each Result since a failed tick is cosmetic.
- found: Exactly that, three lines, each `let _ = ...set_checked(which == "…")`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: An unrecognised `which` silently unticks all three rather than falling back to system, so a typo in a caller leaves the menu with no appearance marked.

### `build_menu`
- read at `2e04ab8dc3d4` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Builds the macOS menubar from Tauri predefined items (app submenu with About/Hide/Quit, Edit with clipboard items, Window with minimize/close) plus a custom three-way appearance radio group as check items, returning the Menu and a ThemeMenu holding those three handles.
- found: Exactly that, plus a File submenu with a single custom "Connect an Agent…" item on ⌘O (id open-project). Appearance is light/dark/system CheckMenuItems nested under View > Appearance, system checked by default; returns (menu, ThemeMenu{light,dark,system}).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The three theme items are independent CheckMenuItems, not an enforced radio group — exclusivity depends entirely on ThemeMenu::select being called correctly.

### `run` — QUIRKY
- read at `ad3ab3f4ee0d` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The Tauri entrypoint: assembles tauri::Builder, registers plugins and managed state, wires invoke_handler with the commands module, calls build_window/build_menu, dispatches menu events including theme selection, and runs the app, panicking on failure.
- found: All of that, plus the agent-API lifecycle I did not predict: it creates the shared agentapi state, manages one clone and keeps another, calls agentapi::restore to reopen the previous project, spawns agentapi::serve on the async runtime, and on RunEvent::Exit calls release_endpoint(pid) so the endpoint file stops naming a dead port. Menu building is macOS-only and failure is logged rather than fatal; the open-project and theme- menu ids are emitted to every webview.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: The project brief in my context had told me about release_endpoint, but I did not put it in my prediction, so I graded on the handout alone; from the signature `pub fn run()` and three window/menu peers there was nothing to suggest this function also hosts the agent backend's start, restore and shutdown.

## src-tauri/src/local.rs

### the file itself — STALE
- read at `7faff69fdc04` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A feature-gated no-server scorer: loads a small local GGUF model, runs one forward pass over a whole function body to get per-token logprobs, converts that to a surprisal/surprise score for `just scan`, plus helpers to label the model, detect it, and discover model files on disk.
- found: Exactly that, plus a concurrency design I did not predict: LlamaContext is neither Send nor Sync, so the model is owned by a dedicated thread and callers post (prefix, body) jobs over an mpsc channel with a reply channel, with backend and model Box::leak'd to 'static to dodge a self-referential struct. score_one tokenises prefix and body, trims the CONTEXT rather than the body to fit MAX_TOKENS=1024, requests logits only at the positions that predict body tokens, and does a max-subtracted log-softmax summed to bits per token. discover_models reads Ollama's blob store and filters by >100MB size.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The header explains the one-pass measurement and hardware choice but says nothing about the owner-thread/leak design, which is the most surprising thing in the file; that reasoning lives in inline comments instead.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `load`
- spec 1 · read at `59001fb85ed8` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md in context
- expected: Loads a GGUF model on a dedicated owner thread (since the context isn't thread-safe/Send) and returns a LocalModel handle communicating via channel.
- found: Spawns a thread that inits LlamaBackend and loads the model, both intentionally Box::leak'd to 'static to sidestep the self-referential LlamaContext<'a> borrow problem since the app loads exactly one model for its whole lifetime; reports load success/failure back via a one-shot ready channel (since the thread can't return a Result directly), then loops servicing scoring Jobs off an mpsc channel by calling score_one, until the LocalModel (and its sender) is dropped.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The deliberate Box::leak to 'static for both backend and model, justified by a comment as honest about permanence rather than faking a managed lifetime, was the one detail I hadn't anticipated.

### `surprisal`
- spec 1 · read at `476dc5b143b1` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md in context
- expected: Locks the jobs mutex, sends a (prefix, body) job with a reply channel to the owner thread, blocks on the reply, returns the surprisal score or None on failure.
- found: Exactly that: creates reply channel, locks jobs sender and sends ((prefix, body), reply_tx), blocks on reply_rx.recv(), propagating None through every fallible step via `?`.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `score_one`
- spec 1 · read at `7e93f16195bd` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Tokenizes prefix+body, single decode with logits at every position, computes per-token surprisal from logits, averages across body tokens into one f32 score.
- found: Tokenizes prefix and body separately; rejects bodies under 8 tokens; trims context (never body) to fit MAX_TOKENS budget; requests logits ONLY at positions needed to predict body tokens (an explicit perf optimization, ~3x cost avoided); does manual max-subtracted log-softmax per position; sums -log2(p) (bits) over body tokens and averages to bits-per-token.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `label` — STALE
- read at `9a3887e51aac` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A trait method returning a short human name for the scorer used in provenance — the model's name, perhaps prefixed to distinguish it from the heuristic proxy.
- found: A one-line getter cloning a `label` String already stored on the struct; whatever naming or prefixing happens does so at construction, not here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_model` — STALE
- read at `aa06a9531b3a` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A trivial trait accessor on LocalModel returning true unconditionally, marking this as a real model-backed scorer rather than the heuristic proxy.
- found: `true`, nothing else.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `surprise` — QUIRKY
- spec 1 · read at `b4a87facc399` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md in context
- expected: Calls self.surprisal on the item and combines the result with the proxy baseline to produce a Reading, likely via LocalModel::label to attach a label.
- found: Builds a prefix from item.context + item.signature (matching what the HTTP path conditions on for comparability), calls self.surprisal(prefix, item.body); on success wraps the calibrated surprisal bits in Reading::plain, on None (model failure) falls back to Reading::plain(proxy) using the caller-supplied proxy score instead.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Proxy is a fallback for when surprisal fails, not a value combined into the score.

### `discover_models`
- spec 1 · read at `6300ccb643a9` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md in context
- expected: Scans Ollama's blob store directory (~/.ollama/models/blobs) for files, filters to those over a size threshold (~100MB) as a proxy for "this is a model weight file", and returns their paths as candidates.
- found: Exactly that: joins home dir with .ollama/models/blobs, reads entries, keeps ones over 100_000_000 bytes, sorts and returns the paths.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc explicitly corrects a prior misreading of this exact function (predicted a GGUF magic-number check), which primed my prediction toward the size-threshold mechanism rather than leaving it to be discovered fresh.

## src-tauri/src/main.rs

### the file itself
- read at `85fd5a79591b` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A thin Tauri binary shim: the windows_subsystem cfg_attr, and a main that dispatches to cli.rs when argv names a subcommand (mcp, serve, study, status) and otherwise calls the library run() to open the window. No logic of its own.
- found: Exactly that shape. `mcp` is special-cased first and returns rather than exiting; any other non-empty argv is forwarded to sanity_lib::cli::main and its return becomes the process exit code; empty argv opens the window. Inline comments carry the reasoning — one binary so the command an agent is told to launch always exists, and so a second installable cannot drift the way mcp/sanity.mjs did.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: No file-level header at all in a repo where every other module carries a long one; the reasoning lives in inline comments instead, so `docs` came through empty.

### `main`
- read at `84cd70f31b74` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Binary entry point: inspects env::args and dispatches to CLI subcommands (scan, mcp, serve, study, history) in cli.rs, exiting after; otherwise launches the Tauri app via sanity_lib::run().
- found: Three-branch dispatch: arg 1 == "mcp" runs the stdio MCP server and returns; any other non-empty args exit with sanity_lib::cli::main's status code; no args opens the window. Heavy inline comments explain the one-binary rationale.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment was handed over, but the body carries three substantial inline comments — the reasons are there, just not where the tool looks.

## src-tauri/src/mcp.rs

### the file itself
- read at `9aece845730b` · commit `6366346` · read by claude-opus-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: The stdio JSON-RPC shim: a run() loop over stdin/stdout handling initialize, tools/list and tools/call, with tools() as the single contract; call() translating each tool into an HTTP request against the per-machine backend via get/post/decode/base_url, holding the session's project in a PROJECT static and passing it as a query parameter via urlencode so a window click cannot retarget a headless run; with_retry/heal probing and restarting a dead backend once, with errors classified transient vs never-started so the text says what to do; contract_fingerprint hashing the schema so drift is visible.
- found: All of that, and the file is about two-thirds commentary. The retry loop is subtler than I expected: a missing endpoint file is deliberately not an error (a restarting app looks exactly like that), the transient/fatal split is decided by a live /health PROBE rather than by the file existing, and healing re-POSTs /open with PROJECT because a fresh backend restores asynchronously and would answer NO_PROJECT. decode() branches on HTTP status — 4xx says nothing was recorded so fix and resend and keep your reading, 5xx says stop and tell the human — rather than parsing every response as JSON. REQUEST_TIMEOUT is 600s specifically so a 51s repo scan is not mistaken for silence. call() omits `n` unless the caller asked, so serde's default_n is the only place the batch size is decided; sanity_report gets `project` injected into the body while the read verbs get it as a query string. Tool errors come back as content with isError rather than as JSON-RPC errors, so the model can read them.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: Warm — this was my second visit to mcp.rs, and CLAUDE.md (already in my context) names PROJECT, default_n and contract drift, so my prediction was better informed than the header alone would have made it; the header itself covers the one-server rule and the never-fail-quietly rule but says nothing about the retry, healing or status-classification machinery that is most of the file.

### `project`
- read at `828a0c7bf6ed` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A getter over the shim's process-global PROJECT: lock it and return a clone of the project key this client opened, None before any open. No other logic.
- found: Exactly that — `PROJECT.lock().ok().and_then(|p| p.clone())`, so a poisoned lock also reads as None.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Warm: second reading in mcp.rs. Worth noting the `.ok()` silently turns a poisoned lock into "no project", which elsewhere in this codebase is a Fatal condition for a reader — the neighbouring backend code deliberately recovers from poison instead.

### `base_url`
- read at `9307f3f15219` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Reads the endpoint file the app publishes, parses the port out of it (ignoring the pid also stored there), returns Some("http://127.0.0.1:{port}") or None when missing/unparseable; no caching; probably honours a SANITY_BACKEND override.
- found: Returns SANITY_BACKEND verbatim when set, otherwise delegates to `agentapi::read_endpoint()?.url()` — deliberately not parsing the file here, because the CLI needs the pid too and two parsers of one format is the duplicated-contract failure in miniature.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc spends most of its length correcting a previous doc's false claim about a liveness check, and says nothing about the SANITY_BACKEND override that is the function's first branch.

### `with_retry`
- read at `72c9619e1d27` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Loops to a deadline re-resolving base_url each pass and calling attempt; Fatal returns Err at once, Transient sleeps and retries; once during the loop, if the backend looks gone, it calls heal/ensure_backend to restart it before continuing, and returns Err(String) if the window closes without success.
- found: That, plus the part I did not cover: how the terminal error is chosen. A missing endpoint file simply skips the attempt rather than erroring. On deadline it probes `cli::live()` and returns UNREACHABLE if something answered, NOT_RUNNING if nothing did — deliberately not deciding by whether the endpoint file exists. The one-shot heal is gated on the same probe and, on success, loops immediately instead of sleeping.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `heal`
- read at `893c3d008631` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Restarts a dead backend (spawn + wait until it answers), then if the shim's PROJECT static holds a path, synchronously reopens that repo against the fresh backend so the caller's retry does not land in the NO_PROJECT window. Err(String) on spawn or reopen failure, Ok(()) when nothing was opened yet.
- found: Calls cli::ensure_backend()?, returns Ok(()) early if project() is None, otherwise resolves base_url() and POSTs {"path": key} to /open using a raw client() call — deliberately not through the shim's own `post` helper, since post is the caller and re-entering the retry loop being repaired would recurse.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The one thing I did not predict — that it must bypass its own `post` helper to avoid recursing into the retry loop it is repairing — is the only non-obvious line, and it lives in an inline comment rather than the doc comment.

### `client`
- read at `0f6714dc0296` · commit `6366346` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A tiny constructor building a blocking reqwest client with an explicit timeout, mapping a builder failure into a RetryableError with a message and a transient/fatal classification.
- found: Exactly that, four lines: builder, .timeout(REQUEST_TIMEOUT), .build(), and the error mapped to RetryableError::Fatal with the source error's string — a client that cannot be constructed is never worth retrying.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I had opened this file earlier in the run for `call`, though only its lines 454-534.

### `decode`
- read at `397997e3c2b3` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: Branches on the HTTP status before touching the body. 2xx parses JSON, a parse failure becoming its own error; 4xx reads the body as text and returns a non-retryable error carrying that sentence plus "your arguments are wrong, nothing was recorded, fix and resend"; 5xx returns an error saying it is Sanity's fault, something may already have been recorded, so do not blindly resend.
- found: Exactly that shape. Details I did not cover: all three outcomes are `RetryableError::Fatal`, so nothing here is ever retried, including 5xx — the advice there is "stop and tell the human" rather than "retry". The body text is trimmed, defaulted to "no detail given" when empty, and truncated to 400 chars because the extractor message is sometimes a wall of serde path detail. The 4xx text also volunteers the most common actual mistake — every field goes at the top level, there is no wrapper object — and insists a paid-for reading be resent rather than discarded.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Warm: I had already read a different function in this file (contract_fingerprint) this run, though not these lines.

### `get`
- read at `f8fa773a68b5` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 4 of its run
- expected: A thin wrapper over with_retry: build {base}{path} (appending the shim's project key, urlencoded), GET through client(), map connection failures to RetryableError::Transient and others to Fatal, return the decoded JSON via decode.
- found: Exactly that minus the query string — it formats {base}{path} verbatim, sends the GET, maps any send error to Transient, and hands the response to decode. The project key is the caller's job, not this function's.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I had already opened this file for with_retry. The one thing my prediction got wrong — that the project key is appended here — came from the project's own brief rather than from the handout, and grading on the handout alone it was an unsupported guess.

### `post`
- read at `34314aa7895c` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: A thin helper: JSON POST to the backend base URL plus `path` through the shared `client()`, response handed to `decode`, the whole thing wrapped in `with_retry` so a dead backend is healed once, flattening RetryableError into a plain String.
- found: Exactly that, in six lines. `with_retry` supplies the base URL to the closure rather than the closure fetching it, and a send failure maps to `RetryableError::Transient` — deliberately discarding the reqwest error, since the transport-level failure is the retry signal and `decode` owns everything that has a status.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm again — third function handed to me from mcp.rs, and having read `decode` immediately before made this one easy in a way the code cannot take credit for.

### `urlencode`
- read at `6ead12706987` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A hand-rolled percent-encoder: iterate the bytes, pass the unreserved set (A-Z, a-z, 0-9, -_.~ and probably /) through unchanged, emit everything else as uppercase %XX hex, collect into a String.
- found: Exactly that — `s.bytes().map(...)` with that literal allowlist including `/`, `format!("%{b:02X}")` otherwise, collected. Working on bytes rather than chars is what makes multi-byte UTF-8 in a directory name encode correctly.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `tools`
- spec 1 · read at `f5ca9c54d15f` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns the static JSON tool-contract definitions (name/description/input schema) for the five MCP tools: sanity_open, sanity_next, sanity_report, sanity_status, sanity_summary.
- found: Exactly that: a json!() literal array with the five tool definitions, each with name, description, and inputSchema; includes an inline comment explaining why sanity_report's schema field order is load-bearing (mangled emissions).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `contract_fingerprint`
- read at `fc0982380099` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Serialises the `tools()` list to a JSON string and runs an FNV hash over its bytes, returning the digest as a short hex string — a stable fingerprint of the schema this process image was compiled with, so drift between two halves can be detected.
- found: Exactly that: `serde_json::to_string(&tools())`, FNV-1a with the standard 64-bit offset basis and prime, wrapping multiply, formatted as 16 hex digits. A serialisation failure falls back to the empty string via `unwrap_or_default`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `call`
- read at `818050c8bf41` · commit `6366346` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The shim's tool dispatcher: match the tool name across the five sanity_* tools, turn each into a get/post against the backend, attach the session's own PROJECT key rather than trusting args, pass n only when the caller supplied one, heal a dead backend, return decoded JSON or an error string.
- found: A five-arm match doing that. sanity_open additionally calls ensure_backend (result deliberately discarded), posts a contract_fingerprint alongside the path, and stores the returned project key into the PROJECT mutex; status/next/summary are GETs with the key urlencoded into the query, next clamps a caller-supplied n to 1..25 and omits it otherwise so serde fills default_n; report clones args and injects the project key; unknown names return an error. Retry/heal is not here, it lives inside get/post.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: My prediction of the omit-n behaviour came from the project brief rather than the handout, which carried no doc comment at all; on the handout alone I would not have called it, so I graded down.

### `run`
- read at `d74877b869da` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The stdio JSON-RPC loop: read newline-delimited requests from stdin, dispatch initialize, tools/list (from tools()) and tools/call (to call), ignore notifications, write each response as a JSON line to stdout, return errors as JSON-RPC error objects, and end when stdin closes.
- found: That loop, with one thing I got backwards: tool-call failures are returned as tool CONTENT with `isError: true`, not as transport errors, deliberately so the model can read and act on the message; only an unknown method gets a real JSON-RPC error (-32601). Notifications are skipped by absence of `id`, unparseable and blank lines are skipped silently, and initialize pins protocolVersion 2024-11-05 with the crate version as serverInfo.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No docs on the function; the one non-obvious decision (errors as content, not transport failures) is explained in an inline comment instead.

## src-tauri/src/model.rs

### the file itself
- read at `facd499708fc` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: The shared data vocabulary crossing the Rust/frontend boundary: the Lang enum with extension mapping and display labels, Provenance and Source enums, the Score struct with derived readings temperature/is_stable/quadrant, and the Node tree (kind, path, loc, score, children) with constructors, visit traversal and LOC-weighted aggregate — serde types with almost no behaviour beyond the score arithmetic and roll-up, followed by tests pinning the metric's stated rules.
- found: That, and denser than I predicted in one respect: it is as much a rationale document as a type file. Every enum and nearly every struct field carries a doc comment arguing why it exists and what went wrong before — Provenance's weights, Source::Agent's deliberate separation from Model, hot_share's anti-averaging argument, body's whitespace-collapsed hash, owner and signature each justified by a specific misreading on a real repo. Beyond what I named it also holds NodeKind, the Quadrant enum with its four corners described, the HOT = 0.5 constant, and Node fields I did not anticipate (excluded, hotspots, last_author, end_line). Behaviour is confined to from_extension, label, Provenance::weight, temperature/is_stable/quadrant, dir/visit/aggregate.
- predicted: most · documented: some · derivable: no · legible: not judged · trap: no
- note: The file header argues the size/colour rule and the temperature-vs-hot_share split well, but says nothing about the file's other half — Lang and its extension policy, Provenance, Source, and the Node tree itself — so it reads as a note about the metric rather than a header for the module.

### `from_extension`
- spec 1 · read at `071ed7ae1925` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A straightforward match/lookup from a file extension string (rs, js, ts, py, etc.) to a Lang enum variant, returning None for anything not explicitly recognized.
- found: Exactly that, but a much larger table than expected — roughly 60 languages — with deliberate, documented tie-breaking for ambiguous extensions (.h to C++ not C, .m to Objective-C not MATLAB, .v to Verilog not V, .pl to Perl not Prolog), each justified by measured parser behavior or ecosystem convention rather than arbitrary choice.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `label`
- read at `c498758b608f` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: An exhaustive `match self` over every Lang variant returning its human-readable display name as a &'static str, no catch-all arm.
- found: Exactly that: 63 arms, one per variant, mapping to display names with the expected casing conventions (C++, C#, Objective-C, Emacs Lisp, jq lowercase). No wildcard, so a new variant fails to compile.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `weight`
- read at `77429a5e2d9b` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A match over Provenance variants returning a 0..1 multiplier for how much explanation each source may bank: human/committed prose 1.0, in-repo Source comments discounted around 0.5 because authorship is unknowable, and any model-authored variant 0.0.
- found: Exactly that shape, four arms: None 0.0, Source 0.6, History 0.85, Human 1.0. There is no model variant at all — the design point is that it does not exist rather than that it weighs zero.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I expected a model-authored variant weighted 0.0 and there is none; I should say that the absence of that variant is a point the project brief in my context makes, so I graded the prediction on the handout's docs alone, which do imply it.

### `temperature`
- read at `dbe0be3b05b2` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A one-line accessor returning self.surprise unchanged, no multiplier, kept named so the definition of the colour has one home.
- found: Returns self.surprise clamped to 0..1. The clamp is the one detail I explicitly said would not be there.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs say "simply the surprise" but the body clamps, which quietly hides any out-of-range surprise a scorer produces rather than surfacing it.

### `is_stable`
- read at `fcc7f260c9ce` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A one-line predicate: true when age exceeds a generous threshold (about a quarter, 90 days) and churn is low; young or busy is false.
- found: `self.churn < 0.25 && self.age_days.is_some_and(|d| d > 90.0)` — and because `age_days` is an Option, an unknown age (a repo with no git history) reports not stable rather than claiming either verdict.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Warm (fourth read in model.rs), and the doc names the quarter-long threshold outright, so 90.0 was handed to me rather than inferred.

### `quadrant`
- read at `7f407691f346` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Crosses the two axes — hot vs cold surprise from temperature, stable vs churning from is_stable (loc probably feeding the stability side) — and returns one of four Quadrant variants.
- found: Matches on (surprise >= HOT, is_stable()): hot+stable is CrownJewel, hot+unstable is Trouble; cold code splits on size instead of stability — loc >= 40 is Bloat, otherwise Quiet. loc is used only for the Bloat call, with a comment saying why.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I assumed loc fed the stability axis; in fact the cold half ignores stability entirely and splits on size, so it is not a clean 2x2 despite the peer test named quadrants_split_on_surprise_and_stability.

### `dir`
- read at `4bc0c53b8d9e` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: An undocumented constructor building a Node with kind Dir, id/path from `path`, name from `name`, zero loc, no score, empty children, everything else defaulted and filled in later by insert/aggregate.
- found: Exactly that — a flat struct literal with id and path both set to `path`, `kind: Dir`, `excluded: false`, `loc: 0`, every optional field None, and empty `hotspots`/`children`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I had already read model.rs earlier in this run for `aggregate`, though not these lines.

### `aggregate` — TRAP
- read at `6c303e224eac` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Post-order recursion over children, summing child LOC into self.loc and folding child score components into an LOC-weighted mean; plus a hot_share computed over analysed lines only, so unanalysed lines are in neither numerator nor denominator.
- found: That, and more bookkeeping I did not cover: LOC is only summed for non-Func nodes; weight is `loc.max(1)` so a zero-line child still counts; hot/analysed is split into a leaf branch (a Func counts fully, but only when `source != Proxy`) and a parent branch (composing the child's own `analyzed_share`/`hot_share`); `age_days` takes the child MAX (oldest surviving code) while `last_touched_days` takes the MIN; `commits` is deliberately zeroed for later fill from the git log because summing children would double-count one commit across files; provenance is not averaged and is forced to `Source`; `analyzed_share` is analysed/w.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: An inline comment names `reaggregate` in api.ts as a hand-maintained twin of this function that has already disagreed with it once — a real ordering/duplication trap for whoever edits either side; the handed doc covers only the LOC-weighting and none of the age/touched/commits/provenance rules.

### `visit`
- read at `4934713a4512` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A preorder traversal: call f(self), then recurse into each child with the same closure.
- found: Precisely that, five lines, no early exit and no depth limit.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `score`
- read at `5ec5f5cc55d7` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A private test helper building a Score from the four named fields with neutral defaults for the rest: age_days Some(age), commits 0, last_touched_days None, provenance Source, hot_share 0.0, source Proxy, analyzed_share 1.0.
- found: Exactly that, with one difference from my prediction: `source` is `Source::Model`, not `Proxy` — which matters, because `aggregate` only counts a Func toward hot/analysed lines when `source != Proxy`, so the helper is deliberately building a reading that registers as measured.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Warm on this file (third reading from model.rs), and the `Source::Model` default is load-bearing for the hot-share tests but nothing in the helper says so.

### `temperature_is_surprise_and_documentation_does_not_discount_it`
- read at `d6abbed69b4c` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test constructing Scores with identical surprise but different documentation/explained values and asserting temperature() is unchanged — temperature equals surprise, docs do not discount it.
- found: Exactly that: three asserts via a `score(surprise, explained, ..)` helper — (1.0, 0.0) and (1.0, 1.0) both give temperature 1.0, and (0.8, 0.5) gives 0.8 within 1e-6.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The name is unusually load-bearing and the body matches it, but the last two positional args of `score` are never varied here, so the test only pins the second parameter's non-effect.

### `quadrants_split_on_surprise_and_stability` — QUIRKY
- read at `48acd6b32ddf` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A test building four Scores at the corners of the surprise × stability axes and asserting quadrant() returns each expected variant.
- found: Five asserts over CrownJewel / Trouble / Bloat / Quiet, and the axes are richer than I said: stability is churn plus AGE (0.9 surprise at age 3 days is Trouble, not CrownJewel), and quadrant() takes a size argument so the same low-surprise score is Bloat at 500 lines and Quiet at 4.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: The test name says two axes but the body shows three inputs deciding the quadrant — surprise, churn/age, and a size parameter that alone separates Bloat from Quiet.

### `a_directory_reports_the_share_of_it_that_is_hot_not_the_mean`
- read at `dac34ae034c9` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: A dir with one hot and one cold Func child of known LOC, aggregated, asserting hot_share is the LOC fraction that is hot rather than the mean temperature.
- found: Precisely that: 100 LOC at surprise 1.0 and 300 LOC at 0.0, asserting hot_share ≈ 0.25 within 1e-6 and that the mean `surprise` stays under 0.3 — the "lukewarm" reading the colour deliberately does not use.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: this is my second test from model.rs, and the previous one taught me the Node::dir-then-set-kind idiom and the score() helper's argument order.

### `unanalysed_lines_are_left_out_of_hot_share_entirely`
- read at `9af15d2567b1` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Builds a directory with an analysed hot function plus a chunk of unanalysed lines, aggregates, and asserts hot share is computed over analysed LOC only, so the unanalysed bulk neither dilutes nor inflates it.
- found: Exactly that: a src dir with a 100-line model-scored hot func and a 300-line func whose score is Proxy with analyzed_share 0. After aggregate() it asserts hot_share == 1.0 and that analyzed_share comes out at 0.25, i.e. the unanalysed lines leave the hot denominator but are still reported as the coverage fraction. A leading comment explains that counting them would make directories appear to warm up as a scan progressed.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: Small readability wart: the fixture builds function nodes by calling Node::dir and then overwriting kind to Func, which reads as a directory until the next line corrects it.

### `a_wedge_nothing_has_analysed_reports_no_heat_at_all`
- read at `3404a3b4079b` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A test building an un-analysed Score and asserting its temperature is zero/None rather than the 0.5 UNDECIDED midpoint, probably also that a directory of only-unanalysed children reports no hot share.
- found: Only the directory half: one Func child with a high-surprise proxy score but `analyzed_share = 0.0`, aggregated into a dir, asserting the dir's `analyzed_share` and `hot_share` are both 0.0. No temperature assertion at all; the inline comment explains the frontend keys "render grey" off `analyzed_share`.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The test's name promises a wedge reports "no heat at all" but it only checks the aggregated directory's shares — the function wedge's own temperature, which is what a wedge is coloured by, is never asserted.

### `hot_share_composes_through_nested_directories`
- read at `fe5b38adc106` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Builds a nested tree — an outer dir holding an inner dir holding hot and cold functions — aggregates, and asserts the outer dir's hot share equals what the same functions flat would give, i.e. the share re-derives from hot lines over analysed lines rather than averaging child shares.
- found: Exactly that, in the simplest form: root > src > two 50-line functions at surprise 1.0 and 0.0, root.aggregate(), assert hot_share == 0.5 within 1e-6. Same Node::dir-then-set-kind idiom as its neighbour.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm on this file and its idiom from the previous reading, and the two equal-size children mean the test would also pass under a naive mean of children — the nesting claim in the name is only weakly exercised.

### `aggregation_is_loc_weighted_not_per_function`
- read at `099eacd93857` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Builds a directory holding two function nodes with very different line counts — a short hot one and a long cold one — calls Node::aggregate, and asserts the parent's figure sits near the big function's value rather than the unweighted mean, proving lines are the weights.
- found: Exactly that: a 3-line function at surprise 1.0 beside a 300-line function at 0.0 under a dir, aggregate(), then asserts loc == 303 and the aggregated surprise < 0.05 (per-function averaging would give 0.5). Note the two function nodes are constructed with Node::dir and then mutated to NodeKind::Func.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: No doc comment on the test; the file_doc I was handed describes the module, not this function, so documented is none by the handout.

### `model_authored_text_cannot_cool_a_wedge` — TRAP
- read at `ee79bee061cb` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test asserting documentation attributed to a model contributes nothing — constructing Provenance variants and checking the model-authored one's weight() is 0, or that no such weighted variant exists, so a wedge scored with model-written text has the same temperature as one with no docs.
- found: Two asserts: Provenance::None.weight() == 0.0, and Provenance::Source.weight() < Provenance::Human.weight(). A comment states the guarded failure and that no model-authored Provenance variant exists with weight. Nothing in the body touches model-authored text; the property is enforced by the absence of an enum variant, which the assertions cannot observe.
- predicted: most · documented: none · derivable: no · legible: full · trap: yes
- note: The test is named for the product's central claim but cannot fail on it: adding a Provenance::Model variant with a positive weight tomorrow would leave both assertions green, so the guard is a comment, not a test.

## src-tauri/src/parse.rs

### the file itself
- spec 1 · read at `f66acd21d559` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: parse.rs is Sanity's multi-language function-extraction module: given source text and a Lang, it uses tree-sitter to walk the parse tree and pull out every top-level-ish function/method as a FuncDef (name, signature, body, doc, owner, line range), matching on node *kinds* rather than tree-sitter queries for resilience against grammar drift. It likely centralizes per-language quirks (how each grammar names/shapes a function node) behind a uniform API like parse_functions/extract, plus helpers for associating doc comments and qualifying methods by their enclosing type.
- found: Matches the prediction closely, and goes further: it supports roughly 60 languages via tree_sitter language table (`language`), defines `func_kinds` per language (including languages with no dedicated function node — Elixir/Lisp/OCaml/R — where an extra `accepts` predicate disambiguates), extracts names via `name_node` with heavy per-language special-casing, finds doc comments via `leading_doc`/`wrapper_doc` (stepping over attributes/decorators, excluding inner module docs and licence headers), computes file-level doc headers via `file_doc` (with careful adjacency/import-skipping rules and a cost-justified character cap), and determines method ownership via `owner_of` (including Go's receiver-based special case and a bug-fix around generic type parameters). The back half of the file (roughly lines 900-1600, not fully read) is a large `#[cfg(test)]` module of named regression tests, one per subtle per-language edge case, matching the peer list's plain-English test names.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `loc`
- read at `0e1677eba3db` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A three-line accessor computing line count from the function's own span — end_line - start_line + 1, the inclusive extent that becomes the wedge width, with no blank-line or comment filtering.
- found: Exactly that, with saturating_sub guarding an inverted span.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `language`
- read at `bf7d31809fbd` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: An undocumented exhaustive match over every Lang variant, ~45-60 arms, each returning the grammar crate's LANGUAGE constant via .into(), with dialect-suffixed constants where a crate ships several and no fallback arm.
- found: Exactly that: 64 arms, one per Lang variant, all `tree_sitter_X::LANGUAGE.into()` except the multi-dialect crates (typescript TSX, php, ocaml, fsharp, commonlisp, cfml, glsl/hlsl/slang) and forked crates (kotlin_ng, clojure_orchard, sequel for SQL, qmljs for QML, vb_dotnet).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `func_kinds`
- read at `3a5b17a6cb09` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: One big `match lang` returning a &'static [&'static str] of tree-sitter node kinds per language — function_item for Rust, function_definition/decorated_definition for Python, function_declaration + method_definition + variable_declarator for the JS/TS family, function_declaration/method_declaration for Go and Java, and so on across the ~45 grammars, with several languages sharing an arm.
- found: That match, with about fifty arms and heavy inline commentary. What I did not cover is the class of languages where the kind alone cannot identify a function and the arm is deliberately over-broad, deferring the real test to `accepts`: Elixir returns "call", OCaml "let_binding", R "binary_operator", Clojure "list_lit", Scheme/Racket "list". Also Erlang keys on function_clause so a multi-clause function is one wedge per clause, and Python has no decorated_definition.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc comment argues only the JS-family exclusions; the arms that return an intentionally over-broad kind and lean on `accepts` are explained in inline comments, not in the header a reader is handed first.

### `declarator_is_function`
- read at `520561382090` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Fetches the declarator's value/initialiser child and returns true only if its kind is a function form — arrow_function, function/function_expression, probably generators — false when absent.
- found: Exactly that: child_by_field_name("value").is_some_and over a matches! against arrow_function, function_expression, function, generator_function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `text`
- read at `ec98efc5bd5b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: The one-liner the rest of the file leans on: the source slice for a node's byte range, borrowed from src rather than allocated, most likely node.utf8_text(src.as_bytes()).unwrap_or("") so a bad range yields an empty string instead of a panic.
- found: Exactly that single expression.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: this was my second task in parse.rs, though I had only read func_kinds' 91 lines, not this one.

### `leading_doc`
- read at `928f9d553bf2` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Walk backwards through previous siblings: step over attribute/decorator nodes, accumulate consecutive comment siblings while adjacent (end row exactly one above the next start row, so a blank line stops the walk), reverse, strip comment markers, join with newlines, None if empty.
- found: Exactly that, plus a THIRD rule the handed docs do not mention: an inner doc comment (`//!` or `/*!`) breaks the walk, because module docs would otherwise be handed to whatever function happens to follow — and the blank-line rule cannot catch it, since tree-sitter-rust gives an inner doc comment a trailing newline that closes the apparent gap.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's last paragraph was added because a cold reader missed the decorator rule — and the same thing has now happened again with the inner-doc-comment rule, which the doc still does not mention.

### `wrapper_doc`
- read at `3bb3df0748bc` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Climbs the parent chain while each parent is a wrapper kind (declarator/lexical declaration/export/expression statement), calling leading_doc at each step and returning the first comment found; stops and returns None at any parent that is a real enclosing type or function rather than inheriting its docstring.
- found: Exactly that, with the climb still bounded to three steps: `DOC_WRAPPERS.contains(parent.kind())` is the gate, `leading_doc(parent, src)` the probe, `None` on the first non-wrapper parent or after three hops.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `owner_of` — QUIRKY
- read at `335ae57df339` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: For Go, read the receiver field off the function node, strip a generic parameter list and pointer/whitespace, reduce to the bare type identifier. Otherwise walk up the ancestors to the NEAREST enclosing type-like node, take its name node, return it; None at the file.
- found: The Go half is as predicted (split at '[', then last identifier run). The non-Go half is not: it collects the WHOLE ancestor chain of OWNER_KINDS, not the nearest, truncates to three levels, reverses to outermost-first and joins with '.' — so nested classes give `Boolean.Input`. It also tries the `name` field then falls back to `type` so Rust's `impl Foo` and `impl Trait for Foo` work without a language branch.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment covers only the Go receiver case in detail and says nothing about the multi-level dotted chain, which is the part that would surprise a caller.

### `python_docstring`
- read at `97ab06ebed79` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Given a Python function's body node, walk to the first statement in the block; if it is an expression_statement wrapping a string literal, take its text, strip surrounding quotes and trim, return Some; else None.
- found: Exactly that, plus one thing I missed: it skips leading comment nodes in a loop (comments are named nodes in this grammar, so a shebang occupied slot zero and hid file-level docstrings). Also tolerates a bare `string` node not wrapped in expression_statement.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `strip_comment_markers`
- read at `eaf5f3ec3e46` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Takes a raw comment block and returns its prose — stripping per-line leading markers (///, //!, //, #, ;;, --, leading * inside a block) and /*…*/ or triple-quote delimiters, trimming each line and rejoining with newlines.
- found: A line-wise chain of trim_start_matches for ///, //!, /**, //, /*, '#' and trailing */ then leading '*', trimmed and rejoined, with a final whole-string trim. No handling of lisp ';' or SQL/Haskell '--' comments, which the repo does parse.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: trim_start_matches strips every repetition, so a Markdown heading inside a doc comment ("### Predict first") loses all its hashes and an emphasis marker loses its asterisks — the doc text a reader is handed is silently reformatted, and lisp ';' comments keep their markers entirely.

### `file_doc`
- read at `b0c7037e17bc` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Rust: collect the leading //! inner-doc run. Python: module docstring, skipping shebang/encoding. Everything else: the leading comment run only when a blank line separates it from the next item. Then strip comment markers, join, truncate a long header with a marker, and return None for nothing or a licence banner.
- found: All of that, plus the part I missed: it walks PAST imports/package clauses rather than stopping at the first non-comment child, keeping multiple comment runs with their end rows, and disqualifies only the LAST run when it is adjacent to the first real declaration (Rust exempt, since //! is unambiguous). Runs are joined with blank lines between them. Licence check is over the whole header, not per line, and truncation cuts on a word boundary with an ellipsis.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The handed docs describe the two-rule design but say nothing about the import-skipping walk, which the inline comments call "the whole of what was wrong".

### `parse_functions`
- read at `a53faa73c822` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A thin public entry point: build a tree-sitter Parser for lang via language(), parse src, return an empty Vec on either failure rather than erroring, and otherwise walk from the root via collect/extract matching func_kinds(lang), returning the FuncDefs.
- found: Exactly that: Parser::new, set_language guarded by is_err, parse guarded by let-else, then func_kinds(lang) and a single collect(root, lang, kinds, src, &mut out).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `collect` — QUIRKY
- read at `600851bbefb7` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The recursive tree walk behind parse_functions: cursor over children, and for any child whose kind is in `kinds` (confirmed by accepts/declarator_is_function) call `extract` to build a FuncDef and push it into `out`. Recurses into every child regardless so nested and method-in-impl definitions are found, passing lang and src through.
- found: It tests the node ITSELF rather than its children, and — the part I got backwards — on a successful extract it returns without descending, so a closure defined inside a function is deliberately not a sibling wedge; counting both would double the enclosing function's lines and dilute its score. It only recurses when the node was not accepted or extraction failed. `variable_declarator` is special-cased through declarator_is_function.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The docs handed over are the module's; the one decision that matters here — not descending into an accepted function, so nested closures never become wedges — is only visible in an inline comment.

### `accepts` — QUIRKY
- read at `fe5c77dc9b54` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: Kind check plus an Elixir special case: for `call` nodes, read the head identifier from src and accept only def/defp/defmacro, rejecting defmodule and other macro calls.
- found: Kind check first, then a per-language refinement match — but for EIGHT languages, not just Elixir: Elixir (target is def/defp/defmacro/defmacrop), OCaml (has a `parameter` child, separating `let f x` from `let x = 5`), F#, R and Nix (RHS must be a function), Clojure and Scheme/Racket via lisp_head plus a parenthesised-head check, and Prolog (only rules with a body, not bare facts). Default is true.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc claims "kind alone answers it everywhere except Elixir" but the body carries seven more language exceptions — the doc is out of date with its own function.

### `first_of_kind`
- read at `acfd540f9c99` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A three-line helper iterating the node's direct named children and returning the first whose kind() equals the given string, as an Option, with no recursion into grandchildren.
- found: One line: node.children(&mut node.walk()).find(|c| c.kind() == kind). One level down as documented, but it walks ALL children, not just named ones — anonymous tokens are included, which the doc's word "named" does not describe.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The doc says "first named child" but the body uses children(), not named_children() — in tree-sitter those differ, so a kind matching an anonymous token would be returned.

### `lisp_head`
- read at `b844a821dd9f` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A three-line helper: take the node's first named child (the head of the list) and return its text slice from src, as an Option so a list with no named children yields None. Depth-agnostic — the text of sym_lit and of a bare symbol are the same string — so no per-grammar branching.
- found: Exactly that: Some(text(node.named_child(0)?, src).trim()). The only detail beyond my prediction is the trim, which matters because a wrapper node's text can carry surrounding whitespace.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `name_node`
- spec 1 · read at `675b18990ee4` · commit `e19603b` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: name_node locates the child node that holds a chunk's name, given a tree-sitter node and a Lang. Most languages expose a simple `name` field, but some grammars are shaped differently, so the function has per-language special cases (e.g. name-via-call-target, name-via-declarator-chain) and returns None when no name node can be found.
- found: A large match over ~25 languages, each navigating that grammar's particular shape to reach the name: C/C++ walk a declarator chain (handling reference_declarator and operator_cast specially), Dart falls back from name to signature.name, ObjC/Odin/D/PowerShell/Verilog scan children for a bare identifier or a specific kind, Elixir/Julia/Cmake/Prolog reach into call-like structures, Lisp-family languages index into s-expression children positionally, and the default case falls back to child_by_field_name("name").
- predicted: most · documented: none · derivable: yes · legible: most · trap: no

### `body_node` — QUIRKY
- read at `5068721d7da4` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Given a definition node and language, returns the child holding the body — the `body` field first, then a per-language fallback list of literal kind names (block, statement_block, suite, compound_statement), and None for languages that hang statements off the definition (Julia, Fortran, lisps, Visual Basic) so body_span falls back to header_end.
- found: Three tiers rather than two, and the first one I missed entirely: a pre-match for languages that bind the function one level down (R via `rhs`, Nix via `expression`, Prolog via `term`/`right`, Odin nested `procedure`/`block`, GdShader's `block` field). Then the generic `body` field lookup. Then a per-language kind-name table (Kotlin function_body, Elixir do_block, Haskell match, Ada handled_sequence_of_statements, CMake `body` as a kind not a field, …) searched over children. The default arm is not None but the JS/TS arrow-const case: `value`→`body`.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The catch-all `_` arm silently applies the JavaScript arrow-const shape (`value` then `body`) to every language not named above, so a new Lang variant gets a wrong-shaped lookup that returns None rather than going red the way the module header promises kind matching does.

### `body_span`
- read at `1f2c8fc01706` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Try body_node first and return its (start_byte, end_byte); otherwise fall back to header_end as the start and the definition node's end_byte, returning None when the header boundary is missing or the span would be empty/inverted.
- found: Exactly that, line for line: body_node short-circuits with its byte extent, else header_end(node, lang)? for the start, node.end_byte() for the end, and (start &lt; end).then_some(...) guards the empty/inverted case.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `header_end` — TRAP
- read at `12da39905fc3` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A match on Lang that, for the languages whose statements hang straight off the definition (Julia, Fortran, the lisps, Visual Basic), finds the last present header piece via child_by_field_name — return type, then parameters, then name, plus Elisp's docstring — and returns its end byte, returning None for every language that has a real body node.
- found: That, with a wider language list than I named (Verilog/SystemVerilog via tf_port_list, OCamlLex, Scheme/Racket, Clojure) and two mechanisms rather than one: field lookups for Elisp and Visual Basic, but `first_of_kind` kind-searches for Julia/Fortran/CommonLisp/Verilog/Clojure and bare positional `named_child(1)` for Scheme, Racket and Clojure's fallback.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The doc says "each of these is read off the grammar's own fields rather than by counting children", but Scheme, Racket and Clojure's fallback use `node.named_child(1)` — precisely the positional index the doc warns will silently start the body inside the signature.

### `extract` — QUIRKY
- read at `678349bf1b07` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Given a tree-sitter node matched as a function kind, builds a FuncDef — name via name_node/lisp_head, owner from enclosing impl/class context, body extent via body_span/header_end, signature sliced from the header, start/end lines — returning None when no name node is found.
- found: That, plus a doc-extraction arm I did not predict at all, which is half the body: Python takes the first-statement docstring from the body node, Emacs Lisp takes a `docstring` FIELD and strips quotes, and everything else falls back to `leading_doc` then `wrapper_doc` — the latter walking out through `lexical_declaration` and `export` wrappers so exported arrow-function components are not read as undocumented. Signature is `start_byte..body_start` trimmed. `?` on name_node, body_span and both `src.get` slices is the None path.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: `extract` is the one function that decides what counts as documentation for every language, and it has no doc comment of its own — the per-language reasoning lives in inline comments only.

### `names`
- read at `1bdc565ae5e3` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A test helper that runs parse_functions on src for the given Lang and collects the FuncDefs' names into a Vec&lt;String&gt; so tests can assert against a plain list.
- found: Exactly that: parse_functions(lang, src).into_iter().map(|f| f.name).collect().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `rust_functions_and_doc_comments`
- read at `e5e3f78997a1` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Parses a small inline Rust source with parse_functions containing a ///-documented free function and probably an impl method, then asserts the extracted names and owner match and the doc text lands on the right function with /// markers stripped.
- found: Close, but the second function is not a method — it is an undocumented function containing a closure, and the count assertion carries the real point ("closures must not become their own wedges"). Also asserts the multi-line doc joins with \n and survives an intervening #[inline] attribute, and that the signature is captured without the body. No owner/impl case here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `a_blank_line_severs_a_comment_from_the_function`
- read at `c462c1e4a82b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test parsing a snippet where a comment sits above a function separated by a blank line, asserting the function's doc is None — the attachment walk stops at a blank line so a file header is not adopted as the function's documentation.
- found: Exactly that, in three lines: an SPDX licence header, a blank line, fn thing(), and assert parse_functions(Lang::Rust, src)[0].doc.is_none(), with an inline comment naming the failure it prevents (every file's licence header documenting its first function).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `typescript_arrow_consts_and_methods`
- read at `5b2665e4cff3` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A #[test] parsing a small TypeScript snippet with a const arrow function and a class method, asserting extract/names returns both names — covering the TSX arm of func_kinds.
- found: Exactly that, plus two things I did not cover: a negative assertion that a non-function const (NOT_A_FUNCTION = 42) is NOT extracted, and a second phase asserting parse_functions attaches the JSDoc "The component." to the arrow const.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `rust_module_docs_are_the_file_doc`
- read at `e9c5499ba522` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test feeding a small Rust snippet whose head is a run of `//!` inner doc comments followed by an item with its own `///` doc, asserting that file_doc returns the module comment with the markers stripped and that the item's own doc is not swept into it.
- found: Exactly that, and it also asserts the positive half of the separation: the parsed function still carries "Opens it." as its own doc, so the same sentence cannot land in both fields.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `rust_item_docs_are_not_the_file_doc`
- read at `ed75e12a612b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A test with Rust source whose first item carries a /// doc and no //! anywhere, asserting file_doc(Lang::Rust, src) is None; possibly also that the function itself keeps that doc.
- found: Exactly that, minimal: "/// Opens it.\npub fn open() {}\n" and a single assert_eq that file_doc is None. It does not check the function keeps the doc.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The doc says the run "belongs to that item", but the test only asserts the negative half — that it is not the file doc — never that the item receives it.

### `a_licence_header_is_not_documentation`
- read at `eb9b89053885` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A four-line test: parse a small source file whose top comment is a licence block (SPDX / Copyright / MIT), then assert the file doc is empty — the licence is recognised and dropped rather than becoming the module header. One extract call plus one assertion.
- found: Exactly that, in Go: a two-line Copyright/Apache comment above `func go() {}`, asserting `file_doc(Lang::Go, src) == None`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The test proves the property for one licence phrasing in one language; nothing here shows whether SPDX-only or block-comment licences are caught.

### `a_comment_attached_to_the_first_item_is_not_the_file_doc`
- read at `eae2b6a4731b` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A six-line Go test: a comment run immediately above the first declaration with no blank line, asserting file_doc == None because leading_doc will supply it as the item's own doc; possibly a second assertion that the function's doc does hold the comment.
- found: Two cases rather than one: the attached comment yields None, and a detached pair (header, blank line, item comment) yields only the header — so the test pins the blank line as the discriminator from both sides. My guessed second assertion checked the function's doc; the real one checks the file doc again on different input.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `a_header_below_the_imports_is_still_the_file_doc`
- read at `43073eb52d07` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A test parsing a small TS source where import lines precede a block comment, asserting the extracted file_doc is that comment — proving the header scan skips imports rather than stopping at the first non-comment line, and does not confuse it with the first declaration's doc.
- found: Exactly that: two imports, a detached `/** ... */` run, then a second doc comment touching an `export interface`; asserts file_doc returns the first and not the second, with the message spelling out the rule.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc credits four independent readers for finding the bug from the far end — provenance no body could carry.

### `a_shebang_does_not_hide_a_python_module_docstring`
- read at `29555f714925` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A test parsing Python source starting with a shebang followed by a triple-quoted module docstring, asserting the extracted file doc is the docstring text rather than the shebang line.
- found: Exactly that: a four-line Python snippet (shebang, docstring, a trivial `def go`), asserting file_doc(Lang::Python, src) is Some("Generate the placeholder app icon.").
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `python_module_docstrings_are_the_file_doc`
- read at `838387d02e52` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A four-line test parsing a Python snippet whose first statement is a triple-quoted module docstring, asserting file_doc returns that text stripped of quote markers rather than None or a function docstring.
- found: Exactly that: a one-line source with a triple-quoted banner followed by def go(n), and a single assert that file_doc(Lang::Python, src) is Some(\"The gate module.\").
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Marked warm: I had already read a 67-line span of parse.rs earlier in this run, though nowhere near this test.

### `a_long_header_is_cut_and_says_so`
- read at `86baa925f59f` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A seven-line test parsing a source file whose module header exceeds FILE_DOC_MAX, then asserting the resulting file_doc is shorter than the original and ends with an explicit truncation marker (an ellipsis), proving a cut header advertises the cut.
- found: Exactly that: a 400-word //! header, file_doc bounded to FILE_DOC_MAX + 2 chars, and asserted to end with '…'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `python_docstrings_are_the_doc`
- read at `71b25bfaa267` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Parses a small Python function whose first statement is a triple-quoted docstring and asserts the function's doc field is that text with quotes stripped.
- found: Exactly that: parses `def go(n)` with a `"""Runs the thing."""` docstring, asserts name "go" and doc Some("Runs the thing."). No comparison against a leading # comment.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `go_methods_and_functions`
- read at `6ac5d1f4bc5e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A five-line test parsing a Go snippet with a top-level func and a method with a receiver, asserting both are found, with the method qualified by its receiver type as owner, via a shared names helper.
- found: Parses exactly that snippet and asserts `names(Lang::Go, src) == ["Add", "Load"]`. It checks only bare names — the receiver type `S` is never asserted, so this test would pass with owner attribution entirely broken for Go.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The name says "methods and functions" but only bare names are checked; a sibling test `owners_across_the_languages_that_claim_one` may cover Go receivers, and if it does not, nothing does.

### `a_method_is_qualified_by_the_type_it_hangs_off`
- read at `0e8fb83a87fa` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Parses a snippet with two same-named methods in different impl blocks and asserts each function carries an owner naming its enclosing type while name stays bare, so the twins are distinguishable.
- found: Parses a Rust snippet covering five cases at once and compares the whole owner vector: two `parse` twins in different impls, a trait-impl method owned by the TYPE not the trait, a default method in a trait owned by the trait, and a free function with owner None. It never asserts on `name`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs argue the twins case but the body's real content is the `impl Trait for Type` rule, which the docs never mention.

### `owners_across_the_languages_that_claim_one`
- read at `af858851ba0b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A table-driven test over languages with a receiver or enclosing type (Rust impl, Go receivers, Swift/Python/TypeScript classes), parsing a snippet each and asserting the extracted function's `owner` is the type it hangs off, with free functions reporting None.
- found: Exactly that shape via a small `owner` closure over parse_functions(...)[0]: Python class, Swift struct, TypeScript class, Go pointer receiver (*S normalises to S), plus a case I did not predict — a generic Go receiver `*Parser[T]` must name Parser, not the type parameter T, with a comment recording that the earlier last-identifier-run implementation attributed every generic method to T. Ends with a Rust free function returning None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Despite the name promising breadth, only five of the ~45 supported languages are covered — Rust appears solely as the negative case, so no Rust impl method's owner is asserted anywhere here.

### `a_nested_owner_names_its_whole_path`
- read at `afb27290539a` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A test parsing a ComfyUI-style Python snippet with a class nested in a class and a method inside, asserting owner is the dotted full path (e.g. Boolean.Input) rather than the innermost name.
- found: Exactly that, using two outer classes with identically named inner classes to show the twins stay apart, plus a second case asserting an unnested class yields the bare name.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `unparseable_input_yields_nothing_rather_than_panicking`
- read at `28372eae137c` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test feeding garbage/malformed source into the parser for some language and asserting an empty function list rather than a panic — one parse call plus an is_empty assertion.
- found: Two asserts: parse_functions(Lang::Rust, "fn (((") is empty, and parse_functions(Lang::Go, "") is empty. Covers both malformed and empty input.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Name promises "rather than panicking" but nothing exercises a panic path distinctly; only two languages of the 45 are covered.

### `a_nested_type_does_not_inherit_the_enclosing_docstring`
- read at `bb7f1942fa6f` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A Swift test: a documented outer class holding a nested type with an undocumented init, asserting the nested member's doc is None while a documented member keeps its own comment — proving the doc walk no longer climbs to parents.
- found: Exactly that. Parses a SentenceSuggester class with a doc comment, a nested struct Context with an init, an undocumented method one level down, and a documented next(); asserts init.doc and untouched.doc are None and next() keeps its own text.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_cpp_header_yields_its_methods_not_its_namespace`
- spec 1 · read at `7226e2895307` · commit `0f6160c` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A test that feeds a .h file containing C++ code (namespace, class, methods, fields) through the parser as Cpp and asserts the resulting functions are the real methods, not the namespace or fields, verifying the fix described in the doc comment.
- found: Matches: parses a namespace with a templated struct (with a constructor whose init-list touches a field, an operator overload), two classes with methods, asserts the function name list excludes the namespace and the field, checks owner attribution disambiguates two same-named methods (step/reset) by class not namespace, and checks that one method's span does not run into the next class's method.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `swift_functions_methods_and_inits`
- read at `a0261177f953` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A Swift snippet with a top-level func, a struct holding a method and an init, parsed with the Swift grammar; asserts the names found and that the method and init are owner-qualified by their enclosing type.
- found: The snippet is as expected (plus a static func and an extension method). It asserts the exact name list ["add","greet","init","make","extra"], the doc comment and signature of the top-level func, the method's doc, and that no name contains "extension". It never asserts `owner` on anything.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The test is named for methods and inits but checks only bare names — Swift's `init` is precisely the case where a bare name is not an identity, and nothing here would catch it losing its owner.

### `every_language_finds_its_functions`
- read at `79ed7431da3f` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A 131-line table-driven test: a big array of (Lang, source snippet, expected function names) covering each supported language, looped over, parsing each snippet and asserting the extracted names match exactly — names rather than counts, so a grammar that renames a kind and returns nothing fails loudly rather than reading as a clean file.
- found: Exactly that — 57 cases from C to jq — with one design detail I did not predict: it does not assert per case. It accumulates every mismatch into a `broken` vector and asserts once at the end, with a comment explaining that a per-case assert would stop at the first failure and turn "which grammars are broken" into one bisect per language. Several cases also include a decoy declaration (a `let x = 5`, a `fact(x).`) so that over-matching fails too.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc claims "one case per language" but several languages listed elsewhere in the repo (Rust, Python, Go, TypeScript, Swift) are absent here — they are covered by their own named neighbours instead, so the table is not the census its name suggests.

### `classes_are_not_chunks`
- read at `955da9aa2e4c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A test parsing a small class with a couple of methods and asserting the extracted functions are exactly the methods, with no chunk for the class itself, so its lines are not double counted.
- found: Just that, across two languages: Java `class Big` with two methods yields 2, and Ruby `class C` with one non-empty method yields 1 — with an inline note that an empty Ruby method has no body node and is dropped for having nothing to measure. It asserts counts only, never the names.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Second function I have read in parse.rs, so this one is warm; only counts are asserted, so a parse that returned the class instead of one method would still pass the Ruby half.

## src-tauri/src/reports.rs

### the file itself — STALE
- read at `2d324150ebff` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A small module owning only the machine-local project index: data_dir resolving the OS app-data directory with a test override, index_path for projects.json, load_index deserialising into a struct of KnownProject plus an active key and defaulting on missing/corrupt input, and save_index writing JSON and failing silently. No reading storage.
- found: Exactly that, 97 lines, with more care than I predicted in two places: data_dir's seam is the SANITY_DATA_DIR env var and its doc explains why redirecting HOME/XDG was rejected (Windows dirs::data_dir ignores the environment); and save_index is an atomic write-to-.tmp-then-rename that removes the temp file if the rename fails, with a doc arguing why silence is correct here and wrong in .sanity/.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The file header's first line still promises "the sizes behind the delete button", but the size accounting and the panel it fed are gone — the header's own later paragraph says so, so the summary line contradicts the body it introduces.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `data_dir`
- spec 1 · read at `304076d2f901` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Checks SANITY_DATA_DIR env var first as a test seam, else falls back to dirs::data_dir() joined with an app subdir; returns None if unavailable.
- found: Exactly that: env var override else dirs::data_dir()?.join(\"Sanity\"), then create_dir_all as a side effect before returning Some(dir).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `index_path` — STALE
- read at `a8d96fb9e034` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: data_dir() joined with a fixed filename such as projects.json, propagating None when the data dir cannot be resolved.
- found: Exactly that: Some(data_dir()?.join("projects.json")).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `load_index` — STALE
- read at `f38d3341c38d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads the index file at index_path(), deserializes JSON into KnownProjects, returns default on any failure.
- found: Exactly that: index_path().and_then(read_to_string.ok()).and_then(serde_json::from_str.ok()).unwrap_or_default().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `save_index`
- spec 1 · read at `d5573add5411` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Serialize index to JSON, write to a .tmp file, rename into place atomically, clean up temp file on failure, all silent.
- found: Exactly that: serde_json::to_string_pretty, write to path.with_extension(\"json.tmp\"), rename over path, remove_file(&tmp) only if write succeeded but rename failed. All failure paths silently return via `?`/let-else.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/scan.rs

### the file itself
- read at `0673131f37c7` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The pipeline turning a directory into the scored tree: find the git root and refuse a non-repo; collect files honouring .gitignore/.sanityignore and skipping vendored, minified and oversized ones; parse with tree-sitter in parallel, memoised through a scan cache; build each function's context from its neighbours and file head; score with the proxy, ordinal-key same-named twins, fold into dir/file/function nodes that aggregate; layer git history onto directories; collapse single-child directory chains; emit progress and per-function score events and honour a cancel flag; a Fidelity knob choosing whether the all-pairs term runs; plus tests for ignores, chain collapse, width invariants and the no-git case.
- found: All of that, and three responsibilities I did not name. It owns the user-facing REFUSAL text (repos_inside plus not_a_repo, which names the repositories inside the folder you picked). It runs a per-line git blame pass so churn, age and last author resolve to the FUNCTION rather than its file, deliberately ordered after the parse so it can reuse the parse's content hash and skip files with no functions. And it defines what a whole-FILE reading is taken against — file_surface, the signatures in order, hashed with the module banner rather than the file bytes, so editing one body does not expire a file reading. It also carries the model pass end to end: priority ordering by lines times proxy surprise, a resumable per-function cache, and streamed results.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The one-line module header is accurate but derivable from the code alone, and warns of none of the three things a newcomer most needs here: the non-repo refusal, the blame pass, and what a file-level reading is hashed against.

### `git_root`
- read at `bfbf34880a2f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Runs `git -C path rev-parse --show-toplevel`, trims stdout into a PathBuf, and returns None when the command fails or the path is in no repo.
- found: Exactly that, with three separate refusals: spawn failure via ok()?, non-zero exit status, and an empty trimmed stdout guarded by (!root.is_empty()).then(...).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `repos_inside`
- read at `676bc5135f06` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Read the immediate entries of path; for each directory containing a .git entry, collect its file name; sort and return, empty vec if the directory cannot be read.
- found: Exactly that. It does not test is_dir explicitly — `e.path().join(".git").exists()` is false for a file entry anyway, so the filter subsumes it.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `not_a_repo`
- read at `1262c25954c2` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Builds the refusal string: says the directory is not a git repository, calls repos_inside, and if any are found names them (capped, with "and N more") suggesting one be opened instead; otherwise the bare statement.
- found: Exactly that, capped at three with " and N more", plus a shared `need` paragraph appended in both branches explaining why git is required.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `commit_count`
- read at `ce0d921725c7` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Runs `git rev-list --count HEAD` in the repo, parses stdout as usize, returns 0 on any failure (no repo, no history, unparseable).
- found: Exactly that, as one Option chain: Command git -C repo rev-list --count HEAD, .ok(), filter on status success, parse trimmed stdout, unwrap_or(0).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `collect_files`
- read at `424b1aa9b20c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Build an ignore::WalkBuilder over root with gitignore/hidden filtering, keep regular files whose extension maps to a Lang via Lang::from_extension, skip vendored/minified and unreadable entries, and collect the surviving (path, lang) pairs.
- found: That, with the exact filters spelled out: hidden, git_ignore, git_global, parents, and require_git(false) with a comment explaining that a non-repo tarball's .gitignore still counts. Files are dropped by extension/Lang, by size over MAX_FILE_BYTES, and by any path component (relative to root) appearing in VENDORED. Minification is not checked here — it is a size cap instead, so that must happen at parse time.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Not cold: I had read one other function in scan.rs earlier in this run, though not this one.

### `rel`
- read at `f57e03277bd1` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Strips root from path with strip_prefix, falling back to the full path when it is not underneath, then joins the components with forward slashes (or replaces backslashes) so the string is identical on Windows and Unix, since node ids are built from it.
- found: Exactly that: strip_prefix(root).unwrap_or(path), then components() mapped through to_string_lossy and joined on "/".
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `ephemeral`
- read at `0b24b07d3a89` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A three-line constructor returning a fresh, default-initialised (Cache, ScanCache) pair with no disk path attached, so callers get memoisation that lives only for the process and never loads or writes a cache file.
- found: Exactly that, delegating to each type's own `ephemeral()` constructor rather than `default()`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `scope_of`
- read at `5d62e1de983e` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Nine lines building a gitignore matcher from root/.sanityignore: None if the file is absent (no defaults ever), otherwise a GitignoreBuilder rooted at root, add the file, build, and None on a build error so a malformed file scopes nothing.
- found: Exactly that, line for line. `b.add` returns an optional error that is discarded, so a bad line is skipped while the rest of the file still applies.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The long doc argues the policy well but says nothing about failure behaviour, which is the only thing the nine lines actually decide.

### `context_for`
- read at `b3e478b0470d` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Returns a prompt string of the file's import/header lines plus the full bodies of the two functions nearest in index to `skip`, excluding `skip` itself.
- found: Starts from file.head, computes a window start of skip - max(CONTEXT_SIBLINGS/2, 1), then iterates enumerated funcs from that start, filtering out skip and taking CONTEXT_SIBLINGS of them. Each contributes its signature plus only the first CONTEXT_SIBLING_LINES lines of its body.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The inline comment claims the window is clamped so a function near the BOTTOM still gets a full window from the side that has neighbours, but the code only shifts the start backwards — near the end of a file the iterator simply runs out and the sibling count silently shrinks; I also missed that sibling bodies are truncated to CONTEXT_SIBLING_LINES.

### `parse_file`
- read at `6cc452bc8899` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Read the file, bail to None on unreadable/minified/vendored content, ask the cache with the relative path and (mtime, len) gate — hit takes stored functions and file surface, miss runs the tree-sitter parse and puts it back — recompute fingerprints from the body only above Ordering fidelity, apply scope/.sanityignore to mark exclusion, and return a ParsedFile with path, lang, header doc and functions.
- found: That, structured as a `print` closure returning an empty Vec at Ordering fidelity, an `excluded` flag deliberately recomputed every scan rather than cached because .sanityignore is human-edited, and a three-way match on cache.look: Unreadable returns None, Hit unpacks funcs/file_doc/head/hash, Miss checks MINIFIED_LINE_BYTES and empty-parse (both None), parses functions plus the file_doc banner plus a CONTEXT_HEAD_LINES head in one pass, and puts them in the cache. Returns ParsedFile including `head` and content `hash`, with excluded files still parsed so they can be counted.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The minified check only runs on a cache MISS, so a file that becomes minified but keeps its (mtime, len) gate — or was cached before the check existed — would still be served with its old parse.

### `apply_dir_history`
- read at `59c0254fdc87` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A recursive tree walk that, for Dir and File nodes alike, looks the node's own path up in the History's per-path distinct-commit map and writes it into the node's commits field (which aggregate left at 0), then recurses into children; Function nodes untouched and churn not touched.
- found: Exactly that, in ten lines: kind check for Dir or File, `score.commits = history.commits_of(&node.path)` if a score exists, then recurse over all children unconditionally.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs I was handed open with a paragraph that documents a different function ("Score every function in one directory", i.e. the `score_dir` peer) before the real doc begins — a preceding doc comment appears to have been absorbed into this function's stack, which charges every reader for it and misdirects the prediction.

### `score_dir` — TRAP
- read at `960a0466316a` · commit `9c38c96` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Given all parsed files in one directory, computes file-local distinctiveness by scoring each function against its siblings (with the directory as a wider corpus), produces a Score per function combining heuristic surprise with stability from history/blame age and churn, assembles file Nodes holding function children with LOC aggregated up, and returns them keyed by file path. Fidelity selects a cheaper approximation that preserves ordering.
- found: Broadly that, with three things I did not cover. Per-FUNCTION blame (line-range) history overrides the file-level churn/age/commits/author when blame covers the range, falling back to the file's otherwise. Peers for distinctiveness are same-file fingerprints when the file has more than one, otherwise the directory's with self excluded by std::ptr::eq; at Fidelity::Ordering peers are empty and distinctiveness is UNDECIDED outright. And the `body` field is not the body — it is reading_hash over (file_doc, doc, body) for functions, and for the FILE node reading_hash over the file doc plus file_surface (the signatures in order), so a file reading expires when the surface changes but not when an implementation is rewritten. Documentation is heuristic::documented times Provenance::Source weight, Source never Human.
- predicted: most · documented: none · derivable: no · legible: most · trap: yes
- note: `file.prints[i]` is indexed by the enumerate over `file.funcs` at lines 572 and 580, so it silently assumes prints and funcs are the same length and in the same order — an invariant nothing here enforces, and at Ordering fidelity (where the comment says no fingerprints exist) it is only unreachable because both call sites happen to sit behind a fidelity check; a fourth use added above one of those checks would panic on every scan.

### `ordinals`
- read at `6eedc9651175` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Walks the functions in file order with a HashMap<&str, usize> counter keyed by name, emitting the current count for each and then incrementing, returning a vector parallel to `funcs` giving each same-named function its zero-based ordinal among its twins.
- found: Exactly that: a `seen` map from name to count, `.iter().map(...)` taking the entry, returning the pre-increment value and bumping it, collected into a parallel Vec<usize>.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs' claim that ordinals are shared by both id-minting sites is not checkable from this body, but the body itself is exactly what the docstring promises; the doc's value is the why (durable keys), not the how.

### `file_surface`
- read at `808877986a14` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Joins the file's declarations in file order into one deterministic string — signature or qualified name per function, newline separated — so the scan and resync_changed can both produce identical bytes for a file-level reading's staleness hash.
- found: Exactly that, using `f.signature` alone: map to signature str, collect, join with newlines. No owner qualification, no filtering.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `apply_model_scores`
- read at `3c84d0157f47` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A recursive walk: at a function leaf, look the node up in `upgrades`, and on a hit overwrite score.surprise with the reading's value, mark it as model-sourced/analysed, leave `documented` untouched, then recurse into children.
- found: That, keyed on `node.id`, and it also replaces `node.hotspots` from the reading. Sets source = Source::Model and analyzed_share = 1.0; returns early at any Func node so recursion only descends containers.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The upgrades map is keyed by node id, which embeds @line — fine while it is built from the same scan, but it is the keying the repo's own rules warn against for anything that outlives one scan.

### `insert`
- read at `6b89f111df90` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Split rel_path on '/', walk down from root through each directory component creating a Node::dir with the accumulated path when one is missing, descend, and push node as a child of the final directory. Pure mutation, no scoring.
- found: Exactly that. It iterates parts[..len-1] with saturating_sub so a bare filename walks nothing, accumulates the prefix in `walked` to give each created dir its full relative path, matches an existing child on both name AND NodeKind::Dir (so a file and a directory sharing a name cannot collide), and pushes into the cursor at the end.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `collapse_chains`
- read at `372859bc858a` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Recursively descend; where a Dir node has exactly one child that is itself a Dir, merge the child up — join names with '/', adopt the child's children — and recurse.
- found: Exactly that. Recurses children first (bottom-up), then loops while the node is a Dir with a single Dir child: appends the child's name, takes over the child's id and path, and steals its children.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `scan` — TRAP
- read at `55408598cf2e` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Walk the repo honouring ignore rules, parse supported files in parallel with a scan cache, build the dir/file/func tree, collapse single-child chains, attach git churn/age, then run the model pass consulting the score cache, firing on_scored per function and bailing on cancel while keeping what it has, computing ordinals and file-local context; aggregate and return a Scan with counts and a no-git warning.
- found: All of that, in a clearly staged pipeline, plus details I did not cover: files are grouped by parent directory into a BTreeMap specifically so sibling order in the sunburst is stable between scans; parse and score are deliberately separate passes so the progress denominator never moves; `git blame` runs AFTER the parse over only the files that parsed, keyed on the hash the parse computed, and the scan cache is then `retain`ed to the surviving set so a shrinking repo drops entries; the proxy tree is built and shown first, and the model pass is entered only when `model.is_model()`; the model queue is ordered by proxy intensity alone, explicitly NOT intensity x lines; `on_scored`/`on_progress` fire inside the parallel map rather than after; cached readings are merged with fresh ones before `apply_model_scores`; and `apply_dir_history` is called again after the second `aggregate` because aggregation zeroes directory commit counts.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: Ordering trap, flagged by its own comment: `tree.aggregate()` wipes directory commit counts, so `apply_dir_history` must follow every aggregate — nothing enforces that pairing, and the handed doc describes only `on_progress`.

### `fixture`
- read at `f6944d8e34fb` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A test helper making a TempDir holding a small synthetic repo — a couple of source files with a few functions in nested directories, maybe git init — returned so the caller keeps it alive while scanning.
- found: Exactly that: src/deep/nest/a.rs with a documented `add` and an undocumented `sub` (feeding the doc-grading and chain-collapse tests), plus a .gitignore excluding a vendor/ directory containing a function, so the gitignore test has something to refuse. No git init.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Shared by ~8 tests with no doc saying which detail serves which — the single-child chain, the doc grade and the ignore rule are all load-bearing here, so an edit that looks harmless can move several tests at once.

### `ordering_fidelity_changes_the_score_and_nothing_else`
- read at `4812ee33d4e7` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Scans a fixture twice, at Fidelity::Ordering and Full, then compares both trees for identical structure — ids, paths, lines, LOC — while allowing the surprise numbers to differ, probably asserting the ordering run reports UNDECIDED distinctiveness.
- found: Compares function count, files_scanned, root LOC and the sorted set of function ids between a Full run and an Ordering run, with a guard that the id list is non-empty so the equality is not vacuous. It never checks the scores at all — despite its name, the "changes the score" half is unasserted.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The test's name promises both halves but only the "and nothing else" half is exercised — nothing asserts the Ordering score differs or that distinctiveness reports UNDECIDED, so a fidelity flag that silently did nothing would pass.

### `run`
- read at `5cc740d026dd` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A test helper wrapping `scan` with the boilerplate tests don't care about — default options, no-op progress callback, no cancel flag — unwrapping the Result into a Scan so a test can say run(dir).
- found: Exactly that: builds ephemeral memo caches, calls scan with HeuristicModel, two no-op callbacks (progress and per-reading), a false AtomicBool cancel flag, the memo borrows, and Fidelity::Full, then unwraps.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `gitignored_paths_never_enter_the_picture`
- read at `ae7a09b435fc` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test building a temp repo via the fixture helper with a .gitignore excluding a path, scanning it, and asserting the ignored file's functions are absent from the tree while an unignored one is present.
- found: Exactly that shape: fixture() + run(), collects every node name via s.root.visit, asserts "add" present and "vendored" absent. The gitignore content lives in the shared fixture, so the test itself never shows what was ignored — the name "vendored" is the only clue, and it reads as if it could be testing vendoring rather than gitignore.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The test's claim about .gitignore rests entirely on the shared fixture; nothing in the body ties the missing "vendored" node to gitignoring rather than to the separate VENDORED skip rule, so it could pass for the wrong reason.

### `single_child_directory_chains_collapse_to_one_ring`
- read at `4a6e2aaffd42` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A short test building a fixture repo with a single-child directory chain, scanning it, and asserting the tree holds one collapsed node named with the joined path instead of several nested rings — that collapse_chains fired.
- found: That, using the shared `fixture()`/`run()` helpers rather than building its own tree: one child named "src/deep/nest". It also asserts a second property I did not predict — the ROOT is exempt from collapsing and keeps the repo directory's own name however deep its only chain runs.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The name promises only the collapse; the root-exemption assertion is the more interesting half and is invisible from outside the body.

### `parents_are_exactly_as_wide_as_their_children`
- read at `19946b1cfeb3` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Scans a fixture repo and walks the tree recursively, asserting every node's line count equals the sum of its children's, so no wedge is wider than the code it contains.
- found: Not recursive: it reaches into root.children[0].children[0] by index for the one fixture file, sums that file's function `loc`, and asserts both file.loc and root.loc equal the sum.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: The name claims a tree-wide invariant but the body checks one hardcoded path through a single-file fixture, so a parent whose width diverged anywhere else would pass.

### `documentation_is_graded_not_discounted`
- read at `874cdb525a8d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test over a fixture with a documented and an undocumented function, asserting the doc raises score.documented (it is reported) while surprise/temperature is unaffected — docs graded, never subtracted from the colour.
- found: Exactly that shape: collects func scores by name from the fixture scan, asserts sub.documented == 0.0 and add.documented > 0.0, then assert_eq!(add.temperature(), add.surprise). A long inline comment explains the previous assertion (add <= sub) could not fail, and that the cooling now happens through the instrument so it is deliberately not asserted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `a_repo_without_git_says_so_rather_than_guessing`
- read at `3afe426ce180` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Scans a fixture with no .git, asserts stats.without_history is true, and that age/churn-derived values are None/UNDECIDED rather than a confident default.
- found: Exactly that: fixture() -> run(), asserts s.stats.without_history, then visits every node asserting any Some(score) has age_days == None.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `a_functions_context_is_its_neighbours`
- read at `66b687ed9745` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test building a file of several functions and asserting the context handed to a function late in the file is drawn from its immediate neighbours rather than always the file's opening functions — probably showing two functions get different sibling sets, or that a late one's context holds a nearby name and not the first.
- found: Builds a synthetic ParsedFile of eight functions f0..f7 and checks `context_for(&file, 6)` contains `fn f5`, not `fn f0`, and never itself. It also asserts a case I did not cover: a function at index 0 still gets a FULL window, taken entirely from the side that has neighbours — `context_for(&file, 0)` contains f1 and f2 but not f0.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe the bug the test was written against but not the second property it actually pins — that an edge function's window is filled from one side rather than truncated.

### `an_edit_above_a_function_does_not_change_its_identity`
- read at `fb503dffef06` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A test that writes a small source file into a temp fixture repo, scans it, records the function ids, then rewrites the file with a line prepended above the functions, rescans, and asserts the ids are unchanged while the reported line numbers have moved.
- found: Just that, minus the line-number half: a tempdir, a closure that writes `a.rs`, runs a full `scan` with the heuristic model, ephemeral memos and Fidelity::Ordering, collects sorted Func node ids, then asserts `before == ["a.rs#one", "a.rs#two"]` and that prepending `use std::fmt;` plus a blank line leaves the id list identical.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Nothing in the test asserts the second scan actually saw the edit — no line number or content is checked — so a scan that silently returned cached or stale results for the rewritten file would pass this test named for surviving an edit.

### `same_named_functions_keep_separate_identities`
- read at `42821d37e78b` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A test writing a fixture with two same-named functions (likely two methods in different impl blocks), scanning it, and asserting the two come back with distinct keys — the first plain, the second suffixed with an ordinal like #2 — probably also asserting the identity does not depend on line numbers.
- found: Exactly that fixture — `impl A { fn go }` and `impl B { fn go }` in one a.rs — scanned with the heuristic model and ephemeral memos, collecting every Func node's id, sorting, and asserting they are ["a.rs#go", "a.rs#go#2"]. It checks node ids rather than key_of keys, and nothing in it moves any line, so the ordinal is exercised but the position-versus-line-number claim is not.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docstring's second half — told apart "by position, which the line number was only ever a proxy for" — is not exercised: the test never perturbs line numbers, so it would still pass under a line-based scheme, and a sibling test named an_edit_above_a_function_does_not_change_its_identity looks like where that claim actually lives.

### `scanning_an_empty_directory_is_not_an_error`
- read at `b0c1952516fb` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A six-line test creating an empty temp directory, running scan on it, and asserting it returns Ok with a root holding zero children and zero LOC — an empty repo yields an empty tree rather than an error.
- found: Exactly that, through the local `run` helper on a tempfile::tempdir: asserts stats.functions == 0 and root.loc == 0. The "not an error" claim in the name is carried implicitly by run's unwrapping rather than by any explicit Ok assertion.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/scancache.rs

### the file itself — STALE
- read at `18bc33c0635b` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A machine-local, append-only per-file cache keyed on content hash plus an (mtime, len) gate and validated against git HEAD/ancestry, memoising the two expensive per-file scan phases — tree-sitter parse and git blame — with an ephemeral no-op variant for tests and the headless scanner, an append-on-save log tolerant of a torn final line, and retain dropping files no longer in the scan; uncommitted edits never served from it.
- found: That, plus two things I did not cover: parse and blame invalidate independently (blame additionally keyed on the oid of the last commit touching the file, with ANCIENT as the stand-in beyond the churn window, so revert-and-reapply is caught), and the log compacts on a COMPACT_RATIO threshold with removals forcing a full rewrite-via-temp-and-rename since an append cannot express a deletion.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ephemeral` — STALE
- read at `90b7706ce367` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns a ScanCache with no backing path (path: None) and empty in-memory maps, so lookups and puts work but save becomes a no-op.
- found: Exactly that: constructs ScanCache { path: None, inner: Mutex::new(Stored { version: FORMAT_VERSION, ..Default::default() }), dirty: Mutex::new(Dirty::default()), head: String::new() }.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `open`
- spec 1 · read at `457d936d5d4e` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Loads cache file for repo path, checks format version tag, on mismatch returns fresh cache; checks if cached HEAD is ancestor of current HEAD, and if not (rewritten history) clears blame entries but keeps parse entries.
- found: Computes path via path_for, reads and parses stored log via read_log, filters on both FORMAT_VERSION and PARSE_VERSION matching (drops everything on either mismatch), falls back to an empty Stored struct with current head if missing/mismatched. Then if stored.head is non-empty, differs from current head, and is not an ancestor of it, clears blame (not parse) from every entry. Constructs ScanCache with path, inner mutex, a Dirty tracker (keys/lines/rewrite) and head.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `path_for`
- spec 1 · read at `4e72bf5bc4c5` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md in context
- expected: Hashes the repo path and joins it with a data/cache directory (creating it if needed) to produce a per-repo cache file path, mirroring the pattern seen in history.rs's cache_path.
- found: Exactly that: joins data_dir()/scans, creates the dir, hashes the repo path with fnv(), and returns dir/{id:016x}.json.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `look`
- spec 1 · read at `a133d745ecac` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Checks a cheap metadata gate (mtime/size) first to avoid reading the file; falls back to reading and hashing content if the gate misses; compares last_commit against cached blame_commit to decide whether cached blame is still usable; returns Hit, a stale-triggering Miss, or Unreadable.
- found: Two-stage check: fast path compares mtime+len against cache entry for a Hit without reading the file; if that misses, reads and FNV-hashes the file content, and if the hash still matches the cached entry (byte-identical despite metadata change) it's still a Hit with restamped ident; otherwise returns Look::Miss with the read source. Blame is only reused from cache if e.blame_commit equals the wanted last_commit.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `cached_blame` — STALE
- read at `00de5774b33e` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Locks the inner store, looks up the entry for rel_path, and returns a clone of its FileBlame only if both the stored content hash matches and the stored commit matches last_commit; any mismatch or a None commit yields None.
- found: That, with two details I missed: a None last_commit is not a miss but is normalised to an ANCIENT sentinel string that a stored entry can equal, and a poisoned mutex is turned into a cache miss via lock().ok()? rather than propagating. e.blame is itself an Option, so the clone is the return value directly.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: Second reading from this file, so not cold; the ANCIENT sentinel is the one thing the docs' "both conditions, not either" does not hint at.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `put_parse` — STALE
- read at `839019ec137d` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Takes &amp;self so the map is behind a lock; builds an entry for rel_path holding the Ident (mtime/len/hash), lang, cloned funcs, file_doc and head sha, inserts it while carrying over any blame already stored for that path, and marks the cache touched so save writes it.
- found: Exactly that, with one guard I did not state: blame is carried across only when the previous entry's hash equals the new ident's hash, otherwise dropped along with blame_commit. A poisoned lock is a silent no-op return. Ends by dropping the guard and calling self.touched(rel_path).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `put_blame` — STALE
- read at `f3e9acc8c244` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: Locks the map, finds the existing parse entry for rel_path, returns silently if absent (orphan drop), otherwise stores the blame with the last_commit it belongs to and marks the entry dirty for save.
- found: Exactly that. Two details I did not name: a poisoned lock is swallowed with a bare return, and a missing last_commit is stored as the ANCIENT sentinel rather than an Option. Dirty-marking is delegated to self.touched, called after the lock is explicitly dropped.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: `touched` is called unconditionally, including when the entry was absent and nothing was stored — harmless if touched only marks dirty, but it says "changed" about a write that did not happen.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `retain`
- spec 1 · read at `cdbd9ca0ab63` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Removes cache entries whose key is not present in `live`, pruning deleted files; sets a dirty/rewrite flag so the pruned state is persisted on next save since removals can't be appended incrementally.
- found: Locks inner, retains entries whose key is in `live`, checks if count changed; if entries were dropped, sets dirty.rewrite = true because the append-only log format can't represent a removal, only next-full-rewrite.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `touched`
- spec 1 · read at `24669c45b5dd` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Locks dirty state, inserts key into dirty.keys, and if accumulated count crosses a threshold, triggers a save/flush of pending entries to the log file.
- found: Locks dirty mutex, inserts key.to_string() into d.keys, checks if len >= FLUSH_EVERY threshold; if so calls self.save() after releasing the lock.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `save`
- spec 1 · read at `8f02cea7e101` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md in context
- expected: Writes dirty/changed entries to the cache file, appending by default; if the accumulated log has grown too large relative to the underlying data (or some threshold), rewrites/compacts the whole file instead. Failures are swallowed silently rather than propagated.
- found: Locks inner state and dirty tracker; if the log is stale (too many appended lines relative to entry count) or a rewrite/full flush is needed, writes the whole file via temp+rename for crash safety. Otherwise appends only the changed entries' lines to the log file, using create+append (so a deleted cache file is recreated). All failure paths just return without propagating errors.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Comments explain two subtle failure-mode fixes: temp+rename for the rewrite path, and create+append to survive a deleted cache file.

### `header_line` — STALE
- read at `85ad8f37c7cd` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Serializes the cache header as one JSON line — a version/format tag plus the git HEAD the cache was built at — via serde_json on a small struct or inline json!, returning the string without a trailing newline.
- found: Exactly that shape: serde_json::to_string of json!({version, head}), unwrap_or_default, but it DOES append "\n" — the newline is part of the line, not the caller's job.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: unwrap_or_default on a header that cannot realistically fail would silently emit a bare "\n" line, which a strict reader would treat as a corrupt header rather than an error.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `entry_line` — TRAP — STALE
- read at `9d2fe761f516` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A three-line formatter producing the single serialized cache-file line for one entry — the key joined with the entry's fields by a separator, the write-side inverse of the loader's line parser, beside header_line.
- found: That, in JSON-lines form: serialises {"k": key, "e": entry} with serde_json and appends a newline, falling back to an empty string if serialisation fails.
- predicted: full · documented: none · derivable: yes · legible: full · trap: yes
- note: unwrap_or_default on a failed serialisation emits a bare newline — a blank line silently written into the cache file rather than an error or a skipped entry.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `read_log`
- spec 1 · read at `92b851d4998a` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Parses the append-only log line by line using header_line/entry_line helpers: first line is header (version/head), rest are entries; a malformed trailing partial line is silently dropped; returns Stored plus count of lines consumed.
- found: Iterates text.lines(); skips empty lines; tries to parse each as JSON Value, skipping (continue) on failure — this is what silently drops a truncated trailing line. First non-empty line is treated as header, extracting version/parse/head with defaults of 0/empty on missing fields. Subsequent lines need 'k' and 'e' fields; 'e' is deserialized into an Entry and inserted into entries map keyed by k. Returns (Stored, count of successfully-consumed lines).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `git_head` — STALE
- read at `4a4644ea6ace` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Runs `git -C <repo> rev-parse HEAD`, trims stdout to the sha and returns it, returning an empty string when git fails or there are no commits.
- found: Exactly that, written as an Option chain: output().ok(), filter on status.success(), from_utf8_lossy().trim(), unwrap_or_default().
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_ancestor` — STALE
- read at `837a5ac98b87` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Shells out to `git merge-base --is-ancestor <old> HEAD` in repo and returns whether it exited 0, with false on any failure (git missing, unknown sha), so a rewritten or unreadable history falls back rather than trusting the cache.
- found: Exactly that: Command::new("git") with -C repo, args merge-base --is-ancestor old HEAD, .output(), maps to status.success(), unwrap_or(false).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `fnv` — STALE
- read at `a732a69dd153` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: An FNV-1a-shaped 64-bit hash: offset-basis start, per byte XOR then wrapping_mul by a deliberately non-FNV multiplier, returning the accumulator; used as a content key.
- found: Exactly that: h starts at 0xcbf29ce484222325, each byte XORed in then h.wrapping_mul(0x100000001b3) — note the constant as written is 0x1000_0000_01b3, which is 0x100000001b3 only if the underscores group differently; it is in fact 0x100000001b3 shifted, i.e. not FNV-1a's 0x00000100000001B3.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc correctly warns the multiplier is not FNV-1a's prime (0x1000_0000_01b3 = 2^44+435 rather than 2^40+435); it is still an odd multiplier so the mixing is fine, but nobody should assume interop with real FNV.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `func` — STALE
- read at `55a052aed517` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A test helper building a minimal FuncDef from a name, everything else stubbed — dummy line range, no docs, no owner, placeholder body — so cache tests can assert identity without a real parse.
- found: Exactly that: name, a derived `fn {name}()` signature, body "{ 1 }", doc and owner None, start_line and end_line both 1.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `seeded` — STALE
- read at `1614c8d369f9` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: Test helper writing `body` to dir/a.rs, opening a ScanCache there and storing a parse entry for "a.rs" via the `func` helper keyed on content hash/mtime, returning cache and path for an immediate hit.
- found: Exactly that, with two specifics: the cache is `ephemeral()` (no file store), and the identity is obtained by first calling `look`, asserting a Miss, and reusing the returned `ident` — so the helper also asserts that an empty cache misses. The stored func is always named "one" regardless of `body`.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The stored parse is hardcoded to a single func named "one" and never derived from `body`, so a caller passing different source gets a parse that does not describe it.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `an_untouched_file_is_taken_from_the_cache`
- spec 1 · read at `975b7e067eab` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Unit test verifying that when a file is unchanged since the last scan, ScanCache serves the cached entry rather than reparsing it.
- found: Seeds a cache with a file containing `fn one() {}`, calls `cache.look` on the same unchanged file, and asserts it returns a `Look::Hit` with the cached function name `one`.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `an_uncommitted_edit_is_never_served_from_the_cache` — STALE
- read at `1dca0e248834` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Seeds a cache with a.rs, rewrites the file with different bytes, asserts look returns Look::Miss because the content hash no longer matches, so a stale parse with wrong line numbers is never served.
- found: Exactly that: seeded with "fn one() {}", overwritten with a second function appended, asserts Look::Miss with the message that an edited file must miss even though nothing was committed.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `identical_bytes_with_a_new_mtime_still_hit` — STALE
- read at `b936c0c2e2f2` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A test seeding a cache with a file, then rewriting the same bytes so the (mtime, len) gate moves, and asserting the lookup still hits because entries are keyed on the content hash rather than the gate.
- found: Exactly that: seeds with "fn one() {}", writes a longer body, sleeps 20ms so the mtime genuinely differs rather than by clock luck, writes the original bytes back, then asserts cache.look returns Look::Hit whose first function is still `one`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_reverted_and_reapplied_file_keeps_its_parse_and_loses_its_blame`
- spec 1 · read at `c989d299b24b` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Seeds cache for a file, simulates revert-and-reapply (same content hash, different last-touching commit), asserts parse still hits cache while blame lookup misses.
- found: Seeds cache, puts blame under commit \"aaa\", then calls cache.look(\"a.rs\", path, Some(\"bbb\")) and gets Look::Hit with funcs[0].name==\"one\" (parse survived) but h.blame.is_none() (blame dropped due to commit mismatch); also directly checks cached_blame(...) returns None.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `on_disk`
- spec 1 · read at `78dc5ad1cdbc` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Test helper that opens a real on-disk ScanCache for repo, seeds entries for each (path, content) pair, saves it, and returns the populated cache.
- found: Opens a real ScanCache::open(repo), then for each (name, body): writes body to disk at repo/name, calls cache.look() and asserts it returns Miss (panicking otherwise), then calls cache.put_parse with a fabricated single-function result (func(\"one\")), Lang::Rust, and \"head\" as the commit; finally calls cache.save() and returns the cache.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `saving_appends_rather_than_rewriting_the_whole_store`
- spec 1 · read at `d0d08ebb4878` · commit `29c6e80` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Uses on_disk helper with several files, calls save() multiple times, reads the log file's line count, asserts one header + one line per file regardless of save() call count — proving appends not full rewrites.
- found: Builds a cache via on_disk with one file, then for three more files individually: writes it, confirms a Miss via look(), put_parse's it, and calls save() after each. Reads the log file and asserts exactly 5 lines (header + 4 files) despite 4 save() calls; also reopens the cache and checks entries.len() == 4.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `a_torn_last_line_costs_only_its_own_entry` — STALE
- read at `d4ffeccd42e8` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A test writing a store with several entries, truncating it mid-last-line to simulate an interrupted append, reloading, and asserting the earlier entries still load while only the torn one is lost — the loader skips the unparseable trailing line rather than discarding the cache.
- found: That, with the tear appended rather than produced by truncation: it builds an on-disk cache for two files, appends a half-written JSON entry for a third ("c.rs") to the end, reopens, and asserts entries.len() == 2. It reaches through `back.inner.lock()` to count entries rather than going through a public accessor.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `a_dropped_file_does_not_come_back_on_the_next_open` — STALE
- read at `1c0af72f8f0e` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: A test building a cache with two files, saving, calling retain to keep only one, saving again, reloading from disk and asserting the dropped file is absent — proving the save rewrote rather than appended.
- found: Exactly that, using an isolated data_home and a tempdir repo: on_disk seeds a.rs and b.rs, retain({a.rs}), save, ScanCache::open, then assert a.rs present and b.rs absent with the message "a dropped file came back from the log".
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm: I had already read fnv in this file, though not this test or its helpers.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `files_no_longer_in_the_scan_are_dropped` — STALE
- read at `f550612d1cb2` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Seeds a cache with entries, calls retain with a set containing only some paths, asserts the omitted entry is gone and the kept one survives.
- found: Seeds one file in a tempdir, calls retain with an EMPTY set, then asserts look() returns Look::Miss. No kept-entry half — it only checks the drop.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Retaining an empty set can't distinguish "retain drops the right entries" from "retain drops everything" — a two-file case would be a stronger test of the same name.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## src-tauri/src/surprise.rs

### the file itself — STALE
- read at `c484be1f8322` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The seam every scorer plugs into: a SurpriseModel trait (label, surprise, min_lines, is_model), the shipped HeuristicModel that just forwards the precomputed proxy, a Reading return type, calibrate_surprisal mapping raw surprisal onto the 0..1 scale, and two tests. Plus the long prose record of the removed Ollama forced-decoding path, kept so nobody rebuilds it.
- found: That, and one whole piece I did not predict: `Item<'a>`, the input side of the contract — name, signature, body, peers, lines, doc, context — where most of the file's argument actually lives, each field documented with the measured failure that put it there (starved context made everything read uniformly hot; docs entering through the prompt rather than as a lexical discount is what makes stale docs read hot). Reading also carries `Hotspot` evidence, contrastive positions from forced decoding, which survives the scorer that produced it. calibrate_surprisal and its test are both behind `local-model` rather than compiled always.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The header is excellent on the metric and the dead model path but never mentions `Item` or `Hotspot`, which are half the file — a reader looking for where the prompt's inputs are defined gets no signal from the top.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `min_lines` — STALE
- read at `55c143fc4803` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A trait method on SurpriseModel with a default body returning 0 — the shipped heuristic proxy is cheap and has no floor, so only implementations that do real (expensive) work override it with a real minimum line count.
- found: Exactly that: a three-line default returning 0.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `is_model` — STALE
- read at `c799ad73b4ba` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A default trait method on SurpriseModel returning false; real model impls would override to true.
- found: Exactly: `fn is_model(&self) -> bool { false }` as the trait default.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: With OllamaModel removed there is no impl that returns true, so this default is currently the only answer anywhere.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `label` — STALE
- read at `6f06fc4aadb0` · commit `16b3bba` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns a short human-readable name for this scorer, likely "heuristic" or "offline proxy" — a constant String, no state read.
- found: Returns the constant string "heuristic (no model)".
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `surprise` — STALE
- read at `69dd61440061` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: HeuristicModel's impl of SurpriseModel::surprise: ignores the item and passes the offline proxy through unchanged as Reading::plain(proxy).
- found: Exactly that, one line.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `plain` — STALE
- read at `15124e0816be` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A constructor building a Reading from a bare surprise value, filling the remaining fields with neutral/empty defaults so nothing beyond the number is claimed.
- found: Exactly that, and Reading turns out to have only two fields: the surprise and an empty hotspots Vec.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `calibrate_surprisal` — STALE
- read at `ca7dd03508a0` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Maps bits/token onto 0..1 by normalizing against a fixed band — ((bits - LOW) / (HIGH - LOW)).clamp(0,1), LOW near half a bit, HIGH a few bits, possibly a mild exponent. Linear ramp with saturation at both ends.
- found: Exactly that: PREDICTABLE = 0.5, UNEXPECTED = 4.0, ((bits - 0.5) / 3.5).clamp(0.0, 1.0). No exponent.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `predictable_code_is_cold_and_unexpected_code_is_hot` — QUIRKY — STALE
- read at `83bac721afab` · commit `16b3bba` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A five-line test scoring a boilerplate body and a dense one and asserting the first is colder than the second.
- found: It touches no code at all: three assertions on calibrate_surprisal alone — clamping at 0.0 below the band, 1.0 above it, and monotonicity between. It tests the clamp curve, not the claim in its name.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The test named for the product's central claim never scores any code — it only checks that a scalar rescaling function clamps and is monotonic, which would pass unchanged if the surprise metric were entirely broken.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `the_heuristic_model_passes_the_proxy_through_untouched`
- spec 1 · read at `bdff3ae1eb67` · commit `0f6160c` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md in context
- expected: Test asserting HeuristicModel::surprise returns the same score as the raw proxy metric computed directly, with no extra transformation.
- found: Builds a trivial Item and asserts HeuristicModel.surprise(&item, 0.73).surprise == 0.73 — the proxy score is passed in as an explicit argument (not computed internally by this call), confirming the model just echoes it back unchanged.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/watch.rs

### the file itself
- read at `3bc87fd9322e` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A cheap polling change-detector rather than a filesystem watcher. `stamp` fingerprints a file by mtime and length, `hash` folds it, and `probe` walks the repo to say whether it moved, so the app can re-scan and stop showing stale blame. The three tests pin the boundaries: an ordinary edit moves it, a write into `.sanity/` deliberately does not, and a commit moves it though no working-tree file changed — only possible if git state is in the stamp.
- found: Exactly that. FNV-1a over each in-scope file's path, mtime (nanoseconds) and length, walked with `ignore::WalkBuilder` configured to mirror the scan's own settings so the probe cannot disagree with the scan about what counts, with `.sanity/` filtered out because the app writes it on every reading. The one structural detail I got wrong: `probe` does not compare anything — it returns a `Marks { tree, git }` with git's HEAD and index hashed into a SEPARATE field, and the comparison lives in the caller. The header also argues the negative case at length: why `notify` loses on a 1.5s-granular delivery path, on filter duplication, and on platform-specific watch semantics.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: `a_commit_moves_the_marks_without_touching_a_file` does not test a commit — it rewrites `.git/HEAD` to point at another branch, which is a checkout; an actual commit on the current branch leaves HEAD byte-identical and moves `refs/heads/<branch>`, which this stamps nothing of, so the property the file's own header opens with ("you committed, and Blame went on reporting Not Committed Yet") is carried in practice only by `.git/index` and is not what the test exercises. (`legible`/`trap` are placeholders — the ask said to leave them unset but the schema requires them.)

### `hash`
- read at `ab046fa6235f` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Standard FNV-1a over bytes, seeded with the caller-supplied accumulator h so it chains across many inputs: XOR each byte into h, then wrapping-multiply by the 64-bit FNV prime 0x100000001b3, and return.
- found: Exactly that, byte for byte, with the prime written as 0x0000_0100_0000_01b3.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm on the file (my second function from watch.rs), though the algorithm was named outright in the docs anyway; the docs' interesting claim — that this twin is free to use the real constant because it stores nothing durable — is not derivable from the body.

### `stamp`
- read at `37e54f4bc220` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A fold step for the stat probe's rolling hash: take the running hash h and one file's Metadata, mix in its mtime and probably its length with a cheap primitive from the `hash` peer, and return the new hash, so a repo whose files kept their mtime and size produces the same stamp.
- found: Exactly that: length folded in first, then the modification time as nanoseconds since the epoch, both little-endian, through the `hash` peer. An unreadable or pre-epoch mtime contributes 0 rather than failing.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The local is called `secs` but holds nanoseconds, which is the one thing that needed a second look in an otherwise transparent function.

### `probe`
- read at `d105b40f71a7` · commit `9c38c96` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Walks the repo with the scan's own settings (skipping .sanity/), stats each file for mtime and length, folds them into a cheap hash, and also stamps git HEAD/index so a commit moves the marks without a file changing. Returns a Marks comparable against a later probe.
- found: Exactly that: an ignore::WalkBuilder honouring hidden/gitignore/global/parents with a filter_entry dropping `.sanity`, hashing each file's path bytes and then `stamp`ing its metadata into a rolling `tree` hash; separately stamps .git/HEAD and .git/index into a `git` hash. Returns Marks { tree, git }. Metadata errors are skipped silently, and walk order is deliberately not sorted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs say it mirrors `scan::collect_files` but the walk settings are written out a second time here, so the two can drift with nothing failing.

### `an_edit_moves_the_marks_and_an_untouched_repo_does_not`
- read at `ed16a8152686` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A unit test building a temp directory with a source file, probing twice with nothing touched and asserting the marks are equal, then editing the file and asserting the mark changes — the pair of assertions the name promises.
- found: That, plus a third case: after the edit it re-probes and adds a second file, asserting `tree` moves for a new file as well. Note the stability assertion compares the whole probe value while both change assertions compare only the `.tree` field.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Both edits also change the file's byte length, so the test would still pass if the probe hashed only mtime and length and never the content — a same-length edit is the case it does not cover.

### `writing_the_assessment_is_not_a_change_to_the_repo`
- read at `f6a514b2c896` · commit `6366346` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test: build a temp repo, take a baseline probe, write a file inside `.sanity/`, probe again, and assert the mark is unchanged — proving `.sanity/` is excluded from the change probe so the app cannot fire on its own writes.
- found: Exactly that: tempdir with one `a.rs`, `probe()` baseline, then creates `.sanity/README.md` and asserts `before == probe(...)` with the message "our own record is not the code".
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `a_commit_moves_the_marks_without_touching_a_file`
- read at `657fd2f8a7b0` · commit `6366346` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A test making a temp git repo, taking a stamp of it, then creating a commit that alters no working-tree file, asserting the stamp differs afterwards because HEAD moved even though no mtime or length did.
- found: The property, with no real git involved: it hand-builds a .git directory containing only a HEAD file plus one source file, probes, then rewrites .git/HEAD to point at a different branch and probes again. The probe result has two separate fields, and the test asserts before.tree == after.tree while before.git != after.git — so the split between "the working tree moved" and "the repo moved" is the thing being pinned, not a single fingerprint.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The name and doc both say "a commit", but what the body actually performs is a branch switch by rewriting .git/HEAD — the same observable to the probe, yet the test does not exercise a commit.
