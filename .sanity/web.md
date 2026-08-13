# web — sanity assessment

265 of 265 read · 50 surprising

197 of these graded legibility under an earlier question and are not counted; see the note below.

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

## web/src/App.tsx

### the file itself — QUIRKY
- spec 2 · read at `5f2e377e8ae5` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:35Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This is the root React component file for the Sanity desktop app's window. It defines the main `App` component, which holds state for the currently-open project, polls the backend status endpoint, and renders a progress view (ProgressTrack/ProgressPane/ProgressStrip) showing how many functions/files have been assessed, plus a HistoryToggle and an Empty state when nothing is open. Helper functions (sameRun, sameIds, sameProjects, findById, parentOf) do identity comparisons across polls and tree lookups so the UI doesn't needlessly re-render or lose selection state, and useProgress is a hook wrapping the polling/state logic.
- found: It is indeed the root App component with progress polling and the identity-comparison helpers I expected, but it's a much bigger shell than predicted: it also wires up a Sunburst chart, git history scanning/CommitLog/HistoryBar, breadcrumbs, a code view, a sidebar, a detail pane, a colour-mode/legend system, theme loading/watching, splash dismissal, and a read dialog. My prediction covered the progress-polling core but missed most of the surrounding app surface (history, sunburst, code view, sidebar, colour modes, theming).
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: File has no header doc at all — its scope has to be inferred entirely from the ~30-line import block.

### `sameRun` — TRAP
- spec 2 · read at `86068e088b4f` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:19:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A field-by-field equality check between two run summaries (handling null/undefined on either side), comparing things like id/status/counts/timing used by the sidebar. Per the docs, it's missing a comparison on `assessed`, so updates to that field don't count as a change, causing the poll to reuse stale objects and freeze the agent panel.
- found: Null-safe field comparison of two run objects across running, stopping, live, spawned, finished, failed, readers, ended — notably missing `assessed`, exactly as the docs describe as the source of the stale-panel bug.
- predicted: most · documented: full · derivable: no · legible: full · trap: yes
- note: The docs essentially spell out the bug (missing `assessed` field) before revealing the code, so predicted='most' reflects that I got the shape right but named the missing field generically rather than knowing the exact field list.

### `sameIds`
- spec 2 · read at `6c45514e1a3d` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:40:58Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Compares two optional string-id arrays for equality — treats absent/undefined as an empty array, checks lengths match, then compares elements pairwise in order (not set equality), returning false on the first mismatch found.
- found: Exactly as predicted: nullish-coalesces both args to empty arrays, then checks length equality and pairwise element equality in order.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `sameProjects` — TRAP
- spec 2 · read at `0c7e62ba3910` · commit `2903db5` · read by claude-sonnet-4.5 · asked for sonnet · via claude · when 2026-08-13T05:42:02Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Compares two arrays of ProjectSummary for equality: checks length first, then iterates comparing each pair (likely by id, and a few mutable fields such as status/progress) to determine if the list has meaningfully changed, used to avoid unnecessary re-renders or state churn in App.
- found: Exhaustive field-by-field equality check across ~20 ProjectSummary fields (not a couple key ones), including nested comparisons via sameIds/sameRun for arrays/objects. The comments explicitly warn that omitting any field here causes stale UI (frozen highlights, stale dialog values), making the exhaustiveness itself the point and an intentional trap for future editors who add a field to ProjectSummary but forget to add it here.
- predicted: most · documented: none · derivable: yes · legible: most · trap: yes
- note: The in-code comments explain WHY the list must be exhaustive (frozen highlight, dialog reopening stale) — this is the real risk: a new field added to ProjectSummary silently won't be compared unless also added here.

