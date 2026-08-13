# web — sanity assessment

261 of 261 read · 41 surprising

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
- spec 2 · read at `5f2e377e8ae5` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:32:23Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: The root React component of the Sanity desktop UI, rendering the main app shell: a tree/list of files and functions with their assessment progress, using helper functions to compare/find nodes (sameRun, sameIds, sameProjects, findById, parentOf) and presentational components (ProgressTrack, ProgressPane, ProgressStrip, HistoryToggle, Empty) plus a useProgress hook to track assessment completion and let the user view run history or an empty state.
- found: Root React component of the Sanity Tauri app: renders a radial sunburst visualization of a codebase colored by selectable lenses (surprise, age, etc.), with drill-in navigation, crumbs, a scrubbable git-history replay mode, project add/forget/select, MCP agent activity polling, theme switching, and a first-run CLI-install empty state. Helper functions split between ProjectSummary comparisons (sameRun, sameProjects), id-array comparison (sameIds), and tree lookups (findById, parentOf); plus shared progress-bar components and a useProgress hook for ETA calculation.
- predicted: some · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file-level doc header exists — the first doc comment belongs to sameRun, not the file.

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

### `sameProjects` — TRAP
- spec 2 · read at `0c7e62ba3910` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Compares two arrays of ProjectSummary for equality: checks length equality then compares each element pairwise (likely by id and some status/progress fields) to determine whether a re-render or state update can be skipped, similar in spirit to sameRun/sameIds.
- found: Exhaustive field-by-field equality check across ~20 ProjectSummary fields (key, name, touched, repo, counts, settings/harness/model fields, banked models via sameIds on a derived string, reading/run state) after a length check, used to decide whether polling state actually changed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: Predicted the general shape (length + pairwise compare) but underestimated how exhaustive the field list is and missed that it's a deliberate trap: any new ProjectSummary field must be manually added here or the UI silently goes stale, per the inline comments.

### `findById`
- spec 2 · read at `977918682157` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:34Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the Node tree (checking node.id against the target, then descending into children) doing a depth-first search, returning the matching node or null if not found anywhere in the subtree.
- found: Recursive depth-first search over node.children comparing node.id, returning the matching node or null.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `parentOf`
- spec 2 · read at `c0cda91e70f7` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:39Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Recursively searches the tree rooted at `node` for the node whose children include one matching `id`, returning that containing node; returns null if `id` refers to the root itself or isn't found anywhere in the tree.
- found: Recursively walks node's children; if a direct child matches id, returns node (the parent); otherwise recurses into each child. Returns null if not found.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `App` — TANGLED
- spec 2 · read at `a1bfba4a4543` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:25Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The root React component: owns top-level state (selected project, list of projects, current run status, polling/history), wires up effects to poll the backend for project/run updates using helpers like sameRun/sameIds/sameProjects to avoid unnecessary re-renders, and composes the overall layout — sidebar, the sunburst progress visualization (ProgressTrack/ProgressPane/ProgressStrip), a history toggle, and an empty state when no project is selected. Likely also wires keyboard/selection handlers and passes callbacks like onRead down to child components such as AgentPanel.
- found: Root component owning a large amount of state (scan/project data, selected node "picked" resolved by id with a stored-node fallback for synthesized overflow nodes, navigation stack, reveal-scroll requests with a nonce for repeat-click behavior, code viewer, read dialog, encoding mode for the sunburst) and composing the full app layout: sidebar, sunburst visualization, progress panels, code overlay, and dialogs.
- predicted: most · documented: none · derivable: no · legible: some · trap: no
- note: Correctly guessed the shape (state + polling + layout composition) but a function this size can't be meaningfully predicted in full from just the name/peers; missed specific mechanisms like the picked-node-vs-id fallback for synthesized overflow aggregates and the reveal nonce for repeat clicks.

### `useProgress`
- spec 2 · read at `022713725cb5` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:11Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Derives `pct` (0-100, defaulting to 0 rather than null when progress is null/empty) and `eta` in minutes from the Progress object's done/total counts and elapsed time. `eta` stays null/undefined until done reaches at least 20 items and 2% completion, since an estimate from a tiny sample is too noisy to show. Likely wrapped in useMemo keyed on progress.
- found: Computes pct as done/total (0 if no progress or total 0). Tracks a start timestamp via useRef set on mount. Computes eta in minutes only once done>20 and pct>0.02, using elapsed/pct - elapsed (linear extrapolation), else null. Returns {pct, eta}.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `ProgressTrack`
- spec 2 · read at `02dad8fe74e4` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:07:32Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a track div with a fill element whose width is derived from pct; when progress is null (no total yet) it applies an indeterminate/sweeping CSS class instead of setting a fixed width, since there's no total to be a fraction of.
- found: Renders a track div; when progress is truthy, an inner fill div with width set to pct*100% (with a transition); when progress is null, renders a differently-classed "track-sweep" div for an indeterminate animation.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `ProgressPane`
- spec 2 · read at `73bf681ceb02` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:15Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a centered container (taking up more width than the inline progress strip variant) showing a progress indicator built from the `progress` prop — likely reusing ProgressTrack internally — plus an optional label, meant to be shown as a full-pane loading state before any map data exists yet.
- found: Centered flex column showing a status line (scoring progress or fallback label), a centered ProgressTrack bar, and an ETA line in minutes if available, using useProgress for pct/eta.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Didn't predict the ETA line or the specific 'Scoring X / Y functions' text.

### `ProgressStrip`
- spec 2 · read at `8e80491e8cc2` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:02:33Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: React component rendering a compact progress bar with a text label. Given `progress` (likely {done, total}-shaped) and an optional `label`, it computes a percentage, renders the label text (defaulting to something like "scanning" when no label given) plus a numeric fraction, and a bar element whose width is set via inline style/percentage to reflect progress. Likely returns null early if progress is null.
- found: Uses useProgress(progress) hook to derive pct and eta, then renders a status line that branches on label/progress presence (custom label with commit count, default "Scoring X/Y functions", or "Reading the repo…" when no progress yet), an optional "~N min left" ETA, and delegates the actual bar rendering to ProgressTrack.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: Missed that pct/eta computation is delegated to a useProgress hook rather than computed inline, and the ETA/minutes-left display.

### `HistoryToggle`
- spec 2 · read at `c1c8ec5a5cba` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small button component toggling between "live" and "history" view modes. It renders a <button> whose label/icon and active styling depend on `on`, is disabled (or shows a spinner/dimmed state) when `busy` is true, and calls `onToggle` on click. Probably includes a title/tooltip explaining what history mode does, given the doc's framing about "the repo as it stood at some commit."
- found: A pill-shaped toggle button: disabled while busy (shows "Reading…" text then), otherwise shows static "History" label with active/inactive styling driven by `on`, and a tooltip explaining what toggling does in each direction.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Label text is static ("History"/"Reading…") rather than switching per `on` as I expected; only color/weight/background switch with `on`.

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
- spec 2 · read at `915999d15278` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:52:21Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A tiny React component (~17 lines) named AgentMascot with no docs — likely renders a decorative SVG/icon representing an "agent" character in the UI, possibly taking a small prop like size or mood/state, with no real business logic, just JSX markup.
- found: A thin wrapper that lazy-loads the heavy MascotFigure (three.js, ~1.2MB) component via React.lazy/Suspense, showing a sized placeholder span until the chunk arrives, forwarding size/events/state props through.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: Expected a plain SVG/icon component; it's actually a code-splitting wrapper around a separate MascotFigure component to defer a large three.js bundle.

