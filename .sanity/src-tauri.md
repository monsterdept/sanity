# src-tauri — sanity assessment

37 of 417 functions read · 1 surprising

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## src-tauri/build.rs

### `main` — as expected
- read at `4b8ff0908edc` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The Tauri build script: a three-line fn main() that just calls tauri_build::build(), generating context, config and platform resources at compile time. No arguments, no error handling.
- found: Exactly that — a single call to tauri_build::build().
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/agentapi.rs

### `grades` — as expected
- read at `3e2a55e7efcf` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Returns (surprise grade, documentation grade). The first comes from `predicted` when present, else is synthesised from the legacy `surprised` boolean mapped to the ends of the scale (surprised -> none, not surprised -> full). The second is `documented` if given, None otherwise — and when `derivable` is true it is overridden to the no-coverage value regardless of what the reader said, because a doc a model could regenerate explains nothing.
- found: Exactly that: predicted.unwrap_or(if surprised { Grade::None } else { Grade::Full }), and derivable yields Some(Grade::None) in place of self.documented. The override is applied at the point of use so no caller can forget it.
- predicted: full · documented: full · derivable: no · legible: full · trap: yes
- note: The derivable override silently rewrites a reader's reported grade, so any code path that reads `report.documented` directly instead of calling `grades()` gets a different answer from the same record — the rule is only enforced here.

### `scan_note` — nearly
- read at `4081998efd3b` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns None when ms is under a threshold of a couple of seconds so fast opens carry no note. Above it, returns a sentence naming the elapsed time and explaining the cost: a first open parses and blames every file, a reopen only pays for what changed, so the next open is quicker.
- found: Threshold is a local const SLOW_MS = 5000; under it returns None. Otherwise formats a sentence with ms/1000 seconds, says the parse and blame are cached per machine so later opens cost only what changed, appends a parenthetical when `reopened` noting the cache was already in use, and closes by telling the reader this is not a hang and that retrying restarts the work.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The `reopened` branch only changes a parenthetical aside, not the substance of the advice, which I did not anticipate — I expected it to select between two different explanations.

### `spread_across_files` — nearly
- read at `b16a290469ea` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Partitions the ranked tasks by whether their file appears in `recent` newer than a cooldown measured against `now`, rested files first and warm ones after with score order preserved inside each group, then takes the first n of the concatenation so warm files are reached only when the rested pool runs dry.
- found: Partition on FILE_REST as predicted, but the fallback is either/or rather than a concatenation: if any rested task exists the recently-drawn ones are discarded for this call entirely, and only when the rested list is empty is the whole warm list used. The take-n and the within-handout spreading are both delegated to interleave_by_file.
- predicted: most · documented: most · derivable: no · legible: some · trap: yes
- note: The two bindings are named against the doc's own vocabulary — `fresh` holds the RESTED files the doc says to prefer and `resting` holds the ones just drawn from — and because the choice is either/or rather than a concatenation, a request for n can come back short whenever fewer than n rested tasks exist, silently, with work still on the table.

### `read_endpoint` — as expected
- read at `12950823ef6a` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Read the file named by endpoint_file() and deserialise its JSON into an Endpoint (port, pid), returning None on any failure — missing file, unreadable, or malformed — without probing whether the process is alive.
- found: Exactly that, written as a chain of `?`/`.ok()?`: read_to_string on endpoint_file(), parse to serde_json::Value (not a derived Deserialize), then hand-pluck `port` and `pid` as u64 and narrow them with u16/u32::try_from, so an out-of-range or missing field yields None rather than an error.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Untyped Value plucking rather than a Deserialize impl, which is what makes the writer and this reader able to drift despite the doc's 'one reader, because two would drift'.

## src-tauri/src/assessment.rs

