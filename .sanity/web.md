# web — sanity assessment

335 of 335 read · 66 surprising

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

## web/src/App.tsx

### the file itself
- spec 3 · read at `4619286609e9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:33Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This is the top-level React app component that owns overall UI state: selecting/switching projects, holding the scanned tree, and orchestrating the scan lifecycle. It renders a progress UI (useProgress hook, ProgressTrack/ProgressStrip/ProgressPane, phaseLine) showing streaming scan phases, includes helpers to compare state across re-renders (sameRun, sameIds, sameProjects) to avoid unnecessary resets, tree-lookup helpers (findById, parentOf), a HistoryToggle for switching some historical view, and an Empty state component for when there's no data yet. No file doc header exists, meaning the file's purpose isn't documented at the top.
- found: Top-level React app component owning all app state (active project, scan tree, live progress, streamed rings, agent/mascot activity, theme, git-history replay/timeline/tracing, selection/drill/crumb navigation, and dialogs) and rendering the whole shell (sidebar, mode switcher, sunburst map or loading placeholder, legend, history scrub bar, side panel). Helpers below App: noop (no-op handler for the placeholder sunburst), sameRun/sameIds/sameProjects (equality checks to skip redundant re-renders on poll ticks), findById/parentOf (tree lookups for re-resolving selection after rescan and for crumbs), readingSignature (FNV-1a hash to detect unchanged agent-report polls), useProgress/ProgressTrack/phaseLine/ProgressStrip/ProgressPane (progress UI), HistoryToggle (toggle git-history replay mode), Empty (first-run/no-projects screen). No file-level doc comment exists.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `noop`
- spec 3 · read at `f3e401aaede9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A trivial no-op arrow function that takes no meaningful action and returns undefined, used as a placeholder event handler (e.g. onClick/onSelect) for UI elements during an in-progress scan where interaction isn't yet meaningful.
- found: A trivial no-op arrow function that does nothing.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `sameRun`
- spec 2 · read at `86068e088b4f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Compares two `run` objects field by field (not by reference) to decide if the sidebar/progress display should treat them as unchanged, since the polling loop always allocates fresh objects. It likely checks every field the progress UI reads — including `assessed`, `live`, and counts — returning false if any differ, since the doc says an omitted field caused stale progress to be shown after a run finished.
- found: Null-safe field-by-field equality check on a run object's progress fields: running, stopping, live, spawned, finished, failed, readers, ended.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The doc text handed to me actually describes `sameProjects` ('Do two project lists say the same thing?') not `sameRun` — it's about comparing project lists, while sameRun compares a single run's fields (running/stopping/live/spawned/finished/failed/readers/ended), and never mentions an `assessed` field at all, so the docs are for a sibling function, not this one.

### `sameIds`
- spec 2 · read at `6c45514e1a3d` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:35Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Treats undefined a/b as empty arrays, then returns false if lengths differ, otherwise returns true only if every element at each index matches (a.every((v, i) => v === b[i])).
- found: Exactly as predicted: nullish-coalesces both to [], compares length, then every element by index.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `sameProjects`
- spec 3 · read at `00fe71533864` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:38Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A structural-equality check used to decide whether a freshly polled project list actually differs from the current one, so React state isn't replaced with a value that's equal but a new reference (avoiding pointless re-renders). It compares array lengths, then for each index compares the relevant ProjectSummary fields (key, name, maybe run status via the `sameRun` peer), returning false as soon as it finds a difference and true if everything matches.
- found: Field-by-field structural equality across ~20 ProjectSummary fields (identity, counts, scan/read progress including phase/unit, harness/model settings including banked models via sameIds, reading and run state via sameIds/sameRun), used to avoid replacing poll state with an equal-but-new-reference value; each comment explains why a specific field can't be dropped from the comparison without causing a stale UI.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Underestimated scope — expected a handful of identity fields, not a near-exhaustive comparison of ~20 fields each defended by its own comment about what breaks if omitted.

### `findById`
- spec 2 · read at `977918682157` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:34Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the Node tree (checking node.id against the target, then descending into children) doing a depth-first search, returning the matching node or null if not found anywhere in the subtree.
- found: Recursive depth-first search over node.children comparing node.id, returning the matching node or null.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `readingSignature`
- spec 3 · read at `4af70cb96078` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:45Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Builds an FNV-1a hash by iterating over reports, feeding in each report's id/existence, the body/function signature it was taken against, and the grade fields (explicitly skipping found/note prose) into the hash accumulator, then returns the resulting hash as a hex string.
- found: Implements FNV-1a hashing inline (offset basis 0x811c9dc5, prime 0x01000193) over a concatenated string of each report's id, at, body, predicted, documented, legible, trap, derivable, legibleDated, trapDated fields (explicitly excluding found/note). Returns "count:hash" as the signature string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `parentOf`
- spec 3 · read at `5c75a1c9f25b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:46:50Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the tree from `node`, checking if any of `node`'s direct children have the given `id`; if so returns `node` as the parent. Otherwise recurses into each child and returns the first non-null match found, or `null` if `id` isn't found anywhere in the subtree.
- found: Recursively searches node's children for one matching id; returns the immediate parent if found among direct children, else recurses into children and returns first found parent, else null.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `App` — TANGLED
- spec 3 · read at `5dc2428e14cd` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:53:49Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: The root React component: owns the top-level app state (selected project, current tree/scan result, progress via useProgress, drill-in/selection path, lens choice, agent run state) and wires up Tauri event listeners (scan-shape, scan-progress, scored) to update that state as scans stream in. It renders the overall layout — sidebar/project list, the sunburst itself, progress UI (ProgressStrip/ProgressPane), and history toggle — delegating most rendering to child components while holding the coordinating state and effects here, given the file's size (~2000 lines) this is likely a large, sprawling component doing a lot of orchestration.
- found: A ~2000-line root component owning scan/tree state, streamed-batch state (scores/shape/function-rings, each flushed on an interval with a "drain before updater" discipline for StrictMode safety), navigation/selection/lens state with per-project view banking, project/session polling with a "follow whichever project an agent is working on" inversion pattern, and a full separate history/replay subsystem (frame reconstruction from tables+deltas, scrub transport, commit log) — rendering a sidebar + central sunburst/progress/onboarding pane + right detail/commit-log panel plus several modals.
- predicted: most · documented: none · derivable: no · legible: some · trap: no
- note: My prediction correctly anticipated a large orchestration component with tree/progress/selection/lens/agent state and event wiring, but missed entirely that half the file is a parallel replay/history subsystem, the poll-based "follow the agent's project" inversion pattern, and the repeated drain-before-updater batching discipline.

### `useProgress`
- spec 3 · read at `567112bc1bd9` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:35:05Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is a React hook that takes a `Progress` object and returns `{ pct, eta }` (or similar) — `pct` is computed as done/total, defaulting to 0 when there's nothing yet. It tracks progress samples over time in a ref (timestamped snapshots) to estimate a rate, and only starts returning a non-null `eta` once enough samples have accumulated to make the estimate meaningful, using `useEffect`/`useRef` rather than deriving eta purely from the current `progress` object.
- found: pct is done/total (0 if no total). A single `mark` ref (not an array of samples) holds a {phase, done, at} snapshot that resets whenever progress.phase changes. eta is computed from how much has moved and how much time has passed since that mark, gated by two thresholds (moved > 20 AND watched > 5s) so a burst or an idle stretch alone can't produce a false estimate; otherwise eta is null.</found> <parameter name="note">The outer doc comment (about ETA history/withholding) and the inline comment above the hook body both explain rationale not visible in the code itself — the dual-threshold and phase-reset design are load-bearing but only justified in prose.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ProgressTrack`
- spec 2 · read at `02dad8fe74e4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:32Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a track div with a fill element whose width is derived from pct; when progress is null (no total yet) it applies an indeterminate/sweeping CSS class instead of setting a fixed width, since there's no total to be a fraction of.
- found: Renders a track div; when progress is truthy, an inner fill div with width set to pct*100% (with a transition); when progress is null, renders a differently-classed "track-sweep" div for an indeterminate animation.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `phaseLine`
- spec 3 · read at `ffefd66fc1c4` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:59Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a status line like "Parsing 67,511 / 111,029 files" from the Progress object, using the phase name and unit string exactly as sent by the backend (not hardcoded), and formatting the done/total counts with thousands separators via toLocaleString for readability.
- found: Capitalizes the phase name (defaulting to "Working" if absent), shows just "Phase…" when total is 0, otherwise formats done/total with toLocaleString separators plus an optional unit suffix pulled from the wire.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc explains why unit/phase come off the wire rather than being hardcoded, but says nothing about the total===0 or missing-phase fallback branches.

### `ProgressStrip` — QUIRKY
- spec 3 · read at `ca51c8550529` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:17Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders a small boxed one-line status chip (styled like the caveat chip in the graph's corner) that shows the current scan phase/progress text — likely built via `phaseLine(progress)` — so that even once the map looks fully drawn, the reader can still see that a slow pass (like git blame) is still running behind it. Probably returns null or renders nothing when progress indicates the scan is fully done.
- found: A boxed one-line strip showing the phase text (phaseLine), a small progress bar (ProgressTrack, fed by pct from useProgress), and an ETA in minutes when available — always rendered, no early-exit for "done".
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I predicted the phase-text chip but missed that it also includes a progress bar and an ETA readout — the visible bulk of the component beyond the caption.

### `ProgressPane`
- spec 3 · read at `1ae798993fe4` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:17Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders a centered, wider progress indicator (reusing something like ProgressTrack/phaseLine) showing the current scan phase and the optional label, used as the empty-pane loading state before any map exists — analogous to ProgressStrip but standalone rather than docked beside a readable map.
- found: Centered flex column showing a phase label (from progress via phaseLine, or a fallback label/default text), a ProgressTrack bar sized via useProgress's pct, and an ETA line in minutes when available.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `HistoryToggle`
- spec 3 · read at `9067ac741431` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a small toggle button that switches the view between "live" and "history" replay mode. It's disabled (or hidden) when `traced` is false, since there's no commit trace to show, and reflects `on`/`busy` state in its label or styling (e.g. showing "History" vs "Live", or a loading indicator when busy). Clicking calls `onToggle()`, but per the docs, this component never itself triggers the trace-building work — that's initiated elsewhere.
- found: A styled toggle button. It's disabled only when trying to enter history mode without a trace or while busy (!on && (busy||!traced)) — leaving is always allowed regardless of busy/traced state. Label is either "Tracing…" (busy) or "History"; the title attribute gives contextual tooltip text for each of the four on/busy/traced states; styling (background/color/weight/shadow/opacity) reflects the `on` state.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment explains the important invariant (never commission work, always allow leaving) but the actual disabled-logic asymmetry and tooltip text had to be read to get right.

### `Empty`
- spec 2 · read at `c802f4eaedc1` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:08Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering the first-run empty state: primarily a single "add repo" call-to-action button wired to onAdd, plus a checkable prerequisite line (is claude/codex installed?) rather than a paragraph explaining the product, and a small MCP-related sentence at the bottom instead of a full connect-agent setup flow. No dismissal state is persisted since the screen only shows when there are zero projects.
- found: Renders the first-run empty state: title, short pitch, an "Add a repo" button, a checked-agent status line (claude/codex installed), a demoted mention of `sanity check` CLI, and a substantial CLI-on-PATH section that checks whether the `sanity` command resolves to this app and offers a button to link it, with several states for linking in progress/success/conflict.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

## web/src/CodeWindow.tsx

### the file itself
- spec 2 · read at `762905383664` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:56:10Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: This is the standalone entry point/root component for the popped-out code window (the one CodeView's onPopOut spawns): it reads repo/file identifiers (likely from URL query params or window args), loads/locates the target file node via fileByPath, and renders CodeView in its own window without an onPopOut handler (since a pop-out window popping out again is meaningless) but possibly with onClose wired to closing the window.
- found: Standalone popped-out window component taking repo/relPath as props (not URL params); re-resolves the file node from a fresh project scan (not shared state, since it's a separate JS context), watches system theme independently, renders a custom draggable titlebar, and passes to CodeView with no onSelect/onPopOut/onClose wired up since this window IS the code view.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Guessed URL query params for identifying repo/file where it's actually React props, and guessed there might be an onClose handler when in fact there's deliberately neither pop-out nor close.

### `fileByPath`
- spec 2 · read at `b2957f945f19` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:19Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively searches the Node tree starting at `node`, comparing each node's own path field to the target `path` and returning it on an exact match, otherwise recursing into `children` (likely short-circuiting into only the directory whose path is a prefix of the target) and returning null if nothing matches.
- found: Plain recursive depth-first search: returns node itself if it's a file matching the path, otherwise brute-force recurses into every child regardless of prefix, returning the first hit or null.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed an optimization (only descending into the directory whose path prefixes the target) that isn't there — it's an unoptimized full tree walk.

### `CodeWindow`
- spec 2 · read at `24f3c2c44870` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:45Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads repo/relPath props, looks up the file node via the fileByPath peer helper against the app's already-loaded scan state (from a shared store/context), handles a not-found/loading case, and renders the same code-view component the main window uses to show one file's source with syntax highlighting.
- found: Fetches the project list and scan via API calls (listProjects/projectScan) rather than reading held app state directly, finds the file with fileByPath, and renders loading/error/found states. Found state renders a custom draggable titlebar strip (Tauri drag region) with the relPath, plus theme sync via watchSystemTheme(loadTheme()), and the CodeView component with no pop-out/close since this window IS the code view.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/AgentMascot.tsx

### the file itself — QUIRKY
- spec 3 · read at `87ea6248950a` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A small React component (~34 lines) that renders a simple visual mascot/avatar representing an AI agent in the UI, probably an inline SVG icon or emoji-based badge, with minimal props (maybe size or a status/active flag) and no complex state or animation logic.
- found: A thin lazy-loading wrapper: it defers importing the heavy (~1.2MB, three.js-based) MascotFigure component via React.lazy, shows a sized placeholder span in a Suspense fallback to avoid layout reflow, and otherwise just forwards size/events/state/gaze/project/remint props through to the real 3D mascot component once loaded.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `AgentMascot`
- spec 3 · read at `8e1655967690` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:29Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A lazy-loading wrapper around `MascotFigure` (which lives in its own module for chunk-splitting). Uses React.lazy/Suspense to import MascotFigure, forwarding all the same props (size, events, state, gaze, project, remint), and renders a fixed-size placeholder box as the Suspense fallback so the row doesn't reflow while the chunk loads.
- found: Suspense wrapper around the lazily-imported MascotFigure, forwarding all props, with a same-sized empty span as the fallback to prevent reflow.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/Bloom.tsx

### the file itself
- spec 2 · read at `60c22cf4f758` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:03Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a decorative "empty state" field of mathematically-generated flowers filling an unused right pane. petals() builds an SVG path from the fattened rhodonea rose-curve formula (r = a·|cos(kθ)|^(1/P)); seedHead() draws the flower's center; Flower composes petals+seedHead (with randomized parameters like size/rotation/petal count/color); Leaf adds foliage; Tile arranges/repeats flowers across the pane in a scattered/tiled pattern; Bloom is the exported top-level component rendering the whole field.
- found: Renders a p6m wallpaper-group pattern of flowers/leaves for the empty pane: petals() and seedHead() build a fattened rhodonea rose and Vogel phyllotaxis seed disc; Flower/Leaf compose them; Tile places large flowers at 6-fold lattice centers, smaller flowers at 3-fold centroids, and leaves at 2-fold edge midpoints per crystallographic symmetry (not random scatter); Bloom draws the tile nine times per repeat via an SVG pattern to avoid edge-clipping artifacts, deliberately without patternTransform rotation.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted 'scattered'/randomized placement, but the actual placement is rigorously derived from p6m wallpaper-group symmetry centers — a much richer design than a random field, which the extensive doc comment explains in detail.

### `petals`
- spec 2 · read at `b23b73eb35ae` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:22Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Samples theta across a full rotation (or the range needed for k petals), computes r = a * |cos(k*theta)|^(1/P) at each sample, converts each (r, theta) polar point to (x, y) cartesian coordinates, and joins them into an SVG path "d" string (moveto + lineto or curve commands) tracing the fattened rose-curve petal outline.
- found: Samples 240 steps of theta over 2π, computes r via the fattened rose curve formula, converts to cartesian (r*cos, r*sin), and builds an SVG path string with M for the first point and L for the rest, closed with Z.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The extensive file_doc explaining the math (Grandi's rhodonea, fractional-power fattening) is genuinely non-derivable from the terse code alone — the code just applies the formula without naming it.

### `seedHead`
- spec 2 · read at `b0599e867627` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:35Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Generates a small cluster of circles (cx, cy, r) representing the flower's central seed disk, likely using a phyllotaxis/golden-angle spiral (Vogel's model) to place seeds in a packed circular pattern with radius growing as sqrt(index).
- found: Places 13 seeds at golden-angle increments (n*GOLDEN) with radius scaling as A*0.115*sqrt(n), each a fixed small dot radius A*0.05 — classic Vogel phyllotaxis spiral.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `Flower` — QUIRKY
- spec 2 · read at `9c287bf640f8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:32Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders an SVG group scaled by s, composing the petals() helper (drawing the fattened rhodonea rose-curve path from the file doc) with a central seedHead element, assembling one flower shape. No component-level docs since the math is explained at file level.
- found: Draws a filled PETALS path (a precomputed constant, not a call to a petals() helper), then the same PETALS path again as an outline scaled to 0.45 (reusing the same rose-curve shape rather than redrawing at a different k), then maps a SEEDS array of precomputed circles for the center. No seedHead call.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: I assumed petals()/seedHead() were called as functions; instead PETALS and SEEDS are precomputed module-level constants used directly, and the center is drawn as discrete seed circles rather than a single seedHead element.

### `Leaf`
- spec 2 · read at `4bb9b5c8f261` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:58Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders an SVG path drawing a vesica piscis (lens) shape made of two arcs from two equal overlapping circles, each passing through the other's center, scaled by the `s` prop. Likely returns a <path> element with an arc-based `d` string, possibly filled green as a leaf.
- found: Renders a scaled <g> containing a vesica-shaped path (two arcs of radius R between two points ±L on the x-axis) filled/stroked with currentColor at low opacity, plus a center line stroke as the leaf's spine.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Guessed "filled green" but it actually uses currentColor (inherits from parent), and I didn't anticipate the extra spine line down the middle.

### `Tile` — QUIRKY
- spec 2 · read at `1b3b535c7b4d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:48Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A React component with no props that picks randomized parameters (rotation, scale, position jitter, maybe seed/color) via useMemo/useState and renders a <Flower> (or <Leaf>) inside a positioned wrapper — one repeatable cell used to tile the empty right pane into a scattered field of flowers.
- found: Deterministically renders one repeating SVG tile: fixed sets of precomputed lattice points (SIXFOLD, THREEFOLD, TWOFOLD) placing full-size Flowers, smaller rotated Flowers, and Leaves at exact translate/rotate transforms — no randomness at all, it's a symmetric tiling unit.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: Assumed randomized placement; it's actually a fully deterministic symmetric lattice using precomputed point arrays.

### `Bloom` — QUIRKY
- spec 3 · read at `41d6c7d9f291` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:53Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the decorative empty-state illustration: a scattered field of flowers built from the rhodonea-curve petal math described in the file doc, using helper functions/components (petals, seedHead, Flower, Leaf, Tile) to generate several flowers at varied positions/sizes/rotations inside an SVG or div wrapper, accepting an optional className to merge into the container.
- found: Renders a full-bleed SVG with a repeating <pattern> built from a grid of Tile components offset by OFFSETS, filling a background rect with that pattern — a tiled decorative field rather than directly-placed individual flowers.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The comment explains why patternTransform rotation was removed (looked crooked, not deliberate) — irregularity is meant to live in the Tile/motif rotations instead, which isn't visible from this function alone.

## web/src/components/CodeView.tsx

### the file itself
- spec 2 · read at `66673a4454f9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:14:00Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A React component file rendering a source-code viewer: tokenize() does lightweight syntax tokenization of a file's text, ownerByLine() maps each line number to which function/entry owns it (for highlighting the selected function), rampStops/rampAt compute a color ramp (likely for a heatmap overlay showing score/staleness/authorship per line), Minimap renders a small scrollable overview alongside the main CodeView component which composes all of this into the actual code panel with syntax highlighting and a minimap scrollbar.
- found: A React component rendering one file's source as a table of lines with a lightweight regex tokenizer for syntax coloring, a per-line "heat" wash/gutter derived from which function (owner) covers that line and its analysis score, click-to-select on a line's owning function, scroll-to-reveal-a-function behavior, and a canvas Minimap alongside showing the whole file's heat profile plus indentation silhouette, clickable/draggable to navigate.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level header doc exists (docs was empty) — the file has no top summary comment, though individual functions/components inside are heavily commented.

### `tokenize`
- spec 2 · read at `d364f0c54271` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A lightweight syntax-highlighting tokenizer — takes a single line of source code and regex-matches/splits it into an array of Tok objects (each with a type like keyword/string/comment/identifier/punctuation and the matched text), likely using one alternation regex iterated with matchAll or exec in a loop, for CodeView to render with per-token styling.
- found: Single alternation regex exec'd in a loop over the line, classifying each match into comment/string/number/word(keyword-or-plain)/space/punct tokens with fixed class names, ordered so comments and strings win over other patterns.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `ownerByLine`
- spec 2 · read at `39b85adfda97` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:18Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a Map from 1-indexed line number to the Node (chunk/function) that covers it, by iterating over the file's child nodes (each with a start/end line range) and, for each line in that range, setting map[line] = node. Likely handles overlapping/nested nodes by letting later (perhaps more specific) nodes overwrite earlier ones.
- found: Iterates file.children, skipping non-'func' nodes and those with a null line, then for each line from fn.line to fn.endLine (falling back to fn.line if endLine is null) sets map.set(line, fn). Returns the resulting Map.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `rampStops`
- spec 2 · read at `5a30a1533442` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:53:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Reads the getComputedStyle of the given element to pull out the five heat-ramp CSS custom properties (hex color strings), parses each hex string into an [r, g, b] number triple, and returns them as an array in ramp order — feeding a canvas-based color interpolation (rampAt) that can't use CSS color-mix() directly.
- found: Reads five `--heat-0` through `--heat-4` CSS custom properties via getComputedStyle, parses each hex color string into an [r,g,b] triple (with a gray fallback), and returns them in order for canvas-based interpolation.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `rampAt`
- spec 2 · read at `815003ab0e2f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Given a sorted array of [position, value1, value2] color stops and a query t, it finds the two stops bracketing t, linearly interpolates between their component values, and returns a CSS color string (e.g. rgb(...) or hsl(...)) representing the ramp color at that point — used for the minimap's heat/color gradient.
- found: Treats stops as evenly-spaced [r,g,b] triples (no explicit position field), maps t (clamped 0-1) into the stop index space, linearly interpolates each RGB component between the two bracketing stops, and returns an rgb(...) CSS string.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Assumed each stop carried an explicit position value; actually stops are just evenly spaced by array index.

### `Minimap`
- spec 2 · read at `a5d4d74a6d60` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:22Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a canvas (or absolutely-positioned divs) drawing one thin bar per line, sized/positioned by that line's leading indentation and length, colored by a heat ramp (via rampAt) looked up per-line through ownerByLine. It listens to scroller's scroll position (re-rendering on scrollTick) to draw a viewport-indicating overlay rectangle, offset by insetTop, and supports click-to-scroll/jump to the clicked line in the main code view.
- found: Draws a full-file minimap onto a canvas: one heat-colored background bar per analyzed line (via rampAt/paintHeat), one indentation-shaped foreground bar per line of text (dimmed for comment lines), and a translucent rectangle showing the current scroll viewport. Supports click/drag (pointer capture) to seek, centering the scroller on the clicked line.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `CodeView` — TANGLED
- spec 3 · read at `2952957d6362` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:00Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the file's source lines with a colored heat gutter per line (via tokenize/ownerByLine/rampAt/rampStops), highlights the selected node's line range, scrolls to and flashes the reveal target (using the nonce to force re-scroll on repeat), and renders a Minimap alongside plus header controls (onPopOut/onClose buttons, conditionally shown).
- found: Fetches file source via readSource in an effect, shows loading/error states, computes owners-by-line and renders each line as a table row with a heat-colored gutter bar and background wash, highlights the selected node, shows a scroll-triggered nonce-driven reveal effect (deliberately excluding `file` from deps to avoid snapping back on tree re-renders), tracks a scrollTick counter for the Minimap, and renders pop-out/close buttons plus a Minimap sibling.
- predicted: most · documented: some · derivable: no · legible: some · trap: no
- note: The scroll-to-reveal effect intentionally omits `file` from its dependency array because the tree is rebuilt as a new object every poll — worth flagging since eslint-disable comments like this are easy to "fix" by mistake.

## web/src/components/ColorKey.tsx

### the file itself
- spec 3 · read at `09914832d330` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:10Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A React/TSX module implementing a chart "color key" (legend) UI: a main ColorKey component that composes a ColorLegend (rendering color swatch + label rows for categories/values) and a Legend (shared/generic legend wrapper), plus a ModeSwitcher letting the user toggle between coloring modes (e.g. categorical vs sequential, or light/dark). No header docs, so intent is inferred from names/shape alone; expect local state for the active mode and a mapping from data categories to colors.
- found: The file has no top-level ColorKey component; instead it exports ModeSwitcher (a segmented-tab control for picking one of several color modes) and ColorLegend (a boxed legend that renders Legend, a component with a distinct branch per color mode: history events, categorical swatches capped at SLOTS with an "Other" bucket, a boolean trap swatch, a two-state reach swatch, a locality-specific mixed ramp, and a generic heat-ramp gradient for the remaining modes), plus stale/unread swatch indicators shown only when relevant. Extensive inline comments justify each rendering choice (why squares vs bars, why certain modes get no key, color-consistency with the chart itself) rather than describing mechanics.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: Comments carry design rationale (why a scale/swatch shape was chosen per mode) that a stranger cannot re-derive from the JSX alone; that's the valuable part of this file.

### `Legend` — QUIRKY — TANGLED
- spec 3 · read at `7b288b19048a` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:12:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Legend branches on `mode`: for a categorical color mode it renders a swatch + label per entry in `categories`; for a gradient/heat mode it renders a continuous color ramp with min/max labels instead of enumerating categories, since per the doc a gradient would falsely imply order on unordered categories. The `history` flag likely toggles a dimmed/secondary rendering style or adds a label marking entries as historical.
- found: Legend renders a different key depending on mode/history: history mode shows birth/touch event swatches; categorical mode shows per-category dot+label up to SLOTS with an "Other" bucket; traps mode shows a single boolean swatch; reach mode shows a two-state swatch pair; locality mode shows its own heat ramp with home/reach-out labels; and the remaining scalar modes (surprise, legible, docs, churn, age) share a generic lo/hi heat-ramp renderer keyed off an ends map and a ramp selector.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The single doc line only explains the categorical-vs-gradient distinction; it says nothing about the traps/reach/locality/history special cases, which each carry their own inline rationale comments not surfaced in the docs field.

### `ModeSwitcher`
- spec 3 · read at `3f0b5702606e` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:35:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a row of buttons (one per ColorMode value) positioned absolutely over the graph; the active mode is visually highlighted, clicking a button calls onMode(m) to switch. When disabled is true, buttons are grayed out/non-interactive but the current selection is still shown, per the doc comment about history mode.
- found: A segmented tablist control rendering one button per ColorMode, highlighting the active one with a raised pill style, disabling/graying out on `disabled`, and showing a tooltip with either an explanation (disabled) or the mode hint plus a computed ⌘-number shortcut.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The prop-level doc comment explains only the `disabled` semantics (history mode); the visual/interaction design (segmented control, why the shortcut lives in the tooltip not the chip) is explained by inline comments not visible from the signature alone.

### `ColorLegend`
- spec 3 · read at `9fc93b90c8ac` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:55Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a boxed legend (styled to visually pair with ModeSwitcher) listing each category in `categories` with its corresponding color swatch and label, using `mode` to determine the color mapping/title text. Conditionally appends a "stale" hatch-textured entry when stale > 0 and an "unread" flat-gray entry when unread > 0, and when `history` is true it adjusts wording to describe the transient replay flash rather than the persistent pinned color lens.
- found: A boxed wrapper that delegates the category swatches to a `<Legend>` subcomponent, then conditionally (only in reading-painted modes, and only when there's something to show) appends stale-hatch and unread-gray entries as hand-reproduced CSS swatches matching Sunburst's own styling.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The gating condition `paintsFromReadings(mode)` isn't derivable from the signature — only found by reading the body — so a caller relying on stale/unread props alone would miss that they're silently ignored outside reading-painted modes.

## web/src/components/CommitLog.tsx

### the file itself — QUIRKY
- spec 3 · read at `8ec0f3d1e324` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:47Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A React component (CommitLog) that renders a scrollable list of git commits for a file or function, showing per-commit author, relative timestamp, and message/summary — likely used in a detail panel when a user inspects a node's history. The `stamp` helper probably formats a raw epoch/ISO timestamp into a human-readable relative time string (e.g. "3 days ago") for each commit row.
- found: A virtualized, paginated commit log synced to a replay/timeline playhead: it windows thousands of commit rows (fixed ROW_H, OVERSCAN), fetches pages of PAGE rows on demand with a cap on in-flight requests, follows the playhead's scroll position while playing (throttled) or scrubs into view when paused, dims upcoming commits with an overlay, and lets clicking a row jump the playhead — all built for a repo-history "replay" UI, not a simple static list.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: There's no file header doc at all — every design rationale (windowing, pagination, playhead-follow throttling, memoized rows) lives in dense inline comments above each piece, so a reader has to assemble the file's purpose from those rather than a summary.

### `stamp`
- spec 2 · read at `007bc6229dfa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a Unix timestamp ts and formats it into a short human-readable string (e.g. via new Date(ts) and toLocaleTimeString/toLocaleString) for display next to a commit log entry.
- found: Converts a Unix seconds timestamp to a short locale date string like "Aug 13" (month + day, no time).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `CommitLog` — QUIRKY
- spec 3 · read at `1c5807f9202e` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Fetches/pages commit rows from repoPath/tables, filters or narrows them by `scope` and `frames`, and renders them oldest-first as a memoized, non-re-rendering static list. On top of that static list it renders two absolutely-positioned overlay elements — a cursor at the row corresponding to `index` and a scrim covering rows after it (not yet reached) — so scrubbing/playback only moves those two elements instead of re-rendering every row. While `playing` is true, an effect auto-scrolls the pane to keep the cursor in view; clicking a row calls `onIndex` to seek.
- found: Windowed/virtualized, paged commit list (fetches PAGE-sized chunks with a bounded in-flight count, dropping pages far from the viewport) rendering only the rows within the scrolled viewport plus overscan; a single absolutely-positioned scrim dims everything past the current position, while selection highlighting is a prop into memoized Row components. A layout effect follows the playhead differently depending on state: centers and throttles while playing, does a minimal reveal when paused/scrubbed externally, and is skipped entirely when the position changed from a click inside the list itself.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: My prediction captured the overlay/no-re-render idea from the docstring but completely missed that this also does viewport virtualization and incremental page-fetching with an in-flight cap — that's the majority of the function's actual logic and isn't hinted at in the top-level doc comment, only in inline comments deep in the body.

