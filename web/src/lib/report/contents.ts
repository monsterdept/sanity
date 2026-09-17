import { FAMILIES, MODE_LABEL, type ColorMode } from '../colorMode'
import { APPENDIX } from '../reportProse'
import type { FindingsPlan } from './findings'
import type { Frame } from './frame'
import type { Section } from './grid'
import { fitText, type Sheet } from './sheet'
import { drawLine, setLines } from './text'
import type { Report } from './types'
import { HEADER_BOTTOM, lead, U } from './units'

/**
 * The contents page, drawn last, because it names every other page. Only a report has one.
 */

/** Where every section starts, once every page has been counted. */
export interface Book {
  total: number
  /** The contents page, or null in a form without one. */
  contents: number | null
  lensStart: Map<ColorMode, number>
  findingsStart: number
  groupStart: Map<string, number>
  /** The appendix's first page, or null where there is none. */
  appendixStart: number | null
}

const SIZE = 11

/** The page being set, from the top down. */
class Toc {
  y = HEADER_BOTTOM + 10 * U

  constructor(readonly sheet: Sheet) {}

  /** A row naming a page, dotted to its number and linked to it. `left`, `right` and `at` set the
   *  row in a column of its own — see the group list, which runs in two. Left out, it spans the
   *  page at the running `y`, as every other row does. */
  row(
    label: string,
    page: string,
    o: { indent?: number; mono?: boolean; muted?: boolean; left?: number; right?: number; at?: number } = {},
  ) {
    const { sheet } = this
    const c = sheet.c
    const x = (o.left ?? sheet.left) + (o.indent ?? 0)
    const right = o.right ?? sheet.right
    const top = o.at ?? this.y
    const pw = sheet.measure(page, SIZE)
    const t = fitText(sheet, label, SIZE, right - x - pw - 24 * U, { mono: o.mono, floor: 8 })
    sheet.text(t.text, x, top, { size: t.size, mono: o.mono, color: o.muted ? sheet.inks.muted : sheet.inks.fg })
    if (!page) return
    c.fillStyle = sheet.inks.border
    for (let dx = x + sheet.measure(t.text, t.size, false, o.mono) + 8 * U; dx < right - pw - 8 * U; dx += 4 * U) {
      c.fillRect(dx, top - 1.5 * U, 1 * U, 1 * U)
    }
    sheet.text(page, right, top, { size: SIZE })
    // The row is a link to what it names.
    sheet.link(x, top - SIZE * U, right, top + 4 * U, Number(page) - 1)
  }

  eyebrow(text: string) {
    this.sheet.text(text.toUpperCase(), this.sheet.left, this.y, { size: 7.5, bold: true, color: this.sheet.inks.muted })
    this.y += 16 * U
  }
}

export function drawContents(
  f: Frame,
  book: Book,
  findings: FindingsPlan,
  /** Lenses left out for having one value, with the sentence that is their result. */
  skips: Map<ColorMode, string>,
) {
  const { sheet } = f
  sheet.header('Report', 'Contents')
  const toc = new Toc(sheet)

  toc.row('Abstract and methodology', '1')
  toc.y += 26 * U

  toc.eyebrow('Lenses')
  lensRows(toc, f.o, book.lensStart, skips)
  toc.y += 10 * U

  toc.eyebrow('Findings')
  const n = findings.list.length
  const groups = findings.sections.length
  toc.row(
    `Overview — ${n.toLocaleString()} finding${n === 1 ? '' : 's'} in ${groups} group${groups === 1 ? '' : 's'}`,
    String(book.findingsStart + 1),
  )
  toc.y += 17 * U
  groupRows(toc, findings.sections, book)

  if (book.appendixStart !== null) {
    toc.y += 10 * U
    toc.eyebrow('Appendix')
    toc.row(APPENDIX.title, String(book.appendixStart + 1))
  }
}

/** Every lens by family, with its page, or with why it has none. */
function lensRows(toc: Toc, o: Report, lensStart: Map<ColorMode, number>, skips: Map<ColorMode, string>) {
  const { sheet } = toc
  const c = sheet.c
  for (const fam of FAMILIES) {
    sheet.text(fam.label, sheet.left + 10 * U, toc.y, { size: 8.5, bold: true, color: sheet.inks.muted })
    toc.y += 15 * U
    for (const [i, m] of fam.modes.entries()) {
      const at = lensStart.get(m)
      if (at !== undefined) {
        toc.row(MODE_LABEL[m], String(at + 1), { indent: 20 * U })
        toc.y += 16 * U
        continue
      }
      toc.row(MODE_LABEL[m], '', { indent: 20 * U, muted: true })
      // Lenses skipped for one reason share its sentence, set once under the last of them:
      // the four a reading paints printed the same sentence four times.
      const whyOf = (x: ColorMode) => o.locks[x]?.paper ?? skips.get(x) ?? ''
      const why = whyOf(m)
      const next = fam.modes[i + 1]
      if (next !== undefined && lensStart.get(next) === undefined && whyOf(next) === why) {
        toc.y += 16 * U
        continue
      }
      toc.y += 12 * U
      for (const line of setLines(c, [{ text: `Not in this report. ${why}`, muted: true, italic: true }], sheet.width - 30 * U, 8)) {
        drawLine(c, line, sheet.left + 20 * U, toc.y, 8, sheet.inks)
        toc.y += lead(8)
      }
      toc.y += 6 * U
    }
    toc.y += 6 * U
  }
}

/** **The groups run in two columns where one will not hold them.** ceph has twenty-one, the page
 *  held fourteen, and the other seven — each with pages of its own — were named nowhere on the one
 *  page a reader uses to find anything. Two columns hold twice as many; past that the tail is
 *  counted rather than dropped in silence. */
function groupRows(toc: Toc, sections: Section[], book: Book) {
  const { sheet } = toc
  const rowH = 16 * U
  const fits = Math.max(1, Math.floor((sheet.bottom - toc.y - (book.appendixStart !== null ? 46 * U : 6 * U)) / rowH))
  const two = sections.length > fits
  const perCol = two ? Math.min(fits, Math.ceil(sections.length / 2)) : sections.length
  const shown = Math.min(sections.length, two ? perCol * 2 : perCol)
  // A gutter wide enough that a left column's page number and the next column's letter are two
  // things: at 14pt they touched, and `31` beside `M` read as `31M`.
  const gutter = 28 * U
  const colW = (sheet.width - gutter) / 2
  const top = toc.y
  for (let i = 0; i < shown; i++) {
    const sec = sections[i]
    const second = two && i >= perCol
    toc.row(`${sec.letter}  ${sec.name}  (${sec.entries.length})`, String((book.groupStart.get(sec.letter) ?? 0) + 1), {
      indent: second ? 0 : 20 * U,
      mono: true,
      left: second ? sheet.left + colW + gutter : sheet.left,
      right: two ? (second ? sheet.right : sheet.left + colW) : sheet.right,
      at: top + (second ? i - perCol : i) * rowH,
    })
  }
  toc.y = top + Math.min(shown, perCol) * rowH
  const rest = sections.length - shown
  if (rest > 0) {
    sheet.text(`and ${rest} more group${rest === 1 ? '' : 's'}`, sheet.left + 20 * U, toc.y, { size: 9, color: sheet.inks.muted })
    toc.y += rowH
  }
}
