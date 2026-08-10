# web — sanity assessment

42 of 190 functions read · 7 surprising

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## web/src/App.tsx

### `useProgress` — as expected
- read at `022713725cb5` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A hook returning { pct, eta } from a Progress object: pct = done/total, always 0 rather than null when nothing yet; a start timestamp held in a ref, elapsed time used to extrapolate, and an eta returned only past 20 items and 2% — null otherwise.
- found: Exactly that. useRef(Date.now()) plus a mount-only useEffect resetting it, pct guarded on progress && total > 0, elapsed in seconds, and eta = round((elapsed/pct - elapsed) / 60) — minutes remaining — gated on done > 20 && pct > 0.02, else null.
- predicted: full · documented: full · derivable: no · legible: full · trap: yes
- note: The start time is set once on mount and never reset when `progress` restarts for a new scan, so a second scan in the same mounted component extrapolates from the first scan's start and the ETA reads far too long; also `elapsed` is computed during render, so the ETA only updates when something else re-renders.

### `HistoryToggle` — as expected
- read at `d488a001385a` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A small presentational React button labelled "History" next to the lens switcher: conditional styling for the `on` state, disabled/dimmed while `busy`, onClick={onToggle}, probably aria-pressed and a tooltip. No local state.
- found: Exactly that: a single <button> with onClick={onToggle}, disabled={busy}, a title that swaps between "Back to the repo as it stands now" and a replay explanation, inline styles keyed off `on` (accent background, foreground colour, weight 600, boxShadow) and opacity 0.6 while busy, and label text "Reading…" vs "History". No aria-pressed.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc explains why the control sits outside the lens row — a design argument no reader could recover from the body — but says nothing about the busy state.

## web/src/CodeWindow.tsx

### `CodeWindow` — nearly
- read at `24f3c2c44870` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A React component that on mount fetches the scan the app already holds for `repo`, locates the file node via fileByPath(root, relPath), keeps it plus source text in state, and renders loading, not-found/error, and otherwise a title bar with the path plus the shared code-view component; probably also syncs theme.
- found: Two effects — one watching the stored theme preference (no picker of its own, by design), one resolving the file by listProjects() -> find by repo -> projectScan(key) -> fileByPath, with a `live` guard and distinct error messages at each of three failure points. Renders centred error text, a centred 'Opening <path>…' placeholder, or a Tauri drag-region title strip (pointer-events-none label so the drag handle is not dead in the middle) above <CodeView> with selection and pop-out deliberately inert.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The source text is CodeView's problem, not this component's — it only resolves the node — and the three separate throw messages are the nicest thing here.

## web/src/components/AgentMascot.tsx

### `AgentMascot` — as expected
- read at `61eafacdfe15` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Lazily loads the mascot bundle chunk (React.lazy/dynamic import under Suspense, or state holding the module), rendering a fixed size x size empty box as the fallback so the row does not reflow, then the real mascot driven by events and active.
- found: Exactly that, and nothing else: a Suspense wrapper whose fallback is an aria-hidden shrink-0 span sized size x size, wrapping a lazily-imported MascotFigure passed size, events and active straight through. The lazy() call itself lives above at module scope.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/components/AgentSetup.tsx

### `ClientRow` — nearly
- read at `fadfb536fc52` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A presentational React row for one MCP client: name/icon, a status line derived from whether the client is installed and whether the sanity server is configured, and exactly one button whose label flips between Connect/Disconnect calling onToggle, disabled while busy. Not-installed clients render status only, action greyed out or replaced by a hint.
- found: As predicted in shape, with a three-way state I did not have: `connected` = registered AND current, `stale` = registered but pointing at a DIFFERENT sanity binary, which gets its own warning-coloured subtitle and a third button label, 'Repoint'. Three action branches rather than two: not present renders 'not installed'; present but not writable (read-only config formats) renders 'connected' or 'add by hand' instead of a button that could not work; otherwise the toggle button, showing '…' while busy. Every variant puts client.path in the title attribute.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The stale/Repoint state — configured but aimed at another sanity install, so it looks fine and silently will not connect — is a real distinction the signature and docs gave no hint of.

## web/src/components/Bloom.tsx

### `petals` — surprising
- read at `48518f1f3d27` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Generates an SVG-markup string for a ring of petals: a loop over a fixed petal count computing an angle per petal and concatenating rotated ellipse/path elements, joined into one string for Flower to inject.
- found: Returns a single SVG path `d` attribute string (not markup): 240 samples of a polar rose-like curve r = A * |cos(K*th)|^(1/P) over a full turn, each converted to cartesian and emitted as M/L commands with 2 decimals, closed with Z. The petal shape is one continuous closed path from module constants A, K, P.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The single-letter module constants A, K and P carry the whole shape and the plural name suggests markup for several elements rather than one path string.

