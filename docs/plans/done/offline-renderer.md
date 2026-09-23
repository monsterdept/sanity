# An offline renderer for PDF and movie export

**Status:** built for the PDF exports (report, brief, deck) on `report-consistency`, since merged
to `main`. The movie
draws its frames from the same markup, but still rasterizes and encodes in the window. This note began as a proposal; what follows says what was built,
what the proposal got wrong, and what is still open.

## Why it was built

Four reasons accumulated, and the last two are why it was built when it was.

- **A person ran every export.** Nothing about one could be tested, and every visual check waited
  on a manual export.
- **A figure's correctness depended on timing the export inferred.** One report copied a group map
  before its function rings arrived.
- **The numbers depended on the window too.** A report read its tables off the window's tree,
  which holds only the function rings it has drawn — and a report's own zoomed pages fetched more.
  A report and a brief of one commit, exported twelve seconds apart, named different most-complex
  functions and counted 84 and then 99 unread. The same fault was in the window's own key and
  panel counts. See [notes/report.md](../../notes/report.md).
- **The files were pictures.** Every page was a canvas encoded as JPEG: a 42-page report was 32MB,
  could not be searched or copied from, and blurred at any zoom. The export also covered the window
  while it re-rooted the live map for every figure.

## What was built

- **The map's picture is a pure render.** `MapArt` (`components/MapArt.tsx`) is the whole
  `<svg data-sunburst>` at rest, from explicit props, with no effects, DOM reads or animation
  frames; `SunburstView` renders through the same `MapSvg`, and its markup was checked byte for byte
  against the old component in 30 staged cases. `mapMarkup` renders it with
  `react-dom/server.browser` and returns the markup, its viewBox and every tagged wedge's geometry
  (`spots`), computed from the layout rather than parsed back out. The measurer and the color table
  are props, never module globals, because the window and an export can lay out at the same time.
  `just map-check` pins it.
- **Every input comes from data, not the window.** `sanity export-data <repo>` writes the complete
  tree, stamped readings, findings, summary counts, head and remote as one JSON document in about
  three seconds warm. What the app derived inline became pure functions both sides call:
  `locksFor` (`lib/locks.ts`), `viewsFor`, `slotsFor`, `keyFor`, `reportLenses`
  (`lib/reportInputs.ts`). In the window, a report asks for every function ring once
  (`completeTree`) before it lays anything out.
- **The PDF is vector.** `lib/vector/`: a hand-written writer (`doc.ts`), a surface with the part of
  the canvas's shape the report uses (`surface.ts`), an SVG→PDF translator for exactly the elements
  the map draws (`svg.ts`), CSS colors including `color-mix` in OKLCH (`color.ts`), and fonts
  (`fonts.ts`) shaped by HarfBuzz and embedded as subsets with their glyph ids kept. The faces are
  TTF subsets vendored in `public/fonts/pdf`. `report.ts` draws exactly what it drew before. The
  same report is now about 2MB, and its text is real. `just vector-check` pins the file.
- **One path, two hosts.** `just render <repo> [report|brief|deck|all]` writes the PDFs from the
  export with no window; the window's export calls the same `buildReport` with the same figures.
- **Figures are rendered once per content.** Every figure is laid out at one density
  (`FIGURE_PX`) and scaled to where it prints, so a report, a brief and a deck share figures. `just
  render` caches them on disk under the CLI's `renders` slot (`reports::cache_slot`, swept and
  reset like the other kinds), keyed on the export's bytes — a dirty tree is another repository at
  the same sha.

## What the proposal got wrong

- **There was no `getBBox`.** The viewBox was already computed from the layout (`viewOf`); the
  proposal, and several comments, described a call that had been removed. What made static markup
  wrong was that the computed viewBox was only applied by an effect.
- **Three live-page reads was four, plus state.** Label measurement and font readiness were
  there. Missed: `ink.ts` resolving label ink with `getComputedStyle` on the document — against the
  window's theme, not the staged pane, so a report exported from a dark window chose ink against
  dark tokens — the pane's aspect ratio, a file root's bearing taken from the previous render, and
  function rings that arrive through an effect.
- **Option B did not need a canvas outside the browser.** The page furniture needed a surface, not
  skia-canvas: once pages are vector, the surface writes PDF operators and runs anywhere JavaScript
  does. The movie's frames are the same markup, rasterized by the webview; a rasterizer is what it would
  take to move the movie out of the window too.
- **The parity test could not be pixels against the window.** The window path it would have been
  measured against was the thing being removed, and its output was itself non-deterministic (the
  hub's animated pose, leftover folds and hover, ring timing). Parity was checked where it is exact —
  the map's markup before and after the split — and the PDF is checked for structure, fonts and
  text by poppler.

## Still open

- **Scripts the faces lack.** LINE Seed JP covers Latin, kana and CJK ideographs; Hangul and other
  scripts print as missing glyphs. A vendored fallback face is the next step if a repository needs
  it — never a system font, which differs by machine and cannot be embedded.
- **The movie still needs the window.** Its frames are `mapMarkup` over `frameTree`, so the map on
  screen no longer changes during an export, but they are rasterized by the webview and encoded
  with WebCodecs. A headless movie needs a rasterizer (resvg) and an encoder without WebCodecs (a
  Rust encoder or ffmpeg, with its size and licensing).
- **Label fit in the window and on paper can differ.** The window measures names with the canvas;
  a report measures them with HarfBuzz in the embedded face at the same ×1.06. A name at the edge of
  fitting can be kept in one and left off in the other.
- **The window's figure cache lives for one export.** A report, then a brief, then a deck from the
  window each lay their figures out again; only `just render` keeps them across runs.
