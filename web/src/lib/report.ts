import type { ColorMode } from './colorMode'
import { mergeFindings } from './findings'
import { onPaper } from './vector/color'
import { PdfDoc } from './vector/doc'
import { drawAppendix, layoutAppendix } from './report/appendix'
import { drawContents, type Book } from './report/contents'
import { drawFront, layoutFront, type Front } from './report/cover'
import { figureCache } from './report/figure'
import { drawGroups, drawOverview, layoutFindings, type FindingsPlan } from './report/findings'
import { frameOf, Press } from './report/frame'
import { drawLenses, layoutLenses, lensPages, lensSkips, type LensPlan } from './report/lenses'
import { Sheet } from './report/sheet'
import type { Inks, Slice } from './report/text'
import { FORM, type Form, type Report } from './report/types'
import { DECK_PAGE, PAGE, PAPER_WHITE } from './report/units'

export { lensPages, settingOf } from './report/lenses'
export {
  FORM,
  type Form,
  type MapRender,
  type MapRequest,
  type Report,
  type ReportBucket,
  type ReportStats,
  type ReportTick,
  type VectorEnv,
} from './report/types'

/**
 * The project's analysis as a PDF, written to stand on its own as a document.
 *
 * **Laid out like a paper, because it has to be read by somebody who has never seen the app.**
 * A cover with the wordmark, an abstract and a methods section; a contents page; one section per
 * lens, each an essay in two columns with the map as a numbered figure in the first; and the
 * findings — an overview, then each group of findings on a map zoomed to where they are. The
 * prose is `reportProse.ts`, written for this and not borrowed from the in-app reference.
 *
 * **Every page is vector: paths, and real text in embedded subsets.** It was a picture — a canvas
 * encoded as JPEG — so a report of 42 pages was 32MB, blurred when zoomed, and could not be
 * searched or copied from. Pages are drawn on a `Surface`, which has the canvas's shape and writes
 * PDF, so the layout below is the layout that was tuned on the canvas. Type is shaped by HarfBuzz
 * from the same font files that are embedded — see `vector/fonts.ts`.
 *
 * **The map is the map's own markup, translated — never a second renderer.** Each figure is the SVG
 * the map component renders for a lens, a density and a root (`Report.map`): rendered as static
 * markup rather than staged in the window and copied off the screen, and drawn here by `drawSvg`.
 * What this draws itself is furniture: type, keys, the gray wash and the marks, which are cut from
 * the layout's own wedge geometry (`MapRender.spots`).
 *
 * **Everything is laid out before anything is drawn.** Footers say `n / total`, the contents page
 * names pages, and both need every page counted — so the text is set and poured into its columns,
 * the findings grouped and paginated, and only then is each figure staged and drawn. Nothing in a
 * layout depends on what a staged map turned out to hold.
 *
 * The sections live under `report/`, each laying itself out against a `Frame` and drawing through
 * a `Press`: `cover.ts` (cover and methodology), `lenses.ts`, `findings.ts` (with `entries.ts` and
 * `grid.ts`), `appendix.ts` and `contents.ts`. Under them, `text.ts` sets type into lines and
 * columns, `sheet.ts` is the page, `figure.ts` the map and its key, and `tables.ts` a lens's tables.
 */
export async function buildReport(o: Report): Promise<Uint8Array> {
  const items = mergeFindings(o.groups)
  const dirt = o.head?.dirty ? ' + uncommitted' : ''
  const stamp = o.head ? `${o.slug} @ ${o.head.sha}${dirt}` : o.slug
  // **Always white paper.** A report is a document, printed or read beside other documents; a
  // dark page is a screen's choice, and the window's warm light ground prints as a gray wash.
  const inks: Inks = {
    bg: PAPER_WHITE,
    fg: 'var(--foreground)',
    muted: 'var(--muted-foreground)',
    border: 'var(--border)',
    secondary: 'var(--secondary)',
    accent: 'var(--accent)',
  }
  const doc = new PdfDoc()
  const paper = o.form === 'deck' ? DECK_PAGE : PAGE
  const sheet = new Sheet(doc, paper, inks, stamp, { ...o.env, vars: onPaper(o.env.vars, PAPER_WHITE) })
  // Figures by lens and root, rendered once: see `figureCache`.
  const press = new Press(o, sheet, figureCache(o.map))

  // ── Lay out.
  press.tick('laying out the pages')
  const f = frameOf(o, sheet, items.length)
  const skips = lensSkips(f, lensPages(o.locks))
  const modes = lensPages(o.locks).filter((m) => !skips.has(m))
  press.tick('setting the methodology')
  const front = layoutFront(f)
  press.tick('setting the lens essays')
  const lenses = layoutLenses(f, modes)
  press.tick('grouping the findings')
  const findings = layoutFindings(f, items, modes.length)
  const appendix = layoutAppendix(f, modes)
  const book = numberPages(o.form, front, lenses, findings, appendix)
  press.total = book.total

  // ── Draw, in page order, and the contents last, because it names every other page.
  await drawFront(f, press, front)
  await drawLenses(f, press, lenses, book.lensStart)
  await drawOverview(f, press, findings, book.findingsStart)
  await drawGroups(f, press, findings, book.groupStart)
  if (book.appendixStart !== null) drawAppendix(f, press, appendix, book.appendixStart)
  if (book.contents !== null) {
    press.check()
    press.tick('setting the contents')
    press.begin(book.contents)
    drawContents(f, book, findings, skips)
    press.end(book.contents, 'Contents')
  }
  press.tick('writing the PDF')
  return doc.write({
    title: `${stamp} — sanity ${FORM[o.form].noun}`,
    created: new Date(),
    subset: o.env.subset,
    deflate: o.env.deflate,
  })
}

/** Every section's first page: the cover and methodology, the contents (a report's only), each
 *  lens, the findings overview, each group, and the appendix. */
function numberPages(form: Form, front: Front, lenses: LensPlan[], findings: FindingsPlan, appendix: Slice[][]): Book {
  const contents = form === 'report' ? front.pages.length : null
  let at = front.pages.length + (contents !== null ? 1 : 0)
  const lensStart = new Map<ColorMode, number>()
  for (const p of lenses) {
    lensStart.set(p.m, at)
    at += p.pages.length
  }
  const findingsStart = at
  at += findings.overview.pages
  const groupStart = new Map<string, number>()
  for (const g of findings.groups) {
    groupStart.set(g.section.letter, at)
    at += g.pages.length
  }
  const appendixStart = appendix.length ? at : null
  at += appendix.length
  return { total: at, contents, lensStart, findingsStart, groupStart, appendixStart }
}