## web/src/components/Crumbs.tsx

### the file itself
- spec 2 · read at `f854d81892ed` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:18Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a breadcrumb trail for the current path/directory, splitting it into clickable segments so the user can navigate up to any ancestor directory. Likely takes a path string and an onNavigate callback prop, maps path segments to clickable spans/buttons separated by a delimiter (e.g. "/"), and highlights or disables the last (current) segment.
- found: A breadcrumb nav component showing the ancestry trail (root to current node) as clickable buttons, plus a separate "Up" button. Collapsed single-child chains keep their internal slashes dimmed so the node reads as one place, while inter-crumb separators stay the louder visual mark.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Doc comment explains non-obvious history (trail is ancestry not drill-stack, past bug with single-link rendering) that couldn't be derived from the code alone.

### `Crumbs`
- spec 2 · read at `9197413e9b46` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:00Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders the breadcrumb trail as a row of clickable spans, each calling onGo(index) on click, with the current (last) node rendered non-clickable or differently styled. A crumb name that contains slashes (a collapsed single-child chain) has its internal slashes dimmed, while the actual separators between distinct crumbs are the brighter mark. If onUp is provided, it renders an additional "up" affordance that calls it.
- found: Renders each trail node as a button calling onGo(i), with the last node still clickable (recenters) but bold/foreground-colored instead of accent; internal slashes within a collapsed-chain name are dimmed (opacity-40) while true crumb separators are opacity-50; ends with an Up button disabled when onUp is absent.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted the last crumb as non-clickable, but it's still a button — clicking it re-centers on the current node.

## web/src/components/Detail.tsx

### the file itself
- spec 2 · read at `370e7a058a92` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:04Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: This is the main detail/report pane component for a selected node — it renders the function's markdown-formatted report/finding text (via a Markdown subcomponent), a CopyButton for copying it, and supporting pieces like rank/grade/provenance badges summarizing the assessment, plus a Contents component for in-page navigation. No file-level doc comment exists, which given the project's habit of writing extensive rationale-heavy docs elsewhere is notable — this file was likely considered self-explanatory UI code rather than carrying product-level decisions worth documenting.
- found: Detail.tsx is the main right-hand detail pane: it renders the selected node (file/dir/function), with a mini markdown renderer, copy buttons, rank/measure helpers for the Contents list (sortable by color mode), a grade fold helper, and a provenance sentence. It handles many UI states — no selection (Summary/Bloom), directory/file container (delegates to Summary), and the leaf function case with dials, expected/found reading text, trap/note styling, hotspots evidence, and a pinned provenance footer. Extremely dense inline commentary explains many past UI bugs and layout decisions.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level doc comment despite being one of the most heavily-commented files seen so far — comments are all per-decision/per-line rather than a summarizing header.

### `Markdown`
- spec 2 · read at `799387943ea1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Splits input text on backtick code spans first (protecting identifiers from further parsing), then within remaining segments applies regex transforms for **bold** and *italic*, then splits on blank lines into paragraphs. Returns an array of React nodes/fragments.
- found: Splits on backtick code spans first, renders those as <code> with a color-mix background derived from currentColor so it looks right on any panel background. Then within remaining text splits on **bold**/*italic* regex and wraps in strong/em/span. Finally splits the whole text on blank lines into <p> elements.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `CopyButton`
- spec 2 · read at `e3b423a23636` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:38Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a button (labeled/tooltipped via `title`) that calls navigator.clipboard.writeText(text) on click. It tracks a local "copied" state that flips to true only after the clipboard write promise resolves (not optimistically), briefly showing a "Copied" indicator/icon before reverting via a timeout, and stays silent/unchanged if the write rejects.
- found: A button with a `done` state toggled true only when the clipboard write promise resolves (false on rejection), auto-reverting after 1200ms via a cleanup timeout; swaps between an icon (copy vs checkmark) and its title/tooltip text based on `done`, stops click propagation, and uses opacity transitions to stay quiet until hovered/focused.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `rank` — QUIRKY
- spec 3 · read at `affbfc96e743` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:34:55Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Switches on `mode` (the same ColorMode used to color the sunburst ring) and returns a numeric field from node `n` — e.g. its surprise/temperature score, size (lines), or coverage/documentation percentage — so that a list of nodes can be sorted by whatever quantity is currently driving the visualization's coloring.
- found: Returns -1 if the node has no score. Otherwise branches per ColorMode: churn returns raw churn (or -1 if age unknown), age returns negated lastTouchedDays so recent sorts first, reach returns 1/(1+callers) so unreferenced/far-flung nodes rank first, locality delegates to localityOf, and the default falls back to wedgeHeat(n).
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc line only names it as "what the list ranks by" — it doesn't hint at the sign-flip/reciprocal tricks each mode uses to keep 'most notable' sorting first.

### `measure` — QUIRKY
- spec 3 · read at `1bddac282c0c` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:18Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a Node and a ColorMode (like "rank", "grade", "provenance", "size"), this is a switch/if over mode that picks the single relevant numeric/text value off the node and formats it into a short string with its unit suffix baked in (e.g. "42%", "3.2kb"), returning null when that mode doesn't apply to this node (e.g. no grade available). It's a formatting helper feeding a fixed-width column in the Detail view.
- found: A per-mode switch that formats one value into a fixed-width string: blame returns null (author swatch already conveys it), churn shows commit count ×, reach shows caller count ×, locality shows % external, age shows relative day count or "today", surprise shows either a categorical heat word or a rounded degree number depending on whether the node was model-scored vs rule-read, and the default falls back to line count.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: The mode names (blame/churn/reach/locality/age/surprise) aren't guessable from the peers list, which only showed unrelated sibling functions like rank/grade/provenance.

### `grade`
- spec 2 · read at `640703ed95d9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:25Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns r.predicted directly if present; for older reports that only have the boolean r.surprised field, folds surprised:true to 'none' and surprised:false to 'full', matching the fold Report::grades does in Rust so old and new readings share one scale.
- found: Returns r.predicted if present, else folds the legacy boolean r.surprised to 'none' (true) or 'full' (false).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `provenance` — QUIRKY
- spec 2 · read at `8e1a3baa6031` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:53:11Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds a short human-readable sentence describing the source of the displayed stats for this node — e.g. how many readings/predictions it's based on and which model produced them (falling back to some generic phrasing like "mixed models" or "no readings yet" when model is null) — for display as a caption/tooltip near the numeric summary in the Detail panel.
- found: Branches on node.score.source: 'Not read yet' if unanalyzed; for agent-sourced scores, 'Read by {model · by}{ at time}' (falling back to 'an agent over MCP' if no identity); for model-sourced, 'Measured by {model}'; otherwise 'Measured by {model ?? the offline proxy}' — a small decision tree over provenance categories rather than a generic reading-count sentence.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Assumed a reading-count-based sentence; actual logic is a source-category branch (agent/model/offline-proxy/unread) with no counting at all.

### `Contents`
- spec 2 · read at `06ab2255d111` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:12Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Component that renders `node.children` as a sortable list of rows, ordered by heat/surprise value descending (using a `rank` or `measure` helper) rather than by size or name, with unread/ungraded children sunk to the bottom instead of sorted as cold. Each row shows its grade/provenance and wires up `onSelect` (click) and `onDrill` (double-click) handlers, using `mode`/`ranks`/`ageSpan` to compute display color and relative rank.
- found: Renders node.children sorted by: analyzed-first, then rank(mode) descending, then loc descending, with unread children sinking to bottom via the 'seen' tiebreaker. Each row is a button with a color swatch (colorFor), truncated name, and a measure(c, mode) value on the right, wired to onSelect/onDrill on click/double-click.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Detail` — QUIRKY — TANGLED
- spec 3 · read at `9bdbbee6b7b1` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:49:33Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Detail is the right-hand detail pane component: when `node` is null it falls back to describing `focus` (or the whole repo/`title`), otherwise it renders the selected node's identity (path via `owners` breadcrumbs, copy button), its color-mode-relevant stats (rank, grade, provenance) computed with the helpers rank/measure/grade/provenance, any markdown docs via `Markdown`, and for containers a `Contents` listing of children — wiring onSelect/onDrill/onShowIn callbacks for navigation.
- found: Renders the detail pane: no-node falls back to Summary(focus) or an idle Bloom graphic; non-leaf nodes delegate entirely to Summary with a path/footer/about override; leaf functions get a custom header (name, trap badge), Dials, FunctionRanks, then a scrollable body with the agent's expected/found markdown, stale/warm-read caveats, a note callout (pink if trap), hotspot evidence snippets, and a Contents list, plus a pinned provenance footer.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: Container vs leaf paths diverge heavily — containers reuse Summary entirely rather than a shared Contents-based layout, which the signature/peers alone didn't suggest.

## web/src/components/Dials.tsx

### the file itself
- spec 2 · read at `5a1e3c637102` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:53Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Defines a `Dials` component with several small gauge/dial visualizations summarizing assessment stats — e.g. share of files with documentation, share of functions graded poorly ("bad") — computed via helper functions (fraction, graded, matches, badShare, fileDocShare) from the assessment data, each rendered via a shared `Gauge` sub-component. No file-level doc comment, which is itself a small finding about documentation coverage in this codebase.
- found: Defines Gauge (an SVG radial dial) and Dials (a fixed row of 4 gauges: Surprise/Surprising, Docs/Doc'd, Churn/Churning, Legibility/Legible) shown for any node (function, file, or directory), with extensive helper logic to compute shares/grades and dual behavior depending on whether the node is a leaf reading or an aggregate container.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level header doc exists at all (docs was empty), though individual functions/components have very rich JSDoc comments explaining design rationale.

### `Gauge`
- spec 2 · read at `848c1df4d93d` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:14Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a single semicircular (180°) SVG dial: draws a fixed background arc/track, then an arc or needle whose sweep is determined by `value` (0..1) and whose color is sampled from `ramp` at `rampValue ?? value` (falling back to a neutral/gray color if `ramp` is undefined). Below/inside the arc it prints either `word` (if given) or the numeric value as a percentage, plus the `label` and `hint` as text; if `unread` is true it skips drawing the needle/value and just shows the empty track with some "no data" indication.
- found: Renders a semicircular SVG gauge: fixed 180° track path plus a colored value arc (color from heatColor(ramp, rampValue??value) or --accent/--secondary), with dynamic font-size text in the middle showing either `word` or the rounded percentage, label below. unread hides the value arc and shows an em-dash.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `fraction` — OBSCURE
- spec 2 · read at `af62d113920a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A small helper closing over counts/totals in scope, returning a formatted string like "n/total" for the given grade "rung" (index into full/most/some/none), used as a gauge tooltip or label.
- found: Just returns the literal string "{rung}/4" — a display label for a rung out of 4 grade levels, no lookup or aggregation involved.
- predicted: none · documented: none · derivable: no · legible: full · trap: no

### `graded`
- spec 3 · read at `044dbbf0a1b3` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up either node.legible or node.documented (selected via the which param) and returns that grade value, likely with some aggregation/fallback across child nodes if the node itself doesn't have a direct reading, returning undefined when no grade data exists.
- found: Returns undefined if the node doesn't match, has no agent reading, or the reading is stale. For 'documented', returns 'none' if the code was derivable (overriding whatever documented grade was recorded), else the documented grade. For 'legible', delegates to legibleOf(node.agent) rather than reading a field directly.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `fileDocShare`
- spec 2 · read at `0a0470425d18` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:14Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree (files and functions), counting the total number of items and how many have no documentation, then returns undocumented/total as a fraction (mirroring undocShare but counted by item rather than weighted by lines). Returns null if there are no items to count (e.g. empty directory).
- found: Walks files/funcs, only counting those that have been graded on 'documented' at all; among those, counts ones graded 'some' or 'none' as bare, and returns bare/read, or null if nothing was graded.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `matches` — QUIRKY
- spec 2 · read at `de224c315994` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:41Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns true if the node is a function, or if it's a file node that has no child functions (so the file itself is the assessable unit) — filtering out container nodes like directories or files-with-functions that can't themselves hold a reading.
- found: Simply checks whether the node's kind is 'func' or 'file' — no additional condition about whether a file has child functions.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: I over-predicted an extra condition (file must have no functions) that the code doesn't actually have.

### `badShare`
- spec 2 · read at `53a6f96217bd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the subtree rooted at node, and for the given lens (legible or documented) sums the total graded lines and the lines that graded "bad" (opaque for legible, undocumented for documented) using helper peers like graded/fraction/matches. Returns the bad/total fraction, or null if there are no graded lines in the subtree (avoiding divide-by-zero).
- found: Recursively walks func nodes, and for each graded node on the given axis weights by n.loc (not a flat count), summing total loc graded and loc graded 'some' or 'none' as bad. Returns bad/graded_ or null if nothing graded.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I assumed a flat per-function count; it actually weights by lines of code (n.loc), so a big ungraded function counts more than a small one.

### `Dials` — QUIRKY — TANGLED
- spec 2 · read at `54b7caa28d90` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Component that renders a fixed row of exactly four `Gauge` dials for a given `Node`, using helper functions like `fraction`, `graded`, `fileDocShare`, `matches`, and `badShare` to compute each metric (including falling back to `opaqueShare` for legibility when the node is a container lacking a `legible` field). Each dial shows a track and em dash when its underlying measurement is absent, and `lead` is rendered as leading content before/alongside the four dials.
- found: Renders a fixed 4-column grid of Gauge dials (Surprise, Docs, Churn, Legible) for a node, with each dial's value/word/ramp/unread state computed differently depending on whether the node is a container (share-based percentages via wedgeHeat/badShare/fileDocShare) or a leaf function (grade-based words via graded()/DOC_GAP/GRADE_SURPRISE/RUNG_GOOD/RUNG_HOT lookup tables), plus a special 'predicted' surprise-grade override for functions with fresh (non-stale) agent readings.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

## web/src/components/ExportDialog.tsx

### the file itself — QUIRKY
- spec 3 · read at `125d6e1a0750` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:57Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A React component file implementing ExportDialog, a modal that lets the user export the current visualization (e.g. as an image or data file), with format/options selection and a trigger to download. The helper functions pace/ms/lasting/suggest are small utilities for estimating and formatting export duration/progress (converting to milliseconds, describing how long an operation is taking) and suggesting a default filename or export format.
- found: ExportDialog renders a modal to export the commit-history replay as an MP4 movie of the sunburst map (not a screen capture), with controls for length, square resolution, and light/dark ground, showing per-stage progress (fetch/fold/raster/encode) and time-left estimate while recording, then saving via saveMovie. pace/ms/lasting are duration-formatting helpers for the length choices, per-stage cost readout, and time-remaining estimate respectively; suggest builds a slugified default filename.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: The docs are unusually rich (extensive rationale comments explaining design decisions like square frames, no 'system' ground option, ref vs state for stop) — far beyond what's derivable from the code alone, so derivable=false despite documented=full.

### `pace` — QUIRKY
- spec 3 · read at `72df0d0149a5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:00Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Given a total count of items to export, computes an estimated duration (using some assumed per-item rate and probably the `ms`/`lasting` helpers) and returns a human-readable string like "~2 minutes" for display in the export progress/estimate UI.
- found: Formats a duration given in seconds as a short label: minutes rounded (e.g. "3m") once it reaches 60 seconds, otherwise seconds (e.g. "45s"). Doesn't call the sibling ms/lasting helpers at all.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Despite the name "pace", this is a plain seconds→"Xm"/"Xs" formatter, not a rate/throughput calculation — the input is a duration in seconds, not an item count.

### `ms`
- spec 3 · read at `4dddd82a330c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:48Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Formats a millisecond duration into a short human-readable string, e.g. showing seconds with one decimal if >= 1000ms, or "Xms" otherwise, for display in export progress/time estimates.
- found: Exactly as predicted: >=1000ms shows seconds to one decimal, else rounded milliseconds.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lasting`
- spec 3 · read at `a07a92bf9be7` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:55Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Converts a duration in seconds to a human-readable string like "5s", "3 min", or "2 hr", picking the coarsest unit (seconds/minutes/hours) that still represents the value without rounding down to zero, and rounding the number up (Math.ceil) within that unit so the estimate never undershoots.
- found: Three-tier ceil-based formatting: >=5400s (1.5hr) shows hours, >=90s shows minutes, else shows whole seconds — matches my general shape but the actual cutoffs (5400, 90) are more deliberately chosen than the simple 3600/60 I guessed, presumably to avoid awkward '1h' at 61 minutes or '1 min' at 61 seconds.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `suggest`
- spec 3 · read at `862ad60f8261` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:55Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Sanitizes `name` into a safe filename: replaces spaces and slashes with dashes/underscores, strips other unsafe characters, and falls back to a generic default (like "export" or "sanity") if the result is empty, possibly appending a date stamp or extension.
- found: Lowercases and collapses non-alphanumeric runs into single dashes, trims leading/trailing dashes, falls back to "history" if empty, and appends "-history.mp4" as a fixed suffix.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected a generic sanitize-with-fallback but didn't anticipate the fixed "-history.mp4" suffix, which reveals this is specifically for exporting the history movie feature, not a general filename helper.

### `ExportDialog` — TANGLED
- spec 3 · read at `d6f4d8c158fa` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:06Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders form controls for movie export settings (duration/pace via ms/lasting/pace, a suggested filename via suggest), then on confirm it stages the map at a target pixel size via onStage, iterates frames calling ensure(index) and awaiting it before capturing/recording each frame (unlike the live transport, which fires-and-forgets), shows progress, and on completion or cancel restores the original playhead index and calls onStage(null)/onClose to hand the pane back.
- found: Dialog with length/resolution/ground(theme) pickers and export/stop buttons; on Export it applies the chosen theme, stages the map at the chosen pixel size, waits two RAFs to let it settle, then calls movie.record (passing frames, ensure, progress/codec callbacks, and a ref-based cancel flag), saves the resulting bytes via a save dialog, shows a progress bar with per-stage cost breakdown and time-left estimate, surfaces a non-H.264 codec note, and always restores theme/stage/playhead in a finally block.
- predicted: most · documented: most · derivable: no · legible: some · trap: no

## web/src/components/Fields.tsx

### the file itself
- spec 3 · read at `c7f47be9f60c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:03Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Defines two small shared UI building blocks used across dialogs: a Field component (a labelled block wrapper) and a Choice component (a selectable chip/pill), extracted to prevent visual drift between dialogs that would otherwise each restate their own similar-but-slightly-different versions.
- found: Field is a labelled wrapper div; Choice is a toggle-able pill button with accent styling when on, an optional parenthetical note, and disabled state — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no

### `Field`
- spec 3 · read at `3e61844d0f48` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:43:00Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A small presentational wrapper component: renders a container div with a label (e.g. a small caption/heading styled span) above or beside its children, used to give consistent spacing/typography to labelled controls across dialogs.
- found: Renders a div with a small uppercase muted label above the children — exactly the labelled-block wrapper the file doc described.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `Choice`
- spec 3 · read at `c9f03f7639d7` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:46Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a selectable "chip" button used inside dialogs' choice groups — a small pill/button showing `label` (and a parenthetical `note` if given), styled differently when `on` is true (selected) vs false, disabled when `disabled` is true, and calling `onClick` on click.
- found: A styled chip/button: shows label plus optional parenthetical note, border/background/color swap when `on`, disabled styling, calls onClick.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/FileZoom.tsx

### the file itself
- spec 2 · read at `3fb3d24d93f0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:32Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A React component file rendering a "zoomed in" detail view of a single file within some larger repo visualization (e.g., a treemap or map of files), used when a user selects/clicks a file. `fanOf` is a helper function computing a fanned-out/radial layout (positions) for child items (likely the functions within the file) so they can be animated into view. `FileZoom` is the main component that renders this zoomed panel, probably showing the file's functions/peers with some transition/animation logic.
- found: This is a React component in a repo visualization app (a polar/sunburst treemap of a codebase). FileZoom renders the "opened out" view of a single file when a user drills into its wedge — it animates the file's function-tiling from the wedge shape into a wider fan shape using an affine (θ,v) mapping, so the same tiled cells just get bigger rather than being re-tessellated. fanOf computes the destination fan sector via fanFor. The component handles the transition (t=0 to 1), selection/hover/drill callbacks, coloring by mode, stale-reading hatching, rollup dots for aggregated functions, and settled-state labels.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Docs field was empty for the file task, but the actual file has an extensive design-rationale header comment (why polar geometry, why this replaced FileStack, etc.) — the emptiness itself was a notable finding since real docs exist.

### `fanOf` — QUIRKY
- spec 2 · read at `4c58496076c4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Wraps a lower-level fanFor() so a null source sector doesn't return null: computes a bearing (either from the source sector's angle/midpoint or a default constant when from is null) and passes it plus paneAspect to fanFor to get the angular span/Sector that a wedge opens into, scaled so wider panes get a wider fan.
- found: It's a one-line passthrough wrapper: fanOf just calls fanFor(from, paneAspect) and returns its result. All the actual null-handling and fan/wedge logic described in the docs lives inside fanFor, not in this function — fanOf exists only as the exported name/entry point.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe behavior (null source still gets a fan) that actually lives in fanFor, not in this wrapper's own body — so the doc explains the callee, not this function.

### `FileZoom` — TANGLED
- spec 2 · read at `d978e4845439` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:19Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the zoomed-in view of a single file's functions as patches/tiles (via fanOf for layout), animating between a previous state (`from`) and current using interpolation factor `t`, culling patches below minPatchArea, coloring by rank/age (ageSpan) or mode, and wiring onSelect/onDrill/onHover callbacks for interaction with individual function tiles. `settled` gates whether transition animation is still in progress.
- found: Lays out a file's functions as a squarified tiling against a fan shape (fanOf/tileFunctions), interpolating between a source sector and destination sector by t via lerpSector, coloring each patch, and rendering trap-pulse/stale-hatch/rollup-dot overlays plus labels that only fade in once the transition has settled.
- predicted: most · documented: none · derivable: no · legible: some · trap: no
- note: No docstring on the function itself; only inline comments explaining specific design decisions (rollup dots honesty, label timing, hatch semantics) which I couldn't have derived without reading the body.

## web/src/components/HistoryBar.tsx

### the file itself — QUIRKY
- spec 3 · read at `2198a50be1b8` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:00Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A React component (HistoryBar) that renders the transport controls for the commit replay — a scrubber/slider representing position across the timeline, plus play/pause and speed controls — driving the same playhead index that CommitLog follows. The `pace` helper likely converts a playback speed setting into a per-frame delay (milliseconds between advancing the playhead) or converts frame count/duration into a human-readable rate label.
- found: The replay transport: a play/pause button, a scrub range input over the commit frames, a row of preset total-DURATION buttons (not a speed/rate — the control fixes how long the whole replay takes regardless of repo size), an export-to-movie button/dialog, and keyboard shortcuts (space to play, arrows to step, shift to stride by 10). The play loop uses requestAnimationFrame driven by elapsed wall-clock time (not per-tick steps) to keep the promised duration accurate at any framerate, skipping commits past MAX_FPS rather than falling behind. `pace` just formats a duration in seconds into a short "Ns"/"Nm" label for those buttons.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file header doc; the key design facts (duration not rate, RAF-with-elapsed-time not fixed-interval, cursor/emitted ref split to preserve sub-integer progress across renders) are only in scattered inline comments.

### `pace` — QUIRKY
- spec 2 · read at `f97e230c1fec` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:51:49Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a total count, returns a human-readable pace label by bucketing the number into ranges (e.g. "slow", "steady", "fast") for display in the HistoryBar UI. Likely a simple if/else or ternary chain comparing total against threshold constants.
- found: Formats a duration in seconds as a short string: minutes rounded with 'm' suffix if >= 60 seconds, otherwise raw seconds with 's' suffix. Not actually a "pace" label like slow/fast — it's a duration formatter, likely misnamed relative to what I expected.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `HistoryBar` — QUIRKY
- spec 3 · read at `f80e6d8549ca` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A bottom-of-screen transport bar component: a play/pause button toggling `playing`, a scrub slider/range input spanning `frames` (mapping slider position to `onIndex(frames[i])` rather than raw commit index), and a duration control feeding `onDuration`. When playing, an effect uses `pace` (the peer helper) to advance the frame index on an interval/rAF loop sized by `duration`, calling `ensure` to fetch data for upcoming frames before stepping onto them, and stopping at the end. It likely also wires an export/save action using `name` and `onStage` to render the current frame to an image.
- found: Play/pause + scrub slider + preset duration buttons + export button, with playback driven by a requestAnimationFrame clock (not setInterval) that tracks a fractional cursor in a ref so slow rates still progress smoothly, keyboard shortcuts (space to toggle, arrows/shift-arrows to step) guarded against text-input focus and the export dialog being open, and export itself delegated to a separate ExportDialog opened on click rather than handled inline.
- predicted: some · documented: full · derivable: no · legible: most · trap: no
- note: Missed entirely: the keyboard shortcut handling and the rAF-based fractional-cursor clock design, which are most of the function's actual complexity.

## web/src/components/MascotFigure.tsx

### the file itself — QUIRKY
- spec 3 · read at `2d17f93e2a77` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:16Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a mascot character (likely an SVG figure) whose appearance/expression changes based on app state — probably the overall health/surprise score of the current scan, via `moodFor` mapping a score to a mood (happy, worried, etc). `loadOrMint` likely generates or loads a persisted/cached identity for the mascot (e.g., a random seed or variant stored per repo, minted once and reused), and `pick` selects a random variant from a set of options (colors, poses, accessories).
- found: Wraps a canvas-based creature-animation bundle (Mascot) and drives it from live agent activity: loadOrMint loads (or randomly mints and persists) a per-project mascot blueprint; moodFor maps an MCP tool-call name to an animation set (bigger/rarer reactions for surprising reports, quiet ones for polling); events are replayed in sequence-number order, one per beat, when new agent calls arrive. It also aims the creature's gaze at whatever sunburst wedges are "flashing" (dwelling on one direction at a time), wakes on mouse movement while idle, plays a repeating "confused" animation while a run is being torn down, and measures/lifts the creature to sit centered in its box once the bundle reports its resting silhouette.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file header; the file's real scope (gaze-tracking toward sunburst activity, wake/idle/stopping lifecycle, sequence-based event replay) is far beyond what the peer list (loadOrMint/pick/moodFor/MascotFigure) suggests on its own.

### `loadOrMint`
- spec 3 · read at `816728647b9c` · commit `cecdbb2` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:35:13Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up a cached MascotConfig for `project` in localStorage (keyed by project name or a generic key), and if none exists, generates a new random one (likely via the `pick` helper for random selection) and persists it back to localStorage before returning it.
- found: Checks storedMonster(project) for a cached config and returns it if present; otherwise mints a fresh one via randomizeMascot(), saves it with saveMonster(project, fresh), and returns it.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Comment clarifies this is the single mint point, shared deliberately with the sidebar's "forget monster" reset path.

### `pick`
- spec 2 · read at `cfbf6454f730` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:54Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Picks a random element from the `from` array (Math.random() * length, floored) and returns it as the chosen MascotAnimation.
- found: Returns a random element from the array via Math.floor(Math.random() * from.length).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `moodFor`
- spec 2 · read at `cda216f69fc2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:05Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Maps a tool name string to a list of candidate mascot animations that fit that tool's "mood" — e.g. a search/read tool maps to curious/looking animations, a write/edit tool to focused/working animations — likely via a switch or lookup table with a default fallback list for unrecognized tool names, to be randomly picked from by a caller like `pick`.
- found: Looks up the first entry in a MOODS table whose `match` regex tests the tool name, returning its `play` animation list, falling back to DEFAULT_PLAY if none match.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Guessed a switch/lookup with default correctly; actual mechanism is a regex-match table (MOODS) rather than a switch.