### `AgentMascot`
- spec 2 · read at `5266beca935b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:47:21Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Lazily loads a heavier mascot chunk (dynamic import/Suspense) and until it resolves renders an empty placeholder div sized to `size` so the row doesn't reflow, passing `events` and `state` through to the real mascot once loaded.
- found: Wraps MascotFigure in Suspense with a sized empty span fallback to reserve layout space while the lazy component loads.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

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

### `Bloom` — QUIRKY — TRAP
- spec 2 · read at `41d6c7d9f291` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:51:05Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: React component rendering the empty-state pane as a field of scattered flowers: generates a deterministic set of Flower (and maybe Leaf) elements with varied position/rotation/size/color via a seeded pseudo-random generator, arranged via Tile-based layout, wrapped in a container using className.
- found: Renders a full-bleed SVG with a repeating <pattern> of size T×H; the pattern is filled by nested loops over OFFSETS placing a <Tile/> at each translated position (a supersampled tiling trick, not a random scatter), then fills a background rect with that pattern.
- predicted: some · documented: none · derivable: no · legible: full · trap: yes
- note: Comment explicitly warns against adding patternTransform rotate to de-grid the tiling — it makes the lattice look crooked rather than deliberate; irregularity is meant to come from per-motif rotation inside Tile/Flower instead.

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

### `CodeView` — TRAP
- spec 2 · read at `2952957d6362` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Fetches/receives the file's source text and renders it line by line, tokenized for syntax highlighting, with each line colored in the gutter by heat (via ownerByLine mapping lines to functions and rampAt/rampStops turning a function's score into a color). Highlights the `selected` node's line range, scrolls to the function named by `reveal.id` whenever `reveal.n` changes (the nonce forcing a re-scroll on repeat requests), calls onSelect when a line/function is clicked, and renders a header with optional pop-out/close buttons plus a Minimap alongside the code.
- found: Fetches file source via readSource(repo, file.path), tokenizes each line for syntax highlighting, and renders a two-column table (gutter heat bar + line number + code) where each line's owning function (via ownerByLine) determines a heat-colored background wash and gutter bar, with unanalyzed functions labeled "not measured" on their first line. Scrolls to the function named by reveal.id (keyed by reveal.n, deliberately excluding `file` object identity from deps to avoid snapping back on re-render), shows loading/error states, and renders a Minimap plus optional pop-out/close buttons.
- predicted: most · documented: some · derivable: no · legible: most · trap: yes
- note: Comments call out the file-identity-vs-reveal.n dependency choice as a deliberate fix for a real bug (scroll snapping back on agent-report polls) — a genuine trap for anyone naively adding `file` back to the deps array.

## web/src/components/ColorKey.tsx

### the file itself
- spec 2 · read at `1fbd415f9b10` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:57Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component file that renders the visual legend for the map's color-coding scheme. It probably exports ModeSwitcher (buttons/dropdown to pick which lens — churn, age, blame, etc. — colors the map), Legend/ColorLegend (renders the gradient ramp or discrete swatches with labels showing what each color band means), and ties them together into a ColorKey UI element placed as chrome over the visualization.
- found: Exports ModeSwitcher (a segmented-control tab bar for picking the color lens, with keyboard-shortcut hints and a disabled/pinned state during history playback) and ColorLegend (boxed legend matching the switcher, delegating to an internal Legend that renders one of three shapes depending on mode: categorical swatches with an 'Other' bucket for overflow, a single filled square for the boolean 'traps' mode, or a 24-step gradient bar with low/high labels for continuous ramps — plus optional stale/unread hatch-swatch indicators shown only in modes actually painted from readings).
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: File has no header doc at all (docs was empty) despite being densely commented inline; the file-level 'why' has to be inferred from many small block comments rather than one summary.

### `Legend`
- spec 2 · read at `89f53bc6e9da` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:43Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders different legend markup depending on whether `mode` is categorical or continuous: categorical modes (e.g. blame/owner, language) map over `categories` to render discrete labeled swatches, while continuous/heat modes (e.g. temperature) render a single gradient ramp bar with min/max labels, since a gradient over unordered categories would be misleading.
- found: Three-way branch: if categories given, renders discrete labeled swatches (capped at SLOTS, rest folded into 'Other'); else if mode is 'traps', renders a single filled square swatch (boolean, not a scale); else renders a labeled gradient ramp bar with mode-specific end labels and ramp choice (churn/age/legible/docs/heat).
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: Missed the dedicated 'traps' branch entirely — assumed only a binary categorical-vs-gradient split when there's actually a third boolean-swatch case.

### `ModeSwitcher`
- spec 2 · read at `7c0381eeb3d3` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:19Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders a row of small buttons, one per ColorMode value, each labeled with the mode name; the currently active `mode` is highlighted/selected and clicking a button calls onMode(m) unless disabled, in which case buttons are grayed out (pointer-events disabled or opacity reduced) but the active one still visually indicates which mode is in force.
- found: Renders a segmented-control (role=tablist) with one tab per ColorMode key, active mode raised/colored via accent background, others dimmed; disabled state grays the whole track and swaps tooltip text; each tab's title shows a hint plus a ⌘N keyboard shortcut.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Didn't anticipate the ⌘-number keyboard shortcut hints baked into the tooltip titles, or the segmented-track visual styling (inset shadow, raised pill for selection).

### `ColorLegend`
- spec 2 · read at `87f5201f6739` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:58Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders a boxed container (bordered/padded to visually match ModeSwitcher) listing a colored swatch + label for each category in `categories` based on the current `mode`, plus conditionally-appended entries for the stale hatch texture (only when stale > 0) and the unread flat-gray texture (only when unread > 0), so unused legend entries don't appear.
- found: Renders a bordered box delegating the category swatches to a separate Legend component, then—only when paintsFromReadings(mode) is true (i.e. surprise-colored mode) and stale or unread are >0—appends a hatched-pattern swatch for stale and a flat --unanalyzed-gray swatch for unread, each with its count, hand-reproduced in CSS to visually match the actual chart fills rather than reusing SVG defs.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

## web/src/components/CommitLog.tsx

### the file itself — QUIRKY
- spec 2 · read at `368f71e8ef43` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:56:27Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A React component file with no header doc. CommitLog renders a scrollable list of git commits (hash, author, message, timestamp) for the currently selected function/file, probably fetched from the Tauri backend; stamp is a helper that formats a raw timestamp/epoch into a relative or short human-readable date string used next to each commit row.
- found: CommitLog is a performance-tuned replay narration pane: a memoized Row renders each commit (subject, hash/author/date via stamp, +/- function counts), the list is oldest-at-top, and rather than restyling every row per frame (which caused lag at high replay speed) it overlays two absolutely-positioned elements — a highlighted current row via background/box-shadow and a dimming scrim over not-yet-reached commits — so only two rows actually re-render per frame. A useLayoutEffect follows the playhead by adjusting scrollTop directly (no smooth-scroll animation), distinguishing playback-driven movement (centers the row) from user clicks (leaves scroll alone) via a fromClick ref.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file header at all (documented: none) — a real finding. My prediction caught the surface (list of commits with metadata) but completely missed that the file's actual engineering weight is a scroll/playhead-synced replay renderer built around avoiding per-frame React re-renders, which the extensive inline comments reveal was iterated on repeatedly.

### `stamp`
- spec 2 · read at `007bc6229dfa` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:49Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Takes a Unix timestamp ts and formats it into a short human-readable string (e.g. via new Date(ts) and toLocaleTimeString/toLocaleString) for display next to a commit log entry.
- found: Converts a Unix seconds timestamp to a short locale date string like "Aug 13" (month + day, no time).
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `CommitLog` — QUIRKY
- spec 2 · read at `d739c2e7d798` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:59Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders a static, memoized list of commit rows from hist.commits (filtered/narrowed to `frames`/`scope`), oldest at top, built once rather than re-rendered per index change. Overlays two absolutely-positioned elements on top of that static list: a cursor marking the row at `index`, and a scrim dimming commits not yet reached, both repositioned via index rather than by re-rendering rows. Clicking a row calls onIndex(i); while `playing`, an effect auto-scrolls the pane to keep the cursor in view.
- found: Renders a header (name, repo path, loc/functions/commit-scope stats, an empty-state message when frames is empty) then a static memoized list of Row components for each frame, with a scrim div covering not-yet-reached commits (sized/positioned via transform, not restyled per row) rather than per-row styling. A useLayoutEffect follows the playhead: centers while playing, minimally scrolls into view when paused/scrubbing, and is suppressed after a manual row click (tracked via a ref) so clicking doesn't yank the scroll position.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Missed the header content and the click-vs-playhead scroll distinction entirely in my prediction; only caught the general overlay-not-per-row-restyle idea from the docs.

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
- spec 2 · read at `aad7f9b65d46` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A switch/if over `mode` returning the numeric quantity used to color the node for that mode — e.g. age for an age mode, a doc-coverage share for a doc mode, opaque share for an opacity mode — delegating to helper functions like ageRamp/docGrade/opaqueShare.
- found: Reads the node's precomputed `score`; returns -1 if absent. For churn mode returns churn (or -1 if no age). For age mode returns negative lastTouchedDays so recent sorts first. Otherwise falls through to a `wedgeHeat(n)` default — a function I hadn't seen and didn't predict.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `measure` — QUIRKY
- spec 2 · read at `0739950a13f3` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:00Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a Node and a ColorMode, picks the single metric relevant to that mode (e.g. size, duration, count) and formats it as a short string with its unit suffix, sized to fit an 8-character column. Returns null when the current mode has no meaningful numeric value for this node (e.g. node doesn't have that stat).
- found: Switches on ColorMode: blame returns null, churn returns commit count with × suffix or em-dash, age returns relative day string, surprise returns either a categorical heat word or a rounded degree number, and default falls back to loc (line count) formatted with locale separators.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

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

### `Detail` — TANGLED
- spec 2 · read at `13b9bc4543f5` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:23Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders the right-hand detail pane for a selected node (or the focused subtree if none selected) — a breadcrumb built from owners, the node's name/title, computed stats (rank, measure, grade) placed against the repo's population/distributions, a provenance line, rendered markdown docs with a copy button, and a Contents list of children for drilling further into the tree, wired through onSelect/onDrill/onShowIn callbacks.
- found: With no node, shows a Summary of the focused subtree or an idle Bloom pattern. With a node, builds a breadcrumb path from owners, delegates to Summary for non-leaf (container) nodes with a computed 'about' block, and for leaf (function) nodes renders name/trap badge, Dials, FunctionRanks, the agent reading (expected/found/note/trap styling, warm-read and stale-read caveats, hotspots evidence), a Contents list, and a pinned provenance footer.
- predicted: most · documented: none · derivable: no · legible: some · trap: no
- note: Missed the trap badge, hotspot 'evidence' section, warm/stale-read caveats, and the container-vs-leaf split via Summary — the doc comments on the props (JSDoc) carried more of the intent than I predicted from names alone.

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

### `graded` — OBSCURE — TRAP
- spec 2 · read at `044dbbf0a1b3` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:52Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Looks up the node's report data for the given field ('legible' or 'documented') and returns a single representative Grade — likely by reading node.reports (an array of per-reader reports) and picking the most common/majority grade value for that field, or the first non-null one. Returns undefined if there are no reports or the field was never graded.
- found: Returns undefined if the node doesn't match the current filter, has no agent report, or the report is stale. For 'documented', returns 'none' if the finding was derivable (overriding the raw documented grade), else the stored documented grade. For 'legible', delegates to legibleOf(node.agent) rather than reading a field directly.
- predicted: none · documented: full · derivable: no · legible: most · trap: yes
- note: Assumed a per-node array of reader reports to majority-vote over; actually it's a single node.agent with special-case overrides (derivable forces 'none', legible routed through legibleOf) — a different mechanism than I guessed.

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
- spec 2 · read at `9826f2e9470c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:23Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A React component file with two declarations: a `pace` helper and the `HistoryBar` component. HistoryBar likely renders a horizontal bar/timeline visualizing a sequence of historical items (e.g., past task runs or scores), computing layout (widths/positions) via `pace`, which likely calculates spacing or a rate (time-per-unit) used for that layout. No file-level docs exist.
- found: The file is a playback transport (play/pause button, scrub range input, and duration-preset buttons) for replaying a sequence of commits, not a rendered bar chart of history items. `pace` formats a duration in seconds into a short label like "45s" or "3m" for the preset buttons. The bulk of the file is two useEffect hooks: one driving a requestAnimationFrame clock that advances the playhead at a rate computed from total duration and frame count (skipping frames rather than falling behind), and one handling keyboard shortcuts (space to toggle, arrows to step) that coordinates with the scrub input's own native arrow handling.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level header, but each declaration has unusually rich prose-style JSDoc explaining design rationale (why duration not rate, why RAF not setInterval, why rewind-on-play, etc.) — very much documented at the function level even though the file-level `docs` field was empty.

