# web — sanity assessment

211 of 234 functions read · 25 surprising · 13 stale

Each entry below is one **reading**. An agent was given a function's name,
signature, neighbouring function names and comments — never its body — and wrote
down what it expected to find. Then it opened the file. The gap between the two
is the finding.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## web/src/App.tsx

### `sameProjects` — as expected — TRAP
- read at `6fd29197698a` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Length check, then index-by-index field comparison of each ProjectSummary's displayed fields (key/name, repo, progress counts), returning false on any mismatch — so a poll returning an unchanged list doesn't trigger a re-render.
- found: Exactly that: length guard then a.every comparing twelve named fields (key, name, touched, repo, assessed, functions, files, stale, working, loading, read_done, read_total) with ===.
- predicted: full · documented: most · derivable: no · legible: full · trap: yes
- note: The docs handed over were spliced: the first two lines describe findById, not this function; also the hand-enumerated field list silently goes stale the moment a field is added to ProjectSummary and shown in the sidebar, which is exactly the failure the doc warns about.

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

### `App` — surprising — TRAP
- read at `4dc77dd6d8dd` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: The root component: holds all top-level state (scan result, selected node, drill stack, active project, error), polls the backend for projects and agent reports, wires keyboard shortcuts and menu events, and renders the sidebar, breadcrumb, sunburst, detail panel and any modals.
- found: All of that plus a great deal more: theme state synced to a Rust menu, MCP-client connection polling, batched streamed-score flushing, an entire history-replay mode (warm/scan/frame tree/scoped commits/transport/commit log), a code-view modal with pop-out, drill semantics that treat functions and synthesised overflow aggregates specially, and breadcrumb/owner trails walked via parentOf.
- predicted: some · documented: none · derivable: yes · legible: most · trap: yes
- note: The code-view backdrop puts onKeyDown={Escape} on a non-focusable, non-tabindexed div, so the comment's promise that "Escape and the backdrop both put it down" is likely only half true — the key never reaches it unless something inside is focused.

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

### `Empty` — as expected — STALE
- read at `04124f0a9c2c` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: The first-run gate screen: a centred card with two numbered Step rows — step one "connect an agent", ticking green off `connected` and offering a button that calls onConnect; step two a CopyPhrase holding the verbatim sentence to paste into the agent, probably dimmed until step one is done. No hand-open door and no dismissal.
- found: Essentially exactly that: a bordered card headed "Study your first project" (LINE Seed JP, negative tracking), Step 1 "Connect an agent" with done={connected} and swapped prose, a conditional accent button calling onConnect indented to the text column, a line pointing at the gear in the Agent panel, then Step 2 "Ask it to study a project" (always done={false}) with a CopyPhrase of "study this project in sanity". Step two is not gated or dimmed, and the card also exists to give the animated background a floor.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: Comment volume outweighs code roughly two to one, and most of it records rejected alternatives rather than what the code does.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

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

### the file itself — nearly
- read at `762905383664` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A small top-level React entry for a popped-out code window: fileByPath walks the scan tree to find a file node by path, CodeWindow loads that file's source and renders it with the selected function's extent highlighted, reacting to selection from the main window.
- found: Right about the shape and about fileByPath (recursive search for kind==='file' with matching path). CodeWindow takes repo + relPath from the URL, re-resolves the file by listing projects, finding the one whose repo matches, fetching its scan and locating the node — deliberately NOT accepting a serialised subtree. It renders error and loading states, its own Tauri drag-region titlebar with traffic-light padding, and delegates all rendering to CodeView with selected/reveal null and a no-op onSelect. It also re-applies the stored theme because a second window is a separate JS context. No highlighted selection at all — that was my miss.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The file was handed over with an empty `docs` header even though both declarations inside carry substantial doc comments — the file itself has no module-level header.

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

### the file itself — surprising
- read at `09e7db32db54` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A small React component file exporting one AgentMascot that renders the mascot bundle, picking a pose from props reflecting assessment state and sized by a prop; almost no logic, a lookup and a render.
- found: It is a lazy-loading boundary, not a renderer: the actual drawing lives in MascotFigure, which is React.lazy'd because the neo-mascots + three.js chunk is ~1.2MB and only needed while a scan runs. AgentMascot wraps it in Suspense with a fixed-size empty span fallback so the row does not reflow, and forwards size/events/active straight through.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: The file's whole reason to exist — a code-split boundary whose benefit evaporates if anything imports MascotFigure eagerly — is invisible from the name and the single exported symbol.

### `AgentMascot` — as expected
- read at `61eafacdfe15` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Lazily loads the heavy mascot bundle and, until it resolves, renders an empty size x size box to reserve the row's layout; once loaded renders the mascot driven by `events` and `active`. Probably a Suspense boundary with a fixed-size fallback.
- found: Exactly that, and nothing more: a Suspense whose fallback is a shrink-0 aria-hidden span of width/height `size`, wrapping a lazily-imported MascotFigure with the three props forwarded. The lazy() call itself is above the function.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/components/AgentSetup.tsx

### the file itself — nearly
- read at `72cacff1c4c5` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A settings/onboarding overlay explaining how to point an MCP client at this install: a list of known clients as ClientRows, each showing whether it is already configured with a button to add it, plus a copyable config snippet for clients not listed and a short explanation of the reading protocol.
- found: That, with more state than I allowed for. Detection and configuration are deliberately one list (the doc on AgentSetup argues the point): each row is fetched from `mcpClients()` and resolves to one of four presentations — not installed, not writable (honest label instead of a button that cannot work), connected, or STALE, meaning registered but pointing at a different sanity binary, which "looks configured, won't connect" and offers Repoint. The button is a toggle, so it disconnects as well as connects, with per-row busy state and an error line. Below that: prose that clients read config at startup (Claude Desktop needs a full quit), a caveat that only user-level config is visible so a repo `.mcp.json` connects invisibly, the instruction to say "study this project in sanity" with the fresh-subagent rationale, and the raw `mcpCommand()` JSON in a selectable pre with a copy button whose clipboard failure is deliberately silent because the block can be copied by hand.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no
- note: The file has no header — the docs field handed over was empty — yet the argument for its whole shape (detection and configuration must be one list) is written on the AgentSetup function inside it, so a reader looking at the file from outside sees nothing.

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

