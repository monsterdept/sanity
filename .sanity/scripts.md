# scripts — sanity assessment

2 of 2 functions read · 0 surprising

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## scripts/make-icon.py

### `pixel` — as expected
- read at `ae8cc24a920f` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Per-pixel colour function for a procedurally drawn app icon: convert x,y to polar coordinates about the image centre, use radius to decide which ring (or background if outside), and angle to pick the wedge colour — a sunburst pattern returning an RGB tuple.
- found: Exactly that. Normalised radius via hypot, theta normalised to 0..1 via atan2. Scans RINGS for the band containing r, then within that band computes the spoke fraction and returns BG for a thin 3.5% gap at each wedge boundary, otherwise RAMP[i+1] clamped. Inside the innermost ring returns RAMP[0]; outside everything returns BG. Imports math inside the function.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `main` — nearly
- read at `409b7ffe876b` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Entry point of an icon generator: builds an image buffer by calling pixel(x,y) across a canvas, producing the app icon, then writes it out as PNG, probably at several sizes into the Tauri icons directory.
- found: Builds raw scanlines by calling pixel(x,y) with a leading 0 filter byte per row, then hand-encodes a PNG from scratch — a local `chunk` helper doing length/tag/data/CRC32, an IHDR for 8-bit RGB, a zlib-compressed IDAT and an IEND — and writes the single result to src-tauri/icons/source.png, creating the directory and printing the size in kB.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I did not expect a dependency-free hand-rolled PNG encoder — no Pillow — and it emits one source.png rather than a set of sizes.
