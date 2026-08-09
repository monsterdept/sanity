# web — sanity assessment

98 of 177 functions read · 1 surprising · 19 stale

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## web/src/App.tsx

### `findById` — as expected — STALE
- read at `977918682157` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function recursively searches through a tree of nodes starting from a given node, looking for one with a matching id, and returns that node or null if not found.
- found: Recursively searches the tree: checks if current node matches id (return it), iterates through children calling findById recursively, returns the first match found or null if none exist.
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `parentOf` — as expected
- read at `c0cda91e70f7` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function finds the parent node of a node with a given ID in the tree structure. It returns the immediate tree parent (not stack parent), or null if the ID is at the root. The navigation uses the tree hierarchy, not the interaction stack.
- found: Recursively searches the tree: checks if target ID is in direct children (returns parent node if found), otherwise recursively searches each child's subtree. Returns null if ID not found. Uses tree traversal to locate parent, as docs specify (not stack-based).
- predicted: full · documented: full · derivable: no

### `App` — nearly — STALE
- read at `5d4b272f5788` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: The main React component serving as the app's root. Given the large size (495 lines) and peers involving progress tracking (ProgressTrack, ProgressPane) and layout components, it likely handles initializing the app state, managing the scan/assessment workflow, parsing command-line repo paths, and rendering the main layout with the sunburst visualization and progress panels.
- found: The App component initializes and manages all app state (scan, busy, progress, error, selected node, drill stack, theme, color mode, agent activity, projects). It sets up effects for keyboard shortcuts (Cmd-1..5 to switch color modes), following agent activity, polling for project changes and new agent reports, and batching score updates from streamed scores. It implements navigation callbacks (drill into nodes, go up, breadcrumb navigation). The render tree includes a sidebar with projects list, top row with mode switcher, main content area (either Sunburst or FileStack depending on focus depth), progress strips, breadcrumbs, detail panel, modal code view, and agent setup modal.
- predicted: most · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `useProgress` — as expected
- read at `022713725cb5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: useProgress is a React hook that processes a Progress object and returns progress tracking data—specifically a percentage value (always a number, 0 before scanning begins) and an estimated time remaining (eta) that is only provided after meaningful progress is made (20+ items, 2%+).
- found: Tracks start time with useRef, calculates pct as done/total or 0, calculates elapsed time, and returns {pct, eta} where eta is computed as remaining time in minutes via (elapsed/pct - elapsed)/60 only when done > 20 and pct > 0.02, otherwise eta is null.
- predicted: full · documented: none · derivable: yes

### `ProgressTrack` — as expected
- read at `02dad8fe74e4` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This React component renders a shared progress bar used by both the strip (header) and pane panels. It takes a Progress object (or null) and percentage value, displays the bar with indeterminate state when progress is null (before a total is known), and relies on CSS animation (track-sweep) for proper visual presentation.
- found: Renders a container div with progress bar logic: when progress is truthy, shows an animated width bar matching the percentage; when progress is null, shows an indeterminate track-sweep animation. Both states use shared styling for accent color, rounded corners, and full height.
- predicted: full · documented: most · derivable: no
- note: Docs provide design intent (shared instrument) and reasoning (why animation matters) that isn't obvious from code alone.

### `ProgressPane` — nearly
- read at `fdcd9adcf3f5` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This React component displays progress on an empty pane with centered, wide layout. It takes progress data (possibly null) and optional label, and renders the progress indicator adapted for full-width display.
- found: The component uses the useProgress hook to calculate percentage and ETA from progress data. It renders a centered flex container with: a label showing either 'Scoring X/Y functions' or a default message, a ProgressTrack component for the progress bar, and conditionally shows estimated time remaining in minutes.
- predicted: most · documented: most · derivable: no

### `ProgressStrip` — nearly — STALE
- read at `6e55be443637` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A React component that renders a horizontal progress indicator or visual strip, displaying progress information if the progress object is provided, or showing nothing/empty state if null.
- found: A React component that renders a progress strip with text information and a progress bar. It uses the useProgress hook to extract percentage and ETA, then displays "Scoring X / Y functions" if progress is provided or "Reading the repo…" if null. It shows the estimated time remaining if available, and renders a ProgressTrack component for the visual bar.
- predicted: most · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `Empty` — nearly
- read at `cb95fe9b3d53` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This is a React component that renders the empty state UI when no project is selected, likely showing a message and a button that calls onPick to allow the user to select a project.
- found: Renders a centered empty state screen with instruction text directing users to use Claude Code with 'study this project in sanity', explaining the interface will open and update as the agent reads, plus a button 'or open a repo by hand' that calls onPick.
- predicted: most · documented: none · derivable: no

## web/src/CodeWindow.tsx

### `fileByPath` — as expected
- read at `b2957f945f19` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function searches a node tree (representing the repository structure) to find a file node matching the given repo-relative path by recursively traversing the tree, returning the matching Node or null if not found.
- found: Performs a depth-first search through the node tree: checks if the current node is a file matching the target path and returns it if so, otherwise recursively searches all children, returning the first matching node found or null if the tree is exhausted.
- predicted: full · documented: none · derivable: yes

### `CodeWindow` — as expected
- read at `24f3c2c44870` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This is a React component for a separate window that displays one file's source code. It receives repo and relPath props, likely re-resolves the file from the app's scan data to ensure it's current, and renders it in a code viewer context with appropriate UI.
- found: Component manages file and error state. Uses useEffect to call listProjects, find matching project, get scan, and search for file by path using fileByPath. Has cleanup with live flag. Renders error message, loading message, or CodeView component with Tauri titlebar.
- predicted: full · documented: full · derivable: no

## web/src/components/AgentMascot.tsx

### `AgentMascot` — as expected
- read at `61eafacdfe15` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This component renders a mascot visual for the agent activity. Until the mascot asset loads, it displays a placeholder that reserves space to prevent layout reflow, with the progress text handling the status messaging.
- found: Uses React.Suspense to load the mascot asynchronously. While loading, displays a space-reserving placeholder span with the same dimensions (size × size) and aria-hidden attribute. Once loaded, renders MascotFigure with the events and active props.
- predicted: full · documented: full · derivable: no

## web/src/components/AgentSetup.tsx

### `AgentSetup` — nearly
- read at `bbd9d4cb2fd5` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This is a React component that displays a list of connected agents/clients and their configuration status. It likely renders each client with both its connection status and any configuration controls in one unified row/section, allowing the user to see the status and take action in the same place.
- found: React component that fetches the MCP command and list of connected clients on load. Renders an overlay with a ClientRow for each client, showing its status with connect/disconnect toggle. Includes explanatory text about MCP and agent workflow, error display for failed toggles, and a manual-config section showing the MCP command JSON with a copy button.
- predicted: most · documented: most · derivable: no

### `ClientRow` — nearly
- read at `fadfb536fc52` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This React component renders a single MCP client row showing the client's information (what it is), its current status, and a toggle button/action to change its state (likely connect/disconnect).
- found: Renders a row with client name and optional stale warning on the left. Right side shows status label or button depending on client state: "not installed" if absent, "connected"/"add by hand" if non-writable, or a button with state-dependent label (Connect/Disconnect/Repoint) and styling if writable. Button is disabled during busy state.
- predicted: most · documented: full · derivable: no

## web/src/components/CodeView.tsx

### `tokenize` — as expected
- read at `d364f0c54271` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This function tokenizes a single line of source code. It likely splits the line into tokens (words, operators, punctuation, whitespace) and returns an array of Tok objects with type information for syntax highlighting or analysis.
- found: Uses single regex with longest-match-first priority to tokenize line. Regex captures comments, strings, numbers, words, whitespace, punctuation. Assigns CSS classes per token type. Keywords tested separately from plain words. Returns array of Tok objects with text and class.
- predicted: full · documented: none · derivable: yes

### `ownerByLine` — as expected
- read at `39b85adfda97` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Builds a Map from 1-indexed line numbers to their owning function Node, allowing each source line to look up which code chunk it belongs to for heat display purposes.
- found: Iterates through file's child nodes, filtering for 'func' nodes with line numbers. For each function, maps all lines in its range (line to endLine, or just line if endLine is null) to that function node, then returns the completed map.
- predicted: full · documented: none · derivable: yes

### `rampStops` — as expected
- read at `5a30a1533442` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Extracts color ramp stops from an HTMLElement's CSS custom properties, converts them from hex format to RGB triples, and returns them as an array of [r, g, b] tuples. This enables the minimap to interpolate heat colors in canvas since fillStyle cannot parse CSS color-mix() strings.
- found: Gets computed style of the element. Maps over indices 0-4 to extract five custom properties (--heat-0 through --heat-4). For each property: reads the hex value (defaulting to '#888888' if missing), trims whitespace, parses as integer, and extracts RGB components using bit shifts: (n >> 16) & 255 for red, (n >> 8) & 255 for green, n & 255 for blue. Returns array of [r, g, b] tuples.
- predicted: full · documented: most · derivable: no
- note: Clean bit-shift implementation for hex-to-RGB conversion, with sensible default for missing properties.

### `rampAt` — as expected
- read at `815003ab0e2f` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: This function interpolates a color value from a color ramp at a given parameter t (likely 0-1). It takes an array of color stops and a position along the ramp, and returns the interpolated color as a string.
- found: Clamps t to 0-1, scales it to stop index range, finds surrounding stops, linearly interpolates each RGB component between the two stops, rounds the result, and returns an rgb() color string.
- predicted: full · documented: none · derivable: no

### `Minimap` — nearly — STALE
- read at `ea6f464ac9a2` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This React component renders a canvas-based minimap showing the entire source file at a glance with heat values overlaid. It displays one indentation-based bar per line (indentation profile is more recognizable than glyphs), colored by surprise heat for each line's owner node. It includes a scroll position indicator and is clickable/draggable to navigate to specific lines, repainting when scroll ticks change.
- found: Renders a canvas element that uses 2D rendering. For each line, draws heat-colored background if owner exists and is analyzed, then draws an indentation bar with lower opacity for comments. Calculates line height to fit entire file on screen. Draws a scroll indicator showing current viewport position. Implements pointer-based seeking: onPointerDown/Move calls seek() to scroll the file to clicked line with the click point centered.
- predicted: most · documented: most · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `CodeView` — nearly — STALE
- read at `4fdff6198439` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The CodeView component renders source code for a file with heat/temperature indicators in the gutter for each line, handles selecting and revealing specific functions via scrolling, and manages popup and close actions for the view.
- found: Fetches and displays source code in a table with line numbers, syntax highlighting (via tokenize), a heat-colored gutter (3px), and faint heat wash backgrounds; handles selection and scroll-to-reveal using a nonce to avoid re-triggers from tree rebuilds; shows "not measured" labels for unanalyzed functions; includes a Minimap on the right and optional pop-out/close buttons.
- predicted: most · documented: some · derivable: no
- note: Docs don't describe the actual rendering (table structure, gutter vs background heat, syntax highlighting, minimap) or the scroll-tick optimization to avoid minimap re-renders on every scroll frame.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## web/src/components/ColourKey.tsx

### `Legend` — nearly
- read at `2623fb138f2d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This React component renders a color legend that adapts to the color mode. When using heat/temperature mode, it shows a gradient ramp; when using categorical mode (like "owner"), it shows discrete colors without a gradient to avoid inventing a false ordering where none exists.
- found: If categories.length > 0 (categorical): renders first 4 categories as named color swatches, then "Other" swatch for remainder. If empty (continuous modes): maps mode to ramp type (churn/age/heat), renders 24-segment gradient bar with endpoint labels (clear/unclear, settled/churning, old/recent).
- predicted: most · documented: most · derivable: no
- note: Missed categorical handling of first-4 + Other pattern, and the endpoint label mapping per mode; docs frame gradient-under-categorical as conceptual lie, not just code behavior.

