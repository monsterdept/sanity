# scripts — sanity assessment

35 of 35 read · 5 surprising

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
- spec 3 · read at `b07a3a6b2534` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:35Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A CI/dev script that determines whether committed readings in .sanity/ are now stale relative to the current code. It walks git history/diffs (via functions like `at`, `version_of`, `stable_since`) to recompute the inputs that feed `reading_hash` — function text, shape, doc — for each cached reading, compares them to what's currently on disk, and reports (via `main`) which readings need a re-read because their underlying inputs moved, versus which are still valid.
- found: Compares specific "watched" functions (by name, extracted via regex) and version constants (PARSE_VERSION, SPEC) between two git refs. Reports one of three outcomes: EXPIRES NOTHING (nothing watched changed, or the parse is declared output-neutral since a stable version), EXPIRES READINGS (a version was deliberately bumped), or UNDECLARED (a watched function's text changed but no version moved — the actual bug this script exists to catch). It also normalizes away pure formatting/whitespace changes (via a `shape` function that collapses layout but preserves string/char literals) so a `cargo fmt` pass doesn't falsely trigger expiry.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The docstring is unusually complete — it explains not just what the script checks but the historical incidents (file_doc silently added without version bump, cargo fmt false-triggering) that justify each design decision.

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

### `shape`
- spec 3 · read at `87afe58247e2` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:56:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Normalizes a function's source text so that pure formatting/whitespace/indentation differences don't count as changes. It probably tokenizes the text, extracting string/number literals verbatim (keeping their exact content), and collapses all other whitespace runs (and maybe other non-literal tokens) into single spaces, then joins everything back into one normalized string used elsewhere (e.g. by body_hash) to compare function bodies for semantic equality.
- found: Normalizes source text into a (normalized_string, literals_tuple) pair: literals are extracted verbatim via regex into `kept`, replaced with a placeholder in the body, then whitespace adjacent to punctuation is stripped entirely (not just collapsed) while whitespace between word characters is collapsed to a single space. Returns None if input is None.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `stable_since`
- spec 3 · read at `3e9487c51fa6` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:58:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Searches the given source text (likely the Rust file defining PARSE_VERSION) with a regex for a comment/marker near the constant declaration indicating the oldest version whose parse output is known to match the current one, and returns that integer. If no such marker is found, returns a very large sentinel integer (e.g. sys.maxsize) so an undeclared/missing annotation is treated pessimistically as "possibly expiring everything" rather than "safe".
- found: Regex-searches the given source text for a `const PARSE_OUTPUT_STABLE_SINCE: u32 = N` declaration and returns N as an int; returns a huge sentinel (1<<30) if src is None or the constant isn't found, so a missing/undeclared value reads as everything-might-be-expired rather than nothing-is.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Predicted a generic "comment marker" rather than a specific named constant, but the sentinel/pessimism behavior was exactly as documented.

### `version_of`
- spec 2 · read at `7fb9eb7a5d80` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Uses a regex to find `const {name}: u32 = N;` in the source text `src` and returns N as an int; returns 0 if no match is found (absent = 0, per the docstring).
- found: Regex-searches src for `const {name}: u32 = N;`, returns N as int; returns 0 if src is None or no match.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `main`
- spec 3 · read at `999fab49f986` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:28:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Orchestrates the expiry check: gets the diff/changed files for the release, uses version_of/stable_since/shape helpers to determine whether anything feeding reading_hash (parser, question text, hashed inputs) changed since the last stable version, and prints a verdict plus exits with a nonzero code if the release silently invalidates cached readings without a version bump (guarding against the file_doc incident described in the file doc).
- found: Compares a previous tag to HEAD (or given refs): diffs watched functions (splitting real changes from mere reflow via `shape`), diffs declared version constants, and separately tracks cache-format version bumps. It prints a full report and returns exit code 1 only for the "undeclared expiry" case (a watched function changed but no version moved); it also special-cases a PARSE_VERSION bump declared output-neutral via `stable_since`, which recomputes caches but expires nothing.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

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

## scripts/palette-search.py

### the file itself — QUIRKY
- spec 3 · read at `62037ae600f0` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:31:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A standalone script that performs a constrained search to derive the hue/chroma values for five color ramps ("lenses") used in a sunburst chart, using perceptual color math (OKLab/OKLCH conversions, CIEDE2000 distance) and colorblindness simulation to score candidate palettes against distinguishability/contrast constraints, then outputs/prints the winning ramp so the derivation is reproducible instead of hand-picked.
- found: A CLI script with four subcommands (verify/order/add/flat) that solves hues for the sunburst's lens ramps in OKLCH space. It shares one lightness/chroma profile across all ramps (hue is the only free variable), scores ramps under normal vision only (unlike the categorical palette which scores across colorblindness simulations too, since a ramp's reading survives via the shared lightness climb), enforces a hue-ordering constraint matching a fixed menu, pins certain hues, and validates against floors relative to neutral/trap/structure colors. `verify` reproduces the shipped palette channel-exact to confirm the model is trustworthy.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted CVD/colorblindness simulation was used to score the ramps, but the file is explicit that ramps are deliberately scored under normal vision only (`plain`), while CVD simulation (`worst`) is reserved for the categorical palette elsewhere — a real distinction I got backwards.