## web/src/components/CodeView.tsx

### `ownerByLine` — as expected
- read at `39b85adfda97` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Walks the file node's function children and for each fills a Map entry for every source line from start to end line pointing at that child, so the code view can look up a line and get the function whose score colours it. Lines outside any function get no entry; overlaps let a later child win.
- found: Exactly that. Skips children whose kind is not 'func' or whose line is null, falls back to `fn.line` when endLine is missing (with a comment explaining that painting one line would leave the body reading as unmeasured), and sets each line 1-indexed into the map, last writer winning.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/ColourKey.tsx

### `ModeSwitcher` — nearly
- read at `7c0381eeb3d3` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A floating segmented control: a local array of the five ColorMode lenses with short labels and tooltips, mapped to buttons in a rounded pill container, the one matching `mode` styled active and the others calling onMode(m) on click. When disabled, every button gets the disabled attribute plus greyed styling and a title explaining history mode fixes the encoding, the control staying visible so the lens in force is still readable. Mostly Tailwind class strings.
- found: That, with the modes coming from Object.keys(MODE_LABEL) rather than a local array, and the styling done through inline style objects and color-mix/oklch CSS variables rather than Tailwind — only layout classes are Tailwind. It uses proper tablist/tab roles with aria-selected, and the tooltip carries both the mode hint and a derived keyboard shortcut ⌘(i+1); when disabled the tooltip is replaced with the history explanation. Positioning is left to the parent. About a third of the body is comments arguing for the recessed track, the single lifted pill, and keeping the shortcut out of the chip.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The shortcut shown in each tooltip is the map index plus one, so it is bound to the declaration order of MODE_LABEL's keys while the actual ⌘-key handler lives in another file — reordering that object silently makes every tooltip advertise the wrong shortcut.

## web/src/components/CommitLog.tsx

### `stamp` — as expected
- read at `007bc6229dfa` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A three-line date formatter: take a unix timestamp in seconds, multiply by 1000 into a Date, return a short human date string via toLocaleDateString with a compact format, for display beside each commit.
- found: Exactly that — `new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })`, locale from the environment, month and day only.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Dropping the year is fine for a scrub bar but ambiguous in a repo whose history spans years — two commits twelve months apart both read "Mar 4".

## web/src/components/Crumbs.tsx

### `Crumbs` — as expected
- read at `899166c24f97` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A breadcrumb bar mapping over trail, rendering every entry including the current one as a clickable element calling onGo(index), with a separator glyph between crumbs, the current styled differently but still navigable, an optional up affordance when onUp is supplied, and collapsed-chain names split on '/' with their internal slashes dimmed so the between-crumb separators stay dominant.
- found: Exactly that: an ol of buttons, aria-current="page" on the last, accent colour on the rest, an opacity-50 '/' between crumbs and opacity-40 inner slashes from splitting name on '/'. Two details beyond my prediction: the Up button is always rendered but disabled when onUp is absent rather than omitted, and the flex sizing is deliberate — min-w-0 on the list plus last:shrink on the items so the trail truncates before the way-out button does.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/components/Detail.tsx

### `rank` — surprising
- read at `ebcfd7520cf3` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A switch over ColorMode returning the node's sort key for that mode: temperature/surprise for the surprise mode, recency/age for the age mode, lines for size, with a fallback so the list orders by the same quantity the ring is coloured by.
- found: Three modes, not the set I guessed: churn (returns s.churn), age (returns NEGATED lastTouchedDays so recent sorts first), and everything else falls through to wedgeHeat(n). Missing data — no score at all, or a null ageDays/lastTouchedDays — returns -1 so it sinks to the bottom rather than pretending to a value. No `size` mode.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The -1 sentinel is doing double duty for "no score" and "no date", which is consistent here only because every mode wants unknowns last.

## web/src/components/FileZoom.tsx