### `ModeSwitcher` — nearly — STALE
- read at `80b508d48adf` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: ModeSwitcher is a React component that renders controls to switch between different color modes for the visualization. It takes the current mode and a callback to update it. Since it's floated over the graph separately from the legend, it likely renders toggle buttons or mode selectors at the top.
- found: Renders a segmented control (one recessed track with pills inside) by mapping over all ColorMode options, creating a button for each with conditional styling (accent color and shadow for selected, muted for unselected), keyboard shortcuts (⌘1-9 in title), and accessibility attributes (role tab, aria-selected).
- predicted: most · documented: none · derivable: yes
- note: Implements segmented control pattern with keyboard shortcuts and clever shadow-based styling for selection.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `ColourLegend` — nearly
- read at `a31ab9cef181` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: The ColourLegend component renders a boxed legend displaying color categories for a given color mode, matching the visual styling of the ModeSwitcher component, with optional handling for displaying stale items marked with a hatch pattern.
- found: Renders a rounded bordered card containing a Legend component, and conditionally appends a row showing stale count with a CSS gradient-based hatch pattern (45-degree repeating lines) when stale items exist, with explanatory text "read, then changed".
- predicted: most · documented: some · derivable: no
- note: Docs don't describe how the stale row renders or explain the CSS gradient approach to creating the hatch pattern instead of using SVG.