### `srgb_to_linear`
- spec 3 · read at `70e0814618e2` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Standard sRGB-to-linear gamma decoding for a single channel value c in [0,1]: applies the piecewise formula, dividing by 12.92 below the 0.04045 threshold and otherwise applying the ((c+0.055)/1.055)**2.4 power curve.
- found: Standard sRGB-to-linear piecewise gamma decode for one channel.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `linear_to_srgb`
- spec 3 · read at `6e1cf972f626` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Standard linear-RGB to sRGB gamma encoding: piecewise, using c*12.92 for small values and 1.055*c**(1/2.4)-0.055 for larger values, operating on a single channel scalar.
- found: Exact standard linear-to-sRGB gamma encoding formula, piecewise on the 0.0031308 threshold.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `hex_to_rgb`
- spec 3 · read at `312118202a45` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Parses a hex color string like "#RRGGBB" (stripping leading '#' if present) and returns a tuple of three integers (r, g, b) each in 0-255, by slicing the string into 2-character chunks and converting each with int(x, 16).
- found: Strips leading '#', slices the hex string into three 2-char chunks, converts each to an int via base 16, then normalizes to 0-1 floats by dividing by 255 (I expected 0-255 ints, not normalized floats).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `rgb_to_hex`
- spec 3 · read at `eda22d417a7e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:52Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Converts an RGB tuple (likely 0-1 floats given the oklab/linear conversion peers) into a "#rrggbb" hex string, rounding and clamping each channel into 0-255 before formatting.
- found: Clamps each channel (0-1 float) to [0,1], scales to 255, rounds, and joins into a #rrggbb hex string.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `linear_to_oklab`
- spec 3 · read at `ef45cb35f5a5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:24Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Applies Ottosson's OKLab matrix M1 to linear RGB to get LMS values, cube-roots each component, then applies matrix M2 to get the final L, a, b values, returning them as a tuple.
- found: Applies the M1 matrix to convert linear RGB to LMS, cube-roots each (guarding against negative bases), then applies M2 to produce L, a, b.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `oklab_to_linear`
- spec 3 · read at `c3d902c379f6` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Standard OKLab-to-linear-sRGB conversion: takes L, a, b, computes the l/m/s intermediate values via the OKLab matrix (linear combination of L,a,b), cubes them to undo the OKLab nonlinearity, then applies the LMS-to-linear-RGB matrix to produce (r, g, b) linear values, returned as a tuple.
- found: Standard OKLab-to-linear-sRGB conversion using the published matrices: computes l_/m_/s_ as linear combos of L,a,b, cubes them, then applies the LMS-to-linear-RGB matrix.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `hex_to_oklch`
- spec 3 · read at `e3ed083c6c8b` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:32:49Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Converts a hex color string to OKLCH by chaining hex_to_rgb, srgb_to_linear, and linear_to_oklab, then converting the resulting oklab a/b to polar chroma and hue (via atan2/hypot), returning (L, C, H).
- found: Exactly as predicted: hex → srgb_to_linear → linear_to_oklab → polar (hypot for chroma, atan2 degrees mod 360 for hue), returning (L, C, H).
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: The docstring explains a caller's usage (reading marks' hue back off shipped colors) rather than what the function itself computes.

