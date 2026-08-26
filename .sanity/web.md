# web — sanity assessment

406 of 406 read · 78 surprising

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

### the file itself — QUIRKY
- spec 3 · served in 5 parts · read at `5024301ecc25` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:55:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: The top-level React component and app-state hub for this desktop (Tauri) code-analysis tool: it wires together project selection/opening, a live scan-progress display fed by streaming events from the Rust backend (via the useProgress hook and ProgressTrack/ProgressStrip/ProgressPane components), and a history/timeline toggle (HistoryToggle) plus an empty-state view (Empty). The small helpers (noop, sameRun, sameIds, sameProgress, sameProjects, findById, parentOf, readingSignature) are mostly cheap equality/lookup utilities used to avoid redundant re-renders or re-fetches when high-frequency progress/project updates arrive, and to navigate/identify nodes in the project or file tree. No file header doc, so the file's overall purpose has to be inferred purely from its component/hook names.
- found: The root component of the whole desktop app: polls the project list and follows whichever project an agent (or the user) has focused, streams and batches scan progress/shape/scores/live-position events to draw an assembling sunburst map while a scan runs, folds in AI-agent "readings" (predictability/legibility grades) and lazily-fetched per-file function rings into the tree, drives the sunburst's drill-down/selection/crumbs/code-view-modal navigation, runs a full git-history replay mode (timeline scrubbing, commit log, movie export staging) as an alternate frame source, manages the mascot/agent-activity indicator, color-mode lens switching with Cmd-number shortcuts, CLI-install and big-folder-confirmation dialogs, and the first-run empty state. Far larger and more feature-complete than the name/peers alone suggested — it is effectively the entire application's state machine and view composition root, not just a progress/history shell.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No module header at all on a 2500-line file that is the app's central state hub — nearly every non-trivial state/effect has its own doc comment (often with incident history) explaining a bug it fixes, but nothing at the top orients a reader to the file's overall shape before diving in.

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