## web/src/components/Crumbs.tsx

### `Crumbs` — nearly — STALE
- read at `899166c24f97` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A breadcrumb component rendering each node in the ancestry trail as clickable buttons. Each click calls onGo with the node's index. Node names with slashes are split and displayed with inner slashes dimmed to distinguish collapsed single-child chains from the outer crumb separators.
- found: Renders a nav containing an ordered list of trail nodes as clickable buttons. Between items (not before first) adds dimmed forward slashes. Each button calls onGo(i), with the current node styled differently (bold, aria-current="page", no hover). Splits each node name by '/' and renders parts with inner slashes dimmed (opacity-40). Also renders an "Up" button that calls onUp if provided, disabled if onUp is undefined.
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## web/src/components/Detail.tsx

### `Gauge` — nearly
- read at `b7cad1632125` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: The Gauge component renders a 180-degree circular dial showing a normalized value (0-1) with an arc indicating the relative position and text in the middle showing either a number, a word (for discrete grades), or a label for unread values, separating measurement into glance (arc) and precision (text) layers.
- found: Renders an SVG with a background arc (secondary color) and a foreground accent arc clipped via strokeDasharray to show the value 0-1; displays text in the middle (em-dash if unread, word if provided, else percentage 0-100); uses different font sizes for words (15px) vs numbers (22px); includes butt cap optimization to avoid dots on empty arcs; labels below with tooltip.
- predicted: most · documented: most · derivable: no
- note: Docs explain the purpose and word vs number choice well; don't describe SVG structure or the strokeDasharray technique for arc clipping.

### `Markdown` — as expected
- read at `1e73cdef74d4` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: React component rendering minimal markdown (code, bold, italic, paragraph breaks). Processes code spans first using regex to prevent markdown syntax inside backticks from being interpreted as emphasis. Then applies bold/italic formatting to remaining text and handles paragraph breaks.
- found: Splits on double-newlines for paragraphs. For each paragraph, the inline helper: (1) splits on backtick-enclosed code using regex, renders code elements without backticks, (2) applies bold (**text**) and italic (*text*) formatting to non-code chunks with length validation to avoid false matches, (3) wraps remaining text in spans. Maintains key order: code extraction first, then formatting application.
- predicted: full · documented: full · derivable: no
- note: Clean implementation enforcing the documented design principle that code must be extracted before formatting interpretation.

### `rank` — as expected
- read at `ebcfd7520cf3` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function computes a rank for a Node based on the active ColorMode. Given the docs say "what the list ranks by, per mode", it likely returns different metrics depending on mode (e.g., lines of code, temperature/surprise, churn, etc.) and always returns the value that determines both list ordering and ring coloring.
- found: Function returns -1 if node has no score. For 'churn' mode returns churn value, for 'age' mode returns negated lastTouchedDays (negative so recent sorts first), for other modes returns wedgeHeat(n). Each path returns a numerical rank used for both list ordering and color.
- predicted: full · documented: none · derivable: yes

### `measure` — nearly
- read at `8b9cc0cc0cbf` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Based on the mode (which likely represents different color/scoring schemes), this function extracts and formats a single key metric from a Node as a string with inline units. It returns null if no metric is appropriate for that mode. The units are embedded in the value to fit the narrow column width.
- found: Returns mode-specific metrics: blame→null, churn→commits with ×, age→days with d ago, surprise→reading words or degrees with °, default→line count. Uses — as placeholder for missing data. Includes inline units on each value.
- predicted: most · documented: full · derivable: no

### `grade` — nearly
- read at `640703ed95d9` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: This is a utility function that converts an AgentReport to a Grade by examining the predicted field and returning a corresponding grade value, possibly mapping predicted enum values to a Grade enum.
- found: Returns the report's predicted field if it exists, otherwise returns 'none' if surprised is true or 'full' if not, providing backwards compatibility for older reports that only have the surprised boolean before predicted was added.
- predicted: most · documented: full · derivable: no

### `provenance` — nearly
- read at `52bd30d87d11` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: This function generates a one-sentence string explaining where the node's measurement numbers came from. It likely takes the node and model name, then returns a string like "Read by [model]" or "From proxy scoring" or similar, indicating the source of the metrics.
- found: Returns one-sentence provenance string. If not analyzed, returns proxy disclaimer noting it tracks length. For agent source with info, formats "Read by [model · by]" with optional timestamp. For agent without info or model source, returns appropriate "Read by" or "Measured by" message. Defaults to proxy/model.
- predicted: most · documented: full · derivable: no

### `Contents` — nearly
- read at `0305a0abe761` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Renders a detailed list of files or functions within a selected wedge, ordered by surprise (heat) rather than size, with visual indicators for read/unread status, and handlers for selection and drilling into sub-items.
- found: Renders a list of child items sorted by analyzed status first (unanalyzed sink to bottom), then by rank according to the current color mode, then by line count. Each row is a button showing a color dot, the item name, and a measure value (lines/size). Handles click for selection and double-click for drilling. Returns null if no children exist.
- predicted: most · documented: full · derivable: no

### `Detail` — nearly — STALE
- read at `1d694ecdef00` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This is a React component that renders a detailed view panel showing information about the selected node, likely using the Gauge and Markdown components to display various aspects of the node.
- found: Renders a detail panel for the selected node, showing name/path/location, three gauge metrics (Surprise/Avg Surprise/Documented/Churn), agent reading assessment with Expected/Found sections if available, hotspot evidence, and a Contents sub-component, with proper handling of stale readings and warm-read indicators.
- predicted: most · documented: none · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## web/src/components/MascotFigure.tsx

### `loadOrMint` — as expected
- read at `296f66e763ec` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Based on the name and return type MascotConfig, this function either loads an existing mascot configuration from storage or generates a new one if none exists. The "mint" terminology suggests creating/generating a new configuration as a fallback.
- found: Attempts to load a saved mascot configuration from localStorage. If found and successfully parsed, returns it immediately. If not found or JSON parsing fails, generates a fresh random mascot configuration via randomizeMascot(), attempts to save it to localStorage (silently continuing if storage is unavailable), and returns the generated config.
- predicted: full · documented: none · derivable: yes

### `pick` — as expected
- read at `cfbf6454f730` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Selects a MascotAnimation from an array. Likely randomly picks one animation from the provided array.
- found: Randomly selects one animation from the array using Math.floor(Math.random() * from.length) to pick an index.
- predicted: full · documented: none · derivable: yes