### `pace` — QUIRKY
- spec 2 · read at `f97e230c1fec` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:51:49Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Given a total count, returns a human-readable pace label by bucketing the number into ranges (e.g. "slow", "steady", "fast") for display in the HistoryBar UI. Likely a simple if/else or ternary chain comparing total against threshold constants.
- found: Formats a duration in seconds as a short string: minutes rounded with 'm' suffix if >= 60 seconds, otherwise raw seconds with 's' suffix. Not actually a "pace" label like slow/fast — it's a duration formatter, likely misnamed relative to what I expected.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `HistoryBar`
- spec 2 · read at `a70abe5b9f29` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:47Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a full-width scrub/slider bound to `index` over `frames.length`, a play/pause button toggling `playing`, and a duration input calling `onDuration`. When `playing` is true, an effect (interval or requestAnimationFrame) advances `index` through `frames` at a rate derived from `duration`, calling `onIndex` each step and `onPlaying(false)` when it reaches the end. It does not render a secondary commit-info caption row, since the docs describe that being removed as redundant with the log view.
- found: Renders play/pause button, a range-input scrub bar, and preset duration buttons. Drives playback via a requestAnimationFrame loop that advances a fractional cursor (tracked in a ref) at a rate derived from elapsed real time and the scoped frame count, converting to an integer index and calling onIndex; stops at the end rather than looping. Also wires global keyboard shortcuts (space to toggle play, arrow keys to step, shift for a 10-commit stride) with care to avoid double-handling when the range input itself has focus.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the keyboard-shortcut handling entirely and assumed a duration text input rather than preset buttons; the docs' claim about a removed caption row was correct and not present in the body.

## web/src/components/MascotFigure.tsx

