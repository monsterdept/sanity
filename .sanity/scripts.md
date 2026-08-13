# scripts — sanity assessment

8 of 8 read · 0 surprising

6 of these graded legibility under an earlier question and are not counted; see the note below.

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

## scripts/expiry-check.py

### the file itself
- spec 1 · read at `0c7a120a83c8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A CI gate script that diffs the current release against a previous ref to decide if cached .sanity/ readings are invalidated: extracts watched function source by name across two refs and compares, checks if a version constant moved, and fails (exit 1) if hash-relevant code changed without a version bump.
- found: Exactly that shape: WATCHED dict of file->function names whose text changes reading hashes, VERSIONS dict of file->const name; at() gets file text via git show at a ref, function_text() extracts one fn by regex to a column-zero closing brace, version_of() reads a `const NAME: u32 = N`, main() compares before/after for both, and prints one of three outcomes (EXPIRES NOTHING / EXPIRES READINGS / UNDECLARED EXPIRY), exiting 1 only for the undeclared case.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `at`
- spec 1 · read at `41b52f38dccc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Retrieves file contents at a git ref via `git show ref:path` in a subprocess, returning None if the file didn't exist there (catching the error).
- found: Exactly as predicted: runs `git show {ref}:{path}` via subprocess.run with check=True, returns stdout, and catches subprocess.CalledProcessError to return None.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `function_text`
- spec 1 · read at `fc17c65a2fbb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Finds a top-level `fn name` in Rust source via regex, then extracts to the next column-zero `}` line, returning the substring or None if not found.
- found: Exactly as predicted, plus a None-passthrough guard for src, and the regex also matches optional `pub` / `pub(...)` visibility prefixes before `fn name`. If no closing brace is found it returns the rest of the string rather than None.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `version_of`
- spec 1 · read at `7fb9eb7a5d80` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Regex-searches src for `const {name}: u32 = N;` and returns N as int, defaulting to 0 if not found.
- found: Exactly as predicted, plus a None-src short-circuit that also returns 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main`
- spec 1 · read at `06131c6f5f9e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: CI entry point that diffs current tree against a previous tag/ref, comparing version_of for hash-relevant inputs old vs new, and exits nonzero or warns if a version bump is required but missing.
- found: Compares two git refs (default: last tag..HEAD): for each watched function, checks if its text changed; for each version constant, checks if its value moved. Prints a report; returns 1 (failure) only when a watched function changed but no version constant moved (undeclared expiry), otherwise 0 with either 'expires nothing' or 'expires readings, declare it in release notes' messaging.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## scripts/make-icon.py

### the file itself
- spec 1 · read at `f08a099178b8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A dependency-free script generating a sunburst placeholder PNG icon (cool-to-hot concentric rings) via raw zlib/struct PNG encoding, with a pixel() color function and main() writing src-tauri/icons/source.png.
- found: Exactly that: pixel() computes ring/wedge color from polar coords using a RAMP matching the app's UI color scale and SPOKES gap counts per ring; main() builds raw scanlines, zlib-compresses them into an IDAT chunk, assembles a minimal PNG by hand, and writes it to src-tauri/icons/source.png.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `pixel`
- spec 1 · read at `d5c463cd7bcd` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes RGB for one pixel based on radial distance from center, mapping radius to a cool-to-hot color ramp for concentric rings.
- found: Computes both radius and angle from center; radius selects which ring/ramp-color applies, and angle divides each ring into spoked wedges with a thin background-colored gap at each wedge boundary (the sunburst spokes), with background outside all rings.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `main`
- spec 1 · read at `f2be9efae435` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a pixel buffer via pixel(x,y) calls, hand-assembles a raw PNG using struct/zlib for IHDR/IDAT/IEND chunks, writes to src-tauri/icons/source.png.
- found: Builds scanlines (filter byte 0 + RGB bytes from pixel()), defines local chunk() helper with CRC32, assembles PNG signature + IHDR(8-bit RGB) + IDAT(zlib compressed) + IEND, writes to src-tauri/icons/source.png after mkdir, prints size in kB.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
