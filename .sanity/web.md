# web — sanity assessment

391 of 391 read · 76 surprising

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

### `App` — QUIRKY — TANGLED
- spec 3 · read at `4754680ee7dc` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: App is the root React component for this "sanity reader" web UI. It likely holds top-level state (selected run/project, list of readings, loading/error state), fetches data on mount via hooks like useProgress, and wires together the presentational pieces from its peers (ProgressTrack, ProgressStrip, ProgressPane, HistoryToggle, Empty) into a layout, using helpers like findById/parentOf/sameRun/sameIds/sameProjects to filter and relate data, with readingSignature used to dedupe or key items.
- found: App is the root component of a Tauri desktop app that renders a repo as a sunburst visualization (dirs/files/functions as nested rings) colored by lens (readings, language, age, git-blame), with drill-in navigation, a git-history replay mode, live polling for scan/reading/agent-activity updates (no websockets), heavy batching/ref-based state to avoid re-render churn and stale closures, and a side panel that swaps between commit log and function detail. It manages dozens of state/ref hooks and several staggered polling/batching effects (projects every 1.5s, agent activity/reports every 2s, score/shape/progress event batching at 400/300/250ms, function-ring fetch batching at 120ms).
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: The function is huge (2084 lines) with unusually rich prose comments narrating past bugs and rejected designs; reading it directly (not via a summarizing subagent) would be the more faithful way to grade legibility.

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

## web/src/components/CodeBlock.tsx