### the file itself — QUIRKY
- spec 2 · read at `38b35ed56074` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:33Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Renders a small mascot/avatar component whose mood (moodFor) is derived from the repo's aggregate stats (e.g., how surprising/undocumented the codebase is — happier when well-documented, grumpier when hot/undocumented), with pick selecting among several mascot art variants/poses for that mood, and loadOrMint handling lazy loading of a cached mascot image/SVG or generating ("minting") one on first use and caching it (e.g., in localStorage) so it isn't regenerated every render. There's no file header doc, suggesting this is a lighter, more whimsical/decorative component that was added without the same documentation discipline as the rest of the app.
- found: A persistent per-machine mascot creature (localStorage-backed, six-click-to-remint easter egg) whose animations are driven by live MCP agent tool-call events, not repo doc/surprise stats as I guessed — a regex table (MOODS) maps tool names like report:hot/report:stale/next/status/error to animation sets, played in order as calls arrive, plus sleeping/working/stopping states tied to run lifecycle. No file header at all, confirming the empty-docs finding.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `loadOrMint`
- spec 2 · read at `296f66e763ec` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:44:49Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Tries to load a persisted MascotConfig from localStorage; if none is found or it's invalid, generates a new random config using the `pick` helper for random trait selection, persists it back to storage, and returns it.
- found: Tries to load and JSON-parse a saved MascotConfig from localStorage; on any failure (missing, corrupt, storage unavailable) falls through to generate a fresh one via randomizeMascot(), attempts to persist it (swallowing storage errors), and returns it either way.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: I predicted the `pick` peer was the generator itself; it's actually a separate randomizeMascot() call, with pick presumably a helper used inside it.

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
- spec 2 · read at `1714d15ae6d3` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:52Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A React component that renders an animated mascot avatar at the given `size`. It derives a "mood" from the `events` (recent agent calls) and `state` via `moodFor`, uses `pick`/`loadOrMint` to select or lazily generate the mascot's visual asset (maybe an SVG or generated image, cached/minted per some identity), and conditionally applies CSS animations/classes depending on whether the mascot is sleeping, working, or being torn down. Likely returns a wrapping div with an img/svg and some state-driven className or inline style for animation.
- found: Wraps an imperative `<Mascot>` scene (ref handle with play/wake) with two effects: one drives sleep/wake/confused-stopping animation purely off `state`, the other replays fresh events (by sequence number, deferred a frame, staggered by BEAT_MS) only while working. A click counter (6 clicks in a window) reroll/remints the mascot's random config into localStorage, remounting via a key={JSON.stringify(config)} on Mascot.
- predicted: some · documented: some · derivable: no · legible: some · trap: yes
- note: Vastly more mechanism than the signature/docs suggested: no CSS classes at all, it's an imperative animation handle plus sequence-tracked event replay and a click-to-remint easter egg.

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
- spec 2 · read at `100b44878b73` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:56Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A React dialog component (ReadDialog) that lets the user configure and kick off a repo "read"/scan — likely choosing a model, sample size, or token budget via slider and choice/field form controls. tokensFor estimates token cost for display, and snap/approx are small numeric helpers that round slider values to clean, human-readable increments. No module header doc, which is itself notable for a file this size (558 lines).
- found: A dialog for starting a repo read: pick agent/harness, pick model (defaulting to what the repo's existing corpus was read with, to avoid silently mixing scales), and choose how many functions to read via a detented slider showing four cost dials (functions, readers, lines, tokens). Extensive reasoning comments justify UX decisions like why batch size isn't a slider, why the model field is hidden behind 'Change' when corpus already has one, and why dials rather than bars.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No module header doc despite being a 558-line file with the most design rationale of anything I've seen so far — the reasoning lives in inline comments instead.

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

### `Field`
- spec 2 · read at `bc059b3aa449` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:05:52Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A tiny layout wrapper used inside ReadDialog's form: renders a small uppercase/muted label above (or beside) its children, providing consistent spacing for each labeled control (like Slider or Choice) in the dialog.
- found: Renders a small uppercase muted label div above the children, a plain layout wrapper.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `Choice`
- spec 2 · read at `e83ef3d9ad2c` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:49Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A small React component rendering a clickable option (like a radio/toggle button) in the ReadDialog form — shows `label` and optional `note` text, styled differently (e.g. highlighted border/background) when `on` is true, calls `onClick` when clicked, and is visually dimmed and non-interactive when `disabled` is true.
- found: A button styled via CSS vars: accent border/background/foreground when `on`, transparent/default otherwise, dimmed via disabled:opacity-40 when disabled, showing label plus an optional parenthesized note.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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

### the file itself
- spec 2 · read at `43c6737e605e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:01:26Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: The app's left-hand sidebar: a `SideBar` component that lists the user's projects (each rendered by `ProjectItem`, with open/select/remove actions and maybe scan status), and an `AgentPanel` that surfaces the background reading-agent's state — progress, start/stop/pause controls, and live counts — for the currently open project.
- found: SideBar is the full-height left column: a header, a scrollable project list (each ProjectItem row shows name, assessed/total count or loading %, a progress-fill edge rule, and a 'reading' sweep/pulse animation when readers are actively working that project), a right-click context menu to remove a project from the list (not delete its data), and an '+' add-project button. AgentPanel sits below and is scoped to the SELECTED project only: an animated mascot + Working/Stopping/Sleeping label, Read/Stop controls, run progress line (spawned/live/failed counts), and a failure-transcript overlay sheet for the last failed run.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: Got the overall structure right (project list + agent status panel with controls) but missed several deliberate design details: per-project progress lives in the list row not a shared bar, the context menu for removing projects, the mascot/animation system, and the failure-transcript sheet.

### `SideBar`
- spec 2 · read at `d2f4d8664a4e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:11Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders the app's sidebar: a scrollable list of ProjectItem rows built from `projects`, highlighting the one matching `active` and calling onSelect on click. Includes an Add button wired to onAdd, per-project Read/Forget actions wired to onRead/onForget, and an AgentPanel driven by `agent` showing current agent activity.
- found: Renders the sidebar: header, an Add (+) button wired to onAdd, an empty-state hint, and a list of ProjectItem rows highlighting the active one and calling onSelect. Right-clicking a row opens a custom context menu (not per-row buttons) with a single 'Remove from list' action wired to onForget, dismissed via a full-screen backdrop. onRead is not attached per-project row — it's passed down to a single AgentPanel at the bottom, which shows activity for whichever project is active.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: I assumed onRead/onForget were per-project buttons in each row; actually onForget comes from a right-click context menu and onRead is only wired into the bottom AgentPanel for the active project.

### `ProjectItem` — QUIRKY
- spec 2 · read at `a8e29ba52526` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:42:16Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a clickable, rounded 28px-tall row for one project: the project's name/label on the left, wired to onClick and onContextMenu, with `active` toggling a highlighted/selected background style. On the right it shows some count from `project` (likely remaining or assessed items) as a small badge, matching the layout described for sibling nav rows.
- found: Renders a 28px button row with icon, name, and assessed/total count badge; toggles active styling. Also draws a bottom-edge progress rule (width = assessed/total), a "reading" sweep animation and pulsing icon when readers are currently out on that project, and a loading state showing a percentage or "reading…" instead of the count while the project is being rescanned.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Docs only described the row's basic layout ("28px strip... count pushed right"); the progress rule, reading-sweep animation, and loading state are undocumented in the handout but heavily commented in the code itself.

### `AgentPanel` — QUIRKY
- spec 2 · read at `0e41658e9e4e` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:46Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a single merged sidebar panel showing current agent/reading activity for a project — a mascot that animates on tool calls, and status text that cycles through states like "reading", "stopping", or idle, replacing what used to be two separate stacked indicators. It takes project/agent info as props and calls onRead(key) presumably when the user acknowledges or dismisses an activity entry. No settings gear/chat-client-connect UI remains, per the docs saying that was removed.
- found: Renders the sidebar's status panel: mascot + one-word state (Sleeping/Working/Stopping) derived from run/chatter flags, a progress line (backlog count or live run stats), a Read button to start reading and a Stop button to kill a running wave, plus a failure-details overlay sheet triggered by an info icon when the previous run failed.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: onRead actually starts a read (button labeled "Read"), not an acknowledge/dismiss action as I guessed; also missed the Stop button, failure sheet, and progress-line logic entirely.

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

### `rowNote`
- spec 2 · read at `38d1b2dcbbca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:24Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Switches on `mode`. For 'age' it formats something like "5d ago" from the node's last-edit timestamp; for 'churn' it formats something like "11 in 90d" from commit count; for all other (categorical) modes it returns a string describing the node's line count, since those modes' bucket headings already state the category value itself.
- found: For 'age' mode, formats lastTouchedDays as 'today' or 'Nd ago', or '—' if unknown. For 'churn' mode, prints '{commits} in 90d' but guards on ageDays !== null (not commits), because commits===0 is ambiguous between 'no history' and 'no commits this window' while ageDays disambiguates; otherwise '—'. All other modes return a compact line count.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The churn branch's guard (ageDays) vs printed value (commits) mismatch is explained by an inline comment as deliberate and previously caused reviewer confusion — a documented near-trap, not a real one.

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
- spec 2 · read at `a568cca97226` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:05:02Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component (SunburstView) that renders the sunburst/ring visualization of the codebase: nested arcs per directory/file/function level, arc size proportional to lines of code, arc color driven by the score's temperature/surprise value. Includes a heatShare helper computing hot-share of a wedge, plus arc-path/layout math and interaction handling (hover, click-to-drill, tooltips) since the file is 1200+ lines with no file-level doc comment.
- found: Implements the sunburst radial visualization: memoized SunburstView renders concentric rings (dir/file/func) plus a hub, with drill-in/out zoom animation and delegation to a separate FileZoom for fully-zoomed files. heatShare only damps fill opacity under the 'surprise' color mode (by node kind); other modes get no damping. Wedge angular size comes from a separate layout() algorithm (not strictly LOC-proportional, with thinning), and color comes from colorFor() supporting multiple ColorMode options (surprise, blame/author, age, language), not a single fixed temperature score. Extensive interaction: hover tooltip, click-select, double-click drill, option-click fold, plus zoom animation, function tiling/rollup, stale-reading hatch overlay, and live 'reading' pulse animation.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `heatShare`
- spec 2 · read at `735127f33e96` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:47Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns a damping multiplier (0-1) for how strongly a ring's color should read, based on kind (e.g. 'dir' vs 'file'/'func') and mode. Returns 1 (no damping) for every mode except 'surprise', where directory-kind nodes get some reduced value since their color there is only a rolled-up "hot share" rather than a direct measurement, while under all other modes (churn, age, blame, lang) it always returns 1 since those aggregates are legitimate readings of the same quantity.
- found: Under 'surprise' mode, looks up a per-kind damping value from a HEAT_BY_KIND table (defaulting to 1 if kind isn't in it); under every other mode it always returns 1 (no damping).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `SunburstView` — TANGLED
- spec 2 · read at `d62a32eef0c1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:07Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: The main SVG sunburst renderer: computes nested arc geometry for the node tree (likely via d3-hierarchy/partition), draws a wedge per node colored via colorFor/mode/ranks/ageSpan, wires click (select), double-click (drill), background click (clear), a center hub click (onUp) to go up a level, animates/pulses wedges whose id is in `reading`, and shows a WedgeTip tooltip on hover, with substantial internal state given its length.
- found: Confirmed the start of the body: it tracks hoverNode plus pointer position separately in state (replacing SVG <title> elements' OS-rendered, delayed tooltips), consistent with rendering a WedgeTip on hover as I predicted. The file was too large (1206 lines / ~66KB) to read in full within my tooling's per-call token cap, so I could only verify the opening portion (hover-state setup) directly; I'm trusting the rest (arc geometry, click/drill/clear/up handlers, reading-set pulse animation) matches based on the signature/JSDoc rather than having read it end to end.
- predicted: most · documented: none · derivable: no · legible: some · trap: no

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
- spec 2 · read at `68e277a8e9bf` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:09:56Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Frontend's central Tauri bridge/API module — thin invoke() wrappers for backend commands (pickProject, listProjects, forgetProject, scanRepo, projectScan, readSource, openCodeWindow, installCli, cliStatus, startCheck/stopCheck), paired event-listener subscriptions (onScanScore, onScanProgress, onSetTheme, onOpenProject, onInstallCli), plus client-side logic mirroring the Rust scoring/aggregation (toNode, toScan, applyScores, reaggregate — a hand-maintained JS twin of Node::aggregate) and color/heat computation (temperature, wedgeHeat, shareRamp, paintHeat, heatColor, rampStop/rampAt, isAnalyzed) so the sunburst can render without a round trip, plus reading/grading and agent-report helpers (readingWords, reportGrades, isReportStale, legibleOf, agentReports, applyAgentReports, countPending, agentActivity, harnesses, summarize). No header docs at all.
- found: Confirmed: Tauri invoke() wrappers, event listeners, and a hand-maintained JS mirror of Rust's Node::aggregate (reaggregate/applyScores/applyAgentReports) plus heat/color ramp math. But the file's real bulk and center of gravity is a large, carefully-designed grading/vocabulary system I underweighted: AgentReport shape, Grade type, GRADE_SURPRISE/GRADE_DOCUMENTED/DOC_GAP mappings, three separate display-word tables (HEAT_WORDS/LEGIBLE_WORDS/DOC_WORDS) each with extensive rationale for why they diverge from each other and from the raw grade, legibleOf/reportGrades/readingWords accessors enforcing single-source-of-truth rules, plus RepoSummary/summarize/countPending for panel stats.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file-level header docs despite every individual export being extremely heavily commented — documented=none is about the missing header, not the file's actual documentation density, which is very high.

### `showsShare`
- spec 2 · read at `81a584ff2399` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:33Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns true if this node's wedge should show a share (documented-fraction style reading) rather than a heat/temperature reading. Based on the docs, it's not simply `kind !== 'func'` anymore — it now also treats the overflow/rollup aggregate node as a share-wedge (rather than falling through to the temperature side by virtue of not being a plain function), fixing the bug where roll-ups painted misleadingly hot.
- found: Returns true (share display) when node.kind !== 'func', or when node.rest is defined (the overflow/rollup aggregate), so the rollup no longer paints as a temperature.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `toNode`
- spec 2 · read at `abb099812d1f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:23:43Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Converts a raw wire-format node object (WireNode) into the app's internal Node type by mapping/renaming fields and filling in defaults for optional properties, possibly recursing into child nodes if the structure is a tree.
- found: Converts a WireNode (snake_case API response) into the app's internal Node type (camelCase), applying nullish-coalescing defaults for optional fields, converting the nested score object similarly, and recursively mapping children via toNode.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

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

### `forgetProject`
- spec 2 · read at `c04aba1c39d5` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:51Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Calls invoke('forget_project', { key }) on the Tauri backend, removing the project from the app's tracked list without deleting any files or committed readings.
- found: Thin invoke wrapper calling 'forget_project' with the key on the Tauri backend.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

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

### `applyAgentReports`
- spec 2 · read at `f17eb82903f5` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:55Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Walks the node tree matching each `AgentReport` to its corresponding function node (likely by id/path), then attaches an `agent` field on that node holding the report's verdict (predicted/surprised), mapping the binary result to the extremes of the heat/surprise scale rather than a mid-range value. Returns a new `Node` tree with these agent annotations folded in, probably also setting/clearing an `agentStale` flag and reaggregating scores up the tree.
- found: Recursively walks the tree matching AgentReports by node id via a Map. Leaves get the report attached as `node.agent`, with staleness handling: stale reports fall back to the proxyScore and keep the code-derived score untouched, while fresh reports overwrite surprise (and documented, if the agent graded it) on the score, marking source 'agent' and analyzedShare 1, saving the old score as proxyScore. Internal nodes recursively visit children, reaggregate if any child changed, and separately attach their own file-level agent report (for file headers) without touching the rolled-up score.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

### `countPending`
- spec 2 · read at `ed6f00b2ea70` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:30Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree from `root`, incrementing a `stale` counter for func nodes whose reading is stale and an `unread` counter for func nodes with no reading at all (unanalyzed), skipping functions a .sanityignore excluded so it stays scoped identically to `summarize`. Uses simple counters with no array allocation or sorting, returning { stale, unread } directly.
- found: Recursively walks the tree propagating an outOfScope flag (once excluded, always excluded down the subtree), counting func nodes as stale (agentStale) or unread (no agent reading) while skipping excluded ones; returns plain counters, no arrays.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `summarize`
- spec 2 · read at `137ee769a153` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:11Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A tree-walking aggregation function that recursively traverses the repo Node tree and rolls it up into a RepoSummary — counting total files/functions, how many have been assessed vs pending, and aggregating some kind of score or grade distribution (e.g. surprise/distinctiveness) across the whole repo for display in a summary header or dashboard.
- found: Recursively walks the Node tree, tallying functions into read/stale/unread/excluded buckets, building a grade distribution (spread/byGrade) from each node's predicted grade, tracking legibility counts and trap counts, collecting "hot" nodes above a temperature threshold, then sorts hot lists and each grade bucket by temperature (falling back to lines-of-code) descending.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: Got the overall shape (tree walk → aggregate counts + grade distribution) but missed several specifics: excluded-subtree propagation, firstStale tracking, and the hot/temperature sorting.

### `scanRepo`
- spec 2 · read at `252492de7a28` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: An async thin wrapper that invokes a Tauri command like 'scan_repo' with the given path and awaits/returns the resulting Scan object describing the repo's structure or functions found.
- found: Invokes 'scan_repo' with { req: { path } }, getting a WireScan, then converts it via toScan() into the app-level Scan type before returning.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `toScan`
- spec 2 · read at `469196822508` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:13:10Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Converts a WireScan (the raw JSON shape sent from the Rust backend, likely snake_case) into the frontend's Scan type, renaming/reshaping fields such as file paths, functions, and counts into camelCase and possibly computing derived fields.
- found: Maps WireScan's snake_case root/stats fields (files_scanned, files_skipped, functions, without_history, commits, model) into the camelCase Scan shape, recursing into toNode for the tree, defaulting commits to 0 if absent.
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

### `reaggregate` — TANGLED — TRAP
- spec 2 · read at `42c73f02d5d4` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:44:20Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recomputes a parent Node's score fields (loc, commits, ageDays, etc.) by summing/averaging over its children's scores, mirroring the Rust-side Node::aggregate so incremental UI updates stay consistent with the full backend recompute. Likely weights averages by loc or child count and returns a new Node object with the merged score plus the given children attached.
- found: Weighted-averages surprise/documented/churn by loc across children, tracks max age and min last-touched, preserves commits from the existing node rather than summing (avoids double counting), tracks the strongest score source (agent > model > proxy) and analyzed/hot shares, and returns a new node with merged score — with several subtle fixes noted in comments (lastTouchedDays previously hardcoded null, source previously hardcoded proxy) that must stay in sync with the Rust-side Node::aggregate.
- predicted: most · documented: some · derivable: no · legible: some · trap: yes

### `onScanProgress`
- spec 2 · read at `6259f44de964` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:07:34Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri event (e.g. 'scan-progress') via listen(), calling cb with the event payload each time it fires, and returns a cleanup function that unsubscribes the listener. Since listen() is async, the returned unsubscribe function likely stores/awaits the unlisten promise so it can be called synchronously by the caller.
- found: Subscribes via Tauri's listen() to a 'scan-progress' event, calling cb with the payload, and returns a synchronous unsubscribe closure that awaits the listen promise then calls the resulting unlisten function.
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
- spec 2 · read at `06ecec996038` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:10:31Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Implements the alternate coloring "lenses" for the sunburst beyond the surprise/heat ramp in api.ts — an Author lens (isAuthor, slotColor, rankCategories assigning stable colors to the most common committers), an Age lens (ageSpanOf, ageRamp), and a Docs lens (docGrade, undocShare, opaqueShare), unified behind a colorFor dispatcher and legendFor/bucketsFor to build the legend and group wedges. paintsFromReadings/saysNothing likely gate whether a lens has real data for a wedge (vs. rendering it neutral). No header docs.
- found: Confirms the lens-dispatcher shape: colorFor handles all 8 ColorModes (surprise, legible, docs, traps, language, blame, churn, age) with per-mode share/ramp/categorical logic, isAuthor/slotColor/rankCategories for the author palette, ageSpanOf/ageRamp for a per-repo-normalized age scale, opaqueShare/docGrade/undocShare for the legible and docs lenses, saysNothing to suppress rows a mode has no right to answer for a given node kind, and bucketsFor/legendFor to build the panel breakdown and legend, all sharing one walk/ranking so map and legend can't disagree.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: Underpredicted the mode count and the legible/traps/churn lenses — I only named author/age/docs from the peer list and inferred the rest generically as "beyond the heat ramp" rather than naming them.

### `paintsFromReadings`
- spec 2 · read at `09004cfe8323` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:03:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Returns true if the given ColorMode is one derived from a reader's report (e.g. surprise/predicted, legibility, documentation) rather than from git history or static parse data. Likely implemented as a small array/set membership check or an equality chain against the reading-based mode names.
- found: Returns true if mode is one of 'surprise', 'legible', 'docs', or 'traps' — the four reading-derived color lenses, as opposed to git- or parse-derived ones.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted 3 of the 4 modes correctly (guessed 'legibility' instead of 'legible') but missed 'traps' as a fourth reading-derived lens.

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
- spec 2 · read at `e1383ed687e1` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:45:34Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A dispatcher that switches on `mode` and for each mode pulls relevant data off `node`, using helpers like ageRamp/ageSpanOf, docGrade/undocShare, opaqueShare, isAuthor/slotColor, or rankCategories/bucketsFor to compute a color plus a human-readable label. Returns null (via a saysNothing-style check) when the node has no data for that mode, rather than fabricating a color.
- found: A big if-chain dispatching on ColorMode ('surprise','legible','docs','traps','churn','age', and a fallback for 'blame'/language mode). Each branch pulls data off node.score or node fields, uses ramped()/shareRamp()/ageRamp() plus per-mode helpers (docGrade, undocShare, opaqueShare, isAuthor, slotColor) to build a {fill,stop,ink,label} object, returning null when the relevant data is absent (unanalyzed node, no header, no age, etc). The docs/comments explain many deliberate design choices (e.g. why docs ramp is linear not shareRamp, why files check their own header vs share, why traps is boolean not ramped) that aren't derivable from signature alone.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `rankCategories`
- spec 2 · read at `3520bac67344` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:08:56Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree from root, groups nodes by category (as determined by mode), sums lines per category, sorts categories descending by total line count, and returns a Map from category name to its rank/slot index (0 = biggest category).
- found: It just delegates entirely to legendFor(root, mode), taking the ordered legend names and building a name→index map from their order. All actual grouping/sorting logic lives in legendFor, not here.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment describes the overall purpose well but doesn't reveal that this is a thin wrapper around legendFor.

### `bucketsFor` — QUIRKY — TANGLED
- spec 2 · read at `c1a1248be69f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:11Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Walks the subtree once, skipping .sanityignore'd functions, and for each function determines its bucket key under the current mode: categorical modes (like Blame/Language) group by the category value itself using ranks for ordering/color via slotColor, while ramped modes (Age, etc.) sort values into a fixed number of bands and color each band by heatColor/ageRamp at the mean of its members' values (not a fixed representative). Anything the mode can't assign a color to (no data) goes into one final neutral bucket rather than being dropped, and each returned Bucket carries its key, label, color, and member nodes.
- found: Walks the subtree once (skipping excluded nodes) and, per current mode, buckets each function (or file, under docs) by category (blame/language, via ranks/slotColor), by reading-derived grade (legible/docs/traps), or by fixed band with ramp-mean color (churn/age). Every mode routes anything it can't classify into one shared 'unknown' sentinel bucket (kept out of real-key namespace) rather than dropping it, then sorts buckets by mode-specific rules (by lines, traps-first, grade order, band order) with the unknown bucket always pinned last.
- predicted: some · documented: most · derivable: no · legible: some · trap: no

### `legendFor`
- spec 2 · read at `5f736b0a6d05` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:43:45Z · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree from root, collecting the distinct category values (e.g. language or provenance) that the categorical mode assigns per node, likely via rankCategories, and returns them as string[] for a legend. For a ramp-based (continuous) mode it returns an empty array, since ramps don't need a discrete legend.
- found: Hardcoded to only 'blame' and 'language' modes (all other modes short-circuit to []); walks function nodes, accumulates LOC per distinct author/lang key (skipping uncommitted lines via isAuthor for blame), and returns keys sorted by total LOC descending — so the legend order reflects how much of the picture each value actually covers, not alphabetical or discovery order.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Expected a generic dispatch over all categorical modes via rankCategories, but it's a direct two-mode special case with its own LOC-weighted aggregation inline.

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
- spec 2 · read at `27d5fd1afc2c` · commit `9ea3e1f` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:09:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Core engine for scanning a git repo's commit history and turning it into a time-based, replayable data structure for a "code history" visualization feature. scanHistory/warmHistory/onHistoryProgress walk commits with progress reporting and caching; scopedCommits filters commits by path; daysBetween is a date utility; opening/advance/replay step through history frame by frame; scoreInto/aggregate/collapse build per-file/per-directory change scores rolled into directory nodes (dirNode) assembled into a frameTree per time slice; posOf/realOf map between a virtual timeline position and the real underlying commit index.
- found: A frontend companion to a Rust history.rs: scanHistory/warmHistory invoke Tauri commands to scan/incrementally update a git commit timeline; replay/advance/opening fold commits into a mutable Frame (loc, touch dates, churn-window hit lists, authors), memoized so forward playback is incremental rather than O(n^2); scoreInto derives a per-function Score (churn/age/lastTouched) from a frame; aggregate/collapse/dirNode/frameTree build a directory/file/function Node tree per frame for a sunburst view, with function nodes pooled and mutated for performance while containers are rebuilt fresh each frame to force layout updates; scopedCommits/posOf/realOf let a directory drill-down show only relevant commits on the scrub bar while still dating frames from the real full replay.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Docs are unusually rich design-rationale (benchmarked numbers, explicit tradeoff explanations) that go well beyond what's derivable from the code, e.g. the 1.3ms/26ms replay benchmark motivating the memo, and the explicit non-pooling of containers to force sunburst re-layout.

### `scanHistory`
- spec 2 · read at `499218ef69e7` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:27:27Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Wraps a Tauri invoke() call to a Rust backend command that scans git history for the repo at `path`, optionally limited to `limit` commits, returning a HistoryScan promise.
- found: Thin wrapper invoking the Tauri 'scan_history' command with path and limit, returning HistoryScan.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

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

### `daysBetween`
- spec 2 · read at `d174e1052ee9` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:28:38Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes (now - then) / 86400 to convert seconds to days, then clamps the result to be non-negative with Math.max(0, ...), since "then" could theoretically be after "now".
- found: Exactly as predicted: (now - then) / 86400 clamped to a minimum of 0.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `opening`
- spec 2 · read at `43a186f38e57` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T22:01:06Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds the initial Frame state representing everything contributed by commits that were truncated/excluded from the scan window, by aggregating their stats (e.g. file/line counts) into a base Frame object, which later frames from `advance`/`replay` will build on top of.
- found: Constructs the initial Frame: empty touched/born/hits/author maps, loc seeded from hist.base (per-file line counts as of the start of the tracked window), ts set to hist.baseTs, at set to -1. Deliberately does not mark base files as touched/born so they render undated rather than falsely appearing freshly written.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The one-line doc comment covered the intent well; the inline comment explained a non-obvious design choice (not marking base files as touched) that I wouldn't have predicted.

### `advance` — QUIRKY
- spec 2 · read at `44181d35b1ca` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:54:46Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: advance mutates `frame` in place to reflect all commits in hist strictly after frame.at up through `to`: for each such commit it applies the set/del deltas (adding/updating functions, removing deleted ones) to frame's function map, then updates frame.at to `to` when done. This lets the frontend incrementally replay history without recomputing state from scratch each time the playhead moves forward.
- found: Iterates commits from frame.at+1 through to, applying set/del deltas to frame.loc, but also maintains touched/born timestamps and a bounded churn history (frame.hits, capped at CHURN_MEMORY) per function, tracks per-file author attribution, then updates frame.at and frame.ts.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `replay` — TRAP
- spec 2 · read at `59a3719d614b` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:17:28Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Iterates through the commits in hist up to the given index, applying each one (likely via advance and scoreInto) to accumulate per-file/per-directory churn or age stats into a tree structure, then returns the resulting Frame snapshot representing cumulative history state at that point — used to let a UI scrub through history and see the tree evolve.
- found: Memoizes the last-built Frame for a given HistoryScan; if the cached frame's position is at or before the requested index, it incrementally advances that same frame object forward to the new index and returns it (mutating and reusing state). Otherwise it starts fresh with opening(hist) and advances from there, caching the result for next time.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: The mutation-based memo caching (advancing forward in place rather than always replaying from index 0) wasn't something I predicted at all.

### `scoreInto`
- spec 2 · read at `443ddd4d08c3` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:46:21Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Writes computed score fields (churn, ageDays, lastTouchedDays, commits, surprise, analyzedShare, hotShare) into the `into` Score object if provided (mutating and returning it) or allocates a new one otherwise, reading from `frame` at index `f` (a per-function slot in the frame's arrays). Fields it can't compute from the frame data are left at zero/defaults that the "no claim" convention (e.g. isAnalyzed) recognizes as absent rather than a real reading.
- found: Looks up touched/born/hits for slot f from frame's maps, computes churn as commits-in-window over CHURN_SATURATION (clamped to 1), ageDays and lastTouchedDays via daysBetween against born/touched (null if undefined), and commits count. Reuses `into` if given (mutating it, leaving fields it doesn't touch like surprise/analyzedShare/hotShare exactly as they were) or builds a fresh Score with those left at zero/null defaults.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `aggregate` — QUIRKY
- spec 2 · read at `017617381d90` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:00:01Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a directory Node's children (post-order, aggregating children first), summing their line counts to set this node's own LOC, and computing this node's age/first-seen as the oldest child's and its last-touched/newest date as the newest child's — mutating the node in place rather than returning a new value, mirroring the Rust `Node::aggregate` LOC-weighted rollup logic used by the scan.
- found: Post-order recursively aggregates children first, sums LOC across children. Then, weighting by each child's LOC (floor 1), computes an LOC-weighted average churn, takes the max commits count seen, the max ageDays (oldest) and min lastTouchedDays (most recently touched), and builds a synthetic 'history'-provenance score object on the node (skipping children with no score, and bailing entirely if total weight is 0).
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: Missed the churn weighting, commits-max, and the synthetic score object construction — only predicted the LOC sum and age/touched rollup mentioned in the docs.

### `collapse`
- spec 2 · read at `d28aae3d52ae` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:50:25Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a Node tree; for any directory node that has exactly one child and that child is itself a directory, merges them into a single node (combining names/paths with a separator) and continues collapsing down the chain, then recurses into the (now collapsed) children to do the same at deeper levels. Returns the transformed node, mirroring the Rust-side collapse_chains logic so the JS-side history replay tree matches the shape the initial scan produced.
- found: Recurses into children first (map collapse), then if this node is a single-dir-child directory, returns the child's node spread with the name joined as "parent/child" — effectively promoting the child up and discarding the parent's other fields (children, etc. come from `only`).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I expected a while-loop that flattens an entire chain in one node before recursing; actual code relies on the post-order recursion itself to naturally chain-collapse one level per call.

### `dirNode`
- spec 2 · read at `fc1e136bdb1a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:40Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns a new directory Node object with the given path and name, an empty children array/map, and default/zeroed aggregate fields (e.g. size, surprise) to be filled in later by aggregation logic.
- found: Builds a default 'dir'-kind Node with the given path/name and all other fields (loc, lang, doc, score, hotspots, children, etc.) zeroed/null/empty, matching the shape of a leaf Node so directory and file nodes are structurally uniform in the tree.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `frameTree` — TANGLED
- spec 2 · read at `ef25db43c51a` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:12:58Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Builds a Node tree (dirs -> files -> functions) representing the codebase's function/file structure as it existed at a given frame `index` within `hist` (a HistoryScan of commits), rooted at `repoName`. It likely replays/aggregates the historical commit data up to that index into per-file/per-function nodes, mirroring the shape the sunburst visualization expects, but reconstructed from the historical scan rather than the live one.
- found: Replays the history scan up to `index`, builds/reuses a dir and file tree via recursive path-splitting helpers, and for each function present in that frame either creates or looks up a pooled Node (cached per `hist` object across frames so identity/path/lang aren't reallocated every frame), updating only the frame-varying fields (loc, lastAuthor, score). Finally aggregates stats up the tree and collapses it before returning.
- predicted: most · documented: most · derivable: no · legible: some · trap: no
- note: Got the overall shape right but missed the cross-frame node-pooling/caching optimization and the final aggregate+collapse steps.

### `scopedCommits`
- spec 2 · read at `f6f52fa3d470` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:30Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Returns indices into hist.commits for commits that touched a path under `scope`. If scope is '' (whole repo), it returns all commit indices. Otherwise it likely iterates hist.commits, checking each commit's changed file paths against the scope prefix (e.g. startsWith), collecting matching indices.
- found: Builds a boolean map over hist.paths for segment-boundary match against scope, then filters commit indices whose files array has any file index in scope. Returns all indices when scope is empty.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs explained the design rationale (why scoped filtering is safe for drawing but not for re-folding) which isn't derivable from the code itself, but didn't mention the segment-boundary matching detail that the code comment called out.

### `posOf`
- spec 2 · read at `8edae688f93f` · commit `51b9d8d` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:22:31Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Searches the sorted `frames` array of real commit indices for the last position whose value is <= `index`, returning that position, or -1 if index precedes all frames — likely via binary search or a linear scan from the end.
- found: Binary search over sorted frames[] for the last index whose value <= index, returning -1 if none.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

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

### `widthPerPx` — TRAP
- spec 2 · read at `ba81f995f47e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:49:33Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Measures how wide `text` renders per unit of font size, using a canvas 2D context's `measureText` at some reference font size divided by that size, memoized in a cache keyed by text+weight since the same names get queried every animation frame. Falls back to a per-character width estimate when no canvas context is available (tests or a browser denying canvas), to avoid throwing.
- found: Memoizes text-width-per-pixel-of-font-size in a Map keyed by "weight|text", lazily creating a canvas 2D context on first use (or falling back to null if unavailable). When a context exists, it sets ctx.font using weight+reference size+family, measures via measureText, divides by the reference size, and multiplies by 1.06 to compensate for measureText undercounting ink vs advance width. Without canvas, falls back to text.length * 0.6 as a rough per-character estimate.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: Missed the 1.06 ink-vs-advance fudge factor; also a comment claims the cache key is "keyed on the FACE too" but the visible key is only weight|text, which reads like a leftover/inconsistent comment or an implicit assumption that font family never varies at call sites.

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

## web/src/lib/population.ts

### the file itself — QUIRKY
- spec 2 · read at `dcfeb20f2e65` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:59:24Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small utility module with two functions: populationOf(x) extracts/looks up a population number for some entity (place/region/row), and shareBelow(threshold) computes the proportion of a population falling below a given threshold (e.g. income or age cutoff). No header docs — treated as self-evident utility code, likely feeding a chart or stat display elsewhere in the web app.
- found: populationOf walks a repo's function tree (a Node from ./api) and builds three ascending-sorted numeric arrays — loc (all functions), heat (temperature of analyzed ones), and commits (90-day commit counts for ones with history) — as comparison populations for the whole repo, excluding synthetic 'rest' rollup wedges. shareBelow binary-searches a sorted array to find the strict share of values below v, returning null if the population is smaller than MIN_POP=20 to avoid misleadingly precise percentiles.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: I predicted a demographic/place-based population utility (populationOf(x) for one entity); it's actually a code-metrics distribution builder for percentile-ranking functions across a whole repo (LOC/heat/commit-churn), with shareBelow matching my guess structurally but populationOf being a whole-tree aggregator rather than a per-entity lookup.

### `populationOf` — QUIRKY — TRAP
- spec 2 · read at `896819b96269` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:45:34Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the node tree from root, collecting some numeric metric (e.g. score/heat) from every node into a flat array, then sorts it and returns it wrapped as a Population object — used by shareBelow to compute percentile rank of a given value against the whole tree's distribution.
- found: Walks the tree collecting three separate sorted arrays (loc, heat, commits) only from real 'func' nodes (excluding synthetic 'rest' rollup wedges that stand in for collapsed crowded bands), with heat/commits conditionally included based on whether the node was analyzed / has age data, and returns them as a Population object.
- predicted: some · documented: none · derivable: yes · legible: full · trap: yes
- note: Missed that it's three parallel metrics rather than one, and the deliberate exclusion of synthetic 'rest' rollup nodes from their own comparison population.

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

### `layout`
- spec 2 · read at `9e2b2db6405f` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:41:55Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the tree from root, assigning each node an angular span (start/end angle) proportional to its line count within its parent's span, and a radius/ring based on depth, up to maxDepth. Children are sorted either by size (default) or by heat if opts requests it, then packed sequentially into the parent's angular range, producing a flat Layout array of arcs with position info for rendering.
- found: Recursively walks the tree, assigning each node an angular wedge proportional to its weight (loc, or 1 if opts.even) within siblings sorted biggest-first or by heat, starting at 9 o'clock. Wedges below minAngle are culled (with hidden dir/file counts tracked) unless they're functions, which always render as dots.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The doc snippet given was about a stale comment being reattached/corrected elsewhere in the codebase, not actually documentation of what layout() does — so it didn't help predict the body at all.

### `arcPath` — TRAP
- spec 2 · read at `e48073887a6d` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:09:49Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes the four corner points of a donut wedge (converting from clockwise-from-12-o'clock angle convention to standard trig coordinates), then builds an SVG path 'd' string with an outer arc, a line to the inner radius, an inner arc back, and a closing line — including a large-arc-flag calculation for spans over 180 degrees.
- found: Matched the general wedge-path construction (outer arc, line to inner, inner arc back, close) with large-arc-flag logic, but missed the special-cased full-circle branch that draws two half-circle arcs since a 360-degree span can't be expressed as a single SVG arc command.
- predicted: most · documented: some · derivable: no · legible: most · trap: yes
- note: The full-circle degenerate case (start==end angle) is a real trap for anyone editing this without noticing the special branch.

### `aggregate`
- spec 2 · read at `92b13aaebdfc` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:24Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Builds a synthetic Node standing in for a group of small functions that couldn't be drawn individually: sums their lines, computes a LOC-weighted mean of the `score`/heat of only the ones that have actually been read (skipping unread members rather than treating them as zero), and returns a Node with a rollup flag, no real signature/docs, and filePath-derived path/id, with kind 'func' so the existing color/hover/mode code paths treat it like any other function.
- found: Builds a synthetic "N+" rollup Node summing member lines and LOC-weighted-averaging score fields (surprise, documented, churn, age, commits) only over members that were actually read by an agent/model, keeping the unread members' lines out of the weight. It also carries a `rest` count flag and keeps the actual member nodes as `children` (so the detail panel/drill can still reach them), plus derived `hotShare` and `analyzedShare` so a mostly-unread aggregate renders as such rather than borrowing confidence from its few read members.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

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

### `tileFunctions` — QUIRKY — TANGLED — TRAP
- spec 2 · read at `878259fa9e6b` · commit `10d6afa` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:47:18Z · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Implements a squarified-treemap-like algorithm (using worstRatio/rowPlacement helpers) that subdivides the file's annular wedge (bounded by r0/r1 radially and a0/a1 angularly) into patches for each child function, sized proportional to each function's LOC so patch AREA (not just angular width) reflects lines of code. It packs functions into rows, and for files with too many functions to fit legibly, rolls the smallest/overflow ones up into a single combined slot rather than rendering illegible slivers, returning an array of Slot objects with computed radial/angular bounds.
- found: A squarified-treemap-style tiler: computes each function's proportional area, separates those that clear a minimum-patch floor from a tail that doesn't, promotes some tail functions (hot ones unconditionally, others bounded by a max-stretch factor) into a limited amount of leftover room, rolls the remaining tail into one aggregate node, then normalizes every member's wanted area by a single scale factor so nothing degenerates to zero, and finally packs rows greedily (row axis chosen by whichever dimension is shorter) using worstRatio/rowPlacement to keep patches near-square, preserving file order rather than size order for adjacency.
- predicted: some · documented: most · derivable: no · legible: some · trap: yes

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

### `geoOf` — TRAP
- spec 2 · read at `759f88eaeaaf` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T21:06:00Z · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Iterates the wedges array, and for each non-function wedge computes its drawn geometry (inner/outer radius from depth × band plus rInner, and start/end angle) applying a per-kind gap via gapOf, then stores it in a Map<id, Geo>; explicitly skips Func-kind wedges since those are drawn inside their file's band by tileFunctions rather than getting their own ring.
- found: Skips 'func' wedges, computes r0 from rInner + (depth-1)*band, and stores {a0,a1,r0,r1} in a map keyed by node id, with r1 shrunk by a per-kind gap.
- predicted: full · documented: most · derivable: no · legible: full · trap: yes
- note: Matches the doc's warning exactly: including func wedges here was the actual historical bug being guarded against.

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