### `moodFor` — as expected
- read at `cda216f69fc2` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns an array of MascotAnimation objects representing the mood or animation sequence corresponding to the given tool string.
- found: Searches MOODS array for an entry whose regex pattern matches the tool string, returns its play property (an array of MascotAnimation), or returns DEFAULT_PLAY if no match is found.
- predicted: full · documented: none · derivable: yes

### `MascotFigure` — nearly
- read at `a5609c67fe2c` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This is a React component that renders an animated mascot figure. It receives a size, a list of recent agent events, and an active flag. It uses these to determine the mascot's mood/state, picks an appropriate animation or pose, and renders it. When active is false, the mascot "dozes off". The module is kept separate for code-splitting/lazy loading purposes.
- found: Loads mascot config, tracks sequence numbers to replay unseen events. Uses useEffect to wake/sleep based on active flag, and another to play animations in sequence when events arrive, spacing them with BEAT_MS timing so all events animate rather than just the latest. Returns Mascot component.
- predicted: most · documented: full · derivable: no

## web/src/components/Overlay.tsx

### `Overlay` — nearly
- read at `9b14ec9655fd` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This React component renders a dimmed backdrop that centers the children as a modal panel. It has click handlers that close the modal when the backdrop is clicked, with the expectation that children will stop propagation to prevent their clicks from closing the modal.
- found: The component renders a fixed full-screen div with flex centering, a semi-transparent black background, and an onClick handler that calls onClose. The children are rendered inside, but there is no stopPropagation call in this component - it relies on children to handle that.
- predicted: most · documented: some · derivable: no
- note: The docs say the panel must stop propagation, but this component doesn't implement that - it relies on children to do it.

## web/src/components/PartyAnts.tsx

