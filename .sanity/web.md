# web — sanity assessment

190 of 190 functions read · 15 surprising

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## web/src/App.tsx

### `sameProjects` — as expected
- read at `df1387c3874a` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Length comparison first, returning false if lengths differ, then a loop over indices comparing each ProjectSummary field by field — key/name/path plus the progress numbers the sidebar shows (functions, assessed, stale) — returning false at the first mismatch and true otherwise.
- found: Exactly that: length check, then `a.every` comparing eleven fields of the paired element — key, name, touched, repo, assessed, functions, stale, working, loading, read_done, read_total.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs handed over open with a sentence about finding a node by id for the drill-in stack, which belongs to the neighbouring findById, not to this function.

### `findById` — as expected
- read at `79803b48606a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Recursive depth-first search: return node if its id matches, else recurse into children returning the first non-null hit, else null.
- found: Exactly that, five lines of it.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `parentOf` — as expected
- read at `c0cda91e70f7` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A recursive tree walk from `node`: if any direct child has `id`, return `node`; otherwise recurse into each child and return the first non-null hit; null if `id` is the root or not found. Structural rather than stack-based, so "up" is always one ring out.
- found: Exactly that, in five lines — a for-loop over children returning `node` on an id match, recursing otherwise, null at the end. No memoisation, no guard against a cyclic tree (there is none to guard).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `App` — nearly
- read at `efd20da82ac6` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: The top-level component holding all app state (project/tree, selection, drill stack, view mode, history playhead, hover, theme), polling the backend for projects and agent readings via Tauri invoke, folding reports into the tree, and laying out the shell — sidebar with projects/progress, sunburst pane, detail panel, history transport — with keyboard wiring and an empty state when no project is open.
- found: Essentially that, at 736 lines. State for scan, error, picked node, drill stack, reveal nonce, code overlay, theme, agent activity, projects, MCP connectedness, and the whole history subsystem (timeline, key, busy, progress, playhead, playing, duration). Effects: theme menu sync, Cmd-1..7 lens shortcuts (pinned during history), a 1.5s project poll that switches to whatever an agent opened, a 2s readings/activity poll suppressed during replay, a 400ms batched stream-score flush, a 4s MCP-client poll, history warm/scan/drop-on-project-change. Derived memos for repoPath, activeProject, frame tree, focus, scoped commit list, breadcrumb trail walked up the tree, and drill/goTo/goUp callbacks. Renders sidebar, TopRow with mode switcher and history toggle, sunburst or progress/empty/error pane, ColourLegend, HistoryBar, and either CommitLog or Detail in the aside, plus an AgentSetup sheet and a modal CodeView.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: A 736-line component with no doc comment of its own, though nearly every state hook and branch carries a paragraph explaining why it is shaped that way.

### `useProgress` — as expected
- read at `022713725cb5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A hook returning {pct, eta}: pct = done/total, 0 when total is 0 or progress is null; a start time in a ref; a rate from elapsed and items done; eta in minutes from the remaining count, null until at least 20 items and 2% are done because a small sample swings.
- found: Exactly that. started is a useRef(Date.now()) re-stamped once in a mount effect; pct = done/total or 0; eta = round((elapsed/pct - elapsed)/60) minutes, gated on done > 20 && pct > 0.02, else null. Note it extrapolates from fraction complete rather than an explicit item rate, which is equivalent.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: elapsed is computed during render off Date.now() rather than from a ticking value, so the ETA only refreshes when something else re-renders the component.

### `ProgressTrack` — nearly
- read at `02dad8fe74e4` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A small React component returning a track div with an inner fill div; when `progress` is null it renders an indeterminate `track-sweep` animation, otherwise the inner bar's width is set from `pct`. No logic beyond that conditional.
- found: Exactly that: an `h-1 w-full` rounded track coloured `--border`, holding either an accent-coloured fill with `width: ${Math.round(pct*100)}%` and a width transition, or a `track-sweep` bar when `progress` is null.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ProgressPane` — nearly
- read at `fdcd9adcf3f5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: The full-pane variant of the progress indicator for when no map is loaded: a centred flex container filling the pane, rendering a wider ProgressTrack/ProgressStrip from the progress prop plus the label and phase/count text, returning null when progress is null.
- found: A centred full-height flex column with a caption ("Scoring done / total functions", or the `label` prop falling back to "Walking the repo…"), a ProgressTrack constrained to min(320px,60%), and a conditional "~N min left" line. pct and eta come from the useProgress peer. It does NOT return null on a null progress — that is precisely the indeterminate case it renders the label for, which I got backwards.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc is written as a contrast against a sibling ("the same wait, on an empty pane rather than over a map"), which said more about the design than a self-contained description would have — but it names neither the ETA line nor the label fallback.

### `ProgressStrip` — nearly
- read at `8e80491e8cc2` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Returns null when progress is null; otherwise renders a thin bar whose filled width is done/total as a percentage, over a sentence that is `label` when supplied and a scan message otherwise, likely delegating the bar to ProgressTrack.
- found: Always renders the strip — with `progress` null it says "Reading the repo…" rather than disappearing, so the bar does not pop in and out. Four sentence cases from label × progress, an ETA from useProgress shown as "~N min left" with 0 rendered "<1", and the bar itself delegated to ProgressTrack with the computed pct.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says only the sentence changes with `label`, but the noun is hardcoded per branch — a labelled wait always counts "commits", so any third caller that is not the history replay would silently report the wrong unit.

### `HistoryToggle` — as expected
- read at `d488a001385a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A small React presentational component rendering one button beside the lens switcher, styled active when `on`, disabled/spinner when `busy`, calling `onToggle` on click; button plus title tooltip and conditional Tailwind classes.
- found: Exactly that: a single button, onClick=onToggle, disabled when busy, a title that swaps between "Back to the repo as it stands now" and a replay explanation, inline style tokens (accent background, weight, shadow, dimmed opacity when busy), and label "Reading…" vs "History".
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `Empty` — as expected
- read at `04124f0a9c2c` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The first-run gate screen: a centred card with two numbered Step rows — step one "connect an agent", ticking green off `connected` and offering a button that calls onConnect; step two a CopyPhrase holding the verbatim sentence to paste into the agent, probably dimmed until step one is done. No hand-open door and no dismissal.
- found: Essentially exactly that: a bordered card headed "Study your first project" (LINE Seed JP, negative tracking), Step 1 "Connect an agent" with done={connected} and swapped prose, a conditional accent button calling onConnect indented to the text column, a line pointing at the gear in the Agent panel, then Step 2 "Ask it to study a project" (always done={false}) with a CopyPhrase of "study this project in sanity". Step two is not gated or dimmed, and the card also exists to give the animated background a floor.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Comment volume outweighs code roughly two to one, and most of it records rejected alternatives rather than what the code does.

### `CopyPhrase` — nearly
- read at `5bf31e10f2cf` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A React component rendering a button that copies `phrase` via navigator.clipboard.writeText with failures swallowed in an empty catch; on success it sets a `copied` state so the label swaps to "Copied", reverted by a setTimeout after a second or two, cleaned up in an effect. Renders the phrase text plus the button.
- found: That, with the phrase rendered INSIDE the button (mono span on the left, affordance on the right) rather than beside it, and the confirmation swapping a copy-icon SVG for a small uppercase "Copied" rather than changing a text label. Revert is 1600ms; there is no effect and no cleanup — the timeout is fired straight from the click handler. A long inline comment explains why the phrase sits left of the icon.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Step` — as expected
- read at `1687a730b657` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A small presentational component rendering one numbered gate step: a circular badge showing n, or a checkmark when done, the title in bolder text, and children as the body beneath, with accent colouring on the badge marking completion and muted styling elsewhere.
- found: Exactly that: a flex row, a 5x5 rounded-full badge showing '✓' when done else n, background/colour switching between --accent/--accent-foreground and --secondary/--muted-foreground, then a column with the title in font-semibold foreground and children in a muted paragraph.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Correction of an immediately prior report on this id: cold was mis-entered as false, this was my first look at App.tsx.

## web/src/CodeWindow.tsx

### `fileByPath` — as expected
- read at `b2957f945f19` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Depth-first recursive search: return the node if it is a file whose path matches, otherwise recurse into children returning the first non-null hit, else null.
- found: Exactly that, in five lines: kind === 'file' && path match returns the node, otherwise recurse over children and return the first hit, else null.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `CodeWindow` — nearly
- read at `24f3c2c44870` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A top-level window component that on mount fetches the scan for repo, resolves the file node by relPath via fileByPath, holds loading/error state, renders the shared code view, sets a title from the path, and shows a plain message if the file isn't in the scan.
- found: That, via listProjects -> find by repo -> projectScan(key) -> fileByPath, with a live flag to cancel, three distinct error strings, and a loading placeholder. Beyond my prediction: a watchSystemTheme(loadTheme()) effect because the popped-out window is a separate JS context, and a hand-rolled data-tauri-drag-region titlebar strip showing relPath with pointer-events-none, plus CodeView rendered with pop-out and close deliberately disabled.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/AgentMascot.tsx

### `AgentMascot` — as expected
- read at `61eafacdfe15` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Lazily loads the heavy mascot bundle and, until it resolves, renders an empty size x size box to reserve the row's layout; once loaded renders the mascot driven by `events` and `active`. Probably a Suspense boundary with a fixed-size fallback.
- found: Exactly that, and nothing more: a Suspense whose fallback is a shrink-0 aria-hidden span of width/height `size`, wrapping a lazily-imported MascotFigure with the three props forwarded. The lazy() call itself is above the function.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/components/AgentSetup.tsx

### `AgentSetup` — nearly
- read at `bbd9d4cb2fd5` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A React modal/panel holding state for detected MCP clients, fetching status via Tauri invoke on mount, rendering one ClientRow per client where each row shows connected/not-connected and carries its own connect action that writes that client's config then refreshes; plus explanatory header, maybe a copyable command, and a close button wired to onClose.
- found: Exactly that, with the action as a toggle rather than connect-only: rows disconnect when already registered and current. State for cmd/clients/busy/error/copied; useEffect fetches mcpCommand and mcpClients; per-row busy spinner and a shared error line. Renders inside an Overlay with prose explaining MCP, the restart/user-level-config caveat, the phrase to say to the agent, and a selectable pre block of the raw server JSON with a Copy button whose clipboard failure is deliberately swallowed because the block is selectable.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `ClientRow` — nearly
- read at `fadfb536fc52` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A React row for one MCP client: display name and config path, a status badge saying whether sanity's MCP server is installed there or the client isn't present, and a single install/remove button wired to onToggle, disabled with a pending label while busy.
- found: That, plus a third state I did not have: `registered && !current` is "stale" — configured but pointing at a different sanity binary — which gets a warning subline and turns the button into "Repoint". Non-writable configs get a text label ("connected" / "add by hand") instead of an unusable button. The config path rides as a title tooltip rather than visible text.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The stale/"points at a different sanity" state is real product knowledge that nothing in the signature or docs hints at.

## web/src/components/Bloom.tsx

### `petals` — surprising
- read at `48518f1f3d27` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: An SVG-generation helper in a decorative flower component: loop over a fixed petal count, compute an angle per petal, and concatenate path/ellipse markup with rotate transforms into one string for Flower to inline.
- found: Builds a single SVG path `d` string for a rose/rhodonea-style polar curve: 240 samples of theta over a full turn, radius r = A * |cos(K*th)|^(1/P), converted to cartesian M/L commands and closed with Z. One closed path, not per-petal elements, and no transforms.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The petal count lives entirely in the module constants A, K and P, so the name gives no hint that this is one polar curve rather than a set of shapes.