### `FileZoom` — nearly
- read at `49dc3f4a54f3` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The drilled-in single-file view: get the target fan via fanOf, interpolate from the file's wedge to it by t (lerpSector), lay the file's functions out as arc patches sized by lines and coloured by mode/ranks, drop patches under minPatchArea, show labels once settled, wire select/drill/hover.
- found: All of that, memoised: dest = fanOf(from, paneAspect); cells = tileFunctions squarified once AGAINST the fan (not the wedge) so the sixty transition frames only re-place output via `place(c, dest, live)`; fills memoised per node. Beyond my prediction it also handles from === null (fan sits at destination, `arrived` forced true so labels do not wait out a non-existent transition), falls back to --unanalyzed for unscored patches, overlays a #stale-hatch on expired readings but only when paintsFromReadings(mode), and overlays a RollupDots lattice on the aggregated "rest" patch when it is large enough in real pixels, taking the patch's own bearing. Labels are placed with fitLabel at maxBend FUNC_BEND (near-straight) and take their ink from the patch's own colour, dimmed to 0.62 when clipped.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment on a 158-line component, but the inline comments are unusually good — each one records the failure the line prevents rather than restating it.

## web/src/components/HistoryBar.tsx

### `HistoryBar` — surprising
- read at `a70abe5b9f29` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A React full-width bottom strip: play/pause button toggling onPlaying, a duration selector calling onDuration, and a range scrub whose value is frames.indexOf(index) mapping back through frames[pos] on change. Playback is a requestAnimationFrame effect computing the target position from wall-clock elapsed time against duration (skipping commits rather than stepping), stopping at the end with onPlaying(false), and not depending on index in its deps.
- found: All of that, and three mechanisms I did not cover: a fractional `cursor` ref so slow rates do not stall on integer rounding, with an `emitted` ref distinguishing the clock's own index from one arriving via scrub or log click so an external move resets the accumulator; a full keyboard transport (space toggles, arrows on BOTH axes step, shift strides 10, with guards against the range input's native arrow handling and against arrow-scrolling the log pane); and a rewind-on-play when the playhead is already at the end. The scrub also starts at -1, an empty pre-first-commit state, and rate is computed over the SCOPED frame list so a drilled-in directory takes the same duration.
- predicted: some · documented: some · derivable: no · legible: full · trap: yes
- note: The keydown effect closes over `toggle`, `pos` and `index` but the RAF effect deliberately does not depend on `index` — the two are kept consistent only by the `emitted` ref, so anyone adding `index` to the clock's deps to silence an exhaustive-deps lint reintroduces the overrun the comment warns about; the component's own doc comment describes a removed second row and says nothing about the keyboard transport, which is a third of the body.

## web/src/components/MascotFigure.tsx

### `loadOrMint` — nearly
- read at `296f66e763ec` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Reads a persisted MascotConfig from localStorage, JSON-parses and returns it when present; otherwise mints a fresh random config (via the pick helper over option lists), writes it back to storage, and returns it. Try/catch so bad JSON or missing storage falls through to minting.
- found: Exactly that shape, with two separate try/catch blocks: one around read+parse, one around the write-back so an unavailable storage still returns a mascot. The fresh config comes from an imported randomizeMascot() rather than the local pick helper.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes
- note: The parse result is cast to MascotConfig with no shape check, so a config stored by an older version — or any valid JSON at all — is returned unvalidated and only the mint path guarantees a well-formed mascot.

### `MascotFigure` — surprising
- read at `a5609c67fe2c` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: A component holding a MascotConfig in state initialised once from loadOrMint, deriving a mood from the events prop via the local moodFor helper and forcing a sleeping mood when active is false, then rendering the neo-mascots figure at size with that config and mood; plus a useEffect keyed on the newest event that flashes a transient reaction and settles back, and possibly a click handler that re-mints.
- found: Config-from-loadOrMint and moodFor-driven reactions were right, but the mascot is driven IMPERATIVELY through a ref handle (play/wake), not by a mood prop, and there is no re-mint handler. Two effects do the work: one toggling sleep/wake on `active` against an asleep ref, and one that replays every call whose `seq` exceeds a high-water mark — capped at MAX_REPLAY, staggered by BEAT_MS timers, first one immediate — because the two-second poll would otherwise animate only the last call of each batch. Both defer a frame via requestAnimationFrame since play() before the scene mounts is dropped, and both clean up their frame and timers.
- predicted: some · documented: none · derivable: no · legible: full · trap: yes
- note: The doc handed over describes the module's lazy-chunk isolation rather than the component, and the replay effect advances its high-water mark to events[last].seq while selecting by filter, so it silently depends on the caller's "oldest first" ordering — one out-of-order batch skips every call behind the largest seq forever.

## web/src/components/Overlay.tsx