### `resolveCoats` — nearly
- read at `d4bcd53369a2` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Extracts color/styling information ("coats") from an HTML element. Given the return type string[][] and peer function "inkOf", it likely parses computed styles or colors from the element and returns them as a 2D array.
- found: Gets the computed style of the HTMLElement, then maps over a COATS array. For each coat (color group), maps over values to retrieve their CSS property values from computed style. Returns the resolved property value, or defaults to gray (#888) if the property value is empty.
- predicted: most · documented: none · derivable: no

### `inkOf` — nearly
- read at `8a03023905f9` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Take an HTML element and return the foreground color value from the theme, which adapts to light/dark mode based on CSS variables to provide appropriate ink coloring for the mascot limbs.
- found: Returns the computed color style of the element directly via getComputedStyle(el).color.
- predicted: most · documented: none · derivable: yes

### `PartyAnts` — nearly — STALE
- read at `e33160929886` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Renders animated party ants using Canvas as decorative mascots for empty panes, with continuous movement, frequent direction changes, and animated legs, all implemented in Canvas to avoid DOM layout overhead.
- found: Creates a Canvas-based animation of 7 ants with realistic alternating tripod walking gait, curved legs with bent knees, and animated antennae. Each ant wanders using sine curves plus jitter for natural movement, bounces at edges, and phases animation based on distance traveled. Respects reduced-motion preference, watches for theme changes, handles resize, and uses deterministic randomization for reproducible layouts.
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## web/src/components/SideBar.tsx

### `SideBar` — nearly
- read at `07f253ba2968` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: React component rendering application sidebar with project list, active selection, project item components, and progress/agent status display at bottom. Handles callbacks for project selection, opening projects, and connecting agents.
- found: Renders sidebar with header, projects nav (with empty state), and agent status panel. Progress bars shown for actively working projects or fall back to busyKey project. Agent panel displays mascot, working/sleeping status, connect button. Per-project bars show assessed/functions counts, stale reading warnings, and animated progress bar. Styling uses Tauri drag region and detailed alignment comments.
- predicted: most · documented: none · derivable: no

### `ProjectItem` — as expected
- read at `f27112610f1c` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A React component that renders a single project row in the sidebar. Takes a ProjectSummary, active boolean, and onClick handler. Renders a 28px rounded strip with the project name/info and a count metric on the right side, highlighting the active project.
- found: Renders a clickable button styled as a 28px rounded nav row. Shows a circle icon, project name, and a right-aligned count. When active, uses shell-chrome--active styling; otherwise shell-chrome--hover. The count shows a loading percentage (read_done/read_total) while loading, or assessed/functions when complete. Includes a title attribute showing repo name and reading progress. Colors the count specially when all functions are assessed.
- predicted: full · documented: full · derivable: no

## web/src/components/Sunburst.tsx

### `heatShare` — nearly — STALE
- read at `d9838ecd84aa` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: The function calculates the heat or surprise share value for a directory in the sunburst visualization. It takes a directory kind (probably a path segment) and a color mode, and returns a number representing what portion of that directory should be colored as "hot" under that measurement mode.
- found: If mode is 'surprise', returns the heat value for that kind from a HEAT_BY_KIND map (defaulting to 1 if not found). For all other modes, returns 1.
- predicted: most · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `Sunburst` — as expected — STALE
- read at `6462cdeafb15` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This is the main sunburst visualization component that renders the interactive DaisyDisk-style diagram. It takes a tree of nodes, handles selection and drilling callbacks for user interactions, applies color based on the mode, and manages navigation with the onUp callback for going up the hierarchy.
- found: Renders the interactive SVG sunburst visualization with mouse interaction handling (hover, select, drill). Manages state for hovered nodes, tooltip position, collapsed directories, and viewport sizing. Applies color based on the ColorMode prop. Displays hover tooltips with node details (name, color swatch, line count, stale warnings). Shows caveat for hidden files/dirs. Supports collapsing directories via alt-click and drilling via double-click.
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## web/src/components/Wordmark.tsx

### `Wordmark` — as expected
- read at `a8bc0df9a246` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This component renders the Sanity wordmark as an inline SVG with an optional height parameter (default 18). It likely returns an SVG element with path data for the mark, using currentColor to inherit theme colors so it adapts to dark/light without multiple files.
- found: Component returns SVG element with viewBox and height parameter. Uses fill="currentColor" for theme inheritance. Includes role="img" and aria-label attributes. Contains 5 path elements that comprise the wordmark design.
- predicted: full · documented: full · derivable: no

## web/src/components/shell/SideBarHeader.tsx

### `SideBarHeader` — nearly
- read at `048333edc686` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A React component rendering the top-left header area of the sidebar with a wordmark/logo, positioned to avoid the macOS Tauri overlay traffic lights and sized to match the TopRow height.
- found: Returns a div with data-tauri-drag-region and shell-chrome styling, height set to --titlebar-h CSS variable. Tracks fullscreen state with useState and useEffect. Applies conditional padding-left: on macOS Tauri when not fullscreen, uses traffic-light-reserve minus 3px; otherwise 9px. Contains a click-through div with pointer-events-none wrapping the Wordmark component.
- predicted: most · documented: full · derivable: no

## web/src/components/shell/TopRow.tsx

### `TopRow` — nearly
- read at `059a0f998b8c` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A React component that renders the top bar/strip of the application. Takes optional children. Based on the detailed docs, it centers a color-mode switcher, marks the strip as a drag region for window chrome, and allows buttons to capture their own clicks.
- found: Renders a header element with data-tauri-drag-region attribute (enabling window dragging), styled with flexbox centering and shell-chrome classes, with height set to the CSS variable --titlebar-h. Renders the provided children inside. It's a simple wrapper component for the top bar chrome.
- predicted: most · documented: none · derivable: yes

## web/src/lib/api.ts

### `toNode` — as expected — STALE
- read at `6af9fec7a5ad` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A transformation function that converts WireNode (backend wire format) into Node (frontend internal representation), mapping snake_case backend fields to camelCase frontend fields.
- found: Converts a WireNode to a Node by mapping all snake_case wire fields to camelCase, handling optional fields with nullish coalescing, transforming the score object structure, and recursively converting children.
- predicted: full · documented: none · derivable: yes
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `agentActivity` — as expected
- read at `498e4cdbcd05` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function polls the backend to check if an agent is currently running by making an RPC call, returning a Promise that resolves to an AgentActivity object.
- found: Invokes the 'agent_activity' Tauri command, returning a Promise with the agent status; catches errors and returns a default inactive AgentActivity object.
- predicted: full · documented: none · derivable: yes

### `mcpCommand` — as expected
- read at `1601a4380b1e` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function fetches the next MCP command from the backend via Tauri invoke, returning a command object or null if none are available. It's likely a simple async wrapper around the backend command call.
- found: Invokes the 'mcp_command' Tauri command, returning the result typed as McpCommand, with any errors caught and converted to null.
- predicted: full · documented: none · derivable: no

### `mcpClients` — as expected
- read at `68c06de6db2a` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function retrieves the list of currently connected MCP clients from the backend. It's an async function that queries the Tauri invoke layer to fetch client instances that are available for interaction.
- found: It calls the Tauri invoke command 'mcp_clients' to fetch an array of MCP clients, with a catch handler that returns an empty array on failure.
- predicted: full · documented: none · derivable: no

### `mcpConnect` — as expected
- read at `7db0d02e71db` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Establishes a connection to an MCP service using the provided id and returns a promise that resolves to a connection status or result string.
- found: Invokes the Tauri command 'mcp_connect' with the id parameter and returns the promise that resolves to a string result.
- predicted: full · documented: none · derivable: no

### `mcpDisconnect` — nearly
- read at `aca46ec6c1f5` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Disconnects an MCP client/server by id and returns a promise with a string result. It probably takes an id, finds the corresponding MCP client, disconnects it, and returns some status message.
- found: A thin wrapper that invokes the Tauri 'mcp_disconnect' command with the provided id, returning a promise resolving to a string.
- predicted: most · documented: none · derivable: no

### `listProjects` — as expected
- read at `352ee0c679ef` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function retrieves the list of projects Sanity is tracking and identifies which one the window should display. Since docs indicate it's polled due to agents potentially opening projects at any moment, it likely invokes a backend command to get the current project state.
- found: Invokes the 'projects' backend command, returning the result typed as ProjectList.
- predicted: full · documented: most · derivable: no

### `readSource` — as expected
- read at `47b1b31b57df` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function reads the text content of a file from within the open repo. It takes a repo path and a relative file path as arguments, calls the backend via Tauri with path validation to ensure security, and returns the file's full contents as a string.
- found: It invokes the Tauri command 'read_source' with repo and relative path parameters, returning the file text as a string.
- predicted: full · documented: full · derivable: no

### `openCodeWindow` — as expected
- read at `4031a63c7534` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Invokes a Tauri command to open a code window displaying the file at the given relative path in the specified repository, without returning any result data.
- found: Invokes the Tauri 'open_code_window' command with repo and relPath parameters and returns a Promise that resolves when the window is opened.
- predicted: full · documented: none · derivable: yes

### `projectScan` — nearly
- read at `0736de93c985` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function requests a scan of a specific project by key, returning the scan result or null if unavailable. It's async and likely invokes the backend 'scan' or similar command with the project key.
- found: Invokes 'project_scan' backend command with the key, transforms the result from WireScan to Scan format using toScan(), or returns null if the backend returns null.
- predicted: most · documented: none · derivable: no

### `isReportStale` — nearly
- read at `fa05e056065b` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function compares the report against the current node to check if the code location or structure has changed, making the report stale. It probably hashes or compares the body of the code to see if it matches what was reported.
- found: Checks if a report is stale by comparing the report's body string against the node's current body string. Returns false if either is missing, true if they differ.
- predicted: most · documented: full · derivable: no

### `reportGrades` — nearly
- read at `340334c0f8d1` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The function extracts and transforms the two grades from an AgentReport. It maps old boolean-only reports to the ends of the scale, and applies the rule that if documented is derivable, it must be forced to null, regardless of the reported grade.
- found: Returns transformed grades: predicted uses fallback of (r.surprised ? 'none' : 'full') if not present; documented is forced to 'none' if r.derivable is true, else uses r.documented. Both are mapped to numeric values via GRADE_SURPRISE/GRADE_DOCUMENTED, with documented returning null if falsy.
- predicted: most · documented: none · derivable: yes

### `readingWords` — nearly
- read at `318fa813ee9e` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: This function extracts word labels from a node's agent reading data, returning null if there is no valid reader-based assessment (missing agent, stale reading, or not a function node). It returns the heat label and documented label as strings.
- found: Returns null if node is not a 'func', lacks an agent property, or has a stale agent reading. Otherwise extracts the predicted grade (with fallback: r.surprised ? 'none' : 'full'), looks it up in HEAT_WORDS, and for documented: returns null if derivable is true, else looks up the grade in DOC_WORDS.
- predicted: most · documented: most · derivable: no

### `agentReports` — as expected
- read at `e7c66ce4c92d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Invokes a Tauri command to fetch the list of agent reports for the specified project key, or for the most recently opened project if the key is null.
- found: Invokes the Tauri 'agent_reports' command with the key parameter and returns a promise resolving to an array of AgentReport objects.
- predicted: full · documented: none · derivable: yes

### `applyAgentReports` — nearly
- read at `7c816acefcf4` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: This function applies agent-generated reports to the tree by updating node scores based on agent verdicts. It likely iterates through reports, finds corresponding nodes in the tree, applies binary verdicts to the ends of the score scale (full surprise or no surprise), and handles stale reports specially (possibly dropping their scores and falling back to proxy scores).
- found: Creates a report Map, recursively visits tree nodes, applies reports to leaf nodes. For stale reports (code changed), marks agentStale=true and restores proxyScore, keeping reading but ignoring its score. For fresh reports, extracts grades from report, updates node score with agent's surprise and documented grades (or just surprise if undocumented), preserves proxyScore, sets source='agent'. Re-aggregates non-leaf nodes if children changed.
- predicted: most · documented: most · derivable: no

### `countStale` — as expected
- read at `04f9c71e9172` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Recursively traverses the tree starting from the root node, counting all nodes that are marked as stale, to accurately reflect the stale wedges actually displayed in the sunburst visualization.
- found: Recursively counts stale nodes in the tree: checks if the root node's agentStale flag is set (contributing 1 if true, 0 if false), then recursively counts stale children, and returns the total count.
- predicted: full · documented: full · derivable: no

### `scanRepo` — nearly
- read at `252492de7a28` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function calls the Tauri backend to scan a repository at the given path and returns the scan results including parsed functions, files, and their metadata.
- found: Invokes the Tauri 'scan_repo' command with the path, receives a WireScan object, and converts it to a Scan using the toScan function before returning.
- predicted: most · documented: none · derivable: no

### `toScan` — nearly
- read at `ce243a1a00a8` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Converts wire-format scan data from the backend into a frontend Scan object, likely deserializing or transforming data structures.
- found: Creates a Scan object from WireScan data, recursively converting the root node via toNode() and transforming the stats object fields from snake_case to camelCase naming convention.
- predicted: most · documented: none · derivable: yes
- note: Missed the snake_case to camelCase field conversion in the stats object and the recursive toNode() call.

### `onScanScore` — as expected
- read at `64991aedf868` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Registers a callback to be invoked for each per-function score update received from the backend, transforming the payload into an Upgrade object, and returns an unsubscribe function.
- found: Attaches a listener to the 'scan-score' event, transforms the event payload (id, surprise, hotspots) into an Upgrade object, invokes the callback with id and upgrade, and returns an unsubscribe function.
- predicted: full · documented: none · derivable: yes

### `applyScores` — nearly
- read at `9076dab0c346` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function applies scores from the Map to nodes in the tree, updating their heat/temperature values, and then re-aggregates all parent nodes' scores bottom-up so that parent nodes have the correct LOC-weighted means reflecting their children's updated scores. It returns a new root node with cloned nodes along the changed path and shared nodes elsewhere.
- found: Recursively visits all nodes; for leaves, patches in surprise and hotspots from the upgrade map while preserving churn/age/doc coverage; for parents, recursively visits children and calls reaggregate only if a child changed (detected by reference equality), enabling React to skip unchanged subtrees.
- predicted: most · documented: full · derivable: no

### `reaggregate` — nearly — STALE
- read at `feeb138409f2` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Aggregates child scores up to parent node. Takes parent node and children array, calculates weighted average of child scores (surprise, documented, churn) to produce parent's aggregated metrics, and returns node with updated score. Must match Rust implementation.
- found: Iterates children accumulating weighted metrics (weighted by max(loc, 1)). Separately tracks analyzed/hot counts for functions (model/agent sourced) vs non-functions (using shares). Computes maximum age and minimum lastTouchedDays. Tracks strongest score source. Returns node with aggregated averages and preserved commits from original node.
- predicted: most · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `onScanProgress` — as expected
- read at `6259f44de964` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: This function registers a progress listener for repo scanning operations. It takes a callback that receives Progress objects and returns an unsubscribe function to remove the listener, likely using Tauri's event system to stream progress updates from the backend scan.
- found: It sets up a Tauri event listener on 'scan-progress' that passes the event payload to the callback, and returns an unsubscribe function.
- predicted: full · documented: none · derivable: no

### `onSetTheme` — as expected
- read at `cf820892bc70` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function registers a callback to listen for theme changes from the app menu, returning an unsubscribe function. It subscribes to Tauri events for theme selection and invokes the callback whenever the user changes the appearance in the menu.
- found: Listens to 'set-theme' Tauri events with string payloads, invoking the callback with the theme when received. Returns an unsubscribe function that cleans up the listener when called.
- predicted: full · documented: most · derivable: no

### `onOpenProject` — as expected
- read at `12cdc9c0634a` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Registers a callback handler for the File → Open Project menu action and returns an unsubscribe or cleanup function to remove the listener.
- found: Uses Tauri's listen function to register a callback for the 'open-project' event and returns a cleanup function that unsubscribes the listener.
- predicted: full · documented: none · derivable: yes

### `syncThemeMenu` — nearly
- read at `6746257ef32c` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function calls the Tauri backend to update/tick the menu item corresponding to the given theme string, ensuring the appearance menu matches what's actually being used.
- found: Invokes the Tauri 'sync_theme_menu' command with the theme string and silently catches any errors with .catch(() => {}).
- predicted: most · documented: full · derivable: no

### `temperature` — nearly
- read at `95eada141c26` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function extracts the surprise/temperature value from a Score object, returning just the surprise metric as a number between 0 and 1 (or whatever scale is used).
- found: Returns 0 if the score is null, otherwise clamps the score's surprise value to [0, 1] using Math.max and Math.min to ensure it stays within bounds.
- predicted: most · documented: full · derivable: no

### `wedgeHeat` — as expected — STALE
- read at `a74b7ad8a437` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function calculates the heat/temperature display value for a node. For functions, it returns the node's temperature directly. For directories and files, it computes the proportion of hot lines (surprising code) to total lines, rather than averaging temperatures which would converge toward the repo mean.
- found: Returns 0 if node has no score. For functions, returns the temperature of the score. For directories/files, returns the hotShare proportion from the score.
- predicted: full · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `isAnalyzed` — nearly — STALE
- read at `5fa6310d7f10` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Checks whether a node has been analyzed by an agent (rather than just using the offline proxy's score). Returns true if the node has a score that came from actual model or agent analysis, false if it only has a proxy score or no score at all.
- found: Returns false if the node has no score. For function nodes, returns true if the score source is 'model' or 'agent' (not proxy). For non-function nodes (directories/files), returns true if analyzedShare is greater than 0, indicating that at least some child nodes have been analyzed.
- predicted: most · documented: none · derivable: yes
- note: I missed that non-function nodes check analyzedShare instead of score source, treating them as aggregates of their children's analysis state.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `heatColor` — nearly
- read at `cb9031e433f6` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Takes a heat value and interpolates between five CSS color stops, returning a CSS variable reference that can be used in styles.
- found: Clamps t to [0,1], scales to [0,4], finds two adjacent stops to interpolate between, and returns a CSS color-mix() function in oklch space that mixes between the upper and lower stops based on the fractional interpolation value.
- predicted: most · documented: some · derivable: no

## web/src/lib/cn.ts

### `clsx` — as expected
- read at `e8933499c48d` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function takes variadic arguments that can be strings or falsy values (false, null, undefined), filters out the falsy values, and joins the remaining strings with spaces to create a single className string. It's a minimal implementation of the clsx library's core functionality.
- found: Filters the parts array using filter(Boolean) to remove all falsy values, then joins the remaining strings with spaces.
- predicted: full · documented: none · derivable: yes

## web/src/lib/colorMode.ts

### `slotColor` — as expected
- read at `ce80239a770a` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function maps a rank number to a color string by looking up the rank in a predefined palette; for ranks beyond the palette size, it returns a default "Other" color. It likely uses a switch statement or array lookup.
- found: Performs an array lookup: if rank is within the CATEGORICAL palette bounds, returns the color at that index; otherwise returns the OTHER constant as a fallback for out-of-range ranks.
- predicted: full · documented: none · derivable: yes

### `ageRamp` — nearly
- read at `3e2cdf544e67` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Converts age in days to a non-linear ramp value for coloring, likely using a logarithmic or sigmoid curve that quickly flattens after one year so that the scale doesn't waste its range on the difference between 2 and 3 years.
- found: Uses a logarithmic scale (log10(days+1) normalized to a one-year baseline) and inverts it (1 - ...) so that newer code returns higher values, capping at 1.0 so anything around or older than a year maps to the cold end of the spectrum.
- predicted: most · documented: full · derivable: no

### `colorFor` — nearly — STALE
- read at `19cb6c27aa96` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: colorFor determines the fill color and descriptive label for a sunburst wedge under a specific color mode. It returns {fill, label} when the mode has data for the node, or null when there's nothing meaningful to display (no history, language, or analysis). The caller uses a structural neutral color for null returns.
- found: Implements four color modes with mode-specific logic: 'surprise' uses heatColor and reading name or percentage, 'churn' uses commit count over 90d, 'age' uses days since last touched, and blame/language modes use slotColor based on ranks, with identity carried in label even when color is "Other" for CVD accessibility.
- predicted: most · documented: none · derivable: yes
- note: Four separate color modes with distinct validation and formatting per mode; label preserves identity for CVD accessibility.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `rankCategories` — nearly
- read at `43639d96a85f` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Walks the tree to identify category values, sorts them by total lines (biggest first), and returns a Map from each category name to its slot index (0, 1, 2...). This ensures consistent color assignment across the sunburst and legend.
- found: Creates a Map from category name to slot index by calling legendFor() to get a pre-sorted array of category names, then mapping each name to its position in that array.
- predicted: most · documented: none · derivable: yes
- note: Delegates ranking work to legendFor, which I didn't predict separately.

### `legendFor` — nearly
- read at `673cd639d481` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Extracts distinct categorical values from the tree node when using categorical color modes (blame or language), returning an empty array for ramp-based modes. The function recursively collects unique values from the tree.
- found: Returns empty array for non-categorical modes. For 'blame' and 'language' modes, recursively walks the tree collecting distinct author names or language values, but only from function nodes. Each value is weighted by total lines of code across all instances, and the result is sorted by LOC in descending order so the legend reflects visual prominence.
- predicted: most · documented: none · derivable: yes

## web/src/lib/runtime.ts

### `isTauri` — nearly
- read at `90484e71e848` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A runtime detection function that returns true if the code is running in a Tauri environment. It likely checks for the presence of a Tauri-specific global object or property on the window object to determine Tauri availability.
- found: Returns true if the window object exists and contains the `__TAURI_INTERNALS__` property, false otherwise. This checks whether the Tauri runtime has injected its internal marker into the window object.
- predicted: most · documented: none · derivable: yes
- note: I predicted the approach correctly but guessed wrong on the specific global property name—it's `__TAURI_INTERNALS__`, not `__TAURI__` or similar.

### `isMac` — nearly
- read at `263dee010e59` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A simple utility function that detects whether the current runtime is macOS by checking platform detection APIs (likely navigator.platform or Tauri runtime info) and returns a boolean.
- found: Checks if navigator is defined (for server-side safety) and tests whether the userAgent string matches /Mac|iPhone|iPad/i to detect Apple platforms, returning the result as a boolean.
- predicted: most · documented: none · derivable: no

### `isTauriMac` — as expected
- read at `78541b5becc9` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function checks if the code is running in a Tauri shell on macOS by combining the conditions of being in Tauri and being on the Mac platform, returning true only when both are satisfied.
- found: Returns the result of isTauri() && isMac(), a logical AND of two platform checks.
- predicted: full · documented: none · derivable: yes

### `onFullscreenChange` — nearly
- read at `09d0c2b498ce` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: This function registers a listener for macOS fullscreen state changes. It takes a callback that receives a boolean, and returns an unsubscribe function. The detailed docs explain that fullscreen affects UI layout (traffic lights are hidden), so tracking this state is necessary.
- found: On non-Tauri-macOS platforms, returns a no-op function. On Tauri macOS, asynchronously imports the Tauri window API, checks the current fullscreen state and calls the callback with it, then registers a resize listener (which fires on fullscreen changes) to re-check and call the callback. Returns an unsubscribe function that sets a dead flag and cleans up the listener, with the dead flag preventing callbacks after unsubscribe.
- predicted: most · documented: full · derivable: no

## web/src/lib/sunburst.ts

### `heatOf` — surprising — STALE
- read at `3caa3e70d7b1` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Extracts the heat or surprise score from a Node, returning it for use in the sunburst color encoding.
- found: Returns 0 if the node has no score, otherwise returns the `surprise` property for function nodes or the `hotShare` property for non-function nodes.
- predicted: some · documented: none · derivable: yes
- note: Missed the distinction between functions using `surprise` vs. aggregates using `hotShare`.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `layout` — as expected
- read at `edc13ec63f43` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This is the main layout computation for a sunburst diagram. It likely recursively traverses the tree from root, calculates angular positions and radii for each level, respects maxDepth by collapsing or omitting deeper levels, and returns a Layout object with positioning data for all visible nodes.
- found: Recursively walks the tree using an inner walk function, calculating angular spans for each node based on weight (size or even). Sorts children by size (or heat) with largest at top. Culls thin wedges below minAngle but never culls functions. Returns Layout with Wedge array, hidden counts of culled files/dirs, and maximum depth reached.
- predicted: full · documented: none · derivable: yes

### `arcPath` — nearly
- read at `e48073887a6d` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: This function constructs and returns an SVG path string representing an annular sector (ring wedge). It converts the angle parameters (a0, a1 for start/end angles) and radii (r0 for inner, r1 for outer) into SVG path commands, with angles measured clockwise from 12 o'clock.
- found: Converts polar coordinates (angles and radii) to SVG path commands for an annular sector. Defines x/y helpers using sin/cos to map angles from 12 o'clock to Cartesian coordinates. For nearly-full-circle angles, draws two semicircles for outer and inner radii separately to work around SVG arc limitations. For normal sectors, constructs path via moveto, lines to radii, and arc segments.
- predicted: most · documented: full · derivable: no

### `aggregate` — as expected — STALE
- read at `1bd7b2953877` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: This function creates a synthetic aggregate node representing functions that couldn't fit in the sunburst visualization. It computes the LOC-weighted mean temperature of the members that have readings, creating a real Node object so rendering logic doesn't need special-case handling for the aggregate.
- found: Calculates total LOC, filters to read functions, computes LOC-weighted means of score properties, creates a synthetic Node with name like "104+" containing all overflow functions as children, and sets score to weighted mean with analyzedShare reflecting the fraction of LOC that was actually read.
- predicted: full · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `sliceFunctions` — nearly
- read at `103298d152b8` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Divides the angular space between a0 and a1 proportionally among child nodes based on their size (lines of code), returning an array of Wedge objects with calculated start and end angles for each child.
- found: Filters children to function-kind nodes, optionally sorts by heat, enforces an angular capacity constraint by aggregating overflow functions, calculates proportional angles using either even or LOC-based weighting with a minimum angle floor, and returns Wedge objects with a0/a1 angles, depth, and index for each function or aggregate.
- predicted: most · documented: none · derivable: yes
- note: Missed the capacity-based overflow handling and aggregation logic that groups excess functions together.

### `labelArc` — nearly
- read at `7cbf1b9a927f` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Calculates SVG positioning for a text label placed on or near an arc. Computes the midpoint angle and corresponding x/y coordinates on the arc, then formats them as a string (likely SVG transform attributes or a path definition) for rendering.
- found: Calculates the midpoint angle of an arc and determines if it's upside-down (π/2 to 3π/2). Adjusts the radius based on font size to correct for WebKit's improper textPath baseline handling. Creates coordinate functions using sin/cos for polar-to-Cartesian conversion. Returns an SVG arc path command string (M...A) with the path direction reversed for upside-down labels to maintain text readability.
- predicted: most · documented: most · derivable: no
- note: The comment explains a real WebKit limitation and the geometric solution is non-obvious - this is good foundational documentation.

## web/src/lib/text.ts

### `elide` — as expected
- read at `199d5d451e32` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Truncates a string to a maximum length by removing middle characters and inserting an ellipsis, with weighting that preserves more of the end than the beginning to prioritize keeping filename and line information visible.
- found: Returns the string unchanged if already within max length. Otherwise, calculates tail as 65% of (max-1) characters, head as the remainder (minimum 1), and returns head of string + "…" + tail of string, weighted to preserve more of the end.
- predicted: full · documented: full · derivable: no

## web/src/lib/theme.ts

### `loadTheme` — as expected
- read at `a0cd551989f5` · commit `61cf1b2` · read by claude-haiku-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Loads and returns the current theme, likely by checking localStorage or applying a default theme value. Given the sibling `saveTheme`, this is probably the inverse operation that retrieves what was previously saved.
- found: Retrieves the stored theme from localStorage using a KEY constant. If the stored value is one of the valid theme strings ('light', 'dark', or 'system'), it returns that value. If localStorage is unavailable (throws an error), it silently falls back to returning the default theme 'system'.
- predicted: full · documented: none · derivable: yes

### `saveTheme` — as expected
- read at `3513dcd2632b` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: saveTheme persists a Theme preference to storage (likely localStorage or similar). Given its peer loadTheme and applyStoredTheme, it's part of a theme persistence mechanism that saves the user's choice so it survives page reloads.
- found: Calls localStorage.setItem(KEY, t) to store the theme, wrapped in try-catch that silently ignores storage errors since the preference gracefully degrades to not surviving a restart.
- predicted: full · documented: none · derivable: yes

### `prefersDark` — as expected
- read at `b277b2c40cd8` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: The prefersDark function checks whether the user's system has dark mode enabled, likely via the CSS media query `prefers-color-scheme: dark`.
- found: Returns the boolean result of window.matchMedia('(prefers-color-scheme: dark)').matches, checking the system dark mode preference.
- predicted: full · documented: none · derivable: yes

### `applyTheme` — as expected
- read at `13fa2a14f29b` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function applies a theme to the document by setting CSS classes or data attributes on the root element, allowing themes to be applied before React mounts to avoid theme flashing. It takes a Theme parameter and modifies the DOM to reflect the selected theme.
- found: Determines if dark mode should be applied (either from system preference if theme is 'system', or directly if theme is 'dark'), then toggles the 'dark' class on the document root element.
- predicted: full · documented: full · derivable: no

### `applyStoredTheme` — as expected — STALE
- read at `6f0934e442b4` · commit `61cf1b2` · read by claude-haiku-4-5-20251001 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Loads the stored theme preference via loadTheme() and immediately applies it to the document via applyTheme(), preventing a flash of the wrong theme before React renders.
- found: Calls applyTheme(loadTheme()) to load and apply the stored theme preference.
- predicted: full · documented: full · derivable: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `watchSystemTheme` — nearly
- read at `27a18420c8ba` · commit `61cf1b2` · read by claude-haiku-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: This function sets up a listener for OS theme preference changes when the theme preference is set to `system`. It returns a teardown function that unsubscribes from the OS theme changes. If the preference is not `system`, it likely returns a no-op function.
- found: Applies the given theme immediately, then if it's not 'system' returns a no-op teardown. For 'system' mode, sets up a matchMedia listener on the dark-color-scheme preference and returns a teardown function that removes the listener. The listener re-applies 'system' whenever the OS preference changes.
- predicted: most · documented: most · derivable: no
