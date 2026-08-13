# scripts — sanity assessment

8 of 8 read · 1 surprising

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

## scripts/expiry-check.py

### the file itself
- spec 2 · read at `0c7a120a83c8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:56:12Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A CI script that inspects a git diff to decide whether this release invalidates existing .sanity/ readings. Uses at/function_text to pull specific function bodies (the ones feeding reading_hash, the parser, and the assessment question) at two revisions, compares them, and via version_of checks whether a version bump accompanied any such change. main is the entrypoint that fails the check if inputs changed without a corresponding version bump, guarding against the past incident where file_doc silently changed cached-record meaning without one.
- found: CI script comparing a previous git ref (defaults to latest tag) against a later one (defaults HEAD), extracting specific named top-level Rust functions (reading_hash, body_hash, file_doc, leading_doc, body_span, header_end, file_surface) by regex and comparing their text, then checking whether PARSE_VERSION or SPEC constants moved. Three outcomes: EXPIRES NOTHING (exit 0), EXPIRES READINGS (deliberate version bump, exit 0), or UNDECLARED (watched function changed but no version bump — exit 1, the actual bug this guards against).
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `at`
- spec 2 · read at `41b52f38dccc` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:25Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Runs `git show {ref}:{path}` via subprocess to get the file's content at that git ref, returning the decoded text. Catches the subprocess error (non-zero exit, meaning the file didn't exist at that ref) and returns None in that case.
- found: Runs git show ref:path via subprocess and returns stdout text, catching CalledProcessError to return None if the file didn't exist at that ref.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `function_text`
- spec 2 · read at `fc17c65a2fbb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Searches src for a line matching `fn {name}` (likely via regex anchored at the start of a line), then scans forward line by line until it finds a closing `}` in column zero, and returns the joined text of that span. Returns None if the function isn't found.
- found: Regex-finds `fn {name}` (optionally prefixed by `pub`/`pub(...)`) anchored at line start, then regex-finds the next `^}` in the remainder and slices out that span as the function text; returns None if the start isn't found, or the whole rest of src if no closing brace is found.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the pub-visibility prefix handling and used regex-on-remainder rather than a manual line scan, though the overall mechanism (start marker, column-zero close) matched.

### `version_of`
- spec 2 · read at `7fb9eb7a5d80` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Uses a regex to find `const {name}: u32 = N;` in the source text `src` and returns N as an int; returns 0 if no match is found (absent = 0, per the docstring).
- found: Regex-searches src for `const {name}: u32 = N;`, returns N as int; returns 0 if src is None or no match.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main`
- spec 2 · read at `06131c6f5f9e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:19Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Runs as a CI check comparing the current branch against a base ref, using version_of and function_text to compare the code feeding reading_hash (and parser/question logic) before and after. If those inputs changed but the version wasn't bumped, it prints an error and exits non-zero; otherwise exits cleanly.
- found: Compares a previous git ref (defaulting to the latest tag) against a later one (defaulting to HEAD): diffs the text of each watched function and the value of each watched version constant across the two refs. If a watched function changed but no version constant moved, it prints an 'UNDECLARED EXPIRY' error and returns 1; if versions moved it prints that readings expire and returns 0 (informational); if nothing changed it returns 0.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No per-function docstring — only the file-level doc explains the rationale; the argv/tag-default handling and the three distinct outcome branches weren't predictable from the signature alone.

## scripts/make-icon.py

### the file itself
- spec 2 · read at `f08a099178b8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:56:09Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A dependency-free Python script that builds a PNG by hand — a pixel(x, y) function computes a color for each pixel based on distance from center (mapping radius to a cool→hot gradient in concentric rings), and main() assembles the raw pixel buffer, zlib-compresses it, and writes out a minimal PNG file (manually constructing IHDR/IDAT/IEND chunks with struct.pack for CRCs and lengths) to src-tauri/icons/source.png.
- found: pixel(x,y) computes polar radius/angle from center, buckets radius into discrete ring bands with per-ring wedge-spoke counts (thin gaps at spoke boundaries), and returns a color from a fixed 5-color cool→hot RAMP per ring, else background. main() builds a raw RGB scanline buffer, hand-assembles a PNG (IHDR/IDAT via zlib.compress/IEND with CRC32 chunk framing) and writes it to src-tauri/icons/source.png.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Predicted a continuous gradient; actual is discrete ring bands with per-ring wedge-count spokes and separator gaps, which I didn't anticipate.

### `pixel` — QUIRKY
- spec 2 · read at `d5c463cd7bcd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:01Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes the distance of (x, y) from the image center, and uses that distance to pick a color along a cool-to-hot ramp (e.g. blue near center transitioning to orange/red at the edges), producing concentric rings. Returns an (r, g, b) tuple, likely with some banding/quantization by ring index to make discrete rings rather than a smooth gradient.
- found: Computes normalized radius and angle from center, finds which ring band the radius falls in, then within that ring divides the circle into spoke wedges by angle (using SPOKES[i] count) and draws a thin background-colored gap at each wedge boundary, else colors by RAMP indexed by ring — producing a sunburst of colored wedged rings, not a smooth or purely radial gradient.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the angular wedge/spoke-separator logic entirely — expected a pure radial ramp, but half the function is about slicing each ring into spokes with gaps.

### `main`
- spec 2 · read at `f2be9efae435` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:48Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Loops over every (x, y) pixel of a square image, calling pixel(x, y) to compute a cool→hot sunburst RGBA color, assembles raw scanline bytes, zlib-compresses them into an IDAT chunk, and manually packs a minimal PNG file (signature + IHDR/IDAT/IEND chunks with CRCs via struct) which it writes to src-tauri/icons/source.png.
- found: Builds scanlines by calling pixel(x,y) per pixel (RGB, filter type 0 per row), zlib-compresses them into an IDAT, packs a minimal PNG (signature + IHDR/IDAT/IEND chunks with length+CRC via struct), and writes it to src-tauri/icons/source.png, printing the file size.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