### `save` — nearly
- read at `e16413963bf4` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Writes the .sanity/ store: creates the directory under repo, iterates the LIVE functions from scan rather than the reports map, looks up each reading by key_of(path, name, ord), compares the stored hash against the current doc+body for staleness, groups entries into shards, renders each shard's Markdown plus a README.md index through a shared compile so the two cannot disagree, and propagates io errors rather than absorbing them.
- found: Structurally as predicted, but thinner than I expected: the iteration, keying and staleness arithmetic are all delegated to `compile` (shared with refresh_index), and save is just create_dir_all, write one file per compiled shard collecting index rows, then write README.md — all with `?`. The part I did not predict at all is a garbage-collection pass: it re-reads the directory and deletes any *.md that is not README.md and not in the freshly compiled shard list, so a shard that lost its last reading cannot leave a file claiming coverage.
- predicted: most · documented: none · derivable: no · legible: full · trap: yes
- note: The sweep deletes every .md in .sanity/ that is not README.md and not a current shard — so any human-written note dropped in that directory is silently removed on the next report, and since the deletes run BEFORE the README write, an error there leaves shards on disk with a stale index; CLAUDE.md's own rule is that a destructive step must not be gated on an Ok, and here it is gated on nothing at all (the remove_file result is discarded).

### `git` — nearly
- read at `ce1c2ecff671` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A helper that shells out to `git` with the given args using `repo` as the working directory, returning Some(trimmed stdout) on success and None on failure or non-zero exit; used by head/who for provenance.
- found: Exactly that: `git -C <repo> <args>`, `.ok()?` on spawn failure, None on non-zero status, trimmed lossy-UTF8 stdout, plus one extra step I did not name — empty output is also folded to None via `(!s.is_empty()).then_some(s)`.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/bin/history.rs

### `main` — nearly
- read at `35f53878b1e3` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The `just history <repo>` headless entry point: parse argv for a repo path plus flags (--files, cache, commit cap), run the replay uncached by default so the run exercises the real walk, time it, print commits/frames/functions at HEAD and elapsed, and under --files print a per-file breakdown of the final frame for reconciliation against `just scan`.
- found: All of that, with the flags being --limit N, --files, --json, --cached and a --help usage line; positional args fall through to `path` (last one wins). Two things I did not predict: a --json mode that dumps the exact serialised payload the webview receives, so the frontend replay can be diffed against this one without a window; and it does not trust any stored total — it replays the set/del deltas over `hist.base` itself to compute functions alive at HEAD, total lines and PEAK live count. It also always prints the eight busiest commits by set+del size at the end.
- predicted: most · documented: none · derivable: no · legible: full · trap: yes
- note: Any unrecognised argument becomes the path rather than an error, so a typo'd flag (`--fils`) silently scans a nonexistent directory instead of failing, and a second positional quietly replaces the first.

## src-tauri/src/bin/sample.rs

### `main` — surprising
- read at `9e9106b273c1` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A dev CLI entry point: parse argv for a repo path and maybe a count/seed, scan the repo, pick a random or stratified sample of functions from the tree, and print them (path, name, line, proxy score) to stdout for eyeballing the metric; usage/exit when no path.
- found: Takes repo, output DIRECTORY and count (defaults ".", "sample", 10). Scans with HeuristicModel using ephemeral memos and Fidelity::Ordering (both choices commented: no cached answers, and skip the all-pairs term whose scores this tool never prints). Builds agentapi::all_tasks, then takes an evenly-strided sample rather than random, and for each writes a PAIR of files into the output dir: NN_head.md holding exactly the handout a reader gets (name, owner, file, lines, signature, docs, peers with the omitted count) and NN_body.txt holding the source sliced live from disk at line..end_line. Prints a count and explains the file pair. Silently skips tasks whose file is unreadable or whose line bounds no longer fit.
- predicted: some · documented: none · derivable: no · legible: full · trap: yes
- note: `written` is incremented only for tasks that survive the two `continue` guards, so a run that skips drifted functions silently produces fewer than `want` exercises with no warning — and the second positional arg being an output directory (not a count) is easy to get wrong from the command line.

## src-tauri/src/bin/scan.rs