### `Overlay` — nearly
- read at `9b14ec9655fd` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A tiny wrapper: fixed full-screen semi-transparent backdrop, children centred with flex, onClick={onClose} on the backdrop, and an inner wrapper calling stopPropagation so clicks inside the panel do not close it.
- found: The backdrop half exactly — fixed inset-0 z-50 flex centring, rgba(0,0,0,0.5), onClick={onClose}. But there is no inner wrapper and no stopPropagation: children are rendered bare, so the responsibility the doc comment describes is pushed onto every caller.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The doc says "the panel itself must stop propagation" but nothing here does it or enforces it, so any caller that forgets gets a modal that closes when you click inside it — a contract stated in prose and checked nowhere.

## web/src/components/PartyAnts.tsx

### `wanted` — as expected
- read at `827bd46826fe` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A one-line arrow computing how many ants to draw for a viewport width and height: density scaled by area, clamped between a floor and a ceiling, roughly Math.max(min, Math.min(max, round(w*h/K))).
- found: Exactly that: Math.max(MIN_ANTS, Math.min(MAX_ANTS, Math.floor((w * h) / AREA_PER_ANT))).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/RollupDots.tsx

### `RollupDots` — nearly
- read at `2cf13c243384` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Returns an SVG defs/pattern keyed by the given id, filled with small circles, whose patternTransform rotates by angle about the patch's own cx/cy so the dot grid follows the wedge's radial direction rather than the screen; used as the fill for a rolled-up wedge standing in for many tiny children.
- found: That, but with the transform worked out properly rather than a rotate-about-a-point: it converts angle to degrees minus 90 (angles run clockwise from twelve o'clock), computes where the tile's centre dot lands after rotation (dx, dy = R(theta)·(HALF,HALF)), and emits patternTransform="translate(cx-dx cy-dy) rotate(deg)" so a dot sits exactly at the patch centre. Single circle at the tile centre, r=0.7, filled with var(--background) at 0.85. Extensive comments justify per-roll-up emission and the mid-angle rotation approximation.
- predicted: most · documented: none · derivable: no · legible: full · trap: yes
- note: The translate depends on the composition order translate-then-rotate; swapping the two transform terms would silently misplace every patch's dots, and only the comment records why.

## web/src/components/SideBar.tsx

### `ProjectItem` — nearly
- read at `f27112610f1c` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A presentational sidebar row: rounded 28px button, project name on the left (truncated), a right-aligned count from ProjectSummary, active-state colours, onClick, probably a title tooltip with the repo path.
- found: That, plus a loading branch I did not predict: a `done` flag (assessed >= functions, guarded against 0 functions) that recolours the count with --agent-mark; a bullet icon glyph; a title that switches between "reading…" and "N of M read · K stale"; and while project.loading the count is replaced by a rescan percentage (read_done/read_total) or the word "reading…", with an inline comment explaining that 0/0 would be a measurement nobody took.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc describes the row's chrome but not the loading state, which is the half of the body a reader could not guess.

## web/src/components/StaleHatch.tsx

### `StaleHatch` — nearly
- read at `bbc24a833314` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Renders a hidden zero-size svg containing a defs with one pattern id="stale-hatch" of 45-degree diagonal lines over a transparent background, a few pixels wide, patternUnits="userSpaceOnUse". Mounted once at app root so fill="url(#stale-hatch)" resolves anywhere; stroke a semi-transparent neutral or CSS variable so it reads over any wedge colour.
- found: Returns a bare `<defs>` (not a wrapping svg — it is dropped inside an existing one) holding a 6x6 userSpaceOnUse pattern with patternTransform rotate(45), a transparent rect, and one vertical line stroked var(--foreground) at width 1.6 and opacity 0.45.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: It returns a bare defs rather than its own svg, so the single-id guarantee the docs argue for depends on every caller mounting it exactly once inside their svg — the constraint is stated in prose but nothing in the component enforces it.

## web/src/components/Summary.tsx

### `Spread` — nearly
- read at `02498c946b1c` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A stacked bar plus legend: segments for the four grades from the shared heat ramp plus neutral stale/unread, widths proportional to counts, zero counts skipped, clicking a segment or key row calls onPick(g) toggling to null when already picked, picked row emphasised, counts shown.
- found: That, with one distinction I did not predict: only the GRADE rows are interactive. Returns null when total is 0; builds segs from GRADES via heatColor(GRADE_SURPRISE[g]) plus 'expired' in --unanalyzed and 'unread' in --structure, filtered to n > 0; renders a 2px-high flex bar with percentage widths and title tooltips; then a key where each grade row is a <button> with aria-pressed and toggle-to-null, while expired/unread render as inert <div>s, with an inline comment arguing they are the absence of a reading rather than a reading and that acting on them belongs in Next Steps. The bar segments themselves are not clickable — only the key is.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc covers the encoding thoroughly but never mentions that the key doubles as the filter control, which is half of what the body does.

## web/src/components/Sunburst.tsx

### `Sunburst` — surprising
- read at `aecc9a2d9912` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: The main sunburst view: computes a partition layout from root with angle proportional to lines, memoised on root identity; renders one path arc per node coloured by mode (using heatShare and the stale hatch for expired readings); handles hover tooltips, click to onSelect, double-click to onDrill, background click to onClear, a centre hub showing the current root calling onUp when defined; plus label placement along arcs, transitions on layout change, and keyboard/zoom handling.
- found: All of that, plus a whole animation architecture I did not anticipate. A level change is detected DURING RENDER (comparing prevRoot.current.id) so the first painted frame is already the first frame of motion; a rAF loop keyed on a `run` counter (never on `t`, which would rebuild the effect per frame and restart the clock) drives t 0..1; `live` records every wedge's position each frame so an interrupted transition resumes from the picture on screen. Three special-cased movers beyond the ordinary lerp: `coring` (the clicked directory shrinking into the hub), `leaving` (the departing level flying outward, drawn outside the fitted group), and `fileLeaving` (an open file's tiling rolling back up, driven at 1-e). Opening a FILE is not a ring level at all — FileZoom unrolls its treemap into a fan out of the sector the wedge occupied. The viewBox is fitted from measured extent and written directly to the element via setAttribute to avoid a second React render per frame. Pixel thresholds (minAngle, minPatchArea) are derived from a ResizeObserver-measured pane through a quantised unitsPerPx, with the area threshold squaring the conversion. Function patches are NOT drawn while moving and fade in by CSS on settle. Also: option-click folds a directory, a corner note counts folded and too-thin omissions with an unfold-all button, an invisible wider hit target for file rims, roll-up dot texture above a pixel threshold, a single deferred `highlight` path drawn last so no sibling eats half the stroke, and elided hub text sized to fit.
- predicted: some · documented: none · derivable: no · legible: most · trap: yes
- note: A 1,066-line component with no doc comment that mutates six refs during the render pass — the level-change block writes prevRoot, from, coring, leaving, fileFrom and fileLeaving before returning JSX, so it is not idempotent under React StrictMode double-render or any future concurrent re-render, and nothing in the code says so.