### `seedHead` — as expected
- read at `9941badd8f72` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A phyllotaxis spiral of seed circles for a flower centre: golden-angle steps, radial distance growing as sqrt(i), each seed a small circle, returned as an array for Flower to render.
- found: Exactly that: 13 seeds, theta = n * GOLDEN, radial distance A * 0.115 * sqrt(n), constant seed radius A * 0.05, cx/cy from cos/sin, returned as an array.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `Flower` — nearly
- read at `d47529b9df6d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A small React SVG component drawing one flower at scale s: a &lt;g&gt; with transform scale(s), rendering the petals helper's path plus a seedHead circle, coloured from a palette.
- found: A &lt;g scale(s)&gt; containing the precomputed PETALS rose path filled translucent with a stroke, then the SAME path nested inside a scale(0.45) group as an unfilled inner outline (with a comment arguing a rose is self-similar under scaling about the origin, so this is not a second shape to maintain), then SEEDS mapped to translucent circles. All colour is currentColor, not a palette.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The peers list names `petals` and `seedHead` as functions but the body consumes constants PETALS and SEEDS instead, so the sibling names mislead about how the shape is produced.

### `Leaf` — nearly
- read at `837dd46c66e8` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A tiny presentational SVG component drawing the vesica piscis: two symmetric arc segments in one path (M .. A r r 0 0 1 .. A r r 0 0 1 Z) with the arc radius tied to the circle radius, wrapped in a scale(s) transform, filled/stroked with a theme colour, no state.
- found: That, plus a second path I did not predict: a straight midrib line across the leaf at 0.45 stroke width. The arc radius is R = L * 1.16, which is the true vesica ratio (2/sqrt(3) = 1.1547) rounded, so the docstring's geometric claim does hold. Colour is `currentColor` throughout with fillOpacity 0.18.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: 1.16 is a rounded 2/sqrt(3) with nothing in the code saying so, so the one constant that makes it a true vesica reads as a magic number.

### `Tile` — as expected
- read at `27138f34720a` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A no-argument SVG sub-component returning one repeating unit of the wallpaper pattern — a group placing a few Flower and Leaf elements at fixed coordinates and rotations inside a square cell, arranged so the cell tiles seamlessly.
- found: Returns a single `<g>` built from three precomputed coordinate tables named for wallpaper-group symmetry orders: SIXFOLD sites get a large `Flower` (s=1.45), THREEFOLD sites a small one rotated 30 degrees (s=0.72), and TWOFOLD sites a `Leaf` at a per-site angle (s=0.62). Coordinates are formatted to two decimals in the transform strings.</found> <parameter name="predicted">full
- predicted: full · documented: none · derivable: yes · legible: most · trap: no

### `Bloom` — surprising
- read at `0e2a112d96ee` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Exported top-level React component of a decorative flower illustration taking an optional className; returns an SVG composing the sibling pieces — Leafs, Flowers built from petals and seedHead, over a Tile background — with a fixed viewBox and className on the root, as a static splash/empty-state graphic.
- found: Returns a 100%x100% aria-hidden SVG with preserveAspectRatio slice, whose defs hold a single userSpaceOnUse `pattern` tiling `Tile` at a 3x3-ish grid of OFFSETS translations, filled into a full-size rect. It is a repeating wallpaper pattern, not a single illustration; Flower/Leaf/petals/seedHead are reached only indirectly through Tile. A long comment explains why patternTransform rotate(-6) was removed.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: The OFFSETS x OFFSETS duplication inside one pattern tile is the one thing the body does not explain — presumably wrap-around so motifs crossing the tile edge repeat, but nothing says so.

## web/src/components/CodeView.tsx

### `tokenize` — as expected
- read at `d364f0c54271` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A minimal syntax highlighter: scan the line with a regex alternation (comments, strings, numbers, keywords, identifiers) returning {text, kind} tokens, unmatched runs emitted as plain so concatenation reproduces the line.
- found: Exactly that: one global regex with ordered alternatives (line/hash/block comments, then the three quote styles, numbers, words, whitespace, single punctuation chars), dispatching on which group matched into cls values tok-comment/string/num/key/plain/punct, with keywords decided by a KEYWORDS regex test on the word. There is no explicit unmatched-text branch — the final `[^\s\w]` alternative catches the remainder instead.
- predicted: full · documented: none · derivable: no · legible: most · trap: no
- note: Warm: I had already opened lines 42-52 of this file for an earlier reading, though not this function.

### `ownerByLine` — as expected
- read at `39b85adfda97` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Walks the file node's children and, for each function chunk, sets a Map entry for every line from its start to its end line so a line can look up its owning chunk; later writes win on overlap.
- found: Exactly that, with kind === 'func' and non-null line filters and an endLine ?? line fallback (commented as deliberate, so a missing endLine paints one line rather than nothing).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `rampStops` — as expected
- read at `5a30a1533442` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Reads five heat-ramp CSS custom properties (--heat-0..--heat-4) off getComputedStyle(el), parses each hex string into an [r,g,b] triple, returns them in ramp order for canvas interpolation.
- found: Exactly that, with a '#888888' fallback when a property is missing or empty, and the hex parsed via parseInt + bit shifts.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `rampAt` — as expected
- read at `815003ab0e2f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A colour-ramp sampler: RGB triples as evenly spaced stops, clamp t to 0..1, find the two bracketing stops, lerp each channel by the fractional part, return a CSS rgb() string. Used by the minimap/heat gutter alongside rampStops.
- found: Exactly that, in six lines: clamp t, scale by stops.length-1, clamp the index to length-2 so the top end interpolates against the last pair, lerp+round each channel, return space-separated `rgb(r g b)`.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `Minimap` — nearly
- read at `3836493a642e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A canvas minimap: measure the container, draw one bar per line from its indent to its length at a tiny fixed row height, scaled or clipped to fit; colour each row from the heat of the owning function via `ownerByLine`/`rampAt`, uncoloured where nothing owns it; overlay a viewport rectangle from the scroller's scrollTop/clientHeight, repainted whenever `scrollTick` changes and offset by `insetTop`; clicking maps y back to a line and scrolls the code pane there.
- found: All of that, plus four details I did not have. It is DPR-aware — canvas backing store sized by devicePixelRatio with a matching transform. Row height is `min(3, height / lines.length)`, so the whole file always fits and the map never scrolls, and char width is derived from an assumed 110-column line. The heat row is painted as a full-width band at alpha 0.4 UNDER the code bar, and only when `isAnalyzed(owner)`. Comment lines are detected by a `/^(\/\/|#|\*|\/\*)/` regex and drawn at alpha 0.22 against 0.5, so prose recedes. The viewport is both filled at 0.12 and stroked at 0.35. `insetTop` is applied as CSS `top`/`height` on the canvas rather than as a draw offset, and it is in the effect's dependency array so the canvas repaints after the resize. Seek is pointer-capture drag as well as click, centring the target line like VS Code.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: `seek` recomputes `lh` with the same `min(3, ...)` expression as the effect rather than sharing it, so the two would silently disagree if either changed — the click would land on a different line than the one drawn there.

### `CodeView` — nearly
- read at `a4822e25ff39` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A React component that loads the file's source from the backend (readSource keyed on repo+path) into state with loading/error handling, tokenizes it for syntax highlighting, and renders numbered lines each with a gutter swatch coloured by the temperature of the function owning that line (ownerByLine + rampAt). Renders a Minimap, scrolls to reveal.id when the nonce changes, calls onSelect on click, and shows a header with optional pop-out/close buttons.
- found: Exactly that: readSource effect with a `live` guard and 'No repo open.' error, early returns for error and loading, ownerByLine memo, a reveal effect keyed on (reveal.n, src!==null) using a fileRef to dodge object-identity re-fires and scrolling the row to one third of viewport height, then a table of lines with a 3px heat gutter, line numbers, tokenized spans, a 16% wash behind owned lines, a "not measured" tag on the first line of unanalyzed functions, plus Minimap and the pop-out/close buttons floating over the minimap's top corner. Extra I did not predict: a scrollTick counter fed to the Minimap instead of the scroll offset, and the absolute inset-0 sizing.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Unusually dense inline commentary — most of the body's non-JSX lines are rationale, and every one of them explains a bug that a naive version had.

## web/src/components/ColourKey.tsx

### `Legend` — nearly
- read at `9105da004da9` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Renders the key beneath the sunburst, branching on mode: categorical modes map `categories` to swatch-plus-label chips coloured by the same hashing the map uses; the heat mode draws a continuous gradient bar with cool/warm end labels; at 80 lines probably also age/churn and an unread/stale hatch marker, returning nothing for an unknown mode.
- found: Three branches, and the first is chosen by `categories.length > 0` rather than by mode: a chip list capped at the first FOUR named categories with the remainder collapsed into one "Other" swatch, because only four slots have distinct colours. `traps` gets a deliberate non-scale — a single square swatch, square specifically to differ from the ramp's pill. Everything else is a 24-segment gradient bar between two mode-specific end words (cold/blazing, crystal/nonsense, settled/churning, old/recent) walking whichever named Ramp the wedges use. No stale/unread swatches here, and unknown modes fall through to a gradient with blank labels rather than rendering nothing.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The comment at the bottom claims the ramp "spans the widget rather than sitting in a fixed 96px well in the middle of it" and the line it introduces is `w-24`, which is exactly a fixed 96px well in the middle of the row — the change it argues for was reverted or never landed, and the comment now describes the opposite of the code.

### `ModeSwitcher` — as expected
- read at `7c0381eeb3d3` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A row of small pill buttons, one per ColorMode, mapped from a label map with tooltips per encoding; active one highlighted, click calls onMode, and when `disabled` all are dimmed and non-interactive while still showing the mode in force, with a title explaining the history-mode lock.
- found: Exactly that, built as an ARIA segmented control: a role="tablist" div acting as a recessed track (inset shadow, dimmed to 0.55 when disabled), mapping Object.keys(MODE_LABEL) to role="tab" buttons with aria-selected. Tooltip is MODE_HINT plus a ⌘N shortcut derived from index, swapped for a pinned-to-recency explanation when disabled. Only the selected chip gets accent background, weight 600 and a drop shadow. Long inline comments justify the track, the tooltip-borne shortcut, and the single lifted segment.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `ColourLegend` — nearly
- read at `e9116d238fb8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A small boxed React component that renders the mode-appropriate key (gradient ramp for surprise, swatches for categories) and conditionally appends a stale-hatch row and an unread-grey row, each only when its count is above zero, with the count shown.
- found: A bordered card that delegates the ramp/swatches to the sibling `Legend`, then adds a divider row with stale and unread swatches — each gated on count > 0 — but additionally gated on `paintsFromReadings(mode)`, so both extras vanish outside the surprise mode. The swatches are reproduced in raw CSS (a 45-degree repeating-linear-gradient for the hatch, `--unanalyzed` at 0.4 for the grey) to match what Sunburst draws.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The one-line doc only covers the box's styling; everything that matters (the paintsFromReadings gate, the CSS swatches that must stay in sync with Sunburst) is in a 17-line inline comment inside the JSX.

## web/src/components/CommitLog.tsx

### `stamp` — as expected
- read at `007bc6229dfa` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A three-line date formatter: unix seconds times 1000 into a Date, returning a short human date string for the commit row via toLocaleDateString with a compact day/month format.
- found: Exactly that: new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `CommitLog` — surprising
- read at `65e4c330112e` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Renders a header (repo/scope name, loc and function counts), then a memoised static list of rows — one per entry in `frames`, each showing date/hash/subject via `stamp` and calling `onIndex` on click. Over that list it absolutely positions two elements: a cursor at the current commit's row offset and a scrim covering the not-yet-reached rows. An effect scrolls the playhead row into view while `playing`.
- found: Structurally as predicted, but only ONE absolutely-positioned overlay exists — the scrim; the cursor is a `selected` boolean prop passed to each memoised `Row`. Also does three things I did not cover: a `fromClick` ref so a click on a row suppresses the follow-scroll entirely, a useLayoutEffect with three cases (centre while playing, minimal scroll-into-view when paused/scrubbing, nothing on click) using direct scrollTop rather than smooth behavior, and an empty-`frames` branch printing "nothing in this window touched X". The scrim's height and translateY come from the same arithmetic so it never overhangs the scroll extent.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The docstring's headline claim — "two absolutely-positioned elements over a static list: a cursor on the current commit, and a scrim" — no longer matches the body, which has only the scrim and marks the current row with a `selected` prop on `Row`, so two rows do re-render per frame.

## web/src/components/Crumbs.tsx

### `Crumbs` — nearly
- read at `899166c24f97` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A breadcrumb bar rendering trail root-first as buttons, every level clickable via onGo(index) — the last either clickable or emphasised as current — separated by a dimmed slash, with a collapsed chain's inner slashes rendered dimmer still than the separators, and an `up` control that appears only when onUp is given and is styled as a button like the rest.
- found: That, with two details I got wrong or missed: the current level IS still a real button (it re-centres the view) and merely carries aria-current plus a bolder style, and the Up button always renders but is `disabled={!onUp}` rather than being omitted. Also does layout work I did not mention — min-w-0/overflow-hidden so the trail truncates rather than the Up button, and `last:shrink` so only the current crumb gives way.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/Detail.tsx

### `Gauge` — nearly
- read at `b7cad1632125` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A small SVG semicircular 180-degree gauge: a background track arc plus a foreground arc filled to the clamped value, the value printed in the centre as `word` when given and otherwise the number, `label` beneath, `hint` as a title tooltip, and an unread branch that draws only the track with a dash instead of a needle at zero.
- found: Exactly that. Fill is done with strokeDasharray over the半 circle length rather than a needle; the value is clamped to 0..1; the printed centre text is '—' when unread, else word ?? Math.round(v*100), with a smaller font size for words. One detail I did not cover: strokeLinecap switches from 'round' to 'butt' below v=0.01 so an empty arc does not draw a dot that reads as a small value.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Markdown` — as expected
- read at `1e73cdef74d4` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: A tiny React renderer: split text on blank lines into paragraphs, then split each paragraph on a backtick code-span regex first, emitting <code> for those segments; remaining plain segments get a second pass applying **bold** and *italic* via regex, producing keyed strong/em/span nodes wrapped in a <p> per paragraph.
- found: Exactly that: an `inline` helper splitting on a capturing code-span regex, then on a combined bold/italic regex, pushing keyed code/strong/em/span nodes with a Tailwind-styled code element; the component splits on two-or-more newlines, drops blank paragraphs and renders each in a <p> with top margin after the first.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Warm: I had already read a bounded slice of Detail.tsx for `provenance` earlier in this run, though not this range.

### `rank` — nearly
- read at `ebcfd7520cf3` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A small switch over ColorMode returning the quantity the wedge is coloured by: surprise/temperature for the default mode, recency/age or churn for the other modes, lines or 0 as fallback, so the list sorts by the same value the ring shows.
- found: Returns -1 when there is no score at all; for 'churn' returns s.churn but -1 if ageDays is null; for 'age' returns NEGATED lastTouchedDays (so recent sorts first, matching the bright end of the ramp), -1 if null; otherwise wedgeHeat(n).
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The -1 sentinel doubles as "no data" and as a real low rank, and churn gates on ageDays rather than churn's own availability.

### `measure` — nearly
- read at `8b9cc0cc0cbf` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A tiny formatter switching on ColorMode: surprise gives a temperature in percent/degrees, churn a commit count, age a relative date like 3mo, blame the author's name or initials, language the extension, each with its unit suffixed and under about eight characters, returning null when the node has no reading for that mode.
- found: That, with two differences from my guess: blame returns null on purpose (an author is a category the swatch already carries, not a quantity), and null is used for that rather than for missing data — missing data returns an em dash. Churn is `12x`, age is `today` or `Nd ago`, surprise prefers the agent's word grade over `NN degrees` so tied readings do not look like coincident measurements, and every remaining mode (including language) falls through to a formatted line count.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Churn gates on `s.ageDays !== null` but prints `s.commits`, so the guard checks a different field from the one it protects.

### `grade` — as expected
- read at `640703ed95d9` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns the report's explicit predicted grade when present, otherwise folds the legacy surprised boolean to the ends of the scale: surprised -> none, not surprised -> full.
- found: One line: `return r.predicted ?? (r.surprised ? 'none' : 'full')`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `provenance` — nearly
- read at `52bd30d87d11` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A small formatter returning one sentence describing where the displayed scores came from — "read by <model> on <date>" when the node carries an agent reading, noting staleness if expired, falling back to a phrase like "estimated by the offline proxy" when there is no agent reading.
- found: Guards on !isAnalyzed with a candid proxy caveat, then branches on node.score.source: 'agent' with an agent record joins model and `by` with a middot and appends `at`; bare 'agent' without the record; 'model'; and a final proxy fallback. No staleness mention.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `Contents` — nearly
- read at `8525ac0c5621` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A React component rendering node.children as a list of rows, sorted by heat descending with unread/unscored children sunk to the bottom; each row shows a colour swatch (from mode/ranks/ageSpan), the name and a line count; click calls onSelect, double-click onDrill; returns null when there are no children.
- found: Exactly that, plus one thing I did not cover: the sort key and the trailing number are not fixed to surprise/loc but follow the current ColorMode via rank(n, mode) and measure(n, mode), with loc only as the final tiebreak. Also a header row labelled 'Contents' for dirs and 'Functions' otherwise with a child count.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `Detail` — nearly
- read at `dbcbf66ffcd3` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 6 of its run
- expected: The right-hand pane: with node null it delegates to a summary of focus; otherwise a header with name, path and line range, a Gauge for temperature or the mode's quantity, a breakdown of the score's terms, the agent reading if present (expected vs found through Markdown, grade chips, a trap flag, a provenance by/at/model line), a stale warning when the reading no longer matches, and the Contents list of children — probably with a source view too.
- found: Broadly that. Null node renders Summary of focus, or a decorative Bloom pattern when there is no scan at all. Otherwise: sticky header (name, KIND_LABEL pill, trap badge, elided path:line, lines/functions), a 3-or-4 column Gauge row — Surprise or Avg surprise depending on leaf/container, Documented, Churn, and Opacity only when a non-stale reading graded legibility — then a scroller with 'not scored' / 'nobody has read this' fallbacks, the agent block (stale banner first, warm-read chip, Expected, Found, a warning-marked note or a 'read as expected' line when grade is full), a 'The evidence' hotspots section printing per-token collapse points and alternatives, the Contents list, and a pinned provenance footer. I did not predict the Bloom idle state, the hotspots section, or the mode being ignored by the gauges (Detail's dials are always the surprise/doc/churn set; mode is only forwarded to Contents).
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The body is roughly 40% inline commentary explaining rejected earlier designs — unusually well annotated, but it means the 423-line count overstates the logic by a lot.

## web/src/components/FileZoom.tsx

### `fanOf` — nearly
- read at `4c58496076c4` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A three-line wrapper deriving an angular span from paneAspect (wide panes a wider fan, tall panes narrower) and handing it with `from` to fanFor, which supplies a default bearing when from is null, so it always returns a Sector rather than null.
- found: A pure pass-through: `return fanFor(from, paneAspect)`. It computes nothing at all — the aspect-to-span choice and the null-source default both live in fanFor. The function exists only to re-export fanFor under another name from this module.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Eleven lines of doc describing span selection, null handling and a fixed History bug sit on a one-line alias for fanFor — every behaviour it documents is somewhere else, so the explanation will not move when that code does.

### `FileZoom` — nearly
- read at `c026cc80121a` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A React component rendering a file's functions as an animated fan expanded out of the sunburst sector, interpolating geometry from `from` toward the fan layout by `t` (via `fanOf`), mapping each function to an SVG arc coloured by mode/ranks/ageSpan, skipping wedges below minPatchArea, wiring select/drill/hover, and using `settled` to gate until the animation finishes.
- found: Exactly that, plus detail: it squarify-tiles the functions once against the destination fan (`tileFunctions`) and only re-places the tiling per frame; memoises fills; lerps the sector each frame, treating a missing `from` as already-arrived; draws a stale hatch overlay for expired readings in reading-painted modes; draws a `RollupDots` texture over the aggregate "rest" patch when it is big enough in pixels; and renders `WedgeLabel` names only once arrived, with ink chosen from the patch colour and reduced opacity for clipped names.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: No doc comment on the function itself, but the inline comments are unusually rich — they carry the reasons, not restatements.

## web/src/components/HistoryBar.tsx

### `pace` — nearly
- read at `f97e230c1fec` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Formats a replay duration (seconds) into a short human label such as "12s" or "1m 30s", since the transport is a duration rather than a rate.
- found: Two lines: 60 or more seconds rounds to whole minutes ("2m"), otherwise raw seconds ("45s"). No mixed minutes-and-seconds form.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `HistoryBar` — nearly — TRAP
- read at `a70abe5b9f29` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A full-width strip with play/pause, a range scrub bar addressing positions in `frames` (converting scoped position to real commit index), and duration preset buttons. Bulk should be a requestAnimationFrame effect that while playing computes the position from elapsed time / duration rather than stepping — skipping commits on a slow machine — keeps its start time in a ref so the effect doesn't rebuild per frame, calls onIndex, and stops at the end. Keyboard (space, arrows) plausible.
- found: All of that. Extra details I did not cover: a fractional `cursor` ref separate from the integer index, with an `emitted` ref used to distinguish the clock's own output from an externally-arriving index so a scrub resets the accumulator rather than the fraction being thrown away every integer step; a MAX_FPS floor that returns early without updating `then`; play-on-a-finished-timeline rewinds to -1 first, and -1 is a real position (empty state) at the low end of the range; arrows work on both axes with down = forward because the log runs oldest-first, shift strides 10; the key handler bails on HTMLInputElement so the range input's native arrow handling doesn't double-move; end is a stop, never a wrap.
- predicted: most · documented: some · derivable: no · legible: full · trap: yes
- note: The keydown effect closes over `toggle` (and thus `playing`/`pos`) but `toggle` is not in its dependency list — it works only because `playing`, `pos` and `index` happen to be listed, so anyone who trims those deps silently gets a stale space bar; the clock effect likewise depends on `rate`, so changing duration mid-play restarts the clock and drops the current tick's fraction.

## web/src/components/MascotFigure.tsx

### `loadOrMint` — nearly
- read at `296f66e763ec` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Reads a stored mascot config from localStorage, JSON-parses it and returns it if present/valid; otherwise mints a fresh random MascotConfig (I guessed via the sibling `pick`), persists it back to storage, and returns it. Expected try/catch around the parse.
- found: Exactly that shape, with two separate try/catch blocks: one around the read+parse (falls through on corrupt data) and one around the write (mascot just won't persist). The fresh config comes from an imported `randomizeMascot()`, not the local `pick`.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The parsed value is cast to MascotConfig with no shape check, so any well-formed JSON in that key is trusted downstream.

### `pick` — as expected
- read at `cfbf6454f730` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A one-liner returning a uniformly random element of the array — from[Math.floor(Math.random() * from.length)] — to vary the mascot's animation.
- found: Exactly that, character for character.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `moodFor` — nearly
- read at `cda216f69fc2` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A three-line lookup mapping a tool name to mascot animations: index a constant record keyed by tool name, falling back to a default/idle animation list, in a single return expression.
- found: Same shape but the table is an ordered array of {match: RegExp, play} rules — it finds the first MOODS entry whose regex matches the tool string and returns its `play`, else DEFAULT_PLAY.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `MascotFigure` — surprising — TRAP
- read at `a5609c67fe2c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A React component that resolves a stable mascot identity via loadOrMint on mount, derives a mood from recent `events` via moodFor (falling back to a dozing mood when `active` is false), and renders the neo-mascots bundle at `size` — probably driving its imperative API through a ref in a useEffect that re-runs on mood/size change, with cleanup on unmount.
- found: The identity, the doze/wake and the ref handle were all there, but the events half is a replay queue I did not predict: it tracks the highest call `seq` already animated, filters the events newer than that, takes the last MAX_REPLAY, and plays them in order staggered by BEAT_MS timers — waking first if asleep. Both effects are deferred one requestAnimationFrame because play() before the scene mounts is silently dropped, and both clean up their frame and timers. The render itself is a single declarative `<Mascot ref config size />`.
- predicted: some · documented: none · derivable: no · legible: full · trap: yes
- note: The doc comment is about which chunk the module lands in and says nothing about the component; and `seen.current` is advanced synchronously while the playback it accounts for happens a frame later, so an unmount or a re-render between the two drops those calls permanently — the exact miss the sequence numbers exist to prevent.

## web/src/components/Overlay.tsx

### `Overlay` — as expected — TRAP
- read at `9b14ec9655fd` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A fixed full-screen div with semi-transparent black background and flex centering, onClick={onClose}, wrapping children — possibly with an inner stopPropagation wrapper, though the doc hints that is the caller's job.
- found: Exactly that, with no inner wrapper: fixed inset-0 z-50, flex centre, p-6, rgba(0,0,0,0.5), onClick={onClose}, children rendered directly. Stopping propagation is left entirely to the panel passed in.
- predicted: full · documented: full · derivable: no · legible: full · trap: yes
- note: The contract that every child must call stopPropagation is enforced nowhere — a new caller that forgets it gets a panel that closes when you click inside it, and nothing here fails.

## web/src/components/PartyAnts.tsx

### `wanted` — as expected
- read at `827bd46826fe` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A tiny arrow function computing how many ant sprites to render for a given viewport width and height — a density formula over the area, clamped between a min and a max so a large window doesn't spawn hundreds.
- found: Exactly that, in one expression: floor(w*h / AREA_PER_ANT) clamped between MIN_ANTS (3) and MAX_ANTS (5).
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `resolveCoats` — as expected
- read at `d4bcd53369a2` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads colour information off the given element — CSS custom properties via computed style — and returns a list of colour groups, one array per ant coat/layer, mapping over a list of coat variable names with a fallback when a variable is unset.
- found: Exactly that: takes getComputedStyle(el), maps the module-level COATS (an array of arrays of CSS custom-property names) to their resolved trimmed values, defaulting to '#888' when empty.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `inkOf` — nearly
- read at `8a03023905f9` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A one-liner reading the computed --foreground CSS custom property off the element (getComputedStyle(el).getPropertyValue('--foreground').trim()) and returning it as the limb stroke colour so ink follows the theme.
- found: It reads getComputedStyle(el).color — the inherited text colour — rather than the --foreground variable directly. Same intent, resolved one level further down: whatever the pane's text ink currently is.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc says it "reads `--foreground`" but the body reads the element's resolved `color`; equivalent only while the pane's colour is set from that variable.

### `PartyAnts` — surprising
- read at `fd96c55e7ec1` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A canvas React component: ref sized by ResizeObserver and devicePixelRatio, a rAF loop cancelled on unmount, ~seven ant agents with position, heading, speed, leg phase and wander bias. Per frame: small constant heading noise, occasional brief pauses, stay in bounds, and when avoid==='rings' push out of a central circle of radius min(w,h)/2. Flat pastel drawing — rounded body segments with no outline, six legs in an alternating tripod gait, antennae, coats from resolveCoats/inkOf.
- found: All the machinery I named, plus a great deal I did not. Feet are stored in WORLD coordinates and left planted while the body moves over them, with a strain threshold forcing an off-phase step after a sharp turn — that is what stops the skating I never considered. Population is a density from wanted(w,h) recomputed on resize without re-seeding existing ants; each ant has a `roam` cast timer and a three-state `walk` ('in'/'about'/'out') so ants leave the pane and re-enter from a random edge, reusing the object with a new coat and scale so the count never dips. Avoidance is not a push-out but a `skirt` that blends radial and tangential headings by penetration depth, tangent signed by the ant's existing direction, so the resting state is a lap of the rim; mapR divides by a FIT constant of 1.1 and adds KEEP_OUT. There is a seeded LCG for determinism, a MutationObserver re-reading ink/coats on theme change, a prefers-reduced-motion early return, dt clamped at 50ms for tab restores, gait phase advanced per unit DISTANCE, legs drawn as quadratics through an outward knee, elbowed antennae, three overlapping segments (gaster/thorax/head) plus a white highlight, and edge behaviour that reflects for 'about' ants but not for arriving or departing ones.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: 478 lines of canvas animation where nearly every constant carries a comment saying which wrong-looking behaviour it fixed; the doc block is unusually good but still could not have led anyone to planted world-space feet or the enter/exit lifecycle.

## web/src/components/RollupDots.tsx

### `dotsId` — as expected
- read at `d813a04c4855` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A one-liner returning a prefixed SVG pattern id built by replacing every non-alphanumeric character with an injective escape — the character's numeric code wrapped in a marker character — so distinct paths can never collide on one id.
- found: Exactly that: `dots-` prefix plus path with every non-alphanumeric replaced by `-<charCode>-`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `RollupDots` — as expected
- read at `2cf13c243384` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Emits an SVG pattern def of a dot lattice, rotated by `angle` and anchored at the patch centre cx/cy via patternTransform, so the texture reads radial along the wedge rather than screen-aligned; callers use url(#id) as fill.
- found: Exactly that. One tile, a single circle at the tile centre (corner would render as a quarter dot), userSpaceOnUse, with patternTransform = translate(C − R(θ)·(HALF,HALF)) then rotate(θ) so a dot lands precisely on the patch centre. `deg = angle·180/π − 90` because chart angles run clockwise from twelve o'clock. Long comments explain why it is per-roll-up rather than a shared def and why a rotation rather than a curved fill is acceptable.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

## web/src/components/SideBar.tsx

### `SideBar` — nearly
- read at `67b6fdc79dc5` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A React sidebar rendering the project list as ProjectItem rows, marking the active one and calling onSelect on click; showing agent activity somewhere (what's being read, maybe a progress count); and when connected is false, a prominent not-connected state with a button wired to onConnect. Tailwind-heavy JSX with a few small derived values.
- found: Exactly that shape, plus specifics I did not name: an always-present agent panel at the bottom holding an AgentMascot aligned on `last baseline`, a three-state label (not connected / working / sleeping), a gear button for onConnect, and per-project progress bars derived from `projects.filter(p => p.working && p.functions > 0)` living in that panel rather than on the rows. Also an empty-state line for zero projects. Roughly half the 195 lines are rationale comments explaining choices that were reverted or narrowed.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The only doc handed to me was a comment on one prop (`connected`); the component itself has none, yet the body carries extensive in-line rationale that would have made a far better handout.

### `ProjectItem` — nearly
- read at `f27112610f1c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A presentational row: a clickable button styled as a rounded 28px strip, truncated project name on the left, right-aligned count (assessed/total) and active-state highlight classes, possibly with progress.
- found: That, plus a loading branch: while the project is still being rescanned it shows a read_done/read_total percentage or 'reading…' instead of a count, on the stated grounds that 0/0 would be a false measurement. Also a leading ◍ icon, a title tooltip carrying repo, assessed/functions and a stale count, and the count tinted with --agent-mark when assessed >= functions.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The docs describe only the strip's geometry and say nothing about the loading state, which is where the reasoning in this function actually is.

## web/src/components/StaleHatch.tsx

### `StaleHatch` — nearly
- read at `bbc24a833314` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A hidden/zero-size svg holding a defs with one pattern id="stale-hatch": 45-degree diagonal lines, patternUnits userSpaceOnUse, a small tile with translucent neutral strokes so it overlays any wedge colour; mounted once so the id stays unique.
- found: Exactly the pattern I described — 6x6 userSpaceOnUse tile, patternTransform rotate(45), one vertical line stroked in var(--foreground) at 1.6 width and 0.45 opacity, with an empty rect for the tile. Difference from my guess: it returns a bare <defs> fragment with no <svg> wrapper, so it is meant to be dropped inside an existing SVG rather than mounted standalone at the app root.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc argues the single-instance rule at length but the body is a bare <defs> with no svg wrapper, so honouring that rule is entirely on the caller and nothing in the component enforces it.

## web/src/components/Summary.tsx

### `ListWindow` — nearly
- read at `ccfadb61f757` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A windowed list: a scroll container ref plus scrollTop state updated on scroll, first/last indices from a fixed row height plus overscan and container height, a total-height spacer with the visible slice offset, and each row drawn with a swatch and trailing label from paint(n) (defaulting to reading heat/grade), onSelect on click and goTo on double-click.
- found: Exactly that shape: useRef box, view {top,h} state read on scroll and via a ResizeObserver (with cleanup), overscan of 8, first/last from ROW_H, leading and trailing spacer divs rather than absolute positioning, rows as buttons with a swatch from paint ?? heatColor(temperature(score)) and HEAT_WORDS[agent?.predicted ?? 'none'], onClick -> onSelect, onDoubleClick -> goTo. One thing I did not predict: a second effect resetting scrollTop to 0 whenever `rows` changes, so switching lens does not open the list mid-scroll.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Spread` — nearly
- read at `02498c946b1c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Builds a segment list — four grades cold→hot plus stale and unread in the structural neutral — each with count, percentage width and a colour from the wedge ramp. Renders a horizontal stacked bar of clickable segments (zero-count dropped) where clicking calls onPick and toggles to null if already picked, plus a key below with swatch, label and count, picked entry emphasised.
- found: The segment construction, the neutral fills for expired/unread, the >0 filter and the percentage widths are all as predicted, plus an early `return null` when the total is zero. But the interaction sits somewhere I did not put it: the bar itself is inert divs carrying only `title` tooltips, and the KEY is the control — each grade row is a button with aria-pressed that toggles onPick(on ? null : grade), while `expired` and `unread` render as plain divs, deliberately inert because they are the absence of a reading rather than a reading that came back some way.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc comment is thorough about the encoding but silent about the half of the body that matters most to a user — that the key is the filter control and that two of its rows are intentionally dead; that argument only exists in an inline comment.

### `Buckets` — as expected
- read at `b763f0dfc9be` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A stacked horizontal bar with each bucket's width its share of total LINES, plus a legend below listing swatch, label and a count/percentage; each row a button calling onPick(key), toggling to null when the picked row is re-clicked, picked row highlighted.
- found: Exactly that. Sums lines, returns null if total is 0, renders an h-2 stacked bar with per-segment width percentages and a title tooltip carrying both function count and line count, then a list of buttons with aria-pressed, swatch, truncated label, and the FUNCTION COUNT (not lines) as the numeral — so the bar is weighted by lines while the number beside it is a count.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc argues at length that widths must be lines rather than counts, yet the only number shown in the key is the count — defensible (the tooltip has both) but the two encodings sit adjacent unlabelled.

### `Summary` — surprising
- read at `3c6f86ff4cde` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A component walking the subtree to render the empty-selection pane: totals (files, functions, lines, commits), read/unread/stale counts, a spread or bucket histogram, and a top-N hottest list whose rows select and drill; branching on mode so Churn/Blame show their own framing; plus a 'connect an agent' call-to-action, the gesture 'ants', and a no-history warning when commits === 0.
- found: Header (title, elided repo path, lines/functions/commits/excluded), then a mode-dependent key — Spread with grade tabs under Surprise, Buckets under any other lens — then a single growing windowed list (ListWindow) of whichever grade or bucket is picked, with unchosen state falling back to the first non-empty grade / first bucket and pickedBucket reset on mode change. There is no CTA, no ants, and no commits===0 warning. The part I missed entirely is the bottom section: a scrollable, attributed Notes list of reader notes (trap-only under the traps lens), each row a heat swatch, function name, optional TRAP chip and the note text, click to select and double-click to go to.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment promises "the ants stay, underneath" and "what to do next", but the body has no ants and its inline comments say Next Steps was replaced by the Notes list — the docs describe a version of this panel that no longer exists.

## web/src/components/Sunburst.tsx

### `heatShare` — as expected
- read at `cbcc1020c953` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A tiny lookup returning the damping factor for a node's colour intensity: under Surprise mode a reduced value for container kinds (dir, maybe file), 1 for leaves and for every other colour mode.
- found: Exactly that, three lines: `if (mode === 'surprise') return HEAT_BY_KIND[kind] ?? 1; return 1`, deferring the per-kind damping to a module constant.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc opens mid-sentence ("...but only under Surprise") — it continues a comment on the constant above and does not stand alone at this function.

### `Sunburst` — surprising
- read at `8a00d5a8a16e` · commit `9fe6ccf` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: The main React component: compute a partition/hierarchy layout from `root` (memoised on root identity), map each node to an SVG arc path filled by colorFor(node, mode, ranks, ageSpan), render a central hub showing the current root that doubles as the go-up button when `onUp` is defined. Handlers for hover, onSelect, double-click to onDrill, background click to onClear; probably a tooltip, a stale hatch pattern, and some transition on layout change.
- found: All of that, and roughly five more subsystems: a ResizeObserver-measured pane feeding a units-per-pixel conversion that drives minimum arc AND minimum patch AREA thresholds; a hand-rolled rAF level-change transition detected DURING render (refs for live/from/leaving/coring/fileLeaving, direction-aware enter and exit geometry, the clicked directory animating into the hub); a viewBox fitted to the measured drawn extent and written straight to the element to avoid a second render per frame; FileZoom for an opened file plus a reversed instance for one being closed; treemap tiling of functions inside each file's band with roll-up dot textures, per-patch labels and a stale hatch limited to reading-painted modes; curved rim labels for files versus in-plate labels for dirs; option-click directory folding with a corner note counting folded and too-thin wedges; and a custom tooltip replacing SVG <title>.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: A 1,079-line component with no doc comment of its own, holding at least five separable subsystems (layout, rAF transition, viewBox fit, function tiling, labelling) — the inline commentary is excellent but there is no way to guess the scope from the outside.

## web/src/components/WedgeLabel.tsx

### `WedgeLabel` — nearly
- read at `8ce325b7d515` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Placement is a union of arc and straight runs. Arc: emit defs with a path baseline from radius/angles plus a text/textPath on it. Straight: a plain text at x/y with an anchor. Both pull face/weight/tracking and a halo or outline for separation from labelStyle read live, applying fill and opacity.
- found: Right on the two branches: at.axis === 'arc' emits defs + labelArc path + textPath at startOffset 50%; otherwise a radial label. Two things I got wrong. There is NO separation treatment at all — halo, plate and shadow were each built, compared on real repos, and all three lost to plain type, so `ink` is only family and tracking. And the radial case is not an x/y text but a transform chain rotate(deg) translate(0,-r) rotate(±90), flipped inward in the left half so labels never read right-to-left.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The `opacity` prop's doc comment describes a prop that no longer exists — it says "WHICH kind of label this is, not how heavy it should be" and argues about weight, which is about a removed `kind`/weight prop, not about opacity; and the header doc still credits `labelStyle` for face and weight, which the body reads from module constants instead.

## web/src/components/WedgeTip.tsx

### `countFiles` — as expected
- read at `84865977315d` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A tiny recursive walk: return 1 for a file node, 0 for a function, otherwise sum countFiles over children (defaulting to empty) and return the total.
- found: Exactly that. Returns 1 for kind 'file', otherwise sums the recursion over n.children; function nodes fall through to the loop and contribute 0 because they have no children.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `WedgeTip` — as expected
- read at `1ebc7f72ea9e` · commit `9fe6ccf` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Same component I was handed at position 6, so this was recall rather than prediction: pointer-positioned card with edge flipping, distinct function and container header shapes, a swatch-plus-label reading row carrying lines/files/rollup counts, a stale warning line, mode-dependent extras, and fold/drill hints. I expected the ten added lines to be a new extras row or a new absence state.
- found: Identical to what I read at position 6 apart from one addition: the swatch itself now gets a CSS repeating-linear-gradient hatch at 45° when `n.agentStale`, reproducing `#stale-hatch`'s angle and pitch so the key matches the wedge on screen. Docs were also reworded to distinguish never-read from expired.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The queue handed me this exact function twice in one run — it was edited between my positions 6 and 8, which expired my own fresh reading and re-queued it to the same reader, so the second reading is pure recall and worth nothing.

## web/src/components/Wordmark.tsx

### `Wordmark` — as expected
- read at `a8bc0df9a246` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An inline SVG of the "sanity" wordmark: a fixed brand viewBox, height from the prop with width derived from the ratio, fill="currentColor" so it inherits ink/white, role/aria-label for accessibility, and path elements holding the letterforms. No state, no other props.
- found: Exactly that: viewBox "0 0 329 125", height from the prop with width left implicit, role="img" aria-label="Sanity", fill="currentColor", xmlns, and six letterform paths (one per glyph, in reverse order y-t-i-n-a-s).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs' claim about the default height being an optical correction against tally's 14 is the kind of thing no reading of the body could recover — worth keeping.

## web/src/components/shell/SideBarHeader.tsx

### `SideBarHeader` — as expected
- read at `048333edc686` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A fixed-height sidebar header strip matching TopRow, holding the wordmark, with left padding conditional on Tauri-on-macOS (~92px traffic-light reserve, collapsed in fullscreen via an onFullscreenChange useState/useEffect pair), and probably a titlebar drag region.
- found: Exactly that. Height from --titlebar-h, paddingLeft = calc(--traffic-light-reserve - 3px) under isTauriMac() and not fullscreen, else 9. data-tauri-drag-region on the outer div, and the wordmark wrapper is pointer-events-none so it does not punch a dead spot in the drag region (Tauri drags only when the event target itself carries the attribute).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/components/shell/TopRow.tsx

### `TopRow` — as expected
- read at `059a0f998b8c` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A tiny layout shell: fixed-height flex strip matching SideBarHeader, data-tauri-drag-region on the container so the whole bar is a window handle, children (the colour-mode switcher) centred inside. One JSX element, no state.
- found: Exactly that — a `header` with data-tauri-drag-region, `shell-chrome flex shrink-0 select-none items-center justify-center`, height from `var(--titlebar-h)`, rendering children.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: Eleven lines of body carrying a fifteen-line doc comment that is almost entirely history of what was REMOVED — useful, but nothing in it could be derived from the code.

## web/src/lib/api.ts

### `showsShare` — as expected
- read at `92308d117684` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A one-expression predicate: true for anything that is not a real function — containers plus the overflow roll-up aggregate — replacing the old bare kind === 'func' test in four places.
- found: Exactly that: `node.kind !== 'func' || node.rest !== undefined`, where the `rest` field marks the overflow aggregate.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: `rest !== undefined` as the overflow marker is the one part not legible from the body alone; the doc carries the whole reason.

### `toNode` — nearly
- read at `29f688e199ed` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Converts a Rust-side wire node into the frontend Node shape: copies id, name, kind, lines/value, maps snake_case score fields to camelCase Score, sets proxyScore from the incoming score so a later report fold is reversible, and recurses over children (defaulting to an empty array when absent).
- found: A flat object literal doing exactly the snake_case-to-camelCase mapping, with `?? null` / `?? false` / `?? []` defaults on every optional wire field, a nested ten-field Score mapping guarded by a ternary so an unscored node stays null, and a plain recursive children.map(toNode) with no default (children is required on the wire). It does NOT set proxyScore — that must be established elsewhere in the fold.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `agentActivity` — as expected
- read at `498e4cdbcd05` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A thin wrapper over Tauri invoke('agent_activity') returning AgentActivity; because it is polled, likely catches errors and returns a default 'nothing active' object rather than throwing at the poller.
- found: Exactly that — invoke('agent_activity') with a .catch returning {active:false, tool:'', nonce:0, events:[]}.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `mcpCommand` — nearly
- read at `1601a4380b1e` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A thin Tauri wrapper: invoke&lt;McpCommand | null&gt;('mcp_command') returned directly, giving the UI the command line to paste into an MCP client config, null when unavailable.
- found: invoke&lt;McpCommand&gt;('mcp_command') with .catch(() =&gt; null) — the null in the signature comes from swallowing a rejected invoke, not from the command returning an option.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `mcpClients` — nearly
- read at `68c06de6db2a` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A thin Tauri binding: return invoke("mcp_clients") — no arguments, no transformation of the result.
- found: invoke<McpClient[]>('mcp_clients') with a .catch(() => []) that swallows any error into an empty list.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The catch makes a failed invoke indistinguishable from "no MCP clients configured" — a silent-failure shape, though for a read-only list it is likely deliberate.

### `mcpConnect` — as expected
- read at `7db0d02e71db` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: The frontend half of the mcp_connect Tauri command: a one-line invoke&lt;string&gt;('mcp_connect', { id }) returned directly, so the UI's Connect button writes the sanity MCP entry into the named client's config and gets the path back.
- found: Exactly that: return invoke&lt;string&gt;('mcp_connect', { id }).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `mcpDisconnect` — as expected
- read at `aca46ec6c1f5` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A one-line invoke wrapper: invoke&lt;string&gt;('mcp_disconnect', { id }), removing the sanity MCP server from the named client's config and returning a status string.
- found: Exactly that, verbatim.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `listProjects` — as expected
- read at `352ee0c679ef` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: One-line Tauri wrapper returning invoke<ProjectList>('list_projects') — the open projects and which is showing, polled by the UI.
- found: return invoke<ProjectList>('projects') — identical but for the command name being 'projects'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `readSource` — as expected
- read at `47b1b31b57df` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 7 of its run
- expected: A thin Tauri invoke wrapper returning the file text: invoke&lt;string&gt;('read_source', { repo, relPath }), with no TS-side validation since Rust does the containment check.
- found: Exactly that one-line invoke wrapper.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I had already read three lines of this file for showsShare, though not this function.

### `openCodeWindow` — as expected
- read at `4031a63c7534` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A one-line wrapper over Tauri's invoke('open_code_window', { repo, relPath }) returning the promise, matching the Rust command of the same name; its siblings are all this shape, so no work beyond naming the command and forwarding both arguments.
- found: Exactly `return invoke('open_code_window', { repo, relPath })`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `projectScan` — as expected
- read at `0736de93c985` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Fetches a stored scan for a project key via invoke('project_scan', { key }), converts the raw wire payload through toScan, and returns null when nothing is loaded — an await plus a null guard before the conversion.
- found: Exactly that: awaits invoke&lt;WireScan | null&gt;('project_scan', { key }) and returns w ? toScan(w) : null. No catch, unlike its neighbour mcpCommand.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- note: Second function handed to me from api.ts; I had read only mcpCommand's three lines, but that alone taught me the invoke-wrapper idiom this one follows.

### `isReportStale` — as expected
- read at `fa05e056065b` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Compares the report's stored body/reading hash against the node's current one and returns true when they differ, with a guard returning false when either hash is missing or empty so a reading with no recorded hash isn't wrongly expired.
- found: Exactly that: early false if either r.body or node.body is falsy, then r.body !== node.body.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The field is named `body` on both sides but holds a hash, which is the one thing the doc could have said and didn't.

### `reportGrades` — as expected
- read at `340334c0f8d1` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Maps the report's two enum grades to numbers: predicted onto a surprise scale, falling back to the surprised boolean at the ends of the scale when no grade exists; documented mapped through a table but forced to the 'none' value when derivable is true, and null when there is no grade.
- found: Exactly that, in four lines: predicted defaults to r.surprised ? 'none' : 'full', documented is overridden to 'none' when r.derivable, then both are looked up in GRADE_SURPRISE / GRADE_DOCUMENTED with documented yielding null if absent.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `readingWords` — nearly
- read at `318fa813ee9e` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Given a node, returns null unless it carries a fresh non-stale agent reading (proxy/model scores and stale readings give null); otherwise maps the reading's score onto one of four heat words and passes the documented grade through as a word, null when there were no docs.
- found: That, plus two details I did not have: it also requires kind === 'func'; the heat word comes from the `predicted` grade with a back-compat fallback that reads the legacy boolean `surprised` as none/full; and `derivable: true` forcibly downgrades the documentation word to DOC_WORDS.none — docs a model could regenerate report as no documentation at all.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The docstring is careful about which scores earn a word but never mentions that `derivable` silently overrides the documented grade to "none", which is the line's most consequential behaviour.

### `agentReports` — as expected
- read at `e7c66ce4c92d` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A thin invoke&lt;AgentReport[]&gt;('agent_reports', { key }) passing the project key through so the backend routes by project rather than the last-opened repo; maybe a ?? [] fallback.
- found: Exactly that, one line, no fallback.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `applyAgentReports` — nearly
- read at `7c816acefcf4` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Builds a lookup from report key to report, walks function nodes, sets each matched node's score to an end of the scale (hot when surprised, cold when predicted) while stashing the original in node.proxyScore so it is reversible; stale reports (isReportStale, body-hash mismatch) keep no colour — the node falls back to its proxy score and is flagged stale for the hatch — then re-aggregates up the tree and returns the new root.
- found: That, plus three things I did not cover. The map is keyed on the NODE ID (r.id), not a path/name/ord key. The score is not written as a bare hot/cold value: reportGrades(r) supplies surprise and, only when the reader actually graded the docs, documented — with source:'agent' and analyzedShare:1 — so the panel never mixes an agent surprise with a lexical documentation number. And the recursion is identity-preserving: a parent whose children all came back referentially unchanged is returned as-is rather than reaggregated, so untouched subtrees keep their object identity.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs promise a binary verdict mapped to the ends of the scale, but the body delegates entirely to reportGrades and also carries a documentation grade, so the doc describes an older and narrower behaviour than the code has.

### `countPending` — as expected
- read at `18fe27cd2352` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A tight recursive walk from root counting two things over function nodes only, skipping excluded ones exactly as summarize does: functions whose reading is stale (hatched) and functions with no agent reading (uncoloured). Returns {stale, unread}, allocating only the result and doing no sorting.
- found: Exactly that. Two closure-captured counters and a `walk(n, out)` whose `out` flag is inherited downward — exclusion set on a directory propagates to every descendant rather than being checked per function. Stale and unread are mutually exclusive (`else if`), so a stale reading counts as stale and never also as unread.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `summarize` — surprising
- read at `b211533d0e99` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A single walk of the folded tree accumulating repo-wide totals — function count, total lines, assessed/stale/unread counts, a lines-weighted average temperature, plus hottest wedges and per-quadrant tallies — returned as one RepoSummary for the sidebar.
- found: One recursive walk threading an out-of-scope flag (excluded functions are counted separately and never enter the denominator), tallying functions/read/stale/unread plus a `predicted` spread, a `legible` spread with its own denominator, traps, and node lists per grade. There is no average temperature and no quadrant tally at all — instead it collects node arrays (hot, byGrade, notes, firstStale) and sorts them: hottest-then-largest for wedges, and a three-key sort for notes (traps first, then worst `predicted`, then hottest) with a comment explaining that temperature alone ranked a reader's self-reported miss above a real doc defect.
- predicted: some · documented: none · derivable: no · legible: most · trap: no
- note: No doc comment on a 70-line function that defines every number the sidebar reports, including the `excluded`/`functions` split that CLAUDE.md treats as load-bearing.

### `scanRepo` — as expected
- read at `252492de7a28` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Awaits invoke('scan_repo', { path }) for the raw Rust payload and returns it passed through the local toScan converter, which turns the wire shape into the frontend Scan/node tree. Errors propagate rather than being swallowed.
- found: Exactly that, with the argument nested one level deeper than I guessed: `invoke<WireScan>('scan_repo', { req: { path } })`, then `toScan(w)`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Not cold: this is my second reading from api.ts, and having seen mcpClients I knew the invoke idiom of this file already.

### `toScan` — as expected
- read at `469196822508` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: An undocumented 13-line adapter turning the Rust wire payload into the frontend Scan: mapping the wire root recursively via a toNode helper, renaming snake_case fields to camelCase and defaulting nulls, and carrying the stats block across.
- found: Exactly that: root through toNode, and a hand-written stats mapping of files_scanned/files_skipped/functions/without_history/commits (?? 0)/model into camelCase.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `onScanScore` — nearly
- read at `64991aedf868` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: A thin Tauri event-subscription wrapper: listen('scan:score', e =&gt; cb(e.payload.id, e.payload.upgrade)) returning an unlisten function — async under the hood, so it returns a synchronous disposer that awaits the promised unlisten.
- found: Exactly that on the event `scan-score`. The one detail beyond the shape: the `Upgrade` is assembled here rather than sent whole — the payload carries `surprise` and `hotspots` flat, and `hotspots` is defaulted to `[]` with `??` so an emitter that omits it yields an empty list rather than undefined. Disposer is `() =&gt; void un.then(f =&gt; f())`.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says "as the model produces them", but the app has no model path — readings arrive from agents over MCP and this event comes from the offline scan, so the comment names an instrument that was removed.

### `applyScores` — nearly
- read at `9076dab0c346` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Structural-sharing recursive walk: leaves whose id is in the scores map return a clone carrying the new score; containers recurse and, if any child changed identity, return a clone with aggregates recomputed (LOC-weighted mean temperature, analysed-lines-only hot share) mirroring Node::aggregate; unchanged subtrees returned by identity.
- found: That, with the aggregate arithmetic delegated to the sibling `reaggregate(node, children)` rather than inlined. The leaf patch is deliberately narrow: only surprise, hotspots, source:'model' and analyzedShare:1 are replaced, with churn/age/doc coverage preserved because they describe the code, not the instrument. Leaves with no existing score are skipped.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docstring describes the aggregate arithmetic at length, but the arithmetic lives in `reaggregate`; this function only routes to it.

### `reaggregate` — surprising — TRAP
- read at `86268e1fc748` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns a new Node with the given children attached and its aggregate score recomputed: total lines summed, and score fields (surprise/temperature etc.) recomputed as line-weighted averages over the children, mirroring Node::aggregate in model.rs, guarding against zero-line children.
- found: Line-weighted averages of surprise/documented/churn over scored children, but also: analyzedShare and hotShare accumulated differently for func children (binary, by source == model|agent) than for container children (via their own shares); ageDays taken as MAX over children; lastTouchedDays as MIN; commits deliberately carried from the node's own prior score rather than summed (a directory has no single commit count); and `source` escalated to the strongest instrument reaching anything inside (agent > model > proxy). Falls back to the node's existing score when no child had weight.
- predicted: some · documented: some · derivable: no · legible: full · trap: yes
- note: Three inline comments record bugs this copy had that the Rust original did not — the duplication the docstring warns about has already drifted at least three times, and nothing in code binds the two implementations.

### `onScanProgress` — as expected
- read at `6259f44de964` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: listen&lt;Progress&gt;('scan-progress', e =&gt; cb(e.payload)) and return a synchronous unsubscribe closure that resolves the listen promise and calls the unlisten fn.
- found: Exactly that: `const un = listen<Progress>('scan-progress', (e) => cb(e.payload))` then `return () => void un.then((f) => f())`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `onSetTheme` — as expected
- read at `cf820892bc70` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Subscribes to a Tauri 'set-theme' event emitted by the Rust app menu, invoking cb with the payload, and returns a synchronous unsubscribe closure that awaits the promised UnlistenFn and calls it.
- found: Exactly that, including the literal event name 'set-theme': listen<string>('set-theme', e => cb(e.payload)) with `() => void un.then(f => f())` as the disposer.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `onOpenProject` — as expected
- read at `12cdc9c0634a` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A thin Tauri event-subscription wrapper: listen for an 'open-project' event from the native menu item, call cb on each, and return an unsubscribe closure that resolves the listen promise and calls the unlisten function.
- found: Exactly that, three lines, event name 'open-project', unsubscribe as () =&gt; void un.then((f) =&gt; f()).
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `syncThemeMenu` — nearly
- read at `6746257ef32c` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: A thin Tauri invoke wrapper telling Rust which appearance menu item to tick: invoke('sync_theme_menu', { theme }), called once the webview has read the stored theme.
- found: That, plus a bare `.catch(() =&gt; {})` that swallows any failure so a missing/unavailable menu never rejects.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The silent catch is undocumented — cosmetic here, but it is the one line that hides a real failure and neither the docs nor the signature admit it.

### `temperature` — nearly
- read at `95eada141c26` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: An identity-ish accessor kept deliberately as a function: return s.surprise when a score exists and something neutral (0, or UNDECIDED 0.5) when it does not, with no 1-explained multiplier any more — a null guard plus a single field read.
- found: Null guard returning 0, then s.surprise clamped into [0,1] with Math.max/Math.min. The clamp was the one detail I did not predict.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Unscored (null) and genuinely-cold both return 0, so the colour cannot distinguish "no reading" from "entirely unsurprising" at this level.

### `wedgeHeat` — nearly
- read at `f7449f9bd797` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A leaf/branch switch: a function (no children) returns its own temperature(node); anything else returns the share of its lines that are hot, likely a precomputed field passed through the neighbouring shareRamp to land on the same 0-1 scale. Four lines, one ternary or early return.
- found: `if (!node.score) return 0` then `showsShare(node) ? node.score.hotShare : temperature(node.score)`. The right branch matches, but the leaf/branch decision is delegated to a `showsShare` predicate rather than tested inline, hotShare is returned raw with no ramp, and there is an unscored-node guard returning 0 that I did not anticipate.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `shareRamp` — as expected
- read at `7f443945c094` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Maps a 0-1 share onto a position on the colour ramp used by rampAt/heatColor: a clamp to [0,1] with some non-linear shaping (a power or a band) so small shares stay visible, returned as a single number.
- found: Clamps the share at zero, divides by SHARE_BAND so the ramp saturates at a fraction well below 1, caps at 1, then raises to SHARE_SKEW — a band-and-exponent calibration, the same shape heuristic::calibrate uses on the Rust side.
- predicted: full · documented: none · derivable: no · legible: most · trap: no
- note: Third handout from api.ts; also the constants SHARE_BAND and SHARE_SKEW carry the whole claim and there is no comment saying what they were measured against, unlike the equivalent Rust calibration.

### `paintHeat` — nearly
- read at `e11eeab12cdc` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Calls wedgeHeat(node) and, for a directory/aggregate whose value is a hot share, pushes it through shareRamp so it lands on the colour bar's scale; leaf functions pass through unchanged. Two lines: get the heat, return the ramped version.
- found: Right structurally but it does not call wedgeHeat at all: it guards on a missing score returning 0, then branches on showsShare(node) between shareRamp(score.hotShare) and temperature(score) — it re-derives the same branch wedgeHeat makes rather than wrapping it.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The doc says this is "`wedgeHeat`, with a share put on the ramp's own scale", but the body never calls wedgeHeat — it duplicates the showsShare branch, so the two can drift apart while the doc still claims one is defined in terms of the other.

### `isAnalyzed` — as expected
- read at `6c3be426c8a7` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A predicate returning true when a node's score came from a real agent reading rather than the proxy — for a function, score.source === 'agent' or equivalent; for a directory or file, analyzedShare > 0 — with a missing score returning false so the wedge renders grey.
- found: Exactly that, with the container/leaf split routed through a `showsShare(node)` helper rather than an inline kind check, and the leaf branch accepting 'model' as well as 'agent' as a real source.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: A 'model' source is still accepted here even though the design notes say the in-app model path was removed entirely.

### `heatColor` — as expected
- read at `1cb793b31e21` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A one-expression wrapper: clamp t to 0-1, scale onto the ramp's five stops, and return a CSS `color-mix(...)` between the two bracketing `var(--<ramp>-N)` custom properties, delegating the stop lookup to the neighbouring `rampAt`/`rampStop` so the ramp stays in index.css.
- found: Precisely that: destructures `{stops, i, f}` from `rampAt(t, ramp)` and returns `color-mix(in oklch, var(stops[i+1]) f%, var(stops[i]))`. Clamping lives in `rampAt`, not here; the mix space is oklch rather than the oklab I guessed.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `rampStop` — nearly
- read at `7190b43ea12d` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Maps normalised t onto a discrete ramp position — scales by stop count, rounds to nearest index, clamps, and returns that stop's CSS custom-property name instead of a color-mix string.
- found: Delegates the scaling and clamping to a sibling rampAt(t, ramp), which returns { stops, i, f }, then picks stops[i] or stops[i+1] on the fractional part — nearest-stop rounding, exactly the shape predicted, but all the arithmetic is in the shared helper.
- predicted: most · documented: full · derivable: no · legible: most · trap: no
- note: The docs explain WHY the rounding exists (color-mix results are unreadable from JS) — nothing in the three-line body could tell you that.

### `rampAt` — surprising
- read at `2e632ef3d0ea` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Given a normalised t and a Ramp of colour stops, clamp t, find the bracketing pair of stops, compute the local fraction between them, and return an interpolated colour string — the shared sampler behind heatColor and shareRamp.
- found: The positioning half only, and the stops are CSS custom-property NAMES, not colours: it builds `--{ramp}-0..4` from a fixed five-element index list, scales the clamped t across four intervals, clamps the lower index to len-2, and returns `{stops, i, f}` for a caller to interpolate. No colour is read or mixed here.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: The five-stop count is hardcoded as a literal `[0,1,2,3,4]` inside the function, so every ramp must have exactly five CSS variables and a ramp defined with fewer silently yields undefined custom properties rather than an error.

## web/src/lib/cn.ts

### `clsx` — as expected
- read at `e8933499c48d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: parts.filter(Boolean).join(' ') — drop falsy varargs, join the rest with a space.
- found: Exactly that, character for character.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/colorMode.ts

### `paintsFromReadings` — as expected
- read at `eff5c407e8c5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A one-line predicate returning true for the reader-report lenses — 'surprise' plus the two newer ones (something like legible/documented) — as a literal set membership or a || chain.
- found: Exactly a three-way || chain: mode === 'surprise' || 'legible' || 'traps'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `slotColor` — as expected
- read at `ce80239a770a` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Indexes a fixed palette array by rank and returns that colour string; if rank is past the palette's end it falls back to a single "Other" colour. Likely PALETTE[rank] ?? OTHER.
- found: Exactly that: `rank < CATEGORICAL.length ? CATEGORICAL[rank] : OTHER`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `ramped` — as expected
- read at `76401bbd20a0` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A four-line helper: pick the colour for v off the named ramp, find the nearest stop index, and return a Paint bundling { fill, stop, ink } with the ink from the ink.ts contrast helper applied to that fill, so the three can never be taken apart.
- found: Exactly that: `rampStop(v, ramp)` for the stop, `heatColor(v, ramp)` for the interpolated fill, `inkOn(stop)` for the ink, returned as one Paint. Worth noting the ink is chosen against the discrete STOP, not against the continuous fill.</found> <parameter name="predicted">full
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `ageRamp` — as expected
- read at `8ebbe96528dd` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Normalises an age in days against the repo's own observed span, returning a 0..1 ramp position, logarithmically compressed so the oldest end does not dominate — roughly log1p(days)/log1p(span), clamped, with a guard for a zero or tiny span so an all-same-age repo does not divide by zero.
- found: Exactly that shape: clamps span at 0, returns 1 outright when the span is under a day (the 0/0 guard, with a comment saying an all-this-morning repo would otherwise paint itself ancient), clamps days into [0,s], and returns `1 - log10(d+1)/log10(s+1)` — so the ramp is INVERTED relative to my phrasing, 1 for newest and 0 for oldest.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docstring is attached at line 126 but the function starts at 162, so it is a long prose block explaining the repo-relative normalisation decision rather than the body — excellent, and not derivable from the code.

### `opaqueShare` — nearly
- read at `7278be878d5a` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 8 of its run
- expected: Recursive subtree walk summing loc of every func node carrying a legible reading into a `read` total, and into an `opaque` total when the grade is low (some/none). Returns null when read is 0, else opaque/read.
- found: Exactly that, with one extra guard I did not name: stale readings are excluded too (`n.agent && !n.agentStale && n.agent.legible`), consistent with the repo rule that a stale reading must not colour anything. some/none are the opaque grades.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Not cold: colorMode.ts was my first reading this run (legendFor), though I read only those 12 lines and nothing near this function.

### `colorFor` — nearly
- read at `0b8ded17ef51` · commit `9fe6ccf` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A dispatch over the ColorMode variants — surprise/temperature, age or recency, language, maybe churn — each branch pulling the relevant field off `node`, returning null early when that field is missing (no touch date, unknown language, unscored). Colours from the sibling helpers: ramped/ageRamp for continuous scales (age using ageSpan with a floor fallback), slotColor plus `ranks` for categorical ones, each returning a Paint spread with a human-readable label.
- found: Exactly that shape — a chain of `if (mode === ...)` returns with a categorical fallthrough at the end — but with more modes and more nuance than predicted: `surprise` switches between a container hot-SHARE (percentage label) and a leaf reading, and deliberately keeps the label uncalibrated while the fill is ramped; `legible` also rolls containers up as an opaque share and otherwise uses the agent grade, skipping stale readings; `traps` is two flat colours plus an absence, painting read-and-clear in the structural neutral so "looked and found nothing" is distinct from "nobody looked"; `churn` and `age` are the predicted ramps; the tail covers BOTH `blame` (lastAuthor) and language via ranks/slotColor.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `rankCategories` — nearly
- read at `43639d96a85f` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Walks the node tree accumulating lines per category (category from `mode`), sorts descending by lines, returns Map of category name to slot index.
- found: Delegates entirely to legendFor(root, mode), which returns the already-ordered category names, and just indexes that array into a Map name→i.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `bucketsFor` — nearly
- read at `6945cc4bc17f` · commit `9fe6ccf` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: One walk over the subtree collecting leaf functions (skipping .sanityignore'd ones), split per mode: categorical modes (language, blame) grouped by key and coloured with slotColor(ranks.get(key)); ramped modes (surprise, legible, churn, age) dropped into fixed bands, each band coloured by ramped() at the MEAN of its members' ramp inputs; anything uncolourable into a final structural-neutral bucket rather than dropped. Returns Bucket[] with label, colour and a count or line total, probably sorted by size.
- found: Essentially that, with three things I did not cover. `surprise` returns an EMPTY array immediately — the one mode the panel does not break down. Buckets carry `nodes` and a `lines` sum rather than a count, and the mean-ramp pass is a separate loop over a side map afterwards. Sorting is per-mode rather than by size: lines for blame/language, traps-first for traps, a fixed grade order for legible, band order for churn/age — and the absence bucket is always moved to the end regardless. legible/traps read off the agent reading (skipping stale) with 'not read yet' versus 'not graded' as distinct absences, and the unknown key is a NUL-escape prefix so a real author named 'unknown' cannot collide.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Five paragraphs of doc and none of them mention the first line of the body: `surprise` returns no buckets at all.

### `legendFor` — nearly
- read at `673cd639d481` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: For categorical color modes it walks the tree collecting each node's distinct category label and returns them in a stable order for the legend; for ramp modes it returns an empty array since a continuous ramp needs no discrete legend.
- found: Returns [] unless mode is 'blame' or 'language'. Otherwise walks the tree accumulating, per key (lastAuthor or lang) and only for kind==='func', a sum of loc, then returns the keys sorted descending by total lines — so the legend is ordered by visual share, not alphabetically or by first appearance.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/fan.ts

### `sectorOf` — nearly
- read at `7019919acd9b` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A tiny constructor taking two angles and two radii and returning a Sector object literal {a0, a1, r0, r1}, one field per line, so fan code need not repeat the shape.
- found: Returns an object literal, but the radii are not stored as radii: angles pass through as a0/a1 while r0/r1 go through vOf() and are stored as v0/v1 — the Sector holds a transformed radial coordinate, not the raw radius.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The parameters are named r0/r1 but the stored fields are v0/v1 via vOf, so a caller reading only the signature would not know the Sector stores a transformed radial coordinate.

### `arcOf` — nearly
- read at `d778f6bc59c4` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 5 of its run
- expected: A tiny converter from the fan's Sector representation (centre/bearing/span plus radii) into the Arc shape the tiling and path code want — {a0,a1,r0,r1} — computing the half-span either side of the bearing. Pure arithmetic.
- found: A four-field object literal: angles pass straight through (a0/a1 already exist on Sector), and the two radii come from mapping the sector's v0/v1 through a helper `rOf`. No bearing/span maths at all — a Sector already stores angle bounds, with the radial axis stored in some other unit that rOf converts.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The `v0`/`v1` fields and `rOf` are the only interesting content and nothing in the signature or peers says what unit v is; I had read FileZoom.tsx, not this file, so it was still cold as a file but I knew arcOf was consumed by a tiler.

### `deg` — as expected
- read at `b04cee775995` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A one-line radians-to-degrees helper, (r * 180) / Math.PI, for converting the sunburst's internal radian angles.
- found: Precisely that, character for character.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `fanFor` — nearly
- read at `fecd387dec73` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Keeps the clicked wedge's mid-bearing, sweeps candidate spans (90/120/180/270/360-ish), measures each fitted to paneAspect, and returns a Sector centred on the same bearing with the span that puts the most area on screen; null src falls back to a full circle.
- found: Exactly that shape, but the sweep is a fine-grained degree loop from MIN_SPAN to MAX_SPAN by STEP rather than a handful of candidates, the radii come from RIM and CORE_SHARE constants, the bounding box is computed by extentOf, the fit is scale = min(paneAspect/w, 1/h) matching the viewBox, and the scored area is the annulus sector area times scale squared. Null src uses a NO_WEDGE_BEARING constant, not a full circle.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc is unusually good on the why (bearing preserved deliberately, area == capacity) yet never mentions the null case, which the body handles with its own constant.

### `lerp` — as expected
- read at `45b2910ff09a` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A one-line linear interpolation: a + (b - a) * t.
- found: Exactly that, verbatim.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `lerpSector` — as expected
- read at `9b76b7006c62` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Same shape as lerpView: a struct literal lerping the sector's angular bounds (a0/a1) and its v bounds (v0/v1, the area-linear radial coordinate rather than r) by t.
- found: Exactly that — lerp on a0, a1, v0, v1.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `share` — as expected
- read at `ff03c942c966` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A one-line arrow helper: given range lo..hi and position `at`, return the normalised fraction (at - lo) / (hi - lo), guarding a zero-width range. The inverse of the neighbouring `lerp`.
- found: Exactly that, with the guard as a ternary: `hi > lo ? (at - lo) / (hi - lo) : 0`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `place` — nearly
- read at `32ae3764810f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Takes a cell laid out inside the dest sector and re-expresses it inside live by an affine rescale on both axes: each of the cell's four bounds as a fraction of dest's angular and radial extents, lerped across live's corresponding extents, returning a new Arc — probably one expression using share/lerp.
- found: Exactly that, with one detail I missed: the radial axis is not remapped in radius but in a transformed coordinate `v` (r squared / area-equalising, via vOf and rOf). Two local closures `a` and `v` do the share-then-scale on angle and on v respectively, and the radii round-trip through vOf/rOf so equal-area cells stay equal-area across the map.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: The doc claims "a cell holds the same fraction of the box at every frame" but the fraction preserved is in v-space, not r-space, and neither the doc nor the body says what v is.

### `centre` — as expected
- read at `b80b50d36cda` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 10 of its run
- expected: Mid-angle (a0+a1)/2 and mid-radius (r0+r1)/2, converted to screen coordinates with the clockwise-from-noon convention: x = r·sin a, y = −r·cos a, returning all four so callers get both the polar bearing and the cartesian point.
- found: Exactly that, line for line.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc hands over the sign convention outright, which is the only thing about this function a reader could get wrong — that is what made it fully predictable.

### `room` — as expected
- read at `1ef61c46850f` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A three-line function returning {w, h} where w is the arc length at mid-radius — (a1 - a0) * (r0 + r1) / 2 — and h is the radial thickness r1 - r0.
- found: Exactly that, one expression, character for character what I predicted.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/history.ts

### `scanHistory` — as expected
- read at `499218ef69e7` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A one-line Tauri wrapper returning invoke&lt;HistoryScan&gt;('scan_history', { path, limit }), with limit optional so the backend cap applies.
- found: Exactly that, verbatim.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `warmHistory` — nearly
- read at `bf062faa9fb5` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A one-liner invoking the Tauri command warm_history with { path } and returning its boolean, probably with a .catch(() => false) since it is fire-and-forget.
- found: return invoke&lt;boolean&gt;('warm_history', { path }) — no catch at all, so the fire-and-forget promise is the caller's to handle; the entire policy the docs describe lives in Rust.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The docstring is a good essay about a policy none of which is in this body — every claim it makes is enforced on the Rust side, so it documents the command, not the shim.

### `onHistoryProgress` — as expected
- read at `362d617cee23` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A thin wrapper over Tauri's event system: listen&lt;Progress&gt;('history-progress', e =&gt; cb(e.payload)), returning a synchronous unsubscribe closure that resolves the listen promise and calls the unlisten handle.
- found: Exactly that, five lines, including the void-then-unlisten shape for the async handle.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `daysBetween` — as expected
- read at `d174e1052ee9` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Math.max(0, (now - then) / 86400) — one expression clamped at zero so a future-dated stamp reads as zero days rather than negative, unrounded because callers want fractional days.
- found: Exactly `Math.max(0, (now - then) / 86_400)`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `opening` — as expected
- read at `442ea8dc2938` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Builds the synthetic frame-zero state from the pre-window fold: a Frame populated from the truncated prefix the backend already collapsed, with no touch dates so those functions draw uncoloured, and date/index set to the window's base or a sentinel. Returns a freshly allocated Frame that advance will mutate forward.
- found: Exactly that: empty loc/touched/born/hits/author Maps, `ts: hist.baseTs`, `at: -1`, then copies `hist.base` into `loc` only — with a comment stating that touched and born are deliberately left unset because dating pre-window functions to the window's start would make the opening frame flare as if the whole repo had just been written.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `advance` — nearly
- read at `44181d35b1ca` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Loop commits frame.at+1..to, apply each commit's per-file deltas in place — delete removed functions, insert/update added or changed ones, stamp touched ones with the commit date for recency colouring — then set frame.at = to. Forward-only, no rebuild.
- found: That, with more state than I named: per function it maintains four maps — loc (lines), touched (last ts), born (first ts, set once), and hits (a bounded ring of touch STAMPS capped at CHURN_MEMORY via shift), plus a per-FILE author map. Deletions clear all four function maps but leave author. Ends by clamping frame.at to the last commit index and setting frame.ts from that commit, falling back to hist.baseTs.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: A deleted function drops its `born` stamp, so a path that is re-added later is reborn at the later commit — correct for a genuine delete, but a rename or a move back and forth resets age.

### `replay` — surprising — TRAP
- read at `59a3719d614b` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Builds a frame from scratch: start from opening(hist) and fold each commit 0..index with advance, returning the Frame — the backwards-scrub path, linear in index, as distinct from the memoised forward-incremental path.
- found: It IS the memo holder: if a module-level `memo` matches the same hist and its frame is at or before `index`, it advances that frame forward in place and returns it; otherwise it builds `opening(hist)`, advances to index, stores it as the new memo, and returns it.
- predicted: some · documented: none · derivable: no · legible: full · trap: yes
- note: The memoised frame is returned by reference, so any caller that retains a previous return value silently sees it mutate on the next replay.

### `scoreInto` — nearly
- read at `307fff6d72fe` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Pooling helper: mutate `into` in place if given, else allocate a fresh Score, filling the fields for function index f from the frame's per-function maps — notably a recency/age computed against the frame's own date, null when there is no stamp — while leaving surprise and analyzedShare at 0 so isAnalyzed refuses to colour it.
- found: That, plus a churn计算 I did not cover: it reads the function's touch stamps out of frame.hits and counts only those within CHURN_WINDOW_DAYS of frame.ts at read time (comment explains the window moves with the playhead so a count cannot be carried), then sets churn = min(1, commits/CHURN_SATURATION), ageDays from `born`, lastTouchedDays from `touched`, both null when absent. The fresh allocation sets provenance 'history' and source 'proxy'.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: On the reuse path the pooled Score keeps whatever surprise/documented/hotShare/analyzedShare the previous frame left on it — only churn, ageDays, lastTouchedDays and commits are rewritten — so the doc's "every field it cannot honestly fill is left at no-claim" holds only for a freshly allocated one.

### `aggregate` — nearly
- read at `017617381d90` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A recursive post-order walk mutating in place: recurse into children, sum lines, LOC-weighted averages of the score fields, oldest child's age and newest child's last-touched written onto the node; leaves return immediately.
- found: That shape, but only churn is LOC-weighted; commits takes a plain max, age is max of children's ageDays and lastTouchedDays is min (both null-tolerant), and the rest of the Score is written as fixed zeroes with provenance 'history' — surprise, documented, hotShare and analyzedShare are deliberately not rolled up, because history never colours by surprise. Children with no score are skipped, and if every child lacks one the node's score is left untouched.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc says "LOC-weighted" of the roll-up generally, but only churn actually is — commits is a max and the surprise-side fields are hardcoded zero, which the doc does not mention at all.

### `collapse` — as expected
- read at `d28aae3d52ae` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Recursive: collapse each child first, then while the node has exactly one child and that child is a directory, replace the node with the child, joining names with '/' so src/tauri/src is one ring; unchanged when it has zero or several children.
- found: Exactly that. Children are mapped through collapse bottom-up first, then a dir with exactly one dir child returns a spread of that child with the joined name. Bottom-up recursion means the single pass handles arbitrary chains without a loop; the node is returned as-is otherwise.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `dirNode` — as expected
- read at `03c8aa3058bc` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Builds a fresh container Node for the history frame tree with kind 'dir', the given path and name, empty children, zero loc, null line/score/agent fields, and an id derived from the path — freshly allocated per frame rather than pooled, since the sunburst relayouts when its root's identity changes.
- found: Exactly that: a single object literal with id = path, the given name, kind 'dir', loc 0, null line/endLine/lang/lastAuthor/score/body, excluded false, empty hotspots and children.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Nothing in or near the function records the reason it must not be pooled the way function nodes are — the constraint lives only in project notes.

### `frameTree` — as expected
- read at `a7efbd30f6f9` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Takes the folded state at index (via memoised advance/replay), then builds a fresh Node tree: buckets surviving functions by path into file and directory nodes (dirNode, collapse), colours each function by recency of its touch stamp against that frame's own date (scoreInto, daysBetween), aggregates line totals upward (aggregate), returns a root named repoName, with function nodes pooled and containers freshly allocated.
- found: Exactly that: replay(hist, index) for the frame, dirNode('', repoName) root, lazy recursive dirFor/fileFor memo maps that create and link parents on demand, a function-node pool keyed on the HistoryScan identity (reset when hist changes), iteration over frame.loc sorted by intern index so wedge order is stable across the replay, per-frame mutation of only loc/lastAuthor/score (scoreInto), then aggregate(root) and collapse(root).
- predicted: full · documented: some · derivable: no · legible: full · trap: no

### `scopedCommits` — nearly
- read at `3602f169da67` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns every commit index when scope is '', otherwise filters hist.commits to those whose touched files fall under scope, using a segment-wise prefix test so `web/src` doesn't match `web/src-old`.
- found: Exactly that, plus one detail I didn't cover: file paths are interned, so it precomputes an inScope boolean per entry in hist.paths and each commit's `files` holds indices into it.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `posOf` — as expected
- read at `8edae688f93f` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A binary search over the ascending array of real commit indices, returning the position of the last entry <= index, or -1 when every scoped commit comes after it. Companion to realOf.
- found: Exactly that: a lo/hi binary search tracking the best candidate in `out`, initialised to -1, moving lo past mid when frames[mid] <= index.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `realOf` — as expected
- read at `d12300962075` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Maps a scoped position to a real timeline index: pos &lt; 0 gives the index just before frames[0] (frames[0] - 1), empty list gives fallback, otherwise frames[pos] with clamping for out-of-range positions.
- found: Exactly that, with the clamp written as Math.min(pos, frames.length - 1) and the empty-list fallback checked first.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/ink.ts

### `inkOn` — nearly
- read at `c90ed237aaf5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Normalise the token (stripping var(...)), resolve the custom property to a concrete colour, return chrome ink if that fails; otherwise composite over the pane background at `alpha` and return whichever of the two ink colours wins on luminance/contrast.
- found: That, with the var() stripping delegated to `resolve`, and one thing I missed: it is memoised in a module cache keyed `theme|token|alpha`. `over` returns a LUMINANCE rather than a colour, and is skipped entirely when alpha >= 1 or the background will not resolve. Choice is contrast(y, PAPER) >= contrast(y, INK) ? PAPER : INK, falling back to CHROME_INK when the fill is unresolvable.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `theme` — nearly
- read at `e9a53e5e7f29` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A one-liner returning the current theme ('dark'|'light'), read from a data-theme/class on the document element or prefers-color-scheme, so the ink colour helpers know which ground they draw on.
- found: Returns document.documentElement.className verbatim (the whole class string, not a parsed theme), falling back to a single space when there is no document (SSR/test). Used as a cache key rather than a theme enum.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: The fallback is a single space rather than an empty string, which reads as a deliberate sentinel but nothing says why.

### `resolve` — nearly
- read at `d458e5fd6f73` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads the CSS custom property named by `token` off the document root via getComputedStyle().getPropertyValue(), trims it, returns it only if it is a plain hex colour, otherwise null so callers fall back (e.g. a color-mix stop).
- found: Exactly that, plus two details I did not name: an SSR/no-document guard returning null, and it strips a wrapping `var( ... )` and requires the name to start with `--` before looking it up. The hex test is a strict 6-digit `/^#[0-9a-f]{6}$/i`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `luminance` — as expected
- read at `2bb31705d74a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Parses the hex colour into r/g/b, converts each through the sRGB-to-linear transfer function (via the `srgb` peer), and returns 0.2126*R + 0.7152*G + 0.0722*B — WCAG relative luminance in 0..1.
- found: Exactly that, written as a reduce over the array `srgb(hex)` returns, indexing the coefficient list [0.2126, 0.7152, 0.0722] by channel position — so the linearisation lives entirely in `srgb` and this is just the weighted sum.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `over` — as expected
- read at `af45ee2bd823` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Converts hex and ground into linear-light RGB channels via srgb(), blends per channel with alpha (c*alpha + bg*(1-alpha)), and returns the relative luminance of the composite using 0.2126/0.7152/0.0722 weights.
- found: Exactly that: destructures [srgb(hex), srgb(ground)], then a single reduce that multiplies each blended channel by the inline coefficient array and sums. It inlines the weights rather than calling the peer `luminance`.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: The coefficient array is reallocated inside the reduce and duplicates whatever `luminance` uses, so the two could drift apart.

### `srgb` — as expected
- read at `2805cb2700d8` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Parse a hex string into three 0-1 channels and apply the sRGB inverse gamma transfer (c/12.92 below the knee, ((c+0.055)/1.055)**2.4 above), returning the linearised triple used by luminance/contrast.
- found: Exactly that, written as [1,3,5].map over byte offsets into the "#rrggbb" string, with the threshold at 0.04045 (I guessed 0.03928, the other constant from the same WCAG text).
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Assumes a full 7-char #rrggbb literal with no validation — a 3-digit shorthand or a named colour silently yields NaN channels.

### `contrast` — as expected
- read at `48b374d2cfba` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Takes two relative luminances and returns the WCAG ratio (lighter + 0.05) / (darker + 0.05), using Math.max/Math.min so argument order does not matter.
- found: Character for character that: `(Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05)`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/label.ts

### `widthPerPx` — nearly — TRAP
- read at `8a929cff67e8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Keys a module-level Map on weight+text, returns the cached ratio if present; otherwise lazily makes a 2D canvas context, sets font to a reference size, measures the text and divides by the reference to get width-per-px-of-font-size, falling back to text.length * ~0.6 with no canvas. Caches and returns.
- found: All of that, key `${weight}|${text}`, REF-relative measure, 0.6/char fallback. Two things beyond my prediction: the measured advance is deliberately inflated by 6% because measureText reports advance rather than ink, and the policy is that a name which does not clearly fit is not drawn at all. And the leading comment claims the cache is keyed on the FACE too — it is not; FAMILY appears in the font string but never in the key.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The comment says the cache is "keyed on the FACE too ... a cache that ignored it would answer every question after the first with the width the first face happened to have" — but the key is only `${weight}|${text}`, so if FAMILY is genuinely live that is exactly the bug the comment describes, sitting one line above it.

### `middleTruncate` — nearly
- read at `057f6ebaee05` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns the name unchanged if it fits in `keep`; otherwise splits the budget between a head slice and a tail slice with an ellipsis between them, head taking the extra character on odd budgets.
- found: Exactly that — early return when keep >= length, head = ceil(keep/2), tail = remainder, joined with '…'. Plus one thing I did not predict: below a MIN_KEPT floor it returns the empty string rather than a stub, and the tail slice is guarded for tail === 0.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc argues the design well but says nothing about the MIN_KEPT floor that makes the function return '' — the one behaviour a caller could be caught by.

### `fitLabel` — nearly
- read at `b2373ee57957` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Tries the full name along the wedge's arc first, then turned 90 degrees radially; only if neither fits does it fall back to middleTruncate on whichever axis has more room, returning null if even the truncated form drops below a minimum. Uses widthPerPx to convert font size to text width against the cell's extent, returning a Placement with orientation, size and text.
- found: That, plus the geometry I did not have: it computes a max size per axis from three or four simultaneous caps — length, thickness at right angles (LINE), and for arc labels a maximum angular BEND, all clamped by opts.max. The radial size is the closed-form fixed point of LINE*s = span*(midR - wpp*s/2), because a radial name must be CENTRED in the wedge, and the doc comment records two earlier wrong answers (measuring at r0, and sliding the label outward). Axis preference is by cell shape (outer arc vs depth), overridable by opts.only for rim bands. Truncation only ever runs at MIN_SIZE, on the preferred axis, scanning keep downward to a floor of MIN_KEPT / MIN_SHARE of the name.
- predicted: most · documented: some · derivable: no · legible: most · trap: no
- note: The handed docs state the ordering policy well but say nothing about the three-way size caps or the centred-radial fixed point, which is where all the actual difficulty lives.

## web/src/lib/runtime.ts

### `isTauri` — as expected
- read at `90484e71e848` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A one-expression arrow returning whether the app runs inside a Tauri webview rather than a plain browser, almost certainly checking that window.__TAURI_INTERNALS__ (or __TAURI__) is defined, coerced to boolean.
- found: Exactly that: `typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window`, with the extra SSR/non-DOM guard on window itself.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `isMac` — as expected
- read at `263dee010e59` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A one-liner returning whether the platform is macOS by testing navigator.platform/userAgent for "Mac", guarded against a non-browser environment, used by isTauriMac.
- found: Exactly that: guards `typeof navigator !== 'undefined'` then tests `/Mac|iPhone|iPad/i` against navigator.userAgent.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `isTauriMac` — as expected
- read at `78541b5becc9` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A one-line arrow returning isTauri() && isMac(), the conjunction of its two neighbours, so traffic-light room is reserved only in the desktop shell on macOS.
- found: Exactly that: `export const isTauriMac = (): boolean => isTauri() && isMac()`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `onFullscreenChange` — nearly
- read at `09d0c2b498ce` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Subscribes to the Tauri window resize event, asks the window whether it is fullscreen on each resize and calls cb with the boolean, fires once immediately for an initial value, returns an unsubscribe; no-ops with a dummy unsubscribe off Tauri/macOS.
- found: All of that, plus careful async teardown: the Tauri window API is dynamically imported inside a floating async IIFE, so the returned disposer may run before the listener exists. A `dead` flag both suppresses late cb calls and, if the disposer already ran, immediately unsubscribes the listener the moment it registers.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/lib/sunburst.ts

### `heatOf` — surprising
- read at `72fdba84ea74` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Returns the temperature a wedge is drawn with: the node's surprise score when it has one (agent reading if present, else proxy), and for containers an aggregate over children — probably a LOC-weighted mean. At five lines, likely `n.score?.surprise` with an undecided/stale fallback rather than a recursive walk.
- found: No aggregation and no fallback to UNDECIDED: if the node has no score it returns 0, and otherwise it picks between two already-computed fields — `hotShare` when `showsShare(n)` says this node is drawn as a share (containers), `surprise` otherwise. The container/leaf distinction I guessed at is real but is delegated to showsShare and to a precomputed field rather than done here.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: A node with no score returns 0, which draws as the coolest possible wedge rather than as undecided — the same "claiming confidence it hasn't got" shape the metric rules warn about, though it may be unreachable in practice.

### `layout` — surprising
- read at `edc13ec63f43` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A recursive sunburst layout: walk root to maxDepth, angular span proportional to aggregated lines, radii per depth ring, cull wedges below a minimum angle, emit a flat array of arcs with path strings and heat colour; leaf functions handled by tileFunctions/sliceFunctions; opts carrying size and min-angle.
- found: A recursive `walk` pushing {node, depth, a0, a1, index} wedges — angles only, no radii, no path strings, no colour, no function tiling (those are separate peers). Children sorted biggest-loc-first (name tiebreak) or by heat when opts.byHeat; weight is 1 per child when opts.even; collapsed ids stop recursion; wedges under minAngle are culled UNLESS kind === 'func' (functions draw as dots), and a culled subtree is counted into hidden.files/hidden.dirs recursively, excluding functions. Starts at -PI/2 (9 o'clock) so the largest wedge sits across the top for label legibility. Returns {wedges, hidden, depth}.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment at all on the file's central layout function, yet the body carries four substantial inline rationales — the reasoning is there, just not where a caller looking at the signature would find it.

### `arcPath` — as expected
- read at `e48073887a6d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Converts the four polar bounds to Cartesian with a -90 degree offset (clockwise from 12), emits M/A along the outer radius, L in to the inner radius, A back the other way, Z; large-arc flag from sweep exceeding pi; likely a special case for a full circle, possibly for r0 === 0.
- found: Exactly that, with the clockwise-from-12 rotation done as x = r*sin(a), y = -r*cos(a) rather than an angle offset, coordinates fixed to 2 decimals, large flag from sweep > pi, and a full-circle branch (within 1e-9 of 2pi) that draws both rings as two half-arcs each with opposite sweep flags so the annulus punches its hole. No r0 === 0 special case — the inner arcs degenerate harmlessly to a point.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `aggregate` — nearly
- read at `4b2eb8e74c45` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Builds one synthetic function Node standing for the functions that did not fit: a name like "+N more", an id from filePath, loc summed over members, and a Score whose temperature (and likely other numeric fields) is the LOC-weighted mean over only members carrying a real reading, falling back to something neutral when none were read; probably keeps the member list on the node for hover/the panel.
- found: As predicted in shape, with more machinery than I covered. "Read" is defined precisely as score.source of 'model' or 'agent'; a LOC-weighted mean helper (with Math.max(loc,1) so zero-line functions still weigh) is applied field by field — surprise, documented, churn, ageDays, lastTouchedDays, commits (rounded) — while provenance and source are copied from the first read member. Two fields I did not anticipate: hotShare is recomputed as the LOC share of read members above HOT rather than a mean, and analyzedShare = read LOC / total LOC so a mostly-unread pool renders unread instead of borrowing the confidence of the few read members. Name is `${fns.length}+`, id `${path}#rest`, `rest` carries the count so colorFor can tell it is a collection, `children` keeps the members so the detail panel can reach them, and `excluded` is hard-coded false rather than inherited. Extensive inline comments explain each choice, including a past bug where hotShare held mean(surprise).
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc says the score is the LOC-weighted mean of read members, but hotShare and analyzedShare are deliberately not means — the doc undersells the one place it matters most.

### `vOf` — as expected
- read at `52de10c15242` · commit `81eb6d5` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A one-liner converting radius to the area-linearised coordinate: r squared over two, the inverse of rOf (sqrt(2v)).
- found: Exactly that: `export const vOf = (r: number) => (r * r) / 2`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `rOf` — as expected
- read at `10225c7853a6` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A one-line arrow inverse of vOf — converting a normalised/area value back into a radius, roughly Math.sqrt(v) with some scale, so equal area per ring is preserved in the sunburst layout.
- found: Math.sqrt(2 * v) — the area-to-radius inverse with the factor of 2 that pairs with vOf's r^2/2.
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- note: The bare 2 is only meaningful against vOf's matching constant, and nothing in either name or a comment ties the pair together.

### `worstRatio` — nearly
- read at `f29daca07a24` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Takes screen-space w/h pairs for one row of patches and returns the worst (largest) aspect ratio: max(w/h, h/w) over the row via Math.max, with Infinity for an empty row or a degenerate zero-sized cell so the squarify loop rejects it.
- found: Exactly that, with the one detail that the seed is 1 rather than 0 (a ratio can never be below 1) and an empty list therefore returns 1, not Infinity; any non-positive w or h short-circuits to Infinity.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `rowPlacement` — as expected
- read at `c12261b3c923` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Squarified-treemap geometry in polar coordinates: sum the row's areas, convert the total into how much of the sector the row eats (radial thickness when radial, otherwise an angular span) and return it as consumed, then divide the other axis proportionally per item — side by side in angle for a band, stacked outward in radius for a wedge — producing a Slot each plus approximate screen dims (arc length at the mid radius as width, radial extent as height) so worstRatio can judge squareness.
- found: Exactly that, with the annulus-area nonlinearity factored out into rOf: the sector is measured in an area-linear coordinate v rather than in radius, so consumed is a plain total/extent division in both branches and rOf(v) converts to a radius only at the point of emitting a slot. Dims are da times the mid radius by the radial extent, as predicted.
- predicted: full · documented: full · derivable: no · legible: most · trap: no

### `tileFunctions` — surprising
- read at `83ae0c03a88b` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A squarified treemap in polar coordinates: sort functions by lines descending, greedily pack into radial rows between r0 and r1 split angularly across a0..a1, using worstRatio to close rows and rowPlacement to emit slots so each patch's area is proportional to lines; slices below a legibility minimum collapse into one overflow roll-up, returning Slot[].
- found: The squarify half is right — rows chosen by worstRatio/rowPlacement in an area-preserving v-space, with `radial` picked per row so the row always spans the SHORTER side. But the admission half is a whole design I did not predict: members are NOT sorted by size (file order is kept deliberately, trading packing quality for adjacency); who gets drawn is decided by each function's own proportional share against MIN_PATCH_AREA, then leftover capacity promotes tail functions that are either hot (heatOf > HOT) or within MAX_STRETCH of the floor, hot-first then longest-first; and areas come from a wants-then-scale pass (`area / wanted`) rather than a remainder budget, specifically so floors cannot starve proportional patches to zero. The roll-up is a synthetic aggregate node found by `rest !== undefined`, not by position.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc explains why functions tile inside their file's wedge but says nothing about the promotion/stretch admission rules, which are most of the body and where all the past bugs lived.

### `sliceFunctions` — surprising
- read at `103298d152b8` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Divides the angular span a0..a1 among a file's function nodes proportional to line counts, walking them in order with an angle cursor and emitting one Wedge each across the ring rather than stacking radially; probably colours via heatOf and floors degenerate slices so tiny functions stay clickable.
- found: The proportional walk with a minimum-angle floor is there, but the bulk is an overflow policy the prediction did not reach: it computes a CAPACITY from span × FLOOR_SHARE / minAngle, and if the file has more functions than that, ranks them by heat and folds everything past capacity-1 into a single aggregate() wedge, so the floor can never stop flooring. Also optional byHeat sorting and an `even` mode that weights every function 1 instead of by loc. It emits wedges only — no colour is assigned here.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The long doc argues entirely for why angle beats radius and says nothing about the capacity/aggregate overflow path, which is more than half the body.

### `labelArc` — nearly
- read at `7cbf1b9a927f` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: An SVG path `d` string for a textPath to run along, at radius r between a0/a1; computes the arc midpoint, flips sweep direction when the label would read upside-down in the lower half, and possibly returns empty string if the arc is too small for text at fontSize.
- found: Exactly that minus the empty-string case: normalises the midpoint into [0,2π) (commented as necessary because layout starts at -π/2), flags upsideDown when mid is in the left/lower half, then offsets the radius by a baseline-to-centre constant whose sign depends on direction (because WebKit ignores dominant-baseline:central on textPath), and emits an arc either forward (sweep 1) or reversed (sweep 0) with a large-arc flag.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment, but the inline comments explain the two non-obvious choices (angle normalisation, manual baseline offset) better than a docstring would have.

## web/src/lib/text.ts

### `elide` — as expected
- read at `199d5d451e32` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Returns s unchanged when within max; otherwise splits the budget unevenly — smaller head, larger tail — joined by an ellipsis so the filename and line at the end survive. A guard, two slice offsets from max, a template-literal return.
- found: Exactly that: early return if s.length <= max, tail = ceil((max-1)*0.65), head = max(1, max-1-tail), returns head slice + '…' + last `tail` chars. The 65/35 tail weighting and the max(1,…) floor on the head are the only specifics beyond the prediction.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `compactCount` — nearly
- read at `3d19f02e2df4` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Below 100,000 return n.toLocaleString() with separators; at or above 1,000,000 return (n/1e6).toFixed(1) + 'M'; otherwise a 'k' form; probably some trailing-.0 handling, in about five lines.
- found: Exactly the three branches. The k branch uses toFixed(0) — whole thousands, no decimal — while the M branch uses toFixed(1), so the digit budget stays roughly constant across bands.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

## web/src/lib/theme.ts

### `loadTheme` — as expected
- read at `a0cd551989f5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads a persisted theme preference from localStorage under a module-level key, validates it is one of 'light'/'dark'/'system', returns it; otherwise returns a default of 'system'. Expected a try/catch around the storage read.
- found: Exactly that: try { localStorage.getItem(KEY); if raw is 'light'|'dark'|'system' return raw } catch { comment only } return 'system'.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `saveTheme` — nearly
- read at `3513dcd2632b` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Writes the theme to localStorage under a module-level KEY inside a try/catch that swallows storage failures, then calls applyTheme(t) so the change takes effect immediately.
- found: Just the localStorage.setItem(KEY, t) in a try/catch whose empty body carries the reason ("the preference just won't survive a restart"). It does NOT apply the theme — persistence only; applying is applyTheme's job and the caller's to sequence.
- predicted: most · documented: none · derivable: no · legible: full · trap: no

### `prefersDark` — as expected
- read at `b277b2c40cd8` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A one-line helper returning window.matchMedia('(prefers-color-scheme: dark)').matches, possibly guarded against a missing matchMedia.
- found: Exactly that, unguarded — a single return of window.matchMedia('(prefers-color-scheme: dark)').matches.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `applyTheme` — as expected
- read at `13fa2a14f29b` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Resolves the Theme — with 'system' falling through to prefersDark() — and stamps the result on document.documentElement, as a class or data-theme attribute, possibly also setting style.colorScheme.
- found: Exactly that, minus the colorScheme: one line computing `dark` from t === 'system' ? prefersDark() : t === 'dark', one line calling classList.toggle('dark', dark) on documentElement.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

### `applyStoredTheme` — as expected
- read at `c2bf76ae3f89` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A three-line wrapper: read the persisted preference with loadTheme() and hand it to applyTheme(), which sets the class on documentElement, with the system fallback already handled inside those two — so the body is a single call, run at module load to re-assert what index.html's blocking script already did.
- found: Exactly one statement: applyTheme(loadTheme()).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `watchSystemTheme` — nearly
- read at `27a18420c8ba` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Returns a no-op teardown if t is not 'system'; otherwise takes the prefers-color-scheme:dark MediaQueryList, adds a change listener that re-applies the theme, and returns a closure removing that listener.
- found: Exactly that, with one extra step I did not mention: it calls applyTheme(t) unconditionally on entry, so the function also does the initial application rather than only subscribing.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The name and docs both say "watch", but the body also applies the theme up front — a side effect the name does not carry.

## web/src/lib/zoom.ts

### `under` — as expected
- read at `c4d3ff9b9a40` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Returns whether `child` is a descendant of `parent` by path string: special-case the empty root path (everything is under root), otherwise `child.startsWith(parent + "/")` so a separator boundary is required and `src` doesn't match `src-tauri`.
- found: Exactly that: `if (parent === '') return child !== ''` then `return child.startsWith(`${parent}/`)`. The empty-parent branch also excludes the root itself.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `direction` — as expected
- read at `255565b9af99` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Compares two node paths, returning three Direction values: toPath under fromPath is a descent ('in'), fromPath under toPath is an ascent ('out'), otherwise 'across'; delegating containment to the peer `under`, with the same-path case folded into one branch.
- found: Exactly that, with equal paths short-circuiting explicitly to 'across' before the two `under` tests.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs are attached to the Direction type, not to this function, but they explain exactly the choice this body makes, so they cover it well by accident rather than by placement.

### `geoOf` — as expected
- read at `759f88eaeaaf` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Walks the wedges, skips function wedges (the doc's whole point), and for each remaining one computes inner/outer radius from rInner + depth*band minus gapOf(kind) plus its angular start/end, storing it in a Map keyed by node id.
- found: Exactly that, in six lines: `if (w.node.kind === 'func') continue`, `r0 = rInner + (w.depth - 1) * band`, and sets `{a0, a1, r0, r1: r0 + band - gapOf(w.node.kind)}` by node id.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The doc comment is ten times the length of the body and is nearly all bug history — valuable, but nothing in it describes the radius formula itself.

### `lerp` — as expected
- read at `45b2910ff09a` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A one-line arrow returning a + (b - a) * t, unclamped, feeding lerpGeo/lerpView.
- found: const lerp = (a, b, t) => a + (b - a) * t — exactly that.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `lerpGeo` — as expected
- read at `0f1f4fe27429` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · warm reading · reading 9 of its run
- expected: Interpolates each field of the ring geometry between a and b at t using the sibling `lerp` — two radii and two angles — returning a fresh Geo, possibly with short-way-round handling for the angles.
- found: A four-field object literal lerping a0, a1, r0, r1 independently. No angle wrapping — plain linear interpolation on all four.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: Warm: I had already opened zoom.ts for `ancestors` at position 3, though I read only that function's ten lines.

### `ancestors` — nearly
- read at `848a8fdedee0` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Splits the id on '/' and returns each successively shorter prefix path — parent, grandparent, up to the top — nearest first, excluding the id itself. Pure string work, no tree lookup.
- found: Exactly that: loops slicing off the last '/' segment, pushing each prefix, then pushes '' as the root sentinel at the end.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The one thing I did not predict is the trailing '' for the root; the doc's second sentence about ids being paths is a genuine non-derivable fact about the tree's id scheme.

### `enterFrom` — as expected
- read at `f6d0a76bb77e` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Walk ancestors(id) outward, return the geo of the nearest ancestor present in the `was` map so the wedge grows from where its parent was; otherwise fall back to a collapsed geo derived from target — same angle, pinned to the inner radius of its own ring.
- found: Exactly that: loops ancestors(id), returns the first hit in `was`; otherwise returns a zero-width, zero-thickness geo at the angular midpoint of the target on its inner radius (a0=a1=mid, r0=r1=target.r0).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `exitTo` — nearly
- read at `294d7ff11dca` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Given a wedge's geometry and the drill direction, returns where it should animate to: for 'in', same angles pushed outward past rOuter; for 'out', collapsed inward toward rInner/the hub; for 'across', unchanged so it fades in place. A small switch returning a modified copy of from.
- found: Exactly that shape, with angles untouched in every branch and only the radii translated. The detail not predicted is that both moves are PARTIAL fractions rather than travel to a boundary: 'in' shifts both radii out by 0.55 of the ring's thickness, 'out' pulls them in by 0.75 of the wedge's own distance from rInner, so nothing actually reaches the rim or the hub — the fade covers the remainder. 'across' returns `from` by identity, not a copy.
- predicted: most · documented: full · derivable: no · legible: most · trap: no

### `ease` — nearly
- read at `bc53040f7296` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A symmetric cubic ease-in-out over t in [0,1]: t < 0.5 ? 4t^3 : 1 - (-2t+2)^3/2, in a single return.
- found: Exactly that cubic, with t first clamped to [0,1] via Math.min/Math.max before the branch.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Docs say why the curve is symmetric but not that the input is clamped; that is the only detail a prediction misses.

### `hubGeo` — as expected
- read at `2db0dc30a449` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Returns a Geo describing the centre disc: a full-circle angular span (0 to 2pi) with inner radius 0 and outer radius rInner minus a small inset constant matching the drawn hub circle, so a collapsing wedge lands exactly on it.
- found: Exactly that: { a0: 0, a1: Math.PI * 2, r0: 0, r1: rInner - 4 }.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: The 4 is a bare literal that must agree with the inset used where the hub circle is actually drawn; the doc says they must match but nothing links the two numbers.

### `extentOf` — as expected
- read at `07f59c070883` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Seed the bounds with the hub circle (±hubR both axes), then for each Geo take the four corners at inner/outer radius crossed with start/end angle via x = r sin a, y = -r cos a, plus each quarter-turn axis crossing inside the angular span evaluated at the outer radius; min/max everything into {x0,x1,y0,y1}.
- found: Exactly that, with a small `at(r, a)` closure doing the min/max, a skip for degenerate sectors (`r1 <= 0 || a1 <= a0`), and the quarter-turn walk started at `ceil(a0 / (π/2)) * (π/2)` so a span crossing twelve o'clock is covered.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `viewFor` — nearly
- read at `a985a34e5091` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: Pad the extent by margin on all sides plus chromeBottom extra at the bottom, take the larger padded dimension to force a square, and centre the extent in it — returning a View of centre plus one size, with the bottom padding shifting the centre upward so the legend does not cover content.
- found: Exactly that, returning {cx, cy, side}. The detail I did not state: margin and chromeBottom are FRACTIONS, not absolute units — both are multiplied by reach, half the extent's larger dimension, so the padding scales with how far you have zoomed in rather than being a fixed gutter.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: Nothing in the signature or docs says margin and chromeBottom are ratios of the extent rather than absolute units; a caller passing pixels would be silently wrong.

### `lerpView` — as expected
- read at `9bdc7a6a3f90` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Component-wise linear interpolation between two View states by t, returning a new View built from lerp() calls on each field (something like centre and scale/extent).
- found: Exactly that: lerp on cx, cy and side.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `viewBoxOf` — as expected
- read at `73db378301fe` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A one-expression arrow turning a View (centre plus a scale/half-extent) into an SVG viewBox string: x - r, y - r, 2r, 2r or equivalent.
- found: `${v.cx - v.side / 2} ${v.cy - v.side / 2} ${v.side} ${v.side}` — the View carries a full side length rather than a radius, so it halves rather than doubles.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