### `section` — nearly
- read at `194d05adc8c6` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Sort the funcs slice in place by rank descending (hence &mut), print the title as a header, then a fixed number of top rows — score, truncated name, path, line, maybe LOC — returning nothing.
- found: That, with the details: partial_cmp with Equal as the NaN fallback, top 15, and a filter dropping zero-ranked entries applied AFTER take(15) rather than before. Each row prints temperature×100 as degrees, the name truncated to 28, LOC, a quadrant label from score.quadrant(loc), and path:line. score is unwrapped with an unreachable! carrying the invariant 'ranked nodes are scored'.
- predicted: most · documented: none · derivable: no · legible: most · trap: yes
- note: `.take(15).filter(...)` prints FEWER than 15 rows whenever zero-ranked entries fall in the top 15 — the filter belongs before the take, and since the sort is descending a zero in the top 15 means the section is nearly empty anyway, which is exactly when the truncation is most misleading; also rank() is called ~2n log n times inside the comparator.

### `truncate` — as expected
- read at `5db024cd301c` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Shortens a string to at most n characters for column-aligned CLI output, returning it unchanged if short enough, otherwise cutting and appending an ellipsis so the total stays within n; char-based rather than byte-based to stay UTF-8 safe.
- found: Exactly that: returns s if chars().count() <= n, else takes n-1 chars and appends "…", with an inline comment explaining the char-wise slicing avoids a mid-codepoint panic.
- predicted: full · documented: none · derivable: yes · legible: full · trap: yes
- note: `n - 1` underflows and panics if called with n == 0 on a non-empty string; nothing guards it.

## src-tauri/src/bin/tokens.rs

### `main` — nearly
- read at `ed32c2284566` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The `just tokens` binary: takes a repo path from argv, scans it, tokenises the MCP contract (tool schemas, PROTOCOL and READER_PROMPT priced separately) and the per-task handout (signature, docs, peers), printing a table via row/pct/big with each part's share of a reader's input floor, plus median/p90 payload sizes and a projected total for a full pass.
- found: All of that, in three sections. Fixed prefix: per-tool JSON sizes with the five tools a reader never calls annotated '· never called', tools/list whole, subagent prompt, and PROTOCOL priced separately as orchestrator-only. Variable part: a deliberately memo-less, Fidelity::Ordering scan, then all_tasks, with median/p90/max distributions of task JSON and its peers/docs/signature slices plus body line counts. Projection: bodies ESTIMATED at a hardcoded 38 chars/line because the scan keeps only a body hash, totals as percentages, an explicit note that a real run is 3-4x this floor because turns re-send, and a closing line pricing the never-called tool descriptions repo-wide.
- predicted: most · documented: none · derivable: no · legible: full · trap: yes
- note: The 'used' tool set is hardcoded as sanity_next|sanity_report in two separate places (line 91 and line 202), so adding a reader-facing tool silently misprices both the annotation and the headline 'ours to cut' figure — and no doc comment on a 161-line binary whose inline comments are otherwise excellent.

## src-tauri/src/blame.rs

### `blame_file` — as expected
- read at `ed62f32435e8` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Runs git blame --line-porcelain on `path` inside `repo`, returns None if git fails or the file is untracked, otherwise passes stdout to parse_porcelain to build a per-line author/time FileBlame.
- found: Exactly that, verbatim down to the `--` separator before the path and the lossy UTF-8 decode. No caching or error surfacing here; that lives in Blame::read/get.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## src-tauri/src/cache.rs

### `path_for` — as expected
- read at `666311ea6c26` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Build the machine-local cache path for a (repo, model) pair: resolve a user data/cache dir (None if unavailable), then a filename combining a sanitised or fnv-hashed repo path with the model name, plus a .json extension.
- found: Exactly that: reports::data_dir()?.join("scores"), create_dir_all with .ok()? so a failed mkdir yields None, then fnv hashes of the repo path bytes and the model name bytes formatted as {id:016x}-{m:016x}.json. An inline comment explains hashing rather than escaping because paths and model names carry filename-illegal characters.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc argues the design (model in the filename, and the empty-proxy-cache bug that motivated it) rather than restating the mechanics, which is the reverse of the usual failure.

### `flush` — nearly
- read at `0d8f104fdb55` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Returns early when the cache is ephemeral (no path) or empty, ensures the parent directory exists, serialises the entries to JSON in a sibling temp file, then renames it over the real path; taking &self and returning (), every error is swallowed because the cache is recomputable.
- found: That, minus the parent-directory creation and the empty check, and plus a detail I did not have: the state lives behind a Mutex, so it also let-else's out on a poisoned lock. Temp path is path.with_extension("json.tmp"); the rename is only attempted if the write succeeded, and its own result is discarded.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: Four separate silent failure paths (poisoned lock, serialisation, write, rename) with no logging, and a failed rename leaves a stale .json.tmp beside the cache that nothing ever cleans up; the temp name is also fixed, so two processes flushing the same repo's cache concurrently write the same tmp file.