## web/src/components/WedgeLabel.tsx

### `WedgeLabel` — surprising
- read at `8ce325b7d515` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: One SVG label renderer branching on the Placement: for a curved placement, a path in defs keyed by id plus text/textPath following it with a start offset and anchor for the flipped case; for a flat placement, a plain text at x/y with an anchor. Face, weight, tracking and the halo/stroke separating it from the wedge come from labelStyle() read live and applied as inline style plus paintOrder/stroke. fill and opacity pass through; no layout maths, fitLabel already decided.
- found: The arc branch is as predicted (defs path from labelArc, textPath at startOffset 50%). The other branch is not flat text — it is RADIAL: rotate(angle) translate(0,-r) then a further +/-90 so the name runs core-to-rim, flipped inward in the left half so it still reads left to right. And there is no labelStyle at all: the style is two module constants (FAMILY, TRACKING) plus WEIGHT and OPACITY, with an inline comment recording that halo, plate and shadow separations were all built, compared on a workbench, and none shipped.
- predicted: some · documented: some · derivable: no · legible: full · trap: yes
- note: Two of the docs handed to me are stale in opposite directions: the function comment says appearance comes from `labelStyle` live when the body reads fixed module constants and an inline comment says that control was deleted, and the paragraph attached to the numeric `opacity` prop describes a prop that names WHICH KIND of label — clearly left behind from a `kind` prop that no longer exists.

## web/src/components/WedgeTip.tsx