### `petals` — as expected
- read at `bdcec771d555` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Builds an SVG path `d` string by stepping theta over one revolution, computing r = A*|cos(K*theta)|^(1/P), converting to cartesian, and joining samples into an M/L polyline closed with Z.
- found: Exactly that: 240 steps over 0..2pi, r = A * |cos(K*th)|^(1/P), pushes 'M'/'L' with coords rounded to 2 decimals, joins with spaces and appends ' Z'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `seedHead` — as expected — STALE
- read at `9941badd8f72` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A phyllotaxis spiral of seed circles for a flower centre: golden-angle steps, radial distance growing as sqrt(i), each seed a small circle, returned as an array for Flower to render.
- found: Exactly that: 13 seeds, theta = n * GOLDEN, radial distance A * 0.115 * sqrt(n), constant seed radius A * 0.05, cx/cy from cos/sin, returned as an array.
- predicted: full · documented: none · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `Flower` — nearly
- read at `f42f709857ff` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A small presentational SVG component composing the file doc's two pieces: petals(...) for the rhodonea path and seedHead(...) for the phyllotaxis dots, rendered in a &lt;g&gt; scaled by `s`, petals as a filled path and the seed head as small circles at the centre.
- found: That shape, but the curve and dots are precomputed module constants (PETALS, SEEDS) rather than called per render, and there is a third element I did not predict: the SAME petal path drawn again inside a scale(0.45) group as a stroke-only inner rose, with a comment noting that a rose scaled about the origin is still the same rose so no second curve has to be kept in step.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `Leaf` — nearly — STALE
- read at `837dd46c66e8` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: A tiny presentational SVG component drawing the vesica piscis: two symmetric arc segments in one path (M .. A r r 0 0 1 .. A r r 0 0 1 Z) with the arc radius tied to the circle radius, wrapped in a scale(s) transform, filled/stroked with a theme colour, no state.
- found: That, plus a second path I did not predict: a straight midrib line across the leaf at 0.45 stroke width. The arc radius is R = L * 1.16, which is the true vesica ratio (2/sqrt(3) = 1.1547) rounded, so the docstring's geometric claim does hold. Colour is `currentColor` throughout with fillOpacity 0.18.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: 1.16 is a rounded 2/sqrt(3) with nothing in the code saying so, so the one constant that makes it a true vesica reads as a magic number.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `Tile` — as expected — STALE
- read at `27138f34720a` · commit `23b1218` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A no-argument SVG sub-component returning one repeating unit of the wallpaper pattern — a group placing a few Flower and Leaf elements at fixed coordinates and rotations inside a square cell, arranged so the cell tiles seamlessly.
- found: Returns a single `<g>` built from three precomputed coordinate tables named for wallpaper-group symmetry orders: SIXFOLD sites get a large `Flower` (s=1.45), THREEFOLD sites a small one rotated 30 degrees (s=0.72), and TWOFOLD sites a `Leaf` at a per-site angle (s=0.62). Coordinates are formatted to two decimals in the transform strings.</found> <parameter name="predicted">full
- predicted: full · documented: none · derivable: yes · legible: most · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `Bloom` — surprising
- read at `c1095e1ce844` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A top-level React component that renders the scattered flower field into the empty pane: an SVG sized to its container, taking className, generating a deterministic set of positions/rotations/scales and mapping them onto Tile/Flower/Leaf children.
- found: An SVG filling 100%x100%, aria-hidden, preserveAspectRatio slice, whose defs hold a single userSpaceOnUse &lt;pattern id="bloom"&gt; tiling module-level OFFSETS x OFFSETS copies of &lt;Tile /&gt;; the body is one rect filled with url(#bloom). Scatter comes from the tile's own motif rotations, not from this function — and a long comment records that patternTransform rotate(-6) was removed for making the lattice read crooked rather than irregular.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: No doc on the function itself; the file_doc covers the rose/phyllotaxis maths but says nothing about the tiling strategy this function actually implements.

## web/src/components/CodeView.tsx

### the file itself — nearly
- read at `66673a4454f9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The source-viewer panel: tokenize does regex syntax highlighting, ownerByLine maps line numbers to owning functions, rampStops/rampAt define and sample the cold-to-hot ramp, Minimap draws the file as a clickable heat strip, and CodeView composes them — rendering the file, highlighting the selected function's extent and scrolling it into view.
- found: All of that, and the shape was right down to why: the tokenizer is deliberately small and stateless (documented as mis-colouring multi-line strings, acceptable for scenery), rampStops exists specifically because heatColor returns color-mix() which canvas fillStyle cannot parse, so the five --heat-N custom properties are read as hex and interpolated in JS. Minimap fits the WHOLE file (never scrolls), draws one bar per line from its indent so the indentation profile reads, fades comments, overlays the viewport box, and drag-seeks centred on the pointer. CodeView fetches source via readSource, renders a table with a full-strength heat gutter plus a fixed-16% wash behind the code, labels unmeasured chunks in words, and carries pop-out/close buttons plus an insetTop the minimap uses to clear them. Extra beyond my prediction: the scroll-to-reveal effect deliberately depends on two primitives (a nonce and a readiness flag) with the node read through a ref, because depending on the file object made the poll-rebuilt tree snap the view back.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The tokenizer's header says "the six languages the scanner parses" while parse.rs now ships dozens of grammars, so the comment has been overtaken; the keyword list is Rust/JS/Python/Go only.

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

### the file itself — nearly
- read at `7801f0beaf20` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: The colour-key UI for the sunburst: a Legend that renders either categorical swatches or a heat ramp depending on the active colour mode, a ModeSwitcher segmented control listing the lenses from MODE_LABEL, and an exported ColourLegend wrapper that boxes the legend and adds counts (e.g. unread/pending). No file header, which is itself the finding.
- found: Exactly that shape. Legend branches three ways — categorical slots with an "Other" rollup past SLOTS, a single square swatch for the boolean `traps` mode, and otherwise a 24-step gradient built from heatColor on a per-mode Ramp with named ends. ModeSwitcher is a tablist of pills with per-mode tooltips carrying ⌘1..n, greyed when history pins the mode. ColourLegend adds a stale-hatch and unread-grey row, gated on paintsFromReadings and on the counts being non-zero.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The file has no header doc, and its inline comments still say "five words"/"four of the five lenses" while MODE_LABEL now drives seven (App.tsx binds ⌘1..7) — the prose has fallen behind the mode list.

### `Legend` — surprising
- read at `fd2f3fbcac71` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Branches on `mode`: categorical modes render one labelled swatch per category using the sunburst's palette; continuous modes render a gradient bar with two end labels (cold/hot, old/new). Never a gradient under a categorical encoding.
- found: Right shape, three branches not two, and the first switches on `categories.length > 0` rather than on mode. Categorical: only the first SLOTS categories get named dots via `slotColor(i)`, the remainder collapse into one neutral "Other (n)" chip because they are genuinely indistinguishable on screen. `traps` gets its own branch — a single square swatch, deliberately not a bar, since a boolean has no continuum. Only then the ramp: a lookup table of end-word pairs for surprise/legible/docs/churn/age, a per-mode `Ramp` selection so the key walks the same hue the wedges do, and 24 flex spans of `heatColor(i/23, ramp)`.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: The categorical branch is chosen by `categories.length > 0`, not by the mode, so a categorical mode that happens to yield zero categories falls through to whichever gradient the ramp chain defaults to ('heat') with blank end labels.

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

### the file itself — nearly
- read at `368f71e8ef43` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A React component file for History mode's commit list panel: `stamp` a small date formatter, `CommitLog` rendering the timeline's commits as a scrollable list — short sha, date, author, subject per row — highlighting the frame the playhead is on, auto-scrolling it into view as replay advances, and seeking on click. Receiving an already-scoped commit list and speaking positions within it.
- found: That, plus three things I did not cover. Rows are a memoised `Row` subcomponent with a fixed ROW_H so the playhead is positioned by arithmetic rather than DOM queries. Everything after the playhead is dimmed by a single absolutely-positioned scrim sized to exactly the remaining rows, not per-row styling. And the file carries a header block duplicating the readings pane's header pixel-for-pixel — name, repo path, lines/functions/commits counts, with the scoped subset and the truncated-window count said out loud — plus an explicit empty state for a scope no commit in the window touched. Scroll-following is a layout effect that centres while playing, minimally reveals while paused, and stands aside for clicks via a ref flag.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: There is no file header, and the CommitLog docstring is partly stale: it says the moving parts are "a cursor on the current commit, and a scrim", but the cursor overlay was replaced by a background on the row itself — Row's own comment says the overlay was tried twice and abandoned.

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

### the file itself — nearly
- read at `f854d81892ed` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A single-component file exporting Crumbs, the breadcrumb trail above the sunburst: takes the drill-down path (root to file), renders each ancestor as a clickable segment separated by a slash/chevron with the last inert, clicking pops the view back to that node; ~65 lines of Tailwind JSX, possibly truncating long paths.
- found: Right shape and responsibility, with two things I got wrong or missed. The last crumb is NOT inert — it is still a button, deliberately, because clicking where you already are should re-centre the view (it only differs by aria-current and weight). And a collapsed single-child directory chain is one node whose name still holds slashes, so each crumb splits its own name and renders those inner slashes dimmed to opacity-40 so they lose against the real separators. There is also a separate disabled-able "↑ Up" button held out of the truncating region by min-w-0 on the list, so the way out is never what gets cut.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Crumbs` — nearly
- read at `899166c24f97` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A breadcrumb bar rendering trail root-first as buttons, every level clickable via onGo(index) — the last either clickable or emphasised as current — separated by a dimmed slash, with a collapsed chain's inner slashes rendered dimmer still than the separators, and an `up` control that appears only when onUp is given and is styled as a button like the rest.
- found: That, with two details I got wrong or missed: the current level IS still a real button (it re-centres the view) and merely carries aria-current plus a bolder style, and the Up button always renders but is `disabled={!onUp}` rather than being omitted. Also does layout work I did not mention — min-w-0/overflow-hidden so the trail truncates rather than the Up button, and `last:shrink` so only the current crumb gives way.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

## web/src/components/Detail.tsx

### `Markdown` — nearly
- read at `01041ca9fd9e` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A React component rendering a restricted markdown subset: split on backtick code spans first (so a * inside an identifier is safe), rendering those as <code>; remaining segments get **bold** then *italic* by regex split; blank lines become separate <p> blocks; keyed children.
- found: Exactly that structure — an inner `inline(t, key)` splits on /(`[^`]+`)/ for <code>, then /(\*\*...\*\*|\*...\*)/ for <strong>/<em>/<span>; the body splits on /\n{2,}/, drops blank paragraphs, and renders <p> with mt-1.5 after the first. One detail I did not cover: the code chip's background is color-mix on currentColor rather than a fixed token, deliberately so it works on the pink trap box.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

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

### `Detail` — surprising
- read at `1e0c8da125b9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: The right-hand detail panel React component. With no node selected it renders a summary of focus/the repo (title, commit count, model). With a node it renders breadcrumbs from owners (falling back to the plain path), the node's name/signature, lines and score, a temperature/rank readout using ranks and mode, age/churn from ageSpan and commits, the agent reading with grades and provenance, plus a Contents child list wired to onSelect/onDrill/onShowIn.
- found: Broadly that, with a three-way dispatch I did not predict: no node and no focus renders a decorative `Bloom` idle state rather than nothing; no node with focus, AND any non-leaf node, both delegate to the SAME `Summary` component (a directory is a subtree exactly as the root is) with kind/path/footer/about slots. Only a leaf function gets the bespoke layout: clickable owner-breadcrumbs, a trap badge beside the name, `Dials`, then a scroller holding stale/warm caveats, Expected/Found markdown with copy buttons, a note box whose tab turns pink when `trapped`, `hotspots` token evidence, `Contents`, and a pinned provenance footer. No signature is shown — the panel deliberately shows what was measured about a thing, not the thing. `trapped` re-gates trap colouring on `!agentStale`.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: A 479-line component with no doc comment above it, though the body is the most heavily commented code in the repo; also line 500 gates the header trap badge on `node.agent?.trap && !node.agentStale` inline while the identical `trapped` const sits three lines above unused there.

## web/src/components/Dials.tsx

### `fileDocShare` — as expected
- read at `4ad16b742bf6` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Walks the subtree counting file nodes that carry a reading, returning the fraction whose own header doc grade is poor (none/some) — an unweighted count of files rather than lines — and null when nothing under it has been read.
- found: Exactly that: recursive walk, `graded(n, 'documented')` gates the denominator, `some`/`none` count as bare, `null` when read === 0.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `badShare` — as expected
- read at `53a6f96217bd` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Recursively walks the subtree, summing lines of functions with a usable grade for `which` and the subset whose grade is on the bad side (some/none), returning bad/graded or null when nothing was graded so the dial reads no-data rather than zero.
- found: Exactly that: closure `walk` accumulates n.loc into graded_ when graded(n, which) returns a grade, into bad when that grade is 'some' or 'none', recurses over children unconditionally, returns null if graded_ is 0 else bad/graded_.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc says it matches opaqueShare/undocShare in colorMode but the some/none cut is duplicated here rather than shared, so the two can drift silently.

## web/src/components/FileZoom.tsx

### the file itself — surprising
- read at `3fb3d24d93f0` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: The drill-in view for a single file: fanOf computes the layout — one segment per function, width proportional to line count, laid out along a horizontal axis (the 'fan' label.ts contrasts with the ring) — and FileZoom renders those as SVG, coloured by temperature, stale ones hatched, labels via fitLabel, click/hover wiring to select a function.
- found: Right about the responsibility and most of the parts (fan layout, per-function colour, stale hatch, fitLabel labels, select/drill/hover), but wrong about the shape and about what the file is mostly ABOUT. The fan is POLAR, not horizontal — an annular sector opened out of the file's wedge — and the file's real subject is the animated transition: cells are tiled once against the destination fan (`tileFunctions`) and carried back to the live interpolated sector by an affine `place`, so no frame re-tessellates. I also missed the roll-up dot texture for aggregated remainders and the per-patch ink choice.
- predicted: some · documented: most · derivable: no · legible: full · trap: no
- note: The file header is placed above `FUNC_MAX` rather than above `FileZoom`, so the module-level essay is attached to a font-size constant and the constant's own doc comment sits second.

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

### the file itself — nearly
- read at `9826f2e9470c` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: The history replay transport: play/pause, a scrub slider over the (possibly directory-scoped) commit list, a commit caption, and duration buttons rather than rate buttons. `pace` turns a chosen duration plus commit count into a frame interval and per-tick step, capping at a max FPS and skipping commits rather than falling behind.
- found: Right about the responsibility, the duration-not-rate control, the MAX_FPS skip and the scoped frames list. Two misses: `pace` is only a label formatter (seconds to "3s"/"1m"); the skipping logic lives inline in a requestAnimationFrame clock that accumulates a fractional cursor in a ref. And there is deliberately NO commit caption — the header explains it was removed because the log beside it already captions itself. Also unpredicted: full keyboard transport (space, both arrow axes, shift stride of 10, guards against the range input's native arrow handling), and a rewind-on-play-from-end in `toggle`.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: Handed over with an empty file `docs` although the constants and the component carry unusually rich reasoning comments; the docs I was given said nothing, so `documented` is none by the rule.

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

### the file itself — surprising
- read at `5f3896c40a27` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A component file drawing the monster-dept mascot from the committed mascot bundle. loadOrMint reads a persisted mascot identity from localStorage and mints a random one on first run so a machine keeps the same character; pick chooses from a parts list; moodFor maps app state — assessment progress or how hot the repo reads — onto an expression; MascotFigure composes them and renders at a given size, degrading gracefully since the bundle is a placeholder.
- found: loadOrMint is exactly as predicted. The rest is a live agent-activity indicator, not a decoration: moodFor maps the NAME OF THE MCP CALL an agent just made (via a first-match-wins RegExp table over next:done, report:hot, report:stale, report:cold, open, next, status, error) to a set of animations, pick randomises within the set so a long run is not a looping GIF, and MascotFigure replays the backlog of AgentCall events since a monotonic `seq` watermark, capped at 4 and spaced 520ms, plus a sleep/wake effect driven by an `active` prop. Two design rules are stated in comments: loudness follows rarity (status is quietest, done and a surprising reading loudest) and the mascot may not claim more than the call did (an error reads as confusion, never celebration). The module is deliberately isolated so the mascot bundle lands in a lazy chunk.
- predicted: some · documented: none · derivable: no · legible: full · trap: no
- note: The file has no header at all, so nothing outside says the mascot is an agent-activity instrument keyed to MCP call names — from the name and exports it reads as ornament, and the two rules governing it are buried mid-file on a const.

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

### the file itself — as expected — TRAP
- read at `dc471b0c1afa` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A single-component file: a shared full-bleed dimmed backdrop that centres modal-ish UI, taking children and a click-to-dismiss handler.
- found: Exactly that, in nine lines: fixed inset-0 z-50 flex-centred div with a 50% black background and onClick={onClose}, rendering children. Its comment shifts one obligation outward — the panel inside must stop propagation itself or a click inside dismisses.
- predicted: full · documented: full · derivable: no · legible: full · trap: yes
- note: The stop-propagation requirement is enforced only by a comment, so a new caller that forgets it gets a modal that closes when you click inside it.

### `Overlay` — as expected — TRAP
- read at `9b14ec9655fd` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A fixed full-screen div with semi-transparent black background and flex centering, onClick={onClose}, wrapping children — possibly with an inner stopPropagation wrapper, though the doc hints that is the caller's job.
- found: Exactly that, with no inner wrapper: fixed inset-0 z-50, flex centre, p-6, rgba(0,0,0,0.5), onClick={onClose}, children rendered directly. Stopping propagation is left entirely to the panel passed in.
- predicted: full · documented: full · derivable: no · legible: full · trap: yes
- note: The contract that every child must call stopPropagation is enforced nowhere — a new caller that forgets it gets a panel that closes when you click inside it, and nothing here fails.

## web/src/components/RollupDots.tsx

### the file itself — nearly
- read at `8d0f27c10624` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A small React/SVG component marking rollup wedges — the 'everything too small to draw separately' arc — with a dot texture instead of a label. dotsId a helper making a unique or deterministic SVG pattern id so the defs and the fill='url(#…)' reference match without colliding, and RollupDots rendering the pattern definition, probably drawing nothing visible on its own.
- found: That, and the file is far more considered than the guess: dotsId escapes every non-alphanumeric to '-charCode-' specifically because the obvious replace is not injective and two paths would then share one rotated grid; a measured constant ROLLUP_TEXTURE_PX = 10 lives here (two clean populations either side of ten) so both the ring and the unrolled file view apply the same legibility floor; and RollupDots emits a per-rollup <defs><pattern> that is both ROTATED to the wedge's mid-angle and TRANSLATED so a dot lands exactly on the patch centre — T = C − R(θ)·(HALF,HALF) — because patternUnits='userSpaceOnUse' anchors the lattice to the chart hub otherwise. Dots rather than stripes because the stale hatch already owns 45° stripes on the same ring, painted in --background so the texture reads in the tiling's own language for 'these are separate'.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: The long doc block that reads as the component's own header (lines 28-47, explaining why the texture exists) is separated from `RollupDots` by an unrelated `const HALF` and its comment, so the block attaches to HALF instead — and my handout carried no file docs at all despite this being one of the best-documented files in the repo.

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
- read at `86a116c821a9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A sidebar rendering projects as ProjectItem rows (highlighting active, calling onSelect), an agent-activity section with progress, and a connection state area with a Connect action when not connected.
- found: That, in detail: a header, an empty-state line, the mapped ProjectItem list, then a permanently-present agent panel with a mascot, a three-way label (not connected / working / sleeping), a gear button calling onConnect, and one progress bar per project that is `working && readable(p) > 0` — the per-project bars, rather than a single app-wide one, being the part I did not anticipate. Roughly two-thirds of the 195 lines are design-rationale comments.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: No doc comment on the component itself, yet the inline commentary is unusually thorough — the docs field was empty only because the prose sits inside the body.

### `ProjectItem` — nearly
- read at `78f84f93e3e4` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: A React row rendering one project as a clickable ~28px rounded strip: truncated name left, a count (assessed/total) right-aligned, active/hover styling from the `active` prop, onClick on click.
- found: That, plus three things I did not cover: a loading branch that shows a scan percentage or 'reading…' instead of a 0/0 count, a `done` state (assessed >= readable) that recolours the count to --agent-mark, and a title tooltip carrying repo, assessed/readable and stale count.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/src/components/StaleHatch.tsx

### the file itself — as expected
- read at `c7b7b8e9ed73` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A tiny presentational module exporting one component StaleHatch that emits an SVG defs block with a diagonal-stripe pattern id="stale-hatch", rendered once in the sunburst SVG so expired-reading wedges can fill url(#stale-hatch); theme-variable colours, no props.
- found: Exactly that: a 6x6 userSpaceOnUse pattern rotated 45deg with a single --foreground line at 0.45 opacity. The file header argues three things the code does not state — texture rather than a second hue because the map has one colour encoding, why a per-wedge mark is acceptable here (stale is rare by construction), and why it is a component rather than a per-geometry defs block (duplicate document ids would make url(#stale-hatch) resolve by mount order).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `StaleHatch` — nearly
- read at `bbc24a833314` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A hidden/zero-size svg holding a defs with one pattern id="stale-hatch": 45-degree diagonal lines, patternUnits userSpaceOnUse, a small tile with translucent neutral strokes so it overlays any wedge colour; mounted once so the id stays unique.
- found: Exactly the pattern I described — 6x6 userSpaceOnUse tile, patternTransform rotate(45), one vertical line stroked in var(--foreground) at 1.6 width and 0.45 opacity, with an empty rect for the tile. Difference from my guess: it returns a bare <defs> fragment with no <svg> wrapper, so it is meant to be dropped inside an existing SVG rather than mounted standalone at the app root.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The doc argues the single-instance rule at length but the body is a bare <defs> with no svg wrapper, so honouring that rule is entirely on the caller and nothing in the component enforces it.

## web/src/components/Summary.tsx

### `ListWindow` — nearly — TRAP
- read at `b01f264c6a80` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A windowed list: scroll-container ref, scrollTop state updated on scroll, first/last visible index from a fixed row height plus overscan, a full-height spacer so the scrollbar is correct, and only the visible slice mapped to rows showing a paint(n) swatch, the name, and rowNote(n, mode), with click handlers calling onSelect and goTo.
- found: That, with three details I did not cover: view height is tracked too and refreshed by a ResizeObserver as well as the scroll listener; a second effect resets scrollTop to 0 whenever `rows` changes so switching lists does not open mid-list; and the two callbacks are split by gesture — single click is onSelect, double click is goTo. Spacers are top and bottom rather than one total-height element, and the swatch falls back to heatColor(temperature(score)) when no paint is given.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The scroll-reset effect depends on the `rows` ARRAY IDENTITY, so any caller that builds that array inline (filter/sort per render) resets scrollTop to 0 on every render and the list cannot be scrolled at all — the same identity hazard CLAUDE.md records for `activeProject`.

### `Spread` — nearly
- read at `02498c946b1c` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Builds a segment list — four grades cold→hot plus stale and unread in the structural neutral — each with count, percentage width and a colour from the wedge ramp. Renders a horizontal stacked bar of clickable segments (zero-count dropped) where clicking calls onPick and toggles to null if already picked, plus a key below with swatch, label and count, picked entry emphasised.
- found: The segment construction, the neutral fills for expired/unread, the >0 filter and the percentage widths are all as predicted, plus an early `return null` when the total is zero. But the interaction sits somewhere I did not put it: the bar itself is inert divs carrying only `title` tooltips, and the KEY is the control — each grade row is a button with aria-pressed that toggles onPick(on ? null : grade), while `expired` and `unread` render as plain divs, deliberately inert because they are the absence of a reading rather than a reading that came back some way.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The doc comment is thorough about the encoding but silent about the half of the body that matters most to a user — that the key is the filter control and that two of its rows are intentionally dead; that argument only exists in an inline comment.

### `Buckets` — nearly
- read at `1088b6d3dd29` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A stacked bar plus legend mirroring Spread: sum bucket lines, return null on zero total, render one segment per bucket sized by share of lines, then a key of clickable rows (swatch, label, count) where clicking the picked key clears to null and the picked row is highlighted.
- found: Exactly that. Extra detail I did not predict: the key list is scrollable and capped at max-h-[33vh] with overscroll containment, with a long inline comment explaining that a forty-author repo (flox) made the key taller than the pane. Row shows function count only; lines appear in the segment's title tooltip.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `Summary` — surprising — STALE
- read at `3c6f86ff4cde` · commit `9fe6ccf` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A component walking the subtree to render the empty-selection pane: totals (files, functions, lines, commits), read/unread/stale counts, a spread or bucket histogram, and a top-N hottest list whose rows select and drill; branching on mode so Churn/Blame show their own framing; plus a 'connect an agent' call-to-action, the gesture 'ants', and a no-history warning when commits === 0.
- found: Header (title, elided repo path, lines/functions/commits/excluded), then a mode-dependent key — Spread with grade tabs under Surprise, Buckets under any other lens — then a single growing windowed list (ListWindow) of whichever grade or bucket is picked, with unchosen state falling back to the first non-empty grade / first bucket and pickedBucket reset on mode change. There is no CTA, no ants, and no commits===0 warning. The part I missed entirely is the bottom section: a scrollable, attributed Notes list of reader notes (trap-only under the traps lens), each row a heat swatch, function name, optional TRAP chip and the note text, click to select and double-click to go to.
- predicted: some · documented: some · derivable: no · legible: most · trap: no
- note: The doc comment promises "the ants stay, underneath" and "what to do next", but the body has no ants and its inline comments say Next Steps was replaced by the Notes list — the docs describe a version of this panel that no longer exists.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## web/src/components/Sunburst.tsx

### the file itself — surprising
- read at `03e55ee39942` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: The main visualization component: a partition/arc layout over the folded tree, arcs sized by LOC and coloured by temperature, hover highlight, click-to-drill with breadcrumbs, a #stale-hatch pattern, labels hidden when arcs are small, and heatShare mapping a score onto a colour ramp. Likely SVG with memoised layout and history-frame support.
- found: All of that plus a great deal more: it owns the whole ring renderer and the level-to-level MOTION. It carries ~30 tuned geometry constants each with a paragraph of measured rationale (rim widths, patch area floors in real pixels via a quantised unitsPerPx, label bands); detects level changes during render rather than in an effect; animates leaving wedges, a "coring" directory becoming the hub, and a closing file retracting via FileZoom; drives a rAF loop keyed on a run counter with prefers-reduced-motion honoured; writes the viewBox straight to the element to avoid a second render per frame; skips function tiling entirely while moving; adds option-click directory folding with an "unfold all" chip that also counts wedges too thin to draw. heatShare turned out to be a per-kind damping factor applied only under the surprise mode, not a ramp lookup. No history-frame code lives here.
- predicted: some · documented: none · derivable: no · legible: not judged · trap: no
- note: A 1,400-line component with no file header at all, while nearly every constant inside it carries a three-paragraph essay — the one document that would orient a newcomer is the one that is missing.

### `heatShare` — as expected
- read at `cbcc1020c953` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A tiny lookup returning the damping factor for a node's colour intensity: under Surprise mode a reduced value for container kinds (dir, maybe file), 1 for leaves and for every other colour mode.
- found: Exactly that, three lines: `if (mode === 'surprise') return HEAT_BY_KIND[kind] ?? 1; return 1`, deferring the per-kind damping to a module constant.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The doc opens mid-sentence ("...but only under Surprise") — it continues a comment on the constant above and does not stand alone at this function.

### `Sunburst` — surprising — TRAP
- read at `d178fea0fea9` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: The main sunburst renderer: compute an arc layout from `root` memoised on root identity, render SVG paths coloured per `mode` with `ranks`/`ageSpan` feeding the alternative lenses, a `#stale-hatch` overlay for expired readings, labels on wedges wide enough, hover/tooltip state, click to onSelect, double-click to onDrill, background click to onClear, and a hub offering go-up only when onUp is passed.
- found: All of that is there, but it is a minority of the body. The bulk is a hand-rolled level-change choreography: a level change is detected DURING render (prevRoot vs root), geometry starts from `live` (where every wedge is on screen right now, rewritten every frame so an interrupted transition does not snap back), a `coring` ref flies the opened directory into the hub, `leaving` animates the departing level outward, `fileFrom`/`fileLeaving` hand an opened/closed file its source sector so `FileZoom` unrolls a treemap fan instead of a ring, and a rAF loop keyed on a `run` counter (never on `t`) drives easing with a reduced-motion bail. Alongside: a ResizeObserver-measured pane feeding a `unitsPerPx` quantiser that converts every pixel threshold (min arc, min patch AREA — squared, deliberately) into user units; a viewBox fitted to the drawn extent and written straight to the element in a layout effect to avoid a second React render per frame; option-click directory folding with a `collapsed` set that survives drilling; function patches suppressed entirely while moving and faded in by CSS; a `selCoarse` dashed fallback outline on the deepest drawn ancestor when the selection itself is not drawn; RollupDots texture gated on a measured pixel threshold; rim labels for files inset within their own slice; and a corner caveat box counting folded dirs and wedges too thin to draw, with an "unfold all" button.
- predicted: some · documented: none · derivable: yes · legible: full · trap: yes
- note: 1,146 lines in one component and the only docs handed to a reader are two comments on props; the `viewTo` useMemo reads the mutable ref `fileFrom.current` while listing only `[target, root.kind, root.id, paneAspect, fileIds]`, so it is correct solely because the level-change block that writes that ref runs earlier in the same render — an ordering nothing enforces if either moves.

## web/src/components/WedgeLabel.tsx

### the file itself — nearly
- read at `80d8479138b2` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A one-component file exporting WedgeLabel, an SVG label for a sunburst wedge: decides whether the wedge can hold text, picks arc-textPath vs radial placement, flips so text never reads backwards, truncates/drops names that don't fit, colours with the wedge ink.
- found: One component, two render paths driven by an already-decided `Placement`: arc labels emit a `<defs>` path from `labelArc` and hang a centred `<textPath>` on it; radial labels use `rotate(deg) translate(0,-r) rotate(±90)`, flipping in the left half so text always reads left-to-right. Fitting, truncation and placement are explicitly NOT here — that is `fitLabel`. Typography (family, weight, tracking, opacity) is imported live from `labelStyle`, and the comments record three rejected label separations (halo, plate, shadow) that were built, compared on real repos and removed.
- predicted: most · documented: none · derivable: no · legible: full · trap: no
- note: The doc comment on the `opacity` prop (lines 28-32) describes a `weight` prop that no longer exists — "WHICH kind of label this is, not how heavy it should be" says nothing about opacity, and the file itself has no header, only a component docstring.

### `WedgeLabel` — nearly
- read at `8ce325b7d515` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: Placement is a union of arc and straight runs. Arc: emit defs with a path baseline from radius/angles plus a text/textPath on it. Straight: a plain text at x/y with an anchor. Both pull face/weight/tracking and a halo or outline for separation from labelStyle read live, applying fill and opacity.
- found: Right on the two branches: at.axis === 'arc' emits defs + labelArc path + textPath at startOffset 50%; otherwise a radial label. Two things I got wrong. There is NO separation treatment at all — halo, plate and shadow were each built, compared on real repos, and all three lost to plain type, so `ink` is only family and tracking. And the radial case is not an x/y text but a transform chain rotate(deg) translate(0,-r) rotate(±90), flipped inward in the left half so labels never read right-to-left.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The `opacity` prop's doc comment describes a prop that no longer exists — it says "WHICH kind of label this is, not how heavy it should be" and argues about weight, which is about a removed `kind`/weight prop, not about opacity; and the header doc still credits `labelStyle` for face and weight, which the body reads from module constants instead.

## web/src/components/WedgeTip.tsx

### the file itself — surprising
- read at `3d34c1f8ccbb` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A hover tooltip for a sunburst wedge: renders the node's path/name and line count, plus mode-dependent detail (temperature, churn/age figures, whether a reading exists and whether it is stale). `countFiles` walks a container's subtree so directories can report "N files", so the component branches between directory and function nodes. Positioning handled by the caller. No file header.
- found: Right responsibility, and it owns more than I gave it. It is the geometry-independent hover card shared by sunburst and treemap: it takes a node, a pointer position and the pane box, and does its OWN edge flipping via an estimated card height that tracks the content. It computes the wedge's colour with `colorFor` and shows the reading as a SWATCH plus word — never a number — hatched in CSS matching `#stale-hatch` when the reading expired, with 'stale' distinguished from 'not measured yet'. Two title layouts (function: name first then path:line; dir/file: elided leading path with the own segment bold), driven by hand-measured character budgets FITS_SMALL/FITS_LARGE. Mode-specific extras rows for surprise/churn/age only. A size cell that never shrinks, carrying lines, `countFiles`, and roll-up `rest` functions. Finally fold/drill affordance lines for directories, suppressed when `folded` is undefined because the geometry has no such gesture.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The task handed me an empty `docs` for the file — there is no file header; the equivalent prose sits on the `WedgeTip` component's own JSDoc, which is where a reader would actually find it.

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

### the file itself — surprising
- read at `43bbe6381ea5` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 6 of its run
- expected: A small presentational component file exporting one Wordmark — the app name as styled text, likely 'sanity' with a differently-weighted or dimmed suffix per the monster-dept branding, Tailwind classes for both grounds, select-none, sitting in the custom titlebar near the traffic lights. No state, minimal props.
- found: Right responsibility, wrong medium: it is not text at all but an inlined SVG of the brand wordmark — six <path> elements in a 329x125 viewBox, fill="currentColor", role="img" with aria-label, one optional `height` prop defaulting to 18. The file is 31 lines only because the paths are enormous; the actual logic is a single return. Its header is a design argument: inlined rather than <img> or CSS mask precisely so currentColor covers ink and white variants without shipping two files, the shape matches tally's so blocks transplant, and the default height of 18 vs tally's 14 is an OPTICAL correction because a light geometric lowercase reads smaller than heavy title-case at matched extent.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: The header explains the two things nobody could recover from the code — why currentColor rather than an asset, and why the default height is 18 and not tally's 14 — which is exactly the kind of doc the code could never have written for itself.

### `Wordmark` — as expected
- read at `a8bc0df9a246` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: An inline SVG of the "sanity" wordmark: a fixed brand viewBox, height from the prop with width derived from the ratio, fill="currentColor" so it inherits ink/white, role/aria-label for accessibility, and path elements holding the letterforms. No state, no other props.
- found: Exactly that: viewBox "0 0 329 125", height from the prop with width left implicit, role="img" aria-label="Sanity", fill="currentColor", xmlns, and six letterform paths (one per glyph, in reverse order y-t-i-n-a-s).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- note: The docs' claim about the default height being an optical correction against tally's 14 is the kind of thing no reading of the body could recover — worth keeping.

## web/src/components/shell/SideBarHeader.tsx

### the file itself — surprising
- read at `cef9ad3d6d95` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: A tiny single-export presentational component for the top of the sidebar: the app name or logo mark, maybe a subtitle, and one or two chrome affordances such as an open-project or collapse button, using the shell's colour tokens. One JSX block, few or no props, no state.
- found: It renders only the Wordmark, but it is window chrome rather than decoration: the div is a Tauri drag region matched to --titlebar-h so it lines up with the TopRow, its left padding reserves space for macOS overlay traffic lights (minus 3px, deliberately), and it subscribes to onFullscreenChange so that reserve collapses in fullscreen where the traffic lights are hidden. The wordmark itself is pointer-events-none so it does not punch a dead spot in the drag region.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: No file header was handed over, though the component's own docstring inside the file explains the traffic-light reserve well; the platform-specific chrome work is invisible from the filename.

### `SideBarHeader` — as expected
- read at `048333edc686` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A fixed-height sidebar header strip matching TopRow, holding the wordmark, with left padding conditional on Tauri-on-macOS (~92px traffic-light reserve, collapsed in fullscreen via an onFullscreenChange useState/useEffect pair), and probably a titlebar drag region.
- found: Exactly that. Height from --titlebar-h, paddingLeft = calc(--traffic-light-reserve - 3px) under isTauriMac() and not fullscreen, else 9. data-tauri-drag-region on the outer div, and the wordmark wrapper is pointer-events-none so it does not punch a dead spot in the drag region (Tauri drags only when the event target itself carries the attribute).
- predicted: full · documented: full · derivable: no · legible: full · trap: no

## web/src/components/shell/TopRow.tsx

### the file itself — surprising
- read at `017ffc141fa9` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: The app shell's title bar row — a TopRow laying out the header strip: the Tauri drag region, a left gutter reserved for the macOS traffic lights that collapses in fullscreen, the Wordmark, and controls on the right. Mostly a flex container with Tailwind classes, no state of its own.
- found: Much thinner than I predicted. It is the RIGHT column's top strip, not the whole title bar — the traffic-light gutter and the wordmark belong to a separate SideBarHeader, which this only matches in height so the two read as one bar. The component is a single <header> with data-tauri-drag-region, centred flex, height from --titlebar-h, rendering nothing but {children}. No fullscreen awareness, no layout of named parts. The header comment is mostly a record of what was REMOVED: a tab rail that could disagree with the sidebar about what was open, an open button that moved to the empty state, and a theme toggle dropped in favour of following the OS. It also notes the one non-obvious mechanic — Tauri drags only when the event target carries the attribute, so nested buttons keep their clicks without opting out.
- predicted: some · documented: full · derivable: no · legible: full · trap: no
- note: Nine lines of code carry seventeen lines of comment, and the comment is almost entirely about things that are no longer in the file — which is the only place that history could live, but it also means the doc describes a component richer than the one that exists.

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
- read at `abb099812d1f` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Converts a wire node from Rust into the frontend Node: snake_case to camelCase, defaults for optional fields, recursion over children, and proxyScore stashed from the score.
- found: A flat field-by-field mapping with ?? defaults, a nested score object mapped the same way (null when absent), and children mapped recursively. No proxyScore is set here.
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
- read at `12906019a736` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: Returns a new tree with readings folded in: index reports by a path#name#ord key rather than node id, walk the function nodes, attach each match; a stale report (isReportStale) is marked agentStale and does not colour — the node falls back to a preserved proxyScore — while a live one sets the score to one end of a binary scale, keeping proxyScore so the fold is reversible; then re-aggregate ancestors.
- found: The staleness half is exactly as predicted, including proxyScore being stashed on the live path and consumed (set back to undefined) on the stale one, and reaggregate running only when a child actually changed so unaffected subtrees keep object identity. Three things I did not have. It keys by `r.id`, the node id itself, not a path#name#ord key. It does not merely set a surprise number: `reportGrades` supplies BOTH surprise and documented, and documented is written only when the reader actually graded the docs — the comment explains that overwriting surprise while leaving a lexical documented behind is what produced an incoherent panel, so both numbers must come from one instrument, with source: 'agent' and analyzedShare: 1. And a CONTAINER — a file — can carry a reading of its own about its header, which attaches but deliberately does not touch the score, because a file's temperature is the roll-up of its contents and a header judgement is a different measurement.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: Cold on the file, but the repo's CLAUDE.md describes this function's staleness and proxyScore design directly, so that part of my prediction was recall rather than inference — the part I had to infer, the node-id keying, I got wrong.

### `countPending` — as expected
- read at `18fe27cd2352` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A tight recursive walk from root counting two things over function nodes only, skipping excluded ones exactly as summarize does: functions whose reading is stale (hatched) and functions with no agent reading (uncoloured). Returns {stale, unread}, allocating only the result and doing no sorting.
- found: Exactly that. Two closure-captured counters and a `walk(n, out)` whose `out` flag is inherited downward — exclusion set on a directory propagates to every descendant rather than being checked per function. Stale and unread are mutually exclusive (`else if`), so a stale reading counts as stale and never also as unread.
- predicted: full · documented: full · derivable: no · legible: full · trap: no

### `summarize` — surprising
- read at `196985d9aa76` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A pure helper walking the folded node tree once, accumulating repo-wide totals into a RepoSummary — file and function counts, total lines, a lines-weighted mean temperature, and a list of hottest functions/files for the sidebar; recursive descent treating function leaves differently from containers.
- found: It is a recursive descent accumulating into RepoSummary, but the content is assessment coverage rather than size: functions vs excluded (exclusion inherited down the tree), read/stale/unread, the predicted-grade spread plus per-grade node lists, legibility spread, trap count, first stale node, and a `hot` list of nodes above a HOT temperature threshold. It ends by sorting hot and every byGrade bucket hottest-first with a loc tiebreak. It also carries a legacy fallback deriving a grade from the old `surprised` boolean when `predicted` is absent.
- predicted: some · documented: none · derivable: yes · legible: most · trap: no
- note: The name promises a size/temperature summary; the body is entirely about assessment coverage, and with no doc comment the only clue is the RepoSummary type.

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

### the file itself — surprising
- read at `82b9285f7d8d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The standard shadcn-style class-name helper: a three-line module exporting `cn(...inputs)` that runs `clsx` over its arguments and passes the result through `twMerge` so conflicting Tailwind utilities resolve last-wins.
- found: Not a wrapper over the library at all — it REIMPLEMENTS the two lines it needs: `export function clsx(...parts)` filtering falsy values and joining with a space. No `clsx` dependency, no `tailwind-merge`, so no last-wins conflict resolution. The peer entry `clsx` was the local declaration, not an import.
- predicted: some · documented: none · derivable: yes · legible: full · trap: no
- note: The file is named `cn.ts` but exports nothing called `cn` — it exports `clsx`, which is also the name of the npm package it deliberately does not use, so an importer reading either the filename or the symbol gets the wrong idea about which one they have.

### `clsx` — as expected
- read at `e8933499c48d` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: parts.filter(Boolean).join(' ') — drop falsy varargs, join the rest with a space.
- found: Exactly that, character for character.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/colorMode.ts

### `paintsFromReadings` — as expected — STALE
- read at `eff5c407e8c5` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A one-line predicate returning true for the reader-report lenses — 'surprise' plus the two newer ones (something like legible/documented) — as a literal set membership or a || chain.
- found: Exactly a three-way || chain: mode === 'surprise' || 'legible' || 'traps'.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

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
- read at `0f318d6c7c90` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: A dispatch over ColorMode variants — surprise/temperature, age/recency, language, docs, churn — each producing a Paint plus a human label via ramped/ageRamp/slotColor, returning null where the node lacks the datum.
- found: Exactly that shape, with more modes than I listed: surprise, legible, docs, traps, churn, age, then a shared categorical tail for blame/lang using ranks + slotColor with OTHER fallback. Containers roll up as shares (showsShare) in surprise/legible/docs; docs inverts the ramp to paint the GAP and a file answers for its own header only; traps is two flat colours plus absence rather than a ramp.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: Unusually dense inline reasoning: most of the 124 lines are comments arguing why each lens is shaped as it is, and they hold up against the code.

### `rankCategories` — nearly
- read at `43639d96a85f` · commit `81eb6d5` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Walks the node tree accumulating lines per category (category from `mode`), sorts descending by lines, returns Map of category name to slot index.
- found: Delegates entirely to legendFor(root, mode), which returns the already-ordered category names, and just indexes that array into a Map name→i.
- predicted: most · documented: full · derivable: no · legible: full · trap: no

### `bucketsFor` — nearly
- read at `0eb06e2866d7` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: One recursive walk gathering the subtree's non-excluded functions, then a switch on mode. Ramped modes (temperature, age, churn) put each function in a fixed band by its ramp input and colour the band at the MEAN of its members' inputs, using the caller's ageSpan rather than the on-screen root's. Categorical modes (language, author, grade) group by key with colours from rankCategories/slotColor so the panel matches colorFor. Anything the mode cannot colour lands in a final neutral bucket rather than being dropped; each Bucket carries a label, count, line total and fill.
- found: All of that, and more modes than I guessed: surprise returns an empty array outright (the map's own lens needs no breakdown), and legible/docs/traps read straight off the agent reading, sharing one "not read yet" bucket and a separate "not graded" one. Buckets hold the nodes themselves plus a line total, not a count. The absence key is a NUL-escape-prefixed sentinel so a real author literally named "unknown" cannot land in the absence row — with a comment recording that it was once a literal NUL byte, which made the whole file read as binary to grep and git diff. Each mode also gets its own sort — lines descending for blame/language to match legendFor, traps first, grade order for legible/docs, band order otherwise — and the absence row is appended last regardless.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc is a good account of the design but says nothing about the per-mode sort orders or the early return for the surprise lens, which are half the body.

### `legendFor` — nearly
- read at `673cd639d481` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: For categorical color modes it walks the tree collecting each node's distinct category label and returns them in a stable order for the legend; for ramp modes it returns an empty array since a continuous ramp needs no discrete legend.
- found: Returns [] unless mode is 'blame' or 'language'. Otherwise walks the tree accumulating, per key (lastAuthor or lang) and only for kind==='func', a sum of loc, then returns the keys sorted descending by total lines — so the legend is ordered by visual share, not alphabetically or by first appearance.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

## web/src/lib/fan.ts

### the file itself — nearly
- read at `aad3a344a715` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 5 of its run
- expected: The geometry for the annular fan an opened file unrolls into: a Sector type with sectorOf/arcOf converting between it and the sunburst's arc geometry, fanFor choosing the destination fan for a pane aspect, lerp/lerpSector interpolating between source wedge and fan for the open/close transition, deg for radian conversion, and share/place/centre/room subdividing a sector into cells.
- found: That, in a (theta, v) space where v = r squared over 2 so that area is linear in both coordinates — which is the load-bearing idea I did not have. Because source and destination are both rectangles in (theta, v), the map between them is affine, so `place` can carry a tiling squarified against the fan back into the wedge and every intermediate frame is still a valid tiling: no morph, no re-tessellation, no sampled polygons. `lerpSector` interpolates in v for the same reason (even growth in area). `fanFor` does not pick a span, it SEARCHES one: it steps 55 to 150 degrees in 5-degree increments, fits each candidate exactly as the viewBox will, and keeps the one putting the most area on screen — because RIM cancels under the fit and only SHAPE decides capacity. The bearing of the source wedge is preserved so the fan grows in place, with NO_WEDGE_BEARING = 0 (straight up) for the three routes into a file that have no wedge behind them. `share` is a normalised fraction rather than a weight split, and `centre`/`room` are label-placement helpers, `room` taking arc width at MID radius as the conservative read of a trapezoid.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The file has a substantial header at lines 4-29 and the `docs` field of this task was EMPTY — the same happened on the AgentSetup.tsx file task, so file-level tasks appear not to be handing over the header the `ask` instructs the reader to predict from.

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
- read at `fc1e136bdb1a` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Constructs a fresh directory Node: id/path from path, given name, kind 'dir', empty children, zeroed lines/score defaults, freshly allocated each call since containers are not pooled.
- found: Exactly that — a literal Node with every field explicitly nulled/zeroed (loc 0, line/endLine/lang/lastAuthor/doc/score/body null, excluded false, hotspots and children empty), with an inline comment arguing doc is deliberately null because a comment is a reading's input rather than a fact about a commit.
- predicted: full · documented: none · derivable: no · legible: full · trap: no

### `frameTree` — as expected
- read at `ef25db43c51a` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Folds the history to the given frame (memoised forward replay), then builds a fresh sunburst Node tree: freshly allocated dir/file containers via dirNode, function nodes taken from a pool and mutated in place, coloured by recency as of the frame's date, returning a root named repoName.
- found: Just that. `replay(hist, index)` gets the frame; lazy recursive `dirFor`/`fileFor` build fresh containers (files carry lang and the frame's last author); a module-level `pool` keyed on the HistoryScan identity holds function nodes, created once and thereafter only `loc`, `lastAuthor` and `score` (via `scoreInto`) are rewritten — identity/path/lang deliberately not. Functions are emitted in interned order so wedge order is stable across the replay. Ends with `aggregate(root)` then returns `collapse(root)`.
- predicted: full · documented: most · derivable: no · legible: full · trap: no

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
- read at `b99ba883c8b2` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Resolve the custom property to an sRGB colour, falling back to the chrome ink if that fails; otherwise composite it over the pane background at alpha, take the luminance, and return whichever of the two inks (Ink vs Paper) has the better contrast — a per-wedge choice, not a per-theme one.
- found: That, plus memoisation I did not predict: results are cached under a `theme()|token|alpha` key, with the theme in the key precisely so a theme switch does not serve stale inks. Compositing is skipped when alpha >= 1 or the background will not resolve, `over` returns a luminance directly rather than a colour, and the tie on equal contrast goes to PAPER.
- predicted: most · documented: most · derivable: no · legible: most · trap: no
- note: `y` holds a luminance on one branch and the result of `over` on the other, so the name and the two paths only agree because `over` happens to return a luminance rather than a colour.

### `theme` — nearly — STALE
- read at `e9a53e5e7f29` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: A one-liner returning the current theme ('dark'|'light'), read from a data-theme/class on the document element or prefers-color-scheme, so the ink colour helpers know which ground they draw on.
- found: Returns document.documentElement.className verbatim (the whole class string, not a parsed theme), falling back to a single space when there is no document (SSR/test). Used as a cache key rather than a theme enum.
- predicted: most · documented: none · derivable: no · legible: most · trap: no
- note: The fallback is a single space rather than an empty string, which reads as a deliberate sentinel but nothing says why.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `resolve` — nearly
- read at `55f91d723736` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads the named CSS custom property off the document root's computed style, trims it, returns null when empty or not a plain hex colour (e.g. a color-mix), so the caller falls back.
- found: Exactly that, plus two guards I did not name: an SSR/no-document check returning null, and unwrapping a `var(--x)` wrapper before requiring the name to start with `--`. Hex check is a strict 6-digit regex.
- predicted: most · documented: most · derivable: no · legible: full · trap: no

### `luminance` — as expected — STALE
- read at `2bb31705d74a` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: Parses the hex colour into r/g/b, converts each through the sRGB-to-linear transfer function (via the `srgb` peer), and returns 0.2126*R + 0.7152*G + 0.0722*B — WCAG relative luminance in 0..1.
- found: Exactly that, written as a reduce over the array `srgb(hex)` returns, indexing the coefficient list [0.2126, 0.7152, 0.0722] by channel position — so the linearisation lives entirely in `srgb` and this is just the weighted sum.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `over` — as expected — STALE
- read at `af45ee2bd823` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Converts hex and ground into linear-light RGB channels via srgb(), blends per channel with alpha (c*alpha + bg*(1-alpha)), and returns the relative luminance of the composite using 0.2126/0.7152/0.0722 weights.
- found: Exactly that: destructures [srgb(hex), srgb(ground)], then a single reduce that multiplies each blended channel by the inline coefficient array and sums. It inlines the weights rather than calling the peer `luminance`.
- predicted: full · documented: full · derivable: no · legible: most · trap: no
- note: The coefficient array is reallocated inside the reduce and duplicates whatever `luminance` uses, so the two could drift apart.
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `srgb` — as expected
- read at `190a8a42c92f` · commit `1b80d39` · read by claude-opus-5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Parses the hex string into three 0-255 byte channels, normalises each to 0-1, applies the sRGB-to-linear transfer function (c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4), and returns the three linear values as an array for luminance.
- found: Exactly that, written as [1,3,5].map over byte offsets in a "#rrggbb" string. It assumes the full six-digit form with a leading '#' — a three-digit shorthand or a missing '#' silently yields NaN rather than throwing.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `contrast` — as expected — STALE
- read at `48b374d2cfba` · commit `23b1218` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Takes two relative luminances and returns the WCAG ratio (lighter + 0.05) / (darker + 0.05), using Math.max/Math.min so argument order does not matter.
- found: Character for character that: `(Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05)`.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

## web/src/lib/label.ts

### `widthPerPx` — nearly — TRAP
- read at `0269c2721d0c` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 9 of its run
- expected: Returns the rendered width of text at font-size 1 for the given weight — measureText(text).width / fontSize — memoised in a Map keyed by weight and text because the chart re-measures the same few hundred names every transition frame. Lazily creates a single module-level canvas 2D context, sets font to a reference size in the app's face, and falls back to a constant-per-character estimate where there is no canvas rather than throwing.
- found: All of that, plus one deliberate fudge I did not predict: the measured advance is multiplied by 1.06, because measureText reports advance rather than ink and side bearings, hinting and subpixel rounding push the painted run past it — the policy being that a name which does not clearly fit is not drawn. Reference size REF, family FAMILY, fallback 0.6 chars, cache `widths` keyed `${weight}|${text}`.
- predicted: most · documented: most · derivable: no · legible: full · trap: yes
- note: The comment says 'Keyed on the FACE too. The face is now live, and a cache that ignored it would answer every question after the first with the width the first face happened to have' — but the key is `${weight}|${text}` and FAMILY appears nowhere in it, so the code does exactly the thing its own comment says it must not.

### `middleTruncate` — nearly
- read at `4add0a3a74a1` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Returns name unchanged if it fits within keep chars; otherwise splits the budget between head and tail (roughly half each, allowing for the ellipsis) and joins with a middle ellipsis.
- found: That, plus a MIN_KEPT floor: below it the function returns the empty string rather than a stub. head = ceil(keep/2), tail = the remainder, ellipsis not counted against keep.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The docs argue at length for keeping both ends, but say nothing about the MIN_KEPT case where the function drops the label entirely.

### `fitLabel` — nearly
- read at `de24ecebad1b` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Measure arc length and radial depth, pick a preferred axis by which is larger, then try in order: full name on preferred, full name on other, middle-truncated on preferred, middle-truncated on other, each against a minimum font size; return a Placement or null.
- found: The ordering is as predicted except truncation is only ever attempted on the PREFERRED axis, never the other. Three things I did not cover: a bend cap (maxBend/DEFAULT_BEND) limiting how much a label may curve, which can knock arc out even in a wide cell; the radial size solved as a fixed point so the name is CENTRED in the wedge rather than fitted at r0 or slid outward; and an `only` option pinning an axis (rim labels are arc-only). Truncation searches keep-lengths downward from name.length-1 to a floor of max(MIN_KEPT, name.length*MIN_SHARE) at fixed MIN_SIZE.
- predicted: most · documented: some · derivable: no · legible: full · trap: no
- note: The handed doc states the priority order but not that clipping is confined to the preferred axis, which is the one place the stated policy ("full on either axis beats clipped on either") stops short of describing the code.

## web/src/lib/runtime.ts

### `isTauri` — as expected
- read at `33a9a1078966` · commit `1b80d39` · read by claude-opus-4.6 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Arrow function returning whether we run inside the Tauri shell by checking a Tauri-injected global on window (__TAURI_INTERNALS__/__TAURI__), guarded against window being undefined, with no Tauri API import.
- found: Exactly that: typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no
- note: No function-level docs; the file_doc carries the intent instead.

### `isMac` — as expected
- read at `18634f7d04cb` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A one-line platform sniff returning true on macOS, testing navigator.platform or userAgent for "Mac", guarded so it is safe where navigator does not exist.
- found: Exactly that: a typeof guard on navigator plus a case-insensitive /Mac|iPhone|iPad/ test of navigator.userAgent — so it is really "Apple platform" rather than strictly macOS.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `isTauriMac` — as expected — STALE
- read at `78541b5becc9` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A one-line arrow returning isTauri() && isMac(), the conjunction of its two neighbours, so traffic-light room is reserved only in the desktop shell on macOS.
- found: Exactly that: `export const isTauriMac = (): boolean => isTauri() && isMac()`.
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `onFullscreenChange` — nearly
- read at `3bca05eb1d24` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 3 of its run
- expected: Subscribes to the window resize event and on each one (plus once immediately) asks the Tauri window whether it is fullscreen, via a dynamic import of @tauri-apps/api/window so the module stays browser-safe, invoking cb with the boolean; returns a teardown removing the listener, and no-ops outside Tauri.
- found: That, plus careful async-unsubscribe handling: it bails to a no-op closure unless isTauriMac(), then runs an async IIFE that dynamic-imports getCurrentWindow, defines read() as isFullscreen().then(f => !dead && cb(f)), reads once, awaits win.onResized(read), and — if the caller already disposed while the import was in flight — immediately calls the unlistener instead of storing it. The returned teardown sets dead and calls stop if it exists.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: The `dead` flag guards both the in-flight listener registration and the in-flight isFullscreen promise — the one detail I did not predict, and the reason this is 18 lines rather than 6.

## web/src/lib/sunburst.ts

### the file itself — nearly
- read at `d29118dbd0ff` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: A pure geometry/layout module for the sunburst: turn the folded tree into wedges with angles proportional to lines, build SVG arc path strings, pack a file's functions into its wedge with something squarified (worstRatio/rowPlacement/tileFunctions), aggregate the overflow, and produce label arcs. No React, no fetching; heat only as an ordering/colour input.
- found: That, and more carefully than I guessed. Angles come from a recursive walk starting at 9 o'clock, biggest-first, culling sub-minAngle arcs (never functions) and counting the hidden subtree by kind. Function tiling is a genuine squarified treemap done in (θ, v=r²/2) coordinates so area is conserved exactly, with a per-patch MAX_STRETCH floor rule, a promote-then-roll-up policy, and a want/scale pass instead of a remainder budget. sliceFunctions is the drilled-in angular variant, aggregate builds a synthetic Node for the overflow, labelArc offsets the radius by an eyeballed baseline constant and reverses bottom-half arcs.
- predicted: most · documented: none · derivable: yes · legible: most · trap: no
- note: The file has no header doc, and two TSDoc blocks are attached to the wrong declaration: "Partition the tree into rings" (L37-44) sits on `LayoutOpts` rather than `layout`, and the "arc for a label to sit ON" block (L669-682) sits on the BASELINE_TO_CENTRE constants rather than `labelArc`, so both functions read as undocumented to any tool that reads the attached comment.

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
- read at `95b97563182d` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 4 of its run
- expected: Builds one synthetic Node standing in for functions that didn't fit: total LOC as size, LOC-weighted mean score over only members carrying a real reading (neutral/undefined if none read), a name like "+N more", id derived from filePath, and a flag marking it an aggregate for hover/click.
- found: All of that, plus three things I did not cover: it keeps `children: fns` so the detail panel can reach the hidden members; it recomputes `hotShare` as hot LOC over read LOC (not a mean of surprise) and `analyzedShare` as read LOC over total LOC so a mostly-unread pool renders unread; and it hardcodes excluded:false and doc:null rather than inheriting from members. "read" is defined as score.source being 'model' or 'agent'. Name is "N+", id is `path#rest`, marker field is `rest`.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc comment stops at the weighted-mean rationale and says nothing about analyzedShare or the children roll-up, which are the two things that make the wedge honest and navigable.

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

### the file itself — nearly
- read at `81445c50569e` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: A tiny shared string-formatting module for the UI: elide truncating a label to a max length with an ellipsis, probably preserving the tail of a path rather than cutting blindly, and compactCount rendering large numbers compactly for wedge labels and the sidebar (1.2k, 17k) so counts fit small spaces.
- found: Both, at the shape predicted, with the parameters chosen more deliberately than expected: elide shortens from the MIDDLE keeping both ends, weighted 65% to the tail because the filename and line are what a path is read for and the leading directories are inferable from what was clicked, counting characters rather than pixels because every caller is monospace. compactCount only switches to a unit once the digits stop fitting — plain toLocaleString with separators below 100,000, then k, then M at one decimal — on the argument that a unit is a loss of precision worth paying only when the exact digits would not fit, sized against a 290px header column printing three counts on one line.
- predicted: most · documented: none · derivable: no · legible: not judged · trap: no
- note: Third file task in a row handed to me with an empty `docs` array while the file itself is thoroughly documented — here every export carries a full rationale, so `documented: none` is a fact about the handout, not the file.

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
- read at `326426743cdb` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 1 of its run
- expected: Reads the stored theme preference from localStorage under a module key, validates the raw string against the three Theme values, returns 'system' as the fallback when missing or unrecognised, wrapped in try/catch because localStorage can throw.
- found: Exactly that: try { localStorage.getItem(KEY) }, literal check against 'light'|'dark'|'system', empty catch with a comment, return 'system'.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- note: The docs are a file-level essay about why a theme toggle exists at all, not about this function; they cover it only by implication (the 'system' default), but they say things no reader could derive from the code.

### `saveTheme` — nearly
- read at `064c9b357299` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: Persists the three-way choice: writes t to localStorage under a module-level key, removing the key when t is 'system' so the default stores nothing, then applies the theme so the dark class on html updates immediately; guarded against a missing localStorage.
- found: Just localStorage.setItem(KEY, t) inside a try/catch whose empty body carries a comment saying the preference simply will not survive a restart. No special case for 'system' — it is stored like any other value — and it does not apply anything; that is applyTheme's job.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no

### `prefersDark` — as expected
- read at `d1c5dd0259c2` · commit `1b80d39` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 8 of its run
- expected: A one-liner returning window.matchMedia('(prefers-color-scheme: dark)').matches, possibly guarded for a missing matchMedia.
- found: Exactly that, unguarded — one return statement.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no

### `applyTheme` — as expected — STALE
- read at `13fa2a14f29b` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: Resolves the Theme — with 'system' falling through to prefersDark() — and stamps the result on document.documentElement, as a class or data-theme attribute, possibly also setting style.colorScheme.
- found: Exactly that, minus the colorScheme: one line computing `dark` from t === 'system' ? prefersDark() : t === 'dark', one line calling classList.toggle('dark', dark) on documentElement.
- predicted: full · documented: most · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `applyStoredTheme` — as expected — STALE
- read at `c2bf76ae3f89` · commit `23b1218` · read by claude-opus-4-5 · by ross@rossturk.com · cold reading · reading 10 of its run
- expected: A three-line wrapper: read the persisted preference with loadTheme() and hand it to applyTheme(), which sets the class on documentElement, with the system fallback already handled inside those two — so the body is a single call, run at module load to re-assert what index.html's blocking script already did.
- found: Exactly one statement: applyTheme(loadTheme()).
- predicted: full · documented: full · derivable: no · legible: full · trap: no
- this code has changed since it was read; the reading above may no longer
  describe it, and Sanity will offer it for re-reading first.

### `watchSystemTheme` — nearly
- read at `49cc65416df4` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 2 of its run
- expected: If t is not 'system', return a no-op teardown; otherwise subscribe to matchMedia('(prefers-color-scheme: dark)') change and re-apply the theme, returning an unsubscribe function.
- found: Exactly that, plus an eager applyTheme(t) on entry before the mode check — so the function both applies and subscribes, which the docs ("keep following the OS") do not mention.
- predicted: most · documented: most · derivable: no · legible: full · trap: no
- note: The doc describes only the subscription; the function also applies the theme immediately, which is why it works as a one-call effect.

## web/src/lib/zoom.ts

### the file itself — nearly
- read at `2c896828e2cd` · commit `1b80d39` · read by claude-opus-4.5 · by ross@rossturk.com · cold reading · reading 7 of its run
- expected: The pure-geometry module behind drilling in and out of the sunburst: per-node ring geometry (geoOf, hubGeo), whether a navigation is a descent or ascent (direction, under, ancestors), start/end geometries for the animation (enterFrom, exitTo), interpolators (lerp, lerpGeo, ease) so a frame at t is a valid layout, and extentOf/viewFor/lerpView/viewBoxOf doing the same for the SVG viewBox so camera and arcs arrive together. No React, no rendering.
- found: All of that, and the shape was as predicted. Two things I did not anticipate: `direction` has a third answer, `across`, for jumps between unrelated nodes (the summary panel's hot list) rather than collapsing to in/out; and `extentOf` is computed analytically from annular-sector corners plus the quarter-turn crossings inside each span, deliberately replacing getBBox because a measured box fits a half-finished animation. The module also carries ZOOM_MS and an Exiting interface, and geoOf deliberately skips func wedges because layout gives them a phantom ring they are never drawn in.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Lines 197-210 are a full doc comment attached to nothing — it documents the absence of a constant that was deleted, so it binds to the `Exiting` interface below it.

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