### `two_models_never_share_a_cache_file` — as expected
- read at `76338bc3ecb6` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Opens/derives cache paths for the same repo under two different model names and asserts the paths differ — the model name is part of the on-disk filename so one model's scores can never be served to another.
- found: Exactly that, via Cache::path_for on a fixed /tmp/repo with "heuristic (no model)" vs "ollama · llama3.2:3b"; asserts both are Some and assert_ne. A comment names the regression: the proxy pass ran right before every model pass and wiped its scores when they shared a file.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The model names in the fixture are ollama-era, and CLAUDE.md says the model path was removed from the app — the test still passes but its scenario no longer exists.

## src-tauri/src/churn.rs

### `credit` — nearly
- read at `53667daf5345` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Looks up or default-inserts a FileHistory for key, bumps a commit count, adds churn only when age_days is inside a ~90-day recency window, keeps the oldest age_days seen as the file's age, and — since git walks newest-first — records last-touched, last author and last commit oid only on first sighting.
- found: Exactly that. recent_commits increments only when age_days <= CHURN_WINDOW_DAYS; age_days is overwritten unconditionally so the last (oldest) write wins; first-sighting fields are stamped once. The one thing I did not anticipate is HOW first sighting is detected: not an Option or a bool but the sentinel condition `recent_commits == 0 && age_days == 0.0`.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: First sighting is inferred from the sentinel `recent_commits == 0 && age_days == 0.0` rather than a flag, so a path whose only commit so far is outside the churn window AND lands at age_days 0.0 re-stamps last_author/last_commit on its next commit — and the whole function silently depends on callers feeding it strictly newest-first, which nothing here enforces.

## src-tauri/src/cli.rs

### `probe` — as expected
- read at `67e1f4b17404` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes the endpoint (host/port from the endpoint file) and makes a short-timeout HTTP request to a health/ping route, parsing the returned JSON for a `pid` field. Returns Some(pid) if something answered with a well-formed reply, None on connection error, non-200 or unparseable body — ignoring any pid recorded in the endpoint file.
- found: Builds a blocking reqwest client with PROBE_TIMEOUT, GETs `{url}/health`, deserialises the body as serde_json::Value, and returns the `pid` field narrowed from u64 to u32. Every fallible step is `.ok()?`, so any failure yields None.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `grades` — as expected
- read at `5069901d0436` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A tiny CLI formatter: pull full/most/some/none counts from a JSON Value, default missing to 0, join as labelled pairs in scale order, and return a dash or empty string when v is None.
- found: Exactly that: returns "—" for None, otherwise maps the fixed array ["full","most","some","none"] to "{k} {count}" with counts read as u64 defaulting to 0 and passed through the sibling `commas` thousands formatter, joined by three spaces.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/commands.rs

### `read_source` — nearly
- read at `515cf731af35` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A Tauri command that joins rel_path onto repo, canonicalises both and rejects with an error string if the result is not inside the repo root (blocking ../ and symlink traversal), then reads the file to a String mapping IO errors to strings, and truncates to some cap (max bytes or lines) so a vendored bundle cannot freeze the code view.
- found: As predicted for the containment check (canonicalize both, starts_with, "outside the open repo"), but the cap is a REFUSAL rather than a truncation: metadata().len() over 2 MiB returns an error "is too large to display". Also runs the whole thing on spawn_blocking and flattens the join error.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: "Capped" in the doc reads as truncation, but the body refuses the file outright over 2 MiB.

## src-tauri/src/heuristic.rs