### `MascotFigure` — QUIRKY — TANGLED — TRAP
- spec 3 · read at `10629a7b57b5` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:54Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders an SVG "mascot" creature. It loads or mints a persistent per-project blueprint via `loadOrMint` (keyed by `project`, re-minted when `remint` changes), computes a mood from the recent `events` via `moodFor`, and picks/generates visual traits via `pick`. It animates the eyes to track the `gaze` targets when provided (else wanders on its own), and varies appearance/animation based on `state` (working/sleeping/torn down) and `size`.
- found: Wraps an imperative `Mascot` scene (remounted via key when config changes). Loads/mints a per-project blueprint, positions the creature vertically once the bundle reports its resting silhouette extent (`onReady`), aims gaze at one of several directions on a timed dwell cycle, wakes on window mouse activity, plays a "confused" animation loop while state is 'stopping', and replays queued mood-driven animations for fresh events (by sequence number) while state is 'working', each staggered on a timer.
- predicted: some · documented: none · derivable: no · legible: some · trap: yes
- note: Comments call out a specific prior bug: reading `handle.current.renderer.engine` instead of `renderer.shared.engine` type-checks fine and fails silently (gaze stops working with nothing on screen indicating why) — worth flagging to anyone touching the gaze-aiming code.

## web/src/components/Overlay.tsx

### the file itself
- spec 2 · read at `dc471b0c1afa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:20Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A generic UI overlay wrapper component — a fixed/absolute-position <div> that sits on top of other content, likely used for a dialog/tooltip or the detail panel shown over the Sunburst chart. Probably takes children and maybe a visibility or position prop, minimal logic.
- found: Dimmed fixed-position backdrop that centers modal children; clicking the backdrop calls onClose (children are expected to stop propagation to avoid closing on inner clicks).
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `Overlay`
- spec 2 · read at `90bafbe9ef93` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:09Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A fixed, full-viewport div with a semi-transparent/dark background and flex centering, whose onClick calls onClose. Inside it wraps `children` in another div with onClick calling e.stopPropagation() so clicks on the modal content itself don't bubble up and trigger the close.
- found: Fixed, full-viewport, centered dark-backdrop div with onClick=onClose, rendering children directly with no stopPropagation wrapper of its own — that responsibility is left to whatever panel component is passed as children, per the docs.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs describe the stopPropagation half of the contract as if it belonged to this function; it's actually the caller's responsibility, not code in this function.

## web/src/components/ReadDialog.tsx

### the file itself
- spec 3 · read at `3a9b933e8f34` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:40Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A modal dialog component (ReadDialog) that lets the user configure and kick off a "read" run of the project — choosing a harness/model and a token/effort budget via a custom Slider with snapping (snap) and human-readable approximate labels (approx), while tokensFor estimates the token cost for a given budget/scope. No file-level doc header, so the file's purpose has to be inferred from the exported component and its small set of local helpers rather than stated anywhere.
- found: A modal for choosing which agent/model reads a project and how much of it to read this run, with a custom detented Slider (snap-to-round-numbers), four Gauge dials (functions/readers/lines/tokens) computed from tokensFor and a measured cost curve, and logic that prefers the corpus's already-banked model/harness over local defaults so a partial run doesn't silently mix reading scales.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level doc header at all — the file's rationale (this dialog exists specifically to replace an orchestrator-level cost confirmation prompt that got dropped) lives only in the ReadDialog component's own doc comment, not at the top of the file.

### `tokensFor`
- spec 2 · read at `0446577e1881` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:46Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Computes number of batches as Math.ceil(functions / batch), then returns an estimated total token cost combining a fixed per-batch overhead with a per-function token cost (batches * overhead + functions * perFunctionCost), used to preview how many tokens a read run will consume before starting it.
- found: Exactly batches*ENTER_TOKENS + functions*PER_FUNCTION_TOKENS, matching prediction precisely.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `Slider`
- spec 2 · read at `8ab9b251b162` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a wrapper div containing a native <input type="range"> (opacity 0 or similar, so it still handles drag/click/keyboard/focus/accessibility) layered over custom-drawn track, fill, and thumb elements built from divs/spans styled via computed percentages. The fill width and thumb position use `(value - min) / (max - min)` consistently, and detent notches are rendered at `(d - min) / (max - min)` percent positions along the track, with label and valueText displayed as text near the slider.
- found: Renders a transparent native range input on top for interaction/accessibility, with drawn-underneath track/fill/thumb positioned via one consistent (v-min)/span percent helper; detents render as small vertical bars painted in the card background color so they stay visible against both track and fill. label/valueText are used only as aria-label/aria-valuetext, not visible text.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `snap`
- spec 2 · read at `c6a1890c842e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:37Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Checks each value in detents and, if v is within a catch window sized as a percentage of the range (using left as part of the range calc) of that detent, returns the detent instead of v; otherwise returns v rounded to the nearest step.
- found: Computes a catch window as max(step, (left-step)*0.02), finds the first detent within that window of v, and returns it; otherwise returns v unchanged (not rounded).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `approx`
- spec 2 · read at `21533db1a284` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:52Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Formats a number as a human-readable approximate string, e.g. abbreviating thousands as "~1.2k" or similar, likely used to display an estimated token count (paired with `tokensFor`) in a dialog without pretending to false precision.
- found: Formats a number into an abbreviated string: millions get one decimal + 'M', thousands round to the nearest whole 'k', anything smaller is just the plain number as a string.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Predicted the abbreviation behavior correctly but assumed a '~' prefix that isn't actually there.

### `ReadDialog` — QUIRKY — TANGLED
- spec 2 · read at `311c14be34c5` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:47Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A modal dialog component with three controls: agent choice, model choice (remembered per-project, likely via localStorage or the project record), and an extent/budget slider (using Slider/snap/tokensFor to show an approximate token cost estimate via `approx`). On confirm, it kicks off a read run (probably an API call) for `project`, then calls onStarted() and onClose(); Field/Choice are small presentational subcomponents used to lay out each option.
- found: A large dialog: picks agent from installed harnesses, resolves model from a priority chain (corpus-banked > recently-used > per-agent default), renders model choice as chips/select/datalist depending on how many the harness enumerates, shows four Gauge dials (functions/readers/lines/tokens) plus a slider with rounded detents for choosing how many functions to read, and on submit calls setReader + startCheck then onStarted/onClose.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The doc block explained the high-level 'why' of the dialog (asking replaced an orchestrator prompt) but the body's real complexity — three-source model precedence, chip/select/datalist branching, four-dial coverage readout — went far beyond what I predicted.

## web/src/components/Reading.tsx

### the file itself
- spec 2 · read at `edad76307ab9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:56Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Reading.tsx renders the small panel showing where a single function ranks among the repo's own functions — using continuous "dial" visualizations (not discrete grade ladders) for metrics like line length, churn, etc. Helper functions ordinal/pct format percentile/rank numbers, Fact renders a labeled stat, Rail draws the dial track, and FunctionRanks assembles them into the leaf-pane view shown only for functions (not directories, which have no length/churn of their own).
- found: Renders a two-fact panel (Lines, Churn) in a function's leaf pane, each shown as a value plus a percentile rank drawn as a dial/rail with an ordinal label, comparing the function against the repo's population; unranked when population data is missing.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `Rail`
- spec 2 · read at `3cf3887150fd` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a small horizontal bar/track representing the percentile range, with a tick mark positioned at `p` percent along its width (via inline style left: `${p}%`) to show where this function falls relative to the rest of the population. Probably includes minimal styling divs, no text.
- found: Renders a track div and a tick mark (span) positioned at p*100% along it, pulled back 2px near the right edge so the tick stays visually inside the rail instead of hanging off the end.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Got the overall shape right; missed that p is a 0-1 fraction (I guessed percent directly) and the edge-clamping nudge.

### `ordinal`
- spec 2 · read at `55320f57d387` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Converts a percentile number (0-100) into an ordinal string like "98th" or "3rd", applying standard English ordinal suffix rules (1st/2nd/3rd/nth with the 11-13 exception), rounding the number first so the result fits in four characters.
- found: Takes a 0-1 fraction, scales to a 1-99 integer rank (clamped so it's never 0th or 100th, since this ranks among real functions), and appends the correct English ordinal suffix.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `pct`
- spec 2 · read at `d2e96ee83b46` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:49Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a fraction p (0-1) into a display string like "12%", rounding and appending a percent sign, for use in the tooltip alongside the ordinal ranking text.
- found: Rounds p*100 to an integer percent, but clamps display to '<1%' and '>99%' at the extremes instead of showing 0% or 100%.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `Fact`
- spec 2 · read at `477fc67fa2fa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:49Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders one non-wrapping row showing `label` and `value` (e.g. "153 lines"), plus a small visual indicator of where `p` (a percentile, 0-1) lands in the repo's distribution — likely a tick or bar akin to the `Rail` peer component — falling back to no indicator when `p` is null. `hint` is probably shown as a title/tooltip attribute explaining what the percentile means.
- found: Renders a label/value row with a title tooltip from `hint`; when `p` is non-null it shows a `Rail` percentile indicator plus the ordinal text, and when null it shows "unranked" instead, distinguishing an absent rank from a rank of zero.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `FunctionRanks`
- spec 2 · read at `7760fa2d0601` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:07Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A component that renders two "dial" rows (using Rail) showing where this function's line count and churn/commit count rank as a percentile within the repo's population of functions (pop). It probably computes percentile via ordinal/pct helpers and returns null early if pop is missing or node isn't a function, otherwise renders labeled dials like "153 lines — longer than X% of functions".
- found: Renders two Fact rows (lines and churn) showing this function's percentile via shareBelow against the population, with hint text explaining the percentile in prose; handles null score (returns null) and null ageDays (no git history) as special cases.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The file_doc explained the surrounding design philosophy (dials not ladders) but not this specific function's behavior, so it read as none/not derivable-from-docs for this function itself.

## web/src/components/RollupDots.tsx

### the file itself — OBSCURE
- spec 2 · read at `90b11b65fd3e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:54Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A small, self-contained component file with no header doc, whose job is to render a compact row of colored dots summarizing a rolled-up/collapsed group of nodes (e.g. one dot per function or per grade bucket, colored by its reading/heat). `dotsId` is a small helper generating a stable id (probably for SVG defs/gradients or React keys) and `RollupDots` is the component itself, likely taking counts or nodes and a color function as props.
- found: Not a row of summary dots at all — it generates a rotated SVG `<pattern>` (a repeating single-dot tile, angle-aligned to the wedge's mid-angle and translated to the patch's own center) used as a texture fill marking roll-up patches in the sunburst chart as "a collection, not a function," distinct from the stale hatch. `dotsId` builds a collision-free SVG id from a file path by escaping non-alphanumeric characters to their char codes.
- predicted: none · documented: none · derivable: no · legible: not judged · trap: no

### `dotsId`
- spec 2 · read at `d813a04c4855` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:48Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a collision-free CSS/SVG id from a file path by replacing each character that isn't a letter, digit, or hyphen with an escape sequence encoding its character code (e.g. "_" + code), rather than collapsing all non-alphanumeric characters to a single "-" which would let different paths collide. Likely uses charCodeAt and some prefix like "id" + code.toString(36) or similar, joined together with allowed characters left as-is.
- found: Prefixes with "dots-" and replaces each non-alphanumeric character with "-<charCode>-", so the escape is delimited by hyphens on both sides rather than a single prefix character.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: My guess about the exact escaping scheme (prefix+base36) was wrong in detail, but the core idea (escape to char code to stay injective) matched.

### `RollupDots` — OBSCURE
- spec 2 · read at `5f2e48bfa4bb` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:07Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Draws a small cluster of dots (like an ellipsis "…") near (cx, cy), offset outward along `angle`, to indicate that this wedge is a rollup of several collapsed children rather than a single leaf. Uses `dotsId` to build a unique SVG element id derived from `id` for defs/reuse (maybe a <symbol> or <use>), and probably renders 3 small <circle>s spaced along a line perpendicular or parallel to the angle direction.
- found: Emits a single <defs><pattern> — a repeating dot-grid texture, one small circle per tile — that is rotated to the wedge's mid-angle and translated so the lattice is anchored to the patch's own center rather than the chart's global origin, meant to be used as a fill (like StaleHatch) rather than as literal drawn dots.
- predicted: none · documented: none · derivable: no · legible: most · trap: no
- note: Expected a small cluster of ~3 literal dots (an ellipsis marker); it's actually an infinite tiling pattern definition analogous to StaleHatch, with careful translate+rotate math to anchor the grid per-patch rather than globally.

## web/src/components/SideBar.tsx

### the file itself — QUIRKY
- spec 3 · read at `b5b60ff265f0` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:16Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: The main sidebar component listing the user's open/known projects/repos, with drag-and-drop reordering support (DropLine renders the insertion-point indicator during a drag) and ProjectItem rendering each individual project row (name, maybe active/selected highlighting, scan status via the mascot, and actions like remove/open). SideBar itself likely manages the list state, drag events, and selection/navigation between projects, and is a large, prop-heavy top-level component given its size.
- found: Much larger and richer than predicted: SideBar renders the project list with a custom pointer-event-based (not HTML5) drag-reorder system with a ghost row and DropLine gap indicator, a right-click context menu (re-trace history, new mascot, remove), a failure-transcript overlay, and per-row (ProjectItem) two-level status display covering scan progress, read backlog, run state (reading/stopping/failed), and a separate 'history trace/replay' sub-feature with its own progress bar and cancel — far more state and features than the simple list+DnD I predicted.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `SideBar` — TANGLED
- spec 3 · read at `f446a09f6c0d` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders the full-height left column: a scrollable list of `projects`, each rendered via the `ProjectItem` peer component (highlighting `active`/replaying rows and wiring onSelect/onRead/onForget/onRemintMascot/onReplay/onError callbacks), plus an "add project" button that calls `onAdd`. It likely supports drag-and-drop reordering of the project list, using `DropLine` to show where a dragged item would land, and manages local state for which row is being dragged/hovered plus any open per-row menu.
- found: Renders the project list via ProjectItem rows plus an add button, with custom pointer-event-based (not HTML5) drag-to-reorder using a ghost element positioned via imperative transform writes for performance and a DropLine to show the landing gap, a right-click context menu per row (re-trace, remint mascot, remove), and a failure-transcript overlay dialog for a run that produced no readings.
- predicted: most · documented: some · derivable: no · legible: some · trap: no
- note: Missed the failure-transcript overlay entirely and the specific reason for pointer events over HTML5 drag-and-drop (Tauri webview swallows dragover on macOS).

### `DropLine` — QUIRKY
- spec 3 · read at `7cf9ac969254` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:17Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering a placeholder div in normal document flow (not absolutely positioned), sized to roughly the height of a project row, used as a drop-target indicator during drag-and-drop reordering in the sidebar's project list.
- found: Renders a thin (h-0.5) accent-colored rounded line with small vertical margin, aria-hidden, as an in-flow drop indicator — not a full-row-height placeholder as I guessed, just a slim line.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I overestimated its size — it's a 2px accent line, not a row-height placeholder block.

### `ProjectItem` — QUIRKY — TANGLED
- spec 3 · read at `cf046e3efce5` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:21:34Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a single project row as a div (not a button, since it nests Read/Stop buttons) with click/context-menu/pointer-drag handlers and keyboard handling for the row's role. The right-hand slot is conditional: shows a progress indicator/percentage when `replay` is non-null and running, shows Read/Stop-style controls when this row is active/hovered, and otherwise shows a static count (e.g. failure or item count). It likely manages local hover state, disables/tooltips the replay trigger when `blocked` is true, and toggles a "dragging" visual style plus renders relative to DropLine when `dragging` is true.
- found: Renders a project row with three tiers of state: a name+status line, a history/"trace" line for commit replay (with its own Cancel/Trace button and progress bar), and a backlog/reading line with Read/Stop/failure-transcript buttons. It tracks local hover/cancelling/asked state, derives many booleans (running, stopping, winding, busy, reading, failed, settled) from the project and run props, and draws a bottom-edge progress rule plus a "reading" sweep animation. Far more machinery than a simple row — distinguishes "read" (function-level reading) from "trace" (commit replay) as two entirely separate jobs with separate UI treatment.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The rationale comments (why div-not-button, why compact numbers, why edge-rule not fill) carry real design history not recoverable from the code alone.

## web/src/components/StaleHatch.tsx

### the file itself
- spec 2 · read at `c7b7b8e9ed73` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:10Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Defines a small React component rendering an SVG <pattern> of diagonal hatch lines, used as a fill overlay (via url(#id)) to visually mark "stale" segments (e.g. in the Sunburst chart) — old/unchanged code — distinct from color-coded surprise/heat. Likely just a <defs>/<pattern> block, minimal logic, maybe a prop for color/id.
- found: A component (not a bare <defs> block, deliberately, so the SVG pattern id is unique across mounted views) rendering a diagonal-line hatch pattern with id "stale-hatch", meant to mark wedges whose reading has "expired" (code moved) — a texture rather than a second color so it doesn't compete with the single color encoding.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `StaleHatch`
- spec 2 · read at `1ce6ece3deac` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:37Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders a single SVG <defs> block containing a <pattern id="stale-hatch"> with diagonal line strokes (a classic hatching pattern), meant to be mounted once at the top of the SVG tree so other elements can reference it via fill="url(#stale-hatch)" without id collisions.
- found: Single <defs><pattern id="stale-hatch"> with a rotated repeating diagonal line, meant to be mounted once and referenced via fill="url(#stale-hatch)".
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/components/Summary.tsx

### the file itself
- spec 2 · read at `eb364ac665a8` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:49Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This is the React component that renders the top-level "Summary" view of a completed (or in-progress) reading run — showing aggregate stats like how many functions were predicted full/most/some/none, some kind of Buckets breakdown by category (documented/derivable/trap), a Spread visualization, and a scrollable ListWindow of individual assessed functions with a rowNote helper formatting each row's note/verdict. It's UI/presentation logic, not data-fetching — probably consumes an already-loaded results object and lays out charts/tables from it.
- found: The detail-pane component that shows what a selected subtree adds up to: dial stats, a mode-dependent breakdown (Spread of grades under Surprise mode, or Buckets by author/language/age/etc under other modes), a windowed scrollable list of the functions in the picked grade/bucket, and a footer. Heavy on 'why' comments explaining UX regressions this design fixed (perf of rendering thousands of rows, scroll position resets, row restating its own bucket heading, etc).
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level doc comment despite every function inside carrying an unusually long rationale comment — the file's own purpose has to be inferred from summing its parts.

### `rowNote` — QUIRKY
- spec 3 · read at `cab66646b605` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:34:56Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A switch/if on `mode`: for 'age' it formats the node's last-touched time as a relative string like "5d ago"; for 'churn' it formats something like "11 in 90d" from a commit count field. For all other (categorical) modes — author, language, grade, trap — it returns a string showing the node's line count (LINES), since those columns can't restate anything else useful.
- found: Got age/churn/default(lines) right, but missed two entire branches: 'reach' mode (callers/calls wiring, with a special case distinguishing isolated stubs from unentered subsystem entry points) and 'locality' mode ("X of Y away").
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment covers only the age/churn/category rationale — it says nothing about the reach and locality branches, which have their own inline comments explaining subtler distinctions (zero commits vs no history; stub vs entry-point orphan).

### `ListWindow`
- spec 2 · read at `b01f264c6a80` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:52Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A manually-windowed list: tracks scroll position of a container (ref + scroll event listener), computes the visible row index range from a fixed row height and container height, pads with an `overscan` of extra rows above/below to hide the paint-lag seam on fast scrolls, and renders only that slice of `rows` with top/bottom spacer elements (or a translateY) to preserve full scrollbar height. Each rendered row uses `paint` for its swatch color, `rowNote`/`mode` for trailing text, and click handlers wired to `onSelect`/`goTo`.
- found: Tracks scroll offset/height via a scroll listener plus ResizeObserver, computes a visible row range from fixed ROW_H with 8-row overscan, slices `rows` to render only that range with top/bottom spacer divs to keep true scrollbar height, resets scrollTop to 0 whenever `rows` itself changes (different list), and renders each row as a button with a paint-derived swatch, name, and rowNote trailing text, wired to onSelect (click) and goTo (double-click).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the reset-to-top-on-new-list effect and the double-click-vs-click split (onSelect/goTo) in my prediction, though the windowing mechanics themselves I got essentially exactly right.

### `Spread`
- spec 2 · read at `3f49c9056efd` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders a horizontal stacked bar whose segments are widths proportional to counts: one segment per Grade in cold-to-hot order (colored from the same heat ramp as the sunburst), plus separate neutral-colored segments for `stale` and `unread`. Below or beside it is a key/legend listing each segment's label and count; clicking a segment or key entry calls onPick(grade) to filter the list, toggling to onPick(null) if the same one that's already `picked` is clicked again.
- found: Builds segments for each Grade (heat-colored) plus stale ('expired', neutral) and unread (neutral), filters zero-count ones, renders a stacked bar with widths as percentage of total. Below it, a key lists each segment with swatch/label/count; only grade segments are clickable buttons (toggling onPick(grade)/onPick(null)), while stale/unread rows are inert divs since they represent absence of a reading rather than a reading outcome.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted stale/unread would also be clickable filters; code deliberately keeps them inert since they're not reading outcomes.

### `Buckets`
- spec 2 · read at `1088b6d3dd29` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:39Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a stacked bar plus a list of rows, one per bucket, where each segment/row width is proportional to the bucket's total LINES (not function count). Clicking a row or segment calls onPick with that bucket's key (toggling to null if it's already picked), and the currently `picked` bucket is visually highlighted; every row is clickable/pickable since buckets (unlike Spread's grades) always represent real, on-screen functions.
- found: Renders a stacked bar of segments sized by bucket.lines/total, plus a scrollable (max 33vh) list of clickable rows below with swatch, label, and function count; clicking toggles onPick(key)/null and highlights the picked row.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `Summary` — QUIRKY — TANGLED
- spec 2 · read at `5428f3a1eb0e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:38Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders the panel shown when no function is selected: a header (title, path breadcrumbs, about), then a set of stats/counts computed by walking `node`'s subtree — total functions, how many are assessed/surprising/expired, etc. — rendered via Buckets/Spread sub-components keyed to the current `mode` and colored via `ranks`. Under modes tied to readings (like surprise) it also surfaces next-step guidance (e.g. connect an agent, readings needed), which it suppresses under modes like Blame where that guidance doesn't apply. Ends with the passed-in `footer`, and rows are clickable via onSelect/onDrill to navigate the map.
- found: Renders the no-selection panel: header/title/path, a Dials row with line/function/commit counts, then a mode-dependent breakdown — Buckets for non-surprise modes (Blame/Age/etc, with a picker) or Spread+grade-picker for surprise mode — followed by a virtualized (windowed) list of the picked bucket/grade's functions that can select+drill into the map, and a pinned footer. No per-note list; notes are shown only on the function they're about elsewhere.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

## web/src/components/Sunburst.tsx

### the file itself — QUIRKY
- spec 3 · read at `7a5cfcead353` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:44:39Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A large React component file implementing a sunburst-chart visualization of the repo (SunburstView) as an alternative layout to the treemap/Spread view — concentric rings of arcs representing directories/files/functions, colored via the shared colorMode logic, with interaction for zoom/drill-down, hover tooltips, and click-to-navigate. heatShare is likely a helper computing how much of a wedge's arc should be colored/highlighted based on some share metric (wiring/doc coverage/etc). Given the total absence of a file header, this is probably a newer or less-documented view compared to the more heavily-annotated colorMode.ts/reports.rs files seen so far.
- found: SunburstView is a very large, heavily-optimized React component rendering the repo as concentric rings (dir/file/func), colored via colorFor per colorMode, with: animated level-change transitions (rAF-driven morph/ease with exponential chase for history replay), directory fold/collapse state, file-tiling zoom (delegating to FileZoom), hover tooltips (WedgeTip, replacing native SVG title), a gaze-tracking AgentMascot creature in the hub that looks at whatever wedges are actively being read/replayed, density-aware pixel thresholds for what's worth drawing, and a hidden/folded-count caveat footer. heatShare is a small helper that damps directory/file heat-ramp intensity specifically under 'surprise' mode (dirs/files at 0.6/0.55, funcs at 1) since container roll-ups would otherwise dominate visually; other modes return full strength since the aggregate is the same measurement, not a different one. The whole thing is wrapped in `memo` because it renders thousands of arcs and any unstable prop causes a full re-render.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file header at all — the file's purpose has to be reconstructed from ~40 inline block comments explaining individual constants/decisions rather than one place that states the component's overall responsibility.