### `WedgeTip` — nearly
- read at `1faa94a19a41` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A ~170-line presentational tooltip: offset from x/y, flipping back across the pointer when it would overflow `box`; header with name/owner/path plus per-kind detail including countFiles for directories; the reading as a colour swatch with a word and never a number; "not measured yet" when absent; a stale label on hover; mode-dependent rows (age/churn vs surprise); a rank line from `ranks`; and a fold hint only when `folded !== undefined`.
- found: Broadly as predicted. Details I did not cover: `ranks` is not rendered as a rank row at all — it is only passed through to `colorFor` so the swatch matches the ring. The extras table is a four-way branch on mode (surprise shows a Documented percentage as a NUMBER; churn shows commits-in-90d and first-seen; age shows last-touched and first-seen; owner/language show nothing because the swatch label is the value). Placement uses a hand-estimated height H reconstructed from the row count rather than a measured one. Functions get a distinct two-line header (name, then path with the line number as a separate non-shrinking span) because the path-dedup used for dirs/files hid the function name entirely. Size, file count and a `rest` roll-up share the swatch row. The fold hint is two near-identical branches on `folded === undefined`.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: H is a hand-maintained estimate of the card's own height and its comment says so, but nothing enforces it: the surprise branch's Documented row, the stale-warning paragraph and the two-line function header are all absent from the arithmetic, so adding or removing a row silently flips the card the wrong way near an edge.

## web/src/components/Wordmark.tsx

### `Wordmark` — as expected
- read at `a8bc0df9a246` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: An inline svg with a fixed brand viewBox, height from the prop and width from the aspect ratio, fill="currentColor" so it inherits ink/white, role="img"/aria-label or a title reading "sanity", and one or more paths holding the letterform outlines.
- found: Exactly that: viewBox 0 0 329 125, height={height}, role="img" aria-label="Sanity", fill="currentColor", explicit xmlns, and six <path> elements — one per letter of "sanity", in reverse order (y, t, i, n, a, s). No width attribute at all; the viewBox aspect ratio supplies it.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs are entirely about brand provenance and the optical-size rationale — nothing a reader could derive from the path data, and the most useful kind of comment on a body that is otherwise opaque coordinates.

## web/src/components/shell/SideBarHeader.tsx

### `SideBarHeader` — nearly
- read at `048333edc686` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A small presentational React component returning a fixed-height header div matching the TopRow height, with left padding large enough to clear the macOS traffic lights (conditionally under Tauri), containing the wordmark plus alignment classes. No state, no props.
- found: Broadly that, but it is NOT stateless: it subscribes via useEffect/onFullscreenChange to fullscreen changes, because macOS hides the traffic lights in fullscreen and the reserve must collapse (to 9px) or the wordmark strands in an empty gutter. It also carries data-tauri-drag-region and wraps <Wordmark /> in a pointer-events-none div so the wordmark does not punch a dead spot in the drag region.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs mention the traffic-light reserve but not the fullscreen case, which is the only reason this component holds state at all.

## web/src/components/shell/TopRow.tsx

### `TopRow` — as expected
- read at `059a0f998b8c` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An eleven-line presentational component: a div at a fixed height matching SideBarHeader, data-tauri-drag-region on the strip, border/background classes, laying children (the colour-mode switcher) out centred with flex; no state or handlers.
- found: Exactly that, as a `<header>`: data-tauri-drag-region, `shell-chrome flex shrink-0 select-none items-center justify-center`, height from the CSS var `--titlebar-h`, rendering children. The shared height is a variable rather than a duplicated number, and the border/background live in the `shell-chrome` class rather than inline.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/api.ts

### `applyScores` — nearly
- read at `9076dab0c346` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A recursive rebuild: leaf/function nodes look up their id in scores and return a clone carrying the new score, else return unchanged; containers map over children, return the same object when nothing beneath changed (structural sharing), and otherwise clone with recomputed aggregates — LOC-weighted mean and analysed-lines-only hot share, mirroring Node::aggregate. Returns the possibly-new root.
- found: That shape, with two details I did not name: leaves are identified by children.length === 0 rather than a kind check; and the upgrade patches ONLY surprise, hotspots, source='model' and analyzedShare=1, deliberately preserving churn, age and doc coverage because those describe the code rather than the instrument. The aggregate arithmetic itself is delegated to a sibling, `reaggregate(node, children)`, so this function does not contain the mirrored math the docs describe.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc's biggest claim — the LOC-weighted mean and hot-share arithmetic that must mirror model.rs — lives in `reaggregate`, not here, so the warning is attached to the wrong function.

## web/src/lib/cn.ts

### `clsx` — as expected
- read at `e8933499c48d` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Filters out falsy entries and joins the remaining strings with a single space: parts.filter(Boolean).join(' ').
- found: Exactly that, character for character.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/colorMode.ts