### `sameProgress`
- spec 3 · read at `6839b955bd59` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:28Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A shallow-equality check for Progress objects used to decide whether a UI update is needed. Returns true if both are null/undefined, false if only one is, and otherwise compares the relevant fields (e.g. phase, count/total) for equality to avoid needless re-renders.
- found: Returns true if both null/undefined, false if only one is, otherwise compares done/total/phase/unit fields for equality.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `sameProjects` — QUIRKY
- spec 3 · read at `2614b0e33f66` · commit `71003bd` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:39:00Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Compares two arrays of ProjectSummary for equality: checks length first, then iterates comparing each project's key summary fields (id, and likely a few others like status or counts) rather than full deep equality, used to detect whether project list state actually changed to avoid unnecessary re-renders.
- found: An exhaustive field-by-field equality check across ~25 ProjectSummary fields (not just a few), including nested comparisons via sameIds/sameProgress/sameRun for arrays and sub-objects, with inline comments documenting three specific past bugs where omitting a field from this comparator caused stale UI (phase, harness/model, and replayed commit counts).
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: The comments already document why this list must stay exhaustive; the risk for an editor is adding a new ProjectSummary field and forgetting to add it here.

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
- spec 3 · served in 5 parts · read at `1ef8a04adfec` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:20Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: The top-level React application component — wires together all global state (projects list, current scan/run, progress tracking, selected file/function, history), IPC calls to the Tauri backend, keyboard shortcuts, and renders the overall layout shell (sidebar, main content pane, progress strip/pane, history toggle, empty state) using the many hooks and subcomponents listed as peers. At 2420 lines it's the monolithic root component holding most of the app's orchestration logic.
- found: The root App component: dozens of pieces of state and refs covering the active project, the live scan tree, streamed function readings, streamed parse "shape" (for drawing the map while a scan is still running), a live-progress marker set, a full git-history replay system (tables/deltas/frame-building/scrubbing/playback), color-mode/lens locking logic, keyboard shortcuts (Cmd+1..9/0/-/+), drill-in/selection/breadcrumb navigation, project add/forget/trace flows with confirmation dialogs for large repos, CLI-install dialog, and the final JSX layout wiring sidebar/top bar/sunburst map/detail panel/history transport/code-view modal together.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no
- note: Nearly every piece of state here has a load-bearing comment explaining a specific historical bug it fixes (stale closures, StrictMode double-invoke, re-render storms) — treat any 'simplification' of this component as high-risk without reading those comments first.

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
- spec 3 · read at `707f6ab7ac5a` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small toggle button component. It renders a button labeled something like "History" that calls onToggle() when clicked, is disabled when !traced (since there's nothing to show) or possibly when busy, and reflects the `on` state visually (active/pressed styling). It does NOT trigger any trace/commission work itself, per the docs warning.
- found: A toggle button rendering "History"/"Tracing…" label with a lock icon when untraced. Disabled state is asymmetric: only disabled when turning ON (not on && (busy || !traced)) — leaving history view is always allowed, since locking someone into a mid-trace view was a past bug. Title tooltip explains state to the user.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The disable condition is asymmetric (only blocks entering, never leaving) — the doc comment explains why but the field docstring alone doesn't make the button's actual disabled expression predictable.

### `Empty`
- spec 3 · read at `4781c65403cd` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:19Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a centered first-run card with a single primary CTA button that calls onAdd to add a repo, plus a checkable prerequisite status (whether claude/codex CLI is installed) shown inline, and a small mention of MCP as an alternate way to trigger reading at the bottom, replacing the old two-step connect+paste-phrase flow.
- found: Renders the first-run card: title, blurb, "Add a repo" button calling onAdd, a checked-agents line (which of claude/codex are installed), a demoted mention of `sanity check` as a terminal alternative, and — unpredicted — a whole CLI-on-PATH section that checks cliStatus and offers a button to link/install the `sanity` CLI onto PATH, with several states (already correct, points elsewhere, linking in progress, linked but shadowed).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The CLI-linking block (install_cli/cliStatus) is a distinct concern from the harness-check block and is the part a name-only prediction can't anticipate.

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
- spec 3 · read at `1b7a639e9ad6` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:08:52Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a decorative empty-state illustration — a scattered field of SVG flowers shown in the right pane when nothing is selected. Uses math helpers (petals, seedHead, leafPath) to generate rose-curve-based petal/leaf paths, small components (Flower, Leaf) built from those paths, a Tile component to lay out repeated/randomized flower instances, and a top-level Bloom component composing many tiles into the full scattered field.
- found: Decorative empty-pane SVG: a rose-curve (rhodonea, fattened by fractional power) flower shape and a Vogel-phyllotaxis seed head compose into Flower/Leaf, placed on a p6m wallpaper-group hexagonal lattice (6-fold, 3-fold, 2-fold sites) in a Tile, drawn nine times at offsets to make SVG pattern clipping tile seamlessly, rendered as a repeating `<pattern>` fill via Bloom.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header explains deep math/design rationale (crystallographic restriction, why 6 not 5 petals, why scattered not vined, the nine-copies tiling trick) that is essential to understanding the seemingly-arbitrary constant choices (K=3, T, lattice point arrays) and isn't recoverable from the code alone.

### `petals`
- spec 3 · read at `4cb8082affa4` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:36Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Generates an SVG path `d` string tracing the rhodonea rose curve r = a*|cos(k*theta)|^(1/P), looping theta from 0 to 2*pi (or pi depending on k parity), converting polar (r,theta) to cartesian x,y at each step, and joining the points into a "M x y L x y L x y..." path string.
- found: Loops 240 steps over theta in [0, 2pi], computes the fattened rhodonea radius using constants A/K/P, converts to cartesian, and builds an SVG path string with M/L commands, closed with Z.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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

### `leafPath`
- spec 3 · read at `6d4b644d3fb7` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:27Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns an SVG path `d` string drawing a vesica/lens shape: starts at one tip (0,-L), draws an elliptical/circular arc out to a maximum width and back to the other tip (0,L), then a mirrored arc back to the start, using a radius derived from L via the vesica piscis geometry (arc radius equal to the distance between the two circle centers, i.e. related to L by a sqrt(3) or similar factor).
- found: Two-arc vesica path as predicted, but tips are along the x-axis (-L,0) to (L,0) rather than the y-axis, and the arc radius is just an empirical constant L*1.16 rather than a geometrically-derived vesica-piscis factor.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Leaf`
- spec 3 · read at `09b88f7e8082` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering a single decorative SVG leaf shape at a given scale `s`, likely reusing `leafPath` from its peers to generate the path data and applying a fill/stroke style consistent with the flower motif.
- found: Renders a scaled SVG group containing a leaf outline path (from leafPath(L), semi-transparent fill + stroke, using currentColor) plus a straight midrib line down the center of the leaf.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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
- spec 3 · read at `6e140e14706c` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: This renders a titled/subtitle panel containing a scrollable code viewer: it dedents the raw code, splits it into lines (via `Lines`), shows a line-number gutter starting from `startLine`, applies syntax highlighting unless `highlight` is false (for prose/doc comments), and optionally shows a `caveat` warning above the code and a `flush` variant without its own border/rounded corners.
- found: Dedents the code and renders it via `Lines` in a small scrollable inline box, but also maintains open/close modal state: a hover-revealed expand button opens the same content full-size in an `Overlay` with a header (title, subtitle, CopyButton, close), Escape-to-close handling, and the caveat repeated in both the inline and modal views.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

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
- spec 3 · read at `8ef2cf503622` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:36Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Defines the lens-switcher UI and its legend: `ModeSwitcher` renders the row of color-mode buttons (with locked/disabled states and tooltips explaining why, via `Lock`), and `ColorLegend`/`Legend` render the corner legend showing categories or a ramp for the current lens. `shortcut` is a small helper that formats/labels the ⌘-digit keyboard shortcut for a given mode, matching the digit order used elsewhere in the app.
- found: Defines Lock (padlock icon for locked lenses), Legend (mode-specific key rendering: categorical swatches, boolean trap swatch, banded callers/reach/clones keys, or a heat ramp), shortcut (keyboard digit label per lens), ModeSwitcher (the segmented lens-picker control with lock states/tooltips), and ColorLegend (boxes the Legend plus stale/unread swatch footnotes).
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `Lock`
- spec 3 · read at `8aa591169d42` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:38:39Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a small padlock icon/SVG whose color is conditional on the `keyed` boolean — accent color when true (some button could open it), muted ink otherwise — with a tooltip naming the button.
- found: Renders a tiny padlock SVG (rect body + arc shackle), aria-hidden, with color and opacity set based on `keyed` — accent/full opacity when true, muted/0.7 opacity when false. No tooltip is present; that lives elsewhere per the docs.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs mention a tooltip naming the button, but that's on a parent/sibling component, not this SVG itself.

### `Legend` — QUIRKY
- spec 3 · read at `f304ed8f627b` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:01Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Branches on mode — for categorical modes (blame/lang) it renders a swatch list using categories colored via the shared ranks map (matching what's painted on the map), with an "Other" bucket for anything past the ranked slots; for quantitative/ramped modes it renders a gradient/ramp legend, likely delegating to ColorLegend, skipping categories entirely.
- found: Categorical branch (categories.length>0) roughly as predicted: sorts named categories by rank, caps names at NAMED, groups the rest into an "Other" swatch. But there's no separate delegation to a ColorLegend component for ramps — it's all inline in this one function, with distinct hand-built keys per mode: traps gets one static square swatch (boolean, not a scale), callers/reach/clones each get their own banded swatch list (CALLER_KEY/REACH_KEY/hardcoded clone triple), and only the remaining modes fall through to an inline 24-segment gradient bar built from heatColor/rampOf with lo/hi labels.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `shortcut`
- spec 3 · read at `2344a0f70bf0` · commit `c4c6042` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T07:08:05Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: One-line arrow function mapping index i to its keyboard shortcut label: i < 9 returns ⌘${i+1}, i === 9 returns ⌘0, i === 10 returns ⌘-, and anything beyond (i >= 11) returns null since shortcuts run out.
- found: Ternary chain returning bare key string ('1'..'9', '0', '-') for index 0-10, null beyond — same logic I predicted but the ⌘ symbol is not part of the returned string, presumably added by the caller.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `ModeSwitcher` — TANGLED — TRAP
- spec 3 · read at `e4e9a18bec7f` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:50Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a row of tabs/buttons, one per ColorMode, highlighting the active `mode` and calling `onMode` on click. For modes present in `locked`, it renders a Lock icon and disables the tab (or shows a tooltip) explaining why that lens has nothing to show, rather than just graying it out silently. Probably also shows keyboard shortcut hints via the `shortcut` helper.
- found: Renders a segmented-control tablist, one tab per ColorMode, highlighting the active one and calling onMode on click; locked modes show a Lock glyph inset in the padding, a `title` tooltip explaining why, and are dimmed to 0.55 opacity — matching my prediction closely, including the shortcut-in-tooltip detail.
- predicted: most · documented: full · derivable: no · legible: some · trap: yes
- note: The comment says a locked tab is "dimmed rather than disabled" (still a place you can stand) but the code also sets `disabled={!!lock}` on the button, which actually blocks focus/click via the native attribute — comment and behavior disagree on whether it's truly clickable.

### `ColorLegend`
- spec 3 · read at `11c63768d866` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:29Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a boxed legend (matching the ModeSwitcher's rounded/inset track styling) that lists color categories via the `Legend` helper, colored/ordered according to `mode` and `ranks`. Conditionally appends a "stale" swatch/entry when `stale > 0` and an "unread"/unanalyzed gray entry when `unread > 0`, since a legend entry for a texture absent from the screen would be misleading.
- found: Boxed container rendering the `Legend` for categories/ranks, then conditionally (only when mode paints from readings, and stale/unread > 0) a footer row with a hatch swatch for "stale" and a gray unanalyzed swatch for "unread", each reproducing the chart's own fill styling in CSS.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed that the whole stale/unread block is additionally gated on paintsFromReadings(mode), not just the counts.

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

## web/src/components/Counts.tsx

### the file itself
- spec 3 · read at `a7d41a04bf6f` · commit `6cf7dc9` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:43Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A small React component named Counts that renders a compact numeric summary (e.g. "N files, M functions, K directories") of the currently displayed codebase/selection, likely shown near the top of the visualization as an at-a-glance overview. No file-level doc.
- found: Renders "N lines · M functions · K commits · J excluded" for a node, where the commit figure is either the full git-log commit count for a subtree, or for a single function the distinct commits its current lines trace back to via blame — deliberately labeled differently and omitted entirely (never shown as 0) when there's no history.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Counts`
- spec 3 · read at `a05667a0c106` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:43Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A shared React component rendering "lines, functions, commits" segments for any node (repo/dir/file/function). It shows the line count always, shows the functions count only when `functions` is passed (omitted for function nodes since they aren't made of functions), and shows a commit count segment labeled differently depending on node kind — a lifetime git-log commit count for repo/dir/file vs a blame-derived "traced back to" count for functions — and omits the commit segment entirely (not a "0") when there's no history data available. Probably also folds `excluded` into the functions figure somehow.
- found: Renders lines · functions · commits as one line, with functions omitted when undefined, commit segment either the lifetime allCommits (repo/dir/file) or the blame-traced count (function, gated on ageDays not null so it doesn't read as a flat 0), and omitted entirely when neither exists. `excluded` is its own separate ' · N excluded' segment (from .sanityignore), not folded into the functions count as I guessed.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Tooltip text (title attrs) carries real semantic explanation of what each count means that isn't visible from the signature/docs alone.

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
- spec 3 · read at `c536befd73eb` · commit `6cf7dc9` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T07:07:34Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a detail panel for a selected node (function/file) — showing metrics (rank, measure, provenance/attribution) and the node's contents/source. Detail is the exported top-level component, Contents a subcomponent rendering source/body text, and rank/measure/provenance are helper functions computing display values (percentile rank, formatted metric, doc/blame provenance). No file header doc exists, which is itself notable.
- found: Detail panel component for the selected node. rank/measure/provenance are per-color-mode helpers as predicted. Contents lists children sorted by current mode's rank. Detail itself is much more involved than predicted: no-selection state falls back to Summary or an idle Bloom pattern, containers (dir/file) delegate to Summary with a LensPane 'about' block, leaf functions get a full custom layout with breadcrumb path, trap badge, Counts, LensPane, Contents list, and a provenance footer.
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
- spec 3 · read at `66e52b241034` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:40:51Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a node and an optional model name, returns a one-sentence human-readable string explaining where the displayed numbers (rank/measure) came from. Likely branches on whether model is non-null: if present, says something like "Computed by {model}"; if null, falls back to describing a cached, heuristic, or default source.
- found: Returns a one-sentence explanation of where a node's score came from, with priority-ordered checks: first if the node is too large to read (returns a size/ceiling message referencing a READ_CEILING constant), then if not yet analyzed, then based on node.score.source — 'agent' (formats who/when read it via MCP), 'model' (measured by the given model name), or falls back to 'the offline proxy'.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `Contents`
- spec 2 · read at `06ab2255d111` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:12Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Component that renders `node.children` as a sortable list of rows, ordered by heat/surprise value descending (using a `rank` or `measure` helper) rather than by size or name, with unread/ungraded children sunk to the bottom instead of sorted as cold. Each row shows its grade/provenance and wires up `onSelect` (click) and `onDrill` (double-click) handlers, using `mode`/`ranks`/`ageSpan` to compute display color and relative rank.
- found: Renders node.children sorted by: analyzed-first, then rank(mode) descending, then loc descending, with unread children sinking to bottom via the 'seen' tiebreaker. Each row is a button with a color swatch (colorFor), truncated name, and a measure(c, mode) value on the right, wired to onSelect/onDrill on click/double-click.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Detail` — QUIRKY — TANGLED
- spec 3 · read at `6748fcad0d32` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:48Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Detail is the right-hand detail-pane component: given the selected `node` (or `focus` when nothing is selected), it renders a title/breadcrumb built from `owners` (falling back to the node's own path when owners is empty), the current color-mode reading/label for the node, and a series of "lens" sections (docs, traps, callers/reach, clones, churn/age, blame/neighbours) that call helper functions like `rank`, `measure`, `provenance`, and render via `Contents`. When `replaying` is true it suppresses or disables the sections that would otherwise fetch live working-tree data (like neighbours/blame), since those only make sense for the current commit. Clicking items in these sections wires to `onSelect`/`onDrill`/`onShowIn`/`onJump` to navigate the map.
- found: Branches heavily on state: no node falls back to a Summary of `focus` or an idle Bloom pattern; a non-leaf (container) node delegates entirely to the same Summary component scoped to it; only a leaf function node renders the full bespoke header (name, trap badge, breadcrumb path, Counts) plus LensPane and Contents in a scrollable body, with a provenance footer shown only when the mode paints from readings. Breadcrumb segments are the tree's owner nodes (clickable via onShowIn) rather than raw path string pieces, and file nodes get their own header/lens content only under the docs mode via LensPane, not a separate block.
- predicted: some · documented: none · derivable: no · legible: some · trap: no

## web/src/components/Dials.tsx

### the file itself
- spec 3 · read at `796bf3155e27` · commit `6cf7dc9` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:26Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: This file now just contains the `Gauge` component — a reusable half-circle SVG dial (used to render surprise/docs/churn/legibility values elsewhere), since the four-gauge row itself was removed and only the primitive that draws one half-circle arc survived. Small single-purpose visual component: takes a value/fraction and label, renders an SVG arc with some color/fill logic.
- found: Exactly the Gauge half-circle SVG dial component (180° arc, ramp-colored, with unread/word variants) plus extensive doc comments explaining the removed dial-row and design rationale for each visual choice (track dimming, cap style, font-size fitting, label wrapping).
- predicted: full · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc comments here carry design history (what was removed and why) that isn't recoverable from the code alone, but they're unusually thorough and accurate for what remains.

### `Gauge`
- spec 3 · read at `35d9d87058bc` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:37Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a fixed-180° arc (SVG or conic-gradient) whose sweep is driven by `value`, colored by sampling `ramp` at `rampValue ?? value` (unless ramp is undefined, in which case it uses a neutral/accent color). If `unread` is true, it draws only the empty track with no needle/fill and a placeholder like "—" instead of a number. In the center it prints either `word` (for four-step qualitative readings) or the numeric value (e.g. as a percentage), with `label` beneath and `hint` wired up as a title/tooltip.
- found: SVG half-circle gauge: fixed 180° arc path, value clamped and drawn as a dasharray fraction of arc length, colored via heatColor(ramp, rampValue??value) or var(--accent)/var(--secondary) fallbacks. Unread suppresses the value arc and shows an em dash. Center text is word or rounded percentage, dynamically sized to shrink-fit longer words; label wraps below with tight tracking.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: Missed the shrink-to-fit font-size calc, the butt-vs-round strokeLinecap zero-value fix, and the label wrapping/tracking details — all called out via inline comments only visible after reveal.

## web/src/components/ExportDialog.tsx

### the file itself
- spec 3 · read at `b48085f52cbc` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:27Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A React dialog component (ExportDialog) that lets the user configure and trigger exporting the commit-replay "movie" (from movie.ts) as a video file — options likely include resolution, frame rate/pace, and which commit range to cover. Helper functions frameOf, pace, ms, lasting, and suggest compute derived values: mapping playhead/commit position to frame number, pacing/frame-rate math, formatting durations (ms, lasting = human-readable duration), and suggesting sensible default export settings (e.g. based on commit count so exports don't run absurdly long). No file header doc, so the responsibility has to be inferred purely from these pieces.
- found: A React dialog (ExportDialog) for exporting the commit-replay sunburst as an MP4: lets the user pick length, resolution, ground (light/dark) and color lens, then drives movie.ts's `record` to rasterize frames and `saveMovie` to write the file, showing live per-stage progress (fetch/fold/raster/draw/encode) and codec fallback messaging. Helpers format duration/size labels and derive a default filename; no file-level header doc exists even though individual consts/functions carry rich JSDoc.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: frameOf actually computes pixel width/height from a chosen frame height, not a frame-number/playhead mapping as I guessed from the name alone.

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

### `ExportDialog` — TANGLED
- spec 3 · read at `60bc89c24ea0` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A modal dialog component that lets the user configure and kick off a movie export (duration/scope/format), then drives the recording loop: for each frame it calls ensure(index) to await the timeline landing before capturing, stages the map via onStage for the export's size/ground, and reports progress while recording. It suggests a filename from name/slug/scope, restores the playhead via onIndex when done, and closes via onClose, using helpers like frameOf/pace/ms/lasting/suggest for timing/labeling math.
- found: A dialog with pickers for lens/length/resolution/ground, driving a `go()` async flow that stages the map (onStage), awaits two animation frames to let it settle, calls record() with ensure/dateOf/progress callbacks, saves the resulting bytes via saveMovie, and manages an idle/recording/saving/done phase state machine with cancel-via-ref, error display, and codec-aware messaging; restores stage/playhead in a finally block.
- predicted: most · documented: some · derivable: no · legible: some · trap: no

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
- spec 3 · read at `61052eb17d6f` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:42Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a scrubber/timeline bar UI for replaying commit history (paired with the Rust history replay backend) — showing progress through commits with play/pause controls; pace and speed are helper functions computing playback timing/animation speed for the scrubbing/replay animation.
- found: A transport bar component (play/pause, scrub range input, duration-preset buttons, export button/dialog, keyboard shortcuts) driving replay of a repo's commit history; requestAnimationFrame-based clock advances a fractional cursor at a rate computed from a chosen total DURATION (not a commits/sec rate) so playback time is repo-size-independent, plus pace/speed label helpers for the duration buttons.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The file has no top-level file docstring in the `docs` field returned, but the code itself carries extensive inline doc comments explaining every design decision (duration-not-rate, ref-based fractional cursor, RAF vs setInterval, stop-not-wrap, keyboard scoping) — richer documentation than most files, just not exposed as a file header.

### `pace` — QUIRKY
- spec 2 · read at `f97e230c1fec` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:51:49Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a total count, returns a human-readable pace label by bucketing the number into ranges (e.g. "slow", "steady", "fast") for display in the HistoryBar UI. Likely a simple if/else or ternary chain comparing total against threshold constants.
- found: Formats a duration in seconds as a short string: minutes rounded with 'm' suffix if >= 60 seconds, otherwise raw seconds with 's' suffix. Not actually a "pace" label like slow/fast — it's a duration formatter, likely misnamed relative to what I expected.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `speed` — QUIRKY
- spec 3 · read at `2ffb530ecac5` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:48Z · by ross@rossturk.com · warm reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes `total / STANDARD` to get the multiple, then formats it — showing one decimal place only when the value isn't a whole number (e.g. `0.3x` vs `1x`), returning a string with an `x` suffix.
- found: Computes STANDARD/total (inverted from my guess — a shorter duration means a faster/larger multiple), then formats with one decimal via toFixed if x<1, else rounds to a whole number, appending 'x'.
- predicted: some · documented: full · derivable: no · legible: full · trap: no

### `HistoryBar` — QUIRKY
- spec 3 · read at `980e3f54b4eb` · commit `38c2756` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:33:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a full-width bottom strip with a scrub/slider control over `frames` and play/pause transport controls, driven by a duration-based animation loop that advances `index` while `playing` (possibly using peers `pace`/`speed` for timing). Also shows a second row with the current commit's hash, subject, ordinal, date, and function count, and hosts/triggers an export dialog using `ensure`, `onStage`, `mode`, and `keyFor` to build a movie export.
- found: Renders the transport strip: play/pause button with rewind-on-replay-when-finished logic, a range-input scrub bar over scoped `frames`, duration-preset buttons (pace/speed), and an export button that opens ExportDialog. Playback uses a requestAnimationFrame clock driven by elapsed time (not per-tick fixed steps) with a ref-based fractional cursor to stay smooth at slow rates, plus global keyboard handling for space (toggle) and arrow keys (step, with shift for a 10-commit stride), carefully guarding against double-handling when the range input or export dialog has focus/control. No second metadata row is actually rendered — the docs describe a row that was apparently removed.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The top-level docs describe a second metadata row (hash/subject/ordinal/date/function count) that isn't present in the current code — it reads as a historical rationale for a past change, not a description of the current component.

## web/src/components/LensPane.tsx

### the file itself
- spec 3 · served in 3 parts · read at `cd5828bbec6a` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:55:40Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: This is the detail/inspector panel shown when a user selects a function or file wedge in the sunburst visualization. The main LensPane component composes a series of per-lens section components (SurpriseSection, LegibleSection, DocsSection, TrapsSection, WiringSection, LanguageSection, HistorySection, AgeSection, ChurnSection), each rendering one dimension of the score/metadata for the selected node, with shared layout primitives (Block, Ladder, NoteBox, RefRow/RefList, ExpandIcon, Absent for empty states) and utility helpers (spanOf, dirOf, useFitToPane) that format values and fit the pane's content to the available viewport space.
- found: Exactly as predicted: the LensPane component switches on the active color-mode/lens to render one of several per-lens sections (SurpriseSection, LegibleSection, DocsSection, TrapsSection, WiringSection for callers/reach/clones, LanguageSection, HistorySection splitting into blame/ChurnSection/AgeSection) for the selected node, each explaining what that lens measured, what it could not measure, and why. Shared primitives (Block, Ladder, NoteBox, RefRow/RefList, Absent, StaleNote, ExpandIcon, Touch/Edge) and layout-fitting utilities (useFitToPane, spanOf, dirOf) support them. Extremely dense inline documentation on individual functions/components explains many past UI bugs and design decisions, but there is no file-level header doc at all.
- predicted: full · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level doc comment exists at all — every one of the extensive design rationale comments is scoped to an individual component, so a reader gets no single-paragraph orientation to the file before diving into ~1500 lines.

### `LensPane` — QUIRKY
- spec 3 · read at `4374527d64b2` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:50Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is the top-level LensPane component: it renders a fixed header (name, path, counts, provenance footer) that stays static across tabs, then switches on `mode` to render exactly one of the per-lens body sections (SurpriseSection, TrapsSection, WiringSection, LanguageSection, HistorySection, AgeSection, DocsSection, LegibleSection), passing down node/repoKey/siblings/ranks/onJump/replaying as needed. It likely uses a `useFitToPane` hook for sizing and handles the "absent vs stale" distinction by delegating to those subcomponents rather than doing it inline.
- found: Handles a special "replaying" case (past-commit frames get an explicit Absent message instead of any measurement), restricts non-function containers to only 4 modes plus a legend-only 'legible' case, then switches on mode to render one of: SurpriseSection, LegibleSection, DocsSection, TrapsSection, WiringSection (for callers/reach/clones), LanguageSection, or HistorySection (for blame/churn/age).
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: I predicted a static header rendered by this function, but the header described in the docs is apparently rendered by a parent/wrapper, not inside LensPane itself — this function is purely the mode switch plus the replaying/container-exception guards.

### `Block`
- spec 3 · read at `0fa4c4027ff0` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders the shared section wrapper used by every lens section: a full-bleed top border (-mx-4, repadded with px-4) so the rule spans the whole pane width, a heading row with `label` on the left and `aside` (e.g. the grade word) right-aligned, an optional small `hint` shown near the label as a caveat/tooltip rather than repeated in the body text, and then `children` below as the section's content.
- found: Wrapper div with full-bleed top border (-mx-4/px-4) that is suppressed on the first section (`first:mt-0 first:border-t-0`) since the pane header now draws that line itself, a heading row with label (cursor-help + title=hint when a hint is given) and right-aligned aside, then children.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `Absent`
- spec 3 · read at `53b9364cb6f9` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:25:28Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A tiny presentational component that wraps its children (an explanatory sentence) in a styled "empty state" container — likely muted/italic text with some padding — used whenever a LensPane has nothing to show, so the UI always displays a reason rather than a blank area.
- found: Renders children as a small muted paragraph — a minimal empty-state text style, simpler than I imagined (no padding/container, just a styled <p>).
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Ladder`
- spec 3 · read at `00d46e962452` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:24Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders the four grade rungs (e.g. full/most/some/none) as rows, each showing its word label and its full description text (`rungs[grade]`), colored by sampling the `ramp` function at `at[grade]`. The row matching `grade` is highlighted/lit (bold, background, etc.) while the rest are dimmed; if `grade` is undefined (legend mode) all four rows are colored normally with none lit, since there's no reading to point at. `dated` presumably desaturates/greys the whole thing when the reading is stale.
- found: Matches my prediction closely: four fixed-order rows (none/some/most/full), swatch colored via heatColor(at[g], ramp), word label and rung description, matching row lit/highlighted via text color and an outline ring on the swatch. I got legend mode right (colors every swatch, highlights text on all rows) but missed the exact mechanism: swatch color for a non-legend, non-matching row is just a flat `var(--secondary)` grey rather than a dimmed/desaturated version of its ramp color, and `dated` only suppresses the ON row's color (falls back to grey) rather than greying the whole ladder as I guessed.
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
- spec 3 · read at `fcfec382eaf6` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:13Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders a list of function references (neighbours). When `code` is true, it makes one batched call (via something like `functionSources`) to fetch source for all refs at once, keyed by repoKey, rather than each row fetching its own — matching the docs. It then maps over `refs`, rendering a `RefRow` for each with its fetched source (if any), the corresponding entry from `notes` by index, and wires `onJump` through for navigation.
- found: Fetches sources in a useEffect keyed on repoKey/refs/code (with a `live` flag guard against stale async updates), but only for the first SNIPPETS refs — it caps the batched fetch and shows a 'Source shown for the first N of M' note when refs exceed that cap. Renders a RefRow per ref with its snippet, note, and onJump.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The SNIPPETS cap and its truncation message aren't mentioned in the docs, which only explain why the fetch is batched at the list level.

### `dirOf`
- spec 3 · read at `434164960692` · commit `d92c31f` · read by claude-sonnet-5 · via claude · when 2026-08-20T23:30:25Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Finds the last "/" in the path and returns the substring before it, or the empty string if there is no slash (root-level file).
- found: Exactly as predicted: lastIndexOf('/') and slice before it, empty string if no slash.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `SurpriseSection`
- spec 3 · read at `ec325e8ca272` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:10Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a section inside the node detail pane showing the "prediction test" data for this node: the reader's expected prediction, what was actually found, and whether it was flagged (e.g. surprised/predicted rating, trap). Likely uses Block/NoteBox to lay out expected vs found text, shows something when there's no prediction data (via Absent), and always renders even matching "expected X, found X" cases rather than only showing misses, per the docs.
- found: Matches my prediction well: Absent state for unread nodes, Block/Passage for expected/found, "read as expected" fallback when no note. I missed several specifics: the "warm read" badge for non-cold reads, backward-compat handling for old readings that only recorded surprised-or-not (mapped to the ends of a grade scale via `r.predicted ?? (r.surprised ? 'none' : 'full')`), staleness handling (agentStale disabling the aside/warm badge/dating the Ladder), and an entirely separate "hotspots" evidence section showing token-level probability collapse points — a whole additional feature I didn't anticipate at all.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The hotspots/probability-collapse evidence block is a distinct feature this file's docs snippet didn't hint at — worth knowing this section does double duty (grade UI + token-level evidence).

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

### `LegibleKey`
- spec 3 · read at `17700dd9bd6f` · commit `c4c6042` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:51Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A no-argument component rendering a static key: a small heading plus a list of the four legibility words (clean, nuanced, tangled, unclear), each paired with a one-line definition of what that word means (since nowhere else on screen explains them). No props, no counts, no data — purely static markup.
- found: Renders a Block with a shared Ladder component (legend mode) displaying the four legibility words/ramp, plus a caption explaining that legibility is graded per-function, not per-file.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Reuses the same Ladder component other lens keys presumably use, rather than a bespoke list — worth checking peers like a DocsSection key for the same pattern.

### `LegibleSection`
- spec 3 · read at `25f1f8bc89af` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders the Legible lens for a function: if there's no `report` (nobody has read this function) it shows an empty/placeholder state; otherwise it shows a Ladder widget for the legibility grade (full/most/some/none), a StaleNote if `stale` is true (grade predates the current code), a NoteBox with the reader's `found` prose (per the docs, not `expected`), and a LegibleKey legend explaining the grade scale.
- found: No-report case shows an Absent placeholder explaining legibility only arrives with a reading. Otherwise renders a Block with the grade word as aside, a StaleNote when stale, a separate note when the grade is `dated` (answers an old/rewritten question, no longer counts), a Ladder widget for the grade itself, a fallback note when there's no grade at all (banked before the axis existed), and a Passage showing the reader's `found` prose (never `expected`, per the docs' surprise-vs-legibility distinction).
- predicted: most · documented: some · derivable: no · legible: full · trap: no

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
- spec 3 · read at `2d15ca4a5efb` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:39Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders the node's language name plus small indicators for whether calls were parsed for that language (vs. simply unsupported) and whether the body was long enough to be eligible for copy-detection comparison, likely as colored badges or short labeled text rather than a full panel.
- found: Renders a Block with the node's language and signature, then computes three gap flags (calls not wired/parsed, too short to compare for copies, no git history) and lists only the gaps that apply as explanatory text; if there are no gaps, prints a single line saying full support for that language.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `HistorySection`
- spec 3 · read at `efdaa99844d2` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:47:42Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Fetches blame data for the given node/repoKey (shared across all three lenses), then branches on `mode` to render either a list of people (blame), a calendar-style churn view, or a timeline age view — likely delegating to ChurnSection/AgeSection peer components after computing derived data (dates, counts) needed for each, with a loading/empty state while the fetch is in flight.
- found: Fetches per-line history via functionHistory(repoKey, path, line, endLine) (0 = whole file) into state, shows loading/empty fallbacks, then for churn/age delegates to ChurnSection/AgeSection with a shared HINT string. For blame mode it renders inline: the newest touch via a shared Touch row, and (only for func nodes) an author breakdown bar list plus a 'where these lines came from' list of surviving touches — the file case only shows the last commit, since Summary already breaks files down by author elsewhere.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The docs explain the three-lens design philosophy well but don't mention the func-only author-breakdown/touches-list split or the whole-file-vs-function history scope (0 sentinel) — those are only in code comments inline.

### `useFitToPane`
- spec 3 · read at `9a96bbc47edb` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:56:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Uses useLayoutEffect to measure box's own top via getBoundingClientRect, finds the nearest scrolling ancestor to get the bottom boundary, and measures `below`'s bounding rect to reserve space beneath the box. Computes available height as scrollAncestorBottom - boxTop - belowHeight (clamped to floor) and sets it as an inline maxHeight style on box, re-running when deps changes.
- found: Returns a `cap` state value (not a direct style-setter as I predicted) computed in a useLayoutEffect: finds the scrolling ancestor by walking up parentElement checking computed overflowY, uses its bottom, subtracts box's own top and below's height and a 10px SLACK constant, clamped to floor via Math.max. Also re-runs on window resize, not just deps.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs explain the design rationale (why measure both ends) but not the mechanism (walking parentElement for overflow style, the SLACK constant, resize listener) — a maintainer still has to read the body for those.

### `AgeSection`
- spec 3 · read at `ef6b11796c44` · commit `9f5abcc` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T22:48:14Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a timeline of every commit that touched these lines (newest at top), each as a Touch row, rather than just printing oldest/newest dates as a sentence — using spanOf to summarize the span/gaps and hint for context text, passing repoKey through so each row can expand into its commit.
- found: Pins the newest and oldest commits (as Edge rows) at top/bottom of the block and puts every commit in between in its own scrollable region sized via useFitToPane, rather than one date-positioned scrolling column — so the two endpoints (the actual answer to "how old is this") always stay visible regardless of how much history is in between.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Uses history.changes (not history.touches) deliberately — changes includes rewritten-away commits, touches would understate the lifespan by only counting surviving lines.

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
- spec 3 · read at `0f5d608ba734` · commit `9f5abcc` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T22:47:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders one git commit ("touch") as a row: commit hash/short id, author/date, and message, highlighted with different styling when `bright` is true. Includes a clickable/expand element using `repoKey` to construct a link or trigger navigation into that commit's full detail (diff/context), possibly using an ExpandIcon-like affordance.
- found: Renders a single commit-touch row with a colored dot (bright/newest gets a heat-ramp color, others muted), relative time, short commit hash, a labeled line count (or "gone" if the commit's changed lines were fully superseded), an expand icon (only if repoKey is set and the commit hash looks like a real sha, not "uncommitted"), a truncated summary, and an optional "in {path}" line for renamed files. Clicking expand opens a CommitCard modal showing the full commit.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The comments explain non-obvious design decisions (why zero shows 'gone' instead of '0 lines', why paths can be stale due to rename-following) that wouldn't be derivable from the code alone.

### `ChurnSection` — TANGLED
- spec 3 · read at `c5f77030db57` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:48:26Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a scrollable, vertically-oriented GitHub-style commit calendar (weeks as rows going back to the oldest commit, weekday columns) built from `history.changes` — i.e. per-function commit dates, not the file's aggregate churn. A pinned header shows weekday letters and a legend/key plus a total count, while the grid itself scrolls through the full history so long-dormant vs. actively-churned functions are visually distinguishable rather than being compressed into a fixed 26-week window.
- found: Renders a GitHub-style vertical commit calendar from history.changes (per-function, not per-file), bucketed by local midnight into week-rows with weekday columns, colored via the shared churn heat ramp, scaled to peak day. It shows a pinned weekday key, scrolls through full history to the oldest commit with month labels and per-week commit counts, and a footer noting total commits/busiest day plus caveats for renames (origin path), a file older than the lines, and uncommitted dirty-worktree state.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: Missed several concrete mechanics: local-midnight day bucketing, empty-history early return, per-week counts drawn beside each row, and the three footer caveats (rename/older-file/dirty).

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

## web/src/components/Phases.tsx

### the file itself
- spec 3 · read at `17271bab776f` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:52:14Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Defines the three-pill UI component (Phases) showing scan/trace/read progress per project — each pill's background fills proportionally to progress and its label states the action and its cost, becoming a flat marker when nothing is left to do. Includes helpers: compact (number formatting like "106k"), seconds (duration formatting), fnv (a hash, likely for stable color/key), and phasesOf/traceOf (deriving per-phase state from raw data), feeding a single Pill sub-component that the exported Phases component renders three of.
- found: Confirmed the three-pill shape (fill=progress, verb+cost when actionable, tick+word when done) and the helper functions I predicted. Missed: the trace pill actually encodes three sub-depths (scan/blame/replay) as thirds of one bar rather than being its own simple phase; the hover-vs-idle note logic where an idle unhovered row shows a decorative seeded 'Sprig' plant instead of blank space; and the `pressed` state workaround for polling latency so a just-clicked pill shows busy before the next poll confirms it.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `compact`
- spec 3 · read at `73bcbba467b7` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:08Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Formats a number compactly for a narrow UI label. For n below 1000, returns it as-is. For thousands, uses "k" suffix — one decimal place while in the first decade (1000-9999, e.g. "5.2k"), then rounds to whole numbers above that (e.g. "12k"). Same pattern for millions with "m" suffix (e.g. "1.2m", then "12m").
- found: Formats a number with k/m suffix, one decimal in the first decade of each unit (1000-9999 and 1000000-9999999), whole number otherwise, using toFixed to round.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `fnv`
- spec 3 · read at `fdf959d81bcc` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:24Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Standard FNV-1a hash implementation — iterates chars/bytes of text, XORs each into a running hash starting at the FNV offset basis, multiplies by the FNV prime (with 32-bit overflow handled via >>> 0 or Math.imul), and returns the final numeric hash.
- found: Standard FNV-1a: offset basis 0x811c9dc5, XOR each char code then Math.imul by prime 0x01000193, returns h >>> 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `seconds`
- spec 3 · read at `958cc9bcf2f6` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:42Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Converts a seconds estimate into a short coarse human-readable duration string, rounding hard (no decimals) — likely something like "<1m", "2m", or "1h" depending on magnitude, used as a wait-time label in the phase pill.
- found: Returns "~Ns" for under 60s (rounded, min 1) or "~Nm" for 60s+ rounded to nearest minute — only two units, no hours tier.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `phasesOf`
- spec 3 · read at `e601c2f5e429` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:46:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Builds a 3-element Phase[] (scan, trace, read) from a ProjectSummary, computing each phase's state (idle/in-progress/done/blocked) and a progress fraction, distinguishing the doc-mentioned edge cases (no git history vs untraced, declined scan vs in-progress scan, stale map vs never-made map). replayBlocked likely disables/marks the read phase when tracing hasn't produced a usable map yet.
- found: Builds scan/trace/read Phase objects for the three pills. Scan phase branches on scan_cost estimate / loading (in-progress scan with stop control and progress note) / behind (needs rescan) / done. Trace delegates to traceOf. Read phase branches on actively running (with stop control, live count, fraction) / blocked because scan not done / fully done / partially done, and for partial splits remaining into unread vs stale counts rather than a naive subtraction, since stale readings are a subset of not-yet-current work that's distinct from assessed.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment on phasesOf itself is a one-paragraph rationale for the three-state distinctions; the much richer detail (wave/stopping semantics, stale-vs-unread split reasoning) lives in inline comments in the body, not in the function doc.

### `traceOf` — QUIRKY
- spec 3 · read at `62449caeb837` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:09Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Determines which of the three trace depths (log walk, blame, replay) the project is at or currently running, computes a combined progress fraction (each depth worth a third of the bar), picks a label (renaming to "Replay" for the last third) and the right action name (trace/stop-trace/replay/stop-replay), and disables/marks the pill based on `scanned` and `replayBlocked`, returning it all as a `Phase` object.
- found: Got the overall three-thirds progress combination and blocked/scanned gating right, but missed several early-return states (not-scanned, pre-run cost estimate, no-git-history) and got the "renames to Replay" behavior backwards: the code's own inline comment says that was tried and reverted — the verb stays "Trace" throughout, with the distinction pushed into the note text instead. The function-level doc I was handed (describing the rename to "Replay") is stale relative to the code's own explanation.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The docs handed to the reader (file_doc and function docs) describe the verb renaming to "Replay" on the last third, but the function body's own comment says that was tried and explicitly reverted — the outer docs are stale relative to the code.

### `Pill`
- spec 3 · read at `bdcc0de0d7c5` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:05Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders a button-shaped div with an absolutely-positioned fill block whose width is set from phase's progress fraction (rounded to a pixel column, not percentage), a label describing the phase and its cost, onClick wired to onPress (unless there's nothing left to do, in which case it renders as a non-interactive flat marker), and onMouseEnter/onMouseLeave calling onHover(true/false). When busy is true it shows some pressed/loading/disabled state.
- found: Builds a shared `body` (fill span sized by phase.fill*100%, hatched if stale, plus a label that's "done ✓" or the verb/label), then branches three ways: phase.na renders a dashed em-dash marker, phase with no verb renders a flat non-interactive span, and otherwise renders an actual disabled-while-busy button wired to onPress/onHover.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Phases` — QUIRKY
- spec 3 · read at `a9e9e3acd7f5` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:48:04Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Calls phasesOf(project, replayBlocked) to get the three Phase descriptors, then renders three Pill components in a row, each showing its fill/label/note and wired to call onAct with the phase's action when clicked (unless it's a flat done marker). The stopping prop overrides rendering to show an optimistic 'stopping' state immediately after a stop press, before the backend's own state (p.run.stopping) catches up.
- found: Renders phasesOf(project, replayBlocked) as three Pills with onAct wiring, plus: a `pressed` optimistic-busy state cleared only when a fingerprint of backend fields actually changes (not on a timer), a memoised per-project Sprig seed, and a note line under the pills that prioritizes hovered phase > running phase > a decorative idle Sprig (falling back to blank via Sprig when nothing is hovered/running).
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Missed the optimistic-press/answered-fingerprint mechanism and the hover>running>Sprig note-line priority entirely — these are the bulk of the component's actual complexity beyond the simple phasesOf→Pill mapping.

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
- spec 3 · served in 2 parts · read at `3a9b933e8f34` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:55:38Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: The modal component for starting a reading run — letting the user pick a harness/model and how many readers, with a slider (backed by `Slider`) to choose how much of the repo to read against the reading-curve data fetched via the `read_curve` command, showing an estimated token/cost via `tokensFor`, with `snap`/`approx` as small helpers to quantize the slider to sensible stopping points and format approximate numbers for display.
- found: The modal for starting a reading run: picks agent/harness (chips, falling back to a datalist/select for models the agent doesn't enumerate itself), defaults harness/model from the project's own banked/recent readings rather than local preference (so a repo already read on one scale doesn't silently drift), and offers a snapping slider bounded by a fetched reading-curve to choose how many functions to read next. It shows four live gauges (Functions, Readers, Lines, Tokens) computed from measured per-reader and per-function token constants and the curve data, warns when the chosen model differs from the corpus's banked model, and calls setReader/startCheck on submit. My prediction correctly identified the slider/cost-estimate/model-picker shape but missed the extensive logic for defaulting model/harness from corpus history, the enumerated-vs-alias model input strategy, and the four-gauge display.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

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

### the file itself
- spec 3 · served in 2 parts · read at `44123db41be7` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:10:48Z · by ross@rossturk.com · warm reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: SideBar.tsx is the project list panel — SideBar renders the scrollable list of ProjectItem rows, manages drag-to-reorder state (pointer tracking, which row is being dragged, calling reorderProjects on drop), and probably an "Add project" affordance; DropLine is a small presentational component drawing the insertion-point indicator between rows during a drag.
- found: Confirmed: SideBar renders the project list with pointer-based drag-to-reorder (calling reorderProjects on drop) and DropLine is the insertion-point indicator, as predicted. Additionally holds a right-click context menu (re-trace, remint mascot, remove from list), a failure-transcript overlay sheet, an "Add project" + button and empty-state copy, and renders a floating "ghost" copy of the dragged row that follows the pointer via a ref rather than React state for performance.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: Already read ProjectItem in an earlier task — this file task's second half was that same body, so only the SideBar/DropLine portion was new here.

### `SideBar` — QUIRKY — TANGLED
- spec 3 · read at `0f9f61e57012` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:35Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders the full-height left column — an add-project control plus a list of ProjectItem rows built from projects, highlighting the active one, wiring each row's per-project actions (select, read, forget, remint mascot, replay, trace, scan, stop-trace) to the passed-in callbacks. Likely manages drag-and-drop reordering internally (using DropLine to render an insertion indicator) and passes replayKey/replay progress down to whichever row matches, funneling row-level failures up through onError.
- found: Renders the project list column with add button, empty state, and per-row ProjectItems wired to all the passed callbacks — plus a hand-rolled pointer-events-based drag-and-drop reorder (state+ref split to avoid render lag, a ghost row following the pointer, a DropLine gap indicator), a right-click context menu (re-trace, remint mascot, forget), and a failure-transcript overlay sheet.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The prop-level JSDoc comments (documented=some) explain the callback semantics well, but the component body's biggest surprises — the custom pointer-based DnD (HTML5 DnD is broken by the Tauri webview) and the context menu/failure overlay — aren't hinted at by the signature at all.

### `DropLine` — QUIRKY
- spec 3 · read at `7cf9ac969254` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:47:17Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering a placeholder div in normal document flow (not absolutely positioned), sized to roughly the height of a project row, used as a drop-target indicator during drag-and-drop reordering in the sidebar's project list.
- found: Renders a thin (h-0.5) accent-colored rounded line with small vertical margin, aria-hidden, as an in-flow drop indicator — not a full-row-height placeholder as I guessed, just a slim line.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: I overestimated its size — it's a 2px accent line, not a row-height placeholder block.

### `ProjectItem` — QUIRKY — TANGLED
- spec 3 · read at `1f6358cc3b7b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a div (not button) acting as a row: role + tabIndex + onKeyDown for click semantics, onClick, onContextMenu, and onPointerDown wired to onGrab for drag start. Shows project name/icon, with `active` and `dragging` controlling CSS classes. The right-side slot conditionally renders: a Progress/percentage view when `replay` is non-null, action buttons (Read, Stop trace, Scan) when this row is active or hovered, otherwise a static count (e.g. file/issue count) — with `blocked` disabling or styling the trace-related control differently.
- found: Renders the row div as predicted (role=button, onClick, onContextMenu, onPointerDown=onGrab, active/dragging styling), but the right-side "slot" I predicted (inline Read/Stop/Scan buttons) is actually delegated entirely to a separate `Phases` subcomponent. The bulk of the function is a state machine deriving `running`, `winding`, `stopping`, `busy`, `reading`, `working`, `failed`, and `open` from `project.run` plus local `cancelling`/`asked` state (with effects to reset them), used to drive a bottom-edge "sweep" progress indicator, a pulsing icon, and a failure chip that opens a transcript — none of which I predicted.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

## web/src/components/Sprig.tsx

### the file itself
- spec 3 · read at `705845ca81b0` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:34Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Defines a small seeded-RNG helper (rng) and a Sprig React component that procedurally draws a decorative one-stem plant (SVG paths for stem + leaves) to fill the blank line under a project row's pills when idle. The shape is deterministic per project (seeded from something like the project id/path) so it looks different per row but stable across renders, purely decorative with no real data displayed.
- found: Mulberry32 seeded PRNG plus a Sprig component that procedurally draws a wandering stem (sum of two sine waves plus a lean) with alternating leaves (borrowing leafPath from Bloom.tsx) as an SVG filler for the blank line under an idle project row's pills, seeded per-project so it's stable across polls but different every app session.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header doc is unusually thorough (explains rejected alternatives: showing a number, keeping the rose bud, a single sine wave) so almost nothing in the body was a surprise beyond exact constants/geometry.

### `rng`
- spec 3 · read at `23eeeccc94cb` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:01Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Implements the Mulberry32 PRNG algorithm — takes a numeric seed and returns a closure that, on each call, advances internal state with the standard Mulberry32 bit-mixing steps (xor-shifts and multiplications) and returns a float in [0,1). Small self-contained generator with no external deps, deterministic per seed.
- found: Standard Mulberry32 PRNG: seeds a 32-bit state, returns a closure that mixes it with the canonical constant/xorshift/imul sequence and returns a float in [0,1) per call.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `Sprig`
- spec 3 · read at `6a67c1b8c88c` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:43Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A decorative SVG component that uses a seeded PRNG (rng) to deterministically generate a unique-looking twig with a curving stem and a handful of small leaves branching off it, so each row gets a different-but-stable sprig based on its seed (likely derived from the project key/name), filling empty space under a project row's pills when there's nothing else to show.
- found: Generates a stem as sum of two irrational-frequency sine waves plus a slight lean (to avoid looking mechanical/plotted), extending off both tile edges; then walks along it placing alternating-side leaves whose angle is derived from the stem's local tangent slope plus jitter, each leaf drawn via the shared leafPath helper.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/StaleHatch.tsx

### the file itself
- spec 2 · read at `c7b7b8e9ed73` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:10Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Defines a small React component rendering an SVG <pattern> of diagonal hatch lines, used as a fill overlay (via url(#id)) to visually mark "stale" segments (e.g. in the Sunburst chart) — old/unchanged code — distinct from color-coded surprise/heat. Likely just a <defs>/<pattern> block, minimal logic, maybe a prop for color/id.
- found: A component (not a bare <defs> block, deliberately, so the SVG pattern id is unique across mounted views) rendering a diagonal-line hatch pattern with id "stale-hatch", meant to mark wedges whose reading has "expired" (code moved) — a texture rather than a second color so it doesn't compete with the single color encoding.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `StaleHatch` — QUIRKY
- spec 3 · read at `8c149bee0240` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:42:00Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a small hidden svg containing a defs/pattern element with id "stale-hatch", drawing repeated diagonal line strokes (likely 45 degrees) at a fixed spacing using a muted/foreground CSS variable, so any wedge elsewhere can set fill={url(#stale-hatch)} to show the hatch texture.
- found: Returns a <defs> block (not a standalone svg) with TWO patterns: 'unreadable-hatch', a cross-hatch (X pattern) for wedges too large to ever be read (READ_CEILING), and 'stale-hatch', 45-degree-rotated parallel lines for readings whose code has since moved. Both use var(--foreground) at low opacity. I predicted the stale-hatch pattern correctly but missed the unreadable-hatch entirely and wrongly assumed a wrapping <svg>.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

## web/src/components/Summary.tsx

### the file itself — QUIRKY
- spec 3 · read at `06e7bfa94dbe` · commit `6cf7dc9` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:40Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: No doc header. This file renders the top-level repo overview/dashboard pane. `Summary` is the main exported component tying together `ListWindow` (a virtualized/windowed scrollable list, probably top files by some metric), `Spread` (a distribution/histogram visualization across the four lenses: surprise/docs/churn/legibility), `Buckets` (bucketed counts, maybe grade tiers), and `rowNote` (a small helper formatting text for a list row, e.g. showing a stat or hint next to a file name).
- found: The default detail panel shown when nothing is selected: a manually-windowed (not virtualized-library) list of readings, a Spread bar/key for grade breakdown under the Surprise lens, a Buckets bar/key for other lenses (authors, languages, age, etc.), and rowNote supplying per-row trailing text tailored to each lens so it never repeats the bucket heading. Extensive design-rationale comments throughout explain UX iteration history (removed dial row, removed notes list, performance fix for 32k DOM nodes, etc).
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file header at all — the per-function doc comments are where all the real design rationale lives, so grading documentation requires reading the whole file rather than a top summary.

### `rowNote` — QUIRKY
- spec 3 · read at `5d7fd33f7e0c` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:05Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Switches on mode: for 'age' it formats the node's timestamp as a short relative string like "5d ago"; for 'churn' it formats commit count over a window like "11 in 90d". For all other (categorical) modes — author, language, grade, trap — it falls through to a default that returns the node's line count (LINES), e.g. "119 lines", since those columns are otherwise pure repetition of the bucket heading.
- found: Switches on mode across six branches (age, churn, callers, clones, reach, default). Age formats a relative day string. Churn prints commit count as "N commit(s)" or em dash, guarded on ageDays (not commits) to distinguish "no history" from "no commits in window" — explained by a lengthy in-code comment recounting a prior review dispute. Callers/reach are complementary: each prints the OTHER direction's count when its own is zero, to distinguish a dead leaf/stub from a hub nothing enters. Clones prints "1 of N" or "unique". Default falls back to line count.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The docs handed at sanity_next only cover the general bands-vs-categories design rationale; the callers/clones/reach branches and the churn ageDays-vs-commits guard are explained entirely by inline comments not visible until reveal.

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

### `Summary` — TANGLED
- spec 3 · read at `5e00f1fed83f` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:38Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: This renders the "nothing selected" panel: a header (title, path breadcrumbs, `about` markdown) followed by stat rows computed from the `node` subtree — counts of functions/readings/expiries under Blame vs surprise-map mode — plus a category breakdown (`Buckets`), an age distribution (`Spread`), and a scrollable list of notable functions (`ListWindow`) that can be clicked via `onSelect`/`onDrill`, ending in the `footer`.
- found: Computes summarize(node) and mode-dependent buckets, with two independently-remembered picks (a reading grade, a bucket key) that default to the hottest/biggest non-empty option; renders header/counts/about, then either a Buckets breakdown (non-surprise modes) or a Spread-by-grade breakdown (surprise mode), then a virtualized ListWindow of the selected grade/bucket's functions that both selects and drills on click, ending with a pinned footer.
- predicted: most · documented: most · derivable: no · legible: some · trap: no

## web/src/components/Sunburst.tsx

### the file itself
- spec 3 · served in 4 parts · read at `dc0c2b5af025` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:36Z · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: This file's whole responsibility is the sunburst chart itself: essentially just SunburstView (the giant component I already read, ~1800 lines) plus a small heatShare helper that decides how strongly a wedge's color reads for a given mode/kind. No file-level doc header, likely because the file is dominated by one component whose extensive inline comments already carry the design rationale that a header would otherwise state — the file has no separate "shape" beyond that one component.
- found: A single-purpose file: a large block of tuned layout/animation constants (with extensive inline rationale comments), the SunburstView component itself, the small heatShare helper, and finally the file's only truly new element — exporting `Sunburst = memo(SunburstView)`, memoized specifically so that unrelated App-level state changes (like opening a dialog) don't force a full re-render of thousands of arcs.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: The file has no header doc at all — confirmed as the finding the task description hinted at — and its only content not already visible from the SunburstView function itself is the top-of-file tuning constants and the closing memo() export with its rationale about the Read-button perf regression.

### `heatShare`
- spec 2 · read at `735127f33e96` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:47Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a damping multiplier (0-1) for how strongly a ring's color should read, based on kind (e.g. 'dir' vs 'file'/'func') and mode. Returns 1 (no damping) for every mode except 'surprise', where directory-kind nodes get some reduced value since their color there is only a rolled-up "hot share" rather than a direct measurement, while under all other modes (churn, age, blame, lang) it always returns 1 since those aggregates are legitimate readings of the same quantity.
- found: Under 'surprise' mode, looks up a per-kind damping value from a HEAT_BY_KIND table (defaulting to 1 if kind isn't in it); under every other mode it always returns 1 (no damping).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `SunburstView` — QUIRKY — TANGLED
- spec 3 · served in 4 parts · read at `9dcdcf65812e` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:50Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A large React component that renders the sunburst chart itself: it lays out the tree into rings/wedges (likely via canvas, given pixel-density thresholds like MIN_ARC_PX/MIN_PATCH_PX), colors wedges according to `mode` and `ranks`/`ageSpan`, handles click-to-select/drill and hover interactions, animates wedge transitions when `morph` is on, hatches unread wedges when `replaying`, pulses wedges present in `reading`, draws the mascot creature in the center hub with a go-up affordance when `onUp` is provided, and reports its measured pane size via `onSide`. It's likely structured as a canvas draw loop plus pointer-event handlers, given the amount of low-level layout math implied by the density/sortBy props.
- found: A massive SVG-based sunburst renderer: computes wedge layout/geometry per frame (level-change keyframe animation plus continuous morph-chase for replay), colors wedges by mode/ranks/ageSpan, draws directory rim bands, tiles functions inside file wedges with roll-up dot textures, hatches stale/unread/not-yet-read functions, pulses wedges being actively read or touched by a replay commit (escalating to the nearest drawn ancestor), fits/animates the viewBox to content, draws labels along arcs, renders a selection mask+outline and hover outline, positions a WebGL mascot canvas over the hub with gaze aimed at active work, handles click/drill/select/fold/unfold interactions, and shows a footer note of folded/hidden wedges.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: This is ~1800 lines of interleaved layout math, animation state machines (level-change keyframe, morph chase, file open/close), and rendering — far beyond what the prop docs alone convey; it's SVG throughout, not canvas, despite the pixel-density framing in the props.

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

### `WedgeTip` — QUIRKY — TANGLED
- spec 3 · read at `75d13a3c3553` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:41:01Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A tooltip/card component for a treemap-style visualization of a git repo. It positions itself near the pointer (x,y) within the container box, flipping to the other side when close to an edge so it stays on-screen. It renders the node's name/path, a color swatch reflecting its "reading" (using mode and ageSpan to compute a color), with special-cased text for never-read ("not measured yet") and stale/expired readings (shown via hover), and possibly shows rank (from `ranks`) and folded state.
- found: Renders a positioned tooltip card that flips across the pointer near the pane edges (using W/H estimates). Computes a color/reading via colorFor and shows it as a swatch with special-cased text for unread ('not measured yet'), too-large-to-read, and stale/expired ('stale', hatched, with a 'changed since last reading' note) states, gated per-lens by whether the mode is reading-based. Displays a function's name+line separately from its path (to avoid burying the name in a truncated path), shows loc/file/rest counts, mode-specific extras (commits/first-seen for churn, last-touched/first-seen for age), and directory-specific fold/drill-in hints.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: The doc describes the shared tooltip-card contract and rationale (swatch not number, never-read vs stale distinction) but says nothing about the extensive per-kind rendering (func name/line, dir fold hints, mode-specific extras) that makes up most of the body.

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
- spec 3 · served in 3 parts · read at `9e690c7db252` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:16Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: The frontend's single API/bridge layer to the Tauri Rust backend — wrapping invoke() calls for project lifecycle (list/select/pick/reorder/forget), scanning/reading/tracing source, and report/history retrieval, plus event listeners for backend-pushed events (scan progress, theme, install). It probably also bundles pure display-derivation helpers (heat/color ramps, legibility/trap grading, summarizing reports) that don't need a backend round-trip, grown into the same file as a catch-all since there's no header describing a narrower scope.
- found: It is the frontend's bridge to the Tauri backend (invoke wrappers for project lifecycle, scanning, tracing, history, reports) plus event listeners, exactly as predicted — but the bulk of the file's weight is actually large wire-format type definitions (Node, Score, ProjectSummary, WireNode, etc. with extensive per-field doc comments) and tree-aggregation logic (reaggregate, applyScores, applyAgentReports, summarize, countPending) that keep the sunburst map's colors/roll-ups consistent with the Rust backend's own aggregation math — a much bigger and more central concern than the "catch-all of misc helpers" framing I predicted.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file header exists, but nearly every export has a rich doc comment — this file rewards per-function reading far more than a top-level skim.

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

### `unreadable`
- spec 3 · read at `85c6bf1ef9a7` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:58:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns false if node.bytes is null (unknown size treated as readable), otherwise compares bytes against a fixed size threshold constant and returns true if it exceeds that threshold, meaning the content is too large to display/read in the UI.
- found: Returns node.bytes !== null && node.bytes > READ_CEILING — null bytes (unknown) is treated as readable, and bytes beyond a fixed ceiling constant is treated as unreadable.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `toNode`
- spec 3 · read at `0af79c5f8dfe` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:41:58Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: `toNode` converts the wire format (`WireNode`, raw JSON from the Tauri backend) into the frontend `Node` shape used throughout the UI — mapping matching fields across, filling in defaults for any optional/missing wire fields (similar to the `dirNode` factory), and recursively mapping `children` through `toNode` as well.
- found: Maps a WireNode (snake_case backend JSON) to the frontend Node (camelCase), converting the nested score object field-by-field, defaulting most fields to null (not 0/false) when absent — a comment explains this distinguishes "backend never analyzed this" from "analyzed and found zero" for the call-graph/clone fields — and recursively mapping children through toNode.
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

### `stopScan`
- spec 3 · read at `460200c485de` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:25Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin frontend wrapper that invokes a Tauri command (e.g. invoke("stop_scan")) to signal the backend to stop the running scan, with no arguments, returning a promise that resolves once the command completes.
- found: Calls invoke('stop_scan') with no args, returning the Promise<void>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `stopCheck`
- spec 3 · read at `8ff5e7dff082` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:28Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin IPC wrapper calling Tauri's invoke('stop_check', { key }) (or similarly named backend command) to tell the Rust backend to halt an in-progress agent "check"/read run for the given project key, returning a promise that resolves when the backend acknowledges.
- found: Exactly as predicted: a one-line Tauri invoke wrapper calling the 'stop_check' backend command with the project key.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `readable`
- spec 2 · read at `d8ec7b19b2c0` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:18Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Takes a ProjectSummary and returns a single number representing total readable units — summing something like p.functions + p.files (or their respective counts), consolidating the "total to read" calculation so it isn't duplicated across call sites.
- found: Returns p.functions + p.files, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `stopTrace`
- spec 3 · read at `f040b070dc9b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:43Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin frontend wrapper invoking the Tauri stop_trace command with the repo path, awaiting the result and returning the boolean indicating whether the running trace was successfully stopped.
- found: Exactly as predicted: a thin wrapper calling invoke('stop_trace', { path }) and returning the Promise<boolean>.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `estimateTrace`
- spec 3 · read at `b7fd2560710b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:47Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper that calls Tauri's invoke("estimate_trace", { path }) and returns the resulting TraceCost promise, mirroring the Rust `estimate` function.
- found: Thin Tauri invoke wrapper: invoke('estimate_trace', { path }) returning Promise<TraceCost>.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `explainTrace`
- spec 3 · read at `a77324d6dcda` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:48Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin frontend wrapper that invokes the Tauri backend command "explain_trace" and returns the resulting boolean promise, mirroring the Rust explain_trace function.
- found: Exactly as predicted: a one-line invoke() wrapper calling the 'explain_trace' Tauri command.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `setExplainTrace`
- spec 3 · read at `3baa2870cb8b` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:51:52Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Thin Tauri IPC wrapper: calls invoke("set_explain_trace", { explain }) and returns the resulting promise, toggling a backend flag controlling whether explain/trace output is produced by subsequent calls.
- found: Thin Tauri IPC wrapper: invoke('set_explain_trace', { explain }).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

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

### `functionHistory`
- spec 3 · read at `f020bba0f71f` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:37Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (e.g. "function_history") with path, start, and end line numbers (and key for caching/identification), awaiting the result and returning it as a LineHistory, or catching an error and returning null.
- found: Invokes the Tauri 'function_history' command with key/path/start/end, and maps the snake_case `file_first` field to camelCase `fileFirst` on the returned object (or passes through null); no try/catch, so errors propagate rather than being swallowed.
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
- spec 3 · read at `5525a4eb829b` · commit `1edee41` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:07:07Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns r?.legible, but first checks whether the report is stale (e.g. via isReportStale or comparing a version/ask field) — if the grading question has since changed, it returns undefined instead of the stored value so stale grades don't get treated as current.
- found: Guards against a dated (stale) legible grade by checking the r.legibleDated flag directly rather than calling a separate staleness helper, returning undefined in that case, otherwise the stored grade.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 3 · read at `de7f8b1d7f86` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:51Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Converts a wire-format scan object (WireScan, from the Rust backend, likely snake_case) into the frontend's Scan type, mapping/renaming fields such as the root node tree, stats, and links into the camelCase shape the UI expects, probably delegating to a node-conversion helper for the tree.
- found: Converts WireScan to Scan: root via toNode(w.root), stats fields renamed snake_case to camelCase with a couple of nullish-coalescing defaults (commits, authors). No links field present here.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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

### `reaggregate` — QUIRKY — TANGLED
- spec 3 · read at `87d57d561a21` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:02:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a node and its already-aggregated children, and recomputes the node's own rollup fields (score, counts of assessed/pending/surprised, etc.) as a weighted combination of the children's values, mirroring whatever arithmetic Node::aggregate does in the Rust model. Returns a new Node object (or mutates and returns the same one) with those fields updated, likely handling the leaf case (no children) by using the node's own data instead.
- found: LOC-weighted average of children's surprise/documented/churn scores; age uses max of children ages, lastTouched uses min; analyzed/hot shares computed differently for func vs directory children; source is upgraded to the strongest instrument seen ('agent' > 'model' > 'proxy'); commits/allCommits are deliberately NOT recomputed (carried from existing node score) since directory commit counts can't be summed from children without double-counting.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: The comments call out two prior bugs (lastTouchedDays hardcoded null, source hardcoded proxy) that this function fixed — worth knowing before 'simplifying' those lines away again.

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
- spec 3 · served in 3 parts · read at `ac346544f31c` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:20:04Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: The core color-mode logic backing the sunburst: given a node and a ColorMode, computes the actual paint color (`colorFor`), covering all the lenses — surprise/legibility/docs/traps (from readings), blame/age/churn/language (from git/wiring), callers/reach/clones (from the call graph). It includes banding/ramp helpers (bandOf, rampOf, ageRamp, slotColor for categorical palettes), doc-coverage math (opaqueShare/docGrade/undocShare/saysNothing), replay-specific flash/notes for what a historical frame can and cannot paint (replayNote, flash/flashPaint), and legend support (rankCategories/legendFor/bucketsFor) plus classifiers (paintsFromReadings/paintsFromWiring) used elsewhere to lock lenses that have nothing to show.
- found: Matches prediction closely: `colorFor` is the central per-node, per-mode color+label function covering all eleven lenses (with replay-flash priority for birth/touch events overriding the lens), backed by banding tables (caller/reach/churn/age/clone bands), a 64-slot categorical palette for blame/language, doc/legibility share roll-ups for containers, an age ramp normalized to the repo's own span, plus `bucketsFor`/`legendFor`/`rankCategories` for the panel breakdown and legend, and `paintsFromReadings`/`paintsFromWiring`/`saysNothing`/`REPLAY` classifiers used to lock/grey lenses elsewhere.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `replayNote`
- spec 3 · read at `e4a707db5280` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:31Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a ColorMode and returns a short explanatory string only for the mode representing "replay" (or when the mode is derived from a parse rather than a reading), explaining why colors are unavailable — something like "recomputed per commit" — and returns null for all other modes.
- found: Returns null if REPLAY[mode] is 'live' (meaning the mode replays fine), otherwise returns a message using MODE_LABEL saying the mode isn't replayed because it would need recomputation at every commit and the timeline doesn't carry it.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The historical reasoning in the docstring (why it went from two sentences to one, shard folding) isn't visible in the code — it's institutional memory only preserved in the comment.

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

### `bandOf`
- spec 3 · read at `01d8530090da` · commit `758c706` · read by claude-sonnet-5 · via claude · when 2026-08-23T05:04:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns bands.find(b => n >= b.min), relying on bands being sorted descending by min so the first band whose threshold n meets or exceeds is the correct (highest applicable) one. No fallback/default handling since docs say it's never called with an unresolved value.
- found: Returns the first band whose min the value n meets or exceeds (relying on descending sort order), falling back to the last band in the array if none match.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I missed the fallback-to-last-band clause (?? bands[bands.length - 1]), which the docs don't call out either.

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

### `rampOf`
- spec 3 · read at `ca6fc72b20a5` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:27Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A lookup/switch that maps a ColorMode value (e.g. 'age', 'author', 'calls') to the corresponding Ramp object/function used elsewhere for coloring, so legend swatches use the same ramp as the actual wedges/nodes for that mode.
- found: A simple mapping from ColorMode to Ramp: churn/age/legible/docs map to same-named ramps, everything else (e.g. author/calls modes) falls back to 'heat' as a default ramp.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

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
- spec 3 · read at `912acc916ed1` · commit `1edee41` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-21T07:07:09Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Pulls the reader's report for node n (if any); if derivable is true, forces the result to "none" regardless of the raw documented field; otherwise returns the raw documented grade; returns undefined if there's no report at all.
- found: Returns undefined if there's no agent report or if it's marked stale; otherwise returns 'none' if derivable is true, else the raw documented grade.
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

### `colorFor` — QUIRKY — TANGLED
- spec 3 · read at `b0e8e3f11525` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:26Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A big switch/dispatch over ColorMode values, each branch calling the matching helper (paintsFromReadings, paintsFromWiring, ageRamp+ageSpanOf, docGrade/undocShare, calledShare/reachingShare, isAuthor, flashPaint) to compute a color + label string for the node. Returns null when the relevant data for that mode is missing, rather than a fallback color.
- found: Dispatches on ColorMode, but first gates everything on replay/history provenance: a wedge that just appeared or was edited in the frame under the playhead flashes (birth/touch) regardless of mode, and non-live modes return null in replay otherwise. Each mode branch (surprise, legible, docs, traps, callers, reach, clones, churn, age, blame/lang) then computes either a share-based ramp for containers or a per-node value/band, with mode-specific label text and several deliberate asymmetries (e.g. docs ramp is linear not shareRamp, clones never roll up, traps are boolean not ramped, blame falls back to an 'uncommitted lines' state).
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

### `rankCategories`
- spec 2 · read at `3520bac67344` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree from root, groups nodes by category (as determined by mode), sums lines per category, sorts categories descending by total line count, and returns a Map from category name to its rank/slot index (0 = biggest category).
- found: It just delegates entirely to legendFor(root, mode), taking the ordered legend names and building a name→index map from their order. All actual grouping/sorting logic lives in legendFor, not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment describes the overall purpose well but doesn't reveal that this is a thin wrapper around legendFor.

### `bucketsFor` — TANGLED
- spec 3 · read at `61d2966b2013` · commit `be4f3be` · read by claude-sonnet-5 · via claude · when 2026-08-21T07:03:23Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks the subtree under `root` once, collecting every function not excluded by .sanityignore, and groups them into buckets according to the current `mode`: fixed bands for ramped/quantitative modes (age, churn, etc.) or discrete categories for others (author, language, grade, trap...). Each bucket's color is derived the same way `colorFor` colors a wedge — for ramped modes via heatColor at the mean of the bucket's members' ramp inputs, otherwise via whatever categorical color colorFor would assign — rather than an independently invented palette, and anything the mode can't color at all is grouped into a final neutral "unset" bucket so counts still sum to the total. Returns the resulting Bucket[] with counts and colors for the legend.
- found: Recursively walks the tree once, routing files as their own rows for blame/language/docs modes (a file stands in for its functions before they're graded) and functions as rows for every other mode, bucketing into per-mode bands/categories with a shared UNKNOWN sentinel key for absence. After the walk, ramped-mode bucket colors are set to heatColor at the mean of collected ramp values. Finally sorts buckets in a per-mode direction (biggest-first, worst/best-first, band order, reversed for paired lenses like callers/reach) and always pushes the UNKNOWN bucket to the end regardless of that sort.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: Missed entirely: files get their own bucket rows in blame/language/docs modes (not just functions), the surprise mode short-circuits to an empty array, and the extensive per-mode sort-order logic at the end — none of that was guessable from the signature/summary docs alone.

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

### the file itself
- spec 3 · served in 2 parts · read at `6d8da81cfe13` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T08:09:11Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file implements the frontend "history replay" engine — pulling commit-history scan data from the Rust backend (scanHistory, traceProject, warmHistory, onHistoryProgress) and then stepping through it frame-by-frame (enter/leave/advance/replay/census) to reconstruct tree state (open directories, sizes, positions) at each point in time so the sunburst can animate through a repo's history. Helper functions (insertSorted/removeSorted/daysBetween/aggregate/collapse/dirNode/frameTree/scopeOf/pathIndexOf/posOf/realOf) maintain sorted timelines and map between logical scope and tree positions during replay.
- found: A commit-by-commit replay engine for the sunburst's History mode. Backend calls (scanHistory/traceProject/warmHistory/onHistoryProgress) fetch/refresh a stored timeline; `opening`/`advance`/`replay` fold commit deltas into a mutable `Frame` (live lines, churn window, birth/touch timestamps, per-function author, packed grade readings) with a forward-only memo since folding is linear in history length; `enter`/`leave`/`census` track container (file/dir) presence so a container's \"birth\" flash fires only on its own 0→1 transition, never rolled up from children. `frameTree` builds a fresh Node tree per frame (pooling function nodes, not containers, to avoid GC pressure and to let the sunburst layout react to identity changes), applying a level-of-detail cutoff (`minLoc`, scaled by density and scope) that rolls thin functions into a synthetic `#/folded` stand-in per file so large repos don't try to render tens of thousands of wedges 30x/second. `aggregate` rolls loc/churn/age/reading-coverage up containers LOD-weighted; `collapse` merges single-child directory chains to match the live scan's shape.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The docs are unusually rich — most functions carry a paragraph of "why", including specific war-story numbers (ceph's 94k functions, a 26ms fold at commit 983, a React duplicate-key ghost-wedge bug) that no static analysis of the code could regenerate.

### `scanHistory`
- spec 3 · read at `5cb544ec5c94` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T00:48:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (e.g. "scan_history") passing path, trace, fresh, and limit, awaits the result, and returns it as a TraceResult — trace=false does a cheap read of already-walked commits while trace=true triggers the expensive walk of unwalked commits.
- found: Thin Tauri invoke wrapper calling the 'scan_history' backend command with path, limit, trace, fresh, returning the TraceResult promise directly.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `traceProject`
- spec 3 · read at `1a442f471908` · commit `03fa9fd` · read by claude-sonnet-5 · when 2026-08-26T17:47:29Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Thin frontend wrapper that POSTs to the backend's /trace endpoint (same one the CLI `trace` command hits) with the project path and optional depth ('files' or 'lines'), awaits the JSON response, and resolves with the `seconds` field from the result so the app can compare actual cost to its own estimate.
- found: A one-line wrapper around Tauri's `invoke('trace_project', { path, depth })`, resolving to the seconds elapsed as reported by the backend Rust command — it's an IPC call to the app's own Tauri backend, not an HTTP fetch to a separate server process.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: This is the Tauri desktop-app path (invoke), a separate call surface from the HTTP /trace endpoint the CLI uses — worth knowing there are two client entry points into tracing.

### `warmHistory`
- spec 3 · read at `ff9955356789` · commit `15a4bd8` · read by claude-sonnet-5 · via claude · when 2026-08-26T07:39:20Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A thin 3-line wrapper that invokes a Tauri backend command to pre-warm/cache git history data for the given project path, returning a boolean indicating whether history is available/was warmed successfully.
- found: Thin wrapper invoking the Tauri 'warm_history' command with the path, returning its boolean result.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

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

### `opening`
- spec 3 · read at `073852a1d2b6` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:53Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds the initial Frame from `hist`'s base/truncated data (paths+langs that existed before the tracked commit window began), constructing the tree structure (likely via census/aggregate/dirNode helpers) with no per-commit scores or readings applied yet, since no frame/commit has been replayed. This is what's shown at position -1, before the first commit's effects land.
- found: Builds an empty Frame at at:-1, ts:baseTs, seeds `graded` from hist.baseRead (pre-window readings, shown as-is), and for each base path sets its loc/lines/order and calls census to count it and its ancestors — deliberately without marking anything touched/born, so undated pre-window code draws uncolored rather than falsely dated to the window start.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: I predicted the census/tree-building shape correctly but didn't anticipate that baseRead grades are carried through unmodified while birth/touch dates are deliberately withheld — a distinction the field docs don't spell out.

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

### `advance` — QUIRKY — TANGLED
- spec 3 · read at `9f50af0c70f2` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:23Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Iterates commits strictly after frame.at up to and including `to`, applying each commit's deltas to mutate `hist` tables in place (e.g., insert/remove entries from indices), then sets frame.at = to to track the new position.
- found: Mutates frame in place by walking commits (frame.at, to]: for each commit's `set` entries it updates per-function loc/touched/author/editedAt maps, detects arrivals (not previously in frame.loc) to insert into sorted order, record birth, call `enter` for directory census, and track churn hit timestamps (capped at CHURN_MEMORY); for `del` entries it calls `leave`, removes from sorted order, and deletes all per-function tracking maps; also applies read/unread grading changes and per-file author updates; finally clamps frame.at to hist.commits-1 and updates frame.ts from the deltas.
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

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

### `gradeAt`
- spec 3 · read at `770cd81e8c0d` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Extracts a small integer field from a bit-packed number at the given shift (e.g. (packed >> shift) & mask), then maps that value to a Grade via lookup array, returning undefined if the extracted value is 0 or otherwise indicates no grade.
- found: Shifts packed right by shift, masks with 7 (3 bits), and indexes into GRADES array; returns undefined if out of range.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `readingInto`
- spec 3 · read at `ee59904f8a7b` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:40Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Unpacks the two-byte `packed` integer into an AgentReport-shaped object by extracting bitfields (predicted, documented, legible, trap) via shifts/masks, writing them into `into` if non-null (reusing it for pooling) or creating a new object otherwise, and setting the "dated" flags to false since packing already resolved superseded axes. Returns the populated object.
- found: Unpacks `packed` bitfields into an AgentReport via gradeAt() calls for predicted/documented/legible and a direct bit test for trap, reusing `into` if given (setting legibleDated/trapDated false only on fresh creation) or allocating a new object with those dated flags false.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `scoreInto` — QUIRKY — TRAP
- spec 3 · read at `3ac5169d04f5` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:07Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Builds/reuses `into` as a Score for function f at a given replay frame: computes churn/age/lastTouchedDays from frame data relative to `since`, decodes `packed` (a bit-packed churn+age value) into those fields, sets provenance: 'history' plus appeared/edited flags, and leaves surprise-related fields at 0 defaults since replay frames carry no static-analysis readings.
- found: Churn/age/lastTouchedDays come from frame's touched/bornAt/hits maps relative to `frame.ts`, not from `packed`. `packed` (when defined) is decoded via gradeAt at offsets 0 and 3 to get real surprise/documented grades and sets analyzedShare/source to 'agent'; only when packed is undefined do surprise/documented/analyzedShare fall back to 0/proxy. appeared/edited are written every call (even to null) because Score objects are pooled/reused across frames.
- predicted: some · documented: some · derivable: no · legible: most · trap: yes
- note: Score objects are pooled and reused frame-to-frame; every field must be written unconditionally (even to null) or it silently carries the previous function's value — an easy trap for anyone adding a new field to Score without writing it here.

### `aggregate` — QUIRKY — TANGLED
- spec 3 · read at `735a6764644d` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:08Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recursively aggregates over a node's children (for a directory), summing their LOC into the node, and rolling up dates: taking the oldest child's "appeared" date as the node's age and the newest child's last-touched date as the node's last-touched. It mutates node in place, using appearedOf(id) to resolve when a given child id first appeared in history, and it's LOC-weighted so bigger children have proportionally more influence on some averaged property.
- found: Recurses into children, sums loc, rolls up birthBelow/touchBelow flags, LOC-weights churn/hotShare/analyzedShare, takes max ageDays and min lastTouchedDays across children, and separately computes `appeared` directly via appearedOf(node.id) rather than rolling it up (while `edited` is always null for containers), building the node's score object.
- predicted: some · documented: some · derivable: no · legible: some · trap: no

### `collapse`
- spec 2 · read at `d28aae3d52ae` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:25Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a Node tree; for any directory node that has exactly one child and that child is itself a directory, merges them into a single node (combining names/paths with a separator) and continues collapsing down the chain, then recurses into the (now collapsed) children to do the same at deeper levels. Returns the transformed node, mirroring the Rust-side collapse_chains logic so the JS-side history replay tree matches the shape the initial scan produced.
- found: Recurses into children first (map collapse), then if this node is a single-dir-child directory, returns the child's node spread with the name joined as "parent/child" — effectively promoting the child up and discarding the parent's other fields (children, etc. come from `only`).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected a while-loop that flattens an entire chain in one node before recursing; actual code relies on the post-order recursion itself to naturally chain-collapse one level per call.

### `dirNode` — QUIRKY
- spec 3 · read at `af5ab22752da` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:54:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns a new Node object representing a directory entry in a file-tree structure, given its full path and its own name. Likely initializes fields such as an empty children collection, a flag marking it as a directory, and default size/count accumulators to be filled in as the tree is built up (used alongside insertSorted/removeSorted and other tree-building peers).
- found: Builds a Node literal for a directory: sets id/name/path/kind='dir', and explicitly nulls out the large set of file-analysis fields shared with file nodes (callers, calls, incident, away, resolvable, orphans, sinks, cloneGroup/cloneSize, comparable, copied, loc=0, line, endLine, bytes, lang, lastAuthor, doc, signature, owner, score, body), plus initializes hotspots=[], children=[], funcs=0.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: Node is one big shared shape for both files and dirs — most fields are meaningless/null for a dir; a reader predicting from the name alone won't guess how many analysis-specific fields exist.

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

### `frameTree` — TANGLED — TRAP
- spec 3 · read at `89e9de8e2b26` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:45Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Builds a fresh Node tree for one replay frame at `index` (comparing against `since` for flash detection), rooted at `scope`. Walks the directory/file structure from hist/deltas, creates func nodes via scoreInto/readingInto, applies a minLoc roll-up threshold (lines/4000, scaled quadratically by density) to collapse small functions/files into "N+" nodes, aggregates container stats bottom-up (aggregate/collapse), and returns the root Node.
- found: Confirmed the general shape (frame replay, dir/file/func node building, minLoc roll-up scaled by density², scoreInto per func, aggregate+collapse). Missed: node pooling keyed to hist, a scope-relative threshold (scopeMin) when drilled, and the roll-up mechanism itself — functions below minLoc are folded per-file into a single '#/folded' stand-in node carrying only rest-count/lines and a flash-only score (birth/edit), deliberately never named '#/rest' to avoid an id collision with tileFunctions's own layout-level roll-up.
- predicted: most · documented: some · derivable: no · legible: some · trap: yes
- note: The '#/folded' vs '#/rest' id distinction is load-bearing (avoids a React duplicate-key bug documented inline) — anyone adding another synthetic roll-up node must pick an id namespace no real key_of or tileFunctions id can ever produce.

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
- spec 3 · read at `764d29607998` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:47Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: This converts both `hex` and `ground` to linear-light RGB channels (via `srgb`), alpha-composites each channel (`hex*alpha + ground*(1-alpha)`), and then computes the luminance of the resulting composited color (via `luminance`) — doing the blend in linear space per-channel rather than averaging the two luminances directly.
- found: Converts hex and ground to linear sRGB channels, composites each channel with alpha, and sums the channels weighted by the Rec.709 luminance coefficients (0.2126, 0.7152, 0.0722) to get the resulting luminance.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

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
- spec 3 · read at `8a2b8a484244` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:48Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Determines whether the cell is wider-than-deep or deeper-than-wide to pick a preferred axis (arc vs radial), then tries the full name on that axis, falling back to the full name on the other axis, then middle-truncated versions on each axis in the same preference order, returning the first Placement that fits (with orientation, text, and position) or null if nothing fits even truncated.
- found: Computes max size along arc and radial axes (with centering math for radial), picks the shape's preferred axis (arc unless the outer arc is shorter than depth), tries the full name on the preferred axis then the other, and if neither fits at MIN_SIZE, middle-truncates progressively on the preferred axis until something fits or gives up (returns null).
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
- spec 3 · served in 2 parts · read at `d862f458162f` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:59Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Implements the export-to-movie pipeline for HistoryBar/ExportDialog: a Shot class draws one frame of the replay onto an offscreen canvas (map/wedges, caption, legend, timeline, signature/watermark), reading CSS custom-property colors via varCss/ink/faceCss/background so the recording matches the live theme. Surrounding functions (settings, preflight, probe, record, encoded, base64) drive a MediaRecorder-style capture loop: checking codec/capability support, stepping through frames, recording them, producing a base64-encoded video blob for download.
- found: Confirmed the core architecture: Shot rasterizes the live SVG per commit onto a base canvas (caption/legend/timeline/signature drawn in Canvas2D reading resolved CSS custom properties), then composites the WebGL mascot creature per output frame, and record() drives the frame loop, calling ensure/setIndex/settle to advance the app's own state before rastering. Missed the actual encoding stack: not MediaRecorder but the mediabunny library using WebCodecs directly, with an explicit preflight/probe step that tries H.264 then H.265 by actually encoding 10 blank frames (since canEncodeVideo lies), a within() timeout wrapper around every awaited step to detect encoder/decoder hangs, and detailed five-stage (fetch/fold/raster/draw/encode) progress/cost reporting. base64/encoded() is indeed for handing the finished MP4 bytes to Rust.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

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

### `draw` — QUIRKY
- spec 3 · read at `a53a123488df` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:19:03Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Stores the given Playhead as this.at, then rebuilds the whole static frame onto the base canvas from scratch: clears/draws the background, renders the sunburst map at the current commit state, draws the caption, column, legend and signature, and calls this.timeline() to draw the scrub bar. It's async because it likely awaits loading an image/icon (creature) or some other asynchronous resource before compositing.
- found: Rasterizes the live SVG map by cloning it, sizing/styling the clone for export, serializing to a blob URL, and loading it as an Image with a decode() call raced against a timeout (worked around a WebKit bug where decode() can hang forever); once decoded, draws background + the map image onto the base canvas, then calls caption/timeline/legend/signature to composite the rest of the frame, revoking the blob URL in a finally block.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

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
- spec 3 · read at `1b97535cae9d` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:09Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A private method on the `Shot` class that draws a text caption (likely the repo/slug/scope name, and possibly the current date) onto the canvas at a fixed position using ctx.fillText, styled via CSS variables (see `varCss`/`faceCss` peers) — probably the title/header area of the exported movie frame, separate from `signature` and `timeline` which draw other overlay elements.
- found: Draws the title block onto the canvas: splits `this.title` into owner/name, computes available room via `column()`, and dynamically shrinks font size to fit either an inline "owner name" layout or falls back to a stacked layout with owner above name — never eliding text, only shrinking it (with a hard floor). Also draws an optional scope (drilled path) line beneath the name, sized independently, and records the resulting bounding box in `this.rule` for later use (presumably by `timeline`/`signature`).
- predicted: some · documented: none · derivable: yes · legible: some · trap: no

### `legend` — QUIRKY — TANGLED
- spec 3 · read at `08de76ed109f` · commit `c40b9bc` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:21:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Draws the lens/legend key onto the canvas, anchored to the bottom of the caption column area rather than stacked dynamically under the caption. It measures the key content, checks whether it would overlap the caption block, and skips drawing entirely if there isn't room, computing position from the shot's existing layout (column/caption bounds) and calling a draw/text-rendering primitive for each row.
- found: Draws a legend/key in the space between the title-date block and the byline, centered by baseline in that gap. It computes how many rows fit, lays entries out in up to 4 columns sized to the widest label, truncates with a "+N more" indicator if there isn't room for all entries, or (for a ramp-type key) draws a 5-swatch gradient bar with low/high end labels instead of a list.
- predicted: some · documented: most · derivable: no · legible: some · trap: no

### `signature`
- spec 3 · read at `5748c3e6361f` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:17:14Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Draws the byline/signature text (the instrument/author name) onto the canvas at a fixed vertical offset below the date block, within the column. It likely sets font/alignment (probably bottom or middle aligned) and renders a string via ctx.fillText, positioned above the legend block.
- found: Draws the fixed SIGNATURE constant left-aligned at a computed baseline near the bottom of the canvas, using a small muted-foreground font colored via CSS var fallback chain.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `timeline`
- spec 3 · read at `11e75abd2b46` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:30Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Draws a scrub-bar rule on the shot's canvas, filling it up to the current commit's fraction of the total commit count. Labels one end with the commit's own date and the other with its ordinal/number, except for frames before the window (the opening state) where no date is drawn since none can be honestly claimed. It reads canvas dimensions/styles from helpers like varCss and only redraws when called (i.e. when the playhead actually moves, per record).
- found: Draws a muted background rule plus an accent-colored fill proportional to progress through the commit list, then labels the left end with the formatted commit timestamp (via stamp) and the right end with "current / total" commit counts.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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
- spec 3 · read at `fcf1c7023e63` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:44:44Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns a Promise that resolves after two chained requestAnimationFrame calls, giving React time to commit the DOM update and the browser to paint before the caller reads back the frame.
- found: Two nested requestAnimationFrame calls resolving a Promise, exactly as predicted.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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

### `record`
- spec 3 · read at `1a5d0ebfaae6` · commit `7e1842f` · read by claude-sonnet-5 · via claude · when 2026-08-25T07:18:18Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Loops over every output frame (total = duration * FPS), maps frame index to a commit index in the replay, and only re-renders the Shot (calling its draw/frame/creature/column/caption/legend/timeline methods) when the commit under the playhead changes from the previous frame — otherwise reuses the last rendered bitmap. Each frame is fed to a video encoder, and once all frames are done the function finalizes/muxes and returns the resulting MP4 as a Uint8Array.
- found: Sets up an mp4 muxer (mediabunny) with codec preflight, loads fonts, builds a Shot renderer off the live sunburst SVG, then for each output frame maps frame index to a commit position, only re-fetches/folds/rasterizes the map when the commit actually changes, steps the mascot's own clock and draws every frame regardless, encodes each frame, reports detailed timing/cost/ETA, and finalizes to return the MP4 bytes. Handles cancellation and always releases the mascot clock hold.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The per-stage cost accounting (fetch/fold/raster/draw/encode) used to estimate remaining time is intricate and not derivable from the doc comment alone.

### `encoded`
- spec 3 · read at `f3a2a05b43bb` · commit `443bab0` · read by claude-sonnet-5 · via claude · when 2026-08-19T01:01:40Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts a Uint8Array of binary movie/image data into a base64-encoded string, likely delegating to the peer `base64` helper function, so it can be sent as a JSON-safe string over the Tauri invoke bridge to Rust for writing to disk.
- found: Thin exported wrapper delegating to the base64() peer function on the given bytes.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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

### `dirNode` — QUIRKY
- spec 3 · read at `a664ef42bf14` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:41:42Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: `dirNode` looks like a small factory that builds a bare `Node` object for the tree shape — given a `path`, display `name`, and whether it's a `dir` or `file`, it returns an object with those fields plus sensible defaults (like an empty `children` array for dirs, zeroed score/count/value fields) ready to be filled in as the tree is built by `shapeTree`/`onScanShape`.
- found: Builds a bare Node with id/name/kind/path set and every other field (loc, line ranges, bytes, lang, excluded, lastAuthor, doc, signature, owner, score, body, hotspots, and a large set of call-graph/clone-detection fields like callers/calls/incident/away/resolvable/orphans/sinks/cloneGroup/cloneSize/comparable/copied) explicitly nulled/zeroed/emptied, with children:[] and funcs:0 — a comment explains the call-graph fields are null (not zero) because streaming scan results haven't wired cross-file edges yet.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

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
- spec 3 · served in 2 parts · read at `d29118dbd0ff` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T21:56:08Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The pure-geometry/layout engine for the app's central sunburst visualization — turning the scored repo tree into concentric arc wedges (files/directories sized by lines, colored via `heatOf` from surprise scores), with `layout`/`arcPath`/`aggregate`/`vOf`/`rOf` computing positions and rolling up values, and `worstRatio`/`rowPlacement`/`tileFunctions`/`sliceFunctions` implementing a squarified-treemap-like placement for functions inside a wedge's inner ring, plus `labelArc` for positioning readable text along a curved arc.
- found: Exactly as predicted: `layout` partitions the tree into radial wedges sized by lines (or heat/even), `arcPath` draws annular sectors as SVG paths, `aggregate` builds a synthetic roll-up Node for functions that don't fit, `vOf`/`rOf` convert between radius and an area-preserving coordinate so a squarified treemap (`worstRatio`/`rowPlacement`/`tileFunctions`) can tile a file's functions by area inside its wedge (with floor/stretch/promotion logic to keep hot short functions visible), `sliceFunctions` does the angular equivalent for a drilled-into file view, and `labelArc` builds a text-path arc that flips direction in the bottom half so labels stay upright. I underweighted just how much intricate floor/promotion/stretch budget logic tileFunctions contains, but got every function's role and the overall geometric strategy (area-preserving radius transform, squarified treemap for the inner ring) right.
- predicted: full · documented: none · derivable: no · legible: not judged · trap: no

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

### `aggregate` — TANGLED
- spec 3 · read at `90a95e749c59` · commit `2c4bb89` · read by claude-sonnet-5 · via claude · when 2026-08-24T19:41:17Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes the list of function Nodes that couldn't be drawn as individual sunburst slices plus the file path, and builds a single synthetic Node standing in for all of them. It sums their LOC for sizing, computes the score as a LOC-weighted mean but only over members that have actually been assessed/read (skipping unread ones rather than treating them as zero), and fills in enough Node fields (name like "+N more", path, children/member list for hover) that the renderer's color/heat/hover logic can treat it like any other node without special-casing it.
- found: Builds a synthetic overflow Node (id `${filePath}#/rest`, name like "126+") standing in for the functions that didn't fit as their own wedges. Sizes it by summed LOC, computes score fields as LOC-weighted means over only the assessed ('model'/'agent' sourced) members, adds hotShare/analyzedShare fields describing how much of the pooled lines were actually read/hot, keeps the real member Nodes as `children` for the detail panel, sets a `rest` count sentinel (with `funcs: 0`) so color logic treats it as a collection wearing a function's `kind`, and nulls out all the relational fields (callers/calls/etc) since it has no wiring of its own.
- predicted: most · documented: most · derivable: no · legible: some · trap: no

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
- spec 3 · read at `6125784b3f83` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:43:44Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds an SVG arc path string (for use as a <textPath> d attribute) at radius r spanning angles a0 to a1. Computes the wedge's midpoint angle to decide if it's in the bottom half of the circle; if so, it swaps/reverses the start and end points so the arc is drawn in the opposite direction, keeping text upright instead of upside-down. fontSize is probably used to offset r slightly (e.g., centering the text vertically within the wedge band).
- found: Normalizes the midpoint angle to detect bottom-half wedges, flips arc direction for those to keep text upright, and offsets the radius by a font-size-scaled baseline correction (different constant depending on direction) to work around WebKit not honoring dominant-baseline:central on textPath content.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

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
- spec 3 · read at `ec9388c390b5` · commit `9f5abcc` · read by claude-sonnet-5 · via claude · when 2026-08-21T22:45:03Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Computes the geometry and transitions for zooming/drilling into the sunburst chart — arc geometry helpers (geoOf, hubGeo, extentOf), hierarchy relationships and zoom direction (under, ancestors, direction, enterFrom, exitTo), and interpolation between two views for animated pan/zoom transitions (lerp, lerpGeo, lerpView, ease, viewFor, viewBoxOf). A pure-geometry/math module with no React or DOM code, feeding the sunburst's drill-in/out animation. No file header doc present.
- found: Pure geometry/math module computing zoom-transition state for the sunburst: direction detection (in/out/across via path containment), per-wedge annular geometry (geoOf, excluding function wedges which are drawn inside their file's band), interpolation (lerpGeo/lerpView/lerp), enter/exit origin points for wedges appearing/disappearing, computed (not measured) bounding-box extent of annular sectors, and easing/timing constants — all feeding a continuous, non-remounting drill-in/out animation instead of the old scale-and-fade approach.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The sanity_next tool reported docs as empty for this file task, but the file actually opens with a long, detailed design-rationale doc comment (on the Geo interface) that functions as the file header — the empty `docs` field given upfront was misleading.

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
