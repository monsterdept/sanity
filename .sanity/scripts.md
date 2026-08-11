# scripts — sanity assessment

3 of 3 read · 1 surprising

2 of these graded legibility under an earlier question and are not counted; see the note below.

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

## scripts/make-icon.py

### the file itself — QUIRKY
- read at `fbea559dbc3a` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A standalone asset script generating Sanity's app icon programmatically rather than shipping designed artwork: a pixel(x, y) returning an RGBA colour per point, almost certainly a sunburst/ring motif in the app's temperature palette with alpha for a mask, and a main rendering it at the icon sizes Tauri wants, writing PNGs (perhaps an icns/iconset) into src-tauri/icons/. Expected little module documentation since none was handed over.
- found: The sunburst-in-the-temperature-ramp guess was right, but the shape differs in three ways: it writes exactly ONE 1024px file, src-tauri/icons/source.png, leaving the size derivatives to `just icons`; pixel returns opaque RGB with no alpha, painting an ink background instead of masking; and main hand-encodes the PNG with struct and zlib — scanlines with filter byte 0, IHDR/IDAT/IEND chunks with CRC32 — specifically to avoid a Pillow dependency, on the argument that an icon generator needing pip install never gets re-run. The rings are four fixed radius bands with 3/5/8/13 spokes and thin BG wedge separators, and the file DOES carry a module docstring, contrary to the empty `docs` I was handed.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: The task handed me an empty `docs` for this file, but it opens with a module docstring that states its purpose, its output path and the reason it avoids Pillow — so the scanner appears not to collect Python module-level docstrings as file docs.

### `pixel`
- read at `ae8cc24a920f` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Per-pixel colour function for a procedurally drawn app icon: convert x,y to polar coordinates about the image centre, use radius to decide which ring (or background if outside), and angle to pick the wedge colour — a sunburst pattern returning an RGB tuple.
- found: Exactly that. Normalised radius via hypot, theta normalised to 0..1 via atan2. Scans RINGS for the band containing r, then within that band computes the spoke fraction and returns BG for a thin 3.5% gap at each wedge boundary, otherwise RAMP[i+1] clamped. Inside the innermost ring returns RAMP[0]; outside everything returns BG. Imports math inside the function.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `main`
- read at `409b7ffe876b` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Entry point of an icon generator: builds an image buffer by calling pixel(x,y) across a canvas, producing the app icon, then writes it out as PNG, probably at several sizes into the Tauri icons directory.
- found: Builds raw scanlines by calling pixel(x,y) with a leading 0 filter byte per row, then hand-encodes a PNG from scratch — a local `chunk` helper doing length/tag/data/CRC32, an IHDR for 8-bit RGB, a zlib-compressed IDAT and an IEND — and writes the single result to src-tauri/icons/source.png, creating the directory and printing the size in kB.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I did not expect a dependency-free hand-rolled PNG encoder — no Pillow — and it emits one source.png rather than a set of sizes.