### `oklch_to_hex`
- spec 3 · read at `3eacff90ff4b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:52:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Converts OKLCH(L, C, h_deg) to linear sRGB via oklab_to_linear/linear_to_srgb, checks whether the result is within the [0,1] gamut, and if not, reduces chroma C (holding L and h_deg fixed) — likely via a binary search or stepped loop — retrying until the color fits, then formats the final RGB as a hex string via rgb_to_hex.
- found: Binary search (fixed 40 iterations, no epsilon tolerance) over chroma C, converting each candidate (L, C·cos h, C·sin h) via oklab_to_linear and testing strict [0,1] membership on all three channels; keeps the largest in-gamut chroma, then clamps and runs linear_to_srgb before hex-encoding.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I guessed a binary search but expected an epsilon-based stopping condition; the code deliberately avoids one — a comment explains a past bug from using 1e-4 tolerance.

### `hex_to_lab`
- spec 3 · read at `5f38252c4487` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:38Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Converts a hex color string to CIE Lab coordinates for use with ciede2000 — chains hex_to_rgb and srgb_to_linear to get linear RGB, then does the RGB→XYZ matrix multiply and the nonlinear XYZ→Lab transform inline (since there's no separate linear_to_lab peer), returning an (L, a, b) tuple.
- found: Converts hex to linear RGB, multiplies by matrix _M to get XYZ, applies the standard nonlinear CIE Lab transform (cube root or linear piecewise near zero) against white point _WP, and returns (L, a, b).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `ciede2000`
- spec 3 · read at `70d39af622b2` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Implements the standard CIEDE2000 perceptual color-difference formula, taking two CIELAB color tuples (lab1, lab2) and returning a single float distance value (ΔE00) representing how perceptually different the two colors are. It will involve the usual CIEDE2000 math: computing C*, h*, ΔL', ΔC', ΔH', weighting functions (SL, SC, SH), and the RT rotation term, combining them into the final distance. This is used by the palette search (worst/margins/legal functions) to verify that chosen ramp stops are sufficiently distinguishable from each other and from other lenses' stops.
- found: Standard CIEDE2000 ΔE color-difference formula between two Lab colors: computes chroma/hue primes with the G rotation correction, weighting functions SL/SC/SH, the T and RT rotation terms, and combines into the final perceptual distance.
- predicted: full · documented: most · derivable: no · legible: most · trap: no

### `simulate` — QUIRKY
- spec 3 · read at `4be0dae768a1` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:31Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds the 5-stop color ramp for hue `h` (via the `ramp` helper) and then applies a colorblindness simulation transform selected by `kind` (e.g. protanopia/deuteranopia/tritanopia) to each stop, returning the simulated colors. This is used elsewhere to check that the ramp still reads correctly (e.g. via `margins`/`worst`) under simulated color vision deficiency.
- found: Takes a single hex color `h` (not a hue) and a colorblindness `kind`; if kind is "normal" returns it unchanged, otherwise converts to linear sRGB, applies a fixed CVD confusion matrix (`_CVD[kind]`), clamps, and converts back to a hex color.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I misread `h` as a hue parameter for building a ramp; it's actually a single hex color being simulated — the name `h` is ambiguous without the body.

### `worst`
- spec 3 · read at `a985833faadf` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:25Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Runs `simulate` on both colors a and b for every color-vision-deficiency viewer type (and probably the normal viewer too), computes ciede2000 between the simulated pairs for each, and returns the minimum — the worst-case (smallest) perceptual distance across all viewers, used to ensure two categorical colors stay distinguishable even for colorblind users.
- found: Returns the minimum CIEDE2000 distance between colors a and b across every viewer in VIEWS (presumably normal + colorblind simulations), converting each simulated color to Lab first.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: None.

### `plain`
- spec 3 · read at `4acb3bc868b0` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:55Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper: takes two hex color strings a and b, converts each to Lab via hex_to_lab, and returns ciede2000(lab_a, lab_b) — the perceptual color distance under normal (non-colorblind) vision, used as one of the scoring functions alongside a colorblind-simulated variant.
- found: Converts hex colors a and b to Lab and returns ciede2000 distance between them — the normal-vision scoring function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `ramp`
- spec 3 · read at `133ac67d073f` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:58Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Given a hue, returns a list of 5 hex colors forming a ramp: for each of 5 fixed (lightness, chroma) stops shared across all lenses, converts OKLCH(lightness, chroma, hue) to hex via oklch_to_hex. Since it's only 2 lines, it's likely a single list comprehension over a module-level STOPS constant.
- found: Zips module-level L_PROFILE and C_PROFILE constants together with the given hue, converting each (L,C,hue) triple to hex via oklch_to_hex, producing the 5-stop ramp.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc describes the module's purpose well but the docs list for this specific function was empty — coverage came from the file_doc, not per-function docs.

### `margins`
- spec 3 · read at `a80d469a0ee5` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:42:08Z · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes a tuple of worst-case color-distance contrasts across the candidate hue assignment: worst cold-stop pair distance, worst hot-stop pair distance, worst cold-stop-vs-neutral distance, and then worst distances from any ramp stop to the fixed trap colors, clone colors, structural UI colors, and marks — using `worst`/`plain`/`ciede2000`-style helpers similarly to `ordered_score`, returned as a 7-tuple (despite the docstring's "six" framing, per the note about it being undercounted).
- found: Returns the 7-tuple (cold, hot, vs_neutral, vs_trap, vs_clone, vs_struct, vs_mark) of worst-case pairwise color distances: cold/hot are worst distances among ramps at their coldest/hottest stops; vs_neutral is worst cold-stop-vs-neutral; the rest are worst distance from ANY stop on any ramp to trap/clone/structure/mark reference colors respectively.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Docstring says "six worst-case contrasts" but the tuple has seven elements — a caller unpacking by the docstring's own count would be short, which the docstring itself flags as a past bug but doesn't fix the count word.

### `legal`
- spec 3 · read at `1eca3c487558` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:12:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A short boolean check verifying the hue falls outside some forbidden zone(s) — likely too close to red/green CVD-confusion hues or another reserved hue band — returning True/False in a single expression given the 2-line body.
- found: Returns True unless a global BARRED range is set and hue falls within it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `add`
- spec 3 · read at `279c24b5aacd` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:12:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given n, this keeps the existing shipped ramp hues fixed and searches (likely via random sampling or grid search over hue angles) for n new hues to add to the palette, checking each candidate against the legal() and margins() constraints and using ciede2000/worst() to ensure sufficient perceptual distance from existing hues and each other. It prints or returns the resulting hex values for the new hues so they can be pasted into index.css.
- found: Holds shipped hues fixed, builds a grid of legal candidate hue angles (every 2 degrees, filtered by legal()), enumerates all ordered combinations of n new hues from that grid, and for each combination computes margins() against cold/hot/structure floors. It keeps the combination maximizing the worst-case (min) cold/hot margin, then prints the winning hue angles and their full ramps as CSS custom properties.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Exhaustive combinatorial search over the legal grid — cost grows fast with n, so this is only viable for small n (adding 1-2 hues), not documented as a limitation anywhere.

### `flat`
- spec 3 · read at `c308f8c877d5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:13Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Searches over candidate OKLCH hue/lightness/chroma combinations for a single flat color (used by the Locality wiring lens), computing CIEDE2000 distance from each neighboring UI color it must stay distinguishable from (directory fill, unread neutral, agent outline, trap pink, page background), and returns the hex value maximizing the worst-case margin among those comparisons.
- found: Brute-force grid search over OKLCH (L, C, h) for a single flat accent color, computing the minimum CIEDE2000-style distance to a set of light/dark-theme color pairs it must stay distinguishable from, picking the candidate maximizing that worst-case margin, and printing the result.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I predicted the search/margin-maximization structure correctly but missed that each 'against' color is actually a light+dark theme pair, not a single value.