### `lex` — as expected
- read at `8a2e3fec8e11` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Walk src with char_indices accumulating maximal runs of alphanumeric/underscore into one token each; on any other character flush the run and, unless whitespace, push that single punctuation char as its own token. Byte offsets from char_indices keep multi-byte chars intact; returns Vec<&str> borrowing src with whitespace dropped.
- found: Exactly that, implemented with a peekable char_indices: whitespace is skipped with `continue`, an alphanumeric-or-underscore char starts a run extended by peeking and advancing `end` by len_utf8 each time, and any other char is pushed as a one-character slice sized by its own len_utf8. Note `is_alphanumeric` is the Unicode predicate, so accented identifiers and CJK stay whole.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Best doc comment of the ten: it records both a design decision and a specific crash that is invisible from the code, and is the clearest case in this run of documentation that is not derivable from the body.

### `branch_density` — as expected
- read at `098a7ba7e8eb` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Counts branch-ish tokens (if/else/match/for/while/&&/||/?) in the body, divides by line count for decisions per line, maps the ratio onto 0..1 with linmap, and returns UNDECIDED for a body too short to have evidence.
- found: Exactly that: a BRANCH keyword list spanning several languages (incl. case/switch/loop/try/catch/except), returns UNDECIDED below MIN_LINES_FOR_BRANCHING, tokenises on non-alphanumerics while keeping &, | and ? as token chars, and returns linmap(hits/lines, 0.02, 0.25).
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The splitter keeps &, | and ? as token characters, so "&&&" or "??" would fail to match — harmless, but the tokenisation is subtler than it looks.

## src-tauri/src/history.rs

### `drop` — as expected
- read at `be6b40afb233` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Blobs wraps a long-lived `git cat-file --batch` child; Drop closes its stdin so git sees EOF and exits, then waits/reaps the child, ignoring errors.
- found: Exactly that in two lines: self.stdin.take() to drop the pipe handle, then let _ = self.child.wait(), with a comment stating that without the close the wait blocks forever. No kill — the EOF is the whole mechanism.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment on the item, but the one inline comment carries the entire non-obvious fact — the ordering of take() before wait() is load-bearing and nothing but that comment enforces it.

### `cache_path` — as expected
- read at `11d48f3a6a3e` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns a machine-local cache file path for this repo's timeline — the OS/app data cache dir joined with a sanity subfolder, filename derived from a hash of the repo path plus the limit so different commit caps don't collide; None when no cache directory is available.
- found: Joins reports::data_dir() with "timelines", creates it, computes an inline FNV-1a 64-bit hash of the repo path string, and returns dir/{hash:016x}-{limit}.json. None if data_dir is absent or the mkdir fails.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: The docs are about the cache location policy (why machine-local, not in .sanity/) rather than the function's mechanics — good context a model could not derive, but it does not describe the hash or filename scheme.

## src-tauri/src/lib.rs

### `build_menu` — nearly
- read at `90305001aa33` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Builds the whole app menu from scratch with Tauri's builders: an app submenu (about/hide/quit), an Edit submenu of predefined clipboard items, a Window submenu (minimize/close), plus a View or Appearance submenu with a three-way theme toggle as check menu items whose handles are collected into a returned ThemeMenu for later re-syncing. Returns the Menu and that struct.
- found: All of that, in that structure, with one submenu I did not predict: a File menu holding a single custom MenuItem id "open-project" labelled "Connect an Agent…" on CmdOrCtrl+O, because opening a project by hand is gone and a project now arrives via sanity_open. Appearance is a nested submenu under View with light/dark/system CheckMenuItems, system checked by default.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: Rebuilding the stock menu means the Edit submenu is load-bearing — delete it and ⌘C/⌘V silently stop working in every text field, which the inline comment warns about but the doc comment does not.

## src-tauri/src/local.rs

### `discover_models` — as expected
- read at `d9f25575bafc` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Builds the Ollama blob directory path (~/.ollama/models/blobs, maybe honoring OLLAMA_MODELS), reads the dir, keeps files over a 100 MB threshold, collects into Vec<PathBuf>, empty vec if the dir is missing; possibly sorted.
- found: Exactly that: dirs::home_dir(), joins ".ollama/models/blobs", read_dir with errors swallowed via if-let/flatten, pushes any entry whose metadata len() > 100_000_000, sorts the vec and returns it. No OLLAMA_MODELS env override.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc's own retrospective is accurate; the only thing it does not mention is that OLLAMA_MODELS is not honoured, so a user with a relocated blob store discovers nothing.