### `opaqueShare` — nearly
- read at `7278be878d5a` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A recursive subtree walk accumulating two line totals: every function node carrying a legible grade adds its LOC to a read denominator, and adds the same LOC to an opaque numerator when the grade is at the hard end (some/none). Containers recurse and sum. Return null when read is zero, otherwise opaque/read. No internal memoisation.
- found: Exactly that, with one condition I did not name: the reading must also be non-stale (!n.agentStale) as well as present and carrying a legible grade, so an expired reading is excluded from both numerator and denominator rather than counted as read.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `legendFor` — nearly
- read at `673cd639d481` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: For categorical modes it walks the tree from root collecting each node's category value, dedupes, and returns them in a stable order (likely frequency-ranked or fixed bucket order); for ramp modes it returns an empty array since a continuous ramp needs no discrete entries.
- found: Returns [] unless mode is 'blame' or 'language'. Walks the tree accumulating, per key (lastAuthor or lang) and only for kind==='func' nodes, the SUM OF LOC rather than a count, then returns keys sorted by that total descending — so the legend order reflects how much of the picture each category occupies.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: Weighting by lines rather than by count is the one non-obvious choice, and the inline comment says exactly why.

## web/src/lib/fan.ts

### `fanFor` — nearly
- read at `fecd387dec73` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Take the mid-angle of `src` as the bearing (default when null), sweep candidate spans, fit each to paneAspect the way the viewBox will, and return the Sector at that bearing whose on-screen area is largest.
- found: That, in a degree-stepped loop: mid = midpoint of src or NO_WEDGE_BEARING; radii fixed at RIM and RIM*CORE_SHARE; for each span from MIN_SPAN to MAX_SPAN in STEP degrees it builds the bounding extent via extentOf, computes the viewBox scale as min(paneAspect/w, 1/h), scores annular-sector area times scale squared, and keeps the max. Returns the sector at that span, with radii expressed as v0/v1 through vOf rather than r0/r1.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The returned Sector uses v0/v1 (a transformed radius) while the search works in r0/r1, so the type carries two radius representations.

## web/src/lib/history.ts

### `scopedCommits` — nearly
- read at `3602f169da67` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns indices into hist.commits of commits touching a path under `scope`; empty scope returns all indices; filtering tests changed-file paths against the scope prefix segment-wise so `web/src` does not match `web/src-old`.
- found: Exactly that. One detail beyond my prediction: files are stored as indices into a shared `hist.paths` table, so it precomputes an `inScope` boolean array over the path table once and then tests commits by index lookup rather than string-comparing per file.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The docs explain WHY the scoped list is a view rather than a re-fold — the date/colour argument — which the body alone could never tell you.

## web/src/lib/ink.ts

### `inkOn` — nearly
- read at `c90ed237aaf5` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Normalises the token (stripping var() and leading --), resolves it through getComputedStyle on the root, returns the chrome ink if it does not resolve to a plain colour, otherwise composites it over the pane background at `alpha` via `over`, takes its luminance, and returns whichever of the two brand inks has better contrast.
- found: That, plus a memo I did not predict: a module-level cache keyed on `theme()|token|alpha`, so the theme is part of the key and a theme switch cannot serve a stale ink. Token normalisation lives in `resolve`, not here. `over` returns a luminance directly rather than a colour, and is skipped entirely when alpha >= 1 or the background itself does not resolve. PAPER wins ties (>=).
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The nested ternaries computing `y` and `chosen` are the one place the body is harder to read than what it does; the cache key correctly includes the theme, which is the subtle part and is not mentioned in the docs.

### `resolve` — nearly
- read at `d458e5fd6f73` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes a CSS custom-property token name, reads it from the document root via getComputedStyle(document.documentElement).getPropertyValue, trims it, returns null if empty/undefined or not a plain hex string so color-mix values fall through to a caller-side fallback.
- found: Exactly that, plus two things I did not cover: an SSR/no-document guard returning null, and unwrapping a `var( ... )` wrapper off the token before checking it starts with `--`. The hex check is a strict /^#[0-9a-f]{6}$/i.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The six-digit-hex-only regex silently rejects valid CSS shorthand (#fff), 8-digit hex, and rgb()/oklch() stops, so a future palette edit in index.css that uses any of those makes tokens vanish into the fallback with no warning.

## web/src/lib/label.ts

### `middleTruncate` — nearly
- read at `057f6ebaee05` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Returns name unchanged when its length is at most keep; otherwise splits the budget roughly in half, taking the first ceil((keep-1)/2) chars and the last chars, joined by a single ellipsis, so head and tail both survive and the result is exactly keep characters wide.
- found: Same shape, with two details I missed: a MIN_KEPT floor below which it returns the empty string rather than a useless stub, and the ellipsis is charged on TOP of keep (head = ceil(keep/2), tail = keep - head, so the output is keep+1 glyphs), with a guard for tail === 0.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: `keep` is a character budget that excludes the ellipsis, so every truncated label is keep+1 glyphs wide — a caller sizing against a pixel width will overflow by one glyph, and the doc comment's "costs one glyph" is the only place that says so.

