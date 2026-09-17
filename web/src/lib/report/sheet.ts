import { PdfDoc, PdfPage } from '../vector/doc'
import { Surface } from '../vector/surface'
import { drawRow, fontOf, type Inks, type Slice } from './text'
import type { VectorEnv } from './types'
import { MARGIN, U } from './units'

/* ── The page ─────────────────────────────────────────────────────────── */

export class Sheet {
  /** The surface of the page being drawn — a measuring one before the first page exists. */
  c: Surface
  page: PdfPage | null = null
  readonly W: number
  readonly H: number
  readonly left: number
  readonly right: number
  readonly bottom: number

  constructor(
    readonly doc: PdfDoc,
    readonly paper: { w: number; h: number },
    readonly inks: Inks,
    /** What every page head says it is of — the repo, and the commit. */
    readonly stamp: string,
    readonly env: VectorEnv,
  ) {
    this.W = Math.round(paper.w * U)
    this.H = Math.round(paper.h * U)
    // Measured on a page that is never written: layout runs before the first page is begun.
    this.c = new Surface(new PdfPage(doc, paper.w, paper.h), env.fonts, env.vars, U)
    this.left = MARGIN * U
    this.right = this.W - MARGIN * U
    this.bottom = this.H - MARGIN * U
  }

  get width(): number {
    return this.right - this.left
  }

  /** Page `index` of the document, begun on white paper.
   *
   *  **The paper is painted, not assumed.** A PDF page has no backdrop until something is drawn,
   *  and the findings maps are grayed with a `saturation` blend, which over nothing is the blend's
   *  own gray: every findings figure came out on a solid gray square. Over white it is white. */
  begin(index: number) {
    this.page = this.doc.pageAt(index, this.paper.w, this.paper.h)
    this.c = new Surface(this.page, this.env.fonts, this.env.vars, U)
    this.c.fillStyle = this.inks.bg
    this.c.fillRect(0, 0, this.W, this.H)
  }

  /** One line of `s` in the report's own faces, with `y` its alphabetic BASELINE rather than its
   *  top. `optical` moves the string so its first ink, not its advance box, sits at `x` — see
   *  `bearing`. The alignment is put back to `left` afterwards: the surface is shared by every
   *  draw on the page, and a `right` left behind would move the next one that doesn't set its own. */
  text(
    s: string,
    x: number,
    y: number,
    o: { size: number; bold?: boolean; mono?: boolean; color?: string; align?: CanvasTextAlign; optical?: boolean },
  ) {
    const c = this.c
    const shift = o.optical ? this.bearing(s, o.size, o.bold, o.mono) : 0
    c.font = fontOf({ text: s, bold: o.bold, mono: o.mono }, o.size)
    c.fillStyle = o.color ?? this.inks.fg
    c.textAlign = o.align ?? 'left'
    c.textBaseline = 'alphabetic'
    c.fillText(s, x + shift, y)
    c.textAlign = 'left'
  }

  /** The shift that puts a string's first ink at its origin. **A title aligns by its ink.** The
   *  side bearing grows with the type, so a 22pt title set at the margin sat visibly right of the
   *  7.5pt eyebrow above it. Read off the glyph's own side bearing in the face that prints it — it
   *  was measured off pixels on a scratch canvas, because WebKit's `actualBoundingBoxLeft` was not
   *  the number its `fillText` drew by. */
  bearing(s: string, size: number, bold = false, mono = false): number {
    const f = this.c.fontSpec(fontOf({ text: s, bold, mono }, size))
    return f.face.bearing(s, f.size)
  }

  measure(s: string, size: number, bold = false, mono = false): number {
    this.c.font = fontOf({ text: s, bold, mono }, size)
    return this.c.measureText(s).width
  }

  rule(y: number, x = this.left, w = this.width) {
    this.c.fillStyle = this.inks.border
    this.c.fillRect(x, y, w, Math.max(1, 0.6 * U))
  }