## src-tauri/src/main.rs

### `main` — as expected
- read at `84cd70f31b74` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Binary entry point: inspects std::env::args() and dispatches subcommands (mcp, serve, study, status, summary) into cli.rs, exiting after handling one; with no arguments falls through to launching the Tauri app via sanity_lib::run(). Possibly also windows_subsystem concerns and panic/logging setup.
- found: Special-cases `mcp` as argv[1] and returns after sanity_lib::mcp::run(); otherwise any non-empty argument list goes to sanity_lib::cli::main(&args) and its return code is passed to process::exit; empty args opens the window via sanity_lib::run(). No logging or panic setup. Comments carry the reasoning: one binary so the command an agent is told to launch exists, and so there is only one implementation of the contract writing `.sanity/`.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment was handed over, but the body's inline comments carry the design rationale in full — the docs field being empty understates how well explained this is.

## src-tauri/src/mcp.rs

### `base_url` — as expected
- read at `978ace024587` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Reads the endpoint file the running app publishes from a well-known per-machine location, parses out the port (ignoring the pid the file also carries), and returns Some("http://127.0.0.1:{port}") or None when missing or unparseable, with no caching and no liveness check; and consults a SANITY_BACKEND environment override first so a shim pointed at an explicit server does not resolve through the file.
- found: Exactly that, in two statements: SANITY_BACKEND returned verbatim if set, otherwise agentapi::read_endpoint()?.url(). The parsing is deliberately delegated rather than done here, with a comment saying two readers of one file appeared as soon as the CLI needed the pid too.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc is unusually good — it explicitly records that an earlier version of itself described a liveness check that never existed, which is the failure mode this whole tool is built to catch.

### `heal` — as expected
- read at `830606739f03` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Starts a backend (spawn/ensure `sanity serve`) and waits for it to answer, then if this shim's PROJECT static holds a repo path, synchronously POSTs /open for it so the caller's retry finds the project loaded; skips the reopen when nothing was opened yet.
- found: Calls cli::ensure_backend()?, returns Ok early if project() is None, otherwise builds the raw reqwest client and POSTs {path} to {base}/open directly — deliberately bypassing the `post` helper because `post`'s retry loop is what called heal and re-entering it would recurse. Errors map to strings.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## src-tauri/src/model.rs

### `quadrant` — nearly
- read at `f5561346044b` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Classifies a score on the surprise and stability axes: compute a hot boolean from temperature against a threshold and a stable boolean from is_stable(loc) — loc passed through because stability is normalised by size — then match the pair and return one of four Quadrant variants, perhaps with an undecided early return when git history is missing.
- found: Matches on (self.surprise >= HOT, self.is_stable()) — is_stable takes no argument. loc does something different from what I guessed: it only gates the COLD side, where >= 40 lines makes it Bloat and anything smaller is Quiet, and stability is ignored entirely there. Hot maps to CrownJewel/Trouble by stability. An inline comment states the rule that Bloat is the only quadrant that consults size because it is the only claim about size.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## src-tauri/src/parse.rs

### `python_docstring` — as expected
- read at `14f098029780` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Take the body node's first child statement; if it is an expression statement wrapping a string literal, get its text, strip surrounding quotes (triple or single), trim, and return it; otherwise None.
- found: Exactly that: first named child, unwrap an expression_statement to its first named child (falling through to the node itself if it is not one), require kind == "string", then trim_matches on any leading/trailing quote or apostrophe characters, trim whitespace, and return the String.
- predicted: full · documented: none · derivable: yes · legible: full · trap: yes
- note: trim_matches is character-wise and unanchored, so a docstring that legitimately ends in a quoted word ("...called \"foo\"") loses those quotes too, and prefixes like r"" or f"" leave a stray letter behind.

## src-tauri/src/reports.rs

### `save_index` — as expected
- read at `8587a2dec70e` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Serialises index to JSON, writes it to projects.json.tmp beside index_path(), then renames the temp over the real file. Returns nothing and swallows every error, but removes the temp on a failed write or rename so no orphan .tmp is left.
- found: Exactly that: let-else early return if index_path() is None or serde_json::to_string_pretty fails; temp path via with_extension("json.tmp"); write then rename, and remove_file on the temp only when the write succeeded and the rename failed. All errors discarded.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## src-tauri/src/scan.rs

