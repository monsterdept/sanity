# scripts — sanity assessment

1 of 2 functions read · 0 surprising

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## scripts/make-icon.py

### `pixel` — nearly
- read at `ae8cc24a920f` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A per-pixel colour function for a procedurally generated sunburst app icon: convert x,y to centre-relative coords, derive normalised radius and angle, colour by angle (wedges) and band by radius (rings), background outside the disc.
- found: Exactly that. Computes cx/cy from SIZE, normalised radius r = hypot/(SIZE/2) and theta = atan2 normalised to 0..1. Walks RINGS bands; inside a band it uses SPOKES[i] to find the fractional position within a wedge and returns BG for a thin 3.5% gap at each spoke boundary, else RAMP[min(i+1, last)]. Inner hub (r below the first ring) is RAMP[0]; everything outside is BG.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The colour comes from the ring index only, not the angle — I expected hue to vary by wedge; the `min(i + 1, len(RAMP) - 1)` clamp means RINGS longer than RAMP silently paints the last colour repeatedly.
