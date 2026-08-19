# scripts — sanity assessment

27 of 27 read · 3 surprising

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

## scripts/palette-search.py

### the file itself
- spec 3 · read at `7a6af0557b5b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:48Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A standalone Python script that programmatically searches for the five-stop color ramps used by the sunburst visualization's "lens" hues, replacing manual eyeballing with a reproducible constrained search. It implements color-space conversions (sRGB↔linear↔OKLab/OKLCH, hex parsing), a CIEDE2000 perceptual distance metric, a color-vision-deficiency simulator, and search/validation helpers (legal, margins, worst, verify, add, flat, ramp, plain) that iterate candidate hues/chroma/lightness combinations to find ramps satisfying contrast/distinguishability constraints, then prints or outputs the resulting hex values for use in index.css.
- found: A reproducible color-search script for the sunburst's five lens ramps: sRGB/OKLab/OKLCH conversions, CIEDE2000, CVD simulation, and verify/add/flat subcommands that reproduce or extend the shipped palette under explicit perceptual-distance constraints (barred hue range, floors vs neutral/trap/mark colors), scored differently for ramps (normal vision only) vs categorical colors (all dichromacies) per the docstring's reasoning.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

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

### `margins` — QUIRKY — TRAP
- spec 3 · read at `b678801a8838` · commit `0ce57c0` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T02:12:34Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a set of candidate lens hues, builds ramps for each and runs them through `simulate` (likely a colorblindness/appearance simulation under different conditions like "cold"/"hot" viewing), then uses `ciede2000` via `worst` to compute the four worst-case pairwise distances named in the doc line — worst cold pair, worst hot pair, worst cold-vs-neutral, worst hot-vs-trap — returning them as a tuple used as the optimization objective for the palette search.
- found: Builds a ramp per hue, then computes the minimum pairwise `plain` distance between ramp endpoints (index 0 = cold stop, index 4 = hot stop) across all hue pairs for cold and hot margins, plus minimum distances from ramp endpoints/full ramps to NEUTRAL, TRAP, STRUCTURE, and MARK reference colors. Returns a 6-tuple, not the 4-tuple the docstring names.
- predicted: some · documented: some · derivable: no · legible: full · trap: yes
- note: The one-line docstring names only 4 of the 6 returned values (vs_struct and vs_mark are undocumented) — a caller unpacking by the docstring alone would be short two values.

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

### `verify`
- spec 3 · read at `585fb9bf7cc5` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:12:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: verify() hardcodes the shipped palette's stop values (hex or OKLCH triples) for each of the seven ramps, recomputes the same stops by running the palette-search/constraint-solving logic, and compares them channel-by-channel rounded to one decimal — raising/asserting a failure (or printing a mismatch and exiting nonzero) if any channel doesn't match, and printing a success confirmation if all match exactly.
- found: Recomputes each shipped ramp via ramp(), compares to SHIPPED_STOPS hex-by-hex converted to RGB 0-255 and takes the max per-channel integer step difference (not decimal rounding of OKLCH values as I predicted); prints per-ramp diffs plus several margin stats (cold/hot pairs, vs unanalyzed, vs trap, vs structure floor, vs agent-mark) each annotated with the value index.css claims, then returns 0/1 based on whether worst_step <= 1.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The docstring's 'channel-exact-to-one' claim is about the STOPS check, but the function also prints five margins() stats purely for cross-referencing against index.css prose — that reporting role isn't mentioned in the docstring at all.