### `git_root` — as expected
- read at `aa1e56bb89d4` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Runs `git -C <path> rev-parse --show-toplevel`, returns None when the command fails or the output is empty (path not inside a work tree), otherwise the trimmed stdout as a PathBuf; possibly canonicalised.
- found: Exactly that, with no canonicalisation: spawn failure or non-zero status gives None, empty trimmed output gives None, otherwise PathBuf::from(trimmed). Structurally identical to `assessment::git` (position 1) but with the command hardcoded and a PathBuf result — the two are independent copies of the same shell-out shape in different modules.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs are entirely about WHY refusing a non-repo matters (the folder-picker parent, the runaway walk) — none of which the twelve-line body could tell you, which is exactly the non-derivable case.

### `collect_files` — nearly
- read at `3d31d2bb20ab` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Builds an ignore::WalkBuilder on root honouring gitignore/.ignore and skipping hidden files, keeps regular files, maps extension to Lang via a lookup, drops unknown extensions, collects (PathBuf, Lang) — plus the vendored/minified refusals, applied here or nearby.
- found: Exactly that shape, with two specifics: `require_git(false)` so a .gitignore is honoured in a tarball or a repo with no history yet (commented with the reason), and a size cap MAX_FILE_BYTES plus a VENDORED path-component check applied inside the same filter_map. Minified detection is not here — only size and vendored-directory names.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docstring sells the gitignore walker but says nothing about the two silent exclusions in the same body — MAX_FILE_BYTES and VENDORED — which are exactly the ones a user would want counted out loud.

### `gitignored_paths_never_enter_the_picture` — as expected
- read at `1350304cce85` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A test that uses the file-local fixture helper to build a temp repo with a .gitignore plus a source file in an ignored directory alongside a normal source file, runs scan, and asserts the ignored file's functions are absent from the tree while the normal one is present.
- found: Exactly that: fixture() builds the tree, run() scans it, root.visit collects every node name, then asserts "add" is present and "vendored" is not, printing the full name list on failure.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The test is named for .gitignore but the thing it asserts absent is called "vendored", and whether that path is excluded by the gitignore walker or by the separate vendored-directory rule is decided entirely inside fixture(), so the test could keep passing with gitignore handling removed.

## src-tauri/src/scancache.rs

### `open` — nearly
- read at `15b87f67b054` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Builds a ScanCache for repo by reading its on-disk cache file via path_for and parsing header plus entry lines; a format-version mismatch yields a fresh empty cache, and a rewritten history (cached HEAD no longer an ancestor of current HEAD, via git_head/is_ancestor) keeps the parse entries but discards the blame halves. IO/parse failure degrades to empty rather than erroring.
- found: Exactly that, plus detail I did not name: it also returns the line count from read_log to seed a Dirty struct (keys, lines, rewrite:false) used for append-vs-rewrite bookkeeping, and wraps the Stored in a Mutex, caching the current head on the struct. The ancestor check is guarded by a non-empty stored head and a head inequality first.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The docs explain the two invalidation levels and their blast radii — reasoning that could not be recovered from the code — but say nothing about the Dirty/line-count bookkeeping the function also sets up.

## src-tauri/src/surprise.rs

### `the_heuristic_model_passes_the_proxy_through_untouched` — as expected
- read at `78f34acb294b` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Builds a HeuristicModel, feeds it a function plus a precomputed proxy score, and asserts the returned Reading's surprise equals that proxy exactly — the offline heuristic is the identity on the proxy and adds nothing of its own; possibly also checks is_model() or the label.
- found: Precisely the identity assertion: a minimal Item literal ("f", "fn f()", body "{}", no peers, no doc, 1 line, empty context) and a single assert_eq that HeuristicModel.surprise(&item, 0.73).surprise == 0.73. No label or is_model check.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The test asserts pass-through with one fixed input, so it would still pass if surprise ignored the item entirely — which is in fact the property named, but it also cannot catch an implementation that clamped or rescaled outside the 0.73 neighbourhood.