### `chips`
- spec 3 · read at `9cb459fb6ffd` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:27Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds the dict of chip colors shown in the MENU: for each ramp lens it computes the hex color at the ramp's fourth stop using the lens's hue from `hues` plus the shared lightness/chroma profile; for the two mark lenses (e.g. traps/clones) it returns their own fixed, louder color rather than deriving from a ramp; and for chrome-only lenses it builds a color at the fourth stop's lightness/chroma so it visually sits on the ring. Likely uses dark-mode lightness/chroma values since that's the theme it was tuned against.
- found: For each menu key, uses the hue from the `hues` argument in all three branches: MARKS keys get their own dark-mode lightness/chroma (from MARKS[k]['dark']) combined with that hue; CHROME keys use fixed CHIP_L/CHIP_C constants with that hue; everything else (ramp lenses) uses the shared L_PROFILE[3]/C_PROFILE[3] fourth-stop lightness/chroma with that hue, converting each to hex via oklch_to_hex.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I assumed marks kept their own hue too ('quote themselves'), but the hue is still taken from the passed-in `hues` dict for every branch, including marks — only lightness/chroma is special-cased.

### `ordered_score` — QUIRKY
- spec 3 · read at `c172030878cc` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:40:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a candidate ordering of hues, computes worst-case (objective, cold, hot, chip) pairwise distances via a `worst`-style helper, and combines them into one scalar with a weighted formula where the cold-end worst-pair leads/dominates the score while the other three terms are held above their own floor values rather than simply summed together.
- found: Builds per-lens ramps (excluding marks/chrome), computes worst-pair distance at the coldest stop, hottest stop, and among chip colors, then combines them as obj = min(cold, hot*0.75, chip*0.6) — a min-based weighting rather than a sum, so cold dominates when it's the binding constraint. Separately it computes the worst distance from any ramp stop to any trap/clone mark, and if that falls below MARK_FLOOR, subtracts the shortfall from obj — a floor penalty covering a past bug where ordering scored ramps only against each other and let assignments sit too close to fixed marks.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The docstring's "held above their floors" language actually describes the marks penalty added later (per the inline comment), not hot/chip, which are instead scaled multipliers inside a min — the docstring doesn't mention the marks term at all.

