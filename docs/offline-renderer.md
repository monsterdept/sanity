# An offline renderer for PDF and movie export

**Status:** proposal. Not scheduled, not critical path.

## Summary

Both exports are made by the window. The report and the movie stage the live map, wait for it to
stop moving, copy its SVG and rasterize the copy in the page. That was a deliberate choice, and it
has a cost: nothing can export without a person running the app, nothing about an export can be
tested, and whether a figure is right depends on timing the export infers rather than knows.

The proposal is to produce **the same SVG markup outside the window** and rasterize it headlessly,
not to write a second renderer. The first deliverable is a parity test, and nothing ships until it
passes.

## How export works today

Checked against the code, September 2026.

- **Staging.** `report.ts` and `movie.ts` dress the window's map through `o.stage` (lens, size,
  root), then `rest()` waits until the rings group has pointer events back and App's `settled()`
  has held for 400ms, giving up after 30s.
- **Copying.** The `svg[data-sunburst]` element is cloned, with the brand faces inlined as data
  URIs (`faceCss` fetches the woff2 files) and every custom property resolved (`varCss`). The clone
  is rasterized through an `<img>` (`rastered`).
- **Output.** Report pages are 2D-canvas JPEGs assembled by `lib/pdf.ts`. Movie frames are encoded
  in the page by WebCodecs (`VideoEncoder`). `save_pdf` and `save_movie` in `commands.rs` only
  write the bytes.
- **Dependencies.** The Rust side has no SVG rasterizer and no video encoder.
- **Where the map reads the live page:**
  - `Sunburst.tsx` fits its viewBox with `getBBox` after drawing.
  - `label.ts` measures label widths with canvas `measureText`, in the face it draws, falling back
    to a per-character estimate where there is no canvas.
  - `document.fonts` decides whether the brand face or its fallback is in use.
- **Page furniture.** The report's type, tables and keys are drawn with canvas 2D (`fillText`,
  `measureText`, and a `getImageData` probe for title bearings), which is a second dependency on a
  browser, separate from the map's.

## What it costs

- **A person runs every export.** There is no CLI path and no test. In the design pass of September
  2026, every visual check waited on a manual export, and the title-alignment check was a script run
  over the resulting PDFs afterwards.
- **Correctness depends on inferred timing.** One report copied a group map before its function
  rings arrived, and drew one page in the fallback face; the next export of the same repository did
  neither. The cause was not established.
- **The window is occupied.** Export covers it (`Overlay`'s `opaque`), and a fault in export code
  freezes the app: a self-recursive `page()` spun the page's microtask queue and locked the window
  and its inspector.

## Why it is built this way

From [notes/report.md](notes/report.md), and still true:

- **One renderer.** The map is copied, never redrawn, because two renderers drift, and in this
  codebase a wrong colour is not a crash. Most of the rules in `CLAUDE.md` are colours that went
  wrong silently.
- **Fonts for every script.** Canvas text falls back to system fonts, so a CJK author name prints.
- **A proven path.** The movie had already shown that rasterizing the map's SVG works.

Any offline design has to keep the first two.

## Proposal

1. **Make the map's SVG a pure function** of tree, lens, views, size and root, by replacing the
   three live-page reads with injected ones:
   - the viewBox computed from layout extents instead of `getBBox`;
   - label widths from a `TextMeasurer`, backed by canvas in the window and by the bundled LINE Seed
     metrics headlessly;
   - the face chosen explicitly.

   The window keeps drawing through the same function. This step is worth doing even if nothing
   else here happens, because it removes a draw-then-measure pass.
2. **Render that function without a window**, as static markup through `react-dom/server`. Static
   is the point: no effects run, so the staging and animation waits have nothing to wait for.
3. **Choose a host for rasterizing and for the page furniture:**
   - **A. A headless browser** (Playwright on WebKit) running the existing export code unchanged.
     There is no drift at all, but the dependency is heavy, so this suits dev and test rather than
     shipping.
   - **B. resvg for the map**, plus a canvas implementation outside the browser (skia-canvas) for
     the page furniture. It ships with the CLI, and the furniture code stays as it is, but it adds
     native dependencies.
   - **C. Reimplement in Rust.** Rejected, because that is the second renderer.

   **Recommendation:** use A as the parity reference, and build B only once the parity test is green
   against it.

## Parity test first

Render a fixed set of states both ways (every lens, the root and a zoomed group, two sizes) and
compare the pixels against a threshold. Label placement is the expected failure, because it is
where font metrics enter. Gate it as `just render-check`, alongside the other bundled checks.

## Open questions

- **Scripts the bundled faces lack.** Without a browser, CJK and emoji need system fonts loaded into
  the rasterizer's font database, which only the user's machine has; a CI machine's output will
  differ.
- **The creature.** `drawCreature` paints the live mascot onto each figure. It needs a headless
  equivalent, or figures leave it out.
- **Video without WebCodecs.** That means bundling ffmpeg (size, licensing) or using a Rust encoder.
- **Window export after this.** Either it moves onto the same path, or it stays as a fallback until
  parity has been measured on real repositories.

## Non-goals

- Replacing the window's renderer.
- Changing what any figure shows.