  /** A link from a rectangle on this page, in layout pixels, to page `target`. */
  link(x0: number, y0: number, x1: number, y1: number, target: number) {
    if (!this.page) return
    const [a, b] = this.c.toPage(x0, y1)
    const [c, d] = this.c.toPage(x1, y0)
    this.page.links.push({ rect: [a, b, c, d], page: target })
  }

  /** Eyebrow and title. The body starts at `HEADER_BOTTOM`. `width` narrows the head to a column
   *  — a deck's lens slide, whose map rises beside a head that spans only its text. The commit is
   *  not here: the footer carries it, once a page. */
  header(eyebrow: string, title: string, mono = false, o: { width?: number } = {}) {
    const width = o.width ?? this.width
    let y = (MARGIN + 8) * U
    this.text(eyebrow.toUpperCase(), this.left, y, { size: 7.5, bold: true, color: this.inks.muted, optical: true })
    y += 25 * U
    const t = fitText(this, title, 22, width, { bold: true, mono, floor: 12 })
    this.text(t.text, this.left, y, { size: t.size, bold: true, mono, optical: true })
    this.rule(y + 10 * U, this.left, width)
  }

  /** The head of a page that carries on from the one before. The body starts at `CONTINUED_TOP`. */
  continued(eyebrow: string, title: string, mono = false) {
    let y = (MARGIN + 8) * U
    this.text(eyebrow.toUpperCase(), this.left, y, { size: 7.5, bold: true, color: this.inks.muted, optical: true })
    y += 25 * U
    const t = fitText(this, title, 16, this.width, { bold: true, mono, floor: 9 })
    this.text(t.text, this.left, y, { size: t.size, bold: true, mono, optical: true })
    this.rule(y + 9 * U)
  }

  /** The credit and the commit, at the foot of every page.
   *
   *  **The commit is stated once a page, and this is the page's quiet end.** It ran in the head of
   *  all forty-four pages beside the section, where a string nobody reads was the second thing on
   *  every one of them; a report is stamped for checking, not for reminding. */
  footer(n: number, of: number) {
    const y = this.H - 22 * U
    this.text(`charted by sanity.monster · ${this.stamp}`, this.left, y, {
      size: 7.5,
      color: this.inks.muted,
    })
    this.text(`${n} / ${of}`, this.right, y, { size: 7.5, color: this.inks.muted, align: 'right' })
  }
}

/** A string that fits `maxW`: shrunk toward `floor`, and only then cut from the middle, where a
 *  path loses the least — its head says which corner, its tail which file. */
export function fitText(
  sheet: Sheet,
  s: string,
  size: number,
  maxW: number,
  o: { bold?: boolean; mono?: boolean; floor?: number } = {},
): { text: string; size: number } {
  const floor = o.floor ?? size * 0.75
  let fs = size
  while (fs > floor && sheet.measure(s, fs, o.bold, o.mono) > maxW) fs -= 0.25
  if (sheet.measure(s, fs, o.bold, o.mono) <= maxW) return { text: s, size: fs }
  const cut = (n: number) => `${s.slice(0, Math.ceil(n / 2))}…${s.slice(s.length - Math.floor(n / 2))}`
  let keep = s.length - 1
  while (keep > 2 && sheet.measure(cut(keep), fs, o.bold, o.mono) > maxW) keep -= 1
  return { text: cut(keep), size: fs }
}

/** A rounded rectangle, spelled out — `roundRect` is newer than the WebKit this has to run on. */
export function pill(c: Surface, x: number, y: number, w: number, h: number) {
  const r = Math.min(h, w) / 2
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

export function drawSlices(sheet: Sheet, slices: Slice[]) {
  for (const s of slices) {
    let y = s.region.top
    s.rows.forEach((r, j) => {
      if (j) y += r.gap
      drawRow(sheet.c, r, s.region.x, y, sheet.inks)
      y += r.lead
    })
  }
}