### `heatShare`
- spec 2 · read at `735127f33e96` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:47Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a damping multiplier (0-1) for how strongly a ring's color should read, based on kind (e.g. 'dir' vs 'file'/'func') and mode. Returns 1 (no damping) for every mode except 'surprise', where directory-kind nodes get some reduced value since their color there is only a rolled-up "hot share" rather than a direct measurement, while under all other modes (churn, age, blame, lang) it always returns 1 since those aggregates are legitimate readings of the same quantity.
- found: Under 'surprise' mode, looks up a per-kind damping value from a HEAT_BY_KIND table (defaulting to 1 if kind isn't in it); under every other mode it always returns 1 (no damping).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `SunburstView` — TANGLED
- spec 3 · read at `006ca16b24ab` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: The core rendering component: lays out root's tree as sunburst arcs (radius by depth, angle by size), draws them as SVG/canvas wedges colored according to mode (using ranks/ageSpan to calibrate color scales like churn/age/blame), wires pointer handlers to onSelect/onDrill/onClear/onUp, animates wedge transitions when morph is true, visually pulses nodes present in `reading`, renders the mascot creature in the central hub reflecting mascot.state, and adjusts what's drawn/labeled based on density (pixel-based level of detail) and sortBy ordering.
- found: A ~1560-line component that lays out and renders the sunburst as SVG arc paths (via arcPath/colorFor keyed by mode/ranks/ageSpan), handles pointer hover/selection/drill/clear via a container-level mousemove rather than per-wedge listeners, animates level transitions with separate 'leaving'/'coring'/arriving wedge groups interpolated by lerpGeo when morph, tracks a hub mascot's screen transform synced to the same animation frame, computes pixel-based level-of-detail thresholds (unitsPerPx/minAngle) from either measured pane size or the density prop, and draws selection/hover outlines as separate overlay marks collected during the wedge walk and painted last to avoid stroke-width bugs from paint order.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: Extremely dense with inline rationale comments explaining non-obvious history (e.g. why selection/hover marks are two slots, why the mascot moves in the same effect as the viewBox) — could not read the full 1564 lines exhaustively, sampled representative sections (top, ~lines 700-850) given tool output size limits.

## web/src/components/WedgeLabel.tsx

### the file itself — QUIRKY
- spec 2 · read at `80d8479138b2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:16Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the text label for a single wedge/sector in this radial visualization — likely computing the label's position (radius, angle) and rotation so it sits legibly within or along the wedge's arc, and probably truncating or hiding the text when the wedge is too small/thin to fit it. Likely a single exported component function with maybe one or two small helper functions for geometry (angle-to-position, text-fit checks).
- found: A single unified label renderer for two placement modes (Placement.axis === 'arc' vs radial), replacing two previously-separate renderers (labelArc+textPath in Sunburst, horizontal text in FileZoom). For arc placement it builds a hidden <path> in <defs> via labelArc and puts text on it with <textPath>; for radial placement it computes a rotate/translate/rotate transform to point text outward along the radius, flipping direction in the left half so text always reads left-to-right. Positioning/fit decisions belong to a separate `fitLabel`; this component only draws. Styling (font, weight, tracking, opacity) is imported live from labelStyle.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: Missed that this is a deliberate merge of two previously-duplicated renderers, and the left-half text-flip trick for readability — my prediction assumed a single rendering mode with truncation logic that actually lives elsewhere.

### `WedgeLabel`
- spec 2 · read at `bd61464a726d` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:53Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A single component that draws a label given a `Placement` (`at`) which may describe either a curved arc (ring) or a straight/radial position (fan). For arc placements it builds a <path> in <defs> keyed by `id` and a <text><textPath> along it, flipping the path direction when the arc would otherwise render the text upside-down; for straight placements it renders a plain <text> element. Styling (font, weight, letter-spacing, fill/opacity) comes from calling `labelStyle`.
- found: Two branches on at.axis: 'arc' draws a <defs><path> plus <text><textPath> along it; otherwise draws a radial <text> positioned via rotate/translate/rotate transforms, flipped 90 vs -90 depending on which half of the circle it's in so labels always read left-to-right. Styling uses local FAMILY/TRACKING/WEIGHT constants inline, not a separate `labelStyle` function call as the docs implied.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Docs say styling "comes from labelStyle, live" but the body sets font/tracking/weight from local constants directly — no labelStyle function is called here. Also the upside-down-flip logic I expected on the arc branch is actually on the radial/fan branch instead.

## web/src/components/WedgeTip.tsx

### the file itself
- spec 2 · read at `16ef0391c866` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:55Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: File defining the `WedgeTip` component — a hover/tooltip popup shown when the cursor is over a wedge in the sunburst/treemap visualization, displaying that node's name, file/function count (via a `countFiles` helper), and possibly its score summary, likely positioned near the cursor with no other exported helpers besides `countFiles`.
- found: Defines WedgeTip, a geometry-independent hover tooltip for any wedge/node in the visualization (shared by sunburst/treemap), showing the node's name/path, a color swatch + label for its current reading (with stale hatching), line/file/function counts, mode-specific extras (commits/age for churn/age modes), a "changed since last reading" warning for stale nodes, and fold/drill interaction hints — plus a small countFiles helper and edge-flipping positioning logic to keep the card on screen.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `countFiles`
- spec 2 · read at `84865977315d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:23Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree — if n.kind === 'file' returns 1, otherwise sums countFiles(child) over n.children (via reduce), giving the total file count under the subtree rooted at n.
- found: Recursive walk: returns 1 for a file node, otherwise sums countFiles over children in a for loop.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `WedgeTip`
- spec 2 · read at `621c87b91c93` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:13Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a positioned tooltip card near (x, y) inside the pane (flipping across the pointer if it would overflow `box`), showing the node's name/path, a color swatch matching the wedge's paint for `mode` (using `ageSpan`/`ranks`), and the node's reading state (never-read / stale / normal); when `folded` is defined it also shows a fold-state hint, and when undefined it shows nothing for that.
- found: Matches my prediction well: positioned/flipping tooltip card, swatch color via colorFor, stale vs never-measured text, fold hint gated on `folded !== undefined`. What I missed: mode-specific extra rows (commits/first-seen for churn, last-touched/first-seen for age), function vs dir/file name layout differences with elision helpers, loc/file/rest counts, and a 'Changed since last reading' warning line for stale nodes — much more UI detail than I predicted.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## web/src/components/Wordmark.tsx

### the file itself
- spec 2 · read at `43bbe6381ea5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:20Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A tiny presentational React component (no doc header, so purely self-evident) that renders the app's text logo/wordmark — probably a styled span or SVG with the product name, used in a header or nav bar. Likely just one exported function `Wordmark` returning some JSX with a font/style treatment, no real logic or props beyond maybe className.
- found: An inline SVG wordmark component using currentColor fill (so it works in both ink/white themes without duplicate assets), with a default height of 18 chosen for optical (not arithmetic) size-matching against a sibling "tally" wordmark.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted the shape correctly (tiny presentational SVG component) but the docs revealed brand-system reasoning (currentColor theming trick, optical vs arithmetic height matching to a sibling mark) that isn't derivable from the code itself.

### `Wordmark`
- spec 2 · read at `33a03e9cdc4e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: An SVG React component rendering the inline "sanity" wordmark path(s) using currentColor fill so it adapts to theme, scaled from a default height prop of 18 with proportional width computed from the SVG's native aspect ratio, and no other configurable props per the brand rule against recoloring/effects/rotation.
- found: An SVG with fixed viewBox, fill=currentColor, height prop (default 18), aria-label "Sanity", containing six inline <path> elements for the wordmark letterforms. No width prop — width scales automatically via the viewBox aspect ratio since only height is set explicitly, matching my prediction.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/components/shell/SideBarHeader.tsx

### the file itself — QUIRKY
- spec 2 · read at `cef9ad3d6d95` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:28Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering the header area of a sidebar panel within the app shell — probably a title/logo, plus maybe a collapse/toggle button or action icons. Given its location under components/shell, it's likely a simple presentational component with minimal props (like a title string and onToggle/onClose callback) styled with Tailwind classes to match the rest of the shell chrome.
- found: Renders the top-left header cell of the sidebar containing just the Wordmark logo, as a Tauri drag-region. It tracks fullscreen state to conditionally reserve left padding for macOS's overlay traffic-light buttons, collapsing that padding in fullscreen since the traffic lights hide then.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: Expected a generic title/toggle-button header; the actual function is almost entirely about macOS Tauri traffic-light spacing and drag regions, not a typical sidebar header with controls.

### `SideBarHeader`
- spec 2 · read at `048333edc686` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:54Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a div/header styled to match the TopRow's height, with left padding sized to clear the macOS traffic-light overlay buttons, containing the app's wordmark/logo text. Likely marked as a Tauri drag region so the window can be moved by dragging this area.
- found: Renders a Tauri drag-region div at fixed titlebar height, with left padding reserved for macOS traffic lights only when on Tauri-mac and not fullscreen (fullscreen hides the traffic lights, so the reserve collapses), containing a pointer-events-none Wordmark so clicks fall through to the drag region beneath it.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the fullscreen-state tracking (traffic lights hide in fullscreen so padding must collapse) and the pointer-events-none click-through detail explaining why the wordmark itself isn't the drag target.

## web/src/components/shell/TopRow.tsx

### the file itself
- spec 2 · read at `017ffc141fa9` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A tiny layout component in the app shell — a thin wrapper rendering its children inside a flex row div (probably justify-between/items-center) that forms the top bar of the app, likely holding title/nav/controls. Just a presentational wrapper, no real logic, which is why it's only 11 lines.
- found: A thin flex wrapper header for the top strip of the right column, height-matched to SideBarHeader, centering its children (now just the color-mode switcher after tabs/open-button/theme-toggle were removed for various reasons documented in comments). It's also a Tauri drag region via data-tauri-drag-region, with the note that Tauri only drags on the actual event target carrying that attribute, so buttons inside it still receive their own clicks.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Got the wrapper/layout shape right but missed the drag-region/Tauri chrome detail and the history of what used to live here (tab rail, open button, theme toggle) and why it was removed.

### `TopRow`
- spec 2 · read at `1754b4518de0` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:09Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders a thin div strip with the Tauri drag-region data attribute on the container, centering the passed children (the color-mode switcher), sized/styled to match SideBarHeader's height so the two form one continuous bar across the window.
- found: A header with data-tauri-drag-region, flex-centered children, select-none, height set via the --titlebar-h CSS var to match SideBarHeader.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/api.ts

### the file itself
- spec 3 · read at `a7e1ac7b1c89` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is the central data/API layer for a desktop app (likely Electron) that manages "projects" (repos being read/graded) and orchestrates an agent-based code-reading/grading workflow — the same "sanity" protocol this session is running. It's a thin bridge over some underlying IPC/electronAPI (project list/select/reorder/forget, CLI install/status, file reading, starting/stopping scans/checks) mixed with domain logic for aggregating agent reports into scores (reportGrades, reaggregate, summarize, isReportStale), and a set of pure heat/color-ramp helper functions (temperature, wedgeHeat, heatColor, rampStop, rampAt, paintHeat, shareRamp) used to visualize scan coverage/quality. Given the sheer variety of unrelated concerns (CLI installation, theme menu sync, node tree pruning, color ramps, event subscriptions), I expect this file to be a large, mixed-responsibility "everything the UI needs" module rather than a single cohesive abstraction.
- found: A mixed-responsibility frontend data layer: hand-written TypeScript types mirroring a Rust backend's wire format (Node/Score/Scan/AgentReport etc, heavily commented), thin invoke()-based IPC wrapper functions calling into a Tauri (not Electron) backend for project management, scanning, and CLI install, listen()-based event subscription helpers for streaming scan progress/scores, substantial tree-aggregation/report-grading business logic (reaggregate, applyScores, applyAgentReports, summarize), and a final pure color/heat-ramp math section (heatColor, rampStop, rampAt using CSS color-mix) for visualizing scan results. No file-level header comment exists.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The runtime is Tauri (invoke/listen from @tauri-apps/api), not Electron — worth noting for anyone predicting from the outside since 'desktop app IPC bridge' is ambiguous between the two.

### `pruneExcluded`
- spec 3 · read at `387ef5c13909` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:29Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively rebuilds the tree, dropping any file-kind node marked excluded (and any directory left with no children as a result), and recomputing each surviving directory's loc as the sum of its remaining children's loc rather than trusting the size Rust computed — so excluded subtrees stop inflating wedge sizes on screen.
- found: Recursively filters out any child marked excluded (checked at any node, not just files) and recurses into survivors; func nodes pass through untouched, file nodes keep their own loc as-is, and only directory nodes get loc recomputed as the sum of surviving children.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I assumed only file-kind children get filtered by `excluded`; the code checks the flag on whatever kind the child is, trusting that only files ever carry it (per the doc's inheritance note) rather than enforcing that here.

### `localityOf`
- spec 3 · read at `f3702b0c8e99` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Reads two counts off the node (e.g. n.outside and n.wired/n.neighbours) representing wiring that leaves the directory vs total wiring, and returns outside / total as the locality ratio, or null if total is zero/undefined (nothing wired to it).
- found: Returns null if n.incident or n.away is null/undefined or n.incident is 0; otherwise returns n.away / n.incident.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `showsShare`
- spec 3 · read at `e52fc0ff471b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:36Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns true when this node's wedge is colored by hot_share rather than temperature — i.e. when node.kind is 'dir' or 'file' rather than 'func', matching the model.rs distinction that only leaf functions show raw temperature while containers show the share of their lines that are hot.
- found: Returns true when node.kind !== 'func' (matching my prediction) OR when node.rest !== undefined — an additional case for some kind of aggregated/rolled-up pseudo-node I didn't anticipate.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: `node.rest` isn't explained anywhere in what I was shown — a future reader needs to know what that field represents to understand the second disjunct.

### `toNode`
- spec 3 · read at `080ed280690b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:46:58Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Converts a WireNode (raw API/wire-format node) into the app's internal Node type, mapping and renaming fields, filling in defaults for any optional/missing properties, and recursively converting any nested child nodes to Node via the same function.
- found: Maps a WireNode (snake_case wire format) to the app's Node type (camelCase), defaulting most optional fields to null via ?? null, defaulting hotspots to [] and funcs to 0, converting the nested score object field-by-field, and recursively mapping children via toNode. A code comment explains the deliberate null-vs-zero distinction for callers/calls/etc: null means "nobody looked" (unanalyzed) vs a real zero meaning "analyzed, found nothing."
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The ?? null vs ?? 0 distinction is a real semantic decision (unanalyzed vs analyzed-and-empty) worth preserving if this function is ever refactored.

### `agentActivity`
- spec 2 · read at `498e4cdbcd05` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:20:44Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Simple fetch wrapper that calls a backend endpoint (likely /health or similar) and returns the parsed JSON as an AgentActivity object, used by the sidebar to poll whether an agent is currently active and show last-activity info.
- found: Calls Tauri's invoke('agent_activity') and on failure falls back to a default inactive AgentActivity object (active: false, empty tool/events, nonce 0) rather than throwing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Used Tauri invoke (IPC to Rust backend) rather than an HTTP fetch as I'd guessed, with a graceful error fallback to a default value.

### `pickProject`
- spec 2 · read at `819957eba1c8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:16Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Opens a native folder-picker dialog (via Tauri's dialog API) for the user to choose a project directory, then sends that path to the backend to register/open it, returning the resulting Added project info or null if the user cancels the dialog.
- found: Opens Tauri's native directory picker dialog, and if the user picked a single directory (string result), invokes the `add_project` backend command with that path and returns the Added result; returns null if cancelled.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `saveMovie`
- spec 3 · read at `36307f93f094` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:33Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Converts the Uint8Array bytes into a base64 string, then calls invoke('save_movie', { bytes: base64, suggested }) (or similarly named Tauri command), which opens a native save dialog on the Rust side, writes the file if the user picks a location, and returns the chosen path as a string. If the user cancels the dialog, the Rust side returns null and this function passes that through unchanged.
- found: Opens the native save dialog via the Tauri dialog plugin (defaulting to `suggested` path, mp4 filter); if the user cancels (non-string path) returns null; otherwise base64-encodes the bytes with the `encoded` helper from ./movie and calls invoke('save_movie', {path, data}) to have Rust write the file, then returns the chosen path.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `installCli`
- spec 2 · read at `68f2c3a4f02f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:44Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Calls invoke('install_cli') (or similar) on the Tauri backend, which creates a symlink to the sanity binary in /usr/local/bin or ~/.local/bin, and returns the resulting { path, on_path } object.
- found: Thin invoke wrapper calling the 'install_cli' Tauri backend command, returning the { path, on_path } result.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `readCurve`
- spec 2 · read at `1c6a5b2181e8` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:48Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Makes a GET request to the backend for the given project key, fetching a precomputed array of cumulative line counts (one entry per ten functions read so far), and returns it as a number[]. Returns an empty array if the project is unknown or the read is complete, per the docs.
- found: Uses Tauri's invoke('read_curve', {key}) rather than an HTTP GET as I guessed, catching any error to an empty array.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `selectProject`
- spec 3 · read at `7472e8cc6b88` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:53Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Calls a backend endpoint (invoke/fetch) with the project key to mark it as the currently selected/active project, persisting that choice server-side so a restart reopens the same project, and likely updates a local store/state to reflect the new selection.
- found: A one-line thin wrapper invoking the Tauri backend command 'select_project' with the key — no local store update happens in this function itself.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The docs handed to me actually describe forgetProject's removal-from-sidebar behavior ('Take a project out of the sidebar... re-adding it restores everything it knew'), not selectProject — only the trailing sentence about restart-persistence fits this function, so the doc block reads as mismatched/misattributed rather than describing this function.

### `reorderProjects`
- spec 3 · read at `4f15725a072b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:46Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes the Tauri command `reorder_projects` with the given keys array, awaiting the backend call to persist the new sidebar order.
- found: Thin invoke wrapper calling the Tauri command 'reorder_projects' with keys.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `forgetProject`
- spec 3 · read at `3664d593232e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:35Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls the Tauri `invoke` bridge with a command like 'forget_project' and { key }, delegating to the backend to remove the project from the index — same one-line pattern as its sibling API functions.
- found: One-line wrapper calling invoke('forget_project', { key }).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `harnesses`
- spec 2 · read at `2458c1de1e62` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:35Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin async wrapper that calls the Tauri backend command (likely invoke('harnesses')) and returns the resulting array of HarnessInfo describing available agent harnesses the tool can drive.
- found: Thin wrapper invoking the Tauri 'harnesses' command, swallowing any error and returning an empty array instead.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Missed the silent-failure fallback to an empty array on error.

### `setReader`
- spec 2 · read at `65639281d69f` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:15Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin API wrapper function that sends the project key along with harness and model (which may be null) to a backend endpoint or Tauri invoke call, to record which agent/harness is reading that project. It returns a Promise<void> and likely does no other logic beyond the network/invoke call.
- found: Thin wrapper that calls Tauri's invoke('set_reader', { key, harness, model }) and returns the resulting promise.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `startCheck`
- spec 2 · read at `5e348db3d3b8` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:10:08Z · by ross@rossturk.com · warm reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin invoke() wrapper calling the 'start_check' Tauri command with key, and opts.model/readers/batch/limit each defaulted to null via ?? when undefined, returning the backend's { ok, error?, hint?, harness? } response directly.
- found: Exactly as predicted: invoke('start_check', {...}) with each optional field defaulted to null.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Already read this exact function verbatim in the prior api.ts file task, so this was recall, not prediction — reporting cold:false.

### `stopCheck`
- spec 2 · read at `0ebe9e44ca28` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:16Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that POSTs to a "/stop" endpoint (or similar) with the given project/run key, likely reusing a shared fetch helper, and resolves once the server acknowledges the stop request — it doesn't wait for the run to actually finish stopping.
- found: A one-line wrapper that calls Tauri's `invoke('stop_check', { key })`, forwarding the key to the Rust backend command and resolving when it acknowledges.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed it was a fetch/HTTP POST wrapper rather than a Tauri invoke call, though the shape (thin passthrough with a key) was right.

### `readable`
- spec 2 · read at `d8ec7b19b2c0` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:18Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes a ProjectSummary and returns a single number representing total readable units — summing something like p.functions + p.files (or their respective counts), consolidating the "total to read" calculation so it isn't duplicated across call sites.
- found: Returns p.functions + p.files, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `listProjects`
- spec 2 · read at `352ee0c679ef` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:18Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin async wrapper that calls the backend (via Tauri invoke or an HTTP fetch to the loopback API) to fetch the current ProjectList — the set of projects sanity is holding plus which one is active/selected — and returns the parsed JSON result.
- found: Thin wrapper calling Tauri's invoke('projects') and returning the resulting ProjectList promise.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `readSource`
- spec 2 · read at `47b1b31b57df` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:20Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls Tauri's invoke("read_source", { repo, relPath }) and returns the resulting Promise<string>, delegating the actual path-containment check to the Rust side.
- found: Thin wrapper calling Tauri invoke('read_source', { repo, relPath }) returning Promise<string>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `openCodeWindow`
- spec 2 · read at `4031a63c7534` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:23Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper calling Tauri's invoke with a command like 'open_code_window', passing repo and relPath, to open a new native window displaying that file's source. Returns the invoke promise directly.
- found: Thin wrapper calling invoke('open_code_window', { repo, relPath }).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `fileFunctions`
- spec 3 · read at `1870df3e44bb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Makes a single batched API call (not one per file) passing the project key and the list of paths, asking the backend to return the parsed function nodes for each file. Parses the JSON response into a Map keyed by path, with Node[] values, defaulting to empty arrays for any path not returned by the backend since paths absent from the tree are simply missing from the response.
- found: Single tauri `invoke('file_functions', {key, paths})` call returning a Record<path, WireNode[]>, converted into a Map with each WireNode mapped through toNode() to produce Node[].
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `projectScan`
- spec 2 · read at `0736de93c985` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:24Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin Tauri invoke wrapper calling something like 'project_scan' with the key, returning the Scan result or null if the backend has no scan for that project yet.
- found: Invokes the Tauri 'project_scan' command with the key, getting back a WireScan or null, and converts the wire type to the app's Scan type via toScan() before returning (or passes through null).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I missed the wire-type-to-domain-type conversion step (toScan), predicting a plain passthrough.

### `isReportStale`
- spec 2 · read at `fa05e056065b` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:26Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Compares some fingerprint stored on the AgentReport (e.g. a hash of the source, or line span/loc) against the current node's corresponding value, returning true if they differ — meaning the code has changed since the report was recorded, mirroring the Rust assessment::is_stale logic.
- found: Returns false if either the report or node lacks a `body`; otherwise compares the report's stored body text directly against the node's current body text and returns true if they differ.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `legibleOf`
- spec 2 · read at `f3e4acef69f7` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:29Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns r?.legible, but only if the report's ask/version still matches the current "legible" question — if the ask has since changed (a "dated" grade), it returns undefined instead of the stale value, since a moved question invalidates the old answer for coloring/counting purposes.
- found: Returns undefined if r is missing or r.legibleDated is true, otherwise returns r.legible — a simple dated-flag check rather than a version comparison, but same net behavior I predicted.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `trapOf`
- spec 3 · read at `794c438640c3` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:50:35Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: trapOf(r) returns whether the report has trap=true AND its spec is current (not dated) — a small accessor gating r.trap on r.trapDated/spec currency so a stale reading's trap answer no longer counts, returning false for undefined/dated reports.
- found: !!r?.trap && !r.trapDated — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `reportGrades`
- spec 2 · read at `340334c0f8d1` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:37Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Converts an AgentReport's categorical grades (predicted, documented, derivable, and legacy surprised) into numeric scores. For legacy reports lacking the new fields, maps the boolean surprised to the two extremes of the surprise scale. Enforces that when derivable is true, the returned documented value is forced to null/0 regardless of the recorded documented string.
- found: Exactly as predicted: maps legacy surprised bool to predicted grade, forces documented to 'none' when derivable is true, then looks both up in numeric grade tables.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `readingWords`
- spec 2 · read at `efb363b3ad5a` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:23Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns null if the node has no fresh agent reading (no `node.agent`, or `node.agentStale` is true, or the reading isn't reader-sourced); otherwise calls `reportGrades`/similar to get the reader's surprise and documented grades and maps them through word tables (like `HEAT_WORDS`/`DOC_WORDS` seen in `Dials`) into `{ heat, documented }`, with `documented` null if the reader didn't grade docs.
- found: Returns null unless the node is a function with a fresh (non-stale) agent reading. Otherwise derives the predicted grade (falling back from surprised boolean), maps it through HEAT_WORDS, and computes documented as DOC_WORDS.none if the reader marked the doc derivable, else the reader's documented grade mapped through DOC_WORDS, else null.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `agentReports`
- spec 2 · read at `e7c66ce4c92d` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:27Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that calls invoke('agent_reports', { key }) (or similar snake_case command) and returns a Promise<AgentReport[]>, passing the project key through to the Rust backend so it looks up reports for that specific project rather than a globally-tracked "current" project.
- found: Thin wrapper calling invoke('agent_reports', { key }) returning Promise<AgentReport[]>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `readInto` — QUIRKY
- spec 3 · read at `0f982de8c428` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:59Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns node unchanged if r is undefined or has no derivable score. Otherwise maps r.predicted to a binary extreme (full/most vs some/none) rather than a graded probability, and returns a new Node with that reading (score/temperature plus grade metadata) folded in, likely using helper peers like legibleOf/trapOf/reportGrades to attach the rest of the report's fields.
- found: Returns node unchanged if no report or no existing score. If the report is stale (code changed since reading), attaches the report but falls back to node.proxyScore for the actual score, marking agentStale true. Otherwise attaches the report, saves the old score as proxyScore, and merges in surprise (and documented, only if the reader graded it) from reportGrades(r), with source: 'agent' and analyzedShare: 1.
- predicted: some · documented: full · derivable: no · legible: most · trap: no

### `readIntoRing`
- spec 3 · read at `02985bf0b25d` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Maps over the ring's nodes, using readInto (or similar) to merge in each node's matching entry from byId when present, and preserves array identity when nothing in the ring changed (no node has a report in byId) — returning the same array reference in that case rather than a new one, and a new array only when at least one node was updated, so downstream memoization keyed on reference equality skips unaffected rings.
- found: Maps ring nodes through readInto(n, byId.get(n.id)), tracks whether any node reference changed, and returns the original ring array unchanged if nothing moved, else the new mapped array — exactly as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `applyAgentReports` — QUIRKY
- spec 3 · read at `9644574adae2` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:28Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks the Node tree and, for each AgentReport, finds the matching function by id and attaches/merges its grading fields (like predicted/legible/trap) onto that node, likely using helpers like reportGrades, legibleOf, trapOf to compute a per-node score, returning the (possibly cloned) updated tree.
- found: Recursively visits the tree; leaf nodes get an agent report merged in via readInto. Internal nodes get their children folded/reaggregated (only rebuilding if a child actually changed), and separately, if the internal node itself (e.g. a FILE) has its own report, that report is attached without affecting the rolled-up score, since file-level doc reports and function score rollups are distinct measurements.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `countPending`
- spec 2 · read at `ed6f00b2ea70` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:30Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree from `root`, incrementing a `stale` counter for func nodes whose reading is stale and an `unread` counter for func nodes with no reading at all (unanalyzed), skipping functions a .sanityignore excluded so it stays scoped identically to `summarize`. Uses simple counters with no array allocation or sorting, returning { stale, unread } directly.
- found: Recursively walks the tree propagating an outOfScope flag (once excluded, always excluded down the subtree), counting func nodes as stale (agentStale) or unread (no agent reading) while skipping excluded ones; returns plain counters, no arrays.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `summarize` — QUIRKY — TANGLED
- spec 3 · read at `b9687d83acc0` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:35:08Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree of Node (files and directories) starting at root, recursively aggregating statistics like total function count, total lines, and counts/percentages of grades (legible, documented, trap, predicted accuracy) from assessed functions into a single RepoSummary object used to drive an overview display (e.g. progress bar or dashboard) for the whole repo.
- found: Recursively walks the Node tree, tracking an "out of scope" flag propagated from excluded ancestors. Counts functions per-file (using the file's own funcs count rather than recursing into unfetched children) split into excluded vs in-scope; for func nodes, tallies read (with grade spread and byGrade buckets), stale, and derives unread as functions - read - stale so totals reconcile regardless of what's been fetched; also tracks legibility grades, trap count, and a sorted "hot" list by temperature/loc.
- predicted: some · documented: none · derivable: no · legible: some · trap: no

### `scanRepo`
- spec 2 · read at `252492de7a28` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: An async thin wrapper that invokes a Tauri command like 'scan_repo' with the given path and awaits/returns the resulting Scan object describing the repo's structure or functions found.
- found: Invokes 'scan_repo' with { req: { path } }, getting a WireScan, then converts it via toScan() into the app-level Scan type before returning.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `toScan`
- spec 3 · read at `bafc425abc8c` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:19Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Converts a WireScan object (the raw JSON shape sent from the Rust backend, likely snake_case fields and flat arrays) into the frontend's Scan type, renaming fields to camelCase and possibly building lookup structures (like a Map keyed by node id) from arrays for faster access in the UI.
- found: Converts a WireScan to a Scan by recursively converting the root node via toNode, and remapping the snake_case stats fields (files_scanned, files_skipped, without_history, calls_resolved, calls_unresolved, etc.) to camelCase, defaulting commits to 0 if absent.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No lookup maps are built — the tree stays a tree; conversion is just recursive node mapping plus a flat stats field rename.

### `onScanScore`
- spec 2 · read at `64991aedf868` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:27Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri backend event (likely named "scan-score" or similar) via listen(), invoking cb with the event payload's id and Upgrade data as each per-function reading streams in during a scan; returns an unlisten function to unsubscribe, mirroring the pattern of onScanProgress.
- found: Listens for Tauri "scan-score" event with payload {id, surprise, hotspots}, reshapes it into an Upgrade object {surprise, hotspots}, and calls cb(id, upgrade); returns a function that unlistens once the listen promise resolves.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Got the shape right but didn't predict the exact event name or the surprise/hotspots field reshaping into Upgrade.

### `applyScores`
- spec 2 · read at `81d9f5c34a2f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree recursively; for each leaf node whose id/path is a key in `scores`, clones it and applies the Upgrade (score/hot fields). For internal nodes, recurses into children, and if any child changed, clones the node and recomputes its aggregate fields (LOC-weighted mean score, hot share over analyzed lines) from the (possibly updated) children — mirroring Node::aggregate in Rust. Nodes with no changed descendants are returned unchanged (shared, not cloned), and the function returns the new root.
- found: Recursively visits the tree; for leaves present in the scores map, clones the node and patches only the `surprise` field of its score (plus hotspots, source, analyzedShare), leaving age/churn/doc fields untouched. For internal nodes, recurses and reaggregates via `reaggregate` only if a child actually changed, otherwise returns the same node reference for React reconciliation.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I expected the whole score object to be replaced by the Upgrade; actually only `surprise` (plus hotspots/source/analyzedShare) is patched, with churn/age/doc coverage explicitly preserved as historical/code properties.

### `reaggregate` — QUIRKY — TRAP
- spec 3 · read at `42c73f02d5d4` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:45Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recomputes a parent node's summary stats (counts, temperature/heat, aggregated grades like legible/documented) by rolling up its children array — sums like assessed/surprised counts, weighted average temperature, and some combination rule (e.g., worst-of or majority) for grade fields — returning a new Node with those fields replaced but identity fields (name, path) preserved. Mirrors Rust's Node::aggregate mechanically field-by-field.
- found: LOC-weighted rollup of children's scores: surprise/documented/churn are weighted averages; age is the max ageDays seen, lastTouchedDays is the min; hotShare/analyzedShare are computed differently for func vs non-func children; source is upgraded to the strongest instrument seen (agent > model > proxy) among children; commits is NOT recomputed (carried from existing node.score since summing would double-count commits touching multiple files).
- predicted: some · documented: some · derivable: no · legible: most · trap: yes
- note: The comments call out that this function previously had bugs (hardcoded null for touched, hardcoded 'proxy' for source) that were fixed to mirror Rust's Node::aggregate — a maintainer changing one side without the other reintroduces exactly those bugs.

### `stopHistory`
- spec 3 · read at `6057a674c87c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:48Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper around Tauri's invoke() that calls the "stop_history" Rust command and returns the resulting promise, with no extra logic on the frontend side.
- found: Thin invoke() wrapper calling the 'stop_history' Tauri command.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onScanProgress`
- spec 3 · read at `8d628373cc95` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:37Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri backend event (something like "scan-progress") via listen(), invoking cb with the event payload's project and Progress fields whenever it fires, and returns an unsubscribe function that calls the listener's unlisten.
- found: Subscribes to Tauri's 'scan-progress' event via listen(), destructuring project/progress off the payload into cb; returns a synchronous unsubscribe closure that awaits the listen promise then calls the resulting unlisten function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onSetTheme`
- spec 2 · read at `cf820892bc70` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:35Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Registers a Tauri event listener (e.g. 'set-theme' emitted from the Rust menu handler when the user picks a View → Appearance item) that calls cb with the new theme string, and returns an unsubscribe function that removes the listener.
- found: Listens for the Tauri 'set-theme' event and calls cb with the event payload; returns a cleanup closure that resolves the listen promise and calls the unlisten function.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `onOpenProject`
- spec 2 · read at `09397a88134b` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:36Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri menu event (something like 'menu-open-project' or 'open-project') via listen(), invoking cb() when it fires, and returns an unsubscribe function that tears down the listener — likely handling the fact that listen() returns a Promise<UnlistenFn> by wrapping it in a synchronous callback.
- found: Subscribes to Tauri 'open-project' event via listen(), calling cb() on fire, returns an unsubscribe fn that resolves the listen promise and calls the resulting unlisten function.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `cliStatus`
- spec 2 · read at `31d26e37e056` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:24:53Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Calls the Tauri backend (via invoke) to check whether the CLI tool is installed/available on the system, returning a Promise resolving to a CliState object describing its install status (e.g. installed, path, version).
- found: Invokes the Tauri 'cli_status' command and returns its CliState; on failure, catches and resolves to a default "not linked" state (linked: false, path: null, on_path: false, resolved: null, is_this_app: false) instead of rejecting.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `onInstallCli`
- spec 2 · read at `cb552cac5719` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:39Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Registers cb as a listener for the Tauri menu event fired when the user clicks "Sanity → Install Command Line Tool…", likely via listen('menu://install-cli', cb) or similar, and returns the unlisten/unsubscribe function so the caller can clean up.
- found: Calls listen('install-cli', () => cb()) and returns a synchronous closure that resolves the listen promise and calls the returned unlisten function — same shape as predicted, missed the promise-wrapping detail in the return.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `syncThemeMenu`
- spec 2 · read at `6746257ef32c` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri command (e.g. 'sync_theme_menu') passing the theme string, telling the native menu to update its checked/ticked state on the matching appearance item so it reflects the actual current theme rather than defaulting to System.
- found: Invokes 'sync_theme_menu' with { theme } and silently swallows any error via .catch(() => {}).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `temperature` — QUIRKY
- spec 2 · read at `d5e606c9b5ce` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:46Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Given a Score (or null, returning some baseline like 0), maps the score's `predicted` grade to a numeric surprise value — e.g. full=0, most/some/none scaling up — used to color the wedge visualization. The doc note implies it used to also factor in `documented`/derivable but now returns just the raw surprise from `predicted` alone, without any discount multiplier.
- found: Returns 0 for a null score; otherwise just clamps the score's already-computed `surprise` field to [0,1]. No grade-mapping arithmetic happens here — that lives elsewhere and this function is just the clamp/gate.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I assumed this function derived the surprise value from the predicted/documented grades itself; it actually just clamps a precomputed `s.surprise` field, so the real computation lives elsewhere.

### `wedgeHeat`
- spec 2 · read at `8d7a802b49e3` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:43Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Branches on whether node is a function (kind === 'Func' or similar): if so returns node.score.temperature, otherwise (file/dir/overflow) returns node.score.hot_share — the value that should color this wedge, per the doc's distinction between a single body's temperature and a collection's hot share.
- found: Returns 0 if the node has no score; otherwise delegates to a showsShare(node) helper to decide between node.score.hotShare (collections) and temperature(node.score) (single function), matching the doc's collection-vs-body distinction.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `shareRamp`
- spec 2 · read at `7f443945c094` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:48Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Takes a share fraction (0..1, e.g. hot_share) and remaps it through a nonlinear curve (like a sqrt or power curve) before it's used for visual purposes such as ring/wedge sizing or color intensity, so that the perceptual weighting of area or color doesn't scale linearly with the raw share value. Returns the transformed number, still roughly in 0..1 range.
- found: Clamps share to [0,1], divides by a SHARE_BAND constant (compressing the range considered before the ramp maxes out), then raises to SHARE_SKEW power — a nonlinear remap for visual intensity, not a plain sqrt as I'd guessed.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Correctly guessed a power-curve remap for perceptual weighting but missed the SHARE_BAND rescaling before exponentiation.

### `paintHeat` — QUIRKY
- spec 2 · read at `656341ed88cd` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:50Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Computes the color-paint value for a node by taking its raw heat/share from wedgeHeat(node) and remapping it through the ramp's own scale (likely via shareRamp), returning a number used to position the color on the gradient rather than the raw reported percentage.
- found: Returns 0 if no score; otherwise branches on showsShare(node) — if true, maps node.score.hotShare through shareRamp; otherwise uses temperature(node.score). Not wedgeHeat at all, contrary to my guess.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `isAnalyzed`
- spec 2 · read at `3e00264afba3` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:26Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Checks node.score and returns true only if the score's source/provenance field indicates a real model reading (not the 'proxy'/offline-heuristic source seen in scoreInto earlier) — distinguishing "actually looked at" from "guessed via the offline proxy," so proxy-scored nodes are treated as unanalyzed (gray) rather than colored.
- found: Returns false if no score. For container nodes (showsShare true) checks analyzedShare > 0; for leaf nodes checks score.source is 'model' or 'agent' (excluding 'proxy').
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `heatColor`
- spec 2 · read at `1cb793b31e21` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes a normalized value t (likely 0-1) and a ramp name, locates which of the five CSS custom-property stops t falls between (using a helper like rampStop or rampAt), and returns a CSS color-mix() or var() expression blending the two adjacent stops proportionally, so the actual colors stay defined in index.css.
- found: Uses rampAt to get the bracketing stop indices and fractional position, then returns a CSS color-mix(in oklch, ...) expression blending the two adjacent var() stops by that fraction as a percentage.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `rampStop`
- spec 2 · read at `9284629ce7d1` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:50Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Takes a fraction t (0-1) along the given ramp and computes which discrete color stop it's nearest to by rounding t against the ramp's stop count, then returns that stop as a CSS custom-property name string like --heat-3.
- found: Delegates to rampAt(t, ramp) to get stops array, index i, and fraction f, then returns stops[i] or stops[i+1] depending on whether f rounds down or up — same "nearest stop" idea I predicted, but the interpolation logic lives in rampAt rather than here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `rampAt`
- spec 2 · read at `2e632ef3d0ea` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a normalized position t (0-1) and a Ramp (array of color stops), finds the two stops bracketing t, and linearly interpolates between them to return an interpolated color value, for use by a heat/color ramp rendering system.
- found: Builds an array of 5 CSS custom-property names from the ramp name (e.g. --{ramp}-0..4), computes a clamped fractional index x into that array, and returns {stops, i, f} — the bracketing stop names and interpolation fraction — leaving the actual color computation/interpolation to the caller (likely via CSS variables).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected it to return an interpolated color value directly; instead it returns CSS variable names plus index/fraction for the caller to interpolate, and Ramp turned out to be a string name rather than an array of stops.

## web/src/lib/cn.ts

### the file itself — QUIRKY
- spec 2 · read at `82b9285f7d8d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Standard "cn" classname utility: a thin wrapper around clsx (join/filter conditional className strings), likely export function cn(...inputs) { return clsx(inputs) } or a direct re-export of clsx as cn. No tailwind-merge given the file is only 3 lines.
- found: Defines its own tiny clsx-like function (not importing the npm package) that filters falsy parts and joins the rest with spaces — a homegrown minimal classnames joiner.
- predicted: some · documented: none · derivable: yes · legible: not judged · trap: no
- note: The "peer" named clsx was this file's own local function, not the npm library I assumed it wrapped.

### `clsx`
- spec 2 · read at `e8933499c48d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:26Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Filters out falsy entries (false/null/undefined) from the variadic parts array and joins the remaining strings with a space, giving a minimal reimplementation of clsx for conditional className composition.
- found: One-liner: filters falsy parts and joins the rest with a space.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/colorMode.ts

### the file itself
- spec 3 · read at `f8ee24a343c4` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:13:00Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file implements the multiple "lens" color modes for the sunburst visualization (referenced elsewhere as five lenses, e.g. churn, wiring/structure, doc coverage, age, authorship). For each lens it computes an underlying per-node metric from readings/wiring data (functions like paintsFromReadings, paintsFromWiring, wiringShare, unreferencedShare, opaqueShare, docGrade, undocShare, ageSpanOf), buckets that metric into ramp stops (bucketsFor, ageRamp, ramped), maps it to an actual color (colorFor, slotColor, flash), and produces legend metadata (legendFor, rankCategories) so the UI can render a consistent legend per lens. It's essentially the data-to-color pipeline that turns raw analysis data into the palette defined elsewhere (e.g. palette-search.py's output).
- found: Defines all ten ColorMode lenses (surprise, legible, docs, traps, reach, locality, language, blame, churn, age) plus a history-replay overlay, and for each: computes the underlying per-node metric or share, buckets/ramps it to a color via colorFor, and provides bucketsFor/legendFor for the side panel's breakdown and legend. Much richer than I predicted — categorical palette handling for blame/language with rank-based slots, absence semantics (saysNothing), and a replay-specific flash/birth/touch overlay that overrides every mode.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level header doc exists (docs was empty), though almost every individual function/const has an unusually thorough inline doc comment explaining design rationale — the coverage lives at function granularity, not file granularity.

### `paintsFromReadings`
- spec 2 · read at `09004cfe8323` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns true if the given ColorMode is one derived from a reader's report (e.g. surprise/predicted, legibility, documentation) rather than from git history or static parse data. Likely implemented as a small array/set membership check or an equality chain against the reading-based mode names.
- found: Returns true if mode is one of 'surprise', 'legible', 'docs', or 'traps' — the four reading-derived color lenses, as opposed to git- or parse-derived ones.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted 3 of the 4 modes correctly (guessed 'legibility' instead of 'legible') but missed 'traps' as a fourth reading-derived lens.

### `paintsFromWiring`
- spec 3 · read at `018894d3e890` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns true if the given ColorMode is one of the modes derived from the call graph (e.g. callers/locality-based wiring modes), false otherwise — a simple set-membership or switch check, mirroring paintsFromReadings but for wiring-based modes instead of reader-based ones.
- found: Returns true if mode is 'reach' or 'locality', the two wiring-derived color modes.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Got the shape right but guessed 'callers' instead of the actual mode name 'reach'.

### `wiringShare` — QUIRKY
- spec 3 · read at `04e0d48e83ab` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:12Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Reads two precomputed summed fields off the node directly (e.g. outsideEdges / totalEdges, already aggregated in Rust's aggregate rather than walked), and returns outsideEdges / totalEdges, or null if totalEdges is 0 (nothing wired underneath).
- found: Just delegates to localityOf(node) — a one-liner wrapper, not inline arithmetic on node fields.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `unreferencedShare`
- spec 3 · read at `f75433fd4fe6` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:14Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Thin accessor mirroring wiringShare: reads pre-aggregated counts already computed in Rust off the node (something like resolvable-function count and unreferenced count) and divides to get a share, returning null when the resolvable denominator is zero/none resolves.
- found: Reads node.resolvable and node.orphans, returns null if either is null/undefined or resolvable is 0, else orphans/resolvable — field named 'orphans' rather than the 'unreferenced' I guessed, but same shape.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `isAuthor`
- spec 2 · read at `9578a38649cd` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:36Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Type guard returning true when key is a non-null string that represents a genuine git author, filtering out sentinel values like "Not Committed Yet" or similar git-internal placeholders that aren't real people, since those get treated as neutral/unanalyzed rather than attributed.
- found: Type guard: true when key is non-null and not equal to the UNCOMMITTED sentinel constant, narrowing to string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `slotColor`
- spec 2 · read at `3d46ee353bcd` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:34Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Indexes into a fixed array of palette colors by rank, returning a neutral/gray 'Other' color (like var(--structure)) if rank is out of bounds (>= palette length / SLOTS).
- found: Returns CATEGORICAL[rank] if in bounds, else the OTHER neutral color constant — exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `flash`
- spec 3 · read at `1cd1abae062e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:17Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: flash(token, label) returns a Paint object built directly from the token color as-is, with no blending/decay/mixing math (since 'flat' replaced the earlier decaying-mix approaches per the doc), plus the label field attached — likely something like { fg: token, bg: token, label } or similarly using the token verbatim.
- found: Returns a Paint using the token verbatim as a CSS var for fill, keeps the raw token as stop, computes a contrasting ink color via inkOn(token), and attaches the label — confirming the 'flat, no mixing' design the doc describes.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `ramped`
- spec 2 · read at `179de516bc35` · commit `9ea3e1f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:04:41Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Looks up the given ramp's stops, finds the stop nearest to v (clamped/quantized), computes the fill hex for that stop, and calls inkOn(fill) to get the readable ink color, returning {fill, stop, ink} as a Paint object so callers can't use one without the other.
- found: Delegates to rampStop(v, ramp) for the stop and heatColor(v, ramp) for the fill separately (both computed from v/ramp directly rather than fill being derived from stop), and inkOn(stop) takes the stop rather than the fill hex — my prediction had the right shape (bundling fill+stop+ink) but wrong data flow between the three helper calls.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I assumed ink was computed from the fill color's luminance directly; instead inkOn takes the stop, meaning ink readability is decided per ramp-stop rather than per exact fill hex.

### `ageSpanOf`
- spec 2 · read at `91acacf4eb3c` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:32:54Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line accessor that returns root.ageDays directly (already aggregated as the max over children elsewhere), with no floor or minimum clamp applied, per the docs' explicit rejection of a floor.
- found: Returns Math.max(root.score?.ageDays ?? 0, 0) — reads ageDays off the root's score object (optional), defaulting to 0, clamped non-negative. I predicted a bare accessor with literally no floor, but there is a 0-floor via Math.max, and the field is nested under `.score` rather than directly on the node.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ageRamp`
- spec 2 · read at `8d335d901c03` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:08Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A function that normalizes `days` (age of a node) against `span` (the repo's own oldest-to-newest range) to produce a 0–1 ramp value, using a logarithmic scale within that span so the oldest thing in the repo lands at the cold end and small differences among old items compress while young items separate more — replacing an earlier version that used a fixed 366-day span regardless of actual repo age.
- found: Clamps span to >=0, returns 1 (hottest) if span < 1 day (avoids 0/0 when everything is same-day-fresh), clamps days into [0, span], then returns 1 - log10(days+1)/log10(span+1) — a logarithmic ramp where day 0 maps to 1 (hot/new) and the oldest thing in the repo's own span maps to 0 (cold).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `opaqueShare`
- spec 2 · read at `2e6034b00e58` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node's subtree, summing lines-read where the reading's `legible` value indicates difficulty (weighting "none" more than "some", say), divided by total lines read in that subtree; returns null if no lines were read anywhere under the node.
- found: Walks the subtree, and for each func node with a non-stale agent reading, adds its loc to `read`, and if the reading's legible grade is "some" or "none" also adds to `opaque`. Returns opaque/read, or null if nothing was read. Excludes stale readings (agentStale), which I hadn't predicted.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `docGrade`
- spec 2 · read at `b23f091a5d1e` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:51Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Finds the agent report associated with node n (if any), and if the report's `derivable` flag is true, returns 'none' regardless of the raw `documented` grade; otherwise returns the report's `documented` grade as-is. Returns undefined if there's no report for this node.
- found: Returns undefined if the node has no agent report or the report is stale; otherwise returns 'none' if the report's derivable flag is set, else the report's documented grade.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `undocShare`
- spec 2 · read at `b4f77e8ad637` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Walks the subtree over both file and function nodes that have a reading, counting one vote per graded node (not weighted by lines) — incrementing a total and, when its doc grade is "none"/undocumented, an undoc counter — then returns undoc/total, or null if nothing underneath has been graded.
- found: Walks file/func nodes, and for each with a docGrade, increments graded, and if the grade is "some" or "none" increments bare; returns bare/graded, null if nothing graded. I predicted "none" alone counted as undocumented, but it's actually "some" OR "none" — matches the opaqueShare sibling's same two-grade threshold, which I hadn't connected until seeing it.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `saysNothing`
- spec 2 · read at `0aafd4177d54` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:30Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns true when a color mode's question doesn't apply to this node's kind — e.g. mode is 'trap' or 'blame' or 'language' and node is a directory (not a file/function) — as opposed to the mode applying but simply having no data yet, which is treated as a different (measured-absence) case elsewhere.
- found: Returns true (mode inapplicable) when mode is 'traps' and node is not a func (so both files and dirs are excluded, not just dirs), or when mode is 'blame'/'language' and node is a dir; otherwise false.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Docs (module-level, not per-function) fully explained the rationale; I slightly misjudged the traps condition as dir-only when it's actually func-only (excludes files too).

### `colorFor` — QUIRKY
- spec 3 · read at `b9c0f39bacea` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:12:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A switch/dispatch over ColorMode values that delegates to peer helpers (paintsFromReadings, paintsFromWiring, wiringShare, docGrade, ageRamp, etc.) to compute a share/value for the given node, then wraps the result into a Paint plus a human-readable label string. Returns null early whenever the relevant helper reports no data for that node, rather than inventing a default color.
- found: A big per-mode dispatcher for painting one node's wedge. First handles a history-replay override (grey/flash on birth/touch) that trumps every mode. Then branches on mode: surprise/legible/docs each split container (share-based rollup) vs leaf (graded value) with careful ramp-vs-linear choices and specific label wording; traps and reach are boolean/count-based rather than ramped, with distinct null-vs-zero semantics; locality unifies leaf/container via the same away/incident formula; churn and age read straight off score fields; blame/lang fall through to an author/language slot-color lookup with an uncommitted-lines special case.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The docs comment only describes the null-return contract; the bulk of the actual logic (mode branches, history override, per-mode share vs boolean semantics) is undocumented at the function signature and only explained via inline comments in the body.

### `rankCategories`
- spec 2 · read at `3520bac67344` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree from root, groups nodes by category (as determined by mode), sums lines per category, sorts categories descending by total line count, and returns a Map from category name to its rank/slot index (0 = biggest category).
- found: It just delegates entirely to legendFor(root, mode), taking the ordered legend names and building a name→index map from their order. All actual grouping/sorting logic lives in legendFor, not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment describes the overall purpose well but doesn't reveal that this is a thin wrapper around legendFor.

### `bucketsFor` — QUIRKY — TANGLED
- spec 3 · read at `b5d280b328c2` · commit `0ce57c0` · read by claude-sonnet-5 · via claude · when 2026-08-19T02:12:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: bucketsFor walks the given subtree once, classifies each function (skipping .sanityignore'd ones) into a small number of discrete categories/bands depending on mode (e.g. doc grade, wiring/unreferenced share, age), and tallies counts per bucket. For ramped modes it computes the mean of the members' underlying ramp input per bucket and asks colorFor/the ramp for that color rather than inventing a swatch; anything the mode can't classify goes into a final "unclassifiable" bucket colored with the structural neutral, and it returns an array of Bucket objects (label, color, count) that sum to the same total as the header's function count.
- found: A big per-mode dispatch: walks the tree (both files, for blame/language/docs, and funcs) building buckets keyed by category, with mode-specific logic for blame/language/docs/legible/traps/reach/locality/churn/age, each with its own UNKNOWN-bucket semantics and band lookups; ramped modes collect raw values per bucket and average them after the walk to pick a ramp color; then each mode has its own sort order for the output, with the UNKNOWN bucket always pushed last.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: Got the overall shape (walk + bucket + ramp-mean + colorFor-consistency) but missed how much mode-specific branching, per-mode sort ordering, and file-vs-func handling lives inside — it's really ~9 near-independent classifiers glued into one function.

### `legendFor`
- spec 3 · read at `10460785a966` · commit `cecdbb2` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:34:48Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Switches on `mode` — for categorical color modes (like author, doc grade) it walks the tree from `root`, collects the distinct category value for each node using a mode-specific helper (e.g. `isAuthor`, `docGrade`), dedupes them into a list, and returns that as the legend labels. For continuous/ramp modes (age, wiring share, etc.) it returns an empty array since those don't need a discrete legend.
- found: Only handles 'blame' and 'language' modes (returns [] otherwise). Walks the tree summing loc per key (lastAuthor or lang), but only counts a node if it's a func, or a file that has no fetched func ring yet (funcs>0 acts as a stand-in so files don't get double-counted with their children). Filters blame keys through isAuthor to exclude non-human authors like uncommitted. Returns keys sorted descending by total loc, not just distinct values in arbitrary order.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The long comment explains a subtle bug history (empty legend after drilling into large repos) — worth reading in full before touching this function.

## web/src/lib/fan.ts

### the file itself
- spec 2 · read at `eba48bb0d5c9` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:01Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Provides the geometry/layout math for the "fan" view — when a file node is opened in the sunburst, its functions are laid out as sub-sectors fanning out from a chosen bearing rather than as a rectangular treemap. Helpers compute each function's angular sector (sectorOf, arcOf, share, room), unit conversions (deg), interpolation for animated open/close transitions between the collapsed wedge state and the expanded fan state (lerp, lerpSector), and placement/centering helpers (place, center), with fanFor as the main entry point returning the full layout for a node's children.
- found: Geometry for opening a file's wedge into a "fan": a bigger annular sector on the same bearing, tiled affinely in (angle, v=r²/2) space so the collapsed-wedge-to-open-fan animation is a pure arcPath interpolation with no morph/resampling. fanFor picks the best span (searched in 5° steps between MIN/MAX_SPAN) to maximize on-screen area given pane aspect; lerpSector interpolates two sectors in (θ,v); place maps a cell's fractional position in dest back into live coordinates; center/room give screen midpoint and label-space estimate for a patch.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no

### `sectorOf`
- spec 2 · read at `d0b697ca5f5d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:57Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A small arrow-function constructor that packages the four numbers into a Sector object literal {a0, a1, r0, r1} — a typed wrapper for the sector's angular and radial bounds, with no other math computed here.
- found: Packages angle bounds as-is but transforms the two radii through a vOf() function before storing as v0/v1 rather than storing r0/r1 directly — I predicted the object-wrapper shape correctly but missed that a value transform is applied to the radii.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Field names in the Sector output (v0/v1) differ from the parameter names (r0/r1), implying a radius-to-something-else conversion (likely area-preserving radius, given file doc talks of polar geometry) I didn't anticipate.

### `arcOf`
- spec 2 · read at `0be99cb3858e` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:55Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a Sector (angular range plus radial range) into an Arc object with the geometric values (start/end angle in degrees or radians, inner/outer radius) needed to render an SVG arc path, likely calling deg() to convert units.
- found: Builds an Arc from a Sector by carrying the angular bounds a0/a1 through unchanged and converting the sector's radial values v0/v1 into actual radii via rOf().
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `deg`
- spec 2 · read at `2daab0c4a6ff` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:55Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Converts a radian value to degrees by multiplying by 180/Math.PI, a one-line helper used elsewhere in this polar/fan geometry file for angle math.
- found: Converts radians to degrees via r * 180 / Math.PI, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `fanFor` — TANGLED
- spec 2 · read at `b427b46737a1` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:24Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Given the source sector's bearing (angle), generates candidate sectors at that same bearing with different angular spans, fits each to the pane's aspect ratio the way the viewBox would, and picks the candidate maximizing on-screen area — returning it as a Sector. If src is null, falls back to some default full/centered sector.
- found: Computes the midpoint bearing from src (or a default NO_WEDGE_BEARING if null), then sweeps candidate angular spans from MIN_SPAN to MAX_SPAN, computing each candidate's bounding box extent, the scale needed to fit paneAspect, and the resulting on-screen area; keeps the best-area candidate and returns it as a Sector with fixed core/rim radii.
- predicted: most · documented: most · derivable: no · legible: some · trap: no

### `lerp`
- spec 2 · read at `2a17dbad7eb0` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:56Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A basic linear interpolation helper: returns a + (b - a) * t.
- found: Standard linear interpolation: a + (b - a) * t.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lerpSector`
- spec 2 · read at `ade4c7e00f40` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Linearly interpolates each field of the Sector (its angular bounds and its v-space radii bounds) between a and b by t using the `lerp` helper, returning a new Sector object with the interpolated values.
- found: Linearly interpolates all four Sector fields (a0, a1, v0, v1 — angle bounds and v-space bounds) between a and b by t using lerp, returning the new Sector.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `share`
- spec 2 · read at `0660f08c622c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:11Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A one-line inverse-lerp helper: `(at - lo) / (hi - lo)`, returning the 0-1 fraction of where `at` sits between `lo` and `hi`, used somewhere in the fan/sector geometry math for placing or scaling a value along a span.
- found: Inverse-lerp helper: fraction of `at` between `lo` and `hi`, guarded to return 0 when the range is degenerate (hi <= lo) rather than dividing by zero or a negative range.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Missed the hi>lo guard against a degenerate/zero range.

### `place`
- spec 2 · read at `be52dcaa99f5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:43Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes the cell's fractional position/size within `dest` (its start and span as a fraction of dest's total span), then applies that same fraction affinely to `live`'s span/start to compute the corresponding Arc within live. Essentially an affine remap: (cell - dest.start)/dest.span gives a fraction, which is then scaled and offset by live.start/live.span to produce the returned Arc.
- found: Affinely remaps the cell's Arc from dest-sector fractional coordinates into live-sector coordinates: angles (a0/a1) are remapped directly via share() and lerp; radii (r0/r1) are first converted to some other space via vOf (likely area-linearizing), remapped by the same fraction/lerp, then converted back via rOf.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Correctly predicted the affine-fraction-remap structure for angle, but missed that radius goes through a vOf/rOf space conversion rather than being remapped directly like angle.

### `center`
- spec 2 · read at `56c3766c17a4` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:18Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the midpoint radius r = (g.r0+g.r1)/2 and midpoint angle a = (g.a0+g.a1)/2 of the arc, then converts to screen coordinates x = r*sin(a), y = -r*cos(a), returning {x, y, r, a}.
- found: Computes midpoint angle and radius of the arc, converts to screen coords via x=r*sin(a), y=-r*cos(a), returns {x,y,r,a}.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `room`
- spec 2 · read at `440ea093ab45` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:13Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Given an Arc (inner/outer radius + start/end angle), computes the arc's mid-radius as (inner+outer)/2, then w = arc length at that radius (angle span in radians × mid-radius) and h = radial thickness (outer - inner), returning {w, h} as the label's available width/height.
- found: w = angle span × mid-radius (arc length at mid radius), h = r1 - r0 (radial thickness); exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/history.ts

### the file itself — QUIRKY
- spec 3 · read at `3f95d900f520` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:31Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds and manages a time-series "history" of filesystem scans for a disk-usage visualization tool: scanning/warming directory snapshots (scanHistory, warmHistory, onHistoryProgress), maintaining a sorted list of scan dates (insertSorted, removeSorted, daysBetween), and replaying/aggregating those snapshots into per-frame directory trees for animation (enter, leave, advance, replay, frameTree, aggregate, collapse, dirNode, scopeOf, posOf, realOf). Likely the data layer behind a treemap-style UI showing disk usage change over time.
- found: This is the client-side replay engine for a code-archaeology sunburst visualizer: it folds a repo's commit-delta timeline (from Rust) frame by frame into a Frame (live LOC, churn, birth/edit commit indices, per-file/dir liveness counts), memoizes/advances that fold incrementally for smooth scrubbing, and builds a pooled Node tree per frame (frameTree) with aggregation, roll-up-when-too-thin, and directory collapsing — driving an animated 'flash on arrival/edit' visualization of how a codebase's functions were written over time. I predicted the general two-stage shape (scan/warm timeline data, then replay/aggregate into per-frame trees for an animated map) correctly, but assumed the domain was disk-usage/treemap when it's actually git-history/code-complexity (churn, surprise, LOC, authorship) — a materially different subject even though the structural pattern (sorted deltas, frame replay, tree aggregation, collapse) matched.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: The `docs` field handed out was empty despite the file carrying an unusually extensive module-level and per-declaration comment set (the 'surprise is not replayed' design rationale); the handout tool apparently doesn't surface file-level block comments the way it does for function docstrings.

### `scanHistory`
- spec 3 · read at `5cb544ec5c94` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (e.g. "scan_history") passing path, trace, fresh, and limit, awaits the result, and returns it as a TraceResult — trace=false does a cheap read of already-walked commits while trace=true triggers the expensive walk of unwalked commits.
- found: Thin Tauri invoke wrapper calling the 'scan_history' backend command with path, limit, trace, fresh, returning the TraceResult promise directly.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `warmHistory`
- spec 2 · read at `bf062faa9fb5` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:35Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Calls the backend's history-warm endpoint/function with the given repo path, awaiting and returning its boolean result (true if a cached timeline existed and was topped up, false if there was nothing to warm), without building a new timeline.
- found: Thin Tauri invoke wrapper calling the 'warm_history' backend command with the path, returning its boolean result.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `onHistoryProgress`
- spec 2 · read at `362d617cee23` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:44Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a backend event (e.g. Tauri's listen('history-progress', ...)) that reports progress of a history scan, calling cb with the Progress payload each time it fires. Returns an unsubscribe function that cancels the listener, likely handling the async nature of Tauri's listen by wrapping unlisten in a closure.
- found: Subscribes to Tauri's 'history-progress' event, invoking cb with each event's payload, and returns a cleanup function that resolves the pending listen() promise and calls the resulting unlisten function.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `insertSorted`
- spec 3 · read at `4a5a94b17561` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:43Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Binary searches `order` (an ascending array of numbers) for `f`'s insertion point; if the value at that position isn't already `f`, splices `f` into the array there to keep it sorted, otherwise leaves the array untouched since it's already present.
- found: Binary search for insertion index, splice in f if not already present at that index.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `removeSorted`
- spec 3 · read at `a7e707d61a2c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:46Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Binary-searches the ascending array `order` for the value `f`, and if found, splices it out in place (mutating the array), mirroring insertSorted's binary-search insertion.
- found: Binary search for f's index in ascending order array, splice it out if found; exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `daysBetween`
- spec 2 · read at `d174e1052ee9` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:38Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes (now - then) / 86400 to convert seconds to days, then clamps the result to be non-negative with Math.max(0, ...), since "then" could theoretically be after "now".
- found: Exactly as predicted: (now - then) / 86400 clamped to a minimum of 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `opening` — TRAP
- spec 3 · read at `52bdd59708bc` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:47Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds the initial Frame by folding together all the "truncated" (pre-window) commits from the history tables — aggregating file/dir sizes and structure into a starting snapshot — so history playback has a valid starting state before advancing frame by frame.
- found: Initializes an empty Frame, then seeds it from hist.base (the pre-window snapshot): for each file/loc pair it sets loc, accumulates total lines, appends to order, and calls census to register its path/dirs as present on screen — but deliberately does NOT mark these files as touched/born/dated, since their true last-write time is unknown and dating them to window start would falsely flare the opening frame as if the whole repo had just been written.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The 'census but not touched/born' distinction is load-bearing and non-obvious — skipping census would make containers falsely report as newly-arrived later, while marking touched/born would falsely flare the opening frame; both are guarded only by inline comments, not by types.

### `dirsOf`
- spec 3 · read at `2b3993be5c43` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Splits the path into segments and returns every ancestor directory (not including the file itself or the repo root), ordered innermost-first. For "a/b/c.txt" it would return ["a/b", "a"]. Likely implemented by repeatedly stripping the last path segment via lastIndexOf('/') or similar, pushing each intermediate directory into an array.
- found: Walks backward through '/' occurrences in the path using lastIndexOf, pushing each successive ancestor directory slice (innermost first), stopping before index 0 so the root is excluded.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `enter` — QUIRKY
- spec 3 · read at `d361298b896c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:14Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Adds function p to frame's live set/count, looks up which file p belongs to via hist, increments that file's function count in frame, and if the count transitions from 0 to 1, records a birth event for that file at time `at`. Per the doc, it does NOT propagate this birth further up to parent directories.
- found: Calls census(frame, p, hist) to count this path in; if it returns falsy (file already present), bails early without touching anything. Otherwise records the file's birth time, then walks each ancestor directory of the path and marks a directory birth at `at` for any directory whose live count is now exactly 1 (i.e. this file was the first thing in it).
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `census`
- spec 3 · read at `df00037ac7a8` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:55:34Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Increments the live function count for file p in frame, checks whether it was 0 before incrementing (capturing that as wasEmpty), then also increments the live count for each ancestor directory via dirsOf. Returns wasEmpty — whether the file itself had zero functions before this one was counted.
- found: Increments frame.pathLive for p; if it was already >0 (not the first), returns false immediately without touching directories. Otherwise increments every ancestor directory's dirLive count and returns true.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `leave` — QUIRKY
- spec 3 · read at `70ba89ec912c` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:18Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Removes function/path index `p` from the frame's live set (using removeSorted since order matters), decrements the owning file's function count via pathIndexOf/hist lookups, and if that count reaches zero, also removes the file itself from the frame's file list — so a file that later regains a function will be treated as a fresh arrival rather than a continuation, matching what enter() does symmetrically.
- found: Decrements the live-function count for path p; if it's still positive, just updates the count and returns. If it hits zero, deletes p's live/bornAt entries entirely, then walks all ancestor directories of that path (dirsOf) decrementing each dir's live count and clearing its bornAt when that too reaches zero — a full cascade up the tree, not just a one-level file removal.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `advance` — QUIRKY
- spec 3 · read at `fb2309ed4f03` · commit `cecdbb2` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T00:35:04Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Mutates `frame` in place by iterating commit indices from `frame.at+1` through `to` in `hist`, applying each commit's line-delta changes (from `deltas`) to the relevant file/dir entries in the frame (likely calling `enter`/`leave` for path additions/removals and `scoreInto`/`aggregate` to update rolled-up stats), then sets `frame.at = to` when done.
- found: Loops commit indices from frame.at+1 to to (breaking early if deltas aren't fetched yet). For each commit, applies per-function set/delete changes: updates loc/lines totals, tracks arrival (birth timestamp/index, insert into sorted order, calls enter() on the file path) vs. update, maintains a rolling churn window (frame.hits) capped at CHURN_MEMORY, and on delete calls leave() and cleans up all the per-function maps. Also stamps per-file author on each touched file. Finally clamps frame.at and sets frame.ts from the last applied commit.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The comments explain two non-obvious invariants (deltas may lag behind `to`; "arrived" must be keyed on presence in frame.loc, not on `born`) that are essential context for anyone modifying the arrival/rewrite logic.

### `replay`
- spec 3 · read at `42fe5ca709c5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:35Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Reconstructs the Frame (a snapshot of file/dir state) at a given index into the history by starting from an initial/base state and applying the sequence of deltas up through that index, likely calling a per-step helper (advance/enter/leave) to accumulate changes, and returning the resulting Frame.
- found: Memoizes the last-computed Frame per hist; if a cached frame exists for the same hist and its position is already at or before the requested index, it advances that same frame forward in place and returns it (incremental replay). Otherwise it builds a fresh starting frame via opening(hist), advances it to index, caches it, and returns it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the module-level memo/incremental-advance optimization entirely — assumed replay always rebuilt from the initial state.

### `headSizes`
- spec 3 · read at `f5ebe8bd7403` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:30Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks the live Node tree (root) recursively, visiting every node and recording its id and its size (e.g. lines) into a Map<string, number>, then returns it read-only. A straightforward single traversal, with no special handling for missing entries — that default (0) is applied by callers, not built into this function.
- found: Recursively walks the tree, and for every non-func node (dirs and files) records its id -> loc into a Map; func nodes are skipped entirely. Returns the map read-only.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed that func nodes are excluded from the map — only dirs/files get sizes recorded.

### `inStep` — QUIRKY
- spec 3 · read at `81b7b111bc96` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:41Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns whether index falls between since and at (e.g. index > since && index <= at), marking events that occurred during the commits the playhead just advanced through this frame/step.
- found: Returns at > since && at <= index — checks we're moving forward and the event's index is at or ahead of the new playhead position, not a since/at bracket on index as I'd guessed.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `scoreInto` — QUIRKY — TRAP
- spec 3 · read at `fa8007d47793` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Computes or refreshes a Score object for one function at replay frame f, reusing the `into` object when provided to avoid allocation churn during animation. It looks up the function's data in `frame`, and if analyzed data exists as of `since`, fills fields like surprise and analyzedShare; otherwise leaves those fields at 0/0 sentinel values meaning "nothing to claim here", which downstream code (isAnalyzed) checks before coloring.
- found: Fills history-derived fields only — churn (commits within CHURN_WINDOW_DAYS, saturated), ageDays, lastTouchedDays, commits, appeared/edited (whether born/edit falls within the current step window) — reusing `into` if given or allocating a fresh Score with surprise/analyzedShare/documented left at 0. It never touches surprise/analyzedShare/documented/provenance/source at all; those stay whatever the pooled object already had (or the 0 defaults on first use), which is exactly what the doc comment describes but I mispredicted as this function actively deciding to zero them per-call.
- predicted: some · documented: most · derivable: no · legible: most · trap: yes
- note: Trap: Score objects are pooled/reused frame-to-frame and this function does NOT reset surprise/documented/analyzedShare/provenance/source each call — a future field added here that forgets to explicitly write-or-null every frame will silently leak the previous function's value onto the next.

### `aggregate` — QUIRKY
- spec 3 · read at `e97ee2119cb8` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:26Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks node.children (if any), calling aggregate on each first, then combines their stats into `node`: sums LOC, computes a LOC-weighted average of some per-file metric (e.g. churn/heat), takes the oldest "appeared" date among children (via appearedOf) for node's age, and the newest "last touched" date for node's recency. Leaf nodes (files) are left as-is since they already carry their own values.
- found: Recursively aggregates children first, sums LOC, computes an LOC-weighted average churn, takes max ageDays and min lastTouchedDays across children, max commits (not sum), and builds a score object — but `appeared` is deliberately NOT rolled up from children, it's looked up directly via appearedOf(node.id) since a container's arrival is its own event; `edited` is always null for containers for the same reason.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment ('the same way Node::aggregate does in Rust') undersells this — the actually load-bearing logic (why appeared/edited are never rolled up) is explained in inline comments inside the function body, not in the docstring, so a reader relying only on the file_doc/docs field would miss the most important design decision.

### `collapse`
- spec 2 · read at `d28aae3d52ae` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:25Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a Node tree; for any directory node that has exactly one child and that child is itself a directory, merges them into a single node (combining names/paths with a separator) and continues collapsing down the chain, then recurses into the (now collapsed) children to do the same at deeper levels. Returns the transformed node, mirroring the Rust-side collapse_chains logic so the JS-side history replay tree matches the shape the initial scan produced.
- found: Recurses into children first (map collapse), then if this node is a single-dir-child directory, returns the child's node spread with the name joined as "parent/child" — effectively promoting the child up and discarding the parent's other fields (children, etc. come from `only`).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected a while-loop that flattens an entire chain in one node before recursing; actual code relies on the post-order recursion itself to naturally chain-collapse one level per call.

### `dirNode`
- spec 3 · read at `8d8d421ffd0e` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:41:12Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns a new directory-type Node object (as opposed to a file/function leaf node) with the given path and name, initializing its children to an empty array and other fields (size, color/temperature, etc.) to defaults appropriate for a container node in the tree/sunburst data structure.
- found: Constructs a directory-kind Node with the given path/name, all leaf-only fields (callers, calls, incident, away, resolvable, orphans, loc, line, lang, doc, score, body, lastAuthor, etc.) set to null/0/false, hotspots and children as empty arrays, and funcs count 0 — notably doc is explicitly always null with a comment explaining a directory is never given a doc since it's a replay of commit structure, not a fact about any commit.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `scopeOf`
- spec 3 · read at `21209e3f2b38` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:28Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Iterates all paths in hist.paths and collects the indices of paths that fall under `scope`, using segment-wise prefix matching (so "web/src" doesn't match "web/src-old"), returning them as a Set<number> for fast membership checks elsewhere (e.g. filtering which functions/files are in view during replay).
- found: Memoized: if the last computed scope set matches the same hist and scope, returns the cached Set directly. Otherwise walks hist.paths collecting indices where path equals scope or starts with scope+'/', caches the result in a module-level `scoped` variable, and returns it.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `pathIndexOf`
- spec 3 · read at `adbb902f8645` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:48Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds a Map<string, number> from hist's paths table (some array of path strings) to their index position, giving O(1) lookup from path string to its row/column index for later use in other functions like dirsOf/scopeOf.
- found: Builds a Map from path string to index over hist.paths, but memoizes it in a module-level `index` variable keyed by reference equality to `hist`, returning the cached map if the same hist object is passed again.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `frameTree` — QUIRKY — TANGLED
- spec 3 · read at `85afb546bb87` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:46:33Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Builds a fresh Node tree representing the repo's state at replay frame `index`, scoped to `scope` (or the whole repo). It walks the history tables to find which files/functions exist at that point (via something like census/opening), builds directory nodes (dirNode) and rolls small functions up into aggregate counts using a lines-based threshold (minLoc) that is scaled by `density` squared since it gates an area (tile) rather than a linear/angular quantity. It also marks nodes that changed between `since` and `index` so the sunburst can flash them (via inStep), and returns the root Node ready to hand to the same layout/render code the live map uses.
- found: Replays to `index`, builds dir/file nodes on demand, and for each live function either builds a node (reusing a pooled node keyed by function id across frames to avoid per-frame allocation, updating only the mutable fields loc/lastAuthor/score) or, if under a lines threshold (minLoc, scaled by density² and separately recomputed per-scope as scopeMin), folds it into a per-file rollup stand-in node keyed `${path}#/folded` (deliberately not `#/rest`, which `tileFunctions` also mints, to avoid a duplicate-key React bug that froze a ghost wedge). Finally calls `aggregate` to propagate an 'arrived this step' flag up to containers via dirBornAt/pathBornAt + inStep, and `collapse` before returning the root.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: Missed the node-pooling mechanism (`pool`/`nodes` map keyed across frame calls) entirely from the docs/signature alone — that's a significant perf-motivated design choice with no signal outside the body.

### `posOf` — QUIRKY
- spec 3 · read at `077496c8f1ea` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:27Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Binary search over the sorted `frames` array to find the position of `index` — returning the exact match position, or an insertion point if not present.
- found: Binary search that returns the index of the rightmost element in `frames` that is <= `index` (a "floor" search), or -1 if every element is greater than `index` — not an exact-match/insertion-point search as I guessed.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: This is a floor/predecessor search (largest frames[mid] <= index), not a general binary search for exact match — worth naming explicitly since 'posOf' alone doesn't convey the <= semantics or the -1 sentinel.

### `realOf` — QUIRKY
- spec 2 · read at `d12300962075` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:42Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: If pos is -1, returns fallback (the commit just before this scope's first). Otherwise indexes into frames[pos] to return the real commit number corresponding to that scoped position.
- found: Empty frames returns fallback; pos<0 returns frames[0]-1 (not the passed fallback); otherwise clamps pos to frames.length-1 and indexes.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I got the -1 case's intent right but wrong mechanism (frames[0]-1, not fallback), and missed the empty-array guard and clamping.

## web/src/lib/ink.ts

### the file itself
- spec 2 · read at `def5ec74d317` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:06:08Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A small color-math library: srgb/luminance/contrast implement WCAG-style relative luminance and contrast ratio calculations, over composites a color over a background, resolve turns a CSS color or var into concrete RGB values, theme reads the app's current theme as a fallback, and inkOn(backgroundColor) is the exported function that picks light or dark ink for a label based on which achieves sufficient contrast against that specific wedge's color rather than the app's theme setting.
- found: Exports fixed PAPER/INK literals (not theme-flipped) and inkOn(token, alpha) which resolves a CSS custom property to a hex color, composites it over the background at the wedge's fillOpacity, computes WCAG luminance/contrast against both PAPER and INK, and returns whichever contrasts more — falling back to CHROME_INK (var(--foreground)) when the token can't be resolved to a plain hex value (e.g. a color-mix). Results are cached keyed by theme+token+alpha since theme is the only thing that invalidates a resolved custom property.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `inkOn`
- spec 2 · read at `80e76d1ad85c` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Resolves the custom property token to an actual color (via `resolve`/`srgb`), composites it with the given alpha over the pane background using `over`, then computes luminance and picks between two candidate inks (light/dark) by comparing contrast ratios via `contrast`, returning whichever wins. If the token doesn't resolve to a plain color, it falls back to returning the chrome/foreground ink directly rather than guessing.
- found: Builds a cache key from theme+token+alpha and returns cached result if present. Resolves the token and background color to hex; computes the composited luminance (or plain luminance if alpha>=1 or background missing). Picks PAPER or INK by comparing contrast ratios, or CHROME_INK if the color didn't resolve. Caches and returns.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the memoization cache entirely; got the compositing/contrast decision logic right.

### `theme`
- spec 2 · read at `92ea90ceffc7` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:28Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A one-line function that reads the current theme (light/dark) from the DOM, likely checking document.documentElement's class list or a data attribute, returning 'light' or 'dark'. Used by inkOn/resolve to decide which ink color to use based on the active theme.
- found: Returns document.documentElement.className (guarding for SSR by returning a single space string if document is undefined), so callers presumably check whether 'dark' is a substring of the returned className rather than getting a clean enum value.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Returns the raw className string (with an SSR fallback of a single space), not a normalized 'light'/'dark' value as I expected.

### `resolve`
- spec 2 · read at `dae3c6f83baf` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:31Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Looks up a CSS custom property's resolved value (e.g. via getComputedStyle on document.documentElement or a probe element), and returns it as a string. Returns null if the value isn't a plain hex color (e.g. if it's a color-mix() expression), since callers rely on parsing this as a simple hex sRGB stop.
- found: Strips a var(--x) wrapper down to the bare custom-property name, guards for SSR (no document), reads the resolved value via getComputedStyle, and returns it only if it matches a strict 6-digit hex pattern, else null.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `luminance`
- spec 2 · read at `d09f89e8db80` · commit `9ea3e1f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T22:04:29Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Parses hex into r,g,b 0-1 channels, applies the sRGB linearization formula to each (dividing by 12.92 below threshold, else the gamma power-curve formula), then returns the weighted sum 0.2126*R + 0.7152*G + 0.0722*B per the WCAG spec.
- found: Delegates hex parsing and sRGB linearization to a separate `srgb()` peer function, and this function itself is just the weighted-sum reduce over the three linearized channels with the WCAG coefficients — I correctly predicted the formula but attributed the linearization step to this function rather than a helper.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `over`
- spec 2 · read at `20a3c83e9ba0` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:31Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Converts both hex and ground to linear-light RGB channels, alpha-blends each channel (fg*alpha + bg*(1-alpha)), then computes the luminance (relative luminance formula, e.g. 0.2126R+0.7152G+0.0722B) of that composited linear color and returns it as a number.
- found: Converts hex and ground to linear sRGB channel arrays, then reduces over channels computing the Rec. 709 luminance-weighted sum of each channel alpha-blended between the two colors — i.e. luminance of hex composited over ground at alpha.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `srgb`
- spec 2 · read at `17e3b63929cc` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:36Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a hex color string into its three RGB channels (0-255), normalizes each to 0-1, and applies the standard sRGB-to-linear gamma correction (dividing by 12.92 below a threshold, otherwise the ((c+0.055)/1.055)^2.4 power curve) to each channel, returning the linearized [r, g, b] array for use in relative luminance/contrast calculations.
- found: Parses a hex color string's R/G/B channels, normalizes to 0-1, and applies the standard sRGB-to-linear gamma correction for each channel, returning the linearized [r,g,b] array used in luminance/contrast math.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The file-level doc explains WHY (label ink contrast against heat-ramp wedges) but that context lives at the file level, not on this specific helper, which is pure standard color math.

### `contrast`
- spec 2 · read at `fcc143c88c68` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:31Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Implements the standard WCAG contrast ratio formula: given two luminance values a and b, computes (max(a,b) + 0.05) / (min(a,b) + 0.05), so the result is the same regardless of argument order.
- found: Standard WCAG contrast ratio: (max(a,b)+0.05)/(min(a,b)+0.05).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/label.ts

### the file itself
- spec 2 · read at `0d1a191b1b3f` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:40Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A small geometry/text-fitting module for sunburst wedge labels: `widthPerPx` estimates the average pixel width of a character for measuring how much text fits, `middleTruncate` truncates a string in the middle (preserving start and end, replacing the middle with an ellipsis) to fit a given pixel budget, and `fitLabel` is the main exported function that picks whether a label runs along the arc or along the radius based on the wedge's width-vs-depth shape, then truncates accordingly and returns positioning/orientation info for rendering.
- found: Confirmed the three functions do what I predicted at a high level, but fitLabel is considerably more involved: it computes max sizes for both arc and radial axes (capping arc size by an allowed bend in radians, centering the radial run and solving a fixed-point equation for its size), prefers the axis matching the wedge's own shape, falls back to the other axis if the preferred one can't hold the full name at all, and only as a last resort middle-truncates on the shape's own axis down to a length/character floor (MIN_KEPT/MIN_SHARE) before giving up and drawing nothing.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: File header and inline comments are unusually extensive design-history prose (why axis is chosen by shape not size, why bend is capped, why truncation is middle not tail) — none of that reasoning is derivable from the code alone.

### `widthPerPx`
- spec 3 · read at `ba81f995f47e` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:24Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Looks up a cache (keyed by text+weight) for a previously computed width-per-pixel ratio; on miss, creates/reuses an offscreen canvas 2d context, sets font to some fixed reference size and the given weight, calls measureText, and divides the resulting width by that reference size to get a per-px ratio, storing it in the cache. If canvas/context creation fails, falls back to multiplying text.length by a constant average character-width ratio instead of measuring.
- found: Caches width-per-px by weight+text key; on miss lazily creates a canvas 2d context, measures text at a reference font size and family, divides by ref size, applies a 1.06 fudge factor to account for measureText undereporting actual ink width, and caches it. Falls back to text.length*0.6 if no canvas context is available.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The 1.06 fudge factor and font-family inclusion in the cache key weren't predictable from docs/signature alone.

### `middleTruncate`
- spec 2 · read at `b7213f9d08f3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:07Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Truncates `name` down to roughly `keep` characters by keeping the head and tail and replacing the middle with an ellipsis character, splitting the kept budget between the two ends (e.g. floor/ceil of keep/2) so both the shared prefix and the distinguishing suffix survive. Returns `name` unchanged if it already fits within `keep`.
- found: Returns name unchanged if it fits; returns empty string if keep is below a minimum threshold; otherwise splits keep between head (ceil half) and tail, joining with an ellipsis.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Didn't anticipate the MIN_KEPT empty-string case, but the core middle-truncation logic matched exactly.

### `fitLabel` — TANGLED
- spec 2 · read at `3a263653e782` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:13Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Picks the label's axis (arc vs radius) from the cell's shape, then tries to fit the full name first — on the preferred axis, then possibly the other axis — before falling back to a middleTruncate'd version, using widthPerPx to measure available space per axis. It returns the best Placement it can achieve (full name beats truncated regardless of axis), or null if even a truncated name can't fit within the cell's floor size.
- found: Computes max legible size along both arc and radial axes via distinct geometric formulas (radial solved as a fixed-point for centering), picks a preferred axis by cell shape, tries whole name on preferred then other axis, and only if neither fits falls back to middle-truncating on the preferred axis alone until it fits at MIN_SIZE or gives up (null).
- predicted: most · documented: most · derivable: no · legible: some · trap: no

## web/src/lib/monster.ts

### the file itself
- spec 3 · read at `aafd01a92733` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:59Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A small localStorage persistence utility for a per-project "monster" (likely a playful mascot/pet UI element tied to each project's key). keyFor builds the storage key from a project identifier, storedMonster reads and deserializes the saved monster state for that key, saveMonster serializes and writes it, and forgetMonster removes it — no business logic beyond simple get/set/delete against localStorage.
- found: localStorage persistence for a per-project mascot/creature blueprint: keyFor builds the key from project path, storedMonster/saveMonster/forgetMonster read/write/delete it, all with silent failure handling. Deliberately excludes minting a new creature (that lives in a separate heavy three.js bundle loaded lazily by MascotFigure) so this lightweight file can be imported by the always-visible sidebar without pulling in 1.2MB of three.js.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: Docs (none present as a header, only per-function JSDoc) explained something the file's shape already implied (no mint function present) plus a bundle-size rationale that wasn't derivable from code alone.

### `keyFor`
- spec 3 · read at `b6c7a2957f27` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns a localStorage/cache key string built from the project path, e.g. `monster:${project}`, falling back to a fixed sentinel string when project is null/undefined so all no-project windows resolve to the same stored creature.
- found: Concatenates a module-level PREFIX constant with the project path, defaulting to empty string when project is null/undefined, so all no-project windows share one key.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `storedMonster`
- spec 3 · read at `a0347f090540` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:34Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes a localStorage key via keyFor(project), tries to read and JSON.parse the stored value, wrapped in a try/catch so any error (storage unavailable, corrupt JSON, missing key) returns null rather than throwing.
- found: Reads localStorage at keyFor(project), JSON.parses it if present, and returns null on any failure (missing key or thrown error) via try/catch.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: None.

### `saveMonster`
- spec 3 · read at `40ed68247741` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:40Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes a localStorage key via keyFor(project) (probably returning early/no-op if project is null/undefined), JSON.stringifies `config`, and writes it to localStorage inside a try/catch that silently swallows any error (e.g. quota exceeded or storage unavailable), since the docs say failure is not worth surfacing.
- found: Writes JSON.stringify(config) to localStorage under keyFor(project), swallowing any error silently.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `forgetMonster`
- spec 3 · read at `9533540c82f7` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:49Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the storage key for `project` via keyFor and removes it from localStorage (or whatever storage backs saveMonster/storedMonster), so the next call to look up this project's monster finds nothing and mints a fresh one instead of reusing the old blueprint.
- found: Removes the localStorage entry for keyFor(project), wrapped in a try/catch that silently no-ops if storage is unavailable.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/movie.ts

### the file itself — QUIRKY
- spec 3 · read at `8194ca063b11` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:04:07Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Implements screen-recording/video-export of the sanity map UI — capturing a sequence of rendered frames (via a Shot class with target/draw) as the visualization animates, waiting for it to settle between frames (settle, within), then encoding the frames into a video/gif and returning it as base64 (encoded, base64). probe/preflight check browser/canvas capabilities before starting, and faceCss/varCss/background grab styling to bake into rendered frames.
- found: Records a fixed-length MP4 export of the commit-history replay: for each output frame it maps to a commit, ensures/fetches that commit's timeline data, re-renders the map, rasterizes the live SVG via Shot into a canvas, and feeds it to a WebCodecs encoder (via mediabunny) with codec preflight/fallback (H.264 then H.265), hang-detection timeouts on every async step, and per-stage (fetch/fold/raster/encode) progress+ETA reporting.
- predicted: some · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file header doc existed at all (docs was empty) despite extremely dense per-function docs — file-level summary would have helped orient before diving in.

### `base64`
- spec 3 · read at `679d78a3ef04` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:00:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Converts a Uint8Array to a base64 string. Avoids String.fromCharCode.apply(null, bytes) on large arrays (which throws due to argument/stack limits) by processing bytes in fixed-size chunks, building up a binary string piece by piece, then calling btoa on the concatenated result.
- found: Chunks the byte array in 0x8000-byte slices, converts each chunk with String.fromCharCode(...chunk) to avoid exceeding the call-stack/argument limit, concatenates into a binary string, then base64-encodes with btoa.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `faceCss`
- spec 3 · read at `609a08282997` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Fetches @font-face CSS declarations and inlines the referenced font file(s) as base64 data URIs (likely using the base64 and varCss helpers), returning a self-contained CSS string so fonts render correctly in an offscreen/exported canvas snapshot used when recording a "shot" or movie of the UI.
- found: Fetches each font file listed in FACES, base64-encodes it, and builds an @font-face CSS rule embedding it as a data URI (woff2) for the 'LINE Seed JP' family at each weight, joining all rules into one CSS string.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `varCss`
- spec 3 · read at `cef6b812b36b` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:29Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Scans the document's stylesheets to collect the names of all custom CSS properties (--foo) used/declared anywhere, then for each name reads its currently active value via getComputedStyle on the document root (so light/dark theme is respected), and returns a CSS string like ":root { --foo: value; --bar: value; }" to be injected at the root of a cloned DOM so var() references keep resolving after being detached from the live stylesheet.
- found: Collects all custom property names referenced across document.styleSheets (skipping cross-origin sheets that throw), resolves each to its currently active value via getComputedStyle(document.documentElement), and returns a single `svg{--name:value;...}` CSS string (not :root) to inject so var() references keep resolving on a detached/exported clone.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `background`
- spec 3 · read at `bf279d52bb9d` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:58:14Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Reads the computed `background-color` style of the document (likely `document.body` or `document.documentElement`) via `getComputedStyle` and returns it as a CSS color string, so the video canvas can be filled with the same color the app currently sits on rather than defaulting to black or transparent.
- found: Reads the `--background` CSS custom property off document.documentElement via getComputedStyle, trims it, and falls back to '#fff' if empty.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `constructor` — OBSCURE
- spec 3 · read at `5734f846587d` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Stores the svg/size/bg fields, and injects the given style string into the SVG by creating a <style> element and appending/prepending it to the svg, so that later draws of this svg (or clones of it) render with consistent CSS. May also set the svg's width/height attributes to `size`.
- found: Stores the style string as a field, creates an offscreen canvas sized size x size, grabs its 2D context (throwing if unavailable), and stores it for later frame drawing. No DOM injection into the SVG happens here.
- predicted: none · documented: none · derivable: no · legible: full · trap: no
- note: The svg/bg fields are stored via parameter properties but never touched in this constructor body — all the visible work is canvas setup, unrelated to my SVG-styling guess.

### `target`
- spec 3 · read at `89dc2df62df9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:37Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Simple getter returning a stored canvas element field on the Shot instance, the HTMLCanvasElement this Shot draws to — no computation involved.
- found: Exactly as predicted: returns this.canvas.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `draw` — TRAP
- spec 3 · read at `f446b71567df` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:17Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: draw() is an async method on Shot that renders the current DOM target element into a canvas frame — likely serializing the target's HTML/CSS (using faceCss/varCss/background) into an SVG-wrapped image, drawing it onto a canvas, and encoding the result, contributing one frame toward a recorded "movie" of visual state over time.
- found: Clones the live SVG, strips its class, sets explicit width/height (letterboxing via preserved viewBox) and injects a style block, serializes it to a blob URL (chosen over a data URL for size/perf), loads it into an Image, awaits decode() raced against a DECODE_LIMIT timeout (to survive WebKit's decode() sometimes never settling), then draws it onto the canvas with a background fill, finally revoking the blob URL.
- predicted: most · documented: none · derivable: no · legible: most · trap: yes
- note: The WebKit decode()-hang workaround (raced against within()/DECODE_LIMIT) is not obvious from the signature and is the kind of thing a future editor could accidentally remove, reintroducing hung exports.

### `within`
- spec 3 · read at `f598d9fd28de` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:15Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Races `work` against a timer of `limit` milliseconds; if the timer fires first, rejects with an Error whose message incorporates `whenNot` (naming what failed to happen in time), otherwise resolves/rejects with whatever `work` does. Implemented via Promise.race with a setTimeout-based timeout promise, probably clearing the timeout on success to avoid leaking a dangling timer.
- found: Races `work` against a setTimeout(limit) that rejects with new Error(whenNot); clears the timer via .finally() on the work promise so it doesn't linger after work settles.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `settle`
- spec 3 · read at `fed51b8f3329` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:35Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns a Promise that resolves after two nested requestAnimationFrame callbacks fire, giving React time to commit and the browser time to paint before the caller reads back DOM/canvas state. Implementation is likely just `new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`.
- found: Returns a promise resolved via double nested requestAnimationFrame, exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `settings` — QUIRKY
- spec 3 · read at `c4117a755b56` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:39Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds and returns the encoder config object (bitrate derived from quality via preferBitrate, codec, latencyMode: 'realtime') used both by the preflight check and the actual recording, so the two paths can't drift apart.
- found: Just packages codec, quality, and latencyMode: 'realtime' into a plain object — no bitrate derivation, quality is passed through as-is.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I expected a preferBitrate conversion mentioned in the file doc to happen here, but this function is just the trivial object literal; the actual quality-to-bitrate logic must live elsewhere (or inside mediabunny's Quality type).

### `probe`
- spec 3 · read at `8340c10b3ff5` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:56:47Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Creates a small offscreen canvas/recording target of the given `size`, sets up a MediaRecorder (or similar) configured with `encoding`, and feeds it ten blank/black frames via the injected `deps` (for testability). It awaits whether the recorder successfully encodes those frames, resolving if the codec works and throwing (with a generic/swallowed error) if not, so the caller can fall back to trying another codec without needing to know why this one failed.
- found: Draws a blank filled canvas at `size`, sets up an Output/CanvasSource pipeline (mp4 format, buffer target) with the given encoding, and pushes 10 blank frames through it, each step wrapped in a timeout (within(..., PREFLIGHT_LIMIT)) so a stuck codec throws with a size/codec-specific message; always cancels the output afterward since only success/failure matters, not the resulting file.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `preflight`
- spec 3 · read at `94c0c0c0a49a` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:48Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Iterates candidate codecs (probably via the `settings`/`probe` peers) at the given size and quality, and instead of trusting `canEncodeVideo`'s yes/no answer, actually tries to encode a tiny test frame with each one in turn (using `probe`/`record`/`encoded` peers) to see if it truly works on this machine. Returns the settings for the first codec that actually produces output, and if none do, throws/returns an app-authored error rather than surfacing WebCodecs' raw browser-flavored error text.
- found: Loops over CODECS, builds settings for each via `settings(quality, codec)`, and calls `probe` to actually attempt an encode at the given size; returns the first encoding that doesn't throw, swallowing individual failures, and if every codec fails throws an app-authored error naming the tried codecs and size rather than surfacing the raw WebCodecs error.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `record`
- spec 3 · read at `36b9c118da1a` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:57:24Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Iterates output frame indices 0..totalFrames, computing for each frame's timestamp (f/FPS) which commit should be under the playhead at that point in the replay; only re-draws/rasterizes the sunburst (via a Shot-like helper) when that commit differs from the previous frame's, otherwise reuses the last rendered image to save work. Each frame is fed into a video encoder (likely WebCodecs VideoEncoder or similar), and once all frames are encoded the function finalizes/muxes them into an MP4 and returns the resulting bytes as a Uint8Array.
- found: Dynamically imports the mediabunny muxer, preflights codec/quality, sets up a Shot-based canvas capture and Mp4 Output/CanvasSource pipeline, then loops over `total` output frames mapping each to a commit index; only re-fetches/folds/rasterizes via `shot.draw()` when the commit under the playhead changes, otherwise reuses the last raster; every frame still gets encoded via `source.add`; tracks per-stage timing to report progress/ETA and checks a cancellation flag throughout; finally finalizes the MP4 output and returns its buffer as Uint8Array.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `encoded`
- spec 3 · read at `f3a2a05b43bb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:40Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a Uint8Array of binary movie/image data into a base64-encoded string, likely delegating to the peer `base64` helper function, so it can be sent as a JSON-safe string over the Tauri invoke bridge to Rust for writing to disk.
- found: Thin exported wrapper delegating to the base64() peer function on the given bytes.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/population.ts

### the file itself — QUIRKY
- spec 2 · read at `dcfeb20f2e65` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:24Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small utility module with two functions: populationOf(x) extracts/looks up a population number for some entity (place/region/row), and shareBelow(threshold) computes the proportion of a population falling below a given threshold (e.g. income or age cutoff). No header docs — treated as self-evident utility code, likely feeding a chart or stat display elsewhere in the web app.
- found: populationOf walks a repo's function tree (a Node from ./api) and builds three ascending-sorted numeric arrays — loc (all functions), heat (temperature of analyzed ones), and commits (90-day commit counts for ones with history) — as comparison populations for the whole repo, excluding synthetic 'rest' rollup wedges. shareBelow binary-searches a sorted array to find the strict share of values below v, returning null if the population is smaller than MIN_POP=20 to avoid misleadingly precise percentiles.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted a demographic/place-based population utility (populationOf(x) for one entity); it's actually a code-metrics distribution builder for percentile-ranking functions across a whole repo (LOC/heat/commit-churn), with shareBelow matching my guess structurally but populationOf being a whole-tree aggregator rather than a per-entity lookup.

### `populationOf` — QUIRKY
- spec 3 · read at `896819b96269` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a Node tree (likely a file/directory/function hierarchy from the assessment data) and aggregates some measure — such as counts of read/unread or graded functions — into a Population object. It's probably used together with shareBelow to compute what fraction of a node's descendants fall below some threshold, feeding a treemap or heatmap visualization.
- found: Recursively walks the tree collecting three parallel sorted arrays from real (non-rollup) function nodes: line counts (loc), a temperature/heat score for analyzed nodes, and commit counts for nodes with age data; excludes synthetic 'rest' rollup wedges from the distribution. Returns a Population of these three sorted number arrays, presumably for percentile/threshold lookups like shareBelow.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `shareBelow`
- spec 2 · read at `f33f7bcc8d86` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:27Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the fraction of values in the sorted array that are below (or at-or-below) v, using binary search over the sorted array to find the insertion/boundary index, then returns index/length as a percentile share in [0,1]. Returns null when sorted is empty since there's no population to compute a share of.
- found: Binary search (lower-bound) over sorted for v, returns lo/sorted.length as the share below v. Returns null if sorted.length < MIN_POP (a minimum sample threshold), not just empty.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## web/src/lib/runtime.ts

### the file itself
- spec 2 · read at `fe42178ca3d5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A small runtime-detection module exporting isTauri() (checks for a global like window.__TAURI__ without static-importing @tauri-apps/api), isMac() (checks navigator.platform/userAgent), isTauriMac() (combines both), and onFullscreenChange() which lazily/dynamically imports the Tauri API only when actually running inside Tauri to subscribe to fullscreen events, falling back to a plain DOM fullscreenchange listener in browser mode.
- found: Detects Tauri via window.__TAURI_INTERNALS__, isMac via userAgent, isTauriMac combines them (guards traffic-light gutter space), and onFullscreenChange is a no-op outside Tauri-Mac but otherwise lazily imports @tauri-apps/api/window and polls fullscreen state off the window's resize event (not a DOM fullscreenchange listener) to keep the reserved traffic-light gutter in sync.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: I assumed a plain-browser DOM fullscreenchange fallback existed; instead it's a pure no-op outside Tauri-Mac, and the live-tracking is driven by window resize rather than a fullscreen event.

### `isTauri`
- spec 2 · read at `33a9a1078966` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:57Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns whether a Tauri-specific global (like window.__TAURI__ or window.__TAURI_INTERNALS__) exists on the window object, without importing the Tauri API module — a cheap presence check usable in both desktop and plain-browser bundles.
- found: Checks typeof window !== 'undefined' and '__TAURI_INTERNALS__' in window.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Guessed the exact global name (__TAURI_INTERNALS__) among a couple plausible options and also predicted the SSR-safety typeof window check.

### `isMac`
- spec 2 · read at `18634f7d04cb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:51Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Checks navigator.platform (or navigator.userAgent) for a substring like 'Mac' and returns a boolean — a simple one-liner used to decide whether to render Mac-style traffic-light window chrome vs other OS chrome.
- found: Guards for navigator being undefined (SSR/non-browser), then regex-tests userAgent for Mac, iPhone, or iPad.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `isTauriMac`
- spec 2 · read at `cd44802ba44b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function returning `isTauri() && isMac()` — combining the two peer checks to detect the specific case of running inside the Tauri shell on macOS.
- found: Returns isTauri() && isMac(), exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onFullscreenChange`
- spec 2 · read at `3bca05eb1d24` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:38Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Dynamically imports the Tauri window API (to avoid a module-load-time dependency), gets the current window, subscribes to its resize event, and on each resize checks isFullscreen() and calls `cb` with the boolean result. Returns a cleanup function that unsubscribes the listener (likely async, since Tauri's listen() returns a promise for an unlisten function).
- found: No-ops outside Tauri-on-Mac. Otherwise dynamically imports the window API, reads fullscreen state immediately and on every resize, calling cb each time; tracks a `dead` flag so if the returned cleanup fires before the async setup finishes, the just-obtained unlisten function is invoked right away instead of leaking, and future reads are suppressed.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the isTauriMac() gate and the initial synchronous read() before the first resize; also missed the dead-flag race handling for early unsubscribe.

## web/src/lib/shape.ts

### the file itself
- spec 3 · read at `fbcc82d43fcd` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file handles an early "shape" event streamed from the Rust scanner — a lightweight signal of the directory/file layout (paths and sizes) that arrives before functions are parsed and scored. `dirNode` builds a placeholder directory Node, `shapeTree` assembles the partial tree from the shape data, and `onScanShape` is the event handler that wires this into the frontend so the sunburst can render its skeleton immediately while the real scan (with scores) is still running.
- found: Streams a "scan-shape" Tauri event carrying file paths/langs/function names+sizes before scoring completes, and shapeTree folds the accumulated batch into a placeholder gray Node tree (dirNode builds empty-score dir/file/func nodes) with careful dedup-by-latest-path and ordinal-suffixed ids to avoid React key collisions on duplicate function names, then sums sizes up the ancestry.
- predicted: full · documented: none · derivable: no · legible: not judged · trap: no
- note: Since docs was empty at the file-task level but the actual file has a rich header doc plus per-function docs, `documented`/`derivable` here reflect that the file-level `docs` field handed to me was empty even though the code itself is heavily commented.

### `onScanShape`
- spec 3 · read at `397f67f53a75` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri backend event (something like "scan-shape") via listen, invoking cb(project, files) with the event payload when it fires, and returns an unsubscribe/unlisten function to remove the listener.
- found: Listens for the Tauri 'scan-shape' event, calling cb with project and files from the payload; returns a function that unlistens (handling the async listen() promise).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `dirNode`
- spec 3 · read at `8d8a5631d908` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:50Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Constructs a placeholder Node (for the "assembling shape" map shown during streaming scans) representing either a directory or a file, with the given path and name, empty/zeroed fields for children, score, size etc. — enough structure to render before real scan data has arrived for that node.
- found: Builds a placeholder Node with every field explicitly set to null/0/empty (loc, line, lang, score, callers, calls, etc.) for path/name/kind, used for the streaming shape tree before wiring/scoring data exists; a comment explains wiring fields are null (not zero) because edges aren't resolved until the full tree lands.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `shapeTree` — QUIRKY — TANGLED
- spec 3 · read at `f09cd05a78a4` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:38:04Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a fresh root Node named `repoName`, then for each file in `files` splits its path into directory segments and walks/creates intermediate directory nodes (via the `dirNode` peer helper) as children, attaching the file itself as a leaf child of its parent directory. After inserting all files it sums `loc` up the ancestry so every directory node's size is the total of its descendants, leaving `score` unset everywhere (so unscored nodes render as neutral).
- found: Dedupes files by path (last one wins, for re-streamed scans), builds directory nodes lazily via a path→Node map, attaches each file as a leaf with per-function child nodes (disambiguated with an ordinal suffix when a file has same-named functions, e.g. from #ifdef branches), accumulates loc up through file and directory ancestry, and leaves score unset.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Missed the dedup-by-path step and the per-function leaf nodes with duplicate-name ordinal disambiguation entirely — assumed files were leaves with no children.

## web/src/lib/splash.ts

### the file itself
- spec 2 · read at `1fe713949d2b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A tiny module with one exported function, dismissSplash, that hides/removes the app's startup splash screen element (likely by id) once the real UI is ready — probably toggling a class or display style, maybe with a fade transition, and possibly guarding against calling it more than once.
- found: Idempotent dismissSplash() (module-level `gone` flag) fades the #splash element via a CSS class then removes it from the DOM after a 400ms timeout so it can't linger and swallow clicks; called both when the app has real content to show and by a timeout cap elsewhere in case readiness never arrives.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Got the mechanics right (idempotent, fade+remove) but missed the deeper rationale in the docs: it's timed to "has something to say" rather than first paint, and is deliberately raced by two callers.

### `dismissSplash`
- spec 2 · read at `cc88d07e92b6` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:37Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Finds the splash screen DOM element and hides or removes it, likely via a CSS class toggle or fade-out animation, marking it as dismissed so it won't show again this session.
- found: Guards against double-dismissal with a module-level `gone` flag, finds #splash, adds an 'is-gone' class to trigger a fade, then removes the element from the DOM after a fixed 400ms timeout (as a safety net in case the CSS transition never fires).
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The setTimeout-based removal (rather than transitionend) is explained by an inline comment as a deliberate safety net against clicks being swallowed.

## web/src/lib/stopwatch.ts

### the file itself
- spec 3 · read at `956f3a683199` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:55Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A tiny timing utility exporting mark() to record a timestamp/checkpoint and marked() to compute elapsed time since a given mark, used for lightweight perf instrumentation like logging scan duration. No file header doc.
- found: Dev-only frontend timing instrument: mark() records named timestamps relative to page load (once each, no-op in prod), and marked() is called once when the first map paints — it adds a final 'painted' mark (deferred a frame for actual browser paint) and console.logs all marks as one line, then goes silent.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `mark`
- spec 3 · read at `0ed9e38656e5` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:44Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Records the current time (performance.now() or Date.now()) into a module-level map/store keyed by the `what` label, so a later call to `marked` can compute elapsed time since this mark was set — a lightweight manual timing utility.
- found: Records performance.now() into a module-level map `at` keyed by `what`, but only in dev mode, only once per key (skips if already set), and not at all once some global `done` flag is set.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No docs at all on this function; the dev-only gate and the "done" latch that stops marking entirely aren't discoverable without reading the body or the rest of the file.

### `marked` — QUIRKY
- spec 3 · read at `b5cc07ba3800` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:51Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Called once when the first sunburst/map paints on screen; it checks whether it's already fired (a guard flag), and if not, calls mark() to get the elapsed time since the stopwatch started, console.logs a "time to first map" line, and sets the guard so subsequent calls are no-ops.
- found: Dev-only, fire-once guard (`done`). Schedules a requestAnimationFrame callback so timing reflects actual paint rather than React handoff; records a 'painted' timestamp into the shared `at` Map, then logs all accumulated marks (name + ms) joined into one console line.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/sunburst.ts

### the file itself
- spec 2 · read at `d29118dbd0ff` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:04:03Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file computes the geometry and data aggregation for the app's main tree visualization: a hybrid of sunburst-arc and squarified-treemap layout. It aggregates per-function "heat"/color values up through directories and files (aggregate, heatOf), computes treemap row placement using a squarified algorithm (rowPlacement, worstRatio), and produces SVG path strings for arcs/slices/labels (arcPath, labelArc, sliceFunctions, tileFunctions) representing files and their functions sized/colored by reading data. No file header doc, so the file's purpose has to be inferred from its exports alone.
- found: Implements sunburst layout: partitions the tree into angular wedges by lines/heat (layout), generates SVG arc paths (arcPath, labelArc), and — the bulk of the file — tiles individual functions within a file's wedge using a squarified treemap in (angle, r²/2) coordinates that conserves area exactly (rowPlacement, tileFunctions), with an alternate angular-slice mode for drill-down views (sliceFunctions), plus an 'aggregate' roll-up node standing in for functions that don't fit, sized/floored/promoted by heat and stretch limits.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file header doc at all; extensive inline doc comments on individual exports substitute for one, and most of that documentation is non-derivable — it explains historical bugs and design tradeoffs (e.g. why squarify in (θ, r²/2) space, why sized-then-heat ordering) that the code alone wouldn't convey.

### `heatOf` — QUIRKY
- spec 2 · read at `72fdba84ea74` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:14Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Small accessor returning a node's heat/temperature score for sunburst coloring — reads n.heat (or similar field) directly if present, falling back to 0 or an aggregate (max/average of children) for directory/aggregate nodes without their own score.
- found: Returns 0 if the node has no score; otherwise returns either s.hotShare or s.surprise depending on whether showsShare(n) is true, selecting which numeric field represents "heat" for that node's display mode.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `layout` — QUIRKY — TANGLED
- spec 2 · read at `93ad6e025533` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T02:59:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: layout recursively walks the tree building ring/angle geometry — each node gets an angular span proportional to its line count (or aggregate of children), nested rings by depth, capped at maxDepth. Children are sorted before being laid out — biggest-first by default, or by heat if opts requests it — producing a Layout structure of arcs (start/end angle, inner/outer radius) keyed by node.
- found: Recursively partitions the tree into angular wedges. Children are sorted biggest-first (by opts.sortBy for containers, else loc, tie-broken by name) or by heat if opts.byHeat; angular span is proportional to weight (loc, or 1 if opts.even). Wedges below opts.minAngle are culled (except functions, which render as dots) and their file/dir counts accumulated into `hidden` for reporting. Starts at 9 o'clock going clockwise so the biggest wedge's label lands near horizontal at the top. Respects opts.collapsed to stop descending into collapsed nodes.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

### `arcPath`
- spec 3 · read at `e48073887a6d` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:58:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the four corner points of the annular sector (inner/outer radius at start/end angle) by converting each angle to x/y via sin/cos, adjusted for clockwise-from-12-o'clock convention, determines the SVG large-arc-flag from whether a1-a0 exceeds pi, and returns an SVG path string with an outer arc, a line to the inner radius, an inner arc back, and a closing line, handling (or special-casing) the near-full-circle case to avoid a degenerate zero-length path.
- found: Converts the four corners of the annular sector to x/y via sin/cos (clockwise from 12 o'clock), computes the SVG large-arc-flag from a1-a0 > pi, and builds a path: move to inner-start, line to outer-start, outer arc to outer-end, line to inner-end, inner arc back to inner-start, close. Special-cases a near-full-circle span (can't be drawn as one arc since start/end coincide) by drawing two half-circle arcs for the outer ring and two for the inner ring instead.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `aggregate`
- spec 3 · read at `861d22a2b5ef` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:36:40Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds a synthetic Node representing the overflow functions that didn't get their own wedge in the sunburst band. It sums their LOC for the aggregate's size, computes a LOC-weighted mean of the `score`/heat of only the members that have actually been read/analyzed (skipping unanalyzed ones), and sets a name/label like "+N more" along with an id derived from filePath so it behaves like a normal leaf Node for coloring, hover, etc.
- found: Builds a synthetic overflow Node ("N+") summing LOC of the leftover functions, computing a LOC-weighted mean for every score field (surprise, documented, churn, ageDays, lastTouchedDays, commits, hotShare, analyzedShare) over only the analyzed members. Sets most wiring/reach fields to null since it's a collection wearing a function's kind, marks itself via a `rest` count and keeps the original member nodes in `children` so the detail panel can drill in, and namespaces its id as `filePath#/rest` to avoid colliding with history's own per-file fold node.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The comments reveal a specific past bug (hotShare computed over the wrong pool, id collision with history's fold) that isn't visible from the signature/docs alone.

### `vOf`
- spec 2 · read at `52de10c15242` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:40Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function that computes v = r*r/2 (or r**2/2), the substitution described in the docs that turns annulus-sector area into a plain rectangular product for squarified tiling.
- found: Computes v = r*r/2, exactly the substitution the doc describes for area-preserving annulus-to-rectangle mapping.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The math derivation in the docs explains WHY this formula is correct in a way the one-liner alone would not — genuinely non-derivable rationale.

### `rOf`
- spec 2 · read at `10225c7853a6` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:29Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function that converts a value into a radius using a sqrt scale (Math.sqrt(v) times some radius constant), so that area rather than radius is proportional to the value in the sunburst chart.
- found: Sqrt scale converting a value to radius, but with a factor of 2 inside the sqrt rather than a separate multiplier constant — got the shape right but not the exact formula.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `worstRatio`
- spec 2 · read at `1380b267cb2f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:23Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates the array of {w,h} screen-space dimensions and, for each, computes max(w/h, h/w) — the aspect ratio away from 1 (square) — then returns the maximum of those across the whole array, i.e. the least-square cell in the row.
- found: Computes worst (max) aspect ratio deviation from square across dims, starting worst at 1, and short-circuits to Infinity if any dimension is zero or negative.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `rowPlacement`
- spec 2 · read at `c12261b3c923` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:32:36Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Implements a squarified-treemap-style row layout adapted to radial/polar coordinates: given items with precomputed areas and a target sector, computes a row thickness (angular band for radial rows, or stacked wedge otherwise) sized to fit the total area, divides the row into per-item Slots, and returns the slots plus each item's width/height (for squareness scoring) and how much of the sector's extent was consumed.
- found: Computes total area of items, then for radial rows divides angle proportionally at fixed radial thickness (dv), and for wedge rows divides radius proportionally at fixed angular width (da); builds Slots and w/h dims for each, returns consumed extent — matches predicted squarified-row layout.
- predicted: full · documented: most · derivable: no · legible: most · trap: no

### `tileFunctions` — QUIRKY — TANGLED
- spec 3 · read at `878259fa9e6b` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:56:52Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Treats the wedge (r0..r1, a0..a1) as a rectangle-equivalent area and runs a squarified-treemap-style algorithm (using worstRatio/rowPlacement helpers) to tile the file's functions by their size (lines) into sub-regions within that wedge, alternating between splitting along the radial and angular axes to keep aspect ratios reasonable. If there are too many functions to fit at a legible minimum size, it collapses the smallest/overflow ones into a single rollup slot, similar to the old floor-based overflow behavior, and returns an array of Slot objects each with computed r0/r1/a0/a1 bounds.
- found: Computes each function's proportional area share of the wedge; functions clearing a minimum-patch floor are shown directly, sub-floor ones go to a tail that's rolled up into an aggregate slot, except hot or near-floor ones which get promoted/lifted into their own patch (bounded by a max-stretch factor and available capacity). All shown members' 'wants' (own area, or floor, or roll-up minimum) are summed and the whole set is scaled to exactly fill the wedge area. Then a squarified-treemap row-placement loop (choosing radial vs angular row direction by whichever is the shorter side) lays out slots in file order, and finally tags the rollup slot with how many functions it represents.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: The doc/comments explain the reasoning well but the actual heat-vs-size promotion and want/scale normalization logic is much more elaborate than the top-level doc conveys — a reader needs the inline comments, not just the file doc, to reconstruct it.

### `sliceFunctions`
- spec 2 · read at `103298d152b8` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Takes the function-level children of a file node and an angular range [a0, a1], and divides that range among them proportionally by line count (like a pie/sunburst slice), producing Wedge objects each with its own start/end angle — replacing fixed-radius radial-band stacking with something that scales to hundreds of functions.
- found: Divides angular range [a0,a1] among a file's function children proportionally by loc (or evenly if opts.even), with each slice guaranteed a minAngle floor. If the function count exceeds capacity (computed from span/minAngle), the lowest-heat functions are collapsed into a single aggregate wedge so the rest stay clickable/labellable rather than shrinking below floor.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Docs explained why (scaling past ~40 functions) but not the overflow-aggregation mechanism (ranking by heat, collapsing the tail into one Node via `aggregate`), which I missed entirely in my prediction.

### `labelArc`
- spec 2 · read at `86f231e6e50e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:32Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds an SVG path string tracing an arc at radius r between angles a0 and a1, intended to be used as a <textPath> for label text. Determines whether the wedge's midpoint angle falls in the bottom half of the circle, and if so swaps/reverses the start and end points (draws right-to-left) so text following the path isn't upside down. fontSize is probably used to offset the radius slightly (e.g., placing the arc a bit inside the outer radius) rather than being central to the direction logic.
- found: Builds an SVG arc path for a textPath, normalizing the midpoint angle to detect bottom-half wedges and reversing draw direction for those so text isn't upside down. Also offsets the radius by a baseline-to-center constant scaled by fontSize, in a direction that depends on whether the arc is forward or reversed, to correct for baseline positioning since dominant-baseline:central isn't honored on textPath in WebKit.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Docs explained the reversal and baseline-offset rationale (WebKit textPath quirk) which wasn't derivable from code alone — genuinely useful comments.

## web/src/lib/text.ts

### the file itself — QUIRKY
- spec 2 · read at `81445c50569e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:24Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small text-formatting utility module with two exported functions and no file header. `elide(str, maxLen)` truncates a string to a maximum length, appending an ellipsis ("…") when it's cut short, and returns the string unchanged if within bounds. `compactCount(n)` formats a number into a compact human-readable form for UI display (e.g. "1.2k", "3.4M") for things like counts/badges.
- found: elide() shortens a string by cutting out the MIDDLE and keeping both head and tail (weighted 65% to the tail) joined with an ellipsis, rather than truncating the end — designed for file paths where the tail (filename:line) matters most. compactCount() formats a number using locale comma-separated exact digits below 100k, then switches to 'k' (0 decimals) below 1M, and 'M' (1 decimal) above, prioritizing exact readability until digits would overflow a fixed-width column.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: File has no header doc (docs=[] as reported), but each function carries a substantial JSDoc explaining non-obvious design rationale (why middle-elide, why 65% tail weighting, why the 100k/1M thresholds) that isn't derivable from the code alone.

### `elide`
- spec 2 · read at `199d5d451e32` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:29Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns s unchanged if its length is <= max; otherwise keeps a shorter head and a longer tail (weighted toward the tail, since the end of a path is the informative part), joined with an ellipsis in the middle, sized in characters so the total length equals max (accounting for the ellipsis character(s)).
- found: Returns s unchanged if within max length. Otherwise splits the budget (max-1, for the ellipsis char) 65% to the tail and the rest (min 1) to the head, slicing s into head...tail joined by an ellipsis.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Exact match including the 65% tail-weighting and the -1 budget for the ellipsis character.

### `compactCount`
- spec 2 · read at `3d19f02e2df4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:11Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Formats a number with comma separators when under 100,000 (e.g. 16,072), and switches to a compact k/M suffix with one decimal place once it wouldn't fit otherwise (e.g. 16.1k, 2.3M).
- found: Uses toLocaleString comma formatting below 100k, whole-number k suffix below 1M, and one-decimal M suffix above that.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/theme.ts

### the file itself
- spec 2 · read at `dd33e147c7ef` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:18:05Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This file implements light/dark/system theme handling for the app: it loads and saves a theme preference (defaulting to 'system') via loadTheme/saveTheme, detects the OS preference with prefersDark (via matchMedia), applies the resolved theme to the DOM via applyTheme/applyStoredTheme (setting a class or data attribute), and watchSystemTheme listens for OS-level theme changes to reapply automatically when the preference is 'system'. It's driven by the app menu (View → Appearance) rather than an in-app settings toggle.
- found: Theme (light/dark/system) module: Theme type, THEMES/THEME_LABEL constants for a menu, loadTheme/saveTheme via localStorage (with try/catch fallback to 'system'), prefersDark via matchMedia, applyTheme toggling a 'dark' class on <html> (Tailwind v4 class-based dark mode), applyStoredTheme for applying at module load (complementing a blocking inline script in index.html that already prevented first-paint flash), and watchSystemTheme which only subscribes to OS changes when preference is 'system', returning a teardown.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header explains the *why* (no toggle, menu placement, class vs media-query) in ways not derivable from code alone — genuinely useful design-rationale docs, not restated code.

### `loadTheme`
- spec 2 · read at `85c8c2f73557` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads a persisted theme preference (likely from localStorage), validates that it's one of the allowed Theme values ("light"/"dark"/"system"), and returns "system" as the default if nothing is stored or the stored value is invalid.
- found: Reads the theme key from localStorage; if it's exactly 'light', 'dark', or 'system' returns it, otherwise (including if localStorage throws, e.g. unavailable) falls back to 'system'.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc describes the feature/product rationale for theme following the OS, not this specific function's behavior — so documented is about the enclosing file, not loadTheme itself.

### `saveTheme` — QUIRKY
- spec 2 · read at `bb2b7c2c4125` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:12Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Persists the theme choice ('light' | 'dark' | 'system') to localStorage under a fixed key, then calls applyTheme(t) to immediately apply it to the document so the UI updates without needing a reload.
- found: Just writes the theme to localStorage under KEY, wrapped in a try/catch that silently swallows failure (comment: "the preference just won't survive a restart"). Does not call applyTheme or anything else — callers are responsible for applying the theme separately.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: I assumed it also applied the theme to the DOM; it's purely a storage write, nothing more.

### `prefersDark`
- spec 2 · read at `864605f25436` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:09Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Returns `window.matchMedia('(prefers-color-scheme: dark)').matches` — a one-line check of the OS-level color scheme preference, used by the theme system to resolve the 'system' setting to an actual light/dark value.
- found: Returns window.matchMedia('(prefers-color-scheme: dark)').matches exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `applyTheme`
- spec 2 · read at `37763c7b64ab` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:13Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Resolves t (which may be 'system') to an actual light/dark value — using prefersDark() when it's 'system' — and sets that resolved value as a data attribute or class on document.documentElement so CSS can key off it.
- found: Resolves 'system' via prefersDark(), else dark===t==='dark', then toggles the 'dark' class on documentElement.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `applyStoredTheme`
- spec 2 · read at `d23f20061bcb` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:24Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Calls loadTheme() to read the persisted theme preference (falling back to "system") and passes it to applyTheme() to set the appropriate class/attribute on the document, run once at module load time.
- found: applyTheme(loadTheme()) — reads stored preference and applies it.
- predicted: full · documented: some · derivable: no · legible: full · trap: no
- note: Doc explains the why (relation to index.html's blocking script) rather than the what, which the one-liner body doesn't need explained.

### `watchSystemTheme`
- spec 2 · read at `6d2fb81ba7f4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:59Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: If t is not 'system', returns a no-op teardown function immediately. Otherwise sets up a matchMedia('(prefers-color-scheme: dark)') change listener that calls applyTheme (or similar) whenever the OS theme flips, and returns a function that removes that listener.
- found: Applies the theme immediately regardless of mode, then if t is 'system', subscribes to the OS dark-mode media query to reapply 'system' on change, returning an unsubscribe teardown; otherwise returns a no-op teardown.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed that it calls applyTheme(t) unconditionally up front before branching on system mode.

## web/src/lib/timeline.ts

### the file itself
- spec 3 · read at `2a42fb4daadb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:04:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This module manages commit-history data for the timeline view on the frontend without holding the whole history in JS memory — since a large repo's log/deltas can be tens of MB and freeze the window if received all at once. It fetches small bounded tables once (historyTables) and lazily fetches per-commit data (log entries, deltas, funcs) on demand as the user scrubs, via functions like historyLog/historyScoped/historyDeltas/historyFuncs. The Funcs and Deltas classes cache what's been fetched so far and track a "watermark" (how far into history has been loaded) with an `ensure`/`have`/`at` API so repeated scrubbing doesn't re-fetch already-loaded ranges.
- found: Matches my prediction closely: Tauri invoke wrappers fetch tables once, then log rows (screenful, thrown away) and deltas/funcs (fetched in growing blocks and KEPT since folding needs a full contiguous prefix). Funcs and Deltas classes page in blocks with in-flight dedup and watermark tracking so the delta fold never indexes a function that hasn't arrived yet — a coordination detail (watermark ordering funcs-before-deltas) I didn't anticipate.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The ordering guarantee — Deltas.ensure awaits funcs.ensure(watermark) before pushing the block — is the subtle correctness-critical part and isn't obvious from class/method names alone.

### `historyTables`
- spec 3 · read at `2d80e2ab30a4` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:59:47Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: historyTables invokes the Tauri backend's `tables` command with `path`, awaiting the bounded, repo-sized (not history-sized) lookup table data, and returns it as a Tables object — or null if the invoke fails or there is no cached data.
- found: A thin wrapper that invokes the Tauri command 'history_tables' with { path } and returns the Tables | null result directly.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `historyLog`
- spec 3 · read at `d2edce7b84c3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:03:44Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (likely "history_log") passing path, offset, count, and scope, returning a promise of a page of LogRow entries fetched lazily from Rust rather than held in the frontend. It probably does no caching itself, just forwards the paginated request to the backend and returns the raw array.
- found: Thin wrapper invoking the Tauri 'history_log' backend command with path/offset/count/scope, returning a promise of LogRow[].
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: The file_doc describes the module's overall design but this specific function has no docstring of its own.

### `historyScoped`
- spec 3 · read at `e60a230d0f8e` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:51Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Thin async wrapper that invokes the Rust `scoped` Tauri command with path and scope, returning the array of commit indices where that path/scope appears in the history, like the sibling history* wrappers in this file.
- found: invoke('history_scoped', { path, scope }) returning Promise<number[]>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `historyDeltas`
- spec 3 · read at `f31c38a9ab75` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:53Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper that calls the Tauri invoke('history_deltas', { path, from, count }) backend command and returns the parsed Delta[] result, possibly routing through a Deltas cache object's ensure/have methods to avoid re-fetching frames already loaded.
- found: Directly calls invoke('history_deltas', { path, from, count }) and returns the promise, no caching logic in this function itself (that lives in the separate Deltas class).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `historyFuncs`
- spec 3 · read at `e04b4ddd0e4b` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:53Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes the Tauri command 'history_funcs' with path, from, and count, returning the promise of HistoryFunc[] straight from the backend without additional client-side logic.
- found: Thin invoke wrapper calling the Tauri command 'history_funcs' with path, from, count.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `constructor`
- spec 3 · read at `b6d4826a79ac` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:57Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Initializes a Funcs instance that lazily caches per-commit function tables for a given repo path, storing `path` and `total` (total commit count) as fields alongside an empty cache structure (e.g. a Map or array) and a watermark of 0, to be filled in by `ensure()` as commits are scrolled into view.
- found: Just stores path and total as fields — no cache/watermark initialization here, presumably those are declared as class field initializers elsewhere or added lazily by ensure().
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I predicted extra cache/watermark setup in the constructor that isn't there — likely declared as class property defaults instead.

### `ensure`
- spec 3 · read at `44d868506881` · commit `cecdbb2` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:37:58Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A method on `Funcs` that lazily pages in function data up to `index`. It checks the current watermark (how far it has already fetched), and if `index` is beyond that, calls `historyFuncs` to fetch the missing range, storing results and advancing the watermark. It clamps to the timeline's actual length so an out-of-range index triggers one fetch attempt and then gives up rather than looping.
- found: Loops fetching `FUNC_BLOCK`-sized chunks via `historyFuncs` until `this.list` reaches `min(index+1, total)`, appending results each time. Concurrent callers share one in-flight fetch via `this.pending` rather than issuing duplicate requests, and a short read (fetch returned fewer than requested, i.e. list length unchanged) is treated as end-of-data and returns early instead of looping forever.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's "asks once and stops" undersells that it's actually a block-by-block loop with de-duped concurrent fetches, not a single request.

### `watermark`
- spec 3 · read at `9b165a2fe147` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:47Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the block: Delta[] array, reading each delta's function-index field, and returns the maximum index seen across the block, or -1 if the block is empty. A simple reduce/loop with no side effects.
- found: Scans each Delta's `set` (array of [funcIndex, ...] tuples) and `del` (array of funcIndices) entries, tracking the maximum function index seen; returns -1 if block is empty.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The docs' rationale (why computed client-side instead of round-tripping to the backend) isn't visible in the code itself, only in the comment.

### `baseWatermark`
- spec 3 · read at `4a86d66f6d22` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:54:46Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Iterates over the `base` array of [index, count]-like pairs (the opening state) and returns the maximum function index found, likely via Math.max over one element of each pair, defaulting to -1 or 0 if base is empty.
- found: Loops over `base` pairs, destructuring the first element `f` (function index) of each, tracking and returning the max, starting from -1.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `constructor` #2
- spec 3 · read at `550e113b9748` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:00Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Stores path and funcs on the instance, and initializes empty cache state (e.g. a map/array of loaded delta chunks and a watermark set to 0) that have/at/ensure will later populate lazily as more history is fetched.
- found: Just assigns this.path = path and this.funcs = funcs; no extra cache state initialized here (presumably declared as class field defaults elsewhere).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `have`
- spec 3 · read at `1ea40cf3a7c3` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:02Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns the count of frames already fetched/cached locally in the Deltas instance — likely the length of an internal array or map of loaded delta frames, representing how far the map can fold without another network request.
- found: Returns blocks.length * BLOCK — data is stored in fixed-size blocks rather than a flat per-frame array, so the count is derived by multiplying loaded block count by block size, not a direct array length.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `at`
- spec 3 · read at `6000321c5b34` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:02:03Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Deltas.at(index) is a simple accessor returning the cached Delta at that frame index from an internal array or map populated by ensure(), returning undefined if that index hasn't been fetched/loaded yet.
- found: Indexes into a blocked/chunked storage (this.blocks) using div/mod by a BLOCK constant, returning undefined via optional chaining if the block or slot isn't populated.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Storage is block-chunked (this.blocks[i/BLOCK][i%BLOCK]) rather than a flat array — worth knowing before assuming a simple index lookup.

### `ensure` #2
- spec 3 · read at `a7651302aa04` · commit `2cf6adc` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:42:44Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Loops, fetching successive blocks of delta data (via historyDeltas or similar) from the backend starting at the current watermark, until the loaded range covers the requested `index`. After each block is merged in, it calls onProgress with the new watermark/count so a caller can show progress during a long jump, and it likely short-circuits immediately if the data already covers `index`.
- found: Loops fetching BLOCK-sized delta pages from historyDeltas starting at the current watermark until have() covers index, sharing a single in-flight `pending` promise so concurrent callers await the same fetch rather than double-requesting; within each fetch it ensures the funcs table is loaded up to the new watermark BEFORE pushing the block (to avoid a window where a frame could be folded before its functions exist), calls onProgress after each block, and detects end-of-timeline via a short (< BLOCK) final page.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/zoom.ts

### the file itself
- spec 2 · read at `2c896828e2cd` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:10:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Zoom/pan transition logic for the sunburst chart — computing interpolated view geometry between zoom levels. Helpers for a node's arc geometry (geoOf), linear interpolation (lerp, lerpGeo, lerpView), easing (ease), ancestor-chain lookup (ancestors, under), enter/exit geometry for zoom transitions (enterFrom, exitTo, hubGeo), and viewBox computation (viewFor, viewBoxOf, extentOf, direction).
- found: Exactly zoom/pan transition geometry for the sunburst: matches wedges by id across zoom levels, interpolates arc geometry (a0/a1/r0/r1) and viewBox continuously rather than doing a CSS scale/fade, computes enter/exit geometry for wedges appearing/disappearing, easing, and a computed (not measured) extent so the viewBox doesn't jump mid-animation. Function-level docs are extremely rich (history of past bugs and rejected approaches) even though there's no file header.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No top-of-file doc, but individual functions have unusually detailed prose explaining prior bugs and rejected designs — 'documented: none' reflects the missing header per the task's own framing, not the actual doc quality in the file.

### `under`
- spec 2 · read at `c4d3ff9b9a40` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns true if `child` path is equal to `parent` or starts with `parent + '/'`; when `parent` is the empty string (root), it matches everything since every path starts with '/' after the empty prefix... more precisely it guards against plain prefix matching (e.g. "src" wrongly matching "src-tauri") by requiring the character after the parent prefix to be the '/' separator.
- found: If parent is the empty-string root, returns true for any non-empty child (root is an ancestor of everything but not of itself); otherwise returns whether child starts with parent + '/'. No equality case — a node is not considered "under" itself.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I assumed child===parent would count as 'under' and mispredicted the root case as unconditionally true; actual code excludes self and excludes empty child from matching root.

### `direction`
- spec 2 · read at `255565b9af99` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:27Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Compares two path strings to classify the zoom transition: if toPath is a descendant of fromPath (via the under helper) returns "in", if fromPath is a descendant of toPath returns "out", and if neither contains the other returns "across" rather than guessing.
- found: Returns 'across' if the paths are equal, 'in' if toPath is under fromPath, 'out' if fromPath is under toPath, else 'across' as the default when neither contains the other.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `geoOf`
- spec 3 · read at `759f88eaeaaf` · commit `6f88fc1` · read by claude-sonnet-5 · via claude · when 2026-08-14T04:57:02Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Iterates the wedges, skipping any whose node is a function (kind === 'func'), and for each remaining wedge computes its Geo (radial r0/r1 from rInner + band*depth, angular a0/a1 possibly padded by gapOf(kind)), inserting into a Map keyed by node id so callers can look up on-screen geometry without hitting the phantom function ring.
- found: Builds a Map from node id to Geo, skipping function-kind wedges. For each remaining wedge, r0 = rInner + (depth-1)*band and r1 = r0 + band - gapOf(kind), with a0/a1 taken directly from the wedge's own angles.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `lerp`
- spec 2 · read at `45b2910ff09a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:40Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns a + (b - a) * t, the standard linear interpolation between a and b by fraction t.
- found: Standard linear interpolation: a + (b - a) * t.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lerpGeo`
- spec 2 · read at `0f1f4fe27429` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:31Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Linearly interpolates a Geo (likely a rect-like shape with x/y/width/height fields) between a and b by fraction t, calling the lerp peer helper on each numeric field and returning a new Geo object.
- found: Lerps each of a0, a1, r0, r1 (angle/radius pairs — an arc/sunburst geometry, not a rect) between a and b by t using the lerp helper — mechanism matched, but I guessed x/y/width/height fields instead of the actual angle-radius shape.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `ancestors`
- spec 2 · read at `848a8fdedee0` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Given a path-like id string (e.g. "a/b/c.ts"), repeatedly strips the last "/"-separated segment to build the list of ancestor path strings, ordered nearest-parent first up to the root, by doing string manipulation (lastIndexOf('/') / slicing) in a loop rather than walking any tree structure.
- found: Loops stripping the last '/'-segment via lastIndexOf/slice, pushing each shorter path, nearest-first, then pushes '' for the root at the end.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `enterFrom`
- spec 2 · read at `f6d0a76bb77e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:55:47Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Walks up the ancestor chain of `id` (via ancestors) looking for the nearest one present in the `was` map (a previously-visible geometry), and if found returns that ancestor's old geo as the starting point for the enter animation. If no ancestor was visible before, it falls back to a degenerate point on the inner edge of the wedge's own target ring (same angle as target, r at target's inner radius) rather than the hub or nothing.
- found: Walks ancestors(id) to find the nearest previously-visible geo in `was`; if none exists, returns a zero-width degenerate wedge at the target's midpoint angle and inner radius.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `exitTo`
- spec 2 · read at `294d7ff11dca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:55Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the destination geometry for a wedge that is leaving the view during a zoom transition, based on `dir`. When drilling in, exiting wedges move outward past `rOuter` (off the rim) since they're the scenery not being drilled into. When drilling out, exiting wedges move inward toward the hub (using `rInner`) since they're the levels being left behind. When the direction is "across", the wedge's geometry is left as-is (`from`) since it just fades in place with no motion.
- found: For 'in', pushes the wedge's radii outward by 55% of the (rOuter-rInner) gap; for 'out', pulls radii inward toward rInner by 75% of the distance from r0 to rInner; for 'across', returns the geometry unchanged.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `ease`
- spec 2 · read at `44eb2f74d2fe` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:46Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A symmetric ease-in-out easing function mapping t in [0,1] to an eased value, likely implemented as a cosine curve (1 - cos(π*t)) / 2 or a cubic smoothstep-like formula, used to animate zoom/pan transitions so they accelerate then decelerate rather than starting at full speed.
- found: Clamps t to [0,1] and applies the standard cubic ease-in-out curve (4x³ for the first half, mirrored 1-(-2x+2)³/2 for the second half), giving a symmetric accelerate-then-decelerate easing for zoom animation.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Guessed cosine-based easing; actual is cubic easeInOutCubic — same symmetric shape/purpose, wrong specific formula.

### `hubGeo`
- spec 2 · read at `2db0dc30a449` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:31Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns a Geo object representing a small disc centered at the origin: startAngle 0, endAngle 2*Math.PI (full circle), innerRadius 0, and outerRadius set to rInner, matching the inset circle drawn at the middle of the chart.
- found: Returns a full-circle disc geometry (a0=0, a1=2π, r0=0) with outer radius rInner-4, a small inset I didn't predict.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `extentOf`
- spec 2 · read at `f827dd1fc8b1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: For each Geo (an annular sector with inner/outer radius and start/end angle), compute the four corner points (r0,r1 × a0,a1 mapped via x=r*sin(a), y=-r*cos(a)), plus extra points wherever the sector's angular span crosses a quarter-turn (0, 90, 180, 270 degrees) since those are where x or y hits its radius extreme. Track running min/max x and y across all geos (and presumably account for hubR as a minimum extent at the origin), returning the bounding box as {x0,x1,y0,y1}.
- found: Starts the bounding box at ±hubR on both axes (hub is always drawn at origin), then for each geo with positive radius and span, expands via the four corners plus quarter-turn crossings within [a0,a1] (only at outer radius r1, walked from the first multiple of π/2 ≥ a0), skipping degenerate geos (r1<=0 or a1<=a0).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `viewFor`
- spec 2 · read at `a985a34e5091` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:41Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes a square View around the extent e: finds the larger of width (x1-x0) and height (y1-y0), uses that as the side length, adds margin padding on all sides and extra chromeBottom padding at the bottom for the legend/hidden-count chip overlay, then centers the resulting square box on the extent's center (adjusting for the asymmetric bottom padding), returning {x, y, width/scale} fields matching the View type.
- found: Computes half-extent 'reach' as max(width,height)/2, margins x0/x1/y0 by reach*margin, and y1 additionally by reach*chromeBottom for bottom chrome room, then returns a View as {cx, cy, side} — center point and square side length — rather than a corner+width box.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `lerpView`
- spec 2 · read at `9bdc7a6a3f90` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:40Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Linearly interpolates each numeric field of a View (likely x, y, width/scale, zoom level) between View a and b by fraction t, using the sibling lerp() helper per-field, and returns a new View object with the interpolated values.
- found: Interpolates a View's three fields (cx, cy, side — a center point and a square side length) between a and b by t, using the lerp() helper on each.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Guessed the general shape correctly (per-field lerp via the helper) but the actual View fields (cx/cy/side, i.e. a centered square viewport) were more specific than my generic x/y/width/scale guess.

### `viewBoxOf`
- spec 2 · read at `73db378301fe` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:32:44Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A one-line arrow function converting a View (zoom/pan state with center and scale/radius) into an SVG viewBox string "x y width height" for setting the SVG element's viewBox during zoom/pan transitions.
- found: Builds an SVG viewBox string centered on v.cx/v.cy with a square side length v.side, i.e. "x y w h" where x/y are offset by half the side.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