## web/src/lib/runtime.ts

### `onFullscreenChange` — nearly
- read at `09d0c2b498ce` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Subscribes to the window's resize event, queries the Tauri window's fullscreen state (getCurrentWindow().isFullscreen(), async) on each resize plus once immediately, calls cb with the boolean, and returns an unsubscribe that removes the listener; a no-op returning () => {} when not Tauri/macOS.
- found: That, using the Tauri window's own onResized rather than the DOM resize event, and with careful teardown-race handling I did not predict: a `dead` flag suppresses a late cb, the @tauri-apps/api/window import is dynamic inside an async IIFE, and if unsubscribe runs before the listener is registered the awaited handle is immediately unregistered.
- predicted: most · documented: most · derivable: no · legible: most · trap: no

## web/src/lib/sunburst.ts

### `layout` — surprising
- read at `edc13ec63f43` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A recursive descent from root assigning each node an angular span proportional to its lines within its parent's span and a radial band per depth up to maxDepth, emitting a flat array of arc records (path via arcPath, colour via heatOf, node, depth) plus label placements via labelArc, with opts controlling start angle, min angle or padding; function nodes possibly routed through tileFunctions/sliceFunctions.
- found: A recursive walk producing only angular geometry: wedges of {node, depth, a0, a1, index}, no paths, no colours, no labels — those are other functions' jobs. Children are sorted biggest-loc-first (name as tiebreak) or by heat when opts.byHeat, weighted by loc or evenly with opts.even, and the sweep starts at 9 o'clock so the biggest wedge lands across the top. Descent stops at maxDepth, at leaves, or at collapsed ids. Sub-minAngle children are culled EXCEPT functions (they render as dots with a floor), and the cull tallies the whole dropped subtree into hidden.files/hidden.dirs, deliberately not counting functions. Returns wedges, hidden, and the max depth reached.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: No docstring, but the inline comments are the best in-body reasoning I have seen so far — every non-obvious constant (9 o'clock start, size ordering, the function-cull exemption) carries its argument.

## web/src/lib/text.ts

### `compactCount` — as expected
- read at `3d19f02e2df4` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Below 100,000 return n.toLocaleString(); at 1e6 and above divide by 1e6 with one decimal and an M suffix; between, divide by 1000 with one decimal and a k suffix, probably trimming a trailing .0.
- found: Exactly that shape, with the k branch at toFixed(0) rather than one decimal (so 100k–999k is a whole number of thousands) and M at toFixed(1). No trimming needed.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/theme.ts

### `loadTheme` — as expected
- read at `a0cd551989f5` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads a persisted theme from localStorage under a module-level key, validates the stored string against the allowed Theme values (light/dark/system), returns it if valid, otherwise returns a default of 'system'. Expected a try/catch so unavailable storage falls back to the default rather than throwing.
- found: Exactly that: try { getItem(KEY); if raw is 'light'|'dark'|'system' return raw } catch { comment } return 'system'.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `saveTheme` — nearly
- read at `3513dcd2632b` · commit `837e620` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A seven-line persistence helper: write the theme to localStorage under a module-level key inside a try/catch (or remove the key when the value is 'system'), then call applyTheme(t) to update the document element.
- found: Just the try/catch localStorage.setItem(KEY, t), with a comment saying the swallowed failure only costs the preference across a restart. No 'system' special case and no applyTheme call — applying is a separate function and this one only persists.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

## web/src/lib/zoom.ts

### `extentOf` — as expected
- read at `07f59c070883` · commit `837e620` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Iterate the geos; for each annular sector take its four corners (r0|r1, a0|a1) mapped by x = r sin a, y = -r cos a, and for each quarter-turn crossing inside [a0,a1] include the extreme at the outer radius; track min/max seeded to include the hub circle of radius hubR; return {x0,x1,y0,y1}.
- found: Exactly that. Bounds initialise to ±hubR (commented as keeping a sparse level from fitting to one lonely arc), an `at(r,a)` helper widens the box, degenerate geos (r1<=0 or a1<=a0) are skipped, four corners are added, then quarter turns are walked from ceil(a0/(π/2))*(π/2) up to a1 at the outer radius only.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment is unusually load-bearing: it explains why getBBox was rejected, which is the one thing the body could never tell you.