### the file itself
- spec 3 · read at `3bf04c052b6c` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:50Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A small, self-contained UI module with no header doc: a dedent string utility, a Lines component that renders numbered, optionally syntax-highlighted code lines, and the exported CodeBlock component that composes them into an inline code box with an expand-to-modal affordance. Its responsibility is purely presentational — displaying source snippets consistently across the app.
- found: A self-contained code-display module: dedent() strips shared leading whitespace so snippets start at the panel's own margin, Lines() renders numbered/tokenized (or plain-wrapped for prose) rows in a table for gutter alignment, and CodeBlock composes them into an inline bounded box plus an expand-to-full-modal view, with a design-rationale doc comment explaining why only two sizes exist and why highlighting uses the app's own approximate tokenizer.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `dedent`
- spec 3 · read at `d3e7ad5ad7e6` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:16Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Splits the code into lines, then computes the shortest common leading-whitespace prefix across all non-blank lines (skipping blank lines when measuring, since they'd otherwise force a zero-length prefix), comparing character-by-character rather than counting indent levels so mixed tabs/spaces aren't misjudged. It then strips that literal prefix from the start of every line and rejoins them with newlines.
- found: Splits on newlines, tracks a running common leading-whitespace prefix by narrowing it character-by-character against each non-blank line's leading whitespace, then strips that literal prefix from every line and rejoins.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `CodeBlock` — QUIRKY
- spec 3 · read at `a037586db893` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:55:42Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a titled/subtitled panel showing `raw` code (after dedenting it via the `dedent` helper), split into lines via `Lines` and displayed with a gutter numbered from `startLine` if provided. Applies syntax highlighting unless `highlight` is false (for prose/doc comments), shows an optional `caveat` message above the code, adjusts container styling (rounded corners/border) based on `flush`, and constrains/scrolls the block to `height`.
- found: Renders a compact code box (dedented, optionally syntax-highlighted, with optional caveat and line numbers from startLine) with a hover-revealed expand button that opens the same content full-size in a modal overlay with a title/subtitle header, a copy button, and an escape-to-close handler.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: The JSDoc on props explains design rationale well, but nothing hints at the expand-to-modal/copy/escape behavior that makes up roughly half the function body.

### `Lines` — QUIRKY
- spec 3 · read at `77c8747ecfb7` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:35Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Splits `code` into lines (after dedenting via the `dedent` helper), and renders a table with one row per line: a gutter cell showing startLine+index as the real file line number, and a cell with the line's text. The `highlight` flag toggles some visual styling (e.g. background/border) applied to the whole block or specific lines.
- found: Splits code into lines and renders a table; each row has an optional gutter cell (startLine+i, shown only if startLine is defined) and a content cell. When highlight is true, the line is tokenized and rendered as syntax-highlighted spans with no wrapping (real code, scrolls sideways); when false, it's rendered as wrapped plain text (prose/doc comments), with a literal space substituted for empty lines to preserve row height.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: `highlight` isn't a style toggle — it switches between syntax-tokenized code (whitespace-pre, no wrap) and wrapped prose rendering for doc comments, with blank lines forced to a space so the row doesn't collapse.

## web/src/components/CodeView.tsx

### the file itself
- spec 3 · read at `3cf262a226d6` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:08Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This file implements the source-code viewer panel — a CodeView React component that renders a file's source text alongside a Minimap for navigation, with ownerByLine/rampAt/rampStops computing a color ramp per line (likely author/heat/ownership) so the code pane visually echoes the sunburst's coloring when you drill into a function or file.
- found: Renders a single file's source as a line table with per-line heat wash/gutter color keyed by the owning function, clickable rows to select a function, a canvas Minimap showing the whole file's heat/indentation profile for click-to-seek navigation, plus scroll-to-reveal-function logic and optional pop-out/close controls.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

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

### `Legend` — QUIRKY
- spec 3 · read at `0e6fa3b4a769` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:56Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A React component that switches on `mode`: for categorical modes (blame/lang) it renders a list of swatches, one per entry in `categories`, each with its slot color and label; for history=true it renders a small birth/touch/ground legend; otherwise it renders a gradient ramp (the ColorLegend gradient bar) with labels for the low/high ends appropriate to that mode (e.g. "cold"/"hot", "old"/"new").
- found: Branches on history (birth/touch swatches), categorical (per-category swatches capped at SLOTS plus an "Other" bucket), then several modes each with their own hard-coded discrete swatch legend (traps single swatch, callers/reach/clones each their own labeled band list), and finally a shared gradient-ramp fallback (surprise/legible/docs/churn/age) with mode-specific low/high end labels and the matching ramp/hue.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Several modes (traps, callers, reach, clones) each get their own bespoke discrete legend shape rather than sharing the categorical or ramp path — not guessable from the signature/docs alone.

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

## web/src/components/CommitCard.tsx

### the file itself — QUIRKY
- spec 3 · read at `6e9c342f2510` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A file with a single exported component, CommitCard, that renders one git commit in the history/replay commit-log list: abbreviated sha, author, relative/absolute date, commit message (possibly truncated), and maybe a stat like files-changed or insertions/deletions. It's likely clickable to jump to that point in the history replay, with hover/selected styling, and receives a commit object as props plus maybe an onClick/onSelect callback.
- found: CommitCard is actually a modal overlay (not a list row) that opens on demand for a given sha, lazily fetching full commit detail via commitDetail() only when opened, then showing the subject/author/body message and a per-file added/removed stat list (no diff/patch), with escape-to-close and copy-full-sha affordances.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: The file-level docs field was empty even though the file itself has a rich JSDoc-style header explaining the design rationale (why no diff, why fetch-on-open, why rows became openable) — that header just wasn't surfaced in the handout's docs field.

### `CommitCard`
- spec 3 · read at `17ea012165c3` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:55:56Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A modal/popover component that, on mount (or when sha/repoKey changes), fetches the commit's detail (full message, author, date, list of changed files) via an effect and shows a loading state until it arrives. Renders the message and file list only (no diff), with a close affordance that calls onClose, and guards against stale fetches if sha changes before the request resolves.
- found: A modal (via Overlay) that lazily fetches commit detail on mount/sha-change with a `live` guard against stale responses, shows loading/error/loaded states, and renders sha, date, copy-full-sha button, author, message body (as preformatted text), and a file list with per-file +/- stats (or a note when git show reports no files for a merge). Escape key closes it, same as backdrop click via Overlay.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Predicted the fetch/guard/close mechanics correctly but missed the specific UI details (copy button, escape handler, merge-with-no-files message, per-file stat formatting).

## web/src/components/CommitLog.tsx

### the file itself — QUIRKY
- spec 3 · read at `206a8e4fb093` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:05Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file implements the commit-log pane: the exported `CommitLog` component (a virtualized, paged, playhead-following list of commits with a dimming scrim over what's still to come, opening a CommitCard on click) plus a small `stamp` helper that formats a commit's timestamp into the short string shown in each row. It has no file-level header comment — the rationale lives on the CommitLog docstring itself rather than at the top of the file, since the file is really "one component and its formatting helper," not a broader module.
- found: The file has no header comment — it opens straight into imports and tuned constants (ROW_H, OVERSCAN, PAGE, FOLLOW_MS, INFLIGHT). It defines three things: the memoized `Row` component (selection shown as a background on the row itself, which is what earlier resolved to being the "cursor" the CommitLog docstring mentions — not a separate overlay element), the `stamp` timestamp formatter, and the exported `CommitLog` component itself.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: My earlier CommitLog reading correctly flagged that the docstring's "cursor" overlay wasn't in that function's body — it's here: Row applies `selected` as its own background, confirming the design note under Row rather than a missing feature.

### `stamp`
- spec 2 · read at `007bc6229dfa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a Unix timestamp ts and formats it into a short human-readable string (e.g. via new Date(ts) and toLocaleTimeString/toLocaleString) for display next to a commit log entry.
- found: Converts a Unix seconds timestamp to a short locale date string like "Aug 13" (month + day, no time).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `CommitLog` — QUIRKY — TANGLED
- spec 3 · read at `63889155572f` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:55:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a paged, oldest-at-top scrollable commit log fetched from repoPath, filtered/narrowed by `scope`/`frames`. Rows are rendered once via memoization (keyed off stable data, not `index`), and instead of restyling each row per frame, two absolutely-positioned overlays move: a cursor marking the current commit (`index`) and a scrim covering rows not yet reached. While `playing`, an effect auto-scrolls the pane to keep the cursor in view; clicking a row calls `onIndex` to seek.
- found: Renders a virtualized, paged commit log (only visible rows + overscan are fetched/rendered, in PAGE-sized chunks with a bounded number in flight and pages far from the viewport evicted), oldest-at-top. A layout effect follows the playhead — centering while playing (throttled via FOLLOW_MS/performance.now), minimally scrolling into view when paused/scrubbed, and doing nothing when the move originated from a click in the log itself (tracked via fromClick ref). The only element actually absolutely-positioned/transformed for performance is the "still to come" scrim over the static row list; row selection highlighting is handled per-row via a memoized `selected` prop rather than a separate cursor overlay in this function.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Docs promised "a cursor on the current commit, and a scrim" as the two moving overlays, but this function only implements the scrim as an absolutely-positioned element — the cursor, if it exists, must live inside the Row peer.

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
- spec 3 · read at `ee2a14cc9938` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:03Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This file implements the detail sidebar shown when a node is selected — a Detail component displaying the selected function/file's score breakdown (measure), how confidently/by what means it was scored (provenance: model vs agent vs proxy), its rank relative to siblings or the whole repo, and a Contents list of children for directories/aggregates so you can drill further in.
- found: The detail sidebar: for a selected function it shows Dials, FunctionRanks (distribution position), a breadcrumb path back into the map, an LensPane (11 lenses: blame/clones/churn/etc), and a Contents list of children sorted by the active color mode's rank/measure with provenance footer; for a directory/file/no-selection it delegates to Summary (with file-specific LensPane "about" block). rank/measure are per-ColorMode sort key and display value; provenance explains who/what produced the score.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `rank`
- spec 3 · read at `f4d8e8cd0ef9` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:18Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Switches on ColorMode like rowNote's sibling, returning the numeric quantity used to sort/rank nodes in a list for that mode: e.g. temperature/surprise for the default grade mode, lastTouchedDays for 'age', commits for 'churn', callers count for 'callers', calls count for 'reach', cloneSize for 'clones' — mirroring whatever field the ring color for that mode is drawn from, with some fallback (like -Infinity or 0) for nodes missing a score.
- found: Switches on ColorMode to return a sort key per node: churn uses s.churn (or -1 if no age history), age uses negated lastTouchedDays so recent sorts first, callers uses 1/(1+callers) so unreferenced (0 callers) ranks highest, reach uses raw calls count, clones uses cloneSize (biggest group first), and the default falls back to wedgeHeat(n).
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The inverse formula for callers (1/(1+n)) is a subtle way to put 0-callers first while still ordering the rest ascending by callers — not obvious without reading the actual expression.

### `measure` — QUIRKY
- spec 3 · read at `33c0c5203f17` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Switches on `mode` (a small enum of display/color modes) and picks the corresponding numeric field off node `n`, formatting it into a short string with its unit suffix baked in (e.g. "42%", "1.2kb") so it fits an 8-character column. Returns null when the node has no value for that mode.
- found: A per-mode switch returning a short formatted string: blame has no number (null); churn shows commit count with × or em-dash if unscored; callers/reach show counts with × or → prefix; clones show clone-group size; age shows "today" or "Nd ago"; surprise shows a categorical heat word if available else a rounded degree number; default falls back to line count. Em-dash is the consistent placeholder for missing data.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The inline comments carry real design rationale (why blame/surprise are special-cased) that isn't recoverable from the code shape alone.

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

### `Detail` — TANGLED
- spec 3 · read at `2b6a85116074` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:21:41Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders the sidebar detail panel: when a node is selected, shows its name/path breadcrumb (via owners), size/rank/measure info, provenance (git/model), and lens sections (Contents, blame, neighbours) with drill/select/jump callbacks wired to buttons; when node is null, falls back to describing the focus subtree (title, repo, commit count) as a placeholder. It likely composes several sub-panels (rank, measure, provenance, Contents) conditionally based on node.kind and whether repoKey/replaying gate live-fetching sections.
- found: Renders the sidebar detail panel with three branches: no node falls back to Summary(focus) or a Bloom placeholder; a non-leaf (dir/file) node reuses Summary scoped to it with a breadcrumb path and provenance footer; a leaf function renders its own header (name, trap badge, breadcrumb path), Dials, FunctionRanks, then LensPane (git/blame/etc lens content) and Contents, with a pinned provenance footer.
- predicted: most · documented: none · derivable: no · legible: some · trap: no
- note: Prediction got the overall composition right (breadcrumb, lens sections, provenance, conditional on node) but missed that directories reuse the same Summary component as the whole-repo view rather than having distinct panel code, and missed the trap badge and Dials/FunctionRanks specifics.

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

### the file itself
- spec 3 · read at `60a20e49a89a` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:21:24Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A dialog component for exporting the history-replay as a video/movie (referenced in App.tsx as "an exported movie"). The helper functions (frameOf, pace, ms, lasting, suggest) compute frame indices and timing/pacing for the recording — e.g. converting a commit index to a frame number, computing how long the whole export will take, and suggesting a sensible duration or frame rate based on the repo's commit count. ExportDialog itself likely renders duration/quality controls, a start/cancel button, and a progress indicator while it drives the timeline's `ensure` API to fetch each frame and hand it off to a recorder.
- found: A dialog to export the history replay as an MP4 movie of the map itself (not a screen capture): controls for length, resolution, and light/dark ground, a progress readout during recording that names the current pipeline stage (fetch/fold/raster/draw/encode) with per-stage timing and an ETA, a codec-mismatch note when H.264 isn't available at the chosen size, and a save step via saveMovie. Helpers: frameOf computes the pixel width/height for a chosen resolution height (not frame indices, as I'd guessed), pace/ms/lasting format durations at different scales, suggest derives a safe filename from the repo name.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: frameOf is about frame DIMENSIONS (pixel width/height for a resolution), not about mapping a commit index to a frame number as the name plausibly suggests next to a replay/export file.

### `frameOf`
- spec 3 · read at `57a2a9bcea07` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:22:20Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Computes the export frame's width from a given height using the 16:9 ASPECT ratio (from movie.ts), then rounds the width to the nearest even number since video encoders require even dimensions for chroma subsampling, returning { width, height }.
- found: Exactly as predicted: width = height * 16/9, rounded to nearest even number, height passed through unchanged.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

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

### `ExportDialog`
- spec 3 · read at `b5ac245a0908` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:28Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A modal dialog with form controls for export settings (resolution/quality preset, duration, filename via `suggest`), a Start/Cancel button, and a progress bar during recording. On start it loops over `frames`, calling `ensure(index)` then `onIndex(index)` to advance the timeline before capturing each frame (via movie.record/preflight), calls `onStage` to dress the map for capture and clears it (null) when done or cancelled, and calls `onClose` to dismiss, restoring the original index/stage.
- found: Modal with length/resolution/ground choices, a Start/Stop/Cancel button and progress UI; `go()` stages the map (onStage), waits two rAFs to let it settle, calls `record()` (passing ensure/dateOf/onProgress/onCodec/cancelled-via-ref), then saveMovie(), and in `finally` always restores stage=null and the original index. Progress UI shows per-stage cost breakdown (fetch/fold/raster/draw/encode) and reports the chosen codec only when it's not the default H.264.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The stop flag is a ref (not state) specifically because record() reads it per-frame and a closure over state would be stale.

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

### `FileZoom` — QUIRKY — TANGLED
- spec 3 · read at `124dfaf524c0` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:10Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders an animated zoomable treemap of files rooted at `root`, interpolating between a `from` state and current `t` (0..1 transition progress) to animate zoom/pan transitions. It computes a treemap layout (using ranks for ordering/coloring, ageSpan for age-based coloring, minPatchArea to filter out tiny rectangles, unitsPerPx/paneAspect for scaling to pixels) and renders div/rect elements for each file/folder, wiring up onSelect/onDrill/onHover handlers for click and hover interaction, highlighting the `selected` and `mode`-dependent styling.
- found: Renders an animated radial/polar treemap ("fan" of wedges/arcs, not rectangles) of a file's children, tiling them via tileFunctions against a squarified layout, interpolating between a source and destination sector shape over transition progress t. Draws each cell as an SVG path with fill/color from colorFor (mode/ranks/ageSpan-based), handles click/dblclick/hover for select/drill/hover, overlays a stale-hatch pattern for stale agent readings, a dotted rollup texture for aggregated 'rest' nodes above a pixel-size threshold, and pulsing trap/clone markers, then draws fitted labels once the transition has settled.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

## web/src/components/HistoryBar.tsx

### the file itself
- spec 3 · read at `f38c9ab25c86` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:21:24Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: This file defines the HistoryBar component — the playback transport UI for the history replay feature (play/pause, scrub position, maybe speed control), analogous to the timeline/Playhead concepts seen in the movie-export code. `pace` is likely a helper computing playback speed or frame-advance timing given the commit count/duration. No file header doc is itself notable — probably because the component is self-explanatory or under-documented compared to the rest of the design-heavy codebase.
- found: Confirmed as the replay transport: play/pause toggle, a scrub range input, and `pace` formats a DURATIONS preset (180/60/30/10/3s) into 'Xm'/'Xs' labels for duration-picker buttons — matching my guess about pace exactly. Missed: an export-to-movie button opening ExportDialog, full keyboard control (space to play, arrow keys to step with shift-stride), and a requestAnimationFrame-driven clock that paces playback by real elapsed time (not per-tick commit stepping) to keep the promised duration honest even on large repos.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level header doc, but the component and most internals are heavily commented individually — the absence is only at the file-header level, not a general lack of documentation.

### `pace` — QUIRKY
- spec 2 · read at `f97e230c1fec` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:51:49Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a total count, returns a human-readable pace label by bucketing the number into ranges (e.g. "slow", "steady", "fast") for display in the HistoryBar UI. Likely a simple if/else or ternary chain comparing total against threshold constants.
- found: Formats a duration in seconds as a short string: minutes rounded with 'm' suffix if >= 60 seconds, otherwise raw seconds with 's' suffix. Not actually a "pace" label like slow/fast — it's a duration formatter, likely misnamed relative to what I expected.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `HistoryBar` — QUIRKY
- spec 3 · read at `f11ae4ebe017` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:19:22Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders the bottom transport strip: a play/pause button and a full-width scrub bar/slider bound to `index` within `frames`, calling onIndex as the user drags. When `playing` is true it advances through frames on an interval/animation loop paced by `duration` (likely using the `pace` helper), calling onPlaying(false) at the end. It also has an export trigger that calls `ensure` to fetch data up to the current index and then `onStage` with a Staged descriptor built from name/slug/scope/dateOf for an export movie/dialog.
- found: Play/pause button, scrub range input, and duration-preset buttons (pace-labeled), driven by a rAF-based clock (not setInterval) that tracks a fractional cursor position separately from the emitted integer index to stay accurate across slow/fast rates. Also wires full keyboard transport (space to play/pause, arrows to step, shift for a 10-commit stride) with careful guards against double-handling when a range input or export dialog has focus, and delegates the actual export UI/logic to a separate ExportDialog component rather than doing ensure/onStage itself.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment describes an older design (a second caption row) that was removed; the actual component's complexity (rAF clock, keyboard handling, ref-based cursor tracking) isn't mentioned in the docs at all.

## web/src/components/LensPane.tsx

### the file itself
- spec 3 · read at `2a688bc218da` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:32Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: The "lens" detail/inspector panel component — shown in the UI when a user selects a function or file — composed of the main LensPane component plus many section subcomponents (DocsSection, TrapsSection, WiringSection, LanguageSection, HistorySection, AgeSection, ChurnSection, LegibleSection, SurpriseSection) each rendering one facet of that item's report data (docs coverage, traps, call wiring/references, language, git history/churn, age). Also includes reference/commit-list helpers (RefRow/RefList) and a born/last-touched date pair display (Ladder/Edge/Touch), plus small utility functions (spanOf, dirOf, when) and empty-state components (Block, Absent, StaleNote, NoteBox, Passage, ExpandIcon).
- found: The file's peer list confirms it's the lens/inspector detail panel: a main LensPane component plus per-facet section subcomponents (DocsSection, TrapsSection, WiringSection, LanguageSection, HistorySection, AgeSection, ChurnSection, LegibleSection, SurpriseSection), reference/commit helpers (RefRow/RefList), a born/last-touched pair (Ladder/Edge/Touch), small utilities (spanOf, dirOf, when), and small empty/placeholder components (Block, Absent, StaleNote, NoteBox, Passage, ExpandIcon).
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: The revealed source (74KB) exceeded tool output limits and could not be read in full via available tools (no working chunked-grep access), so this grading rests on the file header (empty) and the complete peer list rather than a full read.

### `LensPane` — QUIRKY
- spec 3 · read at `9afddfad7666` · commit `d92c31f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-20T23:29:41Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: LensPane is the top-level panel component that renders a fixed header (name, path, dials, ranks, provenance) and then switches on `mode` to render exactly one of the Section components (SurpriseSection, LegibleSection, DocsSection, TrapsSection, WiringSection, LanguageSection, HistorySection, AgeSection), passing along node/repoKey/replaying/siblings/ranks/onJump as needed. It likely also renders an Absent/StaleNote fallback when the selected lens has no data for this node.
- found: Switches on `mode` to render one of the Section components, but before that handles two special cases the docs/signature didn't hint at: a `replaying` guard that shows an explanatory Absent block instead of any measurement (since all lenses read the live working tree, not a historical frame), and a restriction that non-function (container) nodes only get a section for 'surprise'/'docs'/'traps'/'blame' since other lenses are already broken down per-member in the Summary view. It does not render the header (name/path/dials/ranks/footer) itself — that lives outside this component despite the docs describing it as part of "the pane".
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe a header section ("name, path, dials, ranks, provenance footer") as sitting above this component and always visible, but that header is not rendered by LensPane itself — it must live in a sibling/parent component, so the docs describe the whole pane assembly rather than this function alone.

### `Block`
- spec 3 · read at `da53ddbf9913` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:34Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders a heading row containing `label`, an optional `aside` value aligned to the right, and an optional `hint` shown as a small info icon/tooltip rather than inline text. Below the heading is a full-bleed horizontal rule (negative margin -mx-4, repadded) matching the pane's other rules, followed by `children` as the section's content.
- found: Renders a full-bleed bordered-top div containing a heading row (label with cursor-help + native title tooltip when hint is given, plus right-aligned tabular-nums aside) followed by children.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Absent`
- spec 3 · read at `53b9364cb6f9` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:25:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A tiny presentational component that wraps its children (an explanatory sentence) in a styled "empty state" container — likely muted/italic text with some padding — used whenever a LensPane has nothing to show, so the UI always displays a reason rather than a blank area.
- found: Renders children as a small muted paragraph — a minimal empty-state text style, simpler than I imagined (no padding/container, just a styled <p>).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Ladder`
- spec 3 · read at `739144bd5d76` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:44Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders the four grade rungs as a small vertical/horizontal list, each rung showing its `words[grade]` label and `rungs[grade]` description, colored by sampling `ramp` at `at[grade]`. The rung matching the current `grade` prop is visually highlighted/bolded as "you are here", the others dimmed; `dated` probably fades the whole thing or adds a "stale" indicator when the reading is old.
- found: Renders a fixed vertical list of the four grades (none/some/most/full), each with a small swatch, the grade word, and its rung description; the current `grade` is highlighted (foreground text, outlined swatch colored via heatColor(at[g], ramp)) while others are dimmed, and `dated` suppresses the highlighted swatch's color back to the muted/secondary color rather than the ramp color.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `StaleNote`
- spec 3 · read at `220727e6bc5b` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:43Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a short fixed warning message/paragraph (no props) saying the reading below is stale because the code has moved since it was read, styled as a small caveat line similar to Absent, always placed before the content it applies to.
- found: A fixed warning paragraph (no props) stating the code has changed since it was read, so what follows describes a body no longer present; kept as history and doesn't drive any coloring.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `RefRow` — TANGLED
- spec 3 · read at `22a7d13b5170` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:04Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders one clickable row (whole row is the hit target, calling onJump(r.path, r.line)) showing the function's name beside its owner (not folded together), its file path, and either a code snippet (when code is true and snippet is fetched) or the given note text instead — with distinct handling for snippet === undefined (loading) vs null (fetch failed/unavailable).
- found: Renders a clickable row (name+owner label, path:line, optional note), and when `code` is true shows a fetched snippet as a CodeBlock (with a "moved" or "truncated" caveat) or, for rows past the initial fetch batch, a "Show code" button that lazily fetches the snippet on demand; shows a "could not be read" message when the fetch returned null.
- predicted: most · documented: full · derivable: no · legible: some · trap: no

### `spanOf`
- spec 3 · read at `0759b4ec2e05` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:27Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Converts a FuncRef (with path, line, and loc) into a span object of the shape function_sources expects, computing the end line as line + loc - 1 (or similar) so callers can request the source range without carrying a redundant end-line field.
- found: Builds {path, start, end, name} from a FuncRef, with end computed as line + loc - 1.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `RefList`
- spec 3 · read at `a7d46dff1774` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:39Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a list of RefRow entries for `refs`, batch-fetching source code for all of them in a single functionSources call (via useEffect keyed on refs/repoKey) rather than each row fetching itself, and stores the results in state to hand down per-row. It passes through `code` (whether to show snippets at all), per-row `notes`, and an `onJump` callback for navigating to a reference's location, rendering an Absent state if refs is empty.
- found: Batch-fetches source for only the first SNIPPETS refs via a single functionSources call in a useEffect (keyed on a stable path:line join string, with a live-flag cleanup to avoid setting state after unmount/refetch), then renders a RefRow per ref passing the matching snippet/note/onJump, plus a trailing note when more refs exist than were fetched telling the viewer the rest need 'Show code'.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `dirOf`
- spec 3 · read at `434164960692` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Finds the last "/" in the path and returns the substring before it, or the empty string if there is no slash (root-level file).
- found: Exactly as predicted: lastIndexOf('/') and slice before it, empty string if no slash.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `SurpriseSection`
- spec 3 · read at `dd2356d66c55` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:08Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Reads node.agent's prediction/found fields and renders a Block that always shows both the expected and found text (even when they matched, to prove the section isn't just hiding non-surprises), with a staleness note if the answer predates the current code, and an Absent message if nobody has read/predicted this node yet. May use Ladder to visualize how far off the prediction was.
- found: Shows an Absent message if unread. Otherwise always renders Expected/Found passages plus a staleness note, a 'warm read' badge if the reading wasn't cold, either the reader's note or a 'read as expected' line when the prediction was full and there's no note, and — if present — a list of model-probability 'hotspots' showing exactly where the token distribution diverged from the actual code and what was expected instead.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: No Ladder used here; instead there's a per-token 'hotspots' evidence list (model probability collapse points with the alternative token it would have written) and a 'warm read' badge when the reader had already opened the file.

### `Passage`
- spec 3 · read at `ee39f7cfc7d1` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:54Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Renders a heading row containing `label` and a `CopyButton` (copying `text` to the clipboard as markdown), with `hint` shown as a title attribute or tooltip on the label, followed by a paragraph displaying `text` as the reader's prose for that section.
- found: Heading row with uppercase `label` and a CopyButton (copies `text`, tooltip is `hint`), followed by `text` rendered through a Markdown component.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `NoteBox` — QUIRKY
- spec 3 · read at `5f083ce5de33` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:23Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders the note text inside a small styled box/paragraph. The trapped flag adjusts styling — likely a border or left-accent bar — but per the docs the note text itself stays normal (non-pink) color since the loud pink coloring is reserved for the tab elsewhere, not duplicated here.
- found: Renders a bordered box with a small header row (warning icon, 'trap'/'note' label, CopyButton) whose background is pink (var(--trap)) when trapped and neutral otherwise, and a body below rendering the note text as Markdown.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I guessed the note body itself would stay uncolored when trapped, but it's actually the small header bar (not the tab) that gets the pink --trap background here — the doc's 'color goes on the tab and nowhere else' describes intent elsewhere, not a constraint this component itself honors.

### `LegibleSection`
- spec 3 · read at `d60b9322c576` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:25:10Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders the legibility lens: if there's no report, shows an `Absent` placeholder; otherwise renders a `Ladder` with grade=report.legible, using words/rungs strings specific to the legibility scale (full/most/some/none reading passes) and a ramp/`at` mapping for coloring, followed by the reader's `found` prose (what the reading was actually like) via `Passage` or similar, plus a `StaleNote` if `stale` is true.
- found: Gates on node.kind !== 'func' (files aren't graded for legibility at all, with an explanatory Absent), then on missing report; otherwise renders a Block with a Ladder(grade=report.legible) plus explanatory notes for `dated` (question rewritten since grading) and missing-legible-grade (banked before the axis existed), then a Passage showing report.found.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: The docs shown were actually for the file/reveal grading scheme itself (why `expected` isn't shown, why there's no separate legibility note), not a description of this component — so documented is 'none' for this function specifically even though there was a docs block.

### `DocsSection`
- spec 3 · read at `e29f31944e9b` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:30Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders the doc comment text alongside the function's signature and its "documented" grade, showing an Absent placeholder when there's no doc, a StaleNote when stale is true, and pulling in the AgentReport's notes if present — following the same pattern as the other Section components (Churn/Age/History/etc.) in this file.
- found: Renders a Block with the doc grade (Ladder, or "ungraded" text if no report) as aside, a StaleNote when stale, a special warning callout when the reader judged the doc "derivable" (i.e. it counts as none regardless of grade), then the signature and the doc text verbatim in a CodeBlock (unhighlighted, since it's prose not code) or an Absent placeholder if there's no doc.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `TrapsSection` — QUIRKY
- spec 3 · read at `9024c995dfbe` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:53Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders nothing if the node has no trap. Otherwise shows the trap warning text prominently/large at the top, then filters `siblings` to other functions in the same file that also have a trap flag, and lists them below as clickable rows (via onJump with path/line from spanOf) so the reader can jump to related hazards in the same file.
- found: For non-func nodes with no trap, renders nothing; otherwise always renders a Block distinguishing several states: staleness note, a NoteBox if a trap is reported, or one of three distinct absence messages (never read, answered-but-since-dated, or explicitly reported clean). Below that, if same-file siblings (excluding self, stale/untrapped filtered out) have their own reported traps, lists them via RefList with jump links and notes, deliberately showing only the note/link rather than the function body.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The interesting logic isn't the trap display itself but the absence-state taxonomy: unread vs dated-answer vs explicitly-checked-clean are rendered as three distinct messages, since for a function 'nobody looked' and 'looked and it's fine' are different states, not both silence.

### `WiringSection`
- spec 3 · read at `99621e1060f3` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:24:39Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Fetches (on mount/selection change, via functionLinks) the neighbour lists for the selected function's line — callers, calls, or clones depending on `mode` — and renders them as a list of RefRow entries with jump-to-source callbacks (onJump). Shows an Absent/loading state while the fetch is pending or when the language's wiring hasn't been resolved (wired===false), and otherwise renders each neighbour grouped/sorted, probably with the directory shown via dirOf for entries outside the node's own directory.
- found: Fetches functionLinks on selection with a cancellation guard, handling loading/missing states; for 'clones' mode shows two Block sections (this function vs its clones, or an absence explaining the comparability floor); for callers/reach shows a wired/unwired distinction, an away-from-home-directory count sentence, and the RefList.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Predicted the fetch/cancel/loading/RefList shape correctly but missed the clone-specific two-section layout and the away-directory-count sentence, which are the most bespoke parts of the body.

### `LanguageSection`
- spec 3 · read at `638155ff6be7` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:23:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A React component in the detail panel that shows the node's language and, more importantly, what the tool can actually see for that language: whether call resolution was attempted (so a viewer can tell "gray means nobody looked" apart from "gray means nothing calls this") and whether the function's body was long/eligible enough to be compared for clones. It likely renders conditionally based on node.lang/resolvable/comparable fields, with small notes explaining each capability rather than just a language label.
- found: Renders a language-name header plus the node's signature snippet, then computes three booleans (wired/comparable/historied) and lists ONLY the gaps as plain-language notes ('nobody looked' for unresolved calls, too-short for clone comparison, no git history for blame/churn/age) — showing an all-clear message when there are no gaps, or an Absent state when node.lang itself is null.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `HistorySection` — QUIRKY
- spec 3 · read at `ec0c658c9d0e` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:56:16Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Fetches the shared per-line (commit, author, time) blame data for `node` once (keyed by node/repoKey), then branches on `mode`: for 'blame' it renders the data directly as a list of people/refs (likely via RefList/RefRow), for 'churn' it derives commit dates and hands off to ChurnSection to render a calendar-shaped view, and for 'age' it hands off to AgeSection to render a timeline of span. It probably also handles loading and empty states before the fetch resolves.
- found: Fetches functionHistory (blame detail, whole-file if no line range) unconditionally via effect, but for 'churn' mode bails out early and delegates entirely to a separately-fetching ChurnSection. For 'age' it hands the fetched detail to AgeSection. For 'blame' it renders the newest touch inline plus, only for function nodes (not files), a per-author lines breakdown and a touches list — files show just the last commit, since the authors breakdown is already shown elsewhere for files.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I guessed blame rendering used the RefList/RefRow peers; it actually uses bespoke divs with author bar charts colored via slotColor(ranks).

### `AgeSection` — QUIRKY
- spec 3 · read at `a0a19390f3cd` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:56:36Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a vertical timeline of `detail.touches`, positioned proportionally by commit time (not evenly spaced) so clusters and gaps are visible, newest at the top. Below/alongside it shows two distinct dates: the oldest surviving blamed line (a lower bound) and the file's actual first commit from the churn scan (the honest upper bound on age), explicitly labeled as different things rather than collapsed into one "age" figure. Likely uses `Touch` to render each commit and `spanOf`/`when` helpers for formatting durations.
- found: Pins the newest and oldest touch as fixed `Edge` rows and puts everything between them in a middle list that scrolls under its own count, capped to a height measured via useLayoutEffect against the element's actual position and the window bottom (not a guessed constant, to avoid a scrollbar over empty space). No proportional time-positioning of commits and no second "file's first commit" upper-bound date is shown here — just the blame-derived touches.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The docs' "positioned by TIME, not evenly spaced" and "both ends shown, oldest surviving line vs file's actual first commit" describe a design this function doesn't implement — it's a simple pinned-ends/scrolling-middle list of blame touches only; that richer picture may live elsewhere or may be aspirational.

### `Edge`
- spec 3 · read at `483dcf98d1c9` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:56:48Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering one endpoint of a two-point lifespan/history pair (the other end presumably rendered by a sibling like Ladder). It displays the given label alongside the date/commit info from t: TouchRow, styling it more prominently when bright is true, and likely uses repoKey to link out to the commit.
- found: Renders a small uppercase label above a Touch component, passing t/bright/repoKey straight through — it's purely a labeled wrapper, all the actual date/commit rendering logic lives in Touch.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `ExpandIcon`
- spec 3 · read at `9f566aa62008` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:29Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A small button/span rendering an SVG "expand" glyph (likely a diagonal arrows or chevron icon) matching the icon used on code tiles, with a title attribute for tooltip/accessibility and an onClick handler wired to the passed onClick prop. It's a purely presentational corner control, no internal state.
- found: A button rendering a small 10x10 SVG diagonal-arrows expand glyph, styled as a bordered/backgrounded chip (not a bare glyph) so it reads as a control among small grey text, with title/aria-label for accessibility and an onClick that stops propagation before calling the passed handler.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The doc comment's design rationale is essentially restated verbatim as an inline code comment, so it adds little beyond what the code already says.

### `Touch`
- spec 3 · read at `1866093f9b59` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:55:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a single commit "touch" as a row: probably shows a short commit hash/link, commit message/summary, and maybe author/date, with `bright` toggling a highlighted style (e.g. for the most recent or currently selected commit) and `repoKey` used to build a link out to the actual commit (e.g. a GitHub URL). Likely a simple flex row with truncated text and hover/click behavior to expand or navigate.
- found: Renders a commit-touch row: a colored dot (bright uses a heat-ramp color, dim otherwise), a date, short commit hash, a line-count with unit label, an expand icon (only if repoKey is set and commit looks like a real hash, i.e. not 'uncommitted'), and a truncated summary line with author in the tooltip. Clicking the expand icon opens a CommitCard modal for that commit.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The "openable" guard doubles as the uncommitted-changes check via regex on t.commit, which isn't obvious from the signature.

### `ChurnSection`
- spec 3 · read at `d46ac04126bc` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:01Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering the churn "calendar" as a vertical strip of weekly commit ticks for the file (or function, following its line range through history), with the 90-day window visually marked and a heading indicating whether it's showing file-level or function-level churn. It derives commit timestamps for node/repoKey and buckets them into a vertical timeline of marks rather than a single count, to visually distinguish steady weekly work from a burst-then-abandon pattern.
- found: Fetches file commit timestamps via fileCommits, buckets them into local-midnight days, and renders a GitHub-style weekly commit heatmap grid (weekday columns, week rows newest-at-top, month labels, per-day heat color, per-week commit counts), always at file granularity since function-level would require following the line range through every diff.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Docs explicitly say function-level churn would need to follow the line range through history and call that a different order of cost, which is exactly why this only ever operates at file granularity despite the component receiving a specific node.

### `when`
- spec 3 · read at `09bfaf43a6ee` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:04Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Converts a unix timestamp in seconds to a relative string like "3 months ago" if within the last year, computing the difference from now in days/months and picking the coarsest sensible unit; falls back to a locale-formatted date string (e.g. toLocaleDateString) once the gap exceeds a year.
- found: Guards zero/falsy timestamp as 'unknown', then buckets by days elapsed: today, yesterday, "N days ago" up to 60 days, "N months ago" up to 365 days, then falls back to a locale date string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 3 · read at `1155b518fee3` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:33Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This component loads (or mints, via `loadOrMint`) a persistent per-project "blueprint" describing the creature's look, computes a mood from `state`/`events` via `moodFor`, and renders an SVG creature whose eyes track the `gaze` targets (or wander when null) while animating differently for sleeping/working/torn-down states; `pick` is probably used to select randomized visual traits from the blueprint. Re-minting happens when `remint` changes.
- found: Loads/mints a per-project blueprint and remounts on remint as predicted, but the bulk of the function is several useEffects: computing vertical 'lift' offset from the bundle's reported rest extent, aiming gaze at one of several targets on a dwell cycle, waking the creature on any window mouse activity, playing a 'confused' animation loop while state is 'stopping', and replaying queued AgentCall events (via moodFor) in sequence while 'working', plus registering a mascotClock hook for movie export.
- predicted: some · documented: none · derivable: no · legible: some · trap: yes
- note: Addressing the renderer via `renderer.shared.engine` (three levels down) instead of `renderer` directly is silently wrong — the typeof guards make a wrong address just as harmless-looking as a missing method, so gaze tracking or clock-lending can quietly no-op with nothing on screen indicating why.

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

## web/src/components/Prose.tsx

### the file itself
- spec 3 · read at `a7057d1927a1` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:47Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A component file with no header doc. It exports a Markdown component that renders markdown-formatted text (e.g. docs/notes/report content) into styled HTML using prose typography classes, and a CopyButton component, likely placed near rendered code blocks or the whole passage, that copies the raw text to the clipboard.
- found: Markdown is a hand-rolled minimal renderer (no library) supporting only code spans, bold, italic, and paragraph breaks — split code-first so asterisks inside identifiers aren't misread as emphasis. CopyButton copies raw source text (markdown, not rendered) to the clipboard and only shows a "Copied" state when the clipboard write actually resolves successfully.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The per-function doc comments (missing from the docs field since this was scored as a file task) carry real design rationale — e.g. why no markdown library, why copy raw text not rendered — that a header summary wouldn't reproduce.

### `Markdown`
- spec 3 · read at `799387943ea1` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Splits the text into paragraphs on blank lines, and within each paragraph first splits out backtick code spans (rendering them as <code>), then processes the remaining segments for **bold** and *italic* markers, returning an array of React elements/paragraphs. Doing code spans first avoids misinterpreting a `*` inside a code identifier as emphasis markup.
- found: Splits on blank lines into paragraphs, then per paragraph splits code spans first (rendered as <code> with a currentColor-derived background), then within non-code chunks splits bold/italic markers into <strong>/<em>/<span>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Docs explained the code-first ordering rationale well; missed only the currentColor-mix styling detail, which is implementation detail rather than behavior.

### `CopyButton`
- spec 3 · read at `e3b423a23636` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:29:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a button; on click it calls navigator.clipboard.writeText(text) and only sets a "copied" state to true (triggering a checkmark icon / "Copied" label, likely reverted after a timeout via setTimeout) once that promise resolves successfully. If the write throws/rejects (no permission, insecure context), it leaves the copied state false rather than lying about success. `title` is used for a tooltip or aria-label on the button.
- found: Renders a small icon button (square/copy icon vs checkmark) that writes `text` to the clipboard on click, stopping propagation. It uses a `done` boolean state, set true only when the clipboard write promise resolves (false on rejection), and an effect auto-resets `done` to false 1.2s later. Title shows "Copied" while done, otherwise the passed `title`; aria-label always uses `title`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 3 · read at `956d94756191` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:28Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: ProjectItem renders the row as a div (not button, per the doc) carrying role/keyboard handling for accessibility and click/context-menu handlers, showing the project name and a right-side slot that switches between a static count, a live replay progress indicator with a Stop control, or Read/Failure action buttons depending on state. It also applies drag-related styling using the dragging prop and disables/greys the replay trigger when blocked is true, and given its size (495 lines) probably includes internal state for hover/menu/animation logic beyond just prop-driven rendering.
- found: A large row component with two tracked local states (cancelling, asked) plus derived state (running/stopping/winding/busy/reading/failed/settled) computed from project and run/replay props. Renders a name+status line, a conditional trace/replay sub-row with its own progress bar and Cancel/Trace buttons, a detail+action row with Read/Stop/failure-info buttons, plus a bottom-edge progress rule and a 'reading sweep' animation overlay — all wired through many small UX-rationale comments explaining why each piece exists.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

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
- spec 3 · read at `a11712d56854` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: rowNote switches on `mode`: for 'age' it formats a relative time string like "5d ago" from the node's last-modified/commit date; for 'churn' it formats something like "11 in 90d" from the node's commit count over a 90-day window. For all other (categorical) modes — author, language, grade, trap — it falls through to a default that returns the node's line count as a string (e.g. "42 lines"), since those bucket headings already state the category and the line count is the "other axis" mentioned in the docs.
- found: Switches on ColorMode to produce the row's trailing note string: 'age' formats lastTouchedDays as "today"/"Nd ago" or em dash if unknown; 'churn' prints "N in 90d" commits, guarded on ageDays (not commits) so it can distinguish "0 commits in window" from "no history"; 'callers' and 'reach' each print the complementary count (what it calls vs who calls it) to distinguish real leaves/orphans from ones with active traffic in the other direction; 'clones' prints which clone-group size it belongs to or "unique"; default falls back to compact line count.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Docs only discuss the age/churn banding rationale in depth; the callers/clones/reach branches have their own nontrivial complementary-count logic not mentioned in the docs at all.

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
- spec 3 · read at `460f7bf820ab` · commit `fdfb7c6` · read by claude-sonnet-5 · via claude · when 2026-08-21T03:19:59Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This is the main React component that renders the radial sunburst visualization of a repo's file tree. It likely uses a canvas (or SVG) to draw nested arcs/wedges sized by file size and colored per `mode` (heat/age/rank), handles pointer events to select/hover/drill into nodes and clear selection, draws a "hub" in the center showing the repo name/size plus an optional mascot creature reflecting agent activity state, and animates transitions (rescans, drilldowns) with an easing/morph tween keyed by `morph`. It also computes layout thresholds from `density`/pane size to decide which wedges are large enough to render labels for, and highlights nodes currently being "read" by pulsing their wedges via requestAnimationFrame.
- found: The main sunburst SVG view: computes a pixel-density-aware unit scale, runs layout() to produce wedges with collapse/sort/min-angle options, tracks hover/pointer state for an instant custom tooltip (WedgeTip), computes a selection-ancestor trail for outlining, computes which wedges are "reading"/pulsing (deepest drawn node per path, to avoid ancestor directories blazing continuously) and a gaze target (individual points if few, else a single averaged bearing) fed to an AgentMascot in the hub, and renders a footer noting hidden-too-thin vs folded-by-user counts with an "unfold all" action. Ends by returning the SVG plus hub mascot layer and tooltip/footer overlays.
- predicted: most · documented: full · derivable: no · legible: some · trap: no
- note: The function is far larger (1756 lines) than a typical "function" unit in this protocol — reading it required sampling rather than a literal single pass, so legible/predicted grades reflect a big, thoroughly-commented component rather than a small logic unit.

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
- spec 3 · read at `d819003ec94a` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:21:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a positioned tooltip card near the pointer (x,y), flipping to the other side of the pointer when close to the box edges so it doesn't clip. Shows the node's name/path, file count, and a color swatch reflecting the current color mode (e.g. age/size/rank) rather than a raw number, with special-case text for "not measured yet" (never-read) and "stale" (expired) readings, plus a folded indicator when folded is defined. Likely computes the swatch color from ageSpan and the node's own age/rank data via some shared color-scale helper.
- found: Builds a positioned tooltip card that flips near box edges, shows path/name (with special function-name-first layout), a swatch reflecting colorFor(mode) with distinct 'not measured yet' vs 'stale' states gated per-lens by paintsFromReadings, line/file counts, churn/age extras, and fold/drill hints.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Prediction got the overall shape right (positioning, swatch-not-number, stale vs unread distinction) but missed the extensive per-kind layout logic (function name-first vs dir/file dedup path), the height-estimate-for-flip-direction computation, and the extras table for churn/age stats.

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

### the file itself — QUIRKY
- spec 3 · read at `10e5074d620e` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:59:37Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This is the frontend's data-access layer: a set of typed wrapper functions that call out (likely via IPC/fetch to an Electron or Tauri backend) for everything the UI needs — managing the list of projects (list/select/reorder/forget/pick), running and tracking repo scans (scanRepo, projectScan, startCheck/stopCheck, progress/score callbacks), reading source/commits/history for files and functions (readSource, fileCommits, functionHistory, commitDetail, functionSources), agent report handling (agentReports, applyAgentReports, reportGrades), and some CLI/install/theme/window plumbing (installCli, cliStatus, openCodeWindow, syncThemeMenu). It also bundles small pure utilities for the heat-color visualization ramp (heatColor, rampAt, rampStop, temperature, wedgeHeat) that don't really belong to the API surface but live here as shared helpers.
- found: Could not actually verify: the environment's Bash and WebFetch permissions are both hard-denied in this session ("don't ask mode"), and the file is a single ~31,000-token JSON line that exceeds the Read tool's 25,000-token cap with no way to sub-slice it, so I was never able to see the file's real body — only the metadata (path, line count 562) and the peers list I already had. My prediction stands unverified rather than confirmed or refuted.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: Environment limitation, not a repo finding: this file's revealed source was too large for Read/Bash/WebFetch to retrieve in this sandboxed session, so this report reflects inability to verify rather than an actual read.

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
- spec 3 · read at `825c3a1795f3` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:06Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Converts a raw WireNode (as received from the Tauri/JSON backend) into the frontend's Node type used by the visualization, mapping over fields (id, name, kind, path, line, body hash, etc.) and recursively converting the children array by calling toNode on each child. It likely fills in defaults for optional fields and normalizes anything the backend serializes differently than the UI's internal shape expects.
- found: Maps a snake_case WireNode from the backend to the camelCase Node type, defaulting most optional fields to null (deliberately not 0, per an inline comment, so 'never analyzed' is distinguishable from 'zero callers'), unpacks a nested score object field-by-field, and recursively maps children via children.map(toNode).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

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

### `repoRemote`
- spec 3 · read at `21e0142657a1` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:18Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A thin frontend wrapper that calls into a backend command (likely Tauri's invoke) named "repo_remote" with the given path, awaits the result, and returns it as a string or null, possibly catching errors to return null.
- found: A thin wrapper calling Tauri's invoke('repo_remote', {path}) and catching any error to return null instead of throwing.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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

### `functionLinks` — QUIRKY
- spec 3 · read at `d53379c5dcfc` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:29:47Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: An async client-side API wrapper that calls a backend endpoint (e.g. GET /api/function-links or similar) passing key, path, and line as query params, parses the JSON response into a `Related` object, and returns null if the server responds with no data (e.g. 404) or an equivalent "not found" signal, rather than throwing.
- found: Thin wrapper delegating to a generic `invoke` helper (Tauri IPC, not HTTP) with command name 'function_links' and the three params, returning Related or null straight through.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: This is a Tauri desktop app — `invoke` is IPC to a Rust backend, not fetch/HTTP; the file name api.ts is misleading if you assume web REST calls.

### `functionSources`
- spec 3 · read at `06c9dd1bd95c` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:30Z · by ross@rossturk.com · warm reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper delegating to `invoke('function_sources', { key, spans })` (Tauri IPC to the Rust backend), returning the array of Snippet|null positionally matching the input spans, per the docs' description of batching reads into one call.
- found: Thin invoke() wrapper for the 'function_sources' Tauri command, passing key and spans straight through.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Predicted correctly this time only because a prior task in this same run (functionLinks) already established the invoke() wrapper pattern for this file — not purely cold knowledge.

### `commitDetail`
- spec 3 · read at `f70b37de3c2e` · commit `00bad90` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:57:30Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A one-line wrapper that calls `invoke('commit_detail', { key, sha })` (Tauri IPC) and returns the result directly, since validation and the null-for-not-found logic already live in the Rust command.
- found: One-line Tauri invoke wrapper: `return invoke('commit_detail', { key, sha })`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `fileCommits`
- spec 3 · read at `61ca0469d589` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:33Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Invokes the Tauri "file_commits" backend command with key, path, and days, and returns the resulting array of Unix timestamps (seconds) for commits touching that file, newest first.
- found: Thin invoke() wrapper calling the 'file_commits' Tauri command with key/path/days, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `functionHistory`
- spec 3 · read at `3c8482fdc7a1` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:37Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Thin async wrapper that invokes a Tauri backend command (likely 'range_detail' or similar) passing key/path/start/end, awaits the result, and returns it as RangeDetail, or null if the invocation fails/throws — following the same thin-wrapper pattern as sibling functions like functionLinks and fileFunctions in this API module.
- found: Thin wrapper invoking the Tauri command 'function_history' with key, path, start, end, returning the RangeDetail or null result directly.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

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
- spec 3 · read at `dccdd8882360` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:03:22Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: This module is the color-mode engine for the sunburst/fan visualizations: `colorFor` is the main entry point that, given a node, the active mode (temperature/age/wiring/clones/docs/author/etc.), rank data, and the repo's age span, computes a {fill, ink} pair to paint that wedge. Supporting helpers compute the underlying shares/ramps per mode — calledShare/reachingShare for wiring-based modes, ageSpanOf/ageRamp for age-based coloring, docGrade/undocShare/opaqueShare/saysNothing for documentation-based coloring, isAuthor/slotColor for per-author coloring — plus paintsFromReadings/paintsFromWiring gating functions (used elsewhere, e.g. FileZoom, to decide whether stale-reading or wiring-dependent overlays apply to the current mode), a flash/flashPaint mechanism for highlighting recently-changed nodes, and rankCategories/bucketsFor/legendFor to build the legend shown alongside the visualization.
- found: Matches prediction closely: colorFor is the central per-mode color dispatcher (surprise/legible/docs/traps/callers/reach/clones/language/blame/churn/age), with paintsFromReadings/paintsFromWiring as gating helpers used elsewhere (e.g. FileZoom), calledShare/reachingShare/opaqueShare/undocShare/docGrade for share-based container roll-ups, ageSpanOf/ageRamp for per-repo-normalized age coloring, isAuthor/slotColor/rankCategories/legendFor for categorical author/language palettes, flash/flashPaint for history-replay birth/touch highlighting, saysNothing for suppressing rows where a mode has no meaningful reading for a node kind, and bucketsFor building the legend/panel breakdown using the same banding constants (CALLER_BANDS/REACH_BANDS/CLONE_BANDS/CHURN_BANDS/AGE_BANDS) that colorFor itself uses, so map and legend never disagree.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: legible/trap are N/A for this file-level task; values are placeholders since the schema requires them. File has no header doc at all (empty docs array) despite being densely commented per-function — the finding itself is the absence of a file-level doc.

### `paintsFromReadings`
- spec 2 · read at `09004cfe8323` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns true if the given ColorMode is one derived from a reader's report (e.g. surprise/predicted, legibility, documentation) rather than from git history or static parse data. Likely implemented as a small array/set membership check or an equality chain against the reading-based mode names.
- found: Returns true if mode is one of 'surprise', 'legible', 'docs', or 'traps' — the four reading-derived color lenses, as opposed to git- or parse-derived ones.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted 3 of the 4 modes correctly (guessed 'legibility' instead of 'legible') but missed 'traps' as a fourth reading-derived lens.

### `paintsFromWiring`
- spec 3 · read at `816c459c7f97` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:53:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A tiny predicate that returns true if `mode` is one of the call-graph-derived modes ('callers', 'reach', maybe 'clones'), checked via equality/inclusion against a small set of ColorMode values — used elsewhere to decide whether a gray wedge means "this language's call shape was never parsed" rather than "nobody has read this".
- found: Returns true only for 'callers' or 'reach' — the two call-graph-derived color modes; clones is not included.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I hedged by including 'clones' as a maybe, but it's not part of the wiring set — clones apparently has its own gray-means-something-else story.

### `bandOf` — TRAP
- spec 3 · read at `470e1ad727be` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:10Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Takes an array of bands each with a `min` threshold (sorted ascending) and a count `n`, and returns the band whose `min` is the largest one ≤ n — effectively finding the highest threshold the value has crossed, likely implemented via findLast/reverse iteration, defaulting to the first band if none match.
- found: Assumes bands are sorted descending by min; returns the first band whose min is <= n, falling back to the last (lowest) band if none match. Same end effect as "largest min <= n" but only if the caller supplies bands in descending order.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: Correctness depends entirely on callers passing `bands` pre-sorted descending by `min` — nothing in this function enforces or checks that ordering, so a band list passed ascending would silently return wrong bands.

### `calledShare`
- spec 3 · read at `b789829a7561` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:10Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Reads precomputed roll-up counts off the node (how many resolvable functions underneath it, and how many of those are called/referenced) and returns called / resolvable, returning null when the resolvable count is zero. Likely mirrors wiringShare/hotShare in reading fields directly off the node rather than recursing.
- found: Reads node.resolvable and node.orphans; returns null if either is missing or resolvable is 0; otherwise returns 1 - orphans/resolvable, i.e. the share of resolvable functions that ARE called.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `reachingShare` — QUIRKY
- spec 3 · read at `a10f7a376d07` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:10Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Walks the leaf functions under this node, counts how many have a resolvable "away"/fan-out count greater than zero (i.e. call something else in the repo) versus how many have any resolvable away count at all, and returns the ratio reaching/total. Returns null if there are no functions with resolvable data underneath (e.g. an empty or all-unresolvable subtree).
- found: Uses precomputed rollup fields on the node (resolvable and sinks) rather than walking children; returns null if resolvable is null/0, otherwise 1 - sinks/resolvable — the share of resolvable functions that are NOT sinks (i.e. reach out to something).
- predicted: some · documented: most · derivable: no · legible: full · trap: no

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

### `flashPaint`
- spec 3 · read at `b2f01c7f93bb` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:08Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper that calls the peer `flash(kind)` function to get the birth/touch color, and returns it packaged with a `label` field (something like "birth" or "touch") describing the escalated event — same color as flash(), not diluted, per the docs.
- found: Delegates to the peer `flash` helper, mapping 'birth' to the '--birth' CSS var with label 'new', and 'touch' to '--touch' with label 'changed'.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc explains why this exists (escalated wedge display) but not derivable from code that this is specifically for the case where the function/file itself isn't drawn.

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

### `colorFor`
- spec 3 · read at `37bcc8cef993` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:51:18Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A big switch/if-chain over the ColorMode enum: for each mode (age, author, calledShare, reachingShare, docGrade, opaqueShare, etc.) it checks whether the node has the relevant data (history, language, analysis) and if not returns null; otherwise it calls the matching helper (ageRamp, isAuthor, calledShare, reachingShare, docGrade, undocShare, bandOf) to compute a numeric/categorical value, maps that through a color ramp or palette, and returns a Paint object plus a human-readable label string describing the value.
- found: An if-chain over ColorMode (surprise, legible, docs, traps, callers, reach, clones, churn, age, blame/lang), gated first by a history-replay override that always paints grey with a birth/touch flash. Each mode branch handles container (share-based) vs leaf (per-node reading) cases differently and returns a Paint+label, or null when the node has no relevant data for that mode/lens.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Most of the function's real content is in the extensive inline comments explaining WHY each branch is shaped the way it is (failed alternatives, calibration choices) — reading the code without them would miss the reasoning entirely.

### `rankCategories`
- spec 2 · read at `3520bac67344` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree from root, groups nodes by category (as determined by mode), sums lines per category, sorts categories descending by total line count, and returns a Map from category name to its rank/slot index (0 = biggest category).
- found: It just delegates entirely to legendFor(root, mode), taking the ordered legend names and building a name→index map from their order. All actual grouping/sorting logic lives in legendFor, not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment describes the overall purpose well but doesn't reveal that this is a thin wrapper around legendFor.

### `bucketsFor` — QUIRKY — TANGLED
- spec 3 · read at `019eeb9573f3` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:39Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Walks every function node under root (skipping .sanityignore-excluded ones, like `summarize` does), and for each computes the same value colorFor would use for the current mode, grouping them into discrete buckets (bands for banded modes, categories for categorical modes). For ramped modes, each bucket's swatch color is heatColor at the MEAN of its members' ramp inputs rather than a fixed per-band color. Functions the mode can't classify go into one final bucket painted in the structural neutral, and every function is accounted for in some bucket so the counts sum to the total.
- found: Recursively walks the whole tree (excluded subtrees marked out-of-scope but still walked), bucketing both file rows (for blame/language/docs, since a file answers for its own header/author/language) and function rows per mode into a Map keyed by category/band, with a sentinel unknown key for unclassifiable nodes; ramped modes collect raw ramp inputs per bucket and average them after the walk to set the swatch color to the mean; the result list is then sorted with a different explicit order per mode-family (by lines for categorical, trap-first, worst/best-first per lens) with the unknown bucket always pushed last.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Missed that files themselves get their own bucket rows for blame/language/docs and that each mode family has bespoke output ordering — the signature/docs only hinted at the mean-color and unknown-bucket behavior.

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
- spec 3 · read at `19b5be80ff3d` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:19:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively aggregates a directory/container node's stats from its children: for each child, if it's itself a container, first recursively call aggregate on it; then combine the children's LOC by summing (LOC-weighted), take the oldest "appeared" date among children for the node's age, and the newest "last touched" date for recency. appearedOf is used to look up a leaf/child id's appeared date when not already cached on the node. Mutates node's fields in place rather than returning a new value.
- found: Recursively aggregates children first, sums LOC, computes LOC-weighted average churn, max commits, max ageDays, min lastTouchedDays (skipping stand-in 'rest' nodes), sets birthBelow/touchBelow flags by OR-ing children's own flags or presence of appeared/edited scores, sets node's own appeared via appearedOf callback but always sets edited to null (containers never show an edit flash, only birth).
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The extensive inline comments explain WHY (performance constraint of single walk, semantic distinction between birth/touch for containers) far beyond what the signature or docs suggested; the one-line doc comment undersells how much policy is encoded here.

### `collapse`
- spec 2 · read at `d28aae3d52ae` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:25Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a Node tree; for any directory node that has exactly one child and that child is itself a directory, merges them into a single node (combining names/paths with a separator) and continues collapsing down the chain, then recurses into the (now collapsed) children to do the same at deeper levels. Returns the transformed node, mirroring the Rust-side collapse_chains logic so the JS-side history replay tree matches the shape the initial scan produced.
- found: Recurses into children first (map collapse), then if this node is a single-dir-child directory, returns the child's node spread with the name joined as "parent/child" — effectively promoting the child up and discarding the parent's other fields (children, etc. come from `only`).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected a while-loop that flattens an entire chain in one node before recursing; actual code relies on the post-order recursion itself to naturally chain-collapse one level per call.

### `dirNode`
- spec 3 · read at `0638ebe443da` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:27Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Constructs a directory Node for the history-replay tree with the given path and name, setting kind to 'dir', an empty children array, and defaulting the rest of the Node's fields (loc, score, callers, etc.) to null/zero so it matches the shape used for file/func nodes elsewhere in the tree, enabling uniform traversal during replay.
- found: Builds a directory Node with kind 'dir', empty children, funcs/loc 0, and every other field (score, doc, callers, etc.) explicitly nulled/defaulted to match the shape of file/func nodes used elsewhere in the history-replay tree.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

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

### `frameTree` — TANGLED
- spec 3 · read at `bbcb4cd2c4f7` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:21:42Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Replays the historical tables/deltas up to `index` to reconstruct what the repo tree looked like at that commit, scoped down to `scope` if given, and builds a fresh Node tree (files/dirs/functions with sizes and scores) shaped like the live sunburst's tree. Marks nodes that changed in `(since, index]` as "flashing". Applies a roll-up threshold (minLoc, scaled by density squared) to collapse small functions/files into rolled-up counts so the tree isn't overwhelmed at low zoom/density.
- found: Replays history to `index`, builds dir/file/func nodes (pooled for allocation reuse), applies a minLoc threshold (scaled by density² and, when scoped, by the in-scope line share) to decide which functions get real nodes vs. fold into a per-file `${path}#/folded` stand-in wedge that still carries birth/edit flash state, then aggregates directory-level flash timestamps and collapses the tree.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: The extensive comments explain a specific historical bug (React key collision between `#/rest` and `#/folded`) and a perf regression (31.7ms/frame) that aren't derivable from the code alone but are exactly the kind of trap notes future editors need.

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

## web/src/lib/mascotClock.ts

### the file itself — QUIRKY
- spec 3 · read at `3f345ae889fd` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small injectable clock abstraction for the mascot feature: a `mascotClock()` getter returning current time (wrapping Date.now()) and `setMascotClock()` setter to override it, letting tests/storybook control mascot animation timing deterministically instead of using real wall-clock time.
- found: Defines a MascotClock interface (hold/step/release) and a module-level singleton slot (setMascotClock/mascotClock) used to let the movie-export code take over the mascot's own animation loop and drive it frame-by-frame in file-time instead of wall-clock time, so exports play the creature at true speed regardless of how long rendering actually took on the machine doing it.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: My prediction assumed a generic testable time-provider (Date.now wrapper); the actual purpose — synchronizing a live animation loop to an export's frame time via hold/step/release — is a much more specific and non-obvious design that only the docstring reveals.

### `setMascotClock`
- spec 3 · read at `27aad1144c3a` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:50Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Just assigns the given clock (or null) to a module-level variable, presumably named mascotClock, so other code can look it up later via the peer export.
- found: Assigns the argument to a module-level `current` variable.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `mascotClock`
- spec 3 · read at `37b3fba49ae9` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:04Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A trivial getter that returns a module-level variable (set elsewhere by setMascotClock) holding the current MascotClock instance/creature driving the mascot hub, or null if none is currently active.
- found: Trivial getter returning the module-level `current` variable, presumably set by setMascotClock.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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

### the file itself
- spec 3 · read at `e77fa85b50ff` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:21:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This file implements exporting the history replay as a movie file. A `Shot` class draws a single frame onto a canvas — the map rect, the "creature"/icon, a caption column, signature/timeline text, using CSS variable colors (varCss, faceCss, background, ink) and helpers like mapRect/mapSide/base64/round/stamp/within for layout and encoding. `settings`, `probe`, and `preflight` figure out what recording capability/codec is available in the browser (e.g. MediaRecorder support), and `record`/`encoded`/`settle` drive the actual frame-by-frame capture loop and produce the final encoded video (base64 or Blob) for saveMovie to write to disk.
- found: Records the history replay as an MP4: Shot draws each frame by cloning the live SVG into a raster base canvas (re-rasterized only when the commit changes, not every frame), compositing a WebGL mascot canvas on top per-frame, and drawing a caption/timeline/signature with careful text-fitting logic; record() drives a fixed-clock (not realtime) frame loop with per-stage progress/cost reporting and cancellation checks, calling preflight/probe to find a codec (H.264 then H.265 fallback) that will actually encode at the requested size via mediabunny, and encoded() base64s the result for the Rust side to write to disk.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file header comment exists; the file's real complexity (encoder deadlock workarounds, WebKit SVG-decode hangs, fixed-clock vs realtime capture, two-canvas base/frame split) is entirely in inline comments distributed across the file, not summarized anywhere.

### `mapRect`
- spec 3 · read at `e7e68e2675f3` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:22:39Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the square region for the map within a width×height frame: calls mapSide(height) (or similar) to get the side length as 0.72 of the frame height, then returns {x, y, side} with x placing it right-aligned (x = width - side, or width - side - some margin) and y vertically centered ((height - side) / 2), leaving the remaining left-hand column for the caption.
- found: Computes side = height*(1-2*PAD), x = width - height*PAD - side (right-aligned with a PAD margin), y = (height-side)/2 (vertically centered); returns {x, y, side}.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The side/x math is done inline with a PAD constant rather than delegating to the peer mapSide, which I'd assumed it called.

### `mapSide` — QUIRKY
- spec 3 · read at `2f803f5cc5cd` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:22:52Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns Math.round(height * (1 - 2 * PAD)) — the same side-length formula used inline in mapRect, extracted as its own export so callers like ExportDialog can report the layout size without needing the full rect.
- found: Delegates to mapRect(height*ASPECT, height).side — reconstructs a full 16:9 frame from the height alone (using the ASPECT constant) and reuses mapRect's own side computation, rather than duplicating the PAD formula.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I had the delegation direction backwards — mapSide calls mapRect, not the other way around — and didn't know about the ASPECT constant it uses to reconstruct a full frame from just a height.

### `ink`
- spec 3 · read at `4bb5b17e7502` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:23:02Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Calls getComputedStyle(from).getPropertyValue(name).trim() to read a CSS custom property's resolved value off the given element (the staged SVG/pane during export), returning it as a plain color string usable in Canvas2D fillStyle.
- found: getComputedStyle(from).getPropertyValue(name).trim() — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

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
- spec 3 · read at `4a1f19053778` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:01Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks the document's stylesheets to collect every custom property name (--foo) declared anywhere, then uses getComputedStyle(from) to resolve each to its current value given whatever theme is active, and returns a CSS string (e.g. a `:root { --foo: value; ... }` block or inline style text) that can be attached to the cloned/exported element so its var() references still resolve without needing the original stylesheets.
- found: Collects all `--foo` custom property names by regex-scanning every stylesheet's cssText (skipping cross-origin sheets that throw), resolves each via getComputedStyle(from) — deliberately the passed element rather than `<html>`, since the export stages its ground on the pane — and emits a single `svg{ --foo:val; ... }` rule string.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `background`
- spec 3 · read at `0653551529f0` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:54Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Reads the `--background` custom property off getComputedStyle(from) and returns it trimmed, defaulting to reading it from the document root but accepting a specific element since the ground can be staged on the pane rather than globally during a recording.
- found: Reads and trims the `--background` custom property via getComputedStyle(from), falling back to `#fff` if empty.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `constructor` — QUIRKY
- spec 3 · read at `5d076a57b010` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:43Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This constructor mostly just assigns its constructor-parameter fields (svg, w, h, bg are already parameter-properties) and manually stores title/scope since those aren't marked private in the signature, plus perhaps injects the passed style string into a <style> element inside the SVG so each exported frame carries its own CSS rather than depending on the live document.
- found: No CSS injection into the SVG — instead it computes the map layout rect via mapRect(w,h), creates two off-screen canvases (main + base) sized w×h, grabs their 2D contexts, and throws if either context is unavailable. I also misread title/scope as not being parameter-properties when they actually are (marked private), so I invented a manual-assignment step that doesn't exist.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `target`
- spec 3 · read at `89dc2df62df9` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:37Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Simple getter returning a stored canvas element field on the Shot instance, the HTMLCanvasElement this Shot draws to — no computation involved.
- found: Exactly as predicted: returns this.canvas.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `draw` — TRAP
- spec 3 · read at `ea1158dcc252` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:59Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: This async method rebuilds the base canvas from scratch for one frame — paints the background, serializes/rasterizes the current SVG map (via base64 + loading an Image, hence async) into the map rect, draws the caption text, and renders the timeline with its playhead positioned at `at`. It likely also draws the signature/watermark and any rule drop shadow.
- found: Clones and resizes the live SVG, injects the style element, serializes it to a blob URL (not base64/data-URL, to avoid percent-encoding megabyte-scale path data), loads it into an Image with img.decode() raced against a DECODE_LIMIT timeout to guard against WebKit's SVG-decode hang, then paints background+map image+caption()+timeline(). No signature/watermark drawing here despite it being a peer method.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: img.decode() on an SVG blob URL can hang forever in WebKit rather than rejecting, so it's raced against a DECODE_LIMIT timeout via `within` — an editor calling decode() directly elsewhere would silently freeze an export with no way to cancel.

### `frame`
- spec 3 · read at `65322ab9b269` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T04:52:08Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Draws the current base frame (e.g. via this.draw()) onto the output canvas, then checks whether there's a mascot/creature to composite; if so it computes its position from the current viewBox and hub box (not from the live DOM transform) and draws the creature canvas on top via this.creature(), silently skipping if no creature exists yet. Likely also encodes/stamps the resulting frame for the video via the encoder.
- found: Draws the precomposited base image onto the canvas context, then calls this.creature() to composite the mascot on top — all the positioning/silent-when-absent logic described in the docs lives inside creature(), not here.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs are almost entirely about what creature() does internally; frame() itself is just the two-line call site.

### `creature`
- spec 3 · read at `1cb5f5e22d7f` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:21:53Z · by ross@rossturk.com · warm reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Draws the WebGL mascot canvas composited on top of the base map frame, since the mascot lives outside the SVG and cloning the SVG doesn't carry it. It reads the mascot canvas's DOM position relative to the hub layer, computes an equivalent position/scale in the export's coordinate space using the SVG viewBox and map rect, and drawImages the mascot canvas onto the frame's context at that computed location; it's a no-op if no mascot canvas is present.
- found: Finds the mascot's DOM canvas and hub layer, computes a scale from the SVG viewBox to the export's map rect, then derives the canvas's on-screen offset relative to its layer box (accounting for the sprite's internal "lift" offset) via getBoundingClientRect ratios, and drawImages it onto the frame at the computed position/size; no-ops if there's no mascot canvas.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: Already read this exact function body verbatim as part of the movie.ts whole-file reveal a couple tasks earlier, so this was a warm/recall reading, not a cold prediction.

### `column`
- spec 3 · read at `9a0d12e04439` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:04:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes the horizontal region reserved for the caption — the area to the left of the map. Returns `left` as the frame's margin offset and `room` as the available width between that margin and where the map begins (map's left edge minus margin), so caption text knows where it can be drawn without overlapping the map.
- found: Computes left as 2x a padding value derived from frame height, and room as the distance from that left edge to the map's x position minus one pad — i.e. the caption column's position and available width.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `caption` — QUIRKY — TANGLED
- spec 3 · read at `55c2bc9b1113` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:22:08Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A private Shot method that draws the caption block beneath the map: the repo's slug/name in a larger bold font, the drilled-in directory path (if any) in a smaller font below it, and the current commit's date on another line, computing x/y positions from the frame dimensions, then calling this.signature() near the bottom to add the attribution. It likely uses ctx.fillText multiple times with different font sizes/weights for each line.
- found: Draws the title block: splits the slug into owner/name, computes an inline layout (owner prefix + bold name on one line) shrinking font size until it fits the available column width, and falls back to a stacked layout (owner on its own small line, name on its own line) if it still doesn't fit even at a floor size — the name itself is never elided/truncated. Below that it draws the drilled-in scope path on its own line, independently sized to fit. It records the computed rule (left/right/base) for the timeline to use, but does not call signature() or draw any date — both of my guesses on that front were wrong.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: No docs were given for this one despite the sizing/layout logic being intricate (dynamic shrink-to-fit with an inline/stacked fallback) — worth a header explaining the two-layout strategy.

### `signature`
- spec 3 · read at `7e2818bbbc3d` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:21:37Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A private method on the Shot class that draws the app's own attribution/watermark text (something like "sanity") onto the canvas frame, positioned at the given `left` x-coordinate below `base` (a y-coordinate under the timeline/date block), using a small muted font via ctx.fillText — a sign-off distinct from and below the repo/directory/date caption block drawn elsewhere.
- found: Draws a small muted-color text signature (SIGNATURE constant) at (left, base) on the canvas using a font sized relative to frame height, with a fallback color chain (muted-foreground → foreground → black).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `ruleDrop`
- spec 3 · read at `77320ab81403` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:21Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes and returns a fixed pixel offset — derived from font-size/line-height constants used elsewhere in Shot — representing the total vertical extent of the timeline bar plus signature text below the caption's last baseline, so both the caption-centering code and the timeline-drawing code can share one number instead of duplicating the layout math.
- found: Computes a pixel offset as a sum of terms scaled from `this.h` (canvas height) and a `small` base font size, summing timeline height, a gap, and signature text height to get total vertical extent below the caption baseline.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The purpose (shared single definition so caption-centering and timeline-drawing agree) only comes from the doc comment — the arithmetic alone doesn't reveal why it's structured as one method.

### `timeline`
- spec 3 · read at `967ee64acfab` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:22:12Z · by ross@rossturk.com · warm reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Draws a progress rule under the caption: a muted background bar and a filled accent-colored portion proportional to playhead position (this.at.at / this.at.of), with the commit's date (via stamp) on the left and a "N / total" counter on the right, then calls signature() below it. Positioned relative to this.rule, which caption() set.
- found: Matches prediction: rounded muted background bar plus accent-filled progress portion, date via stamp() on the left, "N / total" count on the right, and calls signature() beneath it all.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Already read this exact function in the earlier movie.ts whole-file reveal, so this is a warm/recall reading.

### `round` — QUIRKY
- spec 3 · read at `454635e06be1` · commit `024199b` · read by claude-sonnet-5 · via claude · when 2026-08-20T05:05:21Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Draws a short horizontal bar using a canvas stroked line with ctx.lineCap set to 'round': moves to (x, y) and strokes a line to (x+w, y) with lineWidth = h, so the rounded end caps produce a pill-shaped bar rather than a sharp-edged rectangle.
- found: Draws a filled rounded-rectangle/pill shape at (x,y) sized w×h using four arcTo calls with corner radius h/2, then fills the closed path — not a stroked round-capped line as I guessed.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The doc's mention of 'caps' made me predict a stroke+lineCap approach; actual implementation is a filled arcTo path, which achieves the same pill look but works differently (e.g. behaves correctly with any fillStyle/alpha, no stroke state needed).

### `stamp`
- spec 3 · read at `32c58c4d592a` · commit `50b4d0a` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-19T08:22:04Z · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Formats a commit timestamp (seconds since epoch) as a locale date string including the year, month, and day, for display under the timeline in the exported movie; returns a fallback string like "before this history" when ts is null (for frames before the export window).
- found: Exactly as predicted: null returns 'before this history', otherwise formats as a locale date string with year/month/day.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Already read this exact function in the earlier movie.ts whole-file reveal, so this is a warm/recall reading.

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
- spec 3 · read at `c9ebc1ef3f14` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:14Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Sets up a real mediabunny output/encoder with the given width/height/encoding config, feeds it ten blank (e.g. black canvas) frames, and finalizes/closes it — resolving if the whole pipeline actually produces output, and letting any thrown error (from WebCodecs or mediabunny) propagate up uncaught so the caller (preflight) can just try the next codec without needing to know why this one failed.
- found: Draws a background-filled canvas, builds a real mediabunny Output/CanvasSource/Mp4OutputFormat/BufferTarget pipeline with the given encoding, and wraps start/each of 10 frame adds/finalize in `within(..., PREFLIGHT_LIMIT, slow)` so a codec that hangs rather than errors still fails with a clear message; always cancels the output afterward since only the pass/fail verdict matters, not the produced bytes.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The `within` timeout wrapper is the key detail the doc/signature don't hint at — this guards against codecs that hang silently instead of throwing.

### `preflight`
- spec 3 · read at `9e5e446fdd2b` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:19:00Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates over candidate codec configurations (probably from `settings`/`probe` helpers) for the given width/height/quality, checking each with something like canEncodeVideo, but since that check can lie, it likely actually attempts a real encode (via `record`/`encoded`) to confirm a packet is produced. Returns the settings object for the first codec that truly works, and throws/returns an app-authored error message (not WebCodecs' raw error) if none do.
- found: Loops through CODECS, building settings via settings(quality, codec) and calling probe(width, height, encoding, deps) to actually try it; returns the first settings that don't throw. If all codecs fail, throws a custom Error naming all tried codecs and the resolution, telling the user to try a smaller resolution — deliberately not surfacing WebCodecs' own error message, matching the doc's point about the refusal being "the app's own sentence."
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `record` — TANGLED — TRAP
- spec 3 · read at `ce9cc554d57a` · commit `50b4d0a` · read by claude-sonnet-5 · via claude · when 2026-08-19T08:20:31Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Loops over the total output frames (seconds*FPS), mapping each output frame to a source commit index, calling o.ensure/o.setIndex to advance the timeline only when the target commit changes from the last drawn one — caching/reusing the last rasterized bitmap otherwise to avoid redundant draws. For each frame it uses a Shot-like drawer to rasterize the map (with varCss/background baked in) onto a canvas, feeds it to a mediabunny CanvasSource/Output built from a codec selected via preflight, reports progress and per-stage timing costs via o.onProgress, checks o.cancelled() each iteration to bail early, and finally calls output.finalize() to return the resulting MP4 bytes as a Uint8Array.
- found: Lazily imports mediabunny, runs preflight to pick a codec, loads fonts, builds a Shot rasterizer and Output/CanvasSource pipeline, then loops `total` output frames mapping each to a source commit (only re-fetching/folding/rastering when the mapped commit changes, reusing the last raster otherwise), holds/steps/releases the mascot clock so the creature animates on the output's own clock rather than wall time, tracks rolling per-stage average costs to estimate time-left, checks cancellation at multiple points throwing CANCELLED, and returns the finalized MP4 buffer.
- predicted: most · documented: most · derivable: no · legible: some · trap: yes
- note: The mascot clock hold/step/release is wrapped in try/finally specifically so a cancelled or errored export doesn't leave the creature frozen mid-animation in the live hub — easy to miss if refactoring the loop's control flow.

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
- spec 3 · read at `e2bfb68ae99e` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:21:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Constructs a bare Node object of the given kind ('dir' or 'file') with the given path and name, initializing all the other Node fields (children array, score/agent fields, loc, line, etc.) to empty/null defaults. Used by shapeTree/onScanShape as a factory when building up the tree structure before scores are attached.
- found: Builds a bare Node object with id/path/name/kind set and every other field (score, wiring lenses like callers/calls, clone fields, children, funcs) initialized to null/empty/zero defaults for use during in-progress tree shaping.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Comment clarifies wiring fields (callers/calls/etc.) are null rather than zero specifically because the shape tree streams before repo-wide resolution finishes — a nice bit of context not guessable from the signature alone.

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

### `aggregate` — QUIRKY
- spec 3 · read at `5c1eccd64541` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:21:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a synthetic Node representing the "everything else" wedge in a sunburst. Sums LOC across fns, computes a LOC-weighted average score/heat only from members that have actual read/score data (skipping unread ones), and sets a name/id like "+N more" with path filePath so downstream color/heat/hover code treats it like any other node without special-casing.
- found: Builds a synthetic overflow Node (id `${filePath}#/rest`, name `${fns.length}+`) representing functions that didn't fit their own wedge. Computes LOC-weighted means of score fields only over members actually read (model/agent source), retains the full member list as `children` for drill-down, marks itself with `rest`/`funcs` flags so color logic treats it as a collection wearing a function's kind, and tracks `hotShare`/`analyzedShare` to avoid the aggregate looking falsely cold or falsely confident.
- predicted: some · documented: full · derivable: no · legible: most · trap: no

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

## web/src/lib/tokens.ts

### the file itself
- spec 3 · read at `793cbf4705d3` · commit `d92c31f` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-20T23:29:57Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file exports a single `tokenize` function providing a lightweight, shared lexer used for syntax highlighting: it takes a source string (possibly with a language hint) and returns an array of token objects (e.g. {type, text}) classifying spans as keywords, strings, comments, identifiers, etc. It exists so both the main CodeView and the smaller code snippets shown in the panel apply identical coloring, avoiding a second approximate tokenizer that would drift from the first.
- found: Exports KEYWORDS regex (a union of keywords across ~6 languages) and tokenize(line), which runs one combined regex per line (not per whole source, no language parameter) matching comment/string/number/word/space/punct in priority order and returns Tok[] with {text, cls} for CSS-class-based coloring. It's a deliberately approximate single-pass, per-line lexer, not a real per-language grammar.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Predicted a language-hint parameter and per-source-string call; actually it's per-line, no language argument, and keyword sets for all languages are unioned into one regex.

### `tokenize`
- spec 3 · read at `c196b013b7f0` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:22:15Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A lightweight, language-agnostic tokenizer for one line of source code: scans left to right with regexes matching strings, comments, numbers, keywords/identifiers, and punctuation/operators, pushing each match as a Tok with a type and text so the code view can apply syntax coloring without a real parser.
- found: Single-regex pass over the line matching comment/string/number/word/space/punct groups in longest-match-first priority order, classifying words as keyword vs plain via a KEYWORDS regex test, and pushing each match as a {text, cls} token.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

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