### `findById`
- spec 1 · read at `977918682157` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Recursive tree search: return node if id matches, else recurse into children, return null if not found.
- found: Exactly that: checks node.id, recurses over node.children, returns first hit or null.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `parentOf`
- spec 1 · read at `c0cda91e70f7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the tree from node, searching for a child whose id equals id, and returns the parent node that directly contains it (or null if not found).
- found: Recursive search over children: for each direct child, if its id matches return the current node as parent; otherwise recurse into that child and propagate a hit up. Returns null if not found anywhere in the subtree.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `App` — QUIRKY — TANGLED
- spec 2 · read at `46286061ad71` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:42Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: The root React component: holds top-level state (list of projects, selected project, current run/progress, history visibility) and effects to load/poll that state via Tauri IPC commands. Renders the overall layout — sidebar/project list, the main content pane, ProgressTrack/ProgressPane/ProgressStrip for showing scan/analysis progress, an Empty state when there's no project, and a HistoryToggle — wiring callbacks between them using the helper functions (sameRun, sameIds, sameProjects, findById, parentOf) to diff state and avoid unnecessary re-renders.
- found: The root component: massive amount of state and effects covering project selection/polling (following whichever project an agent is working on via MCP), theme sync with the Rust menu, streamed score batching, git-history replay (scrubbable timeline with its own tree-per-commit), code view modal, CLI install dialog, and drill/crumb navigation through a sunburst tree. Renders sidebar, top row with mode switcher and history toggle, the sunburst or various fallback panes (progress/empty/error), a detail panel or commit log aside, and overlays for CLI install / read dialog / code view.
- predicted: some · documented: none · derivable: no · legible: some · trap: no
- note: My prediction correctly named the general shape (state + effects + layout with sidebar/progress/empty) but drastically underestimated scope — missed the agent-following inversion, history replay/scrubbing feature, theme menu sync, and CLI installer entirely; this is one of the biggest functions I've seen and reading it required holding many interacting pieces of state in mind at once.

### `useProgress`
- spec 1 · read at `022713725cb5` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Hook returning {pct, eta}: pct is done/total (0 if nothing yet, never null); eta estimates minutes remaining from elapsed time, withheld (null) until enough samples (20 items, 2%) exist for a stable estimate.
- found: Exactly as predicted: tracks a start timestamp via useRef/useEffect, pct = done/total or 0, eta = round((elapsed/pct - elapsed)/60) gated on done > 20 && pct > 0.02, else null.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `ProgressTrack`
- spec 1 · read at `02dad8fe74e4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Shared progress-bar track component: filled div sized by pct when progress known, indeterminate sweep animation otherwise.
- found: Renders a rounded track div; if progress is non-null renders a width:pct*100% filled bar with a width transition, else renders a div with class track-sweep for the indeterminate animation.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `ProgressPane`
- spec 1 · read at `fdcd9adcf3f5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Centered, wider progress indicator reusing the same progress bar as elsewhere, showing an optional label, for use on an empty pane rather than overlaid on a map.
- found: Centered flex column showing status text (progress done/total or fallback label), a ProgressTrack bar sized to min(320px,60%), and an ETA line in minutes via useProgress hook, when eta is not null.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `ProgressStrip`
- spec 1 · read at `8e80491e8cc2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a progress bar via ProgressTrack plus a label sentence above it; falls back to a default sentence about "the scan" when label is absent, handles null progress gracefully.
- found: Uses useProgress(progress) to get pct/eta, renders a label line (custom label + commit count, or default "Scoring X/Y functions"/"Reading the repo…" when no label/progress) alongside an ETA readout (\"~N min left\", <1 special-cased), then delegates the bar itself to ProgressTrack.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `HistoryToggle`
- spec 1 · read at `d488a001385a` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a toggle button beside the lens switcher for entering/exiting history/replay mode: `on` controls active styling, `busy` disables the button and shows a loading state, `onToggle` fires on click.
- found: A button with dynamic title text explaining what toggling does, styled via inline style (accent background when on, muted otherwise), disabled and dimmed with label 'Reading…' when busy, otherwise label 'History'.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `Empty` — QUIRKY — TANGLED
- spec 2 · read at `c802f4eaedc1` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:36:22Z · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders the first-run empty state: a single prominent "add a repo" call-to-action wired to onAdd, a card that checks/displays whether claude or codex is installed locally (a checkable prerequisite), and a small line at the bottom mentioning MCP as a secondary way to trigger a read. No pitch paragraph about what the rings mean, and no persisted dismissal state since the screen only shows while there are zero projects.
- found: Renders the first-run card: headline, "Add a repo" CTA, a checked-harness status line (which of claude/codex are installed), a demoted mention of `sanity check` from the terminal, and a whole additional CLI-on-PATH section that checks whether the `sanity` binary on PATH resolves to this app and offers a button to link it if not, with feedback on where it linked to and whether something else still wins on PATH.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: Missed the entire CLI-symlink/PATH-precedence section of the component, which is roughly half the body.

## web/src/CodeWindow.tsx

### the file itself
- spec 1 · read at `762905383664` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: The pop-out code window opened by CodeView's onPopOut — reads target repo/file, locates the file node via fileByPath, and renders CodeView alone without app chrome, likely via URL params.
- found: Standalone window spawned by open_code_window with repo/relPath props; re-resolves the file by calling listProjects/projectScan (re-fetching the app's scan state fresh, since a separate window is a separate JS context) rather than receiving a serialized node; watches system theme independently since it can't inherit the main window's setting; renders a custom draggable titlebar showing the relPath, then CodeView with no onPopOut/onClose (since this window IS the code view). No file-level doc comment exists, but the CodeWindow function itself has a thorough one explaining these design choices.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `fileByPath`
- spec 1 · read at `b2957f945f19` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks node's children, comparing path to find a matching file node; returns null if not found.
- found: Checks if current node is kind 'file' and path matches, returns it; else recurses into children returning first hit, or null.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `CodeWindow`
- spec 1 · read at `24f3c2c44870` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Looks up the file via fileByPath from fetched scan data for the repo/relPath, and renders the file's code view, with loading/error states.
- found: Syncs the stored theme preference, then finds the project by repo, fetches its scan, resolves the file via fileByPath, and shows error/loading states or a custom draggable titlebar plus a CodeView for the resolved file.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/AgentMascot.tsx

### the file itself — QUIRKY
- spec 2 · read at `915999d15278` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:03Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A tiny, doc-less file exporting a single small React functional component `AgentMascot` that renders a simple visual mascot/avatar (likely an SVG icon) representing the agent in the UI. Probably takes minimal props (size/status/className) and has little to no logic beyond returning JSX.
- found: A thin lazy-loading wrapper around the real mascot component (MascotFigure, which pulls in a ~1.2MB three.js bundle). It wraps MascotFigure in React.lazy + Suspense with a size-reserving placeholder fallback, so the heavy chunk is only fetched when a scan indicator actually appears rather than at app startup.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: Predicted a simple mascot-rendering component; the file is actually just a code-splitting/lazy-load boundary, with the real rendering delegated to MascotFigure.

### `AgentMascot`
- spec 2 · read at `5266beca935b` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:39Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that lazy-loads the real mascot renderer (likely a heavy 3D/canvas component) via React.lazy/Suspense, rendering a fixed-size placeholder div (sized by `size`) as the Suspense fallback so the row doesn't reflow while the chunk loads. Passes size, events, and state through to the loaded component once ready.
- found: Suspense wrapper around a lazy-loaded MascotFigure, with a same-sized empty span as fallback to prevent reflow, passing size/events/state through unchanged.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/Bloom.tsx

### the file itself
- spec 1 · read at `60c22cf4f758` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Empty-pane decorative illustration: petals/seedHead compute rose-curve and phyllotaxis math for one flower, Flower/Leaf are the SVG motifs, Tile arranges/repeats them across the pane in a scattered layout, Bloom is the exported top-level component.
- found: Same core components as predicted, but the arrangement is not a loose scatter — Tile places flowers and leaves precisely at the 6-fold, 3-fold and 2-fold centres of a p6m wallpaper group on a hexagonal lattice, and Bloom repeats the whole tile 3x3 (via SVG pattern + explicit offset copies) so edge-straddling motifs are supplied by neighbours instead of being clipped.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I assumed a genuinely scattered/random layout; the file's own header explicitly rejects that reading — placement is fully determined by wallpaper-group symmetry, which is the opposite of scatter despite the visual effect being described that way.

### `petals`
- spec 1 · read at `b23b73eb35ae` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Samples the fattened rose curve formula over theta, builds SVG path d string with M/L commands, closed with Z.
- found: Exactly that: 240 steps over 0..2pi, r = A*|cos(K*th)|^(1/P), pushes M/L svg commands, joins and closes with Z.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: File doc explains the math (why fractional power) but doesn't mention constants A/K/P or step count, which live elsewhere in the file.

### `seedHead`
- spec 1 · read at `b0599e867627` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Generates seed positions for the flower's center using a golden-angle phyllotactic spiral (sunflower seed pattern), returning an array of small circle positions and radii.
- found: Loops n=1..13, angle = n*GOLDEN, radius = A*0.115*sqrt(n) (Vogel's model), pushes {cx,cy,r} with fixed dot radius A*0.05 — exactly the phyllotactic seed-head pattern predicted.
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `Flower`
- spec 1 · read at `9c287bf640f8` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders SVG group combining petals rose-curve path and a seedHead at center, scaled by s prop.
- found: Renders a scaled group with the PETALS path filled (outer bloom), the same PETALS path redrawn unfilled at 0.45 scale (an inner outline reusing the identical curve rather than a separate shape, since the rose scales linearly), plus a set of precomputed SEEDS circles at the center — all colored via currentColor.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: Comment explains a neat trick: because a rhodonea's radius is linear in `a`, scaling the same PETALS path by 0.45 exactly reproduces the smaller rose rather than needing a second curve computation.

### `Leaf`
- spec 1 · read at `b7fea705e457` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders an SVG vesica shape via a path built from two arcs, scaled by s.
- found: Renders a <g scale(s)> containing a path with two symmetric arcs (radius R = L*1.16) forming the vesica lens shape filled/stroked with currentColor, plus a horizontal midline stroke.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Tile` — QUIRKY
- spec 1 · read at `1b3b535c7b4d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders one flower placement unit with randomized position/rotation/scale, composing Flower, Leaf, and seedHead, used by Bloom to scatter many across the pane.
- found: Renders a fixed repeating tile using three predefined coordinate lattices (SIXFOLD, THREEFOLD, TWOFOLD): larger Flowers at SIXFOLD points, smaller rotated Flowers at THREEFOLD points, and rotated Leaf elements at TWOFOLD points. No seedHead, no randomization — positions/rotations come from fixed arrays.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

### `Bloom` — QUIRKY
- spec 1 · read at `41d6c7d9f291` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Top-level component tiling Flower/Tile motifs across the pane in a grid, wrapped in a container div with className passthrough.
- found: Renders an SVG with a repeating <pattern> (fixed T x H tile size) containing several <Tile/> instances placed at OFFSETS to break up strict grid tiling, then fills a full-size <rect> with that pattern. No randomization visible at this level; className passed straight to the svg.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: File doc's mathematical detail (rhodonea curve etc.) lives in petals/seedHead, not in this compositing function, so counted docs as none for this specific function.

## web/src/components/CodeView.tsx

### the file itself
- spec 1 · read at `66673a4454f9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a single source file with a lightweight built-in syntax tokenizer, a heat-colored gutter/wash per line keyed to some per-function metric (age/churn), and a canvas minimap (à la VS Code) for whole-file navigation, tying together tokenize, ownerByLine, rampStops/rampAt, and Minimap into the exported CodeView component.
- found: Matches the prediction closely: CodeView fetches file source via readSource, maps each line to its owning function node (ownerByLine) to paint per-line heat (paintHeat/heatColor) as both a full-strength gutter bar and a faint background wash, tokenizes each line for scenery-level syntax highlighting, and renders a canvas Minimap (indentation-profile bars tinted by heat, draggable/clickable, with a viewport rectangle) alongside. Additionally handles: scrolling to a specific revealed function via a nonce-keyed effect (with a documented dependency-list gotcha about object identity vs. re-renders), pop-out/close buttons, and error/loading states. No file-level header doc exists — only per-function/section doc comments — despite substantial rationale embedded throughout (e.g. why not a real highlighter, why the minimap has heat, why the dependency list is what it is).
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The file has no top-level header at all, yet is unusually well-documented at the section level — the docs field being empty undersells how explained this file actually is.

### `tokenize`
- spec 1 · read at `d364f0c54271` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Breaks a line into Tok tokens for syntax highlighting via regexes classifying strings, comments, keywords/identifiers, numbers, punctuation/whitespace in priority order.
- found: Single combined regex with alternation groups (comment|string|num|word|space|punct) run via exec loop in priority order; words checked against KEYWORDS regex to distinguish tok-key from tok-plain; comment allows //, #, and /* */ styles.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `ownerByLine`
- spec 1 · read at `39b85adfda97` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Walk file's children (functions), fill in every line from start to end into a Map<line, Node> for O(1) lookup of which function owns a given line
- found: Iterates file.children, skips non-func kinds and funcs with null line, computes end as fn.endLine ?? fn.line, and sets m[l] = fn for every line l in [fn.line, end]
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `rampStops`
- spec 1 · read at `5a30a1533442` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Reads five --heat-N CSS custom properties as hex colors from computed style, parses each to an [r,g,b] tuple, returns them as an ordered array for canvas interpolation.
- found: Exactly that: maps indices 0-4 to --heat-{i} custom properties, defaults to #888888 if unset, parses hex via parseInt and bit-shifts into [r,g,b].
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `rampAt`
- spec 1 · read at `815003ab0e2f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Interpolates a color along a gradient defined by an array of RGB-triple stops, using t (clamped 0..1) to pick position, and returns a CSS rgb() string. Likely used for coloring a minimap/heatmap by some intensity metric.
- found: Clamps t to [0,1], scales into stop-index space, linearly interpolates between the two bracketing RGB stops, and returns a `rgb(r g b)` CSS string.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `Minimap`
- spec 1 · read at `3836493a642e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Canvas minimap drawing one bar per line (indent to end), colored by owner heat, with a viewport rectangle over the scroll position and click-to-scroll behavior.
- found: Draws to a canvas: per-line heat-tinted background rect (via rampAt/paintHeat, skipped for non-analyzed owners), then an indentation bar for the code itself (dimmer alpha for comment lines), then a translucent viewport rect+stroke showing current scroll position/extent. Pointer down/move implements click-and-drag seek that centers the clicked line, VS-Code-style. Handles devicePixelRatio scaling and clamps line height to at most 3px so long files still fit.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Missed the devicePixelRatio canvas scaling and the comment-dimming detail, and the drag-to-seek (assumed click only).

### `CodeView`
- spec 1 · read at `a4822e25ff39` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Fetches file source, tokenizes lines, maps lines to owning functions via ownerByLine, colors gutter by heat/temperature via rampAt/rampStops, renders a Minimap, handles scroll-to-reveal for a selected function, shows optional pop-out/close buttons, wires click-to-select.
- found: Async-loads source via readSource with loading/error states; memoizes owners via ownerByLine; scrolls to a revealed function using a carefully minimal dependency list (revealN, ready) to avoid re-scrolling on every tree rebuild from the agent-report poll; renders each line as a table row with a heat-colored background wash and full-strength gutter bar via heatColor/paintHeat, tokenized text, and a \"not measured\" label for unanalyzed first-lines; tracks scrollTick to drive the Minimap without re-rendering the table; renders optional pop-out/close buttons.
- predicted: most · documented: some · derivable: no · legible: most · trap: no

## web/src/components/ColourKey.tsx

### the file itself
- spec 1 · read at `7801f0beaf20` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A component file rendering the colour legend/key that accompanies the sunburst's colour-mode encoding: probably a Legend showing what colours mean for the current mode (categorical swatches or a heat gradient), a ModeSwitcher for toggling between colour modes (surprise/age/churn/owner/etc.), and a ColourLegend wrapper combining them, styled to sit as a small overlay/panel near the graph.
- found: Matches closely: `Legend` branches three ways — categorical swatches (with an 'Other' overflow bucket), a single square swatch for the boolean 'traps' mode (deliberately not a gradient), and a labeled heat-ramp gradient for the remaining ordinal modes, each walking the same ramp the wedges use. `ModeSwitcher` is a segmented-control tab bar for switching ColorMode, with a disabled state used during history playback. `ColourLegend` wraps Legend in a bordered card and appends stale/unread swatch counts, gated to only appear in the 'surprise' mode since those are facts about readings. No file-level doc header exists — the per-component comments carry all the reasoning instead.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `Legend`
- spec 1 · read at `44e6033d6d3a` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Branches on mode: categorical modes get a swatch list of categories; continuous/ordered modes get a gradient bar with low/high end labels.
- found: Three-way branch: categories.length>0 renders swatches (capped at SLOTS, with an 'Other' bucket for overflow); mode==='traps' renders a single square swatch since a boolean has no continuum; otherwise renders a 24-segment gradient bar between named lo/hi end-labels, using the ramp matching the mode so the key matches the wedge colours.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ModeSwitcher`
- spec 1 · read at `7c0381eeb3d3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a row of buttons/pills, one per ColorMode, highlighting the active mode and calling onMode when clicked; when disabled, buttons are non-interactive but still show the selected mode via styling.
- found: Renders a segmented control (role=tablist) with one tab button per ColorMode key, active one shown as a raised accent pill; disabled greys the whole track via opacity and disables the buttons, with a tooltip explaining why (pinned during history playback) versus a keyboard-shortcut hint otherwise.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the tablist/tab ARIA semantics and the dual-purpose tooltip (shortcut hint vs disabled explanation).

### `ColourLegend`
- spec 1 · read at `e9116d238fb8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Renders a bordered box containing the base Legend plus optional stale/unread swatch rows, shown only when their counts are >0.
- found: Renders bordered box with <Legend/>, plus a conditional row for stale/unread swatches gated by BOTH paintsFromReadings(mode) AND (stale>0 || unread>0), since grey/hatch textures only mean something in the one mode painted from readings; swatches are hand-reproduced CSS matching Sunburst's actual fill styles.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

## web/src/components/CommitLog.tsx

### the file itself
- spec 1 · read at `368f71e8ef43` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering a scrollable list of commits alongside the main visualization (rings/map), with a memoized Row subcomponent per commit, a `stamp` helper formatting timestamps, and logic to auto-scroll/highlight the row matching the current playback position; clicking a row likely jumps playback to that commit.
- found: Exactly that, plus significant performance engineering documented inline: fixed ROW_H avoids DOM measurement so the playhead position is O(1) arithmetic; rows are memoized and styled only via two absolutely-positioned overlay elements (a selection background baked into the row itself, and a dimming scrim over upcoming commits) rather than per-row re-styling, so a 300-commit/sec replay doesn't re-render every row; a useLayoutEffect follows the playhead by directly setting scrollTop (not smooth-scroll, which can't keep up) and only recenters while playing vs. minimally-revealing when paused/scrubbing, distinguishing self-caused scroll (a ref flag) from playhead-driven scroll; the header intentionally mirrors the Summary pane's header pixel-for-pixel since they're one column under two modes.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `stamp`
- spec 1 · read at `007bc6229dfa` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Format a unix timestamp into a short human-readable date/time string for the commit log, using Date and toLocaleDateString or toLocaleString
- found: new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) — short 'Mon Day' format, no time component, seconds-to-ms conversion
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `CommitLog` — QUIRKY
- spec 1 · read at `65e4c330112e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders a memoized static list of commit rows with two absolutely-positioned overlays (a cursor and a scrim) that move without re-rendering rows; auto-scrolls to follow the playhead only while playing, and clicking a row calls a stable onIndex to seek.
- found: Renders a header (name/repo/loc/functions/commit counts, with scope-narrowed and truncated-history messaging) plus a row list where selection is a `selected` prop on each Row (not a separate cursor overlay) and only the dimming scrim is a separate absolutely-positioned, height/offset-computed element. A useLayoutEffect scrolls to follow the playhead — centering while playing, minimal reveal while paused/scrubbing, skipped entirely when the position changed via a click in this component (tracked via a ref) — and an empty-frames case prints an explanatory message instead of a list.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

## web/src/components/Crumbs.tsx

### the file itself
- spec 1 · read at `f854d81892ed` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Breadcrumb-trail component rendering the ancestor path from root to current node as clickable segments, plus an up button, for navigating back up the tree.
- found: Exactly that shape (nav with ol of clickable crumb buttons plus an Up button), but the JSDoc reveals real history/design reasoning: trail is the focused node's ancestry (not the drill/click stack), collapsed single-child chains are one node whose embedded slashes are dimmed while inter-crumb separators stay bold, and every level including the current one is a real button (re-centers view).
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: File doc explains a specific past bug (drill stack vs ancestry) that isn't derivable from the code alone — it's institutional memory, not description of current behavior.

### `Crumbs`
- spec 1 · read at `f8c65b6cfc88` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Renders trail as clickable crumbs calling onGo(index), dims slashes within collapsed-chain names, and includes an Up button calling onUp.
- found: Matches: each crumb is a button calling onGo(i), current one styled bold/foreground and marked aria-current, others accent-colored; separators between crumbs are opacity-50 while inner slashes of a collapsed chain's name are opacity-40; Up button disabled when onUp is undefined.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/Detail.tsx

### the file itself
- spec 1 · read at `370e7a058a92` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: The Detail side panel component for a selected function/file/directory: markdown rendering of agent prose, copy button, rank/measure/grade helpers for the contents list, provenance sentence, and a Contents sub-list, culminating in the main Detail component.
- found: Matches: Markdown (tiny inline-only renderer for code/bold/italic), CopyButton (clipboard copy with 'Copied' feedback gated on promise resolution), rank/measure (per color-mode sort key and displayed quantity for Contents rows), grade (folds pre-grade readings to scale ends), provenance (one-sentence source description), Contents (sortable children list), and Detail (the main leaf/container panel showing dials, expected/found, trap/note, stale-reading warnings).
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `Markdown`
- spec 1 · read at `01041ca9fd9e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Splits text on backtick code spans first (rendering literally as <code>), then within remaining plain segments handles **bold**/*italic*, then splits the whole text on blank lines into <p> blocks; returns React nodes rather than using a full markdown parser.
- found: Exactly as predicted: paragraphs split on /\n{2,}/, each paragraph run through inline() which first splits on backtick spans (rendered as styled <code> using color-mix with currentColor), then splits remaining chunks on **bold**/*italic* regex, wrapping plain text in <span>.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `CopyButton`
- spec 1 · read at `e3b423a23636` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Copy button calling navigator.clipboard.writeText, setting a 'copied' confirmation state only on success (not on failure), with title used for tooltip.
- found: Exactly that: writes text to clipboard, sets `done` true only on resolve and false on reject, auto-reverts done after 1200ms via useEffect/timeout, swaps between a copy icon and a checkmark icon, stops click propagation, and swaps the title/aria-label to 'Copied' while done.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `rank`
- spec 1 · read at `ebcfd7520cf3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Switches on mode to pull the numeric value matching the ring color (surprise/grade score, staleness, etc.) from the node's score, for use in sorting the list.
- found: Returns -1 if no score; for 'churn' mode returns churn (or -1 if ageDays null); for 'age' mode returns negative lastTouchedDays (recent sorts first, with a comment explaining why); otherwise falls back to wedgeHeat(n).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `measure` — QUIRKY
- spec 1 · read at `8b9cc0cc0cbf` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Picks the relevant numeric field of Node for the given ColorMode, formats it as a short unit-bearing string, returns null when the mode has no applicable value.
- found: Switches on mode: blame returns null; churn shows `{commits}×` (or em-dash); age shows 'today' or '{days}d ago'; surprise shows a heat-word or rounded degree from wedgeHeat/readingWords; default (loc-based modes) shows n.loc.toLocaleString().
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `grade`
- spec 1 · read at `640703ed95d9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns predicted grade if present, else folds a legacy surprised boolean to 'none' (true) or 'full' (false).
- found: Exactly: r.predicted ?? (r.surprised ? 'none' : 'full').
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `provenance` — QUIRKY
- spec 1 · read at `8e1a3baa6031` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns a one-sentence attribution string naming which model/agent produced the score shown for this node.
- found: Branches on isAnalyzed and score.source ('agent' vs 'model' vs default) to produce distinct sentences: 'Not read yet', 'Read by {model · by} at {time}' for agent reads over MCP, or 'Measured by {model}' / 'Measured by the offline proxy' for automated scoring.
- predicted: some · documented: some · derivable: no · legible: full · trap: no

### `Contents`
- spec 1 · read at `8525ac0c5621` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders node.children as a row list sorted by heat/rank for the current color mode, unread items sink to bottom, rows support click-select/double-click-drill like the ring.
- found: Confirmed: sorts by seen-first, then rank(mode) desc, then loc desc; renders swatch via colorFor, name, and measure(c,mode) as the mode-specific metric column (not a fixed line count); label switches Contents/Functions by node.kind; returns null if no children.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Detail`
- spec 1 · read at `5427f8e0f383` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders the detail pane for the selected node (or describes the focused subtree when nothing is selected), showing docs/markdown, grading/coloring, population rank, an owners breadcrumb, and drill/select callbacks; composes peers like Summary, Contents, Dials, Markdown, CopyButton.
- found: Matches the prediction closely: branches on no-selection (Summary of focus, or idle Bloom state), non-leaf nodes (delegates to Summary with a path/footer/about), and leaf functions (full panel with breadcrumb path, trap badge, Dials, FunctionRanks, expected/found agent reading with stale/warm-read/note/trap styling, model hotspots evidence, Contents list, and a pinned provenance footer).
- predicted: most · documented: none · derivable: no · legible: most · trap: no

## web/src/components/Dials.tsx

### the file itself
- spec 1 · read at `5a1e3c637102` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A React component file rendering a row of gauge/dial widgets that summarize a code node's assessment metrics (something like surprise score, documentation coverage) for the sidebar/detail panel, with small helper functions for computing shares and grades.
- found: Broadly right: exports a reusable `Gauge` (semicircular SVG dial, colored by a per-lens ramp, showing either a percentage or a four-step word) and a `Dials` component that renders exactly four of them — Surprise/Surprising, Docs/Doc'd, Churn/Churning, Legibility/Legible — for any node (function, file, or directory) in the assessment tree. Helper functions (fraction, graded, fileDocShare, matches, badShare) compute grade-to-rung mapping and aggregate shares across a subtree. What I missed: the file has no top-level banner doc at all (docs:[] is itself the finding) despite each function carrying extensive inline rationale about specific UI decisions (why dials replaced bars, why the row is fixed at four columns, why value and rampValue diverge, why words vs percentages differ by node kind).", "cold": true, "primed": false}
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `Gauge`
- spec 1 · read at `6757d6425ca6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders a 180-degree SVG arc gauge: a background track plus a foreground arc swept to `value`, colored by sampling `ramp` at `rampValue ?? value` (or a neutral accent if no ramp), with the numeric percentage or `word` printed in the center, label below, and `hint` as a tooltip; an `unread` flag suppresses the value arc/needle and shows a placeholder instead.
- found: Confirmed: fixed R=40 semicircle path, clamps v and c, track always drawn in var(--border), value arc drawn via strokeDasharray only when not unread (with butt cap at 0 to avoid a stray dot), fill from heatColor(ramp) or var(--accent) fallback, center text shows '—' when unread else word or rounded percentage, with font size dynamically shrunk to fit longer words; label wraps below.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `fraction`
- spec 1 · read at `af62d113920a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Formats a rung integer as a fraction string like n/N for display in a gauge component.
- found: Formats rung as `${rung}/4` — fixed denominator of 4, not a parameterized N.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `graded` — QUIRKY
- spec 1 · read at `22b53db3bee7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Switches on which to return node.score's legible or documented grade, or undefined if unscored.
- found: Returns undefined unless matches(node) and node.agent exists and is not stale; for 'documented' forces 'none' when derivable is true (else the raw documented grade); for 'legible' goes through legibleOf() so a rewritten-question reading reads as ungraded, matching the map's own treatment.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `fileDocShare`
- spec 1 · read at `0a0470425d18` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks files and functions, counts total nodes and undocumented ones, returns fraction undocumented or null if empty.
- found: Recursively walks file/func nodes; only counts a node toward `read` if it has actually been graded for `documented` (via graded()), and counts it as `bare` if that grade is 'some' or 'none' (not just 'none'); returns bare/read, or null if nothing was graded.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The denominator is graded nodes, not all nodes, and 'some' counts as bare alongside 'none' — I only anticipated 'none'.

### `matches`
- spec 1 · read at `de224c315994` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a tree node is a leaf type (file or function) that can carry a reading, as opposed to a directory/aggregate node.
- found: Exactly that: returns true if n.kind is 'func' or 'file'.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `badShare`
- spec 1 · read at `53a6f96217bd` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks subtree, sums loc for graded func nodes as denominator and loc for 'some'/'none' grades as numerator for the given lens, returns fraction or null if no graded lines.
- found: Exactly that: walks func nodes, sums n.loc into graded_ when graded() returns truthy, adds to bad if grade is 'some' or 'none', returns bad/graded_ or null if graded_ is 0.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Dials`
- spec 1 · read at `2fdbc7ff6ed0` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders exactly four Gauge dials for a node using helper score functions, always showing all four columns even when a metric is absent, with an empty track/em-dash placeholder instead of collapsing.
- found: Renders four specific Gauge dials — Surprise/Surprising, Docs/Doc'd, Churn/Churning, Legible/Legibility — each switching label, value, and word depending on whether the node is a container (share-based percentage) or a function (graded word), with ramp always colored by the "gap" and `unread` flag driving the em-dash placeholder when a measurement doesn't apply.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

## web/src/components/FileZoom.tsx

### the file itself
- spec 1 · read at `3fb3d24d93f0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A React component rendering the zoomed-in view of a single file, expanding its wedge into the fan layout from fan.ts so the file's functions appear as sub-sectors around a hub, animating the transition from the collapsed treemap wedge to this expanded sector view; fanOf computes the destination sector geometry.
- found: Confirmed the core idea — a file's wedge treemap opens into a bigger polar 'fan' sector, animated by an eased t from a `from` sector to the `fanOf` destination, reusing the same squarified tiling (tileFunctions) and affine (theta, v) mapping so no re-tessellation happens during the transition. Additional detail not predicted: it also renders trap-pulse markers, stale-reading hatch overlays, an aggregate 'rest' rollup-dots patch for functions too small to tile individually, and settled-gated name labels (fitLabel/WedgeLabel) that only appear once the transition finishes.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The file has extensive JSDoc-style prose comments throughout (module doc plus per-prop/per-block rationale) that go well beyond a typical header — documented:full is unusually generous for this codebase's average.

### `fanOf`
- spec 1 · read at `4c58496076c4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Wrapper computing the fan Sector for a wedge, substituting a default bearing when from is null, delegating to fanFor.
- found: One-line delegation: return fanFor(from, paneAspect) — the null-handling and default-bearing logic described in the docs actually lives inside fanFor, not here.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs describe fanOf's exported purpose (letting the caller fit its viewBox) but the null-source default-bearing behavior is fanFor's, not visible in this one-line body.

### `FileZoom` — TANGLED
- spec 1 · read at `c026cc80121a` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a file's functions as colored patches in a fan layout, animated by t/from, colored via mode/ranks/ageSpan, with onSelect/onDrill/onHover interactions and settled gating the transition.
- found: Broadly correct on shape, but missed: squarified treemap tiling in polar coordinates (tileFunctions/arcOf), a stale-reading hatch overlay, an aggregate 'rest' rollup patch with dot texture for functions too small to draw individually, trap-pulse styling reused from the ring view, unanalyzed-function fallback color/opacity, and that names only render once settled with fitLabel bend/clip logic.
- predicted: most · documented: none · derivable: no · legible: some · trap: no

## web/src/components/HistoryBar.tsx

### the file itself — QUIRKY
- spec 1 · read at `9826f2e9470c` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A component rendering a horizontal bar/timeline visualization of assessment history over commits, with a pace helper computing a rate for coloring/sizing segments.
- found: It's a video-player-style transport bar for replaying repo history: play/pause button, scrub range input over commits, and duration-preset buttons (3m/60s/etc, via `pace` formatting seconds as a label). Drives an animation-frame clock keyed on elapsed time (not per-tick steps) so playback duration is honest regardless of repo size, plus keyboard shortcuts (space, arrows) that defer to a focused range input.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: Not a data visualization at all — it's a playback transport control; `pace` just formats a duration in seconds as a short label like '3m' or '30s' for the preset buttons, not a rate.

### `pace` — OBSCURE
- spec 1 · read at `f97e230c1fec` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes a playback interval/speed string scaling inversely with total, for animation pacing through history.
- found: Formats total seconds as a human-readable duration label: minutes rounded (e.g. '5m') if total >= 60, otherwise seconds (e.g. '45s').
- predicted: none · documented: none · derivable: yes · legible: full · trap: no

### `HistoryBar` — QUIRKY
- spec 1 · read at `a70abe5b9f29` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A play/pause button, a scrub range input over frames/index, and duration buttons, driven by a requestAnimationFrame or interval loop that advances index while playing.
- found: Matches the broad shape (play button with SVG icons, range input scrubber, DURATIONS button row using a `pace` helper for labels) but the real complexity is in three hooks I didn't anticipate: a rAF clock that tracks a fractional `cursor` ref separate from the emitted integer index (to stay accurate at both slow and fast playback rates), an `emitted` ref to distinguish clock-driven index changes from external ones (scrub/log click) so the fractional accumulator isn't reset every render, stopping (not looping) at the end, rewinding to start if play is pressed at the end, and a full keyboard handler (space to toggle, arrows to step with shift-stride of 10, ignored when a range input has focus or a modifier key is held).
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc described only the transport's UI role/philosophy, not the fractional-cursor clock or keyboard handling, which is most of the function's actual complexity.

## web/src/components/MascotFigure.tsx

### the file itself — QUIRKY
- spec 2 · read at `38b35ed56074` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:16Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Defines a MascotFigure React component rendering an illustrated mascot whose mood/expression reflects assessment results. loadOrMint persists a stable mascot identity (e.g. via localStorage) so the same identity/variant recurs across sessions rather than re-randomizing each time; pick selects an asset/variant from a small set; moodFor maps grade/score data to a mood category used to pick the expression.
- found: Defines the MascotFigure component: persists/mints a mascot identity via localStorage (loadOrMint), maps recent agent tool calls to mood-based animation sets (moodFor/MOODS) played on a beat as a replay queue, drives a sleeping/working/stopping state machine synced to run state, and hides a 6-click-within-2s easter egg to remint a fresh random mascot.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `loadOrMint`
- spec 1 · read at `296f66e763ec` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Reads a saved MascotConfig from localStorage; if absent, mints a new random one via pick and persists it.
- found: Tries to load and JSON-parse a saved config from localStorage, swallowing errors; on miss or failure calls randomizeMascot() to mint a fresh one, tries to persist it (also swallowing storage errors), and returns it.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `pick`
- spec 1 · read at `cfbf6454f730` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Selects a random element from the array via Math.random() * length.
- found: Exactly that: from[Math.floor(Math.random() * from.length)].
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `moodFor`
- spec 1 · read at `cda216f69fc2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Maps a tool name to a set of candidate mascot animations for that action, falling back to a default set if unrecognized.
- found: Finds the first entry in a MOODS table whose regex `match` tests the tool name and returns its `play` animation list, defaulting to DEFAULT_PLAY if none match.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `MascotFigure` — QUIRKY
- spec 2 · read at `1714d15ae6d3` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:24Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: React component rendering an SVG/image mascot. Computes mood from `events` via `moodFor`, picks a variant via `pick`, loads/generates the asset via `loadOrMint` (likely cached), and renders it at the given `size` with visual differences based on `state` (sleeping/working/torn down), possibly with animation.
- found: A stateful wrapper around a <Mascot> imperative scene: it mints/loads a persisted random mascot config, drives sleep/wake/stopping animations off the `state` prop (not events) via requestAnimationFrame, replays fresh events (by sequence number, capped, staggered by timers) as mood animations only while working, and implements a hidden six-click-to-remint easter egg that persists a new random config to localStorage and remounts the scene via a key.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: Prediction captured the loadOrMint/pick/moodFor pieces but missed the state-driven sleep/wake/stopping animation loop, sequence-based event replay, and the six-click remint easter egg entirely.

## web/src/components/Overlay.tsx

### the file itself
- spec 1 · read at `dc471b0c1afa` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A translucent full-screen backdrop overlay, probably for a loading/error/status state.
- found: A generic dimmed backdrop that centers a modal panel (children); clicking the backdrop calls onClose. Has an inline JSDoc comment I hadn't seen, documenting the click-to-close/stopPropagation contract.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `Overlay`
- spec 1 · read at `9b14ec9655fd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Fixed full-screen dimmed backdrop, flex-centered, onClick calls onClose; wraps children in an inner panel that stops click propagation.
- found: Single div: fixed inset-0, flex centered, semi-transparent black background, onClick=onClose, renders children directly with no inner wrapper — stopPropagation is left entirely to the child per the doc comment.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

## web/src/components/ReadDialog.tsx

### the file itself
- spec 2 · read at `100b44878b73` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T17:01:42Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file implements the dialog UI for configuring and launching a new "read" (assessment run) — letting the user pick parameters such as how many items/functions to sample, and other run settings, via a slider-based control. `tokensFor` estimates token cost from the slider value, `snap`/`approx` round or snap the slider to sensible increments, and `Field`/`Choice` are small reusable form building blocks used inside the main `ReadDialog` component which renders the modal itself.
- found: The dialog for launching a sanity read: choose agent/model (defaulting to what the repo's corpus was already read with, to avoid mixing scales), then choose an extent via a detented slider, with four gauges (Functions, Readers, Lines, Tokens) showing what the run will cost before pressing the button.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no

### `tokensFor`
- spec 2 · read at `0446577e1881` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:45Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes an estimated token cost for reading `functions` items in batches of `batch` — likely `functions * costPerFunction + ceil(functions / batch) * perBatchOverhead`, modeling per-item cost plus fixed overhead per batch call.
- found: Computes ceil(functions/batch) * ENTER_TOKENS + functions * PER_FUNCTION_TOKENS — per-batch entry overhead plus a flat per-function cost.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `Slider`
- spec 2 · read at `27889eeb9d71` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:19:51Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Renders a native <input type="range"> (min/max/step/value/onChange wired straight through) made invisible via opacity/appearance-none but kept on top for interaction, plus a custom visual track underneath built from divs: a filled portion sized by (value-min)/(max-min)*100%, a thumb positioned at that same percentage, and small notch marks for each entry in `detents` positioned the same way. label and valueText are used for an aria-label/aria-valuetext on the input for accessibility.
- found: Renders an invisible native range input on top for interaction/accessibility, with a custom-painted track/fill/thumb underneath positioned via a shared (value-min)/(max-min) percentage helper, plus detent notch marks drawn in the dialog's background color (so they read as gaps against both track and fill) rather than a foreground ink or blend mode.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `snap`
- spec 2 · read at `c6a1890c842e` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:26:47Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Computes a catch-window as a fraction of the total range (derived from left/step), then iterates over `detents` checking if `v` is within that window of a detent; if so returns the detent value, otherwise returns `v` unchanged (not snapped to a step grid).
- found: window = max(step, (left-step)*0.02) — a 2% of range catch window, floored at one step; then finds the first detent within that window of v, falling back to v itself if none match.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains the design rationale (why detents matter) but not the actual formula (2% of range, floored at step size) — that part wasn't derivable from docs alone, though the code itself is trivial to read.

### `approx`
- spec 2 · read at `21533db1a284` · commit `2903db5` · read by gemini-3.6-flash-medium · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: approx formats a numeric count into a human-readable string approximation (e.g. formatting large numbers with suffixes like 'k' or rounding to thousands/millions).
- found: Formats numbers >= 1,000,000 as float with 'M', >= 1,000 as rounded int with 'k', and smaller numbers as standard string.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Prediction exact.

### `ReadDialog` — TANGLED
- spec 2 · read at `56d14ef81f28` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:25Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A modal dialog component that lets the user pick which agent/model to use (remembered per project via Choice/Field controls) and how much of the repo to read this run (via a Slider, with tokensFor estimating cost and snap/approx helpers rounding the value). On confirm it POSTs to start a run, calls onStarted() to refresh the project list immediately, and onClose() to dismiss itself; likely also shows the estimated token/dollar cost before the user commits.
- found: A start-a-run dialog: picks harness (agent) from installed list, resolves model via corpus-priority (banked > recent > local default) with an override toggle, shows a slider for how many functions to read with detents and four Gauge dials (functions/readers/lines/tokens) computed from a fetched readCurve, warns on switching model away from a banked one, and on submit calls setReader then startCheck, invoking onStarted/onClose.
- predicted: most · documented: some · derivable: no · legible: some · trap: no

### `Field`
- spec 2 · read at `bc059b3aa449` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A tiny layout component rendering a label (styled small/muted, e.g. uppercase) above or beside its children, used to wrap form controls in the ReadDialog like model choice, reader count, and limit.
- found: Exactly as predicted: a small uppercase muted label div followed by the children, used to wrap form fields in ReadDialog.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `Choice`
- spec 2 · read at `e83ef3d9ad2c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders a small selectable button/row for a radio-like option: shows label and optional note text, applies a highlighted/selected style when `on` is true, calls onClick when clicked, and renders as disabled (dimmed, non-interactive) when `disabled` is true.
- found: A small toggle-style button: styled with accent colors when `on`, dims via opacity when `disabled`, and shows label plus an optional parenthesized note.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## web/src/components/Reading.tsx

### the file itself
- spec 1 · read at `edad76307ab9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: File defines FunctionRanks, showing where a function sits in the repo's population (lines, churn) using helper Rail (bar viz), ordinal/pct (percentile formatting), and Fact (labeled stat row).
- found: Exactly that: Rail draws a tick on a track, ordinal/pct format a percentile two ways, Fact renders one labeled row (value + rail + ordinal or 'unranked'), and FunctionRanks renders two Facts — Lines and Churn — computed via shareBelow against the repo's Population, with rich tooltips explaining the numbers.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no

### `Rail` — QUIRKY
- spec 1 · read at `3cf3887150fd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a horizontal percentile bar — a track div with a tick mark positioned at p percent, plus a text label (ordinal/pct) stating the percentile in words.
- found: Renders only the track div and an absolutely-positioned tick span at left: p*100%, with the tick pulled back by 2px when p > 0.5 so it doesn't hang off the right edge. No text label is rendered here.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Predicted a text label would be rendered inside Rail itself; it's purely the visual bar, label presumably lives in a sibling like Fact.

### `ordinal`
- spec 1 · read at `55320f57d387` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Converts a 0-1 percentile fraction into a compact ordinal string like '95th' or '3rd', rounding and appending the right suffix.
- found: Rounds p*100 but clamps to [1,99] so it's never '0th' or '100th' (since the rank is among real functions, and the extremes are always held by an actual one), then appends the ordinal suffix (with th for 11-13 teens exception).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The clamp-away-from-extremes behavior was explained by a comment inside the body, not by the docstring I was given, so the doc only covers the four-character formatting, not the min/max logic.

### `pct`
- spec 1 · read at `d2e96ee83b46` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Converts a fraction into a rounded percentage string for a tooltip.
- found: Rounds p*100 to a percent, but clamps display to '<1%' for anything rounding to 0 or below and '>99%' for anything rounding to 100 or above, otherwise 'N%'.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Fact`
- spec 1 · read at `477fc67fa2fa` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a single-line row: label, value, and a Rail component showing the percentile p in the repo's distribution, with a tooltip (hint) and a fallback for when p is null (too few to rank).
- found: Matches prediction: fixed-width label and value, then if p is not null renders a flexible Rail plus an ordinal-formatted percentile (e.g. "3rd"), otherwise shows literal text "unranked" — deliberately distinct from a rank of zero. Whole row has title=hint for the tooltip.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `FunctionRanks`
- spec 1 · read at `311ef399ca28` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Renders two lines under the dials showing this function's rank in the population by line count and by churn, using ordinal/pct helpers and a Fact component; returns nothing if no population.
- found: Returns null if node.score is missing. Computes locP and churnP via shareBelow against pop.loc/pop.commits. Renders two Fact rows (Lines, Churn) with value text and a detailed hint string, including a special case for no git history at all on churn, and last-touched-days phrasing.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: File doc is about the general Population/dial mechanism, not this specific component, so counted as none/not derivable-from-docs.

## web/src/components/RollupDots.tsx

### the file itself — OBSCURE
- spec 1 · read at `8d0f27c10624` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A row of small dots visually summarizing an aggregate/rollup of items (one dot per child/grade), plus a dotsId helper for generating stable keys.
- found: Defines an SVG <pattern> (dot texture, rotated to a wedge's angle) that marks a sunburst roll-up patch — a wedge standing for many small functions collapsed into one visual patch — as a collection rather than a single function, distinct from the stale-hatch stripe texture used elsewhere on the same chart. dotsId turns a file path into a collision-free SVG pattern id (escaping non-alphanumerics to char codes rather than a lossy replace). Also holds ROLLUP_TEXTURE_PX, a measured pixel threshold for when a roll-up is large enough to carry the texture.
- predicted: none · documented: none · derivable: no · legible: not judged · trap: no

### `dotsId`
- spec 1 · read at `d813a04c4855` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Replaces each non-alphanumeric character with an escape based on its char code so different paths cannot collide onto the same id, prefixed with a fixed string.
- found: Exactly that: `dots-${path.replace(/[^a-zA-Z0-9]/g, c => `-${c.charCodeAt(0)}-`)}`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `RollupDots`
- spec 1 · read at `2cf13c243384` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders an SVG pattern with a dot texture rotated to the patch's own angle, anchored via cx/cy so the texture belongs to the patch rather than looking like a global overlay.
- found: Renders a <defs><pattern> with a single dot per tile, computing a translate+rotate patternTransform so the pattern is both rotated to the wedge's mid-angle and anchored so a dot lands exactly at the patch's own centre (T = C - R(theta)*(HALF,HALF)), rather than showing an arbitrary slice of one shared global lattice.
- predicted: most · documented: none · derivable: no · legible: most · trap: no

## web/src/components/SideBar.tsx

### the file itself
- spec 2 · read at `43c6737e605e` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:04Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: This file defines the app's left sidebar UI: a SideBar component listing known/recent projects (each rendered as a ProjectItem row with click-to-open, add, and forget/remove actions) plus an AgentPanel section showing live agent activity or reports for the currently open project, wiring into the backend project/agent commands.
- found: SideBar renders the project list (ProjectItem rows with per-project progress rule + reading-sweep animation, right-click context menu to forget a project) plus an AgentPanel that shows a single merged working/stopping/sleeping state for the currently selected project, with Read/Stop controls, a run-status line, and a failure-details overlay.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Extensive prose comments explain design history (why things were merged/removed) that couldn't be derived from the code alone, and cover far more than just 'what this file is for'.

### `SideBar`
- spec 2 · read at `fb405a5ee41e` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T17:01:37Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a scrollable list of ProjectItem components (one per project, highlighting the active one and calling onSelect on click), a "+" button wired to onAdd for adding a new project, per-item controls wired to onRead and onForget, and an AgentPanel fed by the agent prop, likely with an empty-state message when there are no projects.
- found: Renders the sidebar shell: header, a Projects list with an "Add a repo" (+) button and empty-state hint, each project as a ProjectItem with active highlighting and a custom right-click context menu (backdrop-dismissed) offering "Remove from list" (calls onForget) with reassurance text that data isn't deleted, and an AgentPanel at the bottom fed by the currently-active project, the agent activity, and onRead. Per-project progress/read affordances live inside ProjectItem/AgentPanel rather than inline buttons here.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Expected inline per-item Read/Forget buttons; actual UI uses a right-click context menu for Forget and routes Read only through AgentPanel for the active project — the extensive prose comments explain several past-design iterations (single progress bar removed, + button re-added) that aren't derivable from the code itself.

### `ProjectItem` — QUIRKY
- spec 2 · read at `dcca663e8f0d` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a clickable/right-clickable rounded row (28px strip) showing the project's name/icon, highlighted style when active is true, and some count value (likely agent/session count) right-aligned — wiring onClick and onContextMenu to the row element.
- found: Renders the project nav row: title tooltip with read counts, a bottom-edge progress rule sized to assessed/total (brighter while readers are out), a sweeping animation along the bottom edge while a run is active, a pulsing icon glyph, project name, and a right-aligned count that shows a loading percentage or "reading…" while loading, else assessed/total colored to indicate completion.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Docs described general layout intent (matches sibling apps) but not the progress-bar/reading-indicator logic, which is most of the function's actual work.

### `AgentPanel` — QUIRKY — TANGLED
- spec 2 · read at `c694214bc163` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:29Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Renders a single merged status area (idle/reading/stopping) for agent activity in the sidebar, driven by an animated mascot tied to real MCP tool calls instead of a separate "AGENT IS WORKING" badge. Shows project/activity info from `project` and `agent` props, and calls `onRead(key)` to acknowledge a read item. No longer renders a settings gear or chat-client connection UI, since that was removed.
- found: Renders the sidebar's permanent agent-status box: derives a three-state label (Sleeping/Working/Stopping) from run.running, a locally-optimistic "asked" stop flag, and a "winding down" state for readers still exiting after a run ended, plus a separate `chatter` signal from project.working. Shows run progress (started count or exiting-readers count), unread segment count, Read/Stop buttons, and a failure summary line with an overlay sheet showing raw failure transcripts.
- predicted: some · documented: some · derivable: no · legible: some · trap: no
- note: Prediction caught the merged-status/mascot framing but missed the run-progress line, Read/Stop button logic, and the failure-detail overlay entirely.

## web/src/components/StaleHatch.tsx

### the file itself
- spec 1 · read at `c7b7b8e9ed73` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A single StaleHatch component rendering an SVG pattern of diagonal hatch lines, used as a texture overlay (via url(#id) fill) to mark stale/expired readings on the sunburst map, kept as one component rather than duplicated defs to avoid id collisions.
- found: Exactly that: StaleHatch() returns a <defs><pattern id=\"stale-hatch\" ...> with a single diagonal line at 45°, var(--foreground) stroke at low opacity. Has an extensive doc comment explaining texture-vs-color rationale and why it's a component not inline defs — but the handout's `docs` field was empty, meaning the extraction missed this file's actual header comment.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The handout reported docs: [] for this file, but the file actually has a substantial header comment explaining the design rationale — a gap in doc extraction for this file, not an undocumented file.

### `StaleHatch`
- spec 1 · read at `bbc24a833314` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders an SVG defs/pattern with diagonal hatch lines under id stale-hatch, for other elements to reference via fill=url(#stale-hatch).
- found: Exactly that: a defs block with a pattern id=stale-hatch, rotated 45deg, containing a vertical line using var(--foreground) at low opacity, forming the diagonal hatch.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/components/Summary.tsx

### the file itself
- spec 1 · read at `7b0453b02db3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A React sidebar/summary-panel file: rowNote formats per-row trailing text, ListWindow is a small hand-rolled windowed/virtualized list of function rows, Spread and Buckets render histogram-style bars (grade distribution and per-mode buckets like author/language/age), and Summary is the main exported component that composes dials, the active lens's breakdown, and a scrollable reading list, wiring select/drill callbacks back to the map.
- found: Matches closely: rowNote supplies the trailing per-row text that complements (not repeats) the bucket/heading; ListWindow is a hand-rolled virtualized list keyed to a fixed ROW_H; Spread shows the grade distribution (cold/warm/hot/expired/unread) as a clickable stacked bar for the surprise lens; Buckets is the analogous bar for other lenses (blame/language/age/etc), weighted by lines instead of counts; Summary composes Dials, the lens-appropriate breakdown (Spread or Buckets), and a ListWindow of the selected grade/bucket's functions, plus a pinned footer.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `rowNote`
- spec 1 · read at `38d1b2dcbbca` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns the trailing-column note for a row: age/churn modes print the specific value inside the band (e.g. '5d ago', '11 in 90d'); all other modes fall back to a line-count string like '153 lines'.
- found: Matches prediction; additionally age uses 'today'/'—' special cases and churn is guarded on ageDays !== null (distinguishing 'no history' from 'zero commits in window') rather than just checking commits, using compactCount for the default line-count case.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `ListWindow`
- spec 1 · read at `b01f264c6a80` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Manual windowed list: tracks scroll offset/height, computes visible row slice with overscan padding, renders spacer divs plus visible rows with swatch/name/note, click selects and double-click navigates.
- found: Uses scroll+ResizeObserver to track view {top,h}; resets scrollTop to 0 when rows array changes; computes first/last visible index with 8-row overscan and fixed ROW_H; renders top/bottom spacer divs sized for the hidden rows, and buttons for visible rows showing paint-or-heat swatch, name, and rowNote(mode); onClick calls onSelect, onDoubleClick calls goTo.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Spread`
- spec 1 · read at `02498c946b1c` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Renders a stacked bar with grade+stale+unread segments sized by count, colored via the shared ramp, plus a clickable legend/key that filters the list below by grade, toggling off on repeat click.
- found: Matches, except only the four grade rows are clickable buttons that toggle onPick; the 'expired' (stale) and 'unread' segments render as inert non-button rows since they represent absence of a reading rather than an outcome.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Buckets`
- spec 1 · read at `1088b6d3dd29` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Horizontal stacked bar by line share plus a clickable legend list, toggling picked selection, every row interactive.
- found: Confirmed: stacked bar widths as percent of total lines with title tooltips, and a scrollable (max 33vh) list of toggle buttons showing swatch, label, and function count, clicking toggles `picked` on/off via onPick(on ? null : key).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Comment explains the 33vh cap is there because a repo with 40 authors made the key taller than the pane and pushed the picked-bucket's function list off-screen.

### `Summary`
- spec 1 · read at `3acc9ad37da1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Presentational panel rendering header/breadcrumb, aggregate stats via Buckets/Spread depending on mode (surprise vs Blame/etc), a legend keyed by ranks, click handlers to onSelect/onDrill, and about/footer slots passed through.
- found: Renders a three-part flex column: fixed header (title, path/repo, Dials line with loc/functions/commits/excluded, about slot, and either Buckets or Spread depending on lens/mode with local picked/pickedBucket state defaulting to hottest non-empty grade or first bucket), a growing middle section showing a virtualized ListWindow of the selected bucket/grade's functions (windowed for performance on large repos), and a pinned footer. Deliberately omits a stacked notes list, explained inline as belonging on the per-function Detail panel instead.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## web/src/components/Sunburst.tsx

### the file itself — QUIRKY
- spec 2 · read at `38d255997ad3` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:36Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: This file implements a Sunburst (radial hierarchical) chart React component for the web app. It likely defines a small helper `heatShare` (probably computing a heat/color intensity ratio for a node/segment based on some value share) and the main `SunburstView` component that renders the sunburst using SVG arcs (possibly with d3-shape/d3-hierarchy), handling interactions like hover tooltips, click-to-zoom into a segment, and breadcrumb-style navigation back up the hierarchy. No file-level doc header exists, so it's a self-contained implementation file relying on naming for context.
- found: A hand-rolled (no d3) React sunburst chart visualizing a codebase hierarchy (dir/file/func) as concentric SVG arcs. heatShare(kind, mode) only dampens opacity in 'surprise' color mode via a HEAT_BY_KIND table, returning 1 otherwise. SunburstView (~900 lines, exported memoized as Sunburst) manages hover tooltips, foldable dirs, click-to-select/double-click-to-drill, a requestAnimationFrame-driven zoom-transition interpolation loop, a FileZoom tiled view on file-open, and dynamic viewBox fitting via getBBox. No file-level doc header; extensive inline comments on tuning constants instead.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: There is no doc header at all (docs list was empty), so 'documented'/'derivable' are not really meaningful here beyond 'none'.

### `heatShare`
- spec 1 · read at `cbcc1020c953` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns a damping factor less than 1 for directory-kind rings only under surprise mode, 1 otherwise.
- found: Under mode === 'surprise', looks up a per-kind damping factor from a HEAT_BY_KIND table (defaulting to 1 if kind not present); any other mode returns 1 unconditionally.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Assumed a binary directory-vs-not check; it's actually a table lookup by kind.

### `SunburstView` — TANGLED
- spec 2 · read at `b518deb159ce` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:21:58Z · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A large React component rendering a zoomable/drillable radial (sunburst) arc chart of the repo's file/function tree. It computes a partition/arc layout over `root`, colors wedges according to `mode` (using `ranks` and `ageSpan` as scale inputs for rank- or age-based coloring), highlights the `selected` node, calls `onSelect`/`onDrill`/`onClear`/`onUp` on the corresponding user interactions (click, drill into a directory, clear selection, go up a level), and animates/pulses wedges whose node id is present in the `reading` set to visualize an agent's live progress moving through the repo.
- found: A hand-rolled (no d3) SVG arc/partition renderer for the repo tree: computes wedge paths manually (Math.cos/sin), tracks hover node + pointer position separately (replacing native SVG title tooltips for instant custom tooltips), uses requestAnimationFrame-driven transitions for zoom/drill animations, and many refs for imperative animation/transform state. Colors by mode/ranks/ageSpan, calls onSelect/onDrill/onClear/onUp, and pulses wedges present in the `reading` set to visualize live agent progress — matching the doc comment on that prop closely.
- predicted: most · documented: none · derivable: no · legible: some · trap: no

## web/src/components/WedgeLabel.tsx

### the file itself — QUIRKY
- spec 1 · read at `80d8479138b2` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Single-export file: WedgeLabel component draws a ring-wedge's label using labelArc + textPath, styled via ink/labelStyle, sized/colored/possibly hidden based on wedge dimensions.
- found: Single-export file with one component that renders a label two different ways depending on `at.axis`: 'arc' mode builds a <defs><path> from labelArc and a <textPath> along it (for the ring); the other mode draws a plain rotated <text> radiating outward along a spoke (for the fan/FileZoom view), flipping direction in the left half to stay readable. Consolidates what used to be two separate renderers (Sunburst's textPath and FileZoom's horizontal text) behind one component; layout/placement decisions belong to `fitLabel`, not here; styling constants come from labelStyle.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no

### `WedgeLabel` — QUIRKY
- spec 1 · read at `8ce325b7d515` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders text along an arc via textPath+defs when placement calls for it, else plain horizontal text; opacity prop actually selects a label 'kind' preset per its doc comment.
- found: Arc branch matches prediction (defs path + textPath). Non-arc branch is not horizontal text but radial text rotated outward from center via rotate/translate trick, flipped in the left half to stay left-to-right readable. opacity is literally used as SVG opacity, not a 'kind' selector — I misread the doc comment, which was only explaining why it isn't a font-weight control.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: My reading of the opacity doc comment as implying a 'kind' enum was wrong; it just documents why the prop isn't repurposed as weight.

## web/src/components/WedgeTip.tsx

### the file itself
- spec 1 · read at `3d34c1f8ccbb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Geometry-independent tooltip component shown on hovering a wedge in the treemap/visualization, showing name, grade/reading swatch, LOC and doc info; countFiles is a helper counting files under a node for roll-up display.
- found: Same core idea (shared geometry-independent hover card, countFiles rolls up file counts), plus much more: edge-aware flip positioning (flipX/flipY based on box size), per-color-mode extra fields (churn commits/first-seen, age last-touched), distinguishes function layout (name+path:line) from dir/file layout (path prefix + own name), stale (hatched) vs never-read vs read swatch semantics, fold-state hint text for directories, and roll-up counts for folded 'rest' functions.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file header doc exists despite being a fairly dense 240-line file — the design rationale is instead scattered across many inline comments per section.

### `countFiles`
- spec 1 · read at `84865977315d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Recursively counts File-kind nodes at or under n: 1 if n is a file, else sum over children.
- found: Exactly that: returns 1 if n.kind === 'file', otherwise sums countFiles(c) over n.children.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `WedgeTip` — TANGLED
- spec 1 · read at `e2ab8d903abe` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Positions a tooltip near the pointer with edge-flipping, shows a color swatch matching the wedge plus a never-read/stale state, and node identity info.
- found: Also branches display format for functions vs dirs/files (name-first vs path-first with elision), computes extras rows per color mode (churn commits/first-seen, age last-touched/first-seen), estimates card height from content to decide flip direction, shows loc/file/rest counts, an agentStale warning line, and fold-state hints for directories.
- predicted: most · documented: some · derivable: no · legible: some · trap: no
- note: Docs cover the high-level design contract (geometry-independent, swatch not number) well but not most of the actual branching logic in the 200-line body.

## web/src/components/Wordmark.tsx

### the file itself
- spec 1 · read at `43bbe6381ea5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: A minimal presentational React component rendering the app's wordmark/logo as inline SVG or styled text, with little logic and no file-level doc needed given its size and obvious name.
- found: A single-component file: Wordmark({height=18}) renders the Sanity brand SVG inline with fill=currentColor (so it inherits theme color for ink/white variants). The doc comment (on the function, not file-level) explains why it's inlined vs an img, the currentColor rationale, brand rules, and why the default height differs from a sibling 'tally' wordmark for optical size matching.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: There's no file-level doc, but there is a substantial doc comment on the function itself — the file has documentation, just not at file scope.

### `Wordmark`
- spec 1 · read at `a8bc0df9a246` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Renders an inline SVG wordmark with path(s) filled currentColor, sized by the height prop (default 18), no width prop, viewBox defines the aspect ratio.
- found: Exactly as predicted: svg with viewBox 0 0 329 125, height={height}, fill=currentColor, role=img/aria-label=Sanity, and six path elements making up the wordmark glyphs, no width prop set.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/shell/SideBarHeader.tsx

### the file itself — QUIRKY
- spec 1 · read at `cef9ad3d6d95` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A small presentational component rendering the sidebar's header, likely showing a wordmark/title, with no other exports.
- found: Single export SideBarHeader: a drag-region div sized to the titlebar height, showing the Wordmark, that tracks macOS fullscreen state to conditionally reserve/collapse space for Tauri's traffic-light overlay buttons, with careful pointer-events handling so the wordmark doesn't break window dragging. No file-level doc, only an inline comment above the function.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no

### `SideBarHeader`
- spec 1 · read at `048333edc686` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Renders a header div at titlebar height with the Wordmark, conditionally padded left to clear macOS traffic lights when running under Tauri on Mac.
- found: Renders the drag-region div with Wordmark as predicted, but also tracks fullscreen state via useState/useEffect+onFullscreenChange, since macOS hides traffic lights in fullscreen — the left-padding reserve is only applied when isTauriMac() AND not fullscreen; also marks the Wordmark wrapper pointer-events-none so it doesn't block the drag region.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed the fullscreen-state tracking that toggles the traffic-light reserve.

## web/src/components/shell/TopRow.tsx

### the file itself — QUIRKY
- spec 1 · read at `017ffc141fa9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A component rendering the shell's top toolbar row, likely containing project name/path, window-control spacing, and theme/menu controls, with some supporting logic.
- found: A minimal, content-agnostic drag-region header (`data-tauri-drag-region`) fixed to `--titlebar-h`, centering whatever `children` it's given; the doc comment explains it used to hold a tab rail, open button and theme toggle but those were deliberately removed/relocated after a bug where the tab rail and sidebar disagreed about what was open.
- predicted: some · documented: full · derivable: no · legible: not judged · trap: no
- note: The doc comment is a small design history explaining a removed feature and why — far more informative than the trivial 10-line body it documents.

### `TopRow`
- spec 1 · read at `059a0f998b8c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: A fixed-height header strip with a Tauri drag-region attribute, centering children (the color-mode switcher).
- found: Matches exactly: header with data-tauri-drag-region, flex centered, shrink-0, select-none, height set to --titlebar-h CSS var, renders children.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/api.ts

### the file itself — QUIRKY
- spec 2 · read at `49cdd68096be` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:37:22Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: The frontend's central API/data-access layer: a large collection of exported functions wrapping Tauri IPC commands and event listeners for project management (list/pick/forget projects), scanning/reports (scanRepo, projectScan, onScanProgress, applyScores, reaggregate, reportGrades, agentReports), MCP client commands, and CLI install/status. It also bundles unrelated color-ramp/heat-visualization math (wedgeHeat, heatColor, rampStop, rampAt, paintHeat) used to render grade/coverage heat visuals, making this a somewhat overloaded "everything talking to the backend or drawing heat colors" module rather than a narrowly scoped API client.
- found: The frontend's API/data layer: it hand-mirrors backend types from model.rs (NodeKind, Score, Hotspot, Node, Provenance) with per-field doc comments explaining what each number means, then wraps Tauri invoke calls and event listeners for project management, scanning, MCP, CLI install, plus a cluster of heat/color-ramp math functions for visualizing grade/coverage.
- predicted: some · documented: some · derivable: no · legible: not judged · trap: no
- note: Correctly predicted the API-wrapper + heat-ramp-utility mix, but missed that a large chunk of the file is hand-written TypeScript type definitions mirroring the Rust backend model, each with explanatory field comments.

### `showsShare`
- spec 1 · read at `92308d117684` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Checks node.kind === 'func' but special-cases overflow/aggregate nodes so they aren't miscategorized as temperature-colored despite being rollups of many functions.
- found: return node.kind !== 'func' || node.rest !== undefined -- non-func nodes show share, and func nodes with a 'rest' (overflow aggregate) field also show share.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `toNode`
- spec 1 · read at `abb099812d1f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Recursively converts WireNode to Node, mapping fields and recursing into children, possibly with derived UI-only fields.
- found: Straight field-by-field mapping from snake_case wire fields to camelCase Node fields (endLine, ageDays, lastTouchedDays, etc.), with nullish coalescing for optional fields, a nested remap of the score sub-object, and recursion into children via children.map(toNode). No derived/computed fields beyond the renaming.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `agentActivity`
- spec 1 · read at `498e4cdbcd05` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper invoking the backend to fetch current agent-activity status and returning the AgentActivity result for the sidebar's polling.
- found: Invokes 'agent_activity' and returns it, but also catches any error and substitutes a default inactive AgentActivity ({active: false, tool: '', nonce: 0, events: []}) rather than letting the promise reject.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `pickProject`
- spec 2 · read at `c828c2213e4f` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:19Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes a Tauri backend command (e.g. invoke("pick_project")) to open the native folder picker dialog, returning the selected path as a string, or null if the user dismissed the dialog without choosing. If the backend determines the chosen directory contains multiple repos rather than one, it propagates/throws the rejection with a descriptive sentence for the caller to display.
- found: Opens the Tauri dialog plugin's native folder picker directly (not via a custom backend command), returns null if the user didn't pick a string path, and otherwise forwards the picked path to the add_project backend command which validates/registers it and returns the resolved path (or rejects with the multi-repo message).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The extensive docs describe a macOS list-view double-click bug in the picker, which is context for callers/future maintainers rather than a description of what this function's body does — so much of it isn't derivable from or really about the code itself.

### `installCli`
- spec 2 · read at `68f2c3a4f02f` · commit `2903db5` · read by gemini-3.6-flash-medium · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: installCli is an asynchronous API wrapper function that calls the underlying backend Tauri command to symlink the sanity executable into a system binary directory (/usr/local/bin or ~/.local/bin) and returns an object detailing the installation path and whether it is present on PATH.
- found: Frontend API wrapper invoking Tauri IPC command 'install_cli' returning an object with path string and on_path boolean.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Prediction exact.

### `readCurve`
- spec 2 · read at `1c6a5b2181e8` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:06:52Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper that invokes the Tauri `read_curve` command with the project key and returns the resulting array of cumulative line counts (one per ten functions), used to draw the lines-read progress bar in the Read dialog.
- found: Thin wrapper invoking the Tauri `read_curve` command with the key, returning the number array; I missed that it swallows errors with a `.catch(() => [])` fallback to an empty array.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `forgetProject`
- spec 2 · read at `c04aba1c39d5` · commit `2903db5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:19:58Z · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: A thin fetch wrapper that POSTs (or DELETEs) to a backend endpoint like `/api/project/forget` with the project key in the body or URL, awaits the response, and returns void — removing the project from the sidebar list without touching the underlying repo or its stored readings.
- found: Tauri invoke() wrapper calling the Rust command 'forget_project' with the key, returning its Promise<void> directly.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed a raw fetch/HTTP call instead of Tauri's invoke() bridge to the Rust backend — same intent, wrong transport mechanism, which this codebase uses throughout (Tauri app).

### `harnesses`
- spec 2 · read at `2458c1de1e62` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:26:44Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A thin API wrapper that performs a GET request to a backend endpoint (likely /api/harnesses) and returns the parsed JSON response typed as HarnessInfo[], following the same pattern as sibling functions in this file (listProjects, mcpClients, etc.) which are simple fetch wrappers around REST endpoints.
- found: It calls invoke('harnesses') (an IPC-style call, not a raw fetch) and silently swallows any error by returning an empty array via .catch(() => []).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Silently swallowing errors into an empty list could mask real failures from callers with no way to distinguish "no harnesses" from "request failed".

### `setReader`
- spec 2 · read at `65639281d69f` · commit `298f9f5` · read by claude-sonnet-5 · asked for sonnet · via claude · when 2026-08-13T06:49:18Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Calls into the Tauri backend (via invoke) with the project key and the harness/model strings, recording them against the project's summary so ProjectSummary.harness reflects who last read it — a simple fire-and-forget wrapper returning Promise<void>.
- found: Exactly a thin invoke() wrapper calling the 'set_reader' Tauri command with key, harness, model.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `startCheck`
- spec 2 · read at `5e348db3d3b8` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T17:01:41Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A frontend API wrapper that POSTs to a backend endpoint to start a "check" (wave) run, passing project key and optional model/readers/batch/limit params, and returns the parsed JSON response as-is (including error/hint/harness fields on refusal) rather than throwing on non-2xx.
- found: Thin wrapper around Tauri's invoke('start_check', ...), passing key and normalized optional args (nulling undefined), returning whatever the backend resolves including error fields.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I assumed an HTTP fetch/POST; it's actually a Tauri invoke call, since this is a Tauri app not a plain web API client.

### `stopCheck`
- spec 2 · read at `28be3bde661f` · commit `298f9f5` · read by claude-sonnet-5 · when 2026-08-13T16:30:42Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A thin frontend API wrapper that POSTs/calls the backend "stop" endpoint with the project key, returning a promise that resolves once the request completes (no return value needed).
- found: Calls Tauri's `invoke` to run the backend `stop_check` command with the project key, returning the resulting promise.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: I guessed HTTP fetch-style call; it's actually a Tauri invoke — same idea, different transport.

### `mcpCommand`
- spec 1 · read at `1601a4380b1e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper invoking the Tauri command 'mcp_command' (or similarly named) and returning the result, catching failures to return null.
- found: Exactly: invoke<McpCommand>('mcp_command').catch(() => null).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `mcpClients`
- spec 1 · read at `68c06de6db2a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper invoking a Tauri command and returning the promise.
- found: invoke<McpClient[]>('mcp_clients').catch(() => []) - missed the .catch fallback to an empty array on error.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `mcpConnect`
- spec 1 · read at `7db0d02e71db` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Calls a backend API endpoint (POST) to open an MCP client connection, returning a Promise<string> status/id.
- found: return invoke<string>('mcp_connect', { id }) -- it's a Tauri IPC invoke call, not an HTTP POST as I guessed.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `mcpDisconnect`
- spec 1 · read at `aca46ec6c1f5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A thin wrapper around Tauri invoke, calling a backend mcp_disconnect command with id, returning a Promise<string>.
- found: Exactly that: `return invoke<string>('mcp_disconnect', { id })`.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `readable`
- spec 1 · read at `d8ec7b19b2c0` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns p.functions + p.files as the combined denominator.
- found: Exactly `p.functions + p.files`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `listProjects`
- spec 1 · read at `352ee0c679ef` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Calls backend via Tauri invoke or HTTP to fetch list of projects and which one is active, returns Promise<ProjectList>.
- found: Single line: return invoke<ProjectList>('projects') - thin wrapper around Tauri's invoke calling the 'projects' backend command.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `readSource`
- spec 1 · read at `47b1b31b57df` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: invoke('read_source', {repo, relPath}) returning promise, no catch fallback.
- found: Exactly that: return invoke<string>('read_source', { repo, relPath }).
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `openCodeWindow`
- spec 1 · read at `4031a63c7534` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Invokes a Tauri backend command to open a new window showing the code view for the given file.
- found: Exactly that: thin wrapper calling invoke('open_code_window', { repo, relPath }).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `projectScan`
- spec 1 · read at `0736de93c985` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Invokes a backend project_scan command with key, converts the raw wire result via toScan into Scan, or returns null if not found.
- found: Exactly as predicted: invoke('project_scan', {key}) returning WireScan | null, mapped through toScan.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `isReportStale`
- spec 1 · read at `fa05e056065b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Compares a stored hash or line span on the report against the node's current value, returning true if they differ (code changed since the report was made).
- found: Guards on missing body text on either side (returns false), then directly compares r.body !== node.body — no hash, just raw string inequality.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs describe the concept (mirrors Rust's is_stale, staleness not deletion) well, but say nothing about the actual comparison being a raw body-string diff rather than e.g. a hash.

### `legibleOf`
- spec 1 · read at `525b8fee3553` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns r.legible unless stale, determined by comparing some version/hash to the current ask.
- found: Returns undefined if r is missing or r.legibleDated is truthy (a precomputed staleness flag already on the report), otherwise returns r.legible directly.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `reportGrades`
- spec 1 · read at `340334c0f8d1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes surprise score from predicted (mapping legacy surprised bool to none/full), and documented score forced to none/null when derivable is true, else mapped via table.
- found: Exactly that: predicted falls back from r.surprised; documented is forced to 'none' when derivable, then both looked up in GRADE_SURPRISE/GRADE_DOCUMENTED tables.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `readingWords`
- spec 1 · read at `318fa813ee9e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Derives a heat label and a documented legibility word from a node's human agent reading, returning null when there is no reading, it's a proxy/model score, or it's stale.
- found: Returns null unless node is a func with a non-stale agent reading. Otherwise computes predicted (using r.predicted, falling back to 'none' if surprised else 'full') to index HEAT_WORDS, and documented via DOC_WORDS, special-casing r.derivable as DOC_WORDS.none.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `agentReports`
- spec 1 · read at `e7c66ce4c92d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Invokes backend command 'agent_reports' with the key, returning Promise<AgentReport[]> for that specific project.
- found: return invoke<AgentReport[]>('agent_reports', { key }) -- exactly as predicted.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `applyAgentReports` — QUIRKY — TANGLED — TRAP
- spec 1 · read at `12906019a736` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Indexes reports by id, recursively walks the tree, and for matching leaf nodes overwrites the score's surprise value to the extreme (predicted vs not) implied by the agent's verdict, tagging the source as 'agent'; then reaggregates parents bottom-up so the change propagates upward, returning a new root.
- found: Much more nuanced: a stale report (code changed since reading) falls the wedge back to its saved proxyScore rather than the agent score, keeping the reading attached but marked `agentStale` so the UI can hatch it; a fresh report overwrites only `surprise` (and `documented` only if the agent actually graded docs, preserving the proxy's `documented` otherwise, to avoid an agent-surprise/proxy-documented mismatch) plus sets `analyzedShare: 1`; parent nodes reaggregate only if a child actually changed (reference equality short-circuit); and file nodes can carry their own attached reading without it affecting the rolled-up score, since a file's temperature must stay the aggregate of its contents.
- predicted: some · documented: some · derivable: no · legible: some · trap: yes

### `countPending`
- spec 1 · read at `18fe27cd2352` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Recursive walk over the tree counting stale and unread function nodes, respecting exclusion scoping, with plain counters and no allocation/sorting.
- found: Recursively walks nodes, propagating an outOfScope flag from exclusion; for in-scope func nodes increments stale if agentStale, else increments unread if no agent score; returns the two counters.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `summarize` — QUIRKY
- spec 1 · read at `137ee769a153` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a Node tree, aggregating counts (functions, files, assessed, stale) into a RepoSummary, probably including grade distribution.
- found: Walks the tree tracking scope/exclusion, categorizes each func node into read/stale/unread, derives a grade bucket from predicted (or 'none' if surprised, else 'full'), tallies legibility and traps, collects 'hot' nodes by a temperature(score) threshold, then sorts hot lists by temperature desc then loc desc.
- predicted: some · documented: none · derivable: no · legible: most · trap: no

### `scanRepo`
- spec 1 · read at `252492de7a28` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Async wrapper invoking backend scan_repo command with path, then transforming the raw wire result via toScan into a Scan.
- found: Calls invoke<WireScan>('scan_repo', { req: { path } }), awaits it, then returns toScan(w).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `toScan`
- spec 1 · read at `469196822508` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Maps the wire-format scan payload (snake_case, from the Rust backend) into the frontend's Scan type, converting field names to camelCase and copying values over.
- found: Converts a WireScan to Scan: recursively converts the root node via toNode, and maps stats fields from snake_case to camelCase, defaulting commits to 0 if absent.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `onScanScore`
- spec 1 · read at `64991aedf868` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Wraps Tauri listen() on a 'scan-score' event, calling cb(id, upgrade) per event and returning an unlisten cleanup function.
- found: Confirmed: listens on 'scan-score' with payload {id, surprise, hotspots}, maps it into an Upgrade object (defaulting hotspots to [] if absent), calls cb, and returns a synchronous cleanup closure that resolves the listen promise then calls the unlisten fn.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `applyScores`
- spec 1 · read at `9076dab0c346` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks the tree, applies score upgrades to matching nodes (by id/path in the scores map), and recomputes aggregates bottom-up (LOC-weighted mean, hot share), returning a new root that clones only nodes on paths to changes.
- found: Recursive visit: only leaf nodes (no children) are looked up in the scores map and patched — but only surprise, hotspots, source, and analyzedShare are overwritten (churn/age/doc-coverage are left alone since they belong to the code, not the instrument). Internal nodes recurse into children and call reaggregate only if a child actually changed (reference check), otherwise return the original node unchanged for React's sake.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I assumed the Upgrade would replace a general set of fields; the body deliberately protects churn/age/docCoverage from being clobbered, which the doc's opening lines didn't spell out.

### `reaggregate` — QUIRKY — TRAP
- spec 1 · read at `86268e1fc748` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Recomputes a node's own score by rolling up its (already-updated) children's scores as some kind of weighted average, mirroring Rust's Node::aggregate, and returns an updated Node.
- found: LOC-weights each child to accumulate surprise/documented/churn averages, tracks max ageDays, min lastTouchedDays, analyzed/hot shares (handled differently for func vs dir children), escalates score source proxy->model->agent, and preserves node.score.commits unsummed (with an inline comment noting two specific bugs this rewrite fixes that the naive port had: lastTouchedDays going null and source not escalating to agent).
- predicted: some · documented: some · derivable: no · legible: most · trap: yes
- note: Comments call out two subtle historical bugs (lastTouchedDays reset, source hardcoded to proxy) that this version specifically fixes — real trap territory for anyone re-porting this function.

### `onScanProgress`
- spec 1 · read at `6259f44de964` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Uses Tauri listen() on a 'scan-progress' event, calls cb with payload, returns unsubscribe function.
- found: Matches: `listen<Progress>('scan-progress', (e) => cb(e.payload))`, returns a closure that resolves the listen promise then calls the resulting unlisten function.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `onSetTheme`
- spec 1 · read at `cf820892bc70` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: listen('set-theme', e => cb(e.payload)) with returned unsubscribe wrapping the promise-based unlisten.
- found: Exactly that: const un = listen<string>('set-theme', (e) => cb(e.payload)); return () => void un.then((f) => f()).
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `onOpenProject`
- spec 2 · read at `09397a88134b` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Registers a Tauri event listener for the "File -> Add Project..." menu command (⌘O), invoking cb() when the event fires, and returns an unlisten/cleanup function to remove the listener.
- found: Subscribes to the Tauri 'open-project' event, calling cb() on each firing; returns a cleanup closure that awaits the listen promise and then unsubscribes.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The ⌘O / File menu binding is only in the doc string, not derivable from the event name alone.

### `cliStatus`
- spec 2 · read at `31d26e37e056` · commit `e5ac296` · read by claude-sonnet-5 · when 2026-08-13T19:41:09Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Calls into a backend (likely Tauri invoke) to check whether an external CLI tool is installed on the system, returning a CliState object like {installed, version, path} used to drive UI prompts such as "Install CLI".
- found: Calls Tauri invoke('cli_status') to get CLI symlink state, with a catch fallback returning a default CliState (linked:false, path:null, on_path:false, resolved:null, is_this_app:false) if the invoke fails.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `onInstallCli`
- spec 2 · read at `cb552cac5719` · commit `e5ac296` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:41:43Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Registers an IPC/event listener (likely Electron ipcRenderer.on) tied to the "Install Command Line Tool…" menu item, invoking cb when it fires, and returns a cleanup/unsubscribe function that removes the listener.
- found: Subscribes to the Tauri 'install-cli' event via listen(), calling cb() when it fires; returns an unsubscribe function that resolves the listen promise and calls the resulting unlisten function.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: I guessed Electron ipcRenderer specifically but it's Tauri's listen() — same event-subscription shape, wrong framework detail.

### `syncThemeMenu`
- spec 1 · read at `6746257ef32c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Invokes backend to update native theme menu checkmark to match the actual resolved theme.
- found: Same, plus silently swallows any invoke error via .catch(() => {}), which I didn't predict.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains the 'why' (menu built before localStorage read) which isn't derivable from the code alone.

### `temperature`
- spec 1 · read at `95eada141c26` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Returns s?.surprise ?? 0, just the surprise value from Score.
- found: Returns 0 if null, else clamps s.surprise to [0,1] with Math.max/Math.min — the clamping was the detail I missed.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `wedgeHeat`
- spec 1 · read at `f7449f9bd797` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Branches on showsShare(node): true returns a share-based value, false returns node's temperature; a plain number for the color ramp.
- found: if (!node.score) return 0; return showsShare(node) ? node.score.hotShare : temperature(node.score) -- branch structure matched but missed the score-missing guard and exact field/helper names.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `shareRamp`
- spec 1 · read at `7f443945c094` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Applies a nonlinear power curve to a 0..1 share value to spread out visual emphasis for a color/heat ramp.
- found: Clamps share to [0,1], normalizes by dividing by SHARE_BAND, then raises to SHARE_SKEW power.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `paintHeat` — QUIRKY
- spec 1 · read at `e11eeab12cdc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Calls wedgeHeat then maps through shareRamp to place it on the color scale.
- found: Guards on missing score (returns 0), then branches: if showsShare(node) uses shareRamp(hotShare), otherwise uses temperature(node.score) directly — no call to wedgeHeat at all.
- predicted: some · documented: most · derivable: no · legible: full · trap: no

### `isAnalyzed` — QUIRKY
- spec 1 · read at `6c3be426c8a7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns false if only an offline-proxy estimate is present rather than a real model reading, so ungraded nodes render grey instead of colored.
- found: Returns false if node.score is absent; otherwise branches on showsShare(node): for aggregating/container nodes checks analyzedShare > 0, otherwise checks score.source is 'model' or 'agent' (excluding e.g. a proxy/heuristic source).
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: Got the intent right but not the actual shape: it's a source-tag check plus a separate share-based branch for containers, not a single proxy-vs-real distinction.

### `heatColor`
- spec 1 · read at `1cb793b31e21` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Maps t onto two adjacent stops of the ramp and returns a CSS color-mix/var() expression interpolating between them based on t's fractional position.
- found: Calls rampAt(t, ramp) to get {stops, i, f}, then returns a color-mix(in oklch, var(stop[i+1]) f%, var(stop[i])) string.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `rampStop`
- spec 1 · read at `7190b43ea12d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Rounds t along a named ramp to the nearer of two stops and returns that stop's CSS custom-property name.
- found: Delegates to rampAt(t, ramp) to get {stops, i, f} (index and fractional position), then returns stops[i] or stops[i+1] depending on whether f is below or above 0.5.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `rampAt` — QUIRKY
- spec 1 · read at `2e632ef3d0ea` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Interpolates between the two nearest stops in a color ramp for a normalized value t, returning an interpolated color/value.
- found: Builds an array of 5 CSS custom property names (--{ramp}-0..4), clamps t to [0,1] and scales it to the stop index range, and returns {stops, i, f} — the stop names, the lower index, and the fractional remainder — for a caller to interpolate between two CSS variable colors.
- predicted: some · documented: none · derivable: no · legible: full · trap: no

## web/src/lib/cn.ts

### the file itself — QUIRKY
- spec 1 · read at `82b9285f7d8d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: A cn() helper wrapping clsx (possibly plus tailwind-merge) to combine conditional className strings, following the common shadcn/Tailwind convention.
- found: A minimal home-grown reimplementation of clsx itself (not a wrapper around the real library, and not called cn): filters falsy parts from a variadic array of strings and joins with a space. One-line doc says exactly this.
- predicted: some · documented: none · derivable: yes · legible: not judged · trap: no
- note: The peer name 'clsx' was the giveaway I underweighted — I assumed the common cn()-wrapping-clsx pattern instead of predicting a from-scratch minimal reimplementation exported under the name clsx.

### `clsx`
- spec 1 · read at `e8933499c48d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Filters out falsy values and joins remaining strings with a space to build a className string.
- found: Exactly that: parts.filter(Boolean).join(' ').
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/colorMode.ts

### the file itself — QUIRKY
- spec 1 · read at `0c694bf65005` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Implements alternate colouring lenses for the sunburst besides raw heat — likely Author/categorical, Age, and Docs-coverage modes, with helpers for ranking categories into palette slots and building a legend. No file header doc expected.
- found: Much larger than predicted: a full ColorMode system with eight modes (surprise, legible, docs, traps, language, blame, churn, age), a shared colorFor dispatcher, an eight-slot CVD-safe categorical palette with careful rank-by-size assignment (never hash-based, to avoid collisions), and a large bucketsFor function building the panel's breakdown rows per mode with its own per-mode bucketing/sorting rules and an escape-sequence sentinel key to avoid a literal NUL byte in source. Missed traps, churn, and blame as first-class modes, and completely missed the breakdown/bucket panel logic, which is roughly half the file.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: No module header despite being one of the largest/most complex files seen so far — the per-declaration comments carry extensive design history (e.g. why blame/language use rank-by-size not hashing, why age has no floor, why UNKNOWN is an escaped NUL not a literal byte) but nothing at file scope summarizes that this is the whole multi-lens colour system.

### `paintsFromReadings`
- spec 1 · read at `1230a5cd0d28` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks whether a given ColorMode is one of the modes whose color comes from a reader's report (as opposed to git metadata or parse structure), returning true for the reading-derived subset of modes.
- found: Returns true if mode is 'surprise', 'legible', 'docs', or 'traps' — exactly the reading-derived modes described in the doc comment.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `isAuthor`
- spec 1 · read at `89275b7cd01c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: A TypeScript type-guard that returns true when key is a real author name rather than null or a special sentinel category (like an 'uncommitted'/unanalysed marker), narrowing the type to string.
- found: Returns true iff key is non-null and not equal to the UNCOMMITTED sentinel constant, narrowing key to string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `slotColor`
- spec 1 · read at `ce80239a770a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Indexes a fixed categorical color palette by rank, falling back to an 'Other' color beyond the palette length.
- found: Exactly that: CATEGORICAL[rank] if in range else OTHER.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `ramped`
- spec 1 · read at `76401bbd20a0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Finds nearest stop, computes fill color and contrasting ink for it, bundled into a Paint.
- found: stop = rampStop(v, ramp); returns {fill: heatColor(v, ramp), stop, ink: inkOn(stop)} - ink is computed from the stop, not directly from the fill color, and fill is computed independently via heatColor rather than derived from the stop.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ageSpanOf`
- spec 1 · read at `91acacf4eb3c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Direct read of root's rolled-up ageDays field, no extra computation, no floor.
- found: Math.max(root.score?.ageDays ?? 0, 0) - reads via optional score field with a 0 default and clamps negative to 0 (not a 'minimum span' floor, just non-negativity), which I didn't predict.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Doc emphasizes 'no floor' meaning no artificial minimum span, but the code still clamps to non-negative via Math.max(...,0).

### `ageRamp`
- spec 1 · read at `8ebbe96528dd` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Normalizes days against the repo's own age span logarithmically so oldest lands at the cold end, calibrated per-repo rather than a fixed calendar window.
- found: Returns 1 (all equally 'fresh') if span < 1 day to avoid 0/0 on brand-new repos; otherwise clamps days into [0,span] and returns 1 - log10(d+1)/log10(s+1), so 1=freshest, 0=oldest (cold end).
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `opaqueShare`
- spec 1 · read at `afdaa7505794` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Walks subtree summing read lines and lines with poor legible grades, returns ratio or null if nothing read.
- found: Same, weighted by n.loc; opaque = lines where legible is 'some' or 'none'; excludes stale agent readings (agentStale check) which I did not predict.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Docs were thorough (design rationale, memoisation note) and matched the code well beyond what I'd derive alone.

### `docGrade`
- spec 1 · read at `307b4c5bd3c1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns the node's documented grade, forced to none if derivable.
- found: Same, plus returns undefined if node has no agent report or the report is stale, which I did not predict.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `undocShare`
- spec 1 · read at `081751bc3e63` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks files+functions under node, one vote each, computes share of undocumented (grade none) among graded items, null if nothing graded.
- found: Walks files+functions, counts each graded item once; 'bare' counts grades of both 'some' AND 'none' (not just fully undocumented) as the numerator over total graded; returns null when nothing graded.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `saysNothing`
- spec 1 · read at `34886dcf2ca6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Returns true when mode/node combination is a categorical non-question (traps over non-func nodes, blame/language over directories) rather than an unmeasured value.
- found: Exactly: mode==='traps' -> node.kind !== 'func'; mode==='blame'||'language' -> node.kind==='dir'; else false.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I predicted 'traps' excluded only directories, but it's actually any non-func node kind (e.g. file nodes too), which the docs' framing around 'container'/'directory' didn't make obvious.

### `colorFor` — QUIRKY
- spec 1 · read at `79b08b16d850` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Dispatches on mode (surprise/heat, age, author, category, doc-coverage, etc.), pulling the relevant reading per node and returning a ramped Paint plus label, null when no data for that mode so the caller can fall back to a structural neutral.
- found: Dispatches on seven modes: surprise (share vs raw heat, ramped differently for containers vs leaves), legible (share of opaque lines or a leaf's grade), docs (file header grade vs undoc share vs function grade — direction inverted, brighter = more gap), traps (boolean fill, no ramp, special-cased to funcs only), churn, age (ramped against ageSpan), and a shared fallback for blame/language that special-cases uncommitted lines and looks up a rank-based slot color. Containers roll up via showsShare/opaqueShare/undocShare where leaves use a per-node grade.
- predicted: some · documented: some · derivable: no · legible: most · trap: no

### `rankCategories` — QUIRKY
- spec 1 · read at `43639d96a85f` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Aggregates lines per category from the tree itself, sorts descending, returns name-to-rank map.
- found: Delegates the aggregation/sorting entirely to `legendFor(root, mode)` and just converts its ordered array of names into a name-to-index Map via forEach.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: The actual ranking/aggregation logic lives in legendFor; this function is a thin index-map builder over its output.

### `bucketsFor` — QUIRKY — TANGLED
- spec 1 · read at `901675302712` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: One walk over the subtree bucketing functions by the mode's own coloring logic, mean-averaging ramp inputs per bucket for ramped fills, with an uncolorable bucket that isn't dropped, buckets summing to the total.
- found: Right shape overall, but the walk has a large per-mode branch (legible/docs/traps share an 'unread' absence bucket; blame/language key off author/lang with an 'uncommitted' special case; churn/age band by threshold with ramp value fed in), plus mode-specific sort orders for the legend (by lines, traps-first, ramp-order full→none, or band order), and a reserved NUL-prefixed UNKNOWN key kept out of real key namespace and stored literally as the escape sequence (not a literal NUL byte) to avoid making the file binary to grep/git diff.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Comment explains a real prior incident: using a literal NUL byte as the sentinel key made the source file appear binary to grep/rg/git diff.

### `legendFor` — QUIRKY
- spec 1 · read at `dd8b74f0eee8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Returns distinct category labels present in the tree for categorical color modes, empty for ramp modes; delegates to a helper like rankCategories or bucketsFor.
- found: Only 'blame' and 'language' modes get a legend; others return []. Walks tree accumulating total LOC per key (lastAuthor or lang) restricted to func nodes (and valid authors for blame), then returns keys sorted by descending LOC. Self-contained, no delegation to rankCategories/bucketsFor.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

## web/src/lib/fan.ts

### the file itself
- spec 1 · read at `97948f34c37b` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Computes the geometry for opening a file's wedge into a 'fan' sector where the file's functions are laid out as sub-arcs, replacing an earlier rectangular treemap to keep one consistent polar geometry. Includes interpolation (lerp/lerpSector) for animating the transition and helpers (centre, room, place) for positioning function cells within the fan.
- found: Confirmed shape. Sector uses area-preserving units (v = r²/2) so interpolation in v grows area at an even rate; fanFor searches candidate spans (coarse 5-degree steps) to pick the one maximizing on-screen area given the pane's aspect ratio, keeping the same bearing as the source wedge (or a fixed NO_WEDGE_BEARING of straight up when there's no wedge to open from, e.g. restored sessions or History view); place() does an affine remap from a cell's position in the destination sector back into the live (interpolating) sector so the tiling stays valid at every frame; room() estimates label space accounting for the trapezoid shape of an arc segment.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: The header is a genuine design-rationale doc (why polar over rectangular, referencing a killed `FileStack` treemap version) rather than a mechanical description — full coverage of intent but not something a reader could regenerate from the code alone.

### `sectorOf`
- spec 1 · read at `d0b697ca5f5d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: A constructor that packages angle/radius bounds into a Sector object literal, likely just {a0, a1, r0, r1}.
- found: Packages bounds into a Sector, but the radii are passed through a vOf() transform into v0/v1 fields rather than stored as raw r0/r1 — a radius-to-some-other-space (probably area-equalized radial value) conversion I did not anticipate.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The radius fields are transformed via vOf before storage, not passed through raw as the naming (r0, r1 params) suggested.

### `arcOf` — QUIRKY
- spec 1 · read at `0be99cb3858e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Extracts just the angular start/end from a Sector, discarding radius, to produce an angle-only Arc.
- found: Builds an Arc from a Sector's a0/a1 angles plus radius r0/r1 computed by mapping v0/v1 through rOf — so it keeps both angle and value-derived radius, not angle-only.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: Arc carries radius too (via rOf(v0/v1)), not just angle as I assumed.

### `deg`
- spec 1 · read at `2daab0c4a6ff` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Converts radians to degrees: (r * 180) / Math.PI.
- found: const deg = (r: number) => (r * 180) / Math.PI — exactly radians-to-degrees conversion.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `fanFor`
- spec 1 · read at `b427b46737a1` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Keeps the same bearing as src, iterates candidate angular spans, measures how much area each occupies in the pane at the same fit the viewBox will apply, and returns the Sector with max area.
- found: Bearing = midpoint of src (or NO_WEDGE_BEARING if null). Loops span in degree steps between MIN_SPAN and MAX_SPAN, computes bounding box extent for fixed radial band [core,rim], scales to fit paneAspect (binding axis), computes scaled sector area, tracks best. Returns Sector with a0/a1 from best span and v0/v1 as radius-mapped (vOf) core/rim.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `lerp`
- spec 1 · read at `2a17dbad7eb0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Standard linear interpolation: a + (b - a) * t.
- found: Exactly that.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `lerpSector`
- spec 1 · read at `ade4c7e00f40` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Lerp each field (angle bounds and v bounds) between a and b at t, return new Sector.
- found: Exactly as predicted: lerp on a0, a1, v0, v1.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `share`
- spec 1 · read at `0660f08c622c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes normalized fractional position of `at` within [lo, hi], i.e. (at - lo) / (hi - lo).
- found: Same as predicted, plus a guard: returns 0 if hi <= lo instead of dividing by zero/negative.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `place`
- spec 1 · read at `be52dcaa99f5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Affine remap of cell's fractional position within dest applied to live, for both angle and radius, producing a new Arc.
- found: Confirmed: uses share() to get the fraction of cell's a0/a1 within dest's angular span and remaps into live's angular span; radius goes through vOf/rOf (an area-preserving transform) before the same share-based interpolation, then converts back with rOf.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `centre`
- spec 1 · read at `56c3766c17a4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Midpoint angle and radius of the arc, converted to x/y via (r sin a, -r cos a), returning {x,y,r,a}.
- found: Exactly that: a=(a0+a1)/2, r=(r0+r1)/2, x=r*sin(a), y=-r*cos(a).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `room`
- spec 1 · read at `440ea093ab45` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Compute w as angular width times mid-radius (arc length at mid-radius) and h as radial thickness (r1-r0), returning {w,h}.
- found: Exactly as predicted: w = (a1-a0) * ((r0+r1)/2), h = r1-r0.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/history.ts

### the file itself
- spec 1 · read at `27d5fd1afc2c` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Frontend mirror of history.rs: invoke wrappers for scan_history/warm_history, folding the delta commit list into a frame at a scrub position, building the sunburst tree, coloring by recency-as-of-that-frame, with scrub-bar scoping to map real commit indices to a directory's relevant subset.
- found: Matches closely, including details I didn't anticipate: a module-level memoized `Frame` (replay only advances forward, since scrubbing backward rebuilds from scratch) and a pooled Map of function Nodes mutated in place per frame to avoid allocating ~17k objects 30x/second, plus scopedCommits/posOf/realOf binary-search mapping between a scoped commit list and real commit indices.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: No file-level header despite being a close structural mirror of a heavily-documented Rust module — the design rationale (memoization, pooling, forward-only replay) lives entirely in per-function comments instead.

### `scanHistory`
- spec 1 · read at `499218ef69e7` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Thin wrapper invoking a Tauri backend command 'scan_history' with path and limit, returning the HistoryScan promise.
- found: Exactly that: `return invoke<HistoryScan>('scan_history', { path, limit })`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `warmHistory`
- spec 1 · read at `bf062faa9fb5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Calls some backend function to top up the existing timeline for path, with extra logic like a flag or error swallowing.
- found: Just a thin wrapper: invoke('warm_history', { path }) with no extra logic — the fire-and-forget/never-build behavior lives entirely on the Rust backend side.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `onHistoryProgress`
- spec 1 · read at `362d617cee23` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Subscribes to a Tauri event fired during history scan/warm, calling cb with the Progress payload, returns unsubscribe function wrapping async listen/unlisten.
- found: listen<Progress>('history-progress', (e) => cb(e.payload)) then returns () => { void un.then((f) => f()) } - exactly as predicted.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `daysBetween`
- spec 1 · read at `d174e1052ee9` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: (now - then) / 86400 clamped to a minimum of 0.
- found: Exactly Math.max(0, (now - then) / 86_400).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `opening` — QUIRKY
- spec 1 · read at `442ea8dc2938` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Constructs the initial Frame representing the state before any commit is replayed, seeding per-file loc from the history's base snapshot and initializing the other per-file maps empty, with position set to before the first commit.
- found: Builds the opening Frame: empty maps for touched/born/hits/author, ts from hist.baseTs, at=-1, and loc seeded per-file from hist.base. Deliberately does NOT mark base files as touched or born — an inline comment explains this is because their true last-write time predates the window and is unknown, so leaving them unmarked keeps them undated/uncolored rather than falsely flaring as freshly written.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `advance` — QUIRKY
- spec 1 · read at `44181d35b1ca` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Mutates frame in place, applying commits from frame.at+1 to to, updating some tree/state and advancing frame.at.
- found: Iterates commits (frame.at, to], updating per-file loc, touched, born (first-seen) timestamps, a capped churn history array (hits, capped at CHURN_MEMORY), and per-path author map from added/changed files; deletes tracked state for removed files; then sets frame.at and frame.ts from the last applied commit.
- predicted: some · documented: full · derivable: no · legible: most · trap: no

### `replay`
- spec 1 · read at `59a3719d614b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Reconstructs a Frame at a given index by starting from an opening state and advancing through history, building the frame tree/aggregate scores for that point in time.
- found: Same core idea (opening + advance to reach index) but with a memoization optimization: if there's a cached frame for the same hist already at or before the requested index, it advances that cached frame forward instead of rebuilding from the opening state, and updates the memo.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `scoreInto` — TRAP
- spec 1 · read at `307fff6d72fe` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes a proxy Score for function f at a given history frame, reusing the `into` object when given to avoid allocation. Fields it can't honestly determine (surprise, analyzedShare) are left at 0, a documented \"no claim\" sentinel.
- found: Only computes churn (from recent commit hits within CHURN_WINDOW_DAYS), ageDays (from `born`), lastTouchedDays (from `touched`), and commits count; other fields (surprise, documented, hotShare, analyzedShare, provenance, source) are only set to defaults when `into` is null/absent for a fresh object — when reusing an existing `into`, those fields are left as whatever they already were, not reset.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: Reusing `into` across calls does not reset surprise/documented/analyzedShare/hotShare/provenance/source — only churn/ageDays/lastTouchedDays/commits are freshly computed each call, so stale values from a differently-provenanced Score could leak forward if a caller reuses an object across frame types.

### `aggregate`
- spec 1 · read at `017617381d90` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Recursively aggregates a container node's children: sums LOC, and rolls up age as oldest child and last-touched as newest child, LOC-weighted for blended metrics, mirroring Rust's Node::aggregate.
- found: Post-order recurses into children, sums loc. Then LOC-weights churn across children (using max(loc,1) as weight), takes max of commits, max of ageDays (oldest), min of lastTouchedDays (most recent since presumably lower=more recent), builds a score object zeroing surprise/documented/hotShare/analyzedShare and marking provenance 'history'/source 'proxy'. Bails early if no scored children.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `collapse`
- spec 1 · read at `d28aae3d52ae` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Recursively walks a directory Node tree, merging directories that have exactly one child directory into a single node with a combined name (e.g. "src/tauri/src"), continuing until no such chain remains, and recurses into remaining children.
- found: Maps collapse over children first (post-order recursion), then if this node is a dir with exactly one child which is also a dir, replaces itself with that child but renamed to `parent/child`. Only one level of merge per call site but recursion handles chains since the merged node itself came from a fully-collapsed child.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `dirNode`
- spec 1 · read at `fc1e136bdb1a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Constructs and returns a new directory-kind Node for the history tree, given its path and display name, with children initialized empty and aggregate/stat fields at their zero/default state to be filled in as the tree is built.
- found: Builds a directory Node literal: sets id/path/name/kind='dir', zeroes loc, nulls out line/endLine/lang/lastAuthor/doc/score/body, empty hotspots and children arrays. Includes an inline comment explaining doc is always null for dirs because history replays commit structure, not documentation facts.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `frameTree` — TRAP
- spec 1 · read at `ef25db43c51a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Builds a tree Node for a given frame index by grouping functions into directory/file nodes via helpers like dirNode/aggregate/collapse, computing size/score, mirroring the live sunburst's tree shape.
- found: Replays the history to the given frame, builds dir/file nodes lazily via recursive dirFor/fileFor closures, then iterates frame.loc in interned (first-appearance) order building/reusing pooled func nodes (a module-level `pool` cache keyed by hist reference) updating only per-frame-mutable fields (loc, lastAuthor, score) while treating identity/path/lang as immutable, appends into file children, then calls aggregate(root) and returns collapse(root).
- predicted: most · documented: some · derivable: no · legible: most · trap: yes
- note: There's a module-level mutable `pool` cache for function nodes keyed by `hist` object identity, reset via `pool.hist !== hist` — a subtle invalidation rule not visible from the signature.

### `scopedCommits`
- spec 1 · read at `3602f169da67` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Filters commits by whether a changed file path starts with scope; scope '' returns all indices.
- found: Same idea but implemented via hist.paths/inScope index array and file indices rather than direct string checks, plus explicit segment-boundary match (scope or scope/ prefix) to avoid `web/src` matching `web/src-old`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs explain the design rationale (view vs re-fold) well but not the segment-boundary implementation detail.

### `posOf`
- spec 1 · read at `8edae688f93f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Binary search for the rightmost frames[mid] <= index, returning -1 if none found.
- found: Exactly that: standard binary search maintaining the best (rightmost) index whose value is <= target, defaulting to -1.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `realOf` — QUIRKY
- spec 1 · read at `d12300962075` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: If pos is -1, returns fallback (pre-scope commit); otherwise indexes into frames array directly at pos to get the real commit index.
- found: If frames is empty, returns fallback. If pos < 0, returns frames[0] - 1 (not fallback directly). Otherwise clamps pos to frames.length-1 and indexes frames at that position.
- predicted: some · documented: most · derivable: no · legible: most · trap: no
- note: fallback is only used for the empty-frames case, not for the negative-pos case as I predicted; also pos is clamped rather than indexed raw.

## web/src/lib/ink.ts

### the file itself
- spec 1 · read at `933884a287da` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Color-math utility picking light/dark text ink for a label based on computed contrast against the wedge color it sits on, independent of theme; inkOn as main export with resolve/luminance/over/srgb/contrast helpers.
- found: Exactly that: inkOn(token, alpha) resolves a CSS custom property to hex, computes its luminance (compositing over background if alpha<1 via `over`), and picks PAPER or INK literals (not theme-relative) based on whichever has higher WCAG contrast ratio; falls back to CHROME_INK when the token can't be resolved to a plain hex (e.g. color-mix). Results are cached per theme+token+alpha since custom properties are read off the root and only a theme swap invalidates them.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: I didn't anticipate the memoization cache keyed on theme, or that PAPER/INK are theme-invariant literals rather than flipping with the app theme — the doc explicitly calls out that flipping with theme is the bug being fixed.

### `inkOn`
- spec 1 · read at `f229e713ef84` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Resolves the custom property to a color, composites it over the background at alpha, computes luminance, and picks between two ink colors (foreground vs chrome) by contrast, falling back to chrome ink when the token doesn't resolve.
- found: Caches by theme|token|alpha key; resolves token and background to hex; computes luminance directly if alpha>=1 or background unresolved, otherwise composites via `over`; then picks PAPER vs INK by whichever has higher contrast against that luminance, falling back to CHROME_INK only when the token itself fails to resolve.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `theme` — QUIRKY
- spec 1 · read at `74bd2e2a7276` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Reads current theme (light/dark) from DOM via dataset attribute or matchMedia, returns 'light'|'dark' string, used elsewhere despite ink decisions not depending on it.
- found: Returns document.documentElement.className (falling back to a single space ' ' when document is undefined, i.e. SSR), not a parsed theme name.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no

### `resolve`
- spec 1 · read at `eae2816b15bc` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Reads a CSS custom property's computed value via getComputedStyle, trims it, returns null if unset; returns the raw string (including color-mix values) otherwise, letting the caller detect non-hex values.
- found: Strips a var(...) wrapper from the token to get the property name, returns null if it's not a `--` custom property, reads the computed value via getComputedStyle, and validates it against a strict 6-digit hex regex, returning null for anything else (including color-mix results) rather than returning the raw string.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: I expected the hex-vs-color-mix distinction to be made by the caller, but resolve() itself does the hex validation and returns null for non-hex.

### `luminance`
- spec 1 · read at `512befc1ae41` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Standard WCAG relative luminance: parse hex to RGB, apply sRGB gamma correction per channel, combine with weights 0.2126/0.7152/0.0722.
- found: Calls srgb(hex) to get gamma-corrected channels, then reduces them with the standard WCAG weights [0.2126, 0.7152, 0.0722] summed together.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: The one-line doc "WCAG relative luminance." is on the function itself and matches exactly what the code does — full but minimal, and trivially derivable from the code.

### `over`
- spec 1 · read at `029374649428` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Converts hex and ground to linear RGB, alpha-composites per channel, computes luminance of the result.
- found: Same, fused into one reduce: for each channel, computes composited value then weights it by the Rec.709 luminance coefficient and sums.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `srgb`
- spec 1 · read at `d1cae97f1d31` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Parses a hex color into three 0-1 channels and linearizes each via the sRGB gamma-decode formula (WCAG luminance step).
- found: Extracts R,G,B hex pairs (assuming leading '#'), normalizes to 0-1, applies the piecewise WCAG sRGB linearization formula (linear below 0.04045, gamma 2.4 power curve above).
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Handed doc ('The three channels, linearised.') is accurate but terse — file_doc is about the enclosing inkOn/contrast picker, not this helper specifically.

### `contrast`
- spec 1 · read at `6e3a62a13b1b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Computes WCAG contrast ratio as (lighter+0.05)/(darker+0.05) using max/min of the two luminance inputs so the result doesn't depend on argument order.
- found: Exactly that: (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/label.ts

### the file itself
- spec 1 · read at `0d1a191b1b3f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Geometry/text-fitting utility for sunburst chart labels: chooses arc vs radial axis by wedge shape, measures text width (widthPerPx), truncates from the middle when needed (middleTruncate), with fitLabel as the entry point tying it together.
- found: Matches prediction closely, plus much more nuance encoded in named constants with extensive rationale: LINE (line-box multiplier accounting for halo/overshoot), PAD (safety margin against textPath clipping), DEFAULT_BEND (caps arc curvature per-picture via caller-supplied maxBend), MIN_KEPT/MIN_SHARE (truncation floors chosen empirically to avoid meaningless stubs), and a closed-form solve for radial sizing that centers the label rather than measuring at the narrowest radius. fitLabel tries the shape's preferred axis first, falls back to the other, then truncates only as a last resort.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `widthPerPx`
- spec 1 · read at `ba81f995f47e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Measures text width via canvas measureText at a reference font size divided by that size, caches by text+weight, falls back to per-character estimate with no canvas.
- found: Cache key includes weight and text; lazily creates a module-level canvas 2d context if not yet created; sets font to weight+REF size+FAMILY, measures text width, divides by REF, multiplies by 1.06 as a safety margin against underestimating ink extent (advance vs. actual painted width); falls back to text.length*0.6 with no canvas.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Missed the 1.06 fudge factor accounting for measureText's advance-width vs actual ink extent.

### `middleTruncate`
- spec 1 · read at `b7213f9d08f3` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns name unchanged if it fits within keep; otherwise keeps some chars from head and tail (split evenly) joined by an ellipsis so total length fits keep.
- found: If keep >= name.length return name as-is; if keep is below a MIN_KEPT threshold return empty string; otherwise splits keep chars between head (ceil half) and tail, slicing from start and end of name, joined by an ellipsis.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Did not anticipate the MIN_KEPT floor returning empty string.

### `fitLabel` — QUIRKY — TANGLED
- spec 1 · read at `d61b9ad90e15` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Picks axis by cell shape, tries full name on preferred axis, then full name on the other axis, then falls back to middleTruncate on either axis, using widthPerPx to measure fit.
- found: Computes max size for both arc and radial placements (radial solved as a fixed-point equation to keep the label centered), tries the shape's preferred axis full-size first, then the other axis full-size; only if neither fits does it truncate — and truncation is tried only on the preferred axis, shrinking the kept character count until it fits or a minimum share/floor is hit.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: Missed that truncation only happens on the preferred axis, not tried on both; also missed the centered radial-sizing math.

## web/src/lib/population.ts

### the file itself
- spec 1 · read at `dcfeb20f2e65` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: populationOf flattens a node's subtree into arrays of function-level metrics; shareBelow computes what fraction of a sorted population lies below a given value, for percentile-style stats.
- found: populationOf walks the whole repo tree (not just siblings) collecting three separate sorted arrays — loc (all real functions), heat (only analysed ones), commits (only ones with git history) — each excluding synthetic roll-up wedges, since ranking a function against a population that includes an aggregate standing in for hundreds of others would be self-referential. shareBelow binary-searches a sorted array for the strict share below a value, returning null under a minimum population size (20) so small-sample percentiles render as unknown rather than falsely precise.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no

### `populationOf` — QUIRKY
- spec 1 · read at `896819b96269` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Walks the tree from root, accumulating a measure into a Population result — a total count plus a sorted distribution of values, used by shareBelow for threshold queries.
- found: Recursively walks the node tree collecting loc, heat (temperature of score), and commits arrays for real func nodes only (excluding synthetic 'rest' rollup nodes), then sorts each ascending and returns {loc, heat, commits} as the Population.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: Missed the specific three metrics and the deliberate exclusion of synthetic 'rest' rollup nodes from the distribution.

### `shareBelow`
- spec 1 · read at `f33f7bcc8d86` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Binary search to find count of elements below v in sorted array, divide by length for a share/percentile; return null if array empty.
- found: Binary search (lower_bound) for count of elements < v, divided by length. Null guard is a MIN_POP threshold (minimum sample size), not just emptiness — suppresses percentile claims on small samples.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## web/src/lib/runtime.ts

### the file itself
- spec 1 · read at `fe42178ca3d5` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Runtime probes: isTauri via injected global, isMac via UA sniff, isTauriMac combo for mac-specific desktop chrome, onFullscreenChange subscribing via lazily-imported Tauri window API or browser API, all avoiding static Tauri import so the bundle runs in plain browser too.
- found: isTauri checks window.__TAURI_INTERNALS__; isMac sniffs navigator.userAgent for Mac/iPhone/iPad; isTauriMac ANDs them, used to reserve space for overlay traffic lights; onFullscreenChange no-ops outside Tauri-mac, otherwise dynamically imports @tauri-apps/api/window and polls fullscreen state via the window's onResized event (not a timer) because entering/exiting fullscreen always triggers a resize.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no

### `isTauri`
- spec 1 · read at `33a9a1078966` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks for a Tauri-injected global on window without importing @tauri-apps/api, returning boolean.
- found: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window — SSR-safe existence check for the exact global name.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `isMac`
- spec 1 · read at `18634f7d04cb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Checks navigator.userAgent (or platform) for a Mac signature and returns a boolean, for platform-specific UI behavior.
- found: Guards for navigator being undefined, then tests navigator.userAgent against /Mac|iPhone|iPad/i.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `isTauriMac`
- spec 1 · read at `cd44802ba44b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: isTauriMac = () => isTauri() && isMac(), combining the two sibling checks.
- found: export const isTauriMac = (): boolean => isTauri() && isMac() — exact match.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onFullscreenChange`
- spec 1 · read at `3bca05eb1d24` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Listens for window resize, checks Tauri fullscreen state on each resize, calls cb with boolean, returns unsubscribe function.
- found: Guards on isTauriMac() (no-op elsewhere); dynamically imports @tauri-apps/api/window to avoid load-time dependency; reads fullscreen state immediately and on each onResized event, invoking cb; uses a 'dead' flag plus async-safe cleanup so calling the returned unsubscribe before setup finishes still detaches once the window handle resolves.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## web/src/lib/splash.ts

### the file itself
- spec 1 · read at `1fe713949d2b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: A small utility exporting dismissSplash, which hides/removes a splash/loading screen element from the DOM, likely with a fade, once the app is ready. No file doc expected since it's short and self-evident.
- found: Exports idempotent dismissSplash() guarded by a module-level `gone` flag (since two callers race it — App on ready, and a fallback timeout cap in main.tsx). Adds 'is-gone' class to fade, then removes the element from DOM after 400ms so it can't linger and swallow clicks. Has a substantial doc comment explaining the whole design rationale (why dismissal was moved off first-paint to actual app-readiness).
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: Missed the idempotency/race-guard detail and the specific first-paint-vs-readiness design rationale, though the general shape was right.

### `dismissSplash`
- spec 1 · read at `cc88d07e92b6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Hides the splash element by id, adds a fade/hidden class, then removes it from the DOM after a delay, guarding against double-dismissal, possibly persisting a flag so it won't show again.
- found: Guards with a module-level 'gone' flag, gets #splash element, adds 'is-gone' class to fade it, then removes it from DOM via setTimeout(400ms) as a safety net in case the CSS transitionend never fires, so it can't linger and block clicks. No persistence flag.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## web/src/lib/sunburst.ts

### the file itself
- spec 1 · read at `d29118dbd0ff` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · warm reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Sunburst geometry: layout assigns angular spans recursively, arcPath/labelArc build SVG paths, vOf/rOf/heatOf are accessors, and worstRatio/rowPlacement/tileFunctions implement a squarified-treemap-style alternative to sliceFunctions for laying out a file's functions as area-proportional patches instead of thin arc slices.
- found: Matches the overall shape well, but I mis-predicted `aggregate`: it is not a general tree roll-up (that's history.ts's separate function) but a synthetic overflow node representing functions a wedge/patch had no room to draw individually, with LOC-weighted mean scores. tileFunctions implements real squarifying in (angle, r²/2) coordinates so area is conserved exactly through the r=sqrt(2v) substitution, with elaborate floor/promotion/stretch logic to decide which functions get real patches vs. get rolled up — considerably more sophisticated than the generic 'alternative layout' I predicted.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: Already partially warm: I had read rOf's single line (line 353) in an earlier task in this same run, before predicting this file.

### `heatOf` — QUIRKY
- spec 1 · read at `72fdba84ea74` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Returns a heat/color value for a node, likely reading a score field with fallback or aggregating children.
- found: Reads n.score; returns 0 if absent; otherwise returns s.hotShare if showsShare(n) is true, else s.surprise — a mode switch between two different score fields rather than aggregation.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no

### `layout` — QUIRKY
- spec 1 · read at `2b6fe6f11a3f` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Recursively partitions tree into sunburst wedges, angle proportional to lines, sorted biggest-first or by heat, stopping at maxDepth, returns Layout.
- found: Does that plus: collapsed-node pruning, minimum-angle culling of thin arcs (not functions, which render as dots) with hidden file/dir tallies, an 'even' weighting option, and starts at 9 o'clock going clockwise for label-readability reasons.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: Doc's history note (about a stale claim being corrected) was interesting but described the doc's own provenance rather than adding to what the function does.

### `arcPath` — QUIRKY — TRAP
- spec 1 · read at `e48073887a6d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Computes an SVG path string for an annular (donut) sector given start/end angle and inner/outer radius, using trig for corner points and arc commands, with angles clockwise from 12 o'clock.
- found: Computes the SVG path via trig helpers x/y (angle measured clockwise from 12 o'clock), picks the large-arc-flag from the angular span, and builds M/L/A/L/A/Z commands for the sector — but first special-cases a full circle (span >= 2π - epsilon), which must be drawn as two half-circle arcs per ring because a start point coincident with the end point renders nothing.
- predicted: some · documented: none · derivable: yes · legible: most · trap: yes
- note: The full-circle special case (single-child tree's innermost ring) is a real trap: an arc whose start and end angle coincide silently renders as nothing, and this guard is the only thing preventing that.

### `aggregate` — QUIRKY
- spec 1 · read at `95b97563182d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Builds a synthetic Node representing the functions that didn't fit as individual wedges, computing an LOC-weighted mean score across the members that were actually read/scored, and labels/paths it under the file so it renders like a normal function node.
- found: Does compute an LOC-weighted mean of several score fields (surprise, documented, churn, ageDays, lastTouchedDays, commits) over only model/agent-scored members, but also: names it `${count}+`, keeps `rest` count and the full `children: fns` array (so the detail panel can drill in), computes a separate `hotShare` (share of weighted lines that were found hot) and `analyzedShare` (share of total loc actually read) rather than just a plain mean, and explicitly does NOT inherit `excluded` from members.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `vOf`
- spec 1 · read at `52de10c15242` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: One-line helper computing v = r^2/2, the area-preserving coordinate substitution used for squarified tiling in the annulus.
- found: export const vOf = (r: number) => (r * r) / 2 — exactly as predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `rOf`
- spec 1 · read at `10225c7853a6` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A small scale helper converting a value to a radius for the sunburst, likely Math.sqrt(v) for area-proportional sizing.
- found: export const rOf = (v: number) => Math.sqrt(2 * v) — sqrt scale but with a factor of 2 inside the sqrt.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `worstRatio`
- spec 1 · read at `f29daca07a24` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Iterates over dims, computes ratio = max(w/h, h/w) per rectangle, returns the max (worst) across the row.
- found: Same core logic as predicted, but also short-circuits to Infinity if any dimension is zero or negative (degenerate rectangle), which I did not anticipate.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Zero/negative-dimension guard returning Infinity wasn't something the signature or docs hinted at.

### `rowPlacement`
- spec 1 · read at `c12261b3c923` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Two-branch layout (radial band vs wedge) allocating slots/dims to items proportional to area, returning consumed extent.
- found: Confirmed both branches; the radial branch splits along angle with constant depth (dv computed from total area / angular extent), the wedge branch splits along radial value with constant angle (da from total/radial extent); dims use rOf at midpoint for width scaling.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

### `tileFunctions` — QUIRKY — TANGLED
- spec 1 · read at `83ae0c03a88b` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Squarified-treemap-style packing of a file's functions into polar sub-rectangles proportional to LOC within the wedge, rolling overflow below a legibility floor into one aggregate slot.
- found: Much more elaborate: functions are split into those whose proportional share clears minPatchArea ('fits') and those that don't ('tail'); leftover room in patch-count is then given to promoted tail members (hot functions first, then longest) bounded by a max-stretch-per-patch rule rather than an aggregate cap; remaining tail is rolled into one aggregate node. Each member's 'wanted' area (its own share, or the floor, or floor*ROLLUP_PATCHES for the rollup) is summed and everything is scaled by area/wanted in one pass so nothing degenerates to zero area. Then rows are packed via squarified treemap logic (rowPlacement/worstRatio) in FILE order (not size order, traded away deliberately for adjacency), choosing radial vs angular row direction based on which side of the wedge is shorter.
- predicted: some · documented: most · derivable: no · legible: some · trap: no
- note: The comments narrate several specific bugs this replaced (heat-only selection burying 680/786 lines in one rollup block, backwards row orientation rendering as white slices, a remainder-based scaling producing zero-area patches) — none of that is derivable from the code shape alone, only from the extensive inline history.

### `sliceFunctions` — QUIRKY
- spec 1 · read at `103298d152b8` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 10 of its run · priming: CLAUDE.md excluded
- expected: Divides the angular span [a0,a1] among a file's functions proportionally to their LOC, producing one Wedge per function; since angle can subdivide arbitrarily finely unlike a fixed-radius band, no overflow/aggregation is needed here.
- found: I was wrong about no overflow: it computes a capacity from a minimum-angle floor (span * FLOOR_SHARE / minAngle), and when function count exceeds that capacity, ranks by heat and rolls the coldest overflow into a single `aggregate()` wedge (mirroring tileFunctions' pattern) so even a huge generated file keeps every wedge clickable. Remaining slices get a guaranteed minimum angle plus a share of the leftover span weighted by LOC (or evenly, via opts.even), optionally sorted by heat.
- predicted: some · documented: most · derivable: no · legible: most · trap: no

### `labelArc`
- spec 1 · read at `9c6c93e41a2d` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Builds an SVG arc path at radius r for angles a0..a1 for a textPath label, adjusting radius using fontSize and reversing direction in the bottom half so text isn't upside down.
- found: Normalizes the midpoint angle to detect bottom-half (upsideDown) wedges; offsets radius by a fontSize-scaled baseline-correction constant (different constant per direction, compensating for lack of WebKit textPath dominant-baseline support); computes start/end points via sin/cos; picks the large-arc-flag from the angular span; emits path 'M...A...' reversed (sweep 0) when upside down, forward (sweep 1) otherwise.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Docs cover the upside-down reversal well but the WebKit dominant-baseline workaround (the fontSize offset's real reason) is only in code comments, not the handed docs.

## web/src/lib/text.ts

### the file itself
- spec 1 · read at `81445c50569e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Small text-formatting utility module: elide truncates a string with an ellipsis, compactCount formats a number compactly for narrow UI display.
- found: elide shortens from the middle (not the end), weighted 65% toward keeping the tail, specifically for file paths where the filename/line at the end matters more than the leading directories. compactCount shows exact digits with separators below 100k, and only switches to k/M units above that threshold, sized for a fixed-width header column.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no
- note: File has no file-level doc, but each function carries a substantial doc comment explaining rationale in detail — so the file's purpose is well documented, just not at the file level.

### `elide`
- spec 1 · read at `199d5d451e32` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: If under max length, return as-is; else truncate middle with ellipsis, keeping a smaller head and larger tail portion, character-counted.
- found: Exactly that: early return if s.length <= max, else tail = 65% of remaining budget, head = the rest (min 1), sliced with a single ellipsis char between.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `compactCount`
- spec 1 · read at `3d19f02e2df4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 8 of its run · priming: CLAUDE.md excluded
- expected: Returns toLocaleString() below 100k, else divides by 1000/1000000 and formats with a decimal plus k/M suffix.
- found: Same structure but the k-range uses toFixed(0) — no decimal, e.g. "16k" not "16.1k" — while only the M-range uses toFixed(1).
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Assumed both k and M ranges kept a decimal; only M does.

## web/src/lib/theme.ts

### the file itself
- spec 1 · read at `dd33e147c7ef` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Theme (light/dark/system) persistence and application module: load/save to localStorage, detect OS dark preference, apply to DOM, apply-on-load, and watch OS changes live when in system mode.
- found: Matches prediction closely; ground truth is a Tailwind `dark` class toggled on document.documentElement (not a generic attribute), watchSystemTheme applies immediately and only subscribes to matchMedia changes when mode is 'system', returning a teardown; explains why index.html duplicates the load logic inline to avoid flash-of-wrong-theme.
- predicted: most · documented: full · derivable: no · legible: not judged · trap: no

### `loadTheme`
- spec 1 · read at `85c8c2f73557` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Reads persisted theme preference from localStorage and returns it as a Theme value, defaulting to 'system' if nothing stored or invalid.
- found: Reads raw value from localStorage under KEY, validates it's one of 'light'/'dark'/'system', returns it if valid; catches storage-access errors and falls back to 'system' as default in both the invalid and error cases.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `saveTheme`
- spec 1 · read at `bb2b7c2c4125` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Persists the theme value to localStorage under an app-specific key, so loadTheme can read it back; does not itself apply the theme.
- found: Sets localStorage item KEY to t, wrapped in try/catch that silently swallows failure (comment: preference just won't survive a restart).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Missed the try/catch around localStorage.setItem.

### `prefersDark`
- spec 1 · read at `864605f25436` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Checks window.matchMedia('(prefers-color-scheme: dark)').matches and returns it.
- found: Exactly that, one line.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `applyTheme`
- spec 1 · read at `37763c7b64ab` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Resolves Theme (light/dark/system) to a concrete light/dark value using prefersDark() for 'system', then applies it to document.documentElement, e.g. via a data-theme attribute.
- found: Resolves 'system' via prefersDark(), otherwise checks t === 'dark', then toggles the 'dark' class on document.documentElement accordingly.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `applyStoredTheme`
- spec 1 · read at `d23f20061bcb` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Reads stored theme preference and applies it, called at module load.
- found: Exactly as predicted: applyTheme(loadTheme()), one line.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `watchSystemTheme`
- spec 1 · read at `6d2fb81ba7f4` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: If t is 'system', subscribe to matchMedia prefers-color-scheme changes and call applyTheme on change, returning an unsubscribe cleanup; otherwise return a no-op cleanup without subscribing.
- found: Applies the given theme immediately on every call (applyTheme(t)), then if not 'system' returns a no-op cleanup; if 'system', subscribes a matchMedia change listener that calls applyTheme('system') on OS changes, returning a real removeEventListener cleanup.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Missed that the function also performs the initial apply, not just the watch/subscribe — the name only describes half of what it does.

## web/src/lib/zoom.ts

### the file itself
- spec 1 · read at `2c896828e2cd` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: The sunburst's zoom/navigation geometry module: computes each node's angular/radial extent, tracks ancestor chains for zoom in/out, interpolates between zoom states for animated transitions, and produces the SVG viewBox for the current zoom level. Likely no header doc.
- found: Confirmed shape, with substantial extra nuance: geoOf deliberately excludes function nodes (they're drawn inside their file's tiling, not as their own ring — a documented past bug), direction() is a real containment test rather than string-length comparison (with an explicit 'across' case for jumps via the hot-list), enterFrom/exitTo choreograph wedges growing from/collapsing to ancestors or the hub rather than fading, and extentOf computes the true geometric extent (corners + axis crossings) rather than measuring getBBox, specifically because getBBox would report mid-animation positions. Very design-rationale-heavy comments per declaration, no file header.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: No file-level header doc, but every export has an extensive rationale comment — the density of per-declaration documentation is the pattern seen in api.ts too, suggesting a deliberate house style of no module headers but thorough inline docs.

### `under`
- spec 1 · read at `c4d3ff9b9a40` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Path-prefix check with separator guard against false positives like 'src' matching 'src-tauri'; root is prefix of everything.
- found: Strict-descendant only (child.startsWith(parent + '/')), not inclusive of child === parent; root special-cased to mean 'anything but the root itself'.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `direction`
- spec 1 · read at `255565b9af99` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Returns 'in' if toPath is under fromPath, 'out' if fromPath is under toPath, else 'across', using the under() helper.
- found: Matches, plus an explicit equal-paths check that also returns 'across'.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `geoOf`
- spec 1 · read at `759f88eaeaaf` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Iterates wedges, skips func kind, computes Geo (angles + radii from rInner/band/depth) with gapOf applied, builds Map<id, Geo>.
- found: Exactly as predicted: skips 'func' kind wedges, r0 = rInner + (depth-1)*band, r1 = r0+band-gapOf(kind), angles a0/a1 taken directly from wedge, keyed by node.id.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `lerp`
- spec 1 · read at `45b2910ff09a` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Standard linear interpolation: a + (b - a) * t.
- found: Exactly that.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `lerpGeo`
- spec 1 · read at `0f1f4fe27429` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Fieldwise-lerps a Geo rectangle (x, y, width, height) between a and b at t using the lerp helper.
- found: Lerps a0/a1 (angle bounds) and r0/r1 (radius bounds) -- Geo is a polar/annular wedge geometry, not a Cartesian rectangle.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `ancestors`
- spec 1 · read at `848a8fdedee0` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Loop trimming the last '/' segment off id repeatedly, pushing each shorter prefix, nearest-first, as a plain string walk rather than tree traversal.
- found: Exactly that, via lastIndexOf('/') and slice, with a final push of '' to represent the root.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `enterFrom`
- spec 1 · read at `f6d0a76bb77e` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 6 of its run · priming: CLAUDE.md excluded
- expected: Walks ancestors of id looking for one present in `was`; returns its old geo if found, else falls back to a point at the inner edge of target's own ring rather than the hub.
- found: Exactly that: iterates ancestors(id), returns the first found in `was`; otherwise returns a degenerate point geo at target's angular midpoint and radial inner edge (r0 to r0).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Docs explained the design rationale (why inner-edge point rather than hub or nothing) which matches the code exactly.

### `exitTo`
- spec 1 · read at `294d7ff11dca` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Branches on dir: 'in' pushes radius outward past rOuter, 'out' pulls radius inward toward rInner, 'across' returns from unchanged.
- found: 'in' pushes r0/r1 outward by (rOuter-rInner)*0.55; 'out' pulls r0/r1 inward by (from.r0-rInner)*0.75; otherwise returns from unchanged.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ease`
- spec 1 · read at `bc53040f7296` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A symmetric ease-in-out function mapping t in [0,1] to an eased value, likely quadratic or cubic, replacing an asymmetric cubic-bezier curve.
- found: Clamps t to [0,1], then applies a piecewise cubic ease-in-out: 4x^3 for x<0.5, and 1 - (-2x+2)^3/2 otherwise.
- predicted: most · documented: some · derivable: no · legible: full · trap: no

### `hubGeo`
- spec 1 · read at `2db0dc30a449` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Returns a Geo full-circle wedge (a0=0, a1=2*PI) with radius spanning 0 to rInner, representing the hub disc.
- found: { a0: 0, a1: Math.PI * 2, r0: 0, r1: rInner - 4 } — a full circle wedge, but with a 4px inset on the outer radius rather than rInner exactly.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc's claim that the inset matches the chart's center circle explains the -4 fudge factor, which is not derivable from the code alone.

### `extentOf`
- spec 1 · read at `07f59c070883` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 4 of its run · priming: CLAUDE.md excluded
- expected: Computes a bounding box over a set of annular sectors by checking each sector's four corners plus axis-crossing points (quarter turns) where sin/cos peak, folding min/max; hubR included so the hub circle is part of the extent.
- found: Exactly that: starts the box at [-hubR,hubR]x[-hubR,hubR], then for each sector with positive radius/span checks its 4 corners and walks quarter-turn multiples of π/2 within [a0,a1] via at(g.r1, a), updating min/max.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `viewFor`
- spec 1 · read at `a985a34e5091` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run · priming: CLAUDE.md excluded
- expected: Computes square bounding box around extent e, adding margin padding on all sides plus extra bottom padding for chromeBottom, returns a View sized/positioned accordingly.
- found: reach is half the extent's max dimension; margin and chromeBottom are fractions of reach (not absolute padding) added to x0/x1/y0/y1 (chromeBottom only on y1/bottom); returns {cx, cy, side} - a centroid+side-length View, not x/y/width/height.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: margin/chromeBottom are proportional to reach rather than absolute pixel padding, and the returned View shape is center+side rather than box corners.

### `lerpView`
- spec 1 · read at `9bdc7a6a3f90` · commit `2903db5` · read by claude-sonnet-5 · by ross@rossturk.com · cold reading · reading 5 of its run · priming: CLAUDE.md excluded
- expected: Linearly interpolates each field of a View (pan/zoom parameters) between a and b at t via the lerp helper.
- found: Interpolates View's three fields — cx, cy, side (center x/y and a square viewport side length) — each via lerp.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `viewBoxOf`
- spec 1 · read at `73db378301fe` · commit `2903db5` · read by claude-sonnet-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: Formats a View into an SVG viewBox string from x/y/width/height-like fields.
- found: Formats a viewBox string, but the View is center+side based (`cx`, `cy`, `side`), computing the square's top-left corner as `cx - side/2, cy - side/2` rather than using stored x/y/width/height directly.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