### `descending`
- spec 3 · read at `2a07746e7e30` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:32:41Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Given a list of hue values (circular, 0-360 degrees), this "unwraps" them into a monotonically descending sequence — e.g. by subtracting 360 from any hue that would otherwise be greater than the previous one — so that the menu's declared hue order can be checked or compared with simple numeric less-than comparisons instead of needing circular/modular arithmetic. Returns the unwrapped list of hues.
- found: Iterates the MENU keys in order, looking up each hue in the `hues` dict, and subtracts 360 whenever a hue would be greater than the previous unwrapped value, producing a strictly non-increasing (given the docstring, intended descending) sequence so order can be checked by simple less-than comparison.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `start_from_pins`
- spec 3 · read at `0fd5f0fd240c` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:45Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes an initial hue assignment for the search: identifies the arcs (gaps) between pinned hues on the hue circle, unwraps the circle at the point it wraps through 0, evenly spaces free hues within each arc proportionally to that arc's size (rather than uniformly across the whole circle), then re-applies the modulo to wrap back onto the circle — a starting vector chosen so the optimizer converges to a better local optimum than uniform spacing.
- found: Anchors unwrapping at the first pinned lens in MENU order, builds an unwrapped "line" of pinned hues by subtracting the wrap modulo, then for each consecutive pair of pinned positions (including the wraparound arc from the last pin back to the first across the circle boundary) linearly interpolates the free hues in that arc proportionally by index, wraps the result back into [0,360), and overlays the original pinned hues.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `order`
- spec 3 · read at `8ca521c48c35` · commit `a624db6` · read by claude-sonnet-5 · via claude · when 2026-08-29T07:33:16Z · by ross@rossturk.com · warm reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Solves eleven lens hues under the menu's ordering constraint using coordinate ascent: starts from equal spacing between pinned hues (start_from_pins), then iteratively moves each free hue within the bounds set by its two menu-neighbors to maximize ordered_score (weighted cold/hot/chip margins), repeating until no hue moves or 12 iterations pass. Finally prints the worst cold/hot/chip pairs, each lens's hue and chip color, the ramps, chrome chips, and mark colors.
- found: Coordinate ascent solving all eleven lens hues under the menu's fixed ordering constraint: starts from equal spacing between pinned hues, then repeatedly nudges each free hue within the 4-degree-padded window bounded by its two menu neighbors to maximize ordered_score, until convergence or 12 passes; prints the worst cold/hot/chip margins and the resulting hues, chips, ramps, chrome tokens, and marks.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no
- note: I had already read this exact function in full when assessing scripts/palette-search.py as item 1, so this is a warm/recall reading rather than a genuine cold prediction.

### `verify` — QUIRKY
- spec 3 · read at `8b8160655b1b` · commit `3e9155b` · read by claude-sonnet-5 · via claude · when 2026-09-02T00:41:58Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Re-derives the seven ramps (via order/start_from_pins etc.), then compares each ramp's stops against the hardcoded shipped hex/oklch values channel-by-channel to one decimal place of tolerance, printing a pass/fail per ramp/stop and raising or exiting nonzero if anything drifts — a regression check that this script still reproduces what's actually shipped in index.css.
- found: Regenerates each SHIPPED ramp via ramp(h) and diffs it against SHIPPED_STOPS in raw 0-255 RGB units (max channel delta per stop), prints each ramp with an 'off by N/255' flag, then prints several margin comparisons (cold/hot pairs, vs unanalyzed/trap/clone/structure/agent-mark) against the values index.css claims, and returns 0/1 depending on whether the worst per-stop RGB step is <=1.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
